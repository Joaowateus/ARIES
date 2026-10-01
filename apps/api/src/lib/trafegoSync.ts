// Sincronização do Gerenciador de Anúncios: puxa os insights diários por
// anúncio e guarda em TrafegoInsightDiario. Toda rodada refaz os últimos
// dias (a Meta ainda ajusta atribuição/conversões recentes) e, enquanto o
// histórico de 90 dias não estiver completo, vai trazendo blocos antigos —
// em partes, pra caber no tempo da função serverless.
import { prisma } from './prisma'
import { Prisma } from '@prisma/client'
import { buscarEstrutura, buscarInsightsDiarios, erroDeToken, ErroMetaAds, type InsightAnuncioDia } from './metaAds'

export const DIAS_HISTORICO = 90
const DIAS_RECENTES = 4
const DIAS_POR_BLOCO = 15
const PRAZO_MS = 20_000
// Sobe quando entram métricas novas nos insights guardados: o histórico é
// puxado de novo (as linhas antigas não têm as colunas novas preenchidas).
export const VERSAO_DADOS = 2
// Campanhas/conjuntos/anúncios mudam pouco: relê no máximo a cada 30 min
// (ou quando a pessoa pede "Atualizar agora").
const ESTRUTURA_VALIDADE_MS = 30 * 60_000

