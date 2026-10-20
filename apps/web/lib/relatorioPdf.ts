// Relatório gerencial em PDF (Social Media, Tráfego e Assistente Comercial).
// Cada aba monta os blocos com os dados que já tem; aqui só se desenha:
// capa com sumário, resumo executivo, indicadores, tabelas comparativas,
// gráficos, listas e glossário, com rodapé e páginas. O jsPDF é importado
// sob demanda, só no clique.
import type { jsPDF as JsPDF } from 'jspdf'

export type Tom = 'bom' | 'ruim' | 'atencao' | 'neutro'
export interface KpiPdf { rotulo: string; valor: string; detalhe?: string; variacao?: { texto: string; tom: Tom } | null }
export interface ColunaPdf { titulo: string; largura: number; alinhar?: 'esquerda' | 'direita' }
export type CelulaPdf = string | { texto: string; tom?: Tom; negrito?: boolean }
export interface ItemListaPdf { tag?: { texto: string; tom: Tom }; titulo: string; texto?: string; detalhes?: string[] }
export interface DestaquePdf { tom: Tom; titulo?: string; texto: string }
export type BlocoPdf =
  /** Capítulo numerado (entra no sumário). */
  | { tipo: 'secao'; titulo: string; nota?: string }
  | { tipo: 'subsecao'; titulo: string; nota?: string }
  | { tipo: 'kpis'; itens: KpiPdf[]; colunas?: number }
  | { tipo: 'tabela'; colunas: ColunaPdf[]; linhas: CelulaPdf[][]; vazio?: string; total?: CelulaPdf[] }
  | { tipo: 'barras'; itens: Array<{ rotulo: string; valor: number; texto: string }> }
  /** Colunas verticais (série no tempo), com eixo e linha da média. */
  | { tipo: 'grafico'; titulo: string; itens: Array<{ rotulo: string; valor: number }>; formatar: (v: number) => string; media?: boolean; nota?: string }
  | { tipo: 'lista'; itens: ItemListaPdf[]; vazio?: string }
  /** Leituras do resumo executivo: um ponto colorido + texto. */
  | { tipo: 'destaques'; titulo?: string; itens: DestaquePdf[] }
  /** Pares rótulo: valor em duas colunas (configuração, premissas). */
  | { tipo: 'pares'; itens: Array<{ rotulo: string; valor: string }> }
  | { tipo: 'texto'; texto: string; nota?: boolean }
  | { tipo: 'quebra' }
export interface RelatorioPdf {
  /** Ex.: "Relatório de Tráfego". */
  titulo: string
  /** Ex.: "Dia 20/10/2026 · período analisado 14/10 a 20/10". */
  subtitulo: string
  /** Linhas curtas à direita da capa (conta, atualização...). */
  contexto?: string[]
  blocos: BlocoPdf[]
  /** Nome do arquivo sem extensão. */
  arquivo: string
}

// Marca (preto e prata titânio) + cores de status só onde há status.
const COR = {
  tinta: [11, 12, 16], tinta2: [64, 69, 78], muda: [118, 124, 134], linha: [222, 225, 230],
  fundo: [245, 246, 248], prata: [199, 203, 209], branco: [255, 255, 255], barra: [43, 47, 54], trilho: [233, 235, 239],
  bom: [22, 128, 72], ruim: [196, 40, 40], atencao: [176, 112, 8], neutro: [100, 106, 116],
} as const satisfies Record<string, readonly [number, number, number]>
const PAGINA = { largura: 595.28, altura: 841.89, margem: 40, topoCorpo: 58, limite: 841.89 - 46 }
const UTIL = PAGINA.largura - PAGINA.margem * 2

// As fontes padrão do PDF só têm o alfabeto latino: troca o resto por um equivalente.
const TROCAS: Array<[RegExp, string]> = [
  [/[→⟶➜]/g, '>'], [/←/g, '<'], [/≥/g, '>='], [/≤/g, '<='], [/…/g, '...'], [/[–—]/g, '-'],
  [/[“”]/g, '"'], [/[‘’]/g, "'"], [/[•▪●]/g, '-'], [/×/g, 'x'], [/ /g, ' '], [/[▲▼]/g, ''],
]
export function textoPdf(s: string | null | undefined): string {
  let t = String(s ?? '')
  for (const [de, para] of TROCAS) t = t.replace(de, para)
  return t.replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff]/g, '').replace(/[ \t]+/g, ' ').trim()
}

