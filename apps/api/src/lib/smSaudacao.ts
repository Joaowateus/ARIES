// Motor de saudação (seção 14): a recepção do cabeçalho da tela Hoje.
// - Uma visita começa a cada abertura do sistema ou volta depois de 30 min
//   sem atividade; nela fica o momento escolhido e a frase da saudação.
// - Momentos em ordem de prioridade (o primeiro que se aplicar vence):
//   volta de folga, venda creditada, semana difícil, sexta, começo de
//   semana, manhã, tarde e noite.
// - Banco de 8 frases por momento; a mesma frase não volta antes de 7 dias
//   para a mesma pessoa (no mesmo dia e momento, a saudação é a mesma).
// - O resto (subtítulo, 3 cartões e o CTA) sai dos dados reais, só do que a
//   pessoa pode ver. Fora do expediente, nada em vermelho.
import { prisma } from './prisma'
import type { ContextoSM } from './smAcesso'
import { carregarConfig, diaLocal } from './smCalendario'
import { listarEstoque } from './smEstoque'
import { dentroDoExpediente, inicioDaSemana, tempoRespostaSemana } from './smAtendimento'
import { testeEmDestaque } from './smTestes'
import { atorDe, type Aba } from './smInsights'
import { perguntasDaAba } from './smPerguntas'
import { INATIVIDADE_MS } from './smAtividade'
import { retrospectivaPronta } from './smRetrospectiva'

export const MOMENTOS = ['VOLTA', 'VENDA', 'DIFICIL', 'SEXTA', 'SEGUNDA', 'MANHA', 'TARDE', 'NOITE'] as const
export type Momento = (typeof MOMENTOS)[number]
export const MOMENTO_INFO: Record<Momento, { rotulo: string; quando: string }> = {
  VOLTA: { rotulo: 'Volta de folga', quando: 'Mais de 2 dias sem acessar' },
  VENDA: { rotulo: 'Venda creditada', quando: 'Venda vinda de um post desde o último acesso' },
  DIFICIL: { rotulo: 'Semana difícil', quando: 'Os 3 últimos posts abaixo de 0,7× da mediana, ou metas atrasadas a partir de quarta' },
  SEXTA: { rotulo: 'Sexta-feira', quando: 'Sexta, com a retrospectiva pronta' },
  SEGUNDA: { rotulo: 'Começo de semana', quando: 'Primeiro acesso da semana' },
  MANHA: { rotulo: 'Manhã', quando: 'Das 5h ao meio-dia' },
  TARDE: { rotulo: 'Tarde', quando: 'Do meio-dia às 18h' },
  NOITE: { rotulo: 'Noite', quando: 'Depois das 18h (e de madrugada, até as 5h)' },
}

// Banco de frases (saudacao_frase). {nome}, {saudacao} (bom dia/boa tarde/boa noite), {bemvindo}.
const FRASES: Record<Momento, string[]> = {
  VOLTA: [
    'Que bom te ver de volta, {nome}.',
    '{bemvindo} de volta, {nome}. Já separei o que mudou.',
    'Oi, {nome}! O espaço estava te esperando.',
    '{nome}, de volta ao jogo. Vamos com calma.',
    'Bom te ver, {nome}. Deixei tudo organizado para você.',
    'Olha quem voltou: {nome}! Vamos colocar em dia?',
    '{saudacao}, {nome}. Aqui está o que aconteceu enquanto você esteve fora.',
    'De volta, {nome}? Comece pelo que importa.',
  ],
  VENDA: [
    '{saudacao}, {nome}. Tem venda com a sua assinatura.',
    '{nome}, um post seu virou venda.',
    'Venda creditada, {nome}. O conteúdo trabalhou por você.',
    '{saudacao}, {nome}. Seu post fechou negócio.',
    'Olha só, {nome}: venda com origem no seu post.',
    '{nome}, o Instagram vendeu de novo. E o post é seu.',
    'Começou bem, {nome}: tem venda vinda do seu conteúdo.',
    '{saudacao}, {nome}. Tem moto saindo da loja por causa de um post seu.',
  ],
  DIFICIL: [
    '{saudacao}, {nome}. Semana pesada, um passo de cada vez.',
    '{nome}, semana difícil acontece. Vamos por partes.',
    'Sem pressa, {nome}. Um ajuste pequeno já ajuda.',
    '{saudacao}, {nome}. Hoje o foco é uma coisa só.',
    '{nome}, os números deram uma caída. Já separei por onde começar.',
    'Calma, {nome}: semana que começa devagar ainda pode fechar bem.',
    '{saudacao}, {nome}. Vamos testar uma ideia simples hoje.',
    '{nome}, nem toda semana é de recorde. Bora ajustar o que dá.',
  ],
  SEXTA: [
    'Sexta, {nome}. Sua retrospectiva está pronta.',
    'Sextou, {nome}! Hora de ver como foi a semana.',
    '{nome}, a semana fechou. Vem ver o que deu certo.',
    'Sexta-feira, {nome}. Cinco minutos para fechar a semana.',
    '{saudacao}, {nome}. A semana já tem um resumo esperando você.',
    'Fim de semana chegando, {nome}. Antes, um olhar na semana.',
    '{nome}, sua semana em 5 partes está pronta.',
    'Sexta, {nome}. O que funcionou merece virar padrão.',
  ],
  SEGUNDA: [
    '{saudacao}, {nome}. Semana nova, calendário pronto.',
    'Semana nova, {nome}. As metas já estão no lugar.',
    '{saudacao}, {nome}. Começo de semana: vamos planejar?',
    '{nome}, uma semana inteira esperando por você.',
    '{saudacao}, {nome}. Sete dias para bater as metas.',
    'Começo de semana, {nome}. O calendário já está te esperando.',
    '{nome}, semana nova, pautas novas. Vamos?',
    '{saudacao}, {nome}. Primeira olhada na semana?',
  ],
  MANHA: [
    'Bom dia, {nome}. Café passado?',
    'Bom dia, {nome}. Vamos começar pelo que importa?',
    'Bom dia, {nome}! A manhã está organizada para você.',
    'Bom dia, {nome}. Quinze minutos e a manhã fica resolvida.',
    'Bom dia, {nome}. Bora para o ritual da manhã?',
    'Bom dia, {nome}. Hoje tem coisa boa para publicar.',
    'Bom dia, {nome}. Um café e uma tarefa por vez.',
    'Bom dia, {nome}. O dia já está em ordem por aqui.',
  ],
  TARDE: [
    'Boa tarde, {nome}. O que temos para a tarde?',
    'Boa tarde, {nome}. Hora de criar.',
    'Boa tarde, {nome}. A manhã passou, agora é a vez da tarde.',
    'Boa tarde, {nome}. Vamos ver o que vem nas próximas horas?',
    'Boa tarde, {nome}. Depois do almoço, uma coisa por vez.',
    'Boa tarde, {nome}. A tarde é boa para gravar.',
    'Boa tarde, {nome}. Bora fechar o dia com tudo no lugar.',
    'Boa tarde, {nome}. Segue o plano do dia?',
  ],
  NOITE: [
    'Boa noite, {nome}. Hora de desligar.',
    'Boa noite, {nome}. O resto fica para amanhã.',
    'Boa noite, {nome}. O dia está fechado.',
    'Boa noite, {nome}. Descansa, que amanhã a gente continua.',
    'Boa noite, {nome}. Já deu por hoje.',
    'Boa noite, {nome}. Amanhã cedo eu te conto como o dia fechou.',
    'Boa noite, {nome}. Desliga com a cabeça tranquila.',
    'Boa noite, {nome}. Aqui está o resumo, sem pendência para agora.',
  ],
}

