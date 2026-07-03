import { Request, Response, NextFunction } from 'express'
import { logger } from '../lib/logger'

export interface AppError extends Error {
  statusCode?: number
  code?: string
}

export function errorHandler(err: AppError, req: Request, res: Response, _next: NextFunction): void {
  const traceId = req.requestId ?? 'unknown'
  const statusCode = err.statusCode ?? 500
  const code = err.code ?? 'INTERNAL_ERROR'

  if (statusCode >= 500) {
    logger.error({ traceId, err, path: req.path, method: req.method }, 'Unhandled error')
  }

  res.status(statusCode).json({
    success: false,
    code,
    message: statusCode >= 500 && process.env.NODE_ENV === 'production'
      ? 'Erro interno do servidor'
      : err.message,
    traceId,
  })
}

export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    message: `Rota não encontrada: ${req.method} ${req.path}`,
    traceId: req.requestId ?? 'unknown',
  })
}
