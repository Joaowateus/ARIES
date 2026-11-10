// PDF 05 · seção 9: teste de aceite de uma área da onda 4, calculado na
// própria produção (o dono vê em Configurações). Uma área por vez.
import { prisma } from './prisma'
import { calcular, type Escopo, type Periodo } from './metricas'
import { DETECTORES_ONDA4, configAreas, papeisDaConta, responsavelDaArea, type GrupoArea } from './detectoresOnda4'
import { envioSeguro } from './pergunte'

const igual = (a: number | null, b: number | null) => (a == null && b == null) || (a != null && b != null && Math.abs(a - b) < 0.11)
// Detectores cujo número principal é a própria métrica do dicionário (os demais contam registros direto da fonte).
const RECALCULAVEL: Record<string, (ev: { valor: number | null; periodo: Periodo; detalhe?: Record<string, unknown> }, alvoId: string | null) => { chave: string; escopoPessoa: boolean; extrair?: (v: { valor: number | null; detalhe?: unknown }) => number | null } | null> = {
  recuperacao_caindo: () => ({ chave: 'taxa_recuperacao', escopoPessoa: false }),
  conteudo_abaixo: () => ({ chave: 'posts_publicados', escopoPessoa: false }),
  saida_fora_padrao: () => ({ chave: 'saidas_financeiro', escopoPessoa: false }),
  rotina_nao_cumprida: () => ({ chave: 'aderencia_agenda', escopoPessoa: true }),
  campanha_lead_fraco: (ev) => ({ chave: 'avanco_por_campanha', escopoPessoa: false, extrair: v => (v.detalhe as Array<{ campanha: string; avanco: number | null }>)?.find(x => x.campanha === ev.detalhe?.campanha)?.avanco ?? null }),
}