let frasesGarantidas = false
/** Grava o banco de frases (uma vez por processo; novas frases entram sem mexer nas que existem). */
export async function garantirFrases() {
  if (frasesGarantidas) return
  const data = MOMENTOS.flatMap(m => FRASES[m].map((texto, i) => ({ id: `${m}-${String(i + 1).padStart(2, '0')}`, momento: m, texto, ordem: i })))
  await prisma.smSaudacaoFrase.createMany({ data, skipDuplicates: true })
  frasesGarantidas = true
}

// ---------- Utilidades ----------

const DIA_MS = 864e5
const MIN_MS = 60_000
const OFF = 3 * 3600e3
const SEMANA_CURTA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const DIA_LONGO = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const FORMATO_NOME: Record<string, string> = { REELS: 'reel', CARROSSEL: 'carrossel', FOTO: 'foto', STORY: 'story' }
const PILAR_NOME: Record<string, string> = { ESTOQUE: 'Estoque', PROVA: 'Prova social', EDUCACAO: 'Educação', BASTIDORES: 'Bastidores' }
const num = (v: number, c = 1) => v.toLocaleString('pt-BR', { maximumFractionDigits: c })
const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`
// "3 de 4 dias com post"; passando da meta, "5 dias com post (meta 4)".
const diasDaMeta = (n: number, meta: number) => (n > meta ? `${n} dias com post (meta ${meta})` : `${n} de ${meta} dias com post`)
/** Contagem que lê bem também no zero: "nenhuma conversa nova" em vez de "0 conversas". */
const conta = (n: number, s: string, p: string, nenhum: string) => (n ? plural(n, s, p) : nenhum)
const lista = (l: string[]) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}` : l[0] ?? '')
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const somarDias = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10)
const inicioDoDia = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + OFF)
const horaLocal = (d: Date) => new Date(d.getTime() - OFF).toISOString().slice(11, 16)
const curto = (t: string, n: number) => { const x = t.replace(/\s+/g, ' ').trim(); return x.length > n ? `${x.slice(0, n - 1)}…` : x }
const mediana = (v: number[]) => { if (!v.length) return 0; const s = [...v].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const nomeCliente = (c: { clienteNome: string | null; clienteUsuario: string | null }) => c.clienteNome?.split(' ')[0] ?? (c.clienteUsuario ? `@${c.clienteUsuario}` : 'Um cliente')
function espera(min: number) { return min < 60 ? `${min} min` : min < 2880 ? `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}` : `${Math.floor(min / 1440)} dias` }
function quando(d: Date, agora: Date) {
  const dia = diaLocal(d), hoje = diaLocal(agora)
  return dia === hoje ? 'hoje' : dia === somarDias(hoje, -1) ? 'ontem' : `em ${ddmm(dia)}`
}
function tituloDaLegenda(l: string | null) { const x = (l ?? '').split('\n')[0]?.trim(); return x ? curto(x, 50) : 'Post sem legenda' }

export type Tom = 'bad' | 'info' | 'warn' | 'ok' | 'learn' | 'neutro'
export interface ItemRecepcao { tom: Tom; rotulo: string; texto: string }
export interface Recepcao {
  visitaId: string | null
  momento: Momento
  kicker: string
  titulo: string
  sub: string
  cta: { rotulo: string; href: string } | null
  listaTitulo: string
  itens: ItemRecepcao[]
  perguntas: Array<{ aba: Aba; id: string; texto: string }>
  recolhida: boolean
  foraDoExpediente: boolean
  fraseId: string | null
}

// ---------- Dados reais do momento ----------

async function carregarDados(sm: ContextoSM, agora: Date, anteriorEm: Date | null) {
  const u = sm.usuarioId
  const ve = { producao: sm.pode('producao', 'LEITURA'), atendimento: sm.pode('atendimento', 'LEITURA'), crm: sm.pode('crm', 'LEITURA'), estoque: sm.pode('estoque', 'LEITURA'), analise: sm.pode('analise', 'LEITURA'), vendas: sm.pode('vendas', 'LEITURA') && sm.pode('crm', 'LEITURA') }
  const hoje = diaLocal(agora)
  const iniHoje = inicioDoDia(hoje), iniAmanha = inicioDoDia(somarDias(hoje, 1)), fimAmanha = inicioDoDia(somarDias(hoje, 2))
  const iniSemana = inicioDaSemana(agora)
  const desde = anteriorEm && anteriorEm < iniSemana ? anteriorEm : iniSemana
  const [config, conta] = await Promise.all([carregarConfig(u), prisma.socialMediaConta.findUnique({ where: { titular: `dono:${u}` }, select: { id: true, nomeExibicao: true } })])
  const [pautas, publicadas, feed, esperando, respostasHoje, conversasNovas, leadsHoje, leadsDesde, leadsSemana, acoesHoje, estoque, teste, tempoResp] = await Promise.all([
    ve.producao ? prisma.smPauta.findMany({ where: { usuarioId: u, status: { not: 'PUBLICADO' } }, select: { id: true, titulo: true, status: true, prazo: true, agendadoPara: true, aprovacao: true } }) : Promise.resolve([]),
    ve.producao ? prisma.smPauta.findMany({ where: { usuarioId: u, status: 'PUBLICADO', publicadaEm: { gte: desde } }, select: { titulo: true, publicadaEm: true } }) : Promise.resolve([]),
    conta ? prisma.socialMediaMidia.findMany({ where: { contaId: conta.id, publicadoEm: { gte: new Date(agora.getTime() - 90 * DIA_MS) }, NOT: { formato: { in: ['STORY', 'AD'] } } }, orderBy: { publicadoEm: 'desc' }, select: { legenda: true, formato: true, tipo: true, publicadoEm: true, alcance: true } }) : Promise.resolve([]),
    ve.atendimento ? prisma.smConversa.findMany({ where: { usuarioId: u, aguardandoDesde: { not: null }, status: { not: 'ARQUIVADA' } }, orderBy: { aguardandoDesde: 'asc' }, select: { clienteNome: true, clienteUsuario: true, motoInteresse: true, aguardandoDesde: true } }) : Promise.resolve([]),
    ve.atendimento ? prisma.smMensagem.count({ where: { direcao: 'OUT', autor: { not: 'AUTOMACAO' }, enviadaEm: { gte: iniHoje }, conversa: { usuarioId: u } } }) : Promise.resolve(0),
    ve.atendimento && anteriorEm ? prisma.smConversa.count({ where: { usuarioId: u, criadoEm: { gt: anteriorEm } } }) : Promise.resolve(0),
    ve.crm ? prisma.lead.count({ where: { usuarioId: u, tipoLead: 'ORGANICO', criadoEm: { gte: iniHoje } } }) : Promise.resolve(null),
    ve.crm && anteriorEm ? prisma.lead.count({ where: { usuarioId: u, tipoLead: 'ORGANICO', criadoEm: { gt: anteriorEm } } }) : Promise.resolve(null),
    ve.crm ? prisma.lead.count({ where: { usuarioId: u, tipoLead: 'ORGANICO', criadoEm: { gte: iniSemana } } }) : Promise.resolve(null),
    prisma.smInsightAcao.count({ where: { usuarioId: u, executadoEm: { gte: iniHoje }, desfeitoEm: null } }),
    ve.estoque ? listarEstoque(u, agora) : Promise.resolve(null),
    ve.analise ? testeEmDestaque(u) : Promise.resolve(null),
    ve.atendimento ? tempoRespostaSemana(u, agora) : Promise.resolve(null),
  ])

  // Venda vinda de post registrada desde o último acesso.
  let venda: { moto: string | null; quando: string; post: { titulo: string; formato: string | null; data: string | null; pilar: string | null } | null; leadsDoPost: number } | null = null
  if (ve.vendas && anteriorEm) {
    const v = await prisma.venda.findFirst({
      where: { usuarioId: u, criadoEm: { gt: anteriorEm }, OR: [{ origem: 'INSTAGRAM_ORGANICO' }, { lead: { OR: [{ tipoLead: 'ORGANICO' }, { origem: 'INSTAGRAM_ORGANICO' }] } }] },
      orderBy: { criadoEm: 'desc' },
      select: { data: true, postCode: true, midiaId: true, lead: { select: { modeloInteresse: true, postCode: true, midiaId: true } } },
    })
    if (v) {
      const codigo = v.postCode ?? v.lead?.postCode ?? null
      const midiaId = v.midiaId ?? v.lead?.midiaId ?? null
      const pauta = codigo || midiaId ? await prisma.smPauta.findFirst({ where: { usuarioId: u, OR: [...(codigo ? [{ codigo }] : []), ...(midiaId ? [{ igMediaId: midiaId }] : [])] }, select: { titulo: true, formato: true, pilar: true, publicadaEm: true, moto: { select: { modelo: true } } } }) : null
      const midia = !pauta && midiaId ? await prisma.socialMediaMidia.findUnique({ where: { instagramMediaId: midiaId }, select: { legenda: true, formato: true, tipo: true, publicadoEm: true } }) : null
      const leadsDoPost = codigo || midiaId ? await prisma.lead.count({ where: { usuarioId: u, OR: [...(codigo ? [{ postCode: codigo }] : []), ...(midiaId ? [{ midiaId }] : [])] } }) : 0
      venda = {
        moto: v.lead?.modeloInteresse ?? pauta?.moto?.modelo ?? null,
        quando: quando(v.data, agora),
        post: pauta ? { titulo: pauta.titulo, formato: pauta.formato, data: pauta.publicadaEm ? ddmm(diaLocal(pauta.publicadaEm)) : null, pilar: pauta.pilar }
          : midia ? { titulo: tituloDaLegenda(midia.legenda), formato: midia.formato === 'REELS' ? 'REELS' : midia.tipo === 'CAROUSEL_ALBUM' ? 'CARROSSEL' : 'FOTO', data: ddmm(diaLocal(midia.publicadoEm)), pilar: null } : null,
        leadsDoPost,
      }
    }
  }

  const med = mediana(feed.filter(m => m.alcance > 0).map(m => m.alcance))
  const formato = (m: { formato: string | null; tipo: string }) => (m.formato === 'REELS' ? 'REELS' : m.tipo === 'CAROUSEL_ALBUM' ? 'CARROSSEL' : 'FOTO')
  const posts = feed.map(m => ({ titulo: tituloDaLegenda(m.legenda), formato: formato(m), em: m.publicadoEm, dia: diaLocal(m.publicadoEm), hora: Number(horaLocal(m.publicadoEm).slice(0, 2)), multiplo: med > 0 && m.alcance > 0 ? m.alcance / med : null }))
  const diasComPostSemana = new Set(posts.filter(p => p.em >= iniSemana).map(p => p.dia))
  const agendadas = pautas.filter(p => p.agendadoPara && p.status === 'AGENDADO')
  // Planejadas para uma data (agendadas ou ainda em produção), como na tela Hoje.
  const planejadas = pautas.filter(p => p.agendadoPara)
  const planejadosSemana = new Set([...diasComPostSemana, ...agendadas.filter(p => p.agendadoPara! >= iniSemana && p.agendadoPara! < new Date(iniSemana.getTime() + 7 * DIA_MS)).map(p => diaLocal(p.agendadoPara!))])
  return {
    ve, agora, hoje, config, loja: conta?.nomeExibicao?.split(/\s+/)[0] ?? null,
    foraDoExpediente: !dentroDoExpediente(agora, config),
    anteriorEm,
    // Posts de hoje: agendados que ainda vão ao ar e os já publicados com a força contra a mediana.
    postsHojeAgendados: planejadas.filter(p => p.agendadoPara! >= iniHoje && p.agendadoPara! < iniAmanha).sort((a, b) => a.agendadoPara!.getTime() - b.agendadoPara!.getTime()).map(p => ({ titulo: p.titulo, hora: horaLocal(p.agendadoPara!), em: p.agendadoPara! })),
    proximoPost: (() => { const p = agendadas.filter(x => x.agendadoPara! > agora).sort((a, b) => a.agendadoPara!.getTime() - b.agendadoPara!.getTime())[0]; return p ? { titulo: p.titulo, quando: `${SEMANA_CURTA[new Date(p.agendadoPara!.getTime() - OFF).getUTCDay()]} ${ddmm(diaLocal(p.agendadoPara!))}, ${horaLocal(p.agendadoPara!)}` } : null })(),
    postsAmanha: planejadas.filter(p => p.agendadoPara! >= iniAmanha && p.agendadoPara! < fimAmanha).sort((a, b) => a.agendadoPara!.getTime() - b.agendadoPara!.getTime()).map(p => ({ titulo: p.titulo, hora: horaLocal(p.agendadoPara!) })),
    publicadosHoje: posts.filter(p => p.dia === hoje),
    ultimos3: posts.filter(p => p.multiplo != null).slice(0, 3),
    posts,
    esperando: esperando.map(c => ({ nome: nomeCliente(c), moto: c.motoInteresse, min: Math.round((agora.getTime() - c.aguardandoDesde!.getTime()) / MIN_MS), desde: c.aguardandoDesde! })),
    atrasadas: pautas.filter(p => p.prazo && p.prazo < iniHoje && !['AGENDADO', 'APROVACAO'].includes(p.status)),
    prazoHoje: pautas.filter(p => p.prazo && diaLocal(p.prazo) === hoje && p.status !== 'AGENDADO'),
    aprovacao: pautas.filter(p => p.status === 'APROVACAO' && p.aprovacao === 'PENDENTE').length,
    publicadasDesde: anteriorEm ? publicadas.filter(p => p.publicadaEm && p.publicadaEm > anteriorEm).length : 0,
    respostasHoje, conversasNovas, leadsHoje, leadsDesde, leadsSemana, acoesHoje,
    parada: estoque?.filter(m => m.situacao !== 'VENDIDA' && m.posts === 0 && m.emProducao === 0 && m.diasEmEstoque >= 20).sort((a, b) => b.diasEmEstoque - a.diasEmEstoque)[0] ?? null,
    teste,
    tempoResp,
    semana: { iniSemana, diasComPost: diasComPostSemana.size, planejados: planejadosSemana.size, diasPlanejados: planejadosSemana },
    venda,
  }
}
type Dados = Awaited<ReturnType<typeof carregarDados>>

// ---------- Quais momentos se aplicam ----------

/** Manhã das 5h ao meio-dia, tarde até as 18h; de madrugada ainda é noite ("Boa noite" à 0h30). */
function periodoDoDia(agora: Date): 'MANHA' | 'TARDE' | 'NOITE' {
  const h = Number(horaLocal(agora).slice(0, 2))
  return h >= 5 && h < 12 ? 'MANHA' : h >= 12 && h < 18 ? 'TARDE' : 'NOITE'
}

/** Dia da semana com segunda = 1 ... domingo = 7. */
const diaDaSemana = (d: Dados) => ((new Date(`${d.hoje}T12:00:00Z`).getUTCDay() + 6) % 7) + 1
function metasAtrasadas(d: Dados): string | null {
  const dia = diaDaSemana(d)
  if (dia < 3 || dia > 5) return null
  const esperadoDias = d.config.minDiasSemana * dia / 7
  if (d.semana.diasComPost < esperadoDias / 2) return 'dias'
  if (d.leadsSemana != null && d.leadsSemana < d.config.metaLeadsSemana * dia / 7 / 2) return 'leads'
  return null
}
function alcanceEmQueda(d: Dados) { return d.ultimos3.length === 3 && d.ultimos3.every(p => p.multiplo! < 0.7) }

/** Retrospectiva pronta (tela 11, Fase 4d). Até lá, a sexta não dispara sozinha. */

export async function momentosQueSeAplicam(sm: ContextoSM, d: Dados): Promise<Record<Momento, boolean>> {
  const periodo = periodoDoDia(d.agora)
  return {
    VOLTA: !!d.anteriorEm && d.agora.getTime() - d.anteriorEm.getTime() > 2 * DIA_MS,
    VENDA: !!d.venda,
    DIFICIL: (d.ve.analise && alcanceEmQueda(d)) || !!metasAtrasadas(d),
    SEXTA: diaDaSemana(d) === 5 && await retrospectivaPronta(sm, d.agora),
    SEGUNDA: !!d.anteriorEm && d.anteriorEm < d.semana.iniSemana,
    MANHA: periodo === 'MANHA',
    TARDE: periodo === 'TARDE',
    NOITE: periodo === 'NOITE',
  }
}

// ---------- Conteúdo de cada momento ----------

interface Conteudo { kicker: string; sub: string; cta: { rotulo: string; href: string } | null; listaTitulo: string; itens: ItemRecepcao[]; perguntas: string[] }

/** Cartões de reserva, na ordem de urgência, para completar 3. */
function reservas(d: Dados): ItemRecepcao[] {
  const r: ItemRecepcao[] = []
  const e = d.esperando[0]
  if (e) r.push({ tom: 'bad', rotulo: 'Cliente esperando', texto: `${e.nome} perguntou${e.moto ? ` da ${e.moto}` : ''} há ${espera(e.min)}` })
  if (d.postsHojeAgendados.length) r.push({ tom: 'info', rotulo: lista(d.postsHojeAgendados.slice(0, 2).map(p => p.hora)), texto: lista(d.postsHojeAgendados.slice(0, 2).map(p => curto(p.titulo, 40))) })
  if (d.parada) r.push({ tom: 'warn', rotulo: 'Estoque', texto: `${d.parada.modelo}${d.parada.ano ? ` ${d.parada.ano}` : ''} sem nenhum post em ${d.parada.diasEmEstoque} dias` })
  if (d.atrasadas.length) r.push({ tom: 'warn', rotulo: 'Produção', texto: `${plural(d.atrasadas.length, 'pauta passou', 'pautas passaram')} do prazo: “${curto(d.atrasadas[0].titulo, 40)}”` })
  if (d.aprovacao) r.push({ tom: 'warn', rotulo: 'Aprovação', texto: `${plural(d.aprovacao, 'pauta espera', 'pautas esperam')} o gestor` })
  if (d.postsAmanha[0]) r.push({ tom: 'info', rotulo: `Amanhã, ${d.postsAmanha[0].hora}`, texto: curto(d.postsAmanha[0].titulo, 50) })
  if (d.teste?.status === 'ATIVO') r.push({ tom: 'learn', rotulo: 'Teste A/B', texto: `${curto(d.teste.hipotese, 50)} (${d.teste.amostraAtual} de ${d.teste.amostraAlvo})` })
  if (d.proximoPost && !d.postsHojeAgendados.length && !d.postsAmanha.length) r.push({ tom: 'info', rotulo: 'Próximo post', texto: `${d.proximoPost.quando}: ${curto(d.proximoPost.titulo, 40)}` })
  r.push({ tom: d.semana.diasComPost >= d.config.minDiasSemana ? 'ok' : 'neutro', rotulo: 'Semana', texto: `${diasDaMeta(d.semana.diasComPost, d.config.minDiasSemana)}${d.semana.planejados > d.semana.diasComPost ? `, ${d.semana.planejados} contando os agendados` : ''}` })
  return r
}
function completar(itens: ItemRecepcao[], d: Dados): ItemRecepcao[] {
  const r = [...itens]
  for (const x of reservas(d)) { if (r.length >= 3) break; if (!r.some(y => y.rotulo === x.rotulo)) r.push(x) }
  return r.slice(0, 3)
}
/** Minutos estimados para resolver a fila (modo foco): 3 por cliente, 2 por post, 5 por atrasada. */
function minutosDaFila(d: Dados) { const m = 3 * Math.min(5, d.esperando.length) + 2 * d.postsHojeAgendados.length + 5 * Math.min(2, d.atrasadas.length); return Math.min(45, Math.max(5, Math.ceil(m / 5) * 5)) }
const rotuloData = (d: Dados) => { const l = new Date(d.agora.getTime() - OFF); return `${DIA_LONGO[l.getUTCDay()]}, ${ddmm(d.hoje)}` }
function hrefOu(d: Dados, ...op: Array<[keyof Dados['ve'] | null, string]>): string {
  for (const [m, href] of op) if (!m || d.ve[m]) return href
  return '/pro-labore/sm'
}

function conteudo(m: Momento, d: Dados, bemvindo: string): Conteudo {
  const esperandoTxt = d.esperando.length ? `${plural(d.esperando.length, 'cliente esperando', 'clientes esperando')}` : null
  switch (m) {
    case 'VOLTA': {
      const dias = Math.max(2, Math.floor((d.agora.getTime() - d.anteriorEm!.getTime()) / DIA_MS))
      const partes = [
        d.ve.producao ? `${d.publicadasDesde ? plural(d.publicadasDesde, 'post foi ao ar', 'posts foram ao ar') : 'nenhum post foi ao ar'}` : null,
        d.ve.atendimento ? (d.conversasNovas === 1 ? 'chegou 1 conversa nova' : d.conversasNovas ? `chegaram ${d.conversasNovas} conversas novas` : 'nenhuma conversa nova chegou') : null,
        d.leadsDesde != null ? (d.leadsDesde ? `${plural(d.leadsDesde, 'lead orgânico entrou', 'leads orgânicos entraram')} no CRM` : 'nenhum lead novo entrou no CRM') : null,
      ].filter(Boolean) as string[]
      const itens: ItemRecepcao[] = []
      if (d.esperando.length) itens.push({ tom: 'bad', rotulo: 'Sem resposta', texto: `${plural(d.esperando.length, 'conversa', 'conversas')}, a mais antiga de ${quando(d.esperando[0].desde, d.agora)}` })
      if (d.ve.producao) itens.push({ tom: d.publicadasDesde ? 'ok' : 'warn', rotulo: 'Posts no ar', texto: d.publicadasDesde ? `${plural(d.publicadasDesde, 'publicado', 'publicados')} enquanto você esteve fora` : 'Nenhum post publicado no período' })
      if (d.atrasadas.length) itens.push({ tom: 'warn', rotulo: 'Produção', texto: `${plural(d.atrasadas.length, 'pauta passou', 'pautas passaram')} do prazo` })
      return {
        kicker: `${bemvindo} de volta`,
        sub: partes.length ? `Nos ${dias} dias fora: ${lista(partes)}.` : `Foram ${dias} dias fora. Vamos ver como está tudo.`,
        cta: { rotulo: `Colocar em dia em ${minutosDaFila(d)} minutos`, href: '/pro-labore/sm/foco' },
        listaTitulo: 'Enquanto você esteve fora', itens: completar(itens, d),
        perguntas: ['atd:hoje', 'atd:quente', 'prod:destravar', 'cal:semana'],
      }
    }
    case 'VENDA': {
      const v = d.venda!
      const fmt = v.post?.formato ? FORMATO_NOME[v.post.formato] : 'post'
      const sub = v.post
        ? `${v.moto ? `A ${v.moto} vendida` : 'A venda registrada'} ${v.quando} veio do seu ${fmt}${v.post.data ? ` de ${v.post.data}` : ''}. O post já soma ${plural(v.leadsDoPost, 'lead', 'leads')}.`
        : `${v.moto ? `A ${v.moto} vendida` : 'Uma venda registrada'} ${v.quando} veio do Instagram.`
      const itens: ItemRecepcao[] = []
      if (v.post) itens.push({ tom: 'ok', rotulo: 'Repetir o formato', texto: `${fmt.charAt(0).toUpperCase()}${fmt.slice(1)}${v.post.pilar ? ` de ${PILAR_NOME[v.post.pilar]?.toLowerCase()}` : ''} como “${curto(v.post.titulo, 40)}”` })
      return { kicker: periodoDoDia(d.agora) === 'MANHA' ? 'Notícia boa logo cedo' : 'Notícia boa', sub, cta: { rotulo: 'Ver vendas por post', href: '/pro-labore/sm/vendas-por-post' }, listaTitulo: 'E para hoje', itens: completar(itens, d), perguntas: ['atr:moto', 'atr:formato', 'atr:relatorio'] }
    }
    case 'DIFICIL': {
      const queda = d.ve.analise && alcanceEmQueda(d)
      const media = queda ? d.ultimos3.reduce((s, p) => s + p.multiplo!, 0) / 3 : null
      const atraso = metasAtrasadas(d)
      const sub = queda
        ? `O alcance caiu nos últimos 3 posts (${num(media!, 1)}× a mediana, em média). Já separei uma hipótese simples para testar hoje, sem pressa.`
        : atraso === 'dias'
          ? `A semana começou devagar: ${plural(d.semana.diasComPost, 'dia', 'dias')} com post até agora, de ${d.config.minDiasSemana}. Um post hoje já muda o placar.`
          : `Os leads da semana estão em ${d.leadsSemana} de ${d.config.metaLeadsSemana}. Um post com chamada para o direct ajuda, sem pressa.`
      // Hipótese: formato ou horário dos 3 últimos contra o que costuma render.
      let hipotese = 'Testar um gancho novo da biblioteca nos próximos 2 reels'
      let teste = 'Reel começando com a moto em movimento'
      if (queda) {
        const formatos = new Set(d.ultimos3.map(p => p.formato))
        const reels = d.posts.filter(p => p.formato === 'REELS' && p.multiplo != null)
        const medReels = reels.length >= 3 ? mediana(reels.map(p => p.multiplo!)) : null
        const horas = d.ultimos3.map(p => p.hora)
        const melhores = d.posts.filter(p => p.multiplo != null && p.multiplo >= 1.2)
        const horaBoa = melhores.length >= 3 ? mediana(melhores.map(p => p.hora)) : null
        if (!formatos.has('REELS') && medReels != null && medReels > 1) { hipotese = `Os 3 últimos não foram reels; os reels dos últimos 90 dias renderam ${num(medReels, 1)}× a mediana`; teste = 'Um reel hoje, no horário de sempre' }
        else if (horaBoa != null && horas.every(h => Math.abs(h - horaBoa) >= 3)) { hipotese = `Os 3 últimos saíram longe das ${Math.round(horaBoa)}h, onde os melhores posts costumam sair`; teste = `Publicar o próximo perto das ${Math.round(horaBoa)}h` }
      }
      const itens: ItemRecepcao[] = queda
        ? [{ tom: 'learn', rotulo: 'Hipótese', texto: hipotese }, { tom: 'info', rotulo: 'Teste de hoje', texto: teste }]
        : [{ tom: 'info', rotulo: 'Passo de hoje', texto: atraso === 'dias' ? 'Um post hoje, mesmo simples, no horário de sempre' : 'Um post terminando com “Comente QUERO” para puxar conversa' }]
      const bem = d.tempoResp != null && d.tempoResp <= d.config.metaRespostaMin ? `Resposta no direct dentro da meta (${d.tempoResp} min)`
        : d.leadsSemana != null && d.leadsSemana >= d.config.metaLeadsSemana ? `Leads da semana na meta (${d.leadsSemana})`
          : d.semana.planejados >= d.config.minDiasSemana ? `A semana já tem ${d.semana.planejados} dias com post planejados` : null
      if (bem) itens.push({ tom: 'ok', rotulo: 'O que segue bem', texto: bem })
      const cta = queda
        ? { rotulo: 'Ver a hipótese', href: hrefOu(d, ['analise', '/pro-labore/sm/desempenho'], ['producao', '/pro-labore/sm/calendario']) }
        : { rotulo: 'Planejar o post de hoje', href: hrefOu(d, ['producao', '/pro-labore/sm/producao?nova=1']) }
      return { kicker: 'Vamos por partes', sub, cta, listaTitulo: 'Um passo pequeno', itens: completar(itens, d), perguntas: queda ? ['des:alcance', 'des:horario', 'prod:destravar'] : ['cal:semana', 'prod:destravar', 'atr:formato'] }
    }
    case 'SEXTA': {
      const melhor = [...d.posts].filter(p => p.em >= d.semana.iniSemana && p.multiplo != null).sort((a, b) => b.multiplo! - a.multiplo!)[0]
      const itens: ItemRecepcao[] = []
      if (d.leadsSemana != null) itens.push({ tom: d.leadsSemana >= d.config.metaLeadsSemana ? 'ok' : 'warn', rotulo: d.leadsSemana >= d.config.metaLeadsSemana ? 'Meta batida' : 'Leads da semana', texto: `${plural(d.leadsSemana, 'lead orgânico', 'leads orgânicos')} na semana (meta ${d.config.metaLeadsSemana})` })
      if (melhor) itens.push({ tom: 'info', rotulo: 'Post da semana', texto: `${melhor.titulo}, ${num(melhor.multiplo!, 1)}× a mediana` })
      if (d.teste?.status === 'CONCLUIDO' && d.teste.resultado) itens.push({ tom: 'learn', rotulo: 'Aprendizado', texto: curto(d.teste.resultado.texto, 70) })
      return { kicker: 'Fechamento da semana', sub: `${diasDaMeta(d.semana.diasComPost, d.config.minDiasSemana)} na semana. Leva 5 minutos para ver.`, cta: { rotulo: 'Abrir a retrospectiva', href: '/pro-labore/sm/retrospectiva' }, listaTitulo: 'Destaques', itens: completar(itens, d), perguntas: ['atr:relatorio', 'des:alcance', 'des:horario'] }
    }
    case 'SEGUNDA': {
      const faltam = Math.max(0, d.config.minDiasSemana - d.semana.planejados)
      const livres = Array.from({ length: 7 }, (_, i) => somarDias(diaLocal(d.semana.iniSemana), i)).filter(x => x >= d.hoje && !d.semana.diasPlanejados.has(x))
      const itens: ItemRecepcao[] = []
      if (d.ve.producao) itens.push(faltam
        ? { tom: 'warn', rotulo: `Faltam ${plural(faltam, 'dia', 'dias')} com post`, texto: livres.length ? `${lista(livres.slice(0, 3).map(x => SEMANA_CURTA[new Date(`${x}T12:00:00Z`).getUTCDay()]))} ainda sem pauta` : 'Os dias restantes já estão cheios' }
        : { tom: 'ok', rotulo: 'Semana coberta', texto: `${d.semana.planejados} dias com post planejados (meta ${d.config.minDiasSemana})` })
      if (d.teste?.status === 'ATIVO') itens.push({ tom: 'learn', rotulo: 'Foco da semana', texto: `Fechar o teste: ${curto(d.teste.hipotese, 50)}` })
      const metas = [`${d.config.minDiasSemana} dias com post`, d.ve.crm ? `${d.config.metaLeadsSemana} leads` : null, d.ve.atendimento ? `resposta em até ${d.config.metaRespostaMin} min` : null].filter(Boolean) as string[]
      return {
        kicker: `Começo de semana · ${ddmm(diaLocal(d.semana.iniSemana))}`,
        sub: `Metas: ${lista(metas)}.${d.ve.producao ? ` ${d.semana.planejados} de ${d.config.minDiasSemana} dias já têm post publicado ou agendado.` : ''}`,
        cta: { rotulo: 'Abrir o calendário', href: hrefOu(d, ['producao', '/pro-labore/sm/calendario']) },
        listaTitulo: 'Para fechar a semana', itens: completar(itens, d), perguntas: ['cal:semana', 'cal:mix', 'prod:destravar'],
      }
    }
    case 'MANHA': {
      const partes = [
        d.postsHojeAgendados.length ? plural(d.postsHojeAgendados.length, 'post', 'posts') : null,
        esperandoTxt,
        d.parada ? `uma ${d.parada.modelo} parada há ${d.parada.diasEmEstoque} dias` : null,
      ].filter(Boolean) as string[]
      const tarefas = d.esperando.length + d.postsHojeAgendados.length + d.atrasadas.length
      const sub = partes.length
        ? `Hoje temos ${lista(partes)}.${tarefas ? ` Dá pra resolver a manhã em ${minutosDaFila(d)} minutos.` : ''}`
        : d.ve.producao && !d.postsHojeAgendados.length ? 'Nenhum post agendado para hoje e nada urgente: uma boa manhã para criar.' : 'Nada urgente agora: uma boa manhã para criar.'
      return {
        kicker: `${d.loja ? `Café com a ${d.loja}` : 'Café da manhã'} · ${rotuloData(d)}`, sub,
        cta: { rotulo: 'Começar o ritual da manhã', href: '/pro-labore/sm/foco' },
        listaTitulo: 'O que temos para hoje', itens: completar([], d), perguntas: ['prod:estoque', 'prod:ganchos', 'atd:sugira', 'atd:quente', 'cal:semana', 'prod:destravar'],
      }
    }
    case 'TARDE': {
      const feitas = d.respostasHoje + d.acoesHoje + d.publicadosHoje.length
      const sub = feitas || d.leadsHoje
        ? `A manhã fechou com ${plural(feitas, 'tarefa feita', 'tarefas feitas')}${d.leadsHoje != null ? ` e ${plural(d.leadsHoje, 'lead', 'leads')} no CRM` : ''}. Agora é hora de criar.`
        : 'Nada registrado pela manhã ainda. Dá tempo de virar o dia.'
      const itens: ItemRecepcao[] = []
      const proximo = d.postsHojeAgendados.filter(p => p.em > d.agora)
      if (proximo[0]) itens.push({ tom: 'info', rotulo: proximo[0].hora, texto: curto(proximo[0].titulo, 50) })
      if (d.prazoHoje[0]) itens.push({ tom: 'warn', rotulo: 'Prazo hoje', texto: curto(d.prazoHoje[0].titulo, 50) })
      const deHoje = d.publicadosHoje.find(p => p.multiplo != null)
      if (deHoje) itens.push({ tom: deHoje.multiplo! >= 1 ? 'ok' : 'learn', rotulo: `Post de hoje, ${String(deHoje.hora).padStart(2, '0')}h`, texto: `Está em ${num(deHoje.multiplo!, 1)}× a mediana` })
      return { kicker: `Depois do almoço · ${rotuloData(d)}`, sub, cta: { rotulo: 'Ver a tarde', href: hrefOu(d, ['producao', '/pro-labore/sm/producao'], ['atendimento', '/pro-labore/sm/atendimento']) }, listaTitulo: 'Para as próximas horas', itens: completar(itens, d), perguntas: ['atd:hoje', 'prod:destravar', 'des:horario', 'cal:mix'] }
    }
    case 'NOITE': {
      const deHoje = d.publicadosHoje.find(p => p.multiplo != null)
      const resumo = [d.ve.producao || d.ve.analise ? conta(d.publicadosHoje.length, 'post no ar', 'posts no ar', 'nenhum post no ar') : null, d.ve.atendimento ? conta(d.respostasHoje, 'resposta enviada', 'respostas enviadas', 'nenhuma resposta enviada') : null].filter(Boolean) as string[]
      const sub = deHoje
        ? `“${deHoje.titulo}” está em ${num(deHoje.multiplo!, 1)}× a mediana. Amanhã cedo eu te conto como ele fechou.`
        : resumo.length ? `Hoje: ${lista(resumo)}. O resto fica para amanhã.` : 'Dia encerrado. O resto fica para amanhã.'
      // Nada no ar e nada respondido não vira cartão: o subtítulo já diz.
      const itens: ItemRecepcao[] = []
      if (d.publicadosHoje.length || d.respostasHoje) itens.push({ tom: 'ok', rotulo: 'Hoje', texto: lista(resumo) })
      if (d.postsAmanha[0]) itens.push({ tom: 'info', rotulo: `${DIA_LONGO[new Date(`${somarDias(d.hoje, 1)}T12:00:00Z`).getUTCDay()]}, ${d.postsAmanha[0].hora}`, texto: curto(d.postsAmanha[0].titulo, 50) })
      if (d.teste?.status === 'ATIVO') itens.push({ tom: 'learn', rotulo: 'Teste A/B', texto: `${d.teste.amostraAtual} de ${d.teste.amostraAlvo} posts medidos` })
      return { kicker: 'Fim de expediente', sub, cta: { rotulo: 'Ver o resumo do dia', href: hrefOu(d, ['analise', '/pro-labore/sm/desempenho'], ['producao', '/pro-labore/sm/calendario']) }, listaTitulo: 'Amanhã cedo', itens: completar(itens, d), perguntas: ['atd:hoje', 'des:alcance', 'cal:semana'] }
    }
  }
}

/** Fora do expediente (regra 5): nada em vermelho, só o resumo e o que espera amanhã. */
function respeitarExpediente(itens: ItemRecepcao[], fora: boolean): ItemRecepcao[] {
  if (!fora) return itens
  return itens.map(i => (i.tom === 'bad' ? { tom: 'neutro', rotulo: 'Para amanhã', texto: i.texto } : i))
}

const ABA_DO_PREFIXO: Record<string, Aba> = { cal: 'calendario', prod: 'producao', atd: 'atendimento', des: 'desempenho', atr: 'atribuicao' }
const MODULO_DA_ABA: Record<string, Parameters<ContextoSM['pode']>[0]> = { calendario: 'producao', producao: 'producao', atendimento: 'atendimento', desempenho: 'analise', atribuicao: 'vendas' }

/** As 3 perguntas sugeridas do momento, das abas que a pessoa pode ver. */
async function perguntasDoMomento(sm: ContextoSM, preferidas: string[], agora: Date) {
  const abas = [...new Set(preferidas.map(p => ABA_DO_PREFIXO[p.split(':')[0]]))].filter(a => sm.pode(MODULO_DA_ABA[a], 'LEITURA'))
  const porAba = await Promise.all(abas.map(async a => ({ a, q: await perguntasDaAba(sm, a, agora) })))
  const todas = porAba.flatMap(x => x.q.map(q => ({ aba: x.a, ...q })))
  const r: Array<{ aba: Aba; id: string; texto: string }> = []
  for (const p of preferidas) {
    const q = todas.find(x => (x.id === p || x.id.startsWith(`${p}:`)) && !r.some(y => y.id === x.id))
    if (q) r.push(q)
    if (r.length === 3) break
  }
  return r
}

// ---------- Visita, frase e montagem ----------

const SEMANA_MS = 7 * DIA_MS

function bemVindo(genero: string | null) { return genero === 'F' ? 'Bem-vinda' : genero === 'M' ? 'Bem-vindo' : 'Boas-vindas' }
function saudacaoDaHora(agora: Date) { const p = periodoDoDia(agora); return p === 'MANHA' ? 'Bom dia' : p === 'TARDE' ? 'Boa tarde' : 'Boa noite' }
export function preencherFrase(texto: string, nome: string, genero: string | null, agora: Date) {
  return texto.replace(/\{nome\}/g, nome).replace(/\{bemvindo\}/g, bemVindo(genero)).replace(/\{saudacao\}/g, saudacaoDaHora(agora))
}

/** Frase do momento para a pessoa: a mesma do dia, se já saiu hoje; senão, a primeira que não apareceu nos últimos 7 dias. */
async function escolherFrase(usuarioId: string, ator: string, momento: Momento, agora: Date) {
  await garantirFrases()
  const frases = await prisma.smSaudacaoFrase.findMany({ where: { momento, ativa: true }, orderBy: { ordem: 'asc' } })
  if (!frases.length) return null
  const deHoje = await prisma.smVisita.findFirst({ where: { usuarioId, ator, momento, inicioEm: { gte: inicioDoDia(diaLocal(agora)) }, fraseId: { not: null } }, orderBy: { inicioEm: 'desc' }, select: { fraseId: true } })
  const mesma = deHoje && frases.find(f => f.id === deHoje.fraseId)
  if (mesma) return mesma
  const exibidas = await prisma.smSaudacaoExibida.findMany({ where: { usuarioId, ator, fraseId: { in: frases.map(f => f.id) } }, orderBy: { exibidaEm: 'desc' }, select: { fraseId: true, exibidaEm: true } })
  const ultimaVez = new Map<string, number>()
  for (const e of exibidas) if (!ultimaVez.has(e.fraseId)) ultimaVez.set(e.fraseId, e.exibidaEm.getTime())
  const livre = frases.find(f => !ultimaVez.has(f.id) || agora.getTime() - ultimaVez.get(f.id)! >= SEMANA_MS)
  const f = livre ?? [...frases].sort((a, b) => ultimaVez.get(a.id)! - ultimaVez.get(b.id)!)[0]
  await prisma.smSaudacaoExibida.create({ data: { usuarioId, ator, fraseId: f.id, exibidaEm: agora } })
  return f
}

export async function generoDe(usuarioId: string, ator: string) {
  return (await prisma.smPreferencia.findUnique({ where: { usuarioId_ator: { usuarioId, ator } }, select: { genero: true } }))?.genero ?? null
}

/** Quem a saudação chama: o Social Media (também no "ver como") ou o gestor. */
async function pessoaDaSaudacao(sm: ContextoSM, nomeGestor: string) {
  if (sm.visao === 'SOCIAL_MEDIA') {
    const m = await prisma.smMembro.findUnique({ where: { usuarioId: sm.usuarioId }, select: { id: true, nome: true, tratamento: true } })
    return { nome: m?.tratamento ?? m?.nome?.split(' ')[0] ?? 'Social Media', ator: m?.id ?? 'SOCIAL_MEDIA' }
  }
  return { nome: nomeGestor.split(' ')[0], ator: 'GESTOR' }
}

/**
 * Recepção da tela Hoje. `retorno`: a aba voltou depois de 30 min escondida,
 * então começa uma visita nova. No "ver como", nada é gravado.
 */
export async function montarRecepcao(sm: ContextoSM, nomeGestor: string, agora = new Date(), opcoes: { retorno?: boolean } = {}): Promise<Recepcao> {
  const pessoa = await pessoaDaSaudacao(sm, nomeGestor)
  const ator = sm.verComo ? pessoa.ator : atorDe(sm)
  const genero = await generoDe(sm.usuarioId, ator)
  if (sm.verComo) {
    const d = await carregarDados(sm, agora, null)
    const aplica = await momentosQueSeAplicam(sm, d)
    const momento = MOMENTOS.find(m => aplica[m])!
    const frase = (await prisma.smSaudacaoFrase.findFirst({ where: { momento, ativa: true }, orderBy: { ordem: 'asc' } })) ?? null
    return montar(sm, d, momento, frase, pessoa.nome, genero, null, false)
  }
  const ultima = await prisma.smVisita.findFirst({ where: { usuarioId: sm.usuarioId, ator }, orderBy: { inicioEm: 'desc' } })
  if (ultima && !opcoes.retorno && agora.getTime() - ultima.ultimaAtividadeEm.getTime() < INATIVIDADE_MS) {
    await prisma.smVisita.update({ where: { id: ultima.id }, data: { ultimaAtividadeEm: agora } })
    const d = await carregarDados(sm, agora, ultima.anteriorEm)
    const frase = ultima.fraseId ? await prisma.smSaudacaoFrase.findUnique({ where: { id: ultima.fraseId } }) : null
    return montar(sm, d, ultima.momento as Momento, frase, pessoa.nome, genero, ultima.id, ultima.recolhida)
  }
  const anteriorEm = ultima?.ultimaAtividadeEm ?? null
  const d = await carregarDados(sm, agora, anteriorEm)
  const aplica = await momentosQueSeAplicam(sm, d)
  const momento = MOMENTOS.find(m => aplica[m])!
  const frase = await escolherFrase(sm.usuarioId, ator, momento, agora)
  const visita = await prisma.smVisita.create({ data: { usuarioId: sm.usuarioId, ator, inicioEm: agora, ultimaAtividadeEm: agora, anteriorEm, momento, fraseId: frase?.id ?? null } })
  return montar(sm, d, momento, frase, pessoa.nome, genero, visita.id, false)
}

async function montar(sm: ContextoSM, d: Dados, momento: Momento, frase: { id: string; texto: string } | null, nome: string, genero: string | null, visitaId: string | null, recolhida: boolean): Promise<Recepcao> {
  // Um momento que deixou de valer no meio da visita (ex.: a venda saiu do CRM) cai no momento do horário.
  const valido = (momento === 'VOLTA' && !d.anteriorEm) || (momento === 'VENDA' && !d.venda) ? periodoDoDia(d.agora) : momento
  const c = conteudo(valido, d, bemVindo(genero))
  return {
    visitaId, momento: valido, kicker: c.kicker,
    titulo: preencherFrase(frase && valido === momento ? frase.texto : FRASES[valido][0], nome, genero, d.agora),
    sub: c.sub, cta: c.cta, listaTitulo: c.listaTitulo,
    itens: respeitarExpediente(c.itens, d.foraDoExpediente),
    perguntas: await perguntasDoMomento(sm, c.perguntas, d.agora),
    recolhida, foraDoExpediente: d.foraDoExpediente, fraseId: frase?.id ?? null,
  }
}

/**
 * Simulador de momentos (tela 13, rota interna do gestor): a recepção de um
 * momento escolhido, com os dados reais e sem gravar nada; e o banco de
 * frases do momento com a última vez que cada uma apareceu para a pessoa.
 */
export async function simularRecepcao(smPessoa: ContextoSM, nomeGestor: string, momento: Momento, genero: string | null, fraseId: string | null, agora = new Date()) {
  await garantirFrases()
  const pessoa = await pessoaDaSaudacao(smPessoa, nomeGestor)
  const ultima = await prisma.smVisita.findFirst({ where: { usuarioId: smPessoa.usuarioId, ator: pessoa.ator }, orderBy: { inicioEm: 'desc' }, select: { ultimaAtividadeEm: true } })
  // "Volta de folga" e "venda" precisam de um último acesso: sem ele, simula como se fosse há 3 dias.
  const anteriorEm = momento === 'VOLTA' || momento === 'VENDA' ? (ultima && agora.getTime() - ultima.ultimaAtividadeEm.getTime() > 2 * DIA_MS ? ultima.ultimaAtividadeEm : new Date(agora.getTime() - 3 * DIA_MS)) : ultima?.ultimaAtividadeEm ?? null
  const d = await carregarDados(smPessoa, agora, anteriorEm)
  const aplica = await momentosQueSeAplicam(smPessoa, { ...d, anteriorEm: ultima?.ultimaAtividadeEm ?? null })
  const frases = await prisma.smSaudacaoFrase.findMany({ where: { momento }, orderBy: { ordem: 'asc' } })
  const exibidas = await prisma.smSaudacaoExibida.findMany({ where: { usuarioId: smPessoa.usuarioId, ator: pessoa.ator, fraseId: { in: frases.map(f => f.id) } }, orderBy: { exibidaEm: 'desc' } })
  const frase = frases.find(f => f.id === fraseId) ?? frases[0] ?? null
  // Venda simulada quando não há uma de verdade: o momento mostra que não teria o que dizer.
  const semDados = momento === 'VENDA' && !d.venda
  const r = semDados ? null : await montarComo(smPessoa, d, momento, frase, pessoa.nome, genero)
  return {
    pessoa: pessoa.nome,
    momentos: MOMENTOS.map(m => ({ id: m, ...MOMENTO_INFO[m], aplicaAgora: aplica[m] })),
    vence: MOMENTOS.find(m => aplica[m])!,
    recepcao: r,
    aviso: semDados ? 'Nenhuma venda vinda de post foi registrada desde o último acesso de quem você está simulando.' : null,
    frases: frases.map(f => ({ id: f.id, texto: preencherFrase(f.texto, pessoa.nome, genero, agora), ultimaVez: exibidas.find(e => e.fraseId === f.id)?.exibidaEm ?? null })),
  }
}

async function montarComo(sm: ContextoSM, d: Dados, momento: Momento, frase: { id: string; texto: string } | null, nome: string, genero: string | null) {
  const c = conteudo(momento, d, bemVindo(genero))
  return {
    visitaId: null, momento, kicker: c.kicker, titulo: preencherFrase(frase?.texto ?? FRASES[momento][0], nome, genero, d.agora),
    sub: c.sub, cta: c.cta, listaTitulo: c.listaTitulo, itens: respeitarExpediente(c.itens, d.foraDoExpediente),
    perguntas: await perguntasDoMomento(sm, c.perguntas, d.agora), recolhida: false, foraDoExpediente: d.foraDoExpediente, fraseId: frase?.id ?? null,
  } satisfies Recepcao
}

/** Depois da primeira ação, o bloco recolhe numa linha (regra 4). */
export async function recolherVisita(sm: ContextoSM, visitaId: string) {
  await prisma.smVisita.updateMany({ where: { id: visitaId, usuarioId: sm.usuarioId, ator: atorDe(sm) }, data: { recolhida: true } })
}
