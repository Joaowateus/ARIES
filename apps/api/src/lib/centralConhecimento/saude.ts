// PDF 07 · Central de Conhecimento — números do topo e a Saúde da Central (só o dono).
import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { envioSeguro } from '../pergunte'
import { FONTES, FONTES_INDEXADAS } from './fontes'
import { frescorDasFontes } from './indice'
import { TENTATIVAS_ALERTA } from './rotinas'
import type { CtxCentral } from './contexto'

const DIA = 86_400_000
const inicioDaSemana = (agora: Date) => {
  const brt = new Date(agora.getTime() - 3 * 3_600_000)
  const dow = (brt.getUTCDay() + 6) % 7
  return new Date(Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate() - dow, 3))
}

/** Itens na fonte e no índice, por fonte indexada (contagem na hora). */
export async function cobertura(usuarioId: string) {
  const linhas = await Promise.all(FONTES_INDEXADAS.map(async def => {
    const [f] = await prisma.$queryRaw<Array<{ n: bigint }>>(Prisma.sql`SELECT count(*) n FROM (${def.idsSql!(usuarioId)}) x`)
    const i = await prisma.centralDocumento.count({ where: { usuarioId, fonte: def.tabela! } })
    return { chave: def.chave, fonte: Number(f.n), indice: i }
  }))
  const fonte = linhas.reduce((s, l) => s + l.fonte, 0)
  const coberto = linhas.reduce((s, l) => s + Math.min(l.fonte, l.indice), 0)
  return { linhas, pct: fonte ? Math.round((coberto / fonte) * 1000) / 10 : 100 }
}

export async function topo(ctx: CtxCentral, agora = new Date()) {
  const u = ctx.pessoa.usuarioId
  const frescor = await frescorDasFontes(u, agora)
  const atrasadas = FONTES.filter(f => f.tipo !== 'NAO_INTEGRADA' && f.papeis.includes(ctx.pessoa.papel) && (frescor.get(f.chave)?.atrasada || frescor.get(f.chave)?.falha))
  const ultima = [...frescor.values()].map(f => f.em).filter((d): d is Date => !!d && d <= agora).sort((a, b) => b.getTime() - a.getTime())[0] ?? null
  const aviso = atrasadas.length ? `Pode haver dado desatualizado em: ${atrasadas.map(f => f.nome).join(', ')}.` : null
  if (ctx.pessoa.papel === 'DONO') {
    const [cob, divergencias] = await Promise.all([cobertura(u), prisma.centralDivergencia.count({ where: { usuarioId: u, resolvidaEm: null } })])
    return {
      papel: 'DONO', ultimaAtualizacao: ultima?.toISOString() ?? null, aviso,
      numeros: [
        { chave: 'cobertura', nome: 'Cobertura das fontes', valor: cob.pct, unidade: 'PCT', detalhe: 'Itens das fontes que já estão no índice de pesquisa' },
        { chave: 'fontes_atrasadas', nome: 'Fontes atrasadas ou com falha', valor: atrasadas.length, unidade: 'QTD', detalhe: atrasadas.map(f => f.nome).join(', ') || 'Todas em dia' },
        { chave: 'divergencias', nome: 'Divergências abertas', valor: divergencias, unidade: 'QTD', detalhe: 'Diferenças entre as fontes e o índice achadas na conferência diária' },
      ],
    }
  }
  const semana = inicioDaSemana(agora)
  const [pesquisas, respondidas, verbetes, semResposta] = await Promise.all([
    prisma.centralPesquisa.count({ where: { usuarioId: u, pessoaId: ctx.pessoa.id, criadoEm: { gte: semana }, resultados: { gt: 0 } } }),
    prisma.pergunteConversa.count({ where: { usuarioId: u, pessoaId: ctx.pessoa.id, criadoEm: { gte: semana }, naoSabe: false } }),
    prisma.assistenteConhecimento.count({ where: { usuarioId: u, status: 'ATIVO', aprovadoEm: { gte: semana } } }),
    prisma.pergunteConversa.count({ where: { usuarioId: u, pessoaId: ctx.pessoa.id, criadoEm: { gte: semana }, naoSabe: true } }),
  ])
  return {
    papel: ctx.pessoa.papel, ultimaAtualizacao: ultima?.toISOString() ?? null, aviso,
    numeros: [
      { chave: 'respondidas', nome: 'Pesquisas e perguntas respondidas na semana', valor: pesquisas + respondidas, unidade: 'QTD', detalhe: `${pesquisas} pesquisa(s) com resultado e ${respondidas} pergunta(s) respondida(s)` },
      { chave: 'verbetes_novos', nome: 'Verbetes novos aprovados', valor: verbetes, unidade: 'QTD', detalhe: 'Conhecimento comercial aprovado nesta semana' },
      { chave: 'sem_resposta', nome: 'Perguntas sem resposta', valor: semResposta, unidade: 'QTD', detalhe: 'Suas perguntas desta semana que a Central não soube responder' },
    ],
  }
}

