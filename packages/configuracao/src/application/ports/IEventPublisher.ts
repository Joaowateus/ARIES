export interface ConfiguracaoEvent {
  tipo: string
  empresaId: string
  ocorridoEm: string
  payload: Record<string, unknown>
}

export interface IConfiguracaoEventPublisher {
  publish(event: ConfiguracaoEvent): Promise<void>
}
