// PDF 04 · Papel de cada pessoa nas telas novas (Hoje, Lente, Pergunte ao ARIES)
// e nas métricas: o papel do login, refinado pela função de quem não vende.
import type { ProLaboreJwtPayload } from './jwtProLabore'
import type { Papel } from './metricas'

export type PapelHoje = Papel // DONO | SUPERVISOR | SDR | VENDEDOR | SOCIAL_MEDIA | TRAFEGO | FINANCEIRO

export function papelDoUsuario(u: Pick<ProLaboreJwtPayload, 'papel' | 'sdr' | 'funcao'>): PapelHoje {
  if (u.papel === 'DONO') return 'DONO'
  if (u.papel === 'SOCIAL_MEDIA') return 'SOCIAL_MEDIA'
  if (u.funcao === 'GESTOR_TRAFEGO') return 'TRAFEGO'
  if (u.funcao === 'FINANCEIRO') return 'FINANCEIRO'
  if (u.sdr) return 'SDR'
  if (u.papel === 'SUPERVISOR') return 'SUPERVISOR'
  return 'VENDEDOR'
}

/** Quem vê os números da loja inteira (os demais veem só a própria produção). */
export const veLoja = (p: PapelHoje) => p === 'DONO' || p === 'SUPERVISOR' || p === 'TRAFEGO' || p === 'FINANCEIRO' || p === 'SOCIAL_MEDIA'

export const NOME_PAPEL: Record<PapelHoje, string> = {
  DONO: 'Dono', SUPERVISOR: 'Supervisor', SDR: 'SDR', VENDEDOR: 'Vendedor', SOCIAL_MEDIA: 'Social media', TRAFEGO: 'Gestor de tráfego', FINANCEIRO: 'Financeiro',
}
