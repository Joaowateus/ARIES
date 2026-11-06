// Atividades da jornada (PDF 01, seções 4 e 5): proposta, visita (check-in,
// falta e remarcação), passagem do SDR para o vendedor, devolução e
// rodízio. Até a Atividade (ATV) do PDF 02 existir, as atividades
// obrigatórias usam o follow atual (tipo JORNADA), que já aparece no Meu dia.
import { prisma } from './prisma'
import { autorAtual, comAutor } from './autorAuditoria'
import { ErroJornada, moverEtapa, registrarPerda } from './jornadaRegras'
import type { Etapa } from './etapasJornada'

type LeadBase = { id: string; usuarioId: string; etapa: string | null; estagio: string; vendaId: string | null; modeloInteresse: string | null; formaPagamento: string | null; situacaoCnh: string | null; temEntrada: boolean | null; responsavelQualificacaoId: string | null; responsavelFechamentoId: string | null; vendedorId: string | null }
export type AtividadeJornada = 'PRIMEIRO_CONTATO' | 'FOLLOW_PROPOSTA' | 'CONFIRMAR_VISITA' | 'VISITA' | 'REMARCAR_VISITA' | 'RESULTADO_VISITA'
const TITULO: Record<AtividadeJornada, string> = {
  PRIMEIRO_CONTATO: 'Primeiro contato', FOLLOW_PROPOSTA: 'Follow da proposta', CONFIRMAR_VISITA: 'Confirmar visita',
  VISITA: 'Visita', REMARCAR_VISITA: 'Remarcar visita', RESULTADO_VISITA: 'Registrar resultado da visita',
}
const HORA = 3_600_000, DIA = 24 * HORA

/** Cria a atividade obrigatória (fecha a pendente do mesmo tipo, se houver). */
export async function criarAtividade(l: LeadBase, atividade: AtividadeJornada, quando: Date, nota?: string, vendedorId?: string | null) {
  await prisma.leadFollow.updateMany({ where: { leadId: l.id, tipo: 'JORNADA', status: 'PENDENTE', contexto: { path: ['atividade'], equals: atividade } }, data: { status: 'CANCELADO', resultado: 'Substituída' } })
  return prisma.leadFollow.create({
    data: {
      usuarioId: l.usuarioId, leadId: l.id, vendedorId: vendedorId ?? l.vendedorId, agendadoPara: quando, tipo: 'JORNADA',
      canal: atividade.includes('VISITA') ? 'VISITA' : 'WHATSAPP', nota: nota ? `${TITULO[atividade]}: ${nota}` : TITULO[atividade],
      contexto: { atividade }, criadoPor: autorAtual().id ?? null,
    },
  })
}
async function concluirAtividade(leadId: string, atividade: AtividadeJornada, resultado: string) {
  await prisma.leadFollow.updateMany({ where: { leadId, tipo: 'JORNADA', status: 'PENDENTE', contexto: { path: ['atividade'], equals: atividade } }, data: { status: 'FEITO', feitoEm: new Date(), resultado } })
}

// --- Proposta ---

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
/** Mensagem da proposta montada pelo sistema (sem IA); o vendedor aprova antes de enviar. */
export function mensagemDaProposta(nome: string, modelo: string | null, p: { preco: number; entrada?: number | null; parcela?: number | null; prazo?: number | null; validade?: Date | null }) {
  const linhas = [`Olá, ${nome.split(' ')[0]}! Segue a proposta${modelo ? ` da ${modelo}` : ''}:`, `• Valor: ${brl(p.preco)}`]
  if (p.entrada != null) linhas.push(`• Entrada: ${brl(p.entrada)}`)
  if (p.parcela != null) linhas.push(`• Parcela: ${brl(p.parcela)}${p.prazo ? ` em ${p.prazo}x` : ''}`)
  if (p.validade) linhas.push(`• Válida até ${p.validade.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`)
  linhas.push('Que tal passar aqui na loja para ver a moto de perto? Me diga o melhor dia e horário.')
  return linhas.join('\n')
}

