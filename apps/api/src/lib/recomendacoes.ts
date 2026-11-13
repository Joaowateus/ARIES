// PDF 03 · Recomendação (REC): criação a partir dos achados dos detectores,
// roteamento (4.3), modo silencioso, contexto (não repetir descartadas),
// junção com a camada de qualidade, ciclo (nova → aceita/descartada → em
// execução → avaliada → encerrada), Atividades geradas e memória.
// Nível 1: nada aqui executa ação sozinho; aceitar só cria as Atividades.
import { lerExpediente, prazoNoExpediente } from './expediente'
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { calcular, type Escopo, type Periodo } from './metricas'
import { DETECTORES_ONDA4, configAreas, responsavelDaArea, type GrupoArea } from './detectoresOnda4'
import { DETECTORES, detectar, type Achado } from './detectores'

const DIA = 86_400_000
export const PRAZO_DIAS = { PESSOA: 2, OUTROS: 5 } // decisão aprovada (PDF não define)
export const BLOQUEIO_DESCARTE_DIAS = 30 // descartada não volta no mesmo contexto por 30 dias

export type Roteamento = 'SILENCIOSO' | 'NORMAL'
export async function modoRoteamento(usuarioId: string): Promise<Roteamento> {
  const p = await prisma.parametroLiquidez.findUnique({ where: { usuarioId }, select: { recRoteamento: true } })
  return p?.recRoteamento === 'NORMAL' ? 'NORMAL' : 'SILENCIOSO'
}

async function supervisorDe(usuarioId: string): Promise<string | null> {
  const s = await prisma.vendedor.findFirst({ where: { usuarioId, ativo: true, papel: 'SUPERVISOR', funcao: null, vende: true }, select: { id: true }, orderBy: { criadoEm: 'asc' } })
  return s?.id ?? null
}

/** 4.3: quem recebe primeiro e quem acompanha. Gestor de tráfego ainda não existe: anúncios vão ao dono (decisão aprovada). */
export async function rotear(usuarioId: string, a: Pick<Achado, 'alvoTipo' | 'alvoId'>) {
  const sup = await supervisorDe(usuarioId)
  const supOuDono = sup ?? usuarioId
  switch (a.alvoTipo) {
    case 'PESSOA': return { destinatarioId: a.alvoId ?? usuarioId, acompanha: [supOuDono] }
    case 'CREDITO': return { destinatarioId: a.alvoId ?? supOuDono, acompanha: [supOuDono] }
    case 'ANUNCIOS': return { destinatarioId: usuarioId, acompanha: [usuarioId] }
    case 'RESULTADO': return { destinatarioId: usuarioId, acompanha: sup ? [sup] : [] }
    default: return { destinatarioId: supOuDono, acompanha: [usuarioId] } // EQUIPE, ETAPA, BANCO
  }
}
/** Quem vê agora: no modo silencioso, só o dono e o supervisor; no normal, quem recebe e quem acompanha. */
async function visiveis(usuarioId: string, destinatarioId: string, acompanha: string[], modo: Roteamento) {
  const sup = await supervisorDe(usuarioId)
  const base = modo === 'SILENCIOSO' ? [usuarioId, ...(sup ? [sup] : [])] : [destinatarioId, ...acompanha, usuarioId]
  return [...new Set(base)]
}
const ehIndividual = (alvoTipo: string) => alvoTipo === 'PESSOA' || alvoTipo === 'CREDITO'

/** Onda 4: semana silenciosa = só o dono e o responsável da área; normal = quem recebe, quem acompanha e o dono. */
async function visiveisDaArea(usuarioId: string, grupo: GrupoArea, destinatarioId: string, acompanha: string[], modo: Roteamento) {
  if (modo === 'SILENCIOSO') { const resp = await responsavelDaArea(usuarioId, grupo); return [...new Set([usuarioId, ...(resp ? [resp] : [])])] }
  return [...new Set([destinatarioId, ...acompanha, usuarioId])]
}

