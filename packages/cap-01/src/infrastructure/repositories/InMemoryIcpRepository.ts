import { IcpDefinition, IcpDefinitionProps } from '../../domain/entities/IcpDefinition'
import { IIcpRepository } from '../../application/ports/repositories'

export class InMemoryIcpRepository implements IIcpRepository {
  private store = new Map<string, IcpDefinitionProps>()

  async save(icp: IcpDefinition): Promise<void> {
    this.store.set(icp.id, icp.toObject())
  }

  async findById(id: string): Promise<IcpDefinition | null> {
    const props = this.store.get(id)
    return props ? IcpDefinition.reconstitute(props) : null
  }

  async findActive(): Promise<IcpDefinition | null> {
    for (const props of this.store.values()) {
      if (props.status === 'ATIVO') return IcpDefinition.reconstitute(props)
    }
    return null
  }

  async findAll(): Promise<IcpDefinition[]> {
    return [...this.store.values()].map(IcpDefinition.reconstitute)
  }

  clear(): void { this.store.clear() }
}
