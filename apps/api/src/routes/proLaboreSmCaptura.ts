// Tela 12 · Celular (seção 11.5): captura na loja e aprovação do gestor.
// - Captura: a pauta em gravação com a tomada atual (instrução, formato e
//   duração máxima) e o checklist das tomadas. Foto vai para o armazenamento
//   próprio; vídeo sobe direto do celular para o Vercel Blob (decisão P8) ou
//   entra por link. Com todas as tomadas, a pauta vai para Edição.
// - Aprovação: a fila "Para aprovar" com o horário de publicação, a prévia e
//   os metadados. Aprovar e pedir ajuste usam as rotas da Produção.
import express, { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { contextoSM, requireGestorSM, requireModuloSM } from '../lib/smAcesso'
import { guardarImagem, tipoPelaAssinatura } from '../lib/armazenamento'
import { pendenciasParaPublicar } from '../lib/smPautas'
import { dentroDaJanela, melhoresJanelas } from '../lib/smJanelas'
import { garantirLinkDaPauta } from '../lib/smAtribuicao'
import { STATUS_CAPTURA, avancarPelaCaptura, enderecoDoBlob, situacaoDasTomadas, tipoDaMidia, tokenDeEnvio, videoPeloApp } from '../lib/smCaptura'

const router = Router()
const autenticado = [requireProLaboreAuth, contextoSM]
const MAX_FOTO = 4 * 1024 * 1024
const erro = (res: Response, status: number, mensagem: string, extra?: Record<string, unknown>) => res.status(status).json({ error: mensagem, ...extra })

const SELECT_CAPTURA = {
  id: true, titulo: true, pilar: true, formato: true, status: true, origem: true, prazo: true, agendadoPara: true, autorizacaoImagem: true,
  gancho: true, retencao: true, recompensa: true, cta: true,
  moto: { select: { id: true, modelo: true, ano: true, cor: true } },
  midias: { select: { id: true, tipo: true, url: true, tomada: true, criadoEm: true }, orderBy: [{ ordem: 'asc' as const }, { criadoEm: 'asc' as const }] },
}

async function pautaDaCaptura(usuarioId: string, id: string) {
  return prisma.smPauta.findFirst({ where: { id, usuarioId }, select: SELECT_CAPTURA })
}
type PautaCaptura = NonNullable<Awaited<ReturnType<typeof pautaDaCaptura>>>

function detalhe(p: PautaCaptura, podeEnviar: boolean) {
  const { midias, gancho: _g, retencao: _r, recompensa: _c, ...pauta } = p
  const tomadas = situacaoDasTomadas(p, midias)
  return {
    pauta,
    tomadas,
    enviadas: tomadas.filter(t => t.situacao === 'ENVIADA').length,
    podeEnviar: podeEnviar && (STATUS_CAPTURA as readonly string[]).includes(p.status),
    videoPeloApp: videoPeloApp(),
  }
}

const podeEnviar = (req: Request) => !req.sm!.somenteLeitura && req.sm!.pode('producao', 'COMPLETO')

// ---------- Captura ----------

router.get('/sm/captura', ...autenticado, requireModuloSM('producao', 'LEITURA'), async (req: Request, res: Response) => {
  const pautas = await prisma.smPauta.findMany({
    where: { usuarioId: req.sm!.usuarioId, status: 'GRAVACAO' },
    select: SELECT_CAPTURA, orderBy: [{ prazo: { sort: 'asc', nulls: 'last' } }, { agendadoPara: { sort: 'asc', nulls: 'last' } }, { ordem: 'asc' }],
  })
  res.json(pautas.map(p => {
    const d = detalhe(p, podeEnviar(req))
    return { ...d.pauta, total: d.tomadas.length, enviadas: d.enviadas, proxima: d.tomadas.find(t => t.situacao === 'AGORA')?.nome ?? null }
  }))
})

router.get('/sm/captura/:id', ...autenticado, requireModuloSM('producao', 'LEITURA'), async (req: Request, res: Response) => {
  const p = await pautaDaCaptura(req.sm!.usuarioId, String(req.params.id))
  if (!p) return erro(res, 404, 'Pauta não encontrada')
  res.json(detalhe(p, podeEnviar(req)))
})

/** Pauta e tomada válidas para receber arquivo. */
async function alvo(req: Request, res: Response) {
  const p = await pautaDaCaptura(req.sm!.usuarioId, String(req.params.id))
  if (!p) { erro(res, 404, 'Pauta não encontrada'); return null }
  if (!(STATUS_CAPTURA as readonly string[]).includes(p.status)) { erro(res, 409, 'A pauta já passou da edição: não recebe mais tomadas'); return null }
  const n = Number(req.params.n)
  const tomada = situacaoDasTomadas(p, p.midias).find(t => t.n === n)
  if (!tomada) { erro(res, 404, 'Tomada não encontrada'); return null }
  return { p, tomada }
}

/** Guarda o arquivo da tomada (substitui o anterior), avança a pauta e responde. */
async function registrar(req: Request, res: Response, p: PautaCaptura, n: number, tipo: string, url: string) {
  const anterior = p.midias.find(m => m.tomada === n)
  await prisma.$transaction([
    ...(anterior ? [prisma.smPautaMidia.delete({ where: { id: anterior.id } })] : []),
    prisma.smPautaMidia.create({ data: { pautaId: p.id, tipo, url, tomada: n, ordem: n } }),
  ])
  const avancou = await avancarPelaCaptura(p.id)
  const atual = await pautaDaCaptura(req.sm!.usuarioId, p.id)
  res.status(201).json({ ...detalhe(atual!, podeEnviar(req)), avancou })
}

router.post('/sm/captura/:id/tomadas/:n/foto', ...autenticado, requireModuloSM('producao', 'COMPLETO'),
  express.raw({ type: 'application/octet-stream', limit: MAX_FOTO }), async (req: Request, res: Response) => {
    const a = await alvo(req, res)
    if (!a) return
    if (a.tomada.arquivo !== 'FOTO') return erro(res, 400, 'Esta tomada é em vídeo')
    const dados = Buffer.isBuffer(req.body) ? req.body : null
    if (!dados?.length) return erro(res, 400, 'Arquivo vazio')
    if (dados.length > MAX_FOTO) return erro(res, 413, 'Foto acima de 4 MB')
    // Para publicar, a Meta só aceita JPEG (a câmera do celular já entrega assim).
    if (tipoPelaAssinatura(dados) !== 'image/jpeg') return erro(res, 400, 'Envie a foto em JPEG (a câmera do celular já salva assim)')
    const url = await guardarImagem(req.sm!.usuarioId, dados)
    if (!url) return erro(res, 400, 'Imagem inválida')
    await registrar(req, res, a.p, a.tomada.n, tipoDaMidia(a.p.formato, 'FOTO'), url)
  })

router.post('/sm/captura/:id/tomadas/:n/token', ...autenticado, requireModuloSM('producao', 'COMPLETO'), async (req: Request, res: Response) => {
  const a = await alvo(req, res)
  if (!a) return
  if (a.tomada.arquivo !== 'VIDEO') return erro(res, 400, 'Esta tomada é em foto')
  const extensao = typeof req.body?.extensao === 'string' ? req.body.extensao.toLowerCase() : 'mp4'
  const envio = await tokenDeEnvio(req.sm!.usuarioId, a.p.id, a.tomada.n, extensao)
  if (!envio) return erro(res, 409, 'O envio de vídeo pelo app ainda não foi configurado. Grave e cole o link do vídeo.', { codigo: 'SEM_ARMAZENAMENTO' })
  res.json(envio)
})

router.post('/sm/captura/:id/tomadas/:n/video', ...autenticado, requireModuloSM('producao', 'COMPLETO'), async (req: Request, res: Response) => {
  const parse = z.object({
    url: z.string().trim().url('Link inválido').max(1000).refine(u => u.startsWith('https://'), 'Use um link https'),
    origem: z.enum(['BLOB', 'LINK']),
  }).safeParse(req.body)
  if (!parse.success) return erro(res, 400, parse.error.issues[0].message)
  const a = await alvo(req, res)
  if (!a) return
  if (a.tomada.arquivo !== 'VIDEO') return erro(res, 400, 'Esta tomada é em foto')
  if (parse.data.origem === 'BLOB' && !enderecoDoBlob(parse.data.url, req.sm!.usuarioId, a.p.id)) return erro(res, 400, 'Endereço do vídeo inválido')
  await registrar(req, res, a.p, a.tomada.n, tipoDaMidia(a.p.formato, 'VIDEO'), parse.data.url)
})

router.delete('/sm/captura/:id/tomadas/:n', ...autenticado, requireModuloSM('producao', 'COMPLETO'), async (req: Request, res: Response) => {
  const a = await alvo(req, res)
  if (!a) return
  const m = a.p.midias.find(x => x.tomada === a.tomada.n)
  if (m) await prisma.smPautaMidia.delete({ where: { id: m.id } })
  const atual = await pautaDaCaptura(req.sm!.usuarioId, a.p.id)
  res.json(detalhe(atual!, podeEnviar(req)))
})

// ---------- Aprovação do gestor ----------

const FORMATO: Record<string, string> = { REELS: 'Reels', CARROSSEL: 'Carrossel', FOTO: 'Foto', STORY: 'Story' }

router.get('/sm/aprovar', ...autenticado, requireGestorSM, async (req: Request, res: Response) => {
  const usuarioId = req.sm!.usuarioId
  const [pautas, janelas] = await Promise.all([
    prisma.smPauta.findMany({
      where: { usuarioId, status: 'APROVACAO', aprovacao: 'PENDENTE' },
      include: {
        moto: { select: { id: true, modelo: true, ano: true, cor: true } },
        teste: { select: { variavel: true, status: true } },
        midias: { orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }] },
      },
      orderBy: [{ agendadoPara: { sort: 'asc', nulls: 'last' } }, { enviadaAprovacaoEm: 'asc' }],
    }),
    melhoresJanelas(usuarioId),
  ])
  const fila = await Promise.all(pautas.map(async p => {
    const publicaveis = p.midias.filter(m => m.tipo === 'IMAGEM' || m.tipo === 'VIDEO')
    const capa = p.midias.find(m => m.tipo === 'CAPA') ?? null
    const emTeste = p.teste?.status === 'ATIVO' && p.teste.variavel === 'HORARIO'
    return {
      id: p.id, titulo: p.titulo, pilar: p.pilar, formato: p.formato, formatoRotulo: FORMATO[p.formato] ?? p.formato,
      agendadoPara: p.agendadoPara, enviadaAprovacaoEm: p.enviadaAprovacaoEm, codigo: p.codigo, trial: p.trial,
      legenda: p.legenda, legendaCaracteres: p.legenda?.length ?? 0, moto: p.moto,
      linkSlug: await garantirLinkDaPauta(p),
      horario: emTeste ? 'TESTE' : p.agendadoPara && dentroDaJanela(p.agendadoPara, janelas) ? 'PICO' : null,
      previa: publicaveis.map(m => ({ id: m.id, tipo: m.tipo, url: m.url })), capa: capa && { url: capa.url },
      pendencias: pendenciasParaPublicar(p, p.midias),
    }
  }))
  res.json({ regraLigada: req.sm!.permissoes.regras.aprovacaoGestor, pautas: fila })
})

export default router
