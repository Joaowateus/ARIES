/**
 * ActionPlan — plano de ação criado pela Engine de Correção.
 *
 * Cada ação tem um responsável, prazo e critério de sucesso verificável.
 * RN-D04: plano exige responsável, prazo e critério de sucesso para cada ação.
 * RN-D05: toda execução de plano gera um registro para a Engine de Aprendizado.
 */

import { v4 as uuidv4 } from 'uuid'

export type AcaoStatus = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA'
export type PlanStatus = 'ATIVO' | 'CONCLUIDO' | 'CANCELADO'

export interface Acao {
  id: string
  descricao: string
  responsavelId: string
  prazoIso: string           // ISO date
  criterioSucesso: string    // critério mensurável
  status: AcaoStatus
  resultadoReal?: string     // preenchido ao concluir
  concluidaEm?: string
}

export interface ActionPlanProps {
  id: string
  diagnosticoId: string
  titulo: string
  status: PlanStatus
  acoes: Acao[]
  criadoPor: string
  criadoEm: string
  atualizadoEm: string
  concluidoEm?: string
}

export class ActionPlan {
  private constructor(private props: ActionPlanProps) {}

  static create(params: Omit<ActionPlanProps, 'id' | 'status' | 'criadoEm' | 'atualizadoEm'> & {
    agora: string
  }): ActionPlan {
    if (params.acoes.length === 0) {
      throw new Error('ActionPlan: ao menos uma ação é obrigatória (RN-D04)')
    }
    for (const acao of params.acoes) {
      if (!acao.responsavelId?.trim()) throw new Error(`ActionPlan: ação "${acao.descricao}" sem responsável (RN-D04)`)
      if (!acao.criterioSucesso?.trim()) throw new Error(`ActionPlan: ação "${acao.descricao}" sem critério de sucesso (RN-D04)`)
    }

    return new ActionPlan({
      ...params,
      id: uuidv4(),
      status: 'ATIVO',
      criadoEm: params.agora,
      atualizadoEm: params.agora,
    })
  }

  static reconstitute(props: ActionPlanProps): ActionPlan {
    return new ActionPlan(props)
  }

  get id(): string { return this.props.id }
  get diagnosticoId(): string { return this.props.diagnosticoId }
  get titulo(): string { return this.props.titulo }
  get status(): PlanStatus { return this.props.status }
  get acoes(): readonly Acao[] { return [...this.props.acoes] }
  get criadoPor(): string { return this.props.criadoPor }
  get criadoEm(): string { return this.props.criadoEm }
  get atualizadoEm(): string { return this.props.atualizadoEm }
  get concluidoEm(): string | undefined { return this.props.concluidoEm }

  concluirAcao(acaoId: string, resultadoReal: string, agora: string): void {
    const acao = this.props.acoes.find(a => a.id === acaoId)
    if (!acao) throw new Error(`Ação ${acaoId} não encontrada no plano`)
    if (!resultadoReal?.trim()) throw new Error('ActionPlan: resultadoReal obrigatório ao concluir ação')
    acao.status = 'CONCLUIDA'
    acao.resultadoReal = resultadoReal
    acao.concluidaEm = agora
    this.props.atualizadoEm = agora

    if (this.props.acoes.every(a => a.status === 'CONCLUIDA' || a.status === 'CANCELADA')) {
      this.props.status = 'CONCLUIDO'
      this.props.concluidoEm = agora
    }
  }

  percentualConcluido(): number {
    const concluidas = this.props.acoes.filter(a => a.status === 'CONCLUIDA').length
    return Math.round((concluidas / this.props.acoes.length) * 100)
  }

  toObject(): ActionPlanProps {
    return {
      ...this.props,
      acoes: this.props.acoes.map(a => ({ ...a })),
    }
  }
}
