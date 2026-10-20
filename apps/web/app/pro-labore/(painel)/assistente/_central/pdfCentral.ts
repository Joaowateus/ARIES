// PDF do dia do Assistente Comercial: o retrato da Central (mês até hoje)
// com o dia em destaque — metas, funil, aquisição, equipe, departamentos,
// diagnóstico e plano. Só entra o que a pessoa já pode ver na Central.
import type { IntelCentral, IntelSeveridade } from '@/lib/proLaboreApi'
import { ddmmPdf, diaBR, type BlocoPdf, type RelatorioPdf, type Tom } from '@/lib/relatorioPdf'
import { DEPARTAMENTO, ETAPAS, NOME_ETAPA, PASSAGENS, SEVERIDADE, STATUS_ACAO, STATUS_ABERTOS, brl, dataBR, dataHoraBR, nomeMes, num, pct, pct100, pp } from './fmt'

const TOM_SEVERIDADE: Record<IntelSeveridade, Tom> = { CRITICO: 'ruim', ALTO: 'ruim', MODERADO: 'atencao', MONITORAMENTO: 'neutro' }
const ORDEM_SEVERIDADE: IntelSeveridade[] = ['CRITICO', 'ALTO', 'MODERADO', 'MONITORAMENTO']
const STATUS_LINHA: Record<string, string> = { OK: 'OK', ATENCAO: 'Atenção', CRITICO: 'Crítico', SEM_DADOS: 'Sem dados', INFO: '-' }
const STATUS_FONTE: Record<string, string> = { OK: 'Em dia', ATRASADO: 'Atrasada', ERRO: 'Com erro', SEM_CONEXAO: 'Sem conexão', MANUAL: 'Manual', SEM_DADOS: 'Sem dados' }

