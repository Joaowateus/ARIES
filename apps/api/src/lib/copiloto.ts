// Copiloto Comercial: o ciclo diário de cada pessoa.
// 1. Verifica o efeito das ações dos dias anteriores (o lead avançou? a
//    conversa foi respondida?) e marca como feitas as que o CRM comprova.
// 2. Transforma isso em aprendizado medido ("o que funciona com você") e
//    usa no plano do dia.
// 3. Mede a produção, gera achados, índice e plano; a IA redige o relatório
//    (ou o modelo, sem IA) com a memória da pessoa.
// 4. Garante a trilha de estudo da competência em foco.
// Roda sozinho no cron (rodarCopiloto) e quando a pessoa abre a tela.
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { bibliotecaDa, COMPETENCIAS, type Competencia } from './copilotoCompetencias'
import { EQUIPE, achadosDe, chaveDia, coletarFatos, competenciaFoco, indiceDoDia, planoDoDia, rankEstagio, type Achado, type Fatos } from './copilotoFatos'
import { iaLigada, redigirRelatorio, type RelatorioIA } from './copilotoIA'
import { relatorioModelo } from './copilotoModelos'
import { diaBrasilia } from './socialMediaSync'
import { enviarTexto, evolutionConfigurada } from './whatsappEvolution'

const DIA = 24 * 3600e3
export const ROTULO_ACAO: Record<string, string> = {
  RESPONDER: 'Responder no WhatsApp', ABORDAR: 'Abordar lead novo', FOLLOW_UP: 'Follow-up de negociação e proposta', REATIVAR: 'Puxar lead abordado',
  AGENDA: 'Tarefa da agenda', ESTUDO: 'Estudo', EQUIPE: 'Conversa com a equipe', HABITO: 'Hábito',
}

export const hojeChave = (agora = new Date()) => chaveDia(diaBrasilia(agora))

export async function garantirPerfil(usuarioId: string, pessoa: string) {
  return prisma.copilotoPerfil.upsert({ where: { usuarioId_pessoa: { usuarioId, pessoa } }, create: { usuarioId, pessoa }, update: {} })
}

// ---------- 1. Efeito das ações ----------

export async function verificarAcoes(usuarioId: string, pessoa: string, agora = new Date()): Promise<number> {
  const hoje = hojeChave(agora)
  const desde = chaveDia(new Date(agora.getTime() - 14 * DIA))
  const acoes = await prisma.copilotoAcao.findMany({ where: { usuarioId, pessoa, dia: { lt: hoje, gte: desde }, verificadaEm: null, refId: { not: null }, refTipo: { in: ['LEAD', 'CONVERSA'] } } })
  let n = 0
  for (const a of acoes) {
    let resultado: string | null = null
    if (a.refTipo === 'LEAD') {
      const lead = await prisma.lead.findFirst({ where: { id: a.refId!, usuarioId }, select: { estagio: true } })
      if (!lead) resultado = 'SEM_EFEITO'
      else if (lead.estagio !== 'PERDIDO' && rankEstagio(lead.estagio) > rankEstagio(a.estagioNaHora)) resultado = 'AVANCOU'
      else resultado = 'SEM_EFEITO'
    } else {
      const c = await prisma.assistenteConversa.findUnique({ where: { id: a.refId! }, select: { status: true, mensagens: { where: { criadoEm: { gte: a.criadoEm } }, select: { remetente: true }, orderBy: { criadoEm: 'desc' }, take: 1 } } })
      resultado = c && (c.mensagens[0]?.remetente === 'VENDEDOR' || c.status === 'ENCERRADA') ? 'RESPONDIDA' : 'SEM_EFEITO'
    }
    const comprovada = resultado === 'AVANCOU' || resultado === 'RESPONDIDA'
    await prisma.copilotoAcao.update({
      where: { id: a.id },
      data: { resultado, verificadaEm: agora, ...(a.status === 'PENDENTE' && comprovada ? { status: 'FEITA', feitaEm: agora } : {}) },
    })
    n++
  }
  return n
}

// ---------- 2. Aprendizado medido ----------

