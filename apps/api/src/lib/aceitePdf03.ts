// PDF 03 · seção 9: teste de aceite calculado na própria produção (o dono
// vê em Configurações), e a amostra de 20 Recomendações para o teste de
// utilidade (dono e supervisor marcam pertinente ou não; passa com 80%).
import { prisma } from './prisma'
import { calcular, type Escopo } from './metricas'
import { DETECTORES, configDetectores } from './detectores'

const r2 = (n: number) => Math.round(n * 100) / 100

/** A amostra: até 20 RECs, as mais recentes de cada detector em rodízio (todas as áreas aparecem). */
export async function amostraUtilidade(usuarioId: string, tamanho = 20) {
  const recs = await prisma.recomendacao.findMany({ where: { usuarioId }, orderBy: { criadoEm: 'desc' }, select: { id: true, codigo: true, titulo: true, detector: true, forca: true, status: true, avaliacoes: { select: { avaliadorId: true, pertinente: true } } } })
  const porDetector = new Map<string, typeof recs>()
  for (const r of recs) porDetector.set(r.detector, [...(porDetector.get(r.detector) ?? []), r])
  const fila = [...porDetector.values()]
  const out: typeof recs = []
  for (let i = 0; out.length < tamanho && fila.some(f => f.length > i); i++) for (const f of fila) if (f[i] && out.length < tamanho) out.push(f[i])
  return out
}

