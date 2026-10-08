// Espaço do papel Social Media: identidade do papel, permissões (tela 07) e
// convite. As regras de acesso ficam em lib/smAcesso.ts.
import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { signProLaboreToken } from '../lib/jwtProLabore'
import { MODULOS_SM, NIVEIS_SM, NIVEIS_PADRAO, REGRAS_PADRAO, carregarPermissoes, comoSocialMedia, contextoSM, niveisCompletos, requireGestorSM } from '../lib/smAcesso'
import { emailConfigurado, enviarEmail, escaparHtml } from '../lib/email'
import { montarHoje } from '../lib/smHoje'
import { iaLigada } from '../lib/smIA'
import { podeRoteiroIA } from '../lib/smPerguntas'
import { MOMENTOS, generoDe, montarRecepcao, recolherVisita, simularRecepcao, type Momento } from '../lib/smSaudacao'
import { atorDe } from '../lib/smInsights'

const router = Router()
const autenticado = [requireProLaboreAuth, contextoSM]

const PRAZO_CONVITE_MS = 7 * 24 * 3600 * 1000
const hashConvite = (token: string) => crypto.createHash('sha256').update(token).digest('hex')

/** A conta do Instagram que o papel enxerga: a conectada pelo dono. */
async function contaDaOperacao(usuarioId: string) {
  return prisma.socialMediaConta.findUnique({
    where: { titular: `dono:${usuarioId}` },
    select: { nomeUsuario: true, nomeExibicao: true, tipoConexao: true, ultimaSincronizacaoEm: true, ultimoErroSync: true, falhasSeguidas: true, proximaTentativaEm: true },
  })
}

type StatusConta = 'ok' | 'warn' | 'bad' | 'neutro'
const HORAS_ATRASO = 3

function resumoConta(conta: Awaited<ReturnType<typeof contaDaOperacao>>) {
  if (!conta) return null
  let status: StatusConta = 'ok'
  if (conta.falhasSeguidas > 0 && conta.ultimoErroSync) status = 'bad'
  else if (!conta.ultimaSincronizacaoEm) status = 'neutro'
  else if (Date.now() - conta.ultimaSincronizacaoEm.getTime() > HORAS_ATRASO * 3600 * 1000) status = 'warn'
  return {
    usuario: conta.nomeUsuario,
    nome: conta.nomeExibicao,
    tipoConexao: conta.tipoConexao,
    status,
    ultimaSincronizacaoEm: conta.ultimaSincronizacaoEm,
    erro: status === 'bad' ? conta.ultimoErroSync : null,
    proximaTentativaEm: status === 'bad' ? conta.proximaTentativaEm : null,
  }
}

function statusMembro(m: { ativo: boolean; senhaHash: string | null; conviteExpiraEm: Date | null }) {
  if (!m.ativo) return 'SUSPENSO'
  if (m.senhaHash) return 'ATIVO'
  if (m.conviteExpiraEm && m.conviteExpiraEm.getTime() < Date.now()) return 'CONVITE_EXPIRADO'
  return 'CONVIDADO'
}

// ---------- Quem sou eu no espaço do Social Media ----------