/** "+12% vs. anterior" com a cor certa (verde quando melhorou). */
export function variacaoPdf(atual: number | null | undefined, anterior: number | null | undefined, melhorQuando: 'MAIOR' | 'MENOR' = 'MAIOR', rotulo = 'vs. período anterior'): KpiPdf['variacao'] {
  if (atual == null || anterior == null || !Number.isFinite(atual) || !Number.isFinite(anterior) || anterior === 0) return null
  const v = (atual - anterior) / Math.abs(anterior)
  if (Math.abs(v) < 0.005) return { texto: `igual ${rotulo}`, tom: 'neutro' }
  const melhorou = melhorQuando === 'MAIOR' ? v > 0 : v < 0
  return { texto: `${v > 0 ? '+' : ''}${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: Math.abs(v) < 0.1 ? 1 : 0 })}% ${rotulo}`, tom: melhorou ? 'bom' : 'ruim' }
}

/** Linha de uma tabela comparativa (atual × anterior). */
export interface LinhaComparativa {
  indicador: string
  atual: number | null | undefined
  anterior: number | null | undefined
  formatar: (v: number | null | undefined) => string
  /** O que é melhor: subir, descer ou tanto faz (investimento). */
  melhor: 'MAIOR' | 'MENOR' | 'NEUTRO'
  /** Taxas (0 a 1): variação em pontos percentuais. */
  pontos?: boolean
  explicacao?: string
}
/** Variação e leitura de uma comparação (usado nas tabelas e no resumo executivo). */
export function compararValores(l: Pick<LinhaComparativa, 'atual' | 'anterior' | 'melhor' | 'pontos'>): { texto: string; leitura: 'Melhorou' | 'Piorou' | 'Estável' | 'Subiu' | 'Caiu' | '—'; tom: Tom; relativa: number | null } {
  const { atual, anterior } = l
  if (atual == null || anterior == null || !Number.isFinite(atual) || !Number.isFinite(anterior)) return { texto: '—', leitura: '—', tom: 'neutro', relativa: null }
  if (l.pontos) {
    const d = (atual - anterior) * 100
    if (Math.abs(d) < 0.05) return { texto: '0 p.p.', leitura: 'Estável', tom: 'neutro', relativa: 0 }
    const sobe = d > 0
    const tom: Tom = l.melhor === 'NEUTRO' ? 'neutro' : (sobe === (l.melhor === 'MAIOR')) ? 'bom' : 'ruim'
    return { texto: `${sobe ? '+' : ''}${d.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} p.p.`, leitura: l.melhor === 'NEUTRO' ? (sobe ? 'Subiu' : 'Caiu') : tom === 'bom' ? 'Melhorou' : 'Piorou', tom, relativa: anterior ? (atual - anterior) / Math.abs(anterior) : null }
  }
  if (anterior === 0) return atual === 0 ? { texto: '0%', leitura: 'Estável', tom: 'neutro', relativa: 0 } : { texto: 'novo', leitura: l.melhor === 'NEUTRO' ? 'Subiu' : l.melhor === 'MAIOR' ? 'Melhorou' : 'Piorou', tom: l.melhor === 'NEUTRO' ? 'neutro' : l.melhor === 'MAIOR' ? 'bom' : 'ruim', relativa: null }
  const v = (atual - anterior) / Math.abs(anterior)
  if (Math.abs(v) < 0.005) return { texto: '0%', leitura: 'Estável', tom: 'neutro', relativa: 0 }
  const sobe = v > 0
  const tom: Tom = l.melhor === 'NEUTRO' ? 'neutro' : (sobe === (l.melhor === 'MAIOR')) ? 'bom' : 'ruim'
  return { texto: `${sobe ? '+' : ''}${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: Math.abs(v) < 0.1 ? 1 : 0 })}%`, leitura: l.melhor === 'NEUTRO' ? (sobe ? 'Subiu' : 'Caiu') : tom === 'bom' ? 'Melhorou' : 'Piorou', tom, relativa: v }
}
/** Tabela "Indicador | Atual | Anterior | Variação | Leitura", com a cor da leitura. */
export function tabelaComparativa(linhas: LinhaComparativa[], rotulos: { atual?: string; anterior?: string } = {}): BlocoPdf {
  const comExplicacao = linhas.some(l => l.explicacao)
  return {
    tipo: 'tabela',
    colunas: [
      { titulo: 'Indicador', largura: comExplicacao ? 2.2 : 3 },
      { titulo: rotulos.atual ?? 'Atual', largura: 1.3, alinhar: 'direita' },
      { titulo: rotulos.anterior ?? 'Anterior', largura: 1.3, alinhar: 'direita' },
      { titulo: 'Variação', largura: 1.1, alinhar: 'direita' },
      { titulo: 'Leitura', largura: 1 },
      ...(comExplicacao ? [{ titulo: 'O que mostra', largura: 3 }] : []),
    ],
    linhas: linhas.map(l => {
      const c = compararValores(l)
      return [
        { texto: l.indicador, negrito: true }, l.formatar(l.atual), l.formatar(l.anterior),
        { texto: c.texto, tom: c.tom }, { texto: c.leitura, tom: c.tom, negrito: c.tom !== 'neutro' },
        ...(comExplicacao ? [l.explicacao ?? ''] : []),
      ]
    }),
  }
}

