// Página → documento visual, sem IA: lê a estrutura do texto (títulos,
// itens numerados com descrição, tabelas coladas, "Rótulo: texto", cadeias
// com →, cartões A/B/C, listas) e devolve as peças que o DocumentoVisual
// desenha (fluxo com setas, tabela com gráfico, destaque, cartões...).
import type { Bloco } from '@/lib/proLaboreApi'

export interface Passo { titulo: string; descricao: string | null }
export type Peca =
  | { t: 'secao'; texto: string; numero: number | null }
  | { t: 'subtitulo'; texto: string }
  | { t: 'paragrafo'; texto: string }
  | { t: 'introducao'; texto: string }
  | { t: 'fluxo'; passos: Passo[]; setas: boolean }
  | { t: 'tabela'; cabecalho: string[]; linhas: string[][]; grafico: { rotulos: string[]; valores: number[]; coluna: string } | null }
  | { t: 'destaque'; rotulo: string | null; texto: string; icone: string | null }
  | { t: 'cadeia'; partes: string[] }
  | { t: 'cartoes'; itens: Array<{ marca: string; titulo: string; linhas: Array<{ t: 'texto' | 'cadeia'; texto: string; partes?: string[] }> }> }
  | { t: 'lista'; numerada: boolean; itens: string[] }
  | { t: 'checklist'; itens: Array<{ texto: string; marcado: boolean }> }
  | { t: 'citacao'; texto: string }
  | { t: 'codigo'; texto: string }
  | { t: 'imagem'; src: string }
  | { t: 'divisor' }

interface Item { tipo: Bloco['tipo']; texto: string; marcado?: boolean; icone?: string }

const NUMERADO = /^(\d{1,3}[A-Za-z]?)[.)]\s+(.+)$/
const LETRA = /^([A-H])[.)]\s+(.+)$/
const ROTULO = /^([A-ZÀ-Ú][^:]{1,40}):\s+(.+)$/
const SETA = /\s*(?:→|->|⇒|➜|➔)\s*/
const SUBTITULO = /^(etapa|fase|passo|parte|bloco|m[óo]dulo)\s+\S+/i
const PALAVRAS_FLUXO = /funil|fluxo|jornada|processo|etapas|caminho|sequ[êe]ncia|pipeline/i

const colunasDe = (t: string) => (t.includes('\t') ? t.split('\t') : / \| /.test(t) ? t.replace(/^\||\|$/g, '').split('|') : [t]).map(c => c.trim())
const ehLinhaDeTabela = (it: Item | undefined) => !!it && it.tipo === 'paragrafo' && colunasDe(it.texto).length >= 2
const ehSeparadorMarkdown = (t: string) => /^\|?\s*:?-{3,}/.test(t.trim())
const ehCadeia = (t: string) => t.split(SETA).filter(Boolean).length >= 3 && t.length <= 260
const curtoSemPonto = (t: string) => t.length <= 70 && !/[.?!:;,]$/.test(t)

