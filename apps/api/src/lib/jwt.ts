import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET ?? 'dev-secret'

export interface JwtPayload {
  sub: string
  email: string
  nome: string
  papel: string
  empresaId: string
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as JwtPayload
}

export interface EstadoOAuth {
  empresaId: string
  usuarioId: string
}

/** Token curto (10min) pro parâmetro `state` do fluxo OAuth (ver
 * routes/integracoesAnuncio.ts) — o callback do Meta chega como navegação
 * simples do navegador, sem o header Authorization, então é o `state`
 * assinado (não a sessão) que identifica empresa/usuário na volta. */
export function signEstadoOAuth(payload: EstadoOAuth): string {
  return jwt.sign(payload, SECRET, { expiresIn: '10m' })
}

export function verifyEstadoOAuth(token: string): EstadoOAuth {
  return jwt.verify(token, SECRET) as EstadoOAuth
}