/** Ligar/desligar uma área e mudar o modo silencioso (só o dono, com justificativa e histórico). */
export async function mudarArea(usuarioId: string, grupo: GrupoArea, mudanca: { ligada?: boolean; modo?: Roteamento }, justificativa: string, autorId: string) {
  const atual = await configAreas(usuarioId)
  const antes = atual[grupo]
  const agora = new Date().toISOString()
  const depois = {
    ...antes,
    ...(mudanca.ligada !== undefined ? { ligada: mudanca.ligada, ligadaEm: mudanca.ligada && !antes.ligada ? agora : antes.ligadaEm } : {}),
    ...(mudanca.modo ? { modo: mudanca.modo, liberadaEm: mudanca.modo === 'NORMAL' && antes.modo !== 'NORMAL' ? agora : antes.liberadaEm } : {}),
  }
  const novo = { ...atual, [grupo]: depois }
  await prisma.parametroLiquidez.upsert({ where: { usuarioId }, create: { usuarioId, areasDetectores: novo as unknown as Prisma.InputJsonValue }, update: { areasDetectores: novo as unknown as Prisma.InputJsonValue } })
  await prisma.parametroHistorico.create({ data: { usuarioId, nome: `area.${grupo}`, valorAnterior: antes as unknown as Prisma.InputJsonValue, valorNovo: depois as unknown as Prisma.InputJsonValue, origem: 'MANUAL', justificativa, autorId } })
  // Mudou o modo: as RECs abertas da área passam a ir para quem deve ver.
  let afetadas = 0
  if (mudanca.modo && mudanca.modo !== antes.modo) {
    const chaves = DETECTORES_ONDA4.filter(d => d.grupo === grupo).map(d => d.chave)
    const abertas = await prisma.recomendacao.findMany({ where: { usuarioId, status: 'NOVA', detector: { in: chaves } } })
    for (const rec of abertas) {
      const vis = await visiveisDaArea(usuarioId, grupo, rec.destinatarioId ?? usuarioId, rec.acompanhaIds, mudanca.modo)
      await prisma.recomendacao.update({ where: { id: rec.id }, data: { visivelPara: vis, auditoriaAutor: 'AUTOMACAO|||roteamento-area' } })
      if (mudanca.modo === 'NORMAL' && ehIndividual(rec.alvoTipo)) await criarAtvTratar(rec)
      afetadas++
    }
  }
  return { areas: novo, afetadas }
}

/** Boa prática (4.4.2): o supervisor decide compartilhar com a equipe, sem nomes (ou reconhecendo a pessoa). */
export async function compartilharBoaPratica(recId: string, quem: Quem, comNome: boolean, texto?: string) {
  const rec = await prisma.recomendacao.findFirst({ where: { id: recId, usuarioId: quem.usuarioId } })
  if (!rec || !podeVerRec(rec, quem)) throw new ErroRec(404, 'Recomendação não encontrada')
  if (rec.detector !== 'boa_pratica') throw new ErroRec(400, 'Só boa prática é compartilhada com a equipe')
  if (quem.papel !== 'DONO' && quem.papel !== 'SUPERVISOR') throw new ErroRec(403, 'Quem decide compartilhar é o supervisor')
  if (rec.status === 'NOVA') await aceitar(rec.id, quem)
  const ev = rec.evidencia as { alvoNome?: string | null; metricas?: Array<{ detalhe?: { dica?: string } }> }
  const dica = ev.metricas?.[0]?.detalhe?.dica ?? 'faz algo que funciona melhor que a média'
  const nome = (ev.alvoNome ?? '').split(/\s+/)[0]
  const titulo = comNome && nome ? `Reconhecimento: ${nome.charAt(0)}${nome.slice(1).toLowerCase()} ${dica}` : `Boa prática da equipe: ${texto?.trim() || `quem ${dica} vende mais. Vale copiar a forma de trabalhar.`}`
  const equipe = await prisma.vendedor.findMany({ where: { usuarioId: quem.usuarioId, ativo: true }, select: { id: true } })
  const dicaRec = await prisma.recomendacao.create({
    data: {
      usuarioId: quem.usuarioId, auditoriaAutor: autorDe(quem), titulo: titulo.slice(0, 200), area: 'PESSOAS', detector: 'boa_pratica', tipo: 'FUNCIONANDO',
      evidencia: { metricas: [], casos: 0, volumeMinimo: 0, resumo: 'Aprendizado compartilhado pelo supervisor', origem: rec.id, comNome } as unknown as Prisma.InputJsonValue,
      forca: rec.forca, acaoSugerida: 'Experimentar no seu dia a dia', nivelAutonomia: 1, alvoTipo: 'DICA_EQUIPE', alvoId: null,
      destinatarioId: null, acompanhaIds: [], visivelPara: [...new Set([quem.usuarioId, ...equipe.map(e => e.id)])], prazo: new Date(Date.now() + 14 * DIA), contexto: `dica|${rec.id}`,
    },
  })
  return dicaRec
}

