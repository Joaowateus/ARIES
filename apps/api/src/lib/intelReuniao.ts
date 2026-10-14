// Modo reunião (tráfego, comercial ou integrada): as perguntas da pauta
// respondidas com os números da Central, sem opinião. Quando o dado não
// existe, a resposta diz isso e qual registro falta.
import type { DadosCentral } from './intelCentral'
import { brl } from './intelCentral'
import type { Diagnostico } from './intelDiagnostico'
import { NOME_ETAPA, PASSAGENS, razao } from './intelMotor'

export type TipoReuniao = 'TRAFEGO' | 'COMERCIAL' | 'INTEGRADA'
export interface Resposta { pergunta: string; resposta: string; status: 'OK' | 'ATENCAO' | 'CRITICO' | 'SEM_DADOS'; evidencia?: string }

const p1 = (v: number | null | undefined) => (v == null ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)
const n1 = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }))

export function pautaDaReuniao(tipo: TipoReuniao, d: DadosCentral, diags: Diagnostico[]): Resposta[] {
  const r: Resposta[] = []
  const t = d.trafego
  const ln = d.metas.leadsNecessarios
  const projLeads = d.metas.calendario.decorridos ? Math.round((ln.geradosNoMes / d.metas.calendario.decorridos) * d.metas.calendario.total) : null
  const temDiag = (prefixo: string) => diags.find(x => x.chave.startsWith(prefixo))

  if (tipo === 'TRAFEGO' || tipo === 'INTEGRADA') {
    if (!t) r.push({ pergunta: 'O investimento está no ritmo correto?', resposta: 'Seu acesso não inclui os números de investimento.', status: 'SEM_DADOS' })
    else {
      const pct = t.ritmo.pct
      r.push({ pergunta: 'O investimento está no ritmo correto?', status: pct == null ? 'SEM_DADOS' : pct * 100 > d.premissas.criterios.ritmoInvestimentoAltoPct ? 'CRITICO' : pct < 0.7 ? 'ATENCAO' : 'OK',
        resposta: pct == null ? 'Sem investimento registrado no mês (conecte o Tráfego ou lance o gasto nos Indicadores).' : `${brl(t.ritmo.gastoMes)} até hoje, ${p1(pct)} do proporcional ao orçamento (${brl(t.ritmo.orcamentoProporcional)}). No ritmo, o mês fecha em ${brl(t.ritmo.projecaoMes)} para um orçamento de ${brl(d.premissas.orcamentoMarketing)}.` })
      const max = d.metas.cplMaximo?.comConversaoAtual
      r.push({ pergunta: 'O CPL está dentro do limite?', status: d.resumo.cplMes == null || max == null ? 'SEM_DADOS' : d.resumo.cplMes <= max ? 'OK' : 'ATENCAO',
        resposta: d.resumo.cplMes == null ? 'Sem investimento ou sem leads no mês para calcular.' : `CPL do mês no CRM: ${brl(d.resumo.cplMes)}. O limite compatível com a meta, na conversão atual, é ${brl(max)}${d.metas.cplMaximo?.comMetas != null ? ` (com as metas gerenciais seria ${brl(d.metas.cplMaximo.comMetas)})` : ''}.` })
    }
    r.push({ pergunta: 'O volume de leads atende à necessidade do comercial?', status: ln.comConversaoAtual == null || projLeads == null ? 'SEM_DADOS' : projLeads >= ln.comConversaoAtual ? 'OK' : 'ATENCAO',
      resposta: ln.comConversaoAtual == null ? 'Sem conversão de referência suficiente para calcular a necessidade.' : `${ln.geradosNoMes} leads até hoje, ${projLeads} projetados no mês. A meta pede ${ln.comConversaoAtual} com a conversão atual (${p1(d.funil.referencia.conversaoTotal)}).` })
    if (t) {
      const q = t.qualidade
      r.push({ pergunta: 'Os leads estão se transformando em oportunidades?', status: q.trafego.taxaNegociacao == null ? 'SEM_DADOS' : q.outros.taxaNegociacao != null && q.trafego.taxaNegociacao < q.outros.taxaNegociacao - 0.05 ? 'ATENCAO' : 'OK',
        resposta: q.trafego.leads === 0 ? 'Nenhum lead marcado como Tráfego na coorte de referência.' : `${p1(q.trafego.taxaNegociacao)} dos ${q.trafego.leads} leads de tráfego chegaram à negociação; nos demais canais, ${p1(q.outros.taxaNegociacao)}.` })
      const comRes = t.campanhas.filter(c => c.conversas + c.leads >= 10)
      r.push({ pergunta: 'Quais campanhas geram leads de melhor qualidade?', status: 'SEM_DADOS', resposta: 'O lead do CRM não guarda a campanha de origem, então a qualidade só é medida por canal (Tráfego × demais). Na plataforma, o menor custo por resultado no período é: ' + (comRes.length ? comRes.slice().sort((a, b) => (a.custoResultado ?? 1e9) - (b.custoResultado ?? 1e9)).slice(0, 3).map(c => `${c.nome} (${brl(c.custoResultado)})`).join(', ') : 'nenhuma campanha com 10 resultados ou mais') + '.' })
      r.push({ pergunta: 'Quais campanhas geram vendas atribuídas?', status: 'SEM_DADOS', resposta: `Por campanha, não há como atribuir (falta o identificador da campanha no lead). Pelo canal: ${t.atribuicao.vendas} vendas de leads de tráfego no mês, ${brl(t.atribuicao.faturamento)} de faturamento, ${brl(t.atribuicao.custoPorVenda)} de mídia por venda atribuída.` })
      const ordenadas = comRes.slice().sort((a, b) => (a.custoResultado ?? 1e9) - (b.custoResultado ?? 1e9))
      const evid = ordenadas.length >= 2 && ordenadas[0].custoResultado != null && ordenadas[ordenadas.length - 1].custoResultado != null && (ordenadas[ordenadas.length - 1].custoResultado as number) > (ordenadas[0].custoResultado as number) * 1.3
      r.push({ pergunta: 'Há evidência suficiente para realocar orçamento?', status: evid ? 'ATENCAO' : 'SEM_DADOS',
        resposta: evid ? `Sim, na plataforma: "${ordenadas[ordenadas.length - 1].nome}" custa ${brl(ordenadas[ordenadas.length - 1].custoResultado)} por resultado contra ${brl(ordenadas[0].custoResultado)} em "${ordenadas[0].nome}", ambas com 10+ resultados. Confirme a qualidade no CRM antes de mudar (decisão do gestor).` : 'Ainda não: menos de duas campanhas com 10 resultados ou diferença pequena de custo. Mudar agora seria decidir com amostra pequena.' })
    }
    const teste = diags.find(x => x.departamento === 'TRAFEGO')
    r.push({ pergunta: 'Qual teste deve ser executado e que resultado indicará sucesso?', status: teste ? 'ATENCAO' : 'OK', resposta: teste ? `${teste.acao} Sucesso: ${teste.indicador.nome} de ${teste.indicador.atual ?? '—'} para ${teste.indicador.meta ?? '—'}.` : 'Nenhum desvio de tráfego acima dos critérios agora.' })
  }

  if (tipo === 'COMERCIAL' || tipo === 'INTEGRADA') {
    const v = d.resumo.vendas
    r.push({ pergunta: 'Quantas vendas precisamos realizar?', status: 'OK', resposta: `Meta de ${v.meta ?? '—'} vendas; ${v.realizado} feitas; faltam ${v.falta ?? '—'} em ${d.metas.calendario.restantes} dias úteis (${n1(d.metas.ritmoVendas.porDia)} por dia).` })
    const proj = d.metas.projecao
    r.push({ pergunta: 'Quantas vendas estão previstas?', status: !proj.suficiente ? 'SEM_DADOS' : (proj.base ?? 0) >= (v.meta ?? 0) ? 'OK' : 'ATENCAO',
      resposta: proj.suficiente ? `Projeção base de ${n1(proj.base)} (conservador ${n1(proj.conservador)}, otimista ${n1(proj.otimista)}). As ${d.metas.pipeline.propostasAbertas} propostas em aberto rendem cerca de ${n1(d.metas.pipeline.vendasEsperadas)} vendas pela conversão histórica.` : proj.motivo ?? 'Sem dados.' })
    r.push({ pergunta: 'Qual é o déficit?', status: (v.falta ?? 0) > 0 ? 'ATENCAO' : 'OK', resposta: `${v.falta ?? '—'} vendas e ${brl(d.resumo.faturamento.falta)} de faturamento bruto para a meta.` })
    const g = d.funil.gargalo as null | { passagem: string; vendasPerdidas: number; faturamento: number | null }
    r.push({ pergunta: 'Qual etapa apresenta o maior gargalo?', status: g ? 'ATENCAO' : 'OK', resposta: g ? `${g.passagem}: se chegasse à meta, seriam cerca de ${n1(g.vendasPerdidas)} vendas a mais na coorte de referência (${brl(g.faturamento)}, estimativa).` : 'Todas as etapas estão na meta ou sem amostra suficiente.' })
    const apoio = diags.filter(x => x.chave.startsWith('apoio-'))
    const linhas = d.equipe?.linhas ?? []
    r.push({ pergunta: 'Quais vendedores precisam de apoio?', status: apoio.length ? 'ATENCAO' : 'OK', resposta: apoio.length ? apoio.map(x => x.evidencia).join(' ') : linhas.length ? `Menor índice de execução hoje: ${[...linhas].sort((a, b) => a.indice - b.indice).slice(0, 2).map(l => `${l.nome} (${l.indice})`).join(', ')}.` : 'Sem dados da equipe.' })
    const perdidosPorEtapa = PASSAGENS.map(([de, para], i) => `${NOME_ETAPA[de]} → ${NOME_ETAPA[para]}: ${d.funil.referencia.perdas[i].absoluta ?? '—'}`).join('; ')
    r.push({ pergunta: 'Quais motivos de perda são mais frequentes?', status: 'SEM_DADOS', resposta: `O CRM ainda não registra o motivo da perda, só a etapa. Perdas por etapa na coorte de referência: ${perdidosPorEtapa}. Registrar o motivo é a primeira ação para responder isso.` })
    const piores = d.funil.referencia.conversoes.map((c, i) => ({ i, gap: c == null ? 0 : d.funil.metasConversao[i] - c })).sort((a, b) => b.gap - a.gap)[0]
    const area = ['atendimento (primeiro contato)', 'qualificação', 'negociação (simulação e condições)', 'fechamento'][piores.i]
    const demanda = temDiag('volume-leads')
    r.push({ pergunta: 'O problema está na demanda, no atendimento, na negociação ou no fechamento?', status: piores.gap > 0 || demanda ? 'ATENCAO' : 'OK',
      resposta: `${demanda ? 'Demanda: o volume de leads está abaixo do necessário. ' : ''}${piores.gap > 0 ? `No funil, a maior distância da meta está em ${area} (${p1(d.funil.referencia.conversoes[piores.i])} contra ${p1(d.funil.metasConversao[piores.i])}).` : 'No funil, as etapas estão na meta.'}` })
    const hoje = [
      d.equipe?.whatsapp.esperando ? `responder ${d.equipe.whatsapp.esperando} conversas esperando no WhatsApp` : null,
      d.equipe?.semAbordar ? `abordar ${d.equipe.semAbordar} leads novos parados` : null,
      d.metas.pipeline.propostasAbertas ? `fazer o follow-up das ${d.metas.pipeline.propostasAbertas} propostas em aberto` : null,
    ].filter(Boolean)
    r.push({ pergunta: 'Quais ações devem ser executadas hoje?', status: hoje.length ? 'ATENCAO' : 'OK', resposta: hoje.length ? `${hoje.join('; ')}.` : 'Nada urgente na fila do CRM.' })
  }

  if (tipo === 'INTEGRADA') {
    const cls: Array<[string, string | null, string]> = [
      ['Geração de demanda', 'volume-leads', 'volume de leads frente ao necessário'],
      ['Qualidade dos leads', 'qualidade-trafego', 'leads de tráfego que chegam à negociação'],
      ['Distribuição dos leads', 'apoio-', 'abordagem por vendedor'],
      ['Atendimento', 'sem-abordar', 'leads parados e WhatsApp esperando'],
      ['Qualificação', 'conv-ABORDADO-NEGOCIACAO', 'abordado → negociação'],
      ['Oferta, preço ou condições', 'conv-NEGOCIACAO-PROPOSTA', 'negociação → proposta'],
      ['Fechamento', 'conv-PROPOSTA-FECHADO', 'proposta → fechamento'],
      ['Margem e rentabilidade', 'custo-venda', 'custo de marketing por venda e margem'],
    ]
    for (const [nome, chave, sobre] of cls) {
      const x = chave ? diags.find(y => y.chave.startsWith(chave) || (chave === 'sem-abordar' && y.chave === 'whats-esperando')) : null
      r.push({ pergunta: `${nome}?`, status: x ? (x.severidade === 'CRITICO' ? 'CRITICO' : 'ATENCAO') : 'OK', resposta: x ? `${x.problema} ${x.evidencia}` : `Sem desvio acima dos critérios em ${sobre}.` })
    }
    const cap = razao(d.metas.leadsNecessarios.comConversaoAtual, d.premissas.vendedores.planejados ?? d.vendedoresAtivos)
    r.push({ pergunta: 'Capacidade operacional?', status: 'OK', resposta: cap != null ? `A meta pede cerca de ${Math.round(cap)} leads por vendedor no mês (${d.premissas.vendedores.planejados ?? d.vendedoresAtivos} vendedores).` : 'Sem dados para estimar.' })
  }
  return r
}

/** Números-chave guardados com a ata da reunião (para comparar depois). */
export function retratoParaAta(d: DadosCentral) {
  return {
    mes: d.periodo.mes, vendas: d.resumo.vendas.realizado, metaVendas: d.resumo.vendas.meta, projecaoBase: d.resumo.vendas.previstasBase,
    faturamento: d.resumo.faturamento.realizado, leadsMes: d.resumo.leadsMes, conversoes: d.funil.referencia.conversoes,
    investimento: d.resumo.investimento?.realizado ?? null, cplMes: d.resumo.cplMes,
  }
}
