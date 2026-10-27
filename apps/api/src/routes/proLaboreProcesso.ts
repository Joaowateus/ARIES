// Processo de atendimento (aba "Processo" do Assistente): links das redes,
// fluxo padrão, respostas prontas e regras da loja. A equipe inteira lê;
// só o dono muda. É guia para as pessoas: não vai para a IA.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { requireDono, requireProLaboreAuth } from '../middleware/authProLabore'

const router = Router()

const texto = (max: number) => z.string().trim().max(max)
const conteudoSchema = z.object({
  links: z.array(z.object({
    rotulo: texto(80).min(1, 'Dê um nome ao link'),
    url: texto(500).regex(/^https?:\/\/\S+$/i, 'Link inválido: comece com https://'),
  })).max(40, 'No máximo 40 links'),
  etapas: z.array(z.object({
    titulo: texto(120).min(1, 'Dê um nome à etapa'),
    descricao: texto(4000).default(''),
    prazo: texto(80).default(''),
  })).max(40, 'No máximo 40 etapas'),
  respostas: z.array(z.object({
    titulo: texto(120).min(1, 'Dê um nome à resposta'),
    texto: texto(4000).min(1, 'Escreva a resposta'),
    etapa: texto(120).default(''),
  })).max(150, 'No máximo 150 respostas'),
  regras: z.array(z.object({
    titulo: texto(120).min(1, 'Dê um nome à regra'),
    texto: texto(6000).default(''),
  })).max(40, 'No máximo 40 regras'),
})
export type ConteudoProcesso = z.infer<typeof conteudoSchema>
const VAZIO: ConteudoProcesso = { links: [], etapas: [], respostas: [], regras: [] }

router.get('/processo', requireProLaboreAuth, async (req: Request, res: Response) => {
  const p = await prisma.processoAtendimento.findUnique({ where: { usuarioId: req.proLaboreUser!.sub } })
  const lido = p ? conteudoSchema.safeParse(p.conteudo) : null
  res.json({
    conteudo: lido?.success ? lido.data : VAZIO,
    atualizadoEm: p?.atualizadoEm ?? null,
    atualizadoPor: p?.atualizadoPor ?? null,
    podeEditar: req.proLaboreUser!.papel === 'DONO',
  })
})

router.put('/processo', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const p = conteudoSchema.safeParse(req.body?.conteudo)
  if (!p.success) {
    const i = p.error.issues[0]
    res.status(400).json({ error: i.message, campo: i.path.join('.') })
    return
  }
  const usuarioId = req.proLaboreUser!.sub
  const dados = { conteudo: p.data as unknown as Prisma.InputJsonValue, atualizadoPor: req.proLaboreUser!.nome ?? null }
  const salvo = await prisma.processoAtendimento.upsert({ where: { usuarioId }, update: dados, create: { usuarioId, ...dados } })
  res.json({ conteudo: p.data, atualizadoEm: salvo.atualizadoEm, atualizadoPor: salvo.atualizadoPor, podeEditar: true })
})

export default router
