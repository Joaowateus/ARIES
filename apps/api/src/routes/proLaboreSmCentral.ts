// Central Estratégica de Conteúdo do espaço do Social Media. Ver pede o
// módulo Produção em Leitura; mexer, em Completo. O dossiê só muda pelo
// gestor (o Social Media propõe); aprovar o ciclo também é do gestor;
// aprovar roteiros é do gestor quando a regra de aprovação está ligada.
import { Router, Request, Response, NextFunction } from 'express'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { contextoSM, requireGestorSM, requireModuloSM } from '../lib/smAcesso'
import { dossieSchema, lerDossie } from '../lib/smCentralDossie'
import {
  ErroCentral, ajustarDias, cicloCompleto, criarCiclo, dossieVigente, enviarParaProducao, etapasDoVideo, fechamento, hojeBelem, mesDe, metricasDosVideos, nomeMes,
  proximaVersaoDossie, proximoMes, statusEfetivo,
} from '../lib/smCentral'
import { FORMATOS, NOME_FORMATO, STATUS_VIDEO, montarRoteiro } from '../lib/smCentralModelos'
import { TEMAS } from '../lib/smCentralTemas'
import { gerarRoteiroCentral, iaLigada, sugerirAngulos } from '../lib/smIA'
import { notificar } from '../lib/smPautas'

const router = Router()
const autenticado = [requireProLaboreAuth, contextoSM]
const ler = requireModuloSM('producao', 'LEITURA')
const editar = requireModuloSM('producao', 'COMPLETO')

const souGestor = (req: Request) => req.sm!.visao === 'GESTOR' && !req.sm!.verComo
const podeEditar = (req: Request) => req.sm!.pode('producao', 'COMPLETO') && !req.sm!.somenteLeitura
const ator = (req: Request) => (souGestor(req) ? 'GESTOR' : 'SOCIAL_MEDIA') as 'GESTOR' | 'SOCIAL_MEDIA'
/** Aprovar roteiro: o gestor, ou o próprio Social Media quando a regra de aprovação está desligada. */
const podeAprovar = (req: Request) => souGestor(req) || (podeEditar(req) && !req.sm!.permissoes.regras.aprovacaoGestor)

function tratar(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(e => {
      if (e instanceof ErroCentral) { res.status(e.status).json({ error: e.message }); return }
      if (e instanceof z.ZodError) { res.status(400).json({ error: e.issues[0]?.message ?? 'Dados inválidos' }); return }
      next(e)
    })
  }
}

async function videoDoUsuario(req: Request) {
  const v = await prisma.smVideo.findFirst({ where: { id: String(req.params.id), ciclo: { usuarioId: req.sm!.usuarioId } }, include: { ciclo: { select: { id: true, status: true, mes: true } } } })
  if (!v) throw new ErroCentral(404, 'Vídeo não encontrado')
  return v
}

async function videoCompleto(usuarioId: string, id: string) {
  const v = await prisma.smVideo.findFirstOrThrow({ where: { id, ciclo: { usuarioId } } })
  const pauta = v.pautaId ? await prisma.smPauta.findUnique({ where: { id: v.pautaId }, select: { id: true, status: true, codigo: true, agendadoPara: true, publicadaEm: true, permalink: true } }) : null
  const status = statusEfetivo(v, pauta)
  const metricas = (await metricasDosVideos(usuarioId, [v])).get(v.id)
  const prova = v.provaId ? await prisma.smProva.findFirst({ where: { id: v.provaId, usuarioId } }) : null
  return { ...v, status, etapas: etapasDoVideo(status, v.roteiroOrigem), pauta, metricas, prova, formatoNome: NOME_FORMATO[v.formato] ?? v.formato }
}

// ---------- Visão geral ----------

router.get('/sm/central', ...autenticado, ler, tratar(async (req, res) => {
  const usuarioId = req.sm!.usuarioId
  const [ciclos, dos] = await Promise.all([
    prisma.smCiclo.findMany({ where: { usuarioId }, orderBy: [{ mes: 'desc' }, { versao: 'desc' }], select: { id: true, mes: true, versao: true, status: true, origem: true, criadoEm: true, aprovadoEm: true, fechadoEm: true, dias: true, dossie: { select: { versao: true } }, _count: { select: { videos: true } } } }),
    dossieVigente(usuarioId),
  ])
  const mes = mesDe(new Date())
  const atual = ciclos.find(c => c.mes === mes && c.status !== 'ARQUIVADO') ?? ciclos.find(c => c.status !== 'ARQUIVADO') ?? null
  res.json({
    mesAtual: mes, proximoMes: proximoMes(mes), atualId: atual?.id ?? null,
    ciclos: ciclos.map(c => ({ id: c.id, mes: c.mes, nomeMes: nomeMes(c.mes), versao: c.versao, status: c.status, origem: c.origem, criadoEm: c.criadoEm, aprovadoEm: c.aprovadoEm, fechadoEm: c.fechadoEm, diasProducao: (c.dias as string[]).length, videos: c._count.videos, dossieVersao: c.dossie.versao })),
    dossieVersao: dos.versao, ia: iaLigada(), souGestor: souGestor(req), podeEditar: podeEditar(req), podeAprovar: podeAprovar(req),
    formatos: FORMATOS, temas: TEMAS.map(t => ({ chave: t.chave, nome: t.nome, semana: t.semana })), status: STATUS_VIDEO,
  })
}))

