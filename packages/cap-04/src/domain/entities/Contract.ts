/**
 * Contract — contrato comercial gerado a partir de uma venda ganha.
 * Estados: ATIVO → ENCERRADO | CANCELADO
 *
 * RN-R01: dataFim deve ser posterior a dataInicio.
 * RN-R02: valorTotal > 0.
 * RN-R03: mrr > 0 para contratos recorrentes (formaPagamento ≠ UNICO).
 * RN-R06: apenas contratos ATIVO podem ser encerrados ou cancelados.
 */

import { v4 as uuidv4 } from 'uuid'

export type ContractStatus = 'ATIVO' | 'ENCERRADO' | 'CANCELADO'
export type FormaPagamento = 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL' | 'UNICO'

export interface ContractProps {
  id: string
  oportunidadeId: string          // referência à oportunidade que originou o contrato
  dealCloseId: string
  clienteId: string
  status: ContractStatus
  valorTotal: number
  mrr: number
  arr: number                     // mrr * 12
  segmentoId?: string
  dataInicio: string
  dataFim: string
  formaPagamento: FormaPagamento
  condicoesJson: Record<string, unknown>
  responsavelCsId: string
  motivoCancelamento?: string
  criadoPor: string
  criadoEm: string
  atualizadoEm: string
  encerradoEm?: string
}

export class Contract {
  private constructor(private props: ContractProps) {}

  static create(params: Omit<ContractProps, 'id' | 'status' | 'arr' | 'criadoEm' | 'atualizadoEm'> & {
    agora: string
  }): Contract {
    if (params.valorTotal <= 0) {
      throw new Error('Contract: valorTotal deve ser > 0 (RN-R02)')
    }
    if (params.formaPagamento !== 'UNICO' && params.mrr <= 0) {
      throw new Error('Contract: mrr deve ser > 0 para contratos recorrentes (RN-R03)')
    }
    if (new Date(params.dataFim) <= new Date(params.dataInicio)) {
      throw new Error('Contract: dataFim deve ser posterior a dataInicio (RN-R01)')
    }

    return new Contract({
      ...params,
      id: uuidv4(),
      status: 'ATIVO',
      arr: params.mrr * 12,
      criadoEm: params.agora,
      atualizadoEm: params.agora,
    })
  }

  static reconstitute(props: ContractProps): Contract {
    return new Contract(props)
  }

  get id(): string { return this.props.id }
  get oportunidadeId(): string { return this.props.oportunidadeId }
  get dealCloseId(): string { return this.props.dealCloseId }
  get clienteId(): string { return this.props.clienteId }
  get status(): ContractStatus { return this.props.status }
  get valorTotal(): number { return this.props.valorTotal }
  get mrr(): number { return this.props.mrr }
  get arr(): number { return this.props.arr }
  get segmentoId(): string | undefined { return this.props.segmentoId }
  get dataInicio(): string { return this.props.dataInicio }
  get dataFim(): string { return this.props.dataFim }
  get formaPagamento(): FormaPagamento { return this.props.formaPagamento }
  get condicoesJson(): Record<string, unknown> { return { ...this.props.condicoesJson } }
  get responsavelCsId(): string { return this.props.responsavelCsId }
  get motivoCancelamento(): string | undefined { return this.props.motivoCancelamento }
  get criadoEm(): string { return this.props.criadoEm }
  get atualizadoEm(): string { return this.props.atualizadoEm }
  get encerradoEm(): string | undefined { return this.props.encerradoEm }

  estaAtivo(): boolean { return this.props.status === 'ATIVO' }

  encerrar(agora: string): void {
    this.assertAtivo('encerrar')
    this.props.status = 'ENCERRADO'
    this.props.encerradoEm = agora
    this.props.atualizadoEm = agora
  }

  cancelar(motivo: string, agora: string): void {
    this.assertAtivo('cancelar')
    if (!motivo?.trim()) throw new Error('Contract: motivo obrigatório para cancelamento (RN-R04)')
    this.props.status = 'CANCELADO'
    this.props.motivoCancelamento = motivo
    this.props.encerradoEm = agora
    this.props.atualizadoEm = agora
  }

  /** Vigência restante em dias a partir de `agora`. */
  diasRestantes(agora: string): number {
    const fim = new Date(this.props.dataFim).getTime()
    const hoje = new Date(agora).getTime()
    return Math.max(0, Math.floor((fim - hoje) / 86_400_000))
  }

  toObject(): ContractProps { return { ...this.props } }

  private assertAtivo(acao: string): void {
    if (!this.estaAtivo()) {
      throw new Error(`Contract: não é possível ${acao} contrato com status ${this.props.status} (RN-R06)`)
    }
  }
}
