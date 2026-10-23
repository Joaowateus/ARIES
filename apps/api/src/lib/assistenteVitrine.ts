// Vitrine do estoque no WhatsApp — funções puras: reconhecer a moto que o
// cliente pediu ("tem a XRE 300?"), montar a ficha que vai para ele e achar
// opções parecidas quando a pedida já foi vendida. Preço só entra na ficha
// se a loja ligar; a IA nunca recebe preço (ver fichaParaIA).
import { paraBusca, pareceDuvidaOuObjecao } from './assistenteConhecimento'

export interface ItemFicha { rotulo: string; valor: string }
export interface MotoVitrine {
  id: string
  modelo: string
  marca: string | null
  ano: number | null
  cor: string | null
  situacao: string // DISPONIVEL | RESERVADA | VENDIDA
  versao: string | null
  km: number | null
  cilindrada: number | null
  preco: number | null
  destaques: string[]
  ficha: ItemFicha[]
  fotos: string[]
  videoUrl: string | null
}

// Palavras que não identificam moto nenhuma ("tem a moto honda 2022?").
const GENERICAS = new Set(['moto', 'motos', 'a', 'o', 'de', 'da', 'do', 'cc', 'km', 'nova', 'novo', 'usada', 'usado', 'seminova', 'seminovo', 'flex', 'edicao', 'especial'])
const PEDE_ESTOQUE = /\b(tem|teria|tens|ha|chegou|chegaram|disponivel|disponiveis|estoque|ainda tem|voces tem|vcs tem|tem ainda|vende|vendem|trabalham com)\b/

function tokens(texto: string): string[] {
  return paraBusca(texto).split(' ').filter(t => t && !GENERICAS.has(t))
}

export function nomeDaMoto(m: Pick<MotoVitrine, 'marca' | 'modelo' | 'versao' | 'ano'>): string {
  const modelo = m.marca && !paraBusca(m.modelo).startsWith(paraBusca(m.marca)) ? `${m.marca} ${m.modelo}` : m.modelo
  return [modelo, m.versao, m.ano].filter(Boolean).join(' ')
}

/**
 * Pontos de quanto o texto fala desta moto: cada palavra do modelo/versão
 * que aparece inteira no texto. Exige uma palavra "forte" (3+ letras, ou
 * sigla curta junto com a cilindrada: "cg 160"), para "tem a de 160?" não
 * casar com todas.
 */
export function pontosDaMoto(texto: string, m: MotoVitrine): number {
  const doTexto = new Set(tokens(texto))
  const doModelo = [...new Set(tokens(`${m.modelo} ${m.versao ?? ''}`))]
  const achados = doModelo.filter(t => doTexto.has(t))
  if (!achados.length) return 0
  const forte = achados.some(t => /[a-z]/.test(t) && t.length >= 3) || (achados.some(t => /^[a-z]{2}$/.test(t)) && achados.some(t => /^\d{2,4}$/.test(t)))
  if (!forte) return 0
  let pontos = achados.length * 2
  if (m.marca && doTexto.has(paraBusca(m.marca))) pontos += 1
  if (m.ano && doTexto.has(String(m.ano))) pontos += 1
  if (m.cor && tokens(m.cor).some(t => doTexto.has(t))) pontos += 1
  return pontos
}

/** Motos do estoque de que o texto fala, da mais provável para a menos. */
export function acharMotos(texto: string, motos: MotoVitrine[]): MotoVitrine[] {
  return motos.map(m => ({ m, p: pontosDaMoto(texto, m) })).filter(x => x.p > 0)
    .sort((a, b) => b.p - a.p || ordemSituacao(a.m) - ordemSituacao(b.m)).map(x => x.m)
}

const ordemSituacao = (m: MotoVitrine) => (m.situacao === 'DISPONIVEL' ? 0 : m.situacao === 'RESERVADA' ? 1 : 2)

/** "Tem a XRE 300?" — o cliente está perguntando de uma moto do estoque. */
export function perguntaDeEstoque(texto: string, motos: MotoVitrine[]): MotoVitrine | null {
  const t = paraBusca(texto)
  if (!pareceDuvidaOuObjecao(texto) && !PEDE_ESTOQUE.test(t)) return null
  return acharMotos(texto, motos)[0] ?? null
}

