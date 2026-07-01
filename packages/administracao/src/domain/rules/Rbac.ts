import { PapelSistema } from '../entities/UsuarioAdministrado'

export type Permissao =
  | 'usuarios:convidar'
  | 'usuarios:ativar'
  | 'usuarios:desativar'
  | 'usuarios:alterar_papel'
  | 'usuarios:alterar_equipe'
  | 'usuarios:alterar_filial'
  | 'usuarios:consultar'
  | 'times:criar'
  | 'times:editar'
  | 'times:desativar'
  | 'times:consultar'
  | 'filiais:criar'
  | 'filiais:editar'
  | 'filiais:desativar'
  | 'filiais:consultar'
  | 'dashboard:executivo'
  | 'dashboard:comercial'
  | 'dashboard:gestor'
  | 'dashboard:sdr'
  | 'dashboard:vendedor'
  | 'pipeline:ler'
  | 'pipeline:escrever'
  | 'propostas:ler'
  | 'propostas:escrever'

const TODAS_PERMISSOES: Permissao[] = [
  'usuarios:convidar', 'usuarios:ativar', 'usuarios:desativar',
  'usuarios:alterar_papel', 'usuarios:alterar_equipe', 'usuarios:alterar_filial', 'usuarios:consultar',
  'times:criar', 'times:editar', 'times:desativar', 'times:consultar',
  'filiais:criar', 'filiais:editar', 'filiais:desativar', 'filiais:consultar',
  'dashboard:executivo', 'dashboard:comercial', 'dashboard:gestor', 'dashboard:sdr', 'dashboard:vendedor',
  'pipeline:ler', 'pipeline:escrever',
  'propostas:ler', 'propostas:escrever',
]

export const RBAC: Record<PapelSistema, Permissao[]> = {
  ADMINISTRADOR: TODAS_PERMISSOES,

  DIRETOR_COMERCIAL: [
    'dashboard:executivo', 'dashboard:comercial',
    'pipeline:ler', 'propostas:ler',
    'usuarios:consultar', 'times:consultar', 'filiais:consultar',
  ],

  GERENTE_COMERCIAL: [
    'dashboard:comercial', 'dashboard:gestor',
    'pipeline:ler', 'pipeline:escrever',
    'propostas:ler', 'propostas:escrever',
    'usuarios:consultar', 'usuarios:alterar_equipe',
    'times:criar', 'times:editar', 'times:consultar',
    'filiais:consultar',
  ],

  SUPERVISOR: [
    'dashboard:gestor',
    'pipeline:ler', 'propostas:ler',
    'usuarios:consultar', 'times:consultar', 'filiais:consultar',
  ],

  SDR: [
    'dashboard:sdr',
    'pipeline:ler', 'pipeline:escrever',
  ],

  VENDEDOR: [
    'dashboard:vendedor',
    'pipeline:ler', 'pipeline:escrever',
    'propostas:ler', 'propostas:escrever',
  ],

  CS: [
    'dashboard:vendedor',
    'pipeline:ler', 'propostas:ler',
  ],

  FINANCEIRO: [
    'dashboard:executivo',
    'propostas:ler',
  ],

  LEITOR: [
    'pipeline:ler', 'propostas:ler',
    'usuarios:consultar', 'times:consultar', 'filiais:consultar',
  ],
}

export function possuiPermissao(papel: PapelSistema, permissao: Permissao): boolean {
  return RBAC[papel].includes(permissao)
}

export function permissoesDoRole(papel: PapelSistema): Permissao[] {
  return [...RBAC[papel]]
}