/** Taxa de efeito por tipo de ação (últimos 30 dias) e memória "o que funciona com você". */
export async function atualizarAprendizados(usuarioId: string, pessoa: string, agora = new Date()): Promise<Record<string, number>> {
  const desde = chaveDia(new Date(agora.getTime() - 30 * DIA))
  const acoes = await prisma.copilotoAcao.findMany({ where: { usuarioId, pessoa, dia: { gte: desde }, status: 'FEITA', resultado: { not: null } }, select: { tipo: true, resultado: true } })
  const porTipo = new Map<string, { feitas: number; efeito: number }>()
  for (const a of acoes) {
    const x = porTipo.get(a.tipo) ?? { feitas: 0, efeito: 0 }
    x.feitas++
    if (a.resultado === 'AVANCOU' || a.resultado === 'RESPONDIDA') x.efeito++
    porTipo.set(a.tipo, x)
  }
  const efeito: Record<string, number> = {}
  for (const [tipo, x] of porTipo) {
    efeito[tipo] = x.efeito / x.feitas
    if (x.feitas < 3 || tipo === 'RESPONDER') continue
    const texto = `${ROTULO_ACAO[tipo] ?? tipo}: em ${x.feitas} ações feitas nos últimos 30 dias, ${x.efeito} ${x.efeito === 1 ? 'lead avançou' : 'leads avançaram'} de estágio depois.`
    await lembrarMedido(usuarioId, pessoa, `efeito:${tipo}`, texto)
  }
  // Sugestões de resposta usadas: o lead avançou depois?
  const sugestoes = await prisma.copilotoSugestao.findMany({ where: { usuarioId, pessoa, usadaEm: { gte: new Date(agora.getTime() - 30 * DIA), lte: new Date(agora.getTime() - DIA) } }, select: { id: true, conversaId: true, estagioNaHora: true, resultado: true } })
  let usadas = 0, avancaram = 0
  for (const s of sugestoes) {
    let r = s.resultado
    if (!r) {
      const c = await prisma.assistenteConversa.findUnique({ where: { id: s.conversaId }, select: { lead: { select: { estagio: true } } } })
      r = c?.lead && c.lead.estagio !== 'PERDIDO' && rankEstagio(c.lead.estagio) > rankEstagio(s.estagioNaHora) ? 'AVANCOU' : 'SEM_EFEITO'
      await prisma.copilotoSugestao.update({ where: { id: s.id }, data: { resultado: r } })
    }
    usadas++
    if (r === 'AVANCOU') avancaram++
  }
  if (usadas >= 3) await lembrarMedido(usuarioId, pessoa, 'efeito:SUGESTAO', `Sugestões de resposta usadas: ${usadas} nos últimos 30 dias, e em ${avancaram} o lead avançou de estágio depois.`)
  // Formato de estudo que a pessoa marca como útil.
  const estudos = await prisma.copilotoEstudo.findMany({ where: { usuarioId, pessoa, util: { not: null } }, select: { tipo: true, util: true } })
  const uteis = new Map<string, number>()
  for (const e of estudos) if (e.util) uteis.set(e.tipo, (uteis.get(e.tipo) ?? 0) + 1)
  const preferido = [...uteis.entries()].sort((a, b) => b[1] - a[1])[0]
  if (preferido && preferido[1] >= 2) await lembrarMedido(usuarioId, pessoa, 'preferencia:estudo', `Formato de estudo que você mais marca como útil: ${({ VIDEO: 'vídeo', ARTIGO: 'artigo', LIVRO: 'livro', CURSO: 'curso', PODCAST: 'podcast', BUSCA: 'busca de vídeos' } as Record<string, string>)[preferido[0]] ?? preferido[0]} (${preferido[1]} vezes).`)
  return efeito
}

async function lembrarMedido(usuarioId: string, pessoa: string, chave: string, texto: string) {
  const existente = await prisma.copilotoMemoria.findFirst({ where: { usuarioId, pessoa, chave } })
  if (existente) { if (existente.texto !== texto && existente.ativa) await prisma.copilotoMemoria.update({ where: { id: existente.id }, data: { texto } }); return }
  await prisma.copilotoMemoria.create({ data: { usuarioId, pessoa, chave, texto, tipo: 'APRENDIZADO', natureza: 'FATO', origem: 'RESULTADO' } })
}

export async function memoriaParaIA(usuarioId: string, pessoa: string) {
  const m = await prisma.copilotoMemoria.findMany({ where: { usuarioId, pessoa, ativa: true }, orderBy: { atualizadoEm: 'desc' }, take: 25, select: { tipo: true, texto: true, natureza: true } })
  return m
}

// ---------- 3. O dia ----------

