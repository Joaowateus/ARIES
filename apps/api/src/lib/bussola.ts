// PDF 06 · seção 3: o Hoje vira a bússola do dia. Um cartão por área, todo
// calculado pelo código a partir do dicionário de métricas (P2): situação
// (verde, amarelo, vermelho), o que está bom e onde olhar primeiro (sempre com o
// número que comprova), uma oportunidade com o impacto estimado, uma dica prática
// e até 3 números de apoio. Nada aqui vai para a IA; o resumo (resumoHoje.ts)
// recebe só o sentido dos fatos e escreve com espaços reservados.
// Alcance por papel (5.3): o dono vê tudo, com nomes; o supervisor, as áreas
// comerciais e a equipe, sem as cifras do dono; vendedor e SDR, a própria bússola
// com a equipe só como média; tráfego, social media e financeiro, a própria área e
// o resultado do mês.
import { prisma } from './prisma'
import { fichas, hojeBrt, ler, mesCorrente, type Escopo, type Leitura, type Periodo } from './metricas'
import { fmtValor, nomesDistintos, vendasTxt } from './formato'
import { situacaoDaMeta, type SituacaoMeta } from './metaCoerente'
import type { PapelHoje } from './papelHoje'

const DIA = 86_400_000
type Per = 'MES' | 'HOJE' | 'AGORA' | 'SEMANA' | 'ONTEM' | 'D90'
export type AreaChave = 'RESULTADO' | 'PRE_VENDA' | 'CREDITO' | 'VENDEDORES' | 'TRAFEGO' | 'SOCIAL' | 'REATIVACAO' | 'GESTAO' | 'EQUIPE'
export type Cor = 'VERDE' | 'AMARELO' | 'VERMELHO' | 'CINZA'

export interface Ponto { texto: string; chave: string | null; valor: number | null; unidade: string | null; hipotese?: boolean; levar?: Levar | null }
export interface Levar { area: AreaChave; texto: string; refTipo: string | null; refId: string | null }
export interface MetricaCartao { chave: string; nome: string; valor: number | null; unidade: string; texto: string; faixa: string | null; comparacao: string | null }
export interface Cartao {
  area: AreaChave; nome: string; href: string
  cor: Cor; situacao: string
  bons: Ponto[]; atencao: Ponto[]
  oportunidade: Ponto | null; dica: string
  metricas: MetricaCartao[]
  recs: Array<{ id: string; codigo: string | null; titulo: string; levar: Levar }>
}

