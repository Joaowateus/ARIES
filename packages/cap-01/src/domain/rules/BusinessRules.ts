/**
 * Regras de negócio explícitas do CAP-01.
 * RN-01 a RN-09 conforme especificação arquitetural.
 */

import { IcpDefinition } from '../entities/IcpDefinition'
import { Competitor } from '../entities/Competitor'
import { WinLossAnalysis } from '../entities/WinLossAnalysis'
import { MarketSignal } from '../entities/MarketSignal'

/** RN-01: Critérios do ICP devem ser objetivos e mensuráveis (pesos somam 1.0) */
export function rn01_icpCriteriosObjetivos(icp: IcpDefinition): void {
  const total = icp.todosOsCriterios.reduce((s, c) => s + c.peso, 0)
  if (Math.abs(total - 1.0) > 0.0001) {
    throw new Error(`RN-01: soma dos pesos do ICP deve ser 1.0, recebida: ${total.toFixed(4)}`)
  }
}

/** RN-02: ICP exige versionamento semântico; versão anterior arquivada. */
export function rn02_icpVersaoSemantica(versao: string): void {
  const semver = /^\d+\.\d+\.\d+$/
  if (!semver.test(versao)) {
    throw new Error(`RN-02: versão do ICP deve seguir semver (ex: 1.0.0), recebida: ${versao}`)
  }
}

/** RN-03: 100% das oportunidades encerradas devem ter análise Win/Loss. */
export function rn03_coberturaTotalWinLoss(
  oportunidadesEncerradas: string[],
  analises: WinLossAnalysis[],
): string[] {
  const analisadas = new Set(analises.map((a) => a.oportunidadeId))
  return oportunidadesEncerradas.filter((id) => !analisadas.has(id))
}

/** RN-04: análise Win/Loss deve ser concluída em até 10 dias úteis. */
export function rn04_prazoAnaliseWinLoss(analise: WinLossAnalysis, agora: string): boolean {
  return analise.estaPendentePorMaisDe(10, agora)
}

/** RN-05: mínimo 3 concorrentes ATIVO no mapa competitivo. */
export function rn05_minimoTresConcorrentes(concorrentes: Competitor[]): boolean {
  const ativos = concorrentes.filter((c) => c.status === 'ATIVO')
  return ativos.length >= 3
}

/** RN-05b: concorrente sem atualização > 180 dias → DESATUALIZADO. */
export function rn05b_freshnessConcorrentes(concorrentes: Competitor[], agora: string): void {
  for (const c of concorrentes) {
    c.verificarFreshness(agora)
  }
}

/** RN-06: ICP aprovado é contrato operacional, não recomendação. */
export function rn06_icpContratoOperacional(icp: IcpDefinition): void {
  if (icp.status !== 'ATIVO') {
    throw new Error(`RN-06: apenas ICP com status ATIVO pode ser usado como contrato operacional`)
  }
}

/** RN-07: segmentos precisam de revisão periódica. */
export function rn07_revisaoPeriodica(ultimaRevisao: string, agora: string): boolean {
  const dias = Math.floor(
    (new Date(agora).getTime() - new Date(ultimaRevisao).getTime()) / 86_400_000,
  )
  return dias > 120
}

/** RN-08: aprendizados Win/Loss não podem nomear indivíduos como causa de perda. */
export function rn08_semNomeacaoIndividual(aprendizados: string[]): string[] {
  // Heurística: detecta padrões como "fulano", "sr.", "dra." etc.
  const patterns = [/\bsr\b/i, /\bsra\b/i, /\bdr\b/i, /\bdra\b/i, /\bgerente\b.*\bnome\b/i]
  return aprendizados.filter((a) => patterns.some((p) => p.test(a)))
}

/** RN-09: todo MarketSignal deve ter ao menos um elemento impactado. */
export function rn09_sinalComImpacto(sinal: MarketSignal): void {
  if (sinal.elementosImpactados.length === 0) {
    throw new Error('RN-09: MarketSignal deve ter ao menos um elemento impactado declarado')
  }
}
