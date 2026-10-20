// PDF gerencial da aba Social Media: resumo executivo com as leituras e
// prioridades, o dia, todos os indicadores contra o período anterior,
// evolução diária, interações, caminho até a venda, formatos (reels e
// stories), quando postar, hashtags e legendas, audiência, alcance,
// consistência, pago × orgânico, todas as publicações, recomendações e
// glossário.
import type { AnaliseSocialMedia, FormatoPostSocial, OrigemSocial, PontoSerieSocial, PostSocial } from '@/lib/proLaboreApi'
import {
  compararValores, ddmmPdf, diaBR, diaSemanaPdf, hojeBR, tabelaComparativa, variacaoPdf,
  type BlocoPdf, type CelulaPdf, type DestaquePdf, type KpiPdf, type LinhaComparativa, type RelatorioPdf, type Tom,
} from '@/lib/relatorioPdf'
import { fmtCompacto, fmtNum, fmtPct, fmtSeg } from './viz'

type Analise = Extract<AnaliseSocialMedia, { conectado: true }>
const FORMATO: Record<FormatoPostSocial, string> = { REELS: 'Reels', CARROSSEL: 'Carrossel', FOTO: 'Foto' }
const ORIGEM: Record<OrigemSocial, string> = { ORGANICO: 'Orgânico', PAGO: 'Pago', TOTAL: 'Orgânico + pago' }
const RECOMENDACAO: Record<string, { texto: string; tom: Tom }> = {
  alerta: { texto: 'Alerta', tom: 'ruim' }, oportunidade: { texto: 'Oportunidade', tom: 'atencao' },
  destaque: { texto: 'Destaque', tom: 'bom' }, info: { texto: 'Info', tom: 'neutro' },
}
const CONFIANCA: Record<string, string> = { alta: 'confiança alta', media: 'confiança média', baixa: 'confiança baixa', hipotese: 'hipótese (amostra pequena)' }
const IMPACTO: Record<string, { texto: string; tom?: Tom }> = { EXCEPCIONAL: { texto: 'Excepcional', tom: 'bom' }, ALTO: { texto: 'Alto', tom: 'bom' }, MEDIO: { texto: 'Médio' }, BAIXO: { texto: 'Baixo', tom: 'atencao' } }
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
// Tipos de mídia da distribuição do alcance (nomes da Meta).
const TIPO_MIDIA: Record<string, string> = { REEL: 'Reels', REELS: 'Reels', POST: 'Posts (foto/vídeo)', CAROUSEL_CONTAINER: 'Carrosséis', STORY: 'Stories', AD: 'Anúncios', IGTV: 'Vídeos', LIVE: 'Lives' }
const GENERO: Record<string, string> = { F: 'Mulheres', M: 'Homens', U: 'Não informado' }
const div = (a: number, b: number) => (b > 0 ? a / b : null)
const legenda = (p: PostSocial, n = 70) => {
  const t = (p.legenda ?? '').replace(/\s+/g, ' ').trim()
  return t ? (t.length > n ? `${t.slice(0, n - 1)}…` : t) : '(sem legenda)'
}

function kpisDoDia(d: PontoSerieSocial, anterior: PontoSerieSocial | null, rotulo: string): KpiPdf[] {
  const v = (x: number, y: number | undefined) => variacaoPdf(x, y ?? null, 'MAIOR', rotulo)
  return [
    { rotulo: 'Alcance', valor: fmtCompacto(d.alcance), variacao: v(d.alcance, anterior?.alcance) },
    { rotulo: 'Visualizações', valor: fmtCompacto(d.visualizacoes), variacao: v(d.visualizacoes, anterior?.visualizacoes) },
    { rotulo: 'Interações', valor: fmtNum(d.interacoes), variacao: v(d.interacoes, anterior?.interacoes) },
    { rotulo: 'Seguidores', valor: `${d.saldoSeguidores >= 0 ? '+' : ''}${fmtNum(d.saldoSeguidores)}`, detalhe: `${fmtNum(d.seguidoresGanhos)} entraram · ${fmtNum(d.seguidoresPerdidos)} saíram` },
  ]
}
function comparativoDoDia(d: PontoSerieSocial, ant: PontoSerieSocial | null): LinhaComparativa[] {
  const n = (v: number | null | undefined) => fmtNum(v)
  return [
    { indicador: 'Alcance', atual: d.alcance, anterior: ant?.alcance, formatar: n, melhor: 'MAIOR' },
    { indicador: 'Visualizações', atual: d.visualizacoes, anterior: ant?.visualizacoes, formatar: n, melhor: 'MAIOR' },
    { indicador: 'Interações', atual: d.interacoes, anterior: ant?.interacoes, formatar: n, melhor: 'MAIOR' },
    { indicador: 'Contas engajadas', atual: d.contasEngajadas, anterior: ant?.contasEngajadas, formatar: n, melhor: 'MAIOR' },
    { indicador: 'Visitas ao perfil', atual: d.visitasPerfil, anterior: ant?.visitasPerfil, formatar: n, melhor: 'MAIOR' },
    { indicador: 'Toques em links', atual: d.toquesLinks, anterior: ant?.toquesLinks, formatar: n, melhor: 'MAIOR' },
    { indicador: 'Seguidores ganhos', atual: d.seguidoresGanhos, anterior: ant?.seguidoresGanhos, formatar: n, melhor: 'MAIOR' },
    { indicador: 'Seguidores perdidos', atual: d.seguidoresPerdidos, anterior: ant?.seguidoresPerdidos, formatar: n, melhor: 'MENOR' },
    { indicador: 'Publicações', atual: d.publicacoes, anterior: ant?.publicacoes, formatar: n, melhor: 'NEUTRO' },
  ]
}

