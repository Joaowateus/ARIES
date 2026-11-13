// Hoje como painel de comando: os dados dos gráficos (todos do banco, pelo
// mesmo escopo do dicionário). Ritmo do mês (faturamento acumulado dia a dia
// contra a meta e a projeção), séries dos últimos 30 dias para as minilinhas,
// funil do mês por etapa, equipe (vendas e atividades) e origem do faturamento.
// Alcance por papel: vendedor e SDR só os próprios números; equipe por pessoa
// só para dono e supervisor; cifras do dono (pró-labore) só para ele.
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { calcular, hojeBrt, mesCorrente, type Escopo } from './metricas'
import { situacaoDaMeta } from './metaCoerente'
import { nomesDistintos } from './formato'
import { NOME_ETAPA, type Etapa } from './etapasJornada'
import type { PapelHoje } from './papelHoje'

const DIA = 86_400_000
const BRT = 3 * 3_600_000
const r2 = (n: number) => Math.round(n * 100) / 100
const diaIso = (t: number) => new Date(t).toISOString().slice(0, 10)

type Serie = Array<{ dia: string; valor: number }>
function preencher(ini: string, fim: string, linhas: Array<{ dia: string; valor: number }>): Serie {
  const m = new Map(linhas.map(l => [l.dia, l.valor]))
  const out: Serie = []
  for (let t = Date.parse(`${ini}T12:00:00Z`); t <= Date.parse(`${fim}T12:00:00Z`); t += DIA) { const d = diaIso(t); out.push({ dia: d, valor: m.get(d) ?? 0 }) }
  return out
}

