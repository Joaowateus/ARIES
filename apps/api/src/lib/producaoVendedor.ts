/**
 * Painel de produção do vendedor (Meu Painel — Visão mensal / Visão anual).
 * Toda métrica aqui deriva só de Contrato (vendas fechadas), pra bater com
 * "faturamento" nas outras telas. A meta trimestral e a anual não existem
 * como registro próprio — são derivadas da meta mensal (supermetaFaturamentoMes
 * × 3 / × 12), já que a empresa hoje só configura meta por mês.
 *
 * Meses/trimestres futuros que ainda não fecharam usam projeção: o mês
 * corrente é extrapolado pelo ritmo diário atual (produção até hoje ÷ dias
 * decorridos × dias no mês); meses futuros que nem começaram usam a média
 * dos últimos até-3 meses já fechados como estimativa. É uma aproximação
 * deliberada — não tem como prever o futuro com precisão, só dar um norte.
 */

const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

interface ContratoResumo {
  valorTotal: number
  criadoEm: Date
}

interface DiaProducao {
  dia: number
  realizado: number | null
  metaLinear: number
}

interface MesBalanco {
  mes: number
  label: string
  valor: number
  variacaoPct: number | null
  projetado: boolean
}

interface Trimestre {
  numero: number
  label: string
  realizado: number
  meta: number
  percentual: number
  status: 'FECHADO' | 'PROJETADO'
}

export interface ProducaoDashboard {
  producaoMesAteHoje: number
  variacaoProducaoMesPct: number | null
  vendasRealizadasMes: number
  variacaoVendasMes: number | null
  ticketMedio: number
  variacaoTicketMedioPct: number | null
  taxaConversao: number
  variacaoConversaoPP: number | null

  producaoDiaria: DiaProducao[]
  diaAtual: number
  diasNoMes: number
  ritmoDiarioAtual: number
  projecaoFimMes: number
  metaMes: number
  percentualMetaMes: number
  percentualProjecaoMes: number
  faltaParaMeta: number
  diasRestantesMes: number
  ritmoNecessarioRestante: number

  balancoMensal: MesBalanco[]
  trimestres: Trimestre[]
  metaAnual: number
  producaoAnualAcumulada: number
  percentualMetaAnual: number
  projecaoFechamentoAnual: number
  percentualProjecaoAnual: number
  faltaAnual: number
}

function diasNoMesDe(ano: number, mes: number): number {
  return new Date(ano, mes + 1, 0).getDate()
}

function somaPeriodo(contratos: ContratoResumo[], inicio: Date, fim: Date): { total: number; qtd: number } {
  const doPeriodo = contratos.filter(c => c.criadoEm >= inicio && c.criadoEm <= fim)
  return { total: doPeriodo.reduce((s, c) => s + c.valorTotal, 0), qtd: doPeriodo.length }
}

function variacaoPct(atual: number, anterior: number): number | null {
  if (anterior === 0) return null
  return (atual - anterior) / anterior
}

