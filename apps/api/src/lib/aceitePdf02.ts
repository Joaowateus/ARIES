// PDF 02 · seção 9: teste de aceite calculado na própria produção (o dono vê
// em Configurações). Cada item traz o que foi medido e se passa.
import { prisma } from './prisma'
import { calcular, FICHAS_PADRAO, type Escopo } from './metricas'
import { conferenciaDaMigracao } from './atividades'

// Data de corte da onda 1 (ida para a produção em modo paralelo).
export const CORTE_PDF02 = new Date('2026-11-08T03:00:00.000Z')

const mesFechado = (agora: Date) => {
  const b = new Date(agora.getTime() - 3 * 3_600_000)
  const ini = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth() - 1, 1)), fim = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), 0))
  const d = (x: Date) => x.toISOString().slice(0, 10)
  return { inicio: d(ini), fim: d(fim) }
}

export async function aceitePdf02(usuarioId: string, agora = new Date()) {
  const e: Escopo = { usuarioId, papel: 'DONO' }
  const p = mesFechado(agora)
  // 1. Métricas do primeiro lote no último mês fechado, contra os registros originais.
  const ini = new Date(`${p.inicio}T03:00:00.000Z`), fimTs = new Date(new Date(`${p.fim}T03:00:00.000Z`).getTime() + 86_400_000)
  const dIni = new Date(`${p.inicio}T00:00:00.000Z`), dFim = new Date(new Date(`${p.fim}T00:00:00.000Z`).getTime() + 86_400_000)
  const [leads, vendas] = await Promise.all([
    prisma.lead.count({ where: { usuarioId, criadoEm: { gte: ini, lt: fimTs } } }),
    prisma.venda.aggregate({ where: { usuarioId, situacao: 'CONFIRMADA', data: { gte: dIni, lt: dFim } }, _count: true, _sum: { valorVenda: true, valorProLabore: true } }),
  ])
  const originais: Record<string, number> = { leads_novos: leads, vendas: vendas._count, faturamento: Math.round((vendas._sum.valorVenda ?? 0) * 100) / 100, pro_labore: Math.round((vendas._sum.valorProLabore ?? 0) * 100) / 100 }
  const metricas = []
  for (const f of FICHAS_PADRAO.filter(x => x.lote === 1)) {
    const v = await calcular(f.chave, e, p, agora).catch(err => ({ valor: null, erro: String(err?.message ?? err) }))
    metricas.push({ chave: f.chave, nome: f.nome, valor: v.valor, original: originais[f.chave] ?? null, bate: originais[f.chave] == null ? null : v.valor === originais[f.chave], erro: 'erro' in v ? v.erro : undefined })
  }
  // 2. As 20 conversas mais recentes com primeira resposta humana depois do corte.
  const conversas = await prisma.$queryRaw<Array<{ contato: string | null; vendedor: string | null; cliente: Date; resposta: Date }>>`
    SELECT cv."nomeContato" contato, v.nome vendedor,
      (SELECT min(c."enviadaEm") FROM pro_labore_assistente_mensagens c WHERE c."conversaId" = r."conversaId" AND c.remetente = 'CONTATO' AND c."enviadaEm" <= r."enviadaEm") cliente,
      r."enviadaEm" resposta
    FROM pro_labore_assistente_mensagens r
    JOIN pro_labore_assistente_conversas cv ON cv.id = r."conversaId"
    JOIN pro_labore_assistente_comercial a ON a.id = cv."assistenteId"
    JOIN pro_labore_vendedores v ON v.id = a."vendedorId"
    WHERE r."primeiraRespostaHumana" AND r."enviadaEm" >= ${CORTE_PDF02} AND v."usuarioId" = ${usuarioId}
    ORDER BY r."enviadaEm" DESC LIMIT 20`
  // 3. Migração das tarefas.
  const tarefas = await conferenciaDaMigracao(usuarioId)
  // 4. Régua de cobrança: o que registrou por etapa e se algum alerta saiu depois da atividade feita.
  const regua = await prisma.$queryRaw<Array<{ etapa: string; n: bigint }>>`
    SELECT r.etapa, count(*) n FROM pro_labore_regua_registros r JOIN pro_labore_atividades a ON a.id = r."atividadeId" WHERE a."usuarioId" = ${usuarioId} GROUP BY 1`
  const [depoisDeFeita] = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT count(*) n FROM pro_labore_regua_registros r JOIN pro_labore_atividades a ON a.id = r."atividadeId"
    WHERE a."usuarioId" = ${usuarioId} AND a."executadaEm" IS NOT NULL AND r."registradoEm" > a."executadaEm" + interval '1 minute'`
  const [foraDoTempo] = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT count(*) n FROM pro_labore_regua_registros r JOIN pro_labore_atividades a ON a.id = r."atividadeId"
    WHERE a."usuarioId" = ${usuarioId} AND (r."registradoEm" < r."previstoPara" OR r."registradoEm" > r."previstoPara" + interval '30 minutes')
      -- não conta: venceu de madrugada (0h–6h, o sistema descansa) ou a atividade já foi criada vencida
      AND EXTRACT(HOUR FROM (r."previstoPara" - interval '3 hours')) >= 6 AND a."criadoEm" <= r."previstoPara"`
  // 5. Origem: leads criados depois do corte, por tipo de origem.
  const origens = await prisma.$queryRaw<Array<{ tipo: string | null; n: bigint }>>`
    SELECT "origemTipo" tipo, count(*) n FROM pro_labore_leads WHERE "usuarioId" = ${usuarioId} AND "criadoEm" >= ${CORTE_PDF02} GROUP BY 1 ORDER BY 2 DESC`
  // "Nenhum lead novo sem origem": em branco não pode; "desconhecida" é um valor e vai para a correção orientada (4.5).
  const semOrigem = origens.filter(o => o.tipo == null).reduce((s, o) => s + Number(o.n), 0)
  const desconhecidas = origens.filter(o => o.tipo === 'DESCONHECIDA').reduce((s, o) => s + Number(o.n), 0)
  return {
    corte: CORTE_PDF02.toISOString(),
    metricas: { periodo: p, itens: metricas, passa: metricas.every(m => m.bate !== false && !m.erro) },
    conversas: conversas.map(c => ({ contato: c.contato, vendedor: c.vendedor, clienteEm: c.cliente, respostaEm: c.resposta, minutos: c.cliente ? Math.round((c.resposta.getTime() - c.cliente.getTime()) / 6000) / 10 : null })),
    tarefas: { itens: tarefas, passa: tarefas.every(t => t.bate && !t.semData && !t.semAutor) },
    regua: { porEtapa: Object.fromEntries(regua.map(r => [r.etapa, Number(r.n)])), depoisDeFeita: Number(depoisDeFeita.n), foraDoTempo: Number(foraDoTempo.n), passa: Number(depoisDeFeita.n) === 0 && Number(foraDoTempo.n) === 0 },
    origem: { porTipo: origens.map(o => ({ tipo: o.tipo ?? 'SEM ORIGEM', total: Number(o.n) })), semOrigem, desconhecidas, passa: semOrigem === 0 },
  }
}