export const hojeBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10)
export const diaBR = (aaaammdd: string) => `${aaaammdd.slice(8, 10)}/${aaaammdd.slice(5, 7)}/${aaaammdd.slice(0, 4)}`
export const ddmmPdf = (aaaammdd: string) => `${aaaammdd.slice(8, 10)}/${aaaammdd.slice(5, 7)}`
const DIAS_SEMANA_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
/** "seg 14/10" */
export const diaSemanaPdf = (aaaammdd: string) => `${DIAS_SEMANA_CURTO[new Date(`${aaaammdd}T12:00:00Z`).getUTCDay()]} ${ddmmPdf(aaaammdd)}`

export async function baixarRelatorioPdf(r: RelatorioPdf): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  desenhar(doc, r)
  doc.save(`${r.arquivo}.pdf`)
}

/** Monta o documento (separado do download para os testes). */
export function desenhar(doc: JsPDF, r: RelatorioPdf): void {
  const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const cor = (c: readonly number[]) => doc.setTextColor(c[0], c[1], c[2])
  const preenche = (c: readonly number[]) => doc.setFillColor(c[0], c[1], c[2])
  const contorno = (c: readonly number[]) => doc.setDrawColor(c[0], c[1], c[2])
  const fonte = (tam: number, negrito = false) => { doc.setFont('helvetica', negrito ? 'bold' : 'normal'); doc.setFontSize(tam) }
  const linhas = (t: string, largura: number) => doc.splitTextToSize(textoPdf(t), largura) as string[]
  let y = 0

  // Capa (faixa escura no topo da primeira página).
  const contexto = (r.contexto ?? []).map(textoPdf).filter(Boolean)
  const alturaCapa = Math.max(118, 56 + contexto.length * 12)
  preenche(COR.tinta); doc.rect(0, 0, PAGINA.largura, alturaCapa, 'F')
  fonte(8, true); cor(COR.prata); doc.text('ARIES  ·  RELATÓRIO GERENCIAL', PAGINA.margem, 34, { charSpace: 1.2 })
  fonte(21, true); cor(COR.branco)
  const tituloLinhas = linhas(r.titulo, UTIL * 0.6)
  doc.text(tituloLinhas, PAGINA.margem, 60)
  fonte(10); cor(COR.prata)
  doc.text(linhas(r.subtitulo, UTIL * 0.6), PAGINA.margem, 60 + tituloLinhas.length * 22)
  fonte(8.5); cor(COR.prata)
  contexto.forEach((c, i) => doc.text(c, PAGINA.largura - PAGINA.margem, 36 + i * 12, { align: 'right', maxWidth: UTIL * 0.38 }))
  y = alturaCapa + 22

  // Sumário: espaço reservado na capa, preenchido no fim (com as páginas).
  const capitulos = r.blocos.filter((b): b is Extract<BlocoPdf, { tipo: 'secao' }> => b.tipo === 'secao').map(b => b.titulo)
  const paginaDoCapitulo: number[] = []
  const linhasSumario = Math.ceil(capitulos.length / 2)
  const ySumario = y
  if (capitulos.length > 2) y += 30 + linhasSumario * 14 + 14

  function novaPagina() {
    doc.addPage()
    fonte(8, true); cor(COR.tinta2); doc.text(textoPdf(r.titulo), PAGINA.margem, 30)
    fonte(8); cor(COR.muda); doc.text(textoPdf(r.subtitulo), PAGINA.largura - PAGINA.margem, 30, { align: 'right', maxWidth: UTIL * 0.6 })
    contorno(COR.linha); doc.setLineWidth(0.6); doc.line(PAGINA.margem, 38, PAGINA.largura - PAGINA.margem, 38)
    y = PAGINA.topoCorpo
  }
  const cabe = (altura: number) => { if (y + altura > PAGINA.limite) novaPagina() }

  let numeroCapitulo = 0
  function secao(titulo: string, nota?: string) {
    fonte(8.5)
    const notaLinhas = nota ? linhas(nota, UTIL) : []
    cabe(30 + notaLinhas.length * 11 + 90) // título nunca fica sozinho no pé da página
    if (y > PAGINA.topoCorpo + 4) y += 10
    numeroCapitulo++
    paginaDoCapitulo.push(doc.getNumberOfPages())
    preenche(COR.tinta); doc.rect(PAGINA.margem, y - 10, 3, 15, 'F')
    fonte(13, true); cor(COR.tinta); doc.text(textoPdf(`${numeroCapitulo}. ${titulo}`), PAGINA.margem + 10, y + 1.5)
    y += 15
    if (notaLinhas.length) { fonte(8.5); cor(COR.muda); doc.text(notaLinhas, PAGINA.margem, y + 2); y += notaLinhas.length * 11 }
    y += 9
  }

  function subsecao(titulo: string, nota?: string) {
    fonte(8.5)
    const notaLinhas = nota ? linhas(nota, UTIL) : []
    cabe(18 + notaLinhas.length * 11 + 120) // subtítulo não fica sozinho no pé da página
    fonte(10.5, true); cor(COR.tinta); doc.text(textoPdf(titulo), PAGINA.margem, y + 6)
    y += 12
    if (notaLinhas.length) { fonte(8.5); cor(COR.muda); doc.text(notaLinhas, PAGINA.margem, y + 4); y += notaLinhas.length * 11 }
    y += 6
  }

  function kpis(itens: KpiPdf[], colunas = 4) {
    if (!itens.length) return
    const gap = 8
    const largura = (UTIL - gap * (colunas - 1)) / colunas
    for (let i = 0; i < itens.length; i += colunas) {
      const linha = itens.slice(i, i + colunas).map(k => {
        fonte(7.5, true); const rot = linhas(k.rotulo.toUpperCase(), largura - 18).slice(0, 2)
        fonte(14, true); const val = linhas(k.valor, largura - 18).slice(0, 2)
        fonte(7.8); const det = k.detalhe ? linhas(k.detalhe, largura - 18).slice(0, 3) : []
        const vari = k.variacao ? linhas(k.variacao.texto, largura - 18).slice(0, 2) : []
        return { k, rot, val, det, vari, altura: 14 + rot.length * 9 + val.length * 16 + (det.length + vari.length) * 9.5 + 8 }
      })
      const altura = Math.max(...linha.map(l => l.altura))
      cabe(altura + gap)
      linha.forEach((l, j) => {
        const x = PAGINA.margem + j * (largura + gap)
        preenche(COR.fundo); contorno(COR.linha); doc.setLineWidth(0.5); doc.roundedRect(x, y, largura, altura, 5, 5, 'FD')
        let yy = y + 15
        fonte(7.5, true); cor(COR.muda); doc.text(l.rot, x + 9, yy, { charSpace: 0.3 }); yy += l.rot.length * 9 + 8
        fonte(14, true); cor(COR.tinta); doc.text(l.val, x + 9, yy); yy += l.val.length * 16 - 4
        if (l.det.length) { fonte(7.8); cor(COR.tinta2); doc.text(l.det, x + 9, yy); yy += l.det.length * 9.5 }
        if (l.vari.length) { fonte(7.8, true); cor(COR[l.k.variacao!.tom]); doc.text(l.vari, x + 9, yy) }
      })
      y += altura + gap
    }
    y += 4
  }

  const celula = (c: CelulaPdf) => (typeof c === 'string' ? { texto: c, tom: undefined as Tom | undefined, negrito: false } : { texto: c.texto, tom: c.tom, negrito: !!c.negrito })
  function tabela(colunas: ColunaPdf[], dados: CelulaPdf[][], vazio?: string, total?: CelulaPdf[]) {
    if (!dados.length) { if (vazio) texto(vazio, true); return }
    const soma = colunas.reduce((s, c) => s + c.largura, 0)
    const larguras = colunas.map(c => (c.largura / soma) * UTIL)
    const pad = 5
    // Cabeçalho: diminui a fonte até a palavra mais longa caber na coluna (sem quebrar no meio).
    const tamCab = colunas.map((c, i) => {
      let tam = 7.6
      const maior = textoPdf(c.titulo).split(/\s+/).sort((a, b) => b.length - a.length)[0] ?? ''
      while (tam > 6) { fonte(tam, true); if (doc.getTextWidth(maior) <= larguras[i] - pad * 2) break; tam -= 0.3 }
      return tam
    })
    const cabecalho = () => {
      const cab = colunas.map((c, i) => { fonte(tamCab[i], true); return linhas(c.titulo, larguras[i] - pad * 2) })
      const h = Math.max(...cab.map(l => l.length)) * 9 + 9
      preenche(COR.tinta); doc.rect(PAGINA.margem, y, UTIL, h, 'F')
      cor(COR.branco)
      let x = PAGINA.margem
      cab.forEach((l, i) => {
        const direita = colunas[i].alinhar === 'direita'
        fonte(tamCab[i], true)
        doc.text(l, direita ? x + larguras[i] - pad : x + pad, y + 12, { align: direita ? 'right' : 'left' })
        x += larguras[i]
      })
      y += h
    }
    const todas = total ? [...dados, total] : dados
    const preparadas = todas.map(linha => linha.map((v, i) => {
      const c = celula(v ?? '')
      fonte(8, c.negrito)
      return { ...c, linhas: linhas(c.texto, larguras[i] - pad * 2).slice(0, 4) }
    }))
    const alturas = preparadas.map(cel => Math.max(...cel.map(l => l.linhas.length)) * 10 + 8)
    // Tabela curta não é partida entre páginas.
    const alturaTabela = alturas.reduce((s, h) => s + h, 0) + 24
    cabe(alturaTabela <= 320 ? alturaTabela : 60); cabecalho()
    preparadas.forEach((cel, n) => {
      const h = alturas[n]
      const ehTotal = !!total && n === preparadas.length - 1
      if (y + h > PAGINA.limite) { novaPagina(); cabecalho() }
      if (ehTotal) { contorno(COR.tinta); doc.setLineWidth(0.8); doc.line(PAGINA.margem, y, PAGINA.margem + UTIL, y) }
      else if (n % 2 === 1) { preenche(COR.fundo); doc.rect(PAGINA.margem, y, UTIL, h, 'F') }
      let x = PAGINA.margem
      cel.forEach((c, i) => {
        fonte(8, c.negrito || ehTotal); cor(c.tom ? COR[c.tom] : COR.tinta)
        const direita = colunas[i].alinhar === 'direita'
        doc.text(c.linhas, direita ? x + larguras[i] - pad : x + pad, y + 11.5, { align: direita ? 'right' : 'left' })
        x += larguras[i]
      })
      y += h
    })
    contorno(COR.linha); doc.setLineWidth(0.6); doc.line(PAGINA.margem, y, PAGINA.margem + UTIL, y)
    y += 14
  }

  function barras(itens: Array<{ rotulo: string; valor: number; texto: string }>) {
    const max = Math.max(0, ...itens.map(i => i.valor))
    const larguraRotulo = UTIL * 0.3, larguraValor = UTIL * 0.22
    const larguraBarra = UTIL - larguraRotulo - larguraValor - 16
    itens.forEach(i => {
      cabe(20)
      fonte(8.5); cor(COR.tinta2); doc.text(linhas(i.rotulo, larguraRotulo - 6)[0] ?? '', PAGINA.margem, y + 9)
      const x = PAGINA.margem + larguraRotulo
      preenche(COR.trilho); doc.roundedRect(x, y + 1, larguraBarra, 11, 2, 2, 'F')
      const w = max > 0 ? Math.max(2, (i.valor / max) * larguraBarra) : 0
      if (w > 0) { preenche(COR.barra); doc.roundedRect(x, y + 1, w, 11, 2, 2, 'F') }
      fonte(8.5, true); cor(COR.tinta); doc.text(linhas(i.texto, larguraValor)[0] ?? '', PAGINA.largura - PAGINA.margem, y + 9, { align: 'right' })
      y += 18
    })
    y += 6
  }

  // Colunas verticais: uma cor só (é uma série), rótulo do maior e do último
  // valor, eixo com 0, meio e topo, e a média tracejada.
  function grafico(titulo: string, itens: Array<{ rotulo: string; valor: number }>, formatar: (v: number) => string, comMedia = false, nota?: string) {
    if (!itens.length) return
    if (!itens.some(i => i.valor > 0)) { texto(`${titulo}: nenhum registro no período.`, true); return }
    const altura = 128
    cabe(altura + 56)
    fonte(9.5, true); cor(COR.tinta); doc.text(textoPdf(titulo), PAGINA.margem, y + 8)
    if (nota) { fonte(7.8); cor(COR.muda); doc.text(textoPdf(nota), PAGINA.largura - PAGINA.margem, y + 8, { align: 'right', maxWidth: UTIL * 0.55 }) }
    y += 18
    const eixoX = PAGINA.margem + 46, largura = UTIL - 46
    const topo = y + 6, base = y + altura
    const max = Math.max(...itens.map(i => i.valor), 0) || 1
    // grade
    fonte(7); cor(COR.muda)
    for (const f of [0, 0.5, 1]) {
      const yy = base - (base - topo) * f
      contorno(COR.linha); doc.setLineWidth(f === 0 ? 0.8 : 0.4); doc.line(eixoX, yy, eixoX + largura, yy)
      doc.text(textoPdf(formatar(max * f)), eixoX - 5, yy + 2.5, { align: 'right' })
    }
    const passo = largura / itens.length
    const larguraBarra = Math.max(1.5, Math.min(22, passo - 2))
    const iMax = itens.reduce((m, it, i) => (it.valor > itens[m].valor ? i : m), 0)
    itens.forEach((it, i) => {
      const h = Math.max(0, (it.valor / max) * (base - topo))
      const x = eixoX + i * passo + (passo - larguraBarra) / 2
      if (h > 0) { preenche(COR.barra); doc.rect(x, base - h, larguraBarra, h, 'F') }
      if ((i === iMax || i === itens.length - 1) && it.valor > 0) {
        fonte(7, true); cor(COR.tinta); doc.text(textoPdf(formatar(it.valor)), x + larguraBarra / 2, base - h - 3, { align: 'center' })
      }
    })
    // rótulos do eixo X: no máximo ~12
    const cada = Math.max(1, Math.ceil(itens.length / 12))
    fonte(6.8); cor(COR.muda)
    itens.forEach((it, i) => { if (i % cada === 0 || i === itens.length - 1) doc.text(textoPdf(it.rotulo), eixoX + i * passo + passo / 2, base + 10, { align: 'center' }) })
    if (comMedia) {
      const media = itens.reduce((s, it) => s + it.valor, 0) / itens.length
      const yy = base - (media / max) * (base - topo)
      contorno(COR.atencao); doc.setLineWidth(0.8); doc.setLineDashPattern([3, 2], 0)
      doc.line(eixoX, yy, eixoX + largura, yy); doc.setLineDashPattern([], 0)
      fonte(7, true); cor(COR.atencao)
      const rotuloMedia = textoPdf(`média ${formatar(media)}`)
      preenche(COR.branco); doc.rect(eixoX + 2, yy - 10, doc.getTextWidth(rotuloMedia) + 6, 9, 'F')
      doc.text(rotuloMedia, eixoX + 5, yy - 3)
    }
    y = base + 24
  }

  const RECUO = 88 // espaço da etiqueta à esquerda de cada item da lista
  function lista(itens: ItemListaPdf[], vazio?: string) {
    if (!itens.length) { if (vazio) texto(vazio, true); return }
    itens.forEach(it => {
      fonte(9.5, true); const tit = linhas(it.titulo, UTIL - RECUO)
      fonte(8.6); const corpo = it.texto ? linhas(it.texto, UTIL - RECUO) : []
      const extras = (it.detalhes ?? []).flatMap(dt => linhas(`- ${dt}`, UTIL - RECUO - 8))
      const h = tit.length * 12 + corpo.length * 11 + extras.length * 10.5 + 10
      cabe(Math.min(h, 300))
      if (it.tag) {
        fonte(7, true); const t = textoPdf(it.tag.texto).toUpperCase()
        const w = Math.min(RECUO - 8, doc.getTextWidth(t) + 12)
        const c = COR[it.tag.tom]
        doc.setFillColor(c[0], c[1], c[2]); doc.roundedRect(PAGINA.margem, y - 1, w, 13, 3, 3, 'F')
        cor(COR.branco); doc.text(t, PAGINA.margem + w / 2, y + 8.3, { align: 'center' })
      }
      fonte(9.5, true); cor(COR.tinta); doc.text(tit, PAGINA.margem + RECUO, y + 9)
      let yy = y + 9 + tit.length * 12
      if (corpo.length) { fonte(8.6); cor(COR.tinta2); doc.text(corpo, PAGINA.margem + RECUO, yy); yy += corpo.length * 11 }
      if (extras.length) { fonte(8.2); cor(COR.tinta2); doc.text(extras, PAGINA.margem + RECUO + 8, yy); yy += extras.length * 10.5 }
      y += h
      contorno(COR.linha); doc.setLineWidth(0.4); doc.line(PAGINA.margem + RECUO, y - 4, PAGINA.margem + UTIL, y - 4)
      y += 4
    })
    y += 4
  }

  function destaques(titulo: string | undefined, itens: DestaquePdf[]) {
    if (!itens.length) return
    if (titulo) { cabe(40); fonte(10, true); cor(COR.tinta); doc.text(textoPdf(titulo), PAGINA.margem, y + 6); y += 16 }
    itens.forEach(it => {
      const largura = UTIL - 24
      fonte(9, true); const t = it.titulo ? linhas(it.titulo, largura) : []
      fonte(9); const corpo = linhas(it.texto, largura)
      const h = t.length * 11.5 + corpo.length * 11.5 + 12
      cabe(h)
      preenche(COR.fundo); doc.rect(PAGINA.margem, y, UTIL, h - 4, 'F')
      const c = COR[it.tom]; doc.setFillColor(c[0], c[1], c[2]); doc.rect(PAGINA.margem, y, 3, h - 4, 'F')
      doc.circle(PAGINA.margem + 13, y + 9.5, 2.6, 'F')
      let yy = y + 12
      if (t.length) { fonte(9, true); cor(COR.tinta); doc.text(t, PAGINA.margem + 22, yy); yy += t.length * 11.5 }
      fonte(9); cor(COR.tinta2); doc.text(corpo, PAGINA.margem + 22, yy)
      y += h
    })
    y += 8
  }

  function pares(itens: Array<{ rotulo: string; valor: string }>) {
    const largura = (UTIL - 16) / 2
    for (let i = 0; i < itens.length; i += 2) {
      const par = itens.slice(i, i + 2).map(p => {
        fonte(7.4, true); const r2 = linhas(p.rotulo.toUpperCase(), largura)
        fonte(9); const v = linhas(p.valor, largura)
        return { r2, v, h: r2.length * 9 + v.length * 11 + 10 }
      })
      const h = Math.max(...par.map(p => p.h))
      cabe(h)
      par.forEach((p, j) => {
        const x = PAGINA.margem + j * (largura + 16)
        fonte(7.4, true); cor(COR.muda); doc.text(p.r2, x, y + 8, { charSpace: 0.3 })
        fonte(9); cor(COR.tinta); doc.text(p.v, x, y + 8 + p.r2.length * 9 + 2)
      })
      y += h
      contorno(COR.linha); doc.setLineWidth(0.3); doc.line(PAGINA.margem, y - 3, PAGINA.margem + UTIL, y - 3)
      y += 3
    }
    y += 8
  }

  function texto(t: string, nota = false) {
    fonte(nota ? 8.5 : 9.5); cor(nota ? COR.muda : COR.tinta2)
    const l = linhas(t, UTIL)
    l.forEach(linha => { cabe(12); doc.text(linha, PAGINA.margem, y + 8); y += nota ? 11 : 12.5 })
    y += 8
  }

  for (const b of r.blocos) {
    if (b.tipo === 'secao') secao(b.titulo, b.nota)
    else if (b.tipo === 'subsecao') subsecao(b.titulo, b.nota)
    else if (b.tipo === 'kpis') kpis(b.itens, b.colunas)
    else if (b.tipo === 'tabela') tabela(b.colunas, b.linhas, b.vazio, b.total)
    else if (b.tipo === 'barras') barras(b.itens)
    else if (b.tipo === 'grafico') grafico(b.titulo, b.itens, b.formatar, b.media, b.nota)
    else if (b.tipo === 'lista') lista(b.itens, b.vazio)
    else if (b.tipo === 'destaques') destaques(b.titulo, b.itens)
    else if (b.tipo === 'pares') pares(b.itens)
    else if (b.tipo === 'quebra') novaPagina()
    else texto(b.texto, b.nota)
  }

  // Sumário na capa (agora que as páginas são conhecidas).
  if (capitulos.length > 2) {
    doc.setPage(1)
    let yy = ySumario
    fonte(8, true); cor(COR.muda); doc.text('NESTE RELATÓRIO', PAGINA.margem, yy + 8, { charSpace: 1 })
    yy += 18
    const colLarg = (UTIL - 20) / 2
    capitulos.forEach((cap, i) => {
      const col = i < linhasSumario ? 0 : 1
      const lin = col === 0 ? i : i - linhasSumario
      const x = PAGINA.margem + col * (colLarg + 20), yl = yy + lin * 14 + 8
      fonte(8.8); cor(COR.tinta)
      const nome = linhas(`${i + 1}. ${cap}`, colLarg - 30)[0] ?? ''
      doc.text(nome, x, yl)
      fonte(8.8, true); cor(COR.tinta2); doc.text(String(paginaDoCapitulo[i] ?? ''), x + colLarg, yl, { align: 'right' })
      contorno(COR.linha); doc.setLineWidth(0.3); doc.line(x, yl + 4, x + colLarg, yl + 4)
    })
  }

  // Rodapé de todas as páginas.
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    contorno(COR.linha); doc.setLineWidth(0.6); doc.line(PAGINA.margem, PAGINA.altura - 32, PAGINA.largura - PAGINA.margem, PAGINA.altura - 32)
    fonte(7.5); cor(COR.muda)
    doc.text(textoPdf(`ARIES · ${r.titulo} · gerado em ${geradoEm}`), PAGINA.margem, PAGINA.altura - 20)
    doc.text(`Página ${p} de ${total}`, PAGINA.largura - PAGINA.margem, PAGINA.altura - 20, { align: 'right' })
  }
}
