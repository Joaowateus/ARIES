// Referências (aba do Social Media, benchmark): para cada moto do estoque, os
// vídeos públicos do Instagram com mais engajamento (busca por hashtag,
// top_media) e os perfis de referência escolhidos pela loja (Business
// Discovery), com os vídeos de melhor desempenho de cada um. Os vídeos dos
// perfis que falam de uma moto do estoque (pela legenda) entram também na
// moto. A régua é pública: curtidas + comentários (o Instagram não informa
// visualizações nem alcance de outras contas).
import { prisma } from './prisma'
import { ErroGraphApi, MidiaPublica, comApiDaEmpresa, midiasDaHashtag, midiasDoPerfil } from './instagramGraph'
import { normalizarUsuario } from './smConcorrentes'

const DIA = 864e5
export const LIMITE_HASHTAGS_SEMANA = 30
// Folga para outras buscas da conta: o sistema usa até 26 das 30.
const TETO_HASHTAGS = 26
export const MAX_PERFIS = 20
const VIDEOS_POR_FONTE = 30
const REBUSCAR_APOS = 3 * DIA

export class ErroReferencia extends Error { constructor(readonly status: number, message: string) { super(message) } }

export const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
export const chaveDaMoto = (marca: string | null, modelo: string) => normalizar(`${marca ?? ''} ${modelo}`)
const junto = (t: string) => normalizar(t).replace(/ /g, '')
export const engajamento = (v: { curtidas: number | null; comentarios: number | null }) => (v.curtidas ?? 0) + (v.comentarios ?? 0)

