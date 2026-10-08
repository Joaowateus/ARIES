// Tela 08 · Primeiro acesso (seção 11.1): boas-vindas, o ponto de partida com
// os números reais da conta, as metas da semana (pré-selecionadas pela
// sugestão dos últimos 90 dias) e o ritmo (rituais e canais de aviso).
// Tudo vai para as preferências da pessoa e para as metas da operação
// (smConfig, a meta_semanal da seção 3.4), que o gestor vê e ajusta.
import { prisma } from './prisma'
import type { ContextoSM } from './smAcesso'
import { carregarConfig, diaLocal } from './smCalendario'
import { notificar } from './smPautas'

const DIA_MS = 864e5
export const OPCOES_DIAS = [3, 4, 5] as const
export const OPCOES_RESPOSTA = [15, 30, 60] as const
export const AVISOS_PADRAO = { whatsapp: true, celular: true, email: false }
export type Avisos = typeof AVISOS_PADRAO

const mediana = (v: number[]) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const maisPerto = (opcoes: readonly number[], v: number) => [...opcoes].sort((a, b) => Math.abs(a - v) - Math.abs(b - v) || a - b)[0]

/** Opções de leads por semana: 20, 30 ou 40 (protótipo); para uma conta que ainda gera poucos, opções do tamanho dela. */
export function opcoesLeads(media: number | null): number[] {
  if (media == null || media >= 15) return [20, 30, 40]
  const base = Math.max(1, Math.ceil(media))
  return [...new Set([base, Math.ceil(base * 1.5), base * 2])]
}

export async function preferenciaDe(usuarioId: string, ator: string) {
  const p = await prisma.smPreferencia.findUnique({ where: { usuarioId_ator: { usuarioId, ator } } })
  return {
    genero: (p?.genero ?? null) as 'F' | 'M' | null,
    focoHora: p?.focoHora ?? 9,
    avisos: { ...AVISOS_PADRAO, ...((p?.avisos as Partial<Avisos> | null) ?? {}) },
    onboardingConcluidoEm: p?.onboardingConcluidoEm ?? null,
    tema: (p?.tema ?? null) as 'CLARO' | 'ESCURO' | null,
  }
}

