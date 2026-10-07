// Atribuição (seção 3.5) e tela 06 · Vendas por post (seção 9).
// - Cada pauta com código ganha um link rastreado /r/{slug}; a bio usa #BIO.
// - O toque no link abre o WhatsApp da loja com o código na mensagem; o
//   consultor cola o código no lead e o CRM liga o lead ao post (decisão P9).
// - A venda herda a origem do lead e continua creditada ao post mesmo quando
//   fecha depois do período analisado (os leads do período são a coorte).
import { createHash, randomBytes } from 'crypto'
import { prisma } from './prisma'

const DIA_MS = 864e5
const OFFSET_MS = 3 * 3600 * 1000 // America/Belem (UTC-3)
const REPETIDO_MS = 30 * 60 * 1000 // o mesmo visitante em 30 min conta um toque só

// ---------- Código e link ----------

export const REGEX_CODIGO = /#(?:[PS]-\d{4}-[A-Z0-9]{1,6}(?:-\d{1,2})?|BIO)(?![A-Z0-9])/i

/** Primeiro código de post (#P-..., #S-..., #BIO) encontrado nos textos. */
export function extrairCodigo(...textos: (string | null | undefined)[]): string | null {
  for (const t of textos) {
    const m = t?.match(REGEX_CODIGO)
    if (m) return m[0].toUpperCase()
  }
  return null
}

function novoSlug(): string {
  // 8 caracteres base36 (~41 bits): curto para a bio e impossível de adivinhar em sequência.
  return BigInt('0x' + randomBytes(6).toString('hex')).toString(36).padStart(8, '0').slice(-8)
}

export function mensagemDoLink(codigo: string, assunto: { moto?: string | null; titulo?: string | null }): string {
  if (codigo === '#BIO') return `Oi! Vim pelo Instagram (${codigo})`
  if (assunto.moto) return `Oi! Vi a ${assunto.moto} no Instagram (${codigo})`
  const titulo = (assunto.titulo ?? '').trim()
  const curto = titulo.length > 60 ? `${titulo.slice(0, 57).trimEnd()}…` : titulo
  return curto ? `Oi! Vi o post "${curto}" no Instagram (${codigo})` : `Oi! Vi um post no Instagram (${codigo})`
}

type PautaParaLink = { id: string; usuarioId: string; codigo: string | null; titulo: string; formato: string; moto?: { modelo: string } | null }

/** Garante o link da pauta (o código pode mudar até a publicação; o slug fica). */
export async function garantirLinkDaPauta(p: PautaParaLink): Promise<string | null> {
  if (!p.codigo) return null
  const dados = { codigo: p.codigo, tipo: p.formato === 'STORY' ? 'STORY' : 'POST', titulo: p.titulo, mensagem: mensagemDoLink(p.codigo, { moto: p.moto?.modelo, titulo: p.titulo }) }
  const [daPauta, doCodigo] = await Promise.all([
    prisma.smLinkRastreado.findUnique({ where: { pautaId: p.id } }),
    prisma.smLinkRastreado.findUnique({ where: { usuarioId_codigo: { usuarioId: p.usuarioId, codigo: p.codigo } } }),
  ])
  if (daPauta && daPauta.codigo === dados.codigo && daPauta.titulo === dados.titulo && daPauta.mensagem === dados.mensagem) return daPauta.slug
  if (doCodigo && doCodigo.id !== daPauta?.id) {
    // O código já tinha link (pauta apagada e recriada no mesmo dia): o link passa para esta pauta.
    if (daPauta) await prisma.smLinkRastreado.update({ where: { id: daPauta.id }, data: { pautaId: null } })
    return (await prisma.smLinkRastreado.update({ where: { id: doCodigo.id }, data: { ...dados, pautaId: p.id } })).slug
  }
  if (daPauta) return (await prisma.smLinkRastreado.update({ where: { id: daPauta.id }, data: dados })).slug
  return (await prisma.smLinkRastreado.create({ data: { ...dados, usuarioId: p.usuarioId, pautaId: p.id, slug: novoSlug() } })).slug
}

