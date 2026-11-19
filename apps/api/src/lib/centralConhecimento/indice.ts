// PDF 07 · Central de Conhecimento — índice de pesquisa no próprio Postgres.
// Pesquisa textual em português (tsvector) sobre o texto já sem acento, mais a
// pesquisa aproximada por trigramas (pg_trgm) para erros de digitação, quando a
// extensão existe. Toda pesquisa filtra no servidor: primeiro pelo papel e pelo
// autor (anotações), depois pela regra fina de cada fonte (`visiveis`), igual às telas.
import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { FONTES, fontePorChave, fontePorTabela, NOME_TIPO, type Doc, type TipoDoc } from './fontes'
import type { CtxCentral } from './contexto'

/** Texto de busca: sem acento, minúsculo, só letras, números e alguns sinais. */
export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9#@/.\-\s]/g, ' ').replace(/\s+/g, ' ').trim()
}
export const textoDoDoc = (d: Pick<Doc, 'titulo' | 'resumo' | 'palavrasChave'>) => normalizar([d.titulo, d.resumo ?? '', ...d.palavrasChave].join(' '))

/** Grava (ou atualiza) os itens montados e tira do índice os ids pedidos que não voltaram (registro apagado). */
export async function gravarDocs(fonte: string, idsPedidos: string[], docs: Doc[]): Promise<{ gravados: number; removidos: number }> {
  if (docs.length) {
    const linhas = docs.map(d => Prisma.sql`(${d.usuarioId}, ${d.fonte}, ${d.registroId}, ${d.tipo}, ${d.titulo}, ${d.resumo}, ${d.palavrasChave}::text[], ${textoDoDoc(d)}, ${d.papeis}::text[], ${d.vendedorId}, ${d.autorId}, ${d.link}, ${d.dataRegistro}::timestamp, ${d.versaoFonte}::timestamp, CURRENT_TIMESTAMP)`)
    await prisma.$executeRaw`
      INSERT INTO pro_labore_cc_documentos ("usuarioId", fonte, "registroId", tipo, titulo, resumo, "palavrasChave", "textoBusca", papeis, "vendedorId", "autorId", link, "dataRegistro", "versaoFonte", "atualizadoEm")
      VALUES ${Prisma.join(linhas)}
      ON CONFLICT (fonte, "registroId") DO UPDATE SET
        "usuarioId" = EXCLUDED."usuarioId", tipo = EXCLUDED.tipo, titulo = EXCLUDED.titulo, resumo = EXCLUDED.resumo, "palavrasChave" = EXCLUDED."palavrasChave",
        "textoBusca" = EXCLUDED."textoBusca", papeis = EXCLUDED.papeis, "vendedorId" = EXCLUDED."vendedorId", "autorId" = EXCLUDED."autorId", link = EXCLUDED.link,
        "dataRegistro" = EXCLUDED."dataRegistro", "versaoFonte" = EXCLUDED."versaoFonte", "atualizadoEm" = CURRENT_TIMESTAMP`
  }
  const voltaram = new Set(docs.map(d => d.registroId))
  const sumiram = idsPedidos.filter(id => !voltaram.has(id))
  // O índice é uma cópia de leitura: tirar dele o que sumiu da fonte não apaga dado nenhum.
  const r = sumiram.length ? await prisma.centralDocumento.deleteMany({ where: { fonte, registroId: { in: sumiram } } }) : { count: 0 }
  return { gravados: docs.length, removidos: r.count }
}

// --- Pesquisa ---

let esquemaTrgm: string | null | undefined
/** Esquema da extensão pg_trgm (Supabase costuma usar "extensions"); null = sem pesquisa aproximada. */
export async function trigramas(): Promise<string | null> {
  if (esquemaTrgm !== undefined) return esquemaTrgm
  try {
    const [r] = await prisma.$queryRaw<Array<{ esquema: string }>>`SELECT n.nspname esquema FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pg_trgm'`
    esquemaTrgm = r?.esquema ?? null
  } catch { esquemaTrgm = null }
  return esquemaTrgm
}

