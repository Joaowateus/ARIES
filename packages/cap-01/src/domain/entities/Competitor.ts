/**
 * Competitor — concorrente mapeado.
 * RN-05: mínimo 3 concorrentes ativos; > 180 dias sem update → DESATUALIZADO.
 * Estados: ATIVO → DESATUALIZADO → MONITORAMENTO_REDUZIDO | DESCONTINUADO
 */

import { v4 as uuidv4 } from 'uuid'

export type CompetitorStatus = 'ATIVO' | 'DESATUALIZADO' | 'MONITORAMENTO_REDUZIDO' | 'DESCONTINUADO'
export type CompetitorTier = 'direto' | 'indireto' | 'substituto' | 'entrante'
export type UpdateSource = 'win_loss' | 'pesquisa' | 'cliente' | 'outra'

export interface CompetitorProps {
  id: string
  nome: string
  status: CompetitorStatus
  tier: CompetitorTier
  posicionamento: string
  precoReferencia?: string
  pontosFrotes: string[]
  pontosFracos: string[]
  comoVencer: string[]
  winRateContra?: number     // calculado a partir do Win/Loss
  ultimaAtualizacao: string
  fonteUltimaAtualizacao: UpdateSource
  criadoPor: string
  criadoEm: string
  atualizadoEm: string
}

export class Competitor {
  private constructor(private props: CompetitorProps) {}

  static create(
    params: Omit<CompetitorProps, 'id' | 'status' | 'criadoEm' | 'atualizadoEm'> & {
      agora: string
    },
  ): Competitor {
    if (!params.nome || params.nome.trim() === '') {
      throw new Error('Competitor: nome é obrigatório')
    }
    return new Competitor({
      ...params,
      id: uuidv4(),
      status: 'ATIVO',
      criadoEm: params.agora,
      atualizadoEm: params.agora,
    })
  }

  static reconstitute(props: CompetitorProps): Competitor {
    return new Competitor(props)
  }

  get id(): string { return this.props.id }
  get nome(): string { return this.props.nome }
  get status(): CompetitorStatus { return this.props.status }
  get tier(): CompetitorTier { return this.props.tier }
  get posicionamento(): string { return this.props.posicionamento }
  get precoReferencia(): string | undefined { return this.props.precoReferencia }
  get pontosFrotes(): string[] { return [...this.props.pontosFrotes] }
  get pontosFracos(): string[] { return [...this.props.pontosFracos] }
  get comoVencer(): string[] { return [...this.props.comoVencer] }
  get winRateContra(): number | undefined { return this.props.winRateContra }
  get ultimaAtualizacao(): string { return this.props.ultimaAtualizacao }
  get fonteUltimaAtualizacao(): UpdateSource { return this.props.fonteUltimaAtualizacao }
  get criadoEm(): string { return this.props.criadoEm }
  get atualizadoEm(): string { return this.props.atualizadoEm }

  atualizar(
    params: Partial<Pick<CompetitorProps, 'posicionamento' | 'precoReferencia' | 'pontosFrotes' | 'pontosFracos' | 'comoVencer' | 'tier'>>,
    fonte: UpdateSource,
    agora: string,
  ): void {
    if (this.props.status === 'DESCONTINUADO') {
      throw new Error('Competitor: concorrente descontinuado não pode ser atualizado')
    }
    Object.assign(this.props, params)
    this.props.fonteUltimaAtualizacao = fonte
    this.props.ultimaAtualizacao = agora
    this.props.atualizadoEm = agora
    if (this.props.status === 'DESATUALIZADO' || this.props.status === 'MONITORAMENTO_REDUZIDO') {
      this.props.status = 'ATIVO'
    }
  }

  atualizarWinRate(winRate: number, agora: string): void {
    if (winRate < 0 || winRate > 100) {
      throw new Error(`Competitor: winRate deve ser entre 0 e 100, recebido: ${winRate}`)
    }
    this.props.winRateContra = winRate
    this.props.atualizadoEm = agora
  }

  /** RN-05: verifica se está desatualizado (> 180 dias) */
  verificarFreshness(agora: string): void {
    const dias = this.diasSemAtualizacao(agora)
    if (dias > 180 && this.props.status === 'ATIVO') {
      this.props.status = 'DESATUALIZADO'
      this.props.atualizadoEm = agora
    }
  }

  diasSemAtualizacao(agora: string): number {
    const ultimo = new Date(this.props.ultimaAtualizacao).getTime()
    const hoje = new Date(agora).getTime()
    return Math.floor((hoje - ultimo) / 86_400_000)
  }

  descontinuar(agora: string): void {
    this.props.status = 'DESCONTINUADO'
    this.props.atualizadoEm = agora
  }

  estaDesatualizado(agora: string): boolean {
    return this.diasSemAtualizacao(agora) > 180
  }

  toObject(): CompetitorProps {
    return { ...this.props }
  }
}
