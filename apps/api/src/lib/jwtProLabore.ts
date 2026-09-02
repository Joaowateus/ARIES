import jwt from 'jsonwebtoken'

const SECRET = process.env.PRO_LABORE_JWT_SECRET ?? process.env.JWT_SECRET ?? 'dev-secret-pro-labore'

export interface ProLaboreJwtPayload {
  sub: string
  email: string
  nome: string
  papel: 'DONO' | 'VENDEDOR'
  vendedorId?: string
}

export function signProLaboreToken(payload: ProLaboreJwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: '30d' })
}

export function verifyProLaboreToken(token: string): ProLaboreJwtPayload {
  return jwt.verify(token, SECRET) as ProLaboreJwtPayload
}
