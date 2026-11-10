// PDF 05 · Onda 4 — detectores de Reativação, Marketing, Gestão e Pessoas.
// Mesmo motor do PDF 03 (regras e estatística no código, sem IA, nível 1,
// volume mínimo, sem dados suspeitos nem cliente bloqueado). Cada área é ligada
// pelo dono, uma por vez, e passa pela semana em modo silencioso.
// Os de Gestão rodam só no código: nenhum valor em R$ vai para a IA.
import { prisma } from './prisma'
import { calcular, hojeBrt, mesCorrente, type Escopo, type Periodo } from './metricas'
import { NOME_ETAPA, type Etapa } from './etapasJornada'
import { fluxoDa, lerConfigFollow } from './assistenteFollow'
import type { Achado, ConfigDetector, DefDetector, Forca } from './detectores'

export type GrupoArea = 'REATIVACAO' | 'MARKETING' | 'GESTAO' | 'PESSOAS'
export const GRUPOS: GrupoArea[] = ['REATIVACAO', 'MARKETING', 'GESTAO', 'PESSOAS']
export const NOME_GRUPO: Record<GrupoArea, string> = { REATIVACAO: 'Reativação', MARKETING: 'Marketing', GESTAO: 'Gestão', PESSOAS: 'Pessoas' }
export const RESPONSAVEL_GRUPO: Record<GrupoArea, string> = { REATIVACAO: 'Supervisor', MARKETING: 'Gestor de tráfego', GESTAO: 'Financeiro', PESSOAS: 'Supervisor' }

const D = (chave: string, nome: string, grupo: GrupoArea, area: DefDetector['area'], dispara: string, acao: string, metricas: string[], roteamento: string, volumePadrao: number): DefDetector =>
  ({ chave, nome, area, dispara, acao, metricas, roteamento, frequencia: 'DIARIA', grupo, volumePadrao })

export const DETECTORES_ONDA4: DefDetector[] = [
  // 4.1 Reativação
  D('prioridade_esquecida', 'Prioridade alta esquecida', 'REATIVACAO', 'REATIVACAO', 'Cliente de prioridade alta (chegou a SQL ou está quente) sem atividade programada', 'Agendar a abordagem', ['taxa_recuperacao'], 'Responsável pela recuperação (supervisor acompanha)', 3),
  D('campanha_sem_resposta', 'Campanha sem resposta', 'REATIVACAO', 'REATIVACAO', 'A taxa de resposta de uma campanha (grupo de perda) fica bem abaixo das outras', 'Trocar o roteiro ou o momento do envio', ['taxa_recuperacao'], 'Supervisor (dono acompanha)', 10),
  D('roteiro_que_recupera', 'Roteiro que recupera', 'REATIVACAO', 'REATIVACAO', 'Um roteiro (passo do resgate) recupera clientes bem acima da média', 'Promover a roteiro-base, com aprovação da gestão', ['taxa_recuperacao'], 'Supervisor e dono', 10),
  D('limite_chegando', 'Limite chegando', 'REATIVACAO', 'REATIVACAO', 'Cliente no último passo do resgate sem ter respondido', 'Última tentativa com outro canal ou abordagem', ['taxa_recuperacao'], 'Responsável pela recuperação', 3),
  D('recuperacao_caindo', 'Recuperação caindo', 'REATIVACAO', 'REATIVACAO', 'A taxa de recuperação da Reativação cai contra o mesmo intervalo anterior', 'Revisar campanhas e distribuição', ['taxa_recuperacao'], 'Supervisor (dono acompanha)', 10),
  // 4.2 Marketing
  D('criativo_cansado', 'Criativo cansado', 'MARKETING', 'MARKETING', 'A frequência de um anúncio sobe enquanto a taxa de cliques cai, contra o mesmo intervalo anterior', 'Trocar ou renovar o criativo', ['frequencia_anuncio', 'ctr_anuncio'], 'Gestor de tráfego', 10),
  D('campanha_lead_fraco', 'Campanha com lead fraco', 'MARKETING', 'MARKETING', 'Os leads de uma campanha avançam no funil bem menos que a média das outras', 'Revisar público e mensagem, ou mover verba', ['avanco_por_campanha'], 'Gestor de tráfego', 10),
  D('orcamento_fora_ritmo', 'Orçamento fora do ritmo', 'MARKETING', 'MARKETING', 'O gasto do mês está adiantado ou atrasado em relação ao planejado', 'Ajustar o ritmo de investimento', ['gasto_anuncio'], 'Gestor de tráfego', 5),
  D('conteudo_abaixo', 'Conteúdo abaixo do planejado', 'MARKETING', 'MARKETING', 'Os posts da semana ficam abaixo do calendário aprovado', 'Reorganizar a produção da semana', ['posts_publicados'], 'Social media (gestor de tráfego acompanha)', 3),
  D('post_que_vende', 'Post que vende', 'MARKETING', 'MARKETING', 'Um post gera leads e vendas bem acima da média da conta', 'Repetir o formato ou impulsionar com verba', ['leads_dos_posts', 'vendas_por_post'], 'Social media e gestor de tráfego', 5),
  // 4.3 Gestão (só no código)
  D('venda_parada_confirmacao', 'Venda parada na confirmação', 'GESTAO', 'GESTAO', 'Venda fechada no CRM há mais tempo que o normal sem confirmação do dono', 'Confirmar ou corrigir a venda', ['decisoes_aguardando'], 'Dono', 1),
  D('pagamento_atrasado', 'Pagamento atrasado', 'GESTAO', 'GESTAO', 'Comissões ou pró-labore de vendas confirmadas sem pagamento além do prazo habitual', 'Aprovar e registrar o pagamento', ['comissoes_a_pagar'], 'Dono e financeiro', 1),
  D('conta_nao_fecha', 'Conta que não fecha', 'GESTAO', 'GESTAO', 'Vendas e Financeiro não batem no mês, ou valor fora dos tetos (pagamento sem comprovante: ponto de extensão)', 'Conferir e corrigir o lançamento', ['divergencias_vendas_financeiro'], 'Financeiro (dono acompanha)', 1),
  D('saida_fora_padrao', 'Saída fora do padrão', 'GESTAO', 'GESTAO', 'Saídas fora das vendas bem acima do histórico do mês', 'Revisar os lançamentos do mês', ['saidas_financeiro'], 'Dono e financeiro', 3),
  D('pilar_travando', 'Pilar travando', 'GESTAO', 'GESTAO', 'Um pilar do Plano de Crescimento cai de estágio ou fica parado por 3 meses', 'Atacar a ação de maior impacto nesse pilar', [], 'Dono', 1),
  // 4.4 Pessoas
  D('queda_ritmo', 'Queda de ritmo', 'PESSOAS', 'PESSOAS', 'Uma pessoa fica abaixo do próprio padrão de atividades feitas por 5 dias úteis seguidos', 'Conversa individual (1:1) e ajuste de rotina', ['atividades_feitas'], 'A pessoa, como orientação (supervisor acompanha)', 5),
  D('rotina_nao_cumprida', 'Rotina não cumprida', 'PESSOAS', 'PESSOAS', 'A aderência fica em Atenção ou Crítico, pelos limites da Agenda', 'Rever a rotina ou cobrar o combinado', ['aderencia_agenda'], 'A pessoa (supervisor acompanha)', 5),
  D('ponto_fraco', 'Ponto fraco recorrente', 'PESSOAS', 'PESSOAS', 'A conversão de uma pessoa numa etapa fica bem abaixo da média da equipe', 'Treino específico em Desenvolvimento', ['conversao_por_etapa'], 'A pessoa, com o treino sugerido (supervisor acompanha)', 10),
  D('ocorrencia_repetida', 'Ocorrência repetida', 'PESSOAS', 'PESSOAS', 'A mesma pessoa tem 2 ou mais ocorrências do mesmo tipo em 90 dias', 'Plano de correção', [], 'Só o supervisor e o dono', 2),
  D('boa_pratica', 'Boa prática', 'PESSOAS', 'PESSOAS', 'Uma pessoa se destaca de forma consistente (30% melhor que a equipe em dois períodos seguidos)', 'Transformar em aprendizado para a equipe', ['tempo_primeira_resposta', 'conversao_lead_venda'], 'Supervisor, que decide compartilhar', 10),
]

// --- Configuração das áreas (ligada/desligada e modo silencioso; só o dono muda) ---

