// Motor de mapa mental — classe controladora, sem nenhuma dependência de
// React (instrução: "engine e conectores como módulos JS/TS puros, React só
// na renderização e nos eventos"). Porta 1:1 o comportamento do <script> da
// referência (referencia/motor-mapa-mental.html): mesmo estado, mesmas
// funções (`relayout`, `tick`, `zoomAt`, `fit`, `startEdit`, `addChild`,
// `reparent`, `nav`, etc.), mesmo tratamento de ponteiro/teclado/edição. A
// única diferença estrutural é onde a raiz do DOM vem de fora (`container`,
// injetado pelo componente React) em vez de `document.querySelector` fixo, e
// persistência é um callback (`onMudancaArvore`) em vez de `localStorage`.
import {
  addChild as addChildArvore, addSibling as addSiblingArvore, criarFabricaDeNos, isInside,
  maxId as maxIdArvore, type NoArvore, reindexar, removeNode as removeNodeArvore, reparent as reparentArvore,
  toggleCollapse,
} from './dados'
import { buildLayout, type Layout, type MapaLayout } from './layout'
import { bandSvg, col, connectorsFor, esc, junctionSvg, lum, nodeSvg } from './conectores'
import { FONT } from './constantes'
import { THEMES, type Tema } from './temas'

export interface EstadoMotor {
  layout: Layout
  theme: string
  balanced: boolean
  showBand: boolean
  zoomPct: number
  canUndo: boolean
  canRedo: boolean
  selecionadoId: string | null
  selecionadoTemFilhos: boolean
  selecionadoColapsado: boolean
  podeExcluirSelecionado: boolean
}

export interface MotorMapaMentalOpcoes {
  container: HTMLElement
  treeInicial: NoArvore
  layoutInicial?: Layout
  temaInicial?: string
  balancedInicial?: boolean
  counterInicial?: number
  temas?: Record<string, Tema>
  onMudancaArvore?: (tree: NoArvore, counter: number, posicoes: Map<string, Ponto>) => void
  onMudancaEstado?: (estado: EstadoMotor) => void
}

type Ponto = { x: number; y: number }

export class MotorMapaMental {
  private container: HTMLElement
  private svg: SVGSVGElement
  private ed: HTMLTextAreaElement
  private legend: HTMLDivElement
  private actionsEl: HTMLDivElement
  private zoomEl: HTMLDivElement
  private zoomVal: HTMLOutputElement
  private temas: Record<string, Tema>
  private onMudancaArvore?: (tree: NoArvore, counter: number, posicoes: Map<string, Ponto>) => void
  private onMudancaEstado?: (estado: EstadoMotor) => void
  private RM: boolean
  private fabrica: ReturnType<typeof criarFabricaDeNos>

  private tree: NoArvore
  private layout: Layout
  private theme: string
  private balanced: boolean
  private showBand = false
  private sel: string | null = null
  private L: MapaLayout = new Map()
  private disp = new Map<string, Ponto>()
  private from = new Map<string, Ponto>()
  private view = { tx: 0, ty: 0, k: 1 }
  private editing: string | null = null
  private editOrig = ''
  private editSnap: string | null = null
  private dragging: string | null = null
  private dragPos: Ponto | null = null
  private dropTarget: string | null = null
  private animT0 = 0
  private animRunning = false
  private undoStack: string[] = []
  private redoStack: string[] = []
  private byId = new Map<string, NoArvore>()
  private parentOf = new Map<string, string>()
  private pts = new Map<number, Ponto>()
  private down: { type: 'pan' | 'node'; sx: number; sy: number; tx?: number; ty?: number; id?: string } | null = null
  private pinch: { d: number; k: number } | null = null
  private lastClick = { id: null as string | null, t: 0 }
  private destruido = false

