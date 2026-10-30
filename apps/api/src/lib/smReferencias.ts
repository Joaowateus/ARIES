// Referências (aba do Social Media, benchmark): para cada moto do estoque, os
// vídeos públicos do Instagram com mais engajamento (busca por hashtag,
// top_media) e os perfis de referência escolhidos pela loja (Business
// Discovery), com os vídeos de melhor desempenho de cada um. Os vídeos dos
// perfis que falam de uma moto do estoque (pela legenda) entram também na
// moto. A régua é pública: curtidas + comentários (o Instagram não informa
// visualizações nem alcance de outras contas). Guarda todos os formatos
// (Reels, vídeo, carrossel, foto) com a miniatura, separa concorrentes de
// referências, inclui a própria conta para comparar e mantém o banco de
// referências salvas pela equipe, que pode virar pauta na Produção.
import { prisma } from './prisma'
import { ErroGraphApi, MidiaPublica, comApiDaEmpresa, midiasDaHashtag, midiasDoPerfil } from './instagramGraph'
import { normalizarUsuario } from './smConcorrentes'

const DIA = 864e5
export const LIMITE_HASHTAGS_SEMANA = 30
// Folga para outras buscas da conta: o sistema usa até 26 das 30.
const TETO_HASHTAGS = 26
export const MAX_PERFIS = 30
export const TIPOS_PERFIL = ['REFERENCIA', 'CONCORRENTE'] as const
export type TipoPerfil = (typeof TIPOS_PERFIL)[number]
export const STATUS_SALVA = ['IDEIA', 'GRAVAR', 'FEITO'] as const
const POSTS_POR_FONTE = 50
const REBUSCAR_APOS = 3 * DIA

export class ErroReferencia extends Error { constructor(readonly status: number, message: string) { super(message) } }

export const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
export const chaveDaMoto = (marca: string | null, modelo: string) => normalizar(`${marca ?? ''} ${modelo}`)
const junto = (t: string) => normalizar(t).replace(/ /g, '')
export const engajamento = (v: { curtidas: number | null; comentarios: number | null }) => (v.curtidas ?? 0) + (v.comentarios ?? 0)

/**
 * Hashtags da moto, das mais específicas às mais buscadas: "CG 160 Titan" da Honda → #cg160titan, #hondacg160, #cg160.
 * Nome sem número sozinho é genérico demais (#pop traz de tudo): aí só com a marca (#hondapop).
 */
export function hashtagsSugeridas(marca: string | null, modelo: string): string[] {
  const tokens = normalizar(modelo).split(' ').filter(Boolean)
  const comNumero = tokens.findIndex(t => /\d/.test(t))
  const base = (comNumero >= 0 ? tokens.slice(0, comNumero + 1) : tokens.slice(0, 1)).join('')
  const inteiro = tokens.join('')
  const lista = [
    /\d/.test(inteiro) && inteiro.length >= 4 ? inteiro : null,
    marca ? `${junto(marca)}${base}` : null,
    /\d/.test(base) && base.length >= 4 ? base : null,
  ]
  return [...new Set(lista.filter((h): h is string => !!h && /^[a-z0-9]{3,40}$/.test(h)))].slice(0, 3)
}
/** As hashtags que o sistema sugeria antes (só o nome junto e marca + nome): trocadas pelas novas se ninguém editou. */
const sugestaoAntiga = (marca: string | null, modelo: string) => {
  const m = junto(modelo)
  return [...new Set([m, `${junto(marca ?? '')}${m}`])].filter(h => /^[a-z0-9]{3,40}$/.test(h)).slice(0, 2)
}
/** Hashtags em uso: as editadas pela equipe ou, se ainda são as automáticas antigas, as sugeridas agora. */
function hashtagsDaMoto(moto: { marca: string | null; modelo: string }, salvas: string[] | undefined) {
  const novas = hashtagsSugeridas(moto.marca, moto.modelo)
  if (!salvas?.length) return { hashtags: novas, trocou: false }
  const antigas = sugestaoAntiga(moto.marca, moto.modelo)
  const automaticas = salvas.length === antigas.length && salvas.every((h, i) => h === antigas[i])
  return automaticas && antigas.join() !== novas.join() ? { hashtags: novas, trocou: true } : { hashtags: salvas, trocou: false }
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
  curtidas: m.curtidas, comentarios: m.comentarios, formato: m.formato, midiaUrl: m.midiaUrl, publicadoEm: m.publicadoEm,
})
// n: quantos posts o Instagram devolveu naquela hashtag (diagnóstico na tela).
type Busca = { h: string; em: string; n?: number }
const buscasDe = (j: unknown): Busca[] => (Array.isArray(j) ? j.filter((b): b is Busca => !!b && typeof b.h === 'string' && typeof b.em === 'string') : [])
/** Hashtags pesquisadas nos últimos 7 dias (todas as motos): é o que o Instagram conta no limite. */
const usadasNaSemana = (motos: Array<{ buscadas: unknown }>, agora: Date) =>
  new Set(motos.flatMap(m => buscasDe(m.buscadas)).filter(b => agora.getTime() - Date.parse(b.em) < 7 * DIA).map(b => b.h))