/** A Saúde da Central (só o dono): fontes, eventos, divergências, perguntas sem resposta e cargas. */
export async function saude(usuarioId: string, agora = new Date()) {
  const [frescor, salvas, cob, eventosErro, pendentes, divergencias, semResposta, erradas, pesquisasVazias, conferencias] = await Promise.all([
    frescorDasFontes(usuarioId, agora),
    prisma.centralFonte.findMany({ where: { usuarioId } }),
    cobertura(usuarioId),
    prisma.centralEvento.findMany({ where: { processadoEm: null, tentativas: { gt: 0 }, OR: [{ usuarioId }, { registroId: `*:${usuarioId}` }] }, orderBy: { criadoEm: 'asc' }, take: 50 }),
    prisma.centralEvento.count({ where: { processadoEm: null, OR: [{ usuarioId }, { registroId: `*:${usuarioId}` }] } }),
    prisma.centralDivergencia.findMany({ where: { usuarioId, resolvidaEm: null }, orderBy: { desde: 'asc' }, take: 100 }),
    prisma.pergunteConversa.findMany({ where: { usuarioId, naoSabe: true, tratadaEm: null, criadoEm: { gte: new Date(agora.getTime() - 30 * DIA) } }, orderBy: { criadoEm: 'desc' }, take: 50, select: { id: true, pergunta: true, papel: true, canal: true, criadoEm: true } }),
    prisma.pergunteConversa.findMany({ where: { usuarioId, marcadaErradaEm: { not: null }, tratadaEm: null }, orderBy: { marcadaErradaEm: 'desc' }, take: 50, select: { id: true, pergunta: true, resposta: true, papel: true, marcadaErradaEm: true } }),
    prisma.centralPesquisa.groupBy({ by: ['termo'], where: { usuarioId, resultados: 0, criadoEm: { gte: new Date(agora.getTime() - 30 * DIA) } }, _count: { _all: true }, orderBy: { _count: { termo: 'desc' } }, take: 20 }),
    prisma.centralConferencia.findMany({ where: { usuarioId }, orderBy: { inicio: 'desc' }, take: 40 }),
  ])
  const fontes = FONTES.map(def => {
    const f = frescor.get(def.chave)
    const s = salvas.find(x => x.chave === def.chave)
    const c = cob.linhas.find(x => x.chave === def.chave)
    const situacao = def.tipo === 'NAO_INTEGRADA' ? 'NAO_INTEGRADA' : f?.falha ? 'FALHA' : f?.atrasada ? 'ATRASADA' : 'EM_DIA'
    return {
      chave: def.chave, nome: def.nome, tipo: def.tipo, descricao: def.descricao, situacao,
      ultimaAtualizacaoEm: f?.em?.toISOString() ?? null, limiteMin: def.limiteMin, pendentes: f?.pendentes ?? 0,
      itensFonte: c?.fonte ?? null, itensIndice: c?.indice ?? null, ultimaConferenciaEm: s?.ultimaConferenciaEm?.toISOString() ?? null,
      cargaInicialEm: s?.cargaInicialEm?.toISOString() ?? null, ultimoErro: situacao === 'FALHA' ? s?.ultimoErro ?? 'Eventos com erro' : null,
    }
  })
  return {
    cobertura: cob.pct, fontes, pendentes,
    eventosComErro: eventosErro.map(e => ({ id: e.id, fonte: e.fonte, registroId: e.registroId, tentativas: e.tentativas, ultimoErro: e.ultimoErro, desde: e.criadoEm, proximaTentativaEm: e.proximaTentativaEm, alerta: e.tentativas >= TENTATIVAS_ALERTA })),
    divergencias, perguntasSemResposta: semResposta, respostasErradas: erradas,
    pesquisasSemResultado: pesquisasVazias.map(p => ({ termo: p.termo, vezes: p._count._all })),
    conferencias,
  }
}

