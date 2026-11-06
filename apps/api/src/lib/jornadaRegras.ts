// Regras da jornada de 10 etapas (PDF 01, seções 3 a 5): o critério de
// entrada de cada etapa, a mudança de etapa com histórico e autor, o
// destino da perda e o avanço automático só por fatos que o sistema vê.
//
// Compatibilidade: as telas que ainda não conhecem as 10 etapas (Dashboard,
// indicadores, Reativação) continuam lendo `estagio`; cada etapa nova grava
// também a etapa antiga equivalente.
import { prisma } from './prisma'
import { comAutor, autorAtual, type Autor } from './autorAuditoria'
import { ETAPAS, MOTIVOS_DA_ETAPA, NOME_ETAPA, destinoDoMotivo, faseDa, type Etapa } from './etapasJornada'

export class ErroJornada extends Error {
  constructor(readonly status: number, message: string, readonly faltando: string[] = []) { super(message) }
}

export const ESTAGIO_LEGADO: Record<Etapa, string> = {
  LEAD: 'LEAD', ABORDADO: 'ABORDADO', LEVANTAMENTO: 'ABORDADO', MQL: 'NEGOCIACAO', SQL: 'NEGOCIACAO',
  NEGOCIACAO: 'NEGOCIACAO', PROPOSTA: 'PROPOSTA', AGENDAMENTO: 'PROPOSTA', VISITA: 'PROPOSTA', VENDA: 'FECHADO',
}

// Critérios do Levantamento (editáveis em Metas e premissas).
export type CriterioLevantamento = 'modelo' | 'pagamento' | 'cnh' | 'entrada'
export const CRITERIOS_PADRAO: CriterioLevantamento[] = ['modelo', 'pagamento', 'cnh', 'entrada']
const NOME_CRITERIO: Record<CriterioLevantamento, string> = { modelo: 'modelo de interesse', pagamento: 'forma de pagamento', cnh: 'situação da CNH', entrada: 'se tem entrada' }

export async function criteriosLevantamento(usuarioId: string): Promise<CriterioLevantamento[]> {
  const p = await prisma.parametroLiquidez.findUnique({ where: { usuarioId }, select: { jornadaCriteriosLevantamento: true } })
  const c = p?.jornadaCriteriosLevantamento as unknown
  return Array.isArray(c) && c.length ? (c.filter(x => CRITERIOS_PADRAO.includes(x)) as CriterioLevantamento[]) : CRITERIOS_PADRAO
}

interface LeadJornada {
  id: string; usuarioId: string; etapa: string | null; estagio: string; vendaId: string | null
  modeloInteresse: string | null; formaPagamento: string | null; situacaoCnh: string | null; temEntrada: boolean | null
  responsavelQualificacaoId: string | null; responsavelFechamentoId: string | null; vendedorId: string | null
}
const SELECT_JORNADA = {
  id: true, usuarioId: true, etapa: true, estagio: true, vendaId: true, modeloInteresse: true, formaPagamento: true, situacaoCnh: true, temEntrada: true,
  responsavelQualificacaoId: true, responsavelFechamentoId: true, vendedorId: true,
} as const

/** O que falta no Levantamento, pelos critérios da conta. */
export function faltasDoLevantamento(l: LeadJornada, criterios: CriterioLevantamento[]) {
  const tem: Record<CriterioLevantamento, boolean> = {
    modelo: !!l.modeloInteresse?.trim(), pagamento: !!l.formaPagamento, cnh: !!l.situacaoCnh, entrada: l.temEntrada !== null && l.temEntrada !== undefined,
  }
  return criterios.filter(c => !tem[c]).map(c => NOME_CRITERIO[c])
}

/** Fatos do lead que os critérios usam. */
async function fatos(l: LeadJornada) {
  const conversas = await prisma.assistenteConversa.findMany({ where: { leadId: l.id }, select: { id: true, simulacao: true } })
  const ids = conversas.map(c => c.id)
  const [humano, cliente, aprovadas, propostas, visita, passagem] = await Promise.all([
    ids.length ? prisma.assistenteMensagem.count({ where: { conversaId: { in: ids }, remetente: 'VENDEDOR' } }) : 0,
    ids.length ? prisma.assistenteMensagem.count({ where: { conversaId: { in: ids }, remetente: 'CONTATO' } }) : 0,
    prisma.assistenteAnaliseCredito.count({ where: { status: 'APROVADA', ficha: { OR: [{ leadId: l.id }, ...(ids.length ? [{ conversaId: { in: ids } }] : [])] } } }),
    prisma.leadProposta.count({ where: { leadId: l.id } }),
    prisma.leadVisita.findFirst({ where: { leadId: l.id }, orderBy: { marcadaPara: 'desc' }, select: { marcadaPara: true, checkinEm: true, falta: true } }),
    prisma.leadPassagem.findFirst({ where: { leadId: l.id }, orderBy: { passadaEm: 'desc' }, select: { devolvida: true } }),
  ])
  return { temConversa: ids.length > 0, humano, cliente, simulacao: conversas.some(c => c.simulacao), aprovadas, propostas, visita, passado: !!passagem && !passagem.devolvida }
}

