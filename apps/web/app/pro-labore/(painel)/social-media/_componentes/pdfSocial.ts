// PDF do dia da aba Social Media: o dia (hoje e ontem), o período da tela
// contra o anterior, o caminho do Instagram até a venda, formatos, melhores
// publicações e as recomendações.
import type { AnaliseSocialMedia, FormatoPostSocial, OrigemSocial, PontoSerieSocial } from '@/lib/proLaboreApi'
import { ddmmPdf, diaBR, hojeBR, variacaoPdf, type BlocoPdf, type KpiPdf, type RelatorioPdf, type Tom } from '@/lib/relatorioPdf'
import { fmtCompacto, fmtNum, fmtPct, fmtSeg } from './viz'

type Analise = Extract<AnaliseSocialMedia, { conectado: true }>
const FORMATO: Record<FormatoPostSocial, string> = { REELS: 'Reels', CARROSSEL: 'Carrossel', FOTO: 'Foto' }
const ORIGEM: Record<OrigemSocial, string> = { ORGANICO: 'Orgânico', PAGO: 'Pago', TOTAL: 'Orgânico + pago' }
const RECOMENDACAO: Record<string, { texto: string; tom: Tom }> = {
  alerta: { texto: 'Alerta', tom: 'ruim' }, oportunidade: { texto: 'Oportunidade', tom: 'atencao' },
  destaque: { texto: 'Destaque', tom: 'bom' }, info: { texto: 'Info', tom: 'neutro' },
}
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function kpisDoDia(d: PontoSerieSocial, anterior: PontoSerieSocial | null, rotulo: string): KpiPdf[] {
  const v = (x: number, y: number | undefined) => variacaoPdf(x, y ?? null, 'MAIOR', rotulo)
  return [
    { rotulo: 'Alcance', valor: fmtCompacto(d.alcance), variacao: v(d.alcance, anterior?.alcance) },
    { rotulo: 'Visualizações', valor: fmtCompacto(d.visualizacoes), variacao: v(d.visualizacoes, anterior?.visualizacoes) },
    { rotulo: 'Interações', valor: fmtNum(d.interacoes), variacao: v(d.interacoes, anterior?.interacoes) },
    { rotulo: 'Contas engajadas', valor: fmtNum(d.contasEngajadas), variacao: v(d.contasEngajadas, anterior?.contasEngajadas) },
    { rotulo: 'Visitas ao perfil', valor: fmtNum(d.visitasPerfil), variacao: v(d.visitasPerfil, anterior?.visitasPerfil) },
    { rotulo: 'Toques em links', valor: fmtNum(d.toquesLinks), variacao: v(d.toquesLinks, anterior?.toquesLinks) },
    { rotulo: 'Seguidores', valor: `${d.saldoSeguidores >= 0 ? '+' : ''}${fmtNum(d.saldoSeguidores)}`, detalhe: `${fmtNum(d.seguidoresGanhos)} entraram · ${fmtNum(d.seguidoresPerdidos)} saíram` },
    { rotulo: 'Publicações', valor: fmtNum(d.publicacoes) },
  ]
}

