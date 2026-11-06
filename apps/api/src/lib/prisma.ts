import { PrismaClient } from '@prisma/client'
import { middlewareAutor } from './autorAuditoria'
import { middlewareVendaConfirmada } from './vendaConfirmada'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

// Autor de cada escrita nas tabelas auditadas (a trilha é gravada pelo banco).
// Só instala uma vez, mesmo com o cliente reaproveitado entre recargas.
const marcado = prisma as unknown as { __autorAuditoria?: boolean }
if (!marcado.__autorAuditoria) { prisma.$use(middlewareAutor); prisma.$use(middlewareVendaConfirmada); marcado.__autorAuditoria = true }

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
