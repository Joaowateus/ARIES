// Quem fez o pedido, pelo token (assinatura conferida): é a chave do limite
// de requisições por login. Token ausente ou inválido → null (conta pelo IP).
// Guardado por pedido, para não conferir a assinatura duas vezes (limite e chave).
import type { Request } from 'express'
import { verifyProLaboreToken } from './jwtProLabore'
import { verifyToken } from './jwt'

const cache = new WeakMap<Request, string | null>()

export function loginDoPedido(req: Request): string | null {
  if (cache.has(req)) return cache.get(req)!
  let login: string | null = null
  const h = req.headers.authorization
  if (h?.startsWith('Bearer ')) {
    const token = h.slice(7)
    try {
      const p = verifyProLaboreToken(token)
      // Vendedor e Social Media entram com o sub da conta: o que separa a pessoa é o vendedorId / smMembroId.
      login = `pl:${p.sub}:${p.vendedorId ?? p.smMembroId ?? p.papel}`
    } catch {
      try { login = `aries:${verifyToken(token).sub}` } catch { login = null }
    }
  }
  cache.set(req, login)
  return login
}
