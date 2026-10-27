// Aviso de ligação para quem liga, para não esquecer: na hora marcada (até
// 5 min antes) e um lembrete 30 min depois se continuar pendente. Sai pelo
// Aries quando a pessoa conversa com ele (e deixou os avisos ligados); senão,
// para o vendedor, no chat "Você" do WhatsApp dele. Junta as ligações da
// mesma pessoa numa mensagem só. Roda no job de minuto (/sm/cron/minuto).
import { prisma } from './prisma'
import { logger } from './logger'
import { enviarComoPessoa } from './agenteEnvio'
import { conversaDeSuporte, enviarDoAssistente, formatarTelefone } from './assistenteMotor'
import { lerConfig } from './assistenteRoteiro'

const MIN = 60e3, HORA = 3600e3
const ANTECEDENCIA = 5 * MIN
const LEMBRETE_DEPOIS = 30 * MIN
// Ligação marcada há mais tempo que isso não gera aviso novo (evita uma enxurrada de antigas).
const AVISO_ATE = 3 * HORA, LEMBRETE_ATE = 6 * HORA

const horaBR = (t: Date) => new Date(t.getTime() - 3 * HORA).toISOString().slice(11, 16)
const dentroDoHorario = (agora: Date) => { const h = new Date(agora.getTime() - 3 * HORA).getUTCHours(); return h >= 7 && h < 21 }

type Item = { id: string; usuarioId: string; vendedorId: string | null; agendadaPara: Date; passo: number | null; totalPassos: number | null; instrucao: string | null; cadenciaId: string | null; lead: { nomeCliente: string; telefone: string | null } }

function texto(itens: Item[], tipo: 'AVISO' | 'LEMBRETE', nomesCadencia: Map<string, string>, link: string | null): string {
  const cab = tipo === 'AVISO'
    ? `📞 *Hora de ligar${itens.length > 1 ? ` (${itens.length})` : ''}*`
    : `⏰ *Ligação${itens.length > 1 ? 'ões' : ''} ainda sem registro*`
  const linhas = itens.slice(0, 6).map(l => {
    const passo = l.passo ? `Ligação ${l.passo} de ${l.totalPassos ?? l.passo}${l.cadenciaId && nomesCadencia.get(l.cadenciaId) ? ` · ${nomesCadencia.get(l.cadenciaId)}` : ''}` : 'Ligação agendada'
    const fone = l.lead.telefone ? formatarTelefone(l.lead.telefone.replace(/\D/g, '')) : 'sem telefone no cadastro'
    return [`• *${l.lead.nomeCliente}* — ${horaBR(l.agendadaPara)} · ${passo}`, `  ${fone}`, l.instrucao ? `  O que falar: ${l.instrucao}` : null].filter(Boolean).join('\n')
  })
  return [cab, '', ...linhas, '', link ? `Depois da ligação, registre o resultado: ${link}` : 'Depois da ligação, registre o resultado no sistema, em Ligações.'].join('\n')
}

/** Por quem o aviso sai: Aries (vínculo com avisos ligados) ou o chat "Você" do assistente do vendedor. Também usado pelo follow de crédito. */
export async function avisarNoWhatsapp(usuarioId: string, vendedorId: string | null, mensagem: string): Promise<boolean> {
  const pessoa = vendedorId ?? 'DONO'
  const v = await prisma.agenteVinculo.findFirst({
    where: { pessoa, alertas: true, verificadoEm: { not: null }, numero: { not: null }, agente: { usuarioId, status: 'CONECTADO' } },
    select: { id: true, numero: true, agente: { select: { instancia: true } } },
  })
  if (v?.numero) {
    await enviarComoPessoa(v.agente, v.numero, mensagem, { vinculoId: v.id, intencao: 'ALERTA' })
    return true
  }
  if (!vendedorId) return false // o dono sem o Aries vê o aviso na tela do sistema
  const a = await prisma.assistenteComercial.findFirst({
    where: { vendedorId, status: 'CONECTADO', instancia: { not: null }, numeroWhatsapp: { not: null } },
    include: { vendedor: { select: { nome: true } } },
  })
  if (!a) return false
  const suporte = await conversaDeSuporte(a)
  await enviarDoAssistente(a, { ...lerConfig(a.configuracao), atrasoSegundos: 0 }, suporte.id, a.numeroWhatsapp!, [mensagem])
  return true
}

export async function avisarLigacoes(agora = new Date()): Promise<{ avisosLigacao: number }> {
  if (!dentroDoHorario(agora)) return { avisosLigacao: 0 }
  const sel = { id: true, usuarioId: true, vendedorId: true, agendadaPara: true, passo: true, totalPassos: true, instrucao: true, cadenciaId: true, lead: { select: { nomeCliente: true, telefone: true } } } as const
  const [avisos, lembretes] = await Promise.all([
    prisma.ligacaoTarefa.findMany({ where: { status: 'PENDENTE', avisadaEm: null, agendadaPara: { lte: new Date(agora.getTime() + ANTECEDENCIA), gte: new Date(agora.getTime() - AVISO_ATE) } }, select: sel, orderBy: { agendadaPara: 'asc' }, take: 200 }),
    prisma.ligacaoTarefa.findMany({ where: { status: 'PENDENTE', avisadaEm: { not: null }, relembradaEm: null, agendadaPara: { lte: new Date(agora.getTime() - LEMBRETE_DEPOIS), gte: new Date(agora.getTime() - LEMBRETE_ATE) } }, select: sel, orderBy: { agendadaPara: 'asc' }, take: 200 }),
  ])
  if (!avisos.length && !lembretes.length) return { avisosLigacao: 0 }
  const cadencias = [...new Set([...avisos, ...lembretes].map(l => l.cadenciaId).filter((x): x is string => !!x))]
  const nomes = new Map((await prisma.cadenciaLigacao.findMany({ where: { id: { in: cadencias } }, select: { id: true, nome: true } })).map(c => [c.id, c.nome]))
  const base = process.env.FRONTEND_URL?.replace(/\/+$/, '')
  const link = base ? `${base}/pro-labore/ligacoes` : null
  let enviados = 0
  for (const [tipo, lista, campo] of [['AVISO', avisos, 'avisadaEm'], ['LEMBRETE', lembretes, 'relembradaEm']] as const) {
    const porPessoa = new Map<string, Item[]>()
    for (const l of lista) {
      const chave = `${l.usuarioId}|${l.vendedorId ?? ''}`
      porPessoa.set(chave, [...(porPessoa.get(chave) ?? []), l])
    }
    for (const itens of porPessoa.values()) {
      // Marca antes de enviar: duas rodadas juntas não mandam o mesmo aviso duas vezes.
      const marcados = await prisma.ligacaoTarefa.updateMany({ where: { id: { in: itens.map(i => i.id) }, [campo]: null }, data: { [campo]: agora } })
      if (!marcados.count) continue
      try {
        if (await avisarNoWhatsapp(itens[0].usuarioId, itens[0].vendedorId, texto(itens, tipo, nomes, link))) enviados++
      } catch (e) {
        logger.warn({ err: e, tipo }, 'ligações: falha ao avisar pelo WhatsApp')
      }
    }
  }
  return { avisosLigacao: enviados }
}
