// Áudio e foto de uma mensagem do WhatsApp, para ouvir/ver na conversa. Só
// com login e no mesmo escopo da conversa (o vendedor, só as dele; o dono,
// todas). A tela busca com o token e monta o arquivo no navegador.
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { requireModulo } from '../lib/acessos'
import { arquivoDaMidia } from '../lib/assistenteMidia'

const router = Router()

router.get('/assistente/midias/:mensagemId', requireProLaboreAuth, requireModulo('assistente', 'VER'), async (req: Request, res: Response) => {
  const mensagemId = String(req.params.mensagemId)
  const msg = await prisma.assistenteMensagem.findUnique({
    where: { id: mensagemId },
    select: { conversa: { select: { assistente: { select: { vendedorId: true, vendedor: { select: { usuarioId: true } } } } } } },
  })
  const { sub: usuarioId, papel, vendedorId } = req.proLaboreUser!
  const assistente = msg?.conversa.assistente
  if (!assistente || assistente.vendedor.usuarioId !== usuarioId || ((papel === 'VENDEDOR' || papel === 'SUPERVISOR') && assistente.vendedorId !== vendedorId)) {
    res.status(404).json({ error: 'Mídia não encontrada' })
    return
  }
  const arquivo = await arquivoDaMidia(mensagemId)
  if (!arquivo) { res.status(404).json({ error: 'Esta mensagem não tem áudio nem foto.' }); return }
  if (arquivo.status !== 'OK') {
    res.status(arquivo.status === 'PENDENTE' ? 503 : 410).json({
      error: arquivo.status === 'PENDENTE' ? 'O arquivo ainda não chegou do WhatsApp. Tente de novo em instantes.' : 'O WhatsApp não tem mais esse arquivo.',
      status: arquivo.status,
    })
    return
  }
  res.setHeader('Content-Type', arquivo.mime)
  res.setHeader('Content-Length', String(arquivo.dados.length))
  res.setHeader('Cache-Control', 'private, max-age=86400')
  res.send(arquivo.dados)
})

export default router