export const contextoDe = (a: Pick<Achado, 'detector' | 'alvoTipo' | 'alvoId' | 'tipo' | 'contextoExtra'>) =>
  [a.detector, a.alvoTipo, a.alvoId ?? '-', a.tipo, a.contextoExtra ?? ''].join('|')

async function lembrar(usuarioId: string, detector: string, contexto: string, acao: string, recomendacaoId?: string | null, detalhe?: string, resultado?: string) {
  await prisma.recomendacaoMemoria.create({ data: { usuarioId, detector, contexto, acao, recomendacaoId: recomendacaoId ?? null, detalhe: detalhe ?? null, resultado: resultado ?? null } })
}

/** Cria a REC do achado (ou explica por que não criou). */
export async function criarDoAchado(usuarioId: string, a: Achado, agora = new Date()): Promise<{ criada: boolean; motivo: string; id?: string }> {
  const contexto = contextoDe(a)
  // Já existe uma aberta no mesmo contexto: não duplica.
  const aberta = await prisma.recomendacao.findFirst({ where: { usuarioId, contexto, status: { in: ['NOVA', 'ACEITA', 'EM_EXECUCAO'] } }, select: { id: true } })
  if (aberta) return { criada: false, motivo: 'JA_ABERTA', id: aberta.id }
  // Descartada no mesmo contexto há menos de 30 dias: não repete (4.1.2).
  const descartada = await prisma.recomendacao.findFirst({ where: { usuarioId, contexto, status: 'DESCARTADA', atualizadoEm: { gte: new Date(agora.getTime() - BLOQUEIO_DESCARTE_DIAS * DIA) } }, select: { id: true } })
  if (descartada) {
    const hoje = new Date(agora.getTime() - 3 * 3_600_000).toISOString().slice(0, 10)
    const ja = await prisma.recomendacaoMemoria.findFirst({ where: { usuarioId, contexto, acao: 'REPETICAO_EVITADA', em: { gte: new Date(`${hoje}T03:00:00Z`) } } })
    if (!ja) await lembrar(usuarioId, a.detector, contexto, 'REPETICAO_EVITADA', descartada.id, 'Mesmo contexto descartado nos últimos 30 dias')
    return { criada: false, motivo: 'DESCARTADA_NO_CONTEXTO', id: descartada.id }
  }
  // A camada de qualidade já apontou o mesmo problema (metade ou mais dos registros com correção aberta): junta à correção.
  const ids = a.evidencia.registros?.ids ?? []
  if (ids.length) {
    const corr = await prisma.correcaoPendente.findMany({ where: { usuarioId, status: 'ABERTA', registroId: { in: ids } }, select: { id: true, registroId: true, detectores: true } })
    const cobertos = new Set(corr.map(c => c.registroId))
    if (cobertos.size * 2 >= ids.length) {
      for (const c of corr) if (!c.detectores.includes(a.detector)) await prisma.correcaoPendente.update({ where: { id: c.id }, data: { detectores: [...c.detectores, a.detector] } })
      await lembrar(usuarioId, a.detector, contexto, 'JUNTADA_A_CORRECAO', null, `${cobertos.size} de ${ids.length} registros já estão na Saúde dos dados`)
      return { criada: false, motivo: 'JUNTADA_A_CORRECAO' }
    }
  }
  let modo = await modoRoteamento(usuarioId)
  let r = await rotear(usuarioId, a)
  let visivelPara = await visiveis(usuarioId, r.destinatarioId, r.acompanha, modo)
  // PDF 05: áreas da onda 4 têm o próprio roteamento (tabela da área) e o próprio modo silencioso.
  if (a.grupo) {
    const area = (await configAreas(usuarioId))[a.grupo]
    modo = area.modo
    r = { destinatarioId: a.destino?.destinatarioId ?? usuarioId, acompanha: [...new Set(a.destino?.acompanha ?? [])] }
    visivelPara = await visiveisDaArea(usuarioId, a.grupo, r.destinatarioId, r.acompanha, modo)
  }
  // PDF 06 · correção 9: o prazo vence no fim do expediente do dia, nunca de madrugada.
  const prazo = prazoNoExpediente(agora, ehIndividual(a.alvoTipo) ? PRAZO_DIAS.PESSOA : PRAZO_DIAS.OUTROS, await lerExpediente(usuarioId))
  const def = DETECTORES.find(d => d.chave === a.detector)!
  const rec = await prisma.recomendacao.create({
    data: {
      usuarioId, auditoriaAutor: 'AUTOMACAO|||detector', titulo: a.titulo, area: a.area, detector: a.detector, tipo: a.tipo,
      evidencia: { ...a.evidencia, orientacao: a.orientacao ?? null, alvoNome: a.alvoNome ?? null, regra: def.dispara } as unknown as Prisma.InputJsonValue,
      forca: a.forca, impacto: (a.impacto ?? Prisma.JsonNull) as Prisma.InputJsonValue, acaoSugerida: a.acaoSugerida, nivelAutonomia: 1,
      alvoTipo: a.alvoTipo, alvoId: a.alvoId, destinatarioId: r.destinatarioId, acompanhaIds: r.acompanha, visivelPara, prazo, contexto,
    },
  })
  await lembrar(usuarioId, a.detector, contexto, 'CRIADA', rec.id, a.evidencia.resumo)
  if (modo === 'NORMAL' && ehIndividual(a.alvoTipo)) await criarAtvTratar(rec)
  return { criada: true, motivo: 'CRIADA', id: rec.id }
}

