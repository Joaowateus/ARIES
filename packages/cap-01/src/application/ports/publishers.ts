export interface KpiSnapshot {
  kpiId: string
  valor: number
  meta?: number
  periodo: string
  segmentoId?: string
}

export interface AlertaPayload {
  tipo: string
  severidade: 'baixa' | 'media' | 'alta' | 'critica'
  mensagem: string
  contexto: Record<string, unknown>
}

export interface IKpiPublisher {
  publicar(snapshot: KpiSnapshot): Promise<void>
}

export interface IAlertPublisher {
  publicar(alerta: AlertaPayload): Promise<void>
}
