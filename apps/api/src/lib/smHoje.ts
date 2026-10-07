// Tela 01 · Hoje (seção 4): o cockpit do dia, montado só com dados reais.
// Cada bloco respeita o nível do módulo correspondente (seção 3.1): sem
// acesso, o bloco não vem.
import { prisma } from './prisma'
import type { ContextoSM } from './smAcesso'
import { carregarConfig, diaLocal } from './smCalendario'
import { listarEstoque } from './smEstoque'
import { pendenciasParaPublicar } from './smPautas'
import { gerarPautasDeVendas } from './smPautasAuto'
import { montarAnaliseSocialMedia } from './socialMediaAnalytics'
import { filaAtendimento, tempoRespostaSemana } from './smAtendimento'

const OFFSET_MS = 3 * 3600 * 1000
const DIA_MS = 24 * 3600 * 1000
const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const DIAS_SEM_POST_RETOMADA = 3

const inicioDoDia = (dia: string) => new Date(Date.parse(`${dia}T00:00:00Z`) + OFFSET_MS)
const somarDias = (dia: string, n: number) => new Date(Date.parse(`${dia}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10)
const horaLocal = (d: Date) => new Date(d.getTime() - OFFSET_MS).toISOString().slice(11, 16)
const mediana = (v: number[]) => {
  if (!v.length) return 0
  const s = [...v].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function saudacaoDoHorario(agora: Date): string {
  const h = Number(horaLocal(agora).slice(0, 2))
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

export async function montarHoje(sm: ContextoSM, pessoa: { nome: string; tratamento: string | null }, agora = new Date()) {
  const usuarioId = sm.usuarioId
  const veProducao = sm.pode('producao', 'LEITURA')
  const veEstoque = sm.pode('estoque', 'LEITURA')
  const veCrm = sm.pode('crm', 'LEITURA')
  const veAnalise = sm.pode('analise', 'LEITURA')
  const veAtendimento = sm.pode('atendimento', 'LEITURA')
  if (veProducao) await gerarPautasDeVendas(usuarioId, agora)

  const hoje = diaLocal(agora)
  const segunda = somarDias(hoje, -((new Date(`${hoje}T00:00:00Z`).getUTCDay() + 6) % 7))
  const inicioSemana = inicioDoDia(segunda)
  const fimSemana = inicioDoDia(somarDias(segunda, 7))
  const inicioHoje = inicioDoDia(hoje)
  const fimHoje = inicioDoDia(somarDias(hoje, 1))

  const [config, conta] = await Promise.all([
    carregarConfig(usuarioId),
    prisma.socialMediaConta.findUnique({ where: { titular: `dono:${usuarioId}` } }),
  ])
  const desde90 = new Date(agora.getTime() - 90 * DIA_MS)
  const [feed, pautas, leadsSemana, estoque] = await Promise.all([
    conta
      ? prisma.socialMediaMidia.findMany({
        where: { contaId: conta.id, publicadoEm: { gte: desde90 }, NOT: { formato: { in: ['STORY', 'AD'] } } },
        select: { id: true, legenda: true, formato: true, tipo: true, publicadoEm: true, alcance: true, instagramMediaId: true },
        orderBy: { publicadoEm: 'desc' },
      })
      : Promise.resolve([]),
    veProducao
      ? prisma.smPauta.findMany({
        where: { usuarioId, OR: [{ status: { not: 'PUBLICADO' } }, { publicadaEm: { gte: inicioSemana } }] },
        include: { midias: { select: { tipo: true } } },
      })
      : Promise.resolve([]),
    veCrm ? prisma.lead.count({ where: { usuarioId, tipoLead: 'ORGANICO', criadoEm: { gte: inicioSemana, lt: fimSemana } } }) : Promise.resolve(null),
    veEstoque ? listarEstoque(usuarioId, agora) : Promise.resolve(null),
  ])

  // --- Cadência: dias com post no feed (publicados) e o que está planejado ---
  const diasPublicados = new Set(feed.filter(m => m.publicadoEm >= inicioSemana && m.publicadoEm < fimSemana).map(m => diaLocal(m.publicadoEm)))
  const diasPlanejados = new Set(pautas
    .filter(p => p.formato !== 'STORY' && p.status !== 'PUBLICADO' && p.agendadoPara && p.agendadoPara >= inicioHoje && p.agendadoPara < fimSemana && ['APROVACAO', 'AGENDADO'].includes(p.status))
    .map(p => diaLocal(p.agendadoPara!)))
  const ultimoPost = feed[0]?.publicadoEm ?? null
  const diasSemPost = ultimoPost ? Math.floor((inicioHoje.getTime() - inicioDoDia(diaLocal(ultimoPost)).getTime()) / DIA_MS) : null
  const diasNaSemana = new Set([...diasPublicados, ...diasPlanejados]).size

  // --- Publicar hoje ---
  const publicarHoje = pautas
    .filter(p => {
      const quando = p.status === 'PUBLICADO' ? p.publicadaEm : p.agendadoPara
      return quando && quando >= inicioHoje && quando < fimHoje
    })
    .map(p => {
      const quando = (p.status === 'PUBLICADO' ? p.publicadaEm : p.agendadoPara)!
      return { id: p.id, hora: horaLocal(quando), formato: p.formato, titulo: p.titulo, pilar: p.pilar, codigo: p.codigo, trial: p.trial, status: p.status, aprovacao: p.aprovacao, publicacaoStatus: p.publicacaoStatus }
    })
    .sort((a, b) => a.hora.localeCompare(b.hora))

  // --- Estoque sem conteúdo (as 3 mais urgentes) ---
  const ordemStatus = { PARADA: 0, ATENCAO: 1, OK: 2 } as const
  const estoqueSemConteudo = estoque
    ? estoque.filter(m => m.situacao === 'DISPONIVEL')
      .sort((a, b) => ordemStatus[a.status] - ordemStatus[b.status] || a.posts - b.posts || b.diasEmEstoque - a.diasEmEstoque)
      .slice(0, 3)
      .map(m => ({ id: m.id, modelo: m.modelo, ano: m.ano, cor: m.cor, diasEmEstoque: m.diasEmEstoque, posts: m.posts, emProducao: m.emProducao, status: m.status }))
    : null

  // --- Últimos posts contra a mediana de 90 dias ---
  const comAlcance = feed.filter(m => m.alcance > 0)
  const med = mediana(comAlcance.map(m => m.alcance))
  const ultimosPosts = veAnalise
    ? comAlcance.slice(0, 3).map(m => {
      const legenda = (m.legenda ?? '').replace(/\s+/g, ' ').trim()
      return {
        id: m.id, titulo: legenda ? (legenda.length > 70 ? `${legenda.slice(0, 67)}…` : legenda) : 'Post sem legenda',
        formato: m.formato === 'REELS' ? 'REELS' : m.tipo === 'CAROUSEL_ALBUM' ? 'CARROSSEL' : 'FOTO',
        publicadoEm: m.publicadoEm, alcance: m.alcance, multiplo: med > 0 ? m.alcance / med : null,
      }
    })
    : null

  // --- Produção ---
  const abertas = pautas.filter(p => p.status !== 'PUBLICADO')
  const producao = veProducao
    ? {
      atrasadas: abertas.filter(p => p.prazo && p.prazo < inicioHoje && !['AGENDADO', 'APROVACAO'].includes(p.status)).length,
      aguardandoAprovacao: abertas.filter(p => p.status === 'APROVACAO' && p.aprovacao === 'PENDENTE').length,
      prontasParaAgendar: abertas.filter(p => ['EDICAO', 'APROVACAO'].includes(p.status) && p.aprovacao !== 'PENDENTE' && pendenciasParaPublicar(p, p.midias, agora).length === 0).length,
      falhas: abertas.filter(p => p.publicacaoStatus === 'FALHA').length,
    }
    : null

  // --- Insights e retenção (motor de análise do Desempenho, 30 dias, orgânico) ---
  let insights: Array<{ id: string; tipo: string; titulo: string; detalhe: string; confianca: string; amostra: number | null }> | null = null
  let tempoMedioReelsSeg: number | null = null
  let retencaoReels: number | null = null
  if (veAnalise && conta) {
    const fim = new Date(Date.UTC(+hoje.slice(0, 4), +hoje.slice(5, 7) - 1, +hoje.slice(8, 10)))
    const inicio = new Date(fim.getTime() - 29 * DIA_MS)
    const anteriorInicio = new Date(inicio.getTime() - 30 * DIA_MS)
    const [midias, snapshots] = await Promise.all([
      prisma.socialMediaMidia.findMany({ where: { contaId: conta.id, publicadoEm: { gte: inicioDoDia(somarDias(hoje, -89)), lt: fimHoje } } }),
      prisma.socialMediaSnapshotDiario.findMany({ where: { contaId: conta.id, data: { gte: anteriorInicio, lte: fim } }, orderBy: { data: 'asc' } }),
    ])
    const analise = montarAnaliseSocialMedia({
      conta, periodo: { inicio, fim }, midias, snapshots,
      metaPostagensSemanais: config.minDiasSemana, leadsOrganicos: [], origem: 'ORGANICO',
    })
    if (analise.conectado) {
      insights = analise.recomendacoes.filter(r => r.tipo !== 'info').slice(0, 3)
      tempoMedioReelsSeg = analise.reels.tempoMedioAssistidoSeg ?? null
      // Retenção em % (seção 12): média de tempo médio / duração dos reels com a duração lida do vídeo.
      const comRetencao = analise.publicacoes.filter(p => p.formato === 'REELS' && p.retencao != null)
      retencaoReels = comRetencao.length ? comRetencao.reduce((s, p) => s + p.retencao!, 0) / comRetencao.length : null
    }
  }

  const [fila, tempoResposta] = veAtendimento ? await Promise.all([filaAtendimento(usuarioId), tempoRespostaSemana(usuarioId, agora)]) : [null, null]

  // --- Cabeçalho (recepção simples; o motor completo da seção 14 vem na Fase 4) ---
  const local = new Date(agora.getTime() - OFFSET_MS)
  const rotulo = `${DIAS_SEMANA[local.getUTCDay()]}, ${String(local.getUTCDate()).padStart(2, '0')} de ${MESES[local.getUTCMonth()]}`
  const nome = pessoa.tratamento ?? pessoa.nome.split(' ')[0]
  const itens: string[] = []
  const planejadosHoje = publicarHoje.filter(p => p.status !== 'PUBLICADO').length
  if (planejadosHoje) itens.push(planejadosHoje === 1 ? '1 post' : `${planejadosHoje} posts`)
  const esperando = fila ? fila.dmsSemResposta + fila.comentariosSemResposta : 0
  if (esperando) itens.push(`${esperando} ${esperando === 1 ? 'cliente esperando' : 'clientes esperando'}`)
  const parada = estoqueSemConteudo?.find(m => m.status === 'PARADA')
  if (parada) itens.push(`uma ${parada.modelo} parada há ${parada.diasEmEstoque} dias`)
  const lista = itens.length > 1 ? `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}` : itens[0]
  const semPost = veProducao && planejadosHoje === 0 ? 'Nenhum post planejado para hoje.' : ''
  const resumo = !itens.length
    ? semPost || 'Tudo em dia por aqui.'
    : planejadosHoje ? `Hoje ${planejadosHoje === 1 ? 'tem' : 'temos'} ${lista}.` : `${semPost ? `${semPost} ` : ''}Temos ${lista}.`

  return {
    cabecalho: { rotulo, saudacao: `${saudacaoDoHorario(agora)}, ${nome}.`, resumo },
    retomada: diasSemPost != null && diasSemPost >= DIAS_SEM_POST_RETOMADA
      ? { diasSemPost, feitos: diasNaSemana, meta: config.minDiasSemana, maxPostsDia: config.maxPostsDia }
      : null,
    metas: {
      diasComPost: { valor: diasPublicados.size, meta: config.minDiasSemana, planejados: diasNaSemana },
      respostaDm: veAtendimento ? { valorMin: tempoResposta, meta: config.metaRespostaMin } : null,
      leads: leadsSemana == null ? null : { valor: leadsSemana, meta: config.metaLeadsSemana },
      retencao: veAnalise ? { percentual: retencaoReels, tempoMedioSeg: tempoMedioReelsSeg, meta: config.metaRetencao } : null,
    },
    publicarHoje: veProducao ? publicarHoje : null,
    estoqueSemConteudo,
    ultimosPosts: ultimosPosts && { mediana: Math.round(med), posts: ultimosPosts },
    atendimento: fila && { ...fila, maisAntiga: fila.maisAntiga && { ...fila.maisAntiga, atrasada: agora.getTime() - fila.maisAntiga.desde.getTime() > config.metaRespostaMin * 60_000 } },
    producao,
    insights,
    podeCriarPauta: sm.pode('producao', 'COMPLETO') && !sm.somenteLeitura,
  }
}
