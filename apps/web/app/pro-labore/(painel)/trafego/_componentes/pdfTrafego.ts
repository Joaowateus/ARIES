// PDF gerencial da aba Tráfego: resumo executivo com as leituras e
// prioridades, o dia, todos os indicadores contra o período anterior, a
// jornada até o lead (com perdas e simulações), conversas, vídeos, ritmo do
// mês, dia a dia, dias da semana, campanhas, conjuntos, anúncios, públicos,
// diagnóstico, auditoria e glossário.
import type { AnaliseTrafego, LinhaTabelaTrafego, PublicosTrafego, TipoPublicoTrafego } from '@/lib/proLaboreApi'
import {
  compararValores, ddmmPdf, diaBR, diaSemanaPdf, hojeBR, tabelaComparativa, variacaoPdf,
  type BlocoPdf, type CelulaPdf, type DestaquePdf, type KpiPdf, type LinhaComparativa, type RelatorioPdf, type Tom,
} from '@/lib/relatorioPdf'
import { compacto, moeda, num, pct } from './formato'

const NIVEL: Record<string, { texto: string; tom: Tom }> = {
  critico: { texto: 'Crítico', tom: 'ruim' }, atencao: { texto: 'Atenção', tom: 'atencao' },
  positivo: { texto: 'Positivo', tom: 'bom' }, info: { texto: 'Info', tom: 'neutro' },
}
const AUDITORIA: Record<string, { texto: string; tom: Tom }> = { ok: { texto: 'OK', tom: 'bom' }, atencao: { texto: 'Atenção', tom: 'atencao' }, critico: { texto: 'Crítico', tom: 'ruim' }, sem_dado: { texto: 'Sem dado', tom: 'neutro' } }
const RESULTADO: Record<string, string> = { conversas: 'conversas', leads: 'leads', lpv: 'visualizações', cliquesLink: 'cliques' }
const STATUS: Record<string, string> = {
  ACTIVE: 'Ativo', PAUSED: 'Pausado', CAMPAIGN_PAUSED: 'Campanha pausada', ADSET_PAUSED: 'Conjunto pausado', ARCHIVED: 'Arquivado', DELETED: 'Excluído',
  IN_PROCESS: 'Processando', WITH_ISSUES: 'Com problemas', DISAPPROVED: 'Reprovado', PENDING_REVIEW: 'Em análise', PREAPPROVED: 'Pré-aprovado', PENDING_BILLING_INFO: 'Pagamento pendente',
}
const RANKING: Record<string, string> = { ABOVE_AVERAGE: 'Acima da média', AVERAGE: 'Na média', BELOW_AVERAGE_35: 'Abaixo (35% piores)', BELOW_AVERAGE_20: 'Abaixo (20% piores)', BELOW_AVERAGE_10: 'Abaixo (10% piores)' }
const OTIMIZACAO: Record<string, string> = {
  CONVERSATIONS: 'Conversas', LEAD_GENERATION: 'Leads (formulário)', QUALITY_LEAD: 'Leads de qualidade', OFFSITE_CONVERSIONS: 'Conversões no site',
  LINK_CLICKS: 'Cliques no link', LANDING_PAGE_VIEWS: 'Visualizações da página', REACH: 'Alcance', IMPRESSIONS: 'Impressões', THRUPLAY: 'ThruPlay',
  POST_ENGAGEMENT: 'Engajamento', PROFILE_VISIT: 'Visitas ao perfil', VISIT_INSTAGRAM_PROFILE: 'Visitas ao perfil',
}
const APRENDIZADO: Record<string, { texto: string; tom: Tom }> = { LEARNING: { texto: 'Em aprendizado', tom: 'atencao' }, SUCCESS: { texto: 'Fora do aprendizado', tom: 'bom' }, FAIL: { texto: 'Aprendizado limitado', tom: 'ruim' } }
const QUEBRAS: Array<[TipoPublicoTrafego, string]> = [['idadeGenero', 'Idade e gênero'], ['regiao', 'Região'], ['posicionamento', 'Posicionamento'], ['dispositivo', 'Dispositivo'], ['hora', 'Horário']]

const contatos = (t: { conversas: number; leads: number }) => t.conversas + t.leads
const custoContato = (gasto: number, c: number) => (c > 0 ? gasto / c : null)
const div = (a: number, b: number) => (b > 0 ? a / b : null)
const resultadoDe = (l: LinhaTabelaTrafego) => l.metricas[l.resultado] ?? 0
const tendencia = (t: number | null): CelulaPdf => (t == null ? '—' : { texto: `${t >= 0 ? '+' : ''}${pct(t, 0)}`, tom: t <= -0.3 ? 'ruim' : t >= 0.15 ? 'bom' : 'neutro' })
// Gastar mais não é bom nem ruim por si: a variação do investimento fica cinza.
const neutro = (x: KpiPdf['variacao']): KpiPdf['variacao'] => (x ? { ...x, tom: 'neutro' } : null)

function kpisPrincipais(a: AnaliseTrafego, rotulo: string): KpiPdf[] {
  const { totais: t, totaisAnterior: ta, derivadas: d, derivadasAnterior: da, crm } = a
  const c = a.conta.moeda
  const v = (x: number | null, y: number | null, m: 'MAIOR' | 'MENOR' = 'MAIOR') => variacaoPdf(x, y, m, rotulo)
  const cont = contatos(t), contAnt = contatos(ta)
  const itens: KpiPdf[] = [
    { rotulo: 'Investimento', valor: moeda(t.gasto, c), variacao: neutro(variacaoPdf(t.gasto, ta.gasto, 'MAIOR', rotulo)) },
    { rotulo: 'Contatos', valor: num(cont), detalhe: `${num(t.conversas)} conversas · ${num(t.leads)} leads Meta`, variacao: v(cont, contAnt) },
    { rotulo: 'Custo por contato', valor: moeda(custoContato(t.gasto, cont), c), variacao: v(custoContato(t.gasto, cont), custoContato(ta.gasto, contAnt), 'MENOR') },
  ]
  if (crm.leads != null) itens.push({ rotulo: 'Custo por lead (CRM)', valor: moeda(div(t.gasto, crm.leads), c), detalhe: `${num(crm.leads)} leads no CRM`, variacao: v(div(t.gasto, crm.leads), crm.leadsAnterior ? ta.gasto / crm.leadsAnterior : null, 'MENOR') })
  else itens.push({ rotulo: 'Cliques no link', valor: num(t.cliquesLink), variacao: v(t.cliquesLink, ta.cliquesLink) })
  itens.push(
    { rotulo: 'Impressões', valor: compacto(t.impressoes), detalhe: `alcance ${compacto(t.alcance)}${a.alcanceExato ? '' : ' (aprox.)'}`, variacao: v(t.impressoes, ta.impressoes) },
    { rotulo: 'CTR (link)', valor: pct(d.ctr, 2), detalhe: `${num(t.cliquesLink)} cliques no link`, variacao: v(d.ctr, da.ctr) },
    { rotulo: 'CPC (link)', valor: moeda(d.cpc, c), variacao: v(d.cpc, da.cpc, 'MENOR') },
    { rotulo: 'CPM', valor: moeda(d.cpm, c), detalhe: d.frequencia != null ? `frequência ${d.frequencia.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}` : undefined, variacao: v(d.cpm, da.cpm, 'MENOR') },
  )
  return itens
}

