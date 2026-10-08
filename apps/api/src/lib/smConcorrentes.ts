// Fase 6 · Concorrentes (seção 18, decisão P12): perfis de outras revendas
// da região, escolhidos pelo gestor, acompanhados pela Business Discovery API
// (dados públicos: seguidores, posts, curtidas e comentários). Um retrato por
// dia guarda a evolução. A conta da loja entra na comparação pela mesma
// régua (curtidas + comentários por post), sem métrica privada.
import { prisma } from './prisma'
import { buscarPerfilConcorrente, comApiDaEmpresa, ErroGraphApi } from './instagramGraph'
import { diaLocal } from './smCalendario'

const DIA_MS = 864e5
const JANELA_DIAS = 28
export const MAX_CONCORRENTES = 10

export class ErroConcorrente extends Error { constructor(readonly status: number, message: string) { super(message) } }

/** "@Loja.Motos", "instagram.com/loja.motos/" ou "loja.motos" → "loja.motos". */
export function normalizarUsuario(entrada: string): string | null {
  const t = entrada.trim().replace(/^(https?:\/\/)?(www\.|m\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '').replace(/^@/, '').toLowerCase()
  return /^[a-z0-9._]{1,30}$/.test(t) ? t : null
}

async function contaDaEmpresa(usuarioId: string) {
  const c = await prisma.socialMediaConta.findUnique({
    where: { titular: `dono:${usuarioId}` },
    select: { id: true, tipoConexao: true, instagramUserId: true, accessToken: true, nomeUsuario: true, fotoUrl: true, seguidores: true },
  })
  return c
}

/** Frequência e engajamento público a partir dos últimos posts (janela de 28 dias). */
export function medirPosts(posts: Array<{ publicadoEm: Date; curtidas: number | null; comentarios: number | null }>, agora: Date) {
  const desde = agora.getTime() - JANELA_DIAS * DIA_MS
  const janela = posts.filter(p => p.publicadoEm.getTime() >= desde && p.publicadoEm.getTime() <= agora.getTime())
  const comNumeros = janela.filter(p => p.curtidas != null || p.comentarios != null)
  const ultimo = posts.reduce<Date | null>((m, p) => (!m || p.publicadoEm > m ? p.publicadoEm : m), null)
  return {
    postsSemana: Math.round((janela.length / (JANELA_DIAS / 7)) * 10) / 10,
    engajamentoMedio: comNumeros.length ? Math.round(comNumeros.reduce((s, p) => s + (p.curtidas ?? 0) + (p.comentarios ?? 0), 0) / comNumeros.length) : null,
    ultimoPostEm: ultimo,
  }
}

/** Busca o perfil público e guarda o retrato do dia (ou o erro, sem apagar o histórico). */
export async function retratar(usuarioId: string, concorrenteId: string, agora = new Date()) {
  const conta = await contaDaEmpresa(usuarioId)
  const c = await prisma.smConcorrente.findFirst({ where: { id: concorrenteId, usuarioId } })
  if (!c) return null
  if (conta?.tipoConexao !== 'EMPRESA') return null
  try {
    const p = await comApiDaEmpresa(() => buscarPerfilConcorrente(conta.instagramUserId, conta.accessToken, c.usuario))
    const m = medirPosts(p.ultimos, agora)
    const data = diaLocal(agora)
    const dados = { seguidores: p.seguidores, posts: p.posts, postsSemana: m.postsSemana, engajamentoMedio: m.engajamentoMedio, ultimoPostEm: m.ultimoPostEm }
    await prisma.$transaction([
      prisma.smConcorrenteRetrato.upsert({ where: { concorrenteId_data: { concorrenteId: c.id, data } }, create: { concorrenteId: c.id, data, ...dados }, update: dados }),
      prisma.smConcorrente.update({ where: { id: c.id }, data: { nome: p.nome, fotoUrl: p.fotoUrl, atualizadoEm: agora, ultimoErro: null } }),
    ])
    return true
  } catch (e) {
    const msg = e instanceof ErroGraphApi && (e.codigo === 110 || /business_discovery|not found|não encontrado|Invalid user/i.test(e.message))
      ? 'Perfil não encontrado ou não é uma conta profissional (comercial ou de criador).'
      : e instanceof Error ? e.message : 'Falha ao ler o perfil'
    await prisma.smConcorrente.update({ where: { id: c.id }, data: { ultimoErro: msg } })
    return false
  }
}

export async function adicionarConcorrente(usuarioId: string, entrada: string, agora = new Date()) {
  const usuario = normalizarUsuario(entrada)
  if (!usuario) throw new ErroConcorrente(400, 'Informe o @ do perfil (ex.: @loja.motos)')
  const conta = await contaDaEmpresa(usuarioId)
  if (conta?.nomeUsuario?.toLowerCase() === usuario) throw new ErroConcorrente(400, 'Esse é o perfil da própria loja')
  if (await prisma.smConcorrente.count({ where: { usuarioId } }) >= MAX_CONCORRENTES) throw new ErroConcorrente(400, `Acompanhe até ${MAX_CONCORRENTES} perfis`)
  const existe = await prisma.smConcorrente.findUnique({ where: { usuarioId_usuario: { usuarioId, usuario } } })
  if (existe) throw new ErroConcorrente(409, 'Esse perfil já está na lista')
  const c = await prisma.smConcorrente.create({ data: { usuarioId, usuario } })
  await retratar(usuarioId, c.id, agora)
  return c
}

export async function removerConcorrente(usuarioId: string, id: string) {
  const r = await prisma.smConcorrente.deleteMany({ where: { id, usuarioId } })
  if (!r.count) throw new ErroConcorrente(404, 'Perfil não encontrado')
}

/** Tabela da subseção "Concorrentes" do Desempenho: a loja e cada perfil, com a variação de seguidores em 30 dias. */
export async function painelConcorrentes(usuarioId: string, agora = new Date()) {
  const conta = await contaDaEmpresa(usuarioId)
  const empresa = conta?.tipoConexao === 'EMPRESA'
  const desde30 = diaLocal(new Date(agora.getTime() - 30 * DIA_MS))
  const lista = await prisma.smConcorrente.findMany({
    where: { usuarioId }, orderBy: { criadoEm: 'asc' },
    include: { retratos: { where: { data: { gte: desde30 } }, orderBy: { data: 'asc' } } },
  })
  const perfis = lista.map(c => {
    const ultimo = c.retratos[c.retratos.length - 1] ?? null
    const primeiro = c.retratos[0] ?? null
    return {
      id: c.id, usuario: c.usuario, nome: c.nome, fotoUrl: c.fotoUrl, atualizadoEm: c.atualizadoEm, erro: c.ultimoErro,
      seguidores: ultimo?.seguidores ?? null,
      variacao30d: ultimo && primeiro && primeiro.data !== ultimo.data ? ultimo.seguidores - primeiro.seguidores : null,
      desde: primeiro && primeiro.data !== ultimo?.data ? primeiro.data : null,
      postsSemana: ultimo?.postsSemana ?? null,
      engajamentoMedio: ultimo?.engajamentoMedio ?? null,
      taxaEngajamento: ultimo?.engajamentoMedio != null && ultimo.seguidores > 0 ? Math.round((ultimo.engajamentoMedio / ultimo.seguidores) * 10000) / 100 : null,
      ultimoPostEm: ultimo?.ultimoPostEm ?? null,
      serie: c.retratos.map(r => ({ data: r.data, seguidores: r.seguidores })),
    }
  })
  // A loja, pela mesma régua pública (curtidas + comentários dos posts do feed).
  let loja = null
  if (conta) {
    const posts = await prisma.socialMediaMidia.findMany({
      where: { contaId: conta.id, publicadoEm: { gte: new Date(agora.getTime() - JANELA_DIAS * DIA_MS) }, NOT: { formato: { in: ['STORY', 'AD'] } } },
      select: { publicadoEm: true, curtidas: true, comentarios: true },
    })
    const ultimo = await prisma.socialMediaMidia.findFirst({ where: { contaId: conta.id, NOT: { formato: { in: ['STORY', 'AD'] } } }, orderBy: { publicadoEm: 'desc' }, select: { publicadoEm: true } })
    const m = medirPosts(posts, agora)
    const snap30 = await prisma.socialMediaSnapshotDiario.findFirst({
      where: { contaId: conta.id, seguidores: { not: null }, data: { gte: new Date(agora.getTime() - 31 * DIA_MS) } }, orderBy: { data: 'asc' }, select: { seguidores: true },
    })
    loja = {
      usuario: conta.nomeUsuario, fotoUrl: conta.fotoUrl, seguidores: conta.seguidores,
      variacao30d: snap30?.seguidores != null ? conta.seguidores - snap30.seguidores : null,
      postsSemana: m.postsSemana, engajamentoMedio: m.engajamentoMedio,
      taxaEngajamento: m.engajamentoMedio != null && conta.seguidores > 0 ? Math.round((m.engajamentoMedio / conta.seguidores) * 10000) / 100 : null,
      ultimoPostEm: ultimo?.publicadoEm ?? null,
    }
  }
  return { disponivel: empresa, motivo: empresa ? null : 'A comparação usa a Business Discovery API, que só funciona com a conta da empresa conectada (Graph do Facebook).', max: MAX_CONCORRENTES, loja, perfis }
}

/** Job do dia: um retrato por perfil (contas da empresa). */
export async function rodarConcorrentes(agora = new Date()) {
  const hoje = diaLocal(agora)
  const pendentes = await prisma.smConcorrente.findMany({ where: { retratos: { none: { data: hoje } } }, select: { id: true, usuarioId: true } })
  let feitos = 0
  for (const c of pendentes) if (await retratar(c.usuarioId, c.id, agora)) feitos++
  return { concorrentes: feitos }
}
