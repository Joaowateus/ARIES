/**
 * CustomerPortfolio — snapshot consolidado da carteira de clientes.
 * Leitura sob demanda; não possui estados próprios.
 */

import { v4 as uuidv4 } from 'uuid'
import { CustomerStatus } from './Customer'
import { HealthNivel } from './CustomerHealth'

export interface PortfolioSegment {
  segmentoId: string
  totalClientes: number
  healthMedio: number
}

export interface CustomerPortfolioProps {
  id: string
  totalClientes: number
  clientesPorStatus: Record<CustomerStatus, number>
  clientesPorNivelHealth: Record<HealthNivel, number>
  healthMedioGeral: number
  segmentos: PortfolioSegment[]
  calculadoEm: string
}

export class CustomerPortfolio {
  private constructor(private props: CustomerPortfolioProps) {}

  static create(params: Omit<CustomerPortfolioProps, 'id'>): CustomerPortfolio {
    return new CustomerPortfolio({ ...params, id: uuidv4() })
  }

  static reconstitute(props: CustomerPortfolioProps): CustomerPortfolio {
    return new CustomerPortfolio(props)
  }

  get id(): string { return this.props.id }
  get totalClientes(): number { return this.props.totalClientes }
  get clientesPorStatus(): Record<CustomerStatus, number> { return { ...this.props.clientesPorStatus } }
  get clientesPorNivelHealth(): Record<HealthNivel, number> { return { ...this.props.clientesPorNivelHealth } }
  get healthMedioGeral(): number { return this.props.healthMedioGeral }
  get segmentos(): readonly PortfolioSegment[] { return [...this.props.segmentos] }
  get calculadoEm(): string { return this.props.calculadoEm }

  toObject(): CustomerPortfolioProps {
    return { ...this.props, segmentos: [...this.props.segmentos] }
  }
}