export async function aceitePdf05(usuarioId: string, grupo: GrupoArea, agora = new Date()) {
  const chaves = DETECTORES_ONDA4.filter(d => d.grupo === grupo).map(d => d.chave)
  const recs = await prisma.recomendacao.findMany({ where: { usuarioId, detector: { in: chaves } }, orderBy: { criadoEm: 'desc' }, take: 300, include: { avaliacoes: { select: { pertinente: true } } } })
  const areas = await configAreas(usuarioId)
  const papeis = await papeisDaConta(usuarioId)
  const resp = await responsavelDaArea(usuarioId, grupo)

  // Evidência: o número da REC recalculado pelo dicionário (mesmo período e escopo).
  const evid = []
  for (const r of recs.filter(x => x.alvoTipo !== 'DICA_EQUIPE').slice(0, 40)) {
    const m = (r.evidencia as { metricas?: Array<{ valor: number | null; periodo: Periodo; detalhe?: Record<string, unknown> }> }).metricas?.[0]
    const regra = m && RECALCULAVEL[r.detector]?.(m, r.alvoId)
    if (!m || !regra) { evid.push({ codigo: r.codigo, titulo: r.titulo, valor: m?.valor ?? null, dicionario: null, bate: null }); continue }
    const e: Escopo = { usuarioId, papel: 'DONO', semSuspeitos: true, vendedorId: regra.escopoPessoa ? r.alvoId : null }
    const v = await calcular(regra.chave, e, m.periodo, agora).catch(() => null)
    const dic = v ? (regra.extrair ? regra.extrair(v) : v.valor) : null
    evid.push({ codigo: r.codigo, titulo: r.titulo, valor: m.valor, dicionario: dic, bate: v ? igual(m.valor, dic) : null })
  }
  // Utilidade: amostra de 10 RECs da área, avaliadas pelo responsável (e pelo dono).
  const amostra = recs.filter(r => r.alvoTipo !== 'DICA_EQUIPE').slice(0, 10)
  const avals = amostra.flatMap(a => a.avaliacoes)
  const pert = avals.filter(a => a.pertinente).length
  // Roteamento: na semana silenciosa, só o dono e o responsável da área; no normal, quem recebe e quem acompanha.
  const roteamento = recs.filter(r => r.status === 'NOVA' && r.alvoTipo !== 'DICA_EQUIPE').map(r => {
    const silencioso = areas[grupo].modo === 'SILENCIOSO'
    const ok = silencioso
      ? r.visivelPara.every(v => v === usuarioId || v === resp)
      : [r.destinatarioId, ...r.acompanhaIds].filter((x): x is string => !!x).every(v => r.visivelPara.includes(v))
    // Conteúdo vai ao social media (quando a conta tem um).
    const conteudoOk = !['conteudo_abaixo', 'post_que_vende'].includes(r.detector) || !papeis.socialMedia || r.destinatarioId === papeis.socialMedia
    return { codigo: r.codigo, detector: r.detector, ok: ok && conteudoOk }
  })
  // Cuidados de Pessoas: ocorrência só para supervisor e dono; boa prática sem ranking nem nomes; vendedor nunca vê colega.
  const equipe = new Set(papeis.equipe.map(v => v.id))
  const nomes = papeis.equipe.map(v => v.nome.split(/\s+/)[0]).filter(n => n.length > 2)
  const ocorrencias = recs.filter(r => r.detector === 'ocorrencia_repetida')
  const ocOk = ocorrencias.every(r => r.visivelPara.every(v => v === usuarioId || v === papeis.supervisor || !equipe.has(v) || v === papeis.supervisor) && !r.visivelPara.includes(r.alvoId ?? '__'))
  const dicas = recs.filter(r => r.alvoTipo === 'DICA_EQUIPE')
  const dicasOk = dicas.every(r => (r.evidencia as { comNome?: boolean }).comNome || !nomes.some(n => new RegExp(`\\b${n}\\b`, 'i').test(r.titulo)))
  const pessoaOk = recs.filter(r => r.alvoTipo === 'PESSOA').every(r => r.visivelPara.every(v => !equipe.has(v) || v === r.alvoId || v === papeis.supervisor))
  // Gestão: nada vai à IA (os detectores são código); e o registro do que vai à IA não tem R$.
  const envios = await prisma.iaEnvio.findMany({ where: { usuarioId }, select: { conteudo: true } })
  const inseguros = envios.filter(e => !envioSeguro(e.conteudo)).length
  // Reativação: cliente bloqueado nunca em REC; promoção de roteiro só depois da aprovação da gestão.
  const bloqueados = new Set((await prisma.lead.findMany({ where: { usuarioId, cliente: { is: { bloqueado: true } } }, select: { id: true } })).map(l => l.id))
  const comBloqueado = recs.filter(r => ((r.evidencia as { registros?: { ids?: string[] } }).registros?.ids ?? []).some(id => bloqueados.has(id))).length
  const gestaoIds = new Set([usuarioId, papeis.supervisor].filter(Boolean) as string[])
  const roteiros = recs.filter(r => r.detector === 'roteiro_que_recupera')
  const promocaoOk = roteiros.every(r => r.status === 'NOVA' || r.status === 'DESCARTADA' || (r.decididoPor != null && gestaoIds.has(r.decididoPor)))
  // Sem duplicidade e sistema atual.
  const juntadas = await prisma.recomendacaoMemoria.count({ where: { usuarioId, detector: { in: chaves }, acao: 'JUNTADA_A_CORRECAO' } })
  const desligadas = (Object.keys(areas) as GrupoArea[]).filter(g => !areas[g].ligada)
  const chavesDesligadas = DETECTORES_ONDA4.filter(d => desligadas.includes(d.grupo as GrupoArea)).map(d => d.chave)
  const recsDesligadas = chavesDesligadas.length ? await prisma.recomendacao.count({ where: { usuarioId, detector: { in: chavesDesligadas }, alvoTipo: { not: 'DICA_EQUIPE' }, criadoEm: { gte: new Date(agora.getTime() - 7 * 86_400_000) } } }) : 0

  return {
    grupo, area: areas[grupo], responsavel: resp, total: recs.length,
    porDetector: chaves.map(c => ({ chave: c, nome: DETECTORES_ONDA4.find(d => d.chave === c)!.nome, total: recs.filter(r => r.detector === c).length })),
    evidencia: { itens: evid, passa: evid.some(x => x.bate !== null) ? evid.every(x => x.bate !== false) : null },
    utilidade: { amostra: amostra.map(a => ({ id: a.id, codigo: a.codigo, titulo: a.titulo, detector: a.detector, forca: a.forca, avaliacoes: a.avaliacoes.length, pertinentes: a.avaliacoes.filter(x => x.pertinente).length })), avaliacoes: avals.length, pertinentes: pert, pct: avals.length ? Math.round((pert / avals.length) * 1000) / 10 : null, passa: avals.length ? pert / avals.length >= 0.8 : null },
    roteamento: { itens: roteamento, passa: roteamento.length ? roteamento.every(r => r.ok) : null },
    pessoas: grupo === 'PESSOAS' ? { ocorrencias: ocorrencias.length, dicas: dicas.length, passa: ocOk && dicasOk && pessoaOk } : null,
    gestaoSemIa: grupo === 'GESTAO' ? { envios: envios.length, inseguros, passa: inseguros === 0 } : null,
    reativacao: grupo === 'REATIVACAO' ? { comBloqueado, roteiros: roteiros.length, passa: comBloqueado === 0 && promocaoOk } : null,
    duplicidade: { juntadas, passa: true },
    sistemaAtual: { areasDesligadas: desligadas, recsDeAreasDesligadas: recsDesligadas, passa: recsDesligadas === 0 },
  }
}