// ---------- Dossiê ----------

router.get('/sm/central/dossie', ...autenticado, ler, tratar(async (req, res) => {
  const usuarioId = req.sm!.usuarioId
  const vig = await dossieVigente(usuarioId)
  const versoes = await prisma.smDossie.findMany({ where: { usuarioId }, orderBy: { versao: 'desc' }, select: { id: true, versao: true, status: true, nota: true, criadoPor: true, criadoEm: true, decididoEm: true } })
  res.json({ vigente: { id: vig.id, versao: vig.versao, nota: vig.nota, criadoEm: vig.criadoEm, conteudo: vig.dossie }, versoes, souGestor: souGestor(req), podeEditar: podeEditar(req) })
}))

router.get('/sm/central/dossie/:id', ...autenticado, ler, tratar(async (req, res) => {
  const d = await prisma.smDossie.findFirst({ where: { id: String(req.params.id), usuarioId: req.sm!.usuarioId } })
  if (!d) throw new ErroCentral(404, 'Versão não encontrada')
  res.json({ ...d, conteudo: lerDossie(d.conteudo) })
}))

const dossieEntrada = z.object({ conteudo: dossieSchema, nota: z.string().trim().min(3, 'Diga o que mudou e por quê').max(1000) })

// O gestor publica uma versão nova (a anterior fica no histórico).
router.put('/sm/central/dossie', ...autenticado, requireGestorSM, tratar(async (req, res) => {
  const d = dossieEntrada.parse(req.body)
  const usuarioId = req.sm!.usuarioId
  const versao = await proximaVersaoDossie(usuarioId)
  await prisma.$transaction([
    prisma.smDossie.updateMany({ where: { usuarioId, status: 'VIGENTE' }, data: { status: 'SUBSTITUIDO' } }),
    prisma.smDossie.create({ data: { usuarioId, versao, status: 'VIGENTE', conteudo: d.conteudo as Prisma.InputJsonValue, nota: d.nota, criadoPor: 'GESTOR', decididoEm: new Date() } }),
  ])
  res.json({ versao })
}))

// O Social Media propõe; o gestor decide.
router.post('/sm/central/dossie/propostas', ...autenticado, editar, tratar(async (req, res) => {
  const d = dossieEntrada.parse(req.body)
  const usuarioId = req.sm!.usuarioId
  const p = await prisma.smDossie.create({ data: { usuarioId, versao: await proximaVersaoDossie(usuarioId), status: 'PROPOSTA', conteudo: d.conteudo as Prisma.InputJsonValue, nota: d.nota, criadoPor: ator(req) } })
  if (!souGestor(req)) await notificar(usuarioId, 'GESTOR', 'CENTRAL_DOSSIE', `dossie:${p.id}`, 'Proposta de mudança no dossiê do AVATAR', d.nota, { href: '/pro-labore/sm/central?aba=dossie' })
  res.status(201).json({ id: p.id, versao: p.versao })
}))

router.post('/sm/central/dossie/propostas/:id/decidir', ...autenticado, requireGestorSM, tratar(async (req, res) => {
  const { aceitar } = z.object({ aceitar: z.boolean() }).parse(req.body)
  const usuarioId = req.sm!.usuarioId
  const p = await prisma.smDossie.findFirst({ where: { id: String(req.params.id), usuarioId, status: 'PROPOSTA' } })
  if (!p) throw new ErroCentral(404, 'Proposta não encontrada')
  if (aceitar) {
    await prisma.$transaction([
      prisma.smDossie.updateMany({ where: { usuarioId, status: 'VIGENTE' }, data: { status: 'SUBSTITUIDO' } }),
      prisma.smDossie.update({ where: { id: p.id }, data: { status: 'VIGENTE', decididoEm: new Date() } }),
    ])
  } else await prisma.smDossie.update({ where: { id: p.id }, data: { status: 'RECUSADA', decididoEm: new Date() } })
  res.json({ ok: true })
}))

// ---------- Ciclos ----------

router.post('/sm/central/ciclos', ...autenticado, editar, tratar(async (req, res) => {
  const d = z.object({ mes: z.string().regex(/^\d{4}-\d{2}$/), dias: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(31).optional() }).parse(req.body)
  const c = await criarCiclo(req.sm!.usuarioId, d.mes, { dias: d.dias, origem: 'MANUAL', geradoPor: ator(req) })
  res.status(201).json({ id: c.id, mes: c.mes, versao: c.versao })
}))

