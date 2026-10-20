// Relatório em PDF para apresentar à equipe (Social Media, Tráfego e
// Assistente Comercial). Cada aba monta os blocos com os dados que já
// carregou; aqui só se desenha: capa, indicadores, tabelas, barras, listas e
// rodapé com páginas. O jsPDF é importado sob demanda, só no clique.
import type { jsPDF as JsPDF } from 'jspdf'

export type Tom = 'bom' | 'ruim' | 'atencao' | 'neutro'
export interface KpiPdf { rotulo: string; valor: string; detalhe?: string; variacao?: { texto: string; tom: Tom } | null }
export interface ColunaPdf { titulo: string; largura: number; alinhar?: 'esquerda' | 'direita' }
export interface ItemListaPdf { tag?: { texto: string; tom: Tom }; titulo: string; texto?: string }
export type BlocoPdf =
  | { tipo: 'secao'; titulo: string; nota?: string }
  | { tipo: 'subsecao'; titulo: string; nota?: string }
  | { tipo: 'kpis'; itens: KpiPdf[]; colunas?: number }
  | { tipo: 'tabela'; colunas: ColunaPdf[]; linhas: string[][]; vazio?: string }
  | { tipo: 'barras'; itens: Array<{ rotulo: string; valor: number; texto: string }> }
  | { tipo: 'lista'; itens: ItemListaPdf[]; vazio?: string }
  | { tipo: 'texto'; texto: string; nota?: boolean }
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
  [/[“”]/g, '"'], [/[‘’]/g, "'"], [/[•▪●]/g, '-'], [/×/g, 'x'], [/ /g, ' '],
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

