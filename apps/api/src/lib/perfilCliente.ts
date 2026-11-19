// Perfil do cliente (Funil, 19/11): como atender cada um. Fica no lead (campo opcional).
import { z } from 'zod'

export const PERFIS_CLIENTE = ['INDECISO', 'DETALHISTA', 'APRESSADO', 'NERVOSO'] as const
export type PerfilCliente = (typeof PERFIS_CLIENTE)[number]
/** Na edição do lead: um dos 4 perfis, null para limpar ou ausente para não mexer. */
export const perfilClienteSchema = z.enum(PERFIS_CLIENTE, { message: 'Perfil do cliente inválido' }).nullable().optional()