router.get('/sm/central/ciclos/:id', ...autenticado, ler, tratar(async (req, res) => {
  const c = await cicloCompleto(req.sm!.usuarioId, String(req.params.id))
  if (!c) throw new ErroCentral(404, 'Ciclo não encontrado')
  res.json({ ...c, hoje: hojeBelem(), nomeMes: nomeMes(c.ciclo.mes), ia: iaLigada(), souGestor: souGestor(req), podeEditar: podeEditar(req), podeAprovar: podeAprovar(req) })
}))

router.patch('/sm/central/ciclos/:id', ...autenticado, editar, tratar(async (req, res) => {
  const d = z.object({ dias: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(31).optional(), status: z.enum(['APROVADO', 'RASCUNHO']).optional() }).parse(req.body)
  const usuarioId = req.sm!.usuarioId
  const ciclo = await prisma.smCiclo.findFirst({ where: { id: String(req.params.id), usuarioId } })
  if (!ciclo) throw new ErroCentral(404, 'Ciclo não encontrado')
  if (['FECHADO', 'ARQUIVADO'].includes(ciclo.status)) throw new ErroCentral(409, 'Ciclo fechado ou arquivado: fica só no histórico')
  if (d.dias) await ajustarDias(ciclo.id, d.dias)
  if (d.status === 'APROVADO') {
    if (!souGestor(req)) throw new ErroCentral(403, 'Só o gestor aprova o calendário do mês')
    const c = await cicloCompleto(usuarioId, ciclo.id)
    const falhas = c!.checklist.filter(i => i.essencial && !i.ok && i.chave !== 'comercial')
    if (falhas.length) throw new ErroCentral(409, `Corrija antes de aprovar: ${falhas.map(f => f.rotulo.toLowerCase()).join('; ')}`)
    await prisma.smCiclo.update({ where: { id: ciclo.id }, data: { status: 'APROVADO', aprovadoEm: new Date() } })
  } else if (d.status === 'RASCUNHO') {
    if (!souGestor(req)) throw new ErroCentral(403, 'Só o gestor reabre o calendário')
    await prisma.smCiclo.update({ where: { id: ciclo.id }, data: { status: 'RASCUNHO', aprovadoEm: null } })
  }
  res.json({ ok: true })
}))

router.get('/sm/central/ciclos/:id/fechamento', ...autenticado, ler, tratar(async (req, res) => {
  const ciclo = await prisma.smCiclo.findFirst({ where: { id: String(req.params.id), usuarioId: req.sm!.usuarioId }, select: { relatorio: true, status: true } })
  if (!ciclo) throw new ErroCentral(404, 'Ciclo não encontrado')
  // Fechado: o relatório guardado. Aberto: a prévia com os dados de agora.
  res.json(ciclo.status === 'FECHADO' && ciclo.relatorio ? { ...(ciclo.relatorio as object), guardado: true } : { ...(await fechamento(req.sm!.usuarioId, String(req.params.id))), guardado: false })
}))

router.post('/sm/central/ciclos/:id/fechar', ...autenticado, editar, tratar(async (req, res) => {
  const usuarioId = req.sm!.usuarioId
  const ciclo = await prisma.smCiclo.findFirst({ where: { id: String(req.params.id), usuarioId } })
  if (!ciclo) throw new ErroCentral(404, 'Ciclo não encontrado')
  if (ciclo.status === 'FECHADO') throw new ErroCentral(409, 'Esse ciclo já foi fechado')
  if (ciclo.status === 'ARQUIVADO') throw new ErroCentral(409, 'Versão arquivada: feche a versão vigente do mês')
  const rel = await fechamento(usuarioId, ciclo.id)
  await prisma.smCiclo.update({ where: { id: ciclo.id }, data: { status: 'FECHADO', fechadoEm: new Date(), relatorio: rel as unknown as Prisma.InputJsonValue } })
  res.json(rel)
}))

// Próximo mês a partir deste ciclo (o fechamento entra como consideração).
router.post('/sm/central/ciclos/:id/proximo', ...autenticado, editar, tratar(async (req, res) => {
  const ciclo = await prisma.smCiclo.findFirst({ where: { id: String(req.params.id), usuarioId: req.sm!.usuarioId } })
  if (!ciclo) throw new ErroCentral(404, 'Ciclo não encontrado')
  const mes = proximoMes(ciclo.mes)
  const ja = await prisma.smCiclo.findFirst({ where: { usuarioId: ciclo.usuarioId, mes, status: { not: 'ARQUIVADO' } }, select: { id: true } })
  if (ja && !req.body?.novaVersao) throw new ErroCentral(409, `Já existe um calendário de ${nomeMes(mes)}. Para gerar outra versão (a atual vai para o histórico), confirme.`)
  const c = await criarCiclo(ciclo.usuarioId, mes, { origem: 'MANUAL', geradoPor: ator(req) })
  res.status(201).json({ id: c.id, mes: c.mes, versao: c.versao })
}))

// ---------- Vídeos ----------

router.get('/sm/central/videos/:id', ...autenticado, ler, tratar(async (req, res) => {
  await videoDoUsuario(req)
  res.json(await videoCompleto(req.sm!.usuarioId, String(req.params.id)))
}))