export function calcularProducaoVendedor(
  contratosAno: ContratoResumo[],
  leadsPorMes: number[], // índice 0 = jan, contagem de novos leads entrados no funil naquele mês
  metaMensal: number,
  agora: Date
): ProducaoDashboard {
  const ano = agora.getFullYear()
  const mesAtual = agora.getMonth() // 0-indexado
  const diaAtual = agora.getDate()
  const diasNoMes = diasNoMesDe(ano, mesAtual)

  const inicioMesAtual = new Date(ano, mesAtual, 1)
  const fimHoje = agora

  // --- Produção do mês até hoje, vs mesmo período do mês anterior ---
  const { total: producaoMesAteHoje, qtd: vendasRealizadasMes } = somaPeriodo(contratosAno, inicioMesAtual, fimHoje)

  const mesAnteriorIdx = mesAtual === 0 ? 11 : mesAtual - 1
  const anoMesAnterior = mesAtual === 0 ? ano - 1 : ano
  const diasNoMesAnterior = diasNoMesDe(anoMesAnterior, mesAnteriorIdx)
  const inicioMesAnterior = new Date(anoMesAnterior, mesAnteriorIdx, 1)
  const fimMesAnterior = new Date(anoMesAnterior, mesAnteriorIdx, diasNoMesAnterior, 23, 59, 59, 999)
  const fimMesmoPeriodoAnterior = new Date(anoMesAnterior, mesAnteriorIdx, Math.min(diaAtual, diasNoMesAnterior), 23, 59, 59, 999)

  // Se hoje é janeiro, o "mês anterior" é dezembro do ano passado — fora do
  // array (que só traz o ano corrente), então soma zero naturalmente.
  const { total: producaoMesmoPeriodoAnterior, qtd: vendasMesmoPeriodoAnterior } =
    somaPeriodo(contratosAno, inicioMesAnterior, fimMesmoPeriodoAnterior)

  const variacaoProducaoMesPct = variacaoPct(producaoMesAteHoje, producaoMesmoPeriodoAnterior)
  const variacaoVendasMes = vendasMesmoPeriodoAnterior > 0 || vendasRealizadasMes > 0 ? vendasRealizadasMes - vendasMesmoPeriodoAnterior : null

  // --- Ticket médio e conversão, vs mês anterior completo ---
  const ticketMedio = vendasRealizadasMes > 0 ? producaoMesAteHoje / vendasRealizadasMes : 0
  const { total: producaoMesAnteriorCompleto, qtd: vendasMesAnteriorCompleto } = somaPeriodo(contratosAno, inicioMesAnterior, fimMesAnterior)
  const ticketMedioMesAnterior = vendasMesAnteriorCompleto > 0 ? producaoMesAnteriorCompleto / vendasMesAnteriorCompleto : 0
  const variacaoTicketMedioPct = variacaoPct(ticketMedio, ticketMedioMesAnterior)

  const leadsMesAtual = leadsPorMes[mesAtual] ?? 0
  const leadsMesAnterior = leadsPorMes[mesAnteriorIdx] ?? 0
  const taxaConversao = leadsMesAtual > 0 ? vendasRealizadasMes / leadsMesAtual : 0
  const taxaConversaoMesAnterior = leadsMesAnterior > 0 ? vendasMesAnteriorCompleto / leadsMesAnterior : 0
  const variacaoConversaoPP = leadsMesAnterior > 0 ? taxaConversao - taxaConversaoMesAnterior : null

  // --- Produção diária acumulada do mês corrente ---
  const producaoDiaria: DiaProducao[] = []
  let acumulado = 0
  const contratosDoMes = contratosAno.filter(c => c.criadoEm >= inicioMesAtual && c.criadoEm.getMonth() === mesAtual)
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const doDia = contratosDoMes.filter(c => c.criadoEm.getDate() === dia)
    acumulado += doDia.reduce((s, c) => s + c.valorTotal, 0)
    producaoDiaria.push({
      dia,
      realizado: dia <= diaAtual ? acumulado : null, // null = ainda não chegou nesse dia
      metaLinear: (metaMensal / diasNoMes) * dia,
    })
  }

  const ritmoDiarioAtual = diaAtual > 0 ? producaoMesAteHoje / diaAtual : 0
  const projecaoFimMes = ritmoDiarioAtual * diasNoMes
  const percentualMetaMes = metaMensal > 0 ? producaoMesAteHoje / metaMensal : 0
  const percentualProjecaoMes = metaMensal > 0 ? projecaoFimMes / metaMensal : 0
  const faltaParaMeta = Math.max(0, metaMensal - producaoMesAteHoje)
  const diasRestantesMes = Math.max(0, diasNoMes - diaAtual)
  const ritmoNecessarioRestante = diasRestantesMes > 0 ? faltaParaMeta / diasRestantesMes : 0

  // --- Balanço entre meses (ano corrente, até o mês atual) ---
  const valoresPorMes: number[] = []
  for (let m = 0; m <= mesAtual; m++) {
    if (m === mesAtual) {
      valoresPorMes.push(producaoMesAteHoje) // valor real parcial; a barra usa a projeção, calculada abaixo
    } else {
      const dNoMes = diasNoMesDe(ano, m)
      const { total } = somaPeriodo(contratosAno, new Date(ano, m, 1), new Date(ano, m, dNoMes, 23, 59, 59, 999))
      valoresPorMes.push(total)
    }
  }

  const balancoMensal: MesBalanco[] = valoresPorMes.map((valorReal, m) => {
    const projetado = m === mesAtual
    const valor = projetado ? projecaoFimMes : valorReal
    const valorMesAnterior = m > 0 ? valoresPorMes[m - 1] : null
    return {
      mes: m,
      label: MESES_LABEL[m],
      valor,
      variacaoPct: valorMesAnterior != null ? variacaoPct(valor, valorMesAnterior) : null,
      projetado,
    }
  })

  // --- Trimestres ---
  const mesesFechados = valoresPorMes.slice(0, mesAtual) // sem o mês corrente
  const mediaUltimosFechados = (() => {
    const ultimos = mesesFechados.slice(-3)
    if (ultimos.length === 0) return projecaoFimMes // sem histórico ainda — usa o ritmo do mês corrente como proxy
    return ultimos.reduce((s, v) => s + v, 0) / ultimos.length
  })()

  const trimestres: Trimestre[] = [0, 1, 2, 3].map(q => {
    const mesesDoTrimestre = [q * 3, q * 3 + 1, q * 3 + 2]
    let realizado = 0
    let temMesFuturo = false
    for (const m of mesesDoTrimestre) {
      if (m < mesAtual) realizado += valoresPorMes[m] ?? 0
      else if (m === mesAtual) realizado += projecaoFimMes
      else {
        realizado += mediaUltimosFechados
        temMesFuturo = true
      }
    }
    const incluiMesAtual = mesesDoTrimestre.includes(mesAtual)
    const meta = metaMensal * 3
    return {
      numero: q + 1,
      label: `${q + 1}º trimestre`,
      realizado,
      meta,
      percentual: meta > 0 ? realizado / meta : 0,
      status: incluiMesAtual || temMesFuturo ? 'PROJETADO' : 'FECHADO',
    }
  })

  // --- Ano ---
  const metaAnual = metaMensal * 12
  const producaoAnualAcumulada = contratosAno.reduce((s, c) => s + c.valorTotal, 0)
  const percentualMetaAnual = metaAnual > 0 ? producaoAnualAcumulada / metaAnual : 0

  const somaFechados = mesesFechados.reduce((s, v) => s + v, 0)
  const mesesFuturosRestantes = 11 - mesAtual
  const projecaoFechamentoAnual = somaFechados + projecaoFimMes + mesesFuturosRestantes * mediaUltimosFechados
  const percentualProjecaoAnual = metaAnual > 0 ? projecaoFechamentoAnual / metaAnual : 0
  const faltaAnual = metaAnual - projecaoFechamentoAnual

  return {
    producaoMesAteHoje,
    variacaoProducaoMesPct,
    vendasRealizadasMes,
    variacaoVendasMes,
    ticketMedio,
    variacaoTicketMedioPct,
    taxaConversao,
    variacaoConversaoPP,

    producaoDiaria,
    diaAtual,
    diasNoMes,
    ritmoDiarioAtual,
    projecaoFimMes,
    metaMes: metaMensal,
    percentualMetaMes,
    percentualProjecaoMes,
    faltaParaMeta,
    diasRestantesMes,
    ritmoNecessarioRestante,

    balancoMensal,
    trimestres,
    metaAnual,
    producaoAnualAcumulada,
    percentualMetaAnual,
    projecaoFechamentoAnual,
    percentualProjecaoAnual,
    faltaAnual,
  }
}