/** Orientação individual: uma Atividade "tratar recomendação" na régua; sem tratar no prazo, escala ao supervisor. */
async function criarAtvTratar(rec: { id: string; usuarioId: string; destinatarioId: string | null; prazo: Date; titulo: string; numero: number }) {
  await prisma.atividade.createMany({
    data: [{
      usuarioId: rec.usuarioId, auditoriaAutor: 'AUTOMACAO|||recomendacao', tipo: 'TRATAR_RECOMENDACAO', origemTipo: 'RECOMENDACAO', origemId: rec.id,
      responsavelId: rec.destinatarioId, prazo: rec.prazo, oQueFazer: `Aceitar ou descartar a recomendação REC-${String(rec.numero).padStart(4, '0')}: ${rec.titulo}`,
      registroTabela: 'pro_labore_recomendacoes', registroId: `${rec.id}|tratar`,
    }],
    skipDuplicates: true,
  })
}

/** Ligar o roteamento normal (liberação do dono): as RECs abertas passam a ir para quem deve agir. */
export async function mudarRoteamento(usuarioId: string, modo: Roteamento) {
  await prisma.parametroLiquidez.upsert({ where: { usuarioId }, create: { usuarioId, recRoteamento: modo }, update: { recRoteamento: modo } })
  // Só as RECs da área comercial (PDF 03); as da onda 4 seguem o modo da própria área.
  const abertas = await prisma.recomendacao.findMany({ where: { usuarioId, status: 'NOVA', detector: { notIn: DETECTORES_ONDA4.map(d => d.chave) } } })
  for (const rec of abertas) {
    const visivelPara = await visiveis(usuarioId, rec.destinatarioId ?? usuarioId, rec.acompanhaIds, modo)
    await prisma.recomendacao.update({ where: { id: rec.id }, data: { visivelPara, auditoriaAutor: 'AUTOMACAO|||roteamento' } })
    if (modo === 'NORMAL' && ehIndividual(rec.alvoTipo)) await criarAtvTratar(rec)
  }
  return abertas.length
}