router.get('/sm/eu', ...autenticado, async (req: Request, res: Response) => {
  const sm = req.sm!
  const [membro, conta] = await Promise.all([
    prisma.smMembro.findUnique({ where: { usuarioId: sm.usuarioId }, select: { id: true, nome: true, tratamento: true, email: true, primeiroAcessoEm: true } }),
    contaDaOperacao(sm.usuarioId),
  ])
  const papel = req.proLaboreUser!.papel
  // No "ver como", a pessoa exibida é o responsável (se já houver um).
  const pessoa = papel === 'SOCIAL_MEDIA' || sm.verComo
    ? { nome: membro?.nome ?? 'Social Media', tratamento: membro?.tratamento ?? membro?.nome?.split(' ')[0] ?? null }
    : { nome: req.proLaboreUser!.nome, tratamento: req.proLaboreUser!.nome.split(' ')[0] }
  if (papel === 'SOCIAL_MEDIA' && membro && !membro.primeiroAcessoEm) {
    // A tela de primeiro acesso (Fase 4) usa este marco; aqui só registra.
    await prisma.smMembro.update({ where: { id: membro.id }, data: { primeiroAcessoEm: new Date() } })
  }
  res.json({
    visao: sm.visao,
    verComo: sm.verComo,
    somenteLeitura: sm.somenteLeitura,
    pessoa,
    primeiroAcesso: papel === 'SOCIAL_MEDIA' && !!membro && !membro.primeiroAcessoEm,
    niveis: sm.visao === 'GESTOR' ? Object.fromEntries(MODULOS_SM.map(m => [m, 'COMPLETO'])) : sm.permissoes.niveis,
    regras: sm.permissoes.regras,
    // IA ligada (chave no ambiente) e ganchos/roteiros liberados para quem vê.
    ia: { ligada: iaLigada(), roteiro: podeRoteiroIA(sm) },
    conta: resumoConta(conta),
    contadores: { atendimento: sm.pode('atendimento', 'LEITURA') ? await prisma.smConversa.count({ where: { usuarioId: sm.usuarioId, aguardandoDesde: { not: null }, status: { not: 'ARQUIVADA' } } }) : 0 },
  })
})

// ---------- Tela 01 · Hoje ----------

router.get('/sm/hoje', ...autenticado, async (req: Request, res: Response) => {
  const sm = req.sm!
  const membro = await prisma.smMembro.findUnique({ where: { usuarioId: sm.usuarioId }, select: { nome: true, tratamento: true } })
  const pessoa = sm.visao === 'SOCIAL_MEDIA'
    ? { nome: membro?.nome ?? 'Social Media', tratamento: membro?.tratamento ?? null }
    : { nome: req.proLaboreUser!.nome, tratamento: null }
  // Recepção (seção 14): ?retorno=1 quando a aba volta depois de 30 min escondida.
  const [hoje, recepcao] = await Promise.all([
    montarHoje(sm, pessoa),
    montarRecepcao(sm, req.proLaboreUser!.nome, new Date(), { retorno: req.query.retorno === '1' }),
  ])
  res.json({ ...hoje, cabecalho: { ...hoje.cabecalho, saudacao: recepcao.titulo, resumo: recepcao.sub }, recepcao })
})

// Depois da primeira ação do dia, a recepção recolhe numa linha (seção 14.3, regra 4).
router.post('/sm/recepcao/:id/recolher', ...autenticado, async (req: Request, res: Response) => {
  await recolherVisita(req.sm!, String(req.params.id))
  res.json({ ok: true })
})

// Preferência da própria pessoa: concordância da saudação.
router.put('/sm/preferencias', ...autenticado, async (req: Request, res: Response) => {
  const parse = z.object({ genero: z.enum(['F', 'M']).nullable() }).safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: 'Preferência inválida' }); return }
  const sm = req.sm!
  const chave = { usuarioId: sm.usuarioId, ator: atorDe(sm) }
  await prisma.smPreferencia.upsert({ where: { usuarioId_ator: chave }, create: { ...chave, genero: parse.data.genero }, update: { genero: parse.data.genero } })
  res.json({ genero: parse.data.genero })
})

// Simulador de momentos (tela 13): só o gestor, para revisar as frases com os dados reais.
router.get('/sm/gestor/recepcao', ...autenticado, requireGestorSM, async (req: Request, res: Response) => {
  const momento = (MOMENTOS as readonly string[]).includes(String(req.query.momento)) ? String(req.query.momento) as Momento : 'MANHA'
  const genero = req.query.genero === 'F' || req.query.genero === 'M' ? req.query.genero : null
  const sm = req.query.para === 'GESTOR' ? req.sm! : comoSocialMedia(req.sm!)
  res.json(await simularRecepcao(sm, req.proLaboreUser!.nome, momento, genero, typeof req.query.frase === 'string' ? req.query.frase : null))
})

// ---------- Tela 07 · Permissões (gestor) ----------