const textoOpc = (max: number) => z.string().trim().max(max).optional()
const edicaoSchema = z.object({
  titulo: textoOpc(160), gancho: textoOpc(200), contexto: textoOpc(1500), desenvolvimento: textoOpc(3000), valor: textoOpc(1000), cta: textoOpc(300),
  gravacao: textoOpc(1500), cenas: z.array(z.string().trim().max(300)).max(10).optional(), textosTela: z.array(z.string().trim().max(150)).max(10).optional(),
  legenda: textoOpc(2200), duracaoSeg: z.number().int().min(5).max(180).optional(), lente: textoOpc(120), lenteMotivo: textoOpc(400), persona: textoOpc(300),
  objetivo: textoOpc(400), responsavel: z.string().trim().max(120).nullable().optional(), provaId: z.string().nullable().optional(),
  permalink: z.string().trim().url('Link inválido').max(500).nullable().optional(), resultado: z.string().trim().max(2000).nullable().optional(),
  aprendizado: z.string().trim().max(2000).nullable().optional(), melhoria: z.string().trim().max(2000).nullable().optional(),
  metricasManuais: z.object({ mensagens: z.number().int().min(0), visitasAgendadas: z.number().int().min(0), avaliacoesSolicitadas: z.number().int().min(0), propostas: z.number().int().min(0), cliques: z.number().int().min(0) }).partial().nullable().optional(),
})
const CAMPOS_ROTEIRO = ['titulo', 'gancho', 'contexto', 'desenvolvimento', 'valor', 'cta', 'gravacao', 'cenas', 'textosTela', 'legenda', 'duracaoSeg'] as const

router.patch('/sm/central/videos/:id', ...autenticado, editar, tratar(async (req, res) => {
  const v = await videoDoUsuario(req)
  if (['FECHADO', 'ARQUIVADO'].includes(v.ciclo.status)) throw new ErroCentral(409, 'Ciclo fechado ou arquivado: o vídeo fica só no histórico')
  const d = edicaoSchema.parse(req.body)
  const mexeuRoteiro = CAMPOS_ROTEIRO.some(c => c in d)
  if (mexeuRoteiro && v.pautaId) throw new ErroCentral(409, 'Esse vídeo já está na Produção: edite o roteiro pela pauta')
  if (d.provaId) {
    const p = await prisma.smProva.findFirst({ where: { id: d.provaId, usuarioId: req.sm!.usuarioId } })
    if (!p) throw new ErroCentral(400, 'Prova não encontrada')
  }
  const data: Prisma.SmVideoUpdateInput = { ...d, metricasManuais: d.metricasManuais === null ? Prisma.DbNull : d.metricasManuais ?? undefined }
  if (mexeuRoteiro) {
    data.roteiroOrigem = 'MANUAL'
    // Roteiro revisado: deixa de ser o roteiro-base; aprovado e mexido volta para revisão.
    if (v.status === 'PLANEJADO') data.status = 'ROTEIRIZADO'
    if (['AGUARDANDO_APROVACAO', 'APROVADO'].includes(v.status) && !souGestor(req)) { data.status = 'ROTEIRIZADO'; data.aprovadoEm = null }
  }
  await prisma.smVideo.update({ where: { id: v.id }, data })
  if (d.aprendizado?.trim() && d.aprendizado !== v.aprendizado) {
    await prisma.smCentralItem.create({ data: { usuarioId: req.sm!.usuarioId, tipo: 'APRENDIZADO', texto: d.aprendizado.trim(), natureza: 'FATO', tags: { video: v.codigo, etapa: v.etapa, tema: v.tema }, criadoPor: ator(req) } })
  }
  res.json(await videoCompleto(req.sm!.usuarioId, v.id))
}))

// Mudança de etapa feita à mão (sem pauta). Não marca concluído o que não foi feito.
router.post('/sm/central/videos/:id/status', ...autenticado, editar, tratar(async (req, res) => {
  const v = await videoDoUsuario(req)
  const { status } = z.object({ status: z.enum(STATUS_VIDEO) }).parse(req.body)
  if (['APROVADO'].includes(status)) throw new ErroCentral(409, 'Para aprovar, use "Aprovar roteiro"')
  if (v.pautaId && !['GRAVADO', 'ANALISADO'].includes(status)) throw new ErroCentral(409, 'Esse vídeo está na Produção: a etapa acompanha a pauta')
  if (status === 'PUBLICADO' && !v.permalink) throw new ErroCentral(409, 'Para marcar como publicado, informe o link da publicação')
  if (status === 'ANALISADO' && !v.resultado?.trim()) throw new ErroCentral(409, 'Para concluir a análise, registre o resultado observado')
  if (status === 'AGUARDANDO_APROVACAO' && v.status === 'PLANEJADO') throw new ErroCentral(409, 'Revise o roteiro-base (ou gere com a IA) antes de mandar para aprovação')
  if (['PRONTO_GRAVAR', 'GRAVADO', 'EM_EDICAO', 'PRONTO_PUBLICAR', 'AGENDADO', 'PUBLICADO'].includes(status) && !['APROVADO', 'PRONTO_GRAVAR', 'GRAVADO', 'EM_EDICAO', 'PRONTO_PUBLICAR', 'AGENDADO', 'PUBLICADO'].includes(v.status) && !v.pautaId) {
    throw new ErroCentral(409, 'O roteiro precisa estar aprovado antes de gravar e publicar')
  }
  await prisma.smVideo.update({ where: { id: v.id }, data: { status } })
  if (status === 'AGUARDANDO_APROVACAO' && !souGestor(req)) await notificar(req.sm!.usuarioId, 'GESTOR', 'CENTRAL_APROVACAO', `central-aprovar:${v.ciclo.id}`, 'Roteiros da Central para aprovar', 'Há roteiros aguardando a sua aprovação na Central de Conteúdo.', { href: '/pro-labore/sm/central?aba=producao' })
  res.json(await videoCompleto(req.sm!.usuarioId, v.id))
}))

