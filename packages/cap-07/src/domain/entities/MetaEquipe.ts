/**
 * MetaEquipe — meta agregada da equipe comercial para um período.
 * Consolida as metas individuais e permite rastrear o atingimento coletivo.
 * RN-E03: meta da equipe deve ser distribuída entre os vendedores ativos.
 */

import { v4 as uuidv4 } from 'uuid'

export interface DistribuicaoMeta {
  vendedorId: string
  percentualMeta: number    // % da meta total alocada a este vendedor
  metaReceita: number
}

export interface MetaEquipeProps {
  id: string
  periodo: string
  metaTotalReceita: number
  distribuicao: DistribuicaoMeta[]
  criadoEm: string
  atualizadoEm: string
}

export class MetaEquipe {
  private constructor(private props: MetaEquipeProps) {}

  static create(params: Omit<MetaEquipeProps, 'id' | 'criadoEm' | 'atualizadoEm'> & { agora: string }): MetaEquipe {
    if (params.metaTotalReceita <= 0) throw new Error('MetaEquipe: metaTotalReceita deve ser positiva')
    if (params.distribuicao.length === 0) throw new Error('MetaEquipe: distribuição obrigatória (RN-E03)')

    const totalPercent = params.distribuicao.reduce((s, d) => s + d.percentualMeta, 0)
    if (Math.abs(totalPercent - 100) > 0.01) {
      throw new Error(`MetaEquipe: distribuição deve somar 100% (atual: ${totalPercent.toFixed(1)}%)`)
    }

    return new MetaEquipe({
      ...params,
      id: uuidv4(),
      criadoEm: params.agora,
      atualizadoEm: params.agora,
    })
  }

  static reconstitute(props: MetaEquipeProps): MetaEquipe {
    return new MetaEquipe(props)
  }

  get id(): string { return this.props.id }
  get periodo(): string { return this.props.periodo }
  get metaTotalReceita(): number { return this.props.metaTotalReceita }
  get distribuicao(): readonly DistribuicaoMeta[] { return [...this.props.distribuicao] }
  get criadoEm(): string { return this.props.criadoEm }

  metaDoVendedor(vendedorId: string): DistribuicaoMeta | undefined {
    return this.props.distribuicao.find(d => d.vendedorId === vendedorId)
  }

  toObject(): MetaEquipeProps {
    return { ...this.props, distribuicao: this.props.distribuicao.map(d => ({ ...d })) }
  }
}