const NOME_AREA: Record<AreaChave, string> = {
  RESULTADO: 'Resultado do mês', PRE_VENDA: 'Pré-venda (SDR)', CREDITO: 'Crédito', VENDEDORES: 'Vendedores', TRAFEGO: 'Tráfego',
  SOCIAL: 'Social media', REATIVACAO: 'Reativação', GESTAO: 'Gestão e financeiro', EQUIPE: 'Equipe',
}
const HREF: Record<AreaChave, string> = {
  RESULTADO: '/pro-labore/metas-premissas', PRE_VENDA: '/pro-labore/leads', CREDITO: '/pro-labore/leads', VENDEDORES: '/pro-labore/equipe', TRAFEGO: '/pro-labore/trafego',
  SOCIAL: '/pro-labore/sm', REATIVACAO: '/pro-labore/reativacao', GESTAO: '/pro-labore/vendas', EQUIPE: '/pro-labore/atividades',
}
// Áreas de Recomendação que alimentam cada cartão.
const AREAS_REC: Record<AreaChave, string[]> = {
  RESULTADO: ['RESULTADO'], PRE_VENDA: ['ATENDIMENTO'], CREDITO: ['CREDITO'], VENDEDORES: ['FUNIL'], TRAFEGO: ['ANUNCIOS'],
  SOCIAL: ['MARKETING'], REATIVACAO: ['REATIVACAO'], GESTAO: ['GESTAO'], EQUIPE: ['ATIVIDADES', 'PESSOAS'],
}
// Métricas de apoio de cada área (até 3), do dicionário.
const METRICAS: Record<AreaChave, Array<{ chave: string; per: Per }>> = {
  RESULTADO: [{ chave: 'previsao_fechamento', per: 'MES' }, { chave: 'vendas', per: 'MES' }, { chave: 'faturamento', per: 'MES' }],
  PRE_VENDA: [{ chave: 'leads_novos', per: 'MES' }, { chave: 'tempo_primeira_resposta', per: 'MES' }, { chave: 'leads_passados', per: 'MES' }],
  CREDITO: [{ chave: 'fichas_aguardando_banco', per: 'AGORA' }, { chave: 'aprovacoes_vencendo', per: 'AGORA' }, { chave: 'aprovacao_credito', per: 'MES' }],
  VENDEDORES: [{ chave: 'visitas_agendadas', per: 'MES' }, { chave: 'propostas_enviadas', per: 'MES' }, { chave: 'conversao_lead_venda', per: 'MES' }],
  TRAFEGO: [{ chave: 'gasto_anuncio', per: 'MES' }, { chave: 'custo_por_lead', per: 'MES' }, { chave: 'roas', per: 'MES' }],
  SOCIAL: [{ chave: 'posts_publicados', per: 'MES' }, { chave: 'leads_dos_posts', per: 'MES' }, { chave: 'vendas_por_post', per: 'MES' }],
  REATIVACAO: [{ chave: 'taxa_recuperacao', per: 'MES' }, { chave: 'prioridade_sem_atividade', per: 'AGORA' }, { chave: 'taxa_resposta_reativacao', per: 'MES' }],
  GESTAO: [{ chave: 'decisoes_aguardando', per: 'AGORA' }, { chave: 'comissoes_a_pagar', per: 'AGORA' }, { chave: 'saidas_financeiro', per: 'MES' }],
  EQUIPE: [{ chave: 'aderencia_agenda', per: 'MES' }, { chave: 'atividades_atrasadas', per: 'AGORA' }, { chave: 'atividades_feitas', per: 'MES' }],
}
// Bússola pessoal (vendedor e SDR): as mesmas fichas, no escopo da pessoa.
const PESSOAL: Record<'VENDEDOR' | 'SDR', Array<{ area: AreaChave; nome: string; metricas: Array<{ chave: string; per: Per }> }>> = {
  VENDEDOR: [
    { area: 'RESULTADO', nome: 'Meu resultado do mês', metricas: [{ chave: 'vendas', per: 'MES' }, { chave: 'conversao_lead_venda', per: 'MES' }, { chave: 'ticket_medio', per: 'MES' }] },
    { area: 'VENDEDORES', nome: 'Minhas negociações', metricas: [{ chave: 'propostas_enviadas', per: 'MES' }, { chave: 'visitas_agendadas', per: 'MES' }, { chave: 'propostas_sem_follow', per: 'AGORA' }] },
    { area: 'PRE_VENDA', nome: 'Meu atendimento', metricas: [{ chave: 'tempo_primeira_resposta', per: 'MES' }, { chave: 'clientes_esperando', per: 'AGORA' }, { chave: 'sql_sem_contato', per: 'AGORA' }] },
    { area: 'EQUIPE', nome: 'Minha rotina', metricas: [{ chave: 'aderencia_agenda', per: 'MES' }, { chave: 'atividades_atrasadas', per: 'AGORA' }, { chave: 'atividades_feitas', per: 'MES' }] },
  ],
  SDR: [
    { area: 'PRE_VENDA', nome: 'Meu atendimento', metricas: [{ chave: 'tempo_primeira_resposta', per: 'MES' }, { chave: 'leads_sem_primeira_resposta', per: 'AGORA' }, { chave: 'leads_novos', per: 'MES' }] },
    { area: 'CREDITO', nome: 'Minhas passagens', metricas: [{ chave: 'leads_passados', per: 'MES' }, { chave: 'levantamentos_completos', per: 'MES' }, { chave: 'taxa_devolucao', per: 'MES' }] },
    { area: 'EQUIPE', nome: 'Minha rotina', metricas: [{ chave: 'aderencia_agenda', per: 'MES' }, { chave: 'atividades_atrasadas', per: 'AGORA' }, { chave: 'atividades_feitas', per: 'MES' }] },
  ],
}
export const AREAS_DO_PAPEL: Record<PapelHoje, AreaChave[]> = {
  DONO: ['RESULTADO', 'PRE_VENDA', 'CREDITO', 'VENDEDORES', 'TRAFEGO', 'SOCIAL', 'REATIVACAO', 'GESTAO', 'EQUIPE'],
  SUPERVISOR: ['RESULTADO', 'PRE_VENDA', 'CREDITO', 'VENDEDORES', 'REATIVACAO', 'EQUIPE'],
  TRAFEGO: ['TRAFEGO', 'RESULTADO'], SOCIAL_MEDIA: ['SOCIAL', 'RESULTADO'], FINANCEIRO: ['GESTAO', 'RESULTADO'],
  VENDEDOR: [], SDR: [],
}
// Cifras do dono (P7): só ele vê em R$.
const CIFRAS_DO_DONO = new Set(['pro_labore', 'comissoes_a_pagar', 'comissoes_pagas', 'gasto_anuncio', 'custo_por_lead', 'custo_por_venda', 'custo_por_etapa', 'saidas_financeiro', 'valores_por_etapa'])