router.post('/sm/central/videos/aprovar', ...autenticado, editar, tratar(async (req, res) => {
  if (!podeAprovar(req)) throw new ErroCentral(403, 'A aprovação dos roteiros é do gestor')
  const d = z.object({ ids: z.array(z.string()).min(1).max(200), aprovar: z.boolean(), comentario: z.string().trim().max(1000).optional() }).parse(req.body)
  const usuarioId = req.sm!.usuarioId
  const vs = await prisma.smVideo.findMany({ where: { id: { in: d.ids }, ciclo: { usuarioId, status: { in: ['RASCUNHO', 'APROVADO'] } }, pautaId: null } })
  let feitos = 0
  for (const v of vs) {
    if (d.aprovar) {
      if (v.status === 'PLANEJADO' || chegouAprovado(v.status)) continue
      await prisma.smVideo.update({ where: { id: v.id }, data: { status: 'APROVADO', aprovadoEm: new Date(), ajusteComentario: null } })
    } else {
      await prisma.smVideo.update({ where: { id: v.id }, data: { status: 'ROTEIRIZADO', aprovadoEm: null, ajusteComentario: d.comentario ?? 'Ajuste pedido pelo gestor' } })
    }
    feitos++
  }
  if (!d.aprovar && feitos) await notificar(usuarioId, 'SOCIAL_MEDIA', 'CENTRAL_AJUSTE', `central-ajuste:${Date.now()}`, 'Ajuste pedido em roteiros da Central', d.comentario ?? 'O gestor pediu ajuste em roteiros.', { href: '/pro-labore/sm/central?aba=producao' })
  res.json({ feitos, ignorados: d.ids.length - feitos })
}))
const chegouAprovado = (s: string) => ['APROVADO', 'PRONTO_GRAVAR', 'GRAVADO', 'EM_EDICAO', 'PRONTO_PUBLICAR', 'AGENDADO', 'PUBLICADO', 'ANALISADO'].includes(s)

router.post('/sm/central/videos/:id/confirmar', ...autenticado, editar, tratar(async (req, res) => {
  const v = await videoDoUsuario(req)
  const { nota } = z.object({ nota: z.string().trim().min(5, 'Escreva o que foi confirmado (ex.: estoque conferido com o gestor hoje)').max(500) }).parse(req.body)
  if (!v.pendenteConfirmacao) throw new ErroCentral(409, 'Esse vídeo não depende de confirmação')
  await prisma.smVideo.update({ where: { id: v.id }, data: { confirmadoEm: new Date(), confirmacaoNota: `${nota} (${ator(req) === 'GESTOR' ? 'gestor' : 'Social Media'})` } })
  res.json(await videoCompleto(req.sm!.usuarioId, v.id))
}))

router.post('/sm/central/videos/:id/producao', ...autenticado, editar, tratar(async (req, res) => {
  await videoDoUsuario(req)
  const p = await enviarParaProducao(req.sm!.usuarioId, String(req.params.id), ator(req))
  res.status(201).json({ pautaId: p.id })
}))

