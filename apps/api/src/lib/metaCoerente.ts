// PDF 06 · correção 4: Hoje, Daily, bússola e Recomendações leem a meta pela
// mesma conta. A previsão vem do dicionário (previsao_fechamento, mesmo escopo do
// Hoje), a meta é metaDoMes e o ritmo é dito em vendas inteiras e dias úteis.
// A REC "Meta do mês em risco" é revista toda hora: se a previsão voltou a cobrir
// a meta, a REC nova é encerrada pelo ARIES (com o motivo, na memória e na
// auditoria); a já aceita ganha a nota e fica para o responsável encerrar.
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { calcular, hojeBrt, mesCorrente, metaDoMes, faixaDe, type Escopo } from './metricas'
import { diasUteisRestantes, fmtValor, ritmoEmVendas } from './formato'
import { lerExpediente } from './expediente'

const DIA = 86_400_000
const r2 = (n: number) => Math.round(n * 100) / 100

export interface SituacaoMeta {
  previsao: number | null; meta: number | null; pct: number | null
  faixa: 'BOM' | 'ATENCAO' | 'CRITICO' | null
  realizado: number; diasRestantes: number; diasPassados: number; diasUteis: number
  ticket: number | null; faltamVendas: number | null; cobre: boolean
  ritmo: string // "Meta no ritmo" | "faltam 4 vendas em 12 dias úteis" | "1 venda a cada 3 dias úteis…"
}

/** A situação da meta da loja (ou de um vendedor), igual em todas as telas. */
export async function situacaoDaMeta(usuarioId: string, agora = new Date(), vendedorId: string | null = null): Promise<SituacaoMeta> {
  const e: Escopo = { usuarioId, papel: 'DONO', vendedorId }
  const mes = mesCorrente(agora)
  const [prev, meta, ticket, exp] = await Promise.all([
    calcular('previsao_fechamento', e, mes, agora),
    metaDoMes({ usuarioId, vendedorId }),
    calcular('ticket_medio', e, { inicio: new Date(agora.getTime() - 90 * DIA).toISOString().slice(0, 10), fim: hojeBrt(agora) }, agora).catch(() => null),
    lerExpediente(usuarioId),
  ])
  const d = (prev.detalhe ?? {}) as { realizado?: number; diasRestantes?: number; diasPassados?: number }
  const realizado = d.realizado ?? 0
  const diasRestantes = d.diasRestantes ?? 0
  const h = hojeBrt(agora)
  const diasPassados = d.diasPassados ?? Number(h.slice(8, 10))
  const diasUteis = diasUteisRestantes(h, true, exp.dias)
  const cobre = meta != null && prev.valor != null && prev.valor >= meta
  const t = ticket?.valor && ticket.valor > 0 ? ticket.valor : null
  const faltamVendas = meta != null && t ? Math.max(0, Math.ceil((meta - realizado) / t - 1e-9)) : null
  return {
    previsao: prev.valor, meta, pct: meta && prev.valor != null ? Math.round((prev.valor / meta) * 100) : null,
    faixa: meta && prev.valor != null ? faixaDe(prev.valor, meta, 'MAIOR') : null,
    realizado, diasRestantes, diasPassados, diasUteis, ticket: t, faltamVendas, cobre,
    ritmo: ritmoEmVendas(faltamVendas, diasUteis, cobre),
  }
}

/** Texto da ação sugerida da REC de meta, a partir da situação atual (formato brasileiro, vendas inteiras). */
export function textoMetaEmRisco(s: SituacaoMeta, piorEtapa: { nome: string; conversao: number } | null) {
  const ritmo = s.ritmo === 'Meta no ritmo' ? '' : `${s.ritmo.charAt(0).toUpperCase()}${s.ritmo.slice(1)}. `
  return `${ritmo}${piorEtapa ? `Onde agir: a etapa ${piorEtapa.nome} tem a menor conversão do mês (${fmtValor(piorEtapa.conversao, 'PCT')}).` : 'Concentrar o time nas oportunidades de Negociação a Visita.'}`
}

/**
 * Revê as RECs abertas de "Meta do mês em risco" com a previsão de agora.
 * - Previsão cobre a meta: NOVA → ENCERRADA pelo ARIES, com o motivo; ACEITA/EM_EXECUCAO → nota para o responsável.
 * - Ainda abaixo: atualiza a evidência "agora" e o texto (a tela nunca mostra um número congelado contra outro vivo).
 */
