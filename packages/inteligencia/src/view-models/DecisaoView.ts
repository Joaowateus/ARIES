import { ClassificacaoDiagnostico, ResultadoDecisao, AprendizadoGerado } from '@soe/cap-08'

export interface DecisaoView {
  id: string
  diagnosticoId: string
  planoAcaoId: string
  classificacao: ClassificacaoDiagnostico
  periodo: string
  decisaoTomada: string
  resultadoEsperado: string
  resultadoReal?: string
  resultado?: ResultadoDecisao
  aprendizado?: AprendizadoGerado
  registradoEm: string
  fechadoEm?: string
  estaFechada: boolean
  foiEfetiva: boolean
}

export interface DecisaoFiltros {
  classificacao?: ClassificacaoDiagnostico
  periodo?: string
  resultado?: ResultadoDecisao
  apenasAbertas?: boolean
}
