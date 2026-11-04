// Armazenamento de arquivos do Pró-Labore. As imagens (ImagemUpload) e as
// mídias das conversas vão, nesta ordem de preferência:
// 1. para o Supabase Storage (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY; bucket
//    privado aries-arquivos, criado sozinho): 1 GB no plano gratuito, fora dos
//    500 MB do banco;
// 2. para o Vercel Blob (BLOB_READ_WRITE_TOKEN, ou BLOB_STORE_ID + OIDC);
// 3. sem nenhum dos dois, para o próprio Postgres.
// São servidas por GET /pro-labore/imagens/:chave com uma chave longa e
// aleatória (a tag <img> não manda o login); o endereço do arquivo nunca sai
// da API. No banco, blobAcesso diz onde está: supabase | private | public.
import crypto from 'crypto'
import { get, put } from '@vercel/blob'
import { prisma } from './prisma'
import { logger } from './logger'

export const tokenBlob = () => process.env.BLOB_READ_WRITE_TOKEN?.trim() || null
// Blob ligado ao projeto: pela chave antiga (BLOB_READ_WRITE_TOKEN) ou pelo jeito novo da Vercel
// (BLOB_STORE_ID + a credencial OIDC que a própria Vercel injeta em cada chamada).
export const vercelBlobConfigurado = () => !!(tokenBlob() || process.env.BLOB_STORE_ID?.trim())
const credencial = () => (tokenBlob() ? { token: tokenBlob()! } : {})
const EXTENSAO: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

// --- Supabase Storage (API REST, sem dependência nova) ---
const BUCKET = 'aries-arquivos'
const supabase = () => {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, ''), chave = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  return url && chave ? { url, chave } : null
}
export const supabaseConfigurado = () => !!supabase()
/** Algum armazenamento de arquivos fora do banco. */
export const blobConfigurado = () => supabaseConfigurado() || vercelBlobConfigurado()
// Chave nova (sb_secret_...) vai só no apikey; a antiga (JWT service_role) vai também como Bearer.
const cabecalhos = (chave: string) => ({ apikey: chave, ...(chave.startsWith('sb_') ? {} : { Authorization: `Bearer ${chave}` }) })
const caminhoSeguro = (c: string) => c.split('/').map(encodeURIComponent).join('/')
let bucketPronto = false

async function criarBucket(s: { url: string; chave: string }) {
  const r = await fetch(`${s.url}/storage/v1/bucket`, { method: 'POST', headers: { ...cabecalhos(s.chave), 'Content-Type': 'application/json' }, body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }) })
  if (!r.ok && r.status !== 409 && !/already exists|Duplicate/i.test(await r.text().catch(() => ''))) throw new Error(`Supabase: não deu para criar o bucket (${r.status})`)
  bucketPronto = true
}

async function gravarNoSupabase(caminho: string, mime: string, dados: Buffer): Promise<string> {
  const s = supabase()!
  const enviar = () => fetch(`${s.url}/storage/v1/object/${BUCKET}/${caminhoSeguro(caminho)}`, { method: 'POST', headers: { ...cabecalhos(s.chave), 'Content-Type': mime, 'x-upsert': 'true' }, body: new Uint8Array(dados) })
  if (!bucketPronto) await criarBucket(s)
  let r = await enviar()
  if (r.status === 404 || r.status === 400) {
    const texto = await r.text().catch(() => '')
    if (/bucket/i.test(texto)) { await criarBucket(s); r = await enviar() } else throw new Error(`Supabase recusou o arquivo (${r.status}): ${texto.slice(0, 150)}`)
  }
  if (!r.ok) throw new Error(`Supabase recusou o arquivo (${r.status}): ${(await r.text().catch(() => '')).slice(0, 150)}`)
  return `supabase://${BUCKET}/${caminho}`
}

