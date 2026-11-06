// PDF 02 · 4.8 Camada de qualidade e confiabilidade dos dados.
// Regras no código (sem IA): validação (obrigatórios, ausentes,
// duplicados), anomalias (venda sem negociação, perda sem motivo,
// informação incompatível) e a classificação de cada registro (confirmado,
// incompleto, suspeito). Cada problema vira uma correção orientada para o
// responsável; quando a regra deixa de valer, a correção se resolve sozinha.
// Dados suspeitos não servem de evidência para Recomendações nem padrões
// (onda 2): use `idsSuspeitos`.
import { prisma } from './prisma'

export type Classificacao = 'CONFIRMADO' | 'INCOMPLETO' | 'SUSPEITO'
export interface Problema { tabela: string; id: string; leadId: string | null; regra: string; classificacao: 'INCOMPLETO' | 'SUSPEITO'; oQueFalta: string; responsavelId: string | null }

export const REGRAS: Record<string, { nome: string; classificacao: 'INCOMPLETO' | 'SUSPEITO' }> = {
  ORIGEM_NAO_IDENTIFICADA: { nome: 'Origem não identificada', classificacao: 'INCOMPLETO' },
  LEAD_SEM_TELEFONE: { nome: 'Lead sem telefone', classificacao: 'INCOMPLETO' },
  LEAD_SEM_RESPONSAVEL: { nome: 'Lead sem responsável', classificacao: 'INCOMPLETO' },
  LEAD_DUPLICADO: { nome: 'Possível duplicado', classificacao: 'SUSPEITO' },
  PERDA_SEM_MOTIVO: { nome: 'Perda sem motivo', classificacao: 'INCOMPLETO' },
  VENDA_SEM_NEGOCIACAO: { nome: 'Venda sem histórico de negociação', classificacao: 'SUSPEITO' },
  A_VISTA_EM_CREDITO: { nome: 'À vista em etapa de crédito', classificacao: 'SUSPEITO' },
  ATIVIDADE_SEM_RESULTADO: { nome: 'Atividade feita sem resultado', classificacao: 'INCOMPLETO' },
}

const DIA = 86_400_000
const digitos = (t: string | null) => (t ?? '').replace(/\D/g, '').slice(-11)

