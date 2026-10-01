// Constantes de geometria do motor de mapa mental — copiadas com os MESMOS
// valores do arquivo de referência (referencia/motor-mapa-mental.html).
// Não são "ajustadas" aqui: qualquer mudança de valor é uma mudança de
// comportamento visual em relação à referência, então mexe direto lá.
export const FONT = 'Figtree, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

export const PAD = {
  text: { x: 4, y: 3 },
  underline: { x: 2, y: 5 },
  pill: { x: 14, y: 7 },
  box: { x: 22, y: 14 },
} as const

// mapa mental
export const G = { rootGap: 72, jGap: 7, R: 5, childGap: 26, sib: 10, branch: 24 } as const
// organograma
export const O = { sib: 20, branch: 36, rowGap: 60 } as const
// lista
export const LI = { indent: 44, row: 12 } as const

export const MAXW = { mind: 230, org: 150, list: 420 } as const

export const RED = '#e5484d'

export const fontFor = (d: number): { fs: number; fw: number } =>
  d === 0 ? { fs: 22, fw: 700 } : d === 1 ? { fs: 17, fw: 600 } : { fs: 15, fw: 500 }

// Fontes que dá pra escolher em cada ideia (a "sans" é a do tema).
export const FONTES: Record<'sans' | 'serif' | 'mao' | 'mono', string> = {
  sans: FONT,
  serif: 'Georgia, "Times New Roman", serif',
  mao: '"Segoe Print", "Bradley Hand", "Comic Neue", "Comic Sans MS", cursive',
  mono: '"IBM Plex Mono", ui-monospace, SFMono-Regular, monospace',
}
export const ESCALA_TAMANHO = { p: 0.85, m: 1, g: 1.3 } as const
// Mídia dentro da ideia
export const MIDIA = { maxW: 220, maxWRaiz: 260, maxH: 240, gap: 8, yt: { w: 224, h: 126 }, chipH: 22, chipGap: 6 } as const
