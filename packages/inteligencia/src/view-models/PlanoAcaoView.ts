import { AcaoStatus, PlanStatus } from '@soe/cap-08'

export interface AcaoView {
  id: string
  descricao: string
  responsavelId: string
  prazoIso: string
  criterioSucesso: string
  status: AcaoStatus
  resultadoReal?: string
  concluidaEm?: string
}

export interface PlanoAcaoView {
  id: string
  diagnosticoId: string
  titulo: string
  status: PlanStatus
  criadoPor: string
  acoes: AcaoView[]
  percentualConcluido: number
  prazoProximaAcao?: string   // earliest prazoIso among PENDENTE actions
  criadoEm: string
  concluidoEm?: string
}

export interface PlanoAcaoFiltros {
  status?: PlanStatus[]
  diagnosticoId?: string
}
