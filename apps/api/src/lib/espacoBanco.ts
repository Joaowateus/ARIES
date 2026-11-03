// Espaço do banco (plano gratuito: 500 MB, e ao passar o banco fica só de
// leitura). Mostra o que mais ocupa e libera o que dá sem perder nada:
// - eventos do Instagram já processados (o conteúdo já foi para as tabelas
//   do Social Media; o evento bruto só servia para reprocessar);
// - fotos/imagens e áudios/fotos das conversas guardados dentro do banco vão
//   para o Vercel Blob (continuam abrindo igual, pela mesma rota).
// Depois de esvaziar, VACUUM FULL devolve o espaço do arquivo da tabela
// (sem ele o Postgres só reaproveita o espaço para dados novos).
import { prisma } from './prisma'
import { blobConfigurado, gravarNoBlob, lerDoBlob, supabaseConfigurado, ultimoErroBlob } from './armazenamento'
import { LIMITE_BANCO_MB } from './bancoDisponivel'
import { logger } from './logger'

const MB = 1024 * 1024
const DIA = 864e5
// Eventos processados há mais de 7 dias saem (o reprocessamento só olha os recentes).
const EVENTOS_DIAS = 7

export class ErroEspaco extends Error { constructor(readonly status: number, message: string) { super(message) } }

const ROTULOS: Record<string, string> = {
  pro_labore_imagens: 'Fotos e imagens enviadas (pautas, estoque, miniaturas dos posts)',
  pro_labore_assistente_midias: 'Áudios e fotos das conversas do WhatsApp',
  pro_labore_sm_webhook_eventos: 'Eventos recebidos do Instagram (brutos)',
  pro_labore_assistente_mensagens: 'Mensagens das conversas do WhatsApp',
  pro_labore_assistente_conversas: 'Conversas do WhatsApp',
  pro_labore_leads: 'Leads',
  pro_labore_lead_estagio_historico: 'Histórico de etapas dos leads',
  pro_labore_trafego_insights: 'Tráfego: números diários dos anúncios',
  pro_labore_trafego_publicos: 'Tráfego: públicos',
  pro_labore_sm_posts: 'Instagram: posts',
  pro_labore_sm_notificacoes: 'Avisos do Social Media',
  pro_labore_agente_mensagens: 'Mensagens do Aries no WhatsApp',
  pro_labore_copiloto_dias: 'Copiloto: relatórios do dia',
  pro_labore_notas: 'Anotações',
  pro_labore_mapas_mentais: 'Mapas mentais',
  pro_labore_vendas: 'Vendas',
}

const q = (n: string) => `"${n.replace(/"/g, '""')}"`

export async function painelEspaco() {
  const [[{ bytes }], tabelas, [eventos], [imagens], [midias], [naVercel]] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ bytes: bigint }>>(`SELECT pg_database_size(current_database()) AS bytes`),
    prisma.$queryRawUnsafe<Array<{ t: string; bytes: bigint; linhas: number }>>(`
      SELECT c.relname AS t, pg_total_relation_size(c.oid) AS bytes, GREATEST(c.reltuples, 0)::float8 AS linhas
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY pg_total_relation_size(c.oid) DESC LIMIT 15`),
    prisma.$queryRawUnsafe<Array<{ n: bigint; bytes: bigint }>>(`SELECT count(*) AS n, COALESCE(sum(pg_column_size(payload)), 0)::bigint AS bytes FROM pro_labore_sm_webhook_eventos WHERE "recebidoEm" < $1 AND ("processadoEm" IS NOT NULL OR "recebidoEm" < $2)`, new Date(Date.now() - EVENTOS_DIAS * DIA), new Date(Date.now() - 30 * DIA)),
    prisma.$queryRawUnsafe<Array<{ n: bigint; bytes: bigint }>>(`SELECT count(*) AS n, COALESCE(sum(tamanho), 0)::bigint AS bytes FROM pro_labore_imagens WHERE dados IS NOT NULL`),
    prisma.$queryRawUnsafe<Array<{ n: bigint; bytes: bigint }>>(`SELECT count(*) AS n, COALESCE(sum(octet_length(dados)), 0)::bigint AS bytes FROM pro_labore_assistente_midias WHERE dados IS NOT NULL`),
    // Arquivos que foram para o Vercel Blob (que pode suspender no plano gratuito): dá para levar ao Supabase.
    prisma.$queryRawUnsafe<Array<{ n: bigint; bytes: bigint }>>(`SELECT count(*) AS n, COALESCE(sum(t), 0)::bigint AS bytes FROM (SELECT tamanho AS t FROM pro_labore_imagens WHERE "blobAcesso" IN ('private', 'public') UNION ALL SELECT COALESCE(tamanho, 0) FROM pro_labore_assistente_midias WHERE "blobAcesso" IN ('private', 'public')) x`),
  ])
  const mb = (b: bigint | number) => Math.round((Number(b) / MB) * 10) / 10
  return {
    usadoMB: mb(bytes),
    limiteMB: LIMITE_BANCO_MB(),
    blobConfigurado: blobConfigurado(),
    supabaseConfigurado: supabaseConfigurado(),
    naVercel: { quantidade: Number(naVercel.n), mb: mb(naVercel.bytes) },
    tabelas: tabelas.map(t => ({ tabela: t.t, rotulo: ROTULOS[t.t] ?? null, mb: mb(t.bytes), linhas: Math.round(t.linhas) })),
    compactaveisMB: mb(tabelas.filter(t => COMPACTAVEIS.includes(t.t)).reduce((x, t) => x + Number(t.bytes), 0)),
    liberar: {
      eventos: { quantidade: Number(eventos.n), mb: mb(eventos.bytes) },
      imagens: { quantidade: Number(imagens.n), mb: mb(imagens.bytes) },
      midias: { quantidade: Number(midias.n), mb: mb(midias.bytes) },
    },
  }
}