export interface ConfigArea { ligada: boolean; modo: 'SILENCIOSO' | 'NORMAL'; ligadaEm: string | null; liberadaEm: string | null }
export async function configAreas(usuarioId: string): Promise<Record<GrupoArea, ConfigArea>> {
  const p = await prisma.parametroLiquidez.findUnique({ where: { usuarioId }, select: { areasDetectores: true } })
  const salvo = (p?.areasDetectores ?? {}) as Partial<Record<GrupoArea, Partial<ConfigArea>>>
  return Object.fromEntries(GRUPOS.map(g => [g, { ligada: !!salvo[g]?.ligada, modo: salvo[g]?.modo === 'NORMAL' ? 'NORMAL' : 'SILENCIOSO', ligadaEm: salvo[g]?.ligadaEm ?? null, liberadaEm: salvo[g]?.liberadaEm ?? null }])) as Record<GrupoArea, ConfigArea>
}
export const grupoDoDetector = (chave: string): GrupoArea | null => (DETECTORES_ONDA4.find(d => d.chave === chave)?.grupo as GrupoArea | undefined) ?? null

// --- Pessoas de cada papel (roteamento) ---

export async function papeisDaConta(usuarioId: string) {
  const [vs, sm] = await Promise.all([
    prisma.vendedor.findMany({ where: { usuarioId, ativo: true }, select: { id: true, nome: true, papel: true, funcao: true, vende: true, email: true }, orderBy: { criadoEm: 'asc' } }),
    prisma.smMembro.findFirst({ where: { usuarioId }, select: { id: true } }).catch(() => null),
  ])
  return {
    supervisor: vs.find(v => v.papel === 'SUPERVISOR' && !v.funcao && v.vende)?.id ?? null,
    trafego: vs.find(v => v.funcao === 'GESTOR_TRAFEGO' && v.email)?.id ?? null,
    financeiro: vs.find(v => v.funcao === 'FINANCEIRO' && v.email)?.id ?? null,
    socialMedia: sm?.id ?? null,
    equipe: vs.filter(v => v.vende && !v.funcao),
  }
}
export async function responsavelDaArea(usuarioId: string, g: GrupoArea): Promise<string | null> {
  const p = await papeisDaConta(usuarioId)
  return g === 'MARKETING' ? p.trafego : g === 'GESTAO' ? p.financeiro : p.supervisor
}

// --- Utilidades ---
const DIA = 86_400_000
const r1 = (n: number) => Math.round(n * 10) / 10
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null)
const num = (x: unknown) => (x == null ? 0 : Number(x))
const primeiro = (n: string | null | undefined) => { const p = (n ?? '').trim().split(/\s+/)[0] ?? ''; return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() }
const dia = (d: Date) => d.toISOString().slice(0, 10)
const periodoDias = (agora: Date, dias: number, fimOffset = 1): Periodo => {
  const h = new Date(`${hojeBrt(agora)}T00:00:00Z`).getTime()
  return { inicio: dia(new Date(h - (dias + fimOffset - 1) * DIA)), fim: dia(new Date(h - fimOffset * DIA)) }
}
const forca = (casos: number, vol: number, persistente: boolean, forte: boolean): Forca => (casos >= 30 && persistente ? 'COMPROVADA' : casos >= vol && (forte || persistente) ? 'PADRAO' : 'HIPOTESE')
type Ctx = { usuarioId: string; cfg: ConfigDetector; agora: Date; papeis: Awaited<ReturnType<typeof papeisDaConta>> }
const ev = (chave: string, nome: string, valor: number | null, anterior: number | null, periodo: Periodo, periodoAnterior: Periodo | null, amostra: number, unidade: string, detalhe?: unknown) =>
  ({ chave, nome, valor, anterior, periodo, periodoAnterior, amostra, unidade, detalhe })
const bloqueados = async (usuarioId: string) => new Set((await prisma.lead.findMany({ where: { usuarioId, cliente: { is: { bloqueado: true } } }, select: { id: true } })).map(l => l.id))
const destino = (destinatarioId: string | null, acompanha: Array<string | null>) => ({ destinatarioId, acompanha: acompanha.filter((x): x is string => !!x) })

// ============================================================================
// 4.1 Reativação
// ============================================================================

const ETAPAS_ALTAS = ['SQL', 'NEGOCIACAO', 'PROPOSTA', 'AGENDAMENTO', 'VISITA']
/** Perdidos na Reativação (sem encerrados, descartados e bloqueados), com o responsável pela recuperação. */
async function perdidosNaReativacao(usuarioId: string) {
  const leads = await prisma.lead.findMany({
    where: { usuarioId, estagio: 'PERDIDO', NOT: { cliente: { is: { bloqueado: true } } }, OR: [{ destinoPerda: null }, { destinoPerda: { notIn: ['ENCERRADA', 'DESCARTADA'] } }] },
    select: { id: true, nomeCliente: true, vendedorId: true, responsavelQualificacaoId: true, temperatura: true, destinoPerda: true, perdidoEm: true, historico: { select: { estagioNovo: true } } },
  })
  return leads.map(l => ({ ...l, responsavel: l.vendedorId ?? l.responsavelQualificacaoId, alta: l.temperatura === 'QUENTE' || l.historico.some(h => ETAPAS_ALTAS.includes(h.estagioNovo)) }))
}

async function prioridadeEsquecida(c: Ctx): Promise<Achado[]> {
  const perdidos = (await perdidosNaReativacao(c.usuarioId)).filter(l => l.alta && l.responsavel)
  if (!perdidos.length) return []
  const comAtv = new Set((await prisma.atividade.findMany({ where: { usuarioId: c.usuarioId, status: 'PENDENTE', leadId: { in: perdidos.map(l => l.id) } }, select: { leadId: true } })).map(a => a.leadId))
  const esquecidos = perdidos.filter(l => !comAtv.has(l.id))
  const porResp = new Map<string, typeof esquecidos>()
  for (const l of esquecidos) porResp.set(l.responsavel!, [...(porResp.get(l.responsavel!) ?? []), l])
  const nomes = new Map(c.papeis.equipe.map(v => [v.id, v.nome]))
  const out: Achado[] = []
  for (const [resp, ls] of porResp) {
    if (ls.length < c.cfg.volumeMinimo) continue
    const p = periodoDias(c.agora, 1, 0)
    out.push({
      detector: 'prioridade_esquecida', area: 'REATIVACAO', tipo: 'PROBLEMA', grupo: 'REATIVACAO',
      titulo: `${ls.length} clientes de prioridade alta sem abordagem programada (${primeiro(nomes.get(resp))})`,
      acaoSugerida: 'Agendar a abordagem de cada um (follow ou ligação), começando pelos que chegaram mais longe na jornada',
      orientacao: `Você tem ${ls.length} clientes que já chegaram perto de comprar e estão sem próximo passo. Um contato agendado hoje aumenta a chance de recuperar.`,
      alvoTipo: 'PESSOA', alvoId: resp, alvoNome: nomes.get(resp) ?? null,
      evidencia: { metricas: [ev('taxa_recuperacao', 'Clientes de prioridade alta sem atividade', ls.length, null, p, null, ls.length, 'QTD', { clientes: ls.slice(0, 20).map(l => ({ id: l.id, nome: primeiro(l.nomeCliente), grupo: l.destinoPerda })) })], casos: ls.length, volumeMinimo: c.cfg.volumeMinimo, resumo: `${ls.length} de prioridade alta sem atividade`, registros: { tabela: 'pro_labore_leads', ids: ls.map(l => l.id) } },
      forca: forca(ls.length, c.cfg.volumeMinimo, false, ls.length >= 2 * c.cfg.volumeMinimo), impacto: { unidade: 'LEADS', valor: ls.length, texto: `${ls.length} clientes de prioridade alta para retomar (estimativa)` },
      destino: destino(resp, [c.papeis.supervisor]),
    })
  }
  return out
}

