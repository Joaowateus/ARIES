// ARIES DISPARO — números das campanhas (monitoramento, visão geral, relatórios comerciais).
// Tudo sai das tabelas do Disparo e do CRM na hora; cada número diz de onde vem.
// Resultado comercial é correlação no período (o destinatário avançou depois de receber), não
// atribuição de venda à campanha: o ARIES não tem regra de atribuição aprovada.
import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null)

export async function resumoCampanha(campanhaId: string) {
  const c = await prisma.disparoCampanha.findUnique({ where: { id: campanhaId }, select: { id: true, status: true, versao: true, totais: true, iniciadaEm: true, concluidaEm: true, canceladaEm: true, criadoEm: true, erro: true } })
  if (!c) return null
  const [porMsg, porDest, descadastros, decidir] = await Promise.all([
    prisma.disparoMensagem.groupBy({ by: ['status'], where: { campanhaId }, _count: { _all: true } }),
    prisma.disparoDestinatario.groupBy({ by: ['status'], where: { campanhaId, versao: c.versao }, _count: { _all: true } }),
    prisma.disparoEvento.count({ where: { campanhaId, tipo: 'DESCADASTRO' } }),
    prisma.disparoMensagem.count({ where: { campanhaId, OR: [{ status: 'DESCONHECIDO' }, { status: 'FALHOU', erroClasse: 'ESGOTOU' }] } }),
  ])
  const m = Object.fromEntries(porMsg.map(x => [x.status, x._count._all])) as Record<string, number>
  const dst = Object.fromEntries(porDest.map(x => [x.status, x._count._all])) as Record<string, number>
  const respostas = await prisma.disparoDestinatario.count({ where: { campanhaId, versao: c.versao, respondeuEm: { not: null } } })
  const t = (c.totais ?? {}) as { selecionados?: number; elegiveis?: number; excluidos?: number; porMotivo?: Record<string, number> }
  const aceitas = (m.ACEITA ?? 0) + (m.ENTREGUE ?? 0) + (m.LIDA ?? 0)
  const entregues = (m.ENTREGUE ?? 0) + (m.LIDA ?? 0)
  const alcancados = await prisma.disparoDestinatario.count({ where: { campanhaId, versao: c.versao, mensagens: { some: { status: { in: ['ACEITA', 'ENTREGUE', 'LIDA'] } } } } })
  const processadas = Object.entries(m).filter(([s]) => s !== 'AGENDADA').reduce((s, [, n]) => s + n, 0)
  const fimRef = c.concluidaEm ?? c.canceladaEm ?? new Date()
  return {
    status: c.status, erro: c.erro,
    selecionados: t.selecionados ?? 0, elegiveis: t.elegiveis ?? 0, excluidos: t.excluidos ?? 0, porMotivo: t.porMotivo ?? {},
    destinatarios: dst,
    pendentes: m.AGENDADA ?? 0, naFila: (m.AGENDADA ?? 0) + (m.ENVIANDO ?? 0), processadas,
    aceitas, entregues, lidas: m.LIDA ?? 0, falhas: m.FALHOU ?? 0, desconhecidas: m.DESCONHECIDO ?? 0, puladas: (m.PULADA ?? 0) + (m.CANCELADA ?? 0),
    respostas, descadastros, aDecidir: decidir,
    taxaEntrega: pct(entregues, aceitas), taxaLeitura: pct(m.LIDA ?? 0, aceitas), taxaResposta: pct(respostas, alcancados),
    tempoMs: c.iniciadaEm ? fimRef.getTime() - c.iniciadaEm.getTime() : null,
    origem: 'Mensagens e destinatários desta campanha (tabelas do Disparo); entregue e lida chegam do WhatsApp e dependem do aparelho do cliente.',
  }
}

/**
 * Números do período só das campanhas do escopo (as da pessoa; a gestão pode ver a equipe toda ou
 * as de alguém). `escopo` vazio = loja inteira.
 */