function comparativoPeriodo(a: Analise): LinhaComparativa[] {
  const k = a.kpis
  const n = (v: number | null | undefined) => fmtNum(v)
  const p = (v: number | null | undefined) => fmtPct(v)
  return [
    { indicador: 'Seguidores ganhos', atual: k.seguidores.ganhos, anterior: k.seguidores.ganhosAnterior, formatar: n, melhor: 'MAIOR', explicacao: 'Novas pessoas seguindo o perfil.' },
    { indicador: 'Seguidores perdidos', atual: k.seguidores.perdidos, anterior: k.seguidores.perdidosAnterior, formatar: n, melhor: 'MENOR', explicacao: 'Deixaram de seguir.' },
    { indicador: 'Alcance médio por dia', atual: k.alcanceMedioDia.atual, anterior: k.alcanceMedioDia.anterior, formatar: n, melhor: 'MAIOR', explicacao: 'Pessoas diferentes alcançadas por dia.' },
    { indicador: 'Visualizações', atual: k.visualizacoes.atual, anterior: k.visualizacoes.anterior, formatar: n, melhor: 'MAIOR', explicacao: 'Vezes que o conteúdo foi visto.' },
    { indicador: 'Interações', atual: k.interacoes.atual, anterior: k.interacoes.anterior, formatar: n, melhor: 'MAIOR', explicacao: 'Curtidas, comentários, compartilhamentos, salvamentos e respostas.' },
    { indicador: 'Contas engajadas por dia', atual: k.contasEngajadasMediaDia.atual, anterior: k.contasEngajadasMediaDia.anterior, formatar: n, melhor: 'MAIOR' },
    { indicador: 'Taxa de engajamento', atual: k.taxaEngajamento.atual, anterior: k.taxaEngajamento.anterior, formatar: p, melhor: 'MAIOR', pontos: true, explicacao: 'Interações ÷ alcance dos posts.' },
    { indicador: 'Visitas ao perfil', atual: k.visitasPerfil.atual, anterior: k.visitasPerfil.anterior, formatar: n, melhor: 'MAIOR', explicacao: 'Interesse: quem foi ver o perfil.' },
    { indicador: 'Toques em links', atual: k.toquesLinks.atual, anterior: k.toquesLinks.anterior, formatar: n, melhor: 'MAIOR', explicacao: 'Cliques no link da bio/WhatsApp.' },
    { indicador: 'Alcance médio por post', atual: k.alcanceMedioPost.atual, anterior: k.alcanceMedioPost.anterior, formatar: n, melhor: 'MAIOR' },
    { indicador: 'Publicações no feed', atual: k.publicacoes.atual, anterior: k.publicacoes.anterior, formatar: n, melhor: 'MAIOR', explicacao: `Meta do período: ${k.publicacoes.meta}.` },
    { indicador: 'Dias com post', atual: k.diasComPost.atual, anterior: k.diasComPost.anterior, formatar: n, melhor: 'MAIOR', explicacao: `Meta do período: ${k.diasComPost.meta}.` },
  ]
}

