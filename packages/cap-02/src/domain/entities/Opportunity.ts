/**
 * Opportunity — oportunidade comercial no pipeline.
 * Estados: PROSPECÇÃO → QUALIFICAÇÃO → PROPOSTA → NEGOCIAÇÃO → GANHA | PERDIDA | CANCELADA
 * RN-P01: avanço de estágio exige registro do motivo ao retroceder.
 * RN-P02: oportunidade GANHA ou PERDIDA é imutável (somente leitura).
 * RN-P03: valor estimado ≥ 0.
 * RN-P04: responsável é obrigatório.
 */

import { v4 as uuidv4 } from 'uuid'

export type OpportunityStage =
  | 'PROSPECCAO'
  | 'QUALIFICACAO'
  | 'PROPOSTA'
  | 'NEGOCIACAO'
  | 'GANHA'
  | 'PERDIDA'
  | 'CANCELADA'

export type OpportunityPriority = 'baixa' | 'media' | 'alta' | 'critica'

export interface OpportunityProps {
  id: string
  titulo: string
  clienteId: string
  responsavelId: string
  estagio: OpportunityStage
  prioridade: OpportunityPriority
  valorEstimado: number
  segmentoId?: string
  probabilidade: number       // 0-100
  dataFechamentoPrevista: string
  motivoEncerramento?: string
  concorrenteVencedorId?: string
  historiocoEstagios: { estagio: OpportunityStage; em: string }[]
  criadoPor: string
  criadoEm: string
  atualizadoEm: string
  encerradoEm?: string
}

const STAGE_ORDER: OpportunityStage[] = [
  'PROSPECCAO',
  'QUALIFICACAO',
  'PROPOSTA',
  'NEGOCIACAO',
]

const TERMINAL_STAGES: OpportunityStage[] = ['GANHA', 'PERDIDA', 'CANCELADA']

export class Opportunity {
  private constructor(private props: OpportunityProps) {}

  static create(
    params: Omit<OpportunityProps, 'id' | 'estagio' | 'historiocoEstagios' | 'criadoEm' | 'atualizadoEm'> & {
      agora: string
    },
  ): Opportunity {
    if (!params.responsavelId) throw new Error('Opportunity: responsavelId é obrigatório (RN-P04)')
    if (params.valorEstimado < 0) throw new Error('Opportunity: valorEstimado deve ser ≥ 0 (RN-P03)')
    if (!params.titulo?.trim()) throw new Error('Opportunity: título é obrigatório')

    return new Opportunity({
      ...params,
      id: uuidv4(),
      estagio: 'PROSPECCAO',
      historiocoEstagios: [{ estagio: 'PROSPECCAO', em: params.agora }],
      criadoEm: params.agora,
      atualizadoEm: params.agora,
    })
  }

  static reconstitute(props: OpportunityProps): Opportunity {
    return new Opportunity(props)
  }

  get id(): string { return this.props.id }
  get titulo(): string { return this.props.titulo }
  get clienteId(): string { return this.props.clienteId }
  get responsavelId(): string { return this.props.responsavelId }
  get estagio(): OpportunityStage { return this.props.estagio }
  get prioridade(): OpportunityPriority { return this.props.prioridade }
  get valorEstimado(): number { return this.props.valorEstimado }
  get segmentoId(): string | undefined { return this.props.segmentoId }
  get probabilidade(): number { return this.props.probabilidade }
  get dataFechamentoPrevista(): string { return this.props.dataFechamentoPrevista }
  get motivoEncerramento(): string | undefined { return this.props.motivoEncerramento }
  get concorrenteVencedorId(): string | undefined { return this.props.concorrenteVencedorId }
  get historiocoEstagios() { return [...this.props.historiocoEstagios] }
  get criadoEm(): string { return this.props.criadoEm }
  get atualizadoEm(): string { return this.props.atualizadoEm }
  get encerradoEm(): string | undefined { return this.props.encerradoEm }

  estaEncerrada(): boolean {
    return TERMINAL_STAGES.includes(this.props.estagio)
  }

  avancarEstagio(agora: string): void {
    this.assertNaoEncerrada('avançar estágio')
    const atual = STAGE_ORDER.indexOf(this.props.estagio)
    if (atual === -1 || atual === STAGE_ORDER.length - 1) {
      throw new Error(`Opportunity: estágio ${this.props.estagio} não pode ser avançado pelo fluxo padrão`)
    }
    this.props.estagio = STAGE_ORDER[atual + 1]
    this.props.historiocoEstagios.push({ estagio: this.props.estagio, em: agora })
    this.props.atualizadoEm = agora
  }

  marcarGanha(motivo: string, agora: string): void {
    this.assertNaoEncerrada('marcar como ganha')
    this.props.estagio = 'GANHA'
    this.props.motivoEncerramento = motivo
    this.props.encerradoEm = agora
    this.props.atualizadoEm = agora
    this.props.historiocoEstagios.push({ estagio: 'GANHA', em: agora })
  }

  marcarPerdida(motivo: string, concorrenteVencedorId: string | undefined, agora: string): void {
    this.assertNaoEncerrada('marcar como perdida')
    if (!motivo?.trim()) throw new Error('Opportunity: motivo de perda é obrigatório')
    this.props.estagio = 'PERDIDA'
    this.props.motivoEncerramento = motivo
    this.props.concorrenteVencedorId = concorrenteVencedorId
    this.props.encerradoEm = agora
    this.props.atualizadoEm = agora
    this.props.historiocoEstagios.push({ estagio: 'PERDIDA', em: agora })
  }

  cancelar(motivo: string, agora: string): void {
    this.assertNaoEncerrada('cancelar')
    if (!motivo?.trim()) throw new Error('Opportunity: motivo de cancelamento é obrigatório')
    this.props.estagio = 'CANCELADA'
    this.props.motivoEncerramento = motivo
    this.props.encerradoEm = agora
    this.props.atualizadoEm = agora
    this.props.historiocoEstagios.push({ estagio: 'CANCELADA', em: agora })
  }

  atualizarProbabilidade(prob: number, agora: string): void {
    if (prob < 0 || prob > 100) throw new Error('Opportunity: probabilidade deve estar entre 0 e 100')
    this.props.probabilidade = prob
    this.props.atualizadoEm = agora
  }

  atualizarValor(valor: number, agora: string): void {
    if (valor < 0) throw new Error('Opportunity: valor deve ser ≥ 0 (RN-P03)')
    this.props.valorEstimado = valor
    this.props.atualizadoEm = agora
  }

  cicloEmDias(agora: string): number {
    const inicio = new Date(this.props.criadoEm).getTime()
    const fim = new Date(this.props.encerradoEm ?? agora).getTime()
    return Math.floor((fim - inicio) / 86_400_000)
  }

  toObject(): OpportunityProps {
    return { ...this.props, historiocoEstagios: [...this.props.historiocoEstagios] }
  }

  private assertNaoEncerrada(acao: string): void {
    if (this.estaEncerrada()) {
      throw new Error(`Opportunity: não é possível ${acao} em oportunidade ${this.props.estagio} (RN-P02)`)
    }
  }
}