/** "CG 160 Fan" da Honda → #cg160fan e #hondacg160fan. */
export function hashtagsSugeridas(marca: string | null, modelo: string): string[] {
  const m = junto(modelo)
  return [...new Set([m, `${junto(marca ?? '')}${m}`])].filter(h => /^[a-z0-9]{3,40}$/.test(h)).slice(0, 2)
}
export const hashtagValida = (h: string) => /^[a-z0-9_]{2,60}$/.test(h)
export const limparHashtag = (h: string) => junto(h.replace(/^#/, ''))

/** A legenda fala da moto (modelo com ou sem espaço, ex.: "cg 160" ou "#cg160"). */
export function legendaFalaDaMoto(legenda: string | null, modelo: string): boolean {
  if (!legenda) return false
  const l = normalizar(legenda), m = normalizar(modelo)
  if (m.length >= 3 && ` ${l} `.includes(` ${m} `)) return true
  const mj = junto(modelo)
  return mj.length >= 4 && /\d/.test(mj) && l.replace(/ /g, '').includes(mj)
}

interface MotoDoEstoque { chave: string; nome: string; modelo: string; marca: string | null; quantidade: number }
async function motosDoEstoque(usuarioId: string): Promise<MotoDoEstoque[]> {
  const estoque = await prisma.smMotoEstoque.findMany({ where: { usuarioId, situacao: { not: 'VENDIDA' } }, select: { modelo: true, marca: true } })
  const porChave = new Map<string, MotoDoEstoque>()
  for (const m of estoque) {
    const chave = chaveDaMoto(m.marca, m.modelo)
    if (!chave) continue
    const atual = porChave.get(chave)
    if (atual) atual.quantidade++
    else porChave.set(chave, { chave, nome: [m.marca, m.modelo].filter(Boolean).join(' '), modelo: m.modelo, marca: m.marca, quantidade: 1 })
  }
  return [...porChave.values()].sort((a, b) => a.nome.localeCompare(b.nome))
}

async function contaDaEmpresa(usuarioId: string) {
  return prisma.socialMediaConta.findUnique({ where: { titular: `dono:${usuarioId}` }, select: { tipoConexao: true, instagramUserId: true, accessToken: true, nomeUsuario: true } })
}

function mensagemDeErro(e: unknown): string {
  if (e instanceof ErroGraphApi && (e.codigo === 10 || e.codigo === 200 || /permission|Public Content/i.test(e.message))) {
    return 'A conta do Instagram ainda não tem a permissão de busca de hashtags (Instagram Public Content Access) no app da Meta.'
  }
  if (e instanceof ErroGraphApi && (e.codigo === 110 || /business_discovery|not found|Invalid user/i.test(e.message))) return 'Perfil não encontrado ou não é uma conta profissional (comercial ou de criador).'
  if (e instanceof ErroGraphApi && /hashtag/i.test(e.message) && /limit|30/i.test(e.message)) return 'O Instagram limita a 30 hashtags por semana: tenta de novo em alguns dias.'
  return e instanceof Error ? e.message : 'Falha ao falar com o Instagram'
}

const paraVideo = (usuarioId: string, origem: 'HASHTAG' | 'PERFIL', fonte: string, motoChave: string | null, autor: string | null, m: MidiaPublica) => ({
  usuarioId, mediaId: m.id, origem, fonte, motoChave, autor, permalink: m.permalink, legenda: m.legenda?.slice(0, 2000) ?? null,
  curtidas: m.curtidas, comentarios: m.comentarios, formato: m.formato, publicadoEm: m.publicadoEm,
})
type Busca = { h: string; em: string }
const buscasDe = (j: unknown): Busca[] => (Array.isArray(j) ? j.filter((b): b is Busca => !!b && typeof b.h === 'string' && typeof b.em === 'string') : [])
/** Hashtags pesquisadas nos últimos 7 dias (todas as motos): é o que o Instagram conta no limite. */
const usadasNaSemana = (motos: Array<{ buscadas: unknown }>, agora: Date) =>
  new Set(motos.flatMap(m => buscasDe(m.buscadas)).filter(b => agora.getTime() - Date.parse(b.em) < 7 * DIA).map(b => b.h))

const melhores = (lista: MidiaPublica[]) => lista.filter(m => m.video).sort((a, b) => engajamento(b) - engajamento(a)).slice(0, VIDEOS_POR_FONTE)

/** Busca os perfis e as hashtags das motos que estão vencidas (ou todas, com `forcar`), dentro do limite semanal e do prazo. */
export async function atualizarReferencias(usuarioId: string, opcoes: { agora?: Date; prazoMs?: number; forcar?: boolean } = {}) {
  const agora = opcoes.agora ?? new Date()
  const inicio = Date.now(), prazo = opcoes.prazoMs ?? 20_000
  const conta = await contaDaEmpresa(usuarioId)
  if (conta?.tipoConexao !== 'EMPRESA') return { perfis: 0, motos: 0 }
  const motos = await motosDoEstoque(usuarioId)
  let perfisLidos = 0, motosLidas = 0

  for (const p of await prisma.smReferenciaPerfil.findMany({ where: { usuarioId }, orderBy: { atualizadoEm: { sort: 'asc', nulls: 'first' } } })) {
    if (Date.now() - inicio > prazo) break
    if (!opcoes.forcar && p.atualizadoEm && agora.getTime() - p.atualizadoEm.getTime() < DIA - 3600e3) continue
    try {
      const r = await comApiDaEmpresa(() => midiasDoPerfil(conta.instagramUserId, conta.accessToken, p.usuario))
      const videos = melhores(r.midias)
      await prisma.$transaction([
        prisma.smReferenciaVideo.deleteMany({ where: { usuarioId, origem: 'PERFIL', fonte: p.usuario } }),
        prisma.smReferenciaVideo.createMany({ data: videos.map(v => paraVideo(usuarioId, 'PERFIL', p.usuario, motos.find(m => legendaFalaDaMoto(v.legenda, m.modelo))?.chave ?? null, r.usuario, v)), skipDuplicates: true }),
        prisma.smReferenciaPerfil.update({ where: { id: p.id }, data: { nome: r.nome, fotoUrl: r.fotoUrl, seguidores: r.seguidores, atualizadoEm: agora, ultimoErro: null } }),
      ])
      perfisLidos++
    } catch (e) {
      await prisma.smReferenciaPerfil.update({ where: { id: p.id }, data: { ultimoErro: mensagemDeErro(e) } })
    }
  }

  const salvas = new Map((await prisma.smReferenciaMoto.findMany({ where: { usuarioId } })).map(m => [m.chave, m]))
  // Hashtags já buscadas nos últimos 7 dias não contam de novo no limite do Instagram.
  const usadas = usadasNaSemana([...salvas.values()], agora)
  const fila = motos
    .map(m => ({ moto: m, salva: salvas.get(m.chave) }))
    .filter(({ salva }) => opcoes.forcar || !salva?.buscadoEm || agora.getTime() - salva.buscadoEm.getTime() >= REBUSCAR_APOS)
    .sort((a, b) => (a.salva?.buscadoEm?.getTime() ?? 0) - (b.salva?.buscadoEm?.getTime() ?? 0))
  for (const { moto, salva } of fila) {
    if (Date.now() - inicio > prazo) break
    const hashtags = salva?.hashtags.length ? salva.hashtags : hashtagsSugeridas(moto.marca, moto.modelo)
    if (!hashtags.length) continue
    const novas = hashtags.filter(h => !usadas.has(h))
    if (usadas.size + novas.length > TETO_HASHTAGS) {
      await prisma.smReferenciaMoto.upsert({ where: { usuarioId_chave: { usuarioId, chave: moto.chave } }, create: { usuarioId, chave: moto.chave, hashtags, ultimoErro: 'Limite semanal de hashtags do Instagram: esta moto entra na próxima busca.' }, update: { ultimoErro: 'Limite semanal de hashtags do Instagram: esta moto entra na próxima busca.' } })
      continue
    }
    // Registra cada busca antes de fazer (conta no limite mesmo se der erro); guarda só a última semana.
    const buscadas = buscasDe(salva?.buscadas).filter(b => agora.getTime() - Date.parse(b.em) < 7 * DIA)
    try {
      const achadas: Array<{ fonte: string; m: MidiaPublica }> = []
      for (const h of hashtags) {
        usadas.add(h)
        buscadas.push({ h, em: agora.toISOString() })
        for (const m of await comApiDaEmpresa(() => midiasDaHashtag(conta.instagramUserId, conta.accessToken, h))) achadas.push({ fonte: h, m })
      }
      const vistos = new Set<string>()
      const videos = achadas.filter(a => a.m.video && !vistos.has(a.m.id) && vistos.add(a.m.id)).sort((a, b) => engajamento(b.m) - engajamento(a.m)).slice(0, VIDEOS_POR_FONTE)
      await prisma.$transaction([
        prisma.smReferenciaVideo.deleteMany({ where: { usuarioId, origem: 'HASHTAG', motoChave: moto.chave } }),
        prisma.smReferenciaVideo.createMany({ data: videos.map(a => paraVideo(usuarioId, 'HASHTAG', a.fonte, moto.chave, null, a.m)), skipDuplicates: true }),
        prisma.smReferenciaMoto.upsert({ where: { usuarioId_chave: { usuarioId, chave: moto.chave } }, create: { usuarioId, chave: moto.chave, hashtags, buscadoEm: agora, buscadas }, update: { buscadoEm: agora, ultimoErro: null, buscadas } }),
      ])
      motosLidas++
    } catch (e) {
      await prisma.smReferenciaMoto.upsert({ where: { usuarioId_chave: { usuarioId, chave: moto.chave } }, create: { usuarioId, chave: moto.chave, hashtags, ultimoErro: mensagemDeErro(e), buscadas }, update: { ultimoErro: mensagemDeErro(e), buscadas } })
    }
  }
  return { perfis: perfisLidos, motos: motosLidas }
}

const SELECT_VIDEO = { id: true, origem: true, fonte: true, autor: true, permalink: true, legenda: true, curtidas: true, comentarios: true, formato: true, publicadoEm: true, motoChave: true } as const

export async function painelReferencias(usuarioId: string, agora = new Date()) {
  const [conta, motos, salvas, perfis, videos] = await Promise.all([
    contaDaEmpresa(usuarioId),
    motosDoEstoque(usuarioId),
    prisma.smReferenciaMoto.findMany({ where: { usuarioId } }),
    prisma.smReferenciaPerfil.findMany({ where: { usuarioId }, orderBy: { criadoEm: 'asc' } }),
    prisma.smReferenciaVideo.findMany({ where: { usuarioId }, select: SELECT_VIDEO, take: 3000 }),
  ])
  const porChave = new Map(salvas.map(m => [m.chave, m]))
  const ordenar = <T extends { curtidas: number | null; comentarios: number | null }>(l: T[]) => [...l].sort((a, b) => engajamento(b) - engajamento(a))
  const seguidoresDe = new Map(perfis.map(p => [p.usuario, p.seguidores]))
  const comTaxa = (v: (typeof videos)[number]) => {
    const seg = v.autor ? seguidoresDe.get(v.autor) ?? null : null
    return { ...v, engajamento: engajamento(v), taxa: seg ? Math.round((engajamento(v) / seg) * 10000) / 100 : null }
  }
  const usadas = usadasNaSemana(salvas, agora)
  return {
    disponivel: conta?.tipoConexao === 'EMPRESA',
    conta: conta?.nomeUsuario ?? null,
    hashtagsSemana: { usadas: usadas.size, limite: LIMITE_HASHTAGS_SEMANA },
    motos: motos.map(m => {
      const s = porChave.get(m.chave)
      return {
        chave: m.chave, nome: m.nome, quantidade: m.quantidade,
        hashtags: s?.hashtags.length ? s.hashtags : hashtagsSugeridas(m.marca, m.modelo),
        buscadoEm: s?.buscadoEm ?? null, ultimoErro: s?.ultimoErro ?? null,
        videos: ordenar(videos.filter(v => v.motoChave === m.chave)).slice(0, 12).map(comTaxa),
      }
    }),
    perfis: perfis.map(p => ({
      id: p.id, usuario: p.usuario, nome: p.nome, fotoUrl: p.fotoUrl, seguidores: p.seguidores, atualizadoEm: p.atualizadoEm, ultimoErro: p.ultimoErro,
      videos: ordenar(videos.filter(v => v.origem === 'PERFIL' && v.fonte === p.usuario)).slice(0, 9).map(comTaxa),
    })),
  }
}

export async function adicionarPerfil(usuarioId: string, entrada: string) {
  const usuario = normalizarUsuario(entrada)
  if (!usuario) throw new ErroReferencia(400, 'Informe o @ do perfil (ex.: @canal.motos)')
  if (await prisma.smReferenciaPerfil.count({ where: { usuarioId } }) >= MAX_PERFIS) throw new ErroReferencia(400, `Até ${MAX_PERFIS} perfis de referência`)
  if (await prisma.smReferenciaPerfil.findUnique({ where: { usuarioId_usuario: { usuarioId, usuario } } })) throw new ErroReferencia(409, 'Esse perfil já está nas referências')
  await prisma.smReferenciaPerfil.create({ data: { usuarioId, usuario } })
  // Já traz os vídeos do perfil novo (não gasta hashtags).
  await atualizarReferencias(usuarioId, { prazoMs: 8000 })
}

export async function removerPerfil(usuarioId: string, id: string) {
  const p = await prisma.smReferenciaPerfil.findFirst({ where: { id, usuarioId } })
  if (!p) throw new ErroReferencia(404, 'Perfil não encontrado')
  await prisma.$transaction([
    prisma.smReferenciaVideo.deleteMany({ where: { usuarioId, origem: 'PERFIL', fonte: p.usuario } }),
    prisma.smReferenciaPerfil.delete({ where: { id: p.id } }),
  ])
}

export async function salvarHashtags(usuarioId: string, chave: string, entrada: string[]) {
  const motos = await motosDoEstoque(usuarioId)
  if (!motos.some(m => m.chave === chave)) throw new ErroReferencia(404, 'Moto não está no estoque')
  const hashtags = [...new Set(entrada.map(limparHashtag))].filter(Boolean)
  if (!hashtags.length || hashtags.length > 3 || !hashtags.every(hashtagValida)) throw new ErroReferencia(400, 'Use de 1 a 3 hashtags (letras e números, sem espaço)')
  // Hashtag nova: busca de novo na próxima atualização.
  await prisma.smReferenciaMoto.upsert({ where: { usuarioId_chave: { usuarioId, chave } }, create: { usuarioId, chave, hashtags }, update: { hashtags, buscadoEm: null, ultimoErro: null } })
}

/** Job do dia: todas as lojas com o Instagram conectado pela empresa. */
export async function rodarReferencias(agora = new Date()) {
  const contas = await prisma.socialMediaConta.findMany({ where: { tipoConexao: 'EMPRESA', titular: { startsWith: 'dono:' } }, select: { titular: true } })
  let perfis = 0, motos = 0
  for (const c of contas) {
    const r = await atualizarReferencias(c.titular.slice(5), { agora, prazoMs: 8000 }).catch(() => ({ perfis: 0, motos: 0 }))
    perfis += r.perfis; motos += r.motos
  }
  return { referenciasPerfis: perfis, referenciasMotos: motos }
}
