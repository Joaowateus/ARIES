/**
 * Proposal — proposta comercial versionada, validada contra a política vigente.
 *
 * Estados: RASCUNHO → EM_APROVACAO → APROVADA → ENVIADA
 *                  ↘                ↘
 *                  REPROVADA        CANCELADA
 *
 * RN-G03: apenas uma proposta ATIVA (RASCUNHO | EM_APROVACAO | APROVADA) por oportunidade.
 * RN-G04: proposta com desconto acima da alçada do responsável → EM_APROVACAO obrigatório.
 * RN-G05: proposta só pode ser ENVIADA ao cliente se estiver APROVADA.
 * RN-G06: condições comerciais devem obedecer à política vigente no momento da criação.
 */

import { v4 as uuidv4 } from 'uuid'
import { NivelAlcada } from './CommercialPolicy'

export type ProposalStatus =
  | 'RASCUNHO'
  | 'EM_APROVACAO'
  | 'APROVADA'
  | 'REPROVADA'
  | 'ENVIADA'
  | 'CANCELADA'

export interface PolicyValidation {
  conforme: boolean
  violacoes: string[]            // lista de violações identificadas
  alcadaNecessaria: NivelAlcada  // alçada necessária para aprovação
  alcadaResponsavel: NivelAlcada // alçada do responsável pela proposta
  exigeAprovacao: boolean        // true se alcadaNecessaria > alcadaResponsavel
}

export interface ProposalProps {
  id: string
  oportunidadeId: string
  clienteId: string
  policyId: string
  versao: number
  status: ProposalStatus
  valorBruto: number
  percentualDesconto: number     // 0–100
  valorLiquido: number           // valorBruto * (1 - percentualDesconto/100)
  margemPercent: number          // margem líquida sobre valorBruto
  responsavelId: string
  alcadaResponsavel: NivelAlcada
  policyValidation: PolicyValidation
  condicoesJson: Record<string, unknown>
  motivoReprovacao?: string
  criadoPor: string
  criadoEm: string
  atualizadoEm: string
  enviadaEm?: string
}

export class Proposal {
  private constructor(private props: ProposalProps) {}

  static create(params: Omit<ProposalProps, 'id' | 'valorLiquido' | 'criadoEm' | 'atualizadoEm'> & {
    agora: string
  }): Proposal {
    if (params.valorBruto <= 0) throw new Error('Proposal: valorBruto deve ser > 0 (RN-G06)')
    if (params.percentualDesconto < 0 || params.percentualDesconto >= 100) {
      throw new Error('Proposal: percentualDesconto deve estar entre 0 e 99.99%')
    }

    const valorLiquido = params.valorBruto * (1 - params.percentualDesconto / 100)

    // RN-G04: se exige aprovação, status inicial é EM_APROVACAO
    const status: ProposalStatus = params.policyValidation.exigeAprovacao
      ? 'EM_APROVACAO'
      : 'RASCUNHO'

    return new Proposal({
      ...params,
      id: uuidv4(),
      valorLiquido,
      status,
      criadoEm: params.agora,
      atualizadoEm: params.agora,
    })
  }

  static reconstitute(props: ProposalProps): Proposal {
    return new Proposal(props)
  }

  get id(): string { return this.props.id }
  get oportunidadeId(): string { return this.props.oportunidadeId }
  get clienteId(): string { return this.props.clienteId }
  get policyId(): string { return this.props.policyId }
  get versao(): number { return this.props.versao }
  get status(): ProposalStatus { return this.props.status }
  get valorBruto(): number { return this.props.valorBruto }
  get percentualDesconto(): number { return this.props.percentualDesconto }
  get valorLiquido(): number { return this.props.valorLiquido }
  get margemPercent(): number { return this.props.margemPercent }
  get responsavelId(): string { return this.props.responsavelId }
  get alcadaResponsavel(): NivelAlcada { return this.props.alcadaResponsavel }
  get policyValidation(): PolicyValidation { return { ...this.props.policyValidation } }
  get condicoesJson(): Record<string, unknown> { return { ...this.props.condicoesJson } }
  get motivoReprovacao(): string | undefined { return this.props.motivoReprovacao }
  get criadoPor(): string { return this.props.criadoPor }
  get criadoEm(): string { return this.props.criadoEm }
  get atualizadoEm(): string { return this.props.atualizadoEm }
  get enviadaEm(): string | undefined { return this.props.enviadaEm }

  estaAtiva(): boolean {
    return ['RASCUNHO', 'EM_APROVACAO', 'APROVADA'].includes(this.props.status)
  }

  aprovar(agora: string): void {
    if (this.props.status !== 'EM_APROVACAO') {
      throw new Error(`Proposal: apenas propostas EM_APROVACAO podem ser aprovadas (atual: ${this.props.status})`)
    }
    this.props.status = 'APROVADA'
    this.props.atualizadoEm = agora
  }

  reprovar(motivo: string, agora: string): void {
    if (this.props.status !== 'EM_APROVACAO') {
      throw new Error(`Proposal: apenas propostas EM_APROVACAO podem ser reprovadas (atual: ${this.props.status})`)
    }
    if (!motivo?.trim()) throw new Error('Proposal: motivo de reprovação obrigatório')
    this.props.status = 'REPROVADA'
    this.props.motivoReprovacao = motivo
    this.props.atualizadoEm = agora
  }

  /** RN-G05: apenas proposta APROVADA pode ser enviada ao cliente. */
  enviar(agora: string): void {
    if (this.props.status !== 'APROVADA') {
      throw new Error(`Proposal: apenas propostas APROVADA podem ser enviadas (atual: ${this.props.status}) (RN-G05)`)
    }
    this.props.status = 'ENVIADA'
    this.props.enviadaEm = agora
    this.props.atualizadoEm = agora
  }

  cancelar(agora: string): void {
    if (this.props.status === 'ENVIADA' || this.props.status === 'CANCELADA') {
      throw new Error(`Proposal: não é possível cancelar proposta com status ${this.props.status}`)
    }
    this.props.status = 'CANCELADA'
    this.props.atualizadoEm = agora
  }

  toObject(): ProposalProps {
    return { ...this.props, policyValidation: { ...this.props.policyValidation, violacoes: [...this.props.policyValidation.violacoes] } }
  }
}
