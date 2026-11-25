// ARIES DISPARO — Biblioteca de arquivos: envio do computador (direto para o armazenamento, sem o
// limite de 4,5 MB da Vercel), capa dos vídeos, importação do Instagram da empresa e os links
// temporários para a tela e para o WhatsApp baixar o arquivo.
//
// Caminho do envio do computador:
//   1. iniciar  → confere tipo/tamanho declarados e cria a mídia como ENVIANDO (não aparece na lista)
//   2. o navegador manda o arquivo direto para o Supabase (link assinado); se o navegador não
//      conseguir, manda em pedaços de 3,5 MB pela API e o servidor monta o arquivo
//   3. concluir → confere o tipo pelo CONTEÚDO (primeiros bytes) e o tamanho; só então fica PRONTA
//   4. capa     → a imagem de um quadro do vídeo, gerada no navegador em alta qualidade
import crypto from 'crypto'
import { prisma } from '../prisma'
import { logger } from '../logger'
import { gravarExato, gravarNoBlob, inicioDoArquivo, lerArquivoSistema, lerDoBlob, linkDeEnvio, linksTemporarios, removerTemporarios, supabaseConfigurado } from '../armazenamento'
import { buscarPaginaMidias, buscarPublicacaoCompleta, buscarStoriesAtivos, comApiDaEmpresa, erroDeTokenExpirado } from '../instagramGraph'

export class ErroMidia extends Error { constructor(msg: string, readonly status = 400) { super(msg) } }

const MB = 1024 * 1024
export type TipoMidia = 'IMAGEM' | 'AUDIO' | 'VIDEO' | 'DOCUMENTO'
/** Limite por tipo (o que o WhatsApp do vendedor aceita bem). Sem armazenamento externo, 4 MB. */
export const LIMITES: Record<TipoMidia, number> = { IMAGEM: 16 * MB, AUDIO: 16 * MB, VIDEO: 64 * MB, DOCUMENTO: 64 * MB }
export const LIMITE_SEM_ARMAZENAMENTO = 4 * MB
export const PARTE_BYTES = Math.floor(3.5 * MB)
export const limiteDe = (tipo: TipoMidia) => (supabaseConfigurado() ? LIMITES[tipo] : LIMITE_SEM_ARMAZENAMENTO)

export const MIMES: Record<string, { tipo: TipoMidia; ext: string }> = {
  'image/jpeg': { tipo: 'IMAGEM', ext: 'jpg' }, 'image/png': { tipo: 'IMAGEM', ext: 'png' }, 'image/webp': { tipo: 'IMAGEM', ext: 'webp' },
  'audio/mpeg': { tipo: 'AUDIO', ext: 'mp3' }, 'audio/ogg': { tipo: 'AUDIO', ext: 'ogg' }, 'audio/mp4': { tipo: 'AUDIO', ext: 'm4a' }, 'audio/aac': { tipo: 'AUDIO', ext: 'aac' },
  'video/mp4': { tipo: 'VIDEO', ext: 'mp4' }, 'video/3gpp': { tipo: 'VIDEO', ext: '3gp' }, 'video/quicktime': { tipo: 'VIDEO', ext: 'mov' },
  'application/pdf': { tipo: 'DOCUMENTO', ext: 'pdf' }, 'application/msword': { tipo: 'DOCUMENTO', ext: 'doc' }, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { tipo: 'DOCUMENTO', ext: 'docx' },
  'application/vnd.ms-excel': { tipo: 'DOCUMENTO', ext: 'xls' }, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { tipo: 'DOCUMENTO', ext: 'xlsx' },
}

