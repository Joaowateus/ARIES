// Acesso do papel Social Media (seção 3.1 da especificação).
//
// - Um token SOCIAL_MEDIA só passa em /pro-labore/sm/* e em /pro-labore/auth/me
//   (guardaPapelSocialMedia, montado antes de todas as rotas do Pró-Labore).
//   Assim nenhuma rota antiga que trata "não é vendedor" como dono vaza dados.
// - Dentro de /sm/*, cada rota pede o módulo e o nível (requireModuloSM).
// - O dono pode navegar no espaço do papel com `x-ver-como: SOCIAL_MEDIA`:
//   valem exatamente os mesmos filtros, em modo só leitura.
import { NextFunction, Request, Response } from 'express'
import { prisma } from './prisma'
import { marcarAtividade } from './smAtividade'
import { verifyProLaboreToken } from './jwtProLabore'

export const MODULOS_SM = ['analise', 'producao', 'atendimento', 'estoque', 'crm', 'vendas', 'trafego', 'financeiro', 'dashboard', 'agenda', 'reunioes', 'anotacoes'] as const
// Ferramentas pessoais do painel que o gestor pode liberar para o papel: o
// Social Media usa as telas de Agenda, Reuniões e Anotações com os dados
// dele (um cadastro próprio na equipe, ver vendedorDoMembro).
export const MODULOS_PESSOAIS_SM = ['agenda', 'reunioes', 'anotacoes'] as const
export type ModuloSM = (typeof MODULOS_SM)[number]
export const NIVEIS_SM = ['COMPLETO', 'LEITURA', 'SEM_ACESSO'] as const
export type NivelSM = (typeof NIVEIS_SM)[number]

export const NIVEIS_PADRAO: Record<ModuloSM, NivelSM> = {
  analise: 'COMPLETO',
  producao: 'COMPLETO',
  atendimento: 'COMPLETO',
  estoque: 'LEITURA',
  crm: 'LEITURA',
  vendas: 'LEITURA',
  trafego: 'LEITURA',
  financeiro: 'SEM_ACESSO',
  dashboard: 'SEM_ACESSO',
  agenda: 'SEM_ACESSO',
  reunioes: 'SEM_ACESSO',
  anotacoes: 'SEM_ACESSO',
}

export interface RegrasSM {
  aprovacaoGestor: boolean
  mostrarValores: boolean
  relatorioSemanal: boolean
  assistenteIA: boolean
}

export const REGRAS_PADRAO: RegrasSM = { aprovacaoGestor: true, mostrarValores: true, relatorioSemanal: true, assistenteIA: false }

export interface PermissoesSM { niveis: Record<ModuloSM, NivelSM>; regras: RegrasSM }

const PESO: Record<NivelSM, number> = { SEM_ACESSO: 0, LEITURA: 1, COMPLETO: 2 }

export function niveisCompletos(salvo: unknown): Record<ModuloSM, NivelSM> {
  const s = (salvo && typeof salvo === 'object' ? salvo : {}) as Record<string, unknown>
  const r = { ...NIVEIS_PADRAO }
  for (const m of MODULOS_SM) if (NIVEIS_SM.includes(s[m] as NivelSM)) r[m] = s[m] as NivelSM
  return r
}

export async function carregarPermissoes(usuarioId: string): Promise<PermissoesSM> {
  const p = await prisma.smPermissao.findUnique({ where: { usuarioId } })
  if (!p) return { niveis: { ...NIVEIS_PADRAO }, regras: { ...REGRAS_PADRAO } }
  return {
    niveis: niveisCompletos(p.niveis),
    regras: { aprovacaoGestor: p.aprovacaoGestor, mostrarValores: p.mostrarValores, relatorioSemanal: p.relatorioSemanal, assistenteIA: p.assistenteIA },
  }
}

export interface ContextoSM {
  usuarioId: string // conta do dono (a operação)
  /** GESTOR: o dono no próprio painel. SOCIAL_MEDIA: o papel, ou o dono em "ver como". */
  visao: 'GESTOR' | 'SOCIAL_MEDIA'
  verComo: boolean
  somenteLeitura: boolean
  membroId: string | null
  permissoes: PermissoesSM
  /** Nível efetivo: o gestor tem tudo completo. */
  nivel: (m: ModuloSM) => NivelSM
  pode: (m: ModuloSM, minimo: NivelSM) => boolean
}

declare global {
  namespace Express {
    interface Request {
      sm?: ContextoSM
    }
  }
}