const DIA_MS = 86_400_000
export const hojeNoFuso = (fuso: string | null) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: fuso || 'America/Sao_Paulo' }).format(new Date())
export const somarDias = (data: string, n: number) => new Date(Date.parse(`${data}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10)
const comoData = (data: string) => new Date(`${data}T00:00:00Z`)

type ContaSync = { id: string; adAccountId: string; accessToken: string; fuso: string | null; historicoDesde: Date | null; versaoDados?: number; estruturaEm?: Date | null }

// Troca tudo de um intervalo de uma vez: anúncio que deixou de ter dado no
// intervalo some junto, sem sobrar linha velha.
async function gravarIntervalo(contaId: string, desde: string, ate: string, linhas: InsightAnuncioDia[]) {
  await prisma.$transaction([
    prisma.trafegoInsightDiario.deleteMany({ where: { contaId, data: { gte: comoData(desde), lte: comoData(ate) } } }),
    prisma.trafegoInsightDiario.createMany({
      data: linhas.map(l => ({ ...l, contaId, data: comoData(l.data) })),
      skipDuplicates: true,
    }),
  ])
}

// Troca a estrutura inteira guardada pela que veio agora (o que sumiu do
// Gerenciador — excluído/arquivado — fica, pra não perder o nome/miniatura
// de anúncios antigos que ainda aparecem no histórico).
async function gravarEstrutura(contaId: string, objetos: Awaited<ReturnType<typeof buscarEstrutura>>['objetos']) {
  const ops = objetos.map(o => prisma.trafegoEstrutura.upsert({
    where: { contaId_tipo_objetoId: { contaId, tipo: o.tipo, objetoId: o.id } },
    create: { contaId, tipo: o.tipo, objetoId: o.id, nome: o.nome, status: o.status, dados: o.dados as Prisma.InputJsonValue },
    update: { nome: o.nome, status: o.status, dados: o.dados as Prisma.InputJsonValue },
  }))
  for (let i = 0; i < ops.length; i += 100) await prisma.$transaction(ops.slice(i, i + 100))
  await prisma.trafegoConta.update({ where: { id: contaId }, data: { estruturaEm: new Date() } })
}

export async function sincronizarEstrutura(conta: ContaSync, prazoEm: number) {
  const r = await buscarEstrutura(conta.adAccountId, conta.accessToken, prazoEm)
  await gravarEstrutura(conta.id, r.objetos)
  return r.objetos.length
}

export interface ResultadoSyncTrafego { diasAtualizados: number; historicoCompleto: boolean; linhas: number }

export async function sincronizarTrafego(conta: ContaSync, opcoes: { forcarEstrutura?: boolean } = {}): Promise<ResultadoSyncTrafego> {
  const prazoEm = Date.now() + PRAZO_MS
  // Formato antigo: recomeça o histórico (as linhas são trocadas por bloco).
  if ((conta.versaoDados ?? VERSAO_DADOS) < VERSAO_DADOS) {
    await prisma.trafegoConta.update({ where: { id: conta.id }, data: { historicoDesde: null, versaoDados: VERSAO_DADOS } })
    conta = { ...conta, historicoDesde: null, versaoDados: VERSAO_DADOS }
  }
  const hoje = hojeNoFuso(conta.fuso)
  const limiteHistorico = somarDias(hoje, -(DIAS_HISTORICO - 1))
  let dias = 0
  let totalLinhas = 0
  try {
    // 1. Últimos dias (sempre).
    const desdeRecente = somarDias(hoje, -(DIAS_RECENTES - 1))
    const recente = await buscarInsightsDiarios(conta.adAccountId, conta.accessToken, desdeRecente, hoje, prazoEm)
    if (!recente.completo) throw new ErroMetaAds('A Meta demorou demais pra responder. Tente de novo em instantes.')
    await gravarIntervalo(conta.id, desdeRecente, hoje, recente.linhas)
    await prisma.trafegoConta.update({ where: { id: conta.id }, data: { acoesMeta: { desde: desdeRecente, ate: hoje, totais: recente.acoes } } })
    dias += DIAS_RECENTES
    totalLinhas += recente.linhas.length

    // 2. Estrutura (status, orçamento, público, criativo). Falhar aqui não
    // derruba a sincronização dos números.
    const estruturaVelha = !conta.estruturaEm || Date.now() - conta.estruturaEm.getTime() > ESTRUTURA_VALIDADE_MS
    if ((opcoes.forcarEstrutura || estruturaVelha) && prazoEm - Date.now() > 6000) {
      await sincronizarEstrutura(conta, prazoEm).catch(e => { if (erroDeToken(e)) throw e })
    }

    // 3. Histórico, do mais novo pro mais velho, enquanto houver tempo.
    let desdeGuardado = conta.historicoDesde ? conta.historicoDesde.toISOString().slice(0, 10) : desdeRecente
    while (desdeGuardado > limiteHistorico && Date.now() < prazoEm) {
      const ate = somarDias(desdeGuardado, -1)
      const desde = [somarDias(ate, -(DIAS_POR_BLOCO - 1)), limiteHistorico].sort().at(-1)!
      const bloco = await buscarInsightsDiarios(conta.adAccountId, conta.accessToken, desde, ate, prazoEm)
      if (!bloco.completo) break
      await gravarIntervalo(conta.id, desde, ate, bloco.linhas)
      desdeGuardado = desde
      dias += DIAS_POR_BLOCO
      totalLinhas += bloco.linhas.length
      await prisma.trafegoConta.update({ where: { id: conta.id }, data: { historicoDesde: comoData(desde) } })
    }
    // Dado de mais de 90 dias sai (a aba analisa até 90 dias).
    await prisma.trafegoInsightDiario.deleteMany({ where: { contaId: conta.id, data: { lt: comoData(limiteHistorico) } } })
    await prisma.trafegoConta.update({
      where: { id: conta.id },
      data: { ultimaSincronizacaoEm: new Date(), ultimoErroSync: null, ...(conta.historicoDesde ? {} : { historicoDesde: comoData(desdeGuardado) }) },
    })
    return { diasAtualizados: dias, historicoCompleto: desdeGuardado <= limiteHistorico, linhas: totalLinhas }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha ao sincronizar com o Gerenciador de Anúncios'
    await prisma.trafegoConta.update({ where: { id: conta.id }, data: { ultimoErroSync: msg } })
    if (erroDeToken(e)) throw new ErroMetaAds(msg, 190)
    throw e
  }
}