function leituras(a: Analise): DestaquePdf[] {
  const k = a.kpis
  const out: DestaquePdf[] = []
  const seg = k.seguidores
  out.push({
    tom: (seg.variacao ?? 0) > 0 ? 'bom' : (seg.variacao ?? 0) < 0 ? 'ruim' : 'neutro', titulo: 'Base de seguidores',
    texto: `${fmtNum(seg.atual)} seguidores. No período entraram ${fmtNum(seg.ganhos)} e saíram ${fmtNum(seg.perdidos)}${seg.taxaCrescimento != null ? ` (crescimento de ${fmtPct(seg.taxaCrescimento)})` : ''}.`,
  })
  const vAlc = compararValores({ atual: k.alcanceMedioDia.atual, anterior: k.alcanceMedioDia.anterior, melhor: 'MAIOR' })
  const vEng = compararValores({ atual: k.taxaEngajamento.atual, anterior: k.taxaEngajamento.anterior, melhor: 'MAIOR', pontos: true })
  out.push({ tom: vAlc.tom, titulo: 'Distribuição e engajamento', texto: `Alcance médio de ${fmtNum(k.alcanceMedioDia.atual)} pessoas por dia${vAlc.texto !== '—' ? ` (${vAlc.texto} vs. anterior)` : ''} e engajamento de ${fmtPct(k.taxaEngajamento.atual)}${vEng.texto !== '—' ? ` (${vEng.texto})` : ''}.${a.distribuicaoAlcance?.shareDescoberta != null ? ` ${fmtPct(a.distribuicaoAlcance.shareDescoberta, 0)} do alcance veio de quem não segue o perfil (descoberta).` : ''}` })
  const pub = k.publicacoes, dias = k.diasComPost
  out.push({ tom: pub.atual >= pub.meta ? 'bom' : pub.atual >= pub.meta * 0.7 ? 'atencao' : 'ruim', titulo: 'Constância', texto: `${fmtNum(pub.atual)} publicações de ${fmtNum(pub.meta)} da meta, em ${fmtNum(dias.atual)} de ${fmtNum(dias.meta)} dias planejados. Maior intervalo sem postar: ${fmtNum(dias.maiorIntervalo)} dias.${a.consistencia.diasSemPostAteHoje ? ` Último post há ${a.consistencia.diasSemPostAteHoje} dias.` : ''}` })
  const formatos = a.porFormato.filter(f => f.quantidade >= 2).sort((x, y) => y.alcanceMedio - x.alcanceMedio)
  if (formatos.length >= 2) out.push({ tom: 'bom', titulo: 'Formato que mais alcança', texto: `${FORMATO[formatos[0].formato]}: ${fmtNum(formatos[0].alcanceMedio)} pessoas por post, contra ${fmtNum(formatos[formatos.length - 1].alcanceMedio)} em ${FORMATO[formatos[formatos.length - 1].formato].toLowerCase()} (${formatos[0].quantidade} e ${formatos[formatos.length - 1].quantidade} posts).` })
  const diasBons = a.porDiaSemana.filter(d => d.quantidade >= 1).sort((x, y) => y.alcanceMedio - x.alcanceMedio)
  const horas = a.porHora.filter(h => h.quantidade >= 1).sort((x, y) => y.alcanceMedio - x.alcanceMedio)
  if (diasBons.length >= 2 || horas.length >= 2) out.push({ tom: 'neutro', titulo: 'Quando postar', texto: `${diasBons[0] ? `${DIAS[diasBons[0].dia]} é o dia de maior alcance médio (${fmtNum(diasBons[0].alcanceMedio)})` : ''}${diasBons[0] && horas[0] ? '; ' : ''}${horas[0] ? `o melhor horário foi ${horas[0].hora}h (${fmtNum(horas[0].alcanceMedio)} por post)` : ''}.` })
  const top = [...a.publicacoes].filter(p => !p.semInsights).sort((x, y) => y.alcance - x.alcance)[0]
  if (top) out.push({ tom: 'bom', titulo: 'Post de maior alcance', texto: `${FORMATO[top.formato]} de ${ddmmPdf(top.dia)}: ${fmtNum(top.alcance)} pessoas, ${fmtNum(top.interacoes)} interações (${fmtPct(top.taxaEngajamento)}). "${legenda(top, 90)}"` })
  const f = a.funil
  out.push({ tom: f.leads > 0 ? 'neutro' : 'atencao', titulo: 'Resultado comercial', texto: f.leads > 0 ? `${fmtNum(f.leads)} leads orgânicos no CRM no período, ${fmtNum(f.mql)} em negociação e ${fmtNum(f.vendas)} vendas.` : 'Nenhum lead orgânico cadastrado no CRM no período. Confira se o time marca o canal "Orgânico" ao cadastrar quem chega pelo Instagram.' })
  if (a.qualidade.status !== 'completo') out.push({ tom: 'atencao', titulo: 'Sobre os dados', texto: `${a.qualidade.diasSemDados.length} dia(s) do período sem dados sincronizados: os totais podem estar abaixo do real.` })
  return out
}