function comparativoCompleto(a: AnaliseTrafego): LinhaComparativa[] {
  const { totais: t, totaisAnterior: ta, derivadas: d, derivadasAnterior: da, crm } = a
  const c = a.conta.moeda
  const $ = (v: number | null | undefined) => moeda(v, c)
  const n = (v: number | null | undefined) => num(v)
  const p = (v: number | null | undefined) => pct(v, 2)
  const cr = a.funil.find(e => e.connectRate)
  const cliques = a.funil.find(e => e.chave === 'cliquesLink')
  const linhas: LinhaComparativa[] = [
    { indicador: 'Investimento', atual: t.gasto, anterior: ta.gasto, formatar: $, melhor: 'NEUTRO', explicacao: 'Total gasto na conta (igual ao Gerenciador).' },
    { indicador: 'Impressões', atual: t.impressoes, anterior: ta.impressoes, formatar: n, melhor: 'MAIOR', explicacao: 'Vezes que os anúncios apareceram.' },
    { indicador: 'Alcance', atual: t.alcance, anterior: ta.alcance, formatar: n, melhor: 'MAIOR', explicacao: 'Pessoas diferentes que viram.' },
    { indicador: 'Frequência', atual: d.frequencia, anterior: da.frequencia, formatar: v => (v == null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })), melhor: 'NEUTRO', explicacao: 'Vezes que cada pessoa viu. Acima de 3, cansa.' },
    { indicador: 'CPM', atual: d.cpm, anterior: da.cpm, formatar: $, melhor: 'MENOR', explicacao: 'Custo por mil impressões (preço do leilão).' },
    { indicador: 'Cliques no link', atual: t.cliquesLink, anterior: ta.cliquesLink, formatar: n, melhor: 'MAIOR' },
    { indicador: 'CTR (link)', atual: d.ctr, anterior: da.ctr, formatar: p, melhor: 'MAIOR', pontos: true, explicacao: 'De cada 100 que viram, quantos clicaram.' },
    { indicador: 'CTR (todos os cliques)', atual: d.ctrTodos, anterior: da.ctrTodos, formatar: p, melhor: 'MAIOR', pontos: true },
    { indicador: 'CPC (link)', atual: d.cpc, anterior: da.cpc, formatar: $, melhor: 'MENOR', explicacao: 'Custo de cada clique no link.' },
  ]
  if (cr) linhas.push({ indicador: 'Connect rate', atual: cr.convAnterior, anterior: cr && cliques?.valorAnterior ? cr.valorAnterior / cliques.valorAnterior : null, formatar: p, melhor: 'MAIOR', pontos: true, explicacao: 'Dos cliques, quantos chegaram de fato ao destino.' })
  if (t.lpv > 0 || ta.lpv > 0) linhas.push(
    { indicador: 'Visualizações da página', atual: t.lpv, anterior: ta.lpv, formatar: n, melhor: 'MAIOR' },
    { indicador: 'Custo por visualização', atual: d.custoLpv, anterior: da.custoLpv, formatar: $, melhor: 'MENOR' },
  )
  if (t.conversas > 0 || ta.conversas > 0) linhas.push(
    { indicador: 'Conversas iniciadas', atual: t.conversas, anterior: ta.conversas, formatar: n, melhor: 'MAIOR', explicacao: 'Conversas no WhatsApp/Direct vindas do anúncio.' },
    { indicador: 'Custo por conversa', atual: d.custoConversa, anterior: da.custoConversa, formatar: $, melhor: 'MENOR' },
  )
  if (t.conversasProf2 > 0 || ta.conversasProf2 > 0) linhas.push(
    { indicador: 'Conversas engajadas (2+ msgs)', atual: d.taxaConversaEngajada, anterior: da.taxaConversaEngajada, formatar: p, melhor: 'MAIOR', pontos: true, explicacao: 'A pessoa mandou mais que a mensagem pronta.' },
    { indicador: 'Custo por conversa engajada', atual: d.custoConversaEngajada, anterior: da.custoConversaEngajada, formatar: $, melhor: 'MENOR' },
  )
  if ((t.novosContatos ?? 0) > 0) linhas.push({ indicador: 'Novos contatos (Meta)', atual: t.novosContatos, anterior: ta.novosContatos, formatar: n, melhor: 'MAIOR', explicacao: 'Pessoas que falaram com a empresa pela 1ª vez.' })
  if (t.leads > 0 || ta.leads > 0) linhas.push(
    { indicador: 'Leads Meta (formulário/site)', atual: t.leads, anterior: ta.leads, formatar: n, melhor: 'MAIOR' },
    { indicador: 'CPL Meta', atual: d.cpl, anterior: da.cpl, formatar: $, melhor: 'MENOR' },
  )
  linhas.push(
    { indicador: 'Contatos (conversas + leads)', atual: contatos(t), anterior: contatos(ta), formatar: n, melhor: 'MAIOR' },
    { indicador: 'Custo por contato', atual: custoContato(t.gasto, contatos(t)), anterior: custoContato(ta.gasto, contatos(ta)), formatar: $, melhor: 'MENOR' },
  )
  if (crm.leads != null) linhas.push(
    { indicador: 'Leads no CRM', atual: crm.leads, anterior: crm.leadsAnterior, formatar: n, melhor: 'MAIOR', explicacao: crm.somenteTrafego ? 'Cadastrados no CRM como Tráfego.' : 'Todos os cadastrados no CRM.' },
    { indicador: 'Custo por lead (CRM)', atual: div(t.gasto, crm.leads), anterior: crm.leadsAnterior ? ta.gasto / crm.leadsAnterior : null, formatar: $, melhor: 'MENOR', explicacao: 'Investimento ÷ leads cadastrados. O custo real.' },
    { indicador: 'Contato que vira lead', atual: div(crm.leads, contatos(t)), anterior: crm.leadsAnterior != null ? div(crm.leadsAnterior, contatos(ta)) : null, formatar: p, melhor: 'MAIOR', pontos: true, explicacao: 'Quanto do que chega o time cadastra.' },
  )
  if (t.videoViews > 0) linhas.push(
    { indicador: 'Hook rate (3 s)', atual: d.hookRate, anterior: da.hookRate, formatar: p, melhor: 'MAIOR', pontos: true, explicacao: 'Quem assistiu 3 s ÷ impressões (o gancho).' },
    { indicador: 'Hold rate (ThruPlay)', atual: d.holdRate, anterior: da.holdRate, formatar: p, melhor: 'MAIOR', pontos: true, explicacao: 'Quem ficou até o fim ÷ quem assistiu 3 s.' },
  )
  linhas.push({ indicador: 'Taxa de engajamento', atual: d.taxaEngajamento, anterior: da.taxaEngajamento, formatar: p, melhor: 'MAIOR', pontos: true })
  return linhas
}