export async function registrarProposta(l: LeadBase & { nomeCliente: string }, p: { preco: number; entrada?: number | null; parcela?: number | null; prazo?: number | null; validade?: Date | null; followEm?: Date | null }) {
  if (!['NEGOCIACAO', 'PROPOSTA'].includes(l.etapa ?? '')) throw new ErroJornada(409, 'A proposta é registrada na Negociação (ou para atualizar na Proposta)')
  const proposta = await prisma.leadProposta.create({ data: { usuarioId: l.usuarioId, leadId: l.id, preco: p.preco, entrada: p.entrada ?? null, parcela: p.parcela ?? null, prazo: p.prazo ?? null, validade: p.validade ?? null, autorId: autorAtual().id ?? null } })
  if (l.etapa === 'NEGOCIACAO') await moverEtapa(l, 'PROPOSTA')
  await criarAtividade(l, 'FOLLOW_PROPOSTA', p.followEm ?? new Date(Date.now() + DIA))
  return { proposta, mensagem: mensagemDaProposta(l.nomeCliente, l.modeloInteresse, p) }
}
/** O vendedor aprovou e enviou a proposta (pelo WhatsApp). */
export async function propostaEnviada(propostaId: string, usuarioId: string) {
  const r = await prisma.leadProposta.updateMany({ where: { id: propostaId, usuarioId, enviadaEm: null }, data: { enviadaEm: new Date() } })
  if (!r.count) throw new ErroJornada(404, 'Proposta não encontrada ou já enviada')
}
export async function respostaDaProposta(propostaId: string, usuarioId: string, resultado: 'ACEITA' | 'RECUSADA' | 'SEM_RESPOSTA') {
  const r = await prisma.leadProposta.updateMany({ where: { id: propostaId, usuarioId }, data: { resultado, respondidaEm: new Date() } })
  if (!r.count) throw new ErroJornada(404, 'Proposta não encontrada')
}

// --- Visita ---

export async function marcarVisita(l: LeadBase, marcadaPara: Date) {
  if (!['PROPOSTA', 'AGENDAMENTO'].includes(l.etapa ?? '')) throw new ErroJornada(409, 'A visita é marcada a partir da Proposta')
  if (marcadaPara.getTime() < Date.now() - HORA) throw new ErroJornada(400, 'A data da visita já passou')
  const aberta = await prisma.leadVisita.findFirst({ where: { leadId: l.id, checkinEm: null, falta: false }, orderBy: { criadoEm: 'desc' } })
  const faltas = await prisma.leadVisita.count({ where: { leadId: l.id, falta: true } })
  const visita = aberta
    ? await prisma.leadVisita.update({ where: { id: aberta.id }, data: { marcadaPara, remarcacoes: { increment: 1 } } })
    : await prisma.leadVisita.create({ data: { usuarioId: l.usuarioId, leadId: l.id, vendedorId: l.vendedorId, marcadaPara, remarcacoes: faltas } })
  if (l.etapa === 'PROPOSTA') await moverEtapa(l, 'AGENDAMENTO')
  await concluirAtividade(l.id, 'REMARCAR_VISITA', 'Visita remarcada')
  await concluirAtividade(l.id, 'FOLLOW_PROPOSTA', 'Visita marcada')
  await criarAtividade(l, 'VISITA', marcadaPara)
  const vespera = new Date(marcadaPara.getTime() - DIA)
  await criarAtividade(l, 'CONFIRMAR_VISITA', vespera.getTime() > Date.now() ? vespera : new Date())
  return visita
}

export async function checkin(l: LeadBase) {
  const v = await prisma.leadVisita.findFirst({ where: { leadId: l.id, checkinEm: null, falta: false }, orderBy: { marcadaPara: 'desc' } })
  if (!v) throw new ErroJornada(409, 'Não há visita marcada para registrar o check-in')
  const agora = new Date()
  await prisma.leadVisita.update({ where: { id: v.id }, data: { checkinEm: agora } })
  await concluirAtividade(l.id, 'VISITA', 'Cliente chegou')
  await concluirAtividade(l.id, 'CONFIRMAR_VISITA', 'Cliente chegou')
  if (l.etapa === 'AGENDAMENTO') await moverEtapa(l, 'VISITA')
  // "Registrar resultado da visita" no mesmo dia.
  // Fim do dia em Brasília (23:59, UTC-3).
  const hojeBR = new Date(agora.getTime() - 3 * HORA).toISOString().slice(0, 10)
  const fimDoDia = new Date(`${hojeBR}T23:59:00-03:00`)
  await criarAtividade(l, 'RESULTADO_VISITA', fimDoDia.getTime() > agora.getTime() ? fimDoDia : agora)
  return agora
}