const melhores = (lista: MidiaPublica[]) => [...lista].sort((a, b) => engajamento(b) - engajamento(a)).slice(0, POSTS_POR_FONTE)
const diaBelem = (d: Date) => new Date(d.getTime() - 3 * 3600e3).toISOString().slice(0, 10)
type Ponto = { d: string; s: number }
const pontosDe = (j: unknown): Ponto[] => (Array.isArray(j) ? j.filter((p): p is Ponto => !!p && typeof p.d === 'string' && typeof p.s === 'number') : [])
/** Seguidores do dia no histórico do perfil (um ponto por dia, últimos 180). */
function comPonto(historico: unknown, agora: Date, seguidores: number | null): Ponto[] {
  const d = diaBelem(agora)
  const lista = pontosDe(historico).filter(p => p.d !== d)
  if (seguidores != null) lista.push({ d, s: seguidores })
  return lista.sort((a, b) => a.d.localeCompare(b.d)).slice(-180)
}

/** A própria conta entra sozinha nos perfis (tipo EU), para comparar com os concorrentes. */
async function garantirContaPropria(usuarioId: string, nomeUsuario: string | null) {
  const usuario = nomeUsuario ? normalizarUsuario(nomeUsuario) : null
  if (!usuario) return
  await prisma.smReferenciaPerfil.updateMany({ where: { usuarioId, tipo: 'EU', usuario: { not: usuario } }, data: { tipo: 'REFERENCIA' } })
  await prisma.smReferenciaPerfil.upsert({ where: { usuarioId_usuario: { usuarioId, usuario } }, create: { usuarioId, usuario, tipo: 'EU' }, update: { tipo: 'EU' } })
}

