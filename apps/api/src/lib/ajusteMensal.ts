// PDF 03 · 4.4 Ajuste mensal: uma vez por mês o ARIES compara parâmetros e
// detectores com o que aconteceu e sugere ajustes. Nada muda sem a
// aprovação do dono (P3); aprovar grava no histórico com a justificativa.
// Regras (decisão aprovada):
// - detector com 5+ RECs no mês e mais da metade descartada ou avaliada como
//   não pertinente → sugerir volume mínimo maior (mais casos para disparar);
// - tempo máximo de uma etapa aprovado à mão que ficou 20%+ longe do que
//   aconteceu (percentil 75 do mês) → sugerir o valor do mês;
// - meta diária do SDR definida à mão 20%+ longe da média real do mês → sugerir a média.
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { DETECTORES, configDetectores } from './detectores'
import { premissas, salvarPremissas, type Unidade } from './jornadaPremissas'
import { ETAPAS, NOME_ETAPA, type Etapa } from './etapasJornada'

const DIA = 86_400_000
const EM_MS: Record<Unidade, number> = { MINUTOS: 60_000, HORAS: 3_600_000, DIAS: DIA }
const p75 = (v: number[]) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * 0.75))] }

/** O mês fechado anterior a `agora` (AAAA-MM) e os instantes de começo e fim em Brasília. */
export function mesAnterior(agora = new Date()) {
  const b = new Date(agora.getTime() - 3 * 3_600_000)
  const ini = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth() - 1, 1, 3)), fim = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), 1, 3))
  return { mes: `${ini.getUTCFullYear()}-${String(ini.getUTCMonth() + 1).padStart(2, '0')}`, ini, fim }
}

export async function sugerirAjustes(usuarioId: string, agora = new Date()) {
  const { mes, ini, fim } = mesAnterior(agora)
  const sugestoes: Array<{ parametro: string; valorAtual: unknown; valorSugerido: unknown; justificativa: string }> = []
  // 1. Detectores que erraram muito no mês.
  const cfg = await configDetectores(usuarioId)
  for (const d of DETECTORES) {
    const recs = await prisma.recomendacao.findMany({ where: { usuarioId, detector: d.chave, criadoEm: { gte: ini, lt: fim } }, select: { status: true, avaliacoes: { select: { pertinente: true } } } })
    if (recs.length < 5) continue
    const ruins = recs.filter(r => r.status === 'DESCARTADA' || (r.avaliacoes.length > 0 && r.avaliacoes.every(a => !a.pertinente))).length
    if (ruins * 2 <= recs.length) continue
    const atual = cfg[d.chave].volumeMinimo, novo = Math.ceil(atual * 1.5)
    sugestoes.push({ parametro: `detector.${d.chave}.volumeMinimo`, valorAtual: atual, valorSugerido: novo, justificativa: `${d.nome}: ${ruins} de ${recs.length} recomendações do mês foram descartadas ou avaliadas como não pertinentes. Exigir ${novo} casos (hoje ${atual}) deve reduzir os alarmes fracos.` })
  }
  // 2. Tempo máximo por etapa (só os aprovados à mão) contra o percentil 75 do mês.
  const prem = await premissas(usuarioId)
  const tempos = await prisma.$queryRaw<Array<{ etapa: string; ms: number }>>`
    SELECT h."estagioNovo" etapa, EXTRACT(EPOCH FROM (h."saiuEm" - h."criadoEm")) * 1000 ms
    FROM pro_labore_lead_estagio_historico h JOIN pro_labore_leads l ON l.id = h."leadId"
    WHERE l."usuarioId" = ${usuarioId} AND h."saiuEm" >= ${ini} AND h."saiuEm" < ${fim} AND h."saiuEm" > h."criadoEm"`
  for (const e of ETAPAS) {
    const t = prem.temposMaximos[e as Etapa]
    if (t.fonte !== 'APROVADO' || t.valor == null) continue
    const amostra = tempos.filter(x => x.etapa === e).map(x => Number(x.ms))
    if (amostra.length < 10) continue
    const real = p75(amostra)!, realU = Math.max(1, Math.round(real / EM_MS[t.unidade]))
    if (Math.abs(realU - t.valor) / t.valor < 0.2) continue
    sugestoes.push({ parametro: `tempoMaximo.${e}`, valorAtual: { valor: t.valor, unidade: t.unidade }, valorSugerido: { valor: realU, unidade: t.unidade }, justificativa: `${NOME_ETAPA[e as Etapa]}: 75% dos ${amostra.length} leads que saíram da etapa no mês ficaram até ${realU} ${t.unidade.toLowerCase()}; o tempo máximo aprovado é ${t.valor}.` })
  }
  // 3. Meta diária do SDR definida à mão contra a média real do mês.
  if (prem.metaDiariaSdr.fonte === 'APROVADO' && prem.metaDiariaSdr.valor) {
    const passados = await prisma.leadPassagem.count({ where: { usuarioId, passadaEm: { gte: ini, lt: fim } } })
    const dias = Math.round((fim.getTime() - ini.getTime()) / DIA), media = Math.round((passados / dias) * 10) / 10
    if (passados >= 10 && Math.abs(media - prem.metaDiariaSdr.valor) / prem.metaDiariaSdr.valor >= 0.2) {
      sugestoes.push({ parametro: 'metaDiariaSdr', valorAtual: prem.metaDiariaSdr.valor, valorSugerido: media, justificativa: `No mês, os SDRs passaram ${passados} leads ao vendedor (${media} por dia); a meta definida é ${prem.metaDiariaSdr.valor} por dia.` })
    }
  }
  let criadas = 0
  for (const s of sugestoes) {
    const r = await prisma.sugestaoAjuste.createMany({ data: [{ usuarioId, mes, parametro: s.parametro, valorAtual: s.valorAtual as Prisma.InputJsonValue, valorSugerido: s.valorSugerido as Prisma.InputJsonValue, justificativa: s.justificativa, auditoriaAutor: 'AUTOMACAO|||ajuste-mensal' }], skipDuplicates: true })
    criadas += r.count
  }
  return { mes, sugestoes: criadas }
}