router.post('/sm/central/videos/:id/roteiro-ia', ...autenticado, editar, tratar(async (req, res) => {
  const v = await videoDoUsuario(req)
  if (!iaLigada()) throw new ErroCentral(409, 'A IA não está ligada neste sistema: os roteiros-base da Central continuam valendo')
  if (v.pautaId) throw new ErroCentral(409, 'Esse vídeo já está na Produção')
  const usuarioId = req.sm!.usuarioId
  const [dos, outros] = await Promise.all([
    dossieVigente(usuarioId),
    prisma.smVideo.findMany({ where: { cicloId: v.cicloId, etapa: v.etapa, NOT: { id: v.id } }, select: { gancho: true }, take: 60 }),
  ])
  const d = dos.dossie
  const r = await gerarRoteiroCentral(usuarioId, {
    etapa: v.etapa,
    dossie: { avatar: d.avatar, dores: d.dores, desejos: d.desejos, objecoes: d.objecoes, posicionamento: d.posicionamento, regras: d.regras, promessaAprovada: d.promessa.aprovada },
    ficha: { periodo: v.periodo, etapa: v.etapa, tema: v.tema, formato: NOME_FORMATO[v.formato] ?? v.formato, alvoTipo: v.alvoTipo, alvo: v.alvo, lente: v.lente, persona: v.persona, objetivo: v.objetivo, provaNecessaria: v.provaNecessaria, pendenteConfirmacao: v.pendenteConfirmacao },
    roteiro_base: { titulo: v.titulo, gancho: v.gancho, contexto: v.contexto, desenvolvimento: v.desenvolvimento, valor: v.valor, cta: v.cta },
    ganchos_existentes: outros.map(o => o.gancho),
  })
  if (!r) throw new ErroCentral(502, 'A IA não conseguiu escrever este roteiro agora (tempo, cota ou resposta fora das regras). O roteiro-base continua; tente de novo depois.')
  await prisma.smVideo.update({
    where: { id: v.id },
    data: {
      titulo: r.titulo, gancho: r.gancho, contexto: r.contexto, desenvolvimento: r.desenvolvimento, valor: r.valor, cta: r.cta, gravacao: r.gravacao, cenas: r.cenas, textosTela: r.textosTela,
      legenda: r.legenda, duracaoSeg: r.duracaoSeg, lenteMotivo: r.lenteMotivo || v.lenteMotivo,
      // A IA pode apontar dependências novas; nunca apaga uma que já existia.
      pendenteConfirmacao: v.pendenteConfirmacao ?? (r.pendenteConfirmacao || null),
      roteiroOrigem: 'IA', status: v.status === 'PLANEJADO' ? 'ROTEIRIZADO' : v.status === 'APROVADO' ? 'ROTEIRIZADO' : v.status, aprovadoEm: v.status === 'APROVADO' ? null : v.aprovadoEm,
    },
  })
  res.json(await videoCompleto(usuarioId, v.id))
}))

// Reorganizar a semana sem perder a distribuição: troca com outro vídeo do mesmo período e semana.
router.post('/sm/central/videos/:id/trocar', ...autenticado, editar, tratar(async (req, res) => {
  const a = await videoDoUsuario(req)
  const { comId } = z.object({ comId: z.string() }).parse(req.body)
  const b = await prisma.smVideo.findFirst({ where: { id: comId, cicloId: a.cicloId } })
  if (!b) throw new ErroCentral(404, 'Vídeo para troca não encontrado')
  if (a.periodo !== b.periodo || a.semana !== b.semana) throw new ErroCentral(409, 'Só troca com vídeo do mesmo período (e etapa do funil) e da mesma semana')
  if (a.pautaId || b.pautaId) throw new ErroCentral(409, 'Vídeo já na Produção: mude a data pela pauta')
  const tmp = `${a.codigo}-tmp`
  await prisma.$transaction([
    prisma.smVideo.update({ where: { id: a.id }, data: { codigo: tmp } }),
    prisma.smVideo.update({ where: { id: b.id }, data: { codigo: a.codigo, data: a.data, horario: a.horario, diaCiclo: a.diaCiclo, ordem: a.ordem } }),
    prisma.smVideo.update({ where: { id: a.id }, data: { codigo: b.codigo, data: b.data, horario: b.horario, diaCiclo: b.diaCiclo, ordem: b.ordem } }),
  ])
  res.json({ ok: true })
}))

// Lista para o "Gerar roteiros dos próximos 5 dias" (a tela chama a IA um vídeo por vez).
router.get('/sm/central/ciclos/:id/para-roteirizar', ...autenticado, editar, tratar(async (req, res) => {
  const ciclo = await prisma.smCiclo.findFirst({ where: { id: String(req.params.id), usuarioId: req.sm!.usuarioId }, select: { id: true, dias: true } })
  if (!ciclo) throw new ErroCentral(404, 'Ciclo não encontrado')
  const n = Math.min(20, Math.max(1, Number(req.query.dias) || 5))
  const hoje = hojeBelem()
  const dias = (ciclo.dias as string[]).filter(d => d >= hoje).slice(0, n)
  const vs = await prisma.smVideo.findMany({ where: { cicloId: ciclo.id, data: { in: dias }, roteiroOrigem: 'MODELO', pautaId: null }, select: { id: true }, orderBy: [{ diaCiclo: 'asc' }, { horario: 'asc' }] })
  res.json({ dias, ids: vs.map(v => v.id) })
}))

// ---------- Bancos ----------

const TIPOS_BANCO = ['GANCHO', 'PERGUNTA', 'OBJECAO', 'APRENDIZADO', 'SUGESTAO'] as const

