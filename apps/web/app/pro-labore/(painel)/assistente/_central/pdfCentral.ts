// PDF gerencial do Assistente Comercial: o retrato completo da Central
// (mês até hoje) com o dia em destaque. Resumo executivo, metas e ritmo,
// projeção e cenários, série do mês, funil nas três leituras, aquisição
// (tráfego e Instagram), equipe, departamentos, diagnósticos com hipóteses,
// plano de ação, financeiro (só na versão da gestão), estoque, premissas,
// fontes e glossário. Só entra o que a pessoa já pode ver na Central.
import type { IntelAcao, IntelCentral, IntelEtapa, IntelSeveridade } from '@/lib/proLaboreApi'
import { ddmmPdf, diaBR, type BlocoPdf, type CelulaPdf, type DestaquePdf, type RelatorioPdf, type Tom } from '@/lib/relatorioPdf'
import { DEPARTAMENTO, ETAPAS, NOME_ETAPA, PASSAGENS, SEVERIDADE, STATUS_ACAO, STATUS_ABERTOS, brl, dataBR, dataHoraBR, nomeMes, num, pct, pct100, pp, valorIndicador } from './fmt'

const TOM_SEVERIDADE: Record<IntelSeveridade, Tom> = { CRITICO: 'ruim', ALTO: 'ruim', MODERADO: 'atencao', MONITORAMENTO: 'neutro' }
const ORDEM_SEVERIDADE: IntelSeveridade[] = ['CRITICO', 'ALTO', 'MODERADO', 'MONITORAMENTO']
const STATUS_LINHA: Record<string, { texto: string; tom?: Tom }> = { OK: { texto: 'OK', tom: 'bom' }, ATENCAO: { texto: 'Atenção', tom: 'atencao' }, CRITICO: { texto: 'Crítico', tom: 'ruim' }, SEM_DADOS: { texto: 'Sem dados' }, INFO: { texto: '-' } }
const STATUS_FONTE: Record<string, { texto: string; tom?: Tom }> = { OK: { texto: 'Em dia', tom: 'bom' }, ATRASADO: { texto: 'Atrasada', tom: 'atencao' }, ERRO: { texto: 'Com erro', tom: 'ruim' }, SEM_CONEXAO: { texto: 'Sem conexão', tom: 'ruim' }, MANUAL: { texto: 'Manual' }, SEM_DADOS: { texto: 'Sem dados' } }
const CONFIANCA: Record<string, string> = { ALTA: 'alta', MEDIA: 'média', BAIXA: 'baixa' }
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const NOME_LEITURA = { oficial: 'Oficial (Dashboard)', porAvanco: 'Por data de avanço', coorte: 'Coorte do mês' }

export interface OpcoesRelatorioCentral {
  /** Versão da gestão: entra o financeiro (e o pró-labore, para quem pode ver). */
  gestao: boolean
}

function leituras(d: IntelCentral): DestaquePdf[] {
  const r = d.resumo, m = d.metas, f = d.funil
  const out: DestaquePdf[] = []
  const at = r.faturamento.atingimento
  const decorrido = m.calendario.total ? m.calendario.decorridos / m.calendario.total : null
  out.push({
    tom: at != null && decorrido != null ? (at >= decorrido ? 'bom' : at >= decorrido * 0.8 ? 'atencao' : 'ruim') : 'neutro',
    titulo: 'Faturamento contra a meta',
    texto: `${brl(r.faturamento.realizado)} faturados, ${pct(at)} da meta de ${brl(r.faturamento.meta)}, com ${pct(decorrido, 0)} dos dias úteis já passados. Faltam ${brl(r.faturamento.falta)}: ${brl(m.ritmoFaturamento.porDia)} e ${num(m.ritmoVendas.porDia, 1)} vendas por dia útil nos ${m.calendario.restantes} que restam. No mesmo ponto do mês anterior: ${brl(r.faturamento.mesAnteriorMesmoPonto)}.`,
  })
  const p = m.projecao
  if (p.suficiente && r.vendas.meta) out.push({ tom: (p.base ?? 0) >= r.vendas.meta ? 'bom' : 'ruim', titulo: 'Projeção do mês', texto: `No ritmo atual o mês fecha com ${num(p.base, 1)} vendas (entre ${num(p.conservador, 1)} e ${num(p.otimista, 1)}), contra a meta de ${num(r.vendas.meta)}: ${brl(r.faturamento.projecaoBase)} de faturamento no cenário base.` })
  else if (p.motivo) out.push({ tom: 'neutro', titulo: 'Projeção do mês', texto: p.motivo })
  if (f.gargalo) out.push({ tom: 'ruim', titulo: `Gargalo: ${f.gargalo.passagem}`, texto: `É a passagem do funil que mais trava: se estivesse na meta, seriam ${num(f.gargalo.vendasPerdidas, 1)} vendas a mais${f.gargalo.faturamento != null ? ` (cerca de ${brl(f.gargalo.faturamento)})` : ''}, mantidas as outras etapas.` })
  if (m.leadsNecessarios.comConversaoAtual != null) out.push({ tom: (m.leadsNecessarios.faltamComConversaoAtual ?? 0) > 0 ? 'atencao' : 'bom', titulo: 'Leads para bater a meta', texto: `Com a conversão atual, a meta pede ${num(m.leadsNecessarios.comConversaoAtual)} leads no mês (${num(m.leadsNecessarios.geradosNoMes)} já gerados${m.leadsNecessarios.faltamComConversaoAtual ? `, faltam ${num(m.leadsNecessarios.faltamComConversaoAtual)}` : ''}). Com as metas de conversão batidas, bastariam ${num(m.leadsNecessarios.comMetas)}.` })
  const t = d.trafego
  if (t?.conectado && d.acesso.verInvestimento && t.plataforma) out.push({ tom: t.atribuicao.roas != null && t.atribuicao.roas >= 5 ? 'bom' : 'neutro', titulo: 'Tráfego pago', texto: `${brl(t.plataforma.gasto)} investidos no mês (${pct(t.ritmo.pct, 0)} do orçamento proporcional). ${num(t.crm.leadsTrafego)} leads do tráfego no CRM a ${brl(t.crm.cplCrm)} cada; ${pct(t.qualidade.trafego.taxaNegociacao, 0)} chegam à negociação (outros canais: ${pct(t.qualidade.outros.taxaNegociacao, 0)}). Atribuição: ${num(t.atribuicao.vendas)} vendas, ROAS ${t.atribuicao.roas != null ? `${num(t.atribuicao.roas, 1)}x` : '—'}.` })
  const eq = d.equipe
  if (eq) out.push({ tom: eq.parados + eq.semAbordar > 0 ? 'atencao' : 'bom', titulo: 'Equipe', texto: `${num(eq.semAbordar)} leads sem abordagem e ${num(eq.parados)} parados. Tempo até a 1ª abordagem: ${num(eq.tempoAbordagemHoras, 1)} h. ${num(eq.whatsapp.esperando)} conversas esperando resposta no WhatsApp.` })
  const ac = d.acoesResumo
  if (ac.abertas || ac.atrasadas) out.push({ tom: ac.atrasadas ? 'ruim' : 'neutro', titulo: 'Plano de ação', texto: `${num(ac.abertas)} ações abertas, ${num(ac.atrasadas)} atrasadas; ${num(ac.concluidas)} concluídas (${num(ac.concluidasNoPrazo)} no prazo).` })
  if (d.inconsistencias.length) out.push({ tom: 'atencao', titulo: 'Dados para conferir', texto: `${d.inconsistencias.length} ${d.inconsistencias.length === 1 ? 'inconsistência' : 'inconsistências'} entre as fontes (detalhe no fim do relatório).` })
  return out
}