export function relatorioCentral(d: IntelCentral): RelatorioPdf {
  const hoje = d.periodo.hoje
  const r = d.resumo, m = d.metas
  const blocos: BlocoPdf[] = []

  // O dia.
  const doDia = d.serieMes.find(s => s.dia === hoje)
  blocos.push({ tipo: 'secao', titulo: `O dia ${ddmmPdf(hoje)}`, nota: 'Movimento de hoje e o ritmo necessário por dia útil para bater a meta do mês.' })
  blocos.push({ tipo: 'kpis', itens: [
    { rotulo: 'Leads hoje', valor: num(doDia?.leads ?? 0) },
    { rotulo: 'Vendas hoje', valor: num(doDia?.vendas ?? 0) },
    ...(d.acesso.verInvestimento && doDia?.gasto != null ? [{ rotulo: 'Investimento hoje', valor: brl(doDia.gasto) }] : []),
    { rotulo: 'Vendas por dia útil', valor: num(m.ritmoVendas.porDia, 1), detalhe: `para bater a meta · faltam ${num(m.ritmoVendas.falta)}` },
    { rotulo: 'Faturamento por dia útil', valor: brl(m.ritmoFaturamento.porDia), detalhe: `faltam ${brl(m.ritmoFaturamento.falta)}` },
    { rotulo: 'Dias úteis', valor: `${m.calendario.decorridos} de ${m.calendario.total}`, detalhe: `${m.calendario.restantes} restantes` },
  ] })
  const fechamentosHoje = d.fontes.filter(f => f.fechamento?.dia === hoje)
  blocos.push({
    tipo: 'tabela',
    colunas: [{ titulo: 'Fonte', largura: 2 }, { titulo: 'Situação', largura: 1.3 }, { titulo: 'Última atualização', largura: 1.6 }, { titulo: 'Fechamento de hoje', largura: 2.4 }],
    linhas: d.fontes.map(f => [f.nome, STATUS_FONTE[f.status] ?? f.status, f.ultimaAtualizacao ? dataHoraBR(f.ultimaAtualizacao) : '—', f.fechamento?.dia === hoje ? `Enviado ${dataHoraBR(f.fechamento.confirmadoEm)} por ${f.fechamento.geradoPorNome} (v${f.fechamento.versao})` : 'Não enviado']),
  })
  if (!fechamentosHoje.length) blocos.push({ tipo: 'texto', texto: 'Nenhuma aba enviou o fechamento do dia ainda.', nota: true })

  // O mês até hoje.
  blocos.push({ tipo: 'secao', titulo: `Resultado de ${nomeMes(d.periodo.mes)}${d.periodo.mesInteiro ? '' : ' até hoje'}` })
  blocos.push({ tipo: 'kpis', itens: [
    { rotulo: 'Faturamento', valor: brl(r.faturamento.realizado), detalhe: `meta ${brl(r.faturamento.meta)} · ${pct(r.faturamento.atingimento)} atingido` },
    { rotulo: 'Falta para a meta', valor: brl(r.faturamento.falta), detalhe: `mesmo ponto do mês anterior: ${brl(r.faturamento.mesAnteriorMesmoPonto)}` },
    { rotulo: 'Vendas', valor: `${num(r.vendas.realizado)} de ${num(r.vendas.meta)}`, detalhe: `ticket real ${brl(r.vendas.ticketReal)}` },
    { rotulo: 'Projeção do mês', valor: brl(r.faturamento.projecaoBase), detalhe: `${num(r.vendas.previstasBase, 1)} vendas no cenário base` },
    { rotulo: 'Leads no mês', valor: num(r.leadsMes) },
    ...(d.acesso.verInvestimento ? [
      { rotulo: 'Custo por lead', valor: brl(r.cplMes) },
      { rotulo: 'Marketing por venda', valor: brl(r.custoMarketingPorVenda) },
      ...(r.investimento ? [{ rotulo: 'Investimento', valor: brl(r.investimento.realizado), detalhe: `orçamento ${brl(r.investimento.orcamento)} · disponível ${brl(r.investimento.disponivel)}` }] : []),
    ] : []),
  ] })

  // Metas e projeção.
  const p = m.projecao
  blocos.push({ tipo: 'secao', titulo: 'Metas e projeção', nota: p.suficiente ? p.formula : p.motivo ?? undefined })
  blocos.push({ tipo: 'kpis', colunas: 3, itens: [
    { rotulo: 'Projeção conservadora', valor: num(p.conservador, 1), detalhe: 'vendas no mês' },
    { rotulo: 'Projeção base', valor: num(p.base, 1), detalhe: 'vendas no mês' },
    { rotulo: 'Projeção otimista', valor: num(p.otimista, 1), detalhe: 'vendas no mês' },
    { rotulo: 'Leads necessários', valor: num(m.leadsNecessarios.comConversaoAtual), detalhe: `com a conversão atual · ${num(m.leadsNecessarios.geradosNoMes)} gerados` },
    { rotulo: 'Leads com as metas de conversão', valor: num(m.leadsNecessarios.comMetas) },
    { rotulo: 'Propostas abertas', valor: num(m.pipeline.propostasAbertas), detalhe: `${num(m.pipeline.vendasEsperadas, 1)} vendas esperadas` },
  ] })

  // Funil oficial.
  const f = d.funil
  blocos.push({ tipo: 'secao', titulo: 'Funil do mês (Jornada de compra)', nota: f.oficial.fonte === 'MANUAL' ? 'Contagens lançadas manualmente na Jornada.' : 'Contagens dos leads do CRM.' })
  blocos.push({ tipo: 'barras', itens: ETAPAS.map(e => ({ rotulo: NOME_ETAPA[e], valor: f.oficial.contagens[e] ?? 0, texto: num(f.oficial.contagens[e] ?? 0) })) })
  blocos.push({
    tipo: 'tabela',
    colunas: [{ titulo: 'Passagem', largura: 2.6 }, { titulo: 'Conversão', largura: 1.2, alinhar: 'direita' }, { titulo: 'Meta', largura: 1, alinhar: 'direita' }, { titulo: 'Desvio', largura: 1.2, alinhar: 'direita' }],
    linhas: PASSAGENS.map((ps, i) => [`${ps}${f.gargalo?.indice === i ? ' (gargalo)' : ''}`, pct(f.oficial.conversoes[i]), pct(f.metasConversao[i], 0), pp(f.oficial.conversoes[i], f.metasConversao[i])]),
  })
  if (f.gargalo) blocos.push({ tipo: 'texto', texto: `Gargalo: ${f.gargalo.passagem}. Se esta passagem estivesse na meta, seriam ${num(f.gargalo.vendasPerdidas)} vendas a mais${f.gargalo.faturamento != null ? ` (cerca de ${brl(f.gargalo.faturamento)})` : ''}.` })

  // Aquisição.
  const t = d.trafego, s = d.social
  if (t?.conectado || s?.conectado) blocos.push({ tipo: 'secao', titulo: 'Aquisição', nota: 'Tráfego pago e Instagram no mês.' })
  if (t?.conectado && t.plataforma) {
    blocos.push({ tipo: 'kpis', itens: [
      ...(d.acesso.verInvestimento ? [{ rotulo: 'Investido (Meta)', valor: brl(t.plataforma.gasto), detalhe: t.ritmo.projecaoMes != null ? `projeção ${brl(t.ritmo.projecaoMes)}` : undefined }] : []),
      { rotulo: 'Cliques no link', valor: num(t.plataforma.cliquesLink), detalhe: `CTR ${pct(t.plataforma.ctr, 2)}` },
      { rotulo: 'Conversas + leads Meta', valor: num(t.plataforma.conversas + t.plataforma.leads) },
      { rotulo: 'Leads do tráfego no CRM', valor: num(t.crm.leadsTrafego), detalhe: `${pct(t.qualidade.trafego.taxaNegociacao)} chegam à negociação` },
      ...(d.acesso.verInvestimento ? [
        { rotulo: 'Custo por lead (CRM)', valor: brl(t.crm.cplCrm) },
        { rotulo: 'Vendas atribuídas', valor: num(t.atribuicao.vendas), detalhe: `custo por venda ${brl(t.atribuicao.custoPorVenda)}` },
        { rotulo: 'ROAS', valor: t.atribuicao.roas != null ? `${num(t.atribuicao.roas, 1)}x` : '—', detalhe: `faturamento ${brl(t.atribuicao.faturamento)}` },
      ] : []),
    ] })
  }
  if (s?.conectado) {
    blocos.push({ tipo: 'kpis', itens: [
      { rotulo: 'Alcance médio por dia', valor: num(s.distribuicao?.alcanceMedioDia), detalhe: `antes: ${num(s.distribuicao?.alcanceMedioDiaAnterior)}` },
      { rotulo: 'Interações', valor: num(s.interesse?.interacoes), detalhe: `engajamento ${pct(s.interesse?.taxaEngajamento)}` },
      { rotulo: 'Publicações', valor: `${num(s.producao?.publicacoesNoFeed)} de ${num(s.producao?.metaPublicacoes)}`, detalhe: `${num(s.producao?.diasComPost)} dias com post` },
      { rotulo: 'Leads orgânicos', valor: num(s.conversao?.leadsOrganicos), detalhe: `${num(s.conversao?.vendasAtribuidas)} vendas atribuídas` },
    ] })
  }

  // Equipe.
  if (d.equipe?.linhas.length) {
    blocos.push({ tipo: 'secao', titulo: 'Equipe comercial', nota: `Tempo médio de abordagem ${num(d.equipe.tempoAbordagemHoras, 1)} h · ${num(d.equipe.parados)} leads parados · ${num(d.equipe.semAbordar)} sem abordar · ${num(d.equipe.whatsapp.esperando)} conversas esperando no WhatsApp.` })
    blocos.push({
      tipo: 'tabela',
      colunas: [{ titulo: 'Vendedor', largura: 2.2 }, { titulo: 'Carteira', largura: 1, alinhar: 'direita' }, { titulo: 'Novos 7 dias', largura: 1.1, alinhar: 'direita' }, { titulo: 'Parados', largura: 1, alinhar: 'direita' }, { titulo: 'Sem abordar', largura: 1.1, alinhar: 'direita' }, { titulo: 'Fechados 7 dias', largura: 1.2, alinhar: 'direita' }, { titulo: 'Lead > abordado', largura: 1.3, alinhar: 'direita' }, { titulo: 'Tempo de abordagem', largura: 1.3, alinhar: 'direita' }],
      linhas: [...d.equipe.linhas].sort((a, b) => b.indice - a.indice).map(l => [l.nome, num(l.carteira), num(l.novos7d), num(l.parados), num(l.semAbordar), num(l.fechados7d), pct100(l.conversaoLeadAbordado, 0), l.tempoAbordagemHoras != null ? `${num(l.tempoAbordagemHoras, 1)} h` : '—']),
    })
  }

  // Departamentos.
  if (d.departamentos.length) {
    blocos.push({ tipo: 'secao', titulo: 'Departamentos', nota: 'Indicadores que cada área controla, contra a meta.' })
    for (const dep of d.departamentos) {
      blocos.push({ tipo: 'subsecao', titulo: dep.nome, nota: dep.controla })
      blocos.push({
        tipo: 'tabela',
        colunas: [{ titulo: 'Indicador', largura: 3 }, { titulo: 'Atual', largura: 1.4, alinhar: 'direita' }, { titulo: 'Meta', largura: 1.4, alinhar: 'direita' }, { titulo: 'Situação', largura: 1.1 }],
        linhas: dep.linhas.map(l => [l.nome, l.valor, l.meta ?? '—', STATUS_LINHA[l.status] ?? l.status]),
      })
    }
  }

  // Diagnóstico.
  const diags = [...d.diagnosticos].sort((a, b) => ORDEM_SEVERIDADE.indexOf(a.severidade) - ORDEM_SEVERIDADE.indexOf(b.severidade))
  blocos.push({ tipo: 'secao', titulo: 'Diagnóstico e prioridades', nota: 'Do mais grave ao que é só para acompanhar.' })
  blocos.push({
    tipo: 'lista',
    itens: diags.map(x => ({
      tag: { texto: SEVERIDADE[x.severidade].rotulo, tom: TOM_SEVERIDADE[x.severidade] },
      titulo: `${DEPARTAMENTO[x.departamento]} · ${x.problema}`,
      texto: [x.evidencia, x.atual && x.meta ? `Atual ${x.atual} · meta ${x.meta}${x.diferenca ? ` (${x.diferenca})` : ''}.` : null, x.impacto.texto, `O que fazer: ${x.acao} (prazo ${x.prazoDias} dias).`].filter(Boolean).join(' '),
    })),
    vazio: 'Nenhum problema identificado no mês.',
  })

  // Plano de ação.
  const a = d.acoesResumo
  blocos.push({ tipo: 'secao', titulo: 'Plano de ação' })
  blocos.push({ tipo: 'kpis', itens: [
    { rotulo: 'Ações abertas', valor: num(a.abertas) },
    { rotulo: 'Atrasadas', valor: num(a.atrasadas) },
    { rotulo: 'Concluídas', valor: num(a.concluidas) },
    { rotulo: 'Concluídas no prazo', valor: num(a.concluidasNoPrazo) },
  ] })
  blocos.push({
    tipo: 'tabela',
    colunas: [{ titulo: 'Ação', largura: 3.4 }, { titulo: 'Área', largura: 1.1 }, { titulo: 'Responsável', largura: 1.5 }, { titulo: 'Prazo', largura: 1, alinhar: 'direita' }, { titulo: 'Status', largura: 1.5 }],
    linhas: a.proximas.filter(x => STATUS_ABERTOS.includes(x.status)).map(x => [x.titulo, DEPARTAMENTO[x.departamento], x.responsavelNome ?? '—', x.prazo ? dataBR(x.prazo) : '—', STATUS_ACAO[x.status]]),
    vazio: 'Nenhuma ação aberta.',
  })

  // Estoque. (O financeiro detalhado e o pró-labore ficam fora: o PDF é para a equipe.)
  blocos.push({ tipo: 'secao', titulo: 'Estoque' })
  blocos.push({ tipo: 'kpis', colunas: 3, itens: [
    { rotulo: 'Disponíveis', valor: num(d.estoque.disponiveis) },
    { rotulo: 'Reservadas', valor: num(d.estoque.reservadas) },
    { rotulo: 'Dias médios em estoque', valor: num(d.estoque.diasMedio) },
  ] })
  if (d.estoque.maisAntigas.length) blocos.push({ tipo: 'texto', texto: `Mais antigas: ${d.estoque.maisAntigas.map(x => `${x.modelo} (${x.dias} dias)`).join(', ')}.`, nota: true })
  if (d.inconsistencias.length) {
    blocos.push({ tipo: 'secao', titulo: 'Para conferir', nota: 'Dados que não batem entre as fontes.' })
    blocos.push({ tipo: 'lista', itens: d.inconsistencias.map(i => ({ tag: { texto: 'Conferir', tom: 'atencao' }, titulo: i.titulo, texto: `${i.detalhe} ${i.validar}` })) })
  }

  return {
    titulo: 'Relatório Comercial do Dia',
    subtitulo: `Dia ${diaBR(hoje)} · ${nomeMes(d.periodo.mes)}`,
    contexto: [`${d.vendedoresAtivos} vendedores ativos`, `Dados cruzados em ${dataHoraBR(d.geradoEm)}`],
    blocos,
    arquivo: `assistente-comercial-${hoje}`,
  }
}
