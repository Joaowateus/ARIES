// Vitrine do estoque no Assistente Comercial (aba "Estoque"): a ficha de
// cada moto que vai para o cliente no WhatsApp — fotos, km, versão,
// cilindrada, destaques, ficha técnica, vídeo e preço opcional. Usa as
// mesmas motos do estoque leve do Social Media. Editar e ligar/desligar o
// preço é da gestão; o vendedor vê e envia.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { requireModulo } from '../lib/acessos'
import { chaveDaImagem } from '../lib/armazenamento'
import { SELECT_MOTO_VITRINE, esquecerVitrine, paraVitrine } from '../lib/assistenteRespostas'
import { fichaTexto, nomeDaMoto } from '../lib/assistenteVitrine'

const router = Router()
const ver = [requireProLaboreAuth, requireModulo('assistente', 'VER')]
const editar = [requireProLaboreAuth, requireModulo('assistente', 'EDITAR')]
const daGestao = (req: Request) => req.proLaboreUser!.papel === 'DONO' || req.proLaboreUser!.papel === 'SUPERVISOR'
const erro = (res: Response, status: number, mensagem: string) => res.status(status).json({ error: mensagem })
const MAX_FOTOS = 6
const DIA = 86_400_000

// O robô e as sugestões usam a versão nova já na próxima mensagem.
router.use('/assistente/vitrine', (req: Request, res: Response, next) => {
  if (req.method !== 'GET') res.on('finish', () => { if (req.proLaboreUser) esquecerVitrine(req.proLaboreUser.sub) })
  next()
})

router.get('/assistente/vitrine', ...ver, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const [motos, loja] = await Promise.all([
    prisma.smMotoEstoque.findMany({
      where: { usuarioId, OR: [{ situacao: { not: 'VENDIDA' } }, { saidaEm: { gte: new Date(Date.now() - 30 * DIA) } }] },
      select: { ...SELECT_MOTO_VITRINE, entradaEm: true, enviosWhatsapp: true },
      orderBy: [{ situacao: 'asc' }, { entradaEm: 'desc' }],
    }),
    prisma.assistenteLoja.findUnique({ where: { usuarioId } }),
  ])
  const mostrarPreco = loja?.mostrarPreco ?? false
  res.json({
    motos: motos.map(m => {
      const v = paraVitrine(m)
      return { ...v, entradaEm: m.entradaEm, enviosWhatsapp: m.enviosWhatsapp, nome: nomeDaMoto(v), previa: fichaTexto(v, { mostrarPreco }) }
    }),
    config: { mostrarPreco, vitrineRobo: loja?.vitrineRobo ?? true },
    podeEditar: daGestao(req),
  })
})

router.put('/assistente/vitrine/config', ...editar, async (req: Request, res: Response) => {
  if (!daGestao(req)) return erro(res, 403, 'Só o dono ou o supervisor muda a vitrine')
  const p = z.object({ mostrarPreco: z.boolean().optional(), vitrineRobo: z.boolean().optional() }).safeParse(req.body)
  if (!p.success) return erro(res, 400, 'Configuração inválida')
  const usuarioId = req.proLaboreUser!.sub
  const loja = await prisma.assistenteLoja.upsert({ where: { usuarioId }, update: p.data, create: { usuarioId, ...p.data } })
  res.json({ mostrarPreco: loja.mostrarPreco, vitrineRobo: loja.vitrineRobo })
})

const texto = (max: number) => z.string().trim().max(max).transform(v => v || null).nullable().optional()
const motoSchema = z.object({
  modelo: z.string().trim().min(2, 'Informe o modelo').max(80),
  marca: texto(40),
  ano: z.number().int().min(1950).max(2100).nullable().optional(),
  cor: texto(40),
  versao: texto(60),
  km: z.number().int().min(0).max(2_000_000).nullable().optional(),
  cilindrada: z.number().int().min(30).max(3000).nullable().optional(),
  preco: z.number().min(0).max(10_000_000).nullable().optional(),
  situacao: z.enum(['DISPONIVEL', 'RESERVADA', 'VENDIDA']).optional(),
  destaques: z.array(z.string().trim().max(60)).max(8).transform(l => l.filter(Boolean)).optional(),
  ficha: z.array(z.object({ rotulo: z.string().trim().max(40), valor: z.string().trim().max(80) })).max(12).transform(l => l.filter(f => f.rotulo && f.valor)).optional(),
  fotos: z.array(z.string()).max(MAX_FOTOS, `No máximo ${MAX_FOTOS} fotos`).optional(),
  videoUrl: z.string().trim().max(300).refine(v => !v || /^https?:\/\/\S+$/i.test(v), 'O vídeo precisa ser um link (https://...)').transform(v => v || null).nullable().optional(),
})

// Só fotos guardadas por esta conta (o caminho é público, mas a chave não
// pode vir de outra loja).
async function fotosValidas(usuarioId: string, fotos: string[] | undefined): Promise<boolean> {
  if (!fotos?.length) return true
  const chaves = fotos.map(chaveDaImagem)
  if (chaves.some(c => !c)) return false
  return (await prisma.imagemUpload.count({ where: { chave: { in: chaves as string[] }, usuarioId } })) === new Set(chaves).size
}

router.post('/assistente/vitrine', ...editar, async (req: Request, res: Response) => {
  if (!daGestao(req)) return erro(res, 403, 'Só o dono ou o supervisor cadastra motos')
  const p = motoSchema.safeParse(req.body)
  if (!p.success) return erro(res, 400, p.error.issues[0].message)
  const usuarioId = req.proLaboreUser!.sub
  if (!(await fotosValidas(usuarioId, p.data.fotos))) return erro(res, 400, 'Foto inválida')
  const { ficha, ...d } = p.data
  const moto = await prisma.smMotoEstoque.create({
    data: { usuarioId, ...d, entradaEm: new Date(), ...(ficha && { ficha: ficha as Prisma.InputJsonValue }), saidaEm: d.situacao === 'VENDIDA' ? new Date() : null },
    select: { id: true },
  })
  res.status(201).json(moto)
})

router.patch('/assistente/vitrine/:id', ...editar, async (req: Request, res: Response) => {
  if (!daGestao(req)) return erro(res, 403, 'Só o dono ou o supervisor edita a vitrine')
  const p = motoSchema.partial().safeParse(req.body)
  if (!p.success) return erro(res, 400, p.error.issues[0].message)
  const usuarioId = req.proLaboreUser!.sub
  const atual = await prisma.smMotoEstoque.findFirst({ where: { id: String(req.params.id), usuarioId }, select: { id: true, situacao: true, saidaEm: true } })
  if (!atual) return erro(res, 404, 'Moto não encontrada')
  if (!(await fotosValidas(usuarioId, p.data.fotos))) return erro(res, 400, 'Foto inválida')
  const { ficha, ...d } = p.data
  const situacao = d.situacao ?? atual.situacao
  await prisma.smMotoEstoque.update({
    where: { id: atual.id },
    data: { ...d, ...(ficha && { ficha: ficha as Prisma.InputJsonValue }), saidaEm: situacao === 'VENDIDA' ? atual.saidaEm ?? new Date() : null },
  })
  res.json({ ok: true })
})

export default router
