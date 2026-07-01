/**
 * IcpCriteria — um critério individual do ICP.
 * RN-01: Todo critério DEVE ter dimensão + operador + valor(es) + peso.
 */

export type IcpOperator =
  | 'entre'
  | 'in'
  | 'maior_que'
  | 'menor_que'
  | 'minimo'
  | 'igual'

export interface IcpCriteriaProps {
  dimensao: string
  operador: IcpOperator
  valores?: string[]
  valor?: string
  peso: number
}

export class IcpCriteria {
  readonly dimensao: string
  readonly operador: IcpOperator
  readonly valores?: string[]
  readonly valor?: string
  readonly peso: number

  private constructor(props: IcpCriteriaProps) {
    this.dimensao = props.dimensao
    this.operador = props.operador
    this.valores = props.valores
    this.valor = props.valor
    this.peso = props.peso
  }

  static create(props: IcpCriteriaProps): IcpCriteria {
    if (!props.dimensao || props.dimensao.trim() === '') {
      throw new Error('IcpCriteria: dimensao é obrigatória')
    }
    if (props.peso <= 0 || props.peso > 1) {
      throw new Error(`IcpCriteria: peso deve ser entre 0 e 1, recebido: ${props.peso}`)
    }
    if (!props.valores?.length && !props.valor) {
      throw new Error('IcpCriteria: valores ou valor é obrigatório')
    }
    return new IcpCriteria(props)
  }

  toObject(): IcpCriteriaProps {
    return {
      dimensao: this.dimensao,
      operador: this.operador,
      valores: this.valores,
      valor: this.valor,
      peso: this.peso,
    }
  }
}