export async function reverMetaEmRisco(usuarioId: string, agora = new Date()) {
  const abertas = await prisma.recomendacao.findMany({ where: { usuarioId, detector: 'meta_em_risco', status: { in: ['NOVA', 'ACEITA', 'EM_EXECUCAO'] } } })
  if (!abertas.length) return { revistas: 0, encerradas: 0 }
  const s = await situacaoDaMeta(usuarioId, agora)
  const mesAtual = mesCorrente(agora).inicio.slice(0, 7)
  let encerradas = 0
  for (const rec of abertas) {
    const ev = (rec.evidencia ?? {}) as Record<string, unknown>
    const agoraEv = { previsao: s.previsao, meta: s.meta, pct: s.pct, ritmo: s.ritmo, em: agora.toISOString() }
    const deOutroMes = rec.alvoId != null && rec.alvoId !== mesAtual
    if (s.cobre || deOutroMes) {
      const motivo = deOutroMes
        ? 'Encerrada pelo ARIES: o mês da recomendação terminou.'
        : `Encerrada pelo ARIES: a previsão voltou a cobrir a meta (${fmtValor(s.previsao, 'BRL')} contra ${fmtValor(s.meta, 'BRL')}, ${s.pct}%).`
      if (rec.status === 'NOVA') {
        await prisma.recomendacao.update({ where: { id: rec.id }, data: { status: 'ENCERRADA', encerradaEm: agora, resultadoNota: motivo, evidencia: { ...ev, agora: agoraEv } as Prisma.InputJsonValue, auditoriaAutor: 'AUTOMACAO|||coerencia_meta' } })
        await prisma.atividade.updateMany({ where: { registroTabela: 'pro_labore_recomendacoes', registroId: `${rec.id}|tratar`, status: 'PENDENTE' }, data: { status: 'CANCELADA', resultado: motivo, auditoriaAutor: 'AUTOMACAO|||coerencia_meta' } }).catch(() => undefined)
        encerradas++
      } else {
        await prisma.recomendacao.update({ where: { id: rec.id }, data: { resultadoNota: `${motivo.replace('Encerrada pelo ARIES: ', 'Atenção: ')} Avalie e encerre quando quiser.`, evidencia: { ...ev, agora: agoraEv } as Prisma.InputJsonValue, auditoriaAutor: 'AUTOMACAO|||coerencia_meta' } })
      }
      await prisma.recomendacaoMemoria.create({ data: { usuarioId, detector: rec.detector, contexto: rec.contexto, acao: rec.status === 'NOVA' ? 'ENCERRADA_PELO_ARIES' : 'NOTA_DO_ARIES', recomendacaoId: rec.id, detalhe: motivo } })
      continue
    }
    const pior = (ev.metricas as Array<{ detalhe?: { piorEtapa?: string | null } }> | undefined)?.[0]?.detalhe?.piorEtapa ?? null
    const piorTxt = typeof ev.piorEtapaTexto === 'object' && ev.piorEtapaTexto ? ev.piorEtapaTexto as { nome: string; conversao: number } : null
    await prisma.recomendacao.update({
      where: { id: rec.id },
      data: {
        acaoSugerida: textoMetaEmRisco(s, piorTxt), impacto: { unidade: 'FATURAMENTO', valor: r2((s.meta ?? 0) - (s.previsao ?? 0)), texto: 'diferença entre a meta e a previsão de agora (estimativa)' },
        evidencia: { ...ev, agora: agoraEv, resumo: `previsão ${fmtValor(s.previsao, 'BRL')} contra a meta ${fmtValor(s.meta, 'BRL')} (${s.pct ?? '—'}%)${pior ? '' : ''}` } as Prisma.InputJsonValue,
        auditoriaAutor: 'AUTOMACAO|||coerencia_meta',
      },
    })
  }
  return { revistas: abertas.length, encerradas }
}

export async function reverMetaEmRiscoTodas(agora = new Date()) {
  const contas = await prisma.proLaboreUsuario.findMany({ select: { id: true } })
  let encerradas = 0
  for (const c of contas) encerradas += (await reverMetaEmRisco(c.id, agora).catch(e => { console.error('[meta coerente]', e); return { encerradas: 0 } })).encerradas
  return { encerradas }
}
