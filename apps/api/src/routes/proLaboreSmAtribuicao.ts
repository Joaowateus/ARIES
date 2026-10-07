// Tela 06 · Vendas por post (seção 9) e o link rastreado (seção 3.5).
// - POST /sm/r/:slug é público: a página /r/{slug} do front registra o toque
//   e recebe o endereço do WhatsApp da loja com o código na mensagem.
// - A tela pede o módulo Vendas em Leitura; os valores em R$ seguem a regra
//   "Mostrar valores em R$" (o gestor sempre vê).
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { contextoSM, requireGestorSM, requireModuloSM } from '../lib/smAcesso'
import { garantirLinkBio, normalizarWhatsapp, periodoDosUltimosDias, registrarToque, sincronizarLinks, vendasPorPost } from '../lib/smAtribuicao'

const router = Router()
const autenticado = [requireProLaboreAuth, contextoSM]

router.post('/sm/r/:slug', async (req: Request, res: Response) => {
  const slug = String(req.params.slug).toLowerCase()
  if (!/^[a-z0-9]{4,16}$/.test(slug)) { res.status(404).json({ error: 'Link não encontrado' }); return }
  const r = await registrarToque(slug, req.ip ?? '', String(req.headers['user-agent'] ?? ''))
  if ('url' in r) { res.json(r); return }
  if (r.erro === 'NAO_ENCONTRADO') { res.status(404).json({ error: 'Link não encontrado' }); return }
  res.status(409).json({ error: 'O WhatsApp da loja ainda não foi configurado', codigo: r.codigo })
})

const DIAS = [7, 30, 90] as const

router.get('/sm/vendas-por-post', ...autenticado, requireModuloSM('vendas', 'LEITURA'), async (req: Request, res: Response) => {
  const sm = req.sm!
  const usuarioId = sm.usuarioId
  const pedido = Number(req.query.dias)
  const dias = (DIAS as readonly number[]).includes(pedido) ? pedido : 30
  await sincronizarLinks(usuarioId)
  const mostrarValores = sm.visao === 'GESTOR' || sm.permissoes.regras.mostrarValores
  const [relatorio, bio, config] = await Promise.all([
    vendasPorPost(usuarioId, periodoDosUltimosDias(dias), { mostrarValores }),
    garantirLinkBio(usuarioId),
    prisma.smConfig.findUnique({ where: { usuarioId }, select: { whatsappLoja: true } }),
  ])
  res.json({
    ...relatorio,
    links: { bio: { slug: bio.slug, codigo: bio.codigo, toques: bio.cliques }, whatsappLoja: config?.whatsappLoja ?? null },
    podeCriarPautas: sm.pode('producao', 'COMPLETO') && !sm.somenteLeitura,
    souGestor: sm.visao === 'GESTOR' && !sm.verComo,
  })
})

router.put('/sm/gestor/whatsapp', ...autenticado, requireGestorSM, async (req: Request, res: Response) => {
  const parse = z.object({ numero: z.string().trim().max(30).nullable() }).safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: 'Informe o número com DDD' }); return }
  const numero = parse.data.numero ? normalizarWhatsapp(parse.data.numero) : null
  if (parse.data.numero && !numero) { res.status(400).json({ error: 'Número inválido. Use DDD + número, ex.: (91) 98888-7777' }); return }
  const usuarioId = req.sm!.usuarioId
  await prisma.smConfig.upsert({ where: { usuarioId }, create: { usuarioId, whatsappLoja: numero }, update: { whatsappLoja: numero } })
  res.json({ whatsappLoja: numero })
})

// "Criar pautas no mesmo formato" do banner: uma ideia por post de origem,
// com o mesmo formato, pilar e gancho como ponto de partida.
router.post('/sm/vendas-por-post/pautas', ...autenticado, requireModuloSM('vendas', 'LEITURA'), requireModuloSM('producao', 'COMPLETO'), async (req: Request, res: Response) => {
  const parse = z.object({ codigos: z.array(z.string().max(30)).min(1).max(3) }).safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: 'Escolha os posts de referência' }); return }
  const usuarioId = req.sm!.usuarioId
  const origens = await prisma.smPauta.findMany({ where: { usuarioId, codigo: { in: parse.data.codigos } }, select: { codigo: true, titulo: true, formato: true, pilar: true, gancho: true } })
  const ultima = await prisma.smPauta.findFirst({ where: { usuarioId, status: 'IDEIA' }, orderBy: { ordem: 'desc' }, select: { ordem: true } })
  let ordem = (ultima?.ordem ?? 0) + 1
  const criadas: { id: string; titulo: string }[] = []
  for (const o of origens) {
    const origemRef = `atribuicao:${o.codigo}`
    const ja = await prisma.smPauta.findFirst({ where: { usuarioId, origemRef, status: { not: 'PUBLICADO' } }, select: { id: true } })
    if (ja) continue
    const titulo = `No formato de "${o.titulo}"`.slice(0, 120)
    const p = await prisma.smPauta.create({
      data: {
        usuarioId, titulo, formato: o.formato, pilar: o.pilar, gancho: o.gancho, origem: 'INSIGHT', origemRef, ordem: ordem++,
        criadoPor: req.sm!.visao === 'GESTOR' ? 'GESTOR' : 'SOCIAL_MEDIA',
      },
      select: { id: true, titulo: true },
    })
    criadas.push(p)
  }
  res.status(201).json({ criadas, jaExistiam: origens.length - criadas.length })
})

export default router