/** Busca os perfis e as hashtags das motos que estão vencidas (ou todas, com `forcar`), dentro do limite semanal e do prazo. */
export async function atualizarReferencias(usuarioId: string, opcoes: { agora?: Date; prazoMs?: number; forcar?: boolean } = {}) {
  const agora = opcoes.agora ?? new Date()
  const inicio = Date.now(), prazo = opcoes.prazoMs ?? 20_000
  const conta = await contaDaEmpresa(usuarioId)
  if (conta?.tipoConexao !== 'EMPRESA') return { perfis: 0, motos: 0, pendentes: 0 }
  const motos = await motosDoEstoque(usuarioId)
  await garantirContaPropria(usuarioId, conta.nomeUsuario)
  let perfisLidos = 0, motosLidas = 0, perfisFaltando = 0

  // Os perfis usam no máximo metade do tempo: a outra metade é das motos (o que o Instagram tem sobre cada modelo).
  for (const p of await prisma.smReferenciaPerfil.findMany({ where: { usuarioId }, orderBy: { atualizadoEm: { sort: 'asc', nulls: 'first' } } })) {
    if (!opcoes.forcar && p.atualizadoEm && agora.getTime() - p.atualizadoEm.getTime() < DIA - 3600e3) continue
    if (Date.now() - inicio > prazo / 2) { perfisFaltando++; continue }
    try {
      const r = await comApiDaEmpresa(() => midiasDoPerfil(conta.instagramUserId, conta.accessToken, p.usuario))
      const videos = melhores(r.midias)
      await prisma.$transaction([
        prisma.smReferenciaVideo.deleteMany({ where: { usuarioId, origem: 'PERFIL', fonte: p.usuario } }),
        prisma.smReferenciaVideo.createMany({ data: videos.map(v => paraVideo(usuarioId, 'PERFIL', p.usuario, motos.find(m => legendaFalaDaMoto(v.legenda, m.modelo))?.chave ?? null, r.usuario, v)), skipDuplicates: true }),
        prisma.smReferenciaPerfil.update({ where: { id: p.id }, data: { nome: r.nome, fotoUrl: r.fotoUrl, seguidores: r.seguidores, posts: r.posts, historico: comPonto(p.historico, agora, r.seguidores), atualizadoEm: agora, ultimoErro: null } }),
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
    .map(m => ({ moto: m, salva: salvas.get(m.chave), ...hashtagsDaMoto(m, salvas.get(m.chave)?.hashtags) }))
    .filter(({ salva, trocou }) => opcoes.forcar || trocou || !salva?.buscadoEm || agora.getTime() - salva.buscadoEm.getTime() >= REBUSCAR_APOS)
    .sort((a, b) => (a.trocou || !a.salva?.buscadoEm ? 0 : a.salva.buscadoEm.getTime()) - (b.trocou || !b.salva?.buscadoEm ? 0 : b.salva.buscadoEm.getTime()))
  let motosSemTempo = 0
  for (const [i, { moto, salva, hashtags }] of fila.entries()) {
    if (Date.now() - inicio > prazo) { motosSemTempo = fila.length - i; break }
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
        const busca: Busca = { h, em: agora.toISOString() }
        buscadas.push(busca)
        const midias = await comApiDaEmpresa(() => midiasDaHashtag(conta.instagramUserId, conta.accessToken, h))
        busca.n = midias.length
        for (const m of midias) achadas.push({ fonte: h, m })
      }
      const vistos = new Set<string>()
      const videos = achadas.filter(a => !vistos.has(a.m.id) && vistos.add(a.m.id)).sort((a, b) => engajamento(b.m) - engajamento(a.m)).slice(0, POSTS_POR_FONTE)
      await prisma.$transaction([
        prisma.smReferenciaVideo.deleteMany({ where: { usuarioId, origem: 'HASHTAG', motoChave: moto.chave } }),
        prisma.smReferenciaVideo.createMany({ data: videos.map(a => paraVideo(usuarioId, 'HASHTAG', a.fonte, moto.chave, null, a.m)), skipDuplicates: true }),
        prisma.smReferenciaMoto.upsert({ where: { usuarioId_chave: { usuarioId, chave: moto.chave } }, create: { usuarioId, chave: moto.chave, hashtags, buscadoEm: agora, buscadas }, update: { hashtags, buscadoEm: agora, ultimoErro: null, buscadas } }),
      ])
      motosLidas++
    } catch (e) {
      await prisma.smReferenciaMoto.upsert({ where: { usuarioId_chave: { usuarioId, chave: moto.chave } }, create: { usuarioId, chave: moto.chave, hashtags, ultimoErro: mensagemDeErro(e), buscadas }, update: { ultimoErro: mensagemDeErro(e), buscadas } })
    }
  }
  return { perfis: perfisLidos, motos: motosLidas, pendentes: perfisFaltando + motosSemTempo }
}

const SELECT_VIDEO = { id: true, mediaId: true, origem: true, fonte: true, autor: true, permalink: true, legenda: true, curtidas: true, comentarios: true, formato: true, midiaUrl: true, publicadoEm: true, motoChave: true } as const

const mediana = (l: number[]) => {
  if (!l.length) return 0
  const o = [...l].sort((a, b) => a - b), m = Math.floor(o.length / 2)
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2
}
const arred = (v: number, casas = 2) => Math.round(v * 10 ** casas) / 10 ** casas

/** Ganho de seguidores desde o ponto mais próximo de `dias` atrás (só se houver um ponto com pelo menos `dias - 1` dias). */
function crescimento(pontos: Ponto[], agora: Date, dias: number): number | null {
  if (pontos.length < 2) return null
  const alvo = diaBelem(new Date(agora.getTime() - dias * DIA)), limite = diaBelem(new Date(agora.getTime() - (dias - 1) * DIA))
  const antes = [...pontos].reverse().find(p => p.d <= alvo) ?? (pontos[0].d <= limite ? pontos[0] : null)
  return antes ? pontos[pontos.length - 1].s - antes.s : null
}

export async function painelReferencias(usuarioId: string, agora = new Date()) {
  const [conta, motos, salvas, perfis, videos, salvos, concorrentes] = await Promise.all([
    contaDaEmpresa(usuarioId),
    motosDoEstoque(usuarioId),
    prisma.smReferenciaMoto.findMany({ where: { usuarioId } }),
    prisma.smReferenciaPerfil.findMany({ where: { usuarioId }, orderBy: { criadoEm: 'asc' } }),
    prisma.smReferenciaVideo.findMany({ where: { usuarioId }, select: SELECT_VIDEO, take: 4000 }),
    prisma.smReferenciaSalva.findMany({ where: { usuarioId }, orderBy: { criadoEm: 'desc' } }),
    prisma.smConcorrente.findMany({ where: { usuarioId }, select: { usuario: true } }),
  ])
  const porChave = new Map(salvas.map(m => [m.chave, m]))
  const seguidoresDe = new Map(perfis.map(p => [p.usuario, p.seguidores]))
  const salvoDe = new Map(salvos.map(s => [s.mediaId, s.id]))
  // Índice: engajamento ÷ mediana da mesma fonte (o perfil, ou as hashtags da moto). 2× ou mais = fora da curva.
  const grupo = (v: (typeof videos)[number]) => (v.origem === 'PERFIL' ? `p:${v.fonte}` : `m:${v.motoChave ?? v.fonte}`)
  const porGrupo = new Map<string, number[]>()
  for (const v of videos) porGrupo.set(grupo(v), [...(porGrupo.get(grupo(v)) ?? []), engajamento(v)])
  const medianaDe = new Map([...porGrupo].map(([g, l]) => [g, { m: mediana(l), n: l.length }]))
  const posts = videos.map(v => {
    const seg = v.autor ? seguidoresDe.get(v.autor) ?? null : null
    const e = engajamento(v), g = medianaDe.get(grupo(v))!
    const indice = g.m > 0 ? arred(e / g.m, 1) : null
    return {
      ...v, legenda: v.legenda?.slice(0, 600) ?? null, engajamento: e,
      taxa: seg ? arred((e / seg) * 100) : null, indice, foraDaCurva: indice != null && indice >= 2 && g.n >= 5,
      video: v.formato === 'REELS' || v.formato === 'VIDEO', salvoId: salvoDe.get(v.mediaId) ?? null,
    }
  }).sort((a, b) => b.engajamento - a.engajamento)
  const usadas = usadasNaSemana(salvas, agora)
  const jaNosPerfis = new Set(perfis.map(p => p.usuario))
  const desde28 = agora.getTime() - 28 * DIA
  return {
    disponivel: conta?.tipoConexao === 'EMPRESA',
    conta: conta?.nomeUsuario ?? null,
    hashtagsSemana: { usadas: usadas.size, limite: LIMITE_HASHTAGS_SEMANA },
    maxPerfis: MAX_PERFIS,
    importaveis: concorrentes.filter(c => !jaNosPerfis.has(c.usuario)).length,
    motos: motos.map(m => {
      const s = porChave.get(m.chave)
      const { hashtags, trocou } = hashtagsDaMoto(m, s?.hashtags)
      // Por moto: o que o Instagram tem de melhor sobre o modelo (busca por hashtag), não os perfis acompanhados.
      const daMoto = posts.filter(v => v.motoChave === m.chave && v.origem === 'HASHTAG')
      const ultimas = new Map(buscasDe(s?.buscadas).map(b => [b.h, b]))
      return {
        chave: m.chave, nome: m.nome, quantidade: m.quantidade, hashtags,
        buscadoEm: trocou ? null : s?.buscadoEm ?? null, ultimoErro: s?.ultimoErro ?? null,
        posts: daMoto.length, melhor: daMoto[0]?.engajamento ?? null,
        fontes: hashtags.map(h => ({ h, n: ultimas.get(h)?.n ?? null, em: ultimas.get(h)?.em ?? null })),
      }
    }),
    perfis: perfis.map(p => {
      const dele = posts.filter(v => v.origem === 'PERFIL' && v.fonte === p.usuario)
      const recentes = dele.filter(v => v.publicadoEm && v.publicadoEm.getTime() >= desde28)
      const base = recentes.length ? recentes : dele
      const engMedio = base.length ? Math.round(base.reduce((t, v) => t + v.engajamento, 0) / base.length) : null
      const pontos = pontosDe(p.historico)
      const ultimo = dele.reduce<Date | null>((u, v) => (v.publicadoEm && (!u || v.publicadoEm > u) ? v.publicadoEm : u), null)
      return {
        id: p.id, usuario: p.usuario, nome: p.nome, fotoUrl: p.fotoUrl, seguidores: p.seguidores, totalPosts: p.posts, tipo: p.tipo as TipoPerfil | 'EU',
        atualizadoEm: p.atualizadoEm, ultimoErro: p.ultimoErro,
        postsSemana: dele.length ? arred(recentes.length / 4, 1) : null,
        engajamentoMedio: engMedio,
        taxaMedia: engMedio != null && p.seguidores ? arred((engMedio / p.seguidores) * 100) : null,
        crescimento7: crescimento(pontos, agora, 7), crescimento30: crescimento(pontos, agora, 30),
        historico: pontos.slice(-90),
        ultimoPostEm: ultimo,
      }
    }),
    posts,
    salvos: salvos.map(s => ({ ...s, engajamento: engajamento(s), video: s.formato === 'REELS' || s.formato === 'VIDEO' })),
  }
}

export async function adicionarPerfil(usuarioId: string, entrada: string, tipo: TipoPerfil = 'REFERENCIA') {
  const usuario = normalizarUsuario(entrada)
  if (!usuario) throw new ErroReferencia(400, 'Informe o @ do perfil (ex.: @canal.motos)')
  if (await prisma.smReferenciaPerfil.count({ where: { usuarioId, tipo: { not: 'EU' } } }) >= MAX_PERFIS) throw new ErroReferencia(400, `Até ${MAX_PERFIS} perfis de referência`)
  if (await prisma.smReferenciaPerfil.findUnique({ where: { usuarioId_usuario: { usuarioId, usuario } } })) throw new ErroReferencia(409, 'Esse perfil já está nas referências')
  await prisma.smReferenciaPerfil.create({ data: { usuarioId, usuario, tipo } })
  // Já traz os vídeos do perfil novo (não gasta hashtags).
  await atualizarReferencias(usuarioId, { prazoMs: 8000 })
}

export async function removerPerfil(usuarioId: string, id: string) {
  const p = await prisma.smReferenciaPerfil.findFirst({ where: { id, usuarioId } })
  if (!p) throw new ErroReferencia(404, 'Perfil não encontrado')
  if (p.tipo === 'EU') throw new ErroReferencia(400, 'A conta da loja fica sempre na comparação')
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

export async function definirTipoPerfil(usuarioId: string, id: string, tipo: TipoPerfil) {
  const p = await prisma.smReferenciaPerfil.findFirst({ where: { id, usuarioId } })
  if (!p) throw new ErroReferencia(404, 'Perfil não encontrado')
  if (p.tipo === 'EU') throw new ErroReferencia(400, 'A conta da loja fica sempre como "Você"')
  await prisma.smReferenciaPerfil.update({ where: { id }, data: { tipo } })
}

/** Traz os concorrentes já acompanhados no Desempenho para cá (como concorrentes). */
export async function importarConcorrentes(usuarioId: string) {
  const [lista, ja] = await Promise.all([
    prisma.smConcorrente.findMany({ where: { usuarioId }, orderBy: { criadoEm: 'asc' }, select: { usuario: true } }),
    prisma.smReferenciaPerfil.findMany({ where: { usuarioId }, select: { usuario: true, tipo: true } }),
  ])
  const existentes = new Set(ja.map(p => p.usuario))
  const vagas = MAX_PERFIS - ja.filter(p => p.tipo !== 'EU').length
  const novos = lista.filter(c => !existentes.has(c.usuario)).slice(0, Math.max(0, vagas))
  if (!novos.length) throw new ErroReferencia(400, vagas <= 0 ? `Até ${MAX_PERFIS} perfis` : 'Nenhum concorrente novo para trazer')
  await prisma.smReferenciaPerfil.createMany({ data: novos.map(c => ({ usuarioId, usuario: c.usuario, tipo: 'CONCORRENTE' })), skipDuplicates: true })
  await atualizarReferencias(usuarioId, { prazoMs: 10_000 })
  return novos.length
}

// --- Salvos: o banco de referências da equipe ---

export async function salvarReferencia(usuarioId: string, postId: string, nota?: string | null) {
  const v = await prisma.smReferenciaVideo.findFirst({ where: { id: postId, usuarioId } })
  if (!v) throw new ErroReferencia(404, 'Post não encontrado (a lista foi atualizada): recarregue')
  const { id: _id, atualizadoEm: _a, ...copia } = v
  await prisma.smReferenciaSalva.upsert({
    where: { usuarioId_mediaId: { usuarioId, mediaId: v.mediaId } },
    create: { ...copia, nota: nota?.trim() || null },
    update: nota !== undefined ? { nota: nota?.trim() || null } : {},
  })
}

export async function atualizarSalva(usuarioId: string, id: string, d: { status?: (typeof STATUS_SALVA)[number]; nota?: string | null }) {
  const s = await prisma.smReferenciaSalva.findFirst({ where: { id, usuarioId } })
  if (!s) throw new ErroReferencia(404, 'Referência salva não encontrada')
  await prisma.smReferenciaSalva.update({ where: { id }, data: { ...(d.status ? { status: d.status } : {}), ...(d.nota !== undefined ? { nota: d.nota?.trim() || null } : {}) } })
}

export async function removerSalva(usuarioId: string, id: string) {
  const r = await prisma.smReferenciaSalva.deleteMany({ where: { id, usuarioId } })
  if (!r.count) throw new ErroReferencia(404, 'Referência salva não encontrada')
}

const FORMATO_DA_PAUTA: Record<string, string> = { REELS: 'REELS', VIDEO: 'REELS', CARROSSEL: 'CARROSSEL', FOTO: 'FOTO' }
const primeiraLinha = (t: string | null) => (t ?? '').split('\n').map(l => l.trim()).find(l => l.replace(/[#@\p{Extended_Pictographic}\s]/gu, '').length >= 3) ?? ''

/** A referência vira uma pauta (Ideia) na Produção: formato, moto, gancho de partida e o link da referência. */
export async function criarPautaDaSalva(usuarioId: string, id: string, criadoPor: string) {
  const s = await prisma.smReferenciaSalva.findFirst({ where: { id, usuarioId } })
  if (!s) throw new ErroReferencia(404, 'Referência salva não encontrada')
  if (s.pautaId && await prisma.smPauta.findFirst({ where: { id: s.pautaId, usuarioId }, select: { id: true } })) return s.pautaId
  const estoque = s.motoChave ? await prisma.smMotoEstoque.findMany({ where: { usuarioId, situacao: { not: 'VENDIDA' } }, select: { id: true, modelo: true, marca: true } }) : []
  const moto = estoque.find(m => chaveDaMoto(m.marca, m.modelo) === s.motoChave) ?? null
  const linha = primeiraLinha(s.legenda)
  const quem = s.autor ? `@${s.autor}` : `#${s.fonte}`
  const titulo = (moto ? `${[moto.marca, moto.modelo].filter(Boolean).join(' ')} · inspirado em ${quem}` : `Inspirado em ${quem}${linha ? `: ${linha}` : ''}`).slice(0, 120)
  const pauta = await prisma.smPauta.create({
    data: {
      usuarioId, titulo, pilar: moto ? 'ESTOQUE' : 'EDUCACAO', formato: FORMATO_DA_PAUTA[s.formato ?? ''] ?? 'REELS', motoId: moto?.id ?? null,
      origem: 'REFERENCIA', origemRef: s.permalink.replace(/\?.*$/, '').slice(0, 80), gancho: linha ? linha.slice(0, 500) : null,
      retencao: s.nota ? `Da referência: ${s.nota}`.slice(0, 1000) : null, status: 'IDEIA', ordem: Date.now(), criadoPor,
    },
  })
  await prisma.smReferenciaSalva.update({ where: { id }, data: { pautaId: pauta.id, status: s.status === 'IDEIA' ? 'GRAVAR' : s.status } })
  return pauta.id
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