async function lerDoSupabase(endereco: string): Promise<Buffer | null> {
  const s = supabase()
  if (!s) return null
  const caminho = endereco.replace(/^supabase:\/\//, '')
  const r = await fetch(`${s.url}/storage/v1/object/${caminhoSeguro(caminho)}`, { headers: cabecalhos(s.chave) })
  return r.ok ? Buffer.from(await r.arrayBuffer()) : null
}

/** A última recusa do armazenamento (para explicar na tela o que falta). */
export let ultimoErroBlob: string | null = null

export type Guardado = { blobUrl: string; blobAcesso: 'supabase' | 'private' | 'public' }

/** Grava fora do banco; null = sem armazenamento configurado ou recusado (o arquivo fica no banco). */
export async function gravarNoBlob(caminho: string, mime: string, dados: Buffer, opcoes: { soSupabase?: boolean } = {}): Promise<Guardado | null> {
  if (supabaseConfigurado()) {
    try {
      return { blobUrl: await gravarNoSupabase(`${caminho.replace(/\.[a-z0-9]+$/, '')}-${crypto.randomBytes(6).toString('hex')}${caminho.match(/\.[a-z0-9]+$/)?.[0] ?? ''}`, mime, dados), blobAcesso: 'supabase' }
    } catch (e) {
      ultimoErroBlob = e instanceof Error ? e.message.slice(0, 200) : String(e)
      logger.warn({ err: e }, 'armazenamento: o Supabase recusou o arquivo')
      if (opcoes.soSupabase) return null
    }
  }
  if (opcoes.soSupabase || !vercelBlobConfigurado()) return null
  for (const acesso of ['private', 'public'] as const) {
    try {
      const r = await put(caminho, dados, { access: acesso, ...credencial(), contentType: mime, addRandomSuffix: true })
      return { blobUrl: r.url, blobAcesso: acesso }
    } catch (e) {
      ultimoErroBlob = e instanceof Error ? e.message.slice(0, 200) : String(e)
      logger.warn({ err: e, acesso }, 'armazenamento: o Blob recusou o arquivo')
    }
  }
  return null
}

/** Lê de onde o arquivo estiver (Supabase, Blob privado com credencial, Blob público direto). */
export async function lerDoBlob(blobUrl: string, blobAcesso: string | null): Promise<Buffer | null> {
  if (blobAcesso === 'supabase' || blobUrl.startsWith('supabase://')) return lerDoSupabase(blobUrl)
  if (blobAcesso === 'private') {
    const r = await get(blobUrl, { access: 'private', ...credencial() })
    if (!r || r.statusCode !== 200) return null
    return Buffer.from(await new Response(r.stream).arrayBuffer())
  }
  const r = await fetch(blobUrl)
  return r.ok ? Buffer.from(await r.arrayBuffer()) : null
}

/** Grava uma imagem já validada e devolve a chave. */
export async function criarImagem(usuarioId: string, mime: string, dados: Buffer): Promise<string> {
  const chave = crypto.randomBytes(18).toString('base64url')
  const blob = await gravarNoBlob(`imagens/${usuarioId}/${chave}.${EXTENSAO[mime] ?? 'bin'}`, mime, dados)
  await prisma.imagemUpload.create({ data: { chave, usuarioId, mime, tamanho: dados.length, ...(blob ?? { dados }) } })
  return chave
}

/** O arquivo de uma imagem pela chave, onde quer que esteja. */
export async function imagemPorChave(chave: string): Promise<{ mime: string; dados: Buffer } | null> {
  const img = await prisma.imagemUpload.findUnique({ where: { chave }, select: { mime: true, dados: true, blobUrl: true, blobAcesso: true } })
  if (!img) return null
  if (img.dados) return { mime: img.mime, dados: Buffer.from(img.dados) }
  if (!img.blobUrl) return null
  const dados = await lerDoBlob(img.blobUrl, img.blobAcesso).catch(() => null)
  return dados ? { mime: img.mime, dados } : null
}

// Tipo pelo conteúdo, não pelo que a origem diz. SVG fica de fora de
// propósito: aberto direto no endereço da API, poderia rodar script.
export function tipoPelaAssinatura(b: Buffer): string | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (b.length > 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  if (b.length > 6 && /^GIF8[79]a$/.test(b.subarray(0, 6).toString('ascii'))) return 'image/gif'
  return null
}

// Guarda uma imagem e devolve o caminho público (relativo à API), ou null
// se o conteúdo não for uma imagem aceita.
export async function guardarImagem(usuarioId: string, dados: Buffer): Promise<string | null> {
  const mime = tipoPelaAssinatura(dados)
  if (!mime) return null
  return `/pro-labore/imagens/${await criarImagem(usuarioId, mime, dados)}`
}

// Lê de volta uma imagem guardada (para mandar no WhatsApp, por exemplo).
const CAMINHO_IMAGEM = /^\/pro-labore\/imagens\/([A-Za-z0-9_-]{20,40})$/
export function chaveDaImagem(caminho: string): string | null {
  return caminho.match(CAMINHO_IMAGEM)?.[1] ?? null
}
export async function lerImagem(caminho: string): Promise<{ mime: string; dados: Buffer } | null> {
  const chave = chaveDaImagem(caminho)
  if (!chave) return null
  return imagemPorChave(chave)
}

// Baixa uma imagem de uma URL (com prazo e limite de tamanho) e guarda.
const MAX_MINIATURA = 1.5 * 1024 * 1024
export async function baixarEGuardarImagem(usuarioId: string, url: string, prazoMs = 6000): Promise<string | null> {
  const controle = new AbortController()
  const timer = setTimeout(() => controle.abort(), prazoMs)
  try {
    const res = await fetch(url, { signal: controle.signal })
    if (!res.ok) return null
    const dados = Buffer.from(await res.arrayBuffer())
    if (!dados.length || dados.length > MAX_MINIATURA) return null
    return await guardarImagem(usuarioId, dados)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// --- Arquivos de sistema (cópia de segurança): caminho exato, só no Supabase ---

export async function gravarArquivoSistema(caminho: string, mime: string, dados: Buffer) {
  if (!supabaseConfigurado()) throw new Error('O armazenamento do Supabase não está configurado (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY)')
  return gravarNoSupabase(caminho, mime, dados)
}
export async function lerArquivoSistema(endereco: string) {
  return lerDoSupabase(endereco)
}
/** Link temporário (assinado) para baixar um arquivo privado sem a chave. */
export async function linkTemporario(endereco: string, segundos: number): Promise<string> {
  const s = supabase()
  if (!s) throw new Error('O armazenamento do Supabase não está configurado')
  const caminho = endereco.replace(/^supabase:\/\//, '')
  const r = await fetch(`${s.url}/storage/v1/object/sign/${caminhoSeguro(caminho)}`, { method: 'POST', headers: { ...cabecalhos(s.chave), 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: segundos }) })
  if (!r.ok) throw new Error(`Supabase recusou o link (${r.status})`)
  const j = (await r.json()) as { signedURL?: string; signedUrl?: string }
  const rel = j.signedURL ?? j.signedUrl
  if (!rel) throw new Error('Supabase não devolveu o link')
  return /^https?:/.test(rel) ? rel : `${s.url}/storage/v1${rel.startsWith('/') ? '' : '/'}${rel}`
}