export interface ResultadoBusca {
  id: string; tipo: TipoDoc; tipoNome: string; fonte: string; fonteNome: string
  titulo: string; resumo: string | null; link: string; data: string | null
  atualizadoEm: string; fonteAtualizadaEm: string | null; fonteAtrasada: boolean
}
export interface OpcoesBusca { tipos?: TipoDoc[]; desde?: Date | null; ate?: Date | null; vendedorId?: string | null; limitePorTipo?: number; incluirAnotacoes?: boolean }

const escaparLike = (s: string) => s.replace(/[\\%_]/g, m => `\\${m}`)

export async function buscar(ctx: CtxCentral, termo: string, o: OpcoesBusca = {}): Promise<{ grupos: Array<{ tipo: TipoDoc; nome: string; itens: ResultadoBusca[] }>; total: number }> {
  const q = normalizar(termo).slice(0, 120)
  if (q.length < 2) return { grupos: [], total: 0 }
  const p = ctx.pessoa
  const trgm = await trigramas()
  const digitos = termo.replace(/\D/g, '')
  const meu = p.vendedorId ?? `DONO:${p.usuarioId}`
  const filtros: Prisma.Sql[] = [Prisma.sql`d."usuarioId" = ${p.usuarioId}`]
  if (p.papel !== 'DONO') filtros.push(Prisma.sql`${p.papel} = ANY(d.papeis)`)
  // Anotações: só as de quem pesquisa (e nunca para a IA).
  filtros.push(o.incluirAnotacoes === false ? Prisma.sql`d.tipo <> 'ANOTACAO'` : Prisma.sql`(d.tipo <> 'ANOTACAO' OR d."autorId" = ${meu})`)
  if (o.tipos?.length) filtros.push(Prisma.sql`d.tipo = ANY(${o.tipos}::text[])`)
  if (o.desde) filtros.push(Prisma.sql`d."dataRegistro" >= ${o.desde}`)
  if (o.ate) filtros.push(Prisma.sql`d."dataRegistro" <= ${o.ate}`)
  if (o.vendedorId) filtros.push(Prisma.sql`d."vendedorId" = ${o.vendedorId}`)
  const like = `%${escaparLike(q)}%`
  const casa: Prisma.Sql[] = [Prisma.sql`d.tsv @@ websearch_to_tsquery('portuguese', ${q})`, Prisma.sql`d."textoBusca" LIKE ${like}`]
  if (digitos.length >= 4) casa.push(Prisma.sql`d."textoBusca" LIKE ${`%final ${digitos.slice(-4)}%`}`)
  if (trgm && q.length >= 4) casa.push(Prisma.sql`${Prisma.raw(`"${trgm}"`)}.word_similarity(${q}, d."textoBusca") >= 0.5`)
  const sim = trgm ? Prisma.sql`${Prisma.raw(`"${trgm}"`)}.word_similarity(${q}, d."textoBusca")` : Prisma.sql`0`
  const linhas = await prisma.$queryRaw<Array<{ id: string; fonte: string; registroId: string; tipo: TipoDoc; titulo: string; resumo: string | null; link: string; dataRegistro: Date | null; atualizadoEm: Date }>>`
    SELECT d.id, d.fonte, d."registroId", d.tipo, d.titulo, d.resumo, d.link, d."dataRegistro", d."atualizadoEm"
    FROM pro_labore_cc_documentos d
    WHERE ${Prisma.join(filtros, ' AND ')} AND (${Prisma.join(casa, ' OR ')})
    ORDER BY (lower(d.titulo) = ${termo.trim().toLowerCase()}) DESC,
             ts_rank(d.tsv, websearch_to_tsquery('portuguese', ${q})) + (CASE WHEN d."textoBusca" LIKE ${like} THEN 0.3 ELSE 0 END) + ${sim} * 0.2 DESC,
             d."dataRegistro" DESC NULLS LAST
    LIMIT 400`
  // Regra fina de cada fonte (as mesmas das telas).
  const porFonte = new Map<string, string[]>()
  for (const l of linhas) porFonte.set(l.fonte, [...(porFonte.get(l.fonte) ?? []), l.registroId])
  const pode = new Map<string, Set<string>>()
  await Promise.all([...porFonte].map(async ([fonte, ids]) => {
    const def = fontePorTabela(fonte)
    pode.set(fonte, def?.visiveis ? await def.visiveis(ctx, ids) : new Set())
  }))
  const frescor = await frescorDasFontes(p.usuarioId)
  const limite = o.limitePorTipo ?? 20
  const grupos = new Map<TipoDoc, ResultadoBusca[]>()
  for (const l of linhas) {
    if (!pode.get(l.fonte)?.has(l.registroId)) continue
    const g = grupos.get(l.tipo) ?? []
    if (g.length >= limite) continue
    const def = fontePorTabela(l.fonte)
    const f = def ? frescor.get(def.chave) : undefined
    g.push({
      id: l.id, tipo: l.tipo, tipoNome: NOME_TIPO[l.tipo], fonte: def?.chave ?? l.fonte, fonteNome: def?.nome ?? l.fonte,
      titulo: l.titulo, resumo: l.resumo, link: l.link, data: l.dataRegistro?.toISOString() ?? null, atualizadoEm: l.atualizadoEm.toISOString(),
      fonteAtualizadaEm: f?.em?.toISOString() ?? null, fonteAtrasada: f?.atrasada ?? false,
    })
    grupos.set(l.tipo, g)
  }
  const lista = [...grupos].map(([tipo, itens]) => ({ tipo, nome: NOME_TIPO[tipo], itens }))
  return { grupos: lista, total: lista.reduce((s, g) => s + g.itens.length, 0) }
}

