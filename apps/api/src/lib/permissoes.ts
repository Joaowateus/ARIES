/**
 * Módulo central de permissões. Substitui as cópias soltas de
 * PAPEIS_GESTAO que existiam em precificacao.ts/metas.ts/protocolos.ts e a
 * checagem duplicada no frontend (vendedores/page.tsx).
 */

export const PAPEIS = [
  'ADMINISTRADOR',
  'DIRETOR_COMERCIAL',
  'GERENTE_COMERCIAL',
  'SUPERVISOR',
  'COORDENADOR',
  'VENDEDOR',
  'CS',
  'FINANCEIRO',
  'LEITOR',
] as const

export type Papel = (typeof PAPEIS)[number]

/** Nível hierárquico — maior número = mais acesso. Papéis utilitários
 * (CS/FINANCEIRO/LEITOR) ficam fora da escada de gestão, nível 0. */
export const NIVEL_HIERARQUICO: Record<string, number> = {
  ADMINISTRADOR: 6,
  DIRETOR_COMERCIAL: 5,
  GERENTE_COMERCIAL: 4,
  SUPERVISOR: 3,
  COORDENADOR: 2,
  VENDEDOR: 1,
  CS: 0,
  FINANCEIRO: 0,
  LEITOR: 0,
}

/** Papéis que administram a operação (podiam criar/editar metas, protocolos,
 * parâmetros de precificação etc.) — mesmo conjunto que já era usado antes,
 * agora centralizado. */
export const PAPEIS_GESTAO = ['ADMINISTRADOR', 'DIRETOR_COMERCIAL', 'GERENTE_COMERCIAL'] as const

/** A partir de COORDENADOR (nível 2) o usuário passa a enxergar dados de
 * equipe, não só os próprios — Coordenador já "distribui tarefas" e
 * "acompanha vendedores" no desenho original, então a visão de equipe
 * começa nele, não só a partir de Supervisor. */
export const NIVEL_MINIMO_VISAO_EQUIPE = 2

export function nivelDe(papel: string): number {
  return NIVEL_HIERARQUICO[papel] ?? 0
}

export function ehGestao(papel: string): boolean {
  return (PAPEIS_GESTAO as readonly string[]).includes(papel)
}

export function veEquipe(papel: string): boolean {
  return nivelDe(papel) >= NIVEL_MINIMO_VISAO_EQUIPE
}

export interface UsuarioAuth {
  sub: string
  papel: string
  empresaId: string
}

export type Escopo = { tipo: 'todos' } | { tipo: 'equipe'; usuarioIds: string[] } | { tipo: 'proprio'; usuarioId: string }

/**
 * Decide o filtro de visibilidade para rotas "individuais" (CRM, rotina,
 * tarefas, anúncios, conteúdo...). SUPERVISOR/COORDENADOR veem a própria
 * equipe (subordinados diretos e indiretos via gestorId); GERENTE_COMERCIAL
 * pra cima vê tudo da empresa; VENDEDOR (e os papéis utilitários) só o
 * próprio.
 */
export async function escopoVisibilidade(
  prisma: import('@prisma/client').PrismaClient,
  usuario: UsuarioAuth
): Promise<Escopo> {
  const nivel = nivelDe(usuario.papel)
  if (nivel >= 4) return { tipo: 'todos' }
  if (nivel >= NIVEL_MINIMO_VISAO_EQUIPE) {
    const equipe = await subordinadosDe(prisma, usuario.empresaId, usuario.sub)
    return { tipo: 'equipe', usuarioIds: [usuario.sub, ...equipe] }
  }
  return { tipo: 'proprio', usuarioId: usuario.sub }
}

/** Traduz um Escopo num fragmento de `where` do Prisma sobre um campo de
 * dono (ex: responsavelId, usuarioId). */
export function escopoWhereDono(escopo: Escopo, campo: string): Record<string, unknown> {
  if (escopo.tipo === 'todos') return {}
  if (escopo.tipo === 'equipe') return { [campo]: { in: escopo.usuarioIds } }
  return { [campo]: escopo.usuarioId }
}

/** Percorre a cadeia gestorId para achar todos os subordinados (diretos e
 * indiretos) de um usuário dentro da empresa. */
async function subordinadosDe(
  prisma: import('@prisma/client').PrismaClient,
  empresaId: string,
  usuarioId: string
): Promise<string[]> {
  const todos = await prisma.usuario.findMany({
    where: { empresaId },
    select: { id: true, gestorId: true },
  })

  const filhosDe = new Map<string, string[]>()
  for (const u of todos) {
    if (!u.gestorId) continue
    if (!filhosDe.has(u.gestorId)) filhosDe.set(u.gestorId, [])
    filhosDe.get(u.gestorId)!.push(u.id)
  }

  const resultado: string[] = []
  const fila = [...(filhosDe.get(usuarioId) ?? [])]
  while (fila.length) {
    const id = fila.shift()!
    resultado.push(id)
    fila.push(...(filhosDe.get(id) ?? []))
  }
  return resultado
}
