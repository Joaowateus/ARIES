// Tela 10 · Paleta de comandos (seção 11.3): busca global agrupada em Ações,
// Estoque, Posts e Conversas. Cada grupo só aparece com o módulo liberado
// para o papel; nada de custo, margem ou valores. As ações de escrita somem
// na pré-visualização ("ver como") e para quem só tem leitura.
import { prisma } from './prisma'
import type { ContextoSM } from './smAcesso'
import { diaLocal } from './smCalendario'
import { listarEstoque } from './smEstoque'
import { gerarCodigo } from './smPautas'
import { listarGanchos } from './smTestes'
import { atribuicaoDasPublicacoes, tituloDoPost } from './smDesempenho'
import { gerarRoteiro } from './smIA'
import { fatosDoRoteiro, podeRoteiroIA } from './smPerguntas'

const DIA_MS = 864e5
const POR_GRUPO = 5
const FORMATO: Record<string, string> = { REELS: 'Reels', CARROSSEL: 'Carrossel', FOTO: 'Foto', STORY: 'Story', FEED: 'Post' }
const ETAPA: Record<string, string> = { IDEIA: 'Ideia', ROTEIRO: 'Roteiro', GRAVACAO: 'Gravação', EDICAO: 'Edição', APROVACAO: 'Aprovação', AGENDADO: 'Agendado', PUBLICADO: 'Publicado' }
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const curto = (t: string, n: number) => { const x = t.replace(/\s+/g, ' ').trim(); return x.length > n ? `${x.slice(0, n - 1)}…` : x }
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
const nomeMoto = (m: { modelo: string; ano?: number | null }) => [m.modelo, m.ano].filter(Boolean).join(' ')
const podeAgir = (sm: ContextoSM, m: Parameters<ContextoSM['pode']>[0]) => !sm.somenteLeitura && sm.pode(m, 'COMPLETO')

export type TomIcone = 'pri' | 'ia' | 'estoque' | 'post' | 'conversa' | 'conversa-espera'
export interface AcaoBusca {
  rotulo: string
  tipo: 'LINK' | 'CRIAR_PAUTA' | 'GANCHOS'
  href?: string
  externo?: boolean
  motoId?: string
  pautaId?: string
}
export interface ItemBusca {
  id: string
  ini: string
  tom: TomIcone
  titulo: string
  sub: string
  acao: AcaoBusca
  acoes: AcaoBusca[]
}
export interface ResultadoBusca {
  acoes: ItemBusca[]
  estoque: ItemBusca[]
  posts: ItemBusca[]
  conversas: ItemBusca[]
}

/** Minúsculas e sem acento: "Produção" e "producao" se encontram. */
export function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Todas as palavras da busca precisam aparecer no texto. A pontuação favorece
 * palavra que começa igual e o título sobre o resto.
 */
export function pontuar(tokens: string[], titulo: string, resto = ''): number | null {
  if (!tokens.length) return 0
  const t = normalizar(titulo)
  const r = normalizar(resto)
  let pontos = 0
  for (const k of tokens) {
    const noTitulo = t.indexOf(k)
    if (noTitulo >= 0) pontos += noTitulo === 0 || /[^a-z0-9]/.test(t[noTitulo - 1]) ? 3 : 2
    else if (r.includes(k)) pontos += 1
    else return null
  }
  return pontos
}

