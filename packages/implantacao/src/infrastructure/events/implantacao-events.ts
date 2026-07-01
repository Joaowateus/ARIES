import { z } from 'zod'

export const EmpresaCriadaPayload = z.object({
  empresaId: z.string().uuid(),
  nome: z.string(),
  cnpj: z.string().length(14),
  segmento: z.string(),
  porte: z.enum(['MEI', 'ME', 'EPP', 'MEDIO', 'GRANDE']),
  adminId: z.string().uuid(),
  adminEmail: z.string().email(),
  criadaEm: z.string(),
})

export const UsuarioConvidadoPayload = z.object({
  usuarioId: z.string().uuid(),
  empresaId: z.string().uuid(),
  email: z.string().email(),
  papel: z.enum(['ADMIN', 'GERENTE', 'VENDEDOR', 'SDR', 'CS', 'FINANCEIRO']),
  convidadoPorId: z.string().uuid(),
  criadoEm: z.string(),
})

export const LoginRealizadoPayload = z.object({
  sessaoToken: z.string().uuid(),
  usuarioId: z.string().uuid(),
  empresaId: z.string().uuid(),
  papel: z.enum(['ADMIN', 'GERENTE', 'VENDEDOR', 'SDR', 'CS', 'FINANCEIRO']),
  realizadoEm: z.string(),
})

export const EmpresaAtivadaPayload = z.object({
  empresaId: z.string().uuid(),
  totalUsuarios: z.number().int().positive(),
  ativadaEm: z.string(),
})

export type EmpresaCriadaPayload = z.infer<typeof EmpresaCriadaPayload>
export type UsuarioConvidadoPayload = z.infer<typeof UsuarioConvidadoPayload>
export type LoginRealizadoPayload = z.infer<typeof LoginRealizadoPayload>
export type EmpresaAtivadaPayload = z.infer<typeof EmpresaAtivadaPayload>
