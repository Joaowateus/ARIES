import { Contract } from '../../domain/entities/Contract'
import { IContractRepository } from '../../application/ports/repositories'

export class InMemoryContractRepository implements IContractRepository {
  private store = new Map<string, Contract>()
  private byOportunidade = new Map<string, string>()

  async save(contract: Contract): Promise<void> {
    this.store.set(contract.id, contract)
    this.byOportunidade.set(contract.oportunidadeId, contract.id)
  }

  async findById(id: string): Promise<Contract | null> {
    return this.store.get(id) ?? null
  }

  async findByOportunidade(oportunidadeId: string): Promise<Contract | null> {
    const id = this.byOportunidade.get(oportunidadeId)
    if (!id) return null
    return this.store.get(id) ?? null
  }

  async findByCliente(clienteId: string): Promise<Contract[]> {
    return [...this.store.values()].filter(c => c.clienteId === clienteId)
  }

  async findAtivos(): Promise<Contract[]> {
    return [...this.store.values()].filter(c => c.estaAtivo())
  }

  async findAll(): Promise<Contract[]> {
    return [...this.store.values()]
  }
}
