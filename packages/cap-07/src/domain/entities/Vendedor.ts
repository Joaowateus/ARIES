/**
 * Vendedor — membro da equipe comercial com metas e performance rastreadas.
 * RN-E01: todo vendedor deve ter meta mensal definida para o período ativo.
 * RN-E02: performance é calculada como % de atingimento da meta.
 */

import { v4 as uuidv4 } from 'uuid'

export type VendedorStatus = 'ATIVO' | 'INATIVO' | 'AFASTADO'
export type CargoVendedor = 'SDR' | 'AE' | 'CSM' | 'GERENTE' | 'DIRETOR'

export interface MetaMensal {
  periodo: string       // YYYY-MM
  metaReceita: number   // R$ MRR alvo
  metaOportunidades: number
  metaPropostas: number
}

export interface PerformanceMensal {
  periodo: string
  receitaRealizada: number
  oportunidadesAbertas: number
  propostasEnviadas: number
  taxaAtingimentoMeta: number   // 0-100+
  classificacao: 'ABAIXO' | 'DENTRO' | 'ACIMA'
}

export interface VendedorProps {
  id: string
  nome: string
  email: string
  cargo: CargoVendedor
  status: VendedorStatus
  gerenteId?: string
  metas: MetaMensal[]
  performances: PerformanceMensal[]
  criadoEm: string
  atualizadoEm: string
}

export class Vendedor {
  private constructor(private props: VendedorProps) {}

  static create(params: Omit<VendedorProps, 'id' | 'status' | 'metas' | 'performances' | 'criadoEm' | 'atualizadoEm'> & { agora: string }): Vendedor {
    if (!params.nome?.trim()) throw new Error('Vendedor: nome obrigatório')
    if (!params.email?.trim()) throw new Error('Vendedor: email obrigatório')
    return new Vendedor({
      ...params,
      id: uuidv4(),
      status: 'ATIVO',
      metas: [],
      performances: [],
      criadoEm: params.agora,
      atualizadoEm: params.agora,
    })
  }

  static reconstitute(props: VendedorProps): Vendedor {
    return new Vendedor(props)
  }

  get id(): string { return this.props.id }
  get nome(): string { return this.props.nome }
  get email(): string { return this.props.email }
  get cargo(): CargoVendedor { return this.props.cargo }
  get status(): VendedorStatus { return this.props.status }
  get gerenteId(): string | undefined { return this.props.gerenteId }
  get metas(): readonly MetaMensal[] { return [...this.props.metas] }
  get performances(): readonly PerformanceMensal[] { return [...this.props.performances] }
  get criadoEm(): string { return this.props.criadoEm }
  get atualizadoEm(): string { return this.props.atualizadoEm }

  definirMeta(meta: MetaMensal, agora: string): void {
    const idx = this.props.metas.findIndex(m => m.periodo === meta.periodo)
    if (idx >= 0) this.props.metas[idx] = meta
    else this.props.metas.push(meta)
    this.props.atualizadoEm = agora
  }

  registrarPerformance(perf: Omit<PerformanceMensal, 'taxaAtingimentoMeta' | 'classificacao'>, agora: string): void {
    const meta = this.props.metas.find(m => m.periodo === perf.periodo)
    if (!meta) throw new Error(`Vendedor: meta não definida para o período ${perf.periodo} (RN-E01)`)

    const taxaAtingimentoMeta = meta.metaReceita > 0
      ? Math.round((perf.receitaRealizada / meta.metaReceita) * 100)
      : 0

    const classificacao: PerformanceMensal['classificacao'] =
      taxaAtingimentoMeta >= 100 ? 'ACIMA' :
      taxaAtingimentoMeta >= 80 ? 'DENTRO' : 'ABAIXO'

    const registro: PerformanceMensal = { ...perf, taxaAtingimentoMeta, classificacao }
    const idx = this.props.performances.findIndex(p => p.periodo === perf.periodo)
    if (idx >= 0) this.props.performances[idx] = registro
    else this.props.performances.push(registro)
    this.props.atualizadoEm = agora
  }

  inativar(agora: string): void {
    this.props.status = 'INATIVO'
    this.props.atualizadoEm = agora
  }

  metaDoPeriodo(periodo: string): MetaMensal | undefined {
    return this.props.metas.find(m => m.periodo === periodo)
  }

  performanceDoPeriodo(periodo: string): PerformanceMensal | undefined {
    return this.props.performances.find(p => p.periodo === periodo)
  }

  toObject(): VendedorProps {
    return {
      ...this.props,
      metas: this.props.metas.map(m => ({ ...m })),
      performances: this.props.performances.map(p => ({ ...p })),
    }
  }
}
