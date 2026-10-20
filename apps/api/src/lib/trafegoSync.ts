// Sincronização do Gerenciador de Anúncios, em três partes:
// 1. Totais por dia da conta inteira (TrafegoContaDiario): é o número do
//    rodapé do Gerenciador, com tudo (pausados, arquivados, excluídos). Uma
//    consulta só traz 13 meses; é a fonte oficial do gasto e dos totais.
// 2. Detalhe por anúncio (TrafegoInsightDiario): toda rodada refaz os
//    últimos dias (a Meta ainda ajusta atribuição/conversões recentes) e vai
//    completando o histórico de 90 dias em blocos que se ajustam ao tempo de
//    resposta da Meta, pra caber no tempo da função serverless.
// 3. Estrutura (status, orçamento, público, criativo) com o tempo que sobrar.
import { prisma } from './prisma'
import { Prisma } from '@prisma/client'
import { buscarEstrutura, buscarInsightsDiarios, buscarTotaisDiariosConta, erroDeDemora, erroDeToken, ErroMetaAds, type InsightAnuncioDia, type TotaisContaDia } from './metaAds'
import { causaDoErroMeta, registrarBloqueio, registrarLiberacao } from './metaConexao'

export const DIAS_HISTORICO = 90
const DIAS_RECENTES = 4
// Totais da conta: do dia 1 de 12 meses atrás até hoje (o Dashboard compara
// os meses do ano); depois, cada rodada refaz só os últimos 35 dias.
const MESES_TOTAIS = 12
const DIAS_TOTAIS_REFAZER = 35
// Blocos do histórico por anúncio: começam pequenos e crescem enquanto a
// Meta responde rápido (um bloco que não termina no prazo não grava nada).
const BLOCO_INICIAL = 3
const BLOCO_MAXIMO = 15
const BLOCO_RAPIDO_MS = 4_000
const PRAZO_MS = 20_000
// Sobe quando muda o que é guardado por anúncio: o histórico é puxado de
// novo. 3: anúncios arquivados/excluídos e novos contatos de mensagem.
export const VERSAO_DADOS = 3
// Campanhas/conjuntos/anúncios mudam pouco: relê no máximo a cada 30 min
// (ou quando a pessoa pede "Atualizar agora").
const ESTRUTURA_VALIDADE_MS = 30 * 60_000

