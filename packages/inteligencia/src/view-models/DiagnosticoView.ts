import { KpiNome, ClassificacaoDiagnostico, MupScore, StatusDiagnostico } from '@soe/cap-08'

export interface HipoteseView {
  descricao: string
  confianca: number
  evidencias: string[]
}

export interface DiagnosticoView {
  id: string
  periodo: string
  classificacao: ClassificacaoDiagnostico
  kpisAfetados: KpiNome[]
  hipotesePrincipal: HipoteseView
  impactoFinanceiroEstimado: number
  mupScore: MupScore
  prioridade: number          // rank 1 = maior MUP da lista consultada
  status: StatusDiagnostico
  planoAcaoId?: string
  geradoEm: string
  resolvidoEm?: string
}

export interface DiagnosticoFiltros {
  status?: StatusDiagnostico[]
  classificacao?: ClassificacaoDiagnostico
  periodo?: string
}
