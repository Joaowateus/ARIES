// Atividades da jornada (PDF 01, seções 4 e 5): proposta, visita (check-in,
// falta e remarcação), passagem do SDR para o vendedor, devolução e
// rodízio. Até a Atividade (ATV) do PDF 02 existir, as atividades
// obrigatórias usam o follow atual (tipo JORNADA), que já aparece no Meu dia.
import { prisma } from './prisma'
import { autorAtual, comAutor } from './autorAuditoria'
import { ErroJornada, moverEtapa, registrarPerda } from './jornadaRegras'
import { ETAPAS, type Etapa } from './etapasJornada'

type LeadBase = { id: string; usuarioId: string; etapa: string | null; estagio: string; vendaId: string | null; modeloInteresse: string | null; formaPagamento: string | null; situacaoCnh: string | null; temEntrada: boolean | null; responsavelQualificacaoId: string | null; responsavelFechamentoId: string | null; vendedorId: string | null }
export type AtividadeJornada = 'PRIMEIRO_CONTATO' | 'FOLLOW_PROPOSTA' | 'CONFIRMAR_VISITA' | 'VISITA' | 'REMARCAR_VISITA' | 'RESULTADO_VISITA' | 'POS_ENTREGA' | 'POS_DOCUMENTACAO' | 'POS_REVISAO'
const TITULO: Record<AtividadeJornada, string> = {
  PRIMEIRO_CONTATO: 'Primeiro contato', FOLLOW_PROPOSTA: 'Follow da proposta', CONFIRMAR_VISITA: 'Confirmar visita',
  VISITA: 'Visita', REMARCAR_VISITA: 'Remarcar visita', RESULTADO_VISITA: 'Registrar resultado da visita',
  POS_ENTREGA: 'Pós-venda: entrega', POS_DOCUMENTACAO: 'Pós-venda: documentação', POS_REVISAO: 'Pós-venda: primeira revisão',
}
const HORA = 3_600_000, DIA = 24 * HORA