router.get('/sm/gestor/acesso', ...autenticado, requireGestorSM, async (req: Request, res: Response) => {
  const usuarioId = req.sm!.usuarioId
  const [permissoes, membro, conta] = await Promise.all([
    carregarPermissoes(usuarioId),
    prisma.smMembro.findUnique({ where: { usuarioId } }),
    contaDaOperacao(usuarioId),
  ])
  res.json({
    ...permissoes,
    padrao: { niveis: NIVEIS_PADRAO, regras: REGRAS_PADRAO },
    membro: membro && {
      nome: membro.nome,
      tratamento: membro.tratamento,
      genero: await generoDe(usuarioId, membro.id),
      email: membro.email,
      status: statusMembro(membro),
      convidadoEm: membro.convidadoEm,
      conviteExpiraEm: membro.senhaHash ? null : membro.conviteExpiraEm,
      ativadoEm: membro.ativadoEm,
      ultimoAcessoEm: membro.ultimoAcessoEm,
    },
    conta: resumoConta(conta),
    emailConfigurado: emailConfigurado(),
  })
})

const permissoesSchema = z.object({
  niveis: z.partialRecord(z.enum(MODULOS_SM), z.enum(NIVEIS_SM)).optional(),
  regras: z.object({
    aprovacaoGestor: z.boolean(),
    mostrarValores: z.boolean(),
    relatorioSemanal: z.boolean(),
    assistenteIA: z.boolean(),
  }).partial().optional(),
})

router.put('/sm/gestor/permissoes', ...autenticado, requireGestorSM, async (req: Request, res: Response) => {
  const parse = permissoesSchema.safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0].message }); return }
  const usuarioId = req.sm!.usuarioId
  const atual = await carregarPermissoes(usuarioId)
  const niveis = niveisCompletos({ ...atual.niveis, ...parse.data.niveis })
  const regras = { ...atual.regras, ...parse.data.regras }
  await prisma.smPermissao.upsert({
    where: { usuarioId },
    create: { usuarioId, niveis, ...regras },
    update: { niveis, ...regras },
  })
  res.json({ niveis, regras })
})

const conviteSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome').max(80),
  tratamento: z.string().trim().max(40).optional().nullable(),
  // Concordância da saudação ("Bem-vinda", "Bem-vindo"); vazio = neutra.
  genero: z.enum(['F', 'M']).nullish(),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
})

function linkDoConvite(req: Request, token: string) {
  const origemPedido = String(req.headers.origin ?? '')
  const base = process.env.FRONTEND_URL ?? (origemPedido || 'http://localhost:3000')
  return `${base.replace(/\/$/, '')}/pro-labore/convite/${token}`
}

router.post('/sm/gestor/convite', ...autenticado, requireGestorSM, async (req: Request, res: Response) => {
  const parse = conviteSchema.safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0].message }); return }
  const usuarioId = req.sm!.usuarioId
  const { nome, email } = parse.data
  const tratamento = parse.data.tratamento || null

  const [dono, vendedor, outroMembro] = await Promise.all([
    prisma.proLaboreUsuario.findUnique({ where: { email }, select: { id: true } }),
    prisma.vendedor.findFirst({ where: { email }, select: { id: true } }),
    prisma.smMembro.findFirst({ where: { email, NOT: { usuarioId } }, select: { id: true } }),
  ])
  if (dono || vendedor || outroMembro) { res.status(409).json({ error: 'Este e-mail já está em uso no sistema' }); return }

  const atual = await prisma.smMembro.findUnique({ where: { usuarioId } })
  const outraPessoa = !atual || atual.email !== email
  const token = crypto.randomBytes(32).toString('base64url')
  const dados = {
    nome,
    tratamento,
    email,
    ativo: true,
    conviteHash: hashConvite(token),
    conviteExpiraEm: new Date(Date.now() + PRAZO_CONVITE_MS),
    convidadoEm: new Date(),
    // Outra pessoa: começa do zero (senha e primeiro acesso). A mesma pessoa
    // mantém a senha; o link novo serve para trocá-la.
    ...(outraPessoa && { senhaHash: null, ativadoEm: null, primeiroAcessoEm: null, ultimoAcessoEm: null }),
  }
  const salvo = await prisma.smMembro.upsert({ where: { usuarioId }, create: { usuarioId, ...dados }, update: dados })
  if (parse.data.genero !== undefined) {
    await prisma.smPreferencia.upsert({ where: { usuarioId_ator: { usuarioId, ator: salvo.id } }, create: { usuarioId, ator: salvo.id, genero: parse.data.genero }, update: { genero: parse.data.genero } })
  }

  const link = linkDoConvite(req, token)
  const gestor = req.proLaboreUser!.nome
  const envio = await enviarEmail({
    para: email,
    assunto: 'Seu acesso ao Pró-Labore · Social Media',
    texto: `Olá, ${tratamento ?? nome}!\n\n${gestor} liberou seu acesso ao espaço do Social Media no Pró-Labore.\nDefina sua senha por este link (vale 7 dias):\n${link}\n`,
    html: `<p>Olá, ${escaparHtml(tratamento ?? nome)}!</p><p>${escaparHtml(gestor)} liberou seu acesso ao espaço do Social Media no Pró-Labore.</p><p><a href="${escaparHtml(link)}">Definir minha senha</a> (o link vale 7 dias).</p>`,
  })
  res.status(201).json({ link, emailEnviado: envio.enviado, erroEmail: envio.enviado ? null : envio.erro })
})

