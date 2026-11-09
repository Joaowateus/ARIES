// PDF 04 · 4.2 Hoje por papel: a tela inicial de cada pessoa. Cabeçalho com a
// pergunta do papel, três números do dicionário, a fila de ação na ordem
// aprovada e a Lente do ARIES. Supervisor ganha o quadro da equipe; o dono, o
// painel por área. Todo número vem do dicionário (P2); nada aqui executa ação
// sozinho (a Lente só leva à ação).
import { randomUUID } from 'crypto'
import { prisma } from './prisma'
import { calcular, fichas, hojeBrt, ler, mesCorrente, metaDoMes, padraoDaLoja, faixaDe, type Escopo, type Leitura, type Periodo } from './metricas'
import { NOME_ETAPA, type Etapa } from './etapasJornada'
import { premissas } from './jornadaPremissas'
import { podeVerRec } from './recomendacoes'
import type { PapelHoje } from './papelHoje'

const MIN = 60_000, H = 60 * MIN, DIA = 24 * H

export interface Pessoa { usuarioId: string; papel: PapelHoje; id: string; vendedorId: string | null; nome: string }

// --- Configuração do Hoje por papel (seção 5: papel, três números, ordem da fila, Lente) ---

type PeriodoNum = 'MES' | 'HOJE' | 'SEMANA' | 'AGORA'
type Alvo = 'META_VENDAS' | 'META_MES' | 'META_SDR_DIA' | 'ORCAMENTO' | 'PLANEJADOS'
interface NumeroCfg { chave: string; periodo: PeriodoNum; alvo?: Alvo; escopo?: 'PROPRIO' | 'LOJA' }
interface ConfigHoje { pergunta: string; numeros: NumeroCfg[]; fila: string[]; lente: string }

export const CONFIG_PADRAO: Record<PapelHoje, ConfigHoje> = {
  VENDEDOR: {
    pergunta: 'O que eu preciso fazer agora para bater a meta?',
    numeros: [{ chave: 'vendas', periodo: 'MES', alvo: 'META_VENDAS' }, { chave: 'vendas_por_dia_necessarias', periodo: 'AGORA' }, { chave: 'clientes_esperando', periodo: 'AGORA' }],
    fila: ['ESPERANDO', 'VISITA_HOJE', 'SQL_RECEBIDO', 'ATRASADA', 'DE_HOJE', 'TEMPO_LIVRE'],
    lente: 'Suas orientações individuais, cada uma com aceitar ou descartar com motivo',
  },
  SDR: {
    pergunta: 'Quem eu preciso responder e qualificar agora?',
    numeros: [{ chave: 'leads_sem_primeira_resposta', periodo: 'AGORA' }, { chave: 'leads_passados', periodo: 'HOJE', alvo: 'META_SDR_DIA' }, { chave: 'fichas_aguardando_banco', periodo: 'AGORA' }],
    fila: ['SEM_RESPOSTA', 'APROVADO_NAO_PASSADO', 'FICHA_SEM_RESPOSTA', 'FICHA_PRONTA', 'DEVOLVIDO', 'LEVANTAMENTO_FALTANDO', 'ATRASADA'],
    lente: 'Suas orientações individuais e a taxa de devolução da semana',
  },
  SUPERVISOR: {
    pergunta: 'Onde a equipe precisa de mim agora?',
    numeros: [{ chave: 'previsao_fechamento', periodo: 'MES', alvo: 'META_MES', escopo: 'LOJA' }, { chave: 'clientes_esperando', periodo: 'AGORA', escopo: 'LOJA' }, { chave: 'itens_escalonados', periodo: 'AGORA' }],
    fila: ['SENSIVEL', 'ESPERANDO_EQUIPE', 'ESCALONAMENTO', 'REC_EQUIPE'],
    lente: 'Recomendações de equipe e de etapa',
  },
  DONO: {
    pergunta: 'Como está o negócio e o que depende de mim?',
    numeros: [{ chave: 'previsao_fechamento', periodo: 'MES', alvo: 'META_MES' }, { chave: 'pro_labore', periodo: 'MES' }, { chave: 'decisoes_aguardando', periodo: 'AGORA' }],
    fila: ['VENDA_A_CONFIRMAR', 'PAGAMENTO_A_APROVAR', 'MUDANCA_REGRA', 'META_SUGERIDA'],
    lente: 'Os três maiores riscos e as três maiores Recomendações da operação',
  },
  TRAFEGO: {
    pergunta: 'O dinheiro em anúncio está virando venda?',
    numeros: [{ chave: 'gasto_anuncio', periodo: 'MES', alvo: 'ORCAMENTO' }, { chave: 'custo_por_lead', periodo: 'MES' }, { chave: 'roas', periodo: 'MES' }],
    fila: ['RITMO_ORCAMENTO', 'CRIATIVO_FADIGA', 'CAMPANHA_LEADS_FRACOS'],
    lente: 'Recomendações de anúncios',
  },
  FINANCEIRO: {
    pergunta: 'O que precisa ser pago ou conferido?',
    numeros: [{ chave: 'comissoes_a_pagar', periodo: 'AGORA' }, { chave: 'pagamentos_semana', periodo: 'AGORA' }, { chave: 'divergencias_vendas_financeiro', periodo: 'AGORA' }],
    fila: ['PAGAMENTO_A_LANCAR', 'COMPROVANTE_FALTANDO', 'DIVERGENCIA'],
    lente: 'Previsão de comissões e saídas',
  },
  SOCIAL_MEDIA: {
    pergunta: 'O que publicar hoje e o que funcionou?',
    numeros: [{ chave: 'posts_publicados', periodo: 'SEMANA', alvo: 'PLANEJADOS' }, { chave: 'leads_dos_posts', periodo: 'SEMANA' }, { chave: 'vendas_por_post', periodo: 'MES' }],
    fila: ['PAUTA_DO_DIA', 'APROVACAO_PEDIDA', 'DIRECT_SEM_RESPOSTA'],
    lente: 'Pautas sugeridas pelas conversas e pelo estoque parado',
  },
}

/** Configuração do papel: a guardada pelo dono (seção 5) ou a padrão aprovada no PDF. */
export async function configDoPapel(usuarioId: string, papel: PapelHoje): Promise<ConfigHoje> {
  const salva = await prisma.hojeConfig.findUnique({ where: { usuarioId_papel: { usuarioId, papel } } })
  const base = CONFIG_PADRAO[papel]
  if (!salva) return base
  const numeros = salva.numeros.length === 3 ? salva.numeros.map((c, i) => ({ ...(base.numeros.find(n => n.chave === c) ?? base.numeros[i]), chave: c })) : base.numeros
  return { ...base, numeros, fila: salva.fila.length ? salva.fila : base.fila, lente: salva.lente ?? base.lente }
}

// --- Números ---

const semanaAtual = (agora: Date): Periodo => {
  const h = hojeBrt(agora), d = new Date(`${h}T00:00:00Z`), dow = (d.getUTCDay() + 6) % 7
  const ini = new Date(d.getTime() - dow * DIA), fim = new Date(ini.getTime() + 6 * DIA)
  return { inicio: ini.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) }
}
export function periodoDe(p: PeriodoNum, agora: Date): Periodo {
  const h = hojeBrt(agora)
  if (p === 'MES') return mesCorrente(agora)
  if (p === 'SEMANA') return semanaAtual(agora)
  return { inicio: h, fim: h }
}

export interface NumeroHoje {
  chave: string; nome: string; unidade: string; melhor: string
  periodo: Periodo; tipoPeriodo: PeriodoNum
  valor: number | null; anterior: Leitura['anterior']; variacao: number | null; projecao: number | null
  alvo: { valor: number | null; rotulo: string } | null
  status: 'BOM' | 'ATENCAO' | 'CRITICO' | null
  detalhe: unknown; naoDefinido: string | null
  ficha: { definicao: string; formula: string; fonte: string }
}