export async function visaoGeral(usuarioId: string, desde: Date, escopo: Prisma.DisparoCampanhaWhereInput = {}) {
  const campanhas: Prisma.DisparoCampanhaWhereInput = { usuarioId, excluidaEm: null, ...escopo }
  const ids = (await prisma.disparoCampanha.findMany({ where: campanhas, select: { id: true } })).map(c => c.id)
  const daLoja = Object.keys(escopo).length === 0
  const [porStatus, recentes, msgs, respostas, destinatarios, eventos] = await Promise.all([
    prisma.disparoCampanha.groupBy({ by: ['status'], where: campanhas, _count: { _all: true } }),
    prisma.disparoCampanha.findMany({ where: campanhas, orderBy: { atualizadoEm: 'desc' }, take: 8, select: { id: true, nome: true, status: true, agendadaPara: true, iniciadaEm: true, concluidaEm: true, totais: true, finalidade: true } }),
    prisma.disparoMensagem.groupBy({ by: ['status'], where: { campanhaId: { in: ids }, criadoEm: { gte: desde } }, _count: { _all: true } }),
    prisma.disparoDestinatario.count({ where: { usuarioId, campanhaId: { in: ids }, respondeuEm: { gte: desde } } }),
    prisma.disparoDestinatario.count({ where: { usuarioId, campanhaId: { in: ids }, criadoEm: { gte: desde }, status: { notIn: ['EXCLUIDO', 'DESCARTADO'] } } }),
    // Eventos sem campanha (ex.: configurações) só na visão da loja inteira.
    prisma.disparoEvento.findMany({ where: { usuarioId, tipo: { in: ['RESPOSTA', 'DESCADASTRO', 'FALHA', 'STATUS_RUNNING', 'STATUS_COMPLETED', 'STATUS_COMPLETED_WITH_ERRORS', 'STATUS_CANCELLED', 'DECIDIR_REENVIO'] }, OR: [{ campanhaId: { in: ids } }, ...(daLoja ? [{ campanhaId: null }] : [])] }, orderBy: { criadoEm: 'desc' }, take: 15, select: { id: true, tipo: true, descricao: true, criadoEm: true, campanhaId: true } }),
  ])
  const s = Object.fromEntries(porStatus.map(x => [x.status, x._count._all])) as Record<string, number>
  const m = Object.fromEntries(msgs.map(x => [x.status, x._count._all])) as Record<string, number>
  const aceitas = (m.ACEITA ?? 0) + (m.ENTREGUE ?? 0) + (m.LIDA ?? 0), entregues = (m.ENTREGUE ?? 0) + (m.LIDA ?? 0)
  const nomes = new Map((await prisma.disparoCampanha.findMany({ where: { id: { in: [...new Set(eventos.map(e => e.campanhaId).filter(Boolean) as string[])] } }, select: { id: true, nome: true } })).map(r => [r.id, r.nome]))
  return {
    campanhas: { criadas: Object.values(s).reduce((a, b) => a + b, 0), emAndamento: (s.RUNNING ?? 0) + (s.QUEUED ?? 0) + (s.PAUSED ?? 0), agendadas: s.SCHEDULED ?? 0, concluidas: (s.COMPLETED ?? 0) + (s.COMPLETED_WITH_ERRORS ?? 0), rascunhos: (s.DRAFT ?? 0) + (s.VALIDATING ?? 0) + (s.NEEDS_REVIEW ?? 0) + (s.READY ?? 0) },
    destinatarios, processadas: Object.entries(m).filter(([k]) => k !== 'AGENDADA').reduce((a, [, n]) => a + n, 0),
    aceitas, entregues, lidas: m.LIDA ?? 0, falhas: m.FALHOU ?? 0, respostas,
    taxaEntrega: pct(entregues, aceitas), taxaLeitura: pct(m.LIDA ?? 0, aceitas), taxaResposta: pct(respostas, aceitas),
    recentes, atividade: eventos.map(e => ({ ...e, campanha: e.campanhaId ? nomes.get(e.campanhaId) ?? null : null })),
    periodoDesde: desde,
  }
}