  constructor(opts: MotorMapaMentalOpcoes) {
    this.container = opts.container
    this.temas = opts.temas ?? THEMES
    this.tree = opts.treeInicial
    this.layout = opts.layoutInicial ?? 'mind'
    this.theme = opts.temaInicial && this.temas[opts.temaInicial] ? opts.temaInicial : 'meister'
    this.balanced = !!opts.balancedInicial
    this.fabrica = criarFabricaDeNos(Math.max(opts.counterInicial || 0, maxIdArvore(this.tree)))
    this.onMudancaArvore = opts.onMudancaArvore
    this.onMudancaEstado = opts.onMudancaEstado
    this.RM = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

    this.container.tabIndex = this.container.tabIndex >= 0 ? this.container.tabIndex : 0
    this.container.classList.add('pl-motor-stage')

    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement
    this.svg.setAttribute('class', 'pl-motor-svg')
    this.svg.style.fontFamily = FONT
    this.container.appendChild(this.svg)

    this.ed = document.createElement('textarea')
    this.ed.spellcheck = false
    this.ed.setAttribute('aria-label', 'Texto do nó')
    this.ed.className = 'pl-motor-editor'
    this.container.appendChild(this.ed)

    this.legend = document.createElement('div')
    this.legend.className = 'pl-motor-ui pl-motor-legend'
    this.legend.hidden = true
    this.container.appendChild(this.legend)

    this.actionsEl = document.createElement('div')
    this.actionsEl.className = 'pl-motor-ui pl-motor-actions'
    this.actionsEl.innerHTML = `
      <button type="button" data-a="child" title="Adicionar filho">Adicionar filho <kbd>Tab</kbd></button>
      <button type="button" data-a="sib" title="Adicionar irmão">Adicionar irmão <kbd>Enter</kbd></button>
      <button type="button" data-a="edit" title="Editar texto">Editar <kbd>F2</kbd></button>
      <button type="button" data-a="toggle">Recolher <kbd>Espaço</kbd></button>
      <button type="button" data-a="del">Excluir <kbd>Del</kbd></button>`
    this.container.appendChild(this.actionsEl)

    this.zoomEl = document.createElement('div')
    this.zoomEl.className = 'pl-motor-ui pl-motor-zoom'
    this.zoomEl.innerHTML = `
      <button type="button" data-a="zout" aria-label="Diminuir zoom">−</button>
      <output data-a="zval">100%</output>
      <button type="button" data-a="zin" aria-label="Aumentar zoom">+</button>
      <button type="button" data-a="fit" title="Enquadrar o mapa inteiro">Enquadrar</button>`
    this.container.appendChild(this.zoomEl)
    this.zoomVal = this.zoomEl.querySelector('[data-a="zval"]')!

    this.bindEventos()
    this.sel = this.tree.id
    this.relayout({ instant: true })
    this.fit()
  }

  /* ---------- API pública (chamada pelo wrapper React) ---------- */
  getTree(): NoArvore { return this.tree }
  getCounter(): number { return this.fabrica.getCounter() }
  getPosicoes(): Map<string, Ponto> {
    const posicoes = new Map<string, Ponto>()
    this.L.forEach((e, id) => posicoes.set(id, { x: e.x, y: e.y }))
    return posicoes
  }
  setLayout(layout: Layout): void {
    if (this.layout === layout) return
    this.layout = layout
    this.relayout(); this.fit()
  }
  setTheme(theme: string): void {
    if (!this.temas[theme] || this.theme === theme) return
    this.theme = theme
    this.relayout()
  }
  setBalanced(balanced: boolean): void {
    this.balanced = balanced
    this.relayout(); this.fit()
  }
  setShowBand(showBand: boolean): void {
    this.showBand = showBand
    this.syncChrome(); this.render()
  }
  carregarArvore(tree: NoArvore, counter: number): void {
    this.snapshot()
    this.tree = tree
    this.fabrica.setCounter(Math.max(counter, maxIdArvore(tree)))
    this.sel = tree.id
    this.disp = new Map()
    this.relayout({ instant: true }); this.fit()
  }
  carregarArvoreTeste(): void { this.carregarArvore(this.fabrica.testTree(), this.fabrica.getCounter()) }
  carregarArvoreExemplo(): void { this.carregarArvore(this.fabrica.demoTree(), this.fabrica.getCounter()) }
  undo(): void { this.undoImpl() }
  redo(): void { this.redoImpl() }
  addChildSelecionado(): void { this.addChild(this.sel!) }
  addSiblingSelecionado(): void { this.addSibling(this.sel!) }
  editarSelecionado(): void { this.startEdit(this.sel!, { selectAll: true }) }
  toggleSelecionado(): void { this.toggle(this.sel!) }
  excluirSelecionado(): void { this.removeNode(this.sel!) }
  zoomIn(): void { this.zoomAt(this.container.clientWidth / 2, this.container.clientHeight / 2, this.view.k * 1.2) }
  zoomOut(): void { this.zoomAt(this.container.clientWidth / 2, this.container.clientHeight / 2, this.view.k / 1.2) }
  enquadrar(): void { this.fit() }
  destroy(): void {
    this.destruido = true
    window.removeEventListener('resize', this.onResize)
    this.container.innerHTML = ''
  }