/** Links de todas as pautas com código (mapa pautaId -> slug). */
export async function sincronizarLinks(usuarioId: string): Promise<Map<string, string>> {
  const [pautas, links] = await Promise.all([
    prisma.smPauta.findMany({ where: { usuarioId, codigo: { not: null } }, select: { id: true, usuarioId: true, codigo: true, titulo: true, formato: true, moto: { select: { modelo: true } } } }),
    prisma.smLinkRastreado.findMany({ where: { usuarioId, pautaId: { not: null } }, select: { pautaId: true, codigo: true, titulo: true, slug: true } }),
  ])
  const porPauta = new Map(links.map(l => [l.pautaId!, l]))
  const mapa = new Map<string, string>()
  for (const p of pautas) {
    const l = porPauta.get(p.id)
    const slug = l && l.codigo === p.codigo && l.titulo === p.titulo ? l.slug : await garantirLinkDaPauta(p)
    if (slug) mapa.set(p.id, slug)
  }
  return mapa
}

export async function garantirLinkBio(usuarioId: string) {
  const codigo = '#BIO'
  const atual = await prisma.smLinkRastreado.findUnique({ where: { usuarioId_codigo: { usuarioId, codigo } } })
  if (atual) return atual
  return prisma.smLinkRastreado.create({ data: { usuarioId, codigo, tipo: 'BIO', titulo: 'Bio do perfil', mensagem: mensagemDoLink(codigo, {}), slug: novoSlug() } })
    .catch(() => prisma.smLinkRastreado.findUniqueOrThrow({ where: { usuarioId_codigo: { usuarioId, codigo } } }))
}

/** Só dígitos, com 55 na frente quando vier com DDD (formato do wa.me). */
export function normalizarWhatsapp(numero: string): string | null {
  const d = numero.replace(/\D/g, '')
  if (d.length === 10 || d.length === 11) return `55${d}`
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d
  return null
}

export type ResultadoToque = { url: string; codigo: string } | { erro: 'NAO_ENCONTRADO' | 'SEM_WHATSAPP'; codigo?: string }

/** Toque público em /r/{slug}: registra e devolve o endereço do WhatsApp. */
export async function registrarToque(slug: string, ip: string, navegador: string, agora = new Date()): Promise<ResultadoToque> {
  const link = await prisma.smLinkRastreado.findUnique({ where: { slug }, include: { usuario: { select: { smConfig: { select: { whatsappLoja: true } } } } } })
  if (!link) return { erro: 'NAO_ENCONTRADO' }
  const visitante = createHash('sha256').update(`${link.id}|${ip}|${navegador}`).digest('hex').slice(0, 32)
  const repetido = await prisma.smLinkClique.findFirst({ where: { linkId: link.id, visitante, em: { gte: new Date(agora.getTime() - REPETIDO_MS) } }, select: { id: true } })
  if (!repetido) {
    await prisma.$transaction([
      prisma.smLinkClique.create({ data: { linkId: link.id, visitante, em: agora } }),
      prisma.smLinkRastreado.update({ where: { id: link.id }, data: { cliques: { increment: 1 } } }),
    ])
  }
  const numero = link.usuario.smConfig?.whatsappLoja
  if (!numero) return { erro: 'SEM_WHATSAPP', codigo: link.codigo }
  return { url: `https://wa.me/${numero}?text=${encodeURIComponent(link.mensagem)}`, codigo: link.codigo }
}

// ---------- Reconhecer o código no CRM ----------

export interface OrigemDoPost { origem: 'INSTAGRAM_ORGANICO'; postCode: string; midiaId: string | null; canalEntrada: 'LINK_WHATSAPP' }

/** Código colado em qualquer campo do lead ou da venda -> origem do post (só códigos que existem). */
export async function origemPorCodigo(usuarioId: string, ...textos: (string | null | undefined)[]): Promise<OrigemDoPost | null> {
  const codigo = extrairCodigo(...textos)
  if (!codigo) return null
  if (codigo === '#BIO') return { origem: 'INSTAGRAM_ORGANICO', postCode: codigo, midiaId: null, canalEntrada: 'LINK_WHATSAPP' }
  const [pauta, link] = await Promise.all([
    prisma.smPauta.findFirst({ where: { usuarioId, codigo }, select: { igMediaId: true } }),
    prisma.smLinkRastreado.findUnique({ where: { usuarioId_codigo: { usuarioId, codigo } }, select: { id: true } }),
  ])
  if (!pauta && !link) return null
  return { origem: 'INSTAGRAM_ORGANICO', postCode: codigo, midiaId: pauta?.igMediaId ?? null, canalEntrada: 'LINK_WHATSAPP' }
}

