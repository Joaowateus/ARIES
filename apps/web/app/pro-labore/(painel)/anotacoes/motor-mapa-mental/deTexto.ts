// Texto → mapa mental, sem IA: lê a estrutura da página (títulos, listas,
// numeração, recuo e linhas que terminam em ":") e monta a árvore. A ideia
// central é o título da página; cada título abre um ramo; itens de lista e
// numerados viram filhos da linha que os introduz. Texto longo é encurtado
// no nó (o texto inteiro continua na página).
import type { Bloco } from '@/lib/proLaboreApi'
import type { NoArvore } from './dados'

const MAX_NOS = 400
const MAX_TEXTO = 140

interface Linha { texto: string; nivel: number; tipo: 'titulo' | 'item' | 'texto' }

const encurtar = (t: string) => (t.length > MAX_TEXTO ? `${t.slice(0, MAX_TEXTO - 1).trimEnd()}…` : t)

/** Cada linha não vazia com o tipo e o recuo; títulos markdown (#) e marcadores de lista são reconhecidos. */
function linhasDe(blocos: Bloco[]): Linha[] {
  const linhas: Linha[] = []
  for (const b of blocos) {
    if (b.tipo === 'divisor' || b.tipo === 'imagem') continue
    for (const bruta of b.texto.split(/\r?\n/)) {
      if (!bruta.trim()) continue
      const recuo = Math.floor((bruta.match(/^[ \t]*/)?.[0] ?? '').replace(/\t/g, '  ').length / 2)
      let t = bruta.trim()
      const md = t.match(/^(#{1,3})\s+(.*)$/)
      if (b.tipo === 'titulo1' || b.tipo === 'titulo2' || b.tipo === 'titulo3' || md) {
        const nivel = md ? md[1].length : Number(b.tipo.slice(-1))
        linhas.push({ texto: md ? md[2] : t, nivel, tipo: 'titulo' })
        continue
      }
      const marcador = t.match(/^(?:[-*•▪◦–]|\d{1,3}[.)]|[a-z][.)]|\[[ xX]?\])\s+(.*)$/)
      if (marcador || b.tipo === 'lista' || b.tipo === 'lista_numerada' || b.tipo === 'checkbox') {
        if (marcador) t = marcador[1]
        linhas.push({ texto: t, nivel: recuo, tipo: 'item' })
        continue
      }
      linhas.push({ texto: t, nivel: recuo, tipo: 'texto' })
    }
  }
  return linhas
}

/** A árvore do mapa a partir da página. `titulo` vira a ideia central. */
export function textoParaArvore(titulo: string, blocos: Bloco[]): { tree: NoArvore; total: number } {
  let contador = 1
  const novo = (texto: string): NoArvore => ({ id: `n${contador++}`, text: encurtar(texto), children: [], collapsed: false })
  let linhas = linhasDe(blocos)
  // A primeira linha repete o título da página (comum quando se cola o texto todo): não duplica.
  if (linhas[0] && linhas[0].texto.trim().toLowerCase() === titulo.trim().toLowerCase()) linhas = linhas.slice(1)
  const raiz = novo(titulo.trim() || linhas.shift()?.texto || 'Ideia central')
  raiz.text = encurtar(raiz.text)

  // Pilha de títulos (nível 1..3) e o "introdutor" atual: a linha de texto
  // sob a qual os itens de lista seguintes se penduram.
  const titulos: Array<{ nivel: number; no: NoArvore }> = []
  let introdutor: { no: NoArvore; recuo: number } | null = null
  const itens: Array<{ nivel: number; no: NoArvore }> = []
  const paiDoTitulo = () => titulos.at(-1)?.no ?? raiz

  for (const l of linhas) {
    if (contador > MAX_NOS) break
    if (l.tipo === 'titulo') {
      while (titulos.length && titulos.at(-1)!.nivel >= l.nivel) titulos.pop()
      const no = novo(l.texto)
      paiDoTitulo().children.push(no)
      titulos.push({ nivel: l.nivel, no })
      introdutor = null
      itens.length = 0
      continue
    }
    if (l.tipo === 'item') {
      // Itens com mais recuo descem um nível dentro da lista.
      while (itens.length && itens.at(-1)!.nivel >= l.nivel) itens.pop()
      const pai = itens.at(-1)?.no ?? introdutor?.no ?? paiDoTitulo()
      const no = novo(l.texto)
      pai.children.push(no)
      itens.push({ nivel: l.nivel, no })
      continue
    }
    // Texto comum: recuado abaixo do introdutor vira filho dele; senão é um
    // ramo do título atual e passa a introduzir os itens que vierem.
    const no = novo(l.texto)
    if (introdutor && l.nivel > introdutor.recuo) introdutor.no.children.push(no)
    else {
      paiDoTitulo().children.push(no)
      introdutor = { no, recuo: l.nivel }
    }
    itens.length = 0
  }
  return { tree: raiz, total: contador - 1 }
}

/** Há estrutura suficiente para valer um mapa (pelo menos 4 linhas). */
export function textoRendeMapa(blocos: Bloco[]): boolean {
  return linhasDe(blocos).length >= 4
}
