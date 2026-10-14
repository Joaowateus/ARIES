// Fechamento diário: cada aba prepara o resumo do dia a partir dos mesmos
// cálculos da Central, a pessoa confere e confirma, e o relatório é guardado
// com versão. Reenviar o mesmo módulo e dia não duplica nada: se os números
// são os mesmos, nada muda; se mudaram, nasce a versão seguinte e a anterior
// fica marcada como substituída (histórico para auditoria).
import { createHash } from 'crypto'
import { prisma } from './prisma'
import { montarCentral, type Acesso, type DadosCentral } from './intelCentral'
import { gerarDiagnosticos, type Departamento } from './intelDiagnostico'
import { arred, razao } from './intelMotor'

export const MODULOS_RELATORIO = ['JORNADA', 'TRAFEGO', 'SOCIAL_MEDIA', 'VENDAS', 'FINANCEIRO'] as const
export type ModuloRelatorio = (typeof MODULOS_RELATORIO)[number]
export const NOME_MODULO: Record<ModuloRelatorio, string> = { JORNADA: 'Jornada de compra', TRAFEGO: 'Tráfego', SOCIAL_MEDIA: 'Social Media', VENDAS: 'Vendas', FINANCEIRO: 'Financeiro' }
const DEP_DO_MODULO: Record<ModuloRelatorio, Departamento[]> = { JORNADA: ['COMERCIAL'], TRAFEGO: ['TRAFEGO'], SOCIAL_MEDIA: ['SOCIAL_MEDIA'], VENDAS: ['GESTAO', 'COMERCIAL'], FINANCEIRO: ['FINANCEIRO'] }

export interface IndicadorRelatorio {
  chave: string; nome: string; valor: number | null; unidade: 'BRL' | 'PCT' | 'NUM'; meta: number | null; desvio: number | null
  formula: string; fonte: string; natureza: 'REALIZADO' | 'META' | 'PROJECAO' | 'PLATAFORMA' | 'CRM'
}

const ind = (chave: string, nome: string, valor: number | null, unidade: IndicadorRelatorio['unidade'], fonte: string, formula: string, natureza: IndicadorRelatorio['natureza'] = 'REALIZADO', meta: number | null = null): IndicadorRelatorio =>
  ({ chave, nome, valor: valor == null ? null : arred(valor, 2), unidade, meta: meta == null ? null : arred(meta, 2), desvio: valor != null && meta != null ? arred(valor - meta, 2) : null, formula, fonte, natureza })