/** Até 3 disponíveis parecidas: mesma marca ou cilindrada próxima, depois o resto. */
export function parecidas(alvo: MotoVitrine, motos: MotoVitrine[], n = 3): MotoVitrine[] {
  const cc = alvo.cilindrada
  const nota = (m: MotoVitrine) =>
    (m.marca && alvo.marca && paraBusca(m.marca) === paraBusca(alvo.marca) ? 2 : 0) +
    (cc && m.cilindrada && Math.abs(m.cilindrada - cc) <= 60 ? 3 : 0) +
    (tokens(m.modelo)[0] && tokens(m.modelo)[0] === tokens(alvo.modelo)[0] ? 4 : 0)
  return motos.filter(m => m.id !== alvo.id && m.situacao === 'DISPONIVEL')
    .map(m => ({ m, n: nota(m) })).filter(x => x.n > 0).sort((a, b) => b.n - a.n).slice(0, n).map(x => x.m)
}

const milhar = (n: number) => Math.round(n).toLocaleString('pt-BR')
export const formatarPreco = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

/** Ficha no formato do WhatsApp (negrito com *), pronta para legenda da foto. */
export function fichaTexto(m: MotoVitrine, opcoes: { mostrarPreco: boolean }): string {
  const linhas = [`*${nomeDaMoto(m)}*${m.cor ? ` · ${m.cor}` : ''}`]
  const detalhes = [m.km !== null ? `${milhar(m.km)} km` : null, m.cilindrada ? `${m.cilindrada} cc` : null].filter(Boolean)
  if (detalhes.length) linhas.push(detalhes.join(' · '))
  for (const d of m.destaques.slice(0, 6)) linhas.push(`✅ ${d}`)
  for (const f of m.ficha.slice(0, 8)) linhas.push(`• ${f.rotulo}: ${f.valor}`)
  if (opcoes.mostrarPreco && m.preco) linhas.push(`💰 ${formatarPreco(m.preco)}`)
  if (m.videoUrl) linhas.push(`🎬 Vídeo: ${m.videoUrl}`)
  return linhas.join('\n')
}

/** Uma linha por moto ("• Honda Bros 160 2022 · 18.000 km") para a lista de parecidas. */
export function linhaDaMoto(m: MotoVitrine): string {
  return `• ${nomeDaMoto(m)}${m.km !== null ? ` · ${milhar(m.km)} km` : ''}`
}

/**
 * Resposta do robô para "tem a X?": a ficha (com foto, se houver) quando
 * está disponível; quando foi vendida/reservada, avisa e lista parecidas.
 * Sem parecidas, o robô não responde (o vendedor assume).
 */
export function respostaDeEstoque(alvo: MotoVitrine, motos: MotoVitrine[], opcoes: { mostrarPreco: boolean; nome: string }): { texto: string; foto: string | null; disponivel: boolean } | null {
  const ola = opcoes.nome ? `, ${opcoes.nome}` : ''
  if (alvo.situacao === 'DISPONIVEL') {
    return { texto: `Temos sim${ola}! 😍\n\n${fichaTexto(alvo, opcoes)}`, foto: alvo.fotos[0] ?? null, disponivel: true }
  }
  const outras = parecidas(alvo, motos)
  if (!outras.length) return null
  const motivo = alvo.situacao === 'RESERVADA' ? 'está reservada' : 'já foi vendida'
  return {
    texto: `A ${nomeDaMoto(alvo)} ${motivo}${ola}, mas temos opções parecidas:\n${outras.map(linhaDaMoto).join('\n')}`,
    foto: outras[0].fotos[0] ?? null,
    disponivel: false,
  }
}

/**
 * Ficha para a IA do Copiloto: sem preço e sem fotos. A ficha técnica vai
 * como texto ("Freio: ABS") porque o filtro de dinheiro tira qualquer campo
 * chamado "valor".
 */
export function fichaParaIA(m: MotoVitrine) {
  return { moto: nomeDaMoto(m), cor: m.cor, situacao: m.situacao, km: m.km, cilindrada: m.cilindrada, destaques: m.destaques, ficha: m.ficha.map(f => `${f.rotulo}: ${f.valor}`) }
}

export function lerFicha(v: unknown): ItemFicha[] {
  if (!Array.isArray(v)) return []
  return v.filter(x => x && typeof x === 'object').map(x => ({ rotulo: String((x as ItemFicha).rotulo ?? '').trim(), valor: String((x as ItemFicha).valor ?? '').trim() }))
    .filter(x => x.rotulo && x.valor).slice(0, 12)
}
