import { Contract } from '../entities/Contract'

/** RN-R01: dataFim posterior a dataInicio — verificado em Contract.create. */
export function rn_r01_vigenciaValida(dataInicio: string, dataFim: string): void {
  if (new Date(dataFim) <= new Date(dataInicio)) {
    throw new Error('RN-R01: dataFim deve ser posterior a dataInicio')
  }
}

/** RN-R02: valorTotal > 0 — verificado em Contract.create. */
export function rn_r02_valorPositivo(valorTotal: number): void {
  if (valorTotal <= 0) throw new Error('RN-R02: valorTotal deve ser > 0')
}

/** RN-R03: mrr > 0 para contratos recorrentes — verificado em Contract.create. */
export function rn_r03_mrrRecorrente(mrr: number, formaPagamento: string): void {
  if (formaPagamento !== 'UNICO' && mrr <= 0) {
    throw new Error('RN-R03: mrr deve ser > 0 para contratos recorrentes')
  }
}

/** RN-R04: cancelamento exige motivo — verificado em Contract.cancelar. */
export function rn_r04_motivoCancelamento(motivo: string): void {
  if (!motivo?.trim()) throw new Error('RN-R04: motivo obrigatório para cancelamento')
}

/**
 * RN-R05: receita recorrente de um período só pode ser registrada uma vez
 * por contrato. Verificado antes de criar RevenueRecord no use case.
 */
export function rn_r05_periodoUnico(
  jaExiste: boolean,
  contratoId: string,
  periodo: string,
): void {
  if (jaExiste) {
    throw new Error(
      `RN-R05: receita recorrente já registrada para contrato ${contratoId} no período ${periodo}`,
    )
  }
}

/** RN-R06: apenas contratos ATIVO podem ser encerrados/cancelados — verificado em Contract. */
export function rn_r06_contratoAtivo(contract: Contract, acao: string): void {
  if (!contract.estaAtivo()) {
    throw new Error(`RN-R06: apenas contratos ATIVO podem ser ${acao} (atual: ${contract.status})`)
  }
}