/** Leituras do resumo executivo, a partir dos números do período. */
function leituras(a: AnaliseTrafego): DestaquePdf[] {
  const c = a.conta.moeda
  const { totais: t, totaisAnterior: ta, derivadas: d, crm } = a
  const out: DestaquePdf[] = []
  const cont = contatos(t), contAnt = contatos(ta)
  const cc = custoContato(t.gasto, cont), ccAnt = custoContato(ta.gasto, contAnt)
  const vInv = compararValores({ atual: t.gasto, anterior: ta.gasto, melhor: 'NEUTRO' })
  const vCont = compararValores({ atual: cont, anterior: contAnt, melhor: 'MAIOR' })
  const vCc = compararValores({ atual: cc, anterior: ccAnt, melhor: 'MENOR' })
  out.push({
    tom: vCc.tom === 'neutro' ? (vCont.tom === 'neutro' ? 'neutro' : vCont.tom) : vCc.tom,
    titulo: 'Investimento e retorno',
    texto: `Foram ${moeda(t.gasto, c)} investidos no período${vInv.texto !== '—' ? ` (${vInv.texto} contra o anterior)` : ''}, que trouxeram ${num(cont)} contatos${vCont.texto !== '—' ? ` (${vCont.texto})` : ''} a ${moeda(cc, c)} cada${vCc.texto !== '—' ? `: o custo por contato ${vCc.tom === 'bom' ? 'caiu' : vCc.tom === 'ruim' ? 'subiu' : 'ficou estável'} ${vCc.texto.replace('+', '').replace('-', '')}` : ''}.`,
  })
  if (crm.leads != null) {
    const cpl = div(t.gasto, crm.leads)
    const taxa = div(crm.leads, cont)
    out.push({
      tom: taxa != null && taxa < 0.5 ? 'ruim' : 'neutro', titulo: 'Do contato ao lead no CRM',
      texto: crm.leads > 0
        ? `${num(crm.leads)} leads cadastrados no CRM, a ${moeda(cpl, c)} cada (custo real). ${taxa != null ? `${pct(taxa)} dos contatos viraram lead${taxa < 0.5 ? ': o time está deixando de cadastrar ou de responder parte de quem chega.' : '.'}` : ''}`
        : `Nenhum lead do tráfego cadastrado no CRM no período, com ${num(cont)} contatos chegando. Confira se o time está marcando o canal "Tráfego" ao cadastrar.`,
    })
  }
  const fora = a.funil.filter(e => e.status === false)
  if (fora.length) {
    const e = fora[0]
    out.push({ tom: 'ruim', titulo: `Gargalo: ${e.nome}`, texto: `${e.nome} está fora da meta${e.convAnterior != null ? ` (conversão de ${pct(e.convAnterior)} da etapa anterior` : ''}${e.meta?.tipo === 'CONV_MIN' ? `, meta de ${pct(e.meta.valor)})` : e.meta?.tipo === 'CUSTO_MAX' ? `, meta de até ${moeda(e.meta.valor, c)} por etapa)` : e.convAnterior != null ? ')' : ''}.${e.perda != null ? ` ${num(e.perda)} pessoas se perderam nesta passagem.` : ''}` })
  }
  const relevantes = a.campanhas.filter(x => x.custoResultado != null && x.metricas.gasto >= Math.max(1, t.gasto * 0.1))
  if (relevantes.length >= 2) {
    const ord = [...relevantes].sort((x, y) => (x.custoResultado ?? 0) - (y.custoResultado ?? 0))
    const melhor = ord[0], pior = ord[ord.length - 1]
    out.push({ tom: 'bom', titulo: 'Campanha mais eficiente', texto: `"${melhor.nome}": ${moeda(melhor.custoResultado, c)} por ${RESULTADO[melhor.resultado].replace(/s$/, '')}, com ${pct(melhor.metricas.gasto / t.gasto, 0)} da verba.` })
    if ((pior.custoResultado ?? 0) > (melhor.custoResultado ?? 0) * 1.3) out.push({ tom: 'atencao', titulo: 'Campanha mais cara', texto: `"${pior.nome}": ${moeda(pior.custoResultado, c)} por resultado, ${pct((pior.custoResultado ?? 0) / (melhor.custoResultado || 1) - 1, 0)} acima da mais eficiente, com ${pct(pior.metricas.gasto / t.gasto, 0)} da verba. Vale rever público e criativo ou passar verba para a melhor.` })
  }
  const r = a.ritmoMes
  if (r.mediaDiaria7 > 0) out.push({ tom: 'neutro', titulo: 'Ritmo do mês', texto: `Já foram ${moeda(r.gasto, c)} até o dia ${r.diaAtual}. No ritmo dos últimos 7 dias (${moeda(r.mediaDiaria7, c)}/dia), o mês fecha em ${moeda(r.projecao, c)}${r.projecaoLeadsCrm ? ` e cerca de ${num(r.projecaoLeadsCrm)} leads no CRM` : ''}.${r.orcamentoDiarioAtivo ? ` Orçamento diário ativo hoje: ${moeda(r.orcamentoDiarioAtivo, c)}.` : ''}` })
  const semana = a.semana.filter(s => s.ocorrencias > 0 && s.contatos > 0)
  if (semana.length >= 3) {
    const ord = [...semana].sort((x, y) => x.gasto / x.contatos - y.gasto / y.contatos)
    out.push({ tom: 'neutro', titulo: 'Dia da semana', texto: `${ord[0].nome} é o dia com o contato mais barato (${moeda(ord[0].gasto / ord[0].contatos, c)}); ${ord[ord.length - 1].nome}, o mais caro (${moeda(ord[ord.length - 1].gasto / ord[ord.length - 1].contatos, c)}).` })
  }
  const sim = [...a.simulacoes].sort((x, y) => (y.finalNovo - y.finalAtual) - (x.finalNovo - x.finalAtual))[0]
  if (sim && sim.finalNovo > sim.finalAtual) out.push({ tom: 'bom', titulo: 'Onde está o maior ganho', texto: `Se "${sim.rotulo}" for de ${pct(sim.de)} para ${pct(sim.para)}, ${sim.etapaFinal.toLowerCase()} vão de ${num(sim.finalAtual)} para ${num(sim.finalNovo)} com o mesmo investimento${sim.custoNovo != null ? `, e o custo cai de ${moeda(sim.custoAtual, c)} para ${moeda(sim.custoNovo, c)}` : ''}.` })
  if (d.frequencia != null && d.frequencia >= 3) out.push({ tom: 'atencao', titulo: 'Público saturando', texto: `Frequência de ${d.frequencia.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}: cada pessoa viu os anúncios mais de 3 vezes. Renove criativos ou amplie o público.` })
  if (a.cobertura && !a.cobertura.completo) out.push({ tom: 'neutro', titulo: 'Sobre os dados', texto: `Os totais batem com o Gerenciador (${moeda(a.cobertura.gastoConta, c)}). O detalhe por campanha ainda está sendo puxado (${moeda(a.cobertura.gastoDetalhado, c)} até agora), então as tabelas por campanha podem somar menos.` })
  return out
}

