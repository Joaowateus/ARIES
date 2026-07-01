/**
 * MarketSegment — segmento de mercado com critérios objetivos de entrada/saída.
 * Estados: PROPOSTO → VALIDADO → ATIVO → EM_REVISAO → DESCONTINUADO
 */

import { v4 as uuidv4 } from 'uuid'

export type SegmentStatus = 'PROPOSTO' | 'VALIDADO' | 'ATIVO' | 'EM_REVISAO' | 'DESCONTINUADO'

export interface BuyerPersona {
  id: string
  titulo: string
  doresPrincipais: string[]
  gatilhosDeCompra: string[]
}

export interface CommonObjection {
  objecao: string
  respostaPosicionamento: string
}

export interface SegmentKpiBenchmark {
  winRateEsperado?: number
  cicloMedioDias?: number
  ticketMedio?: number
}

export interface MarketSegmentProps {
  id: string
  nome: string
  status: SegmentStatus
  criteriosEntrada: string[]
  propostaDeValorPrincipal: string
  personasCompradoras: BuyerPersona[]
  perguntasDeQualificacao: string[]
  objecoesComuns: CommonObjection[]
  kpisBenchmark: SegmentKpiBenchmark
  criadoPor: string
  criadoEm: string
  atualizadoEm: string
}

export class MarketSegment {
  private constructor(private props: MarketSegmentProps) {}

  static create(
    params: Omit<MarketSegmentProps, 'id' | 'status' | 'criadoEm' | 'atualizadoEm'> & {
      agora: string
    },
  ): MarketSegment {
    if (!params.nome || params.nome.trim() === '') {
      throw new Error('MarketSegment: nome é obrigatório')
    }
    if (params.criteriosEntrada.length === 0) {
      throw new Error('MarketSegment: ao menos um critério de entrada é obrigatório')
    }
    return new MarketSegment({
      ...params,
      id: uuidv4(),
      status: 'PROPOSTO',
      criadoEm: params.agora,
      atualizadoEm: params.agora,
    })
  }

  static reconstitute(props: MarketSegmentProps): MarketSegment {
    return new MarketSegment(props)
  }

  get id(): string { return this.props.id }
  get nome(): string { return this.props.nome }
  get status(): SegmentStatus { return this.props.status }
  get criteriosEntrada(): string[] { return [...this.props.criteriosEntrada] }
  get propostaDeValorPrincipal(): string { return this.props.propostaDeValorPrincipal }
  get personasCompradoras(): BuyerPersona[] { return [...this.props.personasCompradoras] }
  get perguntasDeQualificacao(): string[] { return [...this.props.perguntasDeQualificacao] }
  get objecoesComuns(): CommonObjection[] { return [...this.props.objecoesComuns] }
  get kpisBenchmark(): SegmentKpiBenchmark { return { ...this.props.kpisBenchmark } }
  get criadoPor(): string { return this.props.criadoPor }
  get criadoEm(): string { return this.props.criadoEm }
  get atualizadoEm(): string { return this.props.atualizadoEm }

  validar(agora: string): void {
    this.assertStatus('PROPOSTO', 'validar')
    this.props.status = 'VALIDADO'
    this.props.atualizadoEm = agora
  }

  ativar(agora: string): void {
    if (this.props.status !== 'VALIDADO' && this.props.status !== 'EM_REVISAO') {
      throw new Error(`MarketSegment: não é possível ativar em status ${this.props.status}`)
    }
    this.props.status = 'ATIVO'
    this.props.atualizadoEm = agora
  }

  iniciarRevisao(agora: string): void {
    this.assertStatus('ATIVO', 'iniciar revisão')
    this.props.status = 'EM_REVISAO'
    this.props.atualizadoEm = agora
  }

  descontinuar(agora: string): void {
    if (this.props.status === 'DESCONTINUADO') return
    this.props.status = 'DESCONTINUADO'
    this.props.atualizadoEm = agora
  }

  atualizarPerguntasDeQualificacao(perguntas: string[], agora: string): void {
    this.props.perguntasDeQualificacao = perguntas
    this.props.atualizadoEm = agora
  }

  atualizarObjecoes(objecoes: CommonObjection[], agora: string): void {
    this.props.objecoesComuns = objecoes
    this.props.atualizadoEm = agora
  }

  toObject(): MarketSegmentProps {
    return { ...this.props }
  }

  private assertStatus(expected: SegmentStatus, action: string): void {
    if (this.props.status !== expected) {
      throw new Error(`MarketSegment: não é possível ${action} em status ${this.props.status}`)
    }
  }
}
