import { v4 as uuidv4 } from 'uuid'

export type TipoMeta = 'EMPRESA' | 'FILIAL' | 'EQUIPE' | 'VENDEDOR'
export type PeriodicidadeMeta = 'MENSAL' | 'TRIMESTRAL' | 'ANUAL'
export type StatusMeta = 'ATIVA' | 'REVISADA' | 'ENCERRADA'

export interface RevisaoMeta {
  valorAnterior: number
  valorNovo: number
  motivo: string
  revisadoEm: string
}

export interface MetaProps {
  id: string
  empresaId: string
  tipo: TipoMeta
  alvoId: string           // empresaId | filialId | equipeId | vendedorId
  periodicidade: PeriodicidadeMeta
  periodo: string          // '2026-07' (mensal) | '2026-Q3' (trimestral) | '2026' (anual)
  valorMeta: number
  status: StatusMeta
  historico: RevisaoMeta[]
  criadoEm: string
  atualizadoEm: string
}

export class Meta {
  private constructor(private props: MetaProps) {}

  static create(params: Omit<MetaProps, 'id' | 'status' | 'historico' | 'criadoEm' | 'atualizadoEm'> & { agora: string }): Meta {
    if (params.valorMeta <= 0) throw new Error('Meta: valorMeta deve ser positivo')
    if (!params.periodo.trim()) throw new Error('Meta: periodo obrigatório')
    return new Meta({
      ...params,
      id: uuidv4(),
      status: 'ATIVA',
      historico: [],
      criadoEm: params.agora,
      atualizadoEm: params.agora,
    })
  }

  static reconstitute(props: MetaProps): Meta {
    return new Meta({ ...props, historico: [...props.historico] })
  }

  revisar(novoValor: number, motivo: string, agora: string): void {
    if (this.props.status === 'ENCERRADA') throw new Error('Meta: meta encerrada não pode ser revisada')
    if (novoValor <= 0) throw new Error('Meta: novoValor deve ser positivo')
    if (!motivo.trim()) throw new Error('Meta: motivo de revisão obrigatório')
    this.props.historico.push({
      valorAnterior: this.props.valorMeta,
      valorNovo: novoValor,
      motivo,
      revisadoEm: agora,
    })
    this.props.valorMeta = novoValor
    this.props.status = 'REVISADA'
    this.props.atualizadoEm = agora
  }

  encerrar(agora: string): void {
    if (this.props.status === 'ENCERRADA') throw new Error('Meta: já está encerrada')
    this.props.status = 'ENCERRADA'
    this.props.atualizadoEm = agora
  }

  get id(): string { return this.props.id }
  get empresaId(): string { return this.props.empresaId }
  get alvoId(): string { return this.props.alvoId }
  get tipo(): TipoMeta { return this.props.tipo }
  get status(): StatusMeta { return this.props.status }

  toObject(): MetaProps { return { ...this.props, historico: [...this.props.historico] } }
}