/** Indicadores do dia (e o acumulado do mês) de um módulo, a partir da Central. */
function indicadoresDo(modulo: ModuloRelatorio, dia: DadosCentral, mes: DadosCentral): IndicadorRelatorio[] {
  const uteis = mes.metas.calendario.total || 1
  const metaDia = (v: number | null) => (v == null ? null : v / uteis)
  if (modulo === 'JORNADA') {
    const c = dia.funil.porAvanco.contagens
    const f = 'Jornada de compra (CRM): quem alcançou a etapa no dia'
    return [
      ind('leads_dia', 'Leads novos no dia', c.LEAD, 'NUM', f, 'leads criados no dia', 'CRM', metaDia(mes.metas.leadsNecessarios.comConversaoAtual)),
      ind('abordados_dia', 'Abordados no dia', c.ABORDADO, 'NUM', f, 'leads que alcançaram Abordado no dia', 'CRM'),
      ind('negociacao_dia', 'Entraram em negociação', c.NEGOCIACAO, 'NUM', f, 'leads que alcançaram Negociação no dia', 'CRM'),
      ind('propostas_dia', 'Propostas no dia', c.PROPOSTA, 'NUM', f, 'leads que alcançaram Proposta no dia', 'CRM'),
      ind('fechados_dia', 'Fechamentos no dia (CRM)', c.FECHADO, 'NUM', f, 'leads que alcançaram Fechado no dia', 'CRM'),
      ind('leads_mes', 'Leads no mês', mes.metas.leadsNecessarios.geradosNoMes, 'NUM', 'Jornada de compra (CRM)', 'leads criados do dia 1 até hoje', 'CRM', mes.metas.leadsNecessarios.comConversaoAtual),
      ...mes.funil.referencia.conversoes.map((v, i) => ind(`conv_${i}`, ['Lead → abordado', 'Abordado → negociação', 'Negociação → proposta', 'Proposta → fechamento'][i], v == null ? null : v * 100, 'PCT', 'Coorte de referência (90 a 7 dias)', 'avançaram ÷ elegíveis da etapa anterior', 'REALIZADO', mes.funil.metasConversao[i] * 100)),
      ind('sem_abordar', 'Leads novos sem abordagem', mes.equipe?.semAbordar ?? null, 'NUM', 'Copiloto (CRM)', 'leads em Novo há mais de 1 dia', 'CRM', 0),
    ]
  }
  if (modulo === 'TRAFEGO') {
    const p = dia.trafego?.plataforma, m = mes.trafego
    const fp = 'Tráfego (Meta Ads)'
    return [
      ind('gasto_dia', 'Investimento no dia', p?.gasto ?? null, 'BRL', fp, 'soma do gasto do dia', 'PLATAFORMA', mes.premissas.orcamentoMarketing / (new Date(Date.UTC(Number(mes.periodo.mes.slice(0, 4)), Number(mes.periodo.mes.slice(5, 7)), 0)).getUTCDate())),
      ind('impressoes_dia', 'Impressões', p?.impressoes ?? null, 'NUM', fp, 'soma do dia', 'PLATAFORMA'),
      ind('cliques_dia', 'Cliques no link', p?.cliquesLink ?? null, 'NUM', fp, 'soma do dia', 'PLATAFORMA'),
      ind('ctr_dia', 'CTR', p?.ctr == null ? null : p.ctr * 100, 'PCT', fp, 'cliques no link ÷ impressões', 'PLATAFORMA'),
      ind('cpc_dia', 'CPC', p?.cpc ?? null, 'BRL', fp, 'gasto ÷ cliques no link', 'PLATAFORMA'),
      ind('cpm_dia', 'CPM', p?.cpm ?? null, 'BRL', fp, 'gasto × 1000 ÷ impressões', 'PLATAFORMA'),
      ind('conversas_dia', 'Conversas iniciadas', p?.conversas ?? null, 'NUM', fp, 'soma do dia (plataforma)', 'PLATAFORMA'),
      ind('leads_plataforma_dia', 'Leads na plataforma', p?.leads ?? null, 'NUM', fp, 'soma do dia (plataforma)', 'PLATAFORMA'),
      ind('leads_crm_dia', 'Leads de tráfego no CRM', dia.trafego?.crm.leadsTrafego ?? null, 'NUM', 'CRM', 'leads marcados como Tráfego criados no dia', 'CRM'),
      ind('cpl_crm_dia', 'CPL (CRM)', dia.trafego?.crm.cplCrm ?? null, 'BRL', 'Tráfego + CRM', 'gasto ÷ leads de tráfego no CRM', 'CRM', mes.metas.cplMaximo?.comConversaoAtual ?? null),
      ind('gasto_mes', 'Investimento no mês', m?.ritmo.gastoMes ?? null, 'BRL', mes.resumo.investimento?.fonte ?? fp, 'do dia 1 até hoje', 'REALIZADO', m?.ritmo.orcamentoProporcional ?? null),
    ]
  }
  if (modulo === 'SOCIAL_MEDIA') {
    const s = dia.social as null | Record<string, Record<string, number | null>>
    const f = 'Social Media (Instagram, orgânico)'
    return [
      ind('publicacoes_dia', 'Publicações no feed', s?.producao?.publicacoesNoFeed ?? null, 'NUM', f, 'posts publicados no dia', 'PLATAFORMA'),
      ind('pautas_publicadas_dia', 'Pautas publicadas pela Produção', s?.producao?.publicadasPelaProducao ?? null, 'NUM', 'Social Media (Produção)', 'pautas com status Publicado no dia', 'REALIZADO', s?.producao?.planejadas ?? null),
      ind('alcance_dia', 'Alcance do dia', s?.distribuicao?.alcanceMedioDia ?? null, 'NUM', f, 'alcance médio por dia no período', 'PLATAFORMA'),
      ind('visualizacoes_dia', 'Visualizações', s?.distribuicao?.visualizacoes ?? null, 'NUM', f, 'soma do dia', 'PLATAFORMA'),
      ind('interacoes_dia', 'Interações', s?.interesse?.interacoes ?? null, 'NUM', f, 'curtidas + comentários + compartilhamentos + salvamentos + respostas', 'PLATAFORMA'),
      ind('visitas_dia', 'Visitas ao perfil', s?.interesse?.visitasPerfil ?? null, 'NUM', f, 'soma do dia', 'PLATAFORMA'),
      ind('cliques_links_dia', 'Cliques nos links rastreados', s?.interesse?.cliquesLinksRastreados ?? null, 'NUM', 'Social Media (links /r)', 'cliques registrados no dia', 'CRM'),
      ind('seguidores_dia', 'Novos seguidores', s?.conversao?.novosSeguidores ?? null, 'NUM', f, 'seguidores ganhos no dia', 'PLATAFORMA'),
      ind('leads_organicos_dia', 'Leads atribuídos ao Instagram', s?.conversao?.leadsOrganicos ?? null, 'NUM', 'CRM', 'leads com origem Instagram orgânico no dia', 'CRM'),
    ]
  }
  if (modulo === 'VENDAS') {
    const v = mes.resumo
    return [
      ind('vendas_mes', 'Vendas no mês', v.vendas.realizado, 'NUM', 'Vendas', 'vendas registradas do dia 1 até hoje', 'REALIZADO', v.vendas.meta),
      ind('faturamento_mes', 'Faturamento bruto no mês', v.faturamento.realizado, 'BRL', 'Vendas', 'soma do valor de venda', 'REALIZADO', v.faturamento.meta),
      ind('atingimento_mes', 'Atingimento da meta de faturamento', v.faturamento.atingimento == null ? null : v.faturamento.atingimento * 100, 'PCT', 'Vendas', 'faturamento ÷ meta', 'REALIZADO', 100),
      ind('ticket_mes', 'Ticket médio real', v.vendas.ticketReal, 'BRL', 'Vendas', 'faturamento ÷ vendas', 'REALIZADO', mes.premissas.ticketMedio),
      ind('projecao_base', 'Vendas projetadas no mês (base)', v.vendas.previstasBase, 'NUM', 'Central (projeção)', mes.metas.projecao.formula, 'PROJECAO', v.vendas.meta),
      ind('pipeline', 'Vendas esperadas das propostas em aberto', mes.metas.pipeline.vendasEsperadas, 'NUM', 'Central (estimativa)', mes.metas.pipeline.formula, 'PROJECAO'),
    ]
  }
  const f = mes.financeiro
  return [
    ind('faturamento_mes', 'Faturamento bruto no mês', f?.faturamentoBruto ?? null, 'BRL', 'Vendas', 'soma do valor de venda (não é lucro)', 'REALIZADO'),
    ind('investimento_mes', 'Investimento em marketing no mês', f?.investimentoMarketing ?? null, 'BRL', mes.resumo.investimento?.fonte ?? 'sem fonte', 'do dia 1 até hoje', 'REALIZADO', mes.premissas.orcamentoMarketing),
    ind('custo_venda_mes', 'Custo de marketing por venda', mes.resumo.custoMarketingPorVenda, 'BRL', 'Central', 'investimento ÷ vendas do mês', 'REALIZADO', mes.premissas.tetoCustoMarketingVenda),
    ind('comissoes_mes', 'Comissões no mês', f?.comissoes ?? null, 'BRL', 'Vendas', 'soma das comissões das vendas', 'REALIZADO'),
    ind('lancado_mes', 'Despesas lançadas no Financeiro no mês', f?.totalLancado ?? null, 'BRL', 'Financeiro', 'lançamentos pagos do dia 1 até hoje', 'REALIZADO'),
    ind('margem_mes', 'Margem de contribuição', f?.margemContribuicao ?? null, 'BRL', 'Premissas', 'margem por venda × vendas (quando configurada)', 'REALIZADO'),
    ind('roas_mes', 'ROAS geral', f?.roasGeral ?? null, 'NUM', 'Central', 'faturamento do mês ÷ investimento do mês (escopo: operação inteira)', 'REALIZADO'),
  ]
}