/** Roda os detectores e cria as RECs (cron). */
export async function rodarDetectores(usuarioId: string, agora = new Date(), quais?: string[]) {
  const achados = await detectar(usuarioId, agora, quais)
  const res = []
  for (const a of achados) res.push({ detector: a.detector, titulo: a.titulo, ...(await criarDoAchado(usuarioId, a, agora)) })
  return res
}
export async function rodarDetectoresTodas(agora = new Date(), quais?: string[]) {
  const contas = await prisma.proLaboreUsuario.findMany({ select: { id: true } })
  let criadas = 0
  for (const c of contas) criadas += (await rodarDetectores(c.id, agora, quais).catch(e => { console.error('[detectores]', e); return [] })).filter(r => r.criada).length
  return { recsCriadas: criadas }
}

// ----------------------------------------------------------------------------
// Ciclo

export class ErroRec extends Error { constructor(public status: number, m: string) { super(m) } }
const ACOES_POR_DETECTOR: Record<string, string[]> = {
  resposta_lenta: ['Separar janelas fixas no dia para responder os novos contatos', 'Rever a fila de conversas esperando e redistribuir o que passar do limite'],
  funil_parado: ['Listar os leads parados há mais tempo e decidir: follow agora ou Reativação', 'Fazer o mutirão de follow com os que ficarem'],
  etapa_travando: ['Revisar 10 conversas da etapa que travou e anotar o ponto fraco', 'Treinar a equipe no ponto fraco encontrado'],
  atividades_acumuladas: ['Repriorizar as atividades atrasadas (clientes mais adiantados primeiro)', 'Pedir redistribuição ao supervisor do que não couber'],
  credito_emperrado: ['Cobrar o banco pelas fichas paradas', 'Rever a ordem de envio das fichas'],
  anuncio_encarecendo: ['Revisar criativos e públicos com o gestor de tráfego', 'Reajustar a verba entre as campanhas'],
  meta_em_risco: ['Definir a meta de vendas por dia até o fim do mês', 'Concentrar o time na etapa com menor conversão'],
}
const autorDe = (quem: { id: string; papel: string }) => `USUARIO|${quem.id}|${quem.papel}|rec`

/** Aceitar: só quem recebeu pelo roteamento (ou o dono). Cria as Atividades com a REC como origem. */
export async function aceitar(recId: string, quem: { id: string; papel: string; usuarioId: string }, agora = new Date(), atribuirA?: string | null) {
  const rec = await prisma.recomendacao.findFirst({ where: { id: recId, usuarioId: quem.usuarioId } })
  if (!rec || !podeVerRec(rec, quem)) throw new ErroRec(404, 'Recomendação não encontrada')
  if (rec.status !== 'NOVA') throw new ErroRec(409, 'Esta recomendação já foi tratada')
  if (!podeDecidir(rec, quem)) throw new ErroRec(403, 'Só quem recebeu a recomendação pode aceitar ou descartar')
  const antes = await indicador(rec, { inicio: diaBrt(agora.getTime() - 14 * DIA), fim: diaBrt(agora.getTime() - DIA) }, agora)
  const passos = (ACOES_POR_DETECTOR[rec.detector] ?? [rec.acaoSugerida]).slice(0, rec.tipo === 'FUNCIONANDO' ? 1 : 3)
  // PDF 04 · "Aceitar e atribuir": dono e supervisor escolhem quem executa (alguém ativo da conta).
  let resp = rec.destinatarioId ?? quem.usuarioId
  if (atribuirA && (quem.papel === 'DONO' || quem.papel === 'SUPERVISOR')) {
    const p = await prisma.vendedor.findFirst({ where: { id: atribuirA, usuarioId: quem.usuarioId, ativo: true }, select: { id: true } })
    if (!p) throw new ErroRec(400, 'Pessoa não encontrada para atribuir')
    resp = p.id
  }
  const exp = await lerExpediente(rec.usuarioId)
  await prisma.$transaction([
    prisma.recomendacao.update({ where: { id: rec.id }, data: { status: 'ACEITA', aceitaEm: agora, decididoPor: quem.id, indicadorAntes: antes as unknown as Prisma.InputJsonValue, auditoriaAutor: autorDe(quem) } }),
    prisma.atividade.createMany({
      data: passos.map((t, i) => ({
        usuarioId: rec.usuarioId, auditoriaAutor: autorDe(quem), tipo: 'ACAO_RECOMENDACAO', origemTipo: 'RECOMENDACAO', origemId: rec.id,
        responsavelId: resp, prazo: prazoNoExpediente(agora, (i + 1) * 2, exp), oQueFazer: `${rec.codigo ?? 'REC'} · ${t}`,
        registroTabela: 'pro_labore_recomendacoes', registroId: `${rec.id}|acao${i + 1}`,
      })),
      skipDuplicates: true,
    }),
    prisma.atividade.updateMany({ where: { registroTabela: 'pro_labore_recomendacoes', registroId: `${rec.id}|tratar`, status: 'PENDENTE' }, data: { status: 'EXECUTADA', executadaEm: agora, resultado: 'Aceita', autorExecucao: quem.id, autorExecucaoTipo: 'PESSOA', reguaEstado: 'PARADA', auditoriaAutor: autorDe(quem) } }),
  ])
  await lembrar(rec.usuarioId, rec.detector, rec.contexto, 'ACEITA', rec.id)
  return detalhe(rec.id, quem)
}

