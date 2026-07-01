/**
 * Sessao — token de acesso autenticado com TTL e contexto de empresa/usuário.
 *
 * Cada login gera uma sessão. A sessão expira após o TTL.
 * O contexto da sessão (empresaId + papel) é suficiente para autorizar qualquer operação.
 */

import { v4 as uuidv4 } from 'uuid'
import { PapelUsuario } from './Usuario'

export interface SessaoProps {
  id: string
  token: string
  empresaId: string
  usuarioId: string
  papel: PapelUsuario
  expiradaEm: string  // ISO string
  criadaEm: string
  invalidadaEm?: string
}

export class Sessao {
  private constructor(private props: SessaoProps) {}

  static create(params: Omit<SessaoProps, 'id' | 'token' | 'invalidadaEm' | 'criadaEm' | 'expiradaEm'> & { ttlMinutos?: number; agora: string }): Sessao {
    const ttl = params.ttlMinutos ?? 480  // 8h default
    const expira = new Date(params.agora)
    expira.setMinutes(expira.getMinutes() + ttl)

    return new Sessao({
      empresaId: params.empresaId,
      usuarioId: params.usuarioId,
      papel: params.papel,
      criadaEm: params.agora,
      expiradaEm: expira.toISOString(),
      id: uuidv4(),
      token: uuidv4(),
    })
  }

  static reconstitute(props: SessaoProps): Sessao {
    return new Sessao(props)
  }

  get id(): string { return this.props.id }
  get token(): string { return this.props.token }
  get empresaId(): string { return this.props.empresaId }
  get usuarioId(): string { return this.props.usuarioId }
  get papel(): PapelUsuario { return this.props.papel }
  get expiradaEm(): string { return this.props.expiradaEm }
  get criadaEm(): string { return this.props.criadaEm }
  get invalidadaEm(): string | undefined { return this.props.invalidadaEm }

  estaValida(agora: string): boolean {
    if (this.props.invalidadaEm) return false
    return new Date(agora) < new Date(this.props.expiradaEm)
  }

  invalidar(agora: string): void {
    this.props.invalidadaEm = agora
  }

  toObject(): SessaoProps {
    return { ...this.props }
  }
}
