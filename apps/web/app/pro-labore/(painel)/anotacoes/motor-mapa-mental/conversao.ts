// Ponte entre o formato de armazenamento do board (plano: BoardObjeto[] +
// BoardConector[], Postgres) e a árvore literal que o motor fiel exige
// (`{id, text, children, collapsed}`, sem posição salva). Existe pra manter
// o schema/backend/histórico de versões intactos: a árvore é derivada em
// memória a partir do formato plano já existente, e a gravação volta pro
// mesmo formato plano (usando a última posição calculada pelo motor, só
// pra o board ficar coerente se o layout for trocado de volta pra 'manual').
import type { BoardConector, BoardObjeto } from '@/lib/proLaboreApi'
import type { NoArvore } from './dados'

interface DadosNoMapaConversao {
  texto?: string
  ehCentral?: boolean
  colapsado?: boolean
}

export function boardParaArvore(objetos: BoardObjeto[], conectores: BoardConector[]): { tree: NoArvore; counter: number } {
  const nos = objetos.filter(o => o.tipo === 'noMapa')
  const central = nos.find(o => (o.conteudo as DadosNoMapaConversao)?.ehCentral) ?? nos[0]
  if (!central) {
    return { tree: { id: 'n1', text: 'Ideia central', children: [], collapsed: false }, counter: 1 }
  }
  const filhosPorPai = new Map<string, string[]>()
  conectores.forEach(c => {
    if (!nos.some(n => n.id === c.origemId) || !nos.some(n => n.id === c.destinoId)) return
    filhosPorPai.set(c.origemId, [...(filhosPorPai.get(c.origemId) ?? []), c.destinoId])
  })
  const porId = new Map(nos.map(n => [n.id, n]))
  const visitados = new Set<string>()
  function construir(id: string): NoArvore {
    visitados.add(id)
    const o = porId.get(id)!
    const dados = (o.conteudo as DadosNoMapaConversao) ?? {}
    const filhosIds = (filhosPorPai.get(id) ?? []).filter(fid => !visitados.has(fid))
    return {
      id: o.id,
      text: dados.texto ?? '',
      collapsed: !!dados.colapsado,
      children: filhosIds.map(construir),
    }
  }
  const tree = construir(central.id)
  let counter = 0
  nos.forEach(n => { const m = parseInt(String(n.id).slice(1)); if (!Number.isNaN(m)) counter = Math.max(counter, m) })
  return { tree, counter }
}

export function arvoreParaObjetosBoard(tree: NoArvore, posicoes?: Map<string, { x: number; y: number }>): { objetos: BoardObjeto[]; conectores: BoardConector[] } {
  const objetos: BoardObjeto[] = []
  const conectores: BoardConector[] = []
  function visitar(no: NoArvore, ehCentral: boolean) {
    const p = posicoes?.get(no.id)
    objetos.push({
      id: no.id, tipo: 'noMapa', x: p?.x ?? 0, y: p?.y ?? 0,
      conteudo: { texto: no.text, ehCentral, colapsado: no.collapsed },
    })
    no.children.forEach(filho => {
      conectores.push({ id: `${no.id}-${filho.id}`, origemId: no.id, destinoId: filho.id })
      visitar(filho, false)
    })
  }
  visitar(tree, true)
  return { objetos, conectores }
}