export function relatorioTrafego(a: AnaliseTrafego, dia: AnaliseTrafego | null, filtroNome?: string | null, publicos?: PublicosTrafego | null): RelatorioPdf {
  const c = a.conta.moeda
  const $ = (v: number | null | undefined) => moeda(v, c)
  const hoje = hojeBR()
  const t = a.totais
  const blocos: BlocoPdf[] = []
  const ordemNivel = ['critico', 'atencao', 'positivo', 'info']
  const diagnostico = [...a.diagnostico].sort((x, y) => ordemNivel.indexOf(x.nivel) - ordemNivel.indexOf(y.nivel))

  // 1. Resumo executivo
  blocos.push({ tipo: 'secao', titulo: 'Resumo executivo', nota: `Período de ${ddmmPdf(a.periodo.inicio)} a ${ddmmPdf(a.periodo.fim)} (${a.periodo.dias} dias), comparado com ${ddmmPdf(a.periodo.anteriorInicio)} a ${ddmmPdf(a.periodo.anteriorFim)}.${filtroNome ? ` Filtro: ${filtroNome}.` : ''}` })
  blocos.push({ tipo: 'kpis', itens: kpisPrincipais(a, 'vs. anterior') })
  blocos.push({ tipo: 'destaques', titulo: 'Leitura do período', itens: leituras(a) })
  const prioridades = diagnostico.filter(i => i.nivel === 'critico' || i.nivel === 'atencao').slice(0, 5)
  if (prioridades.length) blocos.push({ tipo: 'destaques', titulo: 'Prioridades de ação', itens: prioridades.map(i => ({ tom: NIVEL[i.nivel].tom, titulo: i.titulo, texto: i.texto })) })
  if (a.auditoria.nota != null) blocos.push({ tipo: 'texto', texto: `Nota da auditoria: ${a.auditoria.nota} de 100 (${a.auditoria.itens.filter(i => i.status === 'ok').length} de ${a.auditoria.itens.filter(i => i.status !== 'sem_dado').length} checagens dentro da referência).`, nota: true })

  // 2. O dia
  blocos.push({ tipo: 'secao', titulo: `O dia ${ddmmPdf(hoje)}`, nota: 'Hoje até a última atualização com a Meta, comparado com ontem inteiro.' })
  if (dia && (dia.totais.gasto > 0 || dia.totais.impressoes > 0)) {
    blocos.push({ tipo: 'kpis', itens: kpisPrincipais(dia, 'vs. ontem').slice(0, 4) })
    blocos.push(tabelaComparativa(comparativoCompleto(dia).filter(l => !/Frequência|Alcance|todos os cliques|engajamento$/.test(l.indicador)).map(l => ({ ...l, explicacao: undefined })), { atual: 'Hoje', anterior: 'Ontem' }))
  } else blocos.push({ tipo: 'texto', texto: 'Ainda não há veiculação registrada hoje. Os números do dia entram na próxima atualização com o Gerenciador de Anúncios.', nota: true })

  // 3. Indicadores
  blocos.push({ tipo: 'secao', titulo: 'Todos os indicadores', nota: 'Cada número do período contra o período anterior de mesmo tamanho. "Leitura" diz se a mudança foi boa ou ruim para o resultado.' })
  blocos.push(tabelaComparativa(comparativoCompleto(a)))

  // 4. Jornada
  if (a.funil.length) {
    blocos.push({ tipo: 'secao', titulo: 'Jornada até o lead', nota: 'Cada etapa com a conversão da anterior, a perda, o custo e a meta. O gargalo é a etapa que mais trava o resultado.' })
    blocos.push({ tipo: 'barras', itens: a.funil.filter(e => e.chave !== 'impressoes').map(e => ({ rotulo: e.nome, valor: e.valor, texto: `${num(e.valor)}${e.convAnterior != null ? ` · ${pct(e.convAnterior)}` : ''}` })) })
    blocos.push({
      tipo: 'tabela',
      colunas: [{ titulo: 'Etapa', largura: 2.4 }, { titulo: 'Volume', largura: 1.1, alinhar: 'direita' }, { titulo: 'Anterior', largura: 1.1, alinhar: 'direita' }, { titulo: 'Conversão da etapa anterior', largura: 1.4, alinhar: 'direita' }, { titulo: 'Perda', largura: 1.2, alinhar: 'direita' }, { titulo: 'Custo por etapa', largura: 1.2, alinhar: 'direita' }, { titulo: 'Meta', largura: 1.2, alinhar: 'direita' }, { titulo: 'Situação', largura: 1.1 }],
      linhas: a.funil.map(e => [
        { texto: e.nome, negrito: true }, num(e.valor), num(e.valorAnterior), e.convAnterior != null ? pct(e.convAnterior) : '—',
        e.perda != null ? `${num(e.perda)}${e.perdaPct != null ? ` (${pct(e.perdaPct, 0)})` : ''}` : '—', e.custo != null ? $(e.custo) : '—',
        e.meta ? (e.meta.tipo === 'CONV_MIN' ? `>= ${pct(e.meta.valor)}` : `<= ${$(e.meta.valor)}`) : '—',
        e.status == null ? '—' : { texto: e.status ? 'Na meta' : 'Fora da meta', tom: e.status ? 'bom' : 'ruim', negrito: true },
      ]),
    })
    const sims = a.simulacoes.filter(s => s.finalNovo > s.finalAtual)
    if (sims.length) {
      blocos.push({ tipo: 'subsecao', titulo: 'Simulações: se bater a meta', nota: 'Mesmo investimento, só a etapa melhorando até a meta.' })
      blocos.push({
        tipo: 'tabela',
        colunas: [{ titulo: 'Se melhorar', largura: 2.4 }, { titulo: 'De', largura: 1, alinhar: 'direita' }, { titulo: 'Para', largura: 1, alinhar: 'direita' }, { titulo: 'Resultado final', largura: 2, alinhar: 'direita' }, { titulo: 'Custo final', largura: 2, alinhar: 'direita' }],
        linhas: sims.map(s => [{ texto: s.rotulo, negrito: true }, pct(s.de), pct(s.para), { texto: `${num(s.finalAtual)} > ${num(s.finalNovo)} ${s.etapaFinal.toLowerCase()}`, tom: 'bom' }, s.custoNovo != null ? { texto: `${$(s.custoAtual)} > ${$(s.custoNovo)}`, tom: 'bom' } : '—']),
      })
    }
  }

  // 5. Conversas e vídeos
  if (t.conversas > 0) {
    blocos.push({ tipo: 'secao', titulo: 'Qualidade das conversas', nota: 'Quanto das conversas iniciadas vira conversa de verdade (a pessoa responde, troca mensagens).' })
    blocos.push({ tipo: 'kpis', itens: [
      { rotulo: 'Conversas iniciadas', valor: num(t.conversas), detalhe: `custo ${$(a.derivadas.custoConversa)}` },
      { rotulo: '2 ou mais mensagens', valor: pct(div(t.conversasProf2, t.conversas)), detalhe: `${num(t.conversasProf2)} conversas` },
      { rotulo: '3 ou mais mensagens', valor: pct(div(t.conversasProf3, t.conversas)), detalhe: `${num(t.conversasProf3)} conversas` },
      { rotulo: '5 ou mais mensagens', valor: pct(div(t.conversasProf5, t.conversas)), detalhe: `${num(t.conversasProf5)} conversas` },
      { rotulo: 'Bloqueios', valor: pct(div(t.bloqueios, t.conversas)), detalhe: `${num(t.bloqueios)} pessoas bloquearam` },
      { rotulo: 'Custo por conversa engajada', valor: $(a.derivadas.custoConversaEngajada) },
      ...((t.novosContatos ?? 0) > 0 ? [{ rotulo: 'Novos contatos (Meta)', valor: num(t.novosContatos), detalhe: `custo ${$(div(t.gasto, t.novosContatos ?? 0))}` }] : []),
    ] })
  }
  if (t.videoViews > 0) {
    blocos.push({ tipo: 'secao', titulo: 'Vídeos: atenção e retenção', nota: 'Quanto do público para no vídeo e até onde assiste.' })
    blocos.push({ tipo: 'kpis', itens: [
      { rotulo: 'Hook rate (3 s)', valor: pct(a.derivadas.hookRate), detalhe: 'referência: 25% ou mais' },
      { rotulo: 'Hold rate (ThruPlay)', valor: pct(a.derivadas.holdRate), detalhe: 'referência: 25% ou mais' },
      { rotulo: 'Tempo médio assistido', valor: a.derivadas.tempoMedioVideo != null ? `${a.derivadas.tempoMedioVideo.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s` : '—' },
      { rotulo: 'Visualizações de 3 s', valor: num(t.videoViews) },
    ] })
    const base = t.videoPlays || t.videoViews
    blocos.push({ tipo: 'barras', itens: [['Assistiram 25%', t.videoP25], ['Assistiram 50%', t.videoP50], ['Assistiram 75%', t.videoP75], ['Assistiram 95%', t.videoP95], ['Assistiram 100%', t.videoP100]].map(([r, v]) => ({ rotulo: String(r), valor: Number(v), texto: `${num(Number(v))} · ${pct(div(Number(v), base), 0)}` })) })
  }

  // 6. Ritmo do mês
  const r = a.ritmoMes
  blocos.push({ tipo: 'secao', titulo: 'Ritmo do mês e projeção', nota: `Dia ${r.diaAtual} de ${r.diasNoMes}. A projeção soma o que já foi gasto com a média dos últimos 7 dias nos dias que faltam.` })
  blocos.push({ tipo: 'kpis', itens: [
    { rotulo: 'Investido no mês', valor: $(r.gasto) },
    { rotulo: 'Projeção do mês', valor: $(r.projecao), detalhe: 'no ritmo dos últimos 7 dias' },
    { rotulo: 'Média por dia (7 dias)', valor: $(r.mediaDiaria7) },
    { rotulo: 'Orçamento diário ativo', valor: $(r.orcamentoDiarioAtivo), detalhe: 'soma das campanhas/conjuntos ativos' },
    { rotulo: 'Contatos no mês', valor: num(r.contatos), detalhe: `custo ${$(custoContato(r.gasto, r.contatos))}` },
    { rotulo: 'Leads no CRM no mês', valor: num(r.leadsCrm), detalhe: r.projecaoLeadsCrm != null ? `projeção: ${num(r.projecaoLeadsCrm)}` : undefined },
    { rotulo: 'Custo por lead (CRM)', valor: $(r.custoLeadCrm) },
  ] })

  // 7. Dia a dia
  const diario = [...a.diario].sort((x, y) => x.data.localeCompare(y.data))
  blocos.push({ tipo: 'secao', titulo: 'Dia a dia', nota: 'Evolução diária do investimento e dos contatos no período.' })
  blocos.push({ tipo: 'grafico', titulo: 'Investimento por dia', itens: diario.map(d => ({ rotulo: ddmmPdf(d.data), valor: d.gasto })), formatar: v => moeda(v, c, v >= 100 ? 0 : 2), media: true })
  blocos.push({ tipo: 'grafico', titulo: 'Contatos por dia (conversas + leads)', itens: diario.map(d => ({ rotulo: ddmmPdf(d.data), valor: contatos(d) })), formatar: v => num(v), media: true })
  const totalDiario = diario.reduce((s, d) => ({ gasto: s.gasto + d.gasto, impressoes: s.impressoes + d.impressoes, cliquesLink: s.cliquesLink + d.cliquesLink, conversas: s.conversas + d.conversas, leads: s.leads + d.leads, leadsCrm: s.leadsCrm + (d.leadsCrm ?? 0) }), { gasto: 0, impressoes: 0, cliquesLink: 0, conversas: 0, leads: 0, leadsCrm: 0 })
  blocos.push({
    tipo: 'tabela',
    colunas: [{ titulo: 'Dia', largura: 1.1 }, { titulo: 'Investimento', largura: 1.3, alinhar: 'direita' }, { titulo: 'Impressões', largura: 1.2, alinhar: 'direita' }, { titulo: 'Cliques', largura: 1, alinhar: 'direita' }, { titulo: 'CTR', largura: 0.9, alinhar: 'direita' }, { titulo: 'Contatos', largura: 1, alinhar: 'direita' }, { titulo: 'Custo por contato', largura: 1.3, alinhar: 'direita' }, { titulo: 'Leads CRM', largura: 1, alinhar: 'direita' }],
    linhas: [...diario].reverse().map(d => [diaSemanaPdf(d.data), $(d.gasto), num(d.impressoes), num(d.cliquesLink), pct(div(d.cliquesLink, d.impressoes), 2), num(contatos(d)), $(custoContato(d.gasto, contatos(d))), d.leadsCrm == null ? '—' : num(d.leadsCrm)]),
    total: ['Total', $(totalDiario.gasto), num(totalDiario.impressoes), num(totalDiario.cliquesLink), pct(div(totalDiario.cliquesLink, totalDiario.impressoes), 2), num(totalDiario.conversas + totalDiario.leads), $(custoContato(totalDiario.gasto, totalDiario.conversas + totalDiario.leads)), a.crm.leads == null ? '—' : num(totalDiario.leadsCrm)],
    vazio: 'Sem dias com veiculação no período.',
  })

  // 8. Dias da semana
  const semana = a.semana.filter(s => s.ocorrencias > 0)
  if (semana.length) {
    blocos.push({ tipo: 'secao', titulo: 'Dias da semana', nota: 'Média de cada dia da semana no período: onde o contato sai mais barato.' })
    const custos = semana.filter(s => s.contatos > 0).map(s => s.gasto / s.contatos)
    const menor = Math.min(...custos), maior = Math.max(...custos)
    blocos.push({
      tipo: 'tabela',
      colunas: [{ titulo: 'Dia', largura: 1.4 }, { titulo: 'Dias no período', largura: 1, alinhar: 'direita' }, { titulo: 'Investimento por dia', largura: 1.4, alinhar: 'direita' }, { titulo: 'Cliques por dia', largura: 1.2, alinhar: 'direita' }, { titulo: 'Contatos por dia', largura: 1.2, alinhar: 'direita' }, { titulo: 'Custo por contato', largura: 1.3, alinhar: 'direita' }, { titulo: 'Leads CRM', largura: 1, alinhar: 'direita' }],
      linhas: semana.map(s => {
        const custo = s.contatos > 0 ? s.gasto / s.contatos : null
        return [{ texto: s.nome, negrito: true }, num(s.ocorrencias), $(s.gasto / s.ocorrencias), num(s.cliquesLink / s.ocorrencias), num(s.contatos / s.ocorrencias), custo == null ? '—' : { texto: $(custo), tom: custo === menor ? 'bom' : custo === maior ? 'ruim' : undefined, negrito: custo === menor || custo === maior }, s.leadsCrm == null ? '—' : num(s.leadsCrm)]
      }),
    })
  }

  // 9. Campanhas
  const campanhas = [...a.campanhas].sort((x, y) => y.metricas.gasto - x.metricas.gasto)
  blocos.push({ tipo: 'secao', titulo: 'Campanhas', nota: 'Resultado e entrega de cada campanha no período, da que mais investiu para a que menos.' })
  blocos.push({ tipo: 'subsecao', titulo: 'Resultado' })
  blocos.push({
    tipo: 'tabela',
    colunas: [{ titulo: 'Campanha', largura: 3 }, { titulo: 'Status', largura: 1.1 }, { titulo: 'Investimento', largura: 1.3, alinhar: 'direita' }, { titulo: '% da verba', largura: 0.9, alinhar: 'direita' }, { titulo: 'Resultados', largura: 1.4, alinhar: 'direita' }, { titulo: 'Custo por resultado', largura: 1.3, alinhar: 'direita' }, { titulo: 'Dias ativos', largura: 0.8, alinhar: 'direita' }],
    linhas: campanhas.map(l => [{ texto: l.nome, negrito: true }, l.status ? STATUS[l.status] ?? l.status : '—', $(l.metricas.gasto), pct(div(l.metricas.gasto, t.gasto), 0), `${num(resultadoDe(l))} ${RESULTADO[l.resultado]}`, $(l.custoResultado), num(l.diasAtivos)]),
    vazio: 'Nenhuma campanha com veiculação no período.',
  })
  if (campanhas.length) {
    blocos.push({ tipo: 'subsecao', titulo: 'Entrega e custo de mídia', nota: 'Tendência do CTR: 2ª metade do período contra a 1ª (queda forte = criativo cansando).' })
    blocos.push({
      tipo: 'tabela',
      colunas: [{ titulo: 'Campanha', largura: 3 }, { titulo: 'Impressões', largura: 1.1, alinhar: 'direita' }, { titulo: 'Frequência', largura: 0.9, alinhar: 'direita' }, { titulo: 'CPM', largura: 1, alinhar: 'direita' }, { titulo: 'CTR', largura: 0.9, alinhar: 'direita' }, { titulo: 'CPC', largura: 1, alinhar: 'direita' }, { titulo: 'Tendência CTR', largura: 1, alinhar: 'direita' }, { titulo: 'Orçamento/dia', largura: 1.1, alinhar: 'direita' }],
      linhas: campanhas.map(l => [l.nome, num(l.metricas.impressoes), l.derivadas.frequencia != null ? l.derivadas.frequencia.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '—', $(l.derivadas.cpm), pct(l.derivadas.ctr, 2), $(l.derivadas.cpc), tendencia(l.tendenciaCtr), l.estrutura?.orcamentoDiario ? $(l.estrutura.orcamentoDiario) : '—']),
    })
  }

  // 10. Conjuntos
  if (a.conjuntos.length) {
    blocos.push({ tipo: 'secao', titulo: 'Conjuntos de anúncios', nota: 'Resultado, otimização, aprendizado da Meta e o público configurado em cada conjunto.' })
    const conjuntos = [...a.conjuntos].sort((x, y) => y.metricas.gasto - x.metricas.gasto)
    blocos.push({
      tipo: 'tabela',
      colunas: [{ titulo: 'Conjunto', largura: 2.4 }, { titulo: 'Campanha', largura: 1.8 }, { titulo: 'Investimento', largura: 1.2, alinhar: 'direita' }, { titulo: 'Resultados', largura: 1.3, alinhar: 'direita' }, { titulo: 'Custo por resultado', largura: 1.2, alinhar: 'direita' }, { titulo: 'CTR', largura: 0.8, alinhar: 'direita' }, { titulo: 'Otimização', largura: 1.2 }, { titulo: 'Aprendizado', largura: 1.2 }],
      linhas: conjuntos.map(l => {
        const ap = l.estrutura?.aprendizado ? APRENDIZADO[l.estrutura.aprendizado] : null
        return [{ texto: l.nome, negrito: true }, l.campanhaNome, $(l.metricas.gasto), `${num(resultadoDe(l))} ${RESULTADO[l.resultado]}`, $(l.custoResultado), pct(l.derivadas.ctr, 2), l.estrutura?.otimizacao ? OTIMIZACAO[l.estrutura.otimizacao] ?? l.estrutura.otimizacao : '—', ap ? { texto: ap.texto, tom: ap.tom } : '—']
      }),
    })
    const comPublico = conjuntos.filter(l => l.estrutura?.publico)
    if (comPublico.length) {
      blocos.push({ tipo: 'subsecao', titulo: 'Público configurado' })
      blocos.push({
        tipo: 'tabela',
        colunas: [{ titulo: 'Conjunto', largura: 2.2 }, { titulo: 'Idade', largura: 0.9 }, { titulo: 'Gênero', largura: 1 }, { titulo: 'Locais', largura: 2.2 }, { titulo: 'Interesses e públicos', largura: 3 }],
        linhas: comPublico.map(l => {
          const pb = l.estrutura!.publico!
          return [{ texto: l.nome, negrito: true }, pb.idade, pb.generos, pb.locais.slice(0, 4).join(', ') || '—', [...pb.interesses.slice(0, 5), ...pb.publicosPersonalizados.map(x => `Público: ${x}`), ...(pb.advantage ? ['Advantage+ ligado'] : [])].join(', ') || 'Aberto']
        }),
      })
    }
  }

  // 11. Anúncios
  if (a.anuncios.length) {
    blocos.push({ tipo: 'secao', titulo: 'Anúncios e criativos', nota: 'Cada anúncio com resultado, atenção (hook), ranking de qualidade da Meta e a tendência do CTR.' })
    const anuncios = [...a.anuncios].sort((x, y) => y.metricas.gasto - x.metricas.gasto).slice(0, 40)
    blocos.push({
      tipo: 'tabela',
      colunas: [{ titulo: 'Anúncio', largura: 2.3 }, { titulo: 'Campanha', largura: 1.7 }, { titulo: 'Investimento', largura: 1.1, alinhar: 'direita' }, { titulo: 'Resultados', largura: 1.2, alinhar: 'direita' }, { titulo: 'Custo por resultado', largura: 1.1, alinhar: 'direita' }, { titulo: 'CTR', largura: 0.8, alinhar: 'direita' }, { titulo: 'Hook', largura: 0.8, alinhar: 'direita' }, { titulo: 'Qualidade', largura: 1.3 }, { titulo: 'Tend. CTR', largura: 0.8, alinhar: 'direita' }],
      linhas: anuncios.map(l => {
        const semResultado = l.metricas.conversas + l.metricas.leads + l.metricas.lpv === 0 && l.metricas.gasto > 0
        const rk = l.estrutura?.rankQualidade
        return [{ texto: l.nome, negrito: true }, l.campanhaNome, $(l.metricas.gasto), semResultado ? { texto: 'sem resultado', tom: 'ruim', negrito: true } : `${num(resultadoDe(l))} ${RESULTADO[l.resultado]}`, $(l.custoResultado), pct(l.derivadas.ctr, 2), l.metricas.videoViews > 0 ? pct(l.derivadas.hookRate, 0) : '—', rk ? { texto: RANKING[rk] ?? rk, tom: /^BELOW/.test(rk) ? 'ruim' : rk === 'ABOVE_AVERAGE' ? 'bom' : undefined } : '—', tendencia(l.tendenciaCtr)]
      }),
    })
    if (a.anuncios.length > 40) blocos.push({ tipo: 'texto', texto: `Mostrando os 40 anúncios com mais investimento de ${a.anuncios.length}.`, nota: true })
  }

  // 12. Públicos
  if (publicos) {
    blocos.push({ tipo: 'secao', titulo: 'Públicos: quem responde melhor', nota: `Divisão do investimento e de ${publicos.nomeResultado} por segmento. Índice de custo: 100 = custo médio; abaixo de 100 é mais barato que a média.` })
    if (publicos.achados.length) blocos.push({ tipo: 'destaques', itens: publicos.achados.slice(0, 6).map(x => ({ tom: NIVEL[x.nivel]?.tom ?? 'neutro', titulo: x.titulo, texto: x.texto })) })
    for (const [tipo, nome] of QUEBRAS) {
      const q = publicos.quebras[tipo]
      if (!q || q.erro || !q.segmentos.length) continue
      const segs = [...q.segmentos].sort((x, y) => y.gasto - x.gasto).slice(0, tipo === 'hora' ? 24 : 12)
      blocos.push({ tipo: 'subsecao', titulo: nome })
      blocos.push({
        tipo: 'tabela',
        colunas: [{ titulo: 'Segmento', largura: 2.2 }, { titulo: '% da verba', largura: 1, alinhar: 'direita' }, { titulo: `% de ${publicos.nomeResultado}`, largura: 1.2, alinhar: 'direita' }, { titulo: 'Investimento', largura: 1.2, alinhar: 'direita' }, { titulo: 'Resultados', largura: 1, alinhar: 'direita' }, { titulo: 'Custo por resultado', largura: 1.2, alinhar: 'direita' }, { titulo: 'CTR', largura: 0.8, alinhar: 'direita' }, { titulo: 'Índice de custo', largura: 1, alinhar: 'direita' }],
        linhas: segs.map(s => [{ texto: s.grupo && !s.rotulo.startsWith(s.grupo) ? `${s.grupo} · ${s.rotulo}` : s.rotulo, negrito: true }, pct(s.partGasto, 0), pct(s.partResultados, 0), $(s.gasto), num(s.resultados), $(s.custoResultado), pct(s.ctr, 2), s.indiceCusto == null ? '—' : { texto: num(s.indiceCusto * 100), tom: s.indiceCusto <= 0.8 ? 'bom' : s.indiceCusto >= 1.25 ? 'ruim' : undefined, negrito: true }]),
      })
    }
  } else blocos.push({ tipo: 'texto', texto: 'Públicos: não deu para buscar a divisão por público na Meta agora. Ela aparece na aba Tráfego, seção Públicos.', nota: true })

  // 13. Diagnóstico e auditoria
  blocos.push({ tipo: 'secao', titulo: 'Diagnóstico completo', nota: 'Tudo o que o sistema encontrou no período, do mais urgente ao informativo.' })
  blocos.push({ tipo: 'lista', itens: diagnostico.map(i => ({ tag: NIVEL[i.nivel], titulo: i.titulo, texto: i.texto })), vazio: 'Nada a apontar no período.' })
  if (a.auditoria.itens.length) {
    blocos.push({ tipo: 'secao', titulo: `Auditoria${a.auditoria.nota != null ? ` (nota ${a.auditoria.nota})` : ''}`, nota: 'Checagens objetivas contra a referência de mercado ou a meta configurada.' })
    blocos.push({
      tipo: 'tabela',
      colunas: [{ titulo: 'Checagem', largura: 3 }, { titulo: 'Valor', largura: 1.4, alinhar: 'direita' }, { titulo: 'Referência', largura: 1.6 }, { titulo: 'Situação', largura: 1.1 }],
      linhas: a.auditoria.itens.map(i => [{ texto: i.titulo, negrito: true }, i.valor, i.referencia, { texto: AUDITORIA[i.status]?.texto ?? i.status, tom: AUDITORIA[i.status]?.tom, negrito: true }]),
    })
  }

  // 14. Glossário
  blocos.push({ tipo: 'secao', titulo: 'Como ler os números' })
  blocos.push({
    tipo: 'tabela',
    colunas: [{ titulo: 'Termo', largura: 1.6 }, { titulo: 'O que significa', largura: 5 }],
    linhas: [
      ['CPM', 'Custo por mil impressões. Mede o preço do leilão: sobe com concorrência, público pequeno ou criativo fraco.'],
      ['CTR', 'Taxa de cliques: de cada 100 pessoas que viram o anúncio, quantas clicaram. Mede se o anúncio chama atenção.'],
      ['CPC', 'Custo por clique no link.'],
      ['Connect rate', 'Dos cliques, quantos chegaram de fato ao destino (página carregou ou conversa abriu).'],
      ['Contato', 'Conversa iniciada no WhatsApp/Direct ou lead de formulário/site, contado pela Meta.'],
      ['Lead no CRM', 'Pessoa cadastrada pelo time no CRM. É o número que importa para vendas.'],
      ['Custo por lead (CRM)', 'Investimento dividido pelos leads cadastrados: o custo real de cada oportunidade.'],
      ['Frequência', 'Quantas vezes, em média, cada pessoa viu os anúncios. Acima de 3, o público começa a cansar.'],
      ['Hook rate / Hold rate', 'Gancho (quem assiste 3 s) e retenção (quem fica até o fim) dos vídeos.'],
      ['Aprendizado limitado', 'O conjunto não junta ~50 resultados por semana e a Meta não consegue otimizar bem a entrega.'],
      ['Índice de custo', 'Custo por resultado do segmento comparado com a média (100). Abaixo de 100, o segmento é mais barato.'],
    ],
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
