// Camada de dados do motor de mapa mental: a árvore é a única fonte de
// verdade (sem posição salva — a posição é sempre recalculada pelo motor de
// layout). Espelha 1:1 a camada "Dados" da referência
// (referencia/motor-mapa-mental.html): mesmo formato de nó, mesmas funções
// `mk`/`chain`/`testTree`, mesma lógica de reindexação e das ações
// (adicionar filho/irmão, excluir, colapsar, mover de pai).
export interface NoArvore {
  id: string
  text: string
  children: NoArvore[]
  collapsed: boolean
}

export interface IndiceArvore {
  byId: Map<string, NoArvore>
  parentOf: Map<string, string>
}

export function reindexar(raiz: NoArvore): IndiceArvore {
  const byId = new Map<string, NoArvore>()
  const parentOf = new Map<string, string>()
  ;(function w(n: NoArvore, p: NoArvore | null) {
    byId.set(n.id, n)
    if (p) parentOf.set(n.id, p.id)
    n.children.forEach(c => w(c, n))
  })(raiz, null)
  return { byId, parentOf }
}

export function maxId(n: NoArvore): number {
  let m = parseInt(String(n.id).slice(1)) || 0
  ;(n.children || []).forEach(c => (m = Math.max(m, maxId(c))))
  return m
}

export function isInside(id: string, ancestor: string, parentOf: Map<string, string>): boolean {
  let p: string | undefined = id
  while (p) {
    if (p === ancestor) return true
    p = parentOf.get(p)
  }
  return false
}

// Fábrica de nós com contador próprio por instância — a referência usa um
// `counter` global de módulo; aqui cada motor tem o seu, pra várias
// instâncias (várias abas/mapas) não colidirem em ids.
export function criarFabricaDeNos(counterInicial = 0) {
  let counter = counterInicial
  function mk(text: string, children: NoArvore[] = []): NoArvore {
    counter++
    return { id: 'n' + counter, text, children, collapsed: false }
  }
  function chain(a: number, b: number, tail?: NoArvore): NoArvore {
    const n = mk(String(a))
    if (a < b) n.children = [chain(a + 1, b, tail)]
    else if (tail) { n.children = [tail]; n.collapsed = true }
    return n
  }
  function testTree(): NoArvore {
    return mk('Meu novo mapa mental', [
      mk('1', [
        mk('2', [mk('3', [chain(4, 10), chain(4, 10)])]),
        mk('2', [mk('3', [chain(4, 10), mk('4', [mk('5', [chain(6, 10), chain(6, 10)])])])]),
      ]),
      mk('2', [chain(3, 10), chain(3, 10, mk('11'))]),
      mk('3', [chain(4, 10), chain(4, 10)]),
    ])
  }
  function demoTree(): NoArvore {
    return mk('Funil de vendas da loja', [
      mk('Atração', [mk('Tráfego pago no Instagram'), mk('Indicação de clientes'), mk('Ações no showroom')]),
      mk('Qualificação', [mk('Primeiro contato do SDR em até 5 minutos'), mk('Diagnóstico: uso, orçamento e prazo')]),
      mk('Negociação', [
        mk('Proposta com duas opções de moto'),
        mk('Simulação de financiamento', [mk('Banco parceiro'), mk('Consórcio')]),
        mk('Avaliação da usada na troca'),
      ]),
      mk('Pós-venda', [mk('Entrega com checklist'), mk('Revisão de 1.000 km'), mk('Pedido de indicação')]),
    ])
  }
  return { mk, chain, testTree, demoTree, getCounter: () => counter, setCounter: (v: number) => { counter = v } }
}

export function addChild(byId: Map<string, NoArvore>, id: string, novo: NoArvore): boolean {
  const n = byId.get(id)
  if (!n) return false
  n.collapsed = false
  n.children.push(novo)
  return true
}

export function addSibling(idx: IndiceArvore, id: string, novo: NoArvore): string | null {
  const pid = idx.parentOf.get(id)
  if (!pid) return null
  const p = idx.byId.get(pid)!
  p.children.splice(p.children.findIndex(x => x.id === id) + 1, 0, novo)
  return pid
}

export function removeNode(idx: IndiceArvore, id: string): string | null {
  const pid = idx.parentOf.get(id)
  if (!pid) return null
  const p = idx.byId.get(pid)!
  const i = p.children.findIndex(x => x.id === id)
  if (i < 0) return null
  p.children.splice(i, 1)
  return (p.children[i] || p.children[i - 1] || p).id
}

export function toggleCollapse(byId: Map<string, NoArvore>, id: string): boolean {
  const n = byId.get(id)
  if (!n || !n.children.length) return false
  n.collapsed = !n.collapsed
  return true
}

export function reparent(idx: IndiceArvore, id: string, target: string): boolean {
  if (!target || id === target) return false
  if (isInside(target, id, idx.parentOf)) return false
  if (idx.parentOf.get(id) === target) return false
  const pid = idx.parentOf.get(id)
  if (!pid) return false
  const p = idx.byId.get(pid)!, n = idx.byId.get(id)!, t = idx.byId.get(target)
  if (!t) return false
  p.children.splice(p.children.indexOf(n), 1)
  t.children.push(n)
  t.collapsed = false
  return true
}
