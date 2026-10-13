// Telas do espaço do Social Media desligadas por enquanto (decisão do gestor):
// o código fica, mas some do menu, dos atalhos e dos links.
export const TELAS_DESLIGADAS = ['/pro-labore/sm/captura', '/pro-labore/sm/acervo'] as const
export const telaDesligada = (caminho: string) => TELAS_DESLIGADAS.some(t => caminho === t || caminho.startsWith(`${t}/`))
export const CAPTURA_E_ACERVO_LIGADOS = false
