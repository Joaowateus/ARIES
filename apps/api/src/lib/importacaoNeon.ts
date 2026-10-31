// Importação do histórico do banco antigo (Neon) para o banco atual. Só lê
// o Neon (NEON_DATABASE_URL, cadastrada na Vercel): nada lá é alterado.
//
// Como funciona, sem lista fixa de tabelas:
// 1. A conta é achada nos dois bancos pelo e-mail do dono.
// 2. Seleção: a partir da conta antiga, segue as chaves estrangeiras (e as
//    colunas "usuarioId" sem relação declarada) e junta todas as linhas que
//    são da conta, tabela por tabela, na ordem das dependências.
// 3. Simulação: quanto entra de cada tabela, quanto já existe e as vendas
//    que parecem repetidas (mesmo dia e valor). Nada é gravado.
// 4. Importação em rodadas (o servidor tem tempo limitado por chamada):
//    copia as colunas que existem nos dois lados, troca o id da conta antiga
//    pelo da atual e, quando o registro já existe (ex.: a mesma vendedora
//    cadastrada de novo), aponta os dependentes para o que já existe em vez
//    de duplicar. Rodar de novo não duplica (ON CONFLICT DO NOTHING).
import { PrismaClient } from '@prisma/client'
import { prisma } from './prisma'

export class ErroImportacao extends Error { constructor(readonly status: number, message: string) { super(message) } }

const TABELA_DONO = 'pro_labore_usuarios'
const LOTE = 200
const MAX_FALHAS = 50
// Mesmo registro cadastrado de novo no banco atual: casa por estas colunas (sem diferenciar maiúsculas).
const CHAVES_NATURAIS: Record<string, string[]> = {
  pro_labore_vendedores: ['nome'],
  pro_labore_leads: ['telefone'],
}
// Nomes amigáveis no relatório (o resto aparece pelo nome da tabela).
export const ROTULOS: Record<string, string> = {
  pro_labore_vendas: 'Vendas',
  pro_labore_vendedores: 'Vendedores',
  pro_labore_leads: 'Leads',
  pro_labore_parametros: 'Parâmetros da conta',
  pro_labore_funil_mensal: 'Funil mensal',
  pro_labore_gastos_anuncios: 'Gastos com anúncios',
  pro_labore_agenda_itens: 'Agenda',
  pro_labore_pagamentos_comissao: 'Pagamentos de comissão',
  pro_labore_lancamentos_financeiros: 'Financeiro',
  pro_labore_notas: 'Anotações',
  pro_labore_reunioes: 'Reuniões',
}

let clienteFonte: PrismaClient | null = null
export const neonConfigurado = () => !!process.env.NEON_DATABASE_URL
function fonte(): PrismaClient {
  const url = process.env.NEON_DATABASE_URL
  if (!url) throw new ErroImportacao(400, 'A variável NEON_DATABASE_URL não está cadastrada na Vercel')
  clienteFonte ??= new PrismaClient({ datasources: { db: { url } } })
  return clienteFonte
}
type Banco = Pick<PrismaClient, '$queryRawUnsafe' | '$executeRawUnsafe'>
const q = (n: string) => `"${n.replace(/"/g, '""')}"`

// --- Estrutura (do banco atual; do Neon só as colunas) ---

interface Tabela { nome: string; colunas: string[]; fks: Array<{ coluna: string; ref: string }>; uniques: string[][]; temId: boolean }

async function colunas(db: Banco) {
  const linhas = await db.$queryRawUnsafe<Array<{ t: string; c: string }>>(`SELECT table_name AS t, column_name AS c FROM information_schema.columns WHERE table_schema = 'public'`)
  const m = new Map<string, Set<string>>()
  for (const l of linhas) m.set(l.t, (m.get(l.t) ?? new Set()).add(l.c))
  return m
}

