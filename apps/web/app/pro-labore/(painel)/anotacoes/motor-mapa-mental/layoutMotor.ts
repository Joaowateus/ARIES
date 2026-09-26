// Motor de layout — cópia literal, função por função, da camada "Motor de
// layout" da referência (referencia/motor-mapa-mental.html). A regra central
// (comentada lá e repetida aqui de propósito) é: o nó fica no CENTRO DA FAIXA
// do galho inteiro (bandStart + span/2), não no meio dos filhos diretos.
// Não "melhore" nada aqui — qualquer ajuste de fórmula é uma divergência
// visual em relação à referência.
import { FONT, G, LI, MAXW, O, PAD, fontFor } from './constantes'
import type { NoArvore } from './dados'
import type { EstiloNo, Tema } from './temas'

export type Layout = 'mind' | 'org' | 'list'

export interface NoLayout {
  id: string
  depth: number
  branch: number
  parent: string | null
  kids: string[]
  hasKids: boolean
  collapsed: boolean
  hidden: number
  fs: number
  fw: number
  lh: number
  pad: { x: number; y: number }
  st: EstiloNo
  lines: string[]
  w: number
  h: number
  x: number
  y: number
  side: 1 | -1
  span: number
  bandStart: number | null
}

export type MapaLayout = Map<string, NoLayout>

/* ---------- Medição de texto (via canvas — não trocar por outra técnica) ---------- */
let ctxMedida: CanvasRenderingContext2D | null = null
function obterContexto(): CanvasRenderingContext2D {
  if (!ctxMedida) ctxMedida = document.createElement('canvas').getContext('2d')!
  return ctxMedida
}
export function wrap(text: string, font: string, maxW: number): { lines: string[]; w: number } {
  const ctx = obterContexto()
  ctx.font = font
  const out: string[] = []
  for (const para of String(text).split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    if (!words.length) { out.push(''); continue }
    let line = words[0]
    for (let i = 1; i < words.length; i++) {
      const t = line + ' ' + words[i]
      if (ctx.measureText(t).width <= maxW) line = t
      else { out.push(line); line = words[i] }
    }
    out.push(line)
  }
  const w = Math.max(8, ...out.map(l => ctx.measureText(l).width))
  return { lines: out, w }
}

/* ---------- Motor de layout ---------- */
export function buildLayout(tree: NoArvore, layout: Layout, tema: Tema, balanced = false): MapaLayout {
  const M: MapaLayout = new Map()
  ;(function walk(n: NoArvore, depth: number, branch: number, parent: string | null) {
    const kids = n.collapsed ? [] : n.children
    const { fs, fw } = fontFor(depth)
    const lh = Math.round(fs * 1.32)
    const st: EstiloNo = depth === 0 ? tema.rootStyle : tema.style
    const pad = PAD[st]
    const maxW = depth === 0 ? Math.max(MAXW[layout], 260) : MAXW[layout]
    const { lines, w } = wrap(n.text || ' ', `${fw} ${fs}px ${FONT}`, maxW)
    M.set(n.id, {
      id: n.id, depth, branch, parent, kids: kids.map(c => c.id),
      hasKids: n.children.length > 0, collapsed: n.collapsed && n.children.length > 0,
      hidden: n.collapsed ? n.children.length : 0,
      fs, fw, lh, pad, st, lines, w: Math.ceil(w) + pad.x * 2, h: lines.length * lh + pad.y * 2,
      x: 0, y: 0, side: 1, span: 0, bandStart: null,
    })
    kids.forEach((c, i) => walk(c, depth + 1, depth === 0 ? i : branch, n.id))
  })(tree, 0, -1, null)
  if (layout === 'mind') layoutMind(M, tree, balanced)
  else if (layout === 'org') layoutOrg(M, tree)
  else layoutList(M, tree)
  return M
}

// Largura que o galho inteiro ocupa no eixo onde os irmãos se espalham
export function measureSpan(M: MapaLayout, id: string, key: 'h' | 'w', gapFn: (n: NoLayout) => number): number {
  const n = M.get(id)!
  if (!n.kids.length) return (n.span = n[key])
  let s = 0
  n.kids.forEach(k => (s += measureSpan(M, k, key, gapFn)))
  s += gapFn(n) * (n.kids.length - 1)
  return (n.span = Math.max(n[key], s))
}
const sumSpans = (M: MapaLayout, ids: string[], gap: number) =>
  ids.reduce((s, k) => s + M.get(k)!.span, 0) + gap * Math.max(0, ids.length - 1)

export function layoutMind(M: MapaLayout, tree: NoArvore, balanced = false): void {
  const r = M.get(tree.id)!
  r.x = -r.w / 2; r.y = -r.h / 2
  r.kids.forEach(k => measureSpan(M, k, 'h', () => G.sib))
  let right = r.kids.slice(), left: string[] = []
  if (balanced && right.length > 1) {
    const tot = sumSpans(M, right, 0)
    let i = 0, acc = 0
    do { acc += M.get(right[i])!.span; i++ } while (i < right.length - 1 && acc < tot / 2)
    left = right.slice(i).reverse() // sentido horário: o lado esquerdo sobe
    right = right.slice(0, i)
  }
  ;([[right, 1], [left, -1]] as const).forEach(([grp, side]) => {
    if (!grp.length) return
    let c = -sumSpans(M, grp, G.branch) / 2
    const edge = side > 0 ? r.x + r.w + G.rootGap : r.x - G.rootGap
    grp.forEach(k => { placeMind(M, k, c, edge, side); c += M.get(k)!.span + G.branch })
  })
}
export function placeMind(M: MapaLayout, id: string, start: number, edge: number, side: 1 | -1): void {
  const n = M.get(id)!
  n.side = side; n.bandStart = start
  n.y = start + n.span / 2 - n.h / 2 // centro do GALHO, não dos filhos
  n.x = side > 0 ? edge : edge - n.w
  if (!n.kids.length) return
  let c = start + (n.span - sumSpans(M, n.kids, G.sib)) / 2
  const off = G.jGap + 2 * G.R + G.childGap
  const ce = side > 0 ? n.x + n.w + off : n.x - off
  n.kids.forEach(k => { placeMind(M, k, c, ce, side); c += M.get(k)!.span + G.sib })
}

export function layoutOrg(M: MapaLayout, tree: NoArvore): void {
  const lvH: number[] = []
  M.forEach(e => (lvH[e.depth] = Math.max(lvH[e.depth] || 0, e.h)))
  const top: number[] = [0]
  for (let d = 1; d < lvH.length; d++) top[d] = top[d - 1] + lvH[d - 1] + O.rowGap
  const rid = tree.id
  const gapOf = (n: NoLayout) => (n.depth === 0 ? O.branch : O.sib)
  measureSpan(M, rid, 'w', gapOf)
  ;(function place(id: string, start: number) {
    const n = M.get(id)!
    n.bandStart = start
    n.x = start + n.span / 2 - n.w / 2
    n.y = top[n.depth] // cada nível numa linha fixa
    if (!n.kids.length) return
    const gap = gapOf(n)
    let c = start + (n.span - sumSpans(M, n.kids, gap)) / 2
    n.kids.forEach(k => { place(k, c); c += M.get(k)!.span + gap })
  })(rid, -M.get(rid)!.span / 2)
}

export function layoutList(M: MapaLayout, tree: NoArvore): void {
  let y = 0
  ;(function walk(id: string) {
    const n = M.get(id)!
    n.x = n.depth * LI.indent; n.y = y; y += n.h + LI.row
    n.kids.forEach(walk)
  })(tree.id)
}
