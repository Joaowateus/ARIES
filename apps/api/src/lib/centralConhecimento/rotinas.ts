// PDF 07 · Central de Conhecimento — processamento dos eventos, carga inicial e conferência diária.
// Roda dentro dos jobs que já existem (minuto e dia), em lotes pequenos para caber nos 30 s.
// Processar é idempotente: cada evento manda "remontar este registro a partir da fonte".
// Falha → nova tentativa com espera crescente; a partir da 5ª, a Saúde da Central mostra o alerta.
// Nada falha em silêncio: todo erro fica no evento, na fonte e na Saúde.
import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { logger } from '../logger'
import { FONTES, FONTES_INDEXADAS, fontePorChave, fontePorTabela, type FonteDef } from './fontes'
import { gravarDocs } from './indice'

export const TENTATIVAS_ALERTA = 5
const LOTE = 100
const MIN = 60_000

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500)

async function marcarFonte(usuarioId: string, chave: string, dados: Partial<{ ultimaAtualizacaoEm: Date; ultimoErro: string | null; ultimoErroEm: Date | null; itensIndexados: number; ultimaConferenciaEm: Date; cargaInicialEm: Date; cargaCursor: string | null }>) {
  await prisma.centralFonte.upsert({
    where: { usuarioId_chave: { usuarioId, chave } },
    create: { usuarioId, chave, ...dados, atualizadoEm: new Date() },
    update: { ...dados, atualizadoEm: new Date() },
  })
}

/** Grava (ou rearma) um evento fora do gatilho: sincronizações, carga e conferência. */
export async function enfileirar(fonte: string, registroId: string, usuarioId: string | null, tipo: string, origem: string) {
  await prisma.$executeRaw`
    INSERT INTO pro_labore_cc_eventos ("usuarioId", fonte, "registroId", tipo, origem) VALUES (${usuarioId}, ${fonte}, ${registroId}, ${tipo}, ${origem})
    ON CONFLICT (fonte, "registroId") DO UPDATE SET tipo = EXCLUDED.tipo, origem = EXCLUDED.origem, "criadoEm" = CURRENT_TIMESTAMP, "processadoEm" = NULL,
      tentativas = 0, "ultimoErro" = NULL, "proximaTentativaEm" = NULL, "usuarioId" = COALESCE(EXCLUDED."usuarioId", pro_labore_cc_eventos."usuarioId")`
}

/** Fim de uma sincronização (Instagram, Meta): a fonte inteira daquela loja é remontada na próxima rodada. */
export async function registrarSincronizacao(usuarioId: string, chave: 'instagram' | 'meta', erro?: unknown) {
  try {
    if (erro) { await marcarFonte(usuarioId, chave, { ultimoErro: msg(erro), ultimoErroEm: new Date() }); return }
    await enfileirar(chave, `*:${usuarioId}`, usuarioId, 'SINCRONIZADO', 'SINCRONIZACAO')
    await marcarFonte(usuarioId, chave, { ultimaAtualizacaoEm: new Date(), ultimoErro: null })
  } catch (e) {
    // A sincronização em si não pode falhar por causa da Central; o erro fica no log e a conferência diária recupera.
    logger.warn({ err: e, chave }, 'central: não registrou a sincronização')
  }
}

interface EventoPendente { id: string; usuarioId: string | null; fonte: string; registroId: string; tentativas: number; criadoEm: Date }