function tokensDe(q: string): string[] {
  return normalizar(q).split(/[^a-z0-9#-]+/).map(s => s.replace(/^#/, '')).filter(s => s.length > 0).slice(0, 6)
}

function quando(d: Date, agora: Date): string {
  const min = Math.max(0, Math.round((agora.getTime() - d.getTime()) / 60000))
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  if (min < 1440) return `há ${Math.floor(min / 60)}h`
  const dias = Math.floor(min / 1440)
  return dias === 1 ? 'ontem' : `há ${dias} dias`
}

function melhores<T>(lista: Array<{ p: number; item: T }>, n = POR_GRUPO): T[] {
  return lista.sort((a, b) => b.p - a.p).slice(0, n).map(x => x.item)
}

/** Ganchos: pela IA com a ficha (regra ligada) ou os da biblioteca que mais seguraram audiência. */
async function ganchosDisponiveis(sm: ContextoSM): Promise<'IA' | 'BIBLIOTECA' | null> {
  if (!sm.pode('producao', 'LEITURA')) return null
  if (podeRoteiroIA(sm)) return 'IA'
  const { ganchos } = await listarGanchos(sm.usuarioId)
  return ganchos.some(g => g.puloMedio != null) ? 'BIBLIOTECA' : null
}

export async function buscar(sm: ContextoSM, q: string, agora = new Date()): Promise<ResultadoBusca> {
  const tokens = tokensDe(q)
  const vazio = tokens.length === 0
  const u = sm.usuarioId
  const r: ResultadoBusca = { acoes: [], estoque: [], posts: [], conversas: [] }
  const modoGanchos = vazio ? null : await ganchosDisponiveis(sm)

  // Estoque (e as ações a partir da moto).
  if (sm.pode('estoque', 'LEITURA') && !vazio) {
    const motos = await listarEstoque(u, agora)
    const abertas = await prisma.smPauta.findMany({ where: { usuarioId: u, motoId: { in: motos.map(m => m.id) }, status: { not: 'PUBLICADO' } }, select: { id: true, motoId: true, status: true }, orderBy: { criadoEm: 'desc' } })
    // Empate na busca: primeiro a moto que mais precisa de conteúdo.
    const achadas = motos.map(m => ({ m, p: pontuar(tokens, nomeMoto(m), [m.marca, m.cor].filter(Boolean).join(' ')) }))
      .filter((x): x is { m: typeof motos[number]; p: number } => x.p != null)
      .map(x => ({ p: x.p + (x.m.situacao === 'VENDIDA' ? -5 : 0), m: x.m }))
      .sort((a, b) => b.p - a.p || a.m.emProducao - b.m.emProducao || a.m.posts - b.m.posts || b.m.diasEmEstoque - a.m.diasEmEstoque || a.m.entradaEm.getTime() - b.m.entradaEm.getTime() || a.m.id.localeCompare(b.m.id))
      .slice(0, POR_GRUPO).map(x => x.m)
    const verEstoque = sm.visao === 'GESTOR' || sm.pode('estoque', 'COMPLETO')
    for (const m of achadas) {
      const nome = nomeMoto(m)
      const aberta = abertas.find(p => p.motoId === m.id)
      const acoes: AcaoBusca[] = []
      if (aberta && sm.pode('producao', 'LEITURA')) acoes.push({ rotulo: `Abrir a pauta em ${ETAPA[aberta.status].toLowerCase()}`, tipo: 'LINK', href: `/pro-labore/sm/producao?pauta=${aberta.id}` })
      else if (m.situacao !== 'VENDIDA' && podeAgir(sm, 'producao')) acoes.push({ rotulo: 'Criar pauta', tipo: 'CRIAR_PAUTA', motoId: m.id })
      if (modoGanchos && m.situacao !== 'VENDIDA') acoes.push({ rotulo: modoGanchos === 'IA' ? 'Gerar 3 ganchos' : 'Ver os ganchos que mais seguraram', tipo: 'GANCHOS', motoId: m.id })
      if (verEstoque) acoes.push({ rotulo: 'Ver no estoque', tipo: 'LINK', href: `/pro-labore/sm/estoque?moto=${m.id}` })
      const situacao = m.situacao === 'VENDIDA' ? ' · vendida' : m.situacao === 'RESERVADA' ? ' · reservada' : ''
      r.estoque.push({
        id: `moto:${m.id}`, ini: 'E', tom: 'estoque', titulo: nome,
        sub: `${plural(m.diasEmEstoque, 'dia', 'dias')} no estoque · ${m.posts ? plural(m.posts, 'post', 'posts') : '0 posts'}${m.emProducao ? ` · ${m.emProducao} em produção` : ''}${situacao}`,
        acao: acoes[0] ?? { rotulo: verEstoque ? 'Ver no estoque' : 'Ver na Produção', tipo: 'LINK', href: verEstoque ? `/pro-labore/sm/estoque?moto=${m.id}` : '/pro-labore/sm/producao' },
        acoes,
      })
    }
    // Ações em destaque para a moto mais próxima da busca (como no protótipo).
    const alvo = achadas.find(m => m.situacao !== 'VENDIDA')
    if (alvo) {
      const nome = nomeMoto(alvo)
      const aberta = abertas.find(p => p.motoId === alvo.id)
      if (!aberta && podeAgir(sm, 'producao')) {
        r.acoes.push({ id: `criar:${alvo.id}`, ini: '+', tom: 'pri', titulo: `Criar pauta para ${nome}${alvo.cor ? ` ${alvo.cor}` : ''}`, sub: 'Roteiro sugerido a partir da ficha da moto', acao: { rotulo: 'Criar pauta', tipo: 'CRIAR_PAUTA', motoId: alvo.id }, acoes: [] })
      }
      if (modoGanchos) {
        r.acoes.push({
          id: `ganchos:${alvo.id}`, ini: '✦', tom: 'ia',
          titulo: modoGanchos === 'IA' ? `Gerar 3 ganchos para ${alvo.modelo}` : `Ganchos que mais seguraram audiência`,
          sub: modoGanchos === 'IA' ? 'Com base nos ganchos que mais seguraram audiência' : `Da biblioteca, para adaptar à ${alvo.modelo}`,
          acao: { rotulo: 'Gerar', tipo: 'GANCHOS', motoId: alvo.id }, acoes: [],
        })
      }
    }
  }

  // Posts: pautas (Produção) e publicações do Instagram (Desempenho).
  const verLeads = sm.pode('crm', 'LEITURA')
  const verVendas = verLeads && sm.pode('vendas', 'LEITURA')
  const candidatos: Array<{ p: number; item: ItemBusca & { midia?: string | null; ordem: number } }> = []
  const midiasDePautas = new Set<string>()
  if (sm.pode('producao', 'LEITURA')) {
    const pautas = await prisma.smPauta.findMany({
      where: vazio ? { usuarioId: u, status: { in: ['AGENDADO', 'APROVACAO', 'EDICAO', 'GRAVACAO', 'ROTEIRO'] } } : { usuarioId: u },
      select: { id: true, titulo: true, formato: true, status: true, codigo: true, agendadoPara: true, publicadaEm: true, prazo: true, igMediaId: true, permalink: true, legenda: true, moto: { select: { modelo: true, ano: true } } },
      orderBy: { atualizadoEm: 'desc' }, take: 400,
    })
    const recente = new Date(agora.getTime() - 45 * DIA_MS)
    for (const p of pautas) {
      if (p.igMediaId) midiasDePautas.add(p.igMediaId)
      const pts = vazio ? 0 : pontuar(tokens, p.titulo, [p.codigo, p.moto ? nomeMoto(p.moto) : null, p.legenda?.slice(0, 300)].filter(Boolean).join(' '))
      if (pts == null) continue
      const data = p.publicadaEm ?? p.agendadoPara ?? p.prazo
      const publicada = p.status === 'PUBLICADO'
      // O quadro mostra as publicadas dos últimos 45 dias; as antigas abrem no Instagram.
      const noQuadro = !publicada || (p.publicadaEm != null && p.publicadaEm >= recente)
      const abrir: AcaoBusca = noQuadro ? { rotulo: 'Abrir na Produção', tipo: 'LINK', href: `/pro-labore/sm/producao?pauta=${p.id}` }
        : p.permalink ? { rotulo: 'Abrir no Instagram', tipo: 'LINK', href: p.permalink, externo: true }
          : { rotulo: 'Ver Desempenho', tipo: 'LINK', href: '/pro-labore/sm/desempenho' }
      const acoes: AcaoBusca[] = [abrir]
      if (!publicada && p.agendadoPara) acoes.push({ rotulo: 'Ver no Calendário', tipo: 'LINK', href: '/pro-labore/sm/calendario' })
      if (!publicada && podeRoteiroIA(sm) && podeAgir(sm, 'producao')) acoes.push({ rotulo: 'Gerar 3 ganchos', tipo: 'GANCHOS', pautaId: p.id })
      if (publicada && p.permalink && noQuadro) acoes.push({ rotulo: 'Abrir no Instagram', tipo: 'LINK', href: p.permalink, externo: true })
      if (publicada && verVendas) acoes.push({ rotulo: 'Ver em Vendas por post', tipo: 'LINK', href: '/pro-labore/sm/vendas-por-post' })
      candidatos.push({
        p: (pts ?? 0) + (publicada ? 0 : 1),
        item: {
          id: `pauta:${p.id}`, ini: 'P', tom: 'post', titulo: p.titulo,
          sub: [FORMATO[p.formato] ?? p.formato, data ? ddmm(diaLocal(data)) : null, publicada ? null : ETAPA[p.status]].filter(Boolean).join(' · '),
          acao: abrir, acoes, midia: publicada ? p.igMediaId : null, ordem: data?.getTime() ?? 0,
        },
      })
    }
  }
  if (sm.pode('analise', 'LEITURA') && !vazio) {
    const conta = await prisma.socialMediaConta.findUnique({ where: { titular: `dono:${u}` }, select: { id: true } })
    if (conta) {
      const midias = await prisma.socialMediaMidia.findMany({
        where: { contaId: conta.id, NOT: { formato: { in: ['AD'] } }, publicadoEm: { gte: new Date(agora.getTime() - 365 * DIA_MS) } },
        select: { instagramMediaId: true, legenda: true, formato: true, tipo: true, publicadoEm: true, urlPermalink: true },
        orderBy: { publicadoEm: 'desc' }, take: 400,
      })
      for (const m of midias) {
        if (midiasDePautas.has(m.instagramMediaId)) continue
        const titulo = m.legenda?.trim() ? tituloDoPost(m) : m.formato === 'STORY' ? 'Story sem legenda' : 'Post sem legenda'
        const pts = pontuar(tokens, titulo, m.legenda ?? '')
        if (pts == null) continue
        const abrir: AcaoBusca = m.urlPermalink ? { rotulo: 'Abrir no Instagram', tipo: 'LINK', href: m.urlPermalink, externo: true } : { rotulo: 'Ver Desempenho', tipo: 'LINK', href: '/pro-labore/sm/desempenho' }
        const acoes: AcaoBusca[] = [abrir, { rotulo: 'Ver Desempenho', tipo: 'LINK', href: '/pro-labore/sm/desempenho' }]
        if (verVendas) acoes.push({ rotulo: 'Ver em Vendas por post', tipo: 'LINK', href: '/pro-labore/sm/vendas-por-post' })
        const formato = m.formato === 'REELS' ? 'Reels' : m.formato === 'STORY' ? 'Story' : m.tipo === 'CAROUSEL_ALBUM' ? 'Carrossel' : 'Foto'
        candidatos.push({
          p: pts,
          item: { id: `midia:${m.instagramMediaId}`, ini: 'P', tom: 'post', titulo, sub: `${formato} · ${ddmm(diaLocal(m.publicadoEm))}`, acao: abrir, acoes: acoes.filter((a, i, l) => l.findIndex(b => b.href === a.href) === i), midia: m.instagramMediaId, ordem: m.publicadoEm.getTime() },
        })
      }
    }
  }
  const posts = vazio
    ? candidatos.sort((a, b) => a.item.ordem - b.item.ordem).slice(0, 3).map(c => c.item)
    : candidatos.sort((a, b) => b.p - a.p || b.item.ordem - a.item.ordem).slice(0, POR_GRUPO).map(c => c.item)
  // Leads e vendas de cada publicação (vindos do CRM, quando o papel pode ver).
  const midias = posts.map(p => p.midia).filter((m): m is string => !!m)
  if (midias.length && (verLeads || verVendas)) {
    const atrib = await atribuicaoDasPublicacoes(u, midias, verLeads, verVendas)
    for (const p of posts) {
      const a = p.midia ? atrib.get(p.midia) : undefined
      if (!a) continue
      const extra = [a.leads != null ? plural(a.leads, 'lead', 'leads') : null, a.vendas != null ? plural(a.vendas, 'venda', 'vendas') : null].filter(Boolean)
      if (extra.length) p.sub = `${p.sub} · ${extra.join(' · ')}`
    }
  }
  r.posts = posts.map(({ midia: _m, ordem: _o, ...p }) => p)

  // Conversas do Atendimento.
  if (sm.pode('atendimento', 'LEITURA')) {
    const conversas = await prisma.smConversa.findMany({
      where: vazio ? { usuarioId: u, aguardandoDesde: { not: null }, status: { not: 'ARQUIVADA' } } : { usuarioId: u, ultimaMsgEm: { gte: new Date(agora.getTime() - 180 * DIA_MS) } },
      select: {
        id: true, clienteNome: true, clienteUsuario: true, postTitulo: true, motoInteresse: true, status: true, aguardandoDesde: true, ultimaMsgEm: true, leadId: true,
        mensagens: { where: { direcao: 'IN' }, orderBy: { enviadaEm: 'desc' }, take: 1, select: { texto: true, enviadaEm: true } },
      },
      orderBy: vazio ? { aguardandoDesde: 'asc' } : { ultimaMsgEm: 'desc' }, take: vazio ? 3 : 400,
    })
    const podeResponder = podeAgir(sm, 'atendimento')
    const podeLead = podeResponder && sm.pode('crm', 'LEITURA')
    const lista = conversas.map(c => {
      const nome = c.clienteNome?.trim() || (c.clienteUsuario ? `@${c.clienteUsuario}` : 'Cliente do Instagram')
      const ultima = c.mensagens[0]
      const pts = vazio ? 0 : pontuar(tokens, nome, [c.clienteUsuario, c.motoInteresse, c.postTitulo, ultima?.texto].filter(Boolean).join(' '))
      if (pts == null) return null
      const href = `/pro-labore/sm/atendimento?conversa=${c.id}`
      const acoes: AcaoBusca[] = [{ rotulo: podeResponder && c.status !== 'ARQUIVADA' ? 'Responder' : 'Abrir a conversa', tipo: 'LINK', href }]
      if (podeResponder && c.aguardandoDesde) acoes.push({ rotulo: 'Sugerir resposta', tipo: 'LINK', href: `${href}&sugerir=1` })
      if (podeLead && !c.leadId && c.status !== 'ARQUIVADA') acoes.push({ rotulo: 'Virar lead', tipo: 'LINK', href: `${href}&lead=1` })
      const item: ItemBusca = {
        id: `conversa:${c.id}`, ini: (nome.replace(/^@/, '')[0] ?? 'C').toUpperCase(), tom: c.aguardandoDesde ? 'conversa-espera' : 'conversa', titulo: nome,
        sub: `${ultima ? `“${curto(ultima.texto, 60)}”` : 'Sem mensagem do cliente'} · ${quando(ultima?.enviadaEm ?? c.ultimaMsgEm, agora)}${c.status === 'LEAD' ? ' · lead' : ''}`,
        acao: acoes[0], acoes,
      }
      return { p: (pts ?? 0) + (c.aguardandoDesde ? 1 : 0), item }
    }).filter((x): x is { p: number; item: ItemBusca } => !!x)
    r.conversas = vazio ? lista.map(x => x.item) : melhores(lista)
  }
  return r
}

export class ErroBusca extends Error {
  constructor(public status: number, msg: string) { super(msg) }
}

/** Roteiro sugerido a partir da ficha da moto (sem preço nem ficha técnica). */
export function roteiroDaMoto(m: { modelo: string; ano: number | null; cor: string | null }) {
  const nome = nomeMoto(m)
  return {
    gancho: `A ${nome} ligada na frente da loja: o som do motor nos 2 primeiros segundos, sem narração.`,
    retencao: `Volta completa na moto mostrando ${m.cor ? `a cor ${m.cor.toLowerCase()}, ` : ''}painel, banco e acabamento, com 1 detalhe por corte.`,
    recompensa: `Para quem é a ${m.modelo}: o uso do dia a dia em 1 frase.`,
    cta: `Chama no direct e pergunta pela ${m.modelo}`,
  }
}

/** "Criar pauta para {moto}": cria em Ideias com o roteiro sugerido; se já houver uma aberta, devolve ela. */
export async function criarPautaDaMoto(sm: ContextoSM, motoId: string, ator: string) {
  if (!podeAgir(sm, 'producao')) throw new ErroBusca(403, sm.somenteLeitura ? 'Pré-visualização do Social Media: só leitura' : 'Seu acesso à Produção é só leitura')
  if (!sm.pode('estoque', 'LEITURA')) throw new ErroBusca(403, 'Sem acesso ao estoque')
  const m = (await listarEstoque(sm.usuarioId)).find(x => x.id === motoId)
  if (!m) throw new ErroBusca(404, 'Moto não encontrada no estoque')
  const aberta = await prisma.smPauta.findFirst({ where: { usuarioId: sm.usuarioId, motoId, status: { not: 'PUBLICADO' } }, orderBy: { criadoEm: 'desc' }, select: { id: true, titulo: true } })
  if (aberta) return { id: aberta.id, titulo: aberta.titulo, criada: false }
  if (m.situacao === 'VENDIDA') throw new ErroBusca(400, 'Esta moto já foi vendida')
  const criada = await prisma.smPauta.create({
    data: {
      usuarioId: sm.usuarioId,
      titulo: `${nomeMoto(m)}: ${m.posts ? 'de volta ao feed' : 'primeiro post'}`,
      pilar: 'ESTOQUE', formato: 'REELS', status: 'IDEIA', origem: 'ESTOQUE', origemRef: m.id, motoId: m.id,
      ...roteiroDaMoto(m), ordem: Date.now(), criadoPor: ator,
    },
    select: { id: true, titulo: true, formato: true, agendadoPara: true },
  })
  if (criada.agendadoPara) await prisma.smPauta.update({ where: { id: criada.id }, data: { codigo: await gerarCodigo(sm.usuarioId, { ...criada, agendadoPara: criada.agendadoPara, moto: { modelo: m.modelo } }) } })
  return { id: criada.id, titulo: criada.titulo, criada: true }
}

/** "Gerar 3 ganchos": pela IA com a ficha da moto (ou da pauta); sem IA, os 3 da biblioteca com menor pulo. */
export async function ganchosPara(sm: ContextoSM, alvo: { motoId?: string; pautaId?: string }) {
  if (!sm.pode('producao', 'LEITURA')) throw new ErroBusca(403, 'Sem acesso à Produção')
  let nome: string
  let fatos: unknown
  if (alvo.pautaId) {
    const p = await prisma.smPauta.findFirst({ where: { id: alvo.pautaId, usuarioId: sm.usuarioId }, select: { titulo: true } })
    if (!p) throw new ErroBusca(404, 'Pauta não encontrada')
    nome = p.titulo
    fatos = podeRoteiroIA(sm) ? await fatosDoRoteiro(sm, alvo.pautaId) : null
  } else if (alvo.motoId) {
    if (!sm.pode('estoque', 'LEITURA')) throw new ErroBusca(403, 'Sem acesso ao estoque')
    const m = (await listarEstoque(sm.usuarioId)).find(x => x.id === alvo.motoId)
    if (!m) throw new ErroBusca(404, 'Moto não encontrada no estoque')
    nome = nomeMoto(m)
    if (podeRoteiroIA(sm)) {
      const { ganchos } = await listarGanchos(sm.usuarioId)
      fatos = {
        pauta: `Reels da ${nome} (pilar Estoque)`, formato: 'Reels', pilar: 'Estoque',
        moto: { moto: [m.modelo, m.ano, m.cor].filter(Boolean).join(' '), marca: m.marca, diasNaLoja: m.diasEmEstoque, postsFeitos: m.posts },
        ganchosDaBiblioteca: ganchos.filter(g => g.puloMedio != null).slice(0, 5).map(g => ({ gancho: g.texto, puloMedio: `${Math.round(g.puloMedio! * 100)}%`, reels: g.comPulo })),
      }
    }
  } else throw new ErroBusca(400, 'Diga a moto ou a pauta')

  if (fatos) {
    const r = await gerarRoteiro(sm.usuarioId, fatos)
    if (r) return { nome, ia: true, ganchos: r.ganchos.slice(0, 3).map(texto => ({ texto, pulo: null as string | null })) }
  }
  const { ganchos } = await listarGanchos(sm.usuarioId)
  const top = ganchos.filter(g => g.puloMedio != null).slice(0, 3)
  return { nome, ia: false, ganchos: top.map(g => ({ texto: g.texto, pulo: `${Math.round(g.puloMedio! * 100)}% de pulo em ${plural(g.comPulo, 'reel', 'reels')}` })) }
}
