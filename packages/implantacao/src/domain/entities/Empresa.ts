/**
 * Empresa — tenant raiz do Commercial OS.
 *
 * Toda operação do sistema é escopada a uma empresa.
 * O primeiro usuário criado junto à empresa recebe automaticamente papel ADMIN.
 */

import { v4 as uuidv4 } from 'uuid'

export type PorteEmpresa = 'MEI' | 'ME' | 'EPP' | 'MEDIO' | 'GRANDE'
export type StatusEmpresa = 'CONFIGURANDO' | 'ATIVA' | 'SUSPENSA' | 'ENCERRADA'

export interface EmpresaProps {
  id: string
  nome: string
  cnpj: string
  segmento: string
  porte: PorteEmpresa
  status: StatusEmpresa
  configuracaoConcluida: boolean
  criadaEm: string
  atualizadaEm: string
}

export class Empresa {
  private constructor(private props: EmpresaProps) {}

  static create(params: Omit<EmpresaProps, 'id' | 'status' | 'configuracaoConcluida' | 'criadaEm' | 'atualizadaEm'> & { agora: string }): Empresa {
    if (!params.nome?.trim()) throw new Error('Empresa: nome obrigatório')
    if (!params.cnpj?.trim()) throw new Error('Empresa: CNPJ obrigatório')
    if (!params.segmento?.trim()) throw new Error('Empresa: segmento obrigatório')

    const cnpjLimpo = params.cnpj.replace(/\D/g, '')
    if (cnpjLimpo.length !== 14) throw new Error('Empresa: CNPJ deve ter 14 dígitos')

    return new Empresa({
      ...params,
      cnpj: cnpjLimpo,
      id: uuidv4(),
      status: 'CONFIGURANDO',
      configuracaoConcluida: false,
      criadaEm: params.agora,
      atualizadaEm: params.agora,
    })
  }

  static reconstitute(props: EmpresaProps): Empresa {
    return new Empresa(props)
  }

  get id(): string { return this.props.id }
  get nome(): string { return this.props.nome }
  get cnpj(): string { return this.props.cnpj }
  get segmento(): string { return this.props.segmento }
  get porte(): PorteEmpresa { return this.props.porte }
  get status(): StatusEmpresa { return this.props.status }
  get configuracaoConcluida(): boolean { return this.props.configuracaoConcluida }
  get criadaEm(): string { return this.props.criadaEm }
  get atualizadaEm(): string { return this.props.atualizadaEm }

  concluirConfiguracao(agora: string): void {
    if (this.props.status !== 'CONFIGURANDO') throw new Error('Empresa: configuração já concluída')
    this.props.configuracaoConcluida = true
    this.props.status = 'ATIVA'
    this.props.atualizadaEm = agora
  }

  suspender(agora: string): void {
    this.props.status = 'SUSPENSA'
    this.props.atualizadaEm = agora
  }

  toObject(): EmpresaProps {
    return { ...this.props }
  }
}
