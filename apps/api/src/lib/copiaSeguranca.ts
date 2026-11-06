// Cópia de segurança de todo o banco, sem depender de ferramenta externa:
// - Exportação (produção): cada tabela vira partes .json.gz no armazenamento
//   privado do Supabase (pasta copias/<id>/), em rodadas de até ~12 s (a
//   função da Vercel tem 30 s), com um manifesto das tabelas e das linhas.
// - Link temporário: um manifesto com links assinados (6 h), para o
//   ambiente de teste baixar a cópia sem receber nenhuma chave da produção.
// - Restauração: só no ambiente de teste (AMBIENTE=teste) ou com
//   PERMITIR_RESTAURACAO=1 na produção (para voltar atrás). Apaga as tabelas
//   do destino e insere a cópia na ordem das dependências; no ambiente de
//   teste, as credenciais copiadas (Meta) são apagadas.
// O arquivo nunca vai para o GitHub (o repositório é público).
import crypto from 'crypto'
import { gunzipSync, gzipSync } from 'zlib'
import { prisma } from './prisma'
import { gravarArquivoSistema, lerArquivoSistema, linkTemporario } from './armazenamento'
import { ambienteDeTeste } from './ambiente'

export class ErroCopia extends Error { constructor(readonly status: number, message: string) { super(message) } }

const FORA = new Set(['_prisma_migrations', 'pro_labore_copias_seguranca'])
const LOTE = 400
const MAX_BYTES = 3_000_000
const VALIDADE_LINK_S = 6 * 3600
const q = (n: string) => `"${n.replace(/"/g, '""')}"`

interface Parte { tabela: string; arquivo: string; linhas: number }
interface EstadoExportacao { fila: Array<{ nome: string; temId: boolean }>; cursor: { tabela: number; ultimoId: string | null; offset: number }; partes: Parte[]; bytes: number; contagem: Record<string, number> }
export interface Manifesto { versao: 1; copiaId: string; geradaEm: string; migracao: string | null; totalLinhas: number; bytes: number; tabelas: Array<{ nome: string; linhas: number; partes: string[] }> }

async function tabelasDoBanco() {
  const r = await prisma.$queryRawUnsafe<Array<{ nome: string; temId: boolean }>>(`
    SELECT t.table_name AS nome, EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = t.table_name AND c.column_name = 'id') AS "temId"
    FROM information_schema.tables t WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE' ORDER BY t.table_name`)
  return r.filter(t => !FORA.has(t.nome))
}
const ultimaMigracao = async () => (await prisma.$queryRawUnsafe<Array<{ n: string }>>(`SELECT migration_name AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1`).catch(() => []))[0]?.n ?? null

// --- Exportação ---

export async function iniciarExportacao(autor: string | null) {
  const andamento = await prisma.copiaSeguranca.findFirst({ where: { tipo: 'EXPORTACAO', status: 'EM_ANDAMENTO', iniciadoEm: { gte: new Date(Date.now() - 3600_000) } } })
  if (andamento) return andamento.id
  const estado: EstadoExportacao = { fila: await tabelasDoBanco(), cursor: { tabela: 0, ultimoId: null, offset: 0 }, partes: [], bytes: 0, contagem: {} }
  const c = await prisma.copiaSeguranca.create({ data: { tipo: 'EXPORTACAO', autor, estado: estado as unknown as object } })
  return c.id
}