export async function resultadoDaVisita(l: LeadBase, resultado: string) {
  const v = await prisma.leadVisita.findFirst({ where: { leadId: l.id, checkinEm: { not: null } }, orderBy: { checkinEm: 'desc' } })
  if (!v) throw new ErroJornada(409, 'Registre o check-in antes do resultado')
  await prisma.leadVisita.update({ where: { id: v.id }, data: { resultado, resultadoEm: new Date() } })
  await concluirAtividade(l.id, 'RESULTADO_VISITA', resultado.slice(0, 200))
}

/** Falta: gera a remarcação; passado o limite de faltas, o lead é perdido. */
export async function registrarFalta(l: LeadBase) {
  const v = await prisma.leadVisita.findFirst({ where: { leadId: l.id, checkinEm: null, falta: false }, orderBy: { marcadaPara: 'desc' } })
  if (!v) throw new ErroJornada(409, 'Não há visita marcada')
  await prisma.leadVisita.update({ where: { id: v.id }, data: { falta: true } })
  await concluirAtividade(l.id, 'VISITA', 'Cliente faltou')
  await concluirAtividade(l.id, 'CONFIRMAR_VISITA', 'Cliente faltou')
  const [faltas, p] = await Promise.all([
    prisma.leadVisita.count({ where: { leadId: l.id, falta: true } }),
    prisma.parametroLiquidez.findUnique({ where: { usuarioId: l.usuarioId }, select: { jornadaFaltasAtePerda: true } }),
  ])
  const limite = p?.jornadaFaltasAtePerda ?? 2
  if (faltas >= limite) {
    await comAutor({ origem: 'AUTOMACAO' }, () => registrarPerda(l, 'FALTOU_NAO_REMARCOU', `${faltas} faltas sem remarcar`))
    return { faltas, perdido: true }
  }
  await criarAtividade(l, 'REMARCAR_VISITA', new Date())
  return { faltas, perdido: false }
}

// --- Rodízio ---

/** Próxima pessoa do rodízio para o papel (disponível, ativa, há mais tempo sem receber). */
export async function proximoDoRodizio(usuarioId: string, papel: 'SDR' | 'VENDEDOR') {
  const ativos = await prisma.vendedor.findMany({ where: { usuarioId, ativo: true, vende: true, ...(papel === 'SDR' ? { papel: 'SDR' } : { papel: { not: 'SDR' } }) }, select: { id: true } })
  if (!ativos.length) return null
  const fila = await prisma.rodizioLead.findMany({ where: { usuarioId, papel, vendedorId: { in: ativos.map(a => a.id) } } })
  const indisponiveis = new Set(fila.filter(f => !f.disponivel).map(f => f.vendedorId))
  const ultimo = new Map(fila.map(f => [f.vendedorId, f.ultimoRecebidoEm?.getTime() ?? 0]))
  const candidatos = ativos.filter(a => !indisponiveis.has(a.id)).sort((a, b) => (ultimo.get(a.id) ?? 0) - (ultimo.get(b.id) ?? 0) || a.id.localeCompare(b.id))
  const escolhido = candidatos[0]?.id
  if (!escolhido) return null
  await prisma.rodizioLead.upsert({ where: { vendedorId_papel: { vendedorId: escolhido, papel } }, create: { usuarioId, vendedorId: escolhido, papel, ultimoRecebidoEm: new Date() }, update: { ultimoRecebidoEm: new Date() } })
  return escolhido
}