// Dicas do ARIES por área (Playbook): uma quando a área está bem, outra quando pede atenção.
const DICAS: Record<AreaChave, { bem: string; atencao: string }> = {
  RESULTADO: { bem: 'Com a meta no ritmo, use a folga para adiantar as negociações do próximo mês: quem está em Proposta hoje é a venda da semana que vem.', atencao: 'Comece pelas oportunidades mais adiantadas (Proposta, Agendamento e Visita): é onde uma conversa a mais vira venda mais rápido.' },
  PRE_VENDA: { bem: 'Mantenha as janelas fixas de resposta ao longo do dia; foi isso que segurou o tempo de resposta baixo.', atencao: 'Separe janelas fixas no dia só para responder os novos contatos e responda primeiro quem chegou há mais tempo.' },
  CREDITO: { bem: 'Continue mandando as fichas completas na primeira vez: ficha completa volta mais rápido do banco.', atencao: 'Cobre o banco pelas fichas paradas há mais tempo e avise o cliente da previsão de resposta para ele não esfriar.' },
  VENDEDORES: { bem: 'Registre no CRM o que funcionou nas negociações fechadas; vira boa prática para o time.', atencao: 'Faça o follow das propostas paradas no mesmo dia: proposta sem retorno em 48 horas tende a esfriar.' },
  TRAFEGO: { bem: 'Com o custo por lead no padrão, teste um criativo novo por semana para não depender de um só.', atencao: 'Revise com o gestor de tráfego os criativos com mais tempo no ar e redistribua a verba para as campanhas que trazem leads que avançam no CRM.' },
  SOCIAL: { bem: 'Repita o formato dos posts que trouxeram leads; constância no calendário pesa mais que um post viral.', atencao: 'Feche o calendário da semana com antecedência e use as motos paradas no estoque como pauta.' },
  REATIVACAO: { bem: 'Use o roteiro que mais recuperou clientes como padrão nas próximas campanhas.', atencao: 'Comece pelos clientes de prioridade alta sem atividade: são os que já mostraram mais intenção.' },
  GESTAO: { bem: 'Com as decisões em dia, aproveite para conferir as saídas do mês contra o planejado.', atencao: 'Confirme as vendas e aprove os pagamentos parados primeiro: eles travam o fechamento do mês e a comissão da equipe.' },
  EQUIPE: { bem: 'Reconheça em público quem cumpriu a rotina; o exemplo puxa o resto do time.', atencao: 'Repriorize as atividades atrasadas com cada pessoa: primeiro os clientes mais adiantados na jornada.' },
}

const r1 = (n: number) => Math.round(n * 10) / 10
const periodoDe = (p: Per, agora: Date): Periodo => {
  const h = hojeBrt(agora)
  if (p === 'MES') return mesCorrente(agora)
  if (p === 'ONTEM') { const o = new Date(new Date(`${h}T12:00:00Z`).getTime() - DIA).toISOString().slice(0, 10); return { inicio: o, fim: o } }
  if (p === 'SEMANA') { const d = new Date(`${h}T12:00:00Z`), dow = (d.getUTCDay() + 6) % 7; return { inicio: new Date(d.getTime() - dow * DIA).toISOString().slice(0, 10), fim: h } }
  if (p === 'D90') return { inicio: new Date(new Date(`${h}T12:00:00Z`).getTime() - 89 * DIA).toISOString().slice(0, 10), fim: h }
  return { inicio: h, fim: h }
}
const COMP: Record<Per, string> = { MES: 'no mesmo período do mês anterior', SEMANA: 'na semana anterior', ONTEM: 'no dia anterior', HOJE: 'ontem', AGORA: '', D90: 'nos 90 dias anteriores' }

/** Leitura de uma ficha num escopo; nunca derruba o cartão. */
async function leitura(chave: string, e: Escopo, per: Per, agora: Date) {
  return ler(chave, e, periodoDe(per, agora), agora).catch(() => null)
}

