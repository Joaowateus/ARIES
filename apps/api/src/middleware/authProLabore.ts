import { Request, Response, NextFunction } from 'express'
import { verifyProLaboreToken, ProLaboreJwtPayload } from '../lib/jwtProLabore'

declare global {
  namespace Express {
    interface Request {
      proLaboreUser?: ProLaboreJwtPayload
    }
  }
}

export function requireProLaboreAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Não autorizado' })
    return
  }
  try {
    req.proLaboreUser = verifyProLaboreToken(header.slice(7))
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' })
  }
}

// Algumas rotas (parâmetros, gestão de vendedores, gastos com anúncio) são
// exclusivas do dono da operação — um vendedor com login não pode acessá-las.
export function requireDono(req: Request, res: Response, next: NextFunction): void {
  if (req.proLaboreUser?.papel !== 'DONO') {
    res.status(403).json({ error: 'Acesso restrito ao dono da operação' })
    return
  }
  next()
}
