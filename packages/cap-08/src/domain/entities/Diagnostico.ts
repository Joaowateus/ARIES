/**
 * Diagnostico — resultado da Engine de Diagnóstico.
 *
 * Classifica a causa provável de um conjunto de anomalias e quantifica
 * o impacto financeiro estimado para alimentar a Engine de Decisão.
 *
 * RN-D02: um diagnóstico exige ao menos uma anomalia com KPI afetado identificado.
 * RN-D03: diagnósticos são priorizados pela Engine de Decisão via MUP score.
 */

import { v4 as uuidv4 } from 'uuid'
import { KpiNome } from './KpiSnapshot'

export type ClassificacaoDiagnostico =
  | 'DEMANDA'          // pipeline insuficiente, poucos leads
  | 'PRECO'            // descontos elevados, propostas reprovadas
  | 'NEGOCIACAO'       // ciclo longo, baixa taxa de fechamento
  | 'ICP'              // segmentos errados, baixo health pós-venda
  | 'EXECUCAO'         // problemas de processo, onboarding atrasado
  | 'MERCADO'          // queda sistêmica, não atribuível à equipe
  | 'RETENCAO'         // churn, health score em queda

export type StatusDiagnostico = 'ABERTO' | 'EM_TRATAMENTO' | 'RESOLVIDO' | 'DESCARTADO'

export interface Hipotese {
  descricao: string
  confianca: number    // 0-100
  evidencias: string[] // KPIs que suportam esta hipótese
}

export interface MupScore {
  impacto: number      // 0-10: impacto financeiro estimado
  urgencia: number     // 0-10: velocidade de degradação
  esforco: number      // 0-10: dificuldade de resolver (menor = mais fácil)
  bloqueadores: number // 0-10: quantos outros problemas isso desbloqueia
  total: number        // calculado: impacto*0.4 + urgencia*0.3 + (10-esforco)*0.2 + bloqueadores*0.1
}

export interface DiagnosticoProps {
  id: string
  periodo: string
  kpisAfetados: KpiNome[]
  classificacao: ClassificacaoDiagnostico
  hipoteses: Hipotese[]
  impactoFinanceiroEstimado: number   // R$ impacto mensal estimado
  mupScore: MupScore
  status: StatusDiagnostico
  planoAcaoId?: string
  geradoEm: string
  atualizadoEm: string
  resolvidoEm?: string
}

export function calcularMupTotal(score: Omit<MupScore, 'total'>): number {
  return (
    score.impacto * 0.4 +
    score.urgencia * 0.3 +
    (10 - score.esforco) * 0.2 +
    score.bloqueadores * 0.1
  )
}

export class Diagnostico {
  private constructor(private props: DiagnosticoProps) {}

  static create(params: Omit<DiagnosticoProps, 'id' | 'status' | 'geradoEm' | 'atualizadoEm'> & {
    agora: string
  }): Diagnostico {
    if (params.kpisAfetados.length === 0) {
      throw new Error('Diagnostico: ao menos um KPI afetado é obrigatório (RN-D02)')
    }
    if (params.hipoteses.length === 0) {
      throw new Error('Diagnostico: ao menos uma hipótese é obrigatória (RN-D02)')
    }

    const mupTotal = calcularMupTotal(params.mupScore)

    return new Diagnostico({
      ...params,
      id: uuidv4(),
      status: 'ABERTO',
      mupScore: { ...params.mupScore, total: mupTotal },
      geradoEm: params.agora,
      atualizadoEm: params.agora,
    })
  }

  static reconstitute(props: DiagnosticoProps): Diagnostico {
    return new Diagnostico(props)
  }

  get id(): string { return this.props.id }
  get periodo(): string { return this.props.periodo }
  get kpisAfetados(): readonly KpiNome[] { return [...this.props.kpisAfetados] }
  get classificacao(): ClassificacaoDiagnostico { return this.props.classificacao }
  get hipoteses(): readonly Hipotese[] { return [...this.props.hipoteses] }
  get impactoFinanceiroEstimado(): number { return this.props.impactoFinanceiroEstimado }
  get mupScore(): MupScore { return { ...this.props.mupScore } }
  get status(): StatusDiagnostico { return this.props.status }
  get planoAcaoId(): string | undefined { return this.props.planoAcaoId }
  get geradoEm(): string { return this.props.geradoEm }
  get atualizadoEm(): string { return this.props.atualizadoEm }
  get resolvidoEm(): string | undefined { return this.props.resolvidoEm }

  hipotesePrincipal(): Hipotese {
    return [...this.props.hipoteses].sort((a, b) => b.confianca - a.confianca)[0]
  }

  vincularPlano(planoAcaoId: string, agora: string): void {
    this.props.planoAcaoId = planoAcaoId
    this.props.status = 'EM_TRATAMENTO'
    this.props.atualizadoEm = agora
  }

  resolver(agora: string): void {
    if (this.props.status === 'RESOLVIDO') return
    this.props.status = 'RESOLVIDO'
    this.props.resolvidoEm = agora
    this.props.atualizadoEm = agora
  }

  descartar(agora: string): void {
    this.props.status = 'DESCARTADO'
    this.props.atualizadoEm = agora
  }

  toObject(): DiagnosticoProps {
    return {
      ...this.props,
      kpisAfetados: [...this.props.kpisAfetados],
      hipoteses: this.props.hipoteses.map(h => ({ ...h, evidencias: [...h.evidencias] })),
      mupScore: { ...this.props.mupScore },
    }
  }
}
