// Selos do menu lateral numa chamada só (antes eram quatro, a cada 45 s, por
// pessoa logada): apresentação ao vivo, pedidos de reunião (dono), follows do
// dia (quem tem o CRM) e avisos do Instagram ainda não lidos (dono).
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { nivelAtende } from '../lib/acessos'
import { leadWhereBase } from '../lib/escopoLead'
import { SINAL_APRESENTADOR_MS } from '../lib/apresentacaoTransmissao'

const router = Router()
const DIA = 864e5
const OFFSET_BR = 3 * 3600e3

router.get('/barra-lateral', requireProLaboreAuth, async (req: Request, res: Response) => {
  const u = req.proLaboreUser!
  const dono = u.papel === 'DONO'
  const veCrm = dono || nivelAtende(req.acessos?.crm, 'VER')
  const agora = Date.now()
  const hoje = new Date(Math.floor((agora - OFFSET_BR) / DIA) * DIA + OFFSET_BR), amanha = new Date(hoje.getTime() + DIA)
  const lead = veCrm ? leadWhereBase(req) : null
  // Ligações da própria pessoa (o dono: as dos leads sem vendedor) que já chegaram na hora: aviso na tela.
  const minhas = lead ? { status: 'PENDENTE', vendedorId: dono ? null : u.vendedorId ?? '-', agendadaPara: { lte: new Date(agora + 60e3), gte: new Date(agora - 12 * 3600e3) }, lead } : null
  const [aoVivo, pedidosReuniao, atrasados, deHoje, avisos, ligAtrasadas, ligHoje, ligAgora] = await Promise.all([
    prisma.apresentacao.count({ where: { usuarioId: u.sub, aoVivo: true, aprovacao: 'APROVADA', apresentadorSinalEm: { gte: new Date(agora - SINAL_APRESENTADOR_MS) } } }),
    dono ? prisma.apresentacao.count({ where: { usuarioId: u.sub, aprovacao: 'PENDENTE' } }) : 0,
    lead ? prisma.leadFollow.count({ where: { status: 'PENDENTE', agendadoPara: { lt: hoje }, lead } }) : 0,
    lead ? prisma.leadFollow.count({ where: { status: 'PENDENTE', agendadoPara: { gte: hoje, lt: amanha }, lead } }) : 0,
    dono ? prisma.smNotificacao.findMany({ where: { usuarioId: u.sub, destinatario: 'GESTOR', lidaEm: null }, orderBy: { atualizadoEm: 'desc' }, take: 20, select: { titulo: true } }) : [],
    // Ligações: já passou da hora / ainda hoje.
    lead ? prisma.ligacaoTarefa.count({ where: { status: 'PENDENTE', agendadaPara: { lt: new Date(agora) }, lead } }) : 0,
    lead ? prisma.ligacaoTarefa.count({ where: { status: 'PENDENTE', agendadaPara: { gte: new Date(agora), lt: amanha }, lead } }) : 0,
    minhas ? prisma.ligacaoTarefa.findMany({
      where: minhas, orderBy: { agendadaPara: 'asc' }, take: 5,
      select: { id: true, agendadaPara: true, passo: true, totalPassos: true, instrucao: true, discadaEm: true, discagens: true, status: true, lead: { select: { id: true, nomeCliente: true, telefone: true } } },
    }) : [],
  ])
  res.json({ aoVivo, pedidosReuniao, follows: lead ? { atrasados, hoje: deHoje } : null, ligacoes: lead ? { atrasadas: ligAtrasadas, hoje: ligHoje, agora: ligAgora } : null, avisosSocial: avisos.map(a => a.titulo) })
})

export default router
