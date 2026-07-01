/**
 * RegraGovernanca — regra de negócio configurável que governa comportamentos automáticos.
 *
 * Permite que o sistema ajuste suas próprias regras operacionais com base em aprendizado
 * (saída do CAP-08) sem necessidade de deploy de código.
 * RN-G03: toda regra deve ter critério de ativação e ação resultante claramente definidos.
 * RN-G04: regras críticas só podem ser desativadas por nível GERENTE ou superior.
 */

import { v4 as uuidv4 } from 'uuid'

export type TipoRegra =
  | 'LIMIAR_ANOMALIA'       // threshold de detecção de anomalia
  | 'CLASSIFICACAO'         // heurística de classificação de diagnóstico
  | 'PESO_MUP'              // pesos do score MUP
  | 'ALCADA_APROVACAO'      // limites de alçada para aprovação
  | 'ALERTA_PERFORMANCE'    // regras de alerta de performance da equipe

export interface RegraGovernancaProps {
  id: string
  tipo: TipoRegra
  nome: string
  descricao: string
  criterioAtivacao: string   // quando esta regra é aplicada
  acaoResultante: string     // o que acontece quando ativada
  parametros: Record<string, unknown>
  ativo: boolean
  versao: number
  criadoEm: string
  atualizadoEm: string
}

export class RegraGovernanca {
  private constructor(private props: RegraGovernancaProps) {}

  static create(params: Omit<RegraGovernancaProps, 'id' | 'versao' | 'criadoEm' | 'atualizadoEm'> & { agora: string }): RegraGovernanca {
    if (!params.criterioAtivacao?.trim()) throw new Error('RegraGovernanca: criterioAtivacao obrigatório (RN-G03)')
    if (!params.acaoResultante?.trim()) throw new Error('RegraGovernanca: acaoResultante obrigatório (RN-G03)')
    return new RegraGovernanca({
      ...params,
      id: uuidv4(),
      versao: 1,
      criadoEm: params.agora,
      atualizadoEm: params.agora,
    })
  }

  static reconstitute(props: RegraGovernancaProps): RegraGovernanca {
    return new RegraGovernanca(props)
  }

  get id(): string { return this.props.id }
  get tipo(): TipoRegra { return this.props.tipo }
  get nome(): string { return this.props.nome }
  get descricao(): string { return this.props.descricao }
  get criterioAtivacao(): string { return this.props.criterioAtivacao }
  get acaoResultante(): string { return this.props.acaoResultante }
  get parametros(): Record<string, unknown> { return { ...this.props.parametros } }
  get ativo(): boolean { return this.props.ativo }
  get versao(): number { return this.props.versao }
  get criadoEm(): string { return this.props.criadoEm }
  get atualizadoEm(): string { return this.props.atualizadoEm }

  atualizarParametros(novosParametros: Record<string, unknown>, agora: string): void {
    this.props.parametros = { ...this.props.parametros, ...novosParametros }
    this.props.versao++
    this.props.atualizadoEm = agora
  }

  desativar(agora: string): void {
    this.props.ativo = false
    this.props.versao++
    this.props.atualizadoEm = agora
  }

  ativar(agora: string): void {
    this.props.ativo = true
    this.props.versao++
    this.props.atualizadoEm = agora
  }

  toObject(): RegraGovernancaProps {
    return { ...this.props, parametros: { ...this.props.parametros } }
  }
}