// Bom, ruim ou neutro, pela faixa e pela comparação com o mesmo intervalo anterior.
function sentido(l: Leitura): 'BOM' | 'RUIM' | 'NEUTRO' {
  if (l.valor == null || l.melhor === 'NEUTRO') return 'NEUTRO'
  if (l.faixa === 'CRITICO' || l.faixa === 'ATENCAO') return 'RUIM'
  if (l.variacao != null && Math.abs(l.variacao) >= 10) {
    const melhorou = l.melhor === 'MAIOR' ? l.variacao > 0 : l.variacao < 0
    return melhorou ? 'BOM' : 'RUIM'
  }
  return l.faixa === 'BOM' ? 'BOM' : 'NEUTRO'
}
function comparacaoTxt(l: Leitura, per: Per): string | null {
  if (l.anterior?.valor == null || !COMP[per]) return null
  return `${COMP[per]}: ${fmtValor(l.anterior.valor, l.unidade)}`
}
function textoPonto(l: Leitura, per: Per, bom: boolean, media?: { valor: number | null; rotulo: string } | null): string {
  const v = fmtValor(l.valor, l.unidade)
  const nome = l.nome.charAt(0).toLowerCase() + l.nome.slice(1)
  const comp = comparacaoTxt(l, per)
  if (media && media.valor != null) return `${l.nome}: ${v} (${media.rotulo}: ${fmtValor(media.valor, l.unidade)})`
  if (comp) {
    const mudou = l.variacao != null ? `${bom ? (l.melhor === 'MAIOR' ? 'subiu' : 'caiu') : (l.melhor === 'MAIOR' ? 'caiu' : 'subiu')} ${fmtValor(Math.abs(l.variacao), 'PCT')}` : null
    return `${l.nome} em ${v}${mudou ? `, ${mudou}` : ''} (${comp})`
  }
  if (l.padrao != null) return `${l.nome} em ${v} (${bom ? 'dentro' : 'fora'} do padrão da loja, ${fmtValor(l.padrao, l.unidade)})`
  return `${nome.charAt(0).toUpperCase() + nome.slice(1)}: ${v}`
}
const corDe = (faixas: Array<string | null>): Cor => faixas.includes('CRITICO') ? 'VERMELHO' : faixas.includes('ATENCAO') ? 'AMARELO' : faixas.some(f => f === 'BOM') ? 'VERDE' : 'CINZA'
const SITUACAO: Record<Cor, string> = { VERDE: 'em dia', AMARELO: 'em atenção', VERMELHO: 'pede ação hoje', CINZA: 'sem dados suficientes para classificar' }

export interface Contexto {
  usuarioId: string; papel: PapelHoje; vendedorId: string | null
  agora: Date; meta: SituacaoMeta | null; dono: boolean
}

// --- Oportunidade de cada área, com o impacto estimado (sempre dito como estimativa) ---

