import { IConfiguracaoEventPublisher, ConfiguracaoEvent } from '../../application/ports/IEventPublisher'

export class InMemoryConfiguracaoEventPublisher implements IConfiguracaoEventPublisher {
  events: ConfiguracaoEvent[] = []

  async publish(event: ConfiguracaoEvent): Promise<void> { this.events.push(event) }

  findByTipo(tipo: string): ConfiguracaoEvent[] { return this.events.filter(e => e.tipo === tipo) }
}