/** Descartar: exige motivo; o mesmo contexto não volta por 30 dias. */
export async function descartar(recId: string, quem: { id: string; papel: string; usuarioId: string }, motivo: string, agora = new Date()) {
  const rec = await prisma.recomendacao.findFirst({ where: { id: recId, usuarioId: quem.usuarioId } })
  if (!rec || !podeVerRec(rec, quem)) throw new ErroRec(404, 'Recomendação não encontrada')
  if (rec.status !== 'NOVA') throw new ErroRec(409, 'Esta recomendação já foi tratada')
  if (!podeDecidir(rec, quem)) throw new ErroRec(403, 'Só quem recebeu a recomendação pode aceitar ou descartar')
  if (!motivo || motivo.trim().length < 5) throw new ErroRec(400, 'Escreva o motivo do descarte')
  await prisma.$transaction([
    prisma.recomendacao.update({ where: { id: rec.id }, data: { status: 'DESCARTADA', motivoDescarte: motivo.trim(), decididoPor: quem.id, encerradaEm: agora, auditoriaAutor: autorDe(quem) } }),
    prisma.atividade.updateMany({ where: { registroTabela: 'pro_labore_recomendacoes', registroId: `${rec.id}|tratar`, status: 'PENDENTE' }, data: { status: 'EXECUTADA', executadaEm: agora, resultado: `Descartada: ${motivo.trim()}`, autorExecucao: quem.id, autorExecucaoTipo: 'PESSOA', reguaEstado: 'PARADA', auditoriaAutor: autorDe(quem) } }),
  ])
  await lembrar(rec.usuarioId, rec.detector, rec.contexto, 'DESCARTADA', rec.id, motivo.trim())
  return detalhe(rec.id, quem)
}

/** Concluir uma Atividade da REC: a REC vai para "em execução"; com todas feitas, fica pronta para avaliar. */
export async function concluirAtividade(recId: string, atvId: string, quem: { id: string; papel: string; usuarioId: string }, resultado: string, agora = new Date()) {
  const rec = await prisma.recomendacao.findFirst({ where: { id: recId, usuarioId: quem.usuarioId } })
  if (!rec || !podeVerRec(rec, quem)) throw new ErroRec(404, 'Recomendação não encontrada')
  if (!['ACEITA', 'EM_EXECUCAO'].includes(rec.status)) throw new ErroRec(409, 'A recomendação não está em execução')
  const atv = await prisma.atividade.findFirst({ where: { id: atvId, origemTipo: 'RECOMENDACAO', origemId: rec.id, tipo: 'ACAO_RECOMENDACAO' } })
  if (!atv) throw new ErroRec(404, 'Atividade não encontrada')
  if (quem.papel !== 'DONO' && quem.papel !== 'SUPERVISOR' && atv.responsavelId !== quem.id) throw new ErroRec(403, 'A atividade é de outra pessoa')
  await prisma.atividade.updateMany({ where: { id: atv.id, status: 'PENDENTE' }, data: { status: 'EXECUTADA', executadaEm: agora, resultado: resultado?.trim() || 'Feito', autorExecucao: quem.id, autorExecucaoTipo: 'PESSOA', reguaEstado: 'PARADA', auditoriaAutor: autorDe(quem) } })
  const pendentes = await prisma.atividade.count({ where: { origemTipo: 'RECOMENDACAO', origemId: rec.id, tipo: 'ACAO_RECOMENDACAO', status: 'PENDENTE' } })
  await prisma.recomendacao.update({ where: { id: rec.id }, data: { status: 'EM_EXECUCAO', ...(pendentes === 0 ? { executadaEm: agora } : {}), auditoriaAutor: autorDe(quem) } })
  return detalhe(rec.id, quem)
}