/** O que os destinatários fizeram no CRM depois de receber (até N dias após o início). Valores só para o dono. */
export async function resultadoComercial(campanhaId: string, verValores: boolean, janelaDias = 30) {
  const c = await prisma.disparoCampanha.findUnique({ where: { id: campanhaId }, select: { iniciadaEm: true, versao: true } })
  if (!c?.iniciadaEm) return null
  const ate = new Date(c.iniciadaEm.getTime() + janelaDias * 86_400_000)
  const ds = await prisma.disparoDestinatario.findMany({ where: { campanhaId, versao: c.versao, leadId: { not: null }, mensagens: { some: { status: { in: ['ACEITA', 'ENTREGUE', 'LIDA'] } } } }, select: { leadId: true } })
  const leads = [...new Set(ds.map(d => d.leadId!))]
  const periodo = { gte: c.iniciadaEm, lte: ate }
  const [reativados, avancaram, fichas, aprovacoes, visitas, vendas] = await Promise.all([
    prisma.lead.count({ where: { id: { in: leads }, reativadoEm: periodo } }),
    prisma.leadEstagioHistorico.findMany({ where: { leadId: { in: leads }, criadoEm: periodo }, distinct: ['leadId'], select: { leadId: true } }),
    prisma.assistenteFichaCredito.count({ where: { leadId: { in: leads }, criadoEm: periodo } }),
    prisma.assistenteAnaliseCredito.count({ where: { status: 'APROVADA', respondidoEm: periodo, ficha: { leadId: { in: leads } } } }),
    prisma.leadVisita.count({ where: { leadId: { in: leads }, criadoEm: periodo } }),
    prisma.venda.findMany({ where: { data: periodo, lead: { id: { in: leads } } }, select: { valorVenda: true } }),
  ])
  return {
    janelaDias, ate, destinatariosComLead: leads.length,
    leadsReativados: reativados, oportunidades: avancaram.length, fichasDeCredito: fichas, aprovacoes, visitas, vendas: vendas.length,
    receita: verValores ? vendas.reduce((s, v) => s + (v.valorVenda ?? 0), 0) : null,
    custo: null, roi: null,
    origem: `Leads que receberam a campanha e, até ${janelaDias} dias depois do início, mudaram de etapa, foram reativados, fizeram ficha, tiveram aprovação, visita ou venda (CRM). É correlação: a venda não é atribuída à campanha. Custo e retorno não aparecem porque o envio pelo WhatsApp do vendedor não tem custo por mensagem registrado no ARIES.`,
  }
}

/** Comparação entre campanhas do período (por campanha, com objetivo, finalidade, responsável e público). */
export async function comparativo(usuarioId: string, desde: Date, escopo: Prisma.DisparoCampanhaWhereInput = {}) {
  const cs = await prisma.disparoCampanha.findMany({ where: { usuarioId, excluidaEm: null, iniciadaEm: { gte: desde }, ...escopo }, orderBy: { iniciadaEm: 'desc' }, take: 50, select: { id: true, nome: true, objetivo: true, finalidade: true, responsavelNome: true, publico: true, status: true, iniciadaEm: true } })
  const linhas = []
  for (const c of cs) {
    const r = await resumoCampanha(c.id)
    const p = c.publico as { predefinido?: string; base?: string }
    linhas.push({ id: c.id, nome: c.nome, objetivo: c.objetivo, finalidade: c.finalidade, responsavel: c.responsavelNome, publico: p?.predefinido ?? p?.base ?? null, status: c.status, iniciadaEm: c.iniciadaEm, aceitas: r?.aceitas ?? 0, entregues: r?.entregues ?? 0, lidas: r?.lidas ?? 0, respostas: r?.respostas ?? 0, falhas: r?.falhas ?? 0, descadastros: r?.descadastros ?? 0, taxaResposta: r?.taxaResposta ?? null })
  }
  return linhas
}

// ---------- Painel da Visão geral (redesign 26/11/2026): só leitura ----------

