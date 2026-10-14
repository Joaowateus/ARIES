// Diagnóstico automático da Central: regras fixas e documentadas sobre os
// números já calculados (intelCentral). Cada diagnóstico traz a evidência,
// a meta, o atual, a diferença, as hipóteses (marcadas como hipóteses), a
// confiança, o impacto estimado, o departamento, a ação, o prazo e o
// indicador que vai dizer se a correção funcionou. A severidade vem dos
// critérios configuráveis (intelMotor.Criterios), não da IA.
import { NOME_ETAPA, PASSAGENS, arred, faturamentoProjetado, ORDEM_SEVERIDADE, razao, severidadeDeConversao, type Severidade } from './intelMotor'
import { brl, type DadosCentral } from './intelCentral'

export type Departamento = 'TRAFEGO' | 'SOCIAL_MEDIA' | 'COMERCIAL' | 'GESTAO' | 'FINANCEIRO'
export const NOME_DEPARTAMENTO: Record<Departamento, string> = { TRAFEGO: 'Tráfego', SOCIAL_MEDIA: 'Social Media', COMERCIAL: 'Comercial', GESTAO: 'Gestão', FINANCEIRO: 'Financeiro' }
export const PRAZO_DIAS: Record<Severidade, number> = { CRITICO: 2, ALTO: 5, MODERADO: 10, MONITORAMENTO: 15 }

export interface IndicadorAcao { chave: string; nome: string; atual: number | null; meta: number | null; melhorQuando: 'MAIOR' | 'MENOR'; unidade: 'NUM' | 'PCT' | 'BRL' | 'HORAS' }
export interface Diagnostico {
  chave: string
  departamento: Departamento
  severidade: Severidade
  problema: string
  evidencia: string
  meta: string | null
  atual: string | null
  diferenca: string | null
  hipoteses: string[]
  confianca: 'ALTA' | 'MEDIA' | 'BAIXA'
  impacto: { vendas: number | null; faturamento: number | null; texto: string }
  acao: string
  prazoDias: number
  indicador: IndicadorAcao
  /** Ordena dentro da mesma severidade (maior primeiro). */
  peso: number
}

const p1 = (v: number | null | undefined) => (v == null ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)
const n1 = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }))
const pp = (a: number, b: number) => `${((a - b) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p.`

const HIPOTESES_PASSAGEM: string[][] = [
  ['Demora no primeiro contato com o lead.', 'Distribuição dos leads entre os vendedores.', 'Leads inválidos ou sem telefone.', 'Volume acima da capacidade de atendimento.'],
  ['Qualificação fraca na abordagem.', 'Qualidade dos leads gerados pela origem.', 'Falta de roteiro de perguntas.', 'Lead sem retorno depois do primeiro contato.'],
  ['Ausência de simulação ou demora em montá-la.', 'Demora no retorno ao cliente.', 'Condições comerciais (entrada, parcela, crédito) incompatíveis.', 'Falta de acompanhamento das negociações.'],
  ['Crédito reprovado ou condição de pagamento.', 'Objeções de preço sem tratamento.', 'Follow-up insuficiente depois da proposta.', 'Concorrência com condição melhor.'],
]
const ACAO_PASSAGEM = [
  'Auditar os leads não abordados do período, conferir o tempo até o primeiro contato por vendedor e redistribuir a fila.',
  'Revisar uma amostra de leads abordados que não negociaram, por origem e por vendedor, e ajustar o roteiro de qualificação.',
  'Auditar uma amostra de negociações que não viraram proposta, categorizar os motivos e comparar por vendedor e origem.',
  'Revisar as propostas em aberto e perdidas, registrar o motivo de cada uma e fazer o follow-up das abertas.',
]
const DEP_PASSAGEM: Departamento[] = ['COMERCIAL', 'COMERCIAL', 'COMERCIAL', 'COMERCIAL']