export async function rodadaExportacao(id: string, prazoMs = 12_000) {
  const inicio = Date.now()
  const c = await prisma.copiaSeguranca.findUnique({ where: { id } })
  if (!c || c.tipo !== 'EXPORTACAO') throw new ErroCopia(404, 'Cópia não encontrada')
  if (c.status !== 'EM_ANDAMENTO') return resumoCopia(c)
  const e = c.estado as unknown as EstadoExportacao
  try {
    while (e.cursor.tabela < e.fila.length && Date.now() - inicio < prazoMs) {
      const t = e.fila[e.cursor.tabela]
      const linhas: string[] = []
      let bytes = 0, acabou = false
      // Junta lotes da mesma tabela até ~3 MB (ou o fim da tabela), e grava como uma parte.
      while (bytes < MAX_BYTES && Date.now() - inicio < prazoMs) {
        const lote = t.temId
          ? await prisma.$queryRawUnsafe<Array<{ k: string; j: string }>>(`SELECT id::text AS k, row_to_json(x)::text AS j FROM ${q(t.nome)} x WHERE ($1::text IS NULL OR id::text > $1) ORDER BY id::text LIMIT ${LOTE}`, e.cursor.ultimoId)
          : await prisma.$queryRawUnsafe<Array<{ j: string }>>(`SELECT row_to_json(x)::text AS j FROM ${q(t.nome)} x ORDER BY ctid OFFSET ${e.cursor.offset} LIMIT ${LOTE}`)
        for (const l of lote) { linhas.push(l.j); bytes += l.j.length }
        if (t.temId && lote.length) e.cursor.ultimoId = (lote[lote.length - 1] as unknown as { k: string }).k
        e.cursor.offset += lote.length
        if (lote.length < LOTE) { acabou = true; break }
      }
      if (linhas.length) {
        const n = e.partes.length + 1
        const dados = gzipSync(Buffer.from(`[${linhas.join(',')}]`))
        const arquivo = await gravarArquivoSistema(`copias/${id}/${String(n).padStart(4, '0')}-${t.nome}.json.gz`, 'application/gzip', dados)
        e.partes.push({ tabela: t.nome, arquivo, linhas: linhas.length })
        e.bytes += dados.length
        e.contagem[t.nome] = (e.contagem[t.nome] ?? 0) + linhas.length
      }
      if (acabou) { e.contagem[t.nome] ??= 0; e.cursor = { tabela: e.cursor.tabela + 1, ultimoId: null, offset: 0 } }
    }
    if (e.cursor.tabela >= e.fila.length) {
      const manifesto: Manifesto = {
        versao: 1, copiaId: id, geradaEm: new Date().toISOString(), migracao: await ultimaMigracao(),
        totalLinhas: Object.values(e.contagem).reduce((s, n) => s + n, 0), bytes: e.bytes,
        tabelas: e.fila.map(t => ({ nome: t.nome, linhas: e.contagem[t.nome] ?? 0, partes: e.partes.filter(p => p.tabela === t.nome).map(p => p.arquivo) })),
      }
      await gravarArquivoSistema(`copias/${id}/manifesto.json`, 'application/json', Buffer.from(JSON.stringify(manifesto)))
      const fim = await prisma.copiaSeguranca.update({ where: { id }, data: { estado: e as unknown as object, manifesto: manifesto as unknown as object, status: 'CONCLUIDA', concluidoEm: new Date() } })
      return resumoCopia(fim)
    }
    return resumoCopia(await prisma.copiaSeguranca.update({ where: { id }, data: { estado: e as unknown as object } }))
  } catch (err) {
    const msg = (err instanceof Error ? err.message : String(err)).split('\n').filter(Boolean).slice(-1)[0].slice(0, 300)
    await prisma.copiaSeguranca.update({ where: { id }, data: { estado: e as unknown as object, erro: msg } })
    throw new ErroCopia(502, `A cópia parou (${msg}). O que já foi copiado ficou; toque de novo para continuar.`)
  }
}

type RegistroCopia = { id: string; tipo: string; status: string; autor: string | null; estado: unknown; manifesto: unknown; erro: string | null; iniciadoEm: Date; concluidoEm: Date | null }
export function resumoCopia(c: RegistroCopia) {
  if (c.tipo === 'EXPORTACAO') {
    const e = c.estado as EstadoExportacao
    const m = c.manifesto as Manifesto | null
    return {
      id: c.id, tipo: c.tipo, status: c.status, autor: c.autor, iniciadoEm: c.iniciadoEm, concluidoEm: c.concluidoEm, erro: c.erro,
      tabelas: e.fila.length, tabelasFeitas: Math.min(e.cursor.tabela, e.fila.length),
      linhas: m?.totalLinhas ?? Object.values(e.contagem).reduce((s, n) => s + n, 0), bytes: m?.bytes ?? e.bytes,
      migracao: m?.migracao ?? null,
    }
  }
  const e = c.estado as EstadoRestauracao
  return {
    id: c.id, tipo: c.tipo, status: c.status, autor: c.autor, iniciadoEm: c.iniciadoEm, concluidoEm: c.concluidoEm, erro: c.erro,
    passos: e.fila.length, passosFeitos: e.cursor, linhas: Object.values(e.inseridas).reduce((s, n) => s + n, 0), falhas: e.falhas.length,
    conferencia: e.conferencia ?? null, ultimasFalhas: e.falhas.slice(-10), origem: e.origem,
  }
}

