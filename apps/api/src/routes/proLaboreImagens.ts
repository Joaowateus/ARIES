// Imagens dos mapas mentais: o navegador manda o arquivo original (só reduz
// quando passa do limite) como binário puro — sem base64, que aumenta 33% e
// esbarra no limite do JSON. Aceita ainda o formato antigo (data URL). Aqui confere o tipo pelo conteúdo (não pelo que o cliente diz), guarda e
// devolve um endereço público com chave aleatória — a tag <img> não envia
// o token de login, então a chave longa é o que protege.
import express, { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'

const router = Router()
// A Vercel recusa requisições acima de 4,5 MB; o site manda no máximo 3,5 MB.
const MAX_BYTES = 4 * 1024 * 1024

function tipoPelaAssinatura(b: Buffer): string | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (b.length > 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  if (b.length > 6 && /^GIF8[79]a$/.test(b.subarray(0, 6).toString('ascii'))) return 'image/gif'
  return null
}

router.post('/imagens', requireProLaboreAuth, express.raw({ type: 'application/octet-stream', limit: MAX_BYTES }), async (req: Request, res: Response) => {
  let dados: Buffer | null = null
  if (Buffer.isBuffer(req.body)) dados = req.body
  else {
    const parse = z.object({ dataUrl: z.string().max(1_100_000) }).safeParse(req.body)
    const m = parse.success ? parse.data.dataUrl.match(/^data:image\/[a-z+]+;base64,([A-Za-z0-9+/=]+)$/) : null
    if (m) dados = Buffer.from(m[1], 'base64')
  }
  if (!dados || !dados.length) {
    res.status(400).json({ error: 'Imagem inválida' })
    return
  }
  if (dados.length > MAX_BYTES) {
    res.status(413).json({ error: 'Imagem grande demais (máx. 4 MB)' })
    return
  }
  const mime = tipoPelaAssinatura(dados)
  if (!mime) {
    res.status(400).json({ error: 'Formato não aceito — use JPG, PNG, WebP ou GIF' })
    return
  }
  const chave = crypto.randomBytes(18).toString('base64url')
  await prisma.imagemUpload.create({ data: { chave, usuarioId: req.proLaboreUser!.sub, mime, dados, tamanho: dados.length } })
  res.status(201).json({ caminho: `/pro-labore/imagens/${chave}` })
})

router.get('/imagens/:chave', async (req: Request, res: Response) => {
  const chave = String(req.params.chave)
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(chave)) {
    res.status(404).end()
    return
  }
  const img = await prisma.imagemUpload.findUnique({ where: { chave }, select: { mime: true, dados: true } })
  if (!img) {
    res.status(404).end()
    return
  }
  // O site e a API ficam em domínios diferentes: libera o uso em <img>.
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  res.setHeader('Content-Type', img.mime)
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  res.send(Buffer.from(img.dados))
})

export default router