export async function previaRelatorio(usuarioId: string, modulo: ModuloRelatorio, diaRef: string, acesso: Acesso, agora = new Date()) {
  const [dia, mes] = await Promise.all([
    montarCentral(usuarioId, { inicio: diaRef, fim: diaRef }, acesso, agora),
    montarCentral(usuarioId, { inicio: `${diaRef.slice(0, 7)}-01`, fim: diaRef }, acesso, agora),
  ])
  const acoesAtrasadas = await prisma.intelAcao.count({ where: { usuarioId, prazo: { lt: agora }, status: { in: ['IDENTIFICADA', 'AGUARDANDO_APROVACAO', 'PLANEJADA', 'EM_EXECUCAO'] } } })
  const indicadores = indicadoresDo(modulo, dia, mes)
  const alertas = gerarDiagnosticos(mes, { acoesAtrasadas }).filter(x => DEP_DO_MODULO[modulo].includes(x.departamento))
    .map(x => ({ severidade: x.severidade, problema: x.problema, evidencia: x.evidencia }))
  const incompletos = indicadores.filter(i => i.valor == null).map(i => i.nome)
  const origem = {
    leadsDoDia: dia.funil.porAvanco.contagens.LEAD, leadsDoMes: mes.metas.leadsNecessarios.geradosNoMes, vendasDoMes: mes.resumo.vendas.realizado,
    fontes: mes.fontes.map(f => ({ modulo: f.modulo, status: f.status, ultimaAtualizacao: f.ultimaAtualizacao })),
  }
  const hash = createHash('sha256').update(JSON.stringify({ modulo, dia: diaRef, valores: indicadores.map(i => [i.chave, i.valor, i.meta]) })).digest('hex').slice(0, 32)
  return { modulo, nome: NOME_MODULO[modulo], dia: diaRef, periodoInicio: diaRef, periodoFim: diaRef, indicadores, alertas, incompletos, origem, hash }
}

