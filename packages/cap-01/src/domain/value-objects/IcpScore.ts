/**
 * IcpScore — pontuação de aderência de um lead/cliente ao ICP.
 * Escala 0–10. Derivada da soma ponderada dos critérios.
 */

export type IcpTier = 'ICP_FORTE' | 'ICP_ADEQUADO' | 'FORA_DO_ICP'

export class IcpScore {
  private constructor(private readonly value: number) {
    if (value < 0 || value > 10) {
      throw new Error(`IcpScore deve estar entre 0 e 10, recebido: ${value}`)
    }
  }

  static of(value: number): IcpScore {
    return new IcpScore(Math.round(value * 100) / 100)
  }

  static zero(): IcpScore { return new IcpScore(0) }
  static max(): IcpScore { return new IcpScore(10) }

  get numeric(): number { return this.value }

  get tier(): IcpTier {
    if (this.value >= 7.5) return 'ICP_FORTE'
    if (this.value >= 5.0) return 'ICP_ADEQUADO'
    return 'FORA_DO_ICP'
  }

  isAdequate(): boolean { return this.tier !== 'FORA_DO_ICP' }
  isStrong(): boolean { return this.tier === 'ICP_FORTE' }

  equals(other: IcpScore): boolean { return this.value === other.value }

  toString(): string { return `${this.value.toFixed(2)} (${this.tier})` }
}
