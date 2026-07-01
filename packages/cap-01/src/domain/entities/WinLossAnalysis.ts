/**
 * WinLossAnalysis — análise estruturada de resultado de oportunidade.
 * RN-03: cobertura de 100% das oportunidades encerradas.
 * RN-08: não nomeia indivíduos como causa de perda.
 */

import { v4 as uuidv4 } from 'uuid'
import { WinLossResult, WinLossReason } from '../value-objects/WinLossResult'

export type WinLossStatus =
  | 'PENDENTE_ANALISE'
  | 'EM_ANALISE'
  | 'ANALISADA'
  | 'INSIGHTS_PUBLICADOS'
  | 'DESCARTADA'

export interface WinLossAnalysisProps {
  id: string
  oportunidadeId: string
  status: WinLossStatus
  segmentoId?: string
  valorEstimado?: number
  cicloDias?: number
  result?: WinLossResult
  fatoresNegativos: string[]
  fatoresPositivos: string[]
  sinaisDeAlertaIgnorados: string[]
  aprendizados: string[]
  iaSugestaoJson?: Record<string, unknown>
  validadoPor?: string
  motivoDescarte?: string
  criadoEm: string
  atualizadoEm: string
  concluidoEm?: string
  eventoOrigemId: string
}

export class WinLossAnalysis {
  private constructor(private props: WinLossAnalysisProps) {}

  static create(params: {
    oportunidadeId: string
    segmentoId?: string
    valorEstimado?: number
    cicloDias?: number
    eventoOrigemId: string
    agora: string
  }): WinLossAnalysis {
    if (!params.oportunidadeId) {
      throw new Error('WinLossAnalysis: oportunidadeId é obrigatório')
    }
    return new WinLossAnalysis({
      id: uuidv4(),
      oportunidadeId: params.oportunidadeId,
      status: 'PENDENTE_ANALISE',
      segmentoId: params.segmentoId,
      valorEstimado: params.valorEstimado,
      cicloDias: params.cicloDias,
      fatoresNegativos: [],
      fatoresPositivos: [],
      sinaisDeAlertaIgnorados: [],
      aprendizados: [],
      criadoEm: params.agora,
      atualizadoEm: params.agora,
      eventoOrigemId: params.eventoOrigemId,
    })
  }

  static reconstitute(props: WinLossAnalysisProps): WinLossAnalysis {
    return new WinLossAnalysis(props)
  }

  // ── Getters ──────────────────────────────────────────────────────────────

  get id(): string { return this.props.id }
  get oportunidadeId(): string { return this.props.oportunidadeId }
  get status(): WinLossStatus { return this.props.status }
  get segmentoId(): string | undefined { return this.props.segmentoId }
  get valorEstimado(): number | undefined { return this.props.valorEstimado }
  get cicloDias(): number | undefined { return this.props.cicloDias }
  get result(): WinLossResult | undefined { return this.props.result }
  get fatoresNegativos(): string[] { return [...this.props.fatoresNegativos] }
  get fatoresPositivos(): string[] { return [...this.props.fatoresPositivos] }
  get sinaisDeAlertaIgnorados(): string[] { return [...this.props.sinaisDeAlertaIgnorados] }
  get aprendizados(): string[] { return [...this.props.aprendizados] }
  get iaSugestaoJson(): Record<string, unknown> | undefined { return this.props.iaSugestaoJson }
  get validadoPor(): string | undefined { return this.props.validadoPor }
  get motivoDescarte(): string | undefined { return this.props.motivoDescarte }
  get criadoEm(): string { return this.props.criadoEm }
  get atualizadoEm(): string { return this.props.atualizadoEm }
  get concluidoEm(): string | undefined { return this.props.concluidoEm }
  get eventoOrigemId(): string { return this.props.eventoOrigemId }

  // ── Transições de estado ─────────────────────────────────────────────────

  iniciarAnalise(agora: string): void {
    this.assertStatus('PENDENTE_ANALISE', 'iniciar análise')
    this.props.status = 'EM_ANALISE'
    this.props.atualizadoEm = agora
  }

  submeter(params: {
    result: WinLossResult
    fatoresNegativos: string[]
    fatoresPositivos: string[]
    sinaisDeAlertaIgnorados: string[]
    aprendizados: string[]
    validadoPor: string
    iaSugestaoJson?: Record<string, unknown>
    agora: string
  }): void {
    if (this.props.status !== 'EM_ANALISE' && this.props.status !== 'PENDENTE_ANALISE') {
      throw new Error(`WinLossAnalysis: não é possível submeter em status ${this.props.status}`)
    }
    // RN-08: aprendizados não podem nomear indivíduos como causa
    this.props.result = params.result
    this.props.fatoresNegativos = params.fatoresNegativos
    this.props.fatoresPositivos = params.fatoresPositivos
    this.props.sinaisDeAlertaIgnorados = params.sinaisDeAlertaIgnorados
    this.props.aprendizados = params.aprendizados
    this.props.validadoPor = params.validadoPor
    this.props.iaSugestaoJson = params.iaSugestaoJson
    this.props.status = 'ANALISADA'
    this.props.concluidoEm = params.agora
    this.props.atualizadoEm = params.agora
  }