export function relatorioSocial(a: Analise): RelatorioPdf {
  const hoje = hojeBR()
  const k = a.kpis
  const blocos: BlocoPdf[] = []

  // O dia: hoje (parcial) e o último dia fechado com dados.
  const comDados = a.serie.filter(p => p.temDados)
  const pontoHoje = comDados.find(p => p.data === hoje) ?? null
  const fechados = comDados.filter(p => p.data < hoje)
  const ultimo = fechados[fechados.length - 1] ?? null
  const penultimo = fechados[fechados.length - 2] ?? null
  if (pontoHoje) {
    blocos.push({ tipo: 'secao', titulo: `Hoje, ${ddmmPdf(hoje)}`, nota: 'Parcial: números até a última sincronização com o Instagram, comparados com o dia anterior inteiro.' })
    blocos.push({ tipo: 'kpis', itens: kpisDoDia(pontoHoje, ultimo, 'vs. dia anterior') })
  }
  if (ultimo) {
    blocos.push({ tipo: 'secao', titulo: `Último dia fechado: ${ddmmPdf(ultimo.data)}`, nota: penultimo ? `Comparado com ${ddmmPdf(penultimo.data)}.` : undefined })
    blocos.push({ tipo: 'kpis', itens: kpisDoDia(ultimo, penultimo, 'vs. dia anterior') })
  }
  if (!pontoHoje && !ultimo) blocos.push({ tipo: 'texto', texto: 'Ainda não há dias sincronizados no período.', nota: true })
  const postsHoje = a.publicacoes.filter(p => p.dia === hoje)
  if (postsHoje.length) {
    blocos.push({ tipo: 'secao', titulo: 'Publicado hoje' })
    blocos.push({
      tipo: 'tabela',
      colunas: [{ titulo: 'Hora', largura: 0.8 }, { titulo: 'Formato', largura: 1 }, { titulo: 'Legenda', largura: 4 }, { titulo: 'Alcance', largura: 1, alinhar: 'direita' }, { titulo: 'Interações', largura: 1.1, alinhar: 'direita' }],
      linhas: postsHoje.map(p => [`${String(p.hora).padStart(2, '0')}h`, FORMATO[p.formato], (p.legenda ?? '(sem legenda)').slice(0, 140), fmtNum(p.alcance), fmtNum(p.interacoes)]),
    })
  }

  // Período da tela.
  const v = (x: number | null, y: number | null) => variacaoPdf(x, y, 'MAIOR', 'vs. anterior')
  blocos.push({ tipo: 'secao', titulo: `Período analisado: ${ddmmPdf(a.periodo.inicio)} a ${ddmmPdf(a.periodo.fim)} (${a.periodo.dias} dias)`, nota: `${ORIGEM[a.origem.selecionada]} · comparado com ${ddmmPdf(a.periodo.anteriorInicio)} a ${ddmmPdf(a.periodo.anteriorFim)}.` })
  blocos.push({ tipo: 'kpis', itens: [
    { rotulo: 'Seguidores', valor: fmtNum(k.seguidores.atual), detalhe: `${k.seguidores.variacao != null ? `${k.seguidores.variacao >= 0 ? '+' : ''}${fmtNum(k.seguidores.variacao)} no período · ` : ''}${fmtNum(k.seguidores.ganhos)} entraram, ${fmtNum(k.seguidores.perdidos)} saíram` },
    { rotulo: 'Alcance médio por dia', valor: fmtCompacto(k.alcanceMedioDia.atual), variacao: v(k.alcanceMedioDia.atual, k.alcanceMedioDia.anterior) },
    { rotulo: 'Visualizações', valor: fmtCompacto(k.visualizacoes.atual), variacao: v(k.visualizacoes.atual, k.visualizacoes.anterior) },
    { rotulo: 'Interações', valor: fmtNum(k.interacoes.atual), variacao: v(k.interacoes.atual, k.interacoes.anterior) },
    { rotulo: 'Taxa de engajamento', valor: fmtPct(k.taxaEngajamento.atual), variacao: v(k.taxaEngajamento.atual, k.taxaEngajamento.anterior) },
    { rotulo: 'Visitas ao perfil', valor: fmtNum(k.visitasPerfil.atual), variacao: v(k.visitasPerfil.atual, k.visitasPerfil.anterior) },
    { rotulo: 'Toques em links', valor: fmtNum(k.toquesLinks.atual), variacao: v(k.toquesLinks.atual, k.toquesLinks.anterior) },
    { rotulo: 'Alcance médio por post', valor: fmtCompacto(k.alcanceMedioPost.atual), variacao: v(k.alcanceMedioPost.atual, k.alcanceMedioPost.anterior) },
    { rotulo: 'Publicações', valor: `${fmtNum(k.publicacoes.atual)} de ${fmtNum(k.publicacoes.meta)}`, detalhe: `meta do período · ${fmtNum(k.stories.atual)} stories`, variacao: v(k.publicacoes.atual, k.publicacoes.anterior) },
    { rotulo: 'Dias com post', valor: `${fmtNum(k.diasComPost.atual)} de ${fmtNum(k.diasComPost.meta)}`, detalhe: `maior intervalo sem postar: ${fmtNum(k.diasComPost.maiorIntervalo)} dias` },
  ] })

  // Do Instagram até a venda.
  const f = a.funil
  const etapas = [
    { rotulo: 'Alcance (pessoas únicas)', valor: f.alcanceUnico },
    { rotulo: 'Visitas ao perfil', valor: f.visitasPerfil },
    { rotulo: 'Conversas iniciadas', valor: f.conversasIniciadas },
    { rotulo: 'Leads no CRM', valor: f.leads },
    { rotulo: 'Em negociação (MQL)', valor: f.mql },
    { rotulo: 'Vendas', valor: f.vendas },
  ]
  blocos.push({ tipo: 'secao', titulo: 'Do Instagram até a venda', nota: 'Leads com canal Orgânico no CRM criados no período.' })
  blocos.push({
    tipo: 'tabela',
    colunas: [{ titulo: 'Etapa', largura: 3 }, { titulo: 'Volume', largura: 1.4, alinhar: 'direita' }, { titulo: 'Passagem da etapa anterior', largura: 2, alinhar: 'direita' }],
    linhas: etapas.map((e, i) => {
      const anterior = etapas.slice(0, i).reverse().find(x => x.valor != null && x.valor > 0)?.valor ?? null
      return [e.rotulo, e.valor == null ? 'sem dado' : fmtNum(e.valor), i === 0 || e.valor == null || !anterior ? '—' : fmtPct(e.valor / anterior)]
    }),
  })

  if (a.porFormato.length) {
    blocos.push({ tipo: 'secao', titulo: 'Desempenho por formato' })
    blocos.push({
      tipo: 'tabela',
      colunas: [{ titulo: 'Formato', largura: 1.4 }, { titulo: 'Posts', largura: 0.8, alinhar: 'direita' }, { titulo: 'Alcance médio', largura: 1.3, alinhar: 'direita' }, { titulo: 'Visualizações médias', largura: 1.4, alinhar: 'direita' }, { titulo: 'Interações médias', largura: 1.3, alinhar: 'direita' }, { titulo: 'Engajamento', largura: 1.2, alinhar: 'direita' }, { titulo: 'Seguidores gerados', largura: 1.3, alinhar: 'direita' }],
      linhas: a.porFormato.map(x => [FORMATO[x.formato], fmtNum(x.quantidade), fmtCompacto(x.alcanceMedio), fmtCompacto(x.visualizacoesMedias), fmtNum(x.interacoesMedias), fmtPct(x.taxaEngajamento), fmtNum(x.seguidoresGerados)]),
    })
    if (a.reels.quantidade > 0) blocos.push({ tipo: 'texto', texto: `Reels: ${fmtNum(a.reels.quantidade)} no período, tempo médio assistido de ${fmtSeg(a.reels.tempoMedioAssistidoSeg)} e ${fmtPct(a.reels.taxaCompartilhamento)} de compartilhamento.`, nota: true })
  }

  const top = [...a.publicacoes].filter(p => !p.semInsights).sort((x, y) => y.alcance - x.alcance).slice(0, 8)
  if (top.length) {
    blocos.push({ tipo: 'secao', titulo: 'Publicações com mais alcance' })
    blocos.push({
      tipo: 'tabela',
      colunas: [{ titulo: 'Dia', largura: 0.8 }, { titulo: 'Formato', largura: 1 }, { titulo: 'Legenda', largura: 3.6 }, { titulo: 'Alcance', largura: 1, alinhar: 'direita' }, { titulo: 'Interações', largura: 1, alinhar: 'direita' }, { titulo: 'Engajamento', largura: 1.1, alinhar: 'direita' }, { titulo: 'Leads', largura: 0.8, alinhar: 'direita' }],
      linhas: top.map(p => [ddmmPdf(p.dia), FORMATO[p.formato], (p.legenda ?? '(sem legenda)').slice(0, 120), fmtCompacto(p.alcance), fmtNum(p.interacoes), fmtPct(p.taxaEngajamento), p.leads == null ? '—' : fmtNum(p.leads)]),
    })
  }

  const dias = [...a.porDiaSemana].filter(d => d.quantidade > 0).sort((x, y) => y.alcanceMedio - x.alcanceMedio)
  if (dias.length) {
    blocos.push({ tipo: 'secao', titulo: 'Melhores dias para postar', nota: 'Alcance médio das publicações de cada dia da semana no período.' })
    blocos.push({ tipo: 'barras', itens: dias.map(d => ({ rotulo: `${DIAS[d.dia]} (${d.quantidade} ${d.quantidade === 1 ? 'post' : 'posts'})`, valor: d.alcanceMedio, texto: `${fmtCompacto(d.alcanceMedio)} · ${fmtPct(d.taxaEngajamento)}` })) })
  }

  const rv = a.relacaoVendas
  if (rv.leadsGerados > 0 || rv.leadsGanhos > 0) {
    blocos.push({ tipo: 'secao', titulo: 'Resultado comercial' })
    blocos.push({ tipo: 'kpis', colunas: 3, itens: [
      { rotulo: 'Leads gerados', valor: fmtNum(rv.leadsGerados) },
      { rotulo: 'Leads que viraram venda', valor: fmtNum(rv.leadsGanhos) },
      { rotulo: 'Valor negociado', valor: rv.valorNegociadoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) },
    ] })
  }

  blocos.push({ tipo: 'secao', titulo: 'Recomendações', nota: 'Leituras automáticas do período. "Hipótese" quando a amostra ainda é pequena.' })
  blocos.push({
    tipo: 'lista',
    itens: a.recomendacoes.map(r => ({ tag: RECOMENDACAO[r.tipo] ?? RECOMENDACAO.info, titulo: r.titulo, texto: `${r.detalhe}${r.confianca === 'hipotese' ? ' (hipótese)' : ''}` })),
    vazio: 'Sem recomendações para o período.',
  })

  if (a.qualidade.status !== 'completo') blocos.push({ tipo: 'texto', texto: `Atenção: ${a.qualidade.diasSemDados.length} dia(s) do período sem dados sincronizados. Os totais podem estar abaixo do real.`, nota: true })

  const atualizado = a.conta.ultimaSincronizacaoEm ? new Date(a.conta.ultimaSincronizacaoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'sem sincronização'
  return {
    titulo: 'Relatório de Social Media',
    subtitulo: `Dia ${diaBR(hoje)} · período ${ddmmPdf(a.periodo.inicio)} a ${ddmmPdf(a.periodo.fim)}`,
    contexto: [`@${a.conta.nomeUsuario}`, `${fmtNum(a.conta.seguidores)} seguidores`, `Instagram até ${atualizado}`],
    blocos,
    arquivo: `social-media-${hoje}`,
  }
}