/** Encontra os problemas da conta (regras do 4.8). */
export async function detectar(usuarioId: string, agora = new Date()): Promise<Problema[]> {
  const out: Problema[] = []
  const abertos = await prisma.lead.findMany({
    where: { usuarioId, perdidoEm: null, vendaId: null },
    select: { id: true, nomeCliente: true, telefone: true, vendedorId: true, etapa: true, formaPagamento: true, origemConfiabilidade: true, origemTipo: true },
  })
  const porTelefone = new Map<string, typeof abertos>()
  for (const l of abertos) {
    const p = (r: string, falta: string) => out.push({ tabela: 'pro_labore_leads', id: l.id, leadId: l.id, regra: r, classificacao: REGRAS[r].classificacao, oQueFalta: falta, responsavelId: l.vendedorId ?? usuarioId })
    if (l.origemConfiabilidade === 'INCOMPLETO') p('ORIGEM_NAO_IDENTIFICADA', l.origemTipo === 'ANUNCIO' ? 'Veio de anúncio, mas a campanha não foi identificada: confirme de onde o lead veio' : 'Escolha de onde o lead veio (indicação, loja física ou retorno espontâneo)')
    if (!digitos(l.telefone)) p('LEAD_SEM_TELEFONE', 'Falta o telefone do cliente')
    if (!l.vendedorId) p('LEAD_SEM_RESPONSAVEL', 'Falta o responsável pelo lead')
    if (l.formaPagamento === 'A_VISTA' && (l.etapa === 'MQL' || l.etapa === 'SQL')) p('A_VISTA_EM_CREDITO', `Cliente à vista não passa por ${l.etapa}: confira a forma de pagamento ou a etapa`)
    const d = digitos(l.telefone)
    if (d.length >= 10) porTelefone.set(d, [...(porTelefone.get(d) ?? []), l])
  }
  for (const grupo of porTelefone.values()) {
    if (grupo.length < 2) continue
    for (const l of grupo) {
      const outros = grupo.filter(x => x.id !== l.id).map(x => x.nomeCliente).join(', ')
      out.push({ tabela: 'pro_labore_leads', id: l.id, leadId: l.id, regra: 'LEAD_DUPLICADO', classificacao: 'SUSPEITO', oQueFalta: `Mesmo telefone de outra oportunidade aberta (${outros}): junte ou confirme que são diferentes`, responsavelId: l.vendedorId ?? usuarioId })
    }
  }
  // Perdidos sem motivo (últimos 180 dias).
  const perdidos = await prisma.lead.findMany({ where: { usuarioId, perdidoEm: { gte: new Date(agora.getTime() - 180 * DIA) }, motivoPerda: null }, select: { id: true, vendedorId: true } })
  for (const l of perdidos) out.push({ tabela: 'pro_labore_leads', id: l.id, leadId: l.id, regra: 'PERDA_SEM_MOTIVO', classificacao: 'INCOMPLETO', oQueFalta: 'Oportunidade perdida sem motivo: informe por que se perdeu', responsavelId: l.vendedorId ?? usuarioId })
  // Vendas confirmadas nos últimos 90 dias sem histórico de negociação.
  const vendas = await prisma.$queryRaw<Array<{ id: string; vendedorId: string | null; leadId: string | null }>>`
    SELECT v.id, v."vendedorId", l.id "leadId" FROM pro_labore_vendas v LEFT JOIN pro_labore_leads l ON l."vendaId" = v.id
    WHERE v."usuarioId" = ${usuarioId} AND v.situacao = 'CONFIRMADA' AND v.data >= ${new Date(agora.getTime() - 90 * DIA)}
      AND (l.id IS NULL OR NOT EXISTS (SELECT 1 FROM pro_labore_lead_estagio_historico h WHERE h."leadId" = l.id AND h."estagioNovo" IN ('NEGOCIACAO','PROPOSTA','AGENDAMENTO','VISITA','FECHADO')))`
  for (const v of vendas) out.push({ tabela: 'pro_labore_vendas', id: v.id, leadId: v.leadId, regra: 'VENDA_SEM_NEGOCIACAO', classificacao: 'SUSPEITO', oQueFalta: v.leadId ? 'A venda não tem negociação registrada no lead: confira as etapas' : 'Venda sem lead ligado: ligue a venda à oportunidade', responsavelId: v.vendedorId ?? usuarioId })
  // Atividades feitas nos últimos 30 dias sem resultado.
  const atvs = await prisma.atividade.findMany({ where: { usuarioId, status: 'EXECUTADA', resultado: null, executadaEm: { gte: new Date(agora.getTime() - 30 * DIA) }, autorExecucaoTipo: 'PESSOA' }, select: { id: true, leadId: true, responsavelId: true, codigo: true } })
  for (const a of atvs) out.push({ tabela: 'pro_labore_atividades', id: a.id, leadId: a.leadId, regra: 'ATIVIDADE_SEM_RESULTADO', classificacao: 'INCOMPLETO', oQueFalta: `${a.codigo ?? 'Atividade'} marcada como feita sem resultado: registre o que aconteceu`, responsavelId: a.responsavelId ?? usuarioId })
  return out
}

const pior = (a: Classificacao, b: Classificacao): Classificacao => (a === 'SUSPEITO' || b === 'SUSPEITO' ? 'SUSPEITO' : a === 'INCOMPLETO' || b === 'INCOMPLETO' ? 'INCOMPLETO' : 'CONFIRMADO')

