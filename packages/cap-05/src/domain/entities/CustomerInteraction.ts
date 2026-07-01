/**
 * CustomerInteraction — registro de interação com o cliente (reunião, e-mail, etc.).
 */

import { v4 as uuidv4 } from 'uuid'

export type InteractionTipo = 'REUNIAO' | 'EMAIL' | 'LIGACAO' | 'SUPORTE' | 'OUTROS'

export interface CustomerInteractionProps {
  id: string
  customerId: string
  tipo: InteractionTipo
  descricao: string
  realizadoPor: string
  realizadoEm: string
}

export class CustomerInteraction {
  private constructor(private props: CustomerInteractionProps) {}

  static create(params: Omit<CustomerInteractionProps, 'id'>): CustomerInteraction {
    if (!params.descricao?.trim()) throw new Error('CustomerInteraction: descricao obrigatória')
    if (!params.realizadoPor?.trim()) throw new Error('CustomerInteraction: realizadoPor obrigatório')
    return new CustomerInteraction({ ...params, id: uuidv4() })
  }

  static reconstitute(props: CustomerInteractionProps): CustomerInteraction {
    return new CustomerInteraction(props)
  }

  get id(): string { return this.props.id }
  get customerId(): string { return this.props.customerId }
  get tipo(): InteractionTipo { return this.props.tipo }
  get descricao(): string { return this.props.descricao }
  get realizadoPor(): string { return this.props.realizadoPor }
  get realizadoEm(): string { return this.props.realizadoEm }

  toObject(): CustomerInteractionProps { return { ...this.props } }
}