/** Cria a atividade obrigatória (fecha a pendente do mesmo tipo, se houver). */
export async function criarAtividade(l: LeadBase, atividade: AtividadeJornada, quando: Date, nota?: string, vendedorId?: string | null) {
  await prisma.leadFollow.updateMany({ where: { leadId: l.id, tipo: 'JORNADA', status: 'PENDENTE', contexto: { path: ['atividade'], equals: atividade } }, data: { status: 'CANCELADO', resultado: 'Substituída' } })
  return prisma.leadFollow.create({
    data: {
      usuarioId: l.usuarioId, leadId: l.id, vendedorId: vendedorId ?? l.vendedorId, agendadoPara: quando, tipo: 'JORNADA',
      canal: atividade.includes('VISITA') ? 'VISITA' : atividade.startsWith('POS_') ? 'OUTRO' : 'WHATSAPP', nota: nota ? `${TITULO[atividade]}: ${nota}` : TITULO[atividade],
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
  // CRM livre: a proposta pode ser registrada em qualquer etapa antes da venda (o lead vai para a Proposta).
  if (l.etapa === 'VENDA') throw new ErroJornada(409, 'A venda já foi registrada')
  const proposta = await prisma.leadProposta.create({ data: { usuarioId: l.usuarioId, leadId: l.id, preco: p.preco, entrada: p.entrada ?? null, parcela: p.parcela ?? null, prazo: p.prazo ?? null, validade: p.validade ?? null, autorId: autorAtual().id ?? null } })
  if (ETAPAS.indexOf((l.etapa ?? 'LEAD') as Etapa) < ETAPAS.indexOf('PROPOSTA')) await moverEtapa(l, 'PROPOSTA', { forcar: true })
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
  // CRM livre: a visita pode ser marcada em qualquer etapa antes da venda (o lead vai para o Agendamento).
  if (l.etapa === 'VENDA') throw new ErroJornada(409, 'A venda já foi registrada')
  if (marcadaPara.getTime() < Date.now() - HORA) throw new ErroJornada(400, 'A data da visita já passou')
  const aberta = await prisma.leadVisita.findFirst({ where: { leadId: l.id, checkinEm: null, falta: false }, orderBy: { criadoEm: 'desc' } })
  const faltas = await prisma.leadVisita.count({ where: { leadId: l.id, falta: true } })
  const visita = aberta
    ? await prisma.leadVisita.update({ where: { id: aberta.id }, data: { marcadaPara, remarcacoes: { increment: 1 } } })
    : await prisma.leadVisita.create({ data: { usuarioId: l.usuarioId, leadId: l.id, vendedorId: l.vendedorId, marcadaPara, remarcacoes: faltas } })
  if (ETAPAS.indexOf((l.etapa ?? 'LEAD') as Etapa) < ETAPAS.indexOf('AGENDAMENTO')) await moverEtapa(l, 'AGENDAMENTO', { forcar: true })
  await concluirAtividade(l.id, 'REMARCAR_VISITA', 'Visita remarcada')
  await concluirAtividade(l.id, 'FOLLOW_PROPOSTA', 'Visita marcada')
  await criarAtividade(l, 'VISITA', marcadaPara)
  const vespera = new Date(marcadaPara.getTime() - DIA)
  await criarAtividade(l, 'CONFIRMAR_VISITA', vespera.getTime() > Date.now() ? vespera : new Date())
  return visita
}

export async function checkin(l: LeadBase) {
  const agora = new Date()
  // CRM livre: cliente chegou sem visita marcada? Registra a visita agora mesmo.
  const v = (await prisma.leadVisita.findFirst({ where: { leadId: l.id, checkinEm: null, falta: false }, orderBy: { marcadaPara: 'desc' } }))
    ?? await prisma.leadVisita.create({ data: { usuarioId: l.usuarioId, leadId: l.id, vendedorId: l.vendedorId, marcadaPara: agora } })
  await prisma.leadVisita.update({ where: { id: v.id }, data: { checkinEm: agora } })
  await concluirAtividade(l.id, 'VISITA', 'Cliente chegou')
  await concluirAtividade(l.id, 'CONFIRMAR_VISITA', 'Cliente chegou')
  if (l.etapa !== 'VENDA' && l.etapa !== 'VISITA') await moverEtapa(l, 'VISITA', { forcar: true })
  // "Registrar resultado da visita" no mesmo dia.
  // Fim do dia em Brasília (23:59, UTC-3).
  const hojeBR = new Date(agora.getTime() - 3 * HORA).toISOString().slice(0, 10)
  const fimDoDia = new Date(`${hojeBR}T23:59:00-03:00`)
  await criarAtividade(l, 'RESULTADO_VISITA', fimDoDia.getTime() > agora.getTime() ? fimDoDia : agora)
  return agora
}

export async function resultadoDaVisita(l: LeadBase, resultado: string) {
  // CRM livre: sem check-in registrado, o resultado registra a visita (com o check-in) agora.
  const v = (await prisma.leadVisita.findFirst({ where: { leadId: l.id, checkinEm: { not: null } }, orderBy: { checkinEm: 'desc' } }))
    ?? await prisma.leadVisita.create({ data: { usuarioId: l.usuarioId, leadId: l.id, vendedorId: l.vendedorId, marcadaPara: new Date(), checkinEm: new Date() } })
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
  // CRM livre: a passagem ao vendedor pode ser feita em qualquer etapa (o ideal é no SQL ou, à vista, no fim do Levantamento).
  if (l.etapa === 'VENDA') throw new ErroJornada(409, 'A venda já foi registrada')
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

// --- Venda: confirmação do dono, cancelamento e pós-venda ---

const PRAZOS_PADRAO = { entrega: 3, documentacao: 15, primeiraRevisao: 180 }

/** O dono confirma: a venda passa a contar e o Pós-venda começa. */
export async function confirmarVenda(usuarioId: string, vendaId: string, quem: string | null) {
  const v = await prisma.venda.findFirst({ where: { id: vendaId, usuarioId, situacao: 'AGUARDANDO_CONFIRMACAO' }, select: { id: true, lead: { select: { id: true, usuarioId: true, vendedorId: true } } } })
  if (!v) throw new ErroJornada(404, 'Venda não encontrada ou já confirmada')
  const agora = new Date()
  await prisma.venda.update({ where: { id: v.id }, data: { situacao: 'CONFIRMADA', confirmadaEm: agora, confirmadaPor: quem } })
  if (v.lead) await criarPosVenda(v.lead, agora)
}

export async function criarPosVenda(lead: { id: string; usuarioId: string; vendedorId: string | null }, desde: Date) {
  const p = await prisma.parametroLiquidez.findUnique({ where: { usuarioId: lead.usuarioId }, select: { posVendaPrazos: true } })
  const prazos = { ...PRAZOS_PADRAO, ...((p?.posVendaPrazos as Partial<typeof PRAZOS_PADRAO> | null) ?? {}) }
  const base = { ...lead, etapa: 'VENDA', estagio: 'FECHADO', vendaId: null, modeloInteresse: null, formaPagamento: null, situacaoCnh: null, temEntrada: null, responsavelQualificacaoId: null, responsavelFechamentoId: null } as LeadBase
  await criarAtividade(base, 'POS_ENTREGA', new Date(desde.getTime() + prazos.entrega * DIA))
  await criarAtividade(base, 'POS_DOCUMENTACAO', new Date(desde.getTime() + prazos.documentacao * DIA))
  await criarAtividade(base, 'POS_REVISAO', new Date(desde.getTime() + prazos.primeiraRevisao * DIA))
}

export const MOTIVOS_CANCELAMENTO = ['CANCELADA_DESISTENCIA', 'CREDITO_NAO_LIBERADO', 'ERRO_REGISTRO'] as const
/**
 * Cancela a venda (motivos da etapa Venda). Erro de registro devolve o lead
 * à etapa anterior e não conta como perda; os outros motivos perdem o lead
 * com o destino da tabela. A moto volta ao estoque.
 */
export async function cancelarVenda(usuarioId: string, vendaId: string, motivo: typeof MOTIVOS_CANCELAMENTO[number]) {
  const v = await prisma.venda.findFirst({ where: { id: vendaId, usuarioId, situacao: { in: ['AGUARDANDO_CONFIRMACAO', 'CONFIRMADA'] } }, select: { id: true, motoId: true, pagamentoComissaoId: true, pagamentoProLaboreId: true, lead: { select: { id: true } } } })
  if (!v) throw new ErroJornada(404, 'Venda não encontrada')
  if (v.pagamentoComissaoId || v.pagamentoProLaboreId) throw new ErroJornada(409, 'Esta venda já tem comissão ou pró-labore pago: desfaça o pagamento antes de cancelar')
  await prisma.venda.update({ where: { id: v.id }, data: { situacao: 'CANCELADA', canceladaEm: new Date(), motivoCancelamento: motivo } })
  if (v.motoId) await prisma.smMotoEstoque.updateMany({ where: { id: v.motoId, situacao: 'VENDIDA' }, data: { situacao: 'DISPONIVEL', saidaEm: null } })
  if (!v.lead) return
  await prisma.leadFollow.updateMany({ where: { leadId: v.lead.id, tipo: 'JORNADA', status: 'PENDENTE', contexto: { path: ['atividade'], string_starts_with: 'POS_' } }, data: { status: 'CANCELADO', resultado: 'Venda cancelada' } })
  const anterior = await prisma.leadEstagioHistorico.findFirst({ where: { leadId: v.lead.id, estagioNovo: 'VENDA' }, orderBy: { criadoEm: 'desc' }, select: { estagioAnterior: true } })
  const volta = (['NEGOCIACAO', 'PROPOSTA', 'AGENDAMENTO', 'VISITA'].includes(anterior?.estagioAnterior ?? '') ? anterior!.estagioAnterior : 'PROPOSTA') as Etapa
  await prisma.lead.update({ where: { id: v.lead.id }, data: { vendaId: null, etapa: volta, fase: 'VENDA', estagio: volta === 'NEGOCIACAO' ? 'NEGOCIACAO' : 'PROPOSTA', fechadoEm: null, vendaSemVisita: false, entrouNaEtapaEm: new Date() } })
  await prisma.leadEstagioHistorico.create({ data: { leadId: v.lead.id, estagioAnterior: 'VENDA', estagioNovo: volta, motivo } })
  if (motivo !== 'ERRO_REGISTRO') {
    const l = await prisma.lead.findUnique({ where: { id: v.lead.id }, select: { id: true, usuarioId: true, nomeCliente: true, etapa: true, estagio: true, vendaId: true, modeloInteresse: true, formaPagamento: true, situacaoCnh: true, temEntrada: true, responsavelQualificacaoId: true, responsavelFechamentoId: true, vendedorId: true } })
    // A perda conta na etapa Venda (o motivo é dela), com o destino da tabela.
    if (l) await registrarPerda({ ...l, etapa: 'VENDA' }, motivo)
  }
}

/**
 * Agendamento vencido (PDF 01): passada a hora marcada (com 2 h de tolerância)
 * sem check-in, a visita conta como falta — gera a remarcação ou, no limite
 * de faltas, a perda. Roda no job de hora em hora, com autor automação.
 */
export async function faltasVencidas(limite = 100, agora = new Date()) {
  const vencidas = await prisma.leadVisita.findMany({
    where: { checkinEm: null, falta: false, marcadaPara: { lt: new Date(agora.getTime() - 2 * HORA) }, lead: { etapa: 'AGENDAMENTO', estagio: { not: 'PERDIDO' } } },
    select: { leadId: true }, take: limite,
  })
  let faltas = 0
  for (const v of vencidas) {
    const l = await prisma.lead.findUnique({ where: { id: v.leadId }, select: { id: true, usuarioId: true, etapa: true, estagio: true, vendaId: true, modeloInteresse: true, formaPagamento: true, situacaoCnh: true, temEntrada: true, responsavelQualificacaoId: true, responsavelFechamentoId: true, vendedorId: true } })
    if (!l) continue
    await comAutor({ origem: 'AUTOMACAO' }, () => registrarFalta(l)).then(() => faltas++).catch(e => console.error('[jornada] falta automática', e))
  }
  return { faltasAutomaticas: faltas }
}