/** Resgate: conversas de perdidos que receberam mensagens do fluxo de resgate, com o passo e se responderam/voltaram. */
async function envioDoResgate(usuarioId: string, desde: Date, ate: Date) {
  return prisma.$queryRaw<Array<{ leadId: string; destino: string | null; passo: number; enviadaEm: Date; respondeu: boolean; voltou: boolean }>>`
    WITH f AS (
      SELECT m.id, m."conversaId", m."criadoEm", cv."leadId", row_number() OVER (PARTITION BY m."conversaId" ORDER BY m."criadoEm") passo,
             lead(m."criadoEm") OVER (PARTITION BY m."conversaId" ORDER BY m."criadoEm") proxima
      FROM pro_labore_assistente_mensagens m JOIN pro_labore_assistente_conversas cv ON cv.id = m."conversaId"
      JOIN pro_labore_assistente_comercial a ON a.id = cv."assistenteId" JOIN pro_labore_vendedores v ON v.id = a."vendedorId"
      WHERE v."usuarioId" = ${usuarioId} AND m.origem = 'FOLLOW' AND m."followFluxo" = 'REATIVACAO' AND cv."leadId" IS NOT NULL
    )
    SELECT f."leadId", l."destinoPerda" destino, f.passo::int passo, f."criadoEm" "enviadaEm",
      EXISTS (SELECT 1 FROM pro_labore_assistente_mensagens r WHERE r."conversaId" = f."conversaId" AND r.remetente = 'CONTATO' AND r."criadoEm" > f."criadoEm" AND (f.proxima IS NULL OR r."criadoEm" < f.proxima)) respondeu,
      (l."reativadoEm" IS NOT NULL AND l."reativadoEm" > f."criadoEm" AND (f.proxima IS NULL OR l."reativadoEm" < f.proxima)) voltou
    FROM f JOIN pro_labore_leads l ON l.id = f."leadId"
    LEFT JOIN pro_labore_clientes cl ON cl.id = l."clienteId"
    WHERE f."criadoEm" >= ${desde} AND f."criadoEm" < ${ate} AND coalesce(cl.bloqueado, false) = false`
}
/** Passos do fluxo de resgate da loja (os roteiros da Reativação). */
async function passosDoResgate(usuarioId: string) {
  const loja = await prisma.assistenteLoja.findUnique({ where: { usuarioId }, select: { followConfig: true } })
  return fluxoDa(lerConfigFollow(loja?.followConfig), 'REATIVACAO').passos
}
const NOME_CAMPANHA: Record<string, string> = { REATIVACAO_SEM_RESPOSTA: 'Sem resposta', REATIVACAO_INTERESSE: 'Interesse não convertido', REATIVACAO_NEGOCIACAO: 'Negociação interrompida', REATIVACAO_RETOMADA: 'Oportunidade de retomada', REATIVACAO_OUTRO: 'Outro (anterior à migração)' }

async function campanhaSemResposta(c: Ctx): Promise<Achado[]> {
  const p = periodoDias(c.agora, 60)
  const envios = (await envioDoResgate(c.usuarioId, new Date(`${p.inicio}T03:00:00Z`), new Date(new Date(`${p.fim}T03:00:00Z`).getTime() + DIA))).filter(e => e.passo === 1)
  const grupos = new Map<string, { n: number; r: number }>()
  for (const e of envios) { const g = e.destino ?? 'REATIVACAO_OUTRO'; const x = grupos.get(g) ?? { n: 0, r: 0 }; x.n++; if (e.respondeu) x.r++; grupos.set(g, x) }
  const out: Achado[] = []
  for (const [g, x] of grupos) {
    if (x.n < c.cfg.volumeMinimo) continue
    const outros = [...grupos].filter(([k]) => k !== g).reduce((s, [, y]) => ({ n: s.n + y.n, r: s.r + y.r }), { n: 0, r: 0 })
    if (outros.n < c.cfg.volumeMinimo) continue
    const taxa = x.r / x.n, media = outros.r / outros.n
    if (media <= 0 || taxa > media * 0.7) continue
    out.push({
      detector: 'campanha_sem_resposta', area: 'REATIVACAO', tipo: 'PROBLEMA', grupo: 'REATIVACAO',
      titulo: `Campanha "${NOME_CAMPANHA[g] ?? g}" responde bem menos que as outras`,
      acaoSugerida: 'Trocar o roteiro ou o momento do envio desta campanha', alvoTipo: 'CAMPANHA', alvoId: g, contextoExtra: g,
      evidencia: { metricas: [ev('taxa_recuperacao', 'Taxa de resposta do resgate', pct(x.r, x.n), pct(outros.r, outros.n), p, null, x.n, 'PCT', { campanha: g, enviados: x.n, responderam: x.r, mediaOutras: pct(outros.r, outros.n) })], casos: x.n, volumeMinimo: c.cfg.volumeMinimo, resumo: `${pct(x.r, x.n)}% contra ${pct(outros.r, outros.n)}% das outras` },
      forca: forca(x.n, c.cfg.volumeMinimo, false, taxa <= media * 0.5), impacto: { unidade: 'LEADS', valor: Math.round((media - taxa) * x.n), texto: `${Math.round((media - taxa) * x.n)} respostas a mais se igualasse a média (estimativa)` },
      destino: destino(c.papeis.supervisor, [c.usuarioId]),
    })
  }
  return out
}

async function roteiroQueRecupera(c: Ctx): Promise<Achado[]> {
  const p = periodoDias(c.agora, 90)
  const envios = await envioDoResgate(c.usuarioId, new Date(`${p.inicio}T03:00:00Z`), new Date(new Date(`${p.fim}T03:00:00Z`).getTime() + DIA))
  const porPasso = new Map<number, { n: number; v: number }>()
  for (const e of envios) { const x = porPasso.get(e.passo) ?? { n: 0, v: 0 }; x.n++; if (e.voltou || e.respondeu) x.v++; porPasso.set(e.passo, x) }
  const total = [...porPasso.values()].reduce((s, x) => ({ n: s.n + x.n, v: s.v + x.v }), { n: 0, v: 0 })
  if (total.n < c.cfg.volumeMinimo) return []
  const media = total.v / total.n
  const passos = await passosDoResgate(c.usuarioId)
  const out: Achado[] = []
  for (const [passo, x] of porPasso) {
    if (x.n < c.cfg.volumeMinimo || media <= 0 || x.v / x.n < media * 1.3) continue
    const texto = passos[passo - 1]?.texto ?? null
    out.push({
      detector: 'roteiro_que_recupera', area: 'REATIVACAO', tipo: 'FUNCIONANDO', grupo: 'REATIVACAO',
      titulo: `O roteiro do passo ${passo} do resgate recupera bem acima da média`,
      acaoSugerida: `Promover a roteiro-base (só depois da aprovação da gestão): ${texto ? `"${texto.slice(0, 140)}"` : `passo ${passo} do fluxo de resgate`}`,
      alvoTipo: 'ROTEIRO', alvoId: `REATIVACAO|${passo}`, contextoExtra: `passo${passo}`,
      evidencia: { metricas: [ev('taxa_recuperacao', 'Resposta ou recuperação depois do roteiro', pct(x.v, x.n), pct(total.v, total.n), p, null, x.n, 'PCT', { passo, enviados: x.n, recuperou: x.v, media: pct(total.v, total.n), texto })], casos: x.n, volumeMinimo: c.cfg.volumeMinimo, resumo: `${pct(x.v, x.n)}% contra ${pct(total.v, total.n)}% da média` },
      forca: forca(x.n, c.cfg.volumeMinimo, false, x.v / x.n >= media * 1.6), impacto: { unidade: 'LEADS', valor: Math.round((x.v / x.n - media) * total.n), texto: 'Mais clientes recuperados se virar a base (estimativa)' },
      destino: destino(c.papeis.supervisor, [c.usuarioId]),
    })
  }
  return out
}

async function limiteChegando(c: Ctx): Promise<Achado[]> {
  const ultimo = (await passosDoResgate(c.usuarioId)).length
  const perdidos = await perdidosNaReativacao(c.usuarioId)
  const ids = perdidos.map(l => l.id)
  if (!ids.length) return []
  const convs = await prisma.assistenteConversa.findMany({ where: { leadId: { in: ids }, followFluxo: 'REATIVACAO', followPasso: ultimo }, select: { id: true, leadId: true, followUltimoEm: true } })
  const semResposta: typeof perdidos = []
  for (const cv of convs) {
    const resp = await prisma.assistenteMensagem.count({ where: { conversaId: cv.id, remetente: 'CONTATO', criadoEm: { gte: cv.followUltimoEm ?? new Date(0) } } })
    if (!resp) { const l = perdidos.find(x => x.id === cv.leadId); if (l?.responsavel) semResposta.push(l) }
  }
  const porResp = new Map<string, typeof semResposta>()
  for (const l of semResposta) porResp.set(l.responsavel!, [...(porResp.get(l.responsavel!) ?? []), l])
  const nomes = new Map(c.papeis.equipe.map(v => [v.id, v.nome]))
  const out: Achado[] = []
  for (const [resp, ls] of porResp) {
    if (ls.length < c.cfg.volumeMinimo) continue
    out.push({
      detector: 'limite_chegando', area: 'REATIVACAO', tipo: 'PROBLEMA', grupo: 'REATIVACAO',
      titulo: `${ls.length} clientes na última tentativa do resgate sem responder (${primeiro(nomes.get(resp))})`,
      acaoSugerida: 'Fazer a última tentativa por outro canal (ligação ou áudio) ou com outra abordagem',
      orientacao: `Estes ${ls.length} clientes estão na última mensagem do resgate e ainda não responderam. Uma ligação ou um áudio pessoal costuma funcionar melhor que mais uma mensagem.`,
      alvoTipo: 'PESSOA', alvoId: resp, alvoNome: nomes.get(resp) ?? null, contextoExtra: 'limite',
      evidencia: { metricas: [ev('taxa_recuperacao', 'Clientes no último passo sem resposta', ls.length, null, periodoDias(c.agora, 1, 0), null, ls.length, 'QTD', { passos: ultimo, clientes: ls.slice(0, 20).map(l => ({ id: l.id, nome: primeiro(l.nomeCliente) })) })], casos: ls.length, volumeMinimo: c.cfg.volumeMinimo, resumo: `${ls.length} no último passo`, registros: { tabela: 'pro_labore_leads', ids: ls.map(l => l.id) } },
      forca: 'HIPOTESE', impacto: { unidade: 'LEADS', valor: ls.length, texto: `${ls.length} clientes antes do fim do resgate (estimativa)` },
      destino: destino(resp, []),
    })
  }
  return out
}

