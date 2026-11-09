import jwt from 'jsonwebtoken'

const SECRET = process.env.PRO_LABORE_JWT_SECRET ?? process.env.JWT_SECRET ?? 'dev-secret-pro-labore'

export interface ProLaboreJwtPayload {
  sub: string
  email: string
  nome: string
  papel: 'DONO' | 'VENDEDOR' | 'SUPERVISOR' | 'SOCIAL_MEDIA'
  vendedorId?: string
  // SDR (pré-venda): vendedor que vê também os leads que qualifica.
  sdr?: boolean
  smMembroId?: string
  // PDF 04: função de quem não vende (lida do banco a cada pedido; não vai no token).
  funcao?: 'GESTOR_TRAFEGO' | 'FINANCEIRO' | null
}

export function signProLaboreToken(payload: ProLaboreJwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: '30d' })
}

export function verifyProLaboreToken(token: string): ProLaboreJwtPayload {
  return jwt.verify(token, SECRET) as ProLaboreJwtPayload
}
