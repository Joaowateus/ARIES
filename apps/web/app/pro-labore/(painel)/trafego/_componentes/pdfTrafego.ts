// PDF do dia da aba Tráfego: o resultado de hoje (contra ontem) e o
// período que está na tela, do investimento ao lead no CRM.
import type { AnaliseTrafego, LinhaTabelaTrafego } from '@/lib/proLaboreApi'
import { ddmmPdf, diaBR, hojeBR, variacaoPdf, type BlocoPdf, type KpiPdf, type RelatorioPdf, type Tom } from '@/lib/relatorioPdf'
import { compacto, moeda, num, pct } from './formato'

const NIVEL: Record<string, { texto: string; tom: Tom }> = {
  critico: { texto: 'Crítico', tom: 'ruim' }, atencao: { texto: 'Atenção', tom: 'atencao' },
  positivo: { texto: 'Positivo', tom: 'bom' }, info: { texto: 'Info', tom: 'neutro' },
}
const AUDITORIA: Record<string, string> = { ok: 'OK', atencao: 'Atenção', critico: 'Crítico', sem_dado: 'Sem dado' }
const RESULTADO: Record<string, string> = { conversas: 'conversas', leads: 'leads', lpv: 'visualizações', cliquesLink: 'cliques' }
const STATUS: Record<string, string> = { ACTIVE: 'Ativa', PAUSED: 'Pausada', ARCHIVED: 'Arquivada', DELETED: 'Excluída', CAMPAIGN_PAUSED: 'Campanha pausada', ADSET_PAUSED: 'Conjunto pausado', WITH_ISSUES: 'Com problema', IN_PROCESS: 'Em análise' }

// Gastar mais não é bom nem ruim por si: a variação do investimento fica cinza.
const neutro = (x: KpiPdf['variacao']): KpiPdf['variacao'] => (x ? { ...x, tom: 'neutro' } : null)
const contatos = (t: { conversas: number; leads: number }) => t.conversas + t.leads
const custoContato = (gasto: number, c: number) => (c > 0 ? gasto / c : null)

function kpisPrincipais(a: AnaliseTrafego, rotuloComparacao: string): KpiPdf[] {
  const { totais: t, totaisAnterior: ta, derivadas: d, derivadasAnterior: da, crm } = a
  const c = a.conta.moeda
  const v = (x: number | null, y: number | null, m: 'MAIOR' | 'MENOR' = 'MAIOR') => variacaoPdf(x, y, m, rotuloComparacao)
  const cont = contatos(t), contAnt = contatos(ta)
  const itens: KpiPdf[] = [
    { rotulo: 'Investimento', valor: moeda(t.gasto, c), variacao: neutro(variacaoPdf(t.gasto, ta.gasto, 'MAIOR', rotuloComparacao)) },
    { rotulo: 'Impressões', valor: compacto(t.impressoes), variacao: v(t.impressoes, ta.impressoes) },
    { rotulo: 'Alcance', valor: compacto(t.alcance), detalhe: a.alcanceExato ? 'pessoas únicas' : 'aproximado', variacao: v(t.alcance, ta.alcance) },
    { rotulo: 'Cliques no link', valor: num(t.cliquesLink), variacao: v(t.cliquesLink, ta.cliquesLink) },
    { rotulo: 'CTR (link)', valor: pct(d.ctr, 2), variacao: v(d.ctr, da.ctr) },
    { rotulo: 'CPC (link)', valor: moeda(d.cpc, c), variacao: v(d.cpc, da.cpc, 'MENOR') },
    { rotulo: 'CPM', valor: moeda(d.cpm, c), variacao: v(d.cpm, da.cpm, 'MENOR') },
    { rotulo: 'Contatos', valor: num(cont), detalhe: `${num(t.conversas)} conversas · ${num(t.leads)} leads Meta`, variacao: v(cont, contAnt) },
    { rotulo: 'Custo por contato', valor: moeda(custoContato(t.gasto, cont), c), variacao: v(custoContato(t.gasto, cont), custoContato(ta.gasto, contAnt), 'MENOR') },
  ]
  if (crm.leads != null) {
    itens.push({ rotulo: 'Leads no CRM', valor: num(crm.leads), detalhe: crm.somenteTrafego ? 'marcados como Tráfego' : 'todos os cadastrados', variacao: v(crm.leads, crm.leadsAnterior) })
    itens.push({ rotulo: 'Custo por lead (CRM)', valor: moeda(crm.leads > 0 ? t.gasto / crm.leads : null, c), variacao: v(crm.leads > 0 ? t.gasto / crm.leads : null, crm.leadsAnterior ? ta.gasto / crm.leadsAnterior : null, 'MENOR') })
  }
  if (d.frequencia != null) itens.push({ rotulo: 'Frequência', valor: d.frequencia.toLocaleString('pt-BR', { maximumFractionDigits: 2 }), detalhe: 'vezes que cada pessoa viu' })
  return itens
}