async function estrutura() {
  const [cols, fks, idx] = await Promise.all([
    colunas(prisma),
    prisma.$queryRawUnsafe<Array<{ t: string; c: string; ref: string }>>(`
      SELECT c.relname AS t, a.attname AS c, rc.relname AS ref
      FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid JOIN pg_class rc ON rc.oid = k.confrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.conkey[1]
      WHERE k.contype = 'f' AND n.nspname = 'public' AND array_length(k.conkey, 1) = 1`),
    prisma.$queryRawUnsafe<Array<{ t: string; pk: boolean; cols: string[] }>>(`
      SELECT c.relname AS t, i.indisprimary AS pk, array_agg(a.attname::text ORDER BY k.ord) AS cols
      FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN LATERAL unnest(i.indkey) WITH ORDINALITY k(attnum, ord) ON true
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
      WHERE n.nspname = 'public' AND i.indisunique AND i.indpred IS NULL AND i.indexprs IS NULL
      GROUP BY c.relname, i.indexrelid, i.indisprimary`),
  ])
  const tabelas = new Map<string, Tabela>()
  for (const [nome, cs] of cols) {
    if (nome === '_prisma_migrations') continue
    const pk = idx.find(i => i.t === nome && i.pk)?.cols
    tabelas.set(nome, {
      nome, colunas: [...cs], temId: pk?.length === 1 && pk[0] === 'id',
      fks: fks.filter(f => f.t === nome).map(f => ({ coluna: f.c, ref: f.ref })),
      uniques: idx.filter(i => i.t === nome && !i.pk).map(i => i.cols),
    })
  }
  // Ordem das dependências: quem é referenciado vem antes (ciclos e auto-referências no fim da fila).
  const ordem: string[] = [], feito = new Set<string>()
  const pendentes = [...tabelas.keys()].sort()
  while (pendentes.length) {
    const i = pendentes.findIndex(n => tabelas.get(n)!.fks.every(f => f.ref === n || feito.has(f.ref) || !tabelas.has(f.ref)))
    const n = pendentes.splice(i >= 0 ? i : 0, 1)[0]
    ordem.push(n); feito.add(n)
  }
  return { tabelas, ordem }
}

// --- Contas ---