/** Devolve ao disco o espaço da tabela já esvaziada (trava a tabela por instantes). */
async function compactar(tabela: string): Promise<string | null> {
  const motivo = (e: unknown) => (e instanceof Error ? e.message.split('\n').filter(Boolean).slice(-1)[0].slice(0, 200) : String(e))
  try { await prisma.$executeRawUnsafe(`VACUUM (FULL, ANALYZE) ${q(tabela)}`); return null } catch (e) {
    // Pelo pooler do Supabase o VACUUM cai numa transação (código 25001). CLUSTER pela chave primária
    // reescreve a tabela do mesmo jeito (devolve o espaço) e pode rodar dentro de transação.
    if (!/25001|transaction block/i.test(motivo(e))) { logger.warn({ err: e, tabela }, 'espaço: VACUUM FULL falhou'); return motivo(e) }
  }
  try {
    const [pk] = await prisma.$queryRawUnsafe<Array<{ nome: string }>>(`SELECT c.conname AS nome FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public' AND t.relname = $1 AND c.contype = 'p'`, tabela)
    if (!pk) return 'tabela sem chave primária'
    await prisma.$executeRawUnsafe(`CLUSTER ${q(tabela)} USING ${q(pk.nome)}`)
    await prisma.$executeRawUnsafe(`ANALYZE ${q(tabela)}`)
    return null
  } catch (e) {
    logger.warn({ err: e, tabela }, 'espaço: CLUSTER falhou')
    return motivo(e)
  }
}

export type AcaoEspaco = 'eventos' | 'imagens' | 'midias' | 'compactar' | 'vercel'
// Tabelas que guardavam arquivos e eventos: depois de esvaziadas, o espaço só volta ao disco com VACUUM FULL.
const COMPACTAVEIS = ['pro_labore_imagens', 'pro_labore_assistente_midias', 'pro_labore_sm_webhook_eventos']