function statusContraAlvo(valor: number | null, alvo: number | null, melhor: string): NumeroHoje['status'] {
  if (valor == null || alvo == null || alvo <= 0) return null
  return faixaDe(valor, alvo, melhor === 'MENOR' ? 'MENOR' : 'MAIOR')
}

export async function numerosDoHoje(pessoa: Pessoa, agora = new Date()): Promise<NumeroHoje[]> {
  const cfg = await configDoPapel(pessoa.usuarioId, pessoa.papel)
  const lista = await fichas(pessoa.usuarioId)
  const pessoal = pessoa.papel === 'VENDEDOR' || pessoa.papel === 'SDR'
  return Promise.all(cfg.numeros.map(async n => {
    const ficha = lista.find(f => f.chave === n.chave)!
    const vendedorId = n.escopo === 'LOJA' ? null : pessoal ? pessoa.vendedorId ?? '__nenhum__' : n.chave === 'itens_escalonados' ? pessoa.vendedorId : null
    const e: Escopo = { usuarioId: pessoa.usuarioId, papel: pessoa.papel, vendedorId }
    const periodo = periodoDe(n.periodo, agora)
    const l = await ler(n.chave, e, periodo, agora)
    let alvo: NumeroHoje['alvo'] = null
    if (n.alvo === 'META_VENDAS') {
      const d = (await calcular('vendas_por_dia_necessarias', e, periodo, agora)).detalhe as { metaVendas?: number } | undefined
      alvo = { valor: d?.metaVendas ?? null, rotulo: 'meta do mês em vendas' }
    } else if (n.alvo === 'META_MES') alvo = { valor: await metaDoMes(e), rotulo: 'meta do mês' }
    else if (n.alvo === 'META_SDR_DIA') alvo = { valor: (l.detalhe as { metaPeriodo?: number | null })?.metaPeriodo ?? null, rotulo: 'meta do dia' }
    else if (n.alvo === 'ORCAMENTO') alvo = { valor: (l.detalhe as { orcamentoMensal?: number | null })?.orcamentoMensal ?? null, rotulo: 'orçamento do mês' }
    else if (n.alvo === 'PLANEJADOS') alvo = { valor: (l.detalhe as { planejados?: number })?.planejados ?? null, rotulo: 'planejados na semana' }
    // Gasto contra o orçamento: o bom é ficar no ritmo (projeção até o orçamento).
    const comparado = l.projecao ?? l.valor
    const status = alvo ? (n.alvo === 'ORCAMENTO' ? statusContraAlvo(comparado, alvo.valor, 'MENOR') : statusContraAlvo(comparado, alvo.valor, l.melhor)) : l.faixa
    return {
      chave: n.chave, nome: ficha.nome, unidade: ficha.unidade, melhor: ficha.melhor, periodo, tipoPeriodo: n.periodo,
      valor: l.valor, anterior: l.anterior, variacao: l.variacao, projecao: l.projecao, alvo, status, detalhe: l.detalhe, naoDefinido: ficha.naoDefinido ?? null,
      ficha: { definicao: ficha.definicao, formula: ficha.formula, fonte: ficha.fonte },
    }
  }))
}

// --- Fila de ação ---

export interface ItemFila {
  grupo: string; ordem: number; titulo: string; detalhe: string; quando: string | null
  ref: { tipo: string; id: string } | null; href: string | null
  acao: { rotulo: string; tipo: 'LINK' | 'PASSAR_AO_VENDEDOR' | 'CONCLUIR_ATV' | 'REC'; href?: string } | null
  extensao?: boolean
}
const GRUPO_NOME: Record<string, string> = {
  ESPERANDO: 'Clientes esperando resposta', VISITA_HOJE: 'Visitas de hoje', SQL_RECEBIDO: 'Primeiros contatos de SQL recebidos', ATRASADA: 'Atrasadas', DE_HOJE: 'De hoje', TEMPO_LIVRE: 'Para o tempo livre',
  SEM_RESPOSTA: 'Leads novos sem resposta', APROVADO_NAO_PASSADO: 'Aprovados para passar ao vendedor', FICHA_SEM_RESPOSTA: 'Fichas sem resposta do banco além do normal', FICHA_PRONTA: 'Fichas prontas para enviar', DEVOLVIDO: 'Devolvidos pelo vendedor', LEVANTAMENTO_FALTANDO: 'Levantamentos com critério faltando',
  SENSIVEL: 'Conversas encaminhadas a uma pessoa', ESPERANDO_EQUIPE: 'Clientes esperando há mais tempo', ESCALONAMENTO: 'Escalonamentos da régua', REC_EQUIPE: 'Recomendações de equipe e de etapa',
  VENDA_A_CONFIRMAR: 'Vendas a confirmar', PAGAMENTO_A_APROVAR: 'Pagamentos a aprovar', MUDANCA_REGRA: 'Mudanças de regra e parâmetro', META_SUGERIDA: 'Metas sugeridas',
  RITMO_ORCAMENTO: 'Ritmo do orçamento', CRIATIVO_FADIGA: 'Criativos com fadiga', CAMPANHA_LEADS_FRACOS: 'Campanhas com leads fracos no CRM',
  PAGAMENTO_A_LANCAR: 'Pagamentos a lançar', COMPROVANTE_FALTANDO: 'Comprovantes faltando', DIVERGENCIA: 'Divergências para conferir',
  PAUTA_DO_DIA: 'Pautas do dia', APROVACAO_PEDIDA: 'Aprovações pedidas pelo gestor', DIRECT_SEM_RESPOSTA: 'Directs e comentários sem resposta',
}
export const nomeDoGrupo = (g: string) => GRUPO_NOME[g] ?? g

const minTxt = (min: number) => (min < 60 ? `${Math.max(1, Math.round(min))} min` : min < 24 * 60 ? `${Math.round(min / 60)} h` : `${Math.round(min / 1440)} dias`)
const hora = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
const primeiro = (s: string | null | undefined) => (s ?? '').trim().split(/\s+/)[0] || 'Cliente'
const inicioDoDia = (agora: Date) => new Date(`${hojeBrt(agora)}T03:00:00.000Z`)

async function esperando(usuarioId: string, vendedorId: string | null, agora: Date, minimoMin = 0) {
  const e: Escopo = { usuarioId, papel: 'DONO', vendedorId }
  const ids = ((await calcular('clientes_esperando', e, { inicio: hojeBrt(agora), fim: hojeBrt(agora) }, agora)).detalhe as { ids: string[] }).ids
  if (!ids.length) return []
  const cs = await prisma.assistenteConversa.findMany({ where: { id: { in: ids } }, select: { id: true, nomeContato: true, leadId: true, aguardandoVendedorEm: true, ultimaMensagemEm: true, resultado: true, assistente: { select: { vendedorId: true, vendedor: { select: { nome: true } } } } } })
  return cs.map(c => ({ ...c, desde: c.aguardandoVendedorEm ?? c.ultimaMensagemEm, min: (agora.getTime() - (c.aguardandoVendedorEm ?? c.ultimaMensagemEm).getTime()) / MIN }))
    .filter(c => c.min >= minimoMin).sort((a, b) => a.desde.getTime() - b.desde.getTime())
}

async function atividadesDe(usuarioId: string, responsavelId: string, agora: Date) {
  const fimHoje = new Date(inicioDoDia(agora).getTime() + DIA)
  return prisma.atividade.findMany({
    where: { usuarioId, responsavelId, status: 'PENDENTE', prazo: { lt: fimHoje } },
    select: { id: true, codigo: true, tipo: true, prazo: true, oQueFazer: true, leadId: true, origemTipo: true },
    orderBy: { prazo: 'asc' }, take: 200,
  })
}