async function oportunidade(area: AreaChave, c: Contexto, e: Escopo, ls: Map<string, Leitura | null>): Promise<Ponto | null> {
  const { agora } = c
  const lev = (texto: string): Levar => ({ area, texto, refTipo: 'AREA', refId: area })
  const val = (k: string) => ls.get(k)?.valor ?? null
  if (area === 'RESULTADO' && c.meta) {
    const m = c.meta
    if (!m.cobre && m.faltamVendas != null) {
      const t = `Fechar as ${vendasTxt(m.faltamVendas).replace(/^\d+ /, `${m.faltamVendas} `)} que faltam para a meta, começando pelas negociações mais adiantadas`
      return { texto: `${t}: ${m.ritmo}.`, chave: 'previsao_fechamento', valor: m.faltamVendas, unidade: 'QTD', levar: lev(`Plano para as ${vendasTxt(m.faltamVendas)} que faltam (${m.ritmo})`) }
    }
    if (m.cobre && m.ticket) return { texto: c.dono ? `Meta no ritmo: cada venda a mais soma cerca de ${fmtValor(m.ticket, 'BRL')} ao mês (ticket médio dos últimos 90 dias).` : 'Meta no ritmo: cada venda a mais agora é resultado acima da meta.', chave: 'ticket_medio', valor: c.dono ? m.ticket : null, unidade: 'BRL', hipotese: true, levar: lev('Como passar da meta este mês') }
    return null
  }
  if (area === 'PRE_VENDA') {
    const [semResp, conv] = await Promise.all([leitura('leads_sem_primeira_resposta', e, 'AGORA', agora), leitura('conversao_lead_venda', e, 'D90', agora)])
    const n = semResp?.valor ?? 0, cv = conv?.valor ?? null
    if (n > 0 && cv) {
      const est = r1((n * cv) / 100)
      return { texto: `Responder em até 15 minutos os ${n} leads que esperam a primeira resposta${est >= 0.5 ? ` pode virar cerca de ${vendasTxt(est)} (conversão de ${fmtValor(cv, 'PCT')} nos últimos 90 dias)` : ''}.`, chave: 'leads_sem_primeira_resposta', valor: n, unidade: 'QTD', hipotese: true, levar: lev(`Responder os ${n} leads sem primeira resposta`) }
    }
    const tpr = ls.get('tempo_primeira_resposta')
    if (tpr?.valor != null) return { texto: `Manter a primeira resposta em até 15 minutos (hoje está em ${fmtValor(tpr.valor, 'MIN')}): quanto mais rápido, mais conversa vira levantamento.`, chave: 'tempo_primeira_resposta', valor: tpr.valor, unidade: 'MIN', hipotese: true, levar: lev('Tempo de primeira resposta') }
    return null
  }
  if (area === 'CREDITO') {
    const n = val('fichas_aguardando_banco') ?? 0, ap = val('aprovacao_credito')
    if (n > 0) return { texto: `Cobrar o banco pelas ${n} fichas aguardando resposta${ap ? `: com a aprovação de ${fmtValor(ap, 'PCT')} do mês, são cerca de ${Math.round((n * ap) / 100)} aprovações em jogo` : ''}.`, chave: 'fichas_aguardando_banco', valor: n, unidade: 'QTD', hipotese: !!ap, levar: lev(`Cobrar o banco pelas ${n} fichas paradas`) }
    const venc = val('aprovacoes_vencendo') ?? 0
    if (venc > 0) return { texto: `Fechar as ${venc} aprovações que vencem em até 2 dias antes que expirem.`, chave: 'aprovacoes_vencendo', valor: venc, unidade: 'QTD', levar: lev(`Fechar as ${venc} aprovações que vencem`) }
    return null
  }
  if (area === 'VENDEDORES') {
    const [semFollow, props90, vendas90] = await Promise.all([leitura('propostas_sem_follow', e, 'AGORA', agora), leitura('propostas_enviadas', e, 'D90', agora), leitura('vendas', e, 'D90', agora)])
    const n = semFollow?.valor ?? 0
    if (n > 0) {
      const taxa = props90?.valor && vendas90?.valor != null ? Math.min(1, vendas90.valor / props90.valor) : null
      const est = taxa != null ? r1(n * taxa) : null
      return { texto: `Fazer o follow das ${n} propostas sem retorno${est != null && est >= 0.5 ? `: pelo histórico de 90 dias, cerca de ${vendasTxt(est)}` : ''}.`, chave: 'propostas_sem_follow', valor: n, unidade: 'QTD', hipotese: true, levar: lev(`Follow das ${n} propostas sem retorno`) }
    }
    return null
  }
  if (area === 'TRAFEGO') {
    const cpl = ls.get('custo_por_lead'), gasto = val('gasto_anuncio')
    if (c.dono && cpl?.valor && cpl.padrao && cpl.valor > cpl.padrao && gasto) {
      const mais = Math.round(gasto / cpl.padrao - gasto / cpl.valor)
      if (mais > 0) return { texto: `Se o custo por lead voltar ao padrão da loja (${fmtValor(cpl.padrao, 'BRL')}), o mesmo gasto do mês traria cerca de ${mais} leads a mais.`, chave: 'custo_por_lead', valor: mais, unidade: 'QTD', hipotese: true, levar: lev('Custo por lead acima do padrão') }
    }
    const roas = ls.get('roas')
    if (roas?.valor != null) return { texto: `Levar mais verba para as campanhas cujos leads avançam no CRM: o ROAS do mês está em ${fmtValor(roas.valor, 'X')}.`, chave: 'roas', valor: roas.valor, unidade: 'X', hipotese: true, levar: lev('Verba nas campanhas que vendem') }
    return null
  }
  if (area === 'SOCIAL') {
    const pp = ls.get('posts_publicados'), leads = val('leads_dos_posts')
    const plan = (pp?.detalhe as { planejados?: number } | undefined)?.planejados ?? null
    const feitos = pp?.valor ?? 0
    if (plan != null && plan > feitos) return { texto: `Publicar os ${plan - feitos} posts que faltam no calendário${feitos && leads ? `: cada post do mês trouxe em média ${fmtValor(leads / feitos, 'QTD')} leads` : ''}.`, chave: 'posts_publicados', valor: plan - feitos, unidade: 'QTD', hipotese: true, levar: lev(`${plan - feitos} posts atrasados no calendário`) }
    return null
  }
  if (area === 'REATIVACAO') {
    const n = val('prioridade_sem_atividade') ?? 0, tx = val('taxa_recuperacao')
    if (n > 0) return { texto: `Criar atividade para os ${n} clientes de prioridade alta parados${tx ? `: com a recuperação de ${fmtValor(tx, 'PCT')} do mês, são cerca de ${Math.max(0, Math.round((n * tx) / 100))} clientes de volta` : ''}.`, chave: 'prioridade_sem_atividade', valor: n, unidade: 'QTD', hipotese: !!tx, levar: lev(`${n} clientes de prioridade alta sem atividade`) }
    return null
  }
  if (area === 'GESTAO') {
    const d = ls.get('decisoes_aguardando')?.detalhe as { vendasAConfirmar?: number; pagamentosAAprovar?: number } | undefined
    if (d?.vendasAConfirmar) return { texto: `Confirmar ${vendasTxt(d.vendasAConfirmar)} parada${d.vendasAConfirmar === 1 ? '' : 's'}: elas entram no resultado confirmado do mês.`, chave: 'decisoes_aguardando', valor: d.vendasAConfirmar, unidade: 'QTD', levar: lev(`Confirmar ${vendasTxt(d.vendasAConfirmar)}`) }
    if (d?.pagamentosAAprovar) return { texto: `Aprovar o pagamento de comissão de ${vendasTxt(d.pagamentosAAprovar)}: a equipe recebe em dia.`, chave: 'decisoes_aguardando', valor: d.pagamentosAAprovar, unidade: 'QTD', levar: lev(`Pagamento de comissão de ${vendasTxt(d.pagamentosAAprovar)}`) }
    return null
  }
  if (area === 'EQUIPE') {
    const n = val('atividades_atrasadas') ?? 0
    if (n > 0) return { texto: `Zerar as ${n} atividades atrasadas: cada uma é um cliente esperando um passo da loja.`, chave: 'atividades_atrasadas', valor: n, unidade: 'QTD', levar: lev(`${n} atividades atrasadas`) }
    return null
  }
  return null
}