  /* ---------- Dados / índice ---------- */
  private reindex(): void {
    const idx = reindexar(this.tree)
    this.byId = idx.byId; this.parentOf = idx.parentOf
  }
  private snapshot(): void {
    this.undoStack.push(JSON.stringify(this.tree))
    if (this.undoStack.length > 150) this.undoStack.shift()
    this.redoStack.length = 0
  }
  private tema(): Tema { return this.temas[this.theme] }

  /* ---------- Render ---------- */
  private render(): void {
    const th = this.tema(), { tx, ty, k } = this.view
    if (!this.sel || !this.L.has(this.sel)) this.sel = this.tree.id
    this.container.style.backgroundColor = th.bg
    this.container.style.backgroundImage = `radial-gradient(circle, ${th.dots} 1.1px, transparent 1.4px)`
    this.container.style.backgroundSize = `${24 * k}px ${24 * k}px`
    this.container.style.backgroundPosition = `${tx}px ${ty}px`
    const parts: string[] = [`<g transform="translate(${round1(tx)},${round1(ty)}) scale(${k})">`, bandSvg(this.layout, this.sel, this.L, th, this.showBand)]
    this.L.forEach(e => { if (e.hasKids) parts.push(connectorsFor(this.layout, e, this.L, this.disp, th)) })
    this.L.forEach(e => parts.push(nodeSvg(e, this.disp, th, { sel: this.sel, dropTarget: this.dropTarget, dragging: this.dragging, editing: this.editing })))
    this.L.forEach(e => parts.push(junctionSvg(this.layout, e, this.disp, th)))
    if (this.dragging && this.dragPos) {
      const e = this.L.get(this.dragging)!
      parts.push(`<g opacity=".9" pointer-events="none"><rect x="${round1(this.dragPos.x + 10)}" y="${round1(this.dragPos.y + 10)}" width="${e.w + 12}" height="${e.h + 8}" rx="8" fill="${th.bg}" stroke="${th.sel}" stroke-width="1.5"/>` +
        `<text x="${round1(this.dragPos.x + 16 + e.pad.x)}" y="${round1(this.dragPos.y + 14 + e.pad.y + e.lh / 2)}" dominant-baseline="central" font-size="${e.fs}" font-weight="${e.fw}" fill="${th.text}">${esc(e.lines[0])}</text></g>`)
    }
    parts.push('</g>')
    this.svg.innerHTML = parts.join('')
    this.zoomVal.textContent = Math.round(k * 100) + '%'
    this.placeEditor()
    this.syncActions()
  }