export async function listarCopias() {
  const l = await prisma.copiaSeguranca.findMany({ orderBy: { iniciadoEm: 'desc' }, take: 10 })
  return l.map(resumoCopia)
}

/** Manifesto com links assinados de cada parte, para o ambiente de teste baixar (vale 6 h). */
export async function linkDaCopia(id: string) {
  const c = await prisma.copiaSeguranca.findUnique({ where: { id } })
  if (!c || c.tipo !== 'EXPORTACAO' || c.status !== 'CONCLUIDA' || !c.manifesto) throw new ErroCopia(400, 'A cópia ainda não terminou')
  const m = c.manifesto as unknown as Manifesto
  const assinadas: Manifesto['tabelas'] = []
  for (const t of m.tabelas) {
    const partes: string[] = []
    for (let i = 0; i < t.partes.length; i += 8) partes.push(...await Promise.all(t.partes.slice(i, i + 8).map(p => linkTemporario(p, VALIDADE_LINK_S))))
    assinadas.push({ ...t, partes })
  }
  const arquivo = await gravarArquivoSistema(`copias/${id}/link-${crypto.randomBytes(8).toString('hex')}.json`, 'application/json', Buffer.from(JSON.stringify({ ...m, tabelas: assinadas })))
  return { link: await linkTemporario(arquivo, VALIDADE_LINK_S), validoAte: new Date(Date.now() + VALIDADE_LINK_S * 1000).toISOString() }
}

// --- Restauração ---

interface PassoRestauracao { tipo: 'INSERIR' | 'LIGAR'; tabela: string; parte: string; colunas?: string[] }
interface EstadoRestauracao {
  chaveHash: string; origem: { copiaId: string; geradaEm: string; migracao: string | null; migracaoDestino: string | null }
  fila: PassoRestauracao[]; cursor: number; esperadas: Record<string, number>; inseridas: Record<string, number>
  falhas: Array<{ tabela: string; erro: string }>; conferencia?: Array<{ tabela: string; esperadas: number; restauradas: number }>
}

// A restauração copia os registros como estão: não gera eventos de auditoria
// novos (os eventos originais vêm na própria cópia).
const semAuditoria = (sql: string, ...valores: unknown[]) => prisma.$transaction([
  prisma.$executeRawUnsafe(`SELECT set_config('aries.sem_auditoria', '1', true)`),
  prisma.$executeRawUnsafe(sql, ...valores),
]).then(([, n]) => n)

export const restauracaoPermitida = () => ambienteDeTeste() || process.env.PERMITIR_RESTAURACAO === '1'
const hash = (s: string) => crypto.createHash('sha256').update(s).digest('hex')

/** Ordem de inserção pelas chaves estrangeiras (quem é referenciado entra antes). */
async function ordemDasDependencias(nomes: string[]) {
  const fks = await prisma.$queryRawUnsafe<Array<{ de: string; para: string; coluna: string }>>(`
    SELECT c.conrelid::regclass::text AS de, c.confrelid::regclass::text AS para, a.attname AS coluna
    FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace`)
  const limpa = (n: string) => n.replace(/^"|"$/g, '')
  const conj = new Set(nomes)
  const deps = new Map(nomes.map(n => [n, new Set<string>()]))
  const autoRef = new Map<string, string[]>()
  for (const f of fks) {
    const de = limpa(f.de), para = limpa(f.para)
    if (!conj.has(de) || !conj.has(para)) continue
    if (de === para) autoRef.set(de, [...(autoRef.get(de) ?? []), f.coluna])
    else deps.get(de)!.add(para)
  }
  const ordem: string[] = [], feitos = new Set<string>()
  while (ordem.length < nomes.length) {
    const prontos = nomes.filter(n => !feitos.has(n) && [...deps.get(n)!].every(d => feitos.has(d)))
    // Ciclo entre tabelas (não esperado): entra o resto, e o que falhar fica relatado.
    const lote = prontos.length ? prontos : nomes.filter(n => !feitos.has(n))
    for (const n of lote) { ordem.push(n); feitos.add(n) }
  }
  return { ordem, autoRef }
}

