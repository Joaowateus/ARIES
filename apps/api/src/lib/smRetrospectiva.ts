// Tela 11 · Retrospectiva da semana (seção 11.4, protótipo Retro.html).
// Gerada sozinha na sexta (job de hora em hora ou o primeiro acesso do dia),
// em 5 partes: título e conquistas, metas da semana, post da semana, o que
// você aprendeu e próxima semana. Os números saem do banco; a IA só redige o
// título em cima deles. Conquistas medem processo, nunca curtidas.
// É também a base do relatório de segunda às 8h para o gestor (regra
// "Relatório semanal" ligada em Acessos).
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { carregarPermissoes, type ContextoSM, type ModuloSM, type NivelSM } from './smAcesso'
import { carregarConfig, diaLocal } from './smCalendario'
import { listarEstoque } from './smEstoque'
import { atribuicaoDasPublicacoes, tituloDoPost } from './smDesempenho'
import { METRICA_INFO, chaveDoGancho, listarGanchos, salvarGancho, type MetricaTeste, type ResultadoTeste } from './smTestes'
import { notificar } from './smPautas'
import { iaLigada, tituloDaSemana } from './smIA'
import { emailConfigurado, enviarEmail, escaparHtml } from './email'

const DIA_MS = 864e5
const OFF = 3 * 3600e3
const ATUALIZAR_MS = 30 * 60_000
const PULO_OURO = 0.35
const somarDias = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10)
const inicioDoDia = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + OFF)
const diaSemana = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay() // 0 = domingo
const horaLocal = (d: Date) => new Date(d.getTime() - OFF).getUTCHours()
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const num = (v: number, c = 1) => v.toLocaleString('pt-BR', { maximumFractionDigits: c })
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
const curto = (t: string, n: number) => { const x = t.replace(/\s+/g, ' ').trim(); return x.length > n ? `${x.slice(0, n - 1)}…` : x }
const mediana = (v: number[]) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const media = (v: number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null)
const lista = (l: string[]) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}` : l[0] ?? '')
const DIA_NOME = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const CONFIANCA = { alta: 'Confiança alta', media: 'Confiança média', baixa: 'Confiança baixa', hipotese: 'Hipótese' } as const
const PESO_NIVEL: Record<NivelSM, number> = { SEM_ACESSO: 0, LEITURA: 1, COMPLETO: 2 }

/** Segunda-feira (Belém) da semana do dia. */
export const segundaDe = (d: string) => somarDias(d, -((diaSemana(d) + 6) % 7))

export type ChaveConquista = 'SEM_BURACOS' | 'GANCHO_OURO' | 'RESPOSTA_RELAMPAGO'
export interface Conquista { chave: ChaveConquista; titulo: string; detalhe: string; desbloqueada: boolean; modulo: ModuloSM | null }
export interface Barra { rotulo: string; medida: number; texto: string }
export interface DadosRetro {
  semana: string
  ate: string
  rotulo: string
  completa: boolean
  conquistas: Conquista[]
  metas: {
    diasComPost: { atual: number; meta: number; anterior: number; rajadas: number }
    leads: { atual: number; meta: number; anterior: number }
    resposta: { atualMin: number | null; meta: number; anteriorMin: number | null }
    retencao: { pct: number | null; meta: number; anteriorPct: number | null; reels: number }
  }
  post: {
    midiaId: string; titulo: string; formato: string; dia: string; hora: number; multiplo: number; alcance: number
    pulo: number | null; puloMenorDoMes: boolean; leads: number; gancho: string | null; ganchoSalvo: boolean; porque: string; permalink: string | null
  } | null
  aprendizado: { tipo: 'TESTE' | 'FORMATO' | 'HORARIO'; titulo: string; barras: Barra[]; nota: string; menorMelhor: boolean } | null
  focos: Array<{ texto: string; modulo: ModuloSM | null }>
  tituloBase: string
}

type Pode = (m: ModuloSM) => boolean

// ---------- Cálculo (com tudo; o filtro do papel vem na leitura) ----------

const ehFeed = { NOT: { formato: { in: ['STORY', 'AD'] } } }
const formatoDe = (m: { formato: string | null; tipo: string }) => (m.formato === 'REELS' ? 'Reels' : m.tipo === 'CAROUSEL_ALBUM' ? 'Carrossel' : 'Foto')
const FORMATO_PLURAL: Record<string, string> = { Reels: 'Reels', Carrossel: 'Carrosséis', Foto: 'Fotos' }

async function tempoResposta(usuarioId: string, de: Date, ate: Date) {
  const r = await prisma.smMensagem.findMany({ where: { respostaMin: { not: null }, enviadaEm: { gte: de, lt: ate }, conversa: { usuarioId } }, select: { respostaMin: true } })
  const v = mediana(r.map(x => x.respostaMin!))
  return v == null ? null : Math.round(v)
}

function confiancaDaAmostra(menor: number): 'alta' | 'media' | 'hipotese' | null {
  if (menor >= 10) return 'alta'
  if (menor >= 5) return 'media'
  if (menor >= 3) return 'hipotese'
  return null
}

export async function calcularRetrospectiva(usuarioId: string, semana: string, agora = new Date()): Promise<DadosRetro> {
  const hoje = diaLocal(agora)
  const domingo = somarDias(semana, 6)
  const completa = hoje > domingo
  const ate = completa ? domingo : hoje
  const de = inicioDoDia(semana)
  const fim = completa ? inicioDoDia(somarDias(semana, 7)) : agora
  const deAnt = inicioDoDia(somarDias(semana, -7))
  const config = await carregarConfig(usuarioId)
  const conta = await prisma.socialMediaConta.findUnique({ where: { titular: `dono:${usuarioId}` }, select: { id: true } })

  const midias = conta ? await prisma.socialMediaMidia.findMany({
    where: { contaId: conta.id, publicadoEm: { gte: new Date(fim.getTime() - 90 * DIA_MS), lt: fim }, ...ehFeed },
    select: { instagramMediaId: true, legenda: true, formato: true, tipo: true, publicadoEm: true, alcance: true, taxaPulo: true, tempoMedioAssistidoSeg: true, duracaoSeg: true, urlPermalink: true },
  }) : []
  const daSemana = midias.filter(m => m.publicadoEm >= de && m.publicadoEm < fim)
  const daAnterior = midias.filter(m => m.publicadoEm >= deAnt && m.publicadoEm < de)

  // Metas
  const porDia = new Map<string, number>()
  for (const m of daSemana) porDia.set(diaLocal(m.publicadoEm), (porDia.get(diaLocal(m.publicadoEm)) ?? 0) + 1)
  const dias = porDia.size
  const rajadas = [...porDia.values()].filter(n => n > config.maxPostsDia).length
  const diasAnt = new Set(daAnterior.map(m => diaLocal(m.publicadoEm))).size
  const [leads, leadsAnt, resp, respAnt] = await Promise.all([
    prisma.lead.count({ where: { usuarioId, tipoLead: 'ORGANICO', criadoEm: { gte: de, lt: fim } } }),
    prisma.lead.count({ where: { usuarioId, tipoLead: 'ORGANICO', criadoEm: { gte: deAnt, lt: de } } }),
    tempoResposta(usuarioId, de, fim),
    tempoResposta(usuarioId, deAnt, de),
  ])
  const retencaoDe = (l: typeof midias) => {
    const v = l.filter(m => m.formato === 'REELS' && m.duracaoSeg && m.tempoMedioAssistidoSeg != null).map(m => Math.min(1, m.tempoMedioAssistidoSeg! / m.duracaoSeg!))
    return { pct: v.length ? Math.round(media(v)! * 100) : null, reels: v.length }
  }
  const ret = retencaoDe(daSemana)
  const retAnt = retencaoDe(daAnterior)

  // Conquistas (processo, nunca curtida)
  const reelsComPulo = daSemana.filter(m => m.formato === 'REELS' && m.taxaPulo != null).sort((a, b) => a.taxaPulo! - b.taxaPulo!)
  const menorPulo = reelsComPulo[0]
  const limiteResposta = Math.round(config.metaRespostaMin * 0.8 * 10) / 10
  const conquistas: Conquista[] = [
    {
      chave: 'SEM_BURACOS', titulo: 'Semana sem buracos', modulo: null,
      desbloqueada: dias >= config.minDiasSemana && rajadas === 0,
      detalhe: rajadas > 0 ? `${plural(rajadas, 'dia', 'dias')} com mais de ${config.maxPostsDia} posts (rajada)`
        : dias > config.minDiasSemana ? `${dias} dias com post (meta ${config.minDiasSemana}), nenhuma rajada`
          : `${dias} de ${config.minDiasSemana} dias com post${dias >= config.minDiasSemana ? ', nenhuma rajada' : ''}`,
    },
    {
      chave: 'GANCHO_OURO', titulo: 'Gancho de ouro', modulo: 'analise',
      desbloqueada: !!menorPulo && menorPulo.taxaPulo! < PULO_OURO,
      detalhe: !menorPulo ? 'Nenhum reel com o pulo nos 3s medido na semana'
        : menorPulo.taxaPulo! < PULO_OURO ? `“${curto(tituloDoPost(menorPulo), 40)}” com ${Math.round(menorPulo.taxaPulo! * 100)}% de pulo nos 3s`
          : `Menor pulo da semana: ${Math.round(menorPulo.taxaPulo! * 100)}% (precisa ficar abaixo de 35%)`,
    },
    {
      chave: 'RESPOSTA_RELAMPAGO', titulo: 'Resposta relâmpago', modulo: 'atendimento',
      desbloqueada: resp != null && resp <= limiteResposta,
      detalhe: resp == null ? 'Nenhuma conversa respondida na semana'
        : resp <= limiteResposta ? `${resp} min de resposta no direct durante a semana`
          : `${resp} min na semana (precisa de até ${num(limiteResposta)} min)`,
    },
  ]

  // Post da semana: maior múltiplo da mediana de alcance (90 dias).
  const med = mediana(midias.filter(m => m.alcance > 0).map(m => m.alcance))
  const candidatos = daSemana.filter(m => m.alcance > 0 && med).map(m => ({ m, x: m.alcance / med! })).sort((a, b) => b.x - a.x)
  let post: DadosRetro['post'] = null
  if (candidatos.length) {
    const { m, x } = candidatos[0]
    const doMes = midias.filter(r => r.formato === 'REELS' && r.taxaPulo != null && r.publicadoEm >= new Date(fim.getTime() - 30 * DIA_MS))
    const puloMed = mediana(doMes.map(r => r.taxaPulo!))
    const gancho = m.legenda?.split('\n')[0]?.trim() || null
    const [atrib, salvo] = await Promise.all([
      atribuicaoDasPublicacoes(usuarioId, [m.instagramMediaId], true, false),
      gancho ? prisma.smGancho.findFirst({ where: { usuarioId, chave: chaveDoGancho(gancho) }, select: { id: true } }) : null,
    ])
    const dia = diaLocal(m.publicadoEm)
    const hora = horaLocal(m.publicadoEm)
    const partes: string[] = []
    if (x < 1) partes.push('Foi o que mais alcançou na semana, mas ficou abaixo da mediana.')
    if (gancho) {
      const segurou = m.taxaPulo != null && puloMed != null && m.taxaPulo < puloMed
      partes.push(`${x < 1 ? 'Abriu' : 'Por que funcionou: abriu'} com “${curto(gancho, 80)}”${segurou ? ` e segurou nos 3 primeiros segundos (${Math.round(m.taxaPulo! * 100)}% de pulo contra ${Math.round(puloMed! * 100)}% da mediana do mês)` : ''}.`)
    }
    partes.push(`Saiu ${DIA_NOME[diaSemana(dia)]} às ${hora}h, em ${formatoDe(m).toLowerCase()}.`)
    post = {
      midiaId: m.instagramMediaId, titulo: tituloDoPost(m), formato: formatoDe(m), dia, hora, multiplo: Math.round(x * 10) / 10, alcance: m.alcance,
      pulo: m.taxaPulo != null ? Math.round(m.taxaPulo * 100) : null,
      puloMenorDoMes: m.taxaPulo != null && doMes.length >= 2 && doMes.every(r => r.taxaPulo! >= m.taxaPulo!),
      leads: atrib.get(m.instagramMediaId)?.leads ?? 0, gancho, ganchoSalvo: !!salvo, porque: partes.join(' '), permalink: m.urlPermalink,
    }
  }

  const aprendizado = await aprendizadoDaSemana(usuarioId, de, fim, midias)
  const focos = await focosDaProxima(usuarioId, config, { dias, rajadas, leads, resp, ret: ret.pct }, fim, agora)
  const rotulo = semana.slice(5, 7) === ate.slice(5, 7) ? `semana de ${semana.slice(8, 10)} a ${ddmm(ate)}` : `semana de ${ddmm(semana)} a ${ddmm(ate)}`
  const dados: DadosRetro = {
    semana, ate, rotulo, completa, conquistas,
    metas: {
      diasComPost: { atual: dias, meta: config.minDiasSemana, anterior: diasAnt, rajadas },
      leads: { atual: leads, meta: config.metaLeadsSemana, anterior: leadsAnt },
      resposta: { atualMin: resp, meta: config.metaRespostaMin, anteriorMin: respAnt },
      retencao: { pct: ret.pct, meta: config.metaRetencao, anteriorPct: retAnt.pct, reels: ret.reels },
    },
    post, aprendizado, focos, tituloBase: '',
  }
  return dados
}

async function aprendizadoDaSemana(usuarioId: string, de: Date, fim: Date, midias: Array<{ formato: string | null; tipo: string; publicadoEm: Date; alcance: number }>): Promise<DadosRetro['aprendizado']> {
  // 1) O teste A/B concluído na semana.
  const t = await prisma.smTeste.findFirst({ where: { usuarioId, status: 'CONCLUIDO', concluidoEm: { gte: de, lt: fim } }, orderBy: { concluidoEm: 'desc' } })
  const r = t?.resultado as ResultadoTeste | null | undefined
  if (t && r && r.mediaA != null && r.mediaB != null) {
    const info = METRICA_INFO[t.metrica as MetricaTeste] ?? METRICA_INFO.ALCANCE
    const fmt = (v: number) => info.unidade === 'contas' ? `${num(v, 0)} contas em média` : info.unidade === '%' ? `${num(v, 0)}%` : `${num(v, 1)} ${info.unidade}`
    const [v, o] = r.vencedor === 'B' ? [t.grupoB, t.grupoA] : [t.grupoA, t.grupoB]
    const pctDif = r.diferenca != null ? Math.round(r.diferenca * 100) : 0
    const titulo = r.vencedor === 'EMPATE' ? `${t.grupoA} e ${t.grupoB} empataram em ${info.rotulo.toLowerCase()}.`
      : info.menorMelhor ? `${v} teve ${pctDif}% menos pulo nos 3s que ${o}.`
        : t.metrica === 'ALCANCE' ? `${v} alcançou ${pctDif}% mais que ${o}.` : `${v} foi ${pctDif}% melhor em ${info.rotulo.toLowerCase()} que ${o}.`
    const proximoMes = MESES[(new Date(fim.getTime() - OFF).getUTCMonth() + 1) % 12]
    const sugestao = r.vencedor === 'EMPATE' ? ' Sem vencedor: fique com o que dá menos trabalho.'
      : r.confianca === 'alta' || r.confianca === 'media' ? ` Sugestão: virar padrão e repetir o teste em ${proximoMes}.`
        : ' Ainda não dá para cravar: repita com mais posts antes de mudar o padrão.'
    return {
      tipo: 'TESTE', titulo, menorMelhor: info.menorMelhor,
      barras: [{ rotulo: `${t.grupoA} · ${plural(r.nA, 'post', 'posts')}`, medida: r.mediaA, texto: fmt(r.mediaA) }, { rotulo: `${t.grupoB} · ${plural(r.nB, 'post', 'posts')}`, medida: r.mediaB, texto: fmt(r.mediaB) }],
      nota: `${CONFIANCA[r.confianca]} (${plural(r.nA + r.nB, 'post', 'posts')}).${sugestao}`,
    }
  }
  // 2) Sem teste: o maior aprendizado de formato ou horário dos últimos 30 dias (regras de amostra da seção 13.2).
  const recentes = midias.filter(m => m.alcance > 0 && m.publicadoEm >= new Date(fim.getTime() - 30 * DIA_MS))
  const comparar = (grupos: Map<string, number[]>) => {
    const g = [...grupos.entries()].filter(([, v]) => v.length >= 3).map(([k, v]) => ({ k, n: v.length, m: media(v)! })).sort((a, b) => b.m - a.m)
    if (g.length < 2) return null
    const melhor = g[0], pior = g[g.length - 1]
    const fator = melhor.m / pior.m
    const conf = confiancaDaAmostra(Math.min(melhor.n, pior.n))
    return fator >= 1.2 && conf ? { melhor, pior, fator, conf } : null
  }
  const porFormato = new Map<string, number[]>()
  const porFaixa = new Map<string, number[]>()
  for (const m of recentes) {
    const f = formatoDe(m)
    porFormato.set(f, [...(porFormato.get(f) ?? []), m.alcance])
    const b = Math.floor(horaLocal(m.publicadoEm) / 3) * 3
    porFaixa.set(String(b), [...(porFaixa.get(String(b)) ?? []), m.alcance])
  }
  const cf = comparar(porFormato)
  const ch = comparar(porFaixa)
  const escolha = cf && (!ch || cf.fator >= ch.fator) ? { tipo: 'FORMATO' as const, c: cf } : ch ? { tipo: 'HORARIO' as const, c: ch } : null
  if (!escolha) return null
  const { melhor, pior, fator, conf } = escolha.c
  const faixa = (k: string) => `${k}h–${Number(k) + 3}h`
  const nome = (k: string) => (escolha.tipo === 'FORMATO' ? k : faixa(k))
  const mais = Math.round((fator - 1) * 100)
  const titulo = escolha.tipo === 'FORMATO'
    ? `${FORMATO_PLURAL[melhor.k] ?? melhor.k} alcançaram ${mais}% mais que ${(FORMATO_PLURAL[pior.k] ?? pior.k).toLowerCase()}.`
    : `Postar entre ${melhor.k}h e ${Number(melhor.k) + 3}h alcançou ${mais}% mais que entre ${pior.k}h e ${Number(pior.k) + 3}h.`
  return {
    tipo: escolha.tipo, titulo, menorMelhor: false,
    barras: [melhor, pior].map(x => ({ rotulo: `${nome(x.k)} · ${plural(x.n, 'post', 'posts')}`, medida: Math.round(x.m), texto: `${num(x.m, 0)} contas em média` })),
    nota: `${CONFIANCA[conf]} (${plural(Math.min(melhor.n, pior.n), 'post', 'posts')} no menor grupo, últimos 30 dias).${conf === 'hipotese' ? ' Vale confirmar com um teste A/B antes de mudar o calendário.' : ' Dê mais peso a isso no calendário da próxima semana.'}`,
  }
}

const PILAR_FOCO: Record<string, [string, string, string]> = {
  PROVA: ['entrega de cliente', 'entregas de clientes', 'prova social'],
  ESTOQUE: ['post de estoque', 'posts de estoque', 'estoque'],
  EDUCACAO: ['post de educação', 'posts de educação', 'educação'],
  BASTIDORES: ['bastidor', 'bastidores', 'bastidores'],
}

async function focosDaProxima(usuarioId: string, config: Awaited<ReturnType<typeof carregarConfig>>, s: { dias: number; rajadas: number; leads: number; resp: number | null; ret: number | null }, fim: Date, agora: Date) {
  const focos: DadosRetro['focos'] = []
  if (s.dias < config.minDiasSemana) focos.push({ texto: `Postar em ${config.minDiasSemana} dias (esta semana foram ${s.dias}).`, modulo: null })
  if (s.resp != null && s.resp > config.metaRespostaMin) focos.push({ texto: `Responder o direct em até ${config.metaRespostaMin} min (a semana fechou em ${s.resp} min).`, modulo: 'atendimento' })
  if (s.ret != null && s.ret < config.metaRetencao) {
    const alvo = Math.min(config.metaRetencao, Math.round((s.ret + 5) / 5) * 5)
    const { ganchos } = await listarGanchos(usuarioId)
    const g = ganchos.find(x => x.puloMedio != null)
    focos.push({ texto: `Levar a retenção dos reels para ${alvo}%${g ? ` usando o gancho “${curto(g.texto, 50)}”` : ''}.`, modulo: 'analise' })
  }
  // Mix de pilares dos últimos 30 dias (pautas publicadas).
  const publicadas = await prisma.smPauta.findMany({ where: { usuarioId, status: 'PUBLICADO', publicadaEm: { gte: new Date(fim.getTime() - 30 * DIA_MS), lt: fim } }, select: { pilar: true } })
  if (publicadas.length >= 4) {
    const abaixo = Object.entries(config.mixMeta)
      .map(([p, meta]) => ({ p, falta: meta - (publicadas.filter(x => x.pilar === p).length / publicadas.length) * 100 }))
      .filter(x => x.falta >= 5 && PILAR_FOCO[x.p]).sort((a, b) => b.falta - a.falta)[0]
    if (abaixo) {
      const n = Math.max(1, Math.round((config.mixMeta[abaixo.p] / 100) * config.minDiasSemana))
      const [um, varios, nome] = PILAR_FOCO[abaixo.p]
      focos.push({ texto: `Publicar ${n} ${n === 1 ? um : varios} (${nome} está abaixo do mix).`, modulo: 'producao' })
    }
  }
  // Motos que já estavam na loja no fim do período (semana antiga não mostra moto que chegou depois).
  const semConteudo = (await listarEstoque(usuarioId, fim < agora ? fim : agora))
    .filter(m => m.entradaEm <= fim && (m.saidaEm ? m.saidaEm > fim : m.situacao === 'DISPONIVEL') && m.emProducao === 0 && (m.posts === 0 || m.diasEmEstoque >= 20))
    .sort((a, b) => b.diasEmEstoque - a.diasEmEstoque).slice(0, 2)
  if (semConteudo.length) focos.push({ texto: `Tirar ${lista(semConteudo.map(m => `a ${m.modelo}`))} da lista de “estoque sem conteúdo”.`, modulo: 'estoque' })
  if (s.leads < config.metaLeadsSemana) focos.push({ texto: `Chegar a ${config.metaLeadsSemana} leads: chamada para o direct em todo post.`, modulo: 'crm' })
  if (s.rajadas > 0) focos.push({ texto: `Espalhar os posts: no máximo ${config.maxPostsDia} por dia.`, modulo: null })
  const teste = await prisma.smTeste.findFirst({ where: { usuarioId, status: 'ATIVO' }, orderBy: { criadoEm: 'asc' }, select: { hipotese: true } })
  if (teste) focos.push({ texto: `Fechar o teste “${curto(teste.hipotese, 60)}”.`, modulo: 'analise' })
  // Semana sem lacuna: manter o que deu certo.
  focos.push({ texto: `Manter os ${config.minDiasSemana} dias com post e a chamada para o direct.`, modulo: null })
  focos.push({ texto: 'Repetir o formato e o horário do post da semana.', modulo: 'analise' })
  focos.push({ texto: `Responder o direct dentro da meta de ${config.metaRespostaMin} min.`, modulo: 'atendimento' })
  return focos
}

// ---------- O que cada papel vê ----------

export function filtrar(d: DadosRetro, pode: Pode) {
  const verCrm = pode('crm')
  return {
    rotulo: d.rotulo, semana: d.semana, ate: d.ate, completa: d.completa,
    conquistas: d.conquistas.filter(c => !c.modulo || pode(c.modulo)),
    metas: {
      diasComPost: d.metas.diasComPost,
      leads: verCrm ? d.metas.leads : null,
      resposta: pode('atendimento') ? d.metas.resposta : null,
      retencao: pode('analise') ? d.metas.retencao : null,
    },
    post: pode('analise') && d.post ? { ...d.post, leads: verCrm ? d.post.leads : null } : null,
    aprendizado: pode('analise') ? d.aprendizado : null,
    focos: d.focos.filter(f => !f.modulo || pode(f.modulo)).map(f => f.texto).filter((t, i, l) => l.indexOf(t) === i).slice(0, 3),
  }
}
export type RetroDoPapel = ReturnType<typeof filtrar>

function podeDoPapel(niveis: Record<ModuloSM, NivelSM>): Pode {
  return m => PESO_NIVEL[niveis[m]] >= PESO_NIVEL.LEITURA
}

/** Título por template: só com o que o Social Media vê (o mesmo título para os dois). */
function tituloPorTemplate(r: RetroDoPapel): string {
  const m = r.metas
  const dias = m.diasComPost.atual >= m.diasComPost.meta
  const leads = m.leads ? m.leads.atual >= m.leads.meta : null
  const resposta = m.resposta && m.resposta.atualMin != null ? m.resposta.atualMin <= m.resposta.meta : null
  const todas = [dias, leads, resposta].every(x => x !== false)
  const desbloqueadas = r.conquistas.filter(c => c.desbloqueada).length
  if (todas && desbloqueadas >= 2) return 'A semana em que tudo encaixou.'
  if (todas) return 'Semana redonda: as metas foram batidas.'
  if (dias && m.diasComPost.anterior < m.diasComPost.meta) return 'A semana em que a conta voltou a respirar.'
  if (dias && leads === false) return 'Constância garantida. Agora é converter.'
  if (!dias && leads) return 'Poucos posts, muitos leads: imagine com a cadência em dia.'
  if (!dias) return 'Semana de ajuste. A próxima começa com três focos.'
  return 'Semana de trabalho feito. Os detalhes contam o resto.'
}

// ---------- Geração e leitura ----------

async function papelDaConta(usuarioId: string) {
  const p = await carregarPermissoes(usuarioId)
  return podeDoPapel(p.niveis)
}

/** A retrospectiva da semana, gerada ou atualizada (a da semana corrente se refaz a cada 30 min; a de semana fechada fica congelada). */
export async function garantirRetrospectiva(usuarioId: string, semana: string, agora = new Date(), opcoes: { forcar?: boolean } = {}) {
  const existente = await prisma.smRetrospectiva.findUnique({ where: { usuarioId_semana: { usuarioId, semana } } })
  if (existente) {
    const dados = existente.dados as unknown as DadosRetro
    if (dados.completa || (!opcoes.forcar && Math.abs(agora.getTime() - existente.atualizadaEm.getTime()) < ATUALIZAR_MS)) return existente
  }
  const dados = await calcularRetrospectiva(usuarioId, semana, agora)
  const visivel = filtrar(dados, await papelDaConta(usuarioId))
  dados.tituloBase = tituloPorTemplate(visivel)
  const anterior = existente ? (existente.dados as unknown as DadosRetro) : null
  let titulo = existente && anterior?.tituloBase === dados.tituloBase ? existente.titulo : dados.tituloBase
  let tituloIA = existente && anterior?.tituloBase === dados.tituloBase ? existente.tituloIA : false
  if (!tituloIA && iaLigada()) {
    const fatos = {
      semana: visivel.rotulo,
      conquistas: visivel.conquistas.map(c => ({ conquista: c.titulo, desbloqueada: c.desbloqueada, detalhe: c.detalhe })),
      metas: {
        diasComPost: `${visivel.metas.diasComPost.atual} de ${visivel.metas.diasComPost.meta}`,
        ...(visivel.metas.leads ? { leadsOrganicos: `${visivel.metas.leads.atual} (meta ${visivel.metas.leads.meta})` } : {}),
        ...(visivel.metas.resposta?.atualMin != null ? { respostaNoDirect: `${visivel.metas.resposta.atualMin} min (meta ${visivel.metas.resposta.meta})` } : {}),
      },
      ...(visivel.post ? { postDaSemana: { titulo: visivel.post.titulo, vezesAMediana: visivel.post.multiplo } } : {}),
    }
    const ia = await tituloDaSemana(usuarioId, dados.tituloBase, fatos)
    if (ia) { titulo = ia; tituloIA = true }
  }
  const json = dados as unknown as Prisma.InputJsonValue
  return prisma.smRetrospectiva.upsert({
    where: { usuarioId_semana: { usuarioId, semana } },
    create: { usuarioId, semana, ate: dados.ate, dados: json, titulo, tituloIA },
    update: { ate: dados.ate, dados: json, titulo, tituloIA },
  })
}

/** Sexta-feira com a retrospectiva da semana pronta (momento SEXTA da recepção). */
export async function retrospectivaPronta(sm: ContextoSM, agora = new Date()): Promise<boolean> {
  const hoje = diaLocal(agora)
  if (diaSemana(hoje) !== 5) return false
  try { await garantirRetrospectiva(sm.usuarioId, segundaDe(hoje), agora); return true } catch { return false }
}

export class ErroRetro extends Error {
  constructor(public status: number, msg: string) { super(msg) }
}

/** Semana disponível agora: a corrente de sexta a domingo; antes disso, a anterior. */
export function semanaPadrao(agora = new Date()): string {
  const hoje = diaLocal(agora)
  const seg = segundaDe(hoje)
  return [5, 6, 0].includes(diaSemana(hoje)) ? seg : somarDias(seg, -7)
}

export async function montarRetrospectiva(sm: ContextoSM, semanaPedida: string | null, agora = new Date()) {
  const ultima = semanaPadrao(agora)
  const semana = semanaPedida ?? ultima
  if (!/^\d{4}-\d{2}-\d{2}$/.test(semana) || segundaDe(semana) !== semana) throw new ErroRetro(400, 'Semana inválida')
  if (semana > ultima) throw new ErroRetro(404, 'A retrospectiva desta semana sai na sexta-feira.')
  if (semana < somarDias(ultima, -7 * 52)) throw new ErroRetro(404, 'Semana fora do histórico (até um ano)')
  const r = await garantirRetrospectiva(sm.usuarioId, semana, agora)
  const pode: Pode = m => sm.pode(m, 'LEITURA')
  const v = filtrar(r.dados as unknown as DadosRetro, pode)
  const editaProducao = !sm.somenteLeitura && sm.pode('producao', 'COMPLETO')
  return {
    ...v,
    titulo: r.titulo,
    tituloIA: r.tituloIA,
    enviadaGestorEm: r.enviadaGestorEm?.toISOString() ?? null,
    podeEnviar: sm.visao === 'SOCIAL_MEDIA' && !sm.somenteLeitura,
    podeSalvarGancho: editaProducao && !!v.post?.gancho && !v.post.ganchoSalvo,
    anterior: somarDias(semana, -7),
    proxima: semana < ultima ? somarDias(semana, 7) : null,
  }
}

/** Resumo em texto (aviso ao gestor e e-mail de segunda). */
function resumo(v: RetroDoPapel): string {
  const m = v.metas
  const partes = [m.diasComPost.atual > m.diasComPost.meta ? `${m.diasComPost.atual} dias com post (meta ${m.diasComPost.meta})` : `${m.diasComPost.atual} de ${m.diasComPost.meta} dias com post`]
  if (m.leads) partes.push(`${plural(m.leads.atual, 'lead orgânico', 'leads orgânicos')} (meta ${m.leads.meta})`)
  if (m.resposta?.atualMin != null) partes.push(`resposta em ${m.resposta.atualMin} min (meta ${m.resposta.meta})`)
  if (m.retencao?.pct != null) partes.push(`retenção dos reels em ${m.retencao.pct}%`)
  const conq = v.conquistas.filter(c => c.desbloqueada).map(c => c.titulo)
  return `${partes.join(' · ')}.${conq.length ? ` Conquistas: ${lista(conq)}.` : ''}${v.focos.length ? ` Próxima semana: ${v.focos.map((f, i) => `${i + 1}) ${f.replace(/\.$/, '')}`).join('; ')}.` : ''}`
}

/** "Enviar ao gestor": aviso no painel do gestor com o resumo e o link. */
export async function enviarAoGestor(sm: ContextoSM, semana: string, nome: string, agora = new Date()) {
  if (sm.visao !== 'SOCIAL_MEDIA' || sm.somenteLeitura) throw new ErroRetro(403, 'Só quem cuida do Instagram envia a retrospectiva ao gestor')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(semana) || semana > semanaPadrao(agora)) throw new ErroRetro(400, 'Semana inválida')
  const r = await garantirRetrospectiva(sm.usuarioId, semana, agora)
  const v = filtrar(r.dados as unknown as DadosRetro, m => sm.pode(m, 'LEITURA'))
  await notificar(sm.usuarioId, 'GESTOR', 'RETROSPECTIVA', `retro:${semana}`, `${nome} enviou a retrospectiva da ${v.rotulo}: ${r.titulo}`, resumo(v), { href: `/pro-labore/sm/retrospectiva?semana=${semana}` })
  const salvo = await prisma.smRetrospectiva.update({ where: { id: r.id }, data: { enviadaGestorEm: agora } })
  return { enviadaGestorEm: salvo.enviadaGestorEm!.toISOString() }
}

/** Salva o gancho do post da semana na biblioteca. */
export async function salvarGanchoDaSemana(sm: ContextoSM, semana: string, agora = new Date()) {
  if (sm.somenteLeitura || !sm.pode('producao', 'COMPLETO')) throw new ErroRetro(403, 'Seu acesso à Produção é só leitura')
  const r = await garantirRetrospectiva(sm.usuarioId, semana, agora)
  const post = (r.dados as unknown as DadosRetro).post
  if (!post?.gancho) throw new ErroRetro(404, 'O post da semana não tem gancho na legenda')
  await salvarGancho(sm.usuarioId, post.gancho, [post.midiaId], sm.visao === 'GESTOR' ? 'GESTOR' : 'SOCIAL_MEDIA')
  const dados = { ...(r.dados as unknown as DadosRetro), post: { ...post, ganchoSalvo: true } }
  await prisma.smRetrospectiva.update({ where: { id: r.id }, data: { dados: dados as unknown as Prisma.InputJsonValue } })
  return { ok: true }
}

/**
 * Job de hora em hora: na sexta (a partir das 6h) gera a retrospectiva da
 * semana; na segunda a partir das 8h fecha a semana anterior e manda o
 * relatório ao gestor (aviso no painel e e-mail, quando configurado), uma
 * vez por semana e só com a regra ligada.
 */
export async function rodarRetrospectivas(agora = new Date(), base = process.env.FRONTEND_URL ?? 'http://localhost:3000') {
  const hoje = diaLocal(agora)
  const w = diaSemana(hoje)
  const hora = horaLocal(agora)
  const operacoes = await prisma.smMembro.findMany({ where: { ativo: true }, select: { usuarioId: true } })
  let retrospectivas = 0, relatorios = 0
  for (const { usuarioId } of operacoes) {
    if (w === 5 && hora >= 6) {
      const semana = segundaDe(hoje)
      if (!(await prisma.smRetrospectiva.findUnique({ where: { usuarioId_semana: { usuarioId, semana } }, select: { id: true } }))) {
        await garantirRetrospectiva(usuarioId, semana, agora)
        retrospectivas++
      }
    }
    if (w === 1 && hora >= 8) {
      const perm = await carregarPermissoes(usuarioId)
      if (!perm.regras.relatorioSemanal) continue
      const semana = somarDias(segundaDe(hoje), -7)
      // Fecha a semana (até domingo) antes de mandar.
      const r = await garantirRetrospectiva(usuarioId, semana, agora, { forcar: true })
      if (r.relatorioEm) continue
      const v = filtrar(r.dados as unknown as DadosRetro, () => true)
      const href = `/pro-labore/sm/retrospectiva?semana=${semana}`
      const texto = resumo(v)
      await notificar(usuarioId, 'GESTOR', 'RELATORIO_SEMANAL', `relatorio:${semana}`, `Relatório da ${v.rotulo}: ${r.titulo}`, texto, { href })
      const dono = await prisma.proLaboreUsuario.findUnique({ where: { id: usuarioId }, select: { email: true, nome: true } })
      if (dono?.email && emailConfigurado()) {
        const link = `${base.replace(/\/$/, '')}${href}`
        await enviarEmail({
          para: dono.email,
          assunto: `Relatório do Instagram · ${v.rotulo}`,
          texto: `${r.titulo}\n\n${texto}\n\nAbrir a retrospectiva: ${link}\n`,
          html: `<h2>${escaparHtml(r.titulo)}</h2><p>${escaparHtml(texto)}</p><p><a href="${escaparHtml(link)}">Abrir a retrospectiva</a></p>`,
        })
      }
      await prisma.smRetrospectiva.update({ where: { id: r.id }, data: { relatorioEm: agora } })
      relatorios++
    }
  }
  return { retrospectivas, relatorios }
}