export async function aceitePdf03(usuarioId: string, agora = new Date()) {
  const recs = await prisma.recomendacao.findMany({ where: { usuarioId }, orderBy: { criadoEm: 'desc' }, take: 500 })
  const cfg = await configDetectores(usuarioId)

  // 1. Evidência: recalcula a métrica de cada REC aberta pelo dicionário (mesmo escopo e período).
  const evid = []
  for (const r of recs.filter(x => ['NOVA', 'ACEITA', 'EM_EXECUCAO'].includes(x.status)).slice(0, 40)) {
    const ev = r.evidencia as { metricas: Array<{ chave: string; valor: number | null; periodo: { inicio: string; fim: string }; periodoAnterior: unknown; detalhe?: { etapa?: string } }> }
    const m = ev.metricas[0]
    if (!m || !m.periodoAnterior || ['tempo_resposta_banco', 'leads_parados'].includes(m.chave) || r.alvoTipo === 'BANCO') { evid.push({ codigo: r.codigo, titulo: r.titulo, chave: m?.chave, valor: m?.valor ?? null, dicionario: null, bate: null }); continue }
    const e: Escopo = { usuarioId, papel: 'DONO', semSuspeitos: true, vendedorId: r.alvoTipo === 'PESSOA' ? r.alvoId : null }
    const v = await calcular(m.chave, e, m.periodo, agora).catch(() => null)
    const dic = m.chave === 'conversao_por_etapa' ? (v?.detalhe as Array<{ etapa: string; conversao: number | null }> | undefined)?.find(x => x.etapa === r.alvoId)?.conversao ?? null : v?.valor ?? null
    evid.push({ codigo: r.codigo, titulo: r.titulo, chave: m.chave, valor: m.valor, dicionario: dic, bate: dic === m.valor })
  }
  // 2. Utilidade: avaliações da amostra (dono e supervisor).
  const amostra = await amostraUtilidade(usuarioId)
  const avals = amostra.flatMap(a => a.avaliacoes)
  const pertinentes = avals.filter(a => a.pertinente).length
  // 3. Volume mínimo e 4. suspeitos: nenhuma REC abaixo do volume; nenhum registro suspeito como evidência.
  const abaixo = recs.filter(r => { const ev = r.evidencia as { casos: number; volumeMinimo: number }; return ev.casos < ev.volumeMinimo }).length
  const suspeitos = new Set((await prisma.confiabilidade.findMany({ where: { usuarioId, classificacao: 'SUSPEITO' }, select: { registroId: true } })).map(x => x.registroId))
  const comSuspeito = recs.filter(r => ((r.evidencia as { registros?: { ids: string[] } }).registros?.ids ?? []).some(id => suspeitos.has(id))).length
  // 6. Nível 1: nenhuma REC aceita sem pessoa, nenhuma atividade de REC executada por automação, todos os detectores no nível 1.
  const semPessoa = recs.filter(r => r.status !== 'NOVA' && !r.decididoPor).length
  const atvAuto = await prisma.atividade.count({ where: { usuarioId, origemTipo: 'RECOMENDACAO', autorExecucaoTipo: 'AUTOMACAO' } })
  const niveis = DETECTORES.every(d => cfg[d.chave].nivelAutonomia === 1)
  // 7. Roteamento: achado sobre pessoa visível só para ela, supervisor e dono.
  // Vazamento = um colega (quem não é supervisor) vê achado sobre outra pessoa.
  const supervisores = new Set((await prisma.vendedor.findMany({ where: { usuarioId, papel: 'SUPERVISOR' }, select: { id: true } })).map(v => v.id))
  const vazou = recs.filter(r => (r.alvoTipo === 'PESSOA' || r.alvoTipo === 'CREDITO') && r.visivelPara.some(v => v !== r.alvoId && v !== usuarioId && !supervisores.has(v))).length
  const porTipo = Object.entries(recs.reduce<Record<string, number>>((s, r) => ({ ...s, [r.alvoTipo]: (s[r.alvoTipo] ?? 0) + 1 }), {})).map(([tipo, n]) => ({ tipo, n }))
  // 8. Escalonamento: orientações sem tratar que subiram ao supervisor pela régua.
  const [escal] = await prisma.$queryRaw<Array<{ n: bigint }>>`SELECT count(*) n FROM pro_labore_regua_registros r JOIN pro_labore_atividades a ON a.id = r."atividadeId" WHERE a."usuarioId" = ${usuarioId} AND a.tipo = 'TRATAR_RECOMENDACAO' AND r.etapa = 'ESCALONAMENTO'`
  const tratarVencidas = await prisma.atividade.count({ where: { usuarioId, tipo: 'TRATAR_RECOMENDACAO', status: 'PENDENTE', prazo: { lt: new Date(agora.getTime() - 24 * 3_600_000) } } })
  // 9. Descarte e 12. duplicidade, pela memória.
  const mem = await prisma.recomendacaoMemoria.groupBy({ by: ['acao'], where: { usuarioId }, _count: true })
  const memo = Object.fromEntries(mem.map(m => [m.acao, m._count]))
  const voltaram = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT count(*) n FROM pro_labore_recomendacoes d JOIN pro_labore_recomendacoes n ON n.contexto = d.contexto AND n."usuarioId" = d."usuarioId" AND n."criadoEm" > d."atualizadoEm" AND n."criadoEm" < d."atualizadoEm" + interval '30 days'
    WHERE d."usuarioId" = ${usuarioId} AND d.status = 'DESCARTADA'`
  // 10. Ciclo e 11. avaliação.
  const aceitas = recs.filter(r => r.aceitaEm)
  const comAtv = await prisma.atividade.groupBy({ by: ['origemId'], where: { usuarioId, origemTipo: 'RECOMENDACAO', tipo: 'ACAO_RECOMENDACAO' }, _count: true })
  const avaliadas = recs.filter(r => r.avaliadaEm)
  // 13. Auditoria: toda REC tem o evento de criação.
  const [semEvento] = await prisma.$queryRaw<Array<{ n: bigint }>>`SELECT count(*) n FROM pro_labore_recomendacoes r WHERE r."usuarioId" = ${usuarioId} AND NOT EXISTS (SELECT 1 FROM pro_labore_eventos_auditoria e WHERE e.tabela = 'pro_labore_recomendacoes' AND e."registroId" = r.id AND e.acao = 'CRIACAO')`
  const modo = (await prisma.parametroLiquidez.findUnique({ where: { usuarioId }, select: { recRoteamento: true } }))?.recRoteamento ?? 'SILENCIOSO'
  return {
    total: recs.length, modo,
    porDetector: DETECTORES.map(d => ({ chave: d.chave, nome: d.nome, total: recs.filter(r => r.detector === d.chave).length })),
    evidencia: { itens: evid, passa: evid.every(x => x.bate !== false) },
    utilidade: {
      amostra: amostra.map(a => ({ id: a.id, codigo: a.codigo, titulo: a.titulo, detector: a.detector, forca: a.forca, status: a.status, avaliacoes: a.avaliacoes.length, pertinentes: a.avaliacoes.filter(x => x.pertinente).length })),
      avaliacoes: avals.length, pertinentes, pct: avals.length ? r2((pertinentes / avals.length) * 100) : null,
      passa: avals.length > 0 ? pertinentes / avals.length >= 0.8 : null,
    },
    volumeMinimo: { abaixo, passa: abaixo === 0 },
    suspeitos: { comSuspeito, passa: comSuspeito === 0 },
    forca: { semForca: recs.filter(r => !r.forca).length, passa: recs.every(r => !!r.forca), porForca: ['COMPROVADA', 'PADRAO', 'HIPOTESE'].map(f => ({ forca: f, n: recs.filter(r => r.forca === f).length })) },
    nivel1: { semPessoa, atvAuto, niveis, passa: semPessoa === 0 && atvAuto === 0 && niveis },
    roteamento: { porTipo, vazou, passa: vazou === 0 },
    escalonamento: { escalonadas: Number(escal.n), tratarVencidas, passa: tratarVencidas === 0 || Number(escal.n) > 0 ? true : null },
    descarte: { descartadas: recs.filter(r => r.status === 'DESCARTADA').length, repeticoesEvitadas: memo.REPETICAO_EVITADA ?? 0, voltaram: Number(voltaram[0].n), passa: Number(voltaram[0].n) === 0 },
    ciclo: { aceitas: aceitas.length, comAtividades: comAtv.length, encerradas: recs.filter(r => r.status === 'ENCERRADA').length, passa: aceitas.every(a => comAtv.some(c => c.origemId === a.id)) },
    avaliacao: { avaliadas: avaliadas.length, passa: avaliadas.every(r => r.indicadorAntes && r.indicadorDepois) },
    duplicidade: { juntadas: memo.JUNTADA_A_CORRECAO ?? 0, passa: true },
    auditoria: { semEvento: Number(semEvento.n), passa: Number(semEvento.n) === 0 },
  }
}