// --- Um cartão ---

async function cartao(area: AreaChave, nome: string, defs: Array<{ chave: string; per: Per }>, c: Contexto, mediaEquipe: boolean): Promise<Cartao> {
  const pessoal = c.papel === 'VENDEDOR' || c.papel === 'SDR'
  const e: Escopo = { usuarioId: c.usuarioId, papel: pessoal ? c.papel : 'DONO', vendedorId: pessoal ? c.vendedorId ?? '__nenhum__' : null }
  const lista = await fichas(c.usuarioId)
  // Só as fichas que o papel pode ver; cifras do dono só para ele.
  const visiveis = defs.filter(d => { const f = lista.find(x => x.chave === d.chave); return f && (c.dono || (!CIFRAS_DO_DONO.has(d.chave) && (pessoal || f.quemVe.includes(c.papel as never) || d.chave === 'previsao_fechamento' || d.chave === 'vendas'))) })
  const lidas = await Promise.all(visiveis.map(d => leitura(d.chave, e, d.per, c.agora)))
  const ls = new Map(visiveis.map((d, i) => [d.chave, lidas[i]]))
  // Média da equipe (vendedor e SDR): a mesma ficha na loja; somáveis divididas pelo número de pessoas.
  let medias = new Map<string, number | null>()
  if (mediaEquipe) {
    const n = await prisma.vendedor.count({ where: { usuarioId: c.usuarioId, ativo: true, funcao: null, ...(c.papel === 'SDR' ? { papel: 'SDR' } : { vende: true }) } })
    const loja = await Promise.all(visiveis.map(d => leitura(d.chave, { usuarioId: c.usuarioId, papel: 'DONO' }, d.per, c.agora)))
    medias = new Map(visiveis.map((d, i) => { const f = lista.find(x => x.chave === d.chave)!; const v = loja[i]?.valor ?? null; return [d.chave, v == null ? null : f.aditiva && n > 0 ? v / n : v] }))
  }
  const metricas: MetricaCartao[] = []
  const bons: Ponto[] = [], atencao: Ponto[] = []
  for (const d of visiveis) {
    const l = ls.get(d.chave)
    if (!l) continue
    let valor = l.valor, faixa = l.faixa as string | null
    if (d.chave === 'previsao_fechamento' && c.meta) { valor = c.meta.previsao; faixa = c.meta.faixa }
    const unidade = l.unidade
    const comparacao = d.chave === 'previsao_fechamento' && c.meta?.meta ? `${c.meta.pct}% da meta` : comparacaoTxt(l, d.per)
    // Cifras de faturamento e previsão para quem não é o dono: só a porcentagem da meta.
    const fichaD = lista.find(x => x.chave === d.chave)
    const semCifra = !c.dono && unidade === 'BRL' && (CIFRAS_DO_DONO.has(d.chave) || d.chave === 'previsao_fechamento' || !fichaD?.quemVe.includes(c.papel as never))
    metricas.push({ chave: d.chave, nome: l.nome, valor: semCifra ? null : valor, unidade, texto: semCifra ? (d.chave === 'previsao_fechamento' && comparacao ? comparacao : '—') : fmtValor(valor, unidade), faixa, comparacao: semCifra ? null : comparacao })
    if (semCifra && d.chave !== 'previsao_fechamento') continue
    const media = mediaEquipe ? { valor: medias.get(d.chave) ?? null, rotulo: 'média da equipe' } : null
    let s = sentido(l)
    if (media?.valor != null && l.valor != null && l.melhor !== 'NEUTRO') s = (l.melhor === 'MAIOR' ? l.valor >= media.valor : l.valor <= media.valor) ? 'BOM' : 'RUIM'
    if (d.chave === 'previsao_fechamento' && c.meta) {
      if (c.meta.pct == null) continue
      const t = `Previsão de fechamento em ${c.meta.pct}% da meta${c.dono ? ` (${fmtValor(c.meta.previsao, 'BRL')} contra ${fmtValor(c.meta.meta, 'BRL')})` : ''}`
      ;(c.meta.cobre ? bons : atencao).push({ texto: c.meta.cobre ? `${t}: meta no ritmo` : `${t}: ${c.meta.ritmo}`, chave: d.chave, valor: c.meta.pct, unidade: 'PCT', levar: c.meta.cobre ? null : { area, texto: `Meta do mês: ${c.meta.ritmo}`, refTipo: 'METRICA', refId: d.chave } })
      continue
    }
    if (s === 'BOM') bons.push({ texto: textoPonto(l, d.per, true, media), chave: d.chave, valor: l.valor, unidade })
    else if (s === 'RUIM') atencao.push({ texto: `${textoPonto(l, d.per, false, media)}${l.faixa === 'CRITICO' ? ': crítico' : ''}`, chave: d.chave, valor: l.valor, unidade, levar: { area, texto: `${l.nome}: ${fmtValor(l.valor, unidade)}`, refTipo: 'METRICA', refId: d.chave } })
  }
  const cor = area === 'RESULTADO' && c.meta?.faixa ? corDe([c.meta.faixa]) : corDe(metricas.map(m => m.faixa))
  const op = await oportunidade(area, c, e, ls).catch(() => null)
  // Recomendações abertas da área, roteadas para a pessoa (as mesmas regras da Lente).
  const recs = c.dono || c.papel === 'SUPERVISOR' || c.papel === 'TRAFEGO' || c.papel === 'FINANCEIRO' || c.papel === 'SOCIAL_MEDIA'
    ? await prisma.recomendacao.findMany({ where: { usuarioId: c.usuarioId, status: 'NOVA', area: { in: AREAS_REC[area] }, ...(c.dono ? {} : { visivelPara: { has: c.vendedorId ?? '__' } }), ...(pessoal ? { alvoId: c.vendedorId ?? '__' } : {}) }, select: { id: true, codigo: true, titulo: true }, orderBy: { criadoEm: 'desc' }, take: 2 })
    : await prisma.recomendacao.findMany({ where: { usuarioId: c.usuarioId, status: 'NOVA', alvoTipo: 'PESSOA', alvoId: c.vendedorId ?? '__', area: { in: AREAS_REC[area] } }, select: { id: true, codigo: true, titulo: true }, take: 2 })
  // Dica: o que já funcionou na loja (boa prática registrada) ou o Playbook da área.
  const boa = await prisma.recomendacao.findFirst({ where: { usuarioId: c.usuarioId, tipo: 'FUNCIONANDO', area: { in: AREAS_REC[area] }, status: { in: ['NOVA', 'ACEITA', 'AVALIADA', 'ENCERRADA'] } }, orderBy: { criadoEm: 'desc' }, select: { titulo: true } }).catch(() => null)
  const dica = boa && cor !== 'VERDE' ? `O que já funcionou aqui: ${boa.titulo.charAt(0).toLowerCase()}${boa.titulo.slice(1)}. ${DICAS[area].atencao}` : cor === 'VERDE' ? DICAS[area].bem : DICAS[area].atencao
  return {
    area, nome, href: HREF[area], cor, situacao: `${nome} ${SITUACAO[cor]}`,
    bons: bons.slice(0, 2), atencao: atencao.slice(0, 2), oportunidade: op, dica, metricas: metricas.slice(0, 3),
    recs: recs.map(r => ({ id: r.id, codigo: r.codigo, titulo: r.titulo, levar: { area, texto: `${r.codigo ? `${r.codigo} · ` : ''}${r.titulo}`, refTipo: 'REC', refId: r.id } })),
  }
}

