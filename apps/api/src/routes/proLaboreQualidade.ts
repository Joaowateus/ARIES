// PDF 02 · 4.8 Saúde dos dados (correções pendentes, com filtro por
// responsável e por tipo de problema), correção orientada no registro e a
// matriz de ações (4.7) para consulta.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth, requireDonoOuSupervisor } from '../middleware/authProLabore'
import { requireModulo } from '../lib/acessos'
import { leadWhereBase } from '../lib/escopoLead'
import { REGRAS, avaliar } from '../lib/qualidade'
import { ACOES, perfilDe } from '../lib/matrizAcoes'
import { aceitePdf02 } from '../lib/aceitePdf02'
import { requireDono } from '../middleware/authProLabore'

const router = Router()
const vejaEquipe = (req: Request) => ['DONO', 'SUPERVISOR'].includes(req.proLaboreUser!.papel)
const eu = (req: Request) => req.proLaboreUser!.vendedorId ?? req.proLaboreUser!.sub

router.get('/qualidade/correcoes', requireProLaboreAuth, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const { responsavelId, regra } = req.query
  const status = req.query.status === 'RESOLVIDA' ? 'RESOLVIDA' : 'ABERTA'
  const where = {
    usuarioId, status,
    ...(vejaEquipe(req) ? (typeof responsavelId === 'string' && responsavelId ? { responsavelId } : {}) : { responsavelId: eu(req) }),
    ...(typeof regra === 'string' && regra ? { regra } : {}),
  }
  const [itens, porRegra, porResp] = await Promise.all([
    prisma.correcaoPendente.findMany({ where, orderBy: { criadaEm: 'desc' }, take: 300 }),
    prisma.correcaoPendente.groupBy({ by: ['regra'], where: { usuarioId, status: 'ABERTA', ...(vejaEquipe(req) ? {} : { responsavelId: eu(req) }) }, _count: true }),
    vejaEquipe(req) ? prisma.correcaoPendente.groupBy({ by: ['responsavelId'], where: { usuarioId, status: 'ABERTA' }, _count: true }) : Promise.resolve([]),
  ])
  const leads = await prisma.lead.findMany({ where: { id: { in: itens.map(i => i.leadId).filter((x): x is string => !!x) } }, select: { id: true, nomeCliente: true } })
  const nome = new Map(leads.map(l => [l.id, l.nomeCliente]))
  const pessoas = await prisma.vendedor.findMany({ where: { usuarioId }, select: { id: true, nome: true } })
  const nomePessoa = (id: string | null) => (id === usuarioId ? 'Dono' : pessoas.find(p => p.id === id)?.nome ?? '—')
  res.json({
    regras: REGRAS,
    porRegra: Object.fromEntries(porRegra.map(r => [r.regra, r._count])),
    porResponsavel: porResp.map(r => ({ responsavelId: r.responsavelId, nome: nomePessoa(r.responsavelId), total: r._count })),
    itens: itens.map(i => ({ ...i, lead: i.leadId ? nome.get(i.leadId) ?? null : null, responsavel: nomePessoa(i.responsavelId), problema: REGRAS[i.regra]?.nome ?? i.regra })),
  })
})

// Reavaliar agora (dono e supervisor; o cron faz isso todo dia).
router.post('/qualidade/avaliar', requireProLaboreAuth, requireDonoOuSupervisor, async (req: Request, res: Response) => {
  res.json(await avaliar(req.proLaboreUser!.sub))
})

// No registro: o que falta corrigir neste lead (e nas atividades dele).
router.get('/qualidade/leads/:id', requireProLaboreAuth, requireModulo('crm', 'VER'), async (req: Request, res: Response) => {
  const lead = await prisma.lead.findFirst({ where: { id: String(req.params.id), ...leadWhereBase(req) }, select: { id: true } })
  if (!lead) { res.status(404).json({ error: 'Oportunidade não encontrada' }); return }
  const [conf, correcoes] = await Promise.all([
    prisma.confiabilidade.findUnique({ where: { registroTabela_registroId: { registroTabela: 'pro_labore_leads', registroId: lead.id } } }),
    prisma.correcaoPendente.findMany({ where: { leadId: lead.id, status: 'ABERTA' }, orderBy: { criadaEm: 'asc' } }),
  ])
  res.json({ classificacao: conf?.classificacao ?? 'CONFIRMADO', correcoes: correcoes.map(c => ({ ...c, problema: REGRAS[c.regra]?.nome ?? c.regra })) })
})

// Correção orientada da origem (lead com origem incompleta): a lista fechada. Origem confirmada não muda (o banco garante).
const origemSchema = z.object({ origemLista: z.enum(['INDICACAO', 'LOJA_FISICA', 'RETORNO_ESPONTANEO']) })
router.put('/qualidade/leads/:id/origem', requireProLaboreAuth, requireModulo('crm', 'EDITAR'), async (req: Request, res: Response) => {
  const p = origemSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: 'Escolha a origem' }); return }
  const lead = await prisma.lead.findFirst({ where: { id: String(req.params.id), ...leadWhereBase(req) }, select: { id: true, origemConfiabilidade: true } })
  if (!lead) { res.status(404).json({ error: 'Oportunidade não encontrada' }); return }
  if (lead.origemConfiabilidade === 'CONFIRMADO') { res.status(409).json({ error: 'A origem já está confirmada e não muda' }); return }
  await prisma.lead.update({ where: { id: lead.id }, data: { origemLista: p.data.origemLista } })
  await avaliar(req.proLaboreUser!.sub)
  const l = await prisma.lead.findUnique({ where: { id: lead.id }, select: { origemTipo: true, origemLista: true, origemConfiabilidade: true } })
  res.json(l)
})

// Matriz de ações (4.7), para consulta em Configurações.
router.get('/qualidade/matriz', requireProLaboreAuth, async (req: Request, res: Response) => {
  res.json({ meuPerfil: perfilDe(req.proLaboreUser!), acoes: Object.entries(ACOES).map(([chave, a]) => ({ chave, ...a })) })
})

// PDF 02 · seção 9: teste de aceite calculado na produção (só o dono).
router.get('/qualidade/aceite-pdf02', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  res.json(await aceitePdf02(req.proLaboreUser!.sub))
})

export default router