export async function rodizioDaEquipe(usuarioId: string) {
  const [equipe, fila] = await Promise.all([
    prisma.vendedor.findMany({ where: { usuarioId, ativo: true, vende: true }, select: { id: true, nome: true, papel: true }, orderBy: { nome: 'asc' } }),
    prisma.rodizioLead.findMany({ where: { usuarioId } }),
  ])
  return equipe.map(v => {
    const papel = v.papel === 'SDR' ? 'SDR' : 'VENDEDOR'
    const f = fila.find(x => x.vendedorId === v.id && x.papel === papel)
    return { vendedorId: v.id, nome: v.nome, papel, disponivel: f?.disponivel ?? true, ultimoRecebidoEm: f?.ultimoRecebidoEm?.toISOString() ?? null }
  })
}
export async function marcarDisponivel(usuarioId: string, vendedorId: string, disponivel: boolean) {
  const v = await prisma.vendedor.findFirst({ where: { id: vendedorId, usuarioId }, select: { papel: true } })
  if (!v) throw new ErroJornada(404, 'Pessoa não encontrada')
  const papel = v.papel === 'SDR' ? 'SDR' : 'VENDEDOR'
  await prisma.rodizioLead.upsert({ where: { vendedorId_papel: { vendedorId, papel } }, create: { usuarioId, vendedorId, papel, disponivel }, update: { disponivel } })
}

// --- Passagem do SDR para o vendedor ---

export async function passarAoVendedor(l: LeadBase, resumo: string) {
  const etapaOk = l.etapa === 'SQL' || (l.etapa === 'LEVANTAMENTO' && l.formaPagamento === 'A_VISTA')
  if (!etapaOk) throw new ErroJornada(409, 'A passagem é feita no SQL (aprovado) ou, no cliente à vista, ao fim do Levantamento')
  // Lead que voltou: o mesmo vendedor, se ainda estiver ativo; senão, o rodízio.
  let vendedorId: string | null = null
  if (l.responsavelFechamentoId) {
    const v = await prisma.vendedor.findFirst({ where: { id: l.responsavelFechamentoId, ativo: true }, select: { id: true } })
    vendedorId = v?.id ?? null
  }
  vendedorId = vendedorId ?? (await proximoDoRodizio(l.usuarioId, 'VENDEDOR'))
  if (!vendedorId) throw new ErroJornada(409, 'Nenhum vendedor disponível no rodízio')
  const passagem = await prisma.leadPassagem.create({ data: { usuarioId: l.usuarioId, leadId: l.id, sdrId: l.responsavelQualificacaoId, vendedorId, resumo } })
  await prisma.lead.update({ where: { id: l.id }, data: { responsavelFechamentoId: vendedorId, vendedorId } })
  await criarAtividade({ ...l, vendedorId }, 'PRIMEIRO_CONTATO', new Date(Date.now() + 2 * HORA), resumo, vendedorId)
  return passagem
}

export async function devolverAoSdr(l: LeadBase, motivo: string) {
  const p = await prisma.leadPassagem.findFirst({ where: { leadId: l.id, devolvida: false }, orderBy: { passadaEm: 'desc' } })
  if (!p) throw new ErroJornada(409, 'Este lead não foi passado por um SDR')
  if (!motivo.trim()) throw new ErroJornada(400, 'Diga por que o lead não estava qualificado')
  await prisma.leadPassagem.update({ where: { id: p.id }, data: { devolvida: true, devolvidaEm: new Date(), motivoDevolucao: motivo.trim() } })
  await prisma.leadFollow.updateMany({ where: { leadId: l.id, tipo: 'JORNADA', status: 'PENDENTE', contexto: { path: ['atividade'], equals: 'PRIMEIRO_CONTATO' } }, data: { status: 'CANCELADO', resultado: 'Devolvido ao SDR' } })
  const volta: Etapa = l.formaPagamento === 'A_VISTA' ? 'LEVANTAMENTO' : 'SQL'
  await prisma.lead.update({ where: { id: l.id }, data: { vendedorId: p.sdrId ?? l.vendedorId } })
  if (['NEGOCIACAO', 'SQL', 'LEVANTAMENTO'].includes(l.etapa ?? '') && l.etapa !== volta) await moverEtapa({ ...l }, volta)
  return { volta }
}