async function recuperacaoCaindo(c: Ctx): Promise<Achado[]> {
  const atual = periodoDias(c.agora, 14), ant = periodoDias(c.agora, 14, 15)
  const e: Escopo = { usuarioId: c.usuarioId, papel: 'DONO', semSuspeitos: true }
  const [a, b] = await Promise.all([calcular('taxa_recuperacao', e, atual, c.agora), calcular('taxa_recuperacao', e, ant, c.agora)])
  const casos = a.amostra ?? 0
  if (casos < c.cfg.volumeMinimo || a.valor == null || !b.valor || a.valor >= b.valor * (1 - c.cfg.limite)) return []
  return [{
    detector: 'recuperacao_caindo', area: 'REATIVACAO', tipo: 'PROBLEMA', grupo: 'REATIVACAO',
    titulo: 'A taxa de recuperação da Reativação caiu', acaoSugerida: 'Revisar as campanhas e a distribuição dos perdidos', alvoTipo: 'EQUIPE', alvoId: null,
    evidencia: { metricas: [ev('taxa_recuperacao', 'Taxa de recuperação da Reativação', a.valor, b.valor, atual, ant, casos, 'PCT', a.detalhe)], casos, volumeMinimo: c.cfg.volumeMinimo, resumo: `${a.valor}% contra ${b.valor}% no intervalo anterior` },
    forca: forca(casos, c.cfg.volumeMinimo, false, a.valor <= b.valor * 0.5), impacto: { unidade: 'LEADS', valor: Math.round(((b.valor - a.valor) / 100) * casos), texto: 'Clientes a menos recuperados no período (estimativa)' },
    destino: destino(c.papeis.supervisor, [c.usuarioId]),
  }]
}

// ============================================================================
// 4.2 Marketing
// ============================================================================

async function criativoCansado(c: Ctx): Promise<Achado[]> {
  const atual = periodoDias(c.agora, 7), ant = periodoDias(c.agora, 7, 8)
  const e: Escopo = { usuarioId: c.usuarioId, papel: 'DONO' }
  const [fa, fb, ca, cb] = await Promise.all([calcular('frequencia_anuncio', e, atual, c.agora), calcular('frequencia_anuncio', e, ant, c.agora), calcular('ctr_anuncio', e, atual, c.agora), calcular('ctr_anuncio', e, ant, c.agora)])
  type L = { adId: string; adNome: string | null; frequencia?: number | null; ctr?: number | null; cliques?: number; impressoes: number }
  const fA = fa.detalhe as L[], fB = fb.detalhe as L[], cA = ca.detalhe as L[], cB = cb.detalhe as L[]
  const out: Achado[] = []
  for (const x of cA) {
    const y = cB.find(z => z.adId === x.adId), fx = fA.find(z => z.adId === x.adId), fy = fB.find(z => z.adId === x.adId)
    if (!y || !fx || !fy || (x.cliques ?? 0) + (y.cliques ?? 0) < c.cfg.volumeMinimo) continue
    if (!fx.frequencia || !fy.frequencia || x.ctr == null || !y.ctr) continue
    if (fx.frequencia <= fy.frequencia * (1 + c.cfg.limite) || x.ctr >= y.ctr * (1 - c.cfg.limite)) continue
    out.push({
      detector: 'criativo_cansado', area: 'MARKETING', tipo: 'PROBLEMA', grupo: 'MARKETING',
      titulo: `Criativo cansado: "${(x.adNome ?? x.adId).slice(0, 60)}"`, acaoSugerida: 'Trocar ou renovar o criativo', alvoTipo: 'ANUNCIO', alvoId: x.adId,
      evidencia: { metricas: [ev('frequencia_anuncio', 'Frequência do anúncio', fx.frequencia, fy.frequencia, atual, ant, x.impressoes, 'X'), ev('ctr_anuncio', 'Taxa de cliques do anúncio', x.ctr, y.ctr, atual, ant, x.impressoes, 'PCT')], casos: (x.cliques ?? 0) + (y.cliques ?? 0), volumeMinimo: c.cfg.volumeMinimo, resumo: `frequência ${fy.frequencia}→${fx.frequencia}, cliques ${y.ctr}%→${x.ctr}%` },
      forca: forca((x.cliques ?? 0) + (y.cliques ?? 0), c.cfg.volumeMinimo, false, x.ctr <= y.ctr * 0.6), impacto: { unidade: 'LEADS', valor: 0, texto: 'Menos cliques pelo mesmo gasto (estimativa)' },
      destino: destino(c.papeis.trafego ?? c.usuarioId, []),
    })
  }
  return out
}

async function campanhaLeadFraco(c: Ctx): Promise<Achado[]> {
  const p = periodoDias(c.agora, 30)
  const r = await calcular('avanco_por_campanha', { usuarioId: c.usuarioId, papel: 'DONO', semSuspeitos: true }, p, c.agora)
  const linhas = (r.detalhe as Array<{ campanha: string; leads: number; avancaram: number; avanco: number | null }>) ?? []
  const out: Achado[] = []
  for (const x of linhas) {
    if (x.leads < c.cfg.volumeMinimo) continue
    const outros = linhas.filter(y => y.campanha !== x.campanha).reduce((s, y) => ({ n: s.n + y.leads, a: s.a + y.avancaram }), { n: 0, a: 0 })
    if (outros.n < c.cfg.volumeMinimo || !outros.a) continue
    const media = outros.a / outros.n, taxa = x.avancaram / x.leads
    if (taxa > media * 0.7) continue
    out.push({
      detector: 'campanha_lead_fraco', area: 'MARKETING', tipo: 'PROBLEMA', grupo: 'MARKETING',
      titulo: `Campanha "${x.campanha.slice(0, 60)}" traz leads que avançam pouco`, acaoSugerida: 'Revisar público e mensagem, ou mover verba para as campanhas que avançam', alvoTipo: 'CAMPANHA', alvoId: x.campanha,
      evidencia: { metricas: [ev('avanco_por_campanha', 'Avanço dos leads da campanha', x.avanco, pct(outros.a, outros.n), p, null, x.leads, 'PCT', { campanha: x.campanha, leads: x.leads, avancaram: x.avancaram })], casos: x.leads, volumeMinimo: c.cfg.volumeMinimo, resumo: `${x.avanco}% contra ${pct(outros.a, outros.n)}% das outras` },
      forca: forca(x.leads, c.cfg.volumeMinimo, false, taxa <= media * 0.5), impacto: { unidade: 'LEADS', valor: Math.round((media - taxa) * x.leads), texto: `${Math.round((media - taxa) * x.leads)} leads a mais avançando se igualasse a média (estimativa)` },
      destino: destino(c.papeis.trafego ?? c.usuarioId, []),
    })
  }
  return out
}