export interface OpcoesMover { contatoFora?: boolean }

/** O que falta para o lead entrar na etapa `destino` (lista vazia = pode). */
export async function faltasPara(l: LeadJornada, destino: Etapa, opcoes: OpcoesMover = {}): Promise<string[]> {
  const atual = (l.etapa ?? 'LEAD') as Etapa
  const ia = ETAPAS.indexOf(atual), id = ETAPAS.indexOf(destino)
  if (destino === atual) return []
  if (atual === 'VENDA') return ['A venda já foi registrada: para mudar, cancele a venda']
  if (id < ia) return [] // voltar é livre (fica no histórico)
  if (destino === 'VENDA') return ['A venda entra pelo botão "Registrar venda" (o dono confirma depois)']
  const aVista = l.formaPagamento === 'A_VISTA'
  const pulo = id !== ia + 1 && !(atual === 'LEVANTAMENTO' && destino === 'NEGOCIACAO')
  if (pulo) return [`Avance uma etapa por vez: a próxima é ${NOME_ETAPA[ETAPAS[ia + 1]]}`]
  const f = await fatos(l)
  const faltas: string[] = []
  switch (destino) {
    case 'ABORDADO':
      if (!f.humano && !opcoes.contatoFora) faltas.push(f.temConversa ? 'Uma pessoa da loja precisa responder o cliente (a resposta do robô não conta)' : 'Confirme que você respondeu o cliente (por telefone ou pessoalmente)')
      break
    case 'LEVANTAMENTO': {
      const comecou = !!(l.modeloInteresse?.trim() || l.formaPagamento || l.situacaoCnh || l.temEntrada !== null)
      if (!(f.cliente > 0 && f.humano > 0) && !comecou) faltas.push('O cliente precisa responder e a coleta começar (modelo, pagamento, CNH ou entrada)')
      break
    }
    case 'MQL': {
      if (aVista) faltas.push('Cliente à vista não passa por MQL: avance direto para Negociação')
      const falta = faltasDoLevantamento(l, await criteriosLevantamento(l.usuarioId))
      if (falta.length) faltas.push(`Complete o levantamento: falta ${falta.join(', ')}`)
      if (!aVista && l.formaPagamento !== 'FINANCIADO') faltas.push('Marque a forma de pagamento como financiado')
      if (!f.simulacao) faltas.push('Envie a simulação ao cliente')
      break
    }
    case 'SQL':
      if (!f.aprovadas) faltas.push('Pelo menos um banco precisa aprovar o crédito (registre a resposta na ficha de crédito)')
      break
    case 'NEGOCIACAO': {
      if (atual === 'LEVANTAMENTO') {
        if (!aVista) faltas.push('Só o cliente à vista vai do Levantamento direto para a Negociação; financiado passa por MQL e SQL')
        const falta = faltasDoLevantamento(l, await criteriosLevantamento(l.usuarioId))
        if (falta.length) faltas.push(`Complete o levantamento: falta ${falta.join(', ')}`)
      }
      const precisaPassagem = !!l.responsavelQualificacaoId && l.responsavelQualificacaoId !== l.responsavelFechamentoId
      if (precisaPassagem && !f.passado) faltas.push('Passe o lead ao vendedor (botão "Passar ao vendedor")')
      break
    }
    case 'PROPOSTA':
      if (!f.propostas) faltas.push('Registre a proposta (preço, entrada e parcela)')
      break
    case 'AGENDAMENTO':
      if (!f.visita || f.visita.falta || f.visita.checkinEm) faltas.push('Marque a visita à loja, com data e hora')
      break
    case 'VISITA':
      if (!f.visita?.checkinEm) faltas.push('Registre o check-in quando o cliente chegar à loja')
      break
  }
  return faltas
}

async function gravarEtapa(l: LeadJornada, destino: Etapa, extra: Record<string, unknown> = {}, motivo?: string) {
  const agora = new Date()
  await prisma.lead.update({
    where: { id: l.id },
    data: { etapa: destino, fase: faseDa(destino), estagio: ESTAGIO_LEGADO[destino], entrouNaEtapaEm: agora, revisarEtapa: false, ...extra },
  })
  await prisma.leadEstagioHistorico.create({ data: { leadId: l.id, estagioAnterior: l.etapa ?? l.estagio, estagioNovo: destino, ...(motivo ? { motivo } : {}), ...(autorAtual().origem === 'AUTOMACAO' ? { origem: 'ASSISTENTE' } : {}) } })
}