/**
 * Avaliar: indicador antes (14 dias antes do aceite) contra depois (desde a execução).
 * Mostra o que mais mudou no mesmo período, para não atribuir a melhora só à ação (4.1.3).
 */
export async function avaliar(recId: string, quem: { id: string; papel: string; usuarioId: string }, resultado: 'MANTER' | 'AJUSTAR' | 'REVERTER', nota: string | undefined, agora = new Date()) {
  const rec = await prisma.recomendacao.findFirst({ where: { id: recId, usuarioId: quem.usuarioId } })
  if (!rec || !podeVerRec(rec, quem)) throw new ErroRec(404, 'Recomendação não encontrada')
  if (rec.status !== 'EM_EXECUCAO' || !rec.executadaEm) throw new ErroRec(409, 'Conclua as atividades antes de avaliar')
  if (!podeDecidir(rec, quem) && quem.papel !== 'SUPERVISOR') throw new ErroRec(403, 'Sem permissão para avaliar')
  const ini = rec.executadaEm.getTime()
  const depois = await indicador(rec, { inicio: diaBrt(ini), fim: diaBrt(Math.max(ini, agora.getTime())) }, agora)
  const outras = await prisma.recomendacao.findMany({ where: { usuarioId: rec.usuarioId, id: { not: rec.id }, aceitaEm: { gte: rec.aceitaEm ?? rec.criadoEm, lte: agora } }, select: { codigo: true, titulo: true } })
  const parametros = await prisma.parametroHistorico.findMany({ where: { usuarioId: rec.usuarioId, criadoEm: { gte: rec.aceitaEm ?? rec.criadoEm, lte: agora } }, select: { nome: true, criadoEm: true } })
  const diasDepois = Math.max(1, Math.round((agora.getTime() - ini) / DIA))
  await prisma.recomendacao.update({
    where: { id: rec.id },
    data: {
      status: 'AVALIADA', avaliadaEm: agora, resultado, resultadoNota: nota?.trim() || null, auditoriaAutor: autorDe(quem),
      indicadorDepois: { ...depois, diasDepois, periodoCurto: diasDepois < 14, outrasMudancas: { recomendacoes: outras, parametros } } as unknown as Prisma.InputJsonValue,
    },
  })
  await lembrar(rec.usuarioId, rec.detector, rec.contexto, 'AVALIADA', rec.id, nota, resultado)
  return detalhe(rec.id, quem)
}
export async function encerrar(recId: string, quem: { id: string; papel: string; usuarioId: string }, agora = new Date()) {
  const rec = await prisma.recomendacao.findFirst({ where: { id: recId, usuarioId: quem.usuarioId } })
  if (!rec || !podeVerRec(rec, quem)) throw new ErroRec(404, 'Recomendação não encontrada')
  if (rec.status !== 'AVALIADA') throw new ErroRec(409, 'Avalie o resultado antes de encerrar')
  await prisma.recomendacao.update({ where: { id: rec.id }, data: { status: 'ENCERRADA', encerradaEm: agora, auditoriaAutor: autorDe(quem) } })
  return detalhe(rec.id, quem)
}