async function orcamentoForaRitmo(c: Ctx): Promise<Achado[]> {
  const mes = mesCorrente(c.agora)
  const diasPassados = Number(mes.fim.slice(8, 10))
  if (diasPassados < c.cfg.volumeMinimo) return []
  const prm = await prisma.parametroLiquidez.findUnique({ where: { usuarioId: c.usuarioId }, select: { orcamentoAnuncioMensal: true } })
  const orc = prm?.orcamentoAnuncioMensal
  if (!orc) return []
  const g = await calcular('gasto_anuncio', { usuarioId: c.usuarioId, papel: 'DONO' }, mes, c.agora)
  const dm = new Date(Date.UTC(Number(mes.inicio.slice(0, 4)), Number(mes.inicio.slice(5, 7)), 0)).getUTCDate()
  const projecao = ((g.valor ?? 0) / diasPassados) * dm
  const desvio = projecao / orc - 1
  if (Math.abs(desvio) < c.cfg.limite) return []
  const adiantado = desvio > 0
  // Valores em R$ ficam na evidência (do dicionário, para a tela); o título fala só em %.
  return [{
    detector: 'orcamento_fora_ritmo', area: 'MARKETING', tipo: 'PROBLEMA', grupo: 'MARKETING', contextoExtra: adiantado ? 'adiantado' : 'atrasado',
    titulo: `O gasto com anúncios está ${adiantado ? 'adiantado' : 'atrasado'}: o mês fecha em ${Math.round((1 + desvio) * 100)}% do orçamento`,
    acaoSugerida: adiantado ? 'Reduzir o ritmo de investimento para caber no orçamento' : 'Acelerar o investimento ou rever o orçamento planejado', alvoTipo: 'ANUNCIOS', alvoId: null,
    evidencia: { metricas: [ev('gasto_anuncio', 'Gasto com anúncios', g.valor, null, mes, null, diasPassados, 'BRL', { orcamentoMensal: orc, projecao: Math.round(projecao) })], casos: diasPassados, volumeMinimo: c.cfg.volumeMinimo, resumo: `projeção de ${Math.round((1 + desvio) * 100)}% do orçamento` },
    forca: 'PADRAO', impacto: null,
    destino: destino(c.papeis.trafego ?? c.usuarioId, []),
  }]
}

async function conteudoAbaixo(c: Ctx): Promise<Achado[]> {
  // Semana fechada (segunda a domingo da semana passada).
  const h = new Date(`${hojeBrt(c.agora)}T00:00:00Z`), dow = (h.getUTCDay() + 6) % 7
  const p: Periodo = { inicio: dia(new Date(h.getTime() - (dow + 7) * DIA)), fim: dia(new Date(h.getTime() - (dow + 1) * DIA)) }
  const r = await calcular('posts_publicados', { usuarioId: c.usuarioId, papel: 'DONO' }, p, c.agora)
  const planejados = (r.detalhe as { planejados: number }).planejados, publicados = r.valor ?? 0
  if (planejados < c.cfg.volumeMinimo || publicados >= planejados * 0.8) return []
  const sm = c.papeis.socialMedia
  return [{
    detector: 'conteudo_abaixo', area: 'MARKETING', tipo: 'PROBLEMA', grupo: 'MARKETING', contextoExtra: p.inicio,
    titulo: `Semana com ${publicados} de ${planejados} posts do calendário publicados`, acaoSugerida: 'Reorganizar a produção da semana (o que atrasou e o que entra agora)', alvoTipo: 'CONTEUDO', alvoId: null,
    evidencia: { metricas: [ev('posts_publicados', 'Posts publicados', publicados, planejados, p, null, planejados, 'QTD', { planejados })], casos: planejados, volumeMinimo: c.cfg.volumeMinimo, resumo: `${publicados} de ${planejados} planejados` },
    forca: forca(planejados, c.cfg.volumeMinimo, false, publicados <= planejados * 0.5), impacto: null,
    destino: destino(sm ?? c.usuarioId, [c.papeis.trafego]),
  }]
}

async function postQueVende(c: Ctx): Promise<Achado[]> {
  const p = periodoDias(c.agora, 30)
  const ini = new Date(`${p.inicio}T03:00:00Z`), fim = new Date(new Date(`${p.fim}T03:00:00Z`).getTime() + DIA)
  const leads = await prisma.$queryRaw<Array<{ midia: string; leads: bigint; vendas: bigint }>>`
    SELECT coalesce(l."midiaId", l."postCode") midia, count(*) leads, count(*) FILTER (WHERE l."vendaId" IS NOT NULL) vendas
    FROM pro_labore_leads l WHERE l."usuarioId" = ${c.usuarioId} AND (l."midiaId" IS NOT NULL OR l."postCode" IS NOT NULL) AND l."criadoEm" >= ${ini} AND l."criadoEm" < ${fim}
    GROUP BY 1`
  const posts = await prisma.smPauta.count({ where: { usuarioId: c.usuarioId, publicadaEm: { gte: ini, lt: fim } } })
  const totalLeads = leads.reduce((s, x) => s + num(x.leads), 0)
  const base = Math.max(posts, leads.length)
  if (!base) return []
  const media = totalLeads / base
  const out: Achado[] = []
  for (const x of leads) {
    const n = num(x.leads), v = num(x.vendas)
    if (n < c.cfg.volumeMinimo || n < media * 1.3 || v < 1) continue
    const pauta = await prisma.smPauta.findFirst({ where: { usuarioId: c.usuarioId, OR: [{ igMediaId: x.midia }, { codigo: x.midia }] }, select: { titulo: true, formato: true } })
    out.push({
      detector: 'post_que_vende', area: 'MARKETING', tipo: 'FUNCIONANDO', grupo: 'MARKETING',
      titulo: `Post que vende: ${pauta?.titulo ? `"${pauta.titulo.slice(0, 60)}"` : `post ${x.midia.slice(0, 20)}`}`, acaoSugerida: `Repetir o formato${pauta?.formato ? ` (${pauta.formato.toLowerCase()})` : ''} ou impulsionar com verba`, alvoTipo: 'POST', alvoId: x.midia,
      evidencia: { metricas: [ev('leads_dos_posts', 'Leads gerados pelo post', n, r1(media), p, null, n, 'QTD', { vendas: v, mediaPorPost: r1(media) })], casos: n, volumeMinimo: c.cfg.volumeMinimo, resumo: `${n} leads e ${v} venda(s) contra ${r1(media)} leads por post` },
      forca: forca(n, c.cfg.volumeMinimo, false, n >= media * 2), impacto: { unidade: 'VENDAS', valor: v, texto: `${v} venda(s) no período (estimativa do potencial de repetir)` },
      destino: destino(c.papeis.socialMedia ?? c.usuarioId, [c.papeis.trafego]),
    })
  }
  return out
}

// ============================================================================
// 4.3 Gestão — só no código, valores em R$ nunca vão para a IA
// ============================================================================

const mediana = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), k = Math.floor(s.length / 2); return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2 }

async function vendaParadaConfirmacao(c: Ctx): Promise<Achado[]> {
  const conf = await prisma.venda.findMany({ where: { usuarioId: c.usuarioId, situacao: 'CONFIRMADA', confirmadaEm: { not: null }, criadoEm: { gte: new Date(c.agora.getTime() - 180 * DIA) } }, select: { criadoEm: true, confirmadaEm: true } })
  const normal = mediana(conf.map(v => (v.confirmadaEm!.getTime() - v.criadoEm.getTime()) / DIA))
  const limiteDias = Math.max(3, 2 * (normal ?? 0))
  const paradas = await prisma.venda.findMany({ where: { usuarioId: c.usuarioId, situacao: 'AGUARDANDO_CONFIRMACAO', criadoEm: { lt: new Date(c.agora.getTime() - limiteDias * DIA) } }, select: { id: true, criadoEm: true } })
  if (paradas.length < c.cfg.volumeMinimo) return []
  return [{
    detector: 'venda_parada_confirmacao', area: 'GESTAO', tipo: 'PROBLEMA', grupo: 'GESTAO',
    titulo: `${paradas.length} venda(s) aguardando a sua confirmação há mais de ${Math.round(limiteDias)} dias`, acaoSugerida: 'Confirmar ou corrigir cada venda em Vendas e pagamentos', alvoTipo: 'VENDA', alvoId: null,
    evidencia: { metricas: [ev('decisoes_aguardando', 'Vendas paradas na confirmação', paradas.length, null, periodoDias(c.agora, 1, 0), null, paradas.length, 'QTD', { normalDias: normal == null ? null : r1(normal), limiteDias: r1(limiteDias), maisAntigaDias: Math.round((c.agora.getTime() - Math.min(...paradas.map(v => v.criadoEm.getTime()))) / DIA) })], casos: paradas.length, volumeMinimo: c.cfg.volumeMinimo, resumo: `${paradas.length} além do normal`, registros: { tabela: 'pro_labore_vendas', ids: paradas.map(v => v.id) } },
    forca: 'COMPROVADA', impacto: { unidade: 'VENDAS', valor: paradas.length, texto: `${paradas.length} venda(s) sem confirmação (fora dos números do mês)` },
    destino: destino(c.usuarioId, []),
  }]
}