const resultadoDe = (l: LinhaTabelaTrafego) => l.metricas[l.resultado] ?? 0

export function relatorioTrafego(a: AnaliseTrafego, dia: AnaliseTrafego | null, filtroNome?: string | null): RelatorioPdf {
  const c = a.conta.moeda
  const hoje = hojeBR()
  const blocos: BlocoPdf[] = []

  blocos.push({ tipo: 'secao', titulo: `Resultado do dia ${ddmmPdf(hoje)}`, nota: 'Hoje até a última atualização com a Meta, comparado com ontem inteiro.' })
  if (dia && (dia.totais.gasto > 0 || dia.totais.impressoes > 0)) blocos.push({ tipo: 'kpis', itens: kpisPrincipais(dia, 'vs. ontem').slice(0, 8) })
  else blocos.push({ tipo: 'texto', texto: 'Ainda não há veiculação registrada hoje. Os números do dia entram na próxima atualização com o Gerenciador de Anúncios.', nota: true })

  blocos.push({ tipo: 'secao', titulo: `Período analisado: ${ddmmPdf(a.periodo.inicio)} a ${ddmmPdf(a.periodo.fim)} (${a.periodo.dias} ${a.periodo.dias === 1 ? 'dia' : 'dias'})`, nota: `Comparado com ${ddmmPdf(a.periodo.anteriorInicio)} a ${ddmmPdf(a.periodo.anteriorFim)}.` })
  blocos.push({ tipo: 'kpis', itens: kpisPrincipais(a, 'vs. anterior') })

  if (a.funil.length) {
    blocos.push({ tipo: 'secao', titulo: 'Jornada até o lead', nota: 'Quantas pessoas passaram por cada etapa, quanto converteram da anterior e quanto custou cada uma.' })
    blocos.push({
      tipo: 'tabela',
      colunas: [{ titulo: 'Etapa', largura: 3 }, { titulo: 'Volume', largura: 1.4, alinhar: 'direita' }, { titulo: 'Conversão da anterior', largura: 1.8, alinhar: 'direita' }, { titulo: 'Custo por etapa', largura: 1.6, alinhar: 'direita' }, { titulo: 'Situação', largura: 1.6 }],
      linhas: a.funil.map(e => [e.nome, num(e.valor), e.convAnterior != null ? pct(e.convAnterior) : '—', e.custo != null ? moeda(e.custo, c) : '—', e.status == null ? '—' : e.status ? 'Dentro da meta' : 'Fora da meta']),
    })
  }

  const r = a.ritmoMes
  blocos.push({ tipo: 'secao', titulo: 'Ritmo do mês', nota: `Dia ${r.diaAtual} de ${r.diasNoMes}.` })
  blocos.push({ tipo: 'kpis', itens: [
    { rotulo: 'Investido no mês', valor: moeda(r.gasto, c) },
    { rotulo: 'Projeção do mês', valor: moeda(r.projecao, c), detalhe: 'no ritmo dos últimos 7 dias' },
    { rotulo: 'Média por dia (7 dias)', valor: moeda(r.mediaDiaria7, c) },
    { rotulo: 'Orçamento diário ativo', valor: moeda(r.orcamentoDiarioAtivo, c) },
    { rotulo: 'Contatos no mês', valor: num(r.contatos) },
    { rotulo: 'Leads no CRM no mês', valor: num(r.leadsCrm), detalhe: r.projecaoLeadsCrm != null ? `projeção: ${num(r.projecaoLeadsCrm)}` : undefined },
    { rotulo: 'Custo por lead (CRM)', valor: moeda(r.custoLeadCrm, c) },
  ] })

  const campanhas = [...a.campanhas].sort((x, y) => y.metricas.gasto - x.metricas.gasto)
  blocos.push({ tipo: 'secao', titulo: 'Campanhas', nota: 'Ordenadas pelo investimento no período.' })
  blocos.push({
    tipo: 'tabela',
    colunas: [{ titulo: 'Campanha', largura: 3.4 }, { titulo: 'Status', largura: 1.2 }, { titulo: 'Investimento', largura: 1.4, alinhar: 'direita' }, { titulo: 'Resultados', largura: 1.5, alinhar: 'direita' }, { titulo: 'Custo por resultado', largura: 1.4, alinhar: 'direita' }, { titulo: 'CTR', largura: 0.9, alinhar: 'direita' }, { titulo: 'CPM', largura: 1.1, alinhar: 'direita' }],
    linhas: campanhas.slice(0, 20).map(l => [l.nome, l.status ? STATUS[l.status] ?? l.status : '—', moeda(l.metricas.gasto, c), `${num(resultadoDe(l))} ${RESULTADO[l.resultado]}`, moeda(l.custoResultado, c), pct(l.derivadas.ctr, 2), moeda(l.derivadas.cpm, c)]),
    vazio: 'Nenhuma campanha com veiculação no período.',
  })

  const anuncios = [...a.anuncios].sort((x, y) => y.metricas.gasto - x.metricas.gasto).slice(0, 10)
  if (anuncios.length) {
    blocos.push({ tipo: 'secao', titulo: 'Anúncios com mais investimento' })
    blocos.push({
      tipo: 'tabela',
      colunas: [{ titulo: 'Anúncio', largura: 3 }, { titulo: 'Campanha', largura: 2.4 }, { titulo: 'Investimento', largura: 1.4, alinhar: 'direita' }, { titulo: 'Resultados', largura: 1.5, alinhar: 'direita' }, { titulo: 'Custo por resultado', largura: 1.4, alinhar: 'direita' }, { titulo: 'CTR', largura: 0.9, alinhar: 'direita' }],
      linhas: anuncios.map(l => [l.nome, l.campanhaNome, moeda(l.metricas.gasto, c), `${num(resultadoDe(l))} ${RESULTADO[l.resultado]}`, moeda(l.custoResultado, c), pct(l.derivadas.ctr, 2)]),
    })
  }

  blocos.push({ tipo: 'secao', titulo: 'Onde melhorar', nota: 'Diagnóstico automático do período, do mais urgente ao informativo.' })
  const ordem = ['critico', 'atencao', 'positivo', 'info']
  blocos.push({ tipo: 'lista', itens: [...a.diagnostico].sort((x, y) => ordem.indexOf(x.nivel) - ordem.indexOf(y.nivel)).map(i => ({ tag: NIVEL[i.nivel], titulo: i.titulo, texto: i.texto })), vazio: 'Nada a apontar no período.' })

  if (a.auditoria.itens.length) {
    blocos.push({ tipo: 'secao', titulo: `Checklist da auditoria${a.auditoria.nota != null ? ` · nota ${a.auditoria.nota.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}` : ''}` })
    blocos.push({
      tipo: 'tabela',
      colunas: [{ titulo: 'Item', largura: 3 }, { titulo: 'Valor', largura: 1.5, alinhar: 'direita' }, { titulo: 'Referência', largura: 2.2 }, { titulo: 'Situação', largura: 1.1 }],
      linhas: a.auditoria.itens.map(i => [i.titulo, i.valor, i.referencia, AUDITORIA[i.status] ?? i.status]),
    })
  }

  const diario = [...a.diario].sort((x, y) => y.data.localeCompare(x.data)).slice(0, 31)
  blocos.push({ tipo: 'secao', titulo: 'Dia a dia' })
  blocos.push({
    tipo: 'tabela',
    colunas: [{ titulo: 'Dia', largura: 1 }, { titulo: 'Investimento', largura: 1.4, alinhar: 'direita' }, { titulo: 'Impressões', largura: 1.3, alinhar: 'direita' }, { titulo: 'Cliques no link', largura: 1.3, alinhar: 'direita' }, { titulo: 'Contatos', largura: 1.1, alinhar: 'direita' }, { titulo: 'Custo por contato', largura: 1.4, alinhar: 'direita' }, { titulo: 'Leads no CRM', largura: 1.2, alinhar: 'direita' }],
    linhas: diario.map(d => [ddmmPdf(d.data), moeda(d.gasto, c), num(d.impressoes), num(d.cliquesLink), num(contatos(d)), moeda(custoContato(d.gasto, contatos(d)), c), d.leadsCrm == null ? '—' : num(d.leadsCrm)]),
    vazio: 'Sem dias com veiculação no período.',
  })

  const atualizado = a.conta.ultimaSincronizacaoEm ? new Date(a.conta.ultimaSincronizacaoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'sem atualização'
  return {
    titulo: 'Relatório de Tráfego Pago',
    subtitulo: `Dia ${diaBR(hoje)} · período ${ddmmPdf(a.periodo.inicio)} a ${ddmmPdf(a.periodo.fim)}`,
    contexto: [`Conta: ${a.conta.nome}`, `Dados da Meta até ${atualizado}`, ...(filtroNome ? [`Filtro: ${filtroNome}`] : [])],
    blocos,
    arquivo: `trafego-${hoje}`,
  }
}
