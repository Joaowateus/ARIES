/**
 * ConfiguracaoSistema — parâmetros operacionais configuráveis do Commercial OS.
 *
 * Centraliza limites, thresholds e regras que governam o comportamento dos CAPs.
 * RN-G01: toda alteração de configuração deve ser auditada com autor e motivo.
 * RN-G02: configurações críticas exigem confirmação antes de serem aplicadas.
 */

import { v4 as uuidv4 } from 'uuid'

export type CategoriaCofiguracao =
  | 'PIPELINE'      // limiares de qualificação, etapas, SLA
  | 'PROPOSTAS'     // limites de desconto, margens mínimas
  | 'METAS'         // metas padrão, faixas de performance
  | 'DIAGNOSTICO'   // thresholds de anomalia, pesos MUP
  | 'NOTIFICACOES'  // destinatários, canais, frequências

export interface AlteracaoConfig {
  campo: string
  valorAnterior: unknown
  valorNovo: unknown
  alteradoPor: string
  motivo: string
  alteradoEm: string
}

export interface ConfiguracaoSistemaProps {
  id: string
  categoria: CategoriaCofiguracao
  chave: string
  valor: unknown
  descricao: string
  critica: boolean           // se true, exige confirmação (RN-G02)
  ativo: boolean
  historico: AlteracaoConfig[]
  criadoEm: string
  atualizadoEm: string
}

export class ConfiguracaoSistema {
  private constructor(private props: ConfiguracaoSistemaProps) {}

  static create(params: Omit<ConfiguracaoSistemaProps, 'id' | 'historico' | 'criadoEm' | 'atualizadoEm'> & { agora: string }): ConfiguracaoSistema {
    if (!params.chave?.trim()) throw new Error('ConfiguracaoSistema: chave obrigatória')
    return new ConfiguracaoSistema({
      ...params,
      id: uuidv4(),
      historico: [],
      criadoEm: params.agora,
      atualizadoEm: params.agora,
    })
  }

  static reconstitute(props: ConfiguracaoSistemaProps): ConfiguracaoSistema {
    return new ConfiguracaoSistema(props)
  }

  get id(): string { return this.props.id }
  get categoria(): CategoriaCofiguracao { return this.props.categoria }
  get chave(): string { return this.props.chave }
  get valor(): unknown { return this.props.valor }
  get descricao(): string { return this.props.descricao }
  get critica(): boolean { return this.props.critica }
  get ativo(): boolean { return this.props.ativo }
  get historico(): readonly AlteracaoConfig[] { return [...this.props.historico] }
  get criadoEm(): string { return this.props.criadoEm }
  get atualizadoEm(): string { return this.props.atualizadoEm }

  atualizar(novoValor: unknown, alteradoPor: string, motivo: string, agora: string): void {
    if (!motivo?.trim()) throw new Error('ConfiguracaoSistema: motivo obrigatório para alteração (RN-G01)')
    this.props.historico.push({
      campo: this.props.chave,
      valorAnterior: this.props.valor,
      valorNovo: novoValor,
      alteradoPor,
      motivo,
      alteradoEm: agora,
    })
    this.props.valor = novoValor
    this.props.atualizadoEm = agora
  }

  desativar(agora: string): void {
    this.props.ativo = false
    this.props.atualizadoEm = agora
  }

  toObject(): ConfiguracaoSistemaProps {
    return {
      ...this.props,
      historico: this.props.historico.map(h => ({ ...h })),
    }
  }
}