async function pagamentoAtrasado(c: Ctx): Promise<Achado[]> {
  const pagas = await prisma.venda.findMany({ where: { usuarioId: c.usuarioId, situacao: 'CONFIRMADA', confirmadaEm: { not: null }, pagamentoComissaoId: { not: null } }, select: { confirmadaEm: true, pagamentoComissao: { select: { pagoEm: true } } }, take: 500, orderBy: { confirmadaEm: 'desc' } })
  const habitual = mediana(pagas.filter(v => v.pagamentoComissao).map(v => (v.pagamentoComissao!.pagoEm.getTime() - v.confirmadaEm!.getTime()) / DIA))
  const prazo = Math.max(30, habitual ?? 0)
  const corte = new Date(c.agora.getTime() - prazo * DIA)
  const [com, pro] = await Promise.all([
    prisma.venda.findMany({ where: { usuarioId: c.usuarioId, situacao: 'CONFIRMADA', valorComissao: { gt: 0 }, pagamentoComissaoId: null, confirmadaEm: { lt: corte } }, select: { id: true } }),
    prisma.venda.findMany({ where: { usuarioId: c.usuarioId, situacao: 'CONFIRMADA', valorProLabore: { gt: 0 }, pagamentoProLaboreId: null, confirmadaEm: { lt: corte } }, select: { id: true } }),
  ])
  const ids = [...new Set([...com, ...pro].map(v => v.id))]
  if (ids.length < c.cfg.volumeMinimo) return []
  return [{
    detector: 'pagamento_atrasado', area: 'GESTAO', tipo: 'PROBLEMA', grupo: 'GESTAO',
    titulo: `${ids.length} venda(s) confirmada(s) com pagamento além do prazo habitual (${Math.round(prazo)} dias)`, acaoSugerida: 'Aprovar e registrar os pagamentos de comissão e pró-labore', alvoTipo: 'PAGAMENTO', alvoId: null,
    evidencia: { metricas: [ev('comissoes_a_pagar', 'Vendas com pagamento atrasado', ids.length, null, periodoDias(c.agora, 1, 0), null, ids.length, 'QTD', { comissao: com.length, proLabore: pro.length, prazoHabitualDias: Math.round(prazo) })], casos: ids.length, volumeMinimo: c.cfg.volumeMinimo, resumo: `${com.length} comissão(ões) e ${pro.length} pró-labore(s)`, registros: { tabela: 'pro_labore_vendas', ids } },
    forca: 'COMPROVADA', impacto: null,
    destino: destino(c.usuarioId, [c.papeis.financeiro]),
  }]
}

async function contaNaoFecha(c: Ctx): Promise<Achado[]> {
  const mes = mesCorrente(c.agora)
  const div = await calcular('divergencias_vendas_financeiro', { usuarioId: c.usuarioId, papel: 'DONO' }, mes, c.agora)
  const prm = await prisma.parametroLiquidez.findUnique({ where: { usuarioId: c.usuarioId }, select: { tetoComissaoPadrao: true, tetoProLaborePorVenda: true } })
  const vendas = await prisma.venda.findMany({ where: { usuarioId: c.usuarioId, situacao: 'CONFIRMADA', data: { gte: new Date(`${mes.inicio}T00:00:00Z`) } }, select: { id: true, valorComissao: true, valorProLabore: true, vendedor: { select: { tetoComissaoPorVenda: true } } } })
  const foraTeto = vendas.filter(v => (v.valorComissao ?? 0) > (v.vendedor?.tetoComissaoPorVenda ?? prm?.tetoComissaoPadrao ?? Infinity) + 0.01 || v.valorProLabore > (prm?.tetoProLaborePorVenda ?? Infinity) + 0.01)
  const nDiv = div.valor ?? 0
  const casos = nDiv + foraTeto.length
  if (casos < c.cfg.volumeMinimo) return []
  return [{
    detector: 'conta_nao_fecha', area: 'GESTAO', tipo: 'PROBLEMA', grupo: 'GESTAO',
    titulo: `A conta do mês não fecha: ${[nDiv ? `${nDiv} pagamento(s) que não batem com as vendas` : '', foraTeto.length ? `${foraTeto.length} venda(s) com valor fora dos tetos` : ''].filter(Boolean).join(' e ')}`,
    acaoSugerida: 'Conferir e corrigir os lançamentos em Vendas e pagamentos', alvoTipo: 'LANCAMENTO', alvoId: null,
    evidencia: { metricas: [ev('divergencias_vendas_financeiro', 'Divergências entre Vendas e Financeiro', nDiv, null, mes, null, casos, 'QTD', { foraDosTetos: foraTeto.length, semComprovante: 'ponto de extensão: o comprovante é gerado pelo próprio sistema' })], casos, volumeMinimo: c.cfg.volumeMinimo, resumo: `${nDiv} divergência(s), ${foraTeto.length} fora do teto`, registros: { tabela: 'pro_labore_vendas', ids: foraTeto.map(v => v.id) } },
    forca: 'COMPROVADA', impacto: null,
    destino: destino(c.papeis.financeiro ?? c.usuarioId, [c.usuarioId]),
  }]
}

async function saidaForaPadrao(c: Ctx): Promise<Achado[]> {
  const mes = mesCorrente(c.agora)
  const dias = Number(mes.fim.slice(8, 10))
  const e: Escopo = { usuarioId: c.usuarioId, papel: 'DONO' }
  const atual = await calcular('saidas_financeiro', e, mes, c.agora)
  if ((atual.amostra ?? 0) < c.cfg.volumeMinimo) return []
  const hist: number[] = []
  for (let k = 1; k <= 6; k++) {
    const i = new Date(Date.UTC(Number(mes.inicio.slice(0, 4)), Number(mes.inicio.slice(5, 7)) - 1 - k, 1))
    const dm = new Date(Date.UTC(i.getUTCFullYear(), i.getUTCMonth() + 1, 0)).getUTCDate()
    const p = { inicio: dia(i), fim: dia(new Date(i.getTime() + (Math.min(dias, dm) - 1) * DIA)) }
    const v = await calcular('saidas_financeiro', e, p, c.agora)
    if ((v.amostra ?? 0) > 0) hist.push(v.valor ?? 0)
  }
  const med = mediana(hist)
  if (hist.length < 3 || !med || (atual.valor ?? 0) <= med * 1.3) return []
  return [{
    detector: 'saida_fora_padrao', area: 'GESTAO', tipo: 'PROBLEMA', grupo: 'GESTAO', contextoExtra: mes.inicio.slice(0, 7),
    titulo: `As saídas do mês estão ${Math.round(((atual.valor ?? 0) / med - 1) * 100)}% acima do histórico no mesmo número de dias`, acaoSugerida: 'Revisar os lançamentos do mês no Financeiro', alvoTipo: 'LANCAMENTO', alvoId: null,
    evidencia: { metricas: [ev('saidas_financeiro', 'Saídas do caixa', atual.valor, Math.round(med * 100) / 100, mes, null, atual.amostra ?? 0, 'BRL', { mesesNoHistorico: hist.length })], casos: atual.amostra ?? 0, volumeMinimo: c.cfg.volumeMinimo, resumo: 'acima da mediana dos 6 meses anteriores' },
    forca: hist.length >= 6 ? 'PADRAO' : 'HIPOTESE', impacto: null,
    destino: destino(c.usuarioId, [c.papeis.financeiro]),
  }]
}