export async function iniciarRestauracao(link: string, chave: string, autor: string | null) {
  if (!restauracaoPermitida()) throw new ErroCopia(403, 'A restauração só funciona no ambiente de teste (ou com PERMITIR_RESTAURACAO=1)')
  if (!process.env.CHAVE_RESTAURACAO || chave !== process.env.CHAVE_RESTAURACAO) throw new ErroCopia(403, 'Chave de restauração incorreta')
  if (!/^https:\/\//.test(link) && !(process.env.NODE_ENV !== 'production' && /^http:\/\/localhost/.test(link))) throw new ErroCopia(400, 'Link inválido')
  const r = await fetch(link)
  if (!r.ok) throw new ErroCopia(400, `Não deu para abrir o link da cópia (${r.status}). Gere um link novo na produção: ele vale 6 horas.`)
  const m = (await r.json()) as Manifesto
  if (m.versao !== 1 || !Array.isArray(m.tabelas)) throw new ErroCopia(400, 'O link não é de uma cópia de segurança')
  const destino = new Set((await tabelasDoBanco()).map(t => t.nome))
  const presentes = m.tabelas.filter(t => destino.has(t.nome))
  const { ordem, autoRef } = await ordemDasDependencias(presentes.map(t => t.nome))
  const porNome = new Map(presentes.map(t => [t.nome, t]))
  const fila: PassoRestauracao[] = []
  for (const nome of ordem) {
    const t = porNome.get(nome)!
    for (const parte of t.partes) fila.push({ tipo: 'INSERIR', tabela: nome, parte, ...(autoRef.has(nome) ? { colunas: autoRef.get(nome) } : {}) })
    if (autoRef.has(nome)) for (const parte of t.partes) fila.push({ tipo: 'LIGAR', tabela: nome, parte, colunas: autoRef.get(nome) })
  }
  const sessao = crypto.randomBytes(24).toString('hex')
  const estado: EstadoRestauracao = {
    chaveHash: hash(sessao), origem: { copiaId: m.copiaId, geradaEm: m.geradaEm, migracao: m.migracao, migracaoDestino: await ultimaMigracao() },
    fila, cursor: 0, esperadas: Object.fromEntries(presentes.map(t => [t.nome, t.linhas])), inseridas: {}, falhas: [],
  }
  // Esvazia o destino (as tabelas da cópia; esta e a das migrações ficam).
  if (ordem.length) await prisma.$executeRawUnsafe(`TRUNCATE ${ordem.map(q).join(', ')} CASCADE`)
  const c = await prisma.copiaSeguranca.create({ data: { tipo: 'RESTAURACAO', autor, estado: estado as unknown as object } })
  return { id: c.id, sessao }
}

async function colunasDe(tabela: string) {
  return (await prisma.$queryRawUnsafe<Array<{ c: string }>>(`SELECT column_name AS c FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`, tabela)).map(x => x.c)
}

export async function rodadaRestauracao(id: string, sessao: string, prazoMs = 12_000) {
  if (!restauracaoPermitida()) throw new ErroCopia(403, 'A restauração só funciona no ambiente de teste')
  const inicio = Date.now()
  const c = await prisma.copiaSeguranca.findUnique({ where: { id } })
  if (!c || c.tipo !== 'RESTAURACAO') throw new ErroCopia(404, 'Restauração não encontrada')
  const e = c.estado as unknown as EstadoRestauracao
  if (hash(sessao) !== e.chaveHash) throw new ErroCopia(403, 'Sessão de restauração inválida')
  if (c.status !== 'EM_ANDAMENTO') return resumoCopia(c)
  const colunasCache = new Map<string, string[]>()
  while (e.cursor < e.fila.length && Date.now() - inicio < prazoMs) {
    const p = e.fila[e.cursor]
    const r = await fetch(p.parte)
    if (!r.ok) throw new ErroCopia(502, `Não deu para baixar uma parte da cópia (${r.status}). Se passou de 6 horas, gere um link novo e recomece.`)
    const linhas = JSON.parse(gunzipSync(Buffer.from(await r.arrayBuffer())).toString()) as Array<Record<string, unknown>>
    if (!colunasCache.has(p.tabela)) colunasCache.set(p.tabela, await colunasDe(p.tabela))
    const doDestino = new Set(colunasCache.get(p.tabela)!)
    const daCopia = Object.keys(linhas[0] ?? {}).filter(k => doDestino.has(k))
    if (p.tipo === 'INSERIR') {
      // Colunas que apontam para a própria tabela entram vazias e são ligadas no passo seguinte.
      const cols = daCopia.filter(k => !(p.colunas ?? []).includes(k))
      const inserir = (lote: Array<Record<string, unknown>>) => semAuditoria(`INSERT INTO ${q(p.tabela)} (${cols.map(q).join(', ')}) SELECT ${cols.map(q).join(', ')} FROM json_populate_recordset(NULL::${q(p.tabela)}, $1::json) ON CONFLICT DO NOTHING`, JSON.stringify(lote))
      for (let i = 0; i < linhas.length; i += 200) {
        const lote = linhas.slice(i, i + 200)
        try { e.inseridas[p.tabela] = (e.inseridas[p.tabela] ?? 0) + await inserir(lote) } catch {
          for (const l of lote) {
            try { e.inseridas[p.tabela] = (e.inseridas[p.tabela] ?? 0) + await inserir([l]) } catch (err) {
              if (e.falhas.length < 200) e.falhas.push({ tabela: p.tabela, erro: (err instanceof Error ? err.message : String(err)).split('\n').filter(Boolean).slice(-1)[0].slice(0, 200) })
            }
          }
        }
      }
    } else {
      const cols = (p.colunas ?? []).filter(k => doDestino.has(k))
      if (cols.length) {
        try {
          await semAuditoria(`UPDATE ${q(p.tabela)} t SET ${cols.map(k => `${q(k)} = j.${q(k)}`).join(', ')} FROM json_populate_recordset(NULL::${q(p.tabela)}, $1::json) j WHERE t.id = j.id`, JSON.stringify(linhas.map(l => Object.fromEntries([['id', l.id], ...cols.map(k => [k, l[k]])]))))
        } catch (err) { e.falhas.push({ tabela: p.tabela, erro: `vínculos: ${(err instanceof Error ? err.message : String(err)).split('\n').filter(Boolean).slice(-1)[0].slice(0, 180)}` }) }
      }
    }
    e.cursor++
  }
  if (e.cursor >= e.fila.length) {
    if (ambienteDeTeste()) {
      // As credenciais da Meta copiadas da produção não servem aqui e não podem ser usadas.
      await prisma.$executeRawUnsafe(`UPDATE pro_labore_social_media_contas SET "accessToken" = 'removido-no-ambiente-de-teste'`).catch(() => undefined)
      await prisma.$executeRawUnsafe(`UPDATE pro_labore_trafego_contas SET "accessToken" = 'removido-no-ambiente-de-teste'`).catch(() => undefined)
    }
    const conferencia: NonNullable<EstadoRestauracao['conferencia']> = []
    for (const [tabela, esperadas] of Object.entries(e.esperadas)) {
      const [{ n }] = await prisma.$queryRawUnsafe<Array<{ n: number }>>(`SELECT count(*)::int AS n FROM ${q(tabela)}`)
      conferencia.push({ tabela, esperadas, restauradas: n })
    }
    e.conferencia = conferencia
    return resumoCopia(await prisma.copiaSeguranca.update({ where: { id }, data: { estado: e as unknown as object, status: 'CONCLUIDA', concluidoEm: new Date() } }))
  }
  return resumoCopia(await prisma.copiaSeguranca.update({ where: { id }, data: { estado: e as unknown as object } }))
}

/** Baixa o manifesto de uma cópia (para a tela mostrar a contagem por tabela). */
export async function manifestoDaCopia(id: string) {
  const c = await prisma.copiaSeguranca.findUnique({ where: { id } })
  if (!c?.manifesto) return null
  const m = c.manifesto as unknown as Manifesto
  return { ...m, tabelas: m.tabelas.map(t => ({ nome: t.nome, linhas: t.linhas, partes: t.partes.length })) }
}
export { lerArquivoSistema }
