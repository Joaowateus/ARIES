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
import { SIMULACAO_PADRAO, lerConfigSimulacao, resumoSimulacao, simular, textoSimulacao } from '../lib/assistenteSimulacao'
import { primeiroNome } from '../lib/assistenteRoteiro'

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

// Preferências da loja para o Assistente (valem para todos os vendedores).
router.get('/assistente/loja', ...ver, async (req: Request, res: Response) => {
  const loja = await prisma.assistenteLoja.findUnique({ where: { usuarioId: req.proLaboreUser!.sub } })
  res.json({ mostrarPreco: loja?.mostrarPreco ?? false, vitrineRobo: loja?.vitrineRobo ?? true, avancoAutomatico: loja?.avancoAutomatico ?? true, podeEditar: daGestao(req) })
})
router.put('/assistente/loja', ...editar, async (req: Request, res: Response) => {
  if (!daGestao(req)) return erro(res, 403, 'Só o dono ou o supervisor muda as preferências da loja')
  const p = z.object({ mostrarPreco: z.boolean().optional(), vitrineRobo: z.boolean().optional(), avancoAutomatico: z.boolean().optional() }).safeParse(req.body)
  if (!p.success) return erro(res, 400, 'Preferência inválida')
  const usuarioId = req.proLaboreUser!.sub
  const loja = await prisma.assistenteLoja.upsert({ where: { usuarioId }, update: p.data, create: { usuarioId, ...p.data } })
  esquecerVitrine(usuarioId)
  res.json({ mostrarPreco: loja.mostrarPreco, vitrineRobo: loja.vitrineRobo, avancoAutomatico: loja.avancoAutomatico, podeEditar: true })
})

// Simulação de financiamento (aba "Simulação"): taxas de referência da loja.
// Começa desligada e só liga depois de as taxas serem salvas.
const configSimulacaoSchema = z.object({
  taxas: z.array(z.object({
    prazo: z.number().int().min(6, 'Prazo entre 6 e 72 meses').max(72, 'Prazo entre 6 e 72 meses'),
    taxa: z.number().min(0, 'Taxa entre 0 e 10% ao mês').max(10, 'Taxa entre 0 e 10% ao mês'),
  })).min(1, 'Cadastre pelo menos um prazo').max(6, 'No máximo 6 prazos'),
  entradaMinimaPct: z.number().min(0).max(90),
  perguntarRenda: z.boolean(),
  comprometimentoMax: z.number().min(10).max(60),
  aviso: z.string().trim().max(300),
  bancos: z.array(z.string().trim().min(1).max(40)).max(8, 'No máximo 8 bancos'),
  preAnalise: z.boolean(),
}).partial()

router.get('/assistente/simulacao', ...ver, async (req: Request, res: Response) => {
  const loja = await prisma.assistenteLoja.findUnique({ where: { usuarioId: req.proLaboreUser!.sub }, select: { simulacaoAtiva: true, simulacaoConfig: true, mostrarPreco: true } })
  const salva = !!loja?.simulacaoConfig
  res.json({
    ativa: salva && !!loja?.simulacaoAtiva, salva,
    config: salva ? lerConfigSimulacao(loja!.simulacaoConfig) : SIMULACAO_PADRAO,
    mostrarPreco: loja?.mostrarPreco ?? false, podeEditar: daGestao(req),
  })
})

router.put('/assistente/simulacao', ...editar, async (req: Request, res: Response) => {
  if (!daGestao(req)) return erro(res, 403, 'Só o dono ou o supervisor muda a simulação')
  const p = z.object({ ativa: z.boolean().optional(), config: configSimulacaoSchema.optional() }).safeParse(req.body)
  if (!p.success) return erro(res, 400, p.error.issues[0].message)
  const usuarioId = req.proLaboreUser!.sub
  const atual = await prisma.assistenteLoja.findUnique({ where: { usuarioId }, select: { simulacaoConfig: true, simulacaoAtiva: true } })
  const base = atual?.simulacaoConfig ? lerConfigSimulacao(atual.simulacaoConfig) : SIMULACAO_PADRAO
  const config = p.data.config ? lerConfigSimulacao({ ...base, ...p.data.config }) : atual?.simulacaoConfig ? base : null
  if (p.data.ativa && !config) return erro(res, 400, 'Salve as taxas antes de ligar a simulação')
  const data = {
    ...(config && { simulacaoConfig: config as unknown as Prisma.InputJsonValue }),
    ...(p.data.ativa !== undefined && { simulacaoAtiva: p.data.ativa }),
  }
  const loja = await prisma.assistenteLoja.upsert({ where: { usuarioId }, update: data, create: { usuarioId, ...data } })
  esquecerVitrine(usuarioId)
  res.json({ ativa: !!loja.simulacaoConfig && loja.simulacaoAtiva, salva: !!loja.simulacaoConfig, config: lerConfigSimulacao(loja.simulacaoConfig), mostrarPreco: loja.mostrarPreco, podeEditar: true })
})

// Prévia na aba: o que o cliente recebe e a leitura que vai para o vendedor,
// com as taxas na tela (mesmo antes de salvar).
router.post('/assistente/simulacao/previa', ...ver, async (req: Request, res: Response) => {
  const p = z.object({
    config: configSimulacaoSchema.optional(),
    valor: z.number().min(1, 'Informe o valor da moto').max(10_000_000),
    entrada: z.number().min(0).max(10_000_000).nullable().optional(),
    renda: z.number().min(0).max(10_000_000).nullable().optional(),
    vendedor: z.string().trim().max(80).optional(),
  }).safeParse(req.body)
  if (!p.success) return erro(res, 400, p.error.issues[0].message)
  const usuarioId = req.proLaboreUser!.sub
  const loja = await prisma.assistenteLoja.findUnique({ where: { usuarioId }, select: { simulacaoConfig: true, mostrarPreco: true } })
  const cfg = lerConfigSimulacao({ ...(loja?.simulacaoConfig ? lerConfigSimulacao(loja.simulacaoConfig) : SIMULACAO_PADRAO), ...p.data.config })
  const r = simular({ valor: p.data.valor, entrada: p.data.entrada ?? null, renda: p.data.renda ?? null, cfg })
  if (!r) return erro(res, 400, 'A entrada cobre o valor: não há o que financiar')
  const vendedor = primeiroNome(p.data.vendedor || req.proLaboreUser!.nome) || 'O vendedor'
  res.json({
    resultado: r,
    texto: textoSimulacao(r, { moto: null, mostrarPreco: loja?.mostrarPreco ?? false, aviso: cfg.aviso.replace(/\{vendedor\}/g, vendedor), vendedor }),
    resumo: resumoSimulacao(r),
  })
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