  private relayout(o: { instant?: boolean; reveal?: boolean } = {}): void {
    const prev = this.disp
    this.reindex()
    this.L = buildLayout(this.tree, this.layout, this.tema(), this.balanced)
    if (!this.sel || !this.L.has(this.sel)) this.sel = this.tree.id
    this.from = new Map()
    this.L.forEach((e, id) => {
      let st = prev.get(id)
      if (!st) {
        let pid: string | undefined = e.parent ?? undefined, pp: Ponto | undefined
        while (pid && !(pp = prev.get(pid))) pid = this.parentOf.get(pid)
        st = pp ? { x: pp.x, y: pp.y } : { x: e.x, y: e.y }
      }
      this.from.set(id, { x: st.x, y: st.y })
    })
    this.disp = new Map()
    if (o.instant || this.RM) {
      this.L.forEach((e, id) => { this.disp.set(id, { x: e.x, y: e.y }); this.from.set(id, { x: e.x, y: e.y }) })
      this.render()
    } else {
      this.from.forEach((v, id) => this.disp.set(id, { x: v.x, y: v.y }))
      this.animT0 = performance.now()
      if (!this.animRunning) { this.animRunning = true; requestAnimationFrame(this.tick) }
    }
    if (o.reveal && this.sel) this.ensureVisible(this.sel)
    this.onMudancaArvore?.(this.tree, this.fabrica.getCounter(), this.getPosicoes())
    this.syncChrome()
  }

  private tick = (now: number): void => {
    if (this.destruido) return
    const t = Math.min(1, (now - this.animT0) / 230), k = 1 - Math.pow(1 - t, 3)
    this.L.forEach((e, id) => { const a = this.from.get(id)!; this.disp.set(id, { x: a.x + (e.x - a.x) * k, y: a.y + (e.y - a.y) * k }) })
    this.render()
    if (t < 1) requestAnimationFrame(this.tick); else this.animRunning = false
  }

  /* ---------- Vista ---------- */
  private toWorld(sx: number, sy: number): Ponto { return { x: (sx - this.view.tx) / this.view.k, y: (sy - this.view.ty) / this.view.k } }
  private zoomAt(sx: number, sy: number, k: number): void {
    k = Math.max(.2, Math.min(2.5, k))
    const w = this.toWorld(sx, sy)
    this.view.k = k; this.view.tx = sx - w.x * k; this.view.ty = sy - w.y * k
    this.render()
  }
  private fit(): void {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    this.L.forEach(e => { x0 = Math.min(x0, e.x); y0 = Math.min(y0, e.y); x1 = Math.max(x1, e.x + e.w); y1 = Math.max(y1, e.y + e.h) })
    const W = this.container.clientWidth, H = this.container.clientHeight, pad = 70
    const k = Math.max(.2, Math.min((W - pad * 2) / Math.max(1, x1 - x0), (H - pad * 2 - 40) / Math.max(1, y1 - y0), 1.15))
    this.view.k = k; this.view.tx = W / 2 - (x0 + x1) / 2 * k; this.view.ty = (H - 40) / 2 - (y0 + y1) / 2 * k
    this.render()
  }
  private ensureVisible(id: string): void {
    const e = this.L.get(id); if (!e) return
    const W = this.container.clientWidth, H = this.container.clientHeight, m = 60
    const sx = this.view.tx + e.x * this.view.k, sy = this.view.ty + e.y * this.view.k, sw = e.w * this.view.k, sh = e.h * this.view.k
    if (sx < m) this.view.tx += m - sx; else if (sx + sw > W - m) this.view.tx -= sx + sw - (W - m)
    if (sy < m) this.view.ty += m - sy; else if (sy + sh > H - 90) this.view.ty -= sy + sh - (H - 90)
  }