export function gerarDiagnosticos(d: DadosCentral, extras: { acoesAtrasadas: number }): Diagnostico[] {
  const out: Diagnostico[] = []
  const c = d.premissas.criterios
  const metaV = d.premissas.metaVendas
  const ticket = d.resumo.vendas.ticketReal ?? d.premissas.ticketMedio
  const add = (x: Omit<Diagnostico, 'prazoDias'> & { prazoDias?: number }) => out.push({ ...x, prazoDias: x.prazoDias ?? PRAZO_DIAS[x.severidade] })

  // 1. Ritmo de vendas do mês.
  const proj = d.metas.projecao
  if (metaV) {
    if (proj.suficiente && proj.base != null && proj.base < metaV) {
      const sev: Severidade = proj.base < (metaV * c.atingimentoCriticoPct) / 100 ? 'CRITICO' : 'ALTO'
      const faltaV = arred(metaV - proj.base, 1) as number
      add({
        chave: 'ritmo-vendas', departamento: 'GESTAO', severidade: sev, problema: 'No ritmo atual, o mês fecha abaixo da meta de vendas.',
        evidencia: `${d.resumo.vendas.realizado} vendas em ${d.metas.calendario.decorridos} de ${d.metas.calendario.total} dias úteis; projeção base de ${n1(proj.base)} vendas (cenários: ${n1(proj.conservador)} a ${n1(proj.otimista)}).`,
        meta: `${metaV} vendas`, atual: `${n1(proj.base)} projetadas`, diferenca: `${n1(faltaV)} vendas`,
        hipoteses: ['Volume de leads abaixo do necessário.', 'Conversão de alguma etapa abaixo da meta (veja o gargalo).', 'Propostas em aberto sem acompanhamento.'],
        confianca: proj.ritmoMes != null && d.metas.calendario.decorridos >= 8 ? 'ALTA' : 'MEDIA',
        impacto: { vendas: faltaV, faturamento: faturamentoProjetado(faltaV, ticket), texto: `Faltariam cerca de ${n1(faltaV)} vendas (${brl(faturamentoProjetado(faltaV, ticket))} de faturamento bruto, estimado).` },
        acao: `Fazer ${n1(d.metas.ritmoVendas.porDia)} vendas por dia útil até o fim do mês: priorizar as ${d.metas.pipeline.propostasAbertas} propostas em aberto e o gargalo do funil.`,
        indicador: { chave: 'vendas_mes', nome: 'Vendas no mês', atual: d.resumo.vendas.realizado, meta: metaV, melhorQuando: 'MAIOR', unidade: 'NUM' },
        peso: faltaV,
      })
    } else if (!proj.suficiente && d.metas.calendario.decorridos >= 3 && d.resumo.vendas.realizado === 0) {
      add({
        chave: 'sem-vendas', departamento: 'GESTAO', severidade: 'ALTO', problema: 'Nenhuma venda no mês até agora.', evidencia: `${d.metas.calendario.decorridos} dias úteis decorridos sem venda registrada.`,
        meta: `${metaV} vendas`, atual: '0 vendas', diferenca: `${metaV} vendas`, hipoteses: ['Vendas fechadas e ainda não lançadas no sistema.', 'Pipeline sem propostas maduras.'], confianca: 'MEDIA',
        impacto: { vendas: null, faturamento: null, texto: 'Sem ritmo para estimar: confirme se há vendas a lançar.' },
        acao: 'Conferir vendas fechadas e não lançadas e revisar as propostas em aberto.',
        indicador: { chave: 'vendas_mes', nome: 'Vendas no mês', atual: 0, meta: metaV, melhorQuando: 'MAIOR', unidade: 'NUM' }, peso: metaV,
      })
    }
  }

  // 2. Conversões entre etapas (coorte de referência) contra as metas gerenciais.
  const ref = d.funil.referencia
  PASSAGENS.forEach(([de, para], i) => {
    const atual = ref.conversoes[i], meta = d.funil.metasConversao[i], eleg = ref.contagens[de]
    if (atual == null) return
    const sev = severidadeDeConversao(atual * 100, meta * 100, eleg, ref.impactoVendas[i], metaV, c)
    if (!sev) return
    const imp = ref.impactoVendas[i]
    add({
      chave: `conv-${de}-${para}`, departamento: DEP_PASSAGEM[i], severidade: sev,
      problema: `A conversão de ${NOME_ETAPA[de].toLowerCase()} para ${NOME_ETAPA[para].toLowerCase()} está abaixo da meta.`,
      evidencia: `${ref.contagens[para]} de ${eleg} (${p1(atual)}) nos leads criados entre ${ref.periodo.inicio.split('-').reverse().join('/')} e ${ref.periodo.fim.split('-').reverse().join('/')}.`,
      meta: p1(meta), atual: p1(atual), diferenca: pp(atual, meta), hipoteses: HIPOTESES_PASSAGEM[i],
      confianca: eleg >= c.amostraMinima * 3 ? 'ALTA' : eleg >= c.amostraMinima ? 'MEDIA' : 'BAIXA',
      impacto: { vendas: imp, faturamento: faturamentoProjetado(imp, ticket), texto: imp ? `Se esta etapa chegasse à meta, mantidas as demais, seriam cerca de ${n1(imp)} vendas a mais nessa coorte (${brl(faturamentoProjetado(imp, ticket))}, estimativa).` : 'Impacto não estimável com os dados atuais.' },
      acao: ACAO_PASSAGEM[i],
      indicador: { chave: `conv:${i}`, nome: `Conversão ${NOME_ETAPA[de]} → ${NOME_ETAPA[para]}`, atual: arred(atual * 100, 1), meta: arred(meta * 100, 1), melhorQuando: 'MAIOR', unidade: 'PCT' },
      peso: imp ?? 0,
    })
  })

  // 3. Volume de leads contra o necessário.
  const ln = d.metas.leadsNecessarios
  if (ln.comConversaoAtual != null && d.metas.calendario.decorridos >= 3) {
    const diasMes = d.metas.calendario.total, decorr = d.metas.calendario.decorridos
    const projLeads = Math.round((ln.geradosNoMes / decorr) * diasMes)
    if (projLeads < ln.comConversaoAtual) {
      const razaoL = projLeads / ln.comConversaoAtual
      add({
        chave: 'volume-leads', departamento: 'TRAFEGO', severidade: razaoL < 0.8 ? 'ALTO' : 'MODERADO',
        problema: 'O volume de leads do mês não sustenta a meta de vendas com a conversão atual.',
        evidencia: `${ln.geradosNoMes} leads em ${decorr} dias úteis; no ritmo, ${projLeads} no mês. Com a conversão total atual (${p1(d.funil.referencia.conversaoTotal)}), a meta pede ${ln.comConversaoAtual}.`,
        meta: `${ln.comConversaoAtual} leads`, atual: `${projLeads} projetados`, diferenca: `${ln.comConversaoAtual - projLeads} leads`,
        hipoteses: ['Investimento abaixo do planejado ou mal distribuído.', 'Queda de alcance dos anúncios ou do orgânico.', 'Conversão baixa que exige volume maior (melhorar conversão reduz a necessidade).'],
        confianca: 'MEDIA', impacto: { vendas: null, faturamento: null, texto: `Também é possível reduzir a necessidade melhorando a conversão: com as metas gerenciais, bastariam ${ln.comMetas ?? '—'} leads.` },
        acao: 'Revisar na reunião de tráfego o volume diário necessário, o orçamento restante e os criativos; em paralelo, atacar o gargalo do funil.',
        indicador: { chave: 'leads_mes', nome: 'Leads no mês', atual: ln.geradosNoMes, meta: ln.comConversaoAtual, melhorQuando: 'MAIOR', unidade: 'NUM' }, peso: ln.comConversaoAtual - projLeads,
      })
    }
  }

  // 4. CPL acima do máximo compatível. 5. Ritmo de investimento. 6. Custo por venda.
  const inv = d.resumo.investimento
  if (inv && d.resumo.cplMes != null && d.metas.cplMaximo?.comConversaoAtual != null) {
    const max = d.metas.cplMaximo.comConversaoAtual
    if (d.resumo.cplMes > max * (1 + c.cplToleranciaPct / 100)) {
      add({
        chave: 'cpl-acima', departamento: 'TRAFEGO', severidade: d.resumo.leadsMes >= c.amostraMinima ? 'ALTO' : 'MONITORAMENTO',
        problema: 'O custo por lead está acima do que o orçamento comporta para a meta.',
        evidencia: `${brl(inv.realizado)} investidos (${inv.fonte}) para ${d.resumo.leadsMes} leads no CRM: CPL de ${brl(d.resumo.cplMes)}.`,
        meta: `até ${brl(max)}`, atual: brl(d.resumo.cplMes), diferenca: brl(d.resumo.cplMes - max),
        hipoteses: ['Criativo ou público com desempenho em queda.', 'Leads da plataforma que não chegam ao CRM.', 'Concorrência maior no leilão.'],
        confianca: d.resumo.leadsMes >= c.amostraMinima ? 'MEDIA' : 'BAIXA', impacto: { vendas: null, faturamento: null, texto: 'Com o mesmo orçamento, entram menos leads do que a meta pede.' },
        acao: 'Comparar o CPL por campanha e criativo antes de mexer em orçamento; só realocar com amostra suficiente.',
        indicador: { chave: 'cpl_mes', nome: 'CPL do mês (CRM)', atual: arred(d.resumo.cplMes), meta: arred(max), melhorQuando: 'MENOR', unidade: 'BRL' }, peso: d.resumo.cplMes - max,
      })
    }
  }
  const ritmo = d.trafego?.ritmo
  if (inv && ritmo?.pct != null) {
    if (ritmo.pct * 100 > c.ritmoInvestimentoAltoPct) {
      add({
        chave: 'investimento-acima', departamento: 'TRAFEGO', severidade: 'ALTO', problema: 'O investimento está acima do ritmo do orçamento.',
        evidencia: `${brl(ritmo.gastoMes)} investidos até hoje, contra ${brl(ritmo.orcamentoProporcional)} proporcionais ao orçamento de ${brl(inv.orcamento)}. No ritmo, o mês fecha em ${brl(ritmo.projecaoMes)}.`,
        meta: brl(ritmo.orcamentoProporcional), atual: brl(ritmo.gastoMes), diferenca: p1(ritmo.pct - 1),
        hipoteses: ['Orçamento diário das campanhas acima do planejado.', 'Campanha nova sem limite de gasto.'], confianca: 'ALTA',
        impacto: { vendas: null, faturamento: null, texto: `Pode faltar verba no fim do mês ou estourar o orçamento em ${brl((ritmo.projecaoMes ?? 0) - inv.orcamento)}.` },
        acao: 'Revisar o orçamento diário das campanhas com o gestor de tráfego. Nenhuma mudança é feita sem aprovação.',
        indicador: { chave: 'invest_ritmo', nome: 'Investimento ÷ orçamento proporcional', atual: arred(ritmo.pct * 100, 1), meta: 100, melhorQuando: 'MENOR', unidade: 'PCT' }, peso: ritmo.pct,
      })
    } else if (ritmo.pct < 0.7 && d.metas.calendario.decorridos >= 8) {
      add({
        chave: 'investimento-abaixo', departamento: 'TRAFEGO', severidade: 'MODERADO', problema: 'O investimento está abaixo do planejado.',
        evidencia: `${brl(ritmo.gastoMes)} investidos, contra ${brl(ritmo.orcamentoProporcional)} proporcionais.`, meta: brl(ritmo.orcamentoProporcional), atual: brl(ritmo.gastoMes), diferenca: p1(ritmo.pct - 1),
        hipoteses: ['Campanhas pausadas ou com limite baixo.', 'Problema de pagamento na conta de anúncios.'], confianca: 'ALTA',
        impacto: { vendas: null, faturamento: null, texto: 'Menos investimento costuma significar menos leads, se o CPL se mantiver.' },
        acao: 'Confirmar com o tráfego se a subutilização é intencional.',
        indicador: { chave: 'invest_ritmo', nome: 'Investimento ÷ orçamento proporcional', atual: arred(ritmo.pct * 100, 1), meta: 100, melhorQuando: 'MAIOR', unidade: 'PCT' }, peso: 1 - ritmo.pct,
      })
    }
  }
  if (inv && d.resumo.custoMarketingPorVenda != null && d.premissas.tetoCustoMarketingVenda != null && d.resumo.custoMarketingPorVenda > d.premissas.tetoCustoMarketingVenda) {
    add({
      chave: 'custo-venda', departamento: 'FINANCEIRO', severidade: d.resumo.vendas.realizado >= 3 ? 'ALTO' : 'MONITORAMENTO',
      problema: 'O custo de marketing por venda está acima do teto do planejamento.',
      evidencia: `${brl(inv.realizado)} de mídia para ${d.resumo.vendas.realizado} vendas no mês (todas as vendas, não só as atribuídas).`,
      meta: `até ${brl(d.premissas.tetoCustoMarketingVenda)}`, atual: brl(d.resumo.custoMarketingPorVenda), diferenca: brl(d.resumo.custoMarketingPorVenda - d.premissas.tetoCustoMarketingVenda),
      hipoteses: ['Poucas vendas para o investimento feito até aqui (início de mês).', 'Conversão baixa no fundo do funil.'], confianca: d.resumo.vendas.realizado >= 3 ? 'MEDIA' : 'BAIXA',
      impacto: { vendas: null, faturamento: null, texto: 'É custo de mídia por venda, não custo operacional completo: avalie junto com a margem.' },
      acao: 'Acompanhar até o fechamento do mês e comparar com a margem por moto antes de cortar investimento.',
      indicador: { chave: 'custo_venda', nome: 'Custo de marketing por venda', atual: arred(d.resumo.custoMarketingPorVenda), meta: d.premissas.tetoCustoMarketingVenda, melhorQuando: 'MENOR', unidade: 'BRL' }, peso: d.resumo.custoMarketingPorVenda,
    })
  }

  // 7. Qualidade dos leads de tráfego frente aos demais.
  const q = d.trafego?.qualidade
  if (q && q.trafego.leads >= c.amostraMinima && q.outros.leads >= c.amostraMinima && q.trafego.taxaNegociacao != null && q.outros.taxaNegociacao != null
    && (q.outros.taxaNegociacao - q.trafego.taxaNegociacao) * 100 >= c.desvioAltoPP) {
    add({
      chave: 'qualidade-trafego', departamento: 'TRAFEGO', severidade: 'ALTO', problema: 'Os leads de tráfego chegam menos à negociação que os demais.',
      evidencia: `${p1(q.trafego.taxaNegociacao)} dos ${q.trafego.leads} leads de tráfego chegaram à negociação, contra ${p1(q.outros.taxaNegociacao)} dos ${q.outros.leads} demais (coorte de referência).`,
      meta: p1(q.outros.taxaNegociacao), atual: p1(q.trafego.taxaNegociacao), diferenca: pp(q.trafego.taxaNegociacao, q.outros.taxaNegociacao),
      hipoteses: ['Público ou criativo atraindo curiosos.', 'Formulário ou mensagem automática sem filtro.', 'Atendimento diferente para leads de anúncio.'], confianca: 'MEDIA',
      impacto: { vendas: null, faturamento: null, texto: 'Volume de tráfego que não vira oportunidade encarece cada venda.' },
      acao: 'Na reunião de tráfego, revisar públicos e a mensagem de entrada; no comercial, auditar o atendimento dos leads de anúncio.',
      indicador: { chave: 'qualidade_trafego', nome: 'Leads de tráfego que chegam à negociação', atual: arred(q.trafego.taxaNegociacao * 100, 1), meta: arred(q.outros.taxaNegociacao * 100, 1), melhorQuando: 'MAIOR', unidade: 'PCT' }, peso: q.outros.taxaNegociacao - q.trafego.taxaNegociacao,
    })
  }

  // 8. Atendimento.
  const eq = d.equipe
  if (eq) {
    if (eq.semAbordar > 0) add({
      chave: 'sem-abordar', departamento: 'COMERCIAL', severidade: eq.semAbordar >= 5 ? 'ALTO' : 'MODERADO', problema: 'Há leads novos sem abordagem há mais de 1 dia.',
      evidencia: `${eq.semAbordar} leads novos parados no CRM.`, meta: '0', atual: String(eq.semAbordar), diferenca: String(eq.semAbordar),
      hipoteses: ['Fila sem dono definido.', 'Vendedor sobrecarregado.'], confianca: 'ALTA', impacto: { vendas: null, faturamento: null, texto: 'Cada lead esfriando reduz a chance de venda, e o custo de mídia dele já foi pago.' },
      acao: 'Distribuir e abordar hoje os leads novos parados.', indicador: { chave: 'sem_abordar', nome: 'Leads novos sem abordagem', atual: eq.semAbordar, meta: 0, melhorQuando: 'MENOR', unidade: 'NUM' }, peso: eq.semAbordar,
    })
    if (eq.whatsapp.esperando > 0) add({
      chave: 'whats-esperando', departamento: 'COMERCIAL', severidade: 'ALTO', problema: 'Leads qualificados esperando resposta no WhatsApp.',
      evidencia: `${eq.whatsapp.esperando} conversas esperando o vendedor agora.`, meta: '0', atual: String(eq.whatsapp.esperando), diferenca: String(eq.whatsapp.esperando),
      hipoteses: ['Vendedor fora do WhatsApp no horário.', 'Aviso do assistente não visto.'], confianca: 'ALTA', impacto: { vendas: null, faturamento: null, texto: 'Lead qualificado que espera esfria.' },
      acao: 'Responder hoje as conversas esperando (o Copiloto de cada vendedor sugere a resposta).', indicador: { chave: 'whats_esperando', nome: 'Conversas esperando resposta', atual: eq.whatsapp.esperando, meta: 0, melhorQuando: 'MENOR', unidade: 'NUM' }, peso: eq.whatsapp.esperando,
    })
    const linhas = eq.linhas.filter(l => l.carteira >= 10 && l.conversaoLeadAbordado != null)
    const media = linhas.length ? linhas.reduce((s, l) => s + (l.conversaoLeadAbordado as number), 0) / linhas.length : null
    for (const l of linhas) if (media != null && media - (l.conversaoLeadAbordado as number) >= c.desvioAltoPP) add({
      chave: `apoio-${l.vendedorId}`, departamento: 'GESTAO', severidade: 'MODERADO', problema: `${l.nome} precisa de apoio na abordagem.`,
      evidencia: `${l.conversaoLeadAbordado}% dos leads de ${l.nome} viram abordados, contra ${Math.round(media)}% na média da equipe; ${l.parados} leads parados.`,
      meta: `${Math.round(media)}%`, atual: `${l.conversaoLeadAbordado}%`, diferenca: `${Math.round((l.conversaoLeadAbordado as number) - media)} p.p.`,
      hipoteses: ['Carteira maior que a capacidade.', 'Dificuldade com o roteiro de abordagem.'], confianca: 'MEDIA', impacto: { vendas: null, faturamento: null, texto: 'Leads parados na carteira de uma pessoa.' },
      acao: `Conversa individual com ${l.nome} e revisão da carteira (o copiloto dele mostra o detalhe).`, indicador: { chave: `abordagem:${l.vendedorId}`, nome: `Lead → abordado (${l.nome})`, atual: l.conversaoLeadAbordado, meta: Math.round(media), melhorQuando: 'MAIOR', unidade: 'PCT' }, peso: media - (l.conversaoLeadAbordado as number),
    })
  }

  // 10. Social Media (produção, distribuição).
  const s = d.social as null | { erro?: string; producao?: { publicacoesNoFeed: number; metaPublicacoes: number; planejadas: number; publicadasPelaProducao: number }; distribuicao?: { alcanceMedioDia: number | null; alcanceMedioDiaAnterior: number | null }; interesse?: { visitasPerfil: number | null; visitasPerfilAnterior: number | null } }
  if (s?.producao && s.producao.metaPublicacoes > 0 && s.producao.publicacoesNoFeed < s.producao.metaPublicacoes) {
    add({
      chave: 'social-producao', departamento: 'SOCIAL_MEDIA', severidade: s.producao.publicacoesNoFeed < s.producao.metaPublicacoes * 0.6 ? 'ALTO' : 'MODERADO', problema: 'Publicações abaixo da meta do período.',
      evidencia: `${s.producao.publicacoesNoFeed} publicações no feed contra a meta de ${s.producao.metaPublicacoes}; ${s.producao.publicadasPelaProducao} de ${s.producao.planejadas} pautas agendadas foram publicadas.`,
      meta: String(s.producao.metaPublicacoes), atual: String(s.producao.publicacoesNoFeed), diferenca: String(s.producao.metaPublicacoes - s.producao.publicacoesNoFeed),
      hipoteses: ['Gargalo de gravação ou edição.', 'Aprovação demorada.'], confianca: 'ALTA', impacto: { vendas: null, faturamento: null, texto: 'Menos conteúdo, menos alcance orgânico e menos demanda gratuita.' },
      acao: 'Revisar a fila da Produção no Social Media e destravar as pautas paradas.', indicador: { chave: 'social_publicacoes', nome: 'Publicações no período', atual: s.producao.publicacoesNoFeed, meta: s.producao.metaPublicacoes, melhorQuando: 'MAIOR', unidade: 'NUM' }, peso: s.producao.metaPublicacoes - s.producao.publicacoesNoFeed,
    })
  }
  const al = s?.distribuicao
  if (al?.alcanceMedioDia != null && al.alcanceMedioDiaAnterior && al.alcanceMedioDia < al.alcanceMedioDiaAnterior * 0.8) {
    const queda = razao(al.alcanceMedioDiaAnterior - al.alcanceMedioDia, al.alcanceMedioDiaAnterior)
    add({
      chave: 'social-alcance', departamento: 'SOCIAL_MEDIA', severidade: 'MODERADO', problema: 'O alcance orgânico caiu frente ao período anterior.',
      evidencia: `Alcance médio por dia de ${n1(al.alcanceMedioDia)}, contra ${n1(al.alcanceMedioDiaAnterior)} no período anterior (queda de ${p1(queda)}).`,
      meta: n1(al.alcanceMedioDiaAnterior), atual: n1(al.alcanceMedioDia), diferenca: p1(queda),
      hipoteses: ['Menos publicações ou formatos com menor distribuição.', 'Ganchos fracos nos primeiros segundos.'], confianca: 'MEDIA', impacto: { vendas: null, faturamento: null, texto: 'Correlação, não causa comprovada: confirme na aba Desempenho.' },
      acao: 'Comparar formatos e ganchos dos últimos posts na aba Desempenho e testar o que mais reteve.', indicador: { chave: 'social_alcance', nome: 'Alcance médio por dia', atual: al.alcanceMedioDia, meta: al.alcanceMedioDiaAnterior, melhorQuando: 'MAIOR', unidade: 'NUM' }, peso: queda ?? 0,
    })
  }

  // 11. Inconsistência de investimento. 12. Ações atrasadas. 13. Estoque parado.
  if (d.inconsistencias.some(i => i.titulo.startsWith('Investimento diferente'))) add({
    chave: 'fonte-investimento', departamento: 'FINANCEIRO', severidade: 'MODERADO', problema: 'Duas fontes de investimento com valores diferentes.',
    evidencia: d.inconsistencias.find(i => i.titulo.startsWith('Investimento diferente'))!.detalhe, meta: null, atual: null, diferenca: null,
    hipoteses: ['Gasto digitado desatualizado.', 'Gasto em outra plataforma além da Meta.'], confianca: 'ALTA', impacto: { vendas: null, faturamento: null, texto: 'ROAS e custo por venda mudam conforme a fonte.' },
    acao: 'Validar o gasto do mês e corrigir a fonte que estiver errada.', indicador: { chave: 'custo_venda', nome: 'Custo de marketing por venda', atual: d.resumo.custoMarketingPorVenda, meta: d.premissas.tetoCustoMarketingVenda, melhorQuando: 'MENOR', unidade: 'BRL' }, peso: 1,
  })
  if (extras.acoesAtrasadas > 0) add({
    chave: 'acoes-atrasadas', departamento: 'GESTAO', severidade: extras.acoesAtrasadas >= 3 ? 'ALTO' : 'MODERADO', problema: 'Ações do plano com prazo vencido.',
    evidencia: `${extras.acoesAtrasadas} ações passaram do prazo sem conclusão.`, meta: '0', atual: String(extras.acoesAtrasadas), diferenca: String(extras.acoesAtrasadas),
    hipoteses: ['Responsável sem tempo ou sem autonomia.', 'Prazo irreal.'], confianca: 'ALTA', impacto: { vendas: null, faturamento: null, texto: 'Problema identificado e não tratado continua custando.' },
    acao: 'Revisar as ações atrasadas na próxima reunião: replanejar o prazo ou trocar o responsável.', indicador: { chave: 'acoes_atrasadas', nome: 'Ações atrasadas', atual: extras.acoesAtrasadas, meta: 0, melhorQuando: 'MENOR', unidade: 'NUM' }, peso: extras.acoesAtrasadas,
  })
  const antigas = d.estoque.maisAntigas.filter(m => m.dias >= 60)
  if (antigas.length) add({
    chave: 'estoque-parado', departamento: 'GESTAO', severidade: 'MONITORAMENTO', problema: 'Motos há mais de 60 dias no estoque.',
    evidencia: antigas.map(m => `${m.modelo} (${m.dias} dias)`).join(', ') + '.', meta: 'até 60 dias', atual: `${antigas[0].dias} dias`, diferenca: null,
    hipoteses: ['Preço acima do mercado.', 'Pouca exposição em conteúdo e anúncios.'], confianca: 'MEDIA', impacto: { vendas: null, faturamento: null, texto: 'Capital parado no estoque.' },
    acao: 'Priorizar essas motos em conteúdo e em uma campanha de teste.', indicador: { chave: 'estoque_60', nome: 'Motos com mais de 60 dias', atual: antigas.length, meta: 0, melhorQuando: 'MENOR', unidade: 'NUM' }, peso: antigas.length,
  })

  return out.sort((a, b) => ORDEM_SEVERIDADE[a.severidade] - ORDEM_SEVERIDADE[b.severidade] || b.peso - a.peso)
}

