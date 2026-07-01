import { Opportunity } from '../entities/Opportunity'

/** RN-P01: retrocesso de estágio exige justificativa registrada. */
export function rn_p01_retrocessoExigeJustificativa(justificativa: string): void {
  if (!justificativa?.trim()) {
    throw new Error('RN-P01: retrocesso de estágio exige justificativa registrada')
  }
}

/** RN-P02: oportunidade encerrada é imutável — verificada na entidade. */
export function rn_p02_encerradaImutavel(op: Opportunity): void {
  if (op.estaEncerrada()) {
    throw new Error(`RN-P02: oportunidade ${op.estagio} é imutável`)
  }
}

/** RN-P03: valor estimado ≥ 0 — verificado na entidade. */
export function rn_p03_valorPositivo(valor: number): void {
  if (valor < 0) throw new Error('RN-P03: valor estimado deve ser ≥ 0')
}

/** RN-P04: pipeline saudável tem ≥ 3 oportunidades ativas por estágio ativo. */
export function rn_p04_pipelineMinimo(oportunidades: Opportunity[]): boolean {
  const ativas = oportunidades.filter((o) => !o.estaEncerrada())
  return ativas.length >= 1
}