async function donoPorEmail(db: Banco, email: string) {
  const r = await db.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM ${q(TABELA_DONO)} WHERE lower(email) = lower($1) LIMIT 1`, email)
  return r[0]?.id ?? null
}

// --- Seleção: as linhas da conta antiga, tabela por tabela ---

type Selecao = Record<string, string[]>

async function selecionar(est: Awaited<ReturnType<typeof estrutura>>, colsFonte: Map<string, Set<string>>, donoAntigo: string): Promise<Selecao> {
  const sel = new Map<string, Set<string>>([[TABELA_DONO, new Set([donoAntigo])]])
  for (let passada = 0; passada < 4; passada++) {
    let cresceu = false
    for (const nome of est.ordem) {
      const t = est.tabelas.get(nome)!
      const cf = colsFonte.get(nome)
      if (nome === TABELA_DONO || !t.temId || !cf) continue
      const conds: string[] = [], params: string[][] = []
      for (const f of t.fks) {
        const ids = sel.get(f.ref)
        if (ids?.size && cf.has(f.coluna)) { params.push([...ids]); conds.push(`${q(f.coluna)}::text = ANY($${params.length}::text[])`) }
      }
      // usuarioId sem relação declarada (tabelas mais novas): também é da conta.
      if (cf.has('usuarioId') && !t.fks.some(f => f.coluna === 'usuarioId')) { params.push([donoAntigo]); conds.push(`"usuarioId"::text = ANY($${params.length}::text[])`) }
      if (!conds.length) continue
      const linhas = await fonte().$queryRawUnsafe<Array<{ id: string }>>(`SELECT id::text AS id FROM ${q(nome)} WHERE ${conds.join(' OR ')}`, ...params)
      const atual = sel.get(nome) ?? new Set<string>()
      const antes = atual.size
      for (const l of linhas) atual.add(l.id)
      if (atual.size) sel.set(nome, atual)
      if (atual.size !== antes) cresceu = true
    }
    if (!cresceu) break
  }
  sel.delete(TABELA_DONO)
  return Object.fromEntries([...sel].map(([k, v]) => [k, [...v]]))
}

// --- Estado (no banco atual) ---

interface Resultado { inseridos: number; existentes: number; casados: number; falhas: number }
interface Estado {
  donoAntigo: string
  selecao: Selecao
  ordem: string[]
  cursor: { tabela: number; posicao: number }
  mapa: Record<string, Record<string, string>>
  resultado: Record<string, Resultado>
  falhas: Array<{ tabela: string; id: string; erro: string }>
}

async function lerEstado(usuarioId: string) {
  return prisma.importacaoNeon.findUnique({ where: { usuarioId } })
}

// --- Simulação ---

export async function statusImportacao(usuarioId: string) {
  const e = await lerEstado(usuarioId)
  return {
    configurado: neonConfigurado(),
    status: e?.status ?? null,
    simuladoEm: e?.simuladoEm ?? null,
    iniciadoEm: e?.iniciadoEm ?? null,
    concluidoEm: e?.concluidoEm ?? null,
    relatorio: e?.relatorio ?? null,
    progresso: e ? progresso(e.estado as unknown as Estado) : null,
  }
}

function progresso(est: Estado) {
  const total = Object.values(est.selecao).reduce((s, l) => s + l.length, 0)
  let feitos = 0
  for (const [i, nome] of est.ordem.entries()) {
    const n = est.selecao[nome]?.length ?? 0
    if (i < est.cursor.tabela) feitos += n
    else if (i === est.cursor.tabela) feitos += Math.min(n, est.cursor.posicao)
  }
  const soma = (k: keyof Resultado) => Object.values(est.resultado).reduce((s, r) => s + r[k], 0)
  return { total, feitos, inseridos: soma('inseridos'), existentes: soma('existentes'), casados: soma('casados'), falhas: soma('falhas'), ultimasFalhas: est.falhas.slice(-10) }
}

export async function simularImportacao(usuarioId: string) {
  const dono = await prisma.proLaboreUsuario.findUnique({ where: { id: usuarioId }, select: { email: true } })
  if (!dono) throw new ErroImportacao(404, 'Conta não encontrada')
  const atual = await lerEstado(usuarioId)
  if (atual?.status === 'IMPORTANDO') throw new ErroImportacao(409, 'A importação está em andamento: continue de onde parou')
  let colsFonte: Map<string, Set<string>>, donoAntigo: string | null
  try {
    colsFonte = await colunas(fonte())
    donoAntigo = await donoPorEmail(fonte(), dono.email)
  } catch (e) {
    if (e instanceof ErroImportacao) throw e
    throw new ErroImportacao(502, `Não foi possível ler o banco antigo: ${e instanceof Error ? e.message.split('\n').filter(Boolean).slice(-1)[0] : 'erro desconhecido'}. Se o Neon ainda estiver suspenso pela cota do mês, tente depois da renovação.`)
  }
  if (!donoAntigo) throw new ErroImportacao(404, `Não achei a conta ${dono.email} no banco antigo`)
  const est = await estrutura()
  const selecao = await selecionar(est, colsFonte, donoAntigo)

  const ultimaMigracao = await fonte().$queryRawUnsafe<Array<{ n: string }>>(`SELECT migration_name AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1`).catch(() => [])
  const tabelas = []
  for (const nome of est.ordem) {
    const ids = selecao[nome]
    if (!ids?.length) continue
    const existentes = new Set((await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id::text AS id FROM ${q(nome)} WHERE id::text = ANY($1::text[])`, ids)).map(x => x.id))
    const casados = await contarCasados(est.tabelas.get(nome)!, ids.filter(id => !existentes.has(id)), donoAntigo, usuarioId)
    const n = existentes.size
    const temData = colsFonte.get(nome)?.has('criadoEm')
    const periodo = temData ? (await fonte().$queryRawUnsafe<Array<{ de: Date | null; ate: Date | null }>>(`SELECT min("criadoEm") AS de, max("criadoEm") AS ate FROM ${q(nome)} WHERE id::text = ANY($1::text[])`, ids))[0] : null
    const semNoDestino = colsFonte.get(nome)!.size - [...colsFonte.get(nome)!].filter(c => est.tabelas.get(nome)!.colunas.includes(c)).length
    tabelas.push({ tabela: nome, rotulo: ROTULOS[nome] ?? null, total: ids.length, jaExistem: n, casados, novos: ids.length - n - casados, de: periodo?.de ?? null, ate: periodo?.ate ?? null, colunasIgnoradas: semNoDestino })
  }
  // Vendas que parecem repetidas: mesmo dia e mesmo valor já lançados no banco atual.
  let vendasRepetidas = 0
  const idsVendas = selecao.pro_labore_vendas ?? []
  if (idsVendas.length) {
    const antigas = await fonte().$queryRawUnsafe<Array<{ id: string; dia: string; valor: number }>>(`SELECT id::text AS id, to_char(data, 'YYYY-MM-DD') AS dia, "valorVenda"::float8 AS valor FROM pro_labore_vendas WHERE id::text = ANY($1::text[])`, idsVendas)
    const atuais = await prisma.$queryRawUnsafe<Array<{ id: string; dia: string; valor: number }>>(`SELECT id::text AS id, to_char(data, 'YYYY-MM-DD') AS dia, "valorVenda"::float8 AS valor FROM pro_labore_vendas WHERE "usuarioId" = $1`, usuarioId)
    const chaves = new Set(atuais.map(v => `${v.dia}|${v.valor}`)), idsAtuais = new Set(atuais.map(v => v.id))
    vendasRepetidas = antigas.filter(v => !idsAtuais.has(v.id) && chaves.has(`${v.dia}|${v.valor}`)).length
  }
  const [inicioAtual] = await prisma.$queryRawUnsafe<Array<{ de: Date | null }>>(`SELECT min("criadoEm") AS de FROM pro_labore_vendas WHERE "usuarioId" = $1`, usuarioId)
  const relatorio = {
    ultimaMigracaoFonte: ultimaMigracao[0]?.n ?? null,
    contaAntigaIgual: donoAntigo === usuarioId,
    tabelas, vendasRepetidas,
    vendasNoAtualDesde: inicioAtual?.de ?? null,
    total: tabelas.reduce((s, t) => s + t.novos, 0),
  }
  const estado: Estado = { donoAntigo, selecao, ordem: est.ordem.filter(n => selecao[n]?.length), cursor: { tabela: 0, posicao: 0 }, mapa: { [TABELA_DONO]: { [donoAntigo]: usuarioId } }, resultado: {}, falhas: [] }
  const dados = { status: 'SIMULADO', relatorio: relatorio as object, estado: estado as unknown as object, simuladoEm: new Date(), iniciadoEm: null, concluidoEm: null }
  await prisma.importacaoNeon.upsert({ where: { usuarioId }, create: { usuarioId, ...dados }, update: dados })
  return statusImportacao(usuarioId)
}