const DIA_MS = 86_400_000
/** Os números de um período [de, ate) das campanhas dadas, como a Visão geral já calcula. */
async function numerosDoPeriodo(usuarioId: string, ids: string[], de: Date, ate: Date) {
  const [msgs, respostas] = await Promise.all([
    prisma.disparoMensagem.groupBy({ by: ['status'], where: { campanhaId: { in: ids }, criadoEm: { gte: de, lt: ate } }, _count: { _all: true } }),
    prisma.disparoDestinatario.count({ where: { usuarioId, campanhaId: { in: ids }, respondeuEm: { gte: de, lt: ate } } }),
  ])
  const m = Object.fromEntries(msgs.map(x => [x.status, x._count._all])) as Record<string, number>
  const aceitas = (m.ACEITA ?? 0) + (m.ENTREGUE ?? 0) + (m.LIDA ?? 0), entregues = (m.ENTREGUE ?? 0) + (m.LIDA ?? 0)
  return { aceitas, entregues, lidas: m.LIDA ?? 0, falhas: m.FALHOU ?? 0, respostas, taxaEntrega: pct(entregues, aceitas), taxaLeitura: pct(m.LIDA ?? 0, aceitas), taxaResposta: pct(respostas, aceitas) }
}

export type ItemAtencao = { id: string; nome: string; status: string; motivo: string; titulo: string; texto: string }
/**
 * O que a Visão geral mostra no topo: o período anterior (para as variações), envios por dia, o que
 * pede atenção (parada, limite, decisão de reenvio, aprovação), as campanhas em andamento com o
 * progresso e o que vem a seguir. Nada aqui muda dado: são as mesmas tabelas, lidas de outro jeito.
 */
