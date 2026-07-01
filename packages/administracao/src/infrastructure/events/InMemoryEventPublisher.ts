import { IEventPublisher, AdministracaoEvent } from '../../application/ports/IEventPublisher'

export class InMemoryEventPublisher implements IEventPublisher {
  events: AdministracaoEvent[] = []

  async publish(event: AdministracaoEvent): Promise<void> {
    this.events.push(event)
  }

  findByTipo(tipo: string): AdministracaoEvent[] {
    return this.events.filter(e => e.tipo === tipo)
  }
}