const DIA_MS = 86_400_000
export const hojeNoFuso = (fuso: string | null) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: fuso || 'America/Sao_Paulo' }).format(new Date())
export const somarDias = (data: string, n: number) => new Date(Date.parse(`${data}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10)
const comoData = (data: string) => new Date(`${data}T00:00:00Z`)
const comoTexto = (d: Date) => d.toISOString().slice(0, 10)
/** Primeiro dia guardado nos totais da conta (dia 1 de 12 meses atrás). */
export function inicioDosTotais(hoje: string): string {
  const [a, m] = hoje.split('-').map(Number)
  const t = new Date(Date.UTC(a, m - 1 - MESES_TOTAIS, 1))
  return comoTexto(t)
}

type ContaSync = {
  id: string; usuarioId: string; adAccountId: string; accessToken: string; fuso: string | null; historicoDesde: Date | null
  versaoDados?: number; estruturaEm?: Date | null; totaisDesde?: Date | null; totaisEm?: Date | null
}

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

async function gravarTotais(contaId: string, desde: string, ate: string, dias: TotaisContaDia[]) {
  await prisma.$transaction([
    prisma.trafegoContaDiario.deleteMany({ where: { contaId, data: { gte: comoData(desde), lte: comoData(ate) } } }),
    prisma.trafegoContaDiario.createMany({
      data: dias.map(d => ({ ...d, contaId, data: comoData(d.data) })),
      skipDuplicates: true,
    }),
  ])
}

/** Totais por dia da conta inteira: 13 meses na primeira vez, depois os últimos 35 dias. */
export async function sincronizarTotais(conta: ContaSync, prazoEm: number): Promise<{ desde: string; dias: number }> {
  const hoje = hojeNoFuso(conta.fuso)
  const alvo = inicioDosTotais(hoje)
  const jaTem = conta.totaisDesde && comoTexto(conta.totaisDesde) <= alvo
  const desde = jaTem ? somarDias(hoje, -(DIAS_TOTAIS_REFAZER - 1)) : alvo
  const r = await buscarTotaisDiariosConta(conta.adAccountId, conta.accessToken, desde, hoje, prazoEm)
  if (!r.completo) throw new ErroMetaAds('A Meta demorou demais pra responder. Tente de novo em instantes.')
  await gravarTotais(conta.id, desde, hoje, r.dias)
  await prisma.trafegoContaDiario.deleteMany({ where: { contaId: conta.id, data: { lt: comoData(alvo) } } })
  await prisma.trafegoConta.update({ where: { id: conta.id }, data: { totaisEm: new Date(), ...(jaTem ? {} : { totaisDesde: comoData(alvo) }) } })
  return { desde, dias: r.dias.length }
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

export interface ResultadoSyncTrafego { diasAtualizados: number; historicoCompleto: boolean; linhas: number; diasTotais: number }

export async function sincronizarTrafego(conta: ContaSync, opcoes: { forcarEstrutura?: boolean; prazoMs?: number } = {}): Promise<ResultadoSyncTrafego> {
  const prazoEm = Date.now() + (opcoes.prazoMs ?? PRAZO_MS)
  // Formato antigo: recomeça o histórico por anúncio (as linhas são trocadas por bloco).
  if ((conta.versaoDados ?? VERSAO_DADOS) < VERSAO_DADOS) {
    await prisma.trafegoConta.update({ where: { id: conta.id }, data: { historicoDesde: null, versaoDados: VERSAO_DADOS } })
    conta = { ...conta, historicoDesde: null, versaoDados: VERSAO_DADOS }
  }
  const hoje = hojeNoFuso(conta.fuso)
  const limiteHistorico = somarDias(hoje, -(DIAS_HISTORICO - 1))
  let dias = 0
  let totalLinhas = 0
  try {
    // 1. Totais da conta (oficiais, iguais ao rodapé do Gerenciador).
    const totais = await sincronizarTotais(conta, prazoEm)

    // 2. Últimos dias por anúncio (sempre).
    const desdeRecente = somarDias(hoje, -(DIAS_RECENTES - 1))
    const recente = await buscarInsightsDiarios(conta.adAccountId, conta.accessToken, desdeRecente, hoje, prazoEm)
    if (!recente.completo) throw new ErroMetaAds('A Meta demorou demais pra responder. Tente de novo em instantes.')
    await gravarIntervalo(conta.id, desdeRecente, hoje, recente.linhas)
    await prisma.trafegoConta.update({ where: { id: conta.id }, data: { acoesMeta: { desde: desdeRecente, ate: hoje, totais: recente.acoes } } })
    dias += DIAS_RECENTES
    totalLinhas += recente.linhas.length

    // 3. Estrutura antes do histórico só se nunca foi lida (nomes e status).
    if (!conta.estruturaEm && prazoEm - Date.now() > 6000) {
      await sincronizarEstrutura(conta, prazoEm).catch(e => { if (erroDeToken(e)) throw e })
    }

    // 4. Histórico por anúncio, do mais novo pro mais velho, enquanto houver tempo.
    let desdeGuardado = conta.historicoDesde && comoTexto(conta.historicoDesde) <= desdeRecente ? comoTexto(conta.historicoDesde) : desdeRecente
    let tamanho = BLOCO_INICIAL
    while (desdeGuardado > limiteHistorico && Date.now() < prazoEm - 1500) {
      const ate = somarDias(desdeGuardado, -1)
      const desde = [somarDias(ate, -(tamanho - 1)), limiteHistorico].sort().at(-1)!
      const comecou = Date.now()
      // Demora da Meta num bloco não derruba a rodada: continua na próxima.
      const bloco = await buscarInsightsDiarios(conta.adAccountId, conta.accessToken, desde, ate, prazoEm)
        .catch(e => { if (erroDeDemora(e)) return { linhas: [], completo: false, acoes: {} }; throw e })
      if (!bloco.completo) {
        // Não coube no tempo: na próxima volta (ou rodada), um dia por vez.
        if (tamanho === 1) break
        tamanho = 1
        continue
      }
      await gravarIntervalo(conta.id, desde, ate, bloco.linhas)
      desdeGuardado = desde
      dias += Math.round((Date.parse(ate) - Date.parse(desde)) / DIA_MS) + 1
      totalLinhas += bloco.linhas.length
      await prisma.trafegoConta.update({ where: { id: conta.id }, data: { historicoDesde: comoData(desde) } })
      if (Date.now() - comecou < BLOCO_RAPIDO_MS) tamanho = Math.min(BLOCO_MAXIMO, tamanho * 2)
    }
    // Detalhe por anúncio de mais de 90 dias sai (a aba analisa até 90 dias).
    await prisma.trafegoInsightDiario.deleteMany({ where: { contaId: conta.id, data: { lt: comoData(limiteHistorico) } } })

    // 5. Estrutura velha (ou pedida em "Atualizar agora") com o tempo que sobrar.
    const estruturaVelha = !!conta.estruturaEm && Date.now() - conta.estruturaEm.getTime() > ESTRUTURA_VALIDADE_MS
    if (conta.estruturaEm && (opcoes.forcarEstrutura || estruturaVelha) && prazoEm - Date.now() > 6000) {
      await sincronizarEstrutura(conta, prazoEm).catch(e => { if (erroDeToken(e)) throw e })
    }

    await prisma.trafegoConta.update({
      where: { id: conta.id },
      data: { ultimaSincronizacaoEm: new Date(), ultimoErroSync: null, historicoDesde: comoData(desdeGuardado) },
    })
    await registrarLiberacao(conta.usuarioId, new Date(), 'TRAFEGO').catch(() => false)
    return { diasAtualizados: dias, historicoCompleto: desdeGuardado <= limiteHistorico, linhas: totalLinhas, diasTotais: totais.dias }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha ao sincronizar com o Gerenciador de Anúncios'
    await prisma.trafegoConta.update({ where: { id: conta.id }, data: { ultimoErroSync: msg } })
    if (e instanceof ErroMetaAds && causaDoErroMeta(e.codigo, e.original) === 'APP_BLOQUEADO') await registrarBloqueio(conta.usuarioId, 'TRAFEGO', e.original ?? msg).catch(() => {})
    if (erroDeToken(e)) throw new ErroMetaAds(msg, 190)
    throw e
  }
}

/**
 * Rodada automática (cron a cada 15 min): contas com o histórico por anúncio
 * incompleto, totais nunca lidos ou última atualização com mais de 1 hora.
 */
export async function sincronizarTrafegoPendentes(prazoMs: number): Promise<{ trafegoSincronizadas: number; trafegoFalhas: number }> {
  const limite = new Date(Date.now() - 60 * 60_000)
  const contas = await prisma.trafegoConta.findMany()
  const pendentes = contas.filter(c => {
    const hoje = hojeNoFuso(c.fuso)
    const historicoIncompleto = !c.historicoDesde || comoTexto(c.historicoDesde) > somarDias(hoje, -(DIAS_HISTORICO - 1)) || (c.versaoDados ?? 0) < VERSAO_DADOS
    return historicoIncompleto || !c.totaisEm || !c.ultimaSincronizacaoEm || c.ultimaSincronizacaoEm < limite
  })
  const fim = Date.now() + prazoMs
  let ok = 0, falhas = 0
  for (const c of pendentes) {
    const resta = fim - Date.now()
    if (resta < 5000) break
    try { await sincronizarTrafego(c, { prazoMs: resta }); ok++ } catch { falhas++ }
  }
  return { trafegoSincronizadas: ok, trafegoFalhas: falhas }
}