export async function dadosBoasVindas(sm: ContextoSM, agora = new Date()) {
  const u = sm.usuarioId
  const desde30 = new Date(agora.getTime() - 30 * DIA_MS)
  const desde90 = new Date(agora.getTime() - 90 * DIA_MS)
  const [membro, conta, config] = await Promise.all([
    prisma.smMembro.findUnique({ where: { usuarioId: u }, select: { id: true, nome: true, tratamento: true } }),
    prisma.socialMediaConta.findUnique({ where: { titular: `dono:${u}` }, select: { id: true, seguidores: true, nomeExibicao: true } }),
    carregarConfig(u),
  ])
  const ator = membro?.id ?? 'GESTOR'
  const veCrm = sm.pode('crm', 'LEITURA')
  const veVendas = veCrm && sm.pode('vendas', 'LEITURA')
  const [pref, feed, leads30, leads90, vendas30, respostas] = await Promise.all([
    preferenciaDe(u, ator),
    conta ? prisma.socialMediaMidia.findMany({ where: { contaId: conta.id, publicadoEm: { gte: desde90 }, NOT: { formato: { in: ['STORY', 'AD'] } } }, select: { publicadoEm: true }, orderBy: { publicadoEm: 'desc' } }) : Promise.resolve([]),
    veCrm ? prisma.lead.count({ where: { usuarioId: u, tipoLead: 'ORGANICO', criadoEm: { gte: desde30 } } }) : Promise.resolve(null),
    veCrm ? prisma.lead.count({ where: { usuarioId: u, tipoLead: 'ORGANICO', criadoEm: { gte: desde90 } } }) : Promise.resolve(null),
    veVendas ? prisma.venda.count({ where: { usuarioId: u, data: { gte: desde30 }, OR: [{ origem: 'INSTAGRAM_ORGANICO' }, { lead: { OR: [{ tipoLead: 'ORGANICO' }, { origem: 'INSTAGRAM_ORGANICO' }] } }] } }) : Promise.resolve(null),
    sm.pode('atendimento', 'LEITURA') ? prisma.smMensagem.findMany({ where: { respostaMin: { not: null }, enviadaEm: { gte: desde90 }, conversa: { usuarioId: u } }, select: { respostaMin: true } }) : Promise.resolve([]),
  ])

  // Ponto de partida: há quantos dias o feed está parado, e o maior intervalo dos últimos 30 dias.
  const hoje = diaLocal(agora)
  const dias = [...new Set(feed.map(m => diaLocal(m.publicadoEm)))].sort()
  const diasSemPost = dias.length ? Math.round((Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${dias[dias.length - 1]}T12:00:00Z`)) / DIA_MS) : null
  const recentes = [diaLocal(desde30), ...dias.filter(d => d >= diaLocal(desde30)), hoje]
  let maiorIntervalo = 0
  for (let i = 1; i < recentes.length; i++) maiorIntervalo = Math.max(maiorIntervalo, Math.round((Date.parse(`${recentes[i]}T12:00:00Z`) - Date.parse(`${recentes[i - 1]}T12:00:00Z`)) / DIA_MS) - 1)

  // Sugestão a partir dos últimos 90 dias.
  const semanas = 90 / 7
  const mediaDias = dias.length / semanas
  const medResposta = mediana(respostas.map(r => r.respostaMin!))
  const mediaLeads = leads90 == null ? null : leads90 / semanas
  const leadsOpcoes = opcoesLeads(mediaLeads)
  const sugerida = {
    diasComPost: maisPerto(OPCOES_DIAS, Math.max(3, mediaDias)),
    respostaMin: medResposta == null ? (OPCOES_RESPOSTA.includes(config.metaRespostaMin as 15) ? config.metaRespostaMin : 30) : OPCOES_RESPOSTA.find(o => medResposta <= o) ?? 60,
    leadsSemana: mediaLeads == null ? leadsOpcoes[0] : maisPerto(leadsOpcoes, mediaLeads * 1.1),
  }
  return {
    pessoa: { nome: membro?.nome ?? null, tratamento: membro?.tratamento ?? membro?.nome?.split(' ')[0] ?? null, genero: pref.genero },
    loja: conta?.nomeExibicao?.split(/\s+/)[0] ?? null,
    ponto: {
      seguidores: conta?.seguidores ?? null,
      leads30, vendas30,
      diasSemPost, maiorIntervalo30: dias.length ? maiorIntervalo : null,
    },
    metas: {
      atual: { diasComPost: config.minDiasSemana, respostaMin: config.metaRespostaMin, leadsSemana: config.metaLeadsSemana },
      sugerida,
      opcoes: { diasComPost: [...OPCOES_DIAS], respostaMin: [...OPCOES_RESPOSTA], leadsSemana: leadsOpcoes },
      base: { diasPorSemana: Math.round(mediaDias * 10) / 10, respostaMediana: medResposta == null ? null : Math.round(medResposta), leadsPorSemana: mediaLeads == null ? null : Math.round(mediaLeads * 10) / 10 },
    },
    ritmo: { focoHora: pref.focoHora, avisos: pref.avisos },
    concluidoEm: pref.onboardingConcluidoEm,
  }
}

export interface EntradaBoasVindas {
  tratamento?: string | null
  genero?: 'F' | 'M' | null
  metas: { diasComPost: number; respostaMin: number; leadsSemana: number }
  focoHora: number
  avisos: Avisos
}

/** Grava as preferências e as metas; avisa o gestor das metas combinadas. Só o próprio Social Media. */
export async function salvarBoasVindas(sm: ContextoSM, e: EntradaBoasVindas, agora = new Date()) {
  const u = sm.usuarioId
  const membro = await prisma.smMembro.findUnique({ where: { usuarioId: u }, select: { id: true, nome: true, tratamento: true } })
  if (!membro || sm.visao !== 'SOCIAL_MEDIA' || sm.verComo) throw Object.assign(new Error('O primeiro acesso é do Social Media.'), { status: 403 })
  const tratamento = e.tratamento?.trim() || membro.tratamento
  await prisma.$transaction([
    prisma.smMembro.update({ where: { id: membro.id }, data: { tratamento } }),
    prisma.smPreferencia.upsert({
      where: { usuarioId_ator: { usuarioId: u, ator: membro.id } },
      create: { usuarioId: u, ator: membro.id, genero: e.genero ?? null, focoHora: e.focoHora, avisos: e.avisos, onboardingConcluidoEm: agora },
      update: { ...(e.genero !== undefined ? { genero: e.genero } : {}), focoHora: e.focoHora, avisos: e.avisos, onboardingConcluidoEm: agora },
    }),
    prisma.smConfig.upsert({
      where: { usuarioId: u },
      create: { usuarioId: u, minDiasSemana: e.metas.diasComPost, metaRespostaMin: e.metas.respostaMin, metaLeadsSemana: e.metas.leadsSemana },
      update: { minDiasSemana: e.metas.diasComPost, metaRespostaMin: e.metas.respostaMin, metaLeadsSemana: e.metas.leadsSemana },
    }),
  ])
  const quem = tratamento ?? membro.nome.split(' ')[0]
  await notificar(u, 'GESTOR', 'METAS', `metas:${membro.id}`, `${quem} combinou as metas da semana`,
    `${e.metas.diasComPost} dias com post, resposta em até ${e.metas.respostaMin} min e ${e.metas.leadsSemana} leads orgânicos por semana. Dá para ajustar nas configurações do Calendário.`)
}
