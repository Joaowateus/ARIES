// PDF 02 · 4.4 Atividade (ATV) e régua de cobrança.
//
// Semana em paralelo: o banco copia cada follow, ligação, conclusão de
// rotina e follow do robô para a ATV (gatilhos aries_atv_*). Aqui ficam:
// - as ocorrências pendentes das rotinas da Agenda (uma ATV por pessoa e
//   por dia, com a mesma chave que a conclusão usa: item|pessoa|dia);
// - a régua de cobrança, em modo de registro: anota o lembrete, o alerta,
//   o segundo alerta e o escalonamento nos tempos certos, sem mandar nada.
//   O envio de verdade só liga depois da liberação do dono (MODO_REGUA).
import { prisma } from './prisma'

export const ETAPAS_REGUA = ['LEMBRETE', 'ALERTA', 'ALERTA_2', 'ESCALONAMENTO'] as const
export type EtapaRegua = typeof ETAPAS_REGUA[number]
export const ORIGENS_ATV = ['OPORTUNIDADE', 'RECOMENDACAO', 'ROTINA', 'REUNIAO', 'OCORRENCIA', 'PAUTA'] as const
export type OrigemAtv = typeof ORIGENS_ATV[number]

export interface ConfigRegua { lembreteMinAntes: number; segundoAlertaMin: number; escalonamentoMin: number; escalonarPara: 'SUPERVISOR' | 'GESTOR' | 'DONO' }
// 4.4: alerta no vencimento, novo alerta 2 h depois, escalonamento com 24 h
// de atraso. O tempo do lembrete "antes do vencimento" não está definido no
// PDF: 30 minutos é o padrão provisório, ajustável por tipo de origem.
export const REGUA_PADRAO: ConfigRegua = { lembreteMinAntes: 30, segundoAlertaMin: 120, escalonamentoMin: 1440, escalonarPara: 'SUPERVISOR' }
// Social Media escalona para o gestor (pauta); venda e reativação, para o supervisor comercial.
const PADRAO_POR_ORIGEM: Partial<Record<OrigemAtv, Partial<ConfigRegua>>> = { PAUTA: { escalonarPara: 'GESTOR' } }

// REGISTRO = só anota (semana em paralelo). ENVIO fica reservado para a liberação.
export const MODO_REGUA: 'REGISTRO' | 'ENVIO' = 'REGISTRO'

const MIN = 60_000
const HORA = 60 * MIN

export async function configDaRegua(usuarioId: string): Promise<Record<OrigemAtv, ConfigRegua>> {
  const salvas = await prisma.reguaCobranca.findMany({ where: { usuarioId } })
  const out = {} as Record<OrigemAtv, ConfigRegua>
  for (const o of ORIGENS_ATV) {
    const s = salvas.find(x => x.origemTipo === o)
    out[o] = s
      ? { lembreteMinAntes: s.lembreteMinAntes, segundoAlertaMin: s.segundoAlertaMin, escalonamentoMin: s.escalonamentoMin, escalonarPara: s.escalonarPara as ConfigRegua['escalonarPara'] }
      : { ...REGUA_PADRAO, ...PADRAO_POR_ORIGEM[o] }
  }
  return out
}

/** Quando cada etapa da régua vence, a partir do prazo da atividade. */
export function horariosDaRegua(prazo: Date, c: ConfigRegua): Record<EtapaRegua, Date> {
  const t = prazo.getTime()
  return {
    LEMBRETE: new Date(t - c.lembreteMinAntes * MIN),
    ALERTA: new Date(t),
    ALERTA_2: new Date(t + c.segundoAlertaMin * MIN),
    ESCALONAMENTO: new Date(t + c.escalonamentoMin * MIN),
  }
}

/** Para quem vai o escalonamento: supervisor comercial (ou gestor do Social Media); sem ele, o dono. */
async function destinoDoEscalonamento(usuarioId: string, para: ConfigRegua['escalonarPara'], cache: Map<string, string>): Promise<string> {
  const chave = `${usuarioId}|${para}`
  const salvo = cache.get(chave)
  if (salvo) return salvo
  let destino = usuarioId
  if (para === 'SUPERVISOR') {
    const sup = await prisma.vendedor.findFirst({ where: { usuarioId, ativo: true, papel: 'SUPERVISOR' }, select: { id: true }, orderBy: { criadoEm: 'asc' } })
    if (sup) destino = sup.id
  }
  // GESTOR (Social Media): o gestor da conta é o dono; DONO: o próprio dono.
  cache.set(chave, destino)
  return destino
}