const ORDEM_ESTAGIO = ['INICIAR', 'MANTER', 'ESCALONAR', 'ESCALAR']
async function pilarTravando(c: Ctx): Promise<Achado[]> {
  const snaps = await prisma.planoCrescimentoSnapshot.findMany({ where: { usuarioId: c.usuarioId }, orderBy: { mesReferencia: 'desc' }, take: 4 })
  if (snaps.length < 2) return []
  const PILARES: Array<[string, 'estagioAquisicao' | 'estagioConversao' | 'estagioExecucao' | 'estagioFinanceiro']> = [['Aquisição', 'estagioAquisicao'], ['Conversão', 'estagioConversao'], ['Execução', 'estagioExecucao'], ['Financeiro', 'estagioFinanceiro']]
  const out: Achado[] = []
  for (const [nome, campo] of PILARES) {
    const [a, b] = [ORDEM_ESTAGIO.indexOf(snaps[0][campo]), ORDEM_ESTAGIO.indexOf(snaps[1][campo])]
    const caiu = a >= 0 && b >= 0 && a < b
    const parado = snaps.length >= 3 && snaps.slice(0, 3).every(s => s[campo] === snaps[0][campo]) && a < ORDEM_ESTAGIO.length - 1
    if (!caiu && !parado) continue
    const acao = await prisma.planoCrescimentoAcao.findFirst({ where: { usuarioId: c.usuarioId, pilar: { equals: campo.replace('estagio', '').toUpperCase() }, concluida: false }, orderBy: { criadoEm: 'asc' }, select: { texto: true } }).catch(() => null)
    out.push({
      detector: 'pilar_travando', area: 'GESTAO', tipo: 'PROBLEMA', grupo: 'GESTAO', contextoExtra: `${campo}|${snaps[0][campo]}`,
      titulo: caiu ? `O pilar ${nome} caiu de ${snaps[1][campo].toLowerCase()} para ${snaps[0][campo].toLowerCase()}` : `O pilar ${nome} está parado em ${snaps[0][campo].toLowerCase()} há 3 meses`,
      acaoSugerida: acao?.texto ? `Atacar a ação de maior impacto: ${acao.texto.slice(0, 160)}` : 'Atacar a ação de maior impacto nesse pilar (Plano de Crescimento)', alvoTipo: 'PILAR', alvoId: campo,
      evidencia: { metricas: [ev('plano_crescimento', `Estágio do pilar ${nome}`, a, b, { inicio: dia(snaps[0].mesReferencia), fim: dia(snaps[0].mesReferencia) }, null, snaps.length, 'QTD', { estagios: snaps.map(s => ({ mes: dia(s.mesReferencia).slice(0, 7), estagio: s[campo] })) })], casos: snaps.length, volumeMinimo: c.cfg.volumeMinimo, resumo: snaps.slice(0, 3).map(s => s[campo]).join(' ← ') },
      forca: caiu ? 'PADRAO' : 'COMPROVADA', impacto: null,
      destino: destino(c.usuarioId, []),
    })
  }
  return out
}

// ============================================================================
// 4.4 Pessoas — tom de desenvolvimento; o vendedor nunca vê achado sobre colega
// ============================================================================

async function quedaRitmo(c: Ctx): Promise<Achado[]> {
  const out: Achado[] = []
  // Dias úteis (seg a sáb) dos últimos 70 dias, até ontem.
  const dias: string[] = []
  for (let k = 1; dias.length < 60 && k < 90; k++) { const d = new Date(new Date(`${hojeBrt(c.agora)}T00:00:00Z`).getTime() - k * DIA); if (d.getUTCDay() !== 0) dias.push(dia(d)) }
  for (const p of c.papeis.equipe) {
    const rs = await prisma.$queryRaw<Array<{ d: string; n: bigint }>>`
      SELECT to_char(("executadaEm" - interval '3 hours')::date, 'YYYY-MM-DD') d, count(*) n FROM pro_labore_atividades
      WHERE "usuarioId" = ${c.usuarioId} AND "responsavelId" = ${p.id} AND status = 'EXECUTADA' AND "executadaEm" >= ${new Date(`${dias[dias.length - 1]}T03:00:00Z`)} GROUP BY 1`
    const porDia = new Map(rs.map(r => [r.d, num(r.n)]))
    const ultimos = dias.slice(0, c.cfg.volumeMinimo), base = dias.slice(c.cfg.volumeMinimo)
    const padrao = mediana(base.map(d => porDia.get(d) ?? 0))
    if (!padrao || padrao < 2) continue
    const abaixo = ultimos.every(d => (porDia.get(d) ?? 0) < padrao * 0.8)
    if (!abaixo) continue
    const media = ultimos.reduce((s, d) => s + (porDia.get(d) ?? 0), 0) / ultimos.length
    const per = { inicio: ultimos[ultimos.length - 1], fim: ultimos[0] }
    out.push({
      detector: 'queda_ritmo', area: 'PESSOAS', tipo: 'PROBLEMA', grupo: 'PESSOAS',
      titulo: `Ritmo abaixo do próprio padrão há ${ultimos.length} dias úteis (${primeiro(p.nome)})`, acaoSugerida: 'Conversa individual (1:1) e ajuste da rotina',
      orientacao: `Nos últimos ${ultimos.length} dias úteis você fez em média ${r1(media)} atividades por dia; o seu normal é ${r1(padrao)}. Que tal uma conversa rápida com o supervisor para ajustar a rotina e destravar o que está pesando?`,
      alvoTipo: 'PESSOA', alvoId: p.id, alvoNome: p.nome,
      evidencia: { metricas: [ev('atividades_feitas', 'Atividades feitas por dia', r1(media), r1(padrao), per, null, ultimos.length, 'QTD')], casos: ultimos.length, volumeMinimo: c.cfg.volumeMinimo, resumo: `${r1(media)} por dia contra ${r1(padrao)} do próprio padrão` },
      forca: forca(ultimos.length, c.cfg.volumeMinimo, false, media <= padrao * 0.5), impacto: null,
      destino: destino(p.id, [c.papeis.supervisor]),
    })
  }
  return out
}

async function rotinaNaoCumprida(c: Ctx): Promise<Achado[]> {
  const prm = await prisma.parametroLiquidez.findUnique({ where: { usuarioId: c.usuarioId }, select: { agendaLimiarBomPct: true, agendaLimiarAtencaoPct: true } })
  const bom = prm?.agendaLimiarBomPct ?? 80, atencao = prm?.agendaLimiarAtencaoPct ?? 60
  const p = periodoDias(c.agora, 7)
  const out: Achado[] = []
  for (const pessoa of c.papeis.equipe) {
    const r = await calcular('aderencia_agenda', { usuarioId: c.usuarioId, papel: 'SUPERVISOR', vendedorId: pessoa.id }, p, c.agora)
    if ((r.amostra ?? 0) < c.cfg.volumeMinimo || r.valor == null || r.valor >= bom) continue
    const faixa = r.valor >= atencao ? 'Atenção' : 'Crítico'
    out.push({
      detector: 'rotina_nao_cumprida', area: 'PESSOAS', tipo: 'PROBLEMA', grupo: 'PESSOAS',
      titulo: `Rotina em ${faixa}: ${r.valor}% cumprida na semana (${primeiro(pessoa.nome)})`, acaoSugerida: 'Rever a rotina ou cobrar o combinado',
      orientacao: `Da sua rotina da Agenda, ${r.valor}% foi feito no próprio dia nesta semana. Vale olhar o que não coube: dá para ajustar a rotina com o supervisor ou reservar um horário fixo para ela.`,
      alvoTipo: 'PESSOA', alvoId: pessoa.id, alvoNome: pessoa.nome,
      evidencia: { metricas: [ev('aderencia_agenda', 'Aderência à rotina', r.valor, null, p, null, r.amostra ?? 0, 'PCT', { ...(r.detalhe as object), limiarBom: bom, limiarAtencao: atencao })], casos: r.amostra ?? 0, volumeMinimo: c.cfg.volumeMinimo, resumo: `${r.valor}% (${faixa})` },
      forca: forca(r.amostra ?? 0, c.cfg.volumeMinimo, false, faixa === 'Crítico'), impacto: null,
      destino: destino(pessoa.id, [c.papeis.supervisor]),
    })
  }
  return out
}