export function relatorioSocial(a: Analise): RelatorioPdf {
  const hoje = hojeBR()
  const k = a.kpis
  const blocos: BlocoPdf[] = []
  const recs = a.recomendacoes

  // 1. Resumo executivo
  blocos.push({ tipo: 'secao', titulo: 'Resumo executivo', nota: `${ORIGEM[a.origem.selecionada]} · período de ${ddmmPdf(a.periodo.inicio)} a ${ddmmPdf(a.periodo.fim)} (${a.periodo.dias} dias), comparado com ${ddmmPdf(a.periodo.anteriorInicio)} a ${ddmmPdf(a.periodo.anteriorFim)}.` })
  const v = (x: number | null, y: number | null) => variacaoPdf(x, y, 'MAIOR', 'vs. anterior')
  blocos.push({ tipo: 'kpis', itens: [
    { rotulo: 'Seguidores', valor: fmtNum(k.seguidores.atual), detalhe: `${k.seguidores.variacao != null ? `${k.seguidores.variacao >= 0 ? '+' : ''}${fmtNum(k.seguidores.variacao)} no período` : ''}` },
    { rotulo: 'Alcance médio por dia', valor: fmtCompacto(k.alcanceMedioDia.atual), variacao: v(k.alcanceMedioDia.atual, k.alcanceMedioDia.anterior) },
    { rotulo: 'Visualizações', valor: fmtCompacto(k.visualizacoes.atual), variacao: v(k.visualizacoes.atual, k.visualizacoes.anterior) },
    { rotulo: 'Taxa de engajamento', valor: fmtPct(k.taxaEngajamento.atual), variacao: v(k.taxaEngajamento.atual, k.taxaEngajamento.anterior) },
    { rotulo: 'Interações', valor: fmtNum(k.interacoes.atual), variacao: v(k.interacoes.atual, k.interacoes.anterior) },
    { rotulo: 'Visitas ao perfil', valor: fmtNum(k.visitasPerfil.atual), variacao: v(k.visitasPerfil.atual, k.visitasPerfil.anterior) },
    { rotulo: 'Publicações', valor: `${fmtNum(k.publicacoes.atual)} de ${fmtNum(k.publicacoes.meta)}`, detalhe: `${fmtNum(k.stories.atual)} stories` },
    { rotulo: 'Leads orgânicos', valor: fmtNum(a.funil.leads), detalhe: `${fmtNum(a.funil.vendas)} vendas` },
  ] })
  blocos.push({ tipo: 'destaques', titulo: 'Leitura do período', itens: leituras(a) })
  const prioridades = recs.filter(r => r.tipo === 'alerta' || r.tipo === 'oportunidade').slice(0, 5)
  if (prioridades.length) blocos.push({ tipo: 'destaques', titulo: 'Prioridades de ação', itens: prioridades.map(r => ({ tom: RECOMENDACAO[r.tipo].tom, titulo: r.titulo, texto: `${r.detalhe}${r.confianca === 'hipotese' ? ' (hipótese: amostra pequena)' : ''}` })) })

  // 2. O dia
  const comDados = a.serie.filter(p => p.temDados)
  const pontoHoje = comDados.find(p => p.data === hoje) ?? null
  const fechados = comDados.filter(p => p.data < hoje)
  const ultimo = fechados[fechados.length - 1] ?? null
  const penultimo = fechados[fechados.length - 2] ?? null
  blocos.push({ tipo: 'secao', titulo: pontoHoje ? `O dia ${ddmmPdf(hoje)}` : `Último dia fechado (${ultimo ? ddmmPdf(ultimo.data) : '—'})`, nota: pontoHoje ? 'Parcial: números até a última sincronização com o Instagram, comparados com o dia anterior inteiro.' : 'O Instagram ainda não mandou os números de hoje.' })
  const dia = pontoHoje ?? ultimo
  const diaAnt = pontoHoje ? ultimo : penultimo
  if (dia) {
    blocos.push({ tipo: 'kpis', itens: kpisDoDia(dia, diaAnt, 'vs. dia anterior') })
    blocos.push(tabelaComparativa(comparativoDoDia(dia, diaAnt), { atual: ddmmPdf(dia.data), anterior: diaAnt ? ddmmPdf(diaAnt.data) : 'Anterior' }))
  } else blocos.push({ tipo: 'texto', texto: 'Ainda não há dias sincronizados no período.', nota: true })
  const postsHoje = a.publicacoes.filter(p => p.dia === hoje)
  if (postsHoje.length) {
    blocos.push({ tipo: 'subsecao', titulo: 'Publicado hoje' })
    blocos.push({
      tipo: 'tabela',
      colunas: [{ titulo: 'Hora', largura: 0.7 }, { titulo: 'Formato', largura: 1 }, { titulo: 'Legenda', largura: 4 }, { titulo: 'Alcance', largura: 1, alinhar: 'direita' }, { titulo: 'Interações', largura: 1.1, alinhar: 'direita' }],
      linhas: postsHoje.map(p => [`${String(p.hora).padStart(2, '0')}h`, FORMATO[p.formato], legenda(p, 140), fmtNum(p.alcance), fmtNum(p.interacoes)]),
    })
  }

  // 3. Indicadores
  blocos.push({ tipo: 'secao', titulo: 'Todos os indicadores', nota: 'Cada número do período contra o período anterior de mesmo tamanho.' })
  blocos.push(tabelaComparativa(comparativoPeriodo(a)))

  // 4. Evolução diária
  const serie = a.serie.filter(p => p.temDados)
  if (serie.length) {
    blocos.push({ tipo: 'secao', titulo: 'Evolução dia a dia' })
    blocos.push({ tipo: 'grafico', titulo: 'Alcance por dia', itens: serie.map(p => ({ rotulo: ddmmPdf(p.data), valor: p.alcance })), formatar: v2 => fmtCompacto(v2), media: true })
    blocos.push({ tipo: 'grafico', titulo: 'Interações por dia', itens: serie.map(p => ({ rotulo: ddmmPdf(p.data), valor: p.interacoes })), formatar: v2 => fmtNum(v2), media: true })
    blocos.push({ tipo: 'grafico', titulo: 'Novos seguidores por dia', itens: serie.map(p => ({ rotulo: ddmmPdf(p.data), valor: p.seguidoresGanhos })), formatar: v2 => fmtNum(v2), media: true })
    const soma = (c: keyof PontoSerieSocial) => serie.reduce((s, p) => s + Number(p[c] ?? 0), 0)
    blocos.push({
      tipo: 'tabela',
      colunas: [{ titulo: 'Dia', largura: 1.1 }, { titulo: 'Alcance', largura: 1, alinhar: 'direita' }, { titulo: 'Visualizações', largura: 1.1, alinhar: 'direita' }, { titulo: 'Interações', largura: 1, alinhar: 'direita' }, { titulo: 'Visitas perfil', largura: 1, alinhar: 'direita' }, { titulo: 'Toques links', largura: 1, alinhar: 'direita' }, { titulo: 'Entraram', largura: 0.9, alinhar: 'direita' }, { titulo: 'Saíram', largura: 0.9, alinhar: 'direita' }, { titulo: 'Posts', largura: 0.7, alinhar: 'direita' }],
      linhas: [...serie].reverse().map(p => [diaSemanaPdf(p.data), fmtNum(p.alcance), fmtNum(p.visualizacoes), fmtNum(p.interacoes), fmtNum(p.visitasPerfil), fmtNum(p.toquesLinks), fmtNum(p.seguidoresGanhos), fmtNum(p.seguidoresPerdidos), fmtNum(p.publicacoes)]),
      total: ['Total', '—', fmtNum(soma('visualizacoes')), fmtNum(soma('interacoes')), fmtNum(soma('visitasPerfil')), fmtNum(soma('toquesLinks')), fmtNum(soma('seguidoresGanhos')), fmtNum(soma('seguidoresPerdidos')), fmtNum(soma('publicacoes'))],
    })
  }

  // 5. Interações
  const ci = a.composicaoInteracoes
  blocos.push({ tipo: 'secao', titulo: 'Composição das interações', nota: 'Salvamentos e compartilhamentos pesam mais para o algoritmo do que curtidas.' })
  blocos.push({ tipo: 'barras', itens: [['Curtidas', ci.curtidas], ['Comentários', ci.comentarios], ['Compartilhamentos', ci.compartilhamentos], ['Salvamentos', ci.salvamentos], ['Respostas (stories)', ci.respostas], ['Outras (reposts etc.)', ci.outras]].map(([r, x]) => ({ rotulo: String(r), valor: Number(x), texto: `${fmtNum(Number(x))} · ${fmtPct(div(Number(x), ci.total), 0)}` })) })

  // 6. Até a venda
  const f = a.funil
  const etapas = [
    { rotulo: 'Alcance (pessoas únicas)', valor: f.alcanceUnico, motivo: f.alcanceUnicoMotivo },
    { rotulo: 'Visitas ao perfil', valor: f.visitasPerfil, motivo: null },
    { rotulo: 'Conversas iniciadas', valor: f.conversasIniciadas, motivo: f.conversasMotivo },
    { rotulo: 'Leads no CRM', valor: f.leads, motivo: null },
    { rotulo: 'Em negociação (MQL)', valor: f.mql, motivo: null },
    { rotulo: 'Vendas', valor: f.vendas, motivo: null },
  ]
  blocos.push({ tipo: 'secao', titulo: 'Do Instagram até a venda', nota: 'Leads com canal Orgânico no CRM criados no período.' })
  blocos.push({
    tipo: 'tabela',
    colunas: [{ titulo: 'Etapa', largura: 2.4 }, { titulo: 'Volume', largura: 1.2, alinhar: 'direita' }, { titulo: 'Passagem da etapa anterior', largura: 1.6, alinhar: 'direita' }, { titulo: 'Observação', largura: 3 }],
    linhas: etapas.map((e, i) => {
      const anterior = etapas.slice(0, i).reverse().find(x => x.valor != null && x.valor > 0)?.valor ?? null
      return [{ texto: e.rotulo, negrito: true }, e.valor == null ? 'sem dado' : fmtNum(e.valor), i === 0 || e.valor == null || !anterior ? '—' : fmtPct(e.valor / anterior), e.valor == null && e.motivo ? e.motivo : '']
    }),
  })
  const rv = a.relacaoVendas
  blocos.push({ tipo: 'kpis', colunas: 3, itens: [
    { rotulo: 'Leads gerados', valor: fmtNum(rv.leadsGerados) },
    { rotulo: 'Leads que viraram venda', valor: fmtNum(rv.leadsGanhos), detalhe: rv.leadsGerados ? `${fmtPct(rv.leadsGanhos / rv.leadsGerados)} dos leads` : undefined },
    { rotulo: 'Valor negociado', valor: rv.valorNegociadoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) },
  ] })

  // 7. Formatos
  if (a.porFormato.length) {
    blocos.push({ tipo: 'secao', titulo: 'Formatos: reels, carrosséis e fotos', nota: 'Médias por publicação de cada formato no período.' })
    blocos.push({
      tipo: 'tabela',
      colunas: [{ titulo: 'Formato', largura: 1.3 }, { titulo: 'Posts', largura: 0.7, alinhar: 'direita' }, { titulo: 'Alcance médio', largura: 1.1, alinhar: 'direita' }, { titulo: 'Visualizações médias', largura: 1.2, alinhar: 'direita' }, { titulo: 'Interações médias', largura: 1.1, alinhar: 'direita' }, { titulo: 'Engajamento', largura: 1, alinhar: 'direita' }, { titulo: 'Salvamentos médios', largura: 1.1, alinhar: 'direita' }, { titulo: 'Compart. médios', largura: 1.1, alinhar: 'direita' }, { titulo: 'Seguidores gerados', largura: 1.1, alinhar: 'direita' }],
      linhas: a.porFormato.map(x => [{ texto: FORMATO[x.formato], negrito: true }, fmtNum(x.quantidade), fmtCompacto(x.alcanceMedio), fmtCompacto(x.visualizacoesMedias), fmtNum(x.interacoesMedias), fmtPct(x.taxaEngajamento), fmtNum(x.salvamentosMedios), fmtNum(x.compartilhamentosMedios), fmtNum(x.seguidoresGerados)]),
    })
    if (a.reels.quantidade > 0) {
      blocos.push({ tipo: 'subsecao', titulo: 'Reels' })
      blocos.push({ tipo: 'kpis', itens: [
        { rotulo: 'Reels no período', valor: fmtNum(a.reels.quantidade) },
        { rotulo: 'Alcance médio', valor: fmtCompacto(a.reels.alcanceMedio) },
        { rotulo: 'Tempo médio assistido', valor: fmtSeg(a.reels.tempoMedioAssistidoSeg) },
        { rotulo: 'Taxa de compartilhamento', valor: fmtPct(a.reels.taxaCompartilhamento) },
      ] })
    }
    const st = a.stories
    if (st.quantidade > 0) {
      blocos.push({ tipo: 'subsecao', titulo: 'Stories', nota: 'Saídas e avanços mostram onde a sequência perde a atenção.' })
      blocos.push({ tipo: 'kpis', itens: [
        { rotulo: 'Stories', valor: fmtNum(st.quantidade), detalhe: `${fmtNum(st.visualizacoesTotais)} visualizações` },
        { rotulo: 'Alcance médio', valor: fmtNum(st.alcanceMedio) },
        { rotulo: 'Respostas', valor: fmtNum(st.respostas), detalhe: `${fmtNum(st.compartilhamentos)} compartilhamentos` },
        { rotulo: 'Visitas ao perfil', valor: fmtNum(st.visitasPerfil), detalhe: `${fmtNum(st.seguidoresGerados)} seguidores gerados` },
        { rotulo: 'Avanços', valor: fmtNum(st.avancos), detalhe: 'pularam para o próximo' },
        { rotulo: 'Saídas', valor: fmtNum(st.saidas), detalhe: `${fmtPct(div(st.saidas, st.visualizacoesTotais))} das visualizações` },
        { rotulo: 'Voltaram', valor: fmtNum(st.retornos) },
        { rotulo: 'Foram ao próximo story', valor: fmtNum(st.proximoStory) },
      ] })
    }
  }

  // 8. Quando postar
  const diasSem = a.porDiaSemana.filter(d => d.quantidade > 0)
  const horas = a.porHora.filter(h => h.quantidade > 0).sort((x, y) => x.hora - y.hora)
  if (diasSem.length || horas.length) {
    blocos.push({ tipo: 'secao', titulo: 'Quando postar', nota: 'Desempenho médio das publicações por dia da semana e por horário de publicação (Brasília).' })
    if (diasSem.length) {
      const maxAlc = Math.max(...diasSem.map(d => d.alcanceMedio))
      blocos.push({
        tipo: 'tabela',
        colunas: [{ titulo: 'Dia', largura: 1.4 }, { titulo: 'Posts', largura: 0.8, alinhar: 'direita' }, { titulo: 'Alcance médio', largura: 1.2, alinhar: 'direita' }, { titulo: 'Interações médias', largura: 1.2, alinhar: 'direita' }, { titulo: 'Engajamento', largura: 1, alinhar: 'direita' }, { titulo: 'Seguidores gerados', largura: 1.1, alinhar: 'direita' }],
        linhas: diasSem.map(d => [{ texto: DIAS[d.dia], negrito: true }, fmtNum(d.quantidade), { texto: fmtNum(d.alcanceMedio), tom: d.alcanceMedio === maxAlc ? 'bom' : undefined, negrito: d.alcanceMedio === maxAlc }, fmtNum(d.interacoesMedias), fmtPct(d.taxaEngajamento), fmtNum(d.seguidoresGerados)]),
      })
    }
    if (horas.length) blocos.push({ tipo: 'grafico', titulo: 'Alcance médio por horário de publicação', itens: horas.map(h => ({ rotulo: `${h.hora}h`, valor: h.alcanceMedio })), formatar: v2 => fmtCompacto(v2), media: true })
    const blocosBons = [...a.heatmap].filter(h => h.quantidade > 0).sort((x, y) => y.alcanceMedio - x.alcanceMedio).slice(0, 6)
    if (blocosBons.length) {
      blocos.push({ tipo: 'subsecao', titulo: 'Melhores combinações de dia e horário' })
      blocos.push({
        tipo: 'tabela',
        colunas: [{ titulo: 'Dia e faixa', largura: 2.4 }, { titulo: 'Posts', largura: 0.8, alinhar: 'direita' }, { titulo: 'Alcance médio', largura: 1.2, alinhar: 'direita' }, { titulo: 'Engajamento', largura: 1, alinhar: 'direita' }],
        linhas: blocosBons.map(h => [{ texto: `${DIAS[h.dia]}, ${h.bloco * 3}h às ${h.bloco * 3 + 3}h`, negrito: true }, fmtNum(h.quantidade), fmtNum(h.alcanceMedio), fmtPct(h.taxaEngajamento)]),
      })
    }
    if (a.seguidoresOnline?.length) {
      const pico = a.seguidoresOnline.reduce((m, x, i) => (x > a.seguidoresOnline![m] ? i : m), 0)
      blocos.push({ tipo: 'grafico', titulo: 'Seguidores online por hora', nota: `pico às ${pico}h`, itens: a.seguidoresOnline.map((x, h) => ({ rotulo: `${h}h`, valor: x })), formatar: v2 => fmtCompacto(v2) })
    }
  }

  // 9. Hashtags e legendas
  if (a.hashtags.length || a.legendas.length) {
    blocos.push({ tipo: 'secao', titulo: 'Hashtags e legendas' })
    const hc = a.hashtagsComparativo
    blocos.push({ tipo: 'texto', texto: `Posts com hashtag: ${fmtNum(hc.com.quantidade)}, alcance médio ${fmtNum(hc.com.alcanceMedio)} e engajamento ${fmtPct(hc.com.taxaEngajamento)}. Sem hashtag: ${fmtNum(hc.sem.quantidade)}, alcance médio ${fmtNum(hc.sem.alcanceMedio)} e engajamento ${fmtPct(hc.sem.taxaEngajamento)}.` })
    if (a.hashtags.length) blocos.push({
      tipo: 'tabela',
      colunas: [{ titulo: 'Hashtag', largura: 2.2 }, { titulo: 'Posts', largura: 0.8, alinhar: 'direita' }, { titulo: 'Alcance médio', largura: 1.2, alinhar: 'direita' }, { titulo: 'Interações médias', largura: 1.2, alinhar: 'direita' }, { titulo: 'Engajamento', largura: 1, alinhar: 'direita' }],
      linhas: [...a.hashtags].sort((x, y) => y.alcanceMedio - x.alcanceMedio).slice(0, 15).map(h => [{ texto: `#${h.tag.replace(/^#/, '')}`, negrito: true }, fmtNum(h.quantidade), fmtNum(h.alcanceMedio), fmtNum(h.interacoesMedias), fmtPct(h.taxaEngajamento)]),
    })
    if (a.legendas.length) {
      blocos.push({ tipo: 'subsecao', titulo: 'Tamanho da legenda' })
      blocos.push({
        tipo: 'tabela',
        colunas: [{ titulo: 'Faixa', largura: 2 }, { titulo: 'Posts', largura: 0.8, alinhar: 'direita' }, { titulo: 'Alcance médio', largura: 1.2, alinhar: 'direita' }, { titulo: 'Engajamento', largura: 1, alinhar: 'direita' }, { titulo: 'Taxa de salvamento', largura: 1.2, alinhar: 'direita' }],
        linhas: a.legendas.map(l => [{ texto: l.faixa, negrito: true }, fmtNum(l.quantidade), fmtNum(l.alcanceMedio), fmtPct(l.taxaEngajamento), fmtPct(l.taxaSalvamento)]),
      })
    }
  }

  // 10. Audiência e alcance
  const demo = a.demografia
  const dist = a.distribuicaoAlcance
  if (demo?.seguidores || dist) {
    blocos.push({ tipo: 'secao', titulo: 'Audiência e de onde vem o alcance', nota: demo?.atualizadoEm ? `Dados do Instagram atualizados em ${new Date(demo.atualizadoEm).toLocaleDateString('pt-BR')}.` : undefined })
    const s = demo?.seguidores
    if (s) {
      const totalIdade = s.idade.reduce((x, i) => x + i.valor, 0)
      if (s.idade.length) { blocos.push({ tipo: 'subsecao', titulo: 'Idade dos seguidores' }); blocos.push({ tipo: 'barras', itens: [...s.idade].sort((x, y) => x.chave.localeCompare(y.chave)).map(i => ({ rotulo: i.chave, valor: i.valor, texto: `${fmtNum(i.valor)} · ${fmtPct(div(i.valor, totalIdade), 0)}` })) }) }
      const totalGen = s.genero.reduce((x, i) => x + i.valor, 0)
      if (s.genero.length) blocos.push({ tipo: 'texto', texto: `Gênero: ${s.genero.map(g => `${GENERO[g.chave] ?? g.chave} ${fmtPct(div(g.valor, totalGen), 0)}`).join(' · ')}.` })
      if (s.cidade.length) {
        const totalCid = s.cidade.reduce((x, i) => x + i.valor, 0)
        blocos.push({ tipo: 'subsecao', titulo: 'Cidades com mais seguidores' })
        blocos.push({ tipo: 'barras', itens: [...s.cidade].sort((x, y) => y.valor - x.valor).slice(0, 10).map(c2 => ({ rotulo: c2.chave, valor: c2.valor, texto: `${fmtNum(c2.valor)} · ${fmtPct(div(c2.valor, totalCid), 0)}` })) })
      }
    }
    if (dist) {
      const seg = dist.porTipoSeguidor.find(x => x.chave === 'FOLLOWER')?.valor ?? 0
      const nao = dist.porTipoSeguidor.find(x => x.chave === 'NON_FOLLOWER')?.valor ?? 0
      blocos.push({ tipo: 'subsecao', titulo: `Alcance dos últimos ${dist.periodoDias} dias` })
      blocos.push({ tipo: 'kpis', colunas: 3, itens: [
        { rotulo: 'Alcance total', valor: fmtCompacto(dist.alcanceTotal) },
        { rotulo: 'Seguidores', valor: fmtPct(div(seg, seg + nao), 0), detalhe: `${fmtNum(seg)} pessoas` },
        { rotulo: 'Não seguidores (descoberta)', valor: fmtPct(div(nao, seg + nao), 0), detalhe: `${fmtNum(nao)} pessoas` },
      ] })
      if (dist.porFormato.length) blocos.push({ tipo: 'barras', itens: [...dist.porFormato].sort((x, y) => y.valor - x.valor).map(x => ({ rotulo: TIPO_MIDIA[x.chave] ?? x.chave, valor: x.valor, texto: fmtNum(x.valor) })) })
    }
  }

  // 11. Consistência e pago × orgânico
  const cs = a.consistencia
  blocos.push({ tipo: 'secao', titulo: 'Constância de publicação', nota: `Meta: ${cs.metaDiasSemana} dias com post por semana.` })
  blocos.push({ tipo: 'kpis', itens: [
    { rotulo: 'Dias com post', valor: `${fmtNum(cs.diasComPost)} de ${fmtNum(cs.diasNoPeriodo)}`, detalhe: `meta do período: ${fmtNum(cs.metaDiasPeriodo)}` },
    { rotulo: 'Maior intervalo', valor: `${fmtNum(cs.maiorIntervalo)} dias`, detalhe: `máximo aceito: ${fmtNum(cs.maxDiasSemPost)}` },
    { rotulo: 'Sem postar até hoje', valor: cs.diasSemPostAteHoje == null ? '—' : `${fmtNum(cs.diasSemPostAteHoje)} dias` },
    { rotulo: 'Rajadas', valor: fmtNum(cs.rajadas), detalhe: cs.pico ? `pico: ${fmtNum(cs.pico.posts)} posts em ${ddmmPdf(cs.pico.data)}` : 'dias com posts demais' },
  ] })
  if (a.origem.temPago) blocos.push({ tipo: 'texto', texto: `Pago × orgânico: ${fmtNum(a.origem.postsImpulsionados)} publicações usadas em anúncios${a.origem.gastoImpulsionamento != null ? `, com ${a.origem.gastoImpulsionamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} investidos` : ''}${a.origem.fracaoAlcanceAnunciosConta != null ? `; ${fmtPct(a.origem.fracaoAlcanceAnunciosConta, 0)} do alcance da conta veio de anúncios` : ''}. Os números deste relatório são do recorte "${ORIGEM[a.origem.selecionada]}".` })

  // 12. Publicações
  const pubs = [...a.publicacoes].sort((x, y) => y.publicadoEm.localeCompare(x.publicadoEm))
  if (pubs.length) {
    blocos.push({ tipo: 'secao', titulo: 'Todas as publicações do período', nota: 'Impacto: desempenho do post contra a mediana da conta (alto/excepcional = acima do normal).' })
    const comInsights = pubs.filter(p => !p.semInsights)
    const top = [...comInsights].sort((x, y) => y.alcance - x.alcance).slice(0, 5)
    const piores = [...comInsights].filter(p => p.dia < hoje).sort((x, y) => x.alcance - y.alcance).slice(0, 5)
    blocos.push({ tipo: 'subsecao', titulo: '5 com mais alcance' })
    blocos.push(tabelaPosts(top))
    if (comInsights.length >= 8) { blocos.push({ tipo: 'subsecao', titulo: '5 com menos alcance' }); blocos.push(tabelaPosts(piores)) }
    blocos.push({ tipo: 'subsecao', titulo: `Todas (${pubs.length})` })
    blocos.push(tabelaPosts(pubs))
    if (a.postsSemInsights) blocos.push({ tipo: 'texto', texto: `${a.postsSemInsights} publicação(ões) ainda sem métricas do Instagram (publicadas há pouco).`, nota: true })
  }

  // 13. Recomendações
  blocos.push({ tipo: 'secao', titulo: 'Recomendações completas', nota: 'Leituras automáticas do período, com o nível de confiança de cada uma.' })
  blocos.push({ tipo: 'lista', itens: recs.map(r => ({ tag: RECOMENDACAO[r.tipo] ?? RECOMENDACAO.info, titulo: r.titulo, texto: `${r.detalhe} (${CONFIANCA[r.confianca] ?? r.confianca}${r.amostra ? `, ${r.amostra} posts` : ''}).` })), vazio: 'Sem recomendações para o período.' })

  // 14. Glossário
  blocos.push({ tipo: 'secao', titulo: 'Como ler os números' })
  blocos.push({
    tipo: 'tabela',
    colunas: [{ titulo: 'Termo', largura: 1.6 }, { titulo: 'O que significa', largura: 5 }],
    linhas: [
      ['Alcance', 'Pessoas diferentes que viram o conteúdo.'],
      ['Visualizações', 'Vezes que o conteúdo foi exibido (a mesma pessoa conta mais de uma vez).'],
      ['Interações', 'Curtidas, comentários, compartilhamentos, salvamentos e respostas.'],
      ['Taxa de engajamento', 'Interações divididas pelo alcance dos posts.'],
      ['Descoberta', 'Parte do alcance que veio de quem não segue o perfil: é como a conta cresce.'],
      ['Visitas ao perfil', 'Quem saiu do post para ver o perfil: sinal de interesse.'],
      ['Toques em links', 'Cliques nos links do perfil (WhatsApp, site).'],
      ['Impacto', 'Desempenho do post comparado com a mediana dos posts da conta.'],
      ['Lead orgânico', 'Pessoa cadastrada no CRM com o canal Orgânico (veio do Instagram sem anúncio).'],
    ],
  })

  const atualizado = a.conta.ultimaSincronizacaoEm ? new Date(a.conta.ultimaSincronizacaoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'sem sincronização'
  return {
    titulo: 'Relatório de Social Media',
    subtitulo: `Dia ${diaBR(hoje)} · período ${ddmmPdf(a.periodo.inicio)} a ${ddmmPdf(a.periodo.fim)}`,
    contexto: [`@${a.conta.nomeUsuario}`, `${fmtNum(a.conta.seguidores)} seguidores`, `Instagram até ${atualizado}`],
    blocos,
    arquivo: `social-media-${hoje}`,
  }
}