/**
 * Quantos registros novos vão ser casados com um que já existe no banco atual (mesma chave única
 * ou chave natural, como o nome da vendedora): na importação eles não entram, só apontam para o existente.
 */
async function contarCasados(t: Tabela, ids: string[], donoAntigo: string, usuarioId: string) {
  const natural = CHAVES_NATURAIS[t.nome] && t.colunas.includes('usuarioId') ? CHAVES_NATURAIS[t.nome] : null
  const chaves = [...t.uniques, ...(natural ? [natural] : [])].filter(ch => !ch.includes('id'))
  if (!ids.length || !chaves.length) return 0
  const norm = (v: unknown, nat: boolean) => (v == null ? null : nat ? String(v).trim().toLowerCase() : typeof v === 'object' ? JSON.stringify(v) : String(v))
  const conjuntos = await Promise.all(chaves.map(async ch => {
    const nat = ch === natural
    const filtro = ch.includes('usuarioId') || nat ? `WHERE "usuarioId" = $1` : ''
    const linhas = await prisma.$queryRawUnsafe<Array<{ j: string }>>(`SELECT json_build_array(${ch.map(q).join(', ')})::text AS j FROM ${q(t.nome)} ${filtro}`, ...(filtro ? [usuarioId] : []))
    return new Set(linhas.map(l => (JSON.parse(l.j) as unknown[]).map(v => norm(v, nat)).join('|')))
  }))
  let n = 0
  for (let i = 0; i < ids.length; i += 1000) {
    const brutas = await fonte().$queryRawUnsafe<Array<{ j: string }>>(`SELECT row_to_json(x)::text AS j FROM ${q(t.nome)} x WHERE id::text = ANY($1::text[])`, ids.slice(i, i + 1000))
    for (const b of brutas) {
      const l = JSON.parse(b.j.split(donoAntigo).join(usuarioId)) as Record<string, unknown>
      if (chaves.some((ch, k) => ch.every(c => l[c] != null) && conjuntos[k].has(ch.map(c => norm(l[c], ch === natural)).join('|')))) n++
    }
  }
  return n
}