  /* ---------- Edição ---------- */
  private placeEditor(): void {
    if (!this.editing || !this.L.has(this.editing)) return
    const e = this.L.get(this.editing)!, th = this.tema(), k = this.view.k
    let tc = e.depth === 0 ? th.rootText : th.text
    if (e.st === 'pill' && e.depth <= 1) tc = lum(e.depth === 0 ? th.rootFill! : col(e, th)) > .6 ? '#1b1e24' : '#ffffff'
    Object.assign(this.ed.style, {
      display: 'block',
      left: (this.view.tx + e.x * k) + 'px', top: (this.view.ty + e.y * k) + 'px',
      width: ((e.w + 10) * k) + 'px', height: (e.h * k + 2) + 'px',
      padding: `${e.pad.y * k}px ${e.pad.x * k}px`,
      fontSize: (e.fs * k) + 'px', fontWeight: String(e.fw), lineHeight: (e.lh * k) + 'px', color: tc,
    })
  }
  private startEdit(id: string, o: { isNew?: boolean; initial?: string; selectAll?: boolean } = {}): void {
    const node = this.byId.get(id); if (!node) return
    this.editing = id; this.editOrig = node.text
    this.editSnap = o.isNew ? null : JSON.stringify(this.tree)
    if (o.initial != null) { this.ed.value = o.initial; node.text = o.initial; this.relayout({ instant: true }) }
    else { this.ed.value = node.text; this.render() }
    this.ed.style.display = 'block'
    this.placeEditor()
    this.ed.focus({ preventScroll: true })
    if (o.selectAll) this.ed.select(); else { const n = this.ed.value.length; this.ed.setSelectionRange(n, n) }
  }
  private commitEdit(): void {
    if (!this.editing) return
    const id = this.editing; this.editing = null
    const node = this.byId.get(id)!, v = this.ed.value.trim()
    this.ed.style.display = 'none'
    if (!v) node.text = this.editOrig || 'Nova ideia'
    else { node.text = v; if (this.editSnap && v !== this.editOrig) { this.undoStack.push(this.editSnap); this.redoStack.length = 0 } }
    this.relayout({ instant: true })
    this.container.focus({ preventScroll: true })
  }
  private cancelEdit(): void {
    if (!this.editing) return
    this.byId.get(this.editing)!.text = this.editOrig; this.editing = null
    this.ed.style.display = 'none'
    this.relayout({ instant: true })
    this.container.focus({ preventScroll: true })
  }

  /* ---------- Ações na árvore ---------- */
  private addChild(id: string): void {
    const n = this.byId.get(id); if (!n) return
    this.snapshot()
    const c = this.fabrica.mk('Nova ideia')
    addChildArvore(this.byId, id, c)
    this.sel = c.id
    this.relayout({ reveal: true })
    this.startEdit(c.id, { isNew: true, selectAll: true })
  }
  private addSibling(id: string): void {
    const pid = this.parentOf.get(id)
    if (!pid) return this.addChild(id)
    this.snapshot()
    const c = this.fabrica.mk('Nova ideia')
    addSiblingArvore({ byId: this.byId, parentOf: this.parentOf }, id, c)
    this.sel = c.id
    this.relayout({ reveal: true })
    this.startEdit(c.id, { isNew: true, selectAll: true })
  }
  private removeNode(id: string): void {
    const pid = this.parentOf.get(id); if (!pid) return
    this.snapshot()
    const novoSel = removeNodeArvore({ byId: this.byId, parentOf: this.parentOf }, id)
    this.sel = novoSel
    this.relayout()
  }
  private toggle(id: string): void {
    const n = this.byId.get(id); if (!n || !n.children.length) return
    const mudou = toggleCollapse(this.byId, id)
    if (!mudou) return
    if (n.collapsed && this.sel !== id && isInside(this.sel || '', id, this.parentOf)) this.sel = id
    this.relayout()
  }
  private reparentNode(id: string, target: string): void {
    if (!target || id === target || isInside(target, id, this.parentOf) || this.parentOf.get(id) === target) return
    this.snapshot()
    const ok = reparentArvore({ byId: this.byId, parentOf: this.parentOf }, id, target)
    if (!ok) { this.undoStack.pop(); return }
    this.sel = id
    this.relayout({ reveal: true })
  }
  private undoImpl(): void {
    if (!this.undoStack.length) return
    if (this.editing) this.commitEdit()
    this.redoStack.push(JSON.stringify(this.tree))
    this.tree = JSON.parse(this.undoStack.pop()!)
    this.relayout()
  }
  private redoImpl(): void {
    if (!this.redoStack.length) return
    if (this.editing) this.commitEdit()
    this.undoStack.push(JSON.stringify(this.tree))
    this.tree = JSON.parse(this.redoStack.pop()!)
    this.relayout()
  }

