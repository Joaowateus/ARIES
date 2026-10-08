// Tela 09 · Modo foco (seção 11.2): o ritual do dia, uma tarefa por vez.
// A fila sai do backend, na ordem da seção: cliente esperando (acima da meta
// de resposta, da mais antiga para a mais nova), o que vai ao ar hoje
// (conferência final), produção atrasada e o aprendizado do post da véspera
// (acima de 1,5× ou abaixo de 0,5× da mediana). Cada ação executa de verdade
// e conta no ritual do dia (ritual_execucao), que guarda o que foi feito, os
// leads enviados ao CRM e a sequência de dias.
import { prisma } from './prisma'
import type { ContextoSM } from './smAcesso'
import { carregarConfig, diaLocal } from './smCalendario'
import { estadoJanela, responderConversa, transformarEmLead } from './smAtendimento'
import { checklistDaPauta, notificar, pendenciasParaPublicar } from './smPautas'
import { melhoresJanelas } from './smJanelas'
import { chaveDoGancho, salvarGancho } from './smTestes'
import { INTENCAO, atorDe } from './smInsights'
import { respostaPadrao } from './smPerguntas'

const DIA_MS = 864e5
const OFF = 3 * 3600e3
const somarDias = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10)
const inicioDoDia = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + OFF)
const horaLocal = (d: Date) => new Date(d.getTime() - OFF).toISOString().slice(11, 16)
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const curto = (t: string, n: number) => { const x = t.replace(/\s+/g, ' ').trim(); return x.length > n ? `${x.slice(0, n - 1)}…` : x }
const num = (v: number, c = 1) => v.toLocaleString('pt-BR', { maximumFractionDigits: c })
const mediana = (v: number[]) => { if (!v.length) return 0; const s = [...v].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
function espera(min: number) { return min < 60 ? `${min} min` : min < 2880 ? `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}` : `${Math.floor(min / 1440)} dias` }

export type TipoTarefa = 'CLIENTE' | 'PUBLICAR' | 'ATRASADA' | 'APRENDER'
type Tom = 'bad' | 'info' | 'warn' | 'ok' | 'learn'
export interface TarefaFoco {
  id: string
  tipo: TipoTarefa
  tag: string
  tom: Tom
  minutos: number
  titulo: string
  porque: string
  caixa: {
    rotulo: string
    texto?: string | null
    /** A pessoa pode editar o texto antes de executar (resposta, gancho). */
    editavel?: boolean
    itens?: Array<{ texto: string; ok: boolean | null; chave?: string; manual?: boolean; detalhe?: string }>
  }
  /** Ação primária (Enter). Sem ela, só o link para a tela certa. */
  acao: { rotulo: string } | null
  link: { rotulo: string; href: string } | null
  /** Cliente com intenção de compra: dá para virar lead junto com a resposta. */
  lead?: { nome: string; moto: string | null; pagamento: 'FINANCIAMENTO' | 'A_VISTA' | 'CONSORCIO' }
  /** Para a resposta sugerida (IA ou template) e a ação. */
  ref: string
}

const pagamentoProvavel = (t: string) => (/cons[óo]rcio/i.test(t) ? 'CONSORCIO' : /[àa] vista/i.test(t) ? 'A_VISTA' : 'FINANCIAMENTO') as 'FINANCIAMENTO' | 'A_VISTA' | 'CONSORCIO'
const podeAgir = (sm: ContextoSM, m: Parameters<ContextoSM['pode']>[0]) => !sm.somenteLeitura && sm.pode(m, 'COMPLETO')

function periodo(agora: Date) { const h = Number(horaLocal(agora).slice(0, 2)); return h >= 5 && h < 12 ? 'da manhã' : h >= 12 && h < 18 ? 'da tarde' : 'da noite' }

/** O ritual do dia de quem está vendo (no "ver como", nada é gravado). */
async function ritualDeHoje(sm: ContextoSM, agora: Date) {
  return prisma.smRitual.findUnique({ where: { usuarioId_ator_data: { usuarioId: sm.usuarioId, ator: atorDe(sm), data: diaLocal(agora) } } })
}

/** Fila do modo foco, na ordem da seção 11.2. As feitas hoje saem; as adiadas vão para o fim. */
export async function filaDoFoco(sm: ContextoSM, agora = new Date()) {
  const u = sm.usuarioId
  const hoje = diaLocal(agora)
  const iniHoje = inicioDoDia(hoje), iniAmanha = inicioDoDia(somarDias(hoje, 1)), fimAmanha = inicioDoDia(somarDias(hoje, 2))
  const [config, ritual] = await Promise.all([carregarConfig(u), sm.verComo ? null : ritualDeHoje(sm, agora)])
  const feitas = new Set((ritual?.feitas as string[] | null) ?? [])
  const adiadas = new Set((ritual?.adiadasIds as string[] | null) ?? [])
  const tarefas: TarefaFoco[] = []
  const souGestor = sm.visao === 'GESTOR'

  // 1. Cliente esperando acima da meta de resposta, da mais antiga para a mais nova.
  if (sm.pode('atendimento', 'LEITURA')) {
    const limite = new Date(agora.getTime() - config.metaRespostaMin * 60_000)
    const conversas = await prisma.smConversa.findMany({
      where: { usuarioId: u, aguardandoDesde: { not: null, lt: limite }, status: { not: 'ARQUIVADA' } },
      orderBy: { aguardandoDesde: 'asc' }, take: 6,
      include: { mensagens: { where: { direcao: 'IN' }, orderBy: { enviadaEm: 'desc' }, take: 3, select: { texto: true } } },
    })
    const podeLead = podeAgir(sm, 'atendimento') && sm.pode('crm', 'LEITURA')
    for (const c of conversas) {
      const nome = c.clienteNome ?? (c.clienteUsuario ? `@${c.clienteUsuario}` : 'Cliente')
      const ultima = c.mensagens[0]?.texto ?? ''
      const todas = c.mensagens.map(m => m.texto).join(' ')
      const janela = estadoJanela(c, agora)
      const min = Math.round((agora.getTime() - c.aguardandoDesde!.getTime()) / 60_000)
      tarefas.push({
        id: `CLIENTE:${c.id}:${c.aguardandoDesde!.toISOString()}`, ref: c.id, tipo: 'CLIENTE', tag: 'Cliente esperando', tom: 'bad', minutos: 2,
        titulo: `${nome}${c.motoInteresse ? ` · ${c.motoInteresse}` : ''}`,
        porque: `Esperando há ${espera(min)} (meta de ${config.metaRespostaMin} min).${ultima ? ` Perguntou: “${curto(ultima, 140)}”` : ''}`,
        caixa: janela.aberta
          ? { rotulo: 'Resposta sugerida (dá para editar)', texto: respostaPadrao(c.clienteNome?.split(' ')[0] ?? null, ultima, c.motoInteresse), editavel: true }
          : { rotulo: 'Janela de 24 h fechada', texto: 'A Meta só deixa responder no direct até 24 h depois da última mensagem do cliente. Quando ele escrever de novo, a janela reabre.' },
        acao: janela.aberta && podeAgir(sm, 'atendimento') ? { rotulo: 'Enviar resposta' } : null,
        link: { rotulo: 'Abrir a conversa', href: `/pro-labore/sm/atendimento?conversa=${c.id}` },
        ...(podeLead && janela.aberta && !c.leadId && INTENCAO.test(todas) ? { lead: { nome: c.clienteNome ?? '', moto: c.motoInteresse, pagamento: pagamentoProvavel(todas) } } : {}),
      })
    }
  }

  // 2. Vai ao ar hoje: conferência final de cada post agendado para o dia.
  if (sm.pode('producao', 'LEITURA')) {
    const [pautas, janelas] = await Promise.all([
      prisma.smPauta.findMany({
        where: { usuarioId: u, agendadoPara: { gte: agora, lt: iniAmanha }, status: { not: 'PUBLICADO' } },
        orderBy: { agendadoPara: 'asc' }, include: { midias: { select: { tipo: true } } },
      }),
      melhoresJanelas(u, agora),
    ])
    for (const p of pautas) {
      // Conferida hoje (aqui ou numa rodada anterior): sai da fila.
      if ((p.checklist as Record<string, unknown> | null)?.conferenciaDia === hoje) continue
      const agendada = p.status === 'AGENDADO'
      const itens = [
        ...checklistDaPauta(p, janelas).map(i => ({ texto: i.rotulo, ok: i.ok, chave: i.chave, manual: !i.automatico, detalhe: i.detalhe })),
        ...pendenciasParaPublicar(p, p.midias, agora).map(t => ({ texto: t, ok: false as boolean | null })),
        ...(agendada ? [] : [{ texto: p.status === 'APROVACAO' ? 'Esperando a aprovação do gestor' : 'Ainda não foi para Agendado', ok: false as boolean | null }]),
      ]
      tarefas.push({
        id: `PUBLICAR:${p.id}`, ref: p.id, tipo: 'PUBLICAR', tag: 'Vai ao ar hoje', tom: 'info', minutos: 3,
        titulo: `“${curto(p.titulo, 70)}” às ${horaLocal(p.agendadoPara!)}`,
        porque: agendada ? 'Conferência final antes de publicar: legenda, capa, link e horário.' : 'Está marcada para hoje, mas ainda não está agendada para publicar sozinha.',
        caixa: { rotulo: 'Checklist', itens },
        acao: agendada && podeAgir(sm, 'producao') ? { rotulo: 'Conferido, pode publicar' } : null,
        link: { rotulo: 'Abrir o briefing', href: `/pro-labore/sm/producao?pauta=${p.id}` },
      })
    }
  }

  // 3. Produção atrasada.
  if (sm.pode('producao', 'LEITURA')) {
    const atrasadas = await prisma.smPauta.findMany({
      where: { usuarioId: u, prazo: { lt: iniHoje }, status: { notIn: ['AGENDADO', 'PUBLICADO', 'APROVACAO'] } },
      orderBy: { prazo: 'asc' }, take: 3,
      select: { id: true, titulo: true, prazo: true, origem: true, gancho: true, retencao: true, recompensa: true, cta: true },
    })
    for (const p of atrasadas) {
      const entrega = p.origem === 'VENDA'
      const roteiro = [p.gancho && `Gancho: ${p.gancho}`, p.retencao && `Retenção: ${p.retencao}`, p.recompensa && `Recompensa: ${p.recompensa}`, p.cta && `Chamada: ${p.cta}`].filter(Boolean).join('\n')
      tarefas.push({
        id: `ATRASADA:${p.id}`, ref: p.id, tipo: 'ATRASADA', tag: 'Produção atrasada', tom: 'warn', minutos: 2,
        titulo: `“${curto(p.titulo, 70)}”`,
        porque: `O prazo era ${ddmm(diaLocal(p.prazo!))}. ${entrega ? 'É a entrega de um cliente: combine a gravação com o consultor.' : 'Avise quem precisa saber e combine um prazo novo.'}`,
        caixa: { rotulo: 'Roteiro', texto: roteiro || 'Roteiro ainda em branco.' },
        acao: sm.somenteLeitura ? null : { rotulo: souGestor ? 'Avisar o Social Media' : entrega ? 'Avisar o gestor e o consultor' : 'Avisar o gestor' },
        link: { rotulo: 'Abrir na Produção', href: `/pro-labore/sm/producao?pauta=${p.id}` },
      })
    }
  }

  // 4. Aprender: o post da véspera, quando acima de 1,5× ou abaixo de 0,5× da mediana.
  if (sm.pode('analise', 'LEITURA')) {
    const conta = await prisma.socialMediaConta.findUnique({ where: { titular: `dono:${u}` }, select: { id: true } })
    if (conta) {
      const feed = await prisma.socialMediaMidia.findMany({
        where: { contaId: conta.id, publicadoEm: { gte: new Date(agora.getTime() - 90 * DIA_MS), lt: iniHoje }, NOT: { formato: { in: ['STORY', 'AD'] } }, alcance: { gt: 0 } },
        select: { instagramMediaId: true, legenda: true, alcance: true, publicadoEm: true, formato: true },
      })
      const med = mediana(feed.map(m => m.alcance))
      const ontem = somarDias(hoje, -1)
      const daVespera = feed.filter(m => diaLocal(m.publicadoEm) === ontem && med > 0).map(m => ({ m, x: m.alcance / med })).filter(v => v.x >= 1.5 || v.x <= 0.5)
        .sort((a, b) => Math.abs(Math.log(b.x)) - Math.abs(Math.log(a.x)))[0]
      if (daVespera) {
        const { m, x } = daVespera
        const gancho = (m.legenda ?? '').split('\n')[0]?.trim() ?? ''
        const titulo = gancho ? curto(gancho, 60) : 'Post sem legenda'
        const alto = x >= 1.5
        const jaSalvo = alto && gancho ? !!(await prisma.smGancho.findFirst({ where: { usuarioId: u, chave: chaveDoGancho(gancho) }, select: { id: true } })) : false
        if (!jaSalvo) {
          tarefas.push({
            id: `APRENDER:${m.instagramMediaId}`, ref: m.instagramMediaId, tipo: 'APRENDER', tag: 'Aprender', tom: 'learn', minutos: 1,
            titulo: alto ? `“${titulo}” rendeu ${num(x)}× a mediana` : `“${titulo}” ficou em ${num(x)}× a mediana`,
            porque: alto ? 'O post de ontem foi bem acima do normal. Vale guardar o gancho na biblioteca para repetir.' : 'O post de ontem ficou abaixo da metade do normal. Vale comparar o gancho com os que funcionaram.',
            caixa: { rotulo: alto ? 'Gancho (primeira frase da legenda)' : 'Primeira frase da legenda', texto: gancho || null, editavel: alto },
            acao: alto ? (podeAgir(sm, 'producao') && gancho ? { rotulo: 'Salvar gancho na biblioteca' } : null) : { rotulo: 'Entendi' },
            link: { rotulo: 'Ver o diagnóstico dos reels', href: '/pro-labore/sm/desempenho#reels' },
          })
        }
      }
    }
  }

  const fila = tarefas.filter(t => !feitas.has(t.id))
  const ordenada = [...fila.filter(t => !adiadas.has(t.id)), ...fila.filter(t => adiadas.has(t.id))]

  // Próximo compromisso do dia (tela de conclusão).
  let proximo: string | null = null
  if (sm.pode('producao', 'LEITURA')) {
    const p = await prisma.smPauta.findFirst({ where: { usuarioId: u, status: 'AGENDADO', agendadoPara: { gt: agora, lt: fimAmanha } }, orderBy: { agendadoPara: 'asc' }, select: { titulo: true, agendadoPara: true } })
    if (p) proximo = p.agendadoPara! < iniAmanha ? `Próximo compromisso: “${curto(p.titulo, 50)}” às ${horaLocal(p.agendadoPara!)}, já agendado.` : `Amanhã às ${horaLocal(p.agendadoPara!)}: “${curto(p.titulo, 50)}”, já agendado.`
  }
  return {
    titulo: `Modo foco · Ritual ${periodo(agora)}`,
    tarefas: ordenada,
    proximo: proximo ?? 'Nada mais marcado para hoje.',
    somenteLeitura: sm.somenteLeitura,
  }
}

export class ErroFoco extends Error { constructor(msg: string, public status = 409) { super(msg) } }

/** Começa (ou recomeça) o ritual de hoje: marca a hora da rodada. */
export async function iniciarRitual(sm: ContextoSM, agora = new Date()) {
  if (sm.verComo) return
  const chave = { usuarioId: sm.usuarioId, ator: atorDe(sm), data: diaLocal(agora) }
  await prisma.smRitual.upsert({ where: { usuarioId_ator_data: chave }, create: { ...chave, iniciadoEm: agora, rodadaEm: agora }, update: { rodadaEm: agora } })
}

async function registrar(sm: ContextoSM, tarefaId: string, agora: Date, extra: { lead?: boolean; adiada?: boolean } = {}) {
  const chave = { usuarioId: sm.usuarioId, ator: atorDe(sm), data: diaLocal(agora) }
  const atual = await prisma.smRitual.upsert({ where: { usuarioId_ator_data: chave }, create: { ...chave, iniciadoEm: agora, rodadaEm: agora }, update: {} })
  if (extra.adiada) {
    const ids = new Set((atual.adiadasIds as string[]) ?? [])
    if (!ids.has(tarefaId)) await prisma.smRitual.update({ where: { id: atual.id }, data: { adiadasIds: [...ids, tarefaId], adiadas: { increment: 1 } } })
    return
  }
  const feitas = new Set((atual.feitas as string[]) ?? [])
  if (feitas.has(tarefaId)) return
  await prisma.smRitual.update({ where: { id: atual.id }, data: { feitas: [...feitas, tarefaId], tarefas: { increment: 1 }, ...(extra.lead ? { leads: { increment: 1 } } : {}) } })
}

/** Executa a ação da tarefa, que o servidor reencontra na fila (o navegador só manda o id). */
export async function executarTarefa(sm: ContextoSM, tarefaId: string, d: { texto?: string; virarLead?: boolean; lead?: { nome: string; moto: string | null; pagamento: 'FINANCIAMENTO' | 'A_VISTA' | 'CONSORCIO' }; capaTexto?: boolean }, agora = new Date()) {
  if (sm.somenteLeitura) throw new ErroFoco('Pré-visualização: só leitura.', 403)
  const t = (await filaDoFoco(sm, agora)).tarefas.find(x => x.id === tarefaId)
  if (!t || !t.acao) throw new ErroFoco('Essa tarefa já não está na fila. Atualize a tela.')
  let leadCriado: { leadId: string; consultor: string | null } | null = null
  if (t.tipo === 'CLIENTE') {
    const texto = (d.texto ?? t.caixa.texto ?? '').trim()
    if (texto.length < 2) throw new ErroFoco('Escreva a resposta', 400)
    if (texto.length > 1000) throw new ErroFoco('Resposta longa demais (máx. 1.000 caracteres)', 400)
    const c = await prisma.smConversa.findFirst({ where: { id: t.ref, usuarioId: sm.usuarioId } })
    if (!c) throw new ErroFoco('Conversa não encontrada', 404)
    try { await responderConversa(c, texto) } catch (e) { throw new ErroFoco(e instanceof Error ? e.message : 'Falha ao enviar') }
    if (d.virarLead && t.lead) {
      const nome = (d.lead?.nome ?? t.lead.nome).trim()
      if (nome.length < 2) throw new ErroFoco('Resposta enviada. Para virar lead, informe o nome do cliente.', 400)
      leadCriado = await transformarEmLead((await prisma.smConversa.findUnique({ where: { id: c.id } }))!, { nome, whatsapp: null, moto: d.lead?.moto ?? t.lead.moto, pagamento: d.lead?.pagamento ?? t.lead.pagamento })
    }
  } else if (t.tipo === 'PUBLICAR') {
    const p = await prisma.smPauta.findFirst({ where: { id: t.ref, usuarioId: sm.usuarioId }, select: { checklist: true } })
    if (!p) throw new ErroFoco('Pauta não encontrada', 404)
    await prisma.smPauta.update({ where: { id: t.ref }, data: { checklist: { ...(p.checklist as object), conferenciaDia: diaLocal(agora), ...(d.capaTexto !== undefined ? { capaTexto: d.capaTexto } : {}) } } })
  } else if (t.tipo === 'ATRASADA') {
    const p = await prisma.smPauta.findFirst({ where: { id: t.ref, usuarioId: sm.usuarioId }, select: { titulo: true, prazo: true, origem: true } })
    if (!p) throw new ErroFoco('Pauta não encontrada', 404)
    const entrega = p.origem === 'VENDA'
    await notificar(sm.usuarioId, sm.visao === 'GESTOR' ? 'SOCIAL_MEDIA' : 'GESTOR', 'INSIGHT', `atrasada:${t.ref}`, `Pauta atrasada: ${p.titulo}`,
      entrega ? 'Entrega de cliente atrasada: combinar a gravação com o consultor da venda.' : `Prazo era ${ddmm(diaLocal(p.prazo!))}.`)
  } else if (t.tipo === 'APRENDER' && t.acao.rotulo !== 'Entendi') {
    const texto = (d.texto ?? t.caixa.texto ?? '').trim()
    if (texto.length < 3) throw new ErroFoco('Escreva o gancho', 400)
    await salvarGancho(sm.usuarioId, texto.slice(0, 300), [t.ref], sm.visao === 'GESTOR' ? 'GESTOR' : 'SOCIAL_MEDIA')
  }
  await registrar(sm, t.id, agora, { lead: !!leadCriado })
  return { ok: true, leadCriado }
}

export async function adiarTarefa(sm: ContextoSM, tarefaId: string, agora = new Date()) {
  if (sm.somenteLeitura) return
  await registrar(sm, tarefaId, agora, { adiada: true })
}

/** Dias seguidos (de expediente) com o ritual concluído, terminando hoje. */
async function sequencia(sm: ContextoSM, agora: Date) {
  const config = await carregarConfig(sm.usuarioId)
  const dias = new Set(config.expedienteDias.split(',').map(Number))
  const rituais = await prisma.smRitual.findMany({ where: { usuarioId: sm.usuarioId, ator: atorDe(sm), concluidoEm: { not: null }, data: { gte: somarDias(diaLocal(agora), -90) } }, select: { data: true } })
  const feitos = new Set(rituais.map(r => r.data))
  let n = 0
  for (let i = 0, d = diaLocal(agora); i < 90; i++, d = somarDias(d, -1)) {
    if (feitos.has(d)) { n++; continue }
    if (i === 0) continue // hoje ainda pode estar em andamento
    if (!dias.has(new Date(`${d}T12:00:00Z`).getUTCDay())) continue // fim de semana não quebra a sequência
    break
  }
  return n
}

/** Fecha a rodada: "Manhã resolvida em X minutos", tarefas, leads e a sequência. */
export async function concluirRitual(sm: ContextoSM, agora = new Date()) {
  const fila = await filaDoFoco(sm, agora)
  if (sm.verComo) return { minutos: 0, tarefas: 0, leads: 0, sequencia: 0, proximo: fila.proximo, periodo: periodo(agora) }
  const chave = { usuarioId: sm.usuarioId, ator: atorDe(sm), data: diaLocal(agora) }
  const r = await prisma.smRitual.upsert({ where: { usuarioId_ator_data: chave }, create: { ...chave, iniciadoEm: agora, rodadaEm: agora, concluidoEm: agora }, update: { concluidoEm: agora } })
  return {
    minutos: Math.max(1, Math.round((agora.getTime() - r.rodadaEm.getTime()) / 60_000)),
    tarefas: r.tarefas, leads: r.leads, sequencia: await sequencia(sm, agora),
    proximo: fila.proximo, periodo: periodo(agora),
  }
}