function numeroDe(t: string): number | null {
  const s = t.replace(/[R$%\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null
}

/** Cada linha de cada bloco vira um item (o texto colado antes da separação por linha ainda funciona). */
function itensDe(blocos: Bloco[]): Item[] {
  const itens: Item[] = []
  for (const b of blocos) {
    if (b.tipo === 'codigo' || b.tipo === 'imagem' || b.tipo === 'divisor') { itens.push({ tipo: b.tipo, texto: b.texto }); continue }
    for (const l of b.texto.split(/\r?\n/)) {
      if (!l.trim()) continue
      const t = l.trim()
      if (b.tipo === 'paragrafo' && /^#{1,3}\s/.test(t)) {
        const n = t.match(/^#+/)![0].length
        itens.push({ tipo: `titulo${n}` as Bloco['tipo'], texto: t.replace(/^#+\s+/, '') })
      } else itens.push({ tipo: b.tipo, texto: b.tipo === 'lista' ? l.replace(/\s+$/, '') : t, marcado: b.marcado, icone: b.icone })
    }
  }
  return itens
}

const ehNumerado = (it: Item | undefined) => !!it && (it.tipo === 'lista_numerada' || (it.tipo === 'paragrafo' && NUMERADO.test(it.texto)))
const tituloNumerado = (it: Item) => (it.tipo === 'paragrafo' ? it.texto.match(NUMERADO)![2] : it.texto).trim()
// Descrição de passo: uma linha curta (não um parágrafo de várias frases nem uma introdução com ":").
const ehDescricao = (it: Item | undefined) => ehTexto(it) && it!.texto.length <= 140 && !/[.!?]\s+\S/.test(it!.texto) && !it!.texto.endsWith(':')
const ehTexto = (it: Item | undefined) => !!it && it.tipo === 'paragrafo' && !NUMERADO.test(it.texto) && !LETRA.test(it.texto) && !ehLinhaDeTabela(it)

export function estruturar(blocos: Bloco[]): Peca[] {
  const itens = itensDe(blocos)
  const pecas: Peca[] = []
  let ultimaSecao = ''
  // A lista numerada do editor não guarda o número digitado: as seções numeradas seguem a ordem.
  let secoesNumeradas = 0
  let i = 0
  while (i < itens.length) {
    const it = itens[i]
    const prox = itens[i + 1]

    if (it.tipo === 'titulo1' || it.tipo === 'titulo2' || it.tipo === 'titulo3') {
      if (it.tipo === 'titulo3') pecas.push({ t: 'subtitulo', texto: it.texto })
      else { pecas.push({ t: 'secao', texto: it.texto, numero: null }); ultimaSecao = it.texto }
      i++; continue
    }
    if (it.tipo === 'divisor') { pecas.push({ t: 'divisor' }); i++; continue }
    if (it.tipo === 'imagem') { if (it.texto) pecas.push({ t: 'imagem', src: it.texto }); i++; continue }
    if (it.tipo === 'codigo') { pecas.push({ t: 'codigo', texto: it.texto }); i++; continue }
    if (it.tipo === 'citacao') { pecas.push({ t: 'citacao', texto: it.texto }); i++; continue }
    if (it.tipo === 'callout') { pecas.push({ t: 'destaque', rotulo: null, texto: it.texto, icone: it.icone ?? '💡' }); i++; continue }
    if (it.tipo === 'checkbox') {
      const lista: Array<{ texto: string; marcado: boolean }> = []
      while (itens[i]?.tipo === 'checkbox') { lista.push({ texto: itens[i].texto, marcado: !!itens[i].marcado }); i++ }
      pecas.push({ t: 'checklist', itens: lista }); continue
    }

    // Tabela: duas ou mais linhas seguidas com colunas (tab ou |).
    if (ehLinhaDeTabela(it) && ehLinhaDeTabela(prox)) {
      const linhas: string[][] = []
      while (ehLinhaDeTabela(itens[i])) { if (!ehSeparadorMarkdown(itens[i].texto)) linhas.push(colunasDe(itens[i].texto)); i++ }
      const [cabecalho, ...corpo] = linhas
      const largura = Math.max(...linhas.map(l => l.length))
      const norm = (l: string[]) => [...l, ...Array(largura - l.length).fill('')]
      // Gráfico: a última coluna é toda numérica (e há pelo menos 2 linhas).
      const ult = largura - 1
      const valores = corpo.map(l => numeroDe(l[ult] ?? ''))
      const grafico = corpo.length >= 2 && valores.every(v => v !== null && v >= 0) ? { rotulos: corpo.map(l => l[0]), valores: valores as number[], coluna: cabecalho[ult] ?? '' } : null
      pecas.push({ t: 'tabela', cabecalho: norm(cabecalho), linhas: corpo.map(norm), grafico })
      continue
    }

    // Itens numerados: com descrição embaixo (2 ou mais) viram passos;
    // sozinho viram título de seção; sem descrição, lista numerada.
    if (ehNumerado(it)) {
      const passos: Passo[] = []
      let j = i
      while (ehNumerado(itens[j]) && ehDescricao(itens[j + 1])) {
        passos.push({ titulo: tituloNumerado(itens[j]), descricao: itens[j + 1].texto })
        j += 2
      }
      if (passos.length >= 2) {
        pecas.push({ t: 'fluxo', passos, setas: PALAVRAS_FLUXO.test(ultimaSecao) })
        i = j; continue
      }
      // Seção numerada: um item só com texto embaixo, ou que abre outra sequência numerada com descrições.
      if (ehTexto(prox) || (ehNumerado(prox) && ehDescricao(itens[i + 2]))) {
        const m = it.tipo === 'paragrafo' ? it.texto.match(NUMERADO) : null
        secoesNumeradas = m ? Number.parseInt(m[1], 10) || secoesNumeradas + 1 : secoesNumeradas + 1
        pecas.push({ t: 'secao', texto: tituloNumerado(it), numero: secoesNumeradas })
        ultimaSecao = tituloNumerado(it)
        i++; continue
      }
      const lista: string[] = []
      while (ehNumerado(itens[i]) && !(ehTexto(itens[i + 1]) && ehNumerado(itens[i + 2]) && ehTexto(itens[i + 3]))) { lista.push(tituloNumerado(itens[i])); i++ }
      if (!lista.length) { lista.push(tituloNumerado(itens[i])); i++ }
      pecas.push({ t: 'lista', numerada: true, itens: lista })
      continue
    }

    // Cartões A/B/C: o título e as linhas até o próximo cartão.
    if (it.tipo === 'paragrafo' && LETRA.test(it.texto)) {
      const cartoes: Extract<Peca, { t: 'cartoes' }>['itens'] = []
      while (itens[i] && itens[i].tipo === 'paragrafo' && LETRA.test(itens[i].texto)) {
        const m = itens[i].texto.match(LETRA)!
        const cartao = { marca: m[1], titulo: m[2], linhas: [] as Extract<Peca, { t: 'cartoes' }>['itens'][number]['linhas'] }
        i++
        while (ehTexto(itens[i]) && (ehCadeia(itens[i].texto) || !curtoSemPonto(itens[i].texto))) {
          const t = itens[i].texto
          cartao.linhas.push(ehCadeia(t) ? { t: 'cadeia', texto: t, partes: t.split(SETA).filter(Boolean) } : { t: 'texto', texto: t })
          i++
        }
        cartoes.push(cartao)
      }
      pecas.push({ t: 'cartoes', itens: cartoes })
      continue
    }

    if (it.tipo === 'lista') {
      const lista: string[] = []
      while (itens[i]?.tipo === 'lista') { lista.push(itens[i].texto); i++ }
      pecas.push({ t: 'lista', numerada: false, itens: lista })
      continue
    }

    // Parágrafos: cadeia com setas, "Rótulo: texto" (destaque), subtítulo curto ou texto.
    const t = it.texto
    if (ehCadeia(t)) { pecas.push({ t: 'cadeia', partes: t.split(SETA).filter(Boolean) }); i++; continue }
    const rot = t.match(ROTULO)
    if (rot && t.length > 30) { pecas.push({ t: 'destaque', rotulo: rot[1], texto: rot[2], icone: null }); i++; continue }
    if (t.endsWith(':') && t.length <= 160) { pecas.push({ t: 'introducao', texto: t }); i++; continue }
    if (SUBTITULO.test(t) && t.length <= 90) { pecas.push({ t: 'subtitulo', texto: t }); i++; continue }
    if (curtoSemPonto(t) && prox && (ehLinhaDeTabela(prox) || (prox.tipo === 'paragrafo' && LETRA.test(prox.texto)) || prox.tipo === 'lista' || ehNumerado(prox))) {
      pecas.push({ t: 'subtitulo', texto: t }); i++; continue
    }
    pecas.push({ t: 'paragrafo', texto: t })
    i++
  }
  return pecas
}