  private nav(dir: 'up' | 'down' | 'left' | 'right'): void {
    if (this.layout === 'list' && (dir === 'up' || dir === 'down')) {
      const order: string[] = []
      const w = (id: string): void => { order.push(id); this.L.get(id)!.kids.forEach(w) }
      w(this.tree.id)
      const i = order.indexOf(this.sel!), j = i + (dir === 'down' ? 1 : -1)
      if (order[j]) { this.sel = order[j]; this.ensureVisible(this.sel); this.render() }
      return
    }
    const a = this.L.get(this.sel!)!, pa = this.disp.get(this.sel!)!, cx = pa.x + a.w / 2, cy = pa.y + a.h / 2
    let best: string | null = null, bs = Infinity
    this.L.forEach((e, id) => {
      if (id === this.sel) return
      const p = this.disp.get(id)!, dx = p.x + e.w / 2 - cx, dy = p.y + e.h / 2 - cy
      const main = dir === 'right' ? dx : dir === 'left' ? -dx : dir === 'down' ? dy : -dy
      const cross = dir === 'right' || dir === 'left' ? dy : dx
      if (main <= 4) return
      const score = main + Math.abs(cross) * 2.5
      if (score < bs) { bs = score; best = id }
    })
    if (best) { this.sel = best; this.ensureVisible(this.sel); this.render() }
  }

  /* ---------- Teclado / ponteiro ---------- */
  private hitNode(w: Ponto): string | null {
    let hit: string | null = null
    this.L.forEach((e, id) => {
      if (this.dragging && isInside(id, this.dragging, this.parentOf)) return
      if (w.x >= e.x - 8 && w.x <= e.x + e.w + 8 && w.y >= e.y - 8 && w.y <= e.y + e.h + 8) hit = id
    })
    return hit
  }
  private onResize = (): void => this.render()