function tabelaPosts(posts: PostSocial[]): BlocoPdf {
  return {
    tipo: 'tabela',
    colunas: [{ titulo: 'Dia', largura: 0.95 }, { titulo: 'Formato', largura: 0.95 }, { titulo: 'Legenda', largura: 2.5 }, { titulo: 'Alcance', largura: 0.9, alinhar: 'direita' }, { titulo: 'Interações', largura: 0.95, alinhar: 'direita' }, { titulo: 'Engaj.', largura: 0.75, alinhar: 'direita' }, { titulo: 'Salv.', largura: 0.65, alinhar: 'direita' }, { titulo: 'Compart.', largura: 0.8, alinhar: 'direita' }, { titulo: 'Seguid.', largura: 0.7, alinhar: 'direita' }, { titulo: 'Impacto', largura: 1.2 }, { titulo: 'Leads', largura: 0.6, alinhar: 'direita' }],
    linhas: posts.map(p => {
      const imp: CelulaPdf = p.faixaImpacto ? { texto: IMPACTO[p.faixaImpacto]?.texto ?? p.faixaImpacto, tom: IMPACTO[p.faixaImpacto]?.tom } : '—'
      return [`${ddmmPdf(p.dia)} ${String(p.hora).padStart(2, '0')}h`, `${FORMATO[p.formato]}${p.impulsionado ? ' (pago)' : ''}`, legenda(p), p.semInsights ? '—' : fmtNum(p.alcance), p.semInsights ? '—' : fmtNum(p.interacoes), p.semInsights ? '—' : fmtPct(p.taxaEngajamento), fmtNum(p.salvamentos), fmtNum(p.compartilhamentos), fmtNum(p.seguidoresGerados), imp, p.leads == null ? '—' : fmtNum(p.leads)]
    }),
  }
}
