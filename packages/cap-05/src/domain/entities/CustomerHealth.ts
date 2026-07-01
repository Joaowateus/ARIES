/**
 * CustomerHealth — snapshot do health score de um cliente em um momento.
 * Não possui estados; é criado a cada reavaliação.
 */

import { v4 as uuidv4 } from 'uuid'

export type HealthNivel = 'CRITICO' | 'BAIXO' | 'MEDIO' | 'ALTO' | 'EXCELENTE'

export interface CustomerHealthProps {
  id: string
  customerId: string
  score: number          // 0-100
  nivel: HealthNivel
  fatores: string[]      // motivos que compõem o score
  avaliadoEm: string
}

export function calcularNivel(score: number): HealthNivel {
  if (score < 20) return 'CRITICO'
  if (score < 40) return 'BAIXO'
  if (score < 65) return 'MEDIO'
  if (score < 85) return 'ALTO'
  return 'EXCELENTE'
}

export class CustomerHealth {
  private constructor(private props: CustomerHealthProps) {}

  static create(params: Omit<CustomerHealthProps, 'id' | 'nivel'>): CustomerHealth {
    if (params.score < 0 || params.score > 100) {
      throw new Error('CustomerHealth: score deve estar entre 0 e 100')
    }
    return new CustomerHealth({
      ...params,
      id: uuidv4(),
      nivel: calcularNivel(params.score),
    })
  }

  static reconstitute(props: CustomerHealthProps): CustomerHealth {
    return new CustomerHealth(props)
  }

  get id(): string { return this.props.id }
  get customerId(): string { return this.props.customerId }
  get score(): number { return this.props.score }
  get nivel(): HealthNivel { return this.props.nivel }
  get fatores(): readonly string[] { return [...this.props.fatores] }
  get avaliadoEm(): string { return this.props.avaliadoEm }

  toObject(): CustomerHealthProps { return { ...this.props, fatores: [...this.props.fatores] } }
}