// --- Importação em rodadas ---

/** Procura no banco atual o registro que ocupa o lugar deste (mesma chave única ou chave natural). */
async function existenteNoDestino(t: Tabela, linha: Record<string, unknown>, usuarioId: string): Promise<string | null> {
  const chaves = [...t.uniques]
  for (const ch of chaves) {
    if (!ch.every(c => linha[c] != null)) continue
    const r = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id::text AS id FROM ${q(t.nome)} WHERE ${ch.map((c, i) => `${q(c)}::text = $${i + 1}`).join(' AND ')} LIMIT 1`, ...ch.map(c => (typeof linha[c] === 'object' ? JSON.stringify(linha[c]) : String(linha[c]))))
    if (r[0]) return r[0].id
  }
  const natural = CHAVES_NATURAIS[t.nome]
  if (natural && t.colunas.includes('usuarioId') && natural.every(c => typeof linha[c] === 'string' && (linha[c] as string).trim())) {
    const r = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id::text AS id FROM ${q(t.nome)} WHERE "usuarioId" = $1 AND ${natural.map((c, i) => `lower(trim(${q(c)})) = lower(trim($${i + 2}))`).join(' AND ')} LIMIT 1`, usuarioId, ...natural.map(c => linha[c] as string))
    if (r[0]) return r[0].id
  }
  return null
}

