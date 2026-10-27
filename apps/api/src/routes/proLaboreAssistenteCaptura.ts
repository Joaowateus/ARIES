// "WhatsApp fora do CRM": quem escreveu no WhatsApp do vendedor e não virou
// lead (contato antigo que não falou de compra). A lista mostra só nome,
// número e quando — o conteúdo não é guardado — e o vendedor decide: vira
// lead ou não é lead (não aparece mais).
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { aplicarCadenciasDoLeadNovo } from '../lib/ligacoes'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { requireModulo } from '../lib/acessos'
import { formatarTelefone } from '../lib/assistenteMotor'

const router = Router()
const ver = [requireProLaboreAuth, requireModulo('assistente', 'VER')]
const editar = [requireProLaboreAuth, requireModulo('assistente', 'EDITAR')]
const DIAS = 14

// Vendedor e supervisor: só o próprio WhatsApp. Gestão: todos (ou um, pelo filtro).
function filtroDoAssistente(req: Request, vendedorId?: unknown) {
  const { sub: usuarioId, papel, vendedorId: proprio } = req.proLaboreUser!
  const alvo = papel === 'VENDEDOR' || papel === 'SUPERVISOR' ? proprio : typeof vendedorId === 'string' && vendedorId ? vendedorId : undefined
  return { vendedor: { usuarioId, ...(alvo && { id: alvo }) } }
}

router.get('/assistente/fora-do-crm', ...ver, async (req: Request, res: Response) => {
  const desde = new Date(Date.now() - DIAS * 86_400_000)
  const itens = await prisma.assistenteContatoForaCrm.findMany({
    where: { ultimaEm: { gte: desde }, assistente: filtroDoAssistente(req, req.query.vendedorId) },
    include: { assistente: { select: { vendedor: { select: { id: true, nome: true } } } } },
    orderBy: { ultimaEm: 'desc' }, take: 100,
  })
  res.json({
    dias: DIAS,
    itens: itens.map(i => ({
      id: i.id, nome: i.nome, telefone: i.semTelefone ? null : formatarTelefone(i.numero), mensagens: i.mensagens, ultimaEm: i.ultimaEm,
      vendedor: i.assistente.vendedor,
    })),
  })
})

async function itemAutorizado(req: Request, res: Response) {
  const item = await prisma.assistenteContatoForaCrm.findFirst({
    where: { id: String(req.params.id), assistente: filtroDoAssistente(req) },
    include: { assistente: { select: { id: true, vendedorId: true, vendedor: { select: { nome: true, usuarioId: true } } } } },
  })
  if (!item) res.status(404).json({ error: 'Contato não encontrado' })
  return item
}

// Vira lead: entra no CRM (ou liga ao lead aberto do mesmo telefone) e a
// conversa passa a ser acompanhada, já com o vendedor.
router.post('/assistente/fora-do-crm/:id/lead', ...editar, async (req: Request, res: Response) => {
  const item = await itemAutorizado(req, res)
  if (!item) return
  const { assistente } = item
  const usuarioId = assistente.vendedor.usuarioId
  const existente = item.semTelefone ? [] : await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "pro_labore_leads"
    WHERE "usuarioId" = ${usuarioId} AND "estagio" NOT IN ('FECHADO', 'PERDIDO')
      AND right(regexp_replace(coalesce("telefone", ''), '\\D', '', 'g'), 8) = ${item.numero.slice(-8)}
    ORDER BY "criadoEm" DESC LIMIT 1`
  const nome = item.nome?.trim() && item.nome.trim().length >= 2 ? item.nome.trim().slice(0, 120) : item.semTelefone ? 'Contato do WhatsApp' : formatarTelefone(item.numero)
  const leadId = existente[0]?.id ?? (await prisma.$transaction(async tx => {
    const lead = await tx.lead.create({
      data: {
        usuarioId, vendedorId: assistente.vendedorId, nomeCliente: nome, telefone: item.semTelefone ? null : formatarTelefone(item.numero),
        origemCadastro: 'WHATSAPP', observacao: `Cadastrado pela lista "WhatsApp fora do CRM" por ${req.proLaboreUser!.nome}.`,
      },
    })
    await tx.leadEstagioHistorico.create({ data: { leadId: lead.id, estagioAnterior: null, estagioNovo: 'LEAD' } })
    await aplicarCadenciasDoLeadNovo(tx, lead)
    return lead.id
  }))
  const aberta = await prisma.assistenteConversa.findFirst({ where: { assistenteId: assistente.id, tipo: 'LEAD', numeroContato: item.numero, status: { in: ['ATIVA', 'AGUARDANDO_VENDEDOR', 'ASSUMIDA'] } }, select: { id: true } })
  if (aberta) await prisma.assistenteConversa.update({ where: { id: aberta.id }, data: { leadId } })
  else {
    await prisma.assistenteConversa.create({
      data: { assistenteId: assistente.id, tipo: 'LEAD', robo: false, status: 'ASSUMIDA', leadId, nomeContato: nome, numeroContato: item.numero, jid: item.jid, ultimaMensagemEm: item.ultimaEm },
    })
  }
  await prisma.assistenteContatoForaCrm.delete({ where: { id: item.id } })
  res.status(201).json({ leadId })
})

// Não é lead (amigo, família, fornecedor): sai da lista e não volta. Anúncio,
// frase de campanha ou conversa de compra ainda viram lead depois.
router.post('/assistente/fora-do-crm/:id/ignorar', ...editar, async (req: Request, res: Response) => {
  const item = await itemAutorizado(req, res)
  if (!item) return
  await prisma.$transaction([
    prisma.assistenteContatoIgnorado.upsert({
      where: { assistenteId_numero: { assistenteId: item.assistente.id, numero: item.numero } },
      update: {},
      create: { assistenteId: item.assistente.id, numero: item.numero, motivo: 'CONVERSA_PESSOAL' },
    }),
    prisma.assistenteContatoForaCrm.delete({ where: { id: item.id } }),
  ])
  res.json({ ok: true })
})

export default router