export async function filaDoHoje(pessoa: Pessoa, agora = new Date()): Promise<ItemFila[]> {
  const cfg = await configDoPapel(pessoa.usuarioId, pessoa.papel)
  const u = pessoa.usuarioId, eu = pessoa.vendedorId
  const itens: ItemFila[] = []
  const ordem = (g: string) => cfg.fila.indexOf(g)
  const add = (g: string, i: Omit<ItemFila, 'grupo' | 'ordem'>) => { if (ordem(g) >= 0) itens.push({ grupo: g, ordem: ordem(g), ...i }) }
  const fimHoje = new Date(inicioDoDia(agora).getTime() + DIA)

  if (pessoa.papel === 'VENDEDOR' && eu) {
    for (const c of await esperando(u, eu, agora)) add('ESPERANDO', { titulo: `${primeiro(c.nomeContato)} está esperando resposta`, detalhe: `há ${minTxt(c.min)}`, quando: c.desde.toISOString(), ref: { tipo: 'CONVERSA', id: c.id }, href: `/pro-labore/whatsapp?conversa=${c.id}`, acao: { rotulo: 'Responder', tipo: 'LINK', href: `/pro-labore/whatsapp?conversa=${c.id}` } })
    const visitas = await prisma.leadVisita.findMany({ where: { usuarioId: u, vendedorId: eu, marcadaPara: { gte: inicioDoDia(agora), lt: fimHoje }, checkinEm: null, falta: false }, orderBy: { marcadaPara: 'asc' }, select: { id: true, marcadaPara: true, leadId: true, lead: { select: { nomeCliente: true, modeloInteresse: true } } } })
    for (const v of visitas) add('VISITA_HOJE', { titulo: `Visita de ${primeiro(v.lead.nomeCliente)} às ${hora(v.marcadaPara)}`, detalhe: v.lead.modeloInteresse ?? 'Confirmar e preparar a moto', quando: v.marcadaPara.toISOString(), ref: { tipo: 'LEAD', id: v.leadId }, href: `/pro-labore/leads?lead=${v.leadId}`, acao: { rotulo: 'Abrir o cliente', tipo: 'LINK', href: `/pro-labore/leads?lead=${v.leadId}` } })
    const passagens = await prisma.leadPassagem.findMany({ where: { usuarioId: u, vendedorId: eu, devolvida: false, passadaEm: { gte: new Date(agora.getTime() - 7 * DIA) }, lead: { etapa: 'SQL', perdidoEm: null } }, orderBy: { passadaEm: 'asc' }, select: { leadId: true, passadaEm: true, resumo: true, lead: { select: { nomeCliente: true } } } })
    for (const p of passagens) add('SQL_RECEBIDO', { titulo: `Primeiro contato com ${primeiro(p.lead.nomeCliente)} (aprovado)`, detalhe: p.resumo?.slice(0, 120) || 'Recebido do SDR', quando: p.passadaEm.toISOString(), ref: { tipo: 'LEAD', id: p.leadId }, href: `/pro-labore/leads?lead=${p.leadId}`, acao: { rotulo: 'Fazer o primeiro contato', tipo: 'LINK', href: `/pro-labore/leads?lead=${p.leadId}` } })
    const atvs = await atividadesDe(u, eu, agora)
    const notas = new Map((await prisma.lead.findMany({ where: { id: { in: atvs.map(a => a.leadId).filter((x): x is string => !!x) } }, select: { id: true, pontuacao: true } })).map(l => [l.id, l.pontuacao ?? 0]))
    for (const a of atvs.filter(a => a.prazo < agora)) add('ATRASADA', { titulo: a.oQueFazer ?? a.tipo, detalhe: `${a.codigo ?? ''} · venceu há ${minTxt((agora.getTime() - a.prazo.getTime()) / MIN)}`, quando: a.prazo.toISOString(), ref: { tipo: 'ATV', id: a.id }, href: a.leadId ? `/pro-labore/leads?lead=${a.leadId}` : '/pro-labore/atividades', acao: { rotulo: 'Concluir', tipo: 'CONCLUIR_ATV' } })
    const deHoje = atvs.filter(a => a.prazo >= agora).sort((a, b) => (notas.get(b.leadId ?? '') ?? 0) - (notas.get(a.leadId ?? '') ?? 0))
    for (const a of deHoje) add('DE_HOJE', { titulo: a.oQueFazer ?? a.tipo, detalhe: `${a.codigo ?? ''} · até ${hora(a.prazo)}${a.leadId && notas.get(a.leadId) ? ` · chance ${notas.get(a.leadId)}/100` : ''}`, quando: a.prazo.toISOString(), ref: { tipo: 'ATV', id: a.id }, href: a.leadId ? `/pro-labore/leads?lead=${a.leadId}` : '/pro-labore/atividades', acao: { rotulo: 'Concluir', tipo: 'CONCLUIR_ATV' } })
    // Tempo livre: leads parados com mais chance de voltar e Reativação de prioridade alta.
    const parados = ((await calcular('leads_parados', { usuarioId: u, papel: 'VENDEDOR', vendedorId: eu }, { inicio: hojeBrt(agora), fim: hojeBrt(agora) }, agora)).detalhe as { ids?: string[] } | undefined)?.ids ?? []
    const livres = await prisma.lead.findMany({ where: { usuarioId: u, vendedorId: eu, OR: [{ id: { in: parados } }, { perdidoEm: { not: null }, temperatura: 'QUENTE', destinoPerda: 'REATIVACAO' }], NOT: { cliente: { is: { bloqueado: true } } } }, orderBy: { pontuacao: 'desc' }, take: 3, select: { id: true, nomeCliente: true, pontuacao: true, perdidoEm: true, etapa: true } })
    for (const l of livres) add('TEMPO_LIVRE', { titulo: l.perdidoEm ? `Reaquecer ${primeiro(l.nomeCliente)} (Reativação, prioridade alta)` : `Retomar ${primeiro(l.nomeCliente)} (parado em ${NOME_ETAPA[(l.etapa ?? 'LEAD') as Etapa] ?? l.etapa})`, detalhe: l.pontuacao != null ? `chance ${l.pontuacao}/100` : 'Sugestão para o tempo livre', quando: null, ref: { tipo: 'LEAD', id: l.id }, href: l.perdidoEm ? '/pro-labore/reativacao' : `/pro-labore/leads?lead=${l.id}`, acao: { rotulo: l.perdidoEm ? 'Reaquecer' : 'Retomar', tipo: 'LINK', href: l.perdidoEm ? '/pro-labore/reativacao' : `/pro-labore/leads?lead=${l.id}` } })
  }

  if (pessoa.papel === 'SDR' && eu) {
    const e: Escopo = { usuarioId: u, papel: 'SDR', vendedorId: eu }
    const hoje = { inicio: hojeBrt(agora), fim: hojeBrt(agora) }
    const semResp = ((await calcular('leads_sem_primeira_resposta', e, hoje, agora)).detalhe as { ids: string[] }).ids
    const novos = await prisma.lead.findMany({ where: { id: { in: semResp } }, orderBy: { criadoEm: 'asc' }, select: { id: true, nomeCliente: true, criadoEm: true } })
    for (const l of novos) add('SEM_RESPOSTA', { titulo: `${primeiro(l.nomeCliente)} ainda não teve resposta`, detalhe: `chegou há ${minTxt((agora.getTime() - l.criadoEm.getTime()) / MIN)}`, quando: l.criadoEm.toISOString(), ref: { tipo: 'LEAD', id: l.id }, href: `/pro-labore/leads?lead=${l.id}`, acao: { rotulo: 'Responder', tipo: 'LINK', href: `/pro-labore/leads?lead=${l.id}` } })
    const sqls = await prisma.lead.findMany({ where: { usuarioId: u, etapa: 'SQL', perdidoEm: null, vendaId: null, OR: [{ responsavelQualificacaoId: eu }, { responsavelQualificacaoId: null, vendedorId: eu }], passagens: { none: { devolvida: false } } }, select: { id: true, nomeCliente: true, entrouNaEtapaEm: true, fichasCredito: { select: { analises: { where: { status: 'APROVADA' }, select: { validadeAte: true, banco: true } } } } } })
    const comValidade = sqls.map(l => ({ ...l, vence: l.fichasCredito.flatMap(f => f.analises).map(a => a.validadeAte).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0] ?? null }))
      .sort((a, b) => (a.vence?.getTime() ?? Infinity) - (b.vence?.getTime() ?? Infinity))
    for (const l of comValidade) add('APROVADO_NAO_PASSADO', { titulo: `${primeiro(l.nomeCliente)} aprovado: passar ao vendedor`, detalhe: l.vence ? `aprovação vence em ${l.vence.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : 'aprovação sem validade registrada', quando: l.vence?.toISOString() ?? null, ref: { tipo: 'LEAD', id: l.id }, href: `/pro-labore/leads?lead=${l.id}`, acao: { rotulo: 'Passar ao vendedor', tipo: 'PASSAR_AO_VENDEDOR' } })
    const fichas = (await calcular('fichas_aguardando_banco', e, hoje, agora)).detalhe as { idsAlem: string[] }
    const alem = await prisma.assistenteAnaliseCredito.findMany({ where: { id: { in: fichas.idsAlem } }, orderBy: { enviadaEm: 'asc' }, select: { id: true, banco: true, enviadaEm: true, ficha: { select: { leadId: true, conversa: { select: { nomeContato: true } } } } } })
    for (const a of alem) add('FICHA_SEM_RESPOSTA', { titulo: `Cobrar o ${a.banco}: ficha de ${primeiro(a.ficha.conversa?.nomeContato)}`, detalhe: `enviada há ${minTxt((agora.getTime() - (a.enviadaEm?.getTime() ?? agora.getTime())) / MIN)}`, quando: a.enviadaEm?.toISOString() ?? null, ref: { tipo: 'FICHA', id: a.id }, href: '/pro-labore/credito', acao: { rotulo: 'Cobrar a ficha', tipo: 'LINK', href: '/pro-labore/credito' } })
    const prontas = await prisma.assistenteAnaliseCredito.findMany({ where: { usuarioId: u, status: 'A_ENVIAR', ficha: { lead: { OR: [{ responsavelQualificacaoId: eu }, { responsavelQualificacaoId: null, vendedorId: eu }] } } }, orderBy: { criadoEm: 'asc' }, select: { id: true, banco: true, criadoEm: true, ficha: { select: { conversa: { select: { nomeContato: true } } } } } })
    for (const a of prontas) add('FICHA_PRONTA', { titulo: `Enviar a ficha de ${primeiro(a.ficha.conversa?.nomeContato)} ao ${a.banco}`, detalhe: 'Pronta para enviar', quando: a.criadoEm.toISOString(), ref: { tipo: 'FICHA', id: a.id }, href: '/pro-labore/credito', acao: { rotulo: 'Enviar a ficha', tipo: 'LINK', href: '/pro-labore/credito' } })
    const devolvidos = await prisma.leadPassagem.findMany({ where: { usuarioId: u, sdrId: eu, devolvida: true, devolvidaEm: { gte: new Date(agora.getTime() - 14 * DIA) }, lead: { perdidoEm: null, etapa: { in: ['SQL', 'MQL', 'LEVANTAMENTO'] } } }, orderBy: { devolvidaEm: 'asc' }, select: { leadId: true, devolvidaEm: true, motivoDevolucao: true, lead: { select: { nomeCliente: true } } } })
    for (const d of devolvidos) add('DEVOLVIDO', { titulo: `${primeiro(d.lead.nomeCliente)} voltou do vendedor`, detalhe: `Motivo: ${d.motivoDevolucao ?? 'não informado'}`, quando: d.devolvidaEm?.toISOString() ?? null, ref: { tipo: 'LEAD', id: d.leadId }, href: `/pro-labore/leads?lead=${d.leadId}`, acao: { rotulo: 'Resolver e passar de novo', tipo: 'LINK', href: `/pro-labore/leads?lead=${d.leadId}` } })
    const prem = await premissas(u)
    const levs = await prisma.lead.findMany({ where: { usuarioId: u, etapa: 'LEVANTAMENTO', perdidoEm: null, levantamentoCompleto: false, OR: [{ responsavelQualificacaoId: eu }, { responsavelQualificacaoId: null, vendedorId: eu }] }, orderBy: { entrouNaEtapaEm: 'asc' }, take: 30, select: { id: true, nomeCliente: true, modeloInteresse: true, formaPagamento: true, situacaoCnh: true, temEntrada: true } })
    const NOMES: Record<string, [string, (l: typeof levs[number]) => boolean]> = { MODELO: ['modelo', l => !!l.modeloInteresse], PAGAMENTO: ['forma de pagamento', l => !!l.formaPagamento], CNH: ['CNH', l => !!l.situacaoCnh], ENTRADA: ['entrada', l => l.temEntrada != null] }
    for (const l of levs) {
      const falta = prem.criteriosLevantamento.filter(c => NOMES[c] && !NOMES[c][1](l)).map(c => NOMES[c][0])
      add('LEVANTAMENTO_FALTANDO', { titulo: `Completar o levantamento de ${primeiro(l.nomeCliente)}`, detalhe: falta.length ? `Falta: ${falta.join(', ')}` : 'Conferir os critérios', quando: null, ref: { tipo: 'LEAD', id: l.id }, href: `/pro-labore/leads?lead=${l.id}`, acao: { rotulo: 'Completar', tipo: 'LINK', href: `/pro-labore/leads?lead=${l.id}` } })
    }
    for (const a of (await atividadesDe(u, eu, agora)).filter(a => a.prazo < agora)) add('ATRASADA', { titulo: a.oQueFazer ?? a.tipo, detalhe: `${a.codigo ?? ''} · venceu há ${minTxt((agora.getTime() - a.prazo.getTime()) / MIN)}`, quando: a.prazo.toISOString(), ref: { tipo: 'ATV', id: a.id }, href: '/pro-labore/atividades', acao: { rotulo: 'Concluir', tipo: 'CONCLUIR_ATV' } })
  }

  if (pessoa.papel === 'SUPERVISOR') {
    const todos = await esperando(u, null, agora)
    for (const c of todos.filter(c => c.resultado === 'PEDIU_ATENDENTE')) add('SENSIVEL', { titulo: `${primeiro(c.nomeContato)} pediu para falar com uma pessoa`, detalhe: `com ${primeiro(c.assistente.vendedor.nome)} · há ${minTxt(c.min)}`, quando: c.desde.toISOString(), ref: { tipo: 'CONVERSA', id: c.id }, href: `/pro-labore/whatsapp?conversa=${c.id}`, acao: { rotulo: 'Ver a conversa', tipo: 'LINK', href: `/pro-labore/whatsapp?conversa=${c.id}` } })
    // Esperando há mais tempo: além de 30 min sem o vendedor responder, da maior espera para a menor.
    for (const c of todos.filter(c => c.resultado !== 'PEDIU_ATENDENTE' && c.min >= 30).slice(0, 15)) add('ESPERANDO_EQUIPE', { titulo: `${primeiro(c.nomeContato)} espera ${primeiro(c.assistente.vendedor.nome)} há ${minTxt(c.min)}`, detalhe: 'O vendedor ainda não respondeu', quando: c.desde.toISOString(), ref: { tipo: 'CONVERSA', id: c.id }, href: `/pro-labore/whatsapp?conversa=${c.id}`, acao: { rotulo: 'Intervir', tipo: 'LINK', href: `/pro-labore/whatsapp?conversa=${c.id}` } })
    const ids = ((await calcular('itens_escalonados', { usuarioId: u, papel: 'SUPERVISOR', vendedorId: eu }, { inicio: hojeBrt(agora), fim: hojeBrt(agora) }, agora)).detalhe as { ids: string[] }).ids
    const escal = await prisma.atividade.findMany({ where: { id: { in: ids } }, orderBy: { prazo: 'asc' }, select: { id: true, codigo: true, oQueFazer: true, prazo: true, responsavelId: true, leadId: true } })
    const nomes = new Map((await prisma.vendedor.findMany({ where: { usuarioId: u }, select: { id: true, nome: true } })).map(v => [v.id, primeiro(v.nome)]))
    for (const a of escal) add('ESCALONAMENTO', { titulo: a.oQueFazer ?? 'Atividade escalonada', detalhe: `${a.codigo ?? ''} · de ${nomes.get(a.responsavelId ?? '') ?? 'sem responsável'} · venceu há ${minTxt((agora.getTime() - a.prazo.getTime()) / MIN)}`, quando: a.prazo.toISOString(), ref: { tipo: 'ATV', id: a.id }, href: '/pro-labore/atividades', acao: { rotulo: 'Resolver', tipo: 'LINK', href: '/pro-labore/atividades' } })
    const recs = await recsVisiveis(pessoa, { alvoTipo: { in: ['EQUIPE', 'ETAPA'] } })
    for (const r of recs) add('REC_EQUIPE', { titulo: r.titulo, detalhe: `${r.codigo} · ${(r.impacto as { texto?: string } | null)?.texto ?? 'impacto estimado'}`, quando: null, ref: { tipo: 'REC', id: r.id }, href: `/pro-labore/recomendacoes?rec=${r.id}`, acao: { rotulo: 'Abrir a recomendação', tipo: 'REC' } })
  }

  if (pessoa.papel === 'DONO') {
    const vendas = await prisma.venda.findMany({ where: { usuarioId: u, situacao: 'AGUARDANDO_CONFIRMACAO' }, orderBy: { data: 'asc' }, select: { id: true, data: true, vendedor: { select: { nome: true } }, lead: { select: { nomeCliente: true } } } })
    for (const v of vendas) add('VENDA_A_CONFIRMAR', { titulo: `Confirmar a venda de ${primeiro(v.lead?.nomeCliente)}`, detalhe: `por ${primeiro(v.vendedor?.nome)} em ${v.data.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`, quando: v.data.toISOString(), ref: { tipo: 'VENDA', id: v.id }, href: '/pro-labore/vendas', acao: { rotulo: 'Confirmar', tipo: 'LINK', href: '/pro-labore/vendas' } })
    const pend = await prisma.venda.groupBy({ by: ['vendedorId'], where: { usuarioId: u, situacao: 'CONFIRMADA', valorComissao: { gt: 0 }, pagamentoComissaoId: null }, _count: true })
    const nomes = new Map((await prisma.vendedor.findMany({ where: { usuarioId: u }, select: { id: true, nome: true } })).map(v => [v.id, primeiro(v.nome)]))
    for (const p of pend) add('PAGAMENTO_A_APROVAR', { titulo: `Aprovar o pagamento de comissão de ${nomes.get(p.vendedorId ?? '') ?? 'sem vendedor'}`, detalhe: `${p._count} venda(s) confirmada(s) sem pagamento`, quando: null, ref: p.vendedorId ? { tipo: 'VENDEDOR', id: p.vendedorId } : null, href: '/pro-labore/vendas', acao: { rotulo: 'Aprovar o pagamento', tipo: 'LINK', href: '/pro-labore/vendas' } })
    const sug = await prisma.sugestaoAjuste.findMany({ where: { usuarioId: u, status: 'PENDENTE' }, orderBy: { criadoEm: 'asc' } })
    for (const s of sug) {
      const meta = s.parametro.startsWith('meta')
      add(meta ? 'META_SUGERIDA' : 'MUDANCA_REGRA', { titulo: meta ? `Meta sugerida: ${s.parametro}` : `Ajuste sugerido: ${s.parametro}`, detalhe: s.justificativa.slice(0, 160), quando: s.criadoEm.toISOString(), ref: { tipo: 'SUGESTAO', id: s.id }, href: '/pro-labore/configuracoes#detectores', acao: { rotulo: 'Aprovar ou recusar', tipo: 'LINK', href: '/pro-labore/configuracoes#detectores' } })
    }
  }

  if (pessoa.papel === 'TRAFEGO') {
    const mes = mesCorrente(agora)
    const l = await ler('gasto_anuncio', { usuarioId: u, papel: 'TRAFEGO' }, mes, agora)
    const orc = (l.detalhe as { orcamentoMensal?: number | null })?.orcamentoMensal ?? null
    add('RITMO_ORCAMENTO', orc
      ? { titulo: `No ritmo atual, o mês fecha com ${Math.round(((l.projecao ?? l.valor ?? 0) / orc) * 100)}% do orçamento`, detalhe: 'Gasto projetado até o fim do mês contra o orçamento planejado', quando: null, ref: null, href: '/pro-labore/trafego', acao: { rotulo: 'Ajustar a verba', tipo: 'LINK', href: '/pro-labore/trafego' } }
      : { titulo: 'Defina o orçamento de anúncio do mês', detalhe: 'Sem o orçamento planejado, o ritmo não tem com o que comparar', quando: null, ref: null, href: '/pro-labore/configuracoes', acao: { rotulo: 'Definir o orçamento', tipo: 'LINK', href: '/pro-labore/configuracoes' } })
    // Onda 4 (detectores de Marketing): ponto de extensão, sinalizado.
    add('CRIATIVO_FADIGA', { titulo: 'Criativos com fadiga', detalhe: 'Chega com os detectores de Marketing (onda 4).', quando: null, ref: null, href: null, acao: null, extensao: true })
    add('CAMPANHA_LEADS_FRACOS', { titulo: 'Campanhas com leads fracos no CRM', detalhe: 'Chega com os detectores de Marketing (onda 4).', quando: null, ref: null, href: null, acao: null, extensao: true })
  }

  if (pessoa.papel === 'FINANCEIRO') {
    const pend = await prisma.venda.groupBy({ by: ['vendedorId'], where: { usuarioId: u, situacao: 'CONFIRMADA', valorComissao: { gt: 0 }, pagamentoComissaoId: null }, _count: true })
    const nomes = new Map((await prisma.vendedor.findMany({ where: { usuarioId: u }, select: { id: true, nome: true } })).map(v => [v.id, primeiro(v.nome)]))
    for (const p of pend) add('PAGAMENTO_A_LANCAR', { titulo: `Lançar a comissão de ${nomes.get(p.vendedorId ?? '') ?? 'sem vendedor'}`, detalhe: `${p._count} venda(s) confirmada(s)`, quando: null, ref: p.vendedorId ? { tipo: 'VENDEDOR', id: p.vendedorId } : null, href: '/pro-labore/vendas', acao: { rotulo: 'Lançar', tipo: 'LINK', href: '/pro-labore/vendas' } })
    add('COMPROVANTE_FALTANDO', { titulo: 'Comprovantes faltando', detalhe: 'O sistema ainda não registra se o comprovante foi anexado; fica como ponto de extensão.', quando: null, ref: null, href: null, acao: null, extensao: true })
    const div = ((await calcular('divergencias_vendas_financeiro', { usuarioId: u, papel: 'FINANCEIRO' }, { inicio: hojeBrt(agora), fim: hojeBrt(agora) }, agora)).detalhe as { ids: string[] }).ids
    const pags = await prisma.pagamentoComissao.findMany({ where: { id: { in: div } }, select: { id: true, numero: true, pagoEm: true } })
    for (const p of pags) add('DIVERGENCIA', { titulo: `Pagamento de comissão nº ${p.numero} não bate com as vendas`, detalhe: 'O valor pago difere da soma das comissões das vendas ligadas', quando: p.pagoEm.toISOString(), ref: { tipo: 'PAGAMENTO', id: p.id }, href: '/pro-labore/vendas', acao: { rotulo: 'Conferir', tipo: 'LINK', href: '/pro-labore/vendas' } })
  }

  return itens.sort((a, b) => a.ordem - b.ordem)
}

// --- Recomendações visíveis e a Lente ---

type RecLente = { id: string; codigo: string | null; titulo: string; area: string; forca: string; tipo: string; impacto: unknown; acaoSugerida: string; evidencia: unknown; status: string; alvoTipo: string; alvoId: string | null; destinatarioId: string | null; visivelPara: string[] }
const impactoDe = (r: { impacto: unknown }) => Number((r.impacto as { valor?: number } | null)?.valor ?? 0)

export async function recsVisiveis(pessoa: Pessoa, filtro: Record<string, unknown> = {}, limite = 3): Promise<RecLente[]> {
  const quem = { id: pessoa.vendedorId ?? pessoa.usuarioId, papel: pessoa.papel === 'DONO' ? 'DONO' : pessoa.papel === 'SUPERVISOR' ? 'SUPERVISOR' : 'VENDEDOR', usuarioId: pessoa.usuarioId }
  const recs = await prisma.recomendacao.findMany({
    where: { usuarioId: pessoa.usuarioId, status: 'NOVA', ...(pessoa.papel === 'DONO' ? {} : pessoa.papel === 'TRAFEGO' ? { area: 'ANUNCIOS' } : { visivelPara: { has: quem.id } }), ...filtro },
    select: { id: true, codigo: true, titulo: true, area: true, forca: true, tipo: true, impacto: true, acaoSugerida: true, evidencia: true, status: true, alvoTipo: true, alvoId: true, destinatarioId: true, visivelPara: true },
    take: 200,
  })
  // O vendedor nunca vê achado sobre colega (mesma regra da aba Recomendações).
  const vistas = pessoa.papel === 'TRAFEGO' ? recs.filter(r => r.alvoTipo === 'ANUNCIOS' || r.alvoTipo === 'EQUIPE') : recs.filter(r => podeVerRec(r, quem as Parameters<typeof podeVerRec>[1]))
  return vistas.sort((a, b) => impactoDe(b) - impactoDe(a)).slice(0, limite)
}

export interface ItemLente {
  tipo: 'REC' | 'RISCO' | 'NUMERO' | 'PAUTA'
  id: string | null; codigo: string | null; achado: string; evidencia: string; forca: string | null
  acao: { rotulo: string; href?: string } | null; podeDescartar: boolean; podeAceitar: boolean
}
export interface Lente { titulo: string; itens: ItemLente[]; vazio: boolean; principal: Leitura | null; mensagem: string | null }

const evidenciaTxt = (ev: unknown) => {
  const e = ev as { resumo?: string; metricas?: Array<{ nome: string }> } | null
  return e?.resumo ?? e?.metricas?.map(m => m.nome).join(', ') ?? 'Evidência do dicionário'
}
const recParaLente = (r: RecLente, pessoa: Pessoa): ItemLente => ({
  tipo: 'REC', id: r.id, codigo: r.codigo, achado: r.titulo, evidencia: evidenciaTxt(r.evidencia), forca: r.forca,
  acao: { rotulo: r.acaoSugerida.length > 60 ? 'Ver a ação sugerida' : r.acaoSugerida, href: `/pro-labore/recomendacoes?rec=${r.id}` },
  podeAceitar: pessoa.papel === 'DONO' || r.destinatarioId === (pessoa.vendedorId ?? pessoa.usuarioId) || pessoa.papel === 'SUPERVISOR', podeDescartar: true,
})

// Abas e as áreas de Recomendação que pertencem a cada uma (Lente: "só o que é daquela aba").
export const ABA_LENTE: Record<string, { areas: string[]; alvos?: string[]; principal: string | null }> = {
  hoje: { areas: [], principal: null },
  crm: { areas: ['FUNIL'], principal: 'leads_parados' },
  conversas: { areas: ['ATENDIMENTO'], principal: 'tempo_primeira_resposta' },
  credito: { areas: ['CREDITO'], principal: 'aprovacao_credito' },
  atividades: { areas: ['ATIVIDADES'], principal: 'atividades_atrasadas' },
  reativacao: { areas: [], principal: 'leads_parados' },
  trafego: { areas: ['ANUNCIOS'], principal: 'custo_por_lead' },
  'vendas-pagamentos': { areas: ['RESULTADO'], principal: 'vendas' },
  'origem-vendas': { areas: [], principal: 'faturamento_por_origem' },
  equipe: { areas: ['ATENDIMENTO', 'ATIVIDADES'], alvos: ['PESSOA'], principal: 'tempo_primeira_resposta' },
  financeiro: { areas: [], principal: 'saidas_financeiro' },
  'metas-premissas': { areas: ['RESULTADO'], principal: 'previsao_fechamento' },
  recomendacoes: { areas: ['ATENDIMENTO', 'FUNIL', 'ATIVIDADES', 'CREDITO', 'ANUNCIOS', 'RESULTADO'], principal: 'previsao_fechamento' },
}

async function principalDe(pessoa: Pessoa, chave: string | null, agora: Date): Promise<Leitura | null> {
  if (!chave) return null
  const ficha = (await fichas(pessoa.usuarioId)).find(f => f.chave === chave)
  if (!ficha || !ficha.quemVe.includes(pessoa.papel)) return null
  const pessoal = pessoa.papel === 'VENDEDOR' || pessoa.papel === 'SDR'
  return ler(chave, { usuarioId: pessoa.usuarioId, papel: pessoa.papel, vendedorId: pessoal ? pessoa.vendedorId ?? '__nenhum__' : null }, ficha.retrato ? { inicio: hojeBrt(agora), fim: hojeBrt(agora) } : mesCorrente(agora), agora).catch(() => null)
}

const NADA = 'Nada fora do normal nesta aba'

/** Lente de uma aba: até 3 Recomendações daquela aba, roteadas para a pessoa, por impacto. Nunca executa nada. */
export async function lenteDaAba(pessoa: Pessoa, aba: string, agora = new Date()): Promise<Lente> {
  if (aba === 'hoje') return lenteDoHoje(pessoa, agora)
  const cfg = ABA_LENTE[aba] ?? { areas: [], principal: null }
  const recs = cfg.areas.length ? await recsVisiveis(pessoa, { area: { in: cfg.areas }, ...(cfg.alvos ? { alvoTipo: { in: cfg.alvos } } : {}) }) : []
  const itens = recs.map(r => recParaLente(r, pessoa))
  const principal = itens.length ? null : await principalDe(pessoa, cfg.principal, agora)
  return { titulo: 'ARIES', itens, vazio: !itens.length, principal, mensagem: itens.length ? null : NADA }
}

export async function lenteDoHoje(pessoa: Pessoa, agora = new Date()): Promise<Lente> {
  const u = pessoa.usuarioId
  let itens: ItemLente[] = []
  if (pessoa.papel === 'VENDEDOR' || pessoa.papel === 'SDR') {
    // Orientações individuais: o achado é sobre a própria pessoa.
    const recs = await recsVisiveis(pessoa, { alvoTipo: { in: ['PESSOA', 'CREDITO'] }, alvoId: pessoa.vendedorId ?? '__nenhum__' }, pessoa.papel === 'SDR' ? 2 : 3)
    itens = recs.map(r => recParaLente(r, pessoa))
    if (pessoa.papel === 'SDR') {
      const h = hojeBrt(agora), ini = new Date(new Date(`${h}T00:00:00Z`).getTime() - 6 * DIA).toISOString().slice(0, 10)
      const l = await ler('taxa_devolucao', { usuarioId: u, papel: 'SDR', vendedorId: pessoa.vendedorId ?? '__nenhum__' }, { inicio: ini, fim: h }, agora).catch(() => null)
      if (l) itens.push({ tipo: 'NUMERO', id: null, codigo: null, achado: `Taxa de devolução da semana: ${l.valor == null ? 'sem passagens' : `${l.valor}%`}`, evidencia: l.anterior?.valor != null ? `semana anterior: ${l.anterior.valor}%` : 'Leads devolvidos pelo vendedor ÷ leads passados', forca: null, acao: { rotulo: 'Ver as devoluções', href: '/pro-labore/leads' }, podeAceitar: false, podeDescartar: false })
    }
  } else if (pessoa.papel === 'SUPERVISOR') {
    itens = (await recsVisiveis(pessoa, { alvoTipo: { in: ['EQUIPE', 'ETAPA'] } })).map(r => recParaLente(r, pessoa))
  } else if (pessoa.papel === 'DONO') {
    // Três maiores riscos: métricas principais em faixa crítica; três maiores Recomendações por impacto.
    const chaves = ['previsao_fechamento', 'tempo_primeira_resposta', 'conversao_lead_venda', 'aprovacao_credito', 'leads_parados', 'atividades_atrasadas', 'custo_por_lead']
    const leituras = await Promise.all(chaves.map(c => principalDe(pessoa, c, agora)))
    const riscos = leituras.filter((l): l is Leitura => !!l && l.faixa === 'CRITICO').slice(0, 3)
    itens = [
      ...riscos.map(l => ({ tipo: 'RISCO' as const, id: null, codigo: null, achado: `${l.nome} em faixa crítica`, evidencia: l.anterior?.valor != null ? `agora ${l.valor} contra ${l.anterior.valor} no mesmo intervalo anterior` : `padrão da loja: ${l.padrao ?? 'sem histórico'}`, forca: null, acao: { rotulo: 'Perguntar ao ARIES por quê', href: `/pro-labore/pergunte?q=${encodeURIComponent(`Por que ${l.nome.toLowerCase()} está crítico?`)}` }, podeAceitar: false, podeDescartar: false })),
      ...(await recsVisiveis(pessoa, {})).map(r => recParaLente(r, pessoa)),
    ]
  } else if (pessoa.papel === 'TRAFEGO') {
    itens = (await recsVisiveis(pessoa, { area: 'ANUNCIOS' })).map(r => ({ ...recParaLente(r, pessoa), podeAceitar: false }))
  } else if (pessoa.papel === 'FINANCEIRO') {
    const mes = mesCorrente(agora)
    const [com, sai, vendasMes] = await Promise.all([
      ler('comissoes_a_pagar', { usuarioId: u, papel: 'FINANCEIRO' }, { inicio: hojeBrt(agora), fim: hojeBrt(agora) }, agora),
      ler('saidas_financeiro', { usuarioId: u, papel: 'FINANCEIRO' }, mes, agora),
      ler('vendas', { usuarioId: u, papel: 'FINANCEIRO' }, mes, agora),
    ])
    const ticketCom = await prisma.venda.aggregate({ where: { usuarioId: u, situacao: 'CONFIRMADA', data: { gte: new Date(agora.getTime() - 90 * DIA) } }, _avg: { valorComissao: true } })
    const faltam = Math.max(0, (vendasMes.projecao ?? vendasMes.valor ?? 0) - (vendasMes.valor ?? 0))
    itens = [
      { tipo: 'NUMERO', id: null, codigo: null, achado: 'Previsão de comissões até o fim do mês', evidencia: `[[comissoes_a_pagar]] a pagar agora + ${Math.round(faltam)} venda(s) previstas × comissão média`, forca: 'HIPOTESE', acao: { rotulo: 'Ver as comissões', href: '/pro-labore/vendas' }, podeAceitar: false, podeDescartar: false },
      { tipo: 'NUMERO', id: null, codigo: null, achado: 'Previsão de saídas do mês', evidencia: 'Saídas do caixa no ritmo do mês ([[saidas_financeiro]] até hoje)', forca: 'HIPOTESE', acao: { rotulo: 'Abrir o Financeiro', href: '/pro-labore/financeiro' }, podeAceitar: false, podeDescartar: false },
    ]
    // Os valores (R$) entram pela tela, que formata a partir destes números do dicionário.
    ;(itens[0] as ItemLente & { valores?: unknown }).valores = { comissoesAgora: com.valor, previstas: Math.round(faltam), comissaoMedia: ticketCom._avg.valorComissao ?? null }
    ;(itens[1] as ItemLente & { valores?: unknown }).valores = { saidas: sai.valor, projecao: sai.projecao }
  } else if (pessoa.papel === 'SOCIAL_MEDIA') {
    const paradas = await prisma.smMotoEstoque.findMany({ where: { usuarioId: u, situacao: 'DISPONIVEL', pautas: { none: { criadoEm: { gte: new Date(agora.getTime() - 30 * DIA) } } } }, orderBy: { criadoEm: 'asc' }, take: 2, select: { id: true, modelo: true, criadoEm: true } }).catch(() => [])
    itens = paradas.map(m => ({ tipo: 'PAUTA' as const, id: m.id, codigo: null, achado: `Pauta sugerida: ${m.modelo} parada no estoque`, evidencia: `no estoque há ${Math.round((agora.getTime() - m.criadoEm.getTime()) / DIA)} dias sem pauta no último mês`, forca: 'PADRAO', acao: { rotulo: 'Criar a pauta', href: '/pro-labore/sm' }, podeAceitar: false, podeDescartar: false }))
    const obj = await calcular('objecoes_frequentes', { usuarioId: u, papel: 'DONO' }, mesCorrente(agora), agora).catch(() => null)
    const top = (obj?.detalhe as Array<{ tipo?: string; rotulo?: string; n?: number }> | undefined)?.[0]
    if (top) itens.push({ tipo: 'PAUTA', id: null, codigo: null, achado: `Pauta sugerida pelas conversas: responder "${top.rotulo ?? top.tipo}"`, evidencia: `a objeção mais frequente nas conversas${top.n ? ` (${top.n} vezes)` : ''}`, forca: 'PADRAO', acao: { rotulo: 'Criar a pauta', href: '/pro-labore/sm' }, podeAceitar: false, podeDescartar: false })
  }
  itens = itens.slice(0, pessoa.papel === 'DONO' ? 6 : 3)
  const principalChave = CONFIG_PADRAO[pessoa.papel].numeros[0]?.chave ?? null
  const principal = itens.length ? null : await principalDe(pessoa, principalChave, agora)
  return { titulo: 'ARIES', itens, vazio: !itens.length, principal, mensagem: itens.length ? null : NADA }
}

// --- Supervisor: quadro da equipe e ações (todas auditadas) ---

export async function quadroDaEquipe(usuarioId: string, agora = new Date()) {
  const equipe = await prisma.vendedor.findMany({ where: { usuarioId, ativo: true, vende: true, funcao: null, email: { not: null } }, select: { id: true, nome: true, papel: true }, orderBy: { nome: 'asc' } })
  const mes = mesCorrente(agora)
  const dm = new Date(Date.UTC(Number(mes.inicio.slice(0, 4)), Number(mes.inicio.slice(5, 7)), 0)).getUTCDate()
  const fracao = Number(mes.fim.slice(8, 10)) / dm
  return Promise.all(equipe.map(async v => {
    const e: Escopo = { usuarioId, papel: 'SUPERVISOR', vendedorId: v.id }
    const sdr = v.papel === 'SDR'
    const [fat, resp, atras, meta] = await Promise.all([
      sdr ? calcular('leads_passados', e, mes, agora) : calcular('faturamento', e, mes, agora),
      calcular('tempo_primeira_resposta', e, mes, agora),
      calcular('atividades_atrasadas', e, { inicio: hojeBrt(agora), fim: hojeBrt(agora) }, agora),
      sdr ? Promise.resolve(null) : metaDoMes(e),
    ])
    const metaSdr = sdr ? ((fat.detalhe as { metaPeriodo?: number | null })?.metaPeriodo ?? null) : null
    const alvo = sdr ? metaSdr : meta != null ? meta * fracao : null
    const ritmo = alvo && fat.valor != null ? Math.round((fat.valor / alvo) * 100) : null
    const [padResp, padAtr] = await Promise.all([padraoDaLoja('tempo_primeira_resposta', e, agora).catch(() => null), padraoDaLoja('atividades_atrasadas', e, agora).catch(() => null)])
    const foraResp = faixaDe(resp.valor, padResp, 'MENOR') === 'CRITICO'
    const foraAtr = faixaDe(atras.valor, padAtr, 'MENOR') === 'CRITICO'
    return {
      id: v.id, nome: v.nome, papel: sdr ? 'SDR' : v.papel === 'SUPERVISOR' ? 'Supervisor' : 'Vendedor',
      ritmo: { valor: ritmo, rotulo: sdr ? 'passagens contra a meta' : 'faturamento contra a meta até hoje' },
      tempoResposta: { valor: resp.valor, padrao: padResp, fora: foraResp },
      atrasadas: { valor: atras.valor, padrao: padAtr, fora: foraAtr },
      foraDoPadrao: foraResp || foraAtr || (ritmo != null && ritmo < 80),
    }
  }))
}

const autor = (p: Pessoa) => `USUARIO|${p.vendedorId ?? p.usuarioId}|${p.papel}|hoje`

export class ErroHoje extends Error { constructor(public status: number, msg: string) { super(msg) } }

export async function acaoDoSupervisor(pessoa: Pessoa, corpo: { acao: string; de?: string; para?: string; atividadeId?: string; prazo?: string; vendedorId?: string; texto?: string }, agora = new Date()) {
  const u = pessoa.usuarioId
  const daConta = async (id?: string) => (id ? prisma.vendedor.findFirst({ where: { id, usuarioId: u, ativo: true } }) : null)
  if (corpo.acao === 'REDISTRIBUIR') {
    const de = await daConta(corpo.de), para = await daConta(corpo.para)
    if (!de || !para || de.id === para.id) throw new ErroHoje(400, 'Escolha de quem e para quem redistribuir')
    const where = { usuarioId: u, responsavelId: de.id, status: 'PENDENTE', ...(corpo.atividadeId ? { id: corpo.atividadeId } : { prazo: { lt: agora } }) }
    const r = await prisma.atividade.updateMany({ where, data: { responsavelId: para.id, auditoriaAutor: autor(pessoa) } })
    return { redistribuidas: r.count }
  }
  if (corpo.acao === 'REPRIORIZAR') {
    const prazo = corpo.prazo ? new Date(corpo.prazo) : null
    if (!corpo.atividadeId || !prazo || Number.isNaN(prazo.getTime())) throw new ErroHoje(400, 'Escolha a atividade e o novo prazo')
    const r = await prisma.atividade.updateMany({ where: { id: corpo.atividadeId, usuarioId: u, status: 'PENDENTE' }, data: { prazo, auditoriaAutor: autor(pessoa) } })
    if (!r.count) throw new ErroHoje(404, 'Atividade não encontrada')
    return { repriorizadas: r.count }
  }
  if (corpo.acao === 'INTERVIR' || corpo.acao === 'PLANO') {
    const alvo = await daConta(corpo.vendedorId)
    const texto = (corpo.texto ?? '').trim()
    if (!alvo || texto.length < 3) throw new ErroHoje(400, 'Escolha a pessoa e descreva a ação')
    const intervir = corpo.acao === 'INTERVIR'
    const atv = await prisma.atividade.create({
      data: {
        usuarioId: u, auditoriaAutor: autor(pessoa), tipo: intervir ? 'INTERVENCAO_SUPERVISOR' : 'PLANO_DE_ACAO', origemTipo: 'ROTINA', origemId: `hoje-supervisor|${alvo.id}`,
        responsavelId: intervir ? pessoa.vendedorId : alvo.id, prazo: new Date(agora.getTime() + (intervir ? 2 * H : 3 * DIA)),
        oQueFazer: intervir ? `Intervir com ${primeiro(alvo.nome)}: ${texto}` : `Plano de ação: ${texto}`,
        registroTabela: 'pro_labore_hoje_acoes', registroId: randomUUID(),
      },
      select: { id: true, codigo: true },
    })
    return { atividade: atv }
  }
  throw new ErroHoje(400, 'Ação desconhecida')
}

// --- Dono: painel por área, cada linha abrindo a aba ---

export async function painelDoDono(usuarioId: string, agora = new Date()) {
  const e: Escopo = { usuarioId, papel: 'DONO' }
  const mes = mesCorrente(agora)
  const [prev, meta, origem, cpl, roas, saidas] = await Promise.all([
    ler('previsao_fechamento', e, mes, agora), metaDoMes(e), ler('faturamento_por_origem', e, mes, agora),
    ler('custo_por_lead', e, mes, agora), ler('roas', e, mes, agora), ler('saidas_financeiro', e, mes, agora),
  ])
  const o = (origem.detalhe ?? {}) as Record<string, number>
  return [
    { area: 'Comercial', chave: 'previsao_fechamento', texto: 'Ritmo contra a meta', valor: prev.valor, unidade: 'BRL', alvo: meta, ritmoPct: meta ? Math.round(((prev.valor ?? 0) / meta) * 100) : null, faixa: meta ? faixaDe(prev.valor, meta, 'MAIOR') : prev.faixa, href: '/pro-labore/leads' },
    { area: 'Reativação', chave: 'faturamento_por_origem', texto: 'Faturamento recuperado', valor: o.RECUPERADO_CENTRAL ?? 0, unidade: 'BRL', alvo: null, ritmoPct: null, faixa: null, href: '/pro-labore/reativacao' },
    { area: 'Marketing', chave: 'custo_por_lead', texto: 'Custo por lead e ROAS', valor: cpl.valor, unidade: 'BRL', extra: { chave: 'roas', valor: roas.valor, unidade: 'X' }, alvo: null, ritmoPct: null, faixa: cpl.faixa, href: '/pro-labore/trafego' },
    { area: 'Financeiro', chave: 'saidas_financeiro', texto: 'Saídas do mês', valor: saidas.valor, unidade: 'BRL', alvo: null, ritmoPct: null, faixa: saidas.faixa, href: '/pro-labore/financeiro' },
    { area: 'Faturamento por origem', chave: 'faturamento_por_origem', texto: 'Novos, recuperados e retorno espontâneo', valor: origem.valor, unidade: 'BRL', detalhe: o, alvo: null, ritmoPct: null, faixa: null, href: '/pro-labore/origem-vendas' },
  ]
}
