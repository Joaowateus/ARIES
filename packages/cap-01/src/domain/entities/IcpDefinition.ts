/**
 * IcpDefinition — Perfil de Cliente Ideal.
 * RN-01: critérios objetivos e mensuráveis.
 * RN-02: versionamento semântico obrigatório; versão anterior arquivada, nunca deletada.
 * RN-06: ICP é contrato operacional, não recomendação.
 */

import { v4 as uuidv4 } from 'uuid'
import { IcpCriteria } from '../value-objects/IcpCriteria'
import { IcpScore } from '../value-objects/IcpScore'

export type IcpStatus = 'RASCUNHO' | 'EM_REVISAO' | 'APROVADO' | 'ATIVO' | 'DESCONTINUADO'

export interface IcpDefinitionProps {
  id: string
  versao: string
  status: IcpStatus
  validoAPartir: string
  criteriosFirmograficos: IcpCriteria[]
  criteriosComportamentais: IcpCriteria[]
  exclusoesAbsolutas: string[]
  fonteDeCalibracao: string
  ultimaCalibracao: string
  proximaRevisao: string
  criadoPor: string
  criadoEm: string
  atualizadoEm: string
  versaoAnteriorId?: string
}

export class IcpDefinition {
  private constructor(private props: IcpDefinitionProps) {}

  static create(
    params: Omit<IcpDefinitionProps, 'id' | 'status' | 'criadoEm' | 'atualizadoEm'> & {
      agora: string
    },
  ): IcpDefinition {
    const pesoTotal =
      [...params.criteriosFirmograficos, ...params.criteriosComportamentais]
        .reduce((s, c) => s + c.peso, 0)

    const diff = Math.abs(pesoTotal - 1.0)
    if (diff > 0.0001) {
      throw new Error(
        `IcpDefinition: soma dos pesos deve ser 1.0, recebida: ${pesoTotal.toFixed(4)}`,
      )
    }

    if (params.criteriosFirmograficos.length === 0) {
      throw new Error('IcpDefinition: ao menos um critério firmográfico é obrigatório')
    }

    return new IcpDefinition({
      ...params,
      id: uuidv4(),
      status: 'RASCUNHO',
      criadoEm: params.agora,
      atualizadoEm: params.agora,
    })
  }

  static reconstitute(props: IcpDefinitionProps): IcpDefinition {
    return new IcpDefinition(props)
  }

  // ── Getters ──────────────────────────────────────────────────────────────

  get id(): string { return this.props.id }
  get versao(): string { return this.props.versao }
  get status(): IcpStatus { return this.props.status }
  get validoAPartir(): string { return this.props.validoAPartir }
  get criteriosFirmograficos(): IcpCriteria[] { return [...this.props.criteriosFirmograficos] }
  get criteriosComportamentais(): IcpCriteria[] { return [...this.props.criteriosComportamentais] }
  get exclusoesAbsolutas(): string[] { return [...this.props.exclusoesAbsolutas] }
  get fonteDeCalibracao(): string { return this.props.fonteDeCalibracao }
  get ultimaCalibracao(): string { return this.props.ultimaCalibracao }
  get proximaRevisao(): string { return this.props.proximaRevisao }
  get criadoPor(): string { return this.props.criadoPor }
  get criadoEm(): string { return this.props.criadoEm }
  get atualizadoEm(): string { return this.props.atualizadoEm }
  get versaoAnteriorId(): string | undefined { return this.props.versaoAnteriorId }

  get todosOsCriterios(): IcpCriteria[] {
    return [...this.props.criteriosFirmograficos, ...this.props.criteriosComportamentais]
  }

  // ── Transições de estado ─────────────────────────────────────────────────

  submeterParaRevisao(agora: string): void {
    this.assertStatus('RASCUNHO', 'submeter para revisão')
    this.props.status = 'EM_REVISAO'
    this.props.atualizadoEm = agora
  }

  aprovar(agora: string): void {
    this.assertStatus('EM_REVISAO', 'aprovar')
    this.props.status = 'APROVADO'
    this.props.atualizadoEm = agora
  }

  ativar(agora: string): void {
    this.assertStatus('APROVADO', 'ativar')
    this.props.status = 'ATIVO'
    this.props.atualizadoEm = agora
  }

  descontinuar(agora: string): void {
    if (this.props.status !== 'ATIVO') {
      throw new Error(`IcpDefinition: só ICPs ATIVO podem ser descontinuados`)
    }
    this.props.status = 'DESCONTINUADO'
    this.props.atualizadoEm = agora
  }

  // ── Lógica de negócio ────────────────────────────────────────────────────

  /**
   * Calcula o ICP Score de um prospect com base nos valores fornecidos.
   * Score = soma(critério_atendido × peso) × 10
   */
  calcularScore(atributos: Record<string, string | number | string[]>): IcpScore {
    let total = 0
    for (const criterio of this.todosOsCriterios) {
      if (this.criterioAtendido(criterio, atributos)) {
        total += criterio.peso
      }
    }
    return IcpScore.of(Math.min(10, total * 10))
  }

  diasSemRevisao(agora: string): number {
    const ultimo = new Date(this.props.ultimaCalibracao).getTime()
    const hoje = new Date(agora).getTime()
    return Math.floor((hoje - ultimo) / 86_400_000)
  }

  precisaRevisao(agora: string): boolean {
    return this.diasSemRevisao(agora) > 120
  }

  // ── Serialização ─────────────────────────────────────────────────────────

  toObject(): IcpDefinitionProps {
    return {
      ...this.props,
      criteriosFirmograficos: this.props.criteriosFirmograficos.map((c) => c),
      criteriosComportamentais: this.props.criteriosComportamentais.map((c) => c),
    }
  }

  // ── Auxiliares privados ──────────────────────────────────────────────────

  private assertStatus(expected: IcpStatus, action: string): void {
    if (this.props.status !== expected) {
      throw new Error(
        `IcpDefinition: não é possível ${action} em status ${this.props.status}`,
      )
    }
  }

  private criterioAtendido(
    criterio: IcpCriteria,
    atributos: Record<string, string | number | string[]>,
  ): boolean {
    const val = atributos[criterio.dimensao]
    if (val === undefined) return false

    switch (criterio.operador) {
      case 'in':
        return criterio.valores?.includes(String(val)) ?? false
      case 'igual':
        return String(val) === criterio.valor
      case 'maior_que':
        return Number(val) > Number(criterio.valor)
      case 'menor_que':
        return Number(val) < Number(criterio.valor)
      case 'minimo':
        return String(val) >= (criterio.valor ?? '')
      case 'entre': {
        const [min, max] = criterio.valores ?? []
        return Number(val) >= Number(min) && Number(val) <= Number(max)
      }
      default:
        return false
    }
  }
}