async function processarGrupo(def: FonteDef, eventos: EventoPendente[]) {
  // Fonte inteira (dicionário e integrações): remonta tudo da loja.
  if (def.inteira) {
    const lojas = [...new Set(eventos.map(e => e.usuarioId ?? (e.registroId.startsWith('*:') ? e.registroId.slice(2) : null)).filter((x): x is string => !!x))]
    for (const u of lojas) {
      const ids = (await prisma.$queryRaw<Array<{ id: string }>>(def.idsSql!(u))).map(r => r.id)
      const docs = await def.montar!(ids)
      const fonte = def.tabela!
      await gravarDocs(fonte, ids, docs)
      // Sobrou no índice e não existe mais na fonte: sai.
      await prisma.centralDocumento.deleteMany({ where: { fonte, usuarioId: u, registroId: { notIn: ids.length ? ids : ['__nenhum__'] } } })
      await marcarFonte(u, def.chave, { ultimaAtualizacaoEm: new Date(), itensIndexados: docs.length, ultimoErro: null })
    }
    return
  }
  const ids = [...new Set(eventos.map(e => e.registroId))]
  const docs = await def.montar!(ids)
  await gravarDocs(def.tabela!, ids, docs)
  const lojas = new Set([...docs.map(d => d.usuarioId), ...eventos.map(e => e.usuarioId).filter((x): x is string => !!x)])
  for (const u of lojas) await marcarFonte(u, def.chave, { ultimaAtualizacaoEm: new Date(), ultimoErro: null })
}

/** Processa eventos pendentes até acabar o tempo. Devolve quantos foram feitos e quantos falharam. */
export async function processarEventos(limiteMs = 8000, agora = new Date()): Promise<{ centralProcessados: number; centralFalhas: number }> {
  const inicio = Date.now()
  let feitos = 0, falhas = 0
  while (Date.now() - inicio < limiteMs - 1500) {
    const eventos = await prisma.$queryRaw<EventoPendente[]>`
      SELECT id, "usuarioId", fonte, "registroId", tentativas, "criadoEm" FROM pro_labore_cc_eventos
      WHERE "processadoEm" IS NULL AND ("proximaTentativaEm" IS NULL OR "proximaTentativaEm" <= ${agora})
      ORDER BY "criadoEm" LIMIT ${LOTE}`
    if (!eventos.length) break
    const porFonte = new Map<string, EventoPendente[]>()
    for (const e of eventos) porFonte.set(e.fonte, [...(porFonte.get(e.fonte) ?? []), e])
    for (const [fonte, lista] of porFonte) {
      const def = fontePorTabela(fonte) ?? fontePorChave(fonte)
      try {
        if (def?.montar) await processarGrupo(def, lista)
        // Só marca feito o evento que não foi rearmado durante o processamento (mesmo criadoEm).
        for (const e of lista) await prisma.centralEvento.updateMany({ where: { id: e.id, criadoEm: e.criadoEm }, data: { processadoEm: new Date(), ultimoErro: null } })
        feitos += lista.length
      } catch (err) {
        falhas += lista.length
        logger.warn({ err, fonte }, 'central: falha ao processar eventos')
        for (const e of lista) {
          const t = e.tentativas + 1
          // Espera crescente: 1, 2, 4, 8… minutos, no máximo 6 horas.
          await prisma.centralEvento.update({ where: { id: e.id }, data: { tentativas: t, ultimoErro: msg(err), proximaTentativaEm: new Date(Date.now() + Math.min(2 ** (t - 1), 360) * MIN) } }).catch(() => undefined)
        }
        const lojas = new Set(lista.map(e => e.usuarioId).filter((x): x is string => !!x))
        if (def) for (const u of lojas) await marcarFonte(u, def.chave, { ultimoErro: msg(err), ultimoErroEm: new Date() }).catch(() => undefined)
      }
    }
    if (eventos.length < LOTE) break
  }
  return { centralProcessados: feitos, centralFalhas: falhas }
}

/** "Tentar de novo" da Saúde: zera as tentativas dos eventos com erro (de uma fonte ou de um evento). */
export async function tentarDeNovo(usuarioId: string, alvo: { eventoId?: string; fonte?: string }) {
  const def = alvo.fonte ? fontePorChave(alvo.fonte) : null
  const r = await prisma.centralEvento.updateMany({
    where: {
      processadoEm: null, tentativas: { gt: 0 },
      OR: [{ usuarioId }, { registroId: `*:${usuarioId}` }],
      ...(alvo.eventoId ? { id: alvo.eventoId } : {}),
      ...(def ? { fonte: { in: [def.tabela ?? def.chave, def.chave] } } : {}),
    },
    data: { tentativas: 0, proximaTentativaEm: null },
  })
  return { reenviados: r.count }
}