// ---------- Tela 06 · Vendas por post ----------

export interface PeriodoAtribuicao { inicio: Date; fim: Date; dias: number }

/** Últimos N dias em Belém, contando hoje. */
export function periodoDosUltimosDias(dias: number, agora = new Date()): PeriodoAtribuicao {
  const local = new Date(agora.getTime() - OFFSET_MS)
  const inicioHoje = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + OFFSET_MS
  return { inicio: new Date(inicioHoje - (dias - 1) * DIA_MS), fim: agora, dias }
}

export interface LinhaAtribuicao {
  chave: string
  nome: string
  sub: string
  toques: number | null // null = não se aplica ao canal
  conversas: number | null
  leads: number
  vendas: number
  valor: number | null // null quando o gestor esconde os valores
}

interface Acumulador { toques: number; conversas: number; leads: number; vendas: number; valor: number }
const vazio = (): Acumulador => ({ toques: 0, conversas: 0, leads: 0, vendas: 0, valor: 0 })

const FORMATO_ROTULO: Record<string, string> = { REELS: 'Reels', CARROSSEL: 'Carrossel', FOTO: 'Foto', STORY: 'Story' }
const FORMATO_PLURAL: Record<string, [string, string]> = { REELS: ['reel', 'reels'], CARROSSEL: ['carrossel', 'carrosséis'], FOTO: ['foto', 'fotos'], STORY: ['story', 'stories'] }
const PILAR_DE: Record<string, string> = { ESTOQUE: 'de estoque', PROVA: 'de prova social', EDUCACAO: 'de educação', BASTIDORES: 'de bastidores' }

const ddmm = (d: Date) => { const l = new Date(d.getTime() - OFFSET_MS); return `${String(l.getUTCDate()).padStart(2, '0')}/${String(l.getUTCMonth() + 1).padStart(2, '0')}` }

/** Formato da mídia sincronizada do Instagram no vocabulário da Produção. */
function formatoDaMidia(m: { tipo: string; formato: string | null }): string {
  if (m.formato === 'REELS') return 'REELS'
  if (m.formato === 'STORY') return 'STORY'
  return m.tipo === 'CAROUSEL_ALBUM' ? 'CARROSSEL' : 'FOTO'
}