  private bindEventos(): void {
    this.ed.addEventListener('input', () => { if (!this.editing) return; this.byId.get(this.editing)!.text = this.ed.value; this.relayout({ instant: true }) })
    this.ed.addEventListener('blur', () => this.commitEdit())
    this.ed.addEventListener('keydown', ev => {
      ev.stopPropagation()
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); this.commitEdit() }
      else if (ev.key === 'Tab') { ev.preventDefault(); const id = this.editing!; this.commitEdit(); this.addChild(id) }
      else if (ev.key === 'Escape') { ev.preventDefault(); this.cancelEdit() }
    })

    this.container.addEventListener('keydown', ev => {
      if (ev.target === this.ed) return
      const mod = ev.ctrlKey || ev.metaKey, key = ev.key.toLowerCase()
      if (mod && key === 'z') { ev.preventDefault(); if (ev.shiftKey) this.redoImpl(); else this.undoImpl(); return }
      if (mod && key === 'y') { ev.preventDefault(); this.redoImpl(); return }
      if (mod || ev.altKey) return
      if ((ev.target as HTMLElement).closest && (ev.target as HTMLElement).closest('button')) return
      switch (ev.key) {
        case 'Tab': ev.preventDefault(); this.addChild(this.sel!); break
        case 'Enter': ev.preventDefault(); this.addSibling(this.sel!); break
        case 'Delete': case 'Backspace': ev.preventDefault(); this.removeNode(this.sel!); break
        case ' ': ev.preventDefault(); this.toggle(this.sel!); break
        case 'F2': ev.preventDefault(); this.startEdit(this.sel!, { selectAll: true }); break
        case 'ArrowUp': ev.preventDefault(); this.nav('up'); break
        case 'ArrowDown': ev.preventDefault(); this.nav('down'); break
        case 'ArrowLeft': ev.preventDefault(); this.nav('left'); break
        case 'ArrowRight': ev.preventDefault(); this.nav('right'); break
        case 'Escape': break
        default:
          if (ev.key.length === 1) { ev.preventDefault(); this.startEdit(this.sel!, { initial: ev.key }) }
      }
    })

    const rect = () => this.container.getBoundingClientRect()
    this.container.addEventListener('pointerdown', ev => {
      if ((ev.target as HTMLElement).closest('.pl-motor-ui') || ev.target === this.ed) return
      if (this.editing) this.commitEdit()
      this.container.focus({ preventScroll: true })
      const r = rect(), sx = ev.clientX - r.left, sy = ev.clientY - r.top
      this.pts.set(ev.pointerId, { x: sx, y: sy })
      if (this.pts.size === 2) {
        const [a, b] = [...this.pts.values()]
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: this.view.k }
        this.down = null; this.dragging = null; this.dropTarget = null; this.container.classList.remove('pl-motor-panning')
        return
      }
      const tg = (ev.target as HTMLElement).closest('[data-toggle]') as HTMLElement | null
      if (tg) { this.toggle(tg.dataset.toggle!); return }
      const ng = (ev.target as HTMLElement).closest('[data-node]') as HTMLElement | null
      if (ng) { this.sel = ng.dataset.node!; this.down = { type: 'node', id: this.sel, sx, sy }; this.render() }
      else { this.down = { type: 'pan', sx, sy, tx: this.view.tx, ty: this.view.ty }; this.container.classList.add('pl-motor-panning') }
      this.container.setPointerCapture(ev.pointerId)
    })
    this.container.addEventListener('pointermove', ev => {
      const r = rect(), sx = ev.clientX - r.left, sy = ev.clientY - r.top
      if (this.pts.has(ev.pointerId)) this.pts.set(ev.pointerId, { x: sx, y: sy })
      if (this.pinch && this.pts.size === 2) {
        const [a, b] = [...this.pts.values()]
        this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, this.pinch.k * Math.hypot(a.x - b.x, a.y - b.y) / this.pinch.d)
        return
      }
      if (!this.down) return
      const dx = sx - this.down.sx, dy = sy - this.down.sy
      if (this.down.type === 'pan') { this.view.tx = this.down.tx! + dx; this.view.ty = this.down.ty! + dy; this.render(); return }
      if (!this.dragging && Math.hypot(dx, dy) > 6 && this.down.id !== this.tree.id) this.dragging = this.down.id!
      if (this.dragging) { this.dragPos = this.toWorld(sx, sy); this.dropTarget = this.hitNode(this.dragPos); this.render() }
    })
    const endPointer = (ev: PointerEvent) => {
      this.pts.delete(ev.pointerId)
      if (this.pts.size < 2) this.pinch = null
      this.container.classList.remove('pl-motor-panning')
      if (this.down && this.down.type === 'node') {
        if (this.dragging) {
          const d = this.dragging, t = this.dropTarget
          this.dragging = null; this.dropTarget = null; this.dragPos = null
          if (t) this.reparentNode(d, t); else this.render()
        } else {
          const now = performance.now()
          if (this.lastClick.id === this.down.id && now - this.lastClick.t < 350) { this.lastClick = { id: null, t: 0 }; this.startEdit(this.down.id!, { selectAll: true }) }
          else this.lastClick = { id: this.down.id!, t: now }
        }
      }
      this.down = null
    }
    this.container.addEventListener('pointerup', endPointer)
    this.container.addEventListener('pointercancel', endPointer)
    this.container.addEventListener('wheel', ev => {
      if ((ev.target as HTMLElement).closest('.pl-motor-ui')) return
      ev.preventDefault()
      const r = rect()
      if (ev.ctrlKey || ev.metaKey) this.zoomAt(ev.clientX - r.left, ev.clientY - r.top, this.view.k * Math.exp(-ev.deltaY * .0025))
      else { this.view.tx -= ev.deltaX; this.view.ty -= ev.deltaY; this.render() }
    }, { passive: false })
    window.addEventListener('resize', this.onResize)

    this.actionsEl.addEventListener('click', ev => {
      const btn = (ev.target as HTMLElement).closest('button') as HTMLButtonElement | null
      if (!btn) return
      const a = btn.dataset.a
      if (a === 'child') this.addChild(this.sel!)
      else if (a === 'sib') this.addSibling(this.sel!)
      else if (a === 'edit') this.startEdit(this.sel!, { selectAll: true })
      else if (a === 'toggle') { this.toggle(this.sel!); this.container.focus({ preventScroll: true }) }
      else if (a === 'del') { this.removeNode(this.sel!); this.container.focus({ preventScroll: true }) }
    })
    this.zoomEl.addEventListener('click', ev => {
      const btn = (ev.target as HTMLElement).closest('button') as HTMLButtonElement | null
      if (!btn) return
      const a = btn.dataset.a
      if (a === 'zin') this.zoomIn()
      else if (a === 'zout') this.zoomOut()
      else if (a === 'fit') this.fit()
    })
  }

  /* ---------- Sincronização de estado "chrome" ---------- */
  private syncActions(): void {
    const n = this.sel ? this.byId.get(this.sel) : null
    const btnDel = this.actionsEl.querySelector('[data-a="del"]') as HTMLButtonElement
    const btnToggle = this.actionsEl.querySelector('[data-a="toggle"]') as HTMLButtonElement
    if (btnDel) btnDel.disabled = !this.sel || !this.parentOf.get(this.sel)
    if (btnToggle) {
      btnToggle.disabled = !n || !n.children.length
      const label = n && n.collapsed ? 'Expandir ' : 'Recolher '
      btnToggle.childNodes[0].textContent = label
    }
    this.syncLegend()
  }
  private syncChrome(): void {
    this.onMudancaEstado?.(this.estadoAtual())
  }
  private syncLegend(): void {
    if (!this.showBand) { this.legend.hidden = true; return }
    this.legend.hidden = false
    const th = this.tema(), e = this.sel ? this.L.get(this.sel) : null
    if (this.layout === 'list') { this.legend.innerHTML = '<h2>Faixa do galho</h2><p>No layout Lista cada nó ocupa a própria linha, então não há faixa para centralizar.</p>'; return }
    if (!e || (this.layout === 'mind' && e.depth === 0)) { this.legend.innerHTML = '<h2>Faixa do galho</h2><p>Selecione um nó que não seja o central para ver a faixa do galho dele.</p>'; return }
    this.legend.innerHTML = `<h2>Faixa do galho</h2>
      <p>O retângulo tracejado é o espaço que o galho inteiro do nó selecionado ocupa.</p>
      <p><span class="pl-motor-legend-k" style="color:${th.sel}"></span>Centro da faixa: é ali que o nó fica.</p>
      <p><span class="pl-motor-legend-k pl-motor-legend-k--erro"></span>Meio dos filhos diretos: aparece quando é diferente, e é onde a maioria dos clones erra.</p>
      <p>Na árvore de teste, selecione o segundo "3" do galho 1 para ver a diferença.</p>`
  }
  private estadoAtual(): EstadoMotor {
    const n = this.sel ? this.byId.get(this.sel) : null
    return {
      layout: this.layout, theme: this.theme, balanced: this.balanced, showBand: this.showBand,
      zoomPct: Math.round(this.view.k * 100),
      canUndo: this.undoStack.length > 0, canRedo: this.redoStack.length > 0,
      selecionadoId: this.sel,
      selecionadoTemFilhos: !!n && n.children.length > 0,
      selecionadoColapsado: !!n && n.collapsed,
      podeExcluirSelecionado: !!this.sel && !!this.parentOf.get(this.sel),
    }
  }
}

function round1(n: number): number { return Math.round(n * 10) / 10 }