export async function rodarImportacao(usuarioId: string, prazoMs = 20_000) {
  const registro = await lerEstado(usuarioId)
  if (!registro || !['SIMULADO', 'IMPORTANDO'].includes(registro.status)) throw new ErroImportacao(400, 'Faça a simulação antes de importar')
  const inicio = Date.now()
  const e = registro.estado as unknown as Estado
  if (registro.status === 'SIMULADO') await prisma.importacaoNeon.update({ where: { usuarioId }, data: { status: 'IMPORTANDO', iniciadoEm: new Date() } })
  const est = await estrutura()
  const colsFonte = await colunas(fonte())
  const salvar = (status = 'IMPORTANDO', concluido = false) => prisma.importacaoNeon.update({ where: { usuarioId }, data: { status, estado: e as unknown as object, ...(concluido ? { concluidoEm: new Date() } : {}) } })

  let lotes = 0
  while (e.cursor.tabela < e.ordem.length) {
    // Toda rodada anda pelo menos um lote; depois respeita o prazo.
    if (lotes > 0 && Date.now() - inicio > prazoMs) { await salvar(); return statusImportacao(usuarioId) }
    const nome = e.ordem[e.cursor.tabela]
    const t = est.tabelas.get(nome)
    const ids = e.selecao[nome] ?? []
    const r = (e.resultado[nome] ??= { inseridos: 0, existentes: 0, casados: 0, falhas: 0 })
    if (!t || e.cursor.posicao >= ids.length) { e.cursor = { tabela: e.cursor.tabela + 1, posicao: 0 }; continue }
    const lote = ids.slice(e.cursor.posicao, e.cursor.posicao + LOTE)
    const comuns = t.colunas.filter(c => colsFonte.get(nome)?.has(c))
    const brutas = await fonte().$queryRawUnsafe<Array<{ j: string }>>(`SELECT row_to_json(x)::text AS j FROM ${q(nome)} x WHERE id::text = ANY($1::text[])`, lote)
    const mapaDe = (ref: string) => (e.mapa[ref] ??= {})
    const linhas: Array<Record<string, unknown>> = []
    for (const b of brutas) {
      // A conta antiga vira a atual em qualquer lugar da linha (inclui "dono:<id>" e JSON).
      const linha = JSON.parse(b.j.split(e.donoAntigo).join(usuarioId)) as Record<string, unknown>
      for (const f of t.fks) { const v = linha[f.coluna]; if (typeof v === 'string' && e.mapa[f.ref]?.[v]) linha[f.coluna] = e.mapa[f.ref][v] }
      const so: Record<string, unknown> = {}
      for (const c of comuns) so[c] = linha[c]
      linhas.push(so)
    }
    // Chave natural (ex.: a mesma vendedora cadastrada de novo): aponta para a que já existe e não insere.
    const paraInserir: typeof linhas = []
    for (const l of linhas) {
      const natural = CHAVES_NATURAIS[nome] ? await existenteNoDestino({ ...t, uniques: [] }, l, usuarioId) : null
      if (natural && natural !== l.id) { mapaDe(nome)[String(l.id)] = natural; r.casados++ } else paraInserir.push(l)
    }
    const inserir = async (lista: typeof linhas) => {
      const sql = `INSERT INTO ${q(nome)} (${comuns.map(q).join(', ')}) SELECT ${comuns.map(q).join(', ')} FROM json_populate_recordset(NULL::${q(nome)}, $1::json) ON CONFLICT DO NOTHING RETURNING id::text AS id`
      return new Set((await prisma.$queryRawUnsafe<Array<{ id: string }>>(sql, JSON.stringify(lista))).map(x => x.id))
    }
    let inseridos: Set<string> | null = null
    if (paraInserir.length) {
      try { inseridos = await inserir(paraInserir) } catch { inseridos = null }
      if (!inseridos) {
        // Algum registro do lote falhou (ex.: dependência ausente): vai um a um para salvar o resto.
        inseridos = new Set()
        for (const l of paraInserir) {
          try { for (const id of await inserir([l])) inseridos.add(id) } catch (err) {
            r.falhas++
            if (e.falhas.length < MAX_FALHAS) e.falhas.push({ tabela: nome, id: String(l.id), erro: (err instanceof Error ? err.message : String(err)).split('\n').filter(Boolean).slice(-1)[0].slice(0, 300) })
            l.__falhou = true
          }
        }
      }
    }
    for (const l of paraInserir) {
      if (l.__falhou) continue
      const id = String(l.id)
      if (inseridos!.has(id)) { r.inseridos++; continue }
      // Não entrou: ou o mesmo id já está no banco atual, ou outro registro ocupa a mesma chave única.
      const [{ n }] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT count(*) AS n FROM ${q(nome)} WHERE id::text = $1`, id)
      if (Number(n)) { r.existentes++; continue }
      const outro = await existenteNoDestino(t, l, usuarioId)
      if (outro) { mapaDe(nome)[id] = outro; r.casados++ } else { r.falhas++; if (e.falhas.length < MAX_FALHAS) e.falhas.push({ tabela: nome, id, erro: 'conflito sem registro correspondente' }) }
    }
    e.cursor.posicao += LOTE
    lotes++
  }
  await salvar('CONCLUIDA', true)
  return statusImportacao(usuarioId)
}

/** Recomeça do zero (mantém o que já entrou: rodar de novo não duplica). */
export async function descartarImportacao(usuarioId: string) {
  await prisma.importacaoNeon.deleteMany({ where: { usuarioId } })
}