/** Fatos sem ids e sem o que só serve à tela (o que vai para a IA). */
export function fatosParaIA(f: Fatos) {
  return {
    ...f,
    parados: { ...f.parados, lista: f.parados.lista.map(({ id: _id, ...r }) => r) },
    agenda: { ...f.agenda, hoje: f.agenda.hoje.map(t => ({ titulo: t.titulo, horario: t.horario })) },
    whatsapp: { ...f.whatsapp, pendentes: f.whatsapp.pendentes.map(p => ({ nome: p.nome, horas: p.horas, situacao: p.situacao })) },
    equipe: f.equipe?.map(({ vendedorId: _v, ...r }) => r) ?? null,
  }
}

export interface ResultadoDia { id: string; origem: string; criado: boolean }

export async function gerarDia(usuarioId: string, pessoa: string, opcoes: { agora?: Date; comIA?: boolean; refazer?: boolean } = {}): Promise<ResultadoDia | null> {
  const agora = opcoes.agora ?? new Date()
  const dia = hojeChave(agora)
  const existente = await prisma.copilotoDia.findUnique({ where: { usuarioId_pessoa_dia: { usuarioId, pessoa, dia } } })
  // Sem IA ainda: tenta de novo no máximo uma vez por hora (falha ou cota não viram repetição a cada abertura).
  const tentarIA = !!opcoes.comIA && iaLigada() && (!existente || (existente.origem !== 'IA' && (!existente.iaEm || agora.getTime() - existente.iaEm.getTime() > 3600e3)))
  if (existente && !opcoes.refazer && !tentarIA) return { id: existente.id, origem: existente.origem, criado: false }

  const perfil = await garantirPerfil(usuarioId, pessoa)
  await verificarAcoes(usuarioId, pessoa, agora)
  const efeito = await atualizarAprendizados(usuarioId, pessoa, agora)
  const fatos = await coletarFatos(usuarioId, pessoa, agora)
  if (!fatos) return null
  const achados = achadosDe(fatos)
  const indice = indiceDoDia(fatos)
  const foco = competenciaFoco(achados, pessoa === EQUIPE)
  const plano = planoDoDia(fatos, foco, perfil.minutosEstudoDia, efeito)

  let relatorio: RelatorioIA = relatorioModelo(fatos, achados, plano, indice, foco)
  let origem = 'MODELO'
  if (tentarIA || (opcoes.refazer && opcoes.comIA && iaLigada())) {
    const ontem = await prisma.copilotoDia.findFirst({ where: { usuarioId, pessoa, dia: { lt: dia } }, orderBy: { dia: 'desc' }, select: { dia: true, indice: true, util: true, comentario: true } })
    const acoesOntem = ontem ? await prisma.copilotoAcao.findMany({ where: { usuarioId, pessoa, dia: ontem.dia }, select: { texto: true, status: true, resultado: true } }) : []
    const memoria = await memoriaParaIA(usuarioId, pessoa)
    const ia = await redigirRelatorio(usuarioId, {
      fatos: fatosParaIA(fatos), achados: achados.map(a => ({ tipo: a.tipo, competencia: a.competencia, texto: a.texto })),
      plano: plano.map(p => ({ tipo: p.tipo, texto: p.texto, porque: p.porque })), memoria,
      efeitos: Object.fromEntries(Object.entries(efeito).map(([k, v]) => [k, Math.round(v * 100)])),
      perfil: { nivel: perfil.nivel, objetivo: perfil.objetivo, minutosEstudoDia: perfil.minutosEstudoDia, indiceHoje: indice },
      ontem: ontem ? { indice: ontem.indice, relatorioUtil: ontem.util, comentario: ontem.comentario, acoes: acoesOntem } : null, foco,
    })
    if (ia) {
      relatorio = ia; origem = 'IA'
      for (const h of ia.hipoteses.slice(0, 2)) {
        const ja = await prisma.copilotoMemoria.findFirst({ where: { usuarioId, pessoa, texto: h } })
        if (!ja) await prisma.copilotoMemoria.create({ data: { usuarioId, pessoa, tipo: 'ESTILO', texto: h, natureza: 'HIPOTESE', origem: 'COPILOTO' } })
      }
    }
  }

  const dados = { fatos: fatos as unknown as Prisma.InputJsonValue, achados: achados as unknown as Prisma.InputJsonValue, relatorio: { ...relatorio, foco } as unknown as Prisma.InputJsonValue, origem, indice, ...(tentarIA || (opcoes.refazer && opcoes.comIA && iaLigada()) ? { iaEm: agora } : {}) }
  const registro = existente
    ? await prisma.copilotoDia.update({ where: { id: existente.id }, data: { ...dados, geradoEm: agora } })
    : await prisma.copilotoDia.create({ data: { usuarioId, pessoa, dia, ...dados } })

  // Plano: refazer mantém o que já foi feito ou dispensado e troca as pendentes.
  const atuais = await prisma.copilotoAcao.findMany({ where: { usuarioId, pessoa, dia } })
  const decididas = atuais.filter(a => a.status !== 'PENDENTE')
  const mesma = (a: { tipo: string; refId: string | null; texto: string }, b: { tipo: string; refId?: string | null; texto: string }) => a.tipo === b.tipo && (a.refId ?? a.texto) === (b.refId ?? b.texto)
  const pendentesAntigas = atuais.filter(a => a.status === 'PENDENTE')
  const novas = plano.filter(p => !decididas.some(d => mesma(d, p)))
  if (!existente || opcoes.refazer || pendentesAntigas.length === 0) {
    await prisma.copilotoAcao.deleteMany({ where: { id: { in: pendentesAntigas.map(a => a.id) } } })
    await prisma.copilotoAcao.createMany({
      data: novas.map((p, i) => ({ usuarioId, pessoa, dia, ordem: decididas.length + i, tipo: p.tipo, texto: p.texto, porque: p.porque, refTipo: p.refTipo ?? null, refId: p.refId ?? null, estagioNaHora: p.estagioNaHora ?? null })),
    })
  }

  await garantirTrilha(usuarioId, pessoa, foco)
  return { id: registro.id, origem, criado: !existente }
}