/** Cron diário: no dia 1º (Brasília), gera as sugestões do mês que fechou. */
export async function ajusteMensalTodas(agora = new Date()) {
  if (new Date(agora.getTime() - 3 * 3_600_000).getUTCDate() !== 1) return { sugestoesAjuste: 0 }
  const contas = await prisma.proLaboreUsuario.findMany({ select: { id: true } })
  let n = 0
  for (const c of contas) n += (await sugerirAjustes(c.id, agora).catch(() => ({ sugestoes: 0 }))).sugestoes
  return { sugestoesAjuste: n }
}

/** Aprovar (aplica com a justificativa da sugestão) ou recusar. Só o dono. */
export async function decidirSugestao(usuarioId: string, id: string, aprovar: boolean, autorId: string) {
  const s = await prisma.sugestaoAjuste.findFirst({ where: { id, usuarioId } })
  if (!s) throw new Error('Sugestão não encontrada')
  if (s.status !== 'PENDENTE') throw new Error('Esta sugestão já foi decidida')
  if (aprovar) {
    const justificativa = `Sugestão mensal do ARIES (${s.mes}) aprovada: ${s.justificativa}`
    if (s.parametro.startsWith('detector.')) {
      const [, chave, campo] = s.parametro.split('.')
      const antes = (await configDetectores(usuarioId))[chave]
      await prisma.detector.upsert({ where: { usuarioId_chave: { usuarioId, chave } }, create: { usuarioId, chave, [campo]: s.valorSugerido as number }, update: { [campo]: s.valorSugerido as number } })
      await prisma.parametroHistorico.create({ data: { usuarioId, nome: s.parametro, valorAnterior: antes[campo as 'volumeMinimo'], valorNovo: s.valorSugerido as number, origem: 'HISTORICO', justificativa, autorId } })
    } else if (s.parametro.startsWith('tempoMaximo.')) {
      const etapa = s.parametro.split('.')[1] as Etapa
      await salvarPremissas(usuarioId, { temposMaximos: { [etapa]: s.valorSugerido as { valor: number; unidade: Unidade } } }, { autorId, justificativa })
    } else if (s.parametro === 'metaDiariaSdr') {
      await salvarPremissas(usuarioId, { metaDiariaSdr: s.valorSugerido as number }, { autorId, justificativa })
    }
  }
  return prisma.sugestaoAjuste.update({ where: { id: s.id }, data: { status: aprovar ? 'APROVADA' : 'RECUSADA', decididoPor: autorId, decididoEm: new Date(), auditoriaAutor: `USUARIO|${autorId}|DONO|ajuste` } })
}
