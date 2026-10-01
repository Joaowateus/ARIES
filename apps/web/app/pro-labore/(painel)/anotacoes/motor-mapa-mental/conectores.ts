// Conectores e desenho dos nós — cópia literal da camada "Conectores" da
// referência (referencia/motor-mapa-mental.html): mesma geometria de
// curva/cotovelo, mesma exceção da raiz (as curvas nascem na borda da
// elipse, na direção de cada filho — não num ponto de junção compartilhado
// como os nós não-raiz).
import { G, MIDIA, RED } from './constantes'
import type { Ligacao } from './dados'
import type { MapaLayout, NoLayout } from './layoutMotor'
import type { Layout } from './layoutMotor'
import type { Tema } from './temas'

export const f = (n: number): number => Math.round(n * 10) / 10

export function col(e: NoLayout, tema: Tema): string {
  const p = tema.palette
  return p[((e.branch % p.length) + p.length) % p.length]
}
export function anchorY(e: NoLayout, p: { y: number }): number {
  return e.st === 'underline' ? p.y + e.h : p.y + e.h / 2
}
export function inAnchorMind(c: NoLayout, q: { x: number; y: number }): [number, number] {
  return [c.side > 0 ? q.x : q.x + c.w, anchorY(c, q)]
}

export interface Ponto { x: number; y: number }
export interface Juncao { x: number; y: number; ox?: number }

export function junction(layout: Layout, e: NoLayout, p: Ponto): Juncao | null {
  if (e.depth === 0) return null
  if (layout === 'mind') {
    const ox = e.side > 0 ? p.x + e.w : p.x
    return { x: ox + e.side * (G.jGap + G.R), y: anchorY(e, p), ox }
  }
  if (layout === 'org') return { x: p.x + e.w / 2, y: p.y + e.h + G.jGap + G.R }
  return { x: p.x - 14, y: anchorY(e, p) }
}

export function elbow(x1: number, y1: number, x2: number, y2: number, my: number, r: number): string {
  if (Math.abs(x2 - x1) < 1) return `M${f(x1)} ${f(y1)} V${f(y2)}`
  const d = Math.sign(x2 - x1)
  const rr = Math.max(0, Math.min(r, Math.abs(x2 - x1) / 2, my - y1, y2 - my))
  return `M${f(x1)} ${f(y1)} V${f(my - rr)} Q${f(x1)} ${f(my)} ${f(x1 + d * rr)} ${f(my)}` +
    ` H${f(x2 - d * rr)} Q${f(x2)} ${f(my)} ${f(x2)} ${f(my + rr)} V${f(y2)}`
}

export const P = (d: string, c: string, w: number, extra = ''): string =>
  `<path d="${d}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`