/** Confere o tipo pelo conteúdo do arquivo (não pelo que o navegador diz). */
export function mimePeloConteudo(b: Buffer, declarado: string): string | null {
  const h = b.subarray(0, 16)
  const ini = (sig: number[], off = 0) => sig.every((x, i) => h[off + i] === x)
  if (ini([0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (ini([0x89, 0x50, 0x4e, 0x47])) return 'image/png'
  if (ini([0x52, 0x49, 0x46, 0x46]) && b.subarray(8, 12).toString() === 'WEBP') return 'image/webp'
  if (ini([0x25, 0x50, 0x44, 0x46])) return 'application/pdf'
  if (ini([0x4f, 0x67, 0x67, 0x53])) return 'audio/ogg'
  if (ini([0x49, 0x44, 0x33]) || ini([0xff, 0xfb]) || ini([0xff, 0xf3])) return 'audio/mpeg'
  if (b.subarray(4, 8).toString() === 'ftyp') {
    const marca = b.subarray(8, 12).toString()
    if (declarado.startsWith('audio/') || marca === 'M4A ') return 'audio/mp4'
    if (marca === 'qt  ') return 'video/quicktime'
    if (marca.startsWith('3g')) return 'video/3gpp'
    return 'video/mp4'
  }
  if (ini([0xd0, 0xcf, 0x11, 0xe0])) return declarado === 'application/vnd.ms-excel' ? 'application/vnd.ms-excel' : 'application/msword'
  if (ini([0x50, 0x4b, 0x03, 0x04]) && declarado.includes('officedocument')) return declarado
  return null
}
const imagemPeloConteudo = (b: Buffer) => { const m = mimePeloConteudo(b, ''); return m && MIMES[m]?.tipo === 'IMAGEM' ? m : null }

export const nomeSeguro = (n: string) => n.replace(/[^\w.\- ()À-ú]/g, '').slice(0, 120) || 'arquivo'
const caminhoDe = (usuarioId: string, id: string, nome: string, ext: string) => `disparo/${usuarioId}/${id}-${crypto.randomBytes(4).toString('hex')}-${nome.replace(/\.[a-z0-9]+$/i, '').replace(/[^\w-]/g, '_').slice(0, 60)}.${ext}`

// ---------- Envio do computador ----------

export interface Inicio { nome: string; mime: string; tamanho: number; largura?: number | null; altura?: number | null; duracaoSeg?: number | null }

export async function iniciarEnvio(usuarioId: string, autorNome: string | null, i: Inicio) {
  const tipo = MIMES[i.mime]?.tipo
  if (!tipo) throw new ErroMidia('Formato não aceito: use JPG, PNG, WebP, MP4, MOV, MP3, OGG, M4A, PDF, Word ou Excel')
  const limite = limiteDe(tipo)
  if (i.tamanho <= 0) throw new ErroMidia('Arquivo vazio')
  if (i.tamanho > limite) throw new ErroMidia(`Arquivo grande demais: ${(i.tamanho / MB).toFixed(1)} MB (o máximo para ${tipo.toLowerCase()} é ${Math.round(limite / MB)} MB)`, 413)
  const nome = nomeSeguro(i.nome)
  const m = await prisma.disparoMidia.create({ data: { usuarioId, nome, tipo, mime: i.mime, tamanho: i.tamanho, status: 'ENVIANDO', largura: i.largura ?? null, altura: i.altura ?? null, duracaoSeg: i.duracaoSeg ?? null, criadoPorNome: autorNome } })
  // Sem armazenamento externo: o arquivo (até 4 MB) vai pela própria API.
  if (!supabaseConfigurado()) return { id: m.id, direto: null, parteBytes: PARTE_BYTES, pelaApi: true }
  const caminho = caminhoDe(usuarioId, m.id, nome, MIMES[i.mime].ext)
  const envio = await linkDeEnvio(caminho)
  await prisma.disparoMidia.update({ where: { id: m.id }, data: { blobUrl: envio.endereco, blobAcesso: 'supabase' } })
  return { id: m.id, direto: envio.url, parteBytes: PARTE_BYTES, pelaApi: false }
}

async function midiaEmEnvio(usuarioId: string, id: string) {
  const m = await prisma.disparoMidia.findFirst({ where: { id, usuarioId } })
  if (!m) throw new ErroMidia('Arquivo não encontrado', 404)
  if (m.status !== 'ENVIANDO') throw new ErroMidia('Este arquivo já foi concluído', 409)
  return m
}

/** Plano B (navegador não conseguiu mandar direto): um pedaço de até 3,5 MB pela API. */
export async function receberParte(usuarioId: string, id: string, n: number, dados: Buffer) {
  const m = await midiaEmEnvio(usuarioId, id)
  if (!Number.isInteger(n) || n < 0 || n > 40) throw new ErroMidia('Pedaço inválido')
  if (!dados.length || dados.length > PARTE_BYTES) throw new ErroMidia('Pedaço com tamanho inválido')
  if (!supabaseConfigurado()) {
    // Sem armazenamento externo só existe um pedaço (até 4 MB): ele é o arquivo.
    if (n !== 0) throw new ErroMidia('Sem armazenamento externo, o arquivo precisa ter até 4 MB')
    await prisma.disparoMidia.update({ where: { id: m.id }, data: { dados } })
    return
  }
  await gravarExato(`disparo-partes/${m.id}/${String(n).padStart(3, '0')}`, 'application/octet-stream', dados)
}

/** Confere o arquivo recebido (tipo pelo conteúdo e tamanho) e libera para uso. */
export async function concluirEnvio(usuarioId: string, id: string, partes: number | null) {
  const m = await midiaEmEnvio(usuarioId, id)
  let inicio: Buffer | null = null
  let tamanho: number | null = null
  if (m.dados) { inicio = Buffer.from(m.dados).subarray(0, 64); tamanho = m.dados.length }
  else if (partes && partes > 0) {
    // Monta o arquivo com os pedaços (até 64 MB) e grava no caminho definitivo.
    const enderecos = Array.from({ length: partes }, (_, k) => `supabase://aries-arquivos/disparo-partes/${m.id}/${String(k).padStart(3, '0')}`)
    const bufs: Buffer[] = []
    for (const e of enderecos) { const b = await lerArquivoSistema(e); if (!b) throw new ErroMidia('Um pedaço do arquivo não chegou: envie de novo'); bufs.push(b) }
    const tudo = Buffer.concat(bufs)
    inicio = tudo.subarray(0, 64); tamanho = tudo.length
    const destino = m.blobUrl ?? `supabase://aries-arquivos/${caminhoDe(usuarioId, m.id, m.nome, MIMES[m.mime]?.ext ?? 'bin')}`
    await gravarExato(destino.replace(/^supabase:\/\/aries-arquivos\//, ''), m.mime, tudo)
    await prisma.disparoMidia.update({ where: { id: m.id }, data: { blobUrl: destino, blobAcesso: 'supabase' } })
    void removerTemporarios(enderecos)
  } else if (m.blobUrl) {
    const r = await inicioDoArquivo(m.blobUrl)
    if (!r) throw new ErroMidia('O arquivo não chegou ao armazenamento: envie de novo')
    inicio = r.inicio; tamanho = r.tamanho
  }
  if (!inicio) throw new ErroMidia('O arquivo não chegou: envie de novo')
  const real = mimePeloConteudo(inicio, m.mime)
  if (!real || MIMES[real]?.tipo !== m.tipo) {
    await prisma.disparoMidia.update({ where: { id: m.id }, data: { status: 'RECUSADA', arquivadoEm: new Date() } })
    throw new ErroMidia('O conteúdo do arquivo não confere com o tipo (ex.: texto com nome de imagem): recusado')
  }
  if (tamanho != null && tamanho > LIMITES[m.tipo as TipoMidia]) {
    await prisma.disparoMidia.update({ where: { id: m.id }, data: { status: 'RECUSADA', arquivadoEm: new Date() } })
    throw new ErroMidia('Arquivo maior que o limite: recusado', 413)
  }
  await prisma.disparoMidia.update({ where: { id: m.id }, data: { status: 'PRONTA', mime: real, ...(tamanho ? { tamanho } : {}) } })
  return { id: m.id }
}

/** Capa (imagem de um quadro do vídeo), em alta qualidade. */
export async function guardarCapa(usuarioId: string, id: string, dados: Buffer) {
  const m = await prisma.disparoMidia.findFirst({ where: { id, usuarioId }, select: { id: true } })
  if (!m) throw new ErroMidia('Arquivo não encontrado', 404)
  const mime = imagemPeloConteudo(dados)
  if (!mime) throw new ErroMidia('A capa precisa ser uma imagem JPG, PNG ou WebP')
  const g = await gravarNoBlob(`disparo/${usuarioId}/capas/${id}.${MIMES[mime].ext}`, mime, dados)
  await prisma.disparoMidia.update({ where: { id }, data: { capaMime: mime, ...(g ? { capaBlobUrl: g.blobUrl, capaBlobAcesso: g.blobAcesso, capaDados: null } : { capaDados: dados }) } })
}

// ---------- Leitura: lista com links, arquivo para o WhatsApp ----------

const LINK_TELA_SEG = 2 * 3600
export async function listarMidias(usuarioId: string) {
  const ms = await prisma.disparoMidia.findMany({ where: { usuarioId, arquivadoEm: null, status: 'PRONTA' }, orderBy: { criadoEm: 'desc' }, select: { id: true, nome: true, tipo: true, mime: true, tamanho: true, criadoPorNome: true, criadoEm: true, largura: true, altura: true, duracaoSeg: true, blobUrl: true, capaBlobUrl: true, capaDados: false, capaMime: true, origem: true, origemLink: true, legenda: true } })
  const links = await linksTemporarios(ms.flatMap(m => [m.blobUrl, m.capaBlobUrl].filter((x): x is string => !!x)), LINK_TELA_SEG).catch(() => new Map<string, string>())
  return ms.map(({ blobUrl, capaBlobUrl, ...m }) => ({ ...m, arquivoUrl: blobUrl ? links.get(blobUrl) ?? null : null, capaUrl: capaBlobUrl ? links.get(capaBlobUrl) ?? null : null, temCapa: !!(capaBlobUrl || m.capaMime) }))
}

/** O arquivo para o WhatsApp: link temporário (o servidor do WhatsApp baixa) ou o conteúdo (arquivo pequeno no banco). */
export async function arquivoParaEnvio(midiaId: string): Promise<{ mime: string; nomeArquivo: string; url: string | null; dados: Buffer | null } | null> {
  const md = await prisma.disparoMidia.findUnique({ where: { id: midiaId } })
  if (!md || md.status !== 'PRONTA') return null
  if (md.blobUrl && md.blobAcesso === 'supabase') {
    const url = (await linksTemporarios([md.blobUrl], 3 * 3600).catch(() => new Map<string, string>())).get(md.blobUrl) ?? null
    if (url) return { mime: md.mime, nomeArquivo: md.nome, url, dados: null }
  }
  const dados = md.blobUrl ? await lerDoBlob(md.blobUrl, md.blobAcesso) : md.dados ? Buffer.from(md.dados) : null
  return dados ? { mime: md.mime, nomeArquivo: md.nome, url: null, dados } : null
}

export async function capaDaMidia(usuarioId: string, id: string): Promise<{ mime: string; dados: Buffer } | null> {
  const m = await prisma.disparoMidia.findFirst({ where: { id, usuarioId }, select: { capaDados: true, capaBlobUrl: true, capaBlobAcesso: true, capaMime: true } })
  if (!m?.capaMime) return null
  const dados = m.capaDados ? Buffer.from(m.capaDados) : m.capaBlobUrl ? await lerDoBlob(m.capaBlobUrl, m.capaBlobAcesso) : null
  return dados ? { mime: m.capaMime, dados } : null
}

// ---------- Instagram da empresa ----------

async function contaDaEmpresa(usuarioId: string) {
  const conta = await prisma.socialMediaConta.findUnique({ where: { titular: `dono:${usuarioId}` }, select: { id: true, instagramUserId: true, accessToken: true, nomeUsuario: true, tipoConexao: true } })
  if (!conta) throw new ErroMidia('O Instagram da empresa não está conectado. Conecte em Social Media › Conexão.', 409)
  const naApi = <T,>(fn: () => Promise<T>) => (conta.tipoConexao === 'EMPRESA' ? comApiDaEmpresa(fn) : fn())
  return { ...conta, naApi, idConta: conta.tipoConexao === 'EMPRESA' ? conta.instagramUserId : 'me' }
}
function erroDoInstagram(e: unknown): never {
  if (e instanceof ErroMidia) throw e
  if (erroDeTokenExpirado(e)) throw new ErroMidia('A conexão com o Instagram venceu. Reconecte em Social Media › Conexão.', 409)
  throw new ErroMidia(`O Instagram não respondeu: ${String((e as Error)?.message ?? e).slice(0, 160)}`, 502)
}
async function jaImportadas(usuarioId: string, ids: string[]) {
  if (!ids.length) return new Set<string>()
  return new Set((await prisma.disparoMidia.findMany({ where: { usuarioId, origem: 'INSTAGRAM', arquivadoEm: null, origemRef: { in: ids } }, select: { origemRef: true } })).map(x => x.origemRef))
}

/** Publicações do feed (fotos, reels, carrosséis), página a página até a primeira postagem. */
export async function publicacoesDoInstagram(usuarioId: string, opcoes: { apos?: string | null; limite?: number } = {}) {
  const c = await contaDaEmpresa(usuarioId)
  try {
    const pag = await c.naApi(() => buscarPaginaMidias(c.idConta, c.accessToken, opcoes.apos ?? null, opcoes.limite ?? 24))
    const ja = await jaImportadas(usuarioId, pag.itens.map(m => m.instagramMediaId))
    return {
      conta: c.nomeUsuario, proximo: pag.proximo,
      itens: pag.itens.map(m => ({ id: m.instagramMediaId, tipo: m.tipo, formato: m.formato, legenda: m.legenda?.slice(0, 300) ?? null, capa: m.tipo === 'VIDEO' ? m.thumbnailUrl ?? null : m.urlMidia ?? null, link: m.urlPermalink ?? null, publicadoEm: m.publicadoEm.toISOString(), importada: ja.has(m.instagramMediaId), noAr: true, guardado: true })),
    }
  } catch (e) { erroDoInstagram(e) }
}

const DIA_MS = 86_400_000
/**
 * Stories: os que estão no ar agora (direto do Instagram) e os que já saíram do ar mas tiveram o
 * arquivo guardado pelo ARIES enquanto estavam no ar. Página a página (cursor = data do último).
 */
export async function storiesDoInstagram(usuarioId: string, opcoes: { apos?: string | null; limite?: number } = {}) {
  const c = await contaDaEmpresa(usuarioId)
  const limite = Math.min(60, Math.max(6, opcoes.limite ?? 30))
  // Na primeira página: garante que os stories no ar agora já estão guardados (até ~8 s).
  if (!opcoes.apos) await arquivarStoriesDaConta(c.id, Date.now() + 8000).catch(e => logger.warn({ err: e }, 'disparo: arquivar stories'))
  const linhas = await prisma.socialMediaMidia.findMany({
    where: { contaId: c.id, formato: 'STORY', ...(opcoes.apos ? { publicadoEm: { lt: new Date(opcoes.apos) } } : {}) },
    orderBy: { publicadoEm: 'desc' }, take: limite + 1,
    select: { instagramMediaId: true, tipo: true, legenda: true, urlMidia: true, thumbnailUrl: true, publicadoEm: true, arquivoBlobUrl: true, capaBlobUrl: true, arquivoErro: true },
  })
  const pagina = linhas.slice(0, limite)
  const links = await linksTemporarios(pagina.flatMap(l => [l.capaBlobUrl, l.tipo === 'IMAGE' ? l.arquivoBlobUrl : null].filter((x): x is string => !!x)), LINK_TELA_SEG).catch(() => new Map<string, string>())
  const ja = await jaImportadas(usuarioId, pagina.map(l => l.instagramMediaId))
  const agora = Date.now()
  return {
    conta: c.nomeUsuario, proximo: linhas.length > limite ? pagina[pagina.length - 1].publicadoEm.toISOString() : null,
    itens: pagina.map(l => {
      const noAr = agora - l.publicadoEm.getTime() < DIA_MS
      const capa = (l.capaBlobUrl && links.get(l.capaBlobUrl)) || (l.tipo === 'IMAGE' && l.arquivoBlobUrl && links.get(l.arquivoBlobUrl)) || (noAr ? (l.tipo === 'VIDEO' ? l.thumbnailUrl : l.urlMidia) : null) || null
      return { id: l.instagramMediaId, tipo: l.tipo, formato: 'STORY', legenda: l.legenda?.slice(0, 300) ?? null, capa, link: null, publicadoEm: l.publicadoEm.toISOString(), importada: ja.has(l.instagramMediaId), noAr, guardado: !!l.arquivoBlobUrl }
    }),
  }
}

/** Guarda no armazenamento o arquivo (e a capa) dos stories no ar desta conta. Para no prazo. */
export async function arquivarStoriesDaConta(contaId: string, prazo: number): Promise<number> {
  if (!supabaseConfigurado()) return 0
  const conta = await prisma.socialMediaConta.findUnique({ where: { id: contaId }, select: { id: true, instagramUserId: true, accessToken: true, tipoConexao: true } })
  if (!conta) return 0
  const naApi = <T,>(fn: () => Promise<T>) => (conta.tipoConexao === 'EMPRESA' ? comApiDaEmpresa(fn) : fn())
  const idConta = conta.tipoConexao === 'EMPRESA' ? conta.instagramUserId : 'me'
  // Os que estão no ar agora (o sync de hora em hora pode ainda não ter gravado).
  const noAr = await naApi(() => buscarStoriesAtivos(idConta, conta.accessToken)).catch(() => [] as Awaited<ReturnType<typeof buscarStoriesAtivos>>)
  for (const m of noAr) {
    await prisma.socialMediaMidia.upsert({ where: { instagramMediaId: m.instagramMediaId }, create: { contaId: conta.id, instagramMediaId: m.instagramMediaId, tipo: m.tipo, formato: 'STORY', legenda: m.legenda ?? null, urlMidia: m.urlMidia ?? null, thumbnailUrl: m.thumbnailUrl ?? null, urlPermalink: m.urlPermalink ?? null, publicadoEm: m.publicadoEm }, update: { urlMidia: m.urlMidia ?? null, thumbnailUrl: m.thumbnailUrl ?? null } }).catch(() => undefined)
  }
  const pendentes = await prisma.socialMediaMidia.findMany({ where: { contaId: conta.id, formato: 'STORY', arquivoBlobUrl: null, arquivoErro: null, publicadoEm: { gte: new Date(Date.now() - 26 * 3600e3) } }, orderBy: { publicadoEm: 'desc' }, take: 20 })
  let n = 0
  for (const p of pendentes) {
    if (Date.now() > prazo - 3000) break
    const vivo = noAr.find(x => x.instagramMediaId === p.instagramMediaId)
    const url = vivo?.urlMidia ?? p.urlMidia
    const capaUrl = vivo?.thumbnailUrl ?? p.thumbnailUrl
    try {
      if (!url) throw new Error('A Meta não liberou o arquivo deste story')
      const video = p.tipo === 'VIDEO'
      const dados = await baixar(url, video ? LIMITES.VIDEO : LIMITES.IMAGEM, Math.max(3000, prazo - Date.now() - 1000))
      const mime = mimePeloConteudo(dados, video ? 'video/mp4' : 'image/jpeg')
      if (!mime) throw new Error('Formato inesperado')
      const endereco = await gravarExato(`instagram/stories/${conta.id}/${p.instagramMediaId}.${MIMES[mime]?.ext ?? 'bin'}`, mime, dados)
      let capaEnd: string | null = null
      if (video && capaUrl) {
        const capa = await baixar(capaUrl, 8 * MB, 5000).catch(() => null)
        const cm = capa ? imagemPeloConteudo(capa) : null
        if (capa && cm) capaEnd = await gravarExato(`instagram/stories/${conta.id}/${p.instagramMediaId}-capa.${MIMES[cm].ext}`, cm, capa)
      }
      await prisma.socialMediaMidia.updateMany({ where: { instagramMediaId: p.instagramMediaId }, data: { arquivoBlobUrl: endereco, arquivoMime: mime, arquivoTamanho: dados.length, capaBlobUrl: capaEnd, arquivoGuardadoEm: new Date(), arquivoErro: null } })
      n += 1
    } catch (e) {
      // Ainda no ar: tenta de novo na próxima rodada; saiu do ar sem guardar: registra o motivo.
      if (!vivo && Date.now() - p.publicadoEm.getTime() > DIA_MS) await prisma.socialMediaMidia.updateMany({ where: { instagramMediaId: p.instagramMediaId }, data: { arquivoErro: String((e as Error)?.message ?? e).slice(0, 200) } })
    }
  }
  return n
}

/** Rotina: guarda os stories no ar de todas as contas da empresa conectadas. */
export async function arquivarStories(prazoMs: number): Promise<{ storiesGuardados: number }> {
  const fim = Date.now() + prazoMs
  let total = 0
  if (!supabaseConfigurado()) return { storiesGuardados: 0 }
  for (const c of await prisma.socialMediaConta.findMany({ where: { titular: { startsWith: 'dono:' } }, select: { id: true } })) {
    if (Date.now() > fim - 3000) break
    total += await arquivarStoriesDaConta(c.id, fim).catch(() => 0)
  }
  return { storiesGuardados: total }
}

/** Baixa com prazo e limite de tamanho (para no limite, sem guardar tudo antes de conferir). */
async function baixar(url: string, max: number, prazoMs: number): Promise<Buffer> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), prazoMs)
  try {
    const r = await fetch(url, { signal: ctl.signal })
    if (!r.ok || !r.body) throw new ErroMidia(`O Instagram não entregou o arquivo (${r.status})`, 502)
    const partes: Uint8Array[] = []
    let total = 0
    const leitor = r.body.getReader()
    for (;;) {
      const { done, value } = await leitor.read()
      if (done) break
      total += value.length
      if (total > max) { ctl.abort(); throw new ErroMidia(`Arquivo do Instagram maior que ${Math.round(max / MB)} MB`, 413) }
      partes.push(value)
    }
    return Buffer.concat(partes)
  } finally { clearTimeout(t) }
}

/**
 * Traz para a Biblioteca: uma publicação (todos os itens, ou só os escolhidos do carrossel) ou um story
 * (guardado pelo ARIES ou ainda no ar). comoImagem: de um vídeo, traz só a capa como imagem.
 */
export async function importarDoInstagram(usuarioId: string, autorNome: string | null, mediaId: string, escolhidos?: string[] | null, opcoes: { comoImagem?: boolean } = {}) {
  if (!supabaseConfigurado()) throw new ErroMidia('Para trazer vídeos e fotos do Instagram, o armazenamento de arquivos (Supabase) precisa estar configurado.', 409)
  const c = await contaDaEmpresa(usuarioId)
  // Story guardado pelo ARIES: usa o arquivo guardado (funciona mesmo depois de sair do ar).
  const story = await prisma.socialMediaMidia.findFirst({ where: { contaId: c.id, instagramMediaId: mediaId, formato: 'STORY' } })
  if (story?.arquivoBlobUrl && story.arquivoMime) {
    const quando = story.publicadoEm.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    if (opcoes.comoImagem && story.tipo === 'VIDEO') {
      if (!story.capaBlobUrl) throw new ErroMidia('Este story em vídeo não tem capa guardada: traga o vídeo')
      const dados = await lerArquivoSistema(story.capaBlobUrl)
      const mime = dados ? imagemPeloConteudo(dados) : null
      if (!dados || !mime) throw new ErroMidia('A capa guardada não está disponível')
      const m = await prisma.disparoMidia.create({ data: { usuarioId, nome: nomeSeguro(`Story ${quando} (capa).${MIMES[mime].ext}`), tipo: 'IMAGEM', mime, tamanho: dados.length, status: 'PRONTA', blobUrl: story.capaBlobUrl, blobAcesso: 'supabase', origem: 'INSTAGRAM', origemRef: mediaId, criadoPorNome: autorNome } })
      return { criadas: [{ id: m.id, nome: m.nome, tipo: 'IMAGEM' }], falhas: [], legenda: null }
    }
    const tipo = MIMES[story.arquivoMime]?.tipo ?? 'IMAGEM'
    const m = await prisma.disparoMidia.create({ data: { usuarioId, nome: nomeSeguro(`Story ${quando}.${MIMES[story.arquivoMime]?.ext ?? 'bin'}`), tipo, mime: story.arquivoMime, tamanho: story.arquivoTamanho ?? 0, status: 'PRONTA', blobUrl: story.arquivoBlobUrl, blobAcesso: 'supabase', ...(story.capaBlobUrl ? { capaBlobUrl: story.capaBlobUrl, capaBlobAcesso: 'supabase', capaMime: 'image/jpeg' } : {}), origem: 'INSTAGRAM', origemRef: mediaId, legenda: story.legenda, criadoPorNome: autorNome } })
    return { criadas: [{ id: m.id, nome: m.nome, tipo }], falhas: [], legenda: story.legenda ?? null }
  }
  if (story && Date.now() - story.publicadoEm.getTime() > DIA_MS) throw new ErroMidia(`Este story saiu do ar antes de o ARIES guardar o arquivo${story.arquivoErro ? ` (${story.arquivoErro})` : ''}. Os próximos ficam guardados sozinhos.`, 410)
  let pub
  try { pub = await c.naApi(() => buscarPublicacaoCompleta(mediaId, c.accessToken)) } catch (e) { erroDoInstagram(e) }
  const itens = pub.itens.filter(i => !escolhidos?.length || escolhidos.includes(i.id))
  if (!itens.length) throw new ErroMidia('Nada para importar nesta publicação')
  const fim = Date.now() + 22_000
  const criadas: Array<{ id: string; nome: string; tipo: string }> = []
  const falhas: string[] = []
  const base = story ? `Story ${story.publicadoEm.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : (pub.legenda ?? '').split('\n')[0].replace(/[#@]\S+/g, '').trim().slice(0, 50) || `Instagram ${pub.formato === 'REELS' ? 'reels' : 'post'}`
  for (const [k, it] of itens.entries()) {
    if (Date.now() > fim) { falhas.push(`${itens.length - k} item(ns) ficaram para depois: importe de novo`); break }
    try {
      const soCapa = !!opcoes.comoImagem && it.tipo === 'VIDEO'
      const url = soCapa ? it.capa : it.url
      if (!url) throw new ErroMidia(soCapa ? 'Este vídeo não tem capa disponível' : 'A Meta não liberou o arquivo deste item (ex.: música com direitos autorais)')
      const video = it.tipo === 'VIDEO' && !soCapa
      const dados = await baixar(url, video ? LIMITES.VIDEO : LIMITES.IMAGEM, Math.max(4000, fim - Date.now()))
      const mime = mimePeloConteudo(dados, video ? 'video/mp4' : 'image/jpeg')
      if (!mime || MIMES[mime].tipo !== (video ? 'VIDEO' : 'IMAGEM')) throw new ErroMidia('O arquivo do Instagram veio num formato inesperado')
      const nome = nomeSeguro(`${base}${itens.length > 1 ? ` (${k + 1})` : ''}${soCapa ? ' (capa)' : ''}.${MIMES[mime].ext}`)
      const m = await prisma.disparoMidia.create({ data: { usuarioId, nome, tipo: MIMES[mime].tipo, mime, tamanho: dados.length, status: 'ENVIANDO', origem: 'INSTAGRAM', origemRef: pub.id, origemLink: pub.link, legenda: pub.legenda?.slice(0, 2000) ?? null, criadoPorNome: autorNome } })
      const destino = caminhoDe(usuarioId, m.id, nome, MIMES[mime].ext)
      const endereco = await gravarExato(destino, mime, dados)
      await prisma.disparoMidia.update({ where: { id: m.id }, data: { blobUrl: endereco, blobAcesso: 'supabase' } })
      if (video && it.capa) {
        const capa = await baixar(it.capa, 8 * MB, 6000).catch(() => null)
        if (capa) await guardarCapa(usuarioId, m.id, capa).catch(e => logger.warn({ err: e }, 'disparo: capa do instagram'))
      }
      await prisma.disparoMidia.update({ where: { id: m.id }, data: { status: 'PRONTA' } })
      criadas.push({ id: m.id, nome, tipo: MIMES[mime].tipo })
    } catch (e) {
      falhas.push(`Item ${k + 1}: ${e instanceof ErroMidia ? e.message : String((e as Error)?.message ?? e).slice(0, 120)}`)
    }
  }
  if (!criadas.length) throw new ErroMidia(falhas.join(' · ') || 'Não foi possível importar', 502)
  return { criadas, falhas, legenda: pub.legenda ?? null }
}

export type MidiaListada = Awaited<ReturnType<typeof listarMidias>>[number]
export const _paraTestes = { baixar }
