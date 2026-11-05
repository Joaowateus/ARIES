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
// No ambiente de teste, o banco e o armazenamento vêm das variáveis TESTE_* (a Vercel não deixa
// repetir DATABASE_URL só para uma branch quando ela já vale para Production e Preview).
export const VARIAVEIS_DE_TESTE = ['DATABASE_URL', 'DIRECT_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'FRONTEND_URL'] as const
export function usarVariaveisDeTeste(env: NodeJS.ProcessEnv = process.env) {
  if ((env.AMBIENTE ?? '').trim().toLowerCase() !== 'teste') return
  // Sem o banco de teste, recusa subir: nunca usar o banco da produção por engano.
  if (!env.TESTE_DATABASE_URL?.trim()) throw new Error('Ambiente de teste sem TESTE_DATABASE_URL: recusado para não usar o banco da produção')
  for (const k of VARIAVEIS_DE_TESTE) if (env[`TESTE_${k}`]?.trim()) env[k] = env[`TESTE_${k}`]!.trim()
  if (!env.TESTE_DIRECT_URL?.trim()) env.DIRECT_URL = env.DATABASE_URL
  // Armazenamento da produção nunca é usado no teste: sem o do teste, fica sem armazenamento.
  if (!env.TESTE_SUPABASE_URL?.trim()) { delete env.SUPABASE_URL; delete env.SUPABASE_SERVICE_ROLE_KEY }
}

/** Na subida do servidor: no ambiente de teste, as chaves de envio somem do processo. */
export function desligarSaidasEmTeste() {
  if (!ambienteDeTeste()) return
  for (const k of ['EVOLUTION_API_URL', 'EVOLUTION_API_KEY', 'ANTHROPIC_API_KEY', 'META_APP_SECRET', 'INSTAGRAM_APP_SECRET']) delete process.env[k]
}
usarVariaveisDeTeste()
desligarSaidasEmTeste()