// --- Vendedores (dono e supervisor): um destaque e um ponto de atenção por vendedor ---

async function destaquesPorVendedor(c: Contexto) {
  const vs = await prisma.vendedor.findMany({ where: { usuarioId: c.usuarioId, ativo: true, vende: true, funcao: null }, select: { id: true, nome: true } })
  if (!vs.length) return []
  const nomes = nomesDistintos(vs)
  const mes = mesCorrente(c.agora)
  return Promise.all(vs.slice(0, 12).map(async v => {
    const e: Escopo = { usuarioId: c.usuarioId, papel: 'DONO', vendedorId: v.id }
    const [vendas, conv, sem] = await Promise.all([ler('vendas', e, mes, c.agora).catch(() => null), ler('conversao_lead_venda', e, mes, c.agora).catch(() => null), ler('propostas_sem_follow', e, { inicio: hojeBrt(c.agora), fim: hojeBrt(c.agora) }, c.agora).catch(() => null)])
    const destaque = vendas?.valor ? `${vendasTxt(vendas.valor)} no mês` : conv?.valor ? `conversão de ${fmtValor(conv.valor, 'PCT')}` : null
    const atencao = sem?.valor ? `${sem.valor} ${sem.valor === 1 ? 'proposta sem follow' : 'propostas sem follow'}` : conv?.faixa === 'CRITICO' ? `conversão em ${fmtValor(conv.valor, 'PCT')}, abaixo do padrão` : null
    return { id: v.id, nome: nomes.get(v.id) ?? v.nome, destaque, atencao }
  }))
}

