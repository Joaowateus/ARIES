import { Vendedor, CargoVendedor, VendedorStatus } from '../../domain/entities/Vendedor'
import { MetaEquipe } from '../../domain/entities/MetaEquipe'
import { AtribuicaoPlano } from '../../domain/entities/AtribuicaoPlano'

export interface IVendedorRepository {
  save(vendedor: Vendedor): Promise<void>
  findById(id: string): Promise<Vendedor | null>
  findByEmail(email: string): Promise<Vendedor | null>
  findAtivos(): Promise<Vendedor[]>
  findByCargo(cargo: CargoVendedor): Promise<Vendedor[]>
  findAll(): Promise<Vendedor[]>
}

export interface IMetaEquipeRepository {
  save(meta: MetaEquipe): Promise<void>
  findByPeriodo(periodo: string): Promise<MetaEquipe | null>
  findAll(): Promise<MetaEquipe[]>
}

export interface IAtribuicaoPlanoRepository {
  save(atribuicao: AtribuicaoPlano): Promise<void>
  findById(id: string): Promise<AtribuicaoPlano | null>
  findByVendedor(vendedorId: string): Promise<AtribuicaoPlano[]>
  findByPlano(planoAcaoId: string): Promise<AtribuicaoPlano[]>
  findPendentes(): Promise<AtribuicaoPlano[]>
}
