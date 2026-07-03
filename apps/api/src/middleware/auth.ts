import { Request, Response, NextFunction } from 'express'
import { verifyToken, JwtPayload } from '../lib/jwt'

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Não autorizado' })
    return
  }
  try {
    req.user = verifyToken(header.slice(7))
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' })
  }
}

export function requirePapel(...papeis: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !papeis.includes(req.user.papel)) {
      res.status(403).json({ error: 'Permissão insuficiente' })
      return
    }
    next()
  }
}
