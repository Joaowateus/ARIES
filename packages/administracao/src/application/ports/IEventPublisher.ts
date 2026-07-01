export interface AdministracaoEvent {
  tipo: string
  empresaId: string
  ocorridoEm: string
  payload: Record<string, unknown>
}

export interface IEventPublisher {
  publish(event: AdministracaoEvent): Promise<void>
}