const etapaCel = (e: IntelEtapa) => ({ texto: NOME_ETAPA[e], negrito: true })

export function relatorioCentral(d: IntelCentral, opcoes: OpcoesRelatorioCentral = { gestao: false }): RelatorioPdf {
  const hoje = d.periodo.hoje
  const r = d.resumo, m = d.metas, f = d.funil
  const verInv = d.acesso.verInvestimento
  const blocos: BlocoPdf[] = []
  const diags = [...d.diagnosticos].sort((a, b) => ORDEM_SEVERIDADE.indexOf(a.severidade) - ORDEM_SEVERIDADE.indexOf(b.severidade))

  // 1. Resumo executivo
  blocos.push({ tipo: 'secao', titulo: 'Resumo executivo', nota: `${nomeMes(d.periodo.mes)}${d.periodo.mesInteiro ? '' : ` até ${ddmmPdf(hoje)}`}. Dados cruzados da Jornada de compra, Tráfego, Instagram, Vendas${opcoes.gestao && d.financeiro ? ', Financeiro' : ''} e Equipe.` })
  blocos.push({ tipo: 'kpis', itens: [
    { rotulo: 'Faturamento', valor: brl(r.faturamento.realizado), detalhe: `${pct(r.faturamento.atingimento)} da meta de ${brl(r.faturamento.meta)}` },
    { rotulo: 'Vendas', valor: `${num(r.vendas.realizado)} de ${num(r.vendas.meta)}`, detalhe: `ticket real ${brl(r.vendas.ticketReal)}` },
    { rotulo: 'Projeção do mês', valor: brl(r.faturamento.projecaoBase), detalhe: `${num(r.vendas.previstasBase, 1)} vendas no cenário base` },
    { rotulo: 'Falta para a meta', valor: brl(r.faturamento.falta), detalhe: `${brl(m.ritmoFaturamento.porDia)} por dia útil` },
    { rotulo: 'Leads no mês', valor: num(r.leadsMes), detalhe: `conversão total ${pct(r.conversaoTotalRef)}` },
    ...(verInv ? [
      { rotulo: 'Custo por lead', valor: brl(r.cplMes) },
      { rotulo: 'Marketing por venda', valor: brl(r.custoMarketingPorVenda), detalhe: `teto ${brl(d.premissas.tetoCustoMarketingVenda)}` },
      ...(r.investimento ? [{ rotulo: 'Investimento', valor: brl(r.investimento.realizado), detalhe: `de ${brl(r.investimento.orcamento)} · ${r.investimento.fonte ?? ''}` }] : []),
    ] : []),
  ] })
  blocos.push({ tipo: 'destaques', titulo: 'Leitura do mês', itens: leituras(d) })
  const prioridades = diags.filter(x => x.severidade === 'CRITICO' || x.severidade === 'ALTO').slice(0, 5)
  if (prioridades.length) blocos.push({ tipo: 'destaques', titulo: 'Prioridades de ação', itens: prioridades.map(x => ({ tom: TOM_SEVERIDADE[x.severidade], titulo: `${DEPARTAMENTO[x.departamento]} · ${x.problema}`, texto: `${x.acao} (prazo ${x.prazoDias} dias). ${x.impacto.texto}` })) })

  // 2. O dia
  const doDia = d.serieMes.find(s => s.dia === hoje)
  blocos.push({ tipo: 'secao', titulo: `O dia ${ddmmPdf(hoje)}`, nota: 'Movimento de hoje, o ritmo necessário por dia útil e o fechamento enviado por cada aba.' })
  blocos.push({ tipo: 'kpis', itens: [
    { rotulo: 'Leads hoje', valor: num(doDia?.leads ?? 0) },
    { rotulo: 'Vendas hoje', valor: num(doDia?.vendas ?? 0) },
    ...(verInv && doDia?.gasto != null ? [{ rotulo: 'Investimento hoje', valor: brl(doDia.gasto) }] : []),
    { rotulo: 'Vendas por dia útil', valor: num(m.ritmoVendas.porDia, 1), detalhe: `para bater a meta · faltam ${num(m.ritmoVendas.falta)}` },
    { rotulo: 'Faturamento por dia útil', valor: brl(m.ritmoFaturamento.porDia), detalhe: `faltam ${brl(m.ritmoFaturamento.falta)}` },
    { rotulo: 'Dias úteis', valor: `${m.calendario.decorridos} de ${m.calendario.total}`, detalhe: `${m.calendario.restantes} restantes` },
  ] })
  blocos.push({
    tipo: 'tabela',
    colunas: [{ titulo: 'Fonte', largura: 2 }, { titulo: 'Situação', largura: 1.1 }, { titulo: 'Última atualização', largura: 1.4 }, { titulo: 'Fechamento de hoje', largura: 2.6 }, { titulo: 'Detalhe', largura: 2.4 }],
    linhas: d.fontes.map(x => [{ texto: x.nome, negrito: true }, { texto: STATUS_FONTE[x.status]?.texto ?? x.status, tom: STATUS_FONTE[x.status]?.tom }, x.ultimaAtualizacao ? dataHoraBR(x.ultimaAtualizacao) : '—', x.fechamento?.dia === hoje ? `Enviado ${dataHoraBR(x.fechamento.confirmadoEm)} por ${x.fechamento.geradoPorNome} (v${x.fechamento.versao})` : { texto: 'Não enviado', tom: 'atencao' }, x.detalhe]),
  })

  // 3. Metas, ritmo e projeção
  const p = m.projecao
  blocos.push({ tipo: 'secao', titulo: 'Metas, ritmo e projeção' })
  blocos.push({ tipo: 'pares', itens: [
    { rotulo: 'Meta de faturamento', valor: brl(d.premissas.metaFaturamentoMensal) },
    { rotulo: 'Meta de vendas', valor: `${num(r.vendas.meta)} (ticket médio ${brl(d.premissas.ticketMedio)})` },
    { rotulo: 'Dias úteis', valor: `${m.calendario.decorridos} passados, ${m.calendario.restantes} restantes de ${m.calendario.total}` },
    { rotulo: 'Ritmo necessário', valor: `${num(m.ritmoVendas.porDia, 1)} vendas e ${brl(m.ritmoFaturamento.porDia)} por dia útil` },
    { rotulo: 'Leads necessários (conversão atual)', valor: `${num(m.leadsNecessarios.comConversaoAtual)} · faltam ${num(m.leadsNecessarios.faltamComConversaoAtual)}` },
    { rotulo: 'Leads necessários (metas de conversão)', valor: num(m.leadsNecessarios.comMetas) },
    ...(verInv && m.cplMaximo ? [{ rotulo: 'CPL máximo para fechar a conta', valor: `${brl(m.cplMaximo.comConversaoAtual)} com a conversão atual · ${brl(m.cplMaximo.comMetas)} com as metas` }] : []),
    ...(verInv ? [{ rotulo: 'Custo máximo de marketing por venda', valor: brl(m.custoMaximoPorVenda) }] : []),
    { rotulo: 'Propostas abertas', valor: `${num(m.pipeline.propostasAbertas)} → ${num(m.pipeline.vendasEsperadas, 1)} vendas esperadas` },
    { rotulo: 'Como o pipeline é calculado', valor: m.pipeline.formula },
  ] })
  blocos.push({ tipo: 'subsecao', titulo: 'Projeção de vendas do mês', nota: p.suficiente ? p.formula : p.motivo ?? undefined })
  blocos.push({ tipo: 'kpis', itens: [
    { rotulo: 'Conservadora', valor: num(p.conservador, 1), detalhe: 'vendas no mês' },
    { rotulo: 'Base', valor: num(p.base, 1), detalhe: 'vendas no mês' },
    { rotulo: 'Otimista', valor: num(p.otimista, 1), detalhe: 'vendas no mês' },
    { rotulo: 'Ritmo do mês / recente', valor: `${num(p.ritmoMes, 2)} / ${num(p.ritmoRecente, 2)}`, detalhe: 'vendas por dia útil' },
  ] })

  // 4. Cenários
  if (d.cenarios.length) {
    blocos.push({ tipo: 'secao', titulo: 'Cenários', nota: 'O que cada combinação de conversões pede de leads e de investimento para bater a meta, e o que entrega.' })
    const col = (titulo: string) => ({ titulo, largura: 1.2, alinhar: 'direita' as const })
    const linhaCen = (nome: string, valores: string[]): CelulaPdf[] => [{ texto: nome, negrito: true }, ...valores]
    blocos.push({
      tipo: 'tabela',
      colunas: [{ titulo: 'Indicador', largura: 2.2 }, ...d.cenarios.map(c => col(c.nome))],
      linhas: [
        ...PASSAGENS.map((ps, i) => linhaCen(ps, d.cenarios.map(c => pct(c.conversoes[i])))),
        linhaCen('Conversão total', d.cenarios.map(c => pct(c.conversaoTotal, 2))),
        linhaCen('Leads necessários', d.cenarios.map(c => num(c.leadsNecessarios))),
        linhaCen('Vendas esperadas', d.cenarios.map(c => num(c.vendasEsperadas, 1))),
        ...(verInv ? [
          linhaCen('Investimento', d.cenarios.map(c => brl(c.investimento))),
          linhaCen('CPL máximo', d.cenarios.map(c => brl(c.cplMaximo))),
          linhaCen('Custo por venda', d.cenarios.map(c => brl(c.custoPorVenda))),
        ] : []),
        linhaCen('Faturamento projetado', d.cenarios.map(c => brl(c.faturamentoProjetado))),
      ],
    })
  }

  // 5. Série do mês
  if (d.serieMes.length) {
    blocos.push({ tipo: 'secao', titulo: 'O mês dia a dia' })
    blocos.push({ tipo: 'grafico', titulo: 'Leads por dia', itens: d.serieMes.map(s => ({ rotulo: ddmmPdf(s.dia), valor: s.leads })), formatar: v => num(v), media: true })
    blocos.push({ tipo: 'grafico', titulo: 'Vendas por dia', itens: d.serieMes.map(s => ({ rotulo: ddmmPdf(s.dia), valor: s.vendas })), formatar: v => num(v, 1) })
    if (verInv && d.serieMes.some(s => (s.gasto ?? 0) > 0)) blocos.push({ tipo: 'grafico', titulo: 'Investimento em anúncios por dia', itens: d.serieMes.map(s => ({ rotulo: ddmmPdf(s.dia), valor: s.gasto ?? 0 })), formatar: v => brl(v, 0), media: true })
  }

  // 6. Funil
  blocos.push({ tipo: 'secao', titulo: 'Funil da Jornada de compra', nota: 'Três leituras: a oficial (a do Dashboard), por data de avanço (o que andou no mês) e a coorte (o que aconteceu com os leads que entraram no mês).' })
  const leituras3: Array<[keyof typeof NOME_LEITURA, Record<IntelEtapa, number>]> = [['oficial', f.oficial.contagens], ['porAvanco', f.porAvanco.contagens], ['coorte', f.coorte.contagens]]
  blocos.push({
    tipo: 'tabela',
    colunas: [{ titulo: 'Etapa', largura: 2 }, ...leituras3.map(([k]) => ({ titulo: NOME_LEITURA[k], largura: 1.4, alinhar: 'direita' as const })), ...(verInv && f.custoAcumulado ? [{ titulo: 'Custo acumulado', largura: 1.3, alinhar: 'direita' as const }] : [])],
    linhas: ETAPAS.map(e => [etapaCel(e), ...leituras3.map(([, c]) => num(c[e] ?? 0)), ...(verInv && f.custoAcumulado ? [brl(f.custoAcumulado[e])] : [])]),
  })
  blocos.push({ tipo: 'subsecao', titulo: 'Conversão entre etapas', nota: `Referência: coorte de ${ddmmPdf(f.referencia.periodo.inicio)} a ${ddmmPdf(f.referencia.periodo.fim)} (base das metas e projeções).` })
  blocos.push({
    tipo: 'tabela',
    colunas: [{ titulo: 'Passagem', largura: 2.2 }, { titulo: 'Oficial', largura: 1, alinhar: 'direita' }, { titulo: 'Coorte', largura: 1, alinhar: 'direita' }, { titulo: 'Referência', largura: 1, alinhar: 'direita' }, { titulo: 'Meta', largura: 0.9, alinhar: 'direita' }, { titulo: 'Desvio (ref.)', largura: 1.1, alinhar: 'direita' }, { titulo: 'Tempo médio', largura: 1, alinhar: 'direita' }, { titulo: 'Perdidos', largura: 1.1, alinhar: 'direita' }, { titulo: '+ vendas na meta', largura: 1, alinhar: 'direita' }],
    linhas: PASSAGENS.map((ps, i) => {
      const ref = f.referencia.conversoes[i], meta = f.metasConversao[i]
      const abaixo = ref != null && ref < meta
      return [
        { texto: `${ps}${f.gargalo?.indice === i ? ' (gargalo)' : ''}`, negrito: true, tom: f.gargalo?.indice === i ? 'ruim' : undefined },
        pct(f.oficial.conversoes[i]), pct(f.coorte.conversoes[i]), pct(ref), pct(meta, 0),
        { texto: pp(ref, meta), tom: ref == null ? undefined : abaixo ? 'ruim' : 'bom' },
        f.referencia.tempoMedioDias[i] != null ? `${num(f.referencia.tempoMedioDias[i], 1)} dias` : '—',
        f.referencia.perdas[i] ? `${num(f.referencia.perdas[i].absoluta)} (${pct(f.referencia.perdas[i].taxa, 0)})` : '—',
        f.referencia.impactoVendas[i] != null && f.referencia.impactoVendas[i]! > 0 ? `+${num(f.referencia.impactoVendas[i], 1)}` : '—',
      ]
    }),
  })
  if (f.oficial.metasOficiais.length) blocos.push({ tipo: 'texto', texto: `Metas do funil cadastradas no Dashboard: ${f.oficial.metasOficiais.map(x => `${NOME_ETAPA[x.etapa as IntelEtapa] ?? x.etapa} ${x.tipoMeta === 'MAXIMO_CUSTO' ? `até ${brl(x.metaCusto)} por lead` : `${x.tipoMeta === 'MAXIMO_PERDA' ? 'perda máx. ' : ''}${pct(x.metaPct, 0)}`}`).join(' · ')}.`, nota: true })

  // 7. Aquisição
  const t = d.trafego, s = d.social
  if (t?.conectado || s?.conectado) {
    blocos.push({ tipo: 'secao', titulo: 'Aquisição: tráfego pago e Instagram' })
    if (t?.conectado && t.plataforma) {
      const pl = t.plataforma
      blocos.push({ tipo: 'subsecao', titulo: `Tráfego pago${t.conta ? ` · ${t.conta}` : ''}` })
      blocos.push({ tipo: 'kpis', itens: [
        ...(verInv ? [{ rotulo: 'Investido no mês', valor: brl(pl.gasto), detalhe: `${pct(t.ritmo.pct, 0)} do orçamento proporcional · projeção ${brl(t.ritmo.projecaoMes)}` }] : []),
        { rotulo: 'Impressões', valor: num(pl.impressoes), detalhe: `CPM ${verInv ? brl(pl.cpm) : '—'}` },
        { rotulo: 'Cliques no link', valor: num(pl.cliquesLink), detalhe: `CTR ${pct(pl.ctr, 2)}${verInv ? ` · CPC ${brl(pl.cpc)}` : ''}` },
        { rotulo: 'Conversas + leads Meta', valor: num(pl.conversas + pl.leads), detalhe: verInv ? `custo ${brl(pl.custoResultado)}` : undefined },
        { rotulo: 'Leads do tráfego no CRM', valor: num(t.crm.leadsTrafego), detalhe: verInv ? `CPL ${brl(t.crm.cplCrm)}` : undefined },
        { rotulo: 'Todos os leads do mês', valor: num(t.crm.leadsTodos), detalhe: verInv ? `custo por lead ${brl(t.crm.custoPorLeadTodos)}` : undefined },
        { rotulo: 'Vendas atribuídas', valor: num(t.atribuicao.vendas), detalhe: verInv ? `custo por venda ${brl(t.atribuicao.custoPorVenda)}` : undefined },
        ...(verInv ? [{ rotulo: 'ROAS do tráfego', valor: t.atribuicao.roas != null ? `${num(t.atribuicao.roas, 1)}x` : '—', detalhe: `faturamento atribuído ${brl(t.atribuicao.faturamento)}` }] : []),
      ] })
      blocos.push({ tipo: 'texto', texto: `Regra de atribuição: ${t.atribuicao.regra}`, nota: true })
      blocos.push({
        tipo: 'tabela',
        colunas: [{ titulo: 'Qualidade do lead', largura: 2 }, { titulo: 'Leads', largura: 1, alinhar: 'direita' }, { titulo: 'Chegaram à negociação', largura: 1.5, alinhar: 'direita' }, { titulo: 'Taxa', largura: 1, alinhar: 'direita' }],
        linhas: [
          [{ texto: 'Tráfego pago', negrito: true }, num(t.qualidade.trafego.leads), num(t.qualidade.trafego.negociacao), pct(t.qualidade.trafego.taxaNegociacao)],
          [{ texto: 'Outros canais', negrito: true }, num(t.qualidade.outros.leads), num(t.qualidade.outros.negociacao), pct(t.qualidade.outros.taxaNegociacao)],
        ],
      })
      if (t.campanhas.length) blocos.push({
        tipo: 'tabela',
        colunas: [{ titulo: 'Campanha', largura: 2.8 }, ...(verInv ? [{ titulo: 'Investimento', largura: 1.2, alinhar: 'direita' as const }] : []), { titulo: 'Impressões', largura: 1.1, alinhar: 'direita' }, { titulo: 'Cliques', largura: 0.9, alinhar: 'direita' }, { titulo: 'CTR', largura: 0.8, alinhar: 'direita' }, { titulo: 'Conversas', largura: 0.9, alinhar: 'direita' }, { titulo: 'Leads', largura: 0.8, alinhar: 'direita' }, ...(verInv ? [{ titulo: 'Custo por resultado', largura: 1.1, alinhar: 'direita' as const }] : [])],
        linhas: [...t.campanhas].sort((x, y) => y.gasto - x.gasto).map(c => [{ texto: c.nome, negrito: true }, ...(verInv ? [brl(c.gasto)] : []), num(c.impressoes), num(c.cliquesLink), pct(c.ctr, 2), num(c.conversas), num(c.leads), ...(verInv ? [brl(c.custoResultado)] : [])]),
      })
    }
    if (s?.conectado) {
      blocos.push({ tipo: 'subsecao', titulo: `Instagram${s.conta ? ` · @${s.conta}` : ''}` })
      blocos.push({ tipo: 'pares', itens: [
        { rotulo: 'Produção', valor: `${num(s.producao?.publicacoesNoFeed)} publicações de ${num(s.producao?.metaPublicacoes)} da meta · ${num(s.producao?.planejadas)} planejadas · ${num(s.producao?.diasComPost)} dias com post · maior intervalo ${num(s.producao?.maiorIntervalo)} dias` },
        { rotulo: 'Distribuição', valor: `${num(s.distribuicao?.alcanceMedioDia)} de alcance médio por dia (antes ${num(s.distribuicao?.alcanceMedioDiaAnterior)}) · ${num(s.distribuicao?.visualizacoes)} visualizações · ${pct(s.distribuicao?.shareNaoSeguidores, 0)} de não seguidores` },
        { rotulo: 'Atenção', valor: `${num(s.atencao?.reels)} reels · tempo médio assistido ${num(s.atencao?.tempoMedioAssistidoSeg, 1)} s` },
        { rotulo: 'Interesse', valor: `${num(s.interesse?.interacoes)} interações (engajamento ${pct(s.interesse?.taxaEngajamento)}) · ${num(s.interesse?.visitasPerfil)} visitas ao perfil · ${num(s.interesse?.toquesLinks)} toques em links · ${num(s.interesse?.cliquesLinksRastreados)} cliques rastreados` },
        { rotulo: 'Conversão', valor: `${num(s.conversao?.novosSeguidores)} novos seguidores (saldo ${num(s.conversao?.crescimentoLiquido)}) · ${num(s.conversao?.leadsOrganicos)} leads orgânicos · ${num(s.conversao?.vendasAtribuidas)} vendas${verInv ? ` (${brl(s.conversao?.faturamentoAtribuido)})` : ''}` },
      ] })
    }
  }

  // 8. Equipe
  const eq = d.equipe
  if (eq?.linhas.length) {
    blocos.push({ tipo: 'secao', titulo: 'Equipe comercial', nota: 'Índice: nota de 0 a 100 do vendedor no mês (carteira em dia, velocidade, conversão e agenda).' })
    blocos.push({ tipo: 'kpis', itens: [
      { rotulo: 'Tempo até a 1ª abordagem', valor: eq.tempoAbordagemHoras != null ? `${num(eq.tempoAbordagemHoras, 1)} h` : '—', detalhe: 'mediana' },
      { rotulo: 'Leads sem abordagem', valor: num(eq.semAbordar) },
      { rotulo: 'Leads parados', valor: num(eq.parados) },
      { rotulo: 'Agenda cumprida', valor: pct100(eq.agendaPct, 0), detalhe: 'últimos 7 dias' },
      { rotulo: 'WhatsApp esperando', valor: num(eq.whatsapp.esperando), detalhe: `${num(eq.whatsapp.semResposta)} sem resposta` },
      { rotulo: 'Tempo para assumir', valor: eq.whatsapp.tempoAssumirMinutos != null ? `${num(eq.whatsapp.tempoAssumirMinutos)} min` : '—', detalhe: 'conversa do assistente' },
    ] })
    blocos.push({
      tipo: 'tabela',
      colunas: [{ titulo: 'Vendedor', largura: 1.8 }, { titulo: 'Índice', largura: 0.7, alinhar: 'direita' }, { titulo: 'Carteira', largura: 0.8, alinhar: 'direita' }, { titulo: 'Novos 7d', largura: 0.8, alinhar: 'direita' }, { titulo: 'Movim. 7d', largura: 0.8, alinhar: 'direita' }, { titulo: 'Fechados 7d', largura: 0.8, alinhar: 'direita' }, { titulo: 'Parados', largura: 0.8, alinhar: 'direita' }, { titulo: 'Sem abordar', largura: 0.8, alinhar: 'direita' }, { titulo: 'Lead > abordado', largura: 0.9, alinhar: 'direita' }, { titulo: 'Tempo abord.', largura: 0.9, alinhar: 'direita' }, { titulo: 'Agenda', largura: 0.8, alinhar: 'direita' }, { titulo: 'WhatsApp esperando', largura: 0.9, alinhar: 'direita' }],
      linhas: [...eq.linhas].sort((a, b) => b.indice - a.indice).map(l => [
        { texto: l.nome, negrito: true }, { texto: num(l.indice), tom: l.indice >= 70 ? 'bom' : l.indice < 40 ? 'ruim' : undefined, negrito: true }, num(l.carteira), num(l.novos7d), num(l.movimentos7d), num(l.fechados7d),
        { texto: num(l.parados), tom: l.parados > 0 ? 'atencao' : undefined }, { texto: num(l.semAbordar), tom: l.semAbordar > 0 ? 'ruim' : undefined },
        pct100(l.conversaoLeadAbordado, 0), l.tempoAbordagemHoras != null ? `${num(l.tempoAbordagemHoras, 1)} h` : '—', pct100(l.agendaPct, 0), num(l.esperandoWhatsapp),
      ]),
    })
  }

  // 9. Departamentos
  if (d.departamentos.length) {
    blocos.push({ tipo: 'secao', titulo: 'Departamentos', nota: 'Os indicadores que cada área controla, contra a meta.' })
    for (const dep of d.departamentos) {
      blocos.push({ tipo: 'subsecao', titulo: `${dep.nome}${dep.diagnosticos ? ` · ${dep.diagnosticos} ${dep.diagnosticos === 1 ? 'alerta' : 'alertas'}` : ''}`, nota: dep.controla })
      blocos.push({
        tipo: 'tabela',
        colunas: [{ titulo: 'Indicador', largura: 2.6 }, { titulo: 'Atual', largura: 1.3, alinhar: 'direita' }, { titulo: 'Meta', largura: 1.3, alinhar: 'direita' }, { titulo: 'Situação', largura: 1 }, { titulo: 'Observação', largura: 2.2 }],
        linhas: dep.linhas.map(l => [{ texto: l.nome, negrito: true }, l.valor, l.meta ?? '—', { texto: STATUS_LINHA[l.status]?.texto ?? l.status, tom: STATUS_LINHA[l.status]?.tom, negrito: true }, l.nota ?? '']),
      })
    }
  }

  // 10. Diagnóstico completo
  blocos.push({ tipo: 'secao', titulo: 'Diagnóstico completo', nota: 'Cada problema com a evidência, a meta, as hipóteses de causa, o impacto estimado e a ação recomendada.' })
  blocos.push({
    tipo: 'lista',
    itens: diags.map(x => ({
      tag: { texto: SEVERIDADE[x.severidade].rotulo, tom: TOM_SEVERIDADE[x.severidade] },
      titulo: `${DEPARTAMENTO[x.departamento]} · ${x.problema}`,
      texto: x.evidencia,
      detalhes: [
        ...(x.atual || x.meta ? [`Atual ${x.atual ?? '—'} · meta ${x.meta ?? '—'}${x.diferenca ? ` · diferença ${x.diferenca}` : ''}`] : []),
        ...x.hipoteses.map(h => `Hipótese: ${h}`),
        `Impacto: ${x.impacto.texto}`,
        `O que fazer: ${x.acao} (prazo ${x.prazoDias} dias)`,
        `Indicador: ${x.indicador.nome}, hoje ${valorIndicador(x.indicador.atual, x.indicador.unidade)}, meta ${valorIndicador(x.indicador.meta, x.indicador.unidade)} · confiança ${CONFIANCA[x.confianca] ?? x.confianca}${x.ocorrencias > 1 ? ` · aparece há ${x.ocorrencias} dias${x.desde ? ` (desde ${dataBR(x.desde)})` : ''}` : ''}${x.acoes.length ? ` · ${x.acoes.length} ${x.acoes.length === 1 ? 'ação' : 'ações'} no plano` : ''}`,
      ],
    })),
    vazio: 'Nenhum problema identificado no mês.',
  })

  // 11. Plano de ação
  const ac = d.acoesResumo
  blocos.push({ tipo: 'secao', titulo: 'Plano de ação' })
  blocos.push({ tipo: 'kpis', itens: [
    { rotulo: 'Ações abertas', valor: num(ac.abertas) },
    { rotulo: 'Atrasadas', valor: num(ac.atrasadas) },
    { rotulo: 'Concluídas', valor: num(ac.concluidas) },
    { rotulo: 'Concluídas no prazo', valor: num(ac.concluidasNoPrazo) },
  ] })
  const abertas = ac.proximas.filter(x => STATUS_ABERTOS.includes(x.status))
  const atrasada = (x: IntelAcao) => !!x.prazo && x.prazo.slice(0, 10) < hoje
  blocos.push({
    tipo: 'tabela',
    colunas: [{ titulo: 'Ação', largura: 2.8 }, { titulo: 'Área', largura: 1 }, { titulo: 'Responsável', largura: 1.3 }, { titulo: 'Prazo', largura: 0.9, alinhar: 'direita' }, { titulo: 'Prioridade', largura: 0.9 }, { titulo: 'Status', largura: 1.3 }, { titulo: 'Indicador: início > meta', largura: 1.8 }],
    linhas: abertas.map(x => [
      { texto: x.titulo, negrito: true }, DEPARTAMENTO[x.departamento], x.responsavelNome ?? '—',
      x.prazo ? { texto: dataBR(x.prazo), tom: atrasada(x) ? 'ruim' : undefined, negrito: atrasada(x) } : '—',
      { texto: SEVERIDADE[x.prioridade].rotulo, tom: TOM_SEVERIDADE[x.prioridade] }, STATUS_ACAO[x.status],
      x.indicadorNome ? `${x.indicadorNome}: ${num(x.valorInicial, 1)} > ${num(x.metaEsperada, 1)}` : '—',
    ]),
    vazio: 'Nenhuma ação aberta.',
  })
  const comDetalhe = abertas.filter(x => x.problema || x.objetivo)
  if (comDetalhe.length) blocos.push({ tipo: 'lista', itens: comDetalhe.map(x => ({ tag: { texto: STATUS_ACAO[x.status], tom: atrasada(x) ? 'ruim' : 'neutro' }, titulo: x.titulo, texto: [x.problema && `Problema: ${x.problema}`, x.objetivo && `Objetivo: ${x.objetivo}`].filter(Boolean).join(' · '), detalhes: [...(x.colaboradores?.length ? [`Com: ${x.colaboradores.join(', ')}`] : []), ...((x.comentarios ?? []).slice(-2).map(c => `${c.autor} (${dataBR(c.em)}): ${c.texto}`))] })) })

  // 12. Financeiro (versão da gestão)
  const fin = d.financeiro
  if (opcoes.gestao && fin && d.acesso.verFinanceiro) {
    blocos.push({ tipo: 'secao', titulo: 'Financeiro do mês', nota: 'Faturamento não é lucro: a margem considera comissões, marketing e as despesas lançadas.' })
    blocos.push({ tipo: 'kpis', itens: [
      { rotulo: 'Faturamento bruto', valor: brl(fin.faturamentoBruto) },
      { rotulo: 'Comissões', valor: brl(fin.comissoes) },
      { rotulo: 'Investimento em marketing', valor: brl(fin.investimentoMarketing) },
      { rotulo: 'Margem de contribuição', valor: brl(fin.margemContribuicao), detalhe: fin.margemConfigurada ? undefined : 'margem por venda não configurada' },
      { rotulo: 'ROAS geral', valor: fin.roasGeral != null ? `${num(fin.roasGeral, 1)}x` : '—', detalhe: 'faturamento ÷ marketing' },
      { rotulo: 'Despesas lançadas', valor: brl(fin.totalLancado) },
      ...(d.acesso.verProLabore && fin.proLabore != null ? [{ rotulo: 'Pró-labore', valor: brl(fin.proLabore) }] : []),
    ] })
    const desp = Object.entries(fin.despesasLancadas).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
    if (desp.length) blocos.push({
      tipo: 'tabela',
      colunas: [{ titulo: 'Despesa', largura: 3 }, { titulo: 'Valor', largura: 1.4, alinhar: 'direita' }, { titulo: '% do faturamento', largura: 1.4, alinhar: 'direita' }],
      linhas: desp.map(([k, v]) => [{ texto: k, negrito: true }, brl(v), pct(fin.faturamentoBruto ? v / fin.faturamentoBruto : null)]),
      total: ['Total', brl(fin.totalLancado), pct(fin.faturamentoBruto ? fin.totalLancado / fin.faturamentoBruto : null)],
    })
    if (fin.avisos.length) blocos.push({ tipo: 'destaques', itens: fin.avisos.map(x => ({ tom: 'atencao' as Tom, texto: x })) })
  }

  // 13. Estoque
  blocos.push({ tipo: 'secao', titulo: 'Estoque' })
  blocos.push({ tipo: 'kpis', colunas: 3, itens: [
    { rotulo: 'Disponíveis', valor: num(d.estoque.disponiveis) },
    { rotulo: 'Reservadas', valor: num(d.estoque.reservadas) },
    { rotulo: 'Dias médios em estoque', valor: num(d.estoque.diasMedio) },
  ] })
  if (d.estoque.maisAntigas.length) blocos.push({
    tipo: 'tabela',
    colunas: [{ titulo: 'Mais antigas em estoque', largura: 3 }, { titulo: 'Dias', largura: 1, alinhar: 'direita' }],
    linhas: d.estoque.maisAntigas.map(x => [{ texto: x.modelo, negrito: true }, { texto: num(x.dias), tom: x.dias >= 60 ? 'ruim' : x.dias >= 30 ? 'atencao' : undefined }]),
  })

  // 14. Premissas
  const pr = d.premissas
  blocos.push({ tipo: 'secao', titulo: 'Premissas usadas nos cálculos', nota: `Atualizadas em ${dataBR(pr.atualizadoEm)}${pr.atualizadoPor ? ` por ${pr.atualizadoPor}` : ''}.` })
  blocos.push({ tipo: 'pares', itens: [
    { rotulo: 'Meta de faturamento mensal', valor: brl(pr.metaFaturamentoMensal) },
    { rotulo: 'Ticket médio', valor: brl(pr.ticketMedio) },
    { rotulo: 'Meta de vendas', valor: num(pr.metaVendas) },
    ...(verInv ? [{ rotulo: 'Orçamento de marketing', valor: brl(pr.orcamentoMarketing) }, { rotulo: 'Teto de marketing por venda', valor: brl(pr.tetoCustoMarketingVenda) }] : []),
    { rotulo: 'Vendedores', valor: `${num(pr.vendedores.cadastrados)} cadastrados${pr.vendedores.planejados != null ? ` · ${num(pr.vendedores.planejados)} planejados` : ''}` },
    { rotulo: 'Metas de conversão', valor: PASSAGENS.map((ps, i) => `${ps} ${pct(pr.metasConversao[i], 0)}`).join(' · ') },
    { rotulo: 'Dias úteis', valor: pr.diasUteisSemana.map(x => DIAS[x]).join(', ') },
    ...(opcoes.gestao && pr.margemContribuicaoVenda != null ? [{ rotulo: 'Margem de contribuição por venda', valor: brl(pr.margemContribuicaoVenda) }] : []),
    { rotulo: 'Critérios dos alertas', valor: `amostra mínima ${pr.criterios.amostraMinima} leads · desvio alto ${pr.criterios.desvioAltoPP} p.p. · moderado ${pr.criterios.desvioModeradoPP} p.p. · atingimento crítico abaixo de ${pr.criterios.atingimentoCriticoPct}%` },
  ] })

  // 15. Fontes e inconsistências
  if (d.inconsistencias.length) {
    blocos.push({ tipo: 'secao', titulo: 'Dados para conferir', nota: 'Números que não batem entre as fontes. Corrigir aqui deixa o relatório mais preciso.' })
    blocos.push({ tipo: 'lista', itens: d.inconsistencias.map(i => ({ tag: { texto: 'Conferir', tom: 'atencao' }, titulo: i.titulo, texto: i.detalhe, detalhes: [`Onde validar: ${i.validar}`] })) })
  }

  // 16. Glossário
  blocos.push({ tipo: 'secao', titulo: 'Como ler os números' })
  blocos.push({
    tipo: 'tabela',
    colunas: [{ titulo: 'Termo', largura: 1.6 }, { titulo: 'O que significa', largura: 5 }],
    linhas: [
      ['Leitura oficial', 'A mesma contagem do Dashboard: leads criados no mês e vendas do mês.'],
      ['Por data de avanço', 'Quem mudou de etapa dentro do mês, não importa quando entrou.'],
      ['Coorte', 'O que aconteceu com os leads que entraram no mês: é a base mais justa para conversões.'],
      ['Gargalo', 'A passagem do funil que, se fosse para a meta, mais traria vendas a mais.'],
      ['Projeção', 'Vendas no fim do mês pelo ritmo das vendas por dia útil (do mês e dos últimos 14 dias).'],
      ['Cenário', 'Combinação de conversões (atual, metas, personalizado) e o que ela pede de leads e investimento.'],
      ['CPL', 'Custo por lead: investimento em anúncios dividido pelos leads.'],
      ['ROAS', 'Faturamento dividido pelo investimento em anúncios.'],
    ],
  })

  return {
    titulo: opcoes.gestao ? 'Relatório Comercial (gestão)' : 'Relatório Comercial do Dia',
    subtitulo: `Dia ${diaBR(hoje)} · ${nomeMes(d.periodo.mes)}`,
    contexto: [`${d.vendedoresAtivos} vendedores ativos`, `Dados cruzados em ${dataHoraBR(d.geradoEm)}`, opcoes.gestao ? 'Versão completa da gestão' : 'Versão para a equipe (sem financeiro)'],
    blocos,
    arquivo: `assistente-comercial-${opcoes.gestao ? 'gestao-' : ''}${hoje}`,
  }
}