export async function leadDaJornada(usuarioId: string, id: string, where: Record<string, unknown> = {}) {
  const l = await prisma.lead.findFirst({ where: { id, usuarioId, ...where }, select: SELECT_JORNADA })
  if (!l) throw new ErroJornada(404, 'Lead não encontrado')
  if (!l.etapa) throw new ErroJornada(409, 'Este lead ainda está nas 5 etapas antigas (a migração não foi aplicada)')
  return l
}

/** Muda a etapa se o critério estiver cumprido; senão, diz o que falta. */
export async function moverEtapa(l: LeadJornada, destino: Etapa, opcoes: OpcoesMover = {}) {
  if (l.estagio === 'PERDIDO') throw new ErroJornada(409, 'Lead perdido: reative pela Reativação antes de mover')
  const faltas = await faltasPara(l, destino, opcoes)
  if (faltas.length) throw new ErroJornada(422, `Ainda não dá para mover para ${NOME_ETAPA[destino]}`, faltas)
  if (destino === l.etapa) return
  await gravarEtapa(l, destino)
}

/** Registra a perda: só o motivo é escolhido; o destino vem da tabela. */
export async function registrarPerda(l: LeadJornada, motivo: string, nota?: string | null) {
  const etapa = (l.etapa ?? 'LEAD') as Etapa
  const validos = [...MOTIVOS_DA_ETAPA[etapa], 'PEDIU_NAO_CONTATO']
  if (!validos.includes(motivo)) throw new ErroJornada(400, `Motivo não vale para a etapa ${NOME_ETAPA[etapa]}`)
  if (l.estagio === 'PERDIDO') throw new ErroJornada(409, 'Lead já está perdido')
  const destino = destinoDoMotivo(motivo)
  const agora = new Date()
  await prisma.lead.update({
    where: { id: l.id },
    data: { estagio: 'PERDIDO', perdidoEm: agora, fechadoEm: agora, motivoPerda: motivo, destinoPerda: destino, estagioPerda: ESTAGIO_LEGADO[etapa], notaPerda: nota || null },
  })
  await prisma.leadEstagioHistorico.create({ data: { leadId: l.id, estagioAnterior: etapa, estagioNovo: 'PERDIDO', motivo } })
  if (motivo === 'PEDIU_NAO_CONTATO') {
    const c = await prisma.lead.findUnique({ where: { id: l.id }, select: { clienteId: true } })
    if (c?.clienteId) await prisma.cliente.update({ where: { id: c.clienteId }, data: { bloqueado: true, bloqueadoEm: agora, motivoBloqueio: 'Pediu para não ser contatado' } })
  }
  return destino
}

/** O que falta para cada etapa seguinte possível (para a tela mostrar). */
export async function checklist(l: LeadJornada) {
  const atual = (l.etapa ?? 'LEAD') as Etapa
  const i = ETAPAS.indexOf(atual)
  const proximas: Etapa[] = []
  if (i + 1 < ETAPAS.length && ETAPAS[i + 1] !== 'VENDA') proximas.push(ETAPAS[i + 1])
  if (atual === 'LEVANTAMENTO') proximas.push('NEGOCIACAO')
  const r = []
  for (const e of proximas) r.push({ etapa: e, faltando: await faltasPara(l, e) })
  const criterios = await criteriosLevantamento(l.usuarioId)
  return { etapa: atual, proximas: r, levantamentoFalta: faltasDoLevantamento(l, criterios), motivos: [...MOTIVOS_DA_ETAPA[atual], 'PEDIU_NAO_CONTATO'] }
}

/**
 * Avanço automático (decisão aprovada): só por fatos que o sistema vê — uma
 * pessoa da loja respondeu (Abordado), a simulação foi enviada (MQL) ou um
 * banco aprovou (SQL). Autor "automação". Resposta do robô nunca conta.
 */
export async function avancarPorFatos(leadId: string, autor: Autor = { origem: 'AUTOMACAO' }) {
  return comAutor(autor, async () => {
    const l = await prisma.lead.findUnique({ where: { id: leadId }, select: SELECT_JORNADA })
    if (!l?.etapa || l.estagio === 'PERDIDO' || l.vendaId) return null
    const proxima: Partial<Record<Etapa, Etapa>> = { LEAD: 'ABORDADO', LEVANTAMENTO: 'MQL', MQL: 'SQL' }
    const destino = proxima[l.etapa as Etapa]
    if (!destino || (await faltasPara(l, destino)).length) return null
    await gravarEtapa(l, destino, {}, destino === 'ABORDADO' ? 'uma pessoa da loja respondeu' : destino === 'MQL' ? 'simulação enviada com o levantamento completo' : 'banco aprovou o crédito')
    return destino
  })
}