const ROTAS_PUBLICAS_SM = /^\/sm\/(cron|webhook|convite)\//
const ROTAS_DO_GESTOR_SM = /^\/sm\/gestor(\/|$)/
const ROTAS_PESSOAIS_SM = /^\/(agenda-itens|agenda-conclusoes|agenda-inicios|agenda|reunioes|apresentacoes|reunioes-departamentos|reunioes-pastas|notas|pastas|anotacoes|mapas-mentais|imagens|preferencias)(\/|$)/
// POST que só lê: perguntar ao assistente vale também no "ver como".
// Páginas abertas (não as listas que se atualizam sozinhas) contam como uso.
const ROTAS_DE_PAGINA_SM = /^\/sm\/(eu|hoje|foco|assistente\/[a-z]+)$/
const ROTAS_POST_LEITURA_SM = /^\/sm\/(assistente\/[a-z]+\/perguntar|foco\/concluir|busca\/ganchos)$/

/**
 * Montado em app.use('/pro-labore', ...) antes de todas as rotas do
 * Pró-Labore. Para tokens SOCIAL_MEDIA: confere se o acesso continua ativo
 * e barra tudo que não seja o espaço do papel.
 */
export async function guardaPapelSocialMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) { next(); return }
  let payload
  try { payload = verifyProLaboreToken(header.slice(7)) } catch { next(); return } // a rota responde 401
  if (payload.papel !== 'SOCIAL_MEDIA') { next(); return }

  const caminho = req.path
  // Fora do espaço do papel, só as rotas das ferramentas pessoais (o nível
  // de cada módulo é conferido na própria rota, pelos acessos).
  const permitido = caminho === '/auth/me' || (caminho.startsWith('/sm/') && !ROTAS_DO_GESTOR_SM.test(caminho))
    || ROTAS_PESSOAIS_SM.test(caminho) || (caminho === '/parametros' && req.method === 'GET')
  if (!permitido) {
    res.status(403).json({ error: 'Acesso restrito ao espaço do Social Media' })
    return
  }
  if (!payload.smMembroId) { res.status(401).json({ error: 'Token inválido ou expirado' }); return }
  // Ferramenta pessoal: o módulo dela precisa estar liberado na tela do papel.
  if (!caminho.startsWith('/sm/') && caminho !== '/auth/me') {
    const acessos = await acessosPessoaisSM(payload.sub)
    const modulos = modulosDaRota(caminho)
    const liberado = (modulos ?? MODULOS_PESSOAIS_SM).some(m => acessos[m] !== 'NENHUM')
    if (!liberado) { res.status(403).json({ error: 'Acesso restrito ao espaço do Social Media' }); return }
  }
  const membro = await prisma.smMembro.findUnique({ where: { id: payload.smMembroId }, select: { ativo: true, usuarioId: true, senhaHash: true } })
  if (!membro || !membro.ativo || !membro.senhaHash || membro.usuarioId !== payload.sub) {
    res.status(401).json({ error: 'Acesso do Social Media suspenso. Fale com o gestor.' })
    return
  }
  next()
}

/**
 * Resolve quem está pedindo dentro de /sm/* (depois de requireProLaboreAuth).
 * Vendedor e supervisor não entram no espaço do Social Media.
 */
export async function contextoSM(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (ROTAS_PUBLICAS_SM.test(req.path)) { next(); return }
  const u = req.proLaboreUser
  if (!u) { res.status(401).json({ error: 'Não autorizado' }); return }
  if (u.papel !== 'DONO' && u.papel !== 'SOCIAL_MEDIA') {
    res.status(403).json({ error: 'Acesso restrito ao espaço do Social Media' })
    return
  }
  const verComo = u.papel === 'DONO' && String(req.headers['x-ver-como'] ?? '').toUpperCase() === 'SOCIAL_MEDIA'
  const visao = u.papel === 'SOCIAL_MEDIA' || verComo ? 'SOCIAL_MEDIA' : 'GESTOR'
  if (verComo && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !ROTAS_POST_LEITURA_SM.test(req.path)) {
    res.status(403).json({ error: 'Pré-visualização do Social Media: só leitura' })
    return
  }
  const permissoes = await carregarPermissoes(u.sub)
  const nivel = (m: ModuloSM): NivelSM => (visao === 'GESTOR' ? 'COMPLETO' : permissoes.niveis[m])
  req.sm = {
    usuarioId: u.sub,
    visao,
    verComo,
    somenteLeitura: verComo,
    membroId: u.smMembroId ?? null,
    permissoes,
    nivel,
    pode: (m, minimo) => PESO[nivel(m)] >= PESO[minimo],
  }
  if (!verComo && (req.method !== 'GET' || ROTAS_DE_PAGINA_SM.test(req.path))) marcarAtividade(u.sub, visao === 'GESTOR' ? 'GESTOR' : u.smMembroId ?? 'GESTOR')
  next()
}

