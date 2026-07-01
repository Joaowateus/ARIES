import { Contract } from '../../domain/entities/Contract'
import { RevenueRecord } from '../../domain/entities/RevenueRecord'
import { ForecastEntry } from '../../domain/entities/ForecastEntry'

export interface IContractRepository {
  save(contract: Contract): Promise<void>
  findById(id: string): Promise<Contract | null>
  findByOportunidade(oportunidadeId: string): Promise<Contract | null>
  findByCliente(clienteId: string): Promise<Contract[]>
  findAtivos(): Promise<Contract[]>
  findAll(): Promise<Contract[]>
}

export interface IRevenueRepository {
  save(record: RevenueRecord): Promise<void>
  findById(id: string): Promise<RevenueRecord | null>
  findByContrato(contratoId: string): Promise<RevenueRecord[]>
  findByContratoPeriodo(contratoId: string, periodo: string): Promise<RevenueRecord | null>
  findAll(): Promise<RevenueRecord[]>
}

export interface IForecastRepository {
  save(entry: ForecastEntry): Promise<void>
  findByPeriodo(periodo: string): Promise<ForecastEntry | null>
  findLatest(): Promise<ForecastEntry | null>
}
