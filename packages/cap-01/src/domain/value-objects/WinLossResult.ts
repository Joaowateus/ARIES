/**
 * WinLossResult — resultado de uma oportunidade encerrada.
 */

export type WinLossOutcome = 'won' | 'lost'

export type WinLossReason =
  // Razões de perda
  | 'PRECO'               // preço acima da concorrência
  | 'FUNCIONALIDADE'      // produto não atendia requisito
  | 'CONCORRENTE'         // concorrente ganhou
  | 'TIMING'              // cliente não estava pronto
  | 'PROCESSO_COMPRA'     // burocracia interna do cliente
  | 'RELACIONAMENTO'      // concorrente tinha vantagem de relacionamento
  | 'FORA_DO_ICP'         // cliente fora do perfil ideal
  | 'ORCAMENTO'           // sem budget
  | 'STATUS_QUO'          // cliente decidiu não mudar
  // Razões de vitória
  | 'PRECO_COMPETITIVO'
  | 'MELHOR_FUNCIONALIDADE'
  | 'RELACIONAMENTO_FORTE'
  | 'CASE_DE_SUCESSO'
  | 'SUPORTE_TECNICO'
  | 'INTEGRACAO'
  | 'CUSTO_TOTAL_OWNERSHIP'
  | 'OUTRO'

export class WinLossResult {
  private constructor(
    readonly outcome: WinLossOutcome,
    readonly primaryReason: WinLossReason,
    readonly secondaryReason?: WinLossReason,
    readonly tertiaryReason?: WinLossReason,
    readonly competitorWon?: string,
  ) {}

  static won(
    primaryReason: WinLossReason,
    secondaryReason?: WinLossReason,
    tertiaryReason?: WinLossReason,
  ): WinLossResult {
    return new WinLossResult('won', primaryReason, secondaryReason, tertiaryReason)
  }

  static lost(
    primaryReason: WinLossReason,
    competitorWon?: string,
    secondaryReason?: WinLossReason,
    tertiaryReason?: WinLossReason,
  ): WinLossResult {
    return new WinLossResult('lost', primaryReason, secondaryReason, tertiaryReason, competitorWon)
  }

  isWon(): boolean { return this.outcome === 'won' }
  isLost(): boolean { return this.outcome === 'lost' }
}
