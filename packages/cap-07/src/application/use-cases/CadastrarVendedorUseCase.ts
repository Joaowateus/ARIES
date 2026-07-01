import { Vendedor, CargoVendedor } from '../../domain/entities/Vendedor'
import { IVendedorRepository } from '../ports/repositories'

export interface CadastrarVendedorInput {
  nome: string
  email: string
  cargo: CargoVendedor
  gerenteId?: string
  agora: string
}

export interface CadastrarVendedorOutput {
  vendedor: ReturnType<Vendedor['toObject']>
  jaExistia: boolean
}

export class CadastrarVendedorUseCase {
  constructor(private readonly repo: IVendedorRepository) {}

  async execute(input: CadastrarVendedorInput): Promise<CadastrarVendedorOutput> {
    const existente = await this.repo.findByEmail(input.email)
    if (existente) return { vendedor: existente.toObject(), jaExistia: true }

    const vendedor = Vendedor.create(input)
    await this.repo.save(vendedor)
    return { vendedor: vendedor.toObject(), jaExistia: false }
  }
}
