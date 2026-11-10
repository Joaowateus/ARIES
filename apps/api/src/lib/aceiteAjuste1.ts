// Ajuste 1 · teste do Hoje do dono, calculado na própria produção (o dono vê em
// Configurações). As contagens "manuais" são feitas direto no banco, por fora
// do dicionário, para conferir o que o Painel e o Daily mostram.
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { calcular, hojeBrt, mesCorrente, periodoAnterior, type Periodo } from './metricas'
import { ETAPAS } from './etapasJornada'
import { pautaDaily } from './daily'
import { painel, type ParteSecao } from './painel'

const DIA = 86_400_000
const igual = (a: number | null | undefined, b: number | null | undefined) => (a == null && b == null) || (a != null && b != null && Math.abs(a - b) < 0.11)
const instantes = (p: Periodo) => ({ ini: new Date(`${p.inicio}T03:00:00.000Z`), fim: new Date(new Date(`${p.fim}T03:00:00.000Z`).getTime() + DIA) })
const diasDe = (p: Periodo) => Math.round((Date.parse(p.fim) - Date.parse(p.inicio)) / DIA) + 1

export const ITENS_AJUSTE1 = ['numeros', 'jornada', 'modoEquipe', 'decidido', 'comparacao', 'cifras'] as const
export type ItemAjuste1 = typeof ITENS_AJUSTE1[number]
/** Um item por chamada: cada um cabe nos 30 s da função na Vercel. Sem item, roda todos (uso local). */
export async function aceiteAjuste1(usuarioId: string, diaEscolhido: string | null, agora = new Date(), item?: ItemAjuste1) {
  const so = (i: ItemAjuste1) => !item || item === i
  const P = (q: { usuarioId: string; papel: 'DONO' | 'SUPERVISOR' }, per: Periodo, partes: ParteSecao[]) => painel(q, per, {}, agora, partes)
  const ontem = new Date(new Date(`${hojeBrt(agora)}T00:00:00.000Z`).getTime() - DIA).toISOString().slice(0, 10)
  const d = diaEscolhido ?? ontem
  const pDia = { inicio: d, fim: d }
  const { ini, fim } = instantes(pDia)

  const mes = mesCorrente(agora)
  const e = { usuarioId, papel: 'DONO' as const }
  let numeros = null
  if (so('numeros')) {
  // 1) Números de um dia real: contagem direta no banco contra o dicionário, e o que a tela mostra contra o dicionário.
  const [[lr], [vr]] = await Promise.all([
    prisma.$queryRaw<Array<{ n: bigint }>>`SELECT count(*) n FROM pro_labore_leads WHERE "usuarioId" = ${usuarioId} AND "criadoEm" >= ${ini} AND "criadoEm" < ${fim}`,
    prisma.$queryRaw<Array<{ n: bigint; s: number | null }>>`SELECT count(*) n, sum("valorVenda") s FROM pro_labore_vendas WHERE "usuarioId" = ${usuarioId} AND situacao = 'CONFIRMADA' AND data >= ${new Date(`${d}T00:00:00.000Z`)} AND data < ${new Date(Date.parse(`${d}T00:00:00.000Z`) + DIA)}`,
  ])

  const [ln, vn, fn] = await Promise.all([calcular('leads_novos', e, pDia, agora), calcular('vendas', e, pDia, agora), calcular('faturamento', e, pDia, agora)])
  const contagens = [
    { item: `Leads novos em ${d}`, banco: Number(lr.n), dicionario: ln.valor },
    { item: `Vendas confirmadas em ${d}`, banco: Number(vr.n), dicionario: vn.valor },
    { item: `Faturamento em ${d}`, banco: Math.round(Number(vr.s ?? 0) * 100) / 100, dicionario: fn.valor },
  ].map(x => ({ ...x, bate: igual(x.banco, x.dicionario) }))
  // O Daily mostra o que o dicionário calcula (mesmo período e escopo).
  const pauta = await pautaDaily({ usuarioId, papel: 'DONO', vendedorId: null, nome: 'Aceite' }, 'GESTAO', null, agora)
  const daily = []
  for (const b of pauta.blocos) for (const n of b.numeros) {
    const r = await calcular(n.chave, e, n.periodo, agora).catch(() => null)
    const det = r?.detalhe as Record<string, number> | undefined
    const esperado = n.rotulo === 'Posts planejados para hoje' ? det?.planejados ?? null : n.rotulo === 'Clientes recuperados ontem' ? det?.reativados ?? null : n.rotulo === 'Vendas a confirmar' ? det?.vendasAConfirmar ?? null : n.rotulo === 'Pagamentos a aprovar' ? det?.pagamentosAAprovar ?? null : r?.valor ?? null
    daily.push({ bloco: b.nome, numero: n.rotulo, tela: n.valor, dicionario: esperado, bate: igual(n.valor, esperado) })
  }
  const pnl = await P({ usuarioId, papel: 'DONO' }, mes, ['agora'])
  const [fatMes, convMes] = await Promise.all([calcular('faturamento', e, mes, agora), calcular('conversao_lead_venda', e, mes, agora)])
  const painelAgora = [
    { numero: 'Faturamento do mês', tela: pnl.agora!.faturamento.valor, dicionario: fatMes.valor },
    { numero: 'Conversão lead → venda', tela: pnl.agora!.conversao?.valor ?? null, dicionario: convMes.valor },
  ].map(x => ({ ...x, bate: igual(x.tela, x.dicionario) }))

    numeros = { contagens, daily, painel: painelAgora, passa: contagens.every(x => x.bate) && daily.every(x => x.bate) && painelAgora.every(x => x.bate) }
  }

  const mesFechado = (() => { const h = hojeBrt(agora); const a = Number(h.slice(0, 4)), m = Number(h.slice(5, 7)); const pa = m === 1 ? a - 1 : a, pm = m === 1 ? 12 : m - 1; const ult = new Date(Date.UTC(pa, pm, 0)).getUTCDate(); return { inicio: `${pa}-${String(pm).padStart(2, '0')}-01`, fim: `${pa}-${String(pm).padStart(2, '0')}-${ult}` } })()
  let jornada = null
  if (so('jornada')) {
  // 2) Jornada de um mês: conversão, perda e custo contra uma contagem manual no histórico de etapas.
  const pm = await P({ usuarioId, papel: 'DONO' }, mesFechado, ['jornada'])
  const im = instantes(mesFechado)
  const manual = await prisma.$queryRaw<Array<{ etapa: string; chegaram: bigint; seguiram: bigint }>>(Prisma.sql`
    WITH ord AS (SELECT * FROM unnest(${[...ETAPAS] as string[]}::text[]) WITH ORDINALITY AS t(etapa, i)),
    cheg AS (
      SELECT h."leadId", h."estagioNovo" etapa, min(h."criadoEm") em FROM pro_labore_lead_estagio_historico h JOIN pro_labore_leads l ON l.id = h."leadId"
      WHERE l."usuarioId" = ${usuarioId} AND l.etapa IS NOT NULL AND h."criadoEm" >= ${im.ini} AND h."criadoEm" < ${im.fim}
        AND NOT (h."estagioNovo" IN ('MQL','SQL') AND l."formaPagamento" = 'A_VISTA') AND NOT (h."estagioNovo" IN ('AGENDAMENTO','VISITA') AND l."vendaSemVisita")
      GROUP BY 1, 2)
    SELECT c.etapa, count(*) chegaram, count(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM pro_labore_lead_estagio_historico h2 JOIN ord o2 ON o2.etapa = h2."estagioNovo" JOIN ord o1 ON o1.etapa = c.etapa
      WHERE h2."leadId" = c."leadId" AND o2.i > o1.i AND h2."criadoEm" >= c.em)) seguiram
    FROM cheg c GROUP BY 1`)
  const perdasManual = await prisma.$queryRaw<Array<{ etapa: string; n: bigint }>>`SELECT coalesce("estagioPerda", etapa, 'LEAD') etapa, count(*) n FROM pro_labore_leads WHERE "usuarioId" = ${usuarioId} AND "perdidoEm" >= ${im.ini} AND "perdidoEm" < ${im.fim} GROUP BY 1`
  const custoMes = await calcular('custo_por_etapa', e, mesFechado, agora)
  const gastoMes = (custoMes.detalhe as { gasto: number }).gasto
  const pagos = await prisma.$queryRaw<Array<{ etapa: string; n: bigint }>>`
    SELECT h."estagioNovo" etapa, count(DISTINCT h."leadId") n FROM pro_labore_lead_estagio_historico h JOIN pro_labore_leads l ON l.id = h."leadId"
    WHERE l."usuarioId" = ${usuarioId} AND l.etapa IS NOT NULL AND h."criadoEm" >= ${im.ini} AND h."criadoEm" < ${im.fim} AND (l."origemTipo" = 'ANUNCIO' OR l."tipoLead" = 'TRAFEGO')
      AND NOT (h."estagioNovo" IN ('MQL','SQL') AND l."formaPagamento" = 'A_VISTA') AND NOT (h."estagioNovo" IN ('AGENDAMENTO','VISITA') AND l."vendaSemVisita")
    GROUP BY 1`
  const etapasJ = pm.jornada!.etapas.filter(x => x.etapa !== 'VENDA').map(x => {
    const m = manual.find(y => y.etapa === x.etapa)
    const ch = Number(m?.chegaram ?? 0), sg = Number(m?.seguiram ?? 0)
    const convManual = ch ? Math.round((sg / ch) * 1000) / 10 : null
    const perdManual = Number(perdasManual.find(y => y.etapa === x.etapa)?.n ?? 0)
    const nPagos = Number(pagos.find(y => y.etapa === x.etapa)?.n ?? 0)
    const custoManual = gastoMes > 0 && nPagos > 0 ? Math.round((gastoMes / nPagos) * 100) / 100 : null
    return { etapa: x.nome, volume: { tela: x.volume, manual: ch }, conversao: { tela: x.conversao, manual: convManual }, perda: { tela: x.perda.n, manual: perdManual }, custo: { tela: x.custo, manual: custoManual }, bate: x.volume === ch && igual(x.conversao, convManual) && x.perda.n === perdManual && igual(x.custo, custoManual) }
  })

    jornada = { etapas: etapasJ, total: pm.jornada!.etapas.length, passa: pm.jornada!.etapas.length === 10 && etapasJ.every(x => x.bate) }
  }

  let modoEquipe = null
  if (so('modoEquipe')) {
  // 3) Modo equipe: nenhuma orientação individual e nenhum número por pessoa.
  const eq = await pautaDaily({ usuarioId, papel: 'DONO', vendedorId: null, nome: 'Aceite' }, 'EQUIPE', null, agora)
  const individuais = eq.blocos.flatMap(b => b.recs).filter(r => r.individual).length
  const porPessoa = eq.blocos.flatMap(b => b.numeros).filter(n => n.porPessoa).length
  const atvsPessoa = eq.blocos.flatMap(b => b.atividades).length

    modoEquipe = { individuais, porPessoa, atividadesPorPessoa: atvsPessoa, passa: individuais === 0 && porPessoa === 0 && atvsPessoa === 0 }
  }

  let decidido = null
  if (so('decidido')) {
  // 4) "Decidido" vira ATV com origem reunião, e a ata aparece em Reuniões.
  const dailies = await prisma.reuniao.findMany({ where: { usuarioId, tipo: 'DAILY' }, orderBy: { data: 'desc' }, take: 20, select: { id: true, titulo: true, transcricao: true, ata: true } })
  const encerradas = dailies.filter(r => (r.ata as { fim?: string } | null)?.fim)
  const decisoes = encerradas.flatMap(r => ((r.ata as { decisoes?: Array<{ atividadeId: string }> }).decisoes ?? []).map(x => x.atividadeId))
  const atvs = decisoes.length ? await prisma.atividade.findMany({ where: { id: { in: decisoes } }, select: { id: true, origemTipo: true } }) : []

    decidido = { reunioes: encerradas.length, decisoes: decisoes.length, comOrigemReuniao: atvs.filter(a => a.origemTipo === 'REUNIAO').length, passa: encerradas.length ? decisoes.length > 0 && atvs.length === decisoes.length && atvs.every(a => a.origemTipo === 'REUNIAO') && encerradas.every(r => !!r.transcricao) : null }
  }

  let comparacao = null
  if (so('comparacao')) {
  // 5) Sem "−100%" no começo do mês: a comparação usa o mesmo intervalo do mês anterior.
  const ant = periodoAnterior(mes)
  const ind = (await P({ usuarioId, papel: 'DONO' }, mes, ['indicadores'])).indicadores
    const menos100 = ind.filter(i => i && i.variacao === -100 && (i.valor ?? 0) === 0).map(i => i!.nome)

    comparacao = { periodo: mes, anterior: ant, menos100, passa: menos100.length === 0 }
  }

  let cifras = null
  if (so('cifras')) {
  // 6) Supervisor: sem as cifras do dono no Painel e no Daily.
  const sup = await P({ usuarioId, papel: 'SUPERVISOR' }, mes, ['agora', 'jornada', 'indicadores', 'series'])
  const pautaSup = await pautaDaily({ usuarioId, papel: 'SUPERVISOR', vendedorId: null, nome: 'Aceite' }, 'GESTAO', null, agora)
  const cifrasSup = [
    ...(sup.proLabore ? ['pró-labore e comissões'] : []),
    ...sup.indicadores.filter(i => i && ['pro_labore', 'comissoes_pagas', 'gasto_anuncio', 'custo_por_lead'].includes(i.chave)).map(i => i!.nome),
    ...(sup.jornada!.etapas.some(x => x.custo != null || x.valores) ? ['custos e valores por etapa'] : []),
    ...(sup.agora!.custoPorVenda ? ['custo por venda'] : []),
    ...pautaSup.blocos.flatMap(b => b.numeros).filter(n => n.unidade === 'BRL' && ['gasto_anuncio', 'custo_por_lead', 'pro_labore', 'comissoes_pagas'].includes(n.chave)).map(n => n.rotulo),
    ...pautaSup.blocos.filter(b => b.chave === 'GESTAO').flatMap(b => b.recs).map(r => r.titulo),
  ]

    cifras = { supervisorVe: cifrasSup, passa: cifrasSup.length === 0 }
  }

  return { dia: d, mesConferido: mesFechado, numeros, jornada, modoEquipe, decidido, comparacao, cifras }
}