export function connectorsFor(layout: Layout, e: NoLayout, L: MapaLayout, disp: Map<string, Ponto>, tema: Tema): string {
  const p = disp.get(e.id)!
  let out = ''
  if (layout === 'mind') {
    if (e.depth === 0) {
      const cx = p.x + e.w / 2, cy = p.y + e.h / 2
      const grow = e.st === 'text' ? 4 : 0
      const rx = e.w / 2 + grow, ry = e.h / 2 + grow
      e.kids.forEach(id => {
        const c = L.get(id)!, q = disp.get(id)!
        const [ex, ey] = inAnchorMind(c, q)
        let dx = ex - cx, dy = ey - cy
        const sc = 1 / Math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2)
        const sx = cx + dx * sc, sy = cy + dy * sc // nasce na borda, na direção do filho
        dx = ex - sx; dy = ey - sy
        out += P(`M${f(sx)} ${f(sy)} C${f(sx + dx * .18)} ${f(sy + dy * .72)} ${f(sx + dx * .5)} ${f(ey)} ${f(ex)} ${f(ey)}`, col(c, tema), 3)
      })
      return out
    }
    const j = junction(layout, e, p)!, s = e.side, c0 = col(e, tema)
    out += P(`M${f(j.ox!)} ${f(j.y)} H${f(j.x - s * G.R)}`, c0, 2)
    const sx = j.x + s * G.R
    e.kids.forEach(id => {
      const c = L.get(id)!, q = disp.get(id)!
      const [ex, ey] = inAnchorMind(c, q)
      const mx = (sx + ex) / 2
      out += P(`M${f(sx)} ${f(j.y)} C${f(mx)} ${f(j.y)} ${f(mx)} ${f(ey)} ${f(ex)} ${f(ey)}`, c0, 2)
    })
    return out
  }
  if (layout === 'org') {
    const cx = p.x + e.w / 2, by = p.y + e.h
    let sy: number
    if (e.depth === 0) sy = by + 3
    else { const j = junction(layout, e, p)!; out += P(`M${f(cx)} ${f(by)} V${f(j.y - G.R)}`, col(e, tema), 2); sy = j.y + G.R }
    e.kids.forEach(id => {
      const c = L.get(id)!, q = disp.get(id)!
      const ex = q.x + c.w / 2, ey = q.y
      const my = sy + Math.max(8, (ey - sy) * .5)
      out += P(elbow(cx, sy, ex, ey, my, 10), e.depth === 0 ? col(c, tema) : col(e, tema), 2.2)
    })
    return out
  }
  // lista
  let s0: Ponto
  if (e.depth === 0) s0 = { x: p.x + 10, y: p.y + e.h + 2 }
  else { const j = junction(layout, e, p)!; s0 = { x: j.x, y: j.y + G.R } }
  e.kids.forEach(id => {
    const c = L.get(id)!, q = disp.get(id)!
    const ey = anchorY(c, q), ex = c.hasKids ? q.x - 14 - G.R : q.x - 3, r = 7
    const d = ey - s0.y > r
      ? `M${f(s0.x)} ${f(s0.y)} V${f(ey - r)} Q${f(s0.x)} ${f(ey)} ${f(s0.x + r)} ${f(ey)} H${f(ex)}`
      : `M${f(s0.x)} ${f(s0.y)} L${f(ex)} ${f(ey)}`
    out += P(d, e.depth === 0 ? col(c, tema) : col(e, tema), 1.8)
  })
  return out
}

export function junctionSvg(layout: Layout, e: NoLayout, disp: Map<string, Ponto>, tema: Tema): string {
  if (!e.hasKids || e.depth === 0) return ''
  const p = disp.get(e.id)!, j = junction(layout, e, p)!, c = col(e, tema)
  let s = `<circle cx="${f(j.x)}" cy="${f(j.y)}" r="${G.R}" fill="${tema.bg}" stroke="${c}" stroke-width="2"/>`
  if (e.collapsed) {
    s += `<circle cx="${f(j.x)}" cy="${f(j.y)}" r="2.2" fill="${c}"/>`
    if (layout === 'mind')
      s += `<text x="${f(j.x + e.side * (G.R + 5))}" y="${f(j.y)}" dominant-baseline="central" text-anchor="${e.side > 0 ? 'start' : 'end'}" font-size="11" font-weight="600" fill="${c}">${e.hidden}</text>`
    else if (layout === 'org')
      s += `<text x="${f(j.x)}" y="${f(j.y + G.R + 11)}" text-anchor="middle" font-size="11" font-weight="600" fill="${c}">${e.hidden}</text>`
  }
  s += `<circle cx="${f(j.x)}" cy="${f(j.y)}" r="12" fill="transparent" data-toggle="${e.id}" style="cursor:pointer"><title>${e.collapsed ? 'Expandir' : 'Recolher'}</title></circle>`
  return s
}

