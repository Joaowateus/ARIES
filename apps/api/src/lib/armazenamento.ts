// Armazenamento de arquivos do Pró-Labore. Hoje as imagens ficam no próprio
// Postgres (ImagemUpload) e são servidas por GET /pro-labore/imagens/:chave
// com uma chave longa e aleatória (a tag <img> não manda o login). Vídeos,
// que não cabem no banco, vão usar um armazenamento de objetos (Fase 1+).
import crypto from 'crypto'
import { prisma } from './prisma'

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
  const chave = crypto.randomBytes(18).toString('base64url')
  await prisma.imagemUpload.create({ data: { chave, usuarioId, mime, dados, tamanho: dados.length } })
  return `/pro-labore/imagens/${chave}`
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