  publicarInsights(agora: string): void {
    this.assertStatus('ANALISADA', 'publicar insights')
    this.props.status = 'INSIGHTS_PUBLICADOS'
    this.props.atualizadoEm = agora
  }

  descartar(motivo: string, agora: string): void {
    if (this.props.status === 'ANALISADA' || this.props.status === 'INSIGHTS_PUBLICADOS') {
      throw new Error('WinLossAnalysis: não é possível descartar análise já concluída')
    }
    if (!motivo || motivo.trim() === '') {
      throw new Error('WinLossAnalysis: motivo de descarte é obrigatório')
    }
    this.props.status = 'DESCARTADA'
    this.props.motivoDescarte = motivo
    this.props.atualizadoEm = agora
  }

  registrarSugestaoIA(sugestao: Record<string, unknown>, agora: string): void {
    if (this.props.status === 'DESCARTADA') {
      throw new Error('WinLossAnalysis: análise descartada não aceita sugestões')
    }
    this.props.iaSugestaoJson = sugestao
    this.props.atualizadoEm = agora
  }

  // ── Lógica de negócio ────────────────────────────────────────────────────

  /** RN-03: análise pendente por mais de 10 dias úteis gera alerta */
  diasPendente(agora: string): number {
    if (this.props.status !== 'PENDENTE_ANALISE' && this.props.status !== 'EM_ANALISE') return 0
    const criado = new Date(this.props.criadoEm).getTime()
    const hoje = new Date(agora).getTime()
    return Math.floor((hoje - criado) / 86_400_000)
  }

  estaPendentePorMaisDe(diasUteis: number, agora: string): boolean {
    return (
      (this.props.status === 'PENDENTE_ANALISE' || this.props.status === 'EM_ANALISE') &&
      this.diasPendente(agora) > diasUteis
    )
  }

  estaCompleta(): boolean {
    return this.props.status === 'ANALISADA' || this.props.status === 'INSIGHTS_PUBLICADOS'
  }

  toObject(): WinLossAnalysisProps {
    return { ...this.props }
  }

  private assertStatus(expected: WinLossStatus, action: string): void {
    if (this.props.status !== expected) {
      throw new Error(
        `WinLossAnalysis: não é possível ${action} em status ${this.props.status}`,
      )
    }
  }
}

// ── Detector de padrão recorrente ──────────────────────────────────────────

export interface WinLossPattern {
  tipoRazao: WinLossReason
  ocorrencias: number
  segmentosAfetados: string[]
  recomendacao: string
}

export function detectarPadrao(
  analises: WinLossAnalysis[],
  limiteOcorrencias = 3,
): WinLossPattern[] {
  const contagem = new Map<WinLossReason, { count: number; segmentos: Set<string> }>()

  for (const analise of analises.filter((a) => a.estaCompleta() && a.result)) {
    const razao = analise.result!.primaryReason
    const existing = contagem.get(razao) ?? { count: 0, segmentos: new Set() }
    existing.count++
    if (analise.segmentoId) existing.segmentos.add(analise.segmentoId)
    contagem.set(razao, existing)
  }

  const padroes: WinLossPattern[] = []
  for (const [razao, data] of contagem.entries()) {
    if (data.count >= limiteOcorrencias) {
      padroes.push({
        tipoRazao: razao,
        ocorrencias: data.count,
        segmentosAfetados: [...data.segmentos],
        recomendacao: gerarRecomendacao(razao),
      })
    }
  }
  return padroes
}

function gerarRecomendacao(razao: WinLossReason): string {
  const recomendacoes: Partial<Record<WinLossReason, string>> = {
    PRECO: 'Revisar estratégia de pricing e posicionamento competitivo (CAP-06)',
    FUNCIONALIDADE: 'Avaliar roadmap de produto para gaps recorrentes',
    CONCORRENTE: 'Atualizar battlecard competitivo e treinar equipe',
    TIMING: 'Revisar critérios de qualificação de timing no funil (CAP-03)',
    FORA_DO_ICP: 'Revisar critérios de qualificação do ICP (CAP-01.1)',
    ORCAMENTO: 'Revisar segmentação por capacidade de investimento',
    STATUS_QUO: 'Reforçar urgência e ROI na proposta de valor',
  }
  return recomendacoes[razao] ?? 'Investigar padrão e propor plano de ação (ENG-05)'
}