/** Valor atual de um indicador de ação, pela mesma chave do diagnóstico. */
export function valorDoIndicador(chave: string, d: DadosCentral, extras: { acoesAtrasadas: number }): number | null {
  if (chave === 'vendas_mes') return d.resumo.vendas.realizado
  if (chave === 'faturamento_mes') return d.resumo.faturamento.realizado
  if (chave.startsWith('conv:')) { const v = d.funil.referencia.conversoes[Number(chave.slice(5))]; return v == null ? null : arred(v * 100, 1) }
  if (chave === 'leads_mes') return d.metas.leadsNecessarios.geradosNoMes
  if (chave === 'cpl_mes') return arred(d.resumo.cplMes)
  if (chave === 'custo_venda') return arred(d.resumo.custoMarketingPorVenda)
  if (chave === 'invest_ritmo') return d.trafego?.ritmo.pct != null ? arred(d.trafego.ritmo.pct * 100, 1) : null
  if (chave === 'qualidade_trafego') return d.trafego?.qualidade.trafego.taxaNegociacao != null ? arred(d.trafego.qualidade.trafego.taxaNegociacao * 100, 1) : null
  if (chave === 'sem_abordar') return d.equipe?.semAbordar ?? null
  if (chave === 'whats_esperando') return d.equipe?.whatsapp.esperando ?? null
  if (chave === 'tempo_abordagem') return d.equipe?.tempoAbordagemHoras ?? null
  if (chave.startsWith('abordagem:')) return d.equipe?.linhas.find(l => l.vendedorId === chave.slice(10))?.conversaoLeadAbordado ?? null
  const s = d.social as null | { producao?: { publicacoesNoFeed: number }; distribuicao?: { alcanceMedioDia: number | null } }
  if (chave === 'social_publicacoes') return s?.producao?.publicacoesNoFeed ?? null
  if (chave === 'social_alcance') return s?.distribuicao?.alcanceMedioDia ?? null
  if (chave === 'acoes_atrasadas') return extras.acoesAtrasadas
  if (chave === 'estoque_60') return d.estoque.maisAntigas.filter(m => m.dias >= 60).length
  return null
}