/**
 * A cada 15 minutos: para cada atividade pendente, anota as etapas da régua
 * que já venceram (uma vez cada). Para quando a execução é registrada —
 * atividade executada ou cancelada não entra mais aqui.
 */
export async function rodarRegua(agora = new Date(), limite = 2000) {
  const configs = new Map<string, Record<OrigemAtv, ConfigRegua>>()
  const destinos = new Map<string, string>()
  // Só o que já chegou na janela do maior lembrete possível (24 h à frente).
  const pendentes = await prisma.atividade.findMany({
    where: { status: 'PENDENTE', reguaEstado: { notIn: ['ESCALONADA', 'PARADA'] }, prazo: { lte: new Date(agora.getTime() + 24 * HORA) } },
    select: { id: true, usuarioId: true, origemTipo: true, prazo: true, responsavelId: true, reguaEstado: true },
    orderBy: { prazo: 'asc' }, take: limite,
  })
  let registros = 0
  for (const a of pendentes) {
    if (!configs.has(a.usuarioId)) configs.set(a.usuarioId, await configDaRegua(a.usuarioId))
    const c = configs.get(a.usuarioId)![(a.origemTipo as OrigemAtv)] ?? REGUA_PADRAO
    const h = horariosDaRegua(a.prazo, c)
    // Só a etapa mais avançada que já venceu: quem atrasou 3 dias não
    // recebe lembrete, alerta e segundo alerta de uma vez.
    const vencidas = ETAPAS_REGUA.filter(e => h[e] <= agora)
    if (!vencidas.length) continue
    const etapa = vencidas[vencidas.length - 1]
    if (ETAPAS_REGUA.indexOf(etapa) <= ETAPAS_REGUA.indexOf(a.reguaEstado as EtapaRegua)) continue
    const destinatarioId = etapa === 'ESCALONAMENTO' ? await destinoDoEscalonamento(a.usuarioId, c.escalonarPara, destinos) : a.responsavelId
    const criado = await prisma.reguaRegistro.createMany({
      data: [{ atividadeId: a.id, etapa, previstoPara: h[etapa], destinatarioId, modo: MODO_REGUA, enviado: false }],
      skipDuplicates: true,
    })
    // Atualiza o estado só se ninguém registrou a execução nesse meio-tempo.
    await prisma.atividade.updateMany({
      where: { id: a.id, status: 'PENDENTE' },
      data: { reguaEstado: etapa === 'ESCALONAMENTO' ? 'ESCALONADA' : etapa, auditoriaAutor: 'AUTOMACAO|||regua' },
    })
    registros += criado.count
  }
  return { reguaRegistros: registros }
}

const dia = (d: Date) => d.toISOString().slice(0, 10)
// Hoje em Brasília (UTC−3), na convenção da Agenda (meia-noite UTC do dia).
function hojeBrt(agora: Date): Date {
  const b = new Date(agora.getTime() - 3 * HORA)
  return new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()))
}

/**
 * Ocorrências do dia das rotinas da Agenda: uma ATV pendente por pessoa
 * alvo. Não mexe na rotina (o modelo continua editável como hoje); quando
 * a pessoa marca "feito", o gatilho da conclusão grava a execução na mesma ATV.
 */
export async function gerarOcorrenciasDeRotina(agora = new Date()) {
  const hoje = hojeBrt(agora)
  const semana = hoje.getUTCDay()
  const itens = await prisma.agendaItem.findMany({ where: { ativo: true } })
  const equipes = new Map<string, string[]>()
  let criadas = 0
  for (const it of itens) {
    if (it.tipo === 'UNICO') {
      if (!it.data || dia(it.data) !== dia(hoje)) continue
    } else {
      if (!(it.diasSemana ?? '').split(',').map(Number).includes(semana)) continue
      if (it.dataInicio && dia(it.dataInicio) > dia(hoje)) continue
      if (it.dataFim && dia(it.dataFim) < dia(hoje)) continue
    }
    const alvos = (it.vendedorIds ?? '').split(',').filter(Boolean)
    let pessoas = [...alvos, ...(it.incluiDono ? [it.usuarioId] : [])]
    if (!pessoas.length) {
      // Sem alvo = toda a equipe (cada pessoa com a sua ocorrência), mais o dono.
      if (!equipes.has(it.usuarioId)) {
        const vs = await prisma.vendedor.findMany({ where: { usuarioId: it.usuarioId, ativo: true, senhaHash: { not: null } }, select: { id: true } })
        equipes.set(it.usuarioId, [...vs.map(v => v.id), it.usuarioId])
      }
      pessoas = equipes.get(it.usuarioId)!
    }
    const [hh, mm] = (it.horario ?? '23:59').split(':').map(Number)
    const prazo = new Date(hoje.getTime() + (hh * 60 + mm) * MIN + 3 * HORA)
    const r = await prisma.atividade.createMany({
      data: pessoas.map(p => ({
        usuarioId: it.usuarioId, auditoriaAutor: 'AUTOMACAO|||rotina', tipo: 'ROTINA', origemTipo: 'ROTINA', origemId: it.id,
        responsavelId: p, prazo, oQueFazer: it.titulo, modeloTipo: 'ROTINA', modeloId: it.id, exigeLocalizacao: it.exigeLocalizacao,
        registroTabela: 'pro_labore_agenda_conclusoes', registroId: `${it.id}|${p}|${dia(hoje)}`,
      })),
      skipDuplicates: true,
    })
    criadas += r.count
  }
  return { ocorrenciasRotina: criadas }
}

