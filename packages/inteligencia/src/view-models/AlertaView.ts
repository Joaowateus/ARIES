import { KpiNome, KpiDominio } from '@soe/cap-08'

export interface AlertaView {
  id: string
  kpiNome: KpiNome
  dominio: KpiDominio
  valor: number
  baseline: number
  desvioPercent: number
  direcao: 'QUEDA' | 'ALTA'
  severidade: 'LEVE' | 'MODERADA' | 'CRITICA'
  periodo: string
  registradoEm: string
}

export interface AlertaFiltros {
  periodo?: string
  severidade?: Array<'LEVE' | 'MODERADA' | 'CRITICA'>
  dominio?: KpiDominio
  de?: string
  ate?: string
}