router.get('/sm/central/banco', ...autenticado, ler, tratar(async (req, res) => {
  const usuarioId = req.sm!.usuarioId
  const tipo = typeof req.query.tipo === 'string' && (TIPOS_BANCO as readonly string[]).includes(req.query.tipo) ? req.query.tipo : undefined
  const itens = await prisma.smCentralItem.findMany({ where: { usuarioId, ...(tipo ? { tipo } : {}) }, orderBy: [{ ocorrencias: 'desc' }, { criadoEm: 'desc' }], take: 300 })
  // Ganchos: também os dos vídeos publicados, com o resultado observado (fato).
  let ganchosPublicados: unknown[] = []
  if (!tipo || tipo === 'GANCHO') {
    const vs = await prisma.smVideo.findMany({ where: { ciclo: { usuarioId }, pautaId: { not: null } }, select: { id: true, codigo: true, gancho: true, etapa: true, formato: true, alvo: true, persona: true, lente: true, pautaId: true, metricasManuais: true, permalink: true }, take: 300, orderBy: { data: 'desc' } })
    const m = await metricasDosVideos(usuarioId, vs)
    ganchosPublicados = vs.filter(v => m.get(v.id)?.disponivel).map(v => ({ ...v, formatoNome: NOME_FORMATO[v.formato], metricas: m.get(v.id) }))
  }
  const biblioteca = !tipo || tipo === 'GANCHO' ? await prisma.smGancho.findMany({ where: { usuarioId }, select: { id: true, texto: true, exemplos: true }, take: 100 }) : []
  res.json({ itens, ganchosPublicados, biblioteca })
}))

const itemSchema = z.object({
  tipo: z.enum(TIPOS_BANCO), texto: z.string().trim().min(3).max(1000), natureza: z.enum(['FATO', 'HIPOTESE', 'SUGESTAO']).optional(),
  tags: z.record(z.string(), z.string().max(200)).optional(), resultado: z.string().trim().max(1000).nullable().optional(),
})

router.post('/sm/central/banco', ...autenticado, editar, tratar(async (req, res) => {
  const d = itemSchema.parse(req.body)
  const usuarioId = req.sm!.usuarioId
  // A mesma pergunta/objeção de novo soma ocorrência (é o que mostra o que se repete).
  if (d.tipo === 'PERGUNTA' || d.tipo === 'OBJECAO') {
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
    const iguais = await prisma.smCentralItem.findMany({ where: { usuarioId, tipo: d.tipo }, select: { id: true, texto: true } })
    const igual = iguais.find(i => norm(i.texto) === norm(d.texto))
    if (igual) { const u = await prisma.smCentralItem.update({ where: { id: igual.id }, data: { ocorrencias: { increment: 1 } } }); res.json(u); return }
  }
  const i = await prisma.smCentralItem.create({ data: { usuarioId, tipo: d.tipo, texto: d.texto, natureza: d.tipo === 'SUGESTAO' ? 'SUGESTAO' : d.natureza ?? 'FATO', tags: d.tags ?? {}, resultado: d.resultado ?? null, criadoPor: ator(req) } })
  res.status(201).json(i)
}))

router.patch('/sm/central/banco/:id', ...autenticado, editar, tratar(async (req, res) => {
  const d = itemSchema.partial().parse(req.body)
  const r = await prisma.smCentralItem.updateMany({ where: { id: String(req.params.id), usuarioId: req.sm!.usuarioId }, data: { ...d, tags: d.tags ?? undefined } })
  if (!r.count) throw new ErroCentral(404, 'Item não encontrado')
  res.json({ ok: true })
}))

router.delete('/sm/central/banco/:id', ...autenticado, editar, tratar(async (req, res) => {
  const r = await prisma.smCentralItem.deleteMany({ where: { id: String(req.params.id), usuarioId: req.sm!.usuarioId } })
  if (!r.count) throw new ErroCentral(404, 'Item não encontrado')
  res.status(204).end()
}))

// Sugestões de novos ângulos (sem alterar o AVATAR). Com IA quando ligada; senão, pelos modelos.
router.post('/sm/central/sugestoes', ...autenticado, editar, tratar(async (req, res) => {
  const d = z.object({ foco: z.string().trim().min(3).max(300) }).parse(req.body)
  const usuarioId = req.sm!.usuarioId
  const dos = await dossieVigente(usuarioId)
  const aprendizados = await prisma.smCentralItem.findMany({ where: { usuarioId, tipo: { in: ['APRENDIZADO', 'PERGUNTA', 'OBJECAO'] } }, orderBy: { criadoEm: 'desc' }, take: 10, select: { tipo: true, texto: true } })
  let ideias = iaLigada() ? await sugerirAngulos(usuarioId, { foco: d.foco, dossie: { dores: dos.dossie.dores, desejos: dos.dossie.desejos, objecoes: dos.dossie.objecoes, posicionamento: dos.dossie.posicionamento }, aprendizados }) : null
  const origem = ideias ? 'IA' : 'MODELO'
  if (!ideias) {
    // Sem IA: o tema mais próximo do foco, um vídeo por etapa do funil.
    const { temaDaPergunta } = await import('../lib/smCentralModelos')
    const t = temaDaPergunta(d.foco) ?? TEMAS[0]
    ideias = (['TOPO', 'MEIO', 'FUNDO'] as const).map((etapa, i) => {
      const f = FORMATOS[etapa][(i * 3 + d.foco.length) % FORMATOS[etapa].length].chave
      const r = montarRoteiro(etapa, f, { t, alvo: d.foco, persona: dos.dossie.personas[i % dos.dossie.personas.length], lente: t.lentes[0], ctaIdx: i })
      return { etapa, titulo: r.titulo, gancho: r.gancho, porque: `Tema "${t.nome}", ligado ao foco "${d.foco}" (${NOME_FORMATO[f]}).` }
    })
  }
  const criados = await prisma.$transaction(ideias.map(i => prisma.smCentralItem.create({
    data: { usuarioId, tipo: 'SUGESTAO', natureza: 'SUGESTAO', texto: `${i.titulo} · Gancho: ${i.gancho}`, tags: { etapa: i.etapa, foco: d.foco, porque: i.porque, origem }, criadoPor: ator(req) },
  })))
  res.status(201).json({ origem, ideias: criados })
}))

