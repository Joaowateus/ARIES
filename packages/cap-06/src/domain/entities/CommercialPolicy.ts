/**
 * CommercialPolicy — política comercial vigente que define alçadas de desconto
 * e margem mínima aceitável.
 *
 * Alçadas (níveis de autorização):
 *   N1 — vendedor       : desconto até descontoMaxN1 %
 *   N2 — gerente        : desconto até descontoMaxN2 %
 *   N3 — diretor        : desconto até descontoMaxN3 %
 *   N4 — VP/CEO         : acima de N3 (exige aprovação especial)
 *
 * RN-G01: desconto acima da alçada do responsável exige aprovação do nível superior.
 * RN-G02: margem líquida nunca pode ficar abaixo de margemMinimaPercent.
 */

import { v4 as uuidv4 } from 'uuid'

export type NivelAlcada = 'N1' | 'N2' | 'N3' | 'N4'

export interface CommercialPolicyProps {
  id: string
  nome: string
  segmentoId?: string          // null = política global (fallback)
  descontoMaxN1: number        // % máximo que N1 pode aprovar sozinho
  descontoMaxN2: number        // % máximo que N2 pode aprovar sozinho
  descontoMaxN3: number        // % máximo que N3 pode aprovar sozinho
  margemMinimaPercent: number  // margem líquida mínima aceitável (%)
  status: 'ATIVA' | 'INATIVA'
  criadoPor: string
  criadoEm: string
  atualizadoEm: string
}

export class CommercialPolicy {
  private constructor(private props: CommercialPolicyProps) {}

  static create(params: Omit<CommercialPolicyProps, 'id' | 'status' | 'criadoEm' | 'atualizadoEm'> & {
    agora: string
  }): CommercialPolicy {
    if (params.descontoMaxN1 >= params.descontoMaxN2) {
      throw new Error('CommercialPolicy: descontoMaxN1 deve ser menor que descontoMaxN2')
    }
    if (params.descontoMaxN2 >= params.descontoMaxN3) {
      throw new Error('CommercialPolicy: descontoMaxN2 deve ser menor que descontoMaxN3')
    }
    if (params.descontoMaxN3 >= 100) {
      throw new Error('CommercialPolicy: descontoMaxN3 deve ser menor que 100%')
    }
    if (params.margemMinimaPercent < 0) {
      throw new Error('CommercialPolicy: margemMinimaPercent não pode ser negativa')
    }

    return new CommercialPolicy({
      ...params,
      id: uuidv4(),
      status: 'ATIVA',
      criadoEm: params.agora,
      atualizadoEm: params.agora,
    })
  }

  static reconstitute(props: CommercialPolicyProps): CommercialPolicy {
    return new CommercialPolicy(props)
  }

  get id(): string { return this.props.id }
  get nome(): string { return this.props.nome }
  get segmentoId(): string | undefined { return this.props.segmentoId }
  get descontoMaxN1(): number { return this.props.descontoMaxN1 }
  get descontoMaxN2(): number { return this.props.descontoMaxN2 }
  get descontoMaxN3(): number { return this.props.descontoMaxN3 }
  get margemMinimaPercent(): number { return this.props.margemMinimaPercent }
  get status(): 'ATIVA' | 'INATIVA' { return this.props.status }
  get criadoPor(): string { return this.props.criadoPor }
  get criadoEm(): string { return this.props.criadoEm }
  get atualizadoEm(): string { return this.props.atualizadoEm }

  /** Retorna o nível de alçada necessário para aprovar o percentual de desconto. */
  alcadaNecessaria(descontoPercent: number): NivelAlcada {
    if (descontoPercent <= this.props.descontoMaxN1) return 'N1'
    if (descontoPercent <= this.props.descontoMaxN2) return 'N2'
    if (descontoPercent <= this.props.descontoMaxN3) return 'N3'
    return 'N4'
  }

  inativar(agora: string): void {
    this.props.status = 'INATIVA'
    this.props.atualizadoEm = agora
  }

  toObject(): CommercialPolicyProps { return { ...this.props } }
}