/**
 * Conferência da migração (seção 9): total por tipo nas tabelas atuais e na
 * ATV. Só conta na ATV o que ainda existe na tela atual; o que foi apagado lá
 * depois da cópia continua na ATV (cancelado) e aparece à parte.
 */
export async function conferenciaDaMigracao(usuarioId: string) {
  const linhas = await prisma.$queryRaw<{ t: string; atual: bigint; atv: bigint; apagadas: bigint; sem_data: bigint; sem_autor: bigint }[]>`
    WITH base AS (
      SELECT 'Follows'::text t, (SELECT count(*) FROM pro_labore_lead_follows WHERE "usuarioId" = ${usuarioId}) atual, 'pro_labore_lead_follows'::text tab
      UNION ALL SELECT 'Ligações', (SELECT count(*) FROM pro_labore_ligacoes WHERE "usuarioId" = ${usuarioId}), 'pro_labore_ligacoes'
      UNION ALL SELECT 'Rotinas feitas', (SELECT count(*) FROM pro_labore_agenda_conclusoes c JOIN pro_labore_agenda_itens i ON i.id = c."agendaItemId" WHERE i."usuarioId" = ${usuarioId}), 'pro_labore_agenda_conclusoes'
      UNION ALL SELECT 'Follows do robô', (SELECT count(*) FROM pro_labore_assistente_mensagens m JOIN pro_labore_assistente_conversas cv ON cv.id = m."conversaId" JOIN pro_labore_assistente_comercial a ON a.id = cv."assistenteId" JOIN pro_labore_vendedores v ON v.id = a."vendedorId" WHERE m.origem = 'FOLLOW' AND cv."leadId" IS NOT NULL AND v."usuarioId" = ${usuarioId}), 'pro_labore_assistente_mensagens'
    ), atvs AS (
      SELECT a.*, CASE a."registroTabela"
        WHEN 'pro_labore_lead_follows' THEN EXISTS (SELECT 1 FROM pro_labore_lead_follows x WHERE x.id = a."registroId")
        WHEN 'pro_labore_ligacoes' THEN EXISTS (SELECT 1 FROM pro_labore_ligacoes x WHERE x.id = a."registroId")
        WHEN 'pro_labore_assistente_mensagens' THEN EXISTS (SELECT 1 FROM pro_labore_assistente_mensagens x WHERE x.id = a."registroId")
        ELSE a.status <> 'EXECUTADA' OR EXISTS (SELECT 1 FROM pro_labore_agenda_conclusoes x WHERE x."agendaItemId" || '|' || x."autorId" || '|' || to_char(x."dataReferencia", 'YYYY-MM-DD') = a."registroId") END existe
      FROM pro_labore_atividades a WHERE a."usuarioId" = ${usuarioId}
    )
    SELECT b.t, b.atual,
      count(a.id) FILTER (WHERE a.existe AND (a."registroTabela" <> 'pro_labore_agenda_conclusoes' OR a.status = 'EXECUTADA')) atv,
      count(a.id) FILTER (WHERE NOT a.existe) apagadas,
      count(a.id) FILTER (WHERE a.existe AND (a."criadoEm" IS NULL OR a.prazo IS NULL)) sem_data,
      count(a.id) FILTER (WHERE a.existe AND a.status = 'EXECUTADA' AND a."autorExecucao" IS NULL) sem_autor
    FROM base b LEFT JOIN atvs a ON a."registroTabela" = b.tab
    GROUP BY b.t, b.atual ORDER BY b.t`
  return linhas.map(l => ({
    tipo: l.t, atual: Number(l.atual), atv: Number(l.atv), bate: Number(l.atual) === Number(l.atv),
    apagadasDepois: Number(l.apagadas), semData: Number(l.sem_data), semAutor: Number(l.sem_autor), semResultado: 0,
  }))
}