// ---------- Provas e ativos ----------

const TIPOS_PROVA = ['FOTO_VIDEO', 'INFO_PRODUTO', 'CONDICAO_COMERCIAL', 'GARANTIA', 'DOCUMENTACAO', 'INSPECAO', 'AVALIACAO_CLIENTE', 'DEPOIMENTO', 'BASTIDORES', 'FAQ', 'POS_VENDA'] as const
const provaSchema = z.object({
  titulo: z.string().trim().min(3).max(200), tipo: z.enum(TIPOS_PROVA), origem: z.string().trim().max(300).nullable().optional(), link: z.string().trim().max(1000).nullable().optional(),
  responsavel: z.string().trim().max(120).nullable().optional(), permissao: z.string().trim().max(500).nullable().optional(),
  verificadoEm: z.coerce.date().nullable().optional(), validoAte: z.coerce.date().nullable().optional(), situacao: z.enum(['APROVADO', 'PENDENTE']).optional(), nota: z.string().trim().max(1000).nullable().optional(),
})

router.get('/sm/central/provas', ...autenticado, ler, tratar(async (req, res) => {
  const provas = await prisma.smProva.findMany({ where: { usuarioId: req.sm!.usuarioId }, orderBy: { criadoEm: 'desc' } })
  const agora = new Date()
  res.json(provas.map(p => ({ ...p, situacaoEfetiva: p.validoAte && p.validoAte < agora ? 'VENCIDO' : p.situacao })))
}))

router.post('/sm/central/provas', ...autenticado, editar, tratar(async (req, res) => {
  const d = provaSchema.parse(req.body)
  // Depoimento e avaliação de cliente só entram aprovados com a permissão registrada.
  if (d.situacao === 'APROVADO' && ['DEPOIMENTO', 'AVALIACAO_CLIENTE'].includes(d.tipo) && !d.permissao?.trim()) throw new ErroCentral(400, 'Registre como o cliente autorizou o uso antes de aprovar')
  if (d.situacao === 'APROVADO' && !souGestor(req)) throw new ErroCentral(403, 'Só o gestor aprova uma prova; cadastre como pendente')
  const p = await prisma.smProva.create({ data: { ...d, usuarioId: req.sm!.usuarioId, situacao: d.situacao ?? 'PENDENTE' } })
  res.status(201).json(p)
}))

router.patch('/sm/central/provas/:id', ...autenticado, editar, tratar(async (req, res) => {
  const d = provaSchema.partial().parse(req.body)
  const p = await prisma.smProva.findFirst({ where: { id: String(req.params.id), usuarioId: req.sm!.usuarioId } })
  if (!p) throw new ErroCentral(404, 'Prova não encontrada')
  if (d.situacao === 'APROVADO' && !souGestor(req)) throw new ErroCentral(403, 'Só o gestor aprova uma prova')
  const tipo = d.tipo ?? p.tipo
  if ((d.situacao ?? p.situacao) === 'APROVADO' && ['DEPOIMENTO', 'AVALIACAO_CLIENTE'].includes(tipo) && !(d.permissao ?? p.permissao)?.trim()) throw new ErroCentral(400, 'Registre como o cliente autorizou o uso antes de aprovar')
  res.json(await prisma.smProva.update({ where: { id: p.id }, data: d }))
}))

router.delete('/sm/central/provas/:id', ...autenticado, editar, tratar(async (req, res) => {
  const usuarioId = req.sm!.usuarioId
  const usada = await prisma.smVideo.count({ where: { provaId: String(req.params.id), ciclo: { usuarioId } } })
  if (usada) throw new ErroCentral(409, `Essa prova está ligada a ${usada} ${usada === 1 ? 'vídeo' : 'vídeos'}: desligue antes de excluir`)
  const r = await prisma.smProva.deleteMany({ where: { id: String(req.params.id), usuarioId } })
  if (!r.count) throw new ErroCentral(404, 'Prova não encontrada')
  res.status(204).end()
}))

export default router
