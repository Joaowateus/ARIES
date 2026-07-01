import { CommercialPolicy, NivelAlcada } from '../entities/CommercialPolicy'
import { PolicyValidation } from '../entities/Proposal'

/** Hierarquia de alçadas: N1 < N2 < N3 < N4 */
const NIVEL_RANK: Record<NivelAlcada, number> = { N1: 1, N2: 2, N3: 3, N4: 4 }

export function nivelMaiorQue(a: NivelAlcada, b: NivelAlcada): boolean {
  return NIVEL_RANK[a] > NIVEL_RANK[b]
}

/**
 * RN-G01 + RN-G02 + RN-G06: valida proposta contra política vigente.
 * Retorna todas as violações detectadas e se exige aprovação superior.
 */
export function rn_g_validarContraPolitica(
  policy: CommercialPolicy,
  valorBruto: number,
  percentualDesconto: number,
  margemPercent: number,
  alcadaResponsavel: NivelAlcada,
): PolicyValidation {
  const violacoes: string[] = []

  const alcadaNecessaria = policy.alcadaNecessaria(percentualDesconto)

  // RN-G02: margem mínima
  if (margemPercent < policy.margemMinimaPercent) {
    violacoes.push(
      `RN-G02: margem ${margemPercent.toFixed(1)}% abaixo do mínimo de ${policy.margemMinimaPercent}%`,
    )
  }

  // RN-G01: alçada insuficiente do responsável
  const exigeAprovacao = nivelMaiorQue(alcadaNecessaria, alcadaResponsavel)
  if (exigeAprovacao) {
    violacoes.push(
      `RN-G01: desconto de ${percentualDesconto}% requer alçada ${alcadaNecessaria}, responsável tem ${alcadaResponsavel}`,
    )
  }

  return {
    conforme: violacoes.length === 0,
    violacoes,
    alcadaNecessaria,
    alcadaResponsavel,
    exigeAprovacao: violacoes.length > 0, // qualquer violação exige aprovação
  }
}

/** RN-G03: verifica se já existe proposta ativa para a oportunidade. */
export function rn_g03_propostaUnicaAtiva(jaExiste: boolean, oportunidadeId: string): void {
  if (jaExiste) {
    throw new Error(
      `RN-G03: já existe proposta ativa para a oportunidade ${oportunidadeId}. Cancele a atual antes de criar uma nova.`,
    )
  }
}

/** RN-G05: garante que proposta enviada ao cliente está aprovada. */
export function rn_g05_apenasAprovadaEnviada(status: string): void {
  if (status !== 'APROVADA') {
    throw new Error(`RN-G05: proposta deve estar APROVADA para ser enviada (atual: ${status})`)
  }
}