// --- Frescor ---

export interface Frescor { em: Date | null; atrasada: boolean; falha: boolean; pendentes: number; maisAntigoPendente: Date | null }

/** Hora da última atualização de cada fonte e se passou do limite aceito (calculado na hora). */
export async function frescorDasFontes(usuarioId: string, agora = new Date()): Promise<Map<string, Frescor>> {
  const [salvas, pend, zap] = await Promise.all([
    prisma.centralFonte.findMany({ where: { usuarioId } }),
    prisma.$queryRaw<Array<{ fonte: string; n: bigint; antigo: Date; falhas: bigint }>>`
      SELECT fonte, count(*) n, min("criadoEm") antigo, count(*) FILTER (WHERE tentativas >= 5) falhas
      FROM pro_labore_cc_eventos WHERE "processadoEm" IS NULL AND ("usuarioId" = ${usuarioId} OR "registroId" = ${`*:${usuarioId}`}) GROUP BY fonte`,
    prisma.$queryRaw<Array<{ ultima: Date | null }>>`
      SELECT max(m."criadoEm") ultima FROM pro_labore_assistente_mensagens m
      JOIN pro_labore_assistente_conversas cv ON cv.id = m."conversaId" JOIN pro_labore_assistente_comercial a ON a.id = cv."assistenteId"
      JOIN pro_labore_vendedores v ON v.id = a."vendedorId" WHERE v."usuarioId" = ${usuarioId} AND m."criadoEm" > ${new Date(agora.getTime() - 30 * 86_400_000)}`.catch(() => [{ ultima: null }]),
  ])
  const mapa = new Map<string, Frescor>()
  for (const def of FONTES) {
    const s = salvas.find(x => x.chave === def.chave)
    const pe = pend.find(x => fontePorTabela(x.fonte)?.chave === def.chave)
    const pendentes = Number(pe?.n ?? 0)
    const antigo = pe?.antigo ?? null
    let em = s?.ultimaAtualizacaoEm ?? null
    if (def.chave === 'whatsapp') em = zap[0]?.ultima ?? null
    if (def.chave === 'historico') em = agora
    let atrasada = false
    if (def.tipo === 'NAO_INTEGRADA') atrasada = false
    else if (antigo && agora.getTime() - antigo.getTime() > def.limiteMin * 60_000) atrasada = true
    // Integrações: atrasada se a última sincronização passou do limite (o WhatsApp só conta se já houve mensagens).
    else if (def.tipo === 'INTEGRACAO' && def.chave !== 'whatsapp' && s?.ultimaAtualizacaoEm && agora.getTime() - s.ultimaAtualizacaoEm.getTime() > def.limiteMin * 60_000) atrasada = true
    const falha = Number(pe?.falhas ?? 0) > 0 || (!!s?.ultimoErroEm && (!s.ultimaAtualizacaoEm || s.ultimoErroEm > s.ultimaAtualizacaoEm))
    mapa.set(def.chave, { em, atrasada, falha, pendentes, maisAntigoPendente: antigo })
  }
  return mapa
}

export { fontePorChave }