/** Catálogo de indicadores que uma ação manual pode acompanhar. */
export const INDICADORES_ACAO: Array<{ chave: string; nome: string; melhorQuando: 'MAIOR' | 'MENOR'; unidade: IndicadorAcao['unidade'] }> = [
  { chave: 'vendas_mes', nome: 'Vendas no mês', melhorQuando: 'MAIOR', unidade: 'NUM' },
  { chave: 'faturamento_mes', nome: 'Faturamento do mês', melhorQuando: 'MAIOR', unidade: 'BRL' },
  ...PASSAGENS.map(([de, para], i) => ({ chave: `conv:${i}`, nome: `Conversão ${NOME_ETAPA[de]} → ${NOME_ETAPA[para]}`, melhorQuando: 'MAIOR' as const, unidade: 'PCT' as const })),
  { chave: 'leads_mes', nome: 'Leads no mês', melhorQuando: 'MAIOR', unidade: 'NUM' },
  { chave: 'cpl_mes', nome: 'CPL do mês (CRM)', melhorQuando: 'MENOR', unidade: 'BRL' },
  { chave: 'custo_venda', nome: 'Custo de marketing por venda', melhorQuando: 'MENOR', unidade: 'BRL' },
  { chave: 'qualidade_trafego', nome: 'Leads de tráfego que chegam à negociação', melhorQuando: 'MAIOR', unidade: 'PCT' },
  { chave: 'sem_abordar', nome: 'Leads novos sem abordagem', melhorQuando: 'MENOR', unidade: 'NUM' },
  { chave: 'whats_esperando', nome: 'Conversas esperando resposta', melhorQuando: 'MENOR', unidade: 'NUM' },
  { chave: 'tempo_abordagem', nome: 'Tempo até a 1ª abordagem (h)', melhorQuando: 'MENOR', unidade: 'HORAS' },
  { chave: 'social_publicacoes', nome: 'Publicações no período', melhorQuando: 'MAIOR', unidade: 'NUM' },
  { chave: 'social_alcance', nome: 'Alcance médio por dia', melhorQuando: 'MAIOR', unidade: 'NUM' },
]