const diaBrt = (t: number) => new Date(t - 3 * 3_600_000).toISOString().slice(0, 10)
/** O indicador principal da REC (a 1ª métrica da evidência), no escopo do alvo. */
async function indicador(rec: { usuarioId: string; detector: string; alvoTipo: string; alvoId: string | null; evidencia: unknown }, p: Periodo, agora: Date) {
  const ev = rec.evidencia as { metricas?: Array<{ chave: string; nome: string }> }
  const m = ev.metricas?.[0]
  if (!m) return { periodo: p, valor: null }
  const e: Escopo = { usuarioId: rec.usuarioId, papel: 'DONO', semSuspeitos: true, vendedorId: rec.alvoTipo === 'PESSOA' ? rec.alvoId : null }
  if (m.chave === 'conversao_por_etapa' && rec.alvoTipo === 'ETAPA') {
    const v = await calcular('conversao_por_etapa', e, p, agora)
    const linha = (v.detalhe as Array<{ etapa: string; conversao: number | null; chegaram: number }>).find(x => x.etapa === rec.alvoId)
    return { metrica: m.nome, chave: m.chave, periodo: p, valor: linha?.conversao ?? null, amostra: linha?.chegaram ?? 0 }
  }
  const chave = m.chave === 'tempo_resposta_banco' ? 'aprovacao_credito' : m.chave
  const v = await calcular(chave, e, p, agora).catch(() => ({ valor: null, amostra: 0 }))
  return { metrica: m.nome, chave, periodo: p, valor: v.valor, amostra: v.amostra ?? 0 }
}

// ----------------------------------------------------------------------------
// Quem vê e quem decide (P7 e 4.3)

type Quem = { id: string; papel: string; usuarioId: string }
export function podeVerRec(rec: { visivelPara: string[]; alvoTipo: string; alvoId: string | null }, quem: Quem) {
  if (quem.papel === 'DONO') return true
  if (!rec.visivelPara.includes(quem.id)) return false
  // O vendedor nunca vê achado sobre colega.
  if (quem.papel !== 'SUPERVISOR' && (rec.alvoTipo === 'PESSOA' || rec.alvoTipo === 'CREDITO') && rec.alvoId !== quem.id) return false
  return true
}
/** 4.7: aceitar ou descartar é de quem recebeu pelo roteamento; no modo silencioso, dono e supervisor tratam. */
export function podeDecidir(rec: { destinatarioId: string | null; visivelPara: string[]; usuarioId: string }, quem: Quem) {
  if (quem.papel === 'DONO') return true
  if (rec.destinatarioId === quem.id && rec.visivelPara.includes(quem.id)) return true
  return quem.papel === 'SUPERVISOR' && !rec.visivelPara.includes(rec.destinatarioId ?? '')
}

export async function detalhe(recId: string, quem: Quem) {
  const rec = await prisma.recomendacao.findFirst({ where: { id: recId, usuarioId: quem.usuarioId }, include: { avaliacoes: true } })
  if (!rec || !podeVerRec(rec, quem)) throw new ErroRec(404, 'Recomendação não encontrada')
  const [atividades, historico, pessoas] = await Promise.all([
    prisma.atividade.findMany({ where: { origemTipo: 'RECOMENDACAO', origemId: rec.id }, orderBy: { numero: 'asc' }, select: { id: true, codigo: true, tipo: true, oQueFazer: true, prazo: true, status: true, resultado: true, responsavelId: true, executadaEm: true, reguaEstado: true } }),
    prisma.$queryRaw<Array<{ acao: string; campo: string | null; valorAnterior: string | null; valorNovo: string | null; autorOrigem: string; autorId: string | null; em: Date }>>`SELECT acao, campo, "valorAnterior", "valorNovo", "autorOrigem", "autorId", em FROM pro_labore_eventos_auditoria WHERE tabela = 'pro_labore_recomendacoes' AND "registroId" = ${rec.id} AND (campo IS NULL OR campo IN ('status', 'motivoDescarte', 'resultado', 'visivelPara')) ORDER BY em`,
    prisma.vendedor.findMany({ where: { usuarioId: rec.usuarioId }, select: { id: true, nome: true } }),
  ])
  const nome = (id: string | null) => (!id ? null : id === rec.usuarioId ? 'Dono' : pessoas.find(p => p.id === id)?.nome ?? id)
  return {
    ...rec, destinatario: nome(rec.destinatarioId), acompanham: rec.acompanhaIds.map(nome),
    podeDecidir: rec.status === 'NOVA' && podeDecidir(rec, quem),
    minhaAvaliacao: rec.avaliacoes.find(a => a.avaliadorId === quem.id) ?? null,
    atividades: atividades.map(a => ({ ...a, responsavel: nome(a.responsavelId) })),
    historico: historico.map(h => ({ ...h, quem: h.autorOrigem === 'AUTOMACAO' ? 'ARIES (automação)' : nome(h.autorId) ?? 'Sistema' })),
  }
}