function mediana(v: number[]): number | null {
  if (!v.length) return null
  const s = [...v].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const CANAIS = [
  { chave: 'LINK_WHATSAPP', nome: 'Link rastreado → WhatsApp', sub: 'Bio e posts com código', leads: ['LINK_WHATSAPP'], conversas: null },
  { chave: 'DIRECT', nome: 'Direct', sub: 'Conversas iniciadas no Instagram', leads: ['DIRECT', 'RESPOSTA_STORY'], conversas: ['DIRECT', 'RESPOSTA_STORY'] },
  { chave: 'COMENTE_QUERO', nome: 'Comente QUERO → direct', sub: 'Automação de comentário', leads: ['COMENTE_QUERO'], conversas: ['COMENTARIO_AUTOMACAO'] },
  { chave: 'COMENTARIO', nome: 'Comentários', sub: 'Respondidos no post', leads: ['COMENTARIO'], conversas: ['COMENTARIO'] },
] as const

export async function vendasPorPost(usuarioId: string, periodo: PeriodoAtribuicao, opcoes: { mostrarValores: boolean }) {
  const { inicio, fim } = periodo
  const noPeriodo = { gte: inicio, lte: fim }
  const conta = await prisma.socialMediaConta.findUnique({ where: { titular: `dono:${usuarioId}` }, select: { id: true } })

  const [leads, vendasDiretas, conversas, toquesPorLink, links, midiasDoPeriodo, config] = await Promise.all([
    // A coorte: leads orgânicos criados no período, com a venda onde quer que ela caia.
    prisma.lead.findMany({
      where: { usuarioId, criadoEm: noPeriodo, OR: [{ tipoLead: 'ORGANICO' }, { origem: 'INSTAGRAM_ORGANICO' }] },
      select: { id: true, postCode: true, midiaId: true, canalEntrada: true, origem: true, estagio: true, criadoEm: true, conversaId: true, venda: { select: { data: true, valorVenda: true } } },
    }),
    // Venda lançada direto no CRM com o código (sem lead): entra pela data da venda.
    prisma.venda.findMany({
      where: { usuarioId, origem: 'INSTAGRAM_ORGANICO', lead: null, data: noPeriodo },
      select: { postCode: true, midiaId: true, canalEntrada: true, valorVenda: true },
    }),
    prisma.smConversa.findMany({ where: { usuarioId, criadoEm: noPeriodo }, select: { canal: true, postCode: true, midiaIgId: true } }),
    prisma.smLinkClique.groupBy({ by: ['linkId'], where: { em: noPeriodo, link: { usuarioId } }, _count: { _all: true } }),
    prisma.smLinkRastreado.findMany({ where: { usuarioId }, select: { id: true, codigo: true, tipo: true } }),
    conta
      ? prisma.socialMediaMidia.findMany({ where: { contaId: conta.id, publicadoEm: noPeriodo, NOT: { formato: 'AD' } }, select: { instagramMediaId: true, tipo: true, formato: true } })
      : Promise.resolve([]),
    prisma.smConfig.findUnique({ where: { usuarioId }, select: { whatsappLoja: true } }),
  ])

  const conversasDosLeads = await prisma.smConversa.findMany({
    where: { id: { in: leads.map(l => l.conversaId).filter((x): x is string => !!x) } },
    select: { id: true, criadoEm: true },
  })
  const inicioConversa = new Map(conversasDosLeads.map(c => [c.id, c.criadoEm]))

  // Pautas dos códigos citados e mídias dos ids citados (para nome, formato e data).
  const codigos = new Set<string>()
  const midiaIds = new Set<string>()
  for (const x of [...leads, ...vendasDiretas]) { if (x.postCode) codigos.add(x.postCode); if (x.midiaId) midiaIds.add(x.midiaId) }
  for (const c of conversas) { if (c.postCode) codigos.add(c.postCode); if (c.midiaIgId) midiaIds.add(c.midiaIgId) }
  const linkPorId = new Map(links.map(l => [l.id, l]))
  for (const t of toquesPorLink) { const l = linkPorId.get(t.linkId); if (l) codigos.add(l.codigo) }
  for (const m of midiasDoPeriodo) midiaIds.add(m.instagramMediaId)

  const [pautas, midias] = await Promise.all([
    prisma.smPauta.findMany({
      where: { usuarioId, OR: [{ codigo: { in: [...codigos] } }, { igMediaId: { in: [...midiaIds] } }] },
      select: { codigo: true, titulo: true, formato: true, pilar: true, igMediaId: true, publicadaEm: true, agendadoPara: true, moto: { select: { modelo: true } } },
    }),
    conta && midiaIds.size
      ? prisma.socialMediaMidia.findMany({ where: { contaId: conta.id, instagramMediaId: { in: [...midiaIds] } }, select: { instagramMediaId: true, tipo: true, formato: true, legenda: true, publicadoEm: true } })
      : Promise.resolve([]),
  ])
  const pautaPorCodigo = new Map(pautas.filter(p => p.codigo).map(p => [p.codigo!, p]))
  const pautaPorMidia = new Map(pautas.filter(p => p.igMediaId).map(p => [p.igMediaId!, p]))
  const midiaPorId = new Map(midias.map(m => [m.instagramMediaId, m]))

  /** Um post é uma chave só, venha pelo código ou pelo id da mídia. */
  const chaveDoPost = (postCode: string | null, midiaId: string | null): string | null => {
    if (postCode === '#BIO') return 'BIO'
    if (postCode) return `cod:${postCode}`
    if (midiaId) { const p = pautaPorMidia.get(midiaId); return p?.codigo ? `cod:${p.codigo}` : `midia:${midiaId}` }
    return null
  }
  const midiaDaChave = (chave: string): string | null => {
    if (chave.startsWith('midia:')) return chave.slice(6)
    if (chave.startsWith('cod:')) return pautaPorCodigo.get(chave.slice(4))?.igMediaId ?? null
    return null
  }

  const porPost = new Map<string, Acumulador>()
  const porCanal = new Map<string, Acumulador>()
  const somar = (mapa: Map<string, Acumulador>, chave: string, campo: keyof Acumulador, n = 1) => {
    const a = mapa.get(chave) ?? vazio(); a[campo] += n; mapa.set(chave, a)
  }
  const canalDoLead = (c: string | null) => CANAIS.find(k => (k.leads as readonly string[]).includes(c ?? ''))?.chave ?? 'SEM_CANAL'

  let totalLeads = 0, totalVendas = 0, totalValor = 0, totalToques = 0
  const ciclos: number[] = []
  let emNegociacao = 0

  for (const l of leads) {
    const post = chaveDoPost(l.postCode, l.midiaId) ?? (l.origem === 'INSTAGRAM_ORGANICO' ? 'PERFIL' : 'SEM_CODIGO')
    const canal = canalDoLead(l.canalEntrada)
    somar(porPost, post, 'leads'); somar(porCanal, canal, 'leads'); totalLeads++
    if (l.venda) {
      somar(porPost, post, 'vendas'); somar(porCanal, canal, 'vendas'); totalVendas++
      somar(porPost, post, 'valor', l.venda.valorVenda); somar(porCanal, canal, 'valor', l.venda.valorVenda); totalValor += l.venda.valorVenda
      const contato = (l.conversaId && inicioConversa.get(l.conversaId)) || l.criadoEm
      ciclos.push(Math.max(0, (l.venda.data.getTime() - contato.getTime()) / DIA_MS))
    } else if (l.estagio !== 'FECHADO' && l.estagio !== 'PERDIDO') emNegociacao++
  }
  for (const v of vendasDiretas) {
    const post = chaveDoPost(v.postCode, v.midiaId) ?? 'PERFIL'
    const canal = canalDoLead(v.canalEntrada)
    somar(porPost, post, 'vendas'); somar(porCanal, canal, 'vendas'); totalVendas++
    somar(porPost, post, 'valor', v.valorVenda); somar(porCanal, canal, 'valor', v.valorVenda); totalValor += v.valorVenda
  }
  let totalConversas = 0
  for (const c of conversas) {
    somar(porPost, chaveDoPost(c.postCode, c.midiaIgId) ?? 'PERFIL', 'conversas')
    const canal = CANAIS.find(k => k.conversas && (k.conversas as readonly string[]).includes(c.canal))?.chave
    if (canal) somar(porCanal, canal, 'conversas')
    totalConversas++
  }
  for (const t of toquesPorLink) {
    const l = linkPorId.get(t.linkId)
    if (!l) continue
    somar(porPost, l.codigo === '#BIO' ? 'BIO' : `cod:${l.codigo}`, 'toques', t._count._all)
    somar(porCanal, 'LINK_WHATSAPP', 'toques', t._count._all)
    totalToques += t._count._all
  }

  const mostrar = opcoes.mostrarValores
  const valorOuNulo = (v: number) => (mostrar ? Math.round(v * 100) / 100 : null)

  // ----- Por post -----
  const infoDoPost = (chave: string) => {
    const pauta = chave.startsWith('cod:') ? pautaPorCodigo.get(chave.slice(4)) : pautaPorMidia.get(chave.slice(6))
    const midiaId = midiaDaChave(chave)
    const midia = midiaId ? midiaPorId.get(midiaId) : undefined
    const formato = pauta?.formato ?? (midia ? formatoDaMidia(midia) : null)
    const data = pauta?.publicadaEm ?? midia?.publicadoEm ?? pauta?.agendadoPara ?? null
    const codigo = pauta?.codigo ?? (chave.startsWith('cod:') ? chave.slice(4) : null)
    const legenda = midia?.legenda?.split('\n')[0]?.trim()
    const nome = pauta?.titulo ?? (legenda ? (legenda.length > 60 ? `${legenda.slice(0, 57).trimEnd()}…` : legenda) : codigo ?? 'Post do Instagram')
    return {
      nome, formato, pilar: pauta?.pilar ?? null, moto: pauta?.moto?.modelo ?? null,
      sub: [formato ? FORMATO_ROTULO[formato] : 'Post', data ? ddmm(data) : null, codigo].filter(Boolean).join(' · '),
    }
  }
  const linha = (chave: string, nome: string, sub: string, a: Acumulador, toques: number | null = a.toques, conversas: number | null = a.conversas): LinhaAtribuicao =>
    ({ chave, nome, sub, toques, conversas, leads: a.leads, vendas: a.vendas, valor: valorOuNulo(a.valor) })

  const posts = [...porPost.entries()]
    .filter(([k]) => k.startsWith('cod:') || k.startsWith('midia:'))
    .map(([k, a]) => ({ chave: k, a, info: infoDoPost(k) }))
    .sort((x, y) => y.a.leads - x.a.leads || y.a.vendas - x.a.vendas || y.a.valor - x.a.valor || y.a.conversas - x.a.conversas || y.a.toques - x.a.toques)
  const MAX_POSTS = 6
  const visiveis = posts.slice(0, MAX_POSTS)
  const outros = posts.slice(MAX_POSTS)
  const linhasPost: LinhaAtribuicao[] = visiveis.map(p => linha(p.chave, p.info.nome, p.info.sub, p.a))
  if (outros.length) {
    const soma = outros.reduce((s, p) => { s.toques += p.a.toques; s.conversas += p.a.conversas; s.leads += p.a.leads; s.vendas += p.a.vendas; s.valor += p.a.valor; return s }, vazio())
    linhasPost.push(linha('OUTROS', `Outros ${outros.length} ${outros.length === 1 ? 'post' : 'posts'}`, 'Com toques, conversas ou leads no período', soma))
  }
  const especiais: [string, string, string][] = [
    // O Atendimento marca o direct sem post com #BIO (seção 3.5.4): bio e perfil são a mesma origem.
    ['BIO', 'Perfil (sem post)', 'Link da bio e direct sem post · #BIO'],
    ['PERFIL', 'Instagram sem post identificado', 'Lead do Instagram sem código'],
    ['SEM_CODIGO', 'Sem código', 'Lead orgânico cadastrado no CRM sem o código do post'],
  ]
  for (const [k, nome, sub] of especiais) { const a = porPost.get(k); if (a) linhasPost.push(linha(k, nome, sub, a)) }

  // ----- Por canal -----
  const linhasCanal: LinhaAtribuicao[] = CANAIS
    .filter(c => c.chave !== 'COMENTARIO' || porCanal.has('COMENTARIO'))
    .map(c => { const a = porCanal.get(c.chave) ?? vazio(); return linha(c.chave, c.nome, c.sub, a, c.chave === 'LINK_WHATSAPP' ? a.toques : null, c.conversas ? a.conversas : null) })
  const semCanal = porCanal.get('SEM_CANAL')
  if (semCanal) linhasCanal.push(linha('SEM_CANAL', 'Cadastro no CRM', 'Lead orgânico sem canal de entrada', semCanal, null, null))

  const totais: LinhaAtribuicao = { chave: 'TOTAL', nome: 'Total', sub: '', toques: totalToques, conversas: totalConversas, leads: totalLeads, vendas: totalVendas, valor: valorOuNulo(totalValor) }

  // ----- Banner "O que os dados dizem" (regra de concentração) -----
  const comLeads = posts.filter(p => p.a.leads > 0)
  const leadsEmPosts = comLeads.reduce((s, p) => s + p.a.leads, 0)
  let concentracao: { titulo: string; detalhe: string; posts: { codigo: string | null; nome: string; formato: string | null; pilar: string | null }[] } | null = null
  const MIN_LEADS = 5
  if (leadsEmPosts >= MIN_LEADS && comLeads.length >= 2) {
    const top = comLeads.slice(0, 3)
    const leadsTop = top.reduce((s, p) => s + p.a.leads, 0)
    const pct = Math.round((leadsTop / totalLeads) * 100)
    if (pct >= 30) {
      const formatoComum = top.every(p => p.info.formato && p.info.formato === top[0].info.formato) ? top[0].info.formato : null
      const pilarComum = top.every(p => p.info.pilar && p.info.pilar === top[0].info.pilar) ? top[0].info.pilar : null
      const n = top.length
      const tipo = formatoComum ? FORMATO_PLURAL[formatoComum][n === 1 ? 0 : 1] : n === 1 ? 'post' : 'posts'
      const nomes = top.map(p => p.info.moto ?? p.info.nome)
      const lista = nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}` : nomes[0]
      const restantes = posts.length - n
      const leadsRestantes = posts.reduce((s, p) => s + p.a.leads, 0) - leadsTop
      const vendasTop = top.reduce((s, p) => s + p.a.vendas, 0)
      concentracao = {
        titulo: `${pct}% dos leads vieram de ${n} ${tipo}${pilarComum ? ` ${PILAR_DE[pilarComum]}` : ''}: ${lista}`,
        detalhe: `Juntos: ${leadsTop} ${leadsTop === 1 ? 'lead' : 'leads'} e ${vendasTop} ${vendasTop === 1 ? 'venda' : 'vendas'}.`
          + (restantes > 0 ? ` Os outros ${restantes} ${restantes === 1 ? 'post' : 'posts'} com atividade somaram ${leadsRestantes} ${leadsRestantes === 1 ? 'lead' : 'leads'}.` : '')
          + ' Vale repetir o formato.',
        posts: top.map(p => ({ codigo: p.chave.startsWith('cod:') ? p.chave.slice(4) : null, nome: p.info.nome, formato: p.info.formato, pilar: p.info.pilar })),
      }
    }
  }

  // ----- Leads por formato (posts publicados no período) -----
  const leadsPorMidia = new Map<string, number>()
  for (const p of posts) { const m = midiaDaChave(p.chave); if (m) leadsPorMidia.set(m, (leadsPorMidia.get(m) ?? 0) + p.a.leads) }
  const formatos = new Map<string, { posts: number; leads: number }>()
  for (const m of midiasDoPeriodo) {
    const f = formatoDaMidia(m)
    const x = formatos.get(f) ?? { posts: 0, leads: 0 }
    x.posts++; x.leads += leadsPorMidia.get(m.instagramMediaId) ?? 0
    formatos.set(f, x)
  }
  const AMOSTRA_MINIMA = 5
  const leadsPorFormato = ['REELS', 'CARROSSEL', 'FOTO', 'STORY']
    .filter(f => formatos.has(f))
    .map(f => { const x = formatos.get(f)!; return { formato: f, rotulo: FORMATO_ROTULO[f], posts: x.posts, leads: x.leads, leadsPorPost: Math.round((x.leads / x.posts) * 10) / 10, amostraPequena: x.posts < AMOSTRA_MINIMA } })
    .sort((a, b) => b.leads - a.leads || b.posts - a.posts)

  const m = mediana(ciclos)
  return {
    periodo: { inicio: inicio.toISOString(), fim: fim.toISOString(), dias: periodo.dias, rotulo: `${ddmm(inicio)} a ${ddmm(fim)}` },
    valoresOcultos: !mostrar,
    kpis: {
      leads: totalLeads,
      vendas: totalVendas,
      valor: valorOuNulo(totalValor),
      conversao: totalLeads ? Math.round((totalVendas / totalLeads) * 1000) / 10 : null,
      ticket: totalVendas ? valorOuNulo(totalValor / totalVendas) : null,
    },
    concentracao,
    leadsComPost: leadsEmPosts,
    minimoConcentracao: MIN_LEADS,
    porPost: linhasPost,
    porCanal: linhasCanal,
    totais,
    leadsPorFormato,
    ciclo: { medianaDias: m === null ? null : Math.round(m), vendas: ciclos.length, emNegociacao },
    whatsappConfigurado: !!config?.whatsappLoja,
  }
}
