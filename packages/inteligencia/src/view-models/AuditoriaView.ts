import { CategoriaAuditoria } from '@soe/cap-09'

export interface AuditoriaView {
  id: string
  modulo: string          // derivado de entidadeTipo para apresentação
  categoria: CategoriaAuditoria
  acao: string
  entidadeTipo: string
  entidadeId: string
  realizadoPor: string
  payload: Record<string, unknown>
  ocorridoEm: string
}

export interface AuditoriaFiltros {
  realizadoPor?: string
  categoria?: CategoriaAuditoria
  entidadeTipo?: string
  de?: string
  ate?: string
}