/** O indicador chegou à meta? (null quando não dá para medir). */
export function atingiuMeta(atual: number | null, meta: number | null, melhorQuando: string | null): boolean | null {
  if (atual == null || meta == null) return null
  return melhorQuando === 'MENOR' ? atual <= meta : atual >= meta
}

// ---------- Desempenho por departamento ----------

export interface LinhaScore { nome: string; valor: string; meta: string | null; status: 'OK' | 'ATENCAO' | 'CRITICO' | 'SEM_DADOS' | 'INFO'; nota?: string }
export interface Scorecard { departamento: Departamento; nome: string; controla: string; linhas: LinhaScore[]; diagnosticos: number }

const st = (ok: boolean | null, critico = false): LinhaScore['status'] => (ok == null ? 'SEM_DADOS' : ok ? 'OK' : critico ? 'CRITICO' : 'ATENCAO')

export function scorecards(d: DadosCentral, diags: Diagnostico[], acoes: { abertas: number; atrasadas: number; concluidasNoPrazo: number; concluidas: number }): Scorecard[] {
  const conta = (dep: Departamento) => diags.filter(x => x.departamento === dep).length
  const ref = d.funil.referencia
  const metas = d.funil.metasConversao
  const conv = (i: number) => ref.conversoes[i]
  const linhaConv = (i: number, nome: string): LinhaScore => ({ nome, valor: p1(conv(i)), meta: p1(metas[i]), status: st(conv(i) == null ? null : (conv(i) as number) >= metas[i]) })
  const out: Scorecard[] = []
  if (d.trafego) {
    const t = d.trafego
    out.push({
      departamento: 'TRAFEGO', nome: 'Tráfego', controla: 'Orçamento, eficiência de mídia, volume e qualidade dos leads de anúncio.', diagnosticos: conta('TRAFEGO'),
      linhas: [
        { nome: 'Investimento no mês', valor: brl(t.ritmo.gastoMes), meta: `${brl(t.ritmo.orcamentoProporcional)} proporcionais`, status: st(t.ritmo.pct == null ? null : t.ritmo.pct * 100 <= d.premissas.criterios.ritmoInvestimentoAltoPct) },
        { nome: 'CPL do mês (CRM)', valor: brl(d.resumo.cplMes), meta: d.metas.cplMaximo?.comConversaoAtual != null ? `até ${brl(d.metas.cplMaximo.comConversaoAtual)}` : null, status: st(d.resumo.cplMes == null || d.metas.cplMaximo?.comConversaoAtual == null ? null : d.resumo.cplMes <= d.metas.cplMaximo.comConversaoAtual) },
        { nome: 'Leads de tráfego no período (CRM)', valor: String(t.crm.leadsTrafego), meta: null, status: 'INFO' },
        { nome: 'Leads de tráfego que chegam à negociação', valor: p1(t.qualidade.trafego.taxaNegociacao), meta: t.qualidade.outros.taxaNegociacao != null ? `${p1(t.qualidade.outros.taxaNegociacao)} nos demais` : null, status: st(t.qualidade.trafego.taxaNegociacao == null || t.qualidade.outros.taxaNegociacao == null ? null : t.qualidade.trafego.taxaNegociacao >= t.qualidade.outros.taxaNegociacao - 0.05) },
        { nome: 'Custo por venda atribuída ao tráfego', valor: brl(t.atribuicao.custoPorVenda), meta: d.premissas.tetoCustoMarketingVenda != null ? `até ${brl(d.premissas.tetoCustoMarketingVenda)}` : null, status: st(t.atribuicao.custoPorVenda == null || d.premissas.tetoCustoMarketingVenda == null ? null : t.atribuicao.custoPorVenda <= d.premissas.tetoCustoMarketingVenda), nota: 'Atribuição pelo canal do lead no CRM.' },
      ],
    })
  }
  const s = d.social as null | { producao?: { publicacoesNoFeed: number; metaPublicacoes: number }; distribuicao?: { alcanceMedioDia: number | null; alcanceMedioDiaAnterior: number | null }; atencao?: { tempoMedioAssistidoSeg: number | null }; interesse?: { visitasPerfil: number | null; taxaEngajamento: number | null }; conversao?: { novosSeguidores: number; leadsOrganicos: number; vendasAtribuidas: number } }
  out.push({
    departamento: 'SOCIAL_MEDIA', nome: 'Social Media', controla: 'Produção, distribuição, retenção, engajamento, audiência e conversões originadas do conteúdo.', diagnosticos: conta('SOCIAL_MEDIA'),
    linhas: !s?.producao ? [{ nome: 'Instagram da empresa', valor: 'não conectado', meta: null, status: 'SEM_DADOS' }] : [
      { nome: 'Publicações no período', valor: String(s.producao.publicacoesNoFeed), meta: String(s.producao.metaPublicacoes), status: st(s.producao.publicacoesNoFeed >= s.producao.metaPublicacoes) },
      { nome: 'Alcance médio por dia', valor: n1(s.distribuicao?.alcanceMedioDia), meta: s.distribuicao?.alcanceMedioDiaAnterior != null ? `${n1(s.distribuicao.alcanceMedioDiaAnterior)} no período anterior` : null, status: st(s.distribuicao?.alcanceMedioDia == null || s.distribuicao.alcanceMedioDiaAnterior == null ? null : s.distribuicao.alcanceMedioDia >= s.distribuicao.alcanceMedioDiaAnterior * 0.9) },
      { nome: 'Tempo médio assistido nos reels', valor: s.atencao?.tempoMedioAssistidoSeg != null ? `${n1(s.atencao.tempoMedioAssistidoSeg)} s` : '—', meta: null, status: 'INFO' },
      { nome: 'Visitas ao perfil', valor: n1(s.interesse?.visitasPerfil), meta: null, status: 'INFO' },
      { nome: 'Novos seguidores', valor: String(s.conversao?.novosSeguidores ?? '—'), meta: null, status: 'INFO' },
      { nome: 'Leads e vendas atribuídos ao orgânico', valor: `${s.conversao?.leadsOrganicos ?? 0} leads · ${s.conversao?.vendasAtribuidas ?? 0} vendas`, meta: null, status: 'INFO', nota: 'Só o que tem código do post ou veio pelo Atendimento.' },
    ],
  })
  out.push({
    departamento: 'COMERCIAL', nome: 'Comercial', controla: 'Tempo de resposta, abordagem, qualificação, propostas, fechamento, vendas e faturamento.', diagnosticos: conta('COMERCIAL'),
    linhas: [
      { nome: 'Tempo até a 1ª abordagem (mediana 30 dias)', valor: d.equipe?.tempoAbordagemHoras != null ? `${n1(d.equipe.tempoAbordagemHoras)} h` : '—', meta: null, status: 'INFO' },
      linhaConv(0, 'Lead → abordado'), linhaConv(1, 'Abordado → negociação'), linhaConv(2, 'Negociação → proposta'), linhaConv(3, 'Proposta → fechamento'),
      { nome: 'Vendas no mês', valor: String(d.resumo.vendas.realizado), meta: d.premissas.metaVendas != null ? String(d.premissas.metaVendas) : null, status: st(d.resumo.atingimentoPrevisto == null ? null : d.resumo.atingimentoPrevisto >= 1, (d.resumo.atingimentoPrevisto ?? 1) < d.premissas.criterios.atingimentoCriticoPct / 100) },
      { nome: 'Leads novos sem abordagem', valor: String(d.equipe?.semAbordar ?? '—'), meta: '0', status: st(d.equipe == null ? null : d.equipe.semAbordar === 0) },
    ],
  })
  out.push({
    departamento: 'GESTAO', nome: 'Gestão', controla: 'Cumprimento das metas, produtividade, processos e acompanhamento dos planos de ação.', diagnosticos: conta('GESTAO'),
    linhas: [
      { nome: 'Faturamento do mês', valor: brl(d.resumo.faturamento.realizado), meta: brl(d.resumo.faturamento.meta), status: st(d.resumo.faturamento.atingimento == null ? null : d.resumo.faturamento.atingimento >= (d.metas.calendario.decorridos / Math.max(1, d.metas.calendario.total))) },
      { nome: 'Vendas por vendedor no mês', valor: n1(razao(d.resumo.vendas.realizado, d.premissas.vendedores.planejados ?? d.vendedoresAtivos)), meta: d.premissas.metaVendas != null ? n1(razao(d.premissas.metaVendas, d.premissas.vendedores.planejados ?? d.vendedoresAtivos)) : null, status: 'INFO' },
      { nome: 'Ações do plano em aberto', valor: String(acoes.abertas), meta: null, status: 'INFO' },
      { nome: 'Ações atrasadas', valor: String(acoes.atrasadas), meta: '0', status: st(acoes.atrasadas === 0) },
      { nome: 'Ações concluídas no prazo', valor: acoes.concluidas ? `${acoes.concluidasNoPrazo} de ${acoes.concluidas}` : '—', meta: null, status: 'INFO' },
      { nome: 'Agenda da equipe cumprida (7 dias)', valor: d.equipe?.agendaPct != null ? `${d.equipe.agendaPct}%` : '—', meta: null, status: 'INFO' },
    ],
  })
  if (d.financeiro) {
    const f = d.financeiro
    out.push({
      departamento: 'FINANCEIRO', nome: 'Financeiro', controla: 'Investimento realizado, custos por venda, margem e resultado.', diagnosticos: conta('FINANCEIRO'),
      linhas: [
        { nome: 'Faturamento bruto do mês', valor: brl(f.faturamentoBruto), meta: null, status: 'INFO', nota: 'Faturamento não é lucro.' },
        { nome: 'Investimento em marketing', valor: brl(f.investimentoMarketing), meta: brl(d.premissas.orcamentoMarketing), status: st(f.investimentoMarketing == null ? null : f.investimentoMarketing <= d.premissas.orcamentoMarketing) },
        { nome: 'Custo de marketing por venda', valor: brl(d.resumo.custoMarketingPorVenda), meta: d.premissas.tetoCustoMarketingVenda != null ? `até ${brl(d.premissas.tetoCustoMarketingVenda)}` : null, status: st(d.resumo.custoMarketingPorVenda == null || d.premissas.tetoCustoMarketingVenda == null ? null : d.resumo.custoMarketingPorVenda <= d.premissas.tetoCustoMarketingVenda) },
        { nome: 'Comissões do mês', valor: brl(f.comissoes), meta: null, status: 'INFO' },
        { nome: 'Margem de contribuição', valor: f.margemConfigurada ? brl(f.margemContribuicao) : 'não configurada', meta: null, status: f.margemConfigurada ? 'INFO' : 'SEM_DADOS' },
      ],
    })
  }
  return out
}
