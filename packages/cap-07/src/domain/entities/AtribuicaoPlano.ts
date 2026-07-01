/**
 * AtribuicaoPlano — vínculo entre um plano de ação do CAP-08 e um vendedor responsável.
 * Garante rastreabilidade entre decisões operacionais e executores humanos.
 * RN-E04: toda ação de um plano CAP-08 deve ter um responsável na equipe comercial.
 */

import { v4 as uuidv4 } from 'uuid'

export type StatusAtribuicao = 'PENDENTE' | 'EM_EXECUCAO' | 'CONCLUIDA' | 'CANCELADA'

export interface AtribuicaoPlanoProps {
  id: string
  planoAcaoId: string     // referência ao ActionPlan do CAP-08
  acaoId: string          // referência à Acao dentro do plano
  vendedorId: string
  descricaoAcao: string
  prazoIso: string
  criterioSucesso: string
  status: StatusAtribuicao
  observacao?: string
  concluidaEm?: string
  criadoEm: string
  atualizadoEm: string
}

export class AtribuicaoPlano {
  private constructor(private props: AtribuicaoPlanoProps) {}

  static create(params: Omit<AtribuicaoPlanoProps, 'id' | 'status' | 'criadoEm' | 'atualizadoEm'> & { agora: string }): AtribuicaoPlano {
    if (!params.vendedorId?.trim()) throw new Error('AtribuicaoPlano: vendedorId obrigatório (RN-E04)')
    if (!params.criterioSucesso?.trim()) throw new Error('AtribuicaoPlano: criterioSucesso obrigatório (RN-E04)')
    return new AtribuicaoPlano({
      ...params,
      id: uuidv4(),
      status: 'PENDENTE',
      criadoEm: params.agora,
      atualizadoEm: params.agora,
    })
  }

  static reconstitute(props: AtribuicaoPlanoProps): AtribuicaoPlano {
    return new AtribuicaoPlano(props)
  }

  get id(): string { return this.props.id }
  get planoAcaoId(): string { return this.props.planoAcaoId }
  get acaoId(): string { return this.props.acaoId }
  get vendedorId(): string { return this.props.vendedorId }
  get descricaoAcao(): string { return this.props.descricaoAcao }
  get prazoIso(): string { return this.props.prazoIso }
  get criterioSucesso(): string { return this.props.criterioSucesso }
  get status(): StatusAtribuicao { return this.props.status }
  get observacao(): string | undefined { return this.props.observacao }
  get concluidaEm(): string | undefined { return this.props.concluidaEm }

  iniciarExecucao(agora: string): void {
    if (this.props.status !== 'PENDENTE') throw new Error('AtribuicaoPlano: só pode iniciar execução de atribuições PENDENTES')
    this.props.status = 'EM_EXECUCAO'
    this.props.atualizadoEm = agora
  }

  concluir(observacao: string, agora: string): void {
    if (this.props.status === 'CONCLUIDA') throw new Error('AtribuicaoPlano: já concluída')
    this.props.status = 'CONCLUIDA'
    this.props.observacao = observacao
    this.props.concluidaEm = agora
    this.props.atualizadoEm = agora
  }

  cancelar(agora: string): void {
    this.props.status = 'CANCELADA'
    this.props.atualizadoEm = agora
  }

  toObject(): AtribuicaoPlanoProps {
    return { ...this.props }
  }
}