export async function painelDaVisao(usuarioId: string, desde: Date, escopo: Prisma.DisparoCampanhaWhereInput = {}, agora = new Date()) {
  const { situacaoDoEnvio } = await import('./motor')
  const campanhas: Prisma.DisparoCampanhaWhereInput = { usuarioId, excluidaEm: null, ...escopo }
  const ids = (await prisma.disparoCampanha.findMany({ where: campanhas, select: { id: true } })).map(c => c.id)
  const dur = Math.max(DIA_MS, agora.getTime() - desde.getTime())
  const [anterior, dias, ativas, aprovacao, proxima] = await Promise.all([
    numerosDoPeriodo(usuarioId, ids, new Date(desde.getTime() - dur), desde),
    ids.length ? prisma.$queryRaw<Array<{ dia: string; aceitas: bigint; falhas: bigint }>>`
      SELECT to_char(date_trunc('day', coalesce(m."aceitaEm", m."falhouEm") AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM-DD') AS dia,
        count(*) FILTER (WHERE m."aceitaEm" IS NOT NULL) AS aceitas, count(*) FILTER (WHERE m."aceitaEm" IS NULL AND m."falhouEm" IS NOT NULL) AS falhas
      FROM pro_labore_disparo_mensagens m
      WHERE m."campanhaId" IN (${Prisma.join(ids)}) AND coalesce(m."aceitaEm", m."falhouEm") >= ${desde}
      GROUP BY 1 ORDER BY 1` : Promise.resolve([]),
    prisma.disparoCampanha.findMany({ where: { ...campanhas, status: { in: ['RUNNING', 'QUEUED', 'PAUSED'] } }, orderBy: { iniciadaEm: 'desc' }, take: 12, select: { id: true, nome: true, status: true, canal: true, totais: true, criadoPorNome: true, assistente: { select: { vendedor: { select: { nome: true } } } } } }),
    prisma.disparoCampanha.findMany({ where: { ...campanhas, status: 'NEEDS_REVIEW' }, orderBy: { atualizadoEm: 'asc' }, select: { id: true, nome: true, criadoPorNome: true, atualizadoEm: true } }),
    prisma.disparoCampanha.findFirst({ where: { ...campanhas, status: 'SCHEDULED', agendadaPara: { gte: agora } }, orderBy: { agendadaPara: 'asc' }, select: { id: true, nome: true, agendadaPara: true } }),
  ])
  // Envios por dia: todos os dias do período, inclusive os sem envio (a coluna vazia também informa).
  const porDiaMapa = new Map(dias.map(d => [d.dia, { aceitas: Number(d.aceitas), falhas: Number(d.falhas) }]))
  const porDia: Array<{ dia: string; aceitas: number; falhas: number }> = []
  const fmt = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d)
  for (let t = desde.getTime(); t <= agora.getTime() + 1; t += DIA_MS) {
    const dia = fmt(new Date(t))
    if (porDia.some(x => x.dia === dia)) continue
    porDia.push({ dia, ...(porDiaMapa.get(dia) ?? { aceitas: 0, falhas: 0 }) })
  }
  const hoje = fmt(agora)
  if (!porDia.some(x => x.dia === hoje)) porDia.push({ dia: hoje, ...(porDiaMapa.get(hoje) ?? { aceitas: 0, falhas: 0 }) })
  // Progresso e situação de cada campanha em andamento.
  const progresso = ativas.length ? await prisma.disparoDestinatario.groupBy({ by: ['campanhaId', 'status'], where: { campanhaId: { in: ativas.map(a => a.id) } }, _count: { _all: true } }) : []
  const aDecidir = ativas.length ? await prisma.disparoMensagem.groupBy({ by: ['campanhaId'], where: { campanhaId: { in: ativas.map(a => a.id) }, OR: [{ status: 'DESCONHECIDO' }, { status: 'FALHOU', erroClasse: 'ESGOTOU' }] }, _count: { _all: true } }) : []
  const andamento = []
  const atencao: ItemAtencao[] = []
  let proximoEnvioEm: string | null = null
  let intervaloSeg: number | null = null
  for (const c of ativas) {
    const sit = await situacaoDoEnvio(c.id, agora).catch(() => null)
    const conta = (st: string) => progresso.filter(p => p.campanhaId === c.id && p.status === st).reduce((a, p) => a + p._count._all, 0)
    const elegiveis = ((c.totais ?? {}) as { elegiveis?: number }).elegiveis ?? 0
    const enviadas = conta('CONCLUIDO') + conta('RESPONDEU'), falhas = conta('FALHOU'), paradas = conta('INTERROMPIDO')
    const decidir = aDecidir.find(x => x.campanhaId === c.id)?._count._all ?? 0
    andamento.push({ id: c.id, nome: c.nome, status: c.status, canal: c.canal, remetente: c.canal === 'INSTAGRAM' ? 'Instagram' : c.assistente?.vendedor.nome ?? null, criadoPor: c.criadoPorNome, elegiveis, enviadas, falhas, paradas, situacao: sit ? { motivo: sit.motivo, titulo: sit.titulo, proximoEnvioEm: sit.proximoEnvioEm } : null })
    if (c.status === 'RUNNING' && sit?.proximoEnvioEm && (!proximoEnvioEm || sit.proximoEnvioEm < proximoEnvioEm)) { proximoEnvioEm = sit.proximoEnvioEm; intervaloSeg = sit.tempos.intervaloSeg }
    if (sit && ['SEM_CONEXAO', 'LIMITE_HORA', 'LIMITE_DIA'].includes(sit.motivo)) atencao.push({ id: c.id, nome: c.nome, status: c.status, motivo: sit.motivo, titulo: sit.titulo, texto: sit.texto })
    if (decidir) atencao.push({ id: c.id, nome: c.nome, status: c.status, motivo: 'DECIDIR', titulo: `${decidir} mensagem(ns) para decidir`, texto: 'Sem confirmação ou com as tentativas esgotadas: decida se reenvia ou considera enviada.' })
  }
  return {
    anterior,
    porDia,
    atencao,
    andamento,
    agora: { enviando: ativas.filter(a => a.status === 'RUNNING').length, naFila: ativas.filter(a => a.status === 'QUEUED').length, pausadas: ativas.filter(a => a.status === 'PAUSED').length, proximoEnvioEm, intervaloSeg },
    aprovacao: { quantos: aprovacao.length, primeira: aprovacao[0] ? { id: aprovacao[0].id, nome: aprovacao[0].nome, de: aprovacao[0].criadoPorNome, desde: aprovacao[0].atualizadoEm } : null },
    proximaAgendada: proxima ? { id: proxima.id, nome: proxima.nome, em: proxima.agendadaPara } : null,
  }
}