export async function painelDoHoje(p: { usuarioId: string; papel: PapelHoje; vendedorId: string | null }, agora = new Date()) {
  const u = p.usuarioId
  const pessoal = p.papel === 'VENDEDOR' || p.papel === 'SDR'
  const vend = pessoal ? (p.vendedorId ?? '__nenhum__') : null
  const filtroVend = vend ? Prisma.sql` AND "vendedorId" = ${vend}` : Prisma.empty
  const hoje = hojeBrt(agora)
  const ini30 = diaIso(Date.parse(`${hoje}T12:00:00Z`) - 29 * DIA)
  const mes = mesCorrente(agora)
  const fimMes = new Date(Date.UTC(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)), 0)).toISOString().slice(0, 10)
  const dono = p.papel === 'DONO'

  // Séries diárias (dia de São Paulo) dos últimos 30 dias e do mês.
  const desde = new Date(Date.parse(`${ini30 < mes.inicio ? ini30 : mes.inicio}T00:00:00Z`))
  const [vendasDia, leadsDia, atvDia] = await Promise.all([
    prisma.$queryRaw<Array<{ dia: string; n: bigint; fat: number | null; pl: number | null }>>`
      SELECT to_char(data, 'YYYY-MM-DD') dia, count(*) n, sum("valorVenda") fat, sum("valorProLabore") pl FROM pro_labore_vendas
      WHERE "usuarioId" = ${u} AND situacao = 'CONFIRMADA' AND data >= ${desde}${filtroVend} GROUP BY 1`,
    prisma.$queryRaw<Array<{ dia: string; n: bigint }>>`
      SELECT to_char("criadoEm" - interval '3 hours', 'YYYY-MM-DD') dia, count(*) n FROM pro_labore_leads
      WHERE "usuarioId" = ${u} AND "criadoEm" >= ${desde}${filtroVend} GROUP BY 1`,
    prisma.$queryRaw<Array<{ dia: string; n: bigint }>>`
      SELECT to_char("executadaEm" - interval '3 hours', 'YYYY-MM-DD') dia, count(*) n FROM pro_labore_atividades
      WHERE "usuarioId" = ${u} AND status = 'EXECUTADA' AND "executadaEm" >= ${desde}${vend ? Prisma.sql` AND "responsavelId" = ${vend}` : Prisma.empty} GROUP BY 1`,
  ])
  const s = (linhas: Array<{ dia: string; valor: number }>, ini: string, fim: string) => preencher(ini, fim, linhas)
  const fat = vendasDia.map(v => ({ dia: v.dia, valor: Number(v.fat ?? 0) }))
  const series: Record<string, Serie> = {
    faturamento: s(fat, ini30, hoje),
    vendas: s(vendasDia.map(v => ({ dia: v.dia, valor: Number(v.n) })), ini30, hoje),
    leads_novos: s(leadsDia.map(v => ({ dia: v.dia, valor: Number(v.n) })), ini30, hoje),
    atividades_feitas: s(atvDia.map(v => ({ dia: v.dia, valor: Number(v.n) })), ini30, hoje),
    ...(dono ? { pro_labore: s(vendasDia.map(v => ({ dia: v.dia, valor: Number(v.pl ?? 0) })), ini30, hoje) } : {}),
  }

  // Ritmo do mês: acumulado dia a dia contra a meta (linha reta até o fim do mês) e a projeção.
  const meta = await situacaoDaMeta(u, agora, vend).catch(() => null)
  let acc = 0
  const diasMes = s(fat, mes.inicio, hoje).map(d => ({ dia: d.dia, acumulado: r2(acc += d.valor) }))
  const ritmo = {
    dias: diasMes, ultimoDia: fimMes, totalDias: Number(fimMes.slice(8, 10)),
    meta: meta?.meta ?? null, previsao: meta?.previsao ?? null, pct: meta?.pct ?? null, faixa: meta?.faixa ?? null, texto: meta?.ritmo ?? null,
    // Para quem não é o dono nem vê faturamento, a escala é em % da meta (sem R$).
    emPct: false,
  }

  // Funil do mês: quantas oportunidades chegaram em cada etapa e quantas seguiram.
  const e: Escopo = { usuarioId: u, papel: pessoal ? p.papel : 'DONO', vendedorId: vend }
  const conv = await calcular('conversao_por_etapa', e, mes, agora).catch(() => null)
  const etapas = ((conv?.detalhe ?? []) as Array<{ etapa: string; chegaram: number; seguiram: number; conversao: number | null }>)
  const comVolume = etapas.filter(x => x.chegaram > 0)
  const gargalo = comVolume.filter(x => x.etapa !== 'VENDA' && x.conversao != null && x.chegaram >= 3).sort((a, b) => (a.conversao ?? 0) - (b.conversao ?? 0))[0]?.etapa ?? null
  const funil = { etapas: etapas.map(x => ({ etapa: x.etapa, nome: NOME_ETAPA[x.etapa as Etapa] ?? x.etapa, chegaram: x.chegaram, seguiram: x.seguiram, conversao: x.conversao })), gargalo }

  // Equipe (dono e supervisor): vendas do mês e atividades feitas e atrasadas por pessoa.
  let equipe: Array<{ id: string; nome: string; vendas: number; faturamento: number | null; feitas: number; atrasadas: number }> | null = null
  if (p.papel === 'DONO' || p.papel === 'SUPERVISOR') {
    const vs = await prisma.vendedor.findMany({ where: { usuarioId: u, ativo: true, funcao: null }, select: { id: true, nome: true, vende: true, papel: true } })
    const nomes = nomesDistintos(vs)
    const iniMes = new Date(`${mes.inicio}T03:00:00Z`)
    const [v, f, a] = await Promise.all([
      prisma.venda.groupBy({ by: ['vendedorId'], where: { usuarioId: u, situacao: 'CONFIRMADA', data: { gte: new Date(`${mes.inicio}T00:00:00Z`) } }, _count: true, _sum: { valorVenda: true } }),
      prisma.atividade.groupBy({ by: ['responsavelId'], where: { usuarioId: u, status: 'EXECUTADA', executadaEm: { gte: iniMes } }, _count: true }),
      prisma.atividade.groupBy({ by: ['responsavelId'], where: { usuarioId: u, status: 'PENDENTE', prazo: { lt: agora } }, _count: true }),
    ])
    equipe = vs.map(x => ({
      id: x.id, nome: nomes.get(x.id) ?? x.nome,
      vendas: v.find(y => y.vendedorId === x.id)?._count ?? 0,
      faturamento: v.find(y => y.vendedorId === x.id)?._sum.valorVenda ?? 0,
      feitas: f.find(y => y.responsavelId === x.id)?._count ?? 0,
      atrasadas: a.find(y => y.responsavelId === x.id)?._count ?? 0,
    })).filter(x => x.vendas || x.feitas || x.atrasadas).sort((a, b) => b.vendas - a.vendas || b.feitas - a.feitas)
  }

  // Origem do faturamento do mês (novos, recuperados e retorno espontâneo).
  const orig = !pessoal ? await calcular('faturamento_por_origem', e, mes, agora).catch(() => null) : null
  const o = (orig?.detalhe ?? {}) as Record<string, number>
  const origem = orig ? [
    { chave: 'NOVO_CLIENTE', nome: 'Novos clientes', valor: o.NOVO_CLIENTE ?? 0 },
    { chave: 'RECUPERADO_CENTRAL', nome: 'Recuperados', valor: o.RECUPERADO_CENTRAL ?? 0 },
    { chave: 'RETORNO_ESPONTANEO', nome: 'Retorno espontâneo', valor: o.RETORNO_ESPONTANEO ?? 0 },
  ] : null

  void BRT
  return { geradoEm: agora.toISOString(), series, ritmo, funil, equipe, origem }
}