/** Uma rodada (tempo limitado): a tela chama de novo enquanto `restantes` > 0. */
export async function liberarEspaco(acao: AcaoEspaco, prazoMs = 15_000) {
  const inicio = Date.now()
  let feitos = 0, restantes = 0, falhas = 0
  if (acao === 'vercel') {
    if (!supabaseConfigurado()) throw new ErroEspaco(400, 'O armazenamento do Supabase não está configurado (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel)')
    const naVercel = { blobAcesso: { in: ['private', 'public'] } }
    let falhasSeguidas = 0
    while (Date.now() - inicio < prazoMs) {
      const imgs = await prisma.imagemUpload.findMany({ where: naVercel, select: { id: true, usuarioId: true, chave: true, mime: true, blobUrl: true, blobAcesso: true }, take: 10 })
      const mids = imgs.length ? [] : await prisma.assistenteMidia.findMany({ where: naVercel, select: { id: true, usuarioId: true, mime: true, blobUrl: true, blobAcesso: true }, take: 10 })
      if (!imgs.length && !mids.length) break
      for (const x of [...imgs.map(i => ({ ...i, tipo: 'img' as const })), ...mids.map(m => ({ ...m, chave: m.id, tipo: 'mid' as const }))]) {
        if (Date.now() - inicio >= prazoMs) break
        const dados = x.blobUrl ? await lerDoBlob(x.blobUrl, x.blobAcesso).catch(() => null) : null
        if (!dados) {
          falhas++
          if (++falhasSeguidas >= 5) throw new ErroEspaco(502, 'A Vercel não está entregando os arquivos guardados lá (o armazenamento está suspenso). Reative o armazenamento na Vercel por um momento ou espere o próximo mês e toque de novo')
          continue
        }
        falhasSeguidas = 0
        const mime = x.mime ?? 'application/octet-stream'
        const destino = await gravarNoBlob(`${x.tipo === 'img' ? 'imagens' : 'conversas'}/${x.usuarioId}/${x.chave}.${mime.split('/')[1]?.replace(/[^a-z0-9]/g, '') || 'bin'}`, mime, dados, { soSupabase: true })
        if (!destino) throw new ErroEspaco(502, `O Supabase recusou o arquivo${ultimoErroBlob ? ` (${ultimoErroBlob})` : ''}`)
        if (x.tipo === 'img') await prisma.imagemUpload.update({ where: { id: x.id }, data: destino })
        else await prisma.assistenteMidia.update({ where: { id: x.id }, data: destino })
        feitos++
      }
    }
    restantes = (await prisma.imagemUpload.count({ where: naVercel })) + (await prisma.assistenteMidia.count({ where: naVercel }))
    return { feitos, restantes, falhas }
  }
  if (acao === 'compactar') {
    for (const t of COMPACTAVEIS) {
      const erro = await compactar(t)
      if (erro) throw new ErroEspaco(502, `Não deu para compactar ${t.replace(/^pro_labore_/, '')}: ${erro}`)
    }
    return { feitos: COMPACTAVEIS.length, restantes: 0 }
  }
  if (acao === 'eventos') {
    const corte = new Date(Date.now() - EVENTOS_DIAS * DIA), parado = new Date(Date.now() - 30 * DIA)
    while (Date.now() - inicio < prazoMs) {
      const n = await prisma.$executeRawUnsafe(`DELETE FROM pro_labore_sm_webhook_eventos WHERE id IN (SELECT id FROM pro_labore_sm_webhook_eventos WHERE "recebidoEm" < $1 AND ("processadoEm" IS NOT NULL OR "recebidoEm" < $2) LIMIT 2000)`, corte, parado)
      feitos += n
      if (n < 2000) break
    }
    restantes = await prisma.smWebhookEvento.count({ where: { recebidoEm: { lt: corte }, OR: [{ processadoEm: { not: null } }, { recebidoEm: { lt: parado } }] } })
    if (!restantes) await compactar('pro_labore_sm_webhook_eventos')
  } else {
    if (!blobConfigurado()) throw new ErroEspaco(400, 'Nenhum armazenamento de arquivos configurado (Supabase ou Vercel Blob)')
    const tabela = acao === 'imagens' ? 'pro_labore_imagens' : 'pro_labore_assistente_midias'
    while (Date.now() - inicio < prazoMs) {
      const lote = acao === 'imagens'
        ? await prisma.imagemUpload.findMany({ where: { dados: { not: null } }, select: { id: true }, take: 10 })
        : await prisma.assistenteMidia.findMany({ where: { dados: { not: null } }, select: { id: true }, take: 10 })
      if (!lote.length) break
      for (const { id } of lote) {
        if (Date.now() - inicio >= prazoMs) break
        // Um arquivo por vez na memória.
        const r = acao === 'imagens'
          ? await prisma.imagemUpload.findUnique({ where: { id }, select: { usuarioId: true, chave: true, mime: true, dados: true } })
          : await prisma.assistenteMidia.findUnique({ where: { id }, select: { usuarioId: true, mime: true, dados: true } })
        if (!r?.dados) continue
        const mime = r.mime ?? 'application/octet-stream'
        const nome = 'chave' in r ? `imagens/${r.usuarioId}/${r.chave}` : `conversas/${r.usuarioId}/${id}`
        const blob = await gravarNoBlob(`${nome}.${mime.split('/')[1]?.replace(/[^a-z0-9]/g, '') || 'bin'}`, mime, Buffer.from(r.dados))
        if (!blob) { falhas++; continue }
        if (acao === 'imagens') await prisma.imagemUpload.update({ where: { id }, data: { ...blob, dados: null } })
        else await prisma.assistenteMidia.update({ where: { id }, data: { ...blob, dados: null } })
        feitos++
      }
      if (falhas >= 3) throw new ErroEspaco(502, `O armazenamento de arquivos recusou os arquivos${ultimoErroBlob ? ` (${ultimoErroBlob})` : ''}`)
    }
    restantes = acao === 'imagens'
      ? await prisma.imagemUpload.count({ where: { dados: { not: null } } })
      : await prisma.assistenteMidia.count({ where: { dados: { not: null } } })
    if (!restantes) await compactar(tabela)
  }
  return { feitos, restantes }
}

/** Job do dia: os eventos brutos do Instagram não ficam para sempre (só os processados há mais de 15 dias). */
export async function limparEventosAntigos(agora = new Date()) {
  const n = await prisma.$executeRawUnsafe(`DELETE FROM pro_labore_sm_webhook_eventos WHERE id IN (SELECT id FROM pro_labore_sm_webhook_eventos WHERE "recebidoEm" < $1 AND ("processadoEm" IS NOT NULL OR "recebidoEm" < $2) LIMIT 20000)`, new Date(agora.getTime() - 15 * DIA), new Date(agora.getTime() - 30 * DIA))
  return { eventosApagados: n }
}