/** Avalia a conta: abre as correções novas, resolve as que deixaram de valer e grava a classificação de cada registro. */
export async function avaliar(usuarioId: string, agora = new Date()) {
  const problemas = await detectar(usuarioId, agora)
  const chave = (t: string, id: string, r: string) => `${t}|${id}|${r}`
  const atuais = new Map(problemas.map(p => [chave(p.tabela, p.id, p.regra), p]))
  const abertas = await prisma.correcaoPendente.findMany({ where: { usuarioId, status: 'ABERTA' } })
  const jaAbertas = new Set(abertas.map(c => chave(c.registroTabela, c.registroId, c.regra)))
  const resolver = abertas.filter(c => !atuais.has(chave(c.registroTabela, c.registroId, c.regra))).map(c => c.id)
  if (resolver.length) await prisma.correcaoPendente.updateMany({ where: { id: { in: resolver } }, data: { status: 'RESOLVIDA', resolvidaEm: agora } })
  const novas = problemas.filter(p => !jaAbertas.has(chave(p.tabela, p.id, p.regra)))
  if (novas.length) await prisma.correcaoPendente.createMany({ data: novas.map(p => ({ usuarioId, registroTabela: p.tabela, registroId: p.id, leadId: p.leadId, regra: p.regra, classificacao: p.classificacao, oQueFalta: p.oQueFalta, responsavelId: p.responsavelId })), skipDuplicates: true })
  // Texto atualizado (ex.: nomes do duplicado) nas que continuam abertas.
  for (const c of abertas) { const p = atuais.get(chave(c.registroTabela, c.registroId, c.regra)); if (p && p.oQueFalta !== c.oQueFalta) await prisma.correcaoPendente.update({ where: { id: c.id }, data: { oQueFalta: p.oQueFalta, responsavelId: p.responsavelId } }) }
  // Classificação por registro: a pior pendência aberta; sem pendência, confirmado.
  const porRegistro = new Map<string, { tabela: string; id: string; c: Classificacao; motivos: string[]; regras: string[] }>()
  for (const p of problemas) {
    const k = `${p.tabela}|${p.id}`
    const r = porRegistro.get(k) ?? { tabela: p.tabela, id: p.id, c: 'CONFIRMADO' as Classificacao, motivos: [], regras: [] }
    r.c = pior(r.c, p.classificacao); r.motivos.push(REGRAS[p.regra].nome); r.regras.push(p.regra)
    porRegistro.set(k, r)
  }
  const antes = await prisma.confiabilidade.findMany({ where: { usuarioId, classificacao: { not: 'CONFIRMADO' } }, select: { registroTabela: true, registroId: true } })
  for (const a of antes) if (!porRegistro.has(`${a.registroTabela}|${a.registroId}`)) {
    await prisma.confiabilidade.update({ where: { registroTabela_registroId: { registroTabela: a.registroTabela, registroId: a.registroId } }, data: { classificacao: 'CONFIRMADO', motivo: null, regra: null, avaliadoEm: agora } })
  }
  for (const r of porRegistro.values()) {
    const dados = { classificacao: r.c, motivo: r.motivos.join('; '), regra: r.regras.join(','), avaliadoEm: agora }
    await prisma.confiabilidade.upsert({ where: { registroTabela_registroId: { registroTabela: r.tabela, registroId: r.id } }, create: { usuarioId, registroTabela: r.tabela, registroId: r.id, ...dados }, update: dados })
  }
  return { qualidadeAbertas: novas.length, qualidadeResolvidas: resolver.length, qualidadeProblemas: problemas.length }
}

/** Cron diário: avalia todas as contas. */
export async function avaliarTodas(agora = new Date()) {
  const contas = await prisma.proLaboreUsuario.findMany({ select: { id: true } })
  let abertas = 0, resolvidas = 0
  for (const c of contas) { const r = await avaliar(c.id, agora).catch(() => null); if (r) { abertas += r.qualidadeAbertas; resolvidas += r.qualidadeResolvidas } }
  return { qualidadeAbertas: abertas, qualidadeResolvidas: resolvidas }
}

/** Proteção do aprendizado (onda 2): ids de registros suspeitos, que não servem de evidência. */
export async function idsSuspeitos(usuarioId: string, tabela: string): Promise<Set<string>> {
  const rs = await prisma.confiabilidade.findMany({ where: { usuarioId, registroTabela: tabela, classificacao: 'SUSPEITO' }, select: { registroId: true } })
  return new Set(rs.map(r => r.registroId))
}