async function lojas(): Promise<string[]> {
  return (await prisma.proLaboreUsuario.findMany({ select: { id: true } })).map(u => u.id)
}

/** Carga inicial em rodadas: cada fonte de cada loja, 200 itens por vez, guardando onde parou. */
export async function cargaInicial(limiteMs = 8000, soLoja?: string): Promise<{ centralCarga: number }> {
  const inicio = Date.now()
  let n = 0
  const salvas = await prisma.centralFonte.findMany({ select: { usuarioId: true, chave: true, cargaInicialEm: true, cargaCursor: true } })
  for (const u of soLoja ? [soLoja] : await lojas()) {
    for (const def of FONTES_INDEXADAS) {
      if (Date.now() - inicio > limiteMs - 1500) return { centralCarga: n }
      const s = salvas.find(x => x.usuarioId === u && x.chave === def.chave)
      if (s?.cargaInicialEm) continue
      const conf = await prisma.centralConferencia.create({ data: { usuarioId: u, fonte: def.chave, tipo: 'CARGA_INICIAL' } })
      try {
        let cursor = s?.cargaCursor ?? ''
        for (;;) {
          if (Date.now() - inicio > limiteMs - 1500) {
            await marcarFonte(u, def.chave, { cargaCursor: cursor })
            await prisma.centralConferencia.update({ where: { id: conf.id }, data: { fim: new Date(), situacao: 'OK', erro: 'Rodada parcial: continua no próximo job' } })
            return { centralCarga: n }
          }
          const ids = (await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT x.id FROM (${def.idsSql!(u)}) x WHERE x.id > ${cursor} ORDER BY x.id LIMIT 200`)).map(r => r.id)
          if (!ids.length) break
          const docs = await def.montar!(ids)
          await gravarDocs(def.tabela!, ids, docs)
          n += docs.length
          cursor = ids[ids.length - 1]
          if (ids.length < 200) break
        }
        const [fonteN, indiceN] = await contagens(def, u)
        await marcarFonte(u, def.chave, { cargaInicialEm: new Date(), cargaCursor: null, ultimaAtualizacaoEm: new Date(), itensIndexados: indiceN, ultimoErro: null })
        await prisma.centralConferencia.update({ where: { id: conf.id }, data: { fim: new Date(), contagemFonte: fonteN, contagemIndice: indiceN, situacao: fonteN === indiceN ? 'OK' : 'DIVERGENTE' } })
      } catch (e) {
        await prisma.centralConferencia.update({ where: { id: conf.id }, data: { fim: new Date(), situacao: 'FALHA', erro: msg(e) } }).catch(() => undefined)
        await marcarFonte(u, def.chave, { ultimoErro: msg(e), ultimoErroEm: new Date() }).catch(() => undefined)
        logger.warn({ err: e, fonte: def.chave }, 'central: falha na carga inicial')
      }
    }
  }
  return { centralCarga: n }
}

async function contagens(def: FonteDef, u: string): Promise<[number, number]> {
  const [f] = await prisma.$queryRaw<Array<{ n: bigint }>>(Prisma.sql`SELECT count(*) n FROM (${def.idsSql!(u)}) x`)
  const i = await prisma.centralDocumento.count({ where: { usuarioId: u, fonte: def.tabela! } })
  return [Number(f.n), i]
}

/**
 * Conferência diária: compara cada fonte com o índice (contagem e quem falta ou sobra).
 * Cada diferença vira uma divergência na Saúde e um evento para corrigir sozinho na próxima rodada.
 * Divergência que não aparece mais é dada como resolvida pela própria conferência.
 */
export async function conferir(limiteMs = 15_000, agora = new Date(), soLoja?: string): Promise<{ centralConferidas: number; centralDivergencias: number }> {
  const inicio = Date.now()
  let conferidas = 0, total = 0
  // Pedido pelo dono ("Conferir agora"): só a loja dele e sem pular o que já foi conferido hoje.
  const feitasHoje = soLoja ? new Set<string>() : new Set((await prisma.centralConferencia.findMany({ where: { tipo: 'DIARIA', inicio: { gte: new Date(agora.getTime() - 20 * 3_600_000) } }, select: { usuarioId: true, fonte: true } })).map(c => `${c.usuarioId}|${c.fonte}`))
  for (const u of soLoja ? [soLoja] : await lojas()) {
    for (const def of FONTES_INDEXADAS) {
      if (Date.now() - inicio > limiteMs - 2000) return { centralConferidas: conferidas, centralDivergencias: total }
      if (feitasHoje.has(`${u}|${def.chave}`)) continue
      const conf = await prisma.centralConferencia.create({ data: { usuarioId: u, fonte: def.chave, tipo: 'DIARIA' } })
      try {
        const fonte = def.tabela!
        const faltam = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT x.id FROM (${def.idsSql!(u)}) x WHERE NOT EXISTS (SELECT 1 FROM pro_labore_cc_documentos d WHERE d.fonte = ${fonte} AND d."registroId" = x.id) LIMIT 500`)
        const sobram = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT d."registroId" id FROM pro_labore_cc_documentos d WHERE d.fonte = ${fonte} AND d."usuarioId" = ${u}
            AND NOT EXISTS (SELECT 1 FROM (${def.idsSql!(u)}) x WHERE x.id = d."registroId") LIMIT 500`)
        const [fonteN, indiceN] = await contagens(def, u)
        const atuais = new Map<string, string>()
        for (const r of faltam) atuais.set(r.id, 'Está na fonte e não está no índice')
        for (const r of sobram) atuais.set(r.id, 'Está no índice e não existe mais na fonte')
        // Se a carga inicial ainda não terminou, faltar é esperado: não abre divergência.
        const salva = await prisma.centralFonte.findUnique({ where: { usuarioId_chave: { usuarioId: u, chave: def.chave } }, select: { cargaInicialEm: true } })
        const abertas = await prisma.centralDivergencia.findMany({ where: { usuarioId: u, fonte: def.chave, resolvidaEm: null } })
        for (const d of abertas) if (!d.registroId || !atuais.has(d.registroId)) await prisma.centralDivergencia.update({ where: { id: d.id }, data: { resolvidaEm: new Date(), resolvidaPor: 'Conferência diária (voltou a bater)' } })
        if (salva?.cargaInicialEm) {
          const jaAbertas = new Set(abertas.map(d => d.registroId))
          for (const [id, descricao] of atuais) {
            if (!jaAbertas.has(id)) await prisma.centralDivergencia.create({ data: { usuarioId: u, fonte: def.chave, registroId: id, descricao } })
            await enfileirar(def.inteira ? def.chave : fonte, def.inteira ? `*:${u}` : id, u, 'ALTERADO', 'CONFERENCIA')
          }
        }
        const n = salva?.cargaInicialEm ? atuais.size : 0
        total += n
        await prisma.centralConferencia.update({ where: { id: conf.id }, data: { fim: new Date(), contagemFonte: fonteN, contagemIndice: indiceN, divergencias: n, situacao: n ? 'DIVERGENTE' : 'OK' } })
        await marcarFonte(u, def.chave, { ultimaConferenciaEm: new Date(), itensIndexados: indiceN })
        conferidas++
      } catch (e) {
        await prisma.centralConferencia.update({ where: { id: conf.id }, data: { fim: new Date(), situacao: 'FALHA', erro: msg(e) } }).catch(() => undefined)
        await marcarFonte(u, def.chave, { ultimoErro: msg(e), ultimoErroEm: new Date() }).catch(() => undefined)
        logger.warn({ err: e, fonte: def.chave }, 'central: falha na conferência')
      }
    }
  }
  return { centralConferidas: conferidas, centralDivergencias: total }
}

export { FONTES }