/** Confirma o fechamento: mesma versão se nada mudou; senão, versão nova e a anterior substituída. */
export async function confirmarRelatorio(usuarioId: string, previa: Awaited<ReturnType<typeof previaRelatorio>>, autor: { id: string; nome: string }, observacao: string | null) {
  const anterior = await prisma.intelRelatorio.findFirst({ where: { usuarioId, modulo: previa.modulo, dia: previa.dia, status: 'VALIDO' }, orderBy: { versao: 'desc' } })
  if (anterior && anterior.hash === previa.hash && (anterior.observacao ?? null) === (observacao ?? null)) return { relatorio: anterior, duplicado: true }
  const ultima = await prisma.intelRelatorio.findFirst({ where: { usuarioId, modulo: previa.modulo, dia: previa.dia }, orderBy: { versao: 'desc' }, select: { versao: true } })
  const versao = (ultima?.versao ?? 0) + 1
  const relatorio = await prisma.$transaction(async tx => {
    if (anterior) await tx.intelRelatorio.update({ where: { id: anterior.id }, data: { status: 'SUBSTITUIDO' } })
    const r = await tx.intelRelatorio.create({
      data: {
        usuarioId, modulo: previa.modulo, dia: previa.dia, periodoInicio: previa.periodoInicio, periodoFim: previa.periodoFim, versao, status: 'VALIDO',
        indicadores: previa.indicadores as never, alertas: previa.alertas as never, origem: previa.origem as never, hash: previa.hash,
        geradoPorId: autor.id, geradoPorNome: autor.nome, observacao,
      },
    })
    await tx.intelAuditoria.create({ data: { usuarioId, entidade: 'RELATORIO', entidadeId: r.id, acao: anterior ? 'NOVA_VERSAO' : 'CONFIRMADO', antes: anterior ? { versao: anterior.versao, hash: anterior.hash } : undefined, depois: { modulo: r.modulo, dia: r.dia, versao, hash: r.hash }, autorId: autor.id, autorNome: autor.nome } })
    return r
  })
  return { relatorio, duplicado: false }
}

/** Valores ao vivo comparados com o último fechamento confirmado do dia. */
export function diferencas(confirmado: Array<{ chave: string; nome: string; valor: number | null }>, aoVivo: IndicadorRelatorio[]) {
  return aoVivo.map(v => {
    const c = confirmado.find(x => x.chave === v.chave)
    return c && c.valor !== v.valor ? { chave: v.chave, nome: v.nome, confirmado: c.valor, aoVivo: v.valor, variacao: razao((v.valor ?? 0) - (c.valor ?? 0), c.valor ?? null) } : null
  }).filter(Boolean)
}