/* ---------- Nós ---------- */
export const esc = (s: unknown): string => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
// Pra valores dentro de atributo (URL, nome de fonte): aspas também.
export const escAttr = (s: unknown): string => esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;')
export function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`
}
export function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  return .2126 * r + .7152 * g + .0722 * b
}

export function nodeSvg(e: NoLayout, disp: Map<string, Ponto>, tema: Tema, opts: { sel: string | null; dropTarget: string | null; dragging: string | null; editing: string | null; uid?: string }): string {
  const p = disp.get(e.id)!, c = e.depth ? col(e, tema) : tema.text
  let s = `<g data-node="${e.id}" style="cursor:pointer"${opts.dragging === e.id ? ' opacity="0.35"' : ''}>`
  if (opts.sel === e.id)
    s += `<rect x="${f(p.x - 5)}" y="${f(p.y - 5)}" width="${f(e.w + 10)}" height="${f(e.h + 10)}" rx="9" fill="${tema.sel}" fill-opacity="0.1" stroke="${tema.sel}" stroke-width="2"/>`
  if (opts.dropTarget === e.id)
    s += `<rect x="${f(p.x - 7)}" y="${f(p.y - 7)}" width="${f(e.w + 14)}" height="${f(e.h + 14)}" rx="10" fill="${tema.sel}" fill-opacity="0.14" stroke="${tema.sel}" stroke-width="2" stroke-dasharray="5 4"/>`
  let tc = e.depth === 0 ? tema.rootText : tema.text
  if (e.fundo) {
    // Cor de fundo escolhida na ideia: vira um cartão, com o texto contrastando.
    s += `<rect x="${f(p.x)}" y="${f(p.y)}" width="${e.w}" height="${e.h}" rx="${Math.min(e.h / 2, 14)}" fill="${e.fundo}"/>`
    tc = lum(e.fundo) > .6 ? '#1b1e24' : '#ffffff'
  } else if (e.st === 'pill') {
    const fill = e.depth === 0 ? tema.rootFill : e.depth === 1 ? c : hexA(c, .2)
    if (e.depth <= 1) tc = lum(e.depth === 0 ? tema.rootFill! : c) > .6 ? '#1b1e24' : '#ffffff'
    s += `<rect x="${f(p.x)}" y="${f(p.y)}" width="${e.w}" height="${e.h}" rx="${Math.min(e.h / 2, 16)}" fill="${fill}"/>`
  } else if (e.st === 'box') {
    s += `<rect x="${f(p.x)}" y="${f(p.y)}" width="${e.w}" height="${e.h}" rx="12" fill="${tema.rootFill}" stroke="${tema.rootStroke}"/>`
  } else {
    s += `<rect x="${f(p.x)}" y="${f(p.y)}" width="${e.w}" height="${e.h}" fill="transparent"/>`
    if (e.st === 'underline' && e.depth > 0)
      s += `<line x1="${f(p.x)}" x2="${f(p.x + e.w)}" y1="${f(p.y + e.h)}" y2="${f(p.y + e.h)}" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`
  }
  if (e.cor) tc = e.cor

  if (e.midia) {
    const m = e.midia, mx = p.x + (e.w - m.w) / 2, my = p.y + e.pad.y
    const cid = `${opts.uid ?? 'm'}-c-${e.id}`
    s += `<clipPath id="${cid}"><rect x="${f(mx)}" y="${f(my)}" width="${m.w}" height="${m.h}" rx="8"/></clipPath>` +
      `<rect x="${f(mx)}" y="${f(my)}" width="${m.w}" height="${m.h}" rx="8" fill="${hexA(tema.text.length === 7 ? tema.text : '#888888', .06)}"/>` +
      `<image href="${escAttr(m.src)}" x="${f(mx)}" y="${f(my)}" width="${m.w}" height="${m.h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${cid})"/>`
    if (m.tipo === 'youtube' && m.url) {
      const cx = mx + m.w / 2, cy = my + m.h / 2
      s += `<g data-link="${escAttr(m.url)}" style="cursor:pointer"><title>Abrir o vídeo no YouTube</title>` +
        `<rect x="${f(cx - 26)}" y="${f(cy - 18)}" width="52" height="36" rx="10" fill="#ff0033" fill-opacity="0.92"/>` +
        `<path d="M${f(cx - 7)} ${f(cy - 10)} L${f(cx + 11)} ${f(cy)} L${f(cx - 7)} ${f(cy + 10)} Z" fill="#ffffff"/></g>`
    }
  }

  if (opts.editing !== e.id) {
    s += `<text font-size="${e.fs}" font-weight="${e.fw}" font-family="${escAttr(e.fam)}"${e.it ? ' font-style="italic"' : ''} fill="${tc}">` +
      e.lines.map((ln, i) => `<tspan x="${f(p.x + e.pad.x)}" y="${f(p.y + e.topoTexto + i * e.lh + e.lh / 2)}" dominant-baseline="central">${esc(ln)}</tspan>`).join('') +
      `</text>`
  }

  if (e.chip) {
    const cc = e.depth ? c : tema.sel
    const cy = p.y + e.topoTexto + e.lines.length * e.lh + MIDIA.chipGap
    s += `<g data-link="${escAttr(e.chip.url)}" style="cursor:pointer"><title>Abrir ${escAttr(e.chip.url)}</title>` +
      `<rect x="${f(p.x + e.pad.x)}" y="${f(cy)}" width="${e.chip.w}" height="${MIDIA.chipH}" rx="${MIDIA.chipH / 2}" fill="${hexA(cc, .14)}"/>` +
      `<text x="${f(p.x + e.pad.x + 8)}" y="${f(cy + MIDIA.chipH / 2)}" dominant-baseline="central" font-size="12" font-weight="600" fill="${e.fundo ? tc : cc}">${esc(e.chip.texto)}</text></g>`
  }
  return s + '</g>'
}

/* ---------- Conexões livres entre ideias ---------- */
// Ponto na borda do retângulo da ideia, na direção do outro ponto.
function naBorda(e: NoLayout, p: Ponto, alvo: Ponto): Ponto {
  const cx = p.x + e.w / 2, cy = p.y + e.h / 2
  const dx = alvo.x - cx, dy = alvo.y - cy
  if (!dx && !dy) return { x: cx, y: cy }
  const esc2 = Math.min(dx ? (e.w / 2 + 6) / Math.abs(dx) : Infinity, dy ? (e.h / 2 + 6) / Math.abs(dy) : Infinity)
  return { x: cx + dx * esc2, y: cy + dy * esc2 }
}

function curvaLigacao(a: Ponto, b: Ponto, centro?: Ponto): { d: string; meio: Ponto } {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
  const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy) || 1
  // Arco bem visível (mínimo 46px), curvando pro lado de FORA do mapa —
  // longe da ideia central — pra não passar por cima das ideias vizinhas.
  const k = Math.min(160, Math.max(46, dist * 0.35))
  const nx = -dy / dist, ny = dx / dist
  let sinal = 1
  if (centro) {
    const d1 = Math.hypot(mx + nx * k - centro.x, my + ny * k - centro.y)
    const d2 = Math.hypot(mx - nx * k - centro.x, my - ny * k - centro.y)
    sinal = d1 >= d2 ? 1 : -1
  }
  const ctrl = { x: mx + nx * k * sinal, y: my + ny * k * sinal }
  return {
    d: `M${f(a.x)} ${f(a.y)} Q${f(ctrl.x)} ${f(ctrl.y)} ${f(b.x)} ${f(b.y)}`,
    meio: { x: 0.25 * a.x + 0.5 * ctrl.x + 0.25 * b.x, y: 0.25 * a.y + 0.5 * ctrl.y + 0.25 * b.y },
  }
}

export function ligacoesSvg(
  ligacoes: Ligacao[], L: MapaLayout, disp: Map<string, Ponto>, tema: Tema,
  o: { uid: string; selecionada: string | null; interativo: boolean; rascunho: { de: string; cursor: Ponto } | null; centro?: Ponto },
): string {
  const cor = tema.text.length === 7 ? hexA(tema.text, .55) : tema.text
  let out = `<defs>` +
    `<marker id="${o.uid}-seta" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${cor}"/></marker>` +
    `<marker id="${o.uid}-seta-sel" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${tema.sel}"/></marker>` +
    `</defs>`
  for (const l of ligacoes) {
    const ea = L.get(l.de), eb = L.get(l.para)
    const pa = disp.get(l.de), pb = disp.get(l.para)
    if (!ea || !eb || !pa || !pb) continue // alguma ponta está num galho recolhido
    const ca = { x: pa.x + ea.w / 2, y: pa.y + ea.h / 2 }, cb = { x: pb.x + eb.w / 2, y: pb.y + eb.h / 2 }
    const { d, meio } = curvaLigacao(naBorda(ea, pa, cb), naBorda(eb, pb, ca), o.centro)
    const sel = o.selecionada === l.id
    out += P(d, sel ? tema.sel : cor, sel ? 2.4 : 1.8, `stroke-dasharray="6 5" marker-end="url(#${o.uid}-seta${sel ? '-sel' : ''})"`)
    if (o.interativo) {
      out += `<path d="${d}" stroke="transparent" stroke-width="16" fill="none" data-ligacao="${l.id}" style="cursor:pointer"><title>Conexão — clique pra selecionar</title></path>`
      if (sel) {
        out += `<g data-del-ligacao="${l.id}" style="cursor:pointer"><title>Remover conexão</title>` +
          `<circle cx="${f(meio.x)}" cy="${f(meio.y)}" r="11" fill="${tema.bg}" stroke="${tema.sel}" stroke-width="2"/>` +
          P(`M${f(meio.x - 4)} ${f(meio.y - 4)} L${f(meio.x + 4)} ${f(meio.y + 4)} M${f(meio.x + 4)} ${f(meio.y - 4)} L${f(meio.x - 4)} ${f(meio.y + 4)}`, tema.sel, 2) + `</g>`
      }
    }
  }
  if (o.rascunho) {
    const e = L.get(o.rascunho.de), p = disp.get(o.rascunho.de)
    if (e && p) {
      const a = naBorda(e, p, o.rascunho.cursor)
      out += P(curvaLigacao(a, o.rascunho.cursor).d, tema.sel, 2, `stroke-dasharray="6 5" marker-end="url(#${o.uid}-seta-sel)"`)
    }
  }
  return out
}