export const hojeBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10)
export const diaBR = (aaaammdd: string) => `${aaaammdd.slice(8, 10)}/${aaaammdd.slice(5, 7)}/${aaaammdd.slice(0, 4)}`
export const ddmmPdf = (aaaammdd: string) => `${aaaammdd.slice(8, 10)}/${aaaammdd.slice(5, 7)}`

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
  const alturaCapa = Math.max(112, 52 + contexto.length * 12)
  preenche(COR.tinta); doc.rect(0, 0, PAGINA.largura, alturaCapa, 'F')
  fonte(8, true); cor(COR.prata); doc.text('ARIES  ·  RELATÓRIO DO DIA', PAGINA.margem, 34, { charSpace: 1.2 })
  fonte(21, true); cor(COR.branco)
  const tituloLinhas = linhas(r.titulo, UTIL * 0.6)
  doc.text(tituloLinhas, PAGINA.margem, 60)
  fonte(10); cor(COR.prata)
  doc.text(linhas(r.subtitulo, UTIL * 0.6), PAGINA.margem, 60 + tituloLinhas.length * 22)
  fonte(8.5); cor(COR.prata)
  contexto.forEach((c, i) => doc.text(c, PAGINA.largura - PAGINA.margem, 36 + i * 12, { align: 'right', maxWidth: UTIL * 0.38 }))
  y = alturaCapa + 26

  function novaPagina() {
    doc.addPage()
    fonte(8, true); cor(COR.tinta2); doc.text(textoPdf(r.titulo), PAGINA.margem, 30)
    fonte(8); cor(COR.muda); doc.text(textoPdf(r.subtitulo), PAGINA.largura - PAGINA.margem, 30, { align: 'right', maxWidth: UTIL * 0.6 })
    contorno(COR.linha); doc.setLineWidth(0.6); doc.line(PAGINA.margem, 38, PAGINA.largura - PAGINA.margem, 38)
    y = PAGINA.topoCorpo
  }
  const cabe = (altura: number) => { if (y + altura > PAGINA.limite) novaPagina() }

  function secao(titulo: string, nota?: string) {
    fonte(8.5)
    const notaLinhas = nota ? linhas(nota, UTIL) : []
    cabe(30 + notaLinhas.length * 11 + 90) // título nunca fica sozinho no pé da página
    if (y > PAGINA.topoCorpo + 4) y += 8
    preenche(COR.tinta); doc.rect(PAGINA.margem, y - 10, 3, 14, 'F')
    fonte(12.5, true); cor(COR.tinta); doc.text(textoPdf(titulo), PAGINA.margem + 10, y + 1)
    y += 14
    if (notaLinhas.length) { fonte(8.5); cor(COR.muda); doc.text(notaLinhas, PAGINA.margem, y + 2); y += notaLinhas.length * 11 }
    y += 8
  }

  function subsecao(titulo: string, nota?: string) {
    fonte(8.5)
    const notaLinhas = nota ? linhas(nota, UTIL) : []
    cabe(18 + notaLinhas.length * 11 + 70)
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
        fonte(7.8); const det = k.detalhe ? linhas(k.detalhe, largura - 18).slice(0, 2) : []
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

  function tabela(colunas: ColunaPdf[], dados: string[][], vazio?: string) {
    if (!dados.length) { if (vazio) texto(vazio, true); return }
    const total = colunas.reduce((s, c) => s + c.largura, 0)
    const larguras = colunas.map(c => (c.largura / total) * UTIL)
    const pad = 5
    const cabecalho = () => {
      fonte(7.6, true)
      const cab = colunas.map((c, i) => linhas(c.titulo, larguras[i] - pad * 2))
      const h = Math.max(...cab.map(l => l.length)) * 9 + 9
      preenche(COR.tinta); doc.rect(PAGINA.margem, y, UTIL, h, 'F')
      cor(COR.branco)
      let x = PAGINA.margem
      cab.forEach((l, i) => {
        const direita = colunas[i].alinhar === 'direita'
        doc.text(l, direita ? x + larguras[i] - pad : x + pad, y + 12, { align: direita ? 'right' : 'left' })
        x += larguras[i]
      })
      y += h
    }
    fonte(8)
    const celulas = dados.map(linha => linha.map((v, i) => linhas(v ?? '', larguras[i] - pad * 2).slice(0, 3)))
    const alturas = celulas.map(cel => Math.max(...cel.map(l => l.length)) * 10 + 8)
    // Tabela curta não é partida entre páginas.
    const alturaTabela = alturas.reduce((s, h) => s + h, 0) + 24
    cabe(alturaTabela <= 320 ? alturaTabela : 60); cabecalho()
    celulas.forEach((cel, n) => {
      const h = alturas[n]
      if (y + h > PAGINA.limite) { novaPagina(); cabecalho() }
      fonte(8)
      if (n % 2 === 1) { preenche(COR.fundo); doc.rect(PAGINA.margem, y, UTIL, h, 'F') }
      cor(COR.tinta)
      let x = PAGINA.margem
      cel.forEach((l, i) => {
        const direita = colunas[i].alinhar === 'direita'
        doc.text(l, direita ? x + larguras[i] - pad : x + pad, y + 11.5, { align: direita ? 'right' : 'left' })
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

  const RECUO = 88 // espaço da etiqueta à esquerda de cada item da lista
  function lista(itens: ItemListaPdf[], vazio?: string) {
    if (!itens.length) { if (vazio) texto(vazio, true); return }
    itens.forEach(it => {
      fonte(9.5, true); const tit = linhas(it.titulo, UTIL - RECUO)
      fonte(8.6); const corpo = it.texto ? linhas(it.texto, UTIL - RECUO) : []
      const h = tit.length * 12 + corpo.length * 11 + 10
      cabe(h)
      if (it.tag) {
        fonte(7, true); const t = textoPdf(it.tag.texto).toUpperCase()
        const w = Math.min(RECUO - 8, doc.getTextWidth(t) + 12)
        const c = COR[it.tag.tom]
        doc.setFillColor(c[0], c[1], c[2]); doc.roundedRect(PAGINA.margem, y - 1, w, 13, 3, 3, 'F')
        cor(COR.branco); doc.text(t, PAGINA.margem + w / 2, y + 8.3, { align: 'center' })
      }
      fonte(9.5, true); cor(COR.tinta); doc.text(tit, PAGINA.margem + RECUO, y + 9)
      if (corpo.length) { fonte(8.6); cor(COR.tinta2); doc.text(corpo, PAGINA.margem + RECUO, y + 9 + tit.length * 12) }
      y += h
      contorno(COR.linha); doc.setLineWidth(0.4); doc.line(PAGINA.margem + RECUO, y - 4, PAGINA.margem + UTIL, y - 4)
      y += 4
    })
    y += 4
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
    else if (b.tipo === 'tabela') tabela(b.colunas, b.linhas, b.vazio)
    else if (b.tipo === 'barras') barras(b.itens)
    else if (b.tipo === 'lista') lista(b.itens, b.vazio)
    else texto(b.texto, b.nota)
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