export interface Bussola { cartoes: Cartao[]; vendedores: Awaited<ReturnType<typeof destaquesPorVendedor>> | null; meta: SituacaoMeta | null; geradaEm: string }

/** A bússola da pessoa, no alcance do papel. */
export async function montarBussola(p: { usuarioId: string; papel: PapelHoje; vendedorId: string | null }, agora = new Date()): Promise<Bussola> {
  const dono = p.papel === 'DONO'
  const pessoal = p.papel === 'VENDEDOR' || p.papel === 'SDR'
  const meta = await situacaoDaMeta(p.usuarioId, agora, pessoal ? p.vendedorId : null).catch(() => null)
  const c: Contexto = { usuarioId: p.usuarioId, papel: p.papel, vendedorId: p.vendedorId, agora, meta, dono }
  let cartoes: Cartao[]
  if (pessoal) cartoes = await Promise.all(PESSOAL[p.papel as 'VENDEDOR' | 'SDR'].map(a => cartao(a.area, a.nome, a.metricas, c, true)))
  else cartoes = await Promise.all(AREAS_DO_PAPEL[p.papel].map(a => cartao(a, NOME_AREA[a], METRICAS[a], c, false)))
  const vendedores = dono || p.papel === 'SUPERVISOR' ? await destaquesPorVendedor(c).catch(() => []) : null
  return { cartoes, vendedores, meta, geradaEm: agora.toISOString() }
}