/* ---------- Faixa do galho (didático) ---------- */
export function bandSvg(layout: Layout, sel: string | null, L: MapaLayout, tema: Tema, showBand: boolean): string {
  if (!showBand || layout === 'list') return ''
  const e = sel ? L.get(sel) : null
  if (!e || e.bandStart == null || (layout === 'mind' && e.depth === 0)) return ''
  let x0 = e.x, x1 = e.x + e.w, y0 = e.y, y1 = e.y + e.h
  ;(function w(id: string) { const n = L.get(id)!; x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x + n.w); y0 = Math.min(y0, n.y); y1 = Math.max(y1, n.y + n.h); n.kids.forEach(w) })(e.id)
  let out = ''
  const dash = `stroke-dasharray="6 5"`
  if (layout === 'mind') {
    const bx = x0 - 12, bw = x1 - x0 + 24, cy = e.bandStart + e.span / 2
    out += `<rect x="${f(bx)}" y="${f(e.bandStart)}" width="${f(bw)}" height="${f(e.span)}" rx="6" fill="${tema.sel}" fill-opacity=".06" stroke="${tema.sel}" stroke-opacity=".6" ${dash}/>`
    out += P(`M${f(bx - 30)} ${f(cy)} H${f(bx + bw + 14)}`, tema.sel, 1.5, dash)
    if (e.kids.length > 1) {
      const a = L.get(e.kids[0])!, b = L.get(e.kids[e.kids.length - 1])!
      const mid = (a.y + a.h / 2 + b.y + b.h / 2) / 2
      if (Math.abs(mid - cy) > 1.5) out += P(`M${f(bx - 30)} ${f(mid)} H${f(bx + bw + 14)}`, RED, 1.5, dash)
    }
  } else {
    const by = y0 - 12, bh = y1 - y0 + 24, cx = e.bandStart + e.span / 2
    out += `<rect x="${f(e.bandStart)}" y="${f(by)}" width="${f(e.span)}" height="${f(bh)}" rx="6" fill="${tema.sel}" fill-opacity=".06" stroke="${tema.sel}" stroke-opacity=".6" ${dash}/>`
    out += P(`M${f(cx)} ${f(by - 30)} V${f(by + bh + 14)}`, tema.sel, 1.5, dash)
    if (e.kids.length > 1) {
      const a = L.get(e.kids[0])!, b = L.get(e.kids[e.kids.length - 1])!
      const mid = (a.x + a.w / 2 + b.x + b.w / 2) / 2
      if (Math.abs(mid - cx) > 1.5) out += P(`M${f(mid)} ${f(by - 30)} V${f(by + bh + 14)}`, RED, 1.5, dash)
    }
  }
  return out
}
