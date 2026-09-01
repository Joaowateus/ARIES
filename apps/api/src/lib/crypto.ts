import crypto from 'crypto'

/**
 * Cifra/decifra segredos guardados no banco (hoje só o access token das
 * integrações de anúncio — ver IntegracaoAnuncio). AES-256-GCM com IV
 * aleatório por valor; a chave vem de INTEGRACOES_SECRET_KEY (gerar com
 * `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
 * e nunca reaproveitar o JWT_SECRET em produção — o fallback abaixo é só
 * pra não quebrar o ambiente de dev sem .env completo).
 */

const ALGORITMO = 'aes-256-gcm'

function chave(): Buffer {
  const segredo = process.env.INTEGRACOES_SECRET_KEY ?? process.env.JWT_SECRET ?? 'dev-secret'
  return crypto.createHash('sha256').update(segredo).digest()
}

export function cifrar(texto: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITMO, chave(), iv)
  const cifrado = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, cifrado]).toString('base64')
}

export function decifrar(valor: string): string {
  const buf = Buffer.from(valor, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const cifrado = buf.subarray(28)
  const decipher = crypto.createDecipheriv(ALGORITMO, chave(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(cifrado), decipher.final()]).toString('utf8')
}
