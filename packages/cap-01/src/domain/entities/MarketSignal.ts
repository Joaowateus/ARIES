/**
 * MarketSignal — sinal de mercado detectado e avaliado.
 * RN-09: todo sinal DEVE ter avaliação de impacto declarada.
 */

import { v4 as uuidv4 } from 'uuid'

export type SignalType = 'REGULATORIO' | 'TECNOLOGICO' | 'ECONOMICO' | 'COMPETITIVO' | 'COMPORTAMENTAL'
export type SignalUrgency = 'baixa' | 'media' | 'alta' | 'critica'
export type ImpactedElement = 'ICP' | 'SEGMENTACAO' | 'MAPA_COMPETITIVO' | 'PERGUNTAS_QUALIFICACAO' | 'POSICIONAMENTO'

export interface MarketSignalProps {
  id: string
  tipo: SignalType
  descricao: string
  urgencia: SignalUrgency
  elementosImpactados: ImpactedElement[]
  segmentosImpactados: string[]
  fonteDaInformacao: string
  acaoRequerida: 'IMEDIATA' | 'PROXIMA_REVISAO' | 'MONITORAR'
  processadoEm?: string
  processadoPor?: string
  criadoPor: string
  criadoEm: string
  atualizadoEm: string
}

export class MarketSignal {
  private constructor(private props: MarketSignalProps) {}

  static create(
    params: Omit<MarketSignalProps, 'id' | 'criadoEm' | 'atualizadoEm'> & { agora: string },
  ): MarketSignal {
    if (!params.descricao || params.descricao.trim() === '') {
      throw new Error('MarketSignal: descrição é obrigatória')
    }
    // RN-09: avaliação de impacto declarada
    if (params.elementosImpactados.length === 0) {
      throw new Error('MarketSignal: ao menos um elemento impactado deve ser declarado (RN-09)')
    }
    return new MarketSignal({
      ...params,
      id: uuidv4(),
      criadoEm: params.agora,
      atualizadoEm: params.agora,
    })
  }

  static reconstitute(props: MarketSignalProps): MarketSignal {
    return new MarketSignal(props)
  }

  get id(): string { return this.props.id }
  get tipo(): SignalType { return this.props.tipo }
  get descricao(): string { return this.props.descricao }
  get urgencia(): SignalUrgency { return this.props.urgencia }
  get elementosImpactados(): ImpactedElement[] { return [...this.props.elementosImpactados] }
  get segmentosImpactados(): string[] { return [...this.props.segmentosImpactados] }
  get fonteDaInformacao(): string { return this.props.fonteDaInformacao }
  get acaoRequerida(): string { return this.props.acaoRequerida }
  get processadoEm(): string | undefined { return this.props.processadoEm }
  get criadoEm(): string { return this.props.criadoEm }

  marcarProcessado(processadoPor: string, agora: string): void {
    this.props.processadoPor = processadoPor
    this.props.processadoEm = agora
    this.props.atualizadoEm = agora
  }

  esCritico(): boolean {
    return this.props.urgencia === 'critica' || this.props.urgencia === 'alta'
  }

  toObject(): MarketSignalProps {
    return { ...this.props }
  }
}