/**
 * Aceite do PDF 07 calculado na produção (só o dono): cobertura, frescor, divergências,
 * proteção do que foi à IA (P1) e o acerto do Pergunte (respostas marcadas como erradas).
 * As 40 perguntas do roteiro (docs/central-conhecimento-aceite.md) são feitas na tela e conferidas aqui.
 */
export async function aceite(usuarioId: string, agora = new Date()) {
  const desde = new Date(agora.getTime() - 30 * DIA)
  const [cob, frescor, divergencias, envios, conversas, erradas, naoSabe] = await Promise.all([
    cobertura(usuarioId), frescorDasFontes(usuarioId, agora),
    prisma.centralDivergencia.count({ where: { usuarioId, resolvidaEm: null } }),
    prisma.iaEnvio.findMany({ where: { usuarioId, criadoEm: { gte: desde }, finalidade: { startsWith: 'AGENTE' } }, select: { id: true, finalidade: true, conteudo: true, criadoEm: true } }),
    prisma.pergunteConversa.count({ where: { usuarioId, criadoEm: { gte: desde } } }),
    prisma.pergunteConversa.count({ where: { usuarioId, criadoEm: { gte: desde }, marcadaErradaEm: { not: null } } }),
    prisma.pergunteConversa.count({ where: { usuarioId, criadoEm: { gte: desde }, naoSabe: true } }),
  ])
  const inseguros = envios.filter(e => !envioSeguro(e.conteudo) || /\bnascimento\b\s*[:=]/i.test(e.conteudo))
  const atrasadas = FONTES.filter(f => frescor.get(f.chave)?.atrasada || frescor.get(f.chave)?.falha).map(f => f.nome)
  const acerto = conversas ? Math.round(((conversas - erradas) / conversas) * 1000) / 10 : null
  const itens = [
    { item: 'Cobertura das fontes ≥ 99%', valor: `${cob.pct}%`, passa: cob.pct >= 99 },
    { item: 'Nenhuma fonte atrasada ou com falha', valor: atrasadas.join(', ') || 'todas em dia', passa: !atrasadas.length },
    { item: 'Nenhuma divergência aberta', valor: String(divergencias), passa: divergencias === 0 },
    { item: 'Nada de R$, CPF ou data no que foi à IA (30 dias)', valor: `${envios.length} envio(s), ${inseguros.length} com problema`, passa: !inseguros.length },
    { item: 'Acerto do Pergunte ≥ 95% (respostas não marcadas como erradas, 30 dias)', valor: acerto == null ? 'sem perguntas ainda' : `${acerto}% de ${conversas}`, passa: acerto != null && acerto >= 95 && conversas >= 40 },
  ]
  return { itens, passa: itens.every(i => i.passa), naoSabe, inseguros: inseguros.slice(0, 20).map(e => ({ id: e.id, finalidade: e.finalidade, criadoEm: e.criadoEm })) }
}