// ---------- 4. Trilha de estudo ----------

export async function garantirTrilha(usuarioId: string, pessoa: string, foco: Competencia) {
  const tem = await prisma.copilotoEstudo.count({ where: { usuarioId, pessoa, competencia: foco, status: { in: ['SUGERIDO', 'ESTUDANDO'] } } })
  if (tem > 0) return
  const ja = new Set((await prisma.copilotoEstudo.findMany({ where: { usuarioId, pessoa, competencia: foco }, select: { url: true } })).map(e => e.url))
  const itens = bibliotecaDa(foco).filter(i => !ja.has(i.url))
  if (itens.length) await prisma.copilotoEstudo.createMany({ data: itens.map(i => ({ usuarioId, pessoa, competencia: foco, titulo: i.titulo, tipo: i.tipo, url: i.url, fonte: i.fonte, porque: i.porque, origem: 'BIBLIOTECA' })) })
}

// ---------- Leitura para a tela ----------

export interface Relatorio extends RelatorioIA { foco: Competencia }

export async function telaDoDia(usuarioId: string, pessoa: string, agora = new Date()) {
  const dia = hojeChave(agora)
  const registro = await prisma.copilotoDia.findUnique({ where: { usuarioId_pessoa_dia: { usuarioId, pessoa, dia } } })
  if (!registro) return null
  const [acoes, historico] = await Promise.all([
    prisma.copilotoAcao.findMany({ where: { usuarioId, pessoa, dia }, orderBy: { ordem: 'asc' } }),
    prisma.copilotoDia.findMany({ where: { usuarioId, pessoa }, orderBy: { dia: 'desc' }, take: 30, select: { dia: true, indice: true } }),
  ])
  const relatorio = registro.relatorio as unknown as Relatorio
  return {
    dia, origem: registro.origem, geradoEm: registro.geradoEm, lidoEm: registro.lidoEm, util: registro.util, indice: registro.indice ?? 0,
    fatos: registro.fatos as unknown as Fatos, achados: registro.achados as unknown as Achado[], relatorio,
    foco: { chave: relatorio.foco, ...COMPETENCIAS[relatorio.foco] },
    acoes, indices: historico.reverse(),
  }
}

// ---------- WhatsApp do dia (opt-in) ----------

export function textoWhatsapp(nome: string, r: Relatorio, acoes: Array<{ texto: string }>, indice: number): string {
  return [
    `🧭 *Copiloto — seu dia*`,
    '',
    r.resumo,
    '',
    `*Índice de execução:* ${indice}`,
    '',
    '*Plano de hoje:*',
    ...acoes.slice(0, 5).map((a, i) => `${i + 1}. ${a.texto}`),
    '',
    `*Dica:* ${r.dica.titulo} — ${r.dica.tecnica}`,
    '',
    `Bom trabalho, ${nome}! O relatório completo está na aba Copiloto do sistema.`,
  ].join('\n')
}