/** Exige o módulo no nível mínimo; responde 403 com uma frase clara. */
export function requireModuloSM(modulo: ModuloSM, minimo: NivelSM = 'LEITURA') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.sm) { res.status(500).json({ error: 'Contexto do Social Media ausente' }); return }
    if (!req.sm.pode(modulo, minimo)) {
      res.status(403).json({ error: minimo === 'COMPLETO' ? 'Seu acesso a este módulo é só leitura' : 'Sem acesso a este módulo', modulo })
      return
    }
    next()
  }
}

/** Só o dono no próprio painel (fora do "ver como"). */
export function requireGestorSM(req: Request, res: Response, next: NextFunction): void {
  if (req.proLaboreUser?.papel !== 'DONO' || req.sm?.verComo) {
    res.status(403).json({ error: 'Acesso restrito ao gestor' })
    return
  }
  next()
}

/** O mesmo contexto visto como o Social Media (só leitura): para prévias do gestor. */
export function comoSocialMedia(sm: ContextoSM): ContextoSM {
  const nivel = (m: ModuloSM): NivelSM => sm.permissoes.niveis[m]
  return { ...sm, visao: 'SOCIAL_MEDIA', verComo: true, somenteLeitura: true, membroId: null, nivel, pode: (m, minimo) => PESO[nivel(m)] >= PESO[minimo] }
}

const NIVEL_DO_SM: Record<NivelSM, 'NENHUM' | 'VER' | 'EDITAR'> = { COMPLETO: 'EDITAR', LEITURA: 'VER', SEM_ACESSO: 'NENHUM' }

/** Agenda, Reuniões e Anotações liberadas para o papel, no formato dos acessos da equipe. */
export async function acessosPessoaisSM(usuarioId: string): Promise<Record<string, 'NENHUM' | 'VER' | 'EDITAR'>> {
  const { niveis } = await carregarPermissoes(usuarioId)
  return Object.fromEntries(MODULOS_PESSOAIS_SM.map(m => [m, NIVEL_DO_SM[niveis[m]]]))
}

/**
 * O cadastro na equipe do Social Media (não vende, sem login próprio), criado
 * na primeira vez que ele usa uma ferramenta pessoal. Com ele, a agenda, as
 * reuniões e as anotações dessa pessoa ficam separadas das do dono, e o
 * gestor pode passar tarefas para ela na Agenda.
 */
export async function vendedorDoMembro(membroId: string): Promise<string | null> {
  const m = await prisma.smMembro.findUnique({ where: { id: membroId }, select: { id: true, usuarioId: true, nome: true, vendedorId: true } })
  if (!m) return null
  if (m.vendedorId) return m.vendedorId
  const v = await prisma.vendedor.create({ data: { usuarioId: m.usuarioId, nome: m.nome, vende: false } })
  const r = await prisma.smMembro.updateMany({ where: { id: m.id, vendedorId: null }, data: { vendedorId: v.id } })
  if (r.count) return v.id
  // Outro pedido criou ao mesmo tempo: fica o dele.
  await prisma.vendedor.delete({ where: { id: v.id } })
  return (await prisma.smMembro.findUnique({ where: { id: m.id }, select: { vendedorId: true } }))?.vendedorId ?? null
}

// Rota → módulos pessoais que a abrem. Reuniões e Anotações usam as rotas
// uma da outra (copiar entre elas, pastas), então basta uma das duas. Sem
// módulo (imagens, preferências, "ao vivo" do menu): alguma ferramenta liberada.
function modulosDaRota(caminho: string): Array<(typeof MODULOS_PESSOAIS_SM)[number]> | null {
  if (/^\/(agenda|parametros)/.test(caminho)) return ['agenda']
  if (caminho === '/apresentacoes/ao-vivo') return null
  if (/^\/(reunioes|apresentacoes|notas|pastas|anotacoes|mapas-mentais)/.test(caminho)) return ['reunioes', 'anotacoes']
  return null
}