router.post('/sm/gestor/membro/ativo', ...autenticado, requireGestorSM, async (req: Request, res: Response) => {
  const parse = z.object({ ativo: z.boolean() }).safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: 'Informe ativo' }); return }
  const membro = await prisma.smMembro.findUnique({ where: { usuarioId: req.sm!.usuarioId } })
  if (!membro) { res.status(404).json({ error: 'Nenhum responsável convidado' }); return }
  await prisma.smMembro.update({ where: { id: membro.id }, data: { ativo: parse.data.ativo } })
  res.json({ ok: true, status: statusMembro({ ...membro, ativo: parse.data.ativo }) })
})

router.delete('/sm/gestor/membro', ...autenticado, requireGestorSM, async (req: Request, res: Response) => {
  await prisma.smMembro.deleteMany({ where: { usuarioId: req.sm!.usuarioId } })
  res.json({ ok: true })
})

// ---------- Convite (público, protegido pelo token do link) ----------

async function membroDoConvite(token: string) {
  if (!token || token.length < 20) return null
  const m = await prisma.smMembro.findUnique({ where: { conviteHash: hashConvite(token) } })
  if (!m || !m.ativo || !m.conviteExpiraEm || m.conviteExpiraEm.getTime() < Date.now()) return null
  return m
}

router.get('/sm/convite/:token', async (req: Request, res: Response) => {
  const m = await membroDoConvite(String(req.params.token))
  if (!m) { res.status(404).json({ error: 'Convite inválido ou expirado. Peça um novo ao gestor.' }); return }
  res.json({ nome: m.nome, tratamento: m.tratamento, email: m.email, jaTemSenha: !!m.senhaHash })
})

router.post('/sm/convite/:token', async (req: Request, res: Response) => {
  const parse = z.object({ senha: z.string().min(8, 'A senha precisa de pelo menos 8 caracteres').max(200) }).safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0].message }); return }
  const m = await membroDoConvite(String(req.params.token))
  if (!m) { res.status(404).json({ error: 'Convite inválido ou expirado. Peça um novo ao gestor.' }); return }
  const senhaHash = await bcrypt.hash(parse.data.senha, 10)
  // O link é de uso único: some assim que a senha é definida.
  const membro = await prisma.smMembro.update({
    where: { id: m.id },
    data: { senhaHash, conviteHash: null, conviteExpiraEm: null, ativadoEm: m.ativadoEm ?? new Date(), ultimoAcessoEm: new Date() },
  })
  const token = signProLaboreToken({ sub: membro.usuarioId, email: membro.email, nome: membro.nome, papel: 'SOCIAL_MEDIA', smMembroId: membro.id })
  res.json({ token, usuario: { id: membro.id, nome: membro.nome, email: membro.email, papel: 'SOCIAL_MEDIA' } })
})

export default router