async function enviarWhatsappDoDia(usuarioId: string, pessoa: string, agora: Date): Promise<boolean> {
  if (pessoa === EQUIPE || !evolutionConfigurada()) return false
  const dia = hojeChave(agora)
  const reg = await prisma.copilotoDia.findUnique({ where: { usuarioId_pessoa_dia: { usuarioId, pessoa, dia } } })
  if (!reg || reg.whatsappEnviadoEm) return false
  const a = await prisma.assistenteComercial.findUnique({ where: { vendedorId: pessoa }, select: { instancia: true, numeroWhatsapp: true, status: true, vendedor: { select: { nome: true } } } })
  if (!a?.instancia || !a.numeroWhatsapp || a.status !== 'CONECTADO') return false
  const acoes = await prisma.copilotoAcao.findMany({ where: { usuarioId, pessoa, dia }, orderBy: { ordem: 'asc' }, select: { texto: true } })
  try {
    await enviarTexto(a.instancia, a.numeroWhatsapp, textoWhatsapp(a.vendedor.nome.split(' ')[0], reg.relatorio as unknown as Relatorio, acoes, reg.indice ?? 0))
    await prisma.copilotoDia.update({ where: { id: reg.id }, data: { whatsappEnviadoEm: agora } })
    return true
  } catch (e) { console.warn('[copiloto] whatsapp do dia', e instanceof Error ? e.message : e); return false }
}

// ---------- Cron ----------

/**
 * A partir das 7h (Brasília): o dia de cada pessoa que usa o Copiloto
 * (perfil ativo, aberto nos últimos 30 dias) é gerado pelas regras; com o
 * tempo que sobra, a IA redige os relatórios, um por vez; por fim, o resumo
 * vai para o WhatsApp de quem pediu. O que não couber nesta rodada fica
 * para a próxima (ou é feito quando a pessoa abre a tela).
 */
export async function rodarCopiloto(agora = new Date(), orcamentoMs = 8000): Promise<{ copilotoDias: number; copilotoIA: number; copilotoWhatsapp: number }> {
  const inicio = Date.now()
  const r = { copilotoDias: 0, copilotoIA: 0, copilotoWhatsapp: 0 }
  const hora = new Date(agora.getTime() - 3 * 3600e3).getUTCHours()
  if (hora < 7 || hora > 20) return r
  const dia = hojeChave(agora)
  const perfis = await prisma.copilotoPerfil.findMany({ where: { ativo: true, ultimoAcessoEm: { gte: new Date(agora.getTime() - 30 * DIA) } }, select: { usuarioId: true, pessoa: true, whatsappDiario: true } })
  const feitos = new Set((await prisma.copilotoDia.findMany({ where: { dia }, select: { usuarioId: true, pessoa: true } })).map(d => `${d.usuarioId}|${d.pessoa}`))
  for (const p of perfis) {
    if (Date.now() - inicio > orcamentoMs) return r
    if (feitos.has(`${p.usuarioId}|${p.pessoa}`)) continue
    try { if ((await gerarDia(p.usuarioId, p.pessoa, { agora }))?.criado) r.copilotoDias++ } catch (e) { console.error('[copiloto] gerar dia', e) }
  }
  if (iaLigada()) {
    const semIA = await prisma.copilotoDia.findMany({ where: { dia, origem: 'MODELO' }, select: { usuarioId: true, pessoa: true }, take: 20 })
    for (const d of semIA) {
      if (Date.now() - inicio > orcamentoMs - 2000) break
      if (!perfis.some(p => p.usuarioId === d.usuarioId && p.pessoa === d.pessoa)) continue
      try { if ((await gerarDia(d.usuarioId, d.pessoa, { agora, comIA: true }))?.origem === 'IA') r.copilotoIA++ } catch (e) { console.error('[copiloto] IA do dia', e) }
    }
  }
  for (const p of perfis.filter(x => x.whatsappDiario)) {
    if (Date.now() - inicio > orcamentoMs + 4000) break
    if (await enviarWhatsappDoDia(p.usuarioId, p.pessoa, agora)) r.copilotoWhatsapp++
  }
  return r
}