async function pontoFraco(c: Ctx): Promise<Achado[]> {
  const p = periodoDias(c.agora, 30)
  const loja = await calcular('conversao_por_etapa', { usuarioId: c.usuarioId, papel: 'DONO', semSuspeitos: true }, p, c.agora)
  type E = { etapa: string; chegaram: number; seguiram: number; conversao: number | null }
  const eq = (loja.detalhe as E[]) ?? []
  const out: Achado[] = []
  for (const pessoa of c.papeis.equipe) {
    const r = await calcular('conversao_por_etapa', { usuarioId: c.usuarioId, papel: 'SUPERVISOR', vendedorId: pessoa.id, semSuspeitos: true }, p, c.agora)
    const pior = ((r.detalhe as E[]) ?? []).map(x => {
      const t = eq.find(y => y.etapa === x.etapa)
      const outrosN = (t?.chegaram ?? 0) - x.chegaram, outrosS = (t?.seguiram ?? 0) - x.seguiram
      return { ...x, media: outrosN > 0 ? outrosS / outrosN : null }
    }).filter(x => x.chegaram >= c.cfg.volumeMinimo && x.media && x.conversao != null && x.conversao / 100 <= x.media * 0.7)
      .sort((a, b) => (a.conversao! / 100 / a.media!) - (b.conversao! / 100 / b.media!))[0]
    if (!pior) continue
    const etapa = NOME_ETAPA[pior.etapa as Etapa] ?? pior.etapa
    out.push({
      detector: 'ponto_fraco', area: 'PESSOAS', tipo: 'PROBLEMA', grupo: 'PESSOAS', contextoExtra: pior.etapa,
      titulo: `Ponto a desenvolver: ${etapa} (${primeiro(pessoa.nome)})`, acaoSugerida: `Treino específico de ${etapa.toLowerCase()} em Desenvolvimento`,
      orientacao: `Na etapa ${etapa}, ${pior.conversao}% dos seus clientes seguem adiante; a média da equipe é ${Math.round(pior.media! * 1000) / 10}%. O treino de ${etapa.toLowerCase()} em Desenvolvimento mostra o que tem funcionado.`,
      alvoTipo: 'PESSOA', alvoId: pessoa.id, alvoNome: pessoa.nome,
      evidencia: { metricas: [ev('conversao_por_etapa', `Conversão em ${etapa}`, pior.conversao, Math.round(pior.media! * 1000) / 10, p, null, pior.chegaram, 'PCT', { etapa: pior.etapa, mediaEquipeSemNomes: true })], casos: pior.chegaram, volumeMinimo: c.cfg.volumeMinimo, resumo: `${pior.conversao}% contra a média da equipe` },
      forca: forca(pior.chegaram, c.cfg.volumeMinimo, false, pior.conversao! / 100 <= pior.media! * 0.5), impacto: { unidade: 'LEADS', valor: Math.round((pior.media! - pior.conversao! / 100) * pior.chegaram), texto: 'Clientes a mais avançando se igualasse a média (estimativa)' },
      destino: destino(pessoa.id, [c.papeis.supervisor]),
    })
  }
  return out
}

async function ocorrenciaRepetida(c: Ctx): Promise<Achado[]> {
  const rs = await prisma.ocorrencia.groupBy({ by: ['vendedorId', 'tipo'], where: { usuarioId: c.usuarioId, dataOcorrencia: { gte: new Date(c.agora.getTime() - 90 * DIA) } }, _count: true })
  const nomes = new Map(c.papeis.equipe.map(v => [v.id, v.nome]))
  const out: Achado[] = []
  for (const r of rs) {
    if (r._count < c.cfg.volumeMinimo) continue
    const nome = nomes.get(r.vendedorId) ?? (await prisma.vendedor.findUnique({ where: { id: r.vendedorId }, select: { nome: true } }))?.nome ?? 'pessoa'
    out.push({
      detector: 'ocorrencia_repetida', area: 'PESSOAS', tipo: 'PROBLEMA', grupo: 'PESSOAS', contextoExtra: r.tipo,
      titulo: `${r._count} ocorrências do mesmo tipo em 90 dias (${primeiro(nome)})`, acaoSugerida: 'Combinar um plano de correção com a pessoa, com prazo e acompanhamento',
      // Ocorrência não vira orientação automática: o achado vai só para supervisor e dono.
      alvoTipo: 'OCORRENCIA', alvoId: r.vendedorId, alvoNome: nome,
      evidencia: { metricas: [ev('ocorrencias', 'Ocorrências do mesmo tipo', r._count, null, periodoDias(c.agora, 90, 0), null, r._count, 'QTD', { tipo: r.tipo })], casos: r._count, volumeMinimo: c.cfg.volumeMinimo, resumo: `${r._count} do tipo ${r.tipo.toLowerCase()}` },
      forca: r._count >= 3 ? 'COMPROVADA' : 'PADRAO', impacto: null,
      destino: destino(c.papeis.supervisor ?? c.usuarioId, [c.usuarioId]),
    })
  }
  return out
}

async function boaPratica(c: Ctx): Promise<Achado[]> {
  const j1 = periodoDias(c.agora, 14), j0 = periodoDias(c.agora, 14, 15)
  const out: Achado[] = []
  const METRICAS: Array<{ chave: string; nome: string; menor: boolean; descreve: string }> = [
    { chave: 'tempo_primeira_resposta', nome: 'Tempo de primeira resposta', menor: true, descreve: 'responde os clientes bem mais rápido' },
    { chave: 'conversao_lead_venda', nome: 'Conversão lead → venda', menor: false, descreve: 'converte bem mais leads em venda' },
  ]
  for (const m of METRICAS) {
    for (const pessoa of c.papeis.equipe) {
      let consistente = true, casos = 0
      const valores: Array<{ eu: number | null; equipe: number | null }> = []
      for (const p of [j0, j1]) {
        const [eu, eq] = await Promise.all([calcular(m.chave, { usuarioId: c.usuarioId, papel: 'SUPERVISOR', vendedorId: pessoa.id, semSuspeitos: true }, p, c.agora), calcular(m.chave, { usuarioId: c.usuarioId, papel: 'DONO', semSuspeitos: true }, p, c.agora)])
        valores.push({ eu: eu.valor, equipe: eq.valor })
        casos += eu.amostra ?? (m.chave === 'conversao_lead_venda' ? ((eu.detalhe as { leads?: number })?.leads ?? 0) : 0)
        if (eu.valor == null || eq.valor == null || eq.valor === 0) { consistente = false; break }
        if (m.menor ? eu.valor > eq.valor * 0.7 : eu.valor < eq.valor * 1.3) { consistente = false; break }
      }
      if (!consistente || casos < c.cfg.volumeMinimo) continue
      out.push({
        detector: 'boa_pratica', area: 'PESSOAS', tipo: 'FUNCIONANDO', grupo: 'PESSOAS', contextoExtra: m.chave,
        titulo: `Boa prática: ${primeiro(pessoa.nome)} ${m.descreve} que a equipe`, acaoSugerida: 'Transformar em aprendizado para a equipe (compartilhar sem nomes, ou reconhecer a pessoa)',
        alvoTipo: 'BOA_PRATICA', alvoId: pessoa.id, alvoNome: pessoa.nome,
        evidencia: { metricas: [ev(m.chave, m.nome, valores[1].eu, valores[1].equipe, j1, j0, casos, m.chave === 'tempo_primeira_resposta' ? 'MIN' : 'PCT', { periodos: valores, dica: m.descreve })], casos, volumeMinimo: c.cfg.volumeMinimo, resumo: `consistente em dois períodos seguidos` },
        forca: forca(casos, c.cfg.volumeMinimo, true, true), impacto: null,
        destino: destino(c.papeis.supervisor ?? c.usuarioId, []),
      })
    }
  }
  return out
}

export const RODAR_ONDA4: Record<string, (c: Ctx) => Promise<Achado[]>> = {
  prioridade_esquecida: prioridadeEsquecida, campanha_sem_resposta: campanhaSemResposta, roteiro_que_recupera: roteiroQueRecupera, limite_chegando: limiteChegando, recuperacao_caindo: recuperacaoCaindo,
  criativo_cansado: criativoCansado, campanha_lead_fraco: campanhaLeadFraco, orcamento_fora_ritmo: orcamentoForaRitmo, conteudo_abaixo: conteudoAbaixo, post_que_vende: postQueVende,
  venda_parada_confirmacao: vendaParadaConfirmacao, pagamento_atrasado: pagamentoAtrasado, conta_nao_fecha: contaNaoFecha, saida_fora_padrao: saidaForaPadrao, pilar_travando: pilarTravando,
  queda_ritmo: quedaRitmo, rotina_nao_cumprida: rotinaNaoCumprida, ponto_fraco: pontoFraco, ocorrencia_repetida: ocorrenciaRepetida, boa_pratica: boaPratica,
}

/** Roda os detectores de uma área (cada um com sua configuração). */
export async function detectarOnda4(usuarioId: string, cfg: Record<string, ConfigDetector>, agora: Date, quais?: string[], forcarAreas?: GrupoArea[]): Promise<Achado[]> {
  const areas = await configAreas(usuarioId)
  const papeis = await papeisDaConta(usuarioId)
  const out: Achado[] = []
  for (const d of DETECTORES_ONDA4) {
    if (quais && !quais.includes(d.chave)) continue
    const g = d.grupo as GrupoArea
    // Área desligada: o detector não roda (as telas e métricas seguem como antes).
    if (!areas[g].ligada && !forcarAreas?.includes(g)) continue
    const c = cfg[d.chave]
    if (!c?.ativo) continue
    try { out.push(...await RODAR_ONDA4[d.chave]({ usuarioId, cfg: c, agora, papeis })) } catch (e) { console.error(`[detector] ${d.chave}`, e) }
  }
  return out
}
