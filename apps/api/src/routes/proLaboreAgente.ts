// Aries no WhatsApp: o dono conecta o número do agente (QR), aplica nome e
// foto e gera os códigos de vínculo da equipe; cada pessoa também gera o
// próprio código e liga/desliga o resumo da manhã e os avisos.
import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { logger } from '../lib/logger'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { estadoInstancia, evolutionConfigurada, prepararConexao, removerInstancia, configurarWebhook } from '../lib/whatsappEvolution'
import { DONO, aplicarPerfil, codigoLivre, instanciaDoAgente, linkDoCodigo, marcarAgenteConectado, novoSegredo, processarWebhookAgente } from '../lib/agenteMotor'

const router = Router()

const soDono = (req: Request, res: Response, next: NextFunction) => {
  if (req.proLaboreUser!.papel !== 'DONO') { res.status(403).json({ error: 'Só o gestor configura o agente.' }); return }
  next()
}
const urlWebhook = (req: Request, segredo: string) => `${(process.env.API_PUBLIC_URL ?? `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '')}/pro-labore/agente/webhook/${segredo}`
const erroWhatsapp = (e: unknown) => (e instanceof Error ? e.message : 'Falha ao falar com o servidor do WhatsApp')
const VINCULO = { pessoa: true, codigo: true, numero: true, verificadoEm: true, manha: true, alertas: true } as const

function agentePublico(a: { status: string; numero: string | null; nome: string; manhaHora: string; perfilEm: Date | null } | null) {
  return a ? { status: a.status, numero: a.numero, nome: a.nome, manhaHora: a.manhaHora, perfilEm: a.perfilEm } : null
}

// ---------- Gestor ----------

router.get('/agente', requireProLaboreAuth, soDono, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const [agente, dono, vendedores] = await Promise.all([
    prisma.agenteWhatsapp.findUnique({ where: { usuarioId }, include: { vinculos: { select: VINCULO } } }),
    prisma.proLaboreUsuario.findUnique({ where: { id: usuarioId }, select: { nome: true } }),
    prisma.vendedor.findMany({ where: { usuarioId, ativo: true }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
  ])
  const vinculo = (pessoa: string) => {
    const v = agente?.vinculos.find(x => x.pessoa === pessoa)
    return v ? { ...v, link: linkDoCodigo(agente!.numero, v.codigo) } : null
  }
  res.json({
    configurado: evolutionConfigurada(),
    agente: agentePublico(agente),
    pessoas: [{ pessoa: DONO, nome: dono?.nome ?? 'Você', papel: 'DONO', vinculo: vinculo(DONO) }, ...vendedores.map(v => ({ pessoa: v.id, nome: v.nome, papel: 'VENDEDOR', vinculo: vinculo(v.id) }))],
  })
})

const conectarSchema = z.object({ numeroPareamento: z.string().max(20).optional() })
router.post('/agente/conectar', requireProLaboreAuth, soDono, async (req: Request, res: Response) => {
  const p = conectarSchema.safeParse(req.body ?? {})
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  if (!evolutionConfigurada()) { res.status(503).json({ error: 'O servidor do WhatsApp ainda não foi configurado (EVOLUTION_API_URL / EVOLUTION_API_KEY na Vercel).' }); return }
  const usuarioId = req.proLaboreUser!.sub
  const numero = p.data.numeroPareamento?.replace(/\D/g, '')
  if (numero && (numero.length < 10 || numero.length > 15)) { res.status(400).json({ error: 'Número inválido — use DDI + DDD + número, ex.: 55 91 98888-7777' }); return }
  const agente = await prisma.agenteWhatsapp.upsert({
    where: { usuarioId }, update: {},
    create: { usuarioId, instancia: instanciaDoAgente(usuarioId), segredo: novoSegredo() },
  })
  try {
    if ((await estadoInstancia(agente.instancia)) === 'open') {
      await configurarWebhook(agente.instancia, urlWebhook(req, agente.segredo))
      const a = await marcarAgenteConectado(agente)
      res.json({ status: 'CONECTADO', qrBase64: null, pairingCode: null, agente: agentePublico(a) })
      return
    }
    const codigo = await prepararConexao(agente.instancia, urlWebhook(req, agente.segredo), numero)
    await prisma.agenteWhatsapp.update({ where: { id: agente.id }, data: { status: 'CONECTANDO' } })
    res.json({ status: 'CONECTANDO', ...codigo })
  } catch (e) { res.status(502).json({ error: erroWhatsapp(e) }) }
})

// Consultado a cada poucos segundos enquanto o QR está na tela.
router.get('/agente/conexao', requireProLaboreAuth, soDono, async (req: Request, res: Response) => {
  const agente = await prisma.agenteWhatsapp.findUnique({ where: { usuarioId: req.proLaboreUser!.sub } })
  if (!agente) { res.json({ status: 'DESCONECTADO', agente: null }); return }
  try {
    const estado = await estadoInstancia(agente.instancia)
    if (estado === 'open' && agente.status !== 'CONECTADO') { res.json({ status: 'CONECTADO', agente: agentePublico(await marcarAgenteConectado(agente)) }); return }
    if (estado !== 'open' && agente.status === 'CONECTADO') await prisma.agenteWhatsapp.update({ where: { id: agente.id }, data: { status: 'DESCONECTADO' } })
    res.json({ status: estado === 'open' ? 'CONECTADO' : agente.status === 'CONECTANDO' ? 'CONECTANDO' : 'DESCONECTADO', agente: agentePublico(agente) })
  } catch (e) { res.status(502).json({ error: erroWhatsapp(e) }) }
})

router.post('/agente/desconectar', requireProLaboreAuth, soDono, async (req: Request, res: Response) => {
  const agente = await prisma.agenteWhatsapp.findUnique({ where: { usuarioId: req.proLaboreUser!.sub } })
  if (!agente) { res.json({ ok: true }); return }
  try { await removerInstancia(agente.instancia) } catch (e) { logger.warn({ err: e }, 'agente: falha ao remover a instância') }
  await prisma.agenteWhatsapp.update({ where: { id: agente.id }, data: { status: 'DESCONECTADO', numero: null, perfilEm: null } })
  res.json({ ok: true })
})

const configSchema = z.object({
  nome: z.string().trim().min(2, 'Nome muito curto').max(25, 'Nome muito longo').optional(),
  manhaHora: z.string().regex(/^(0[5-9]|1[01]):[0-5]\d$/, 'Horário da manhã entre 05:00 e 11:59').optional(),
})
router.put('/agente/config', requireProLaboreAuth, soDono, async (req: Request, res: Response) => {
  const p = configSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  const atual = await prisma.agenteWhatsapp.findUnique({ where: { usuarioId: req.proLaboreUser!.sub } })
  if (!atual) { res.status(404).json({ error: 'Conecte o número do agente primeiro.' }); return }
  const agente = await prisma.agenteWhatsapp.update({ where: { id: atual.id }, data: p.data })
  if (p.data.nome && p.data.nome !== atual.nome && agente.status === 'CONECTADO') await aplicarPerfil(agente).catch(() => undefined)
  res.json(agentePublico(agente))
})

router.post('/agente/perfil', requireProLaboreAuth, soDono, async (req: Request, res: Response) => {
  const agente = await prisma.agenteWhatsapp.findUnique({ where: { usuarioId: req.proLaboreUser!.sub } })
  if (!agente || agente.status !== 'CONECTADO') { res.status(409).json({ error: 'Conecte o número do agente primeiro.' }); return }
  const r = await aplicarPerfil(agente)
  if (!r.nome && !r.foto) { res.status(502).json({ error: 'O WhatsApp não aceitou o nome nem a foto agora. Tente de novo em instantes.' }); return }
  res.json(r)
})

/** Pessoa válida desta conta: "DONO" ou um vendedor ativo. */
async function pessoaDaConta(usuarioId: string, pessoa: string) {
  if (pessoa === DONO) return true
  return !!(await prisma.vendedor.findFirst({ where: { id: pessoa, usuarioId, ativo: true }, select: { id: true } }))
}

async function gerarCodigo(usuarioId: string, pessoa: string) {
  const agente = await prisma.agenteWhatsapp.findUnique({ where: { usuarioId } })
  if (!agente) return null
  const codigo = await codigoLivre(agente.id)
  // Novo código não desfaz o vínculo atual: o número só muda quando o código novo chegar do WhatsApp.
  const v = await prisma.agenteVinculo.upsert({ where: { agenteId_pessoa: { agenteId: agente.id, pessoa } }, update: { codigo }, create: { agenteId: agente.id, pessoa, codigo }, select: VINCULO })
  return { ...v, link: linkDoCodigo(agente.numero, codigo), agenteNumero: agente.numero }
}

const preferenciasSchema = z.object({ manha: z.boolean().optional(), alertas: z.boolean().optional() })

router.post('/agente/vinculos/:pessoa/codigo', requireProLaboreAuth, soDono, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub, pessoa = String(req.params.pessoa)
  if (!(await pessoaDaConta(usuarioId, pessoa))) { res.status(404).json({ error: 'Pessoa não encontrada' }); return }
  const r = await gerarCodigo(usuarioId, pessoa)
  if (!r) { res.status(409).json({ error: 'Conecte o número do agente primeiro.' }); return }
  res.json(r)
})

router.patch('/agente/vinculos/:pessoa', requireProLaboreAuth, soDono, async (req: Request, res: Response) => {
  const p = preferenciasSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  const r = await prisma.agenteVinculo.updateMany({ where: { pessoa: String(req.params.pessoa), agente: { usuarioId: req.proLaboreUser!.sub } }, data: p.data })
  if (!r.count) { res.status(404).json({ error: 'Vínculo não encontrado' }); return }
  res.json({ ok: true })
})

router.delete('/agente/vinculos/:pessoa', requireProLaboreAuth, soDono, async (req: Request, res: Response) => {
  await prisma.agenteVinculo.deleteMany({ where: { pessoa: String(req.params.pessoa), agente: { usuarioId: req.proLaboreUser!.sub } } })
  res.json({ ok: true })
})

// ---------- Cada pessoa (o próprio vínculo) ----------

const minhaPessoa = (req: Request) => (req.proLaboreUser!.papel === 'DONO' ? DONO : req.proLaboreUser!.vendedorId ?? null)

router.get('/agente/meu', requireProLaboreAuth, async (req: Request, res: Response) => {
  const pessoa = minhaPessoa(req)
  const agente = await prisma.agenteWhatsapp.findUnique({ where: { usuarioId: req.proLaboreUser!.sub } })
  if (!agente || !pessoa) { res.json({ agente: null, vinculo: null }); return }
  const v = await prisma.agenteVinculo.findUnique({ where: { agenteId_pessoa: { agenteId: agente.id, pessoa } }, select: VINCULO })
  res.json({ agente: { status: agente.status, numero: agente.numero, nome: agente.nome, manhaHora: agente.manhaHora }, vinculo: v ? { ...v, link: linkDoCodigo(agente.numero, v.codigo) } : null })
})

router.post('/agente/meu/codigo', requireProLaboreAuth, async (req: Request, res: Response) => {
  const pessoa = minhaPessoa(req)
  if (!pessoa) { res.status(403).json({ error: 'Seu login não está ligado a ninguém da equipe.' }); return }
  const r = await gerarCodigo(req.proLaboreUser!.sub, pessoa)
  if (!r) { res.status(409).json({ error: 'O gestor ainda não conectou o número do agente.' }); return }
  res.json(r)
})

router.patch('/agente/meu', requireProLaboreAuth, async (req: Request, res: Response) => {
  const pessoa = minhaPessoa(req)
  const p = preferenciasSchema.safeParse(req.body)
  if (!pessoa || !p.success) { res.status(400).json({ error: p.success ? 'Seu login não está ligado a ninguém da equipe.' : p.error.issues[0].message }); return }
  const r = await prisma.agenteVinculo.updateMany({ where: { pessoa, agente: { usuarioId: req.proLaboreUser!.sub } }, data: p.data })
  if (!r.count) { res.status(404).json({ error: 'Vínculo não encontrado' }); return }
  res.json({ ok: true })
})

router.delete('/agente/meu', requireProLaboreAuth, async (req: Request, res: Response) => {
  const pessoa = minhaPessoa(req)
  if (pessoa) await prisma.agenteVinculo.deleteMany({ where: { pessoa, agente: { usuarioId: req.proLaboreUser!.sub } } })
  res.json({ ok: true })
})

// ---------- Webhook (servidor do WhatsApp) ----------

router.post('/agente/webhook/:segredo', async (req: Request, res: Response) => {
  try {
    const status = await processarWebhookAgente(String(req.params.segredo), req.body)
    res.status(status).json({ ok: status === 200 })
  } catch (e) {
    logger.error({ err: e }, 'agente: erro no webhook')
    res.json({ ok: false })
  }
})

export default router
