// Ambiente de teste (AMBIENTE=teste, só nas versões de teste da Vercel): roda
// com uma cópia dos dados, mas nunca fala com o mundo de fora. Sem WhatsApp,
// sem Meta e sem IA, mesmo que alguma chave tenha ficado no ambiente; as
// credenciais copiadas do banco são apagadas na restauração.
export const ambienteDeTeste = () => (process.env.AMBIENTE ?? '').trim().toLowerCase() === 'teste'

export class SaidaBloqueadaEmTeste extends Error {
  constructor(servico: string) { super(`Ambiente de teste: ${servico} desligado (nada sai daqui para clientes ou para a Meta)`) }
}
/** Chamar antes de qualquer chamada para fora (Meta). No ambiente de teste, recusa. */
export function exigirSaidaPermitida(servico: string) {
  if (ambienteDeTeste()) throw new SaidaBloqueadaEmTeste(servico)
}
/** Na subida do servidor: no ambiente de teste, as chaves de envio somem do processo. */
export function desligarSaidasEmTeste() {
  if (!ambienteDeTeste()) return
  for (const k of ['EVOLUTION_API_URL', 'EVOLUTION_API_KEY', 'ANTHROPIC_API_KEY', 'META_APP_SECRET', 'INSTAGRAM_APP_SECRET']) delete process.env[k]
}
desligarSaidasEmTeste()
