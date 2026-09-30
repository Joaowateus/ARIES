const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('pro_labore_token')
}

export function setToken(token: string) {
  localStorage.setItem('pro_labore_token', token)
}

export function clearToken() {
  localStorage.removeItem('pro_labore_token')
  localStorage.removeItem('pro_labore_usuario')
}

export function getUsuario(): ProLaboreUsuario | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('pro_labore_usuario')
  return raw ? JSON.parse(raw) : null
}

export function setUsuario(usuario: ProLaboreUsuario) {
  localStorage.setItem('pro_labore_usuario', JSON.stringify(usuario))
}

export type ProLaborePapel = 'DONO' | 'VENDEDOR' | 'SUPERVISOR'

export interface ProLaboreUsuario {
  id: string
  nome: string
  email: string
  papel: ProLaborePapel
  // Só existe pra quem loga como VENDEDOR/SUPERVISOR — meta mensal
  // individual, usada no lugar da meta anual no dashboard de um VENDEDOR.
  metaMensal?: number | null
  // Idem — teto de comissão individual do próprio vendedor. Necessário
  // porque quem loga como VENDEDOR não carrega a lista de Vendedor da
  // conta (só dono/supervisor veem a equipe), então sem isso não teria
  // como calcular a própria comissão potencial sem cair no padrão da
  // conta inteira.
  tetoComissaoPorVenda?: number | null
}

export interface ParametroLiquidez {
  // Pró-labore é sempre do dono, sacado de qualquer venda da operação.
  tetoProLaborePorVenda: number
  // Teto padrão de comissão, usado por vendedores sem comissão individual.
  tetoComissaoPadrao: number
  // Tetos usados só quando o lead está classificado como "R" (renegociação)
  // — substituem os dois de cima (e qualquer teto individual do vendedor)
  // na conversão em venda.
  tetoProLaboreRenegociacao: number
  tetoComissaoRenegociacao: number
  metaFaturamentoAnual: number
  // Meta mensal padrão, usada por vendedores sem meta mensal individual.
  metaMensalPadrao: number
  // Custo por lead no topo da jornada de compra — única cifra que não dá
  // pra derivar sozinho, cadastrada manualmente. Alimenta o custo por lead
  // calculado em cada etapa mais funda (FunilJourney).
  custoPorLeadTopo: number
  fraseMotivacional?: string | null
  // Limiares da Auditoria comercial da Agenda — todos parametrizáveis pela
  // tela de Configurações, nada disso é fixo no código.
  agendaLimiarBomPct: number
  agendaLimiarAtencaoPct: number
  agendaLimiarEfetividadeAltaPct: number
  agendaLimiarOscilacaoPct: number
  agendaAlertaAderenciaPct: number
  agendaAlertaDiasConsecutivos: number
  agendaAlertaQuedaEfetividadePct: number
  agendaReconhecimentoSemanas: number
  // Lista de motivos de Ocorrência, editável em Configurações — CSV numa
  // coluna só (mesmo padrão de AgendaItem.diasSemana/vendedorIds).
  motivosOcorrenciaCsv: string
  // Limiares do Plano de Crescimento (lib/planoCrescimento.ts na API) —
  // também editáveis em Configurações, pelo mesmo motivo dos limiares da
  // Agenda: o que é "ROAS saudável" varia demais de operação pra operação.
  planoRoasMinimo: number
  planoRoasSaudavel: number
  planoConversaoMinimaPct: number
  planoConversaoConsolidadaPct: number
  planoEngajamentoMinimoPct: number
  planoLeadsOrganicosMinimo: number
  planoConcentracaoMaximaLiderPct: number
}

export type TipoMetaFunilPL = 'MINIMO' | 'MAXIMO_PERDA' | 'MAXIMO_CUSTO'

export interface MetaFunilProLabore {
  id: string
  etapa: EstagioFunilPL
  metaPct: number
  metaCusto: number | null
  tipoMeta: TipoMetaFunilPL
}

export interface Vendedor {
  id: string
  nome: string
  ativo: boolean
  email?: string | null
  papel: 'VENDEDOR' | 'SUPERVISOR'
  tetoComissaoPorVenda?: number | null
  metaMensal?: number | null
  criadoEm: string
}

export const ESTAGIOS_LEAD = ['LEAD', 'ABORDADO', 'NEGOCIACAO', 'PROPOSTA', 'FECHADO', 'PERDIDO'] as const
export type EstagioLead = (typeof ESTAGIOS_LEAD)[number]

// Etapas da jornada de compra (FunilJourney) — mesma ordem/nomes de
// ESTAGIOS_LEAD, sem PERDIDO (que não é uma etapa de progresso).
export const ETAPAS_FUNIL_PL = ['LEAD', 'ABORDADO', 'NEGOCIACAO', 'PROPOSTA', 'FECHADO'] as const
export type EstagioFunilPL = (typeof ETAPAS_FUNIL_PL)[number]

export const TIPOS_LEAD = ['TRAFEGO', 'ORGANICO'] as const
export type TipoLead = (typeof TIPOS_LEAD)[number]

// P = pagamento integral (tetos normais da conta) | R = renegociação (tetos
// reduzidos, configuráveis em ParametroLiquidez).
export const TIPOS_NEGOCIACAO = ['P', 'R'] as const
export type TipoNegociacao = (typeof TIPOS_NEGOCIACAO)[number]

export const AGENDA_CATEGORIAS = ['META', 'PROCESSO', 'AUDITORIA', 'PROTOCOLO', 'OUTRO', 'REUNIAO'] as const
export type AgendaCategoria = (typeof AGENDA_CATEGORIAS)[number]

export const AGENDA_TIPOS = ['UNICO', 'RECORRENTE'] as const
export type AgendaTipoItem = (typeof AGENDA_TIPOS)[number]

export interface AgendaItem {
  id: string
  usuarioId: string // id do dono da conta — dobra de "autorId" quando incluiDono
  titulo: string
  descricao?: string | null
  categoria: AgendaCategoria
  tipo: AgendaTipoItem
  data?: string | null // ISO, quando tipo === 'UNICO'
  diasSemana?: string | null // CSV "0,1,2..." (dom-sáb), quando tipo === 'RECORRENTE'
  dataInicio?: string | null
  dataFim?: string | null
  horario?: string | null // "HH:mm", opcional
  // Sem vendedorIds nem incluiDono = toda a equipe. Os dois são
  // independentes entre si — dá pra escolher vendedores específicos E o
  // dono ao mesmo tempo.
  vendedorIds?: string | null // CSV de ids de Vendedor
  incluiDono: boolean
  // Atividade externa (visita, entrega, test-drive) — exige o selo pontual
  // de localização no momento do check-in (não é rastreamento contínuo).
  exigeLocalizacao: boolean
  ativo: boolean
  criadoEm: string
  atualizadoEm: string
}

export interface AgendaConclusao {
  id: string
  agendaItemId: string
  autorId: string
  dataReferencia: string
  concluidoEm: string
  latitude?: number | null
  longitude?: number | null
}

export interface AgendaInicio {
  id: string
  agendaItemId: string
  autorId: string
  dataReferencia: string
  iniciadoEm: string
}

export interface Lead {
  id: string
  nomeCliente: string
  telefone?: string | null
  email?: string | null
  cpf?: string | null
  endereco?: string | null
  modeloInteresse?: string | null
  observacao?: string | null
  tipoLead?: TipoLead | null
  // Como a negociação vai ser paga — muda o teto de pró-labore/comissão
  // usado na conversão em venda. null = ainda não classificada (tratada
  // igual a P na conversão).
  tipoNegociacao?: TipoNegociacao | null
  // Quanto o cliente teria capacidade de gerar de faturamento — base do
  // indicador de oportunidade de faturamento no funil.
  valorNegociacao: number
  estagio: EstagioLead
  vendaId?: string | null
  vendedorId?: string | null
  vendedor?: { id: string; nome: string } | null
  criadoEm: string
  atualizadoEm: string
  fechadoEm?: string | null
  // Transições de estágio em ordem cronológica — usado pra saber QUANDO o
  // lead alcançou cada etapa (não só em que etapa está agora), necessário
  // pra filtrar o funil por período corretamente (ver dataAlcancouEtapa em
  // proLaboreFunilFiltro.tsx).
  historico?: { estagioNovo: EstagioLead; criadoEm: string }[]
}

export interface Venda {
  id: string
  data: string
  valorVenda: number
  valorProLabore: number
  valorComissao?: number | null
  vendedorId?: string | null
  vendedor?: { id: string; nome: string } | null
  observacao?: string | null
  criadoEm: string
}

export interface FunilMensal {
  id: string
  mesReferencia: string
  leads: number
  abordados: number
  negociacao: number
  proposta: number
}

export interface GastoAnuncioMensal {
  id: string
  mesReferencia: string
  valor: number
}

export interface VendedorRanking {
  id: string
  nome: string
  quantidadeVendas: number
  receita: number
  comissaoPaga: number
}

export interface MesPainel {
  mes: number
  label: string
  ano: number
  receita: number
  // Sempre do dono; vem zerado quando quem consulta é um vendedor.
  proLaboreSacado: number
  comissaoPaga: number
  quantidadeVendas: number
  ticketMedio: number
  gastoAnuncios: number
  roas: number
  cac: number
  funil: { leads: number; abordados: number; negociacao: number; proposta: number; fechamento: number }
  conversaoLeadVenda: number
  vendedores: VendedorRanking[]
}

export interface PainelProLabore {
  meses: MesPainel[]
}

export const PERIODOS_RECEITA = ['hoje', '7'] as const
export type ReceitaPeriodo = (typeof PERIODOS_RECEITA)[number]

export interface PontoReceita {
  label: string
  receita: number
  proLabore: number
  vendas: number
}

export interface ReceitaDetalhada {
  totalReceita: number
  totalProLabore: number
  totalVendas: number
  pontos: PontoReceita[]
}

export interface ErroApi extends Error { status?: number; codigo?: string; dados?: unknown }

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })
  // Resposta sem corpo (204, ex.: desconectar) não é JSON — antes quebrava
  // aqui e a tela ficava parada mesmo com a ação feita no servidor.
  const texto = res.status === 204 ? '' : await res.text()
  const body = texto ? JSON.parse(texto) : null
  if (!res.ok) {
    // `codigo`/`dados` deixam a tela reagir a erros específicos (ex.: pedir
    // a senha do departamento em vez de só mostrar a mensagem).
    const erro = new Error(body?.error ?? 'Erro inesperado') as ErroApi
    erro.status = res.status
    erro.codigo = body?.codigo
    erro.dados = body
    throw erro
  }
  return body as T
}

export const proLaboreApi = {
  auth: {
    status: () => request<{ existeUsuario: boolean }>('/pro-labore/auth/status'),
    setup: (data: { nome: string; email: string; senha: string }) =>
      request<{ token: string; usuario: ProLaboreUsuario }>('/pro-labore/auth/setup', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    login: (email: string, senha: string) =>
      request<{ token: string; usuario: ProLaboreUsuario }>('/pro-labore/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, senha }),
      }),
    me: () => request<ProLaboreUsuario>('/pro-labore/auth/me'),
    recuperar: (data: { codigo: string; email: string; senha: string; nome?: string }) =>
      request<{ ok: boolean; email: string }>('/pro-labore/auth/recuperar', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  parametros: {
    get: () => request<ParametroLiquidez>('/pro-labore/parametros'),
    atualizar: (data: Partial<ParametroLiquidez>) =>
      request<ParametroLiquidez>('/pro-labore/parametros', { method: 'PUT', body: JSON.stringify(data) }),
  },
  funilMetas: {
    listar: () => request<MetaFunilProLabore[]>('/pro-labore/funil-metas'),
    atualizar: (etapa: EstagioFunilPL, data: { metaPct?: number; metaCusto?: number; tipoMeta?: TipoMetaFunilPL }) =>
      request<MetaFunilProLabore>(`/pro-labore/funil-metas/${etapa}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  vendedores: {
    listar: () => request<Vendedor[]>('/pro-labore/vendedores'),
    criar: (nome: string) => request<Vendedor>('/pro-labore/vendedores', { method: 'POST', body: JSON.stringify({ nome }) }),
    editar: (id: string, data: { nome?: string; ativo?: boolean; papel?: 'VENDEDOR' | 'SUPERVISOR'; tetoComissaoPorVenda?: number | null; metaMensal?: number | null }) =>
      request<Vendedor>(`/pro-labore/vendedores/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remover: (id: string) => request<{ ok: boolean }>(`/pro-labore/vendedores/${id}`, { method: 'DELETE' }),
    concederAcesso: (id: string, data: { email: string; senha: string }) =>
      request<Vendedor>(`/pro-labore/vendedores/${id}/acesso`, { method: 'POST', body: JSON.stringify(data) }),
    revogarAcesso: (id: string) => request<Vendedor>(`/pro-labore/vendedores/${id}/acesso`, { method: 'DELETE' }),
  },
  vendas: {
    listar: (ano?: number) => request<Venda[]>(`/pro-labore/vendas${ano ? `?ano=${ano}` : ''}`),
    criar: (data: { data: string; valorVenda: number; valorProLabore: number; vendedorId?: string; valorComissao?: number; observacao?: string }) =>
      request<Venda>('/pro-labore/vendas', { method: 'POST', body: JSON.stringify(data) }),
    editar: (id: string, data: { valorVenda?: number; valorProLabore?: number; vendedorId?: string | null; valorComissao?: number | null; observacao?: string }) =>
      request<Venda>(`/pro-labore/vendas/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remover: (id: string) => request<{ ok: boolean }>(`/pro-labore/vendas/${id}`, { method: 'DELETE' }),
  },
  funil: {
    listar: (ano?: number) => request<FunilMensal[]>(`/pro-labore/funil${ano ? `?ano=${ano}` : ''}`),
    salvar: (data: { mesReferencia: string; leads: number; abordados: number; negociacao: number; proposta: number }) =>
      request<FunilMensal>('/pro-labore/funil', { method: 'PUT', body: JSON.stringify(data) }),
  },
  gastosAnuncios: {
    listar: (ano?: number) => request<GastoAnuncioMensal[]>(`/pro-labore/gastos-anuncios${ano ? `?ano=${ano}` : ''}`),
    salvar: (data: { mesReferencia: string; valor: number }) =>
      request<GastoAnuncioMensal>('/pro-labore/gastos-anuncios', { method: 'PUT', body: JSON.stringify(data) }),
  },
  leads: {
    listar: (estagio?: EstagioLead) => request<Lead[]>(`/pro-labore/leads${estagio ? `?estagio=${estagio}` : ''}`),
    criar: (data: { nomeCliente: string; telefone?: string; email?: string; cpf?: string; endereco?: string; modeloInteresse?: string; observacao?: string; vendedorId?: string; tipoLead?: TipoLead; tipoNegociacao?: TipoNegociacao; valorNegociacao: number }) =>
      request<Lead>('/pro-labore/leads', { method: 'POST', body: JSON.stringify(data) }),
    editar: (id: string, data: { nomeCliente?: string; telefone?: string; email?: string; cpf?: string; endereco?: string; modeloInteresse?: string; observacao?: string; vendedorId?: string | null; tipoLead?: TipoLead | null; tipoNegociacao?: TipoNegociacao | null; valorNegociacao?: number }) =>
      request<Lead>(`/pro-labore/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    mudarEstagio: (id: string, estagio: EstagioLead) =>
      request<Lead>(`/pro-labore/leads/${id}/estagio`, { method: 'POST', body: JSON.stringify({ estagio }) }),
    converter: (id: string, data: { data: string; valorVenda: number; valorProLabore: number; valorComissao?: number; observacao?: string }) =>
      request<{ lead: Lead; venda: Venda }>(`/pro-labore/leads/${id}/converter`, { method: 'POST', body: JSON.stringify(data) }),
    remover: (id: string) => request<{ ok: boolean }>(`/pro-labore/leads/${id}`, { method: 'DELETE' }),
  },
  painel: {
    get: (ano?: number, vendedorId?: string) => {
      const params = new URLSearchParams()
      if (ano) params.set('ano', String(ano))
      if (vendedorId) params.set('vendedorId', vendedorId)
      const qs = params.toString()
      return request<PainelProLabore>(`/pro-labore/painel${qs ? `?${qs}` : ''}`)
    },
  },
  receitas: {
    porPeriodo: (periodo: ReceitaPeriodo, vendedorId?: string) => {
      const params = new URLSearchParams({ periodo })
      if (vendedorId) params.set('vendedorId', vendedorId)
      return request<ReceitaDetalhada>(`/pro-labore/receitas-periodo?${params.toString()}`)
    },
    porPeriodoCustom: (inicio: string, fim: string, vendedorId?: string) => {
      const params = new URLSearchParams({ inicio, fim })
      if (vendedorId) params.set('vendedorId', vendedorId)
      return request<ReceitaDetalhada>(`/pro-labore/receitas-periodo?${params.toString()}`)
    },
  },
  agenda: {
    itens: {
      listar: () => request<AgendaItem[]>('/pro-labore/agenda-itens'),
      criar: (data: {
        titulo: string
        descricao?: string
        categoria: AgendaCategoria
        tipo: AgendaTipoItem
        data?: string
        diasSemana?: number[]
        dataInicio?: string
        dataFim?: string
        horario?: string
        vendedorIds?: string[]
        incluiDono?: boolean
        exigeLocalizacao?: boolean
      }) => request<AgendaItem>('/pro-labore/agenda-itens', { method: 'POST', body: JSON.stringify(data) }),
      editar: (
        id: string,
        data: Partial<{
          titulo: string
          descricao: string | null
          categoria: AgendaCategoria
          tipo: AgendaTipoItem
          data: string | null
          diasSemana: number[] | null
          dataInicio: string | null
          dataFim: string | null
          horario: string | null
          vendedorIds: string[] | null
          incluiDono: boolean
          exigeLocalizacao: boolean
          ativo: boolean
        }>,
      ) => request<AgendaItem>(`/pro-labore/agenda-itens/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
      remover: (id: string) => request<{ ok: boolean }>(`/pro-labore/agenda-itens/${id}`, { method: 'DELETE' }),
      concluir: (id: string, data: string, localizacao?: { latitude: number; longitude: number }) =>
        request<{ concluido: boolean; concluidoEm?: string; latitude?: number | null; longitude?: number | null }>(`/pro-labore/agenda-itens/${id}/concluir`, { method: 'POST', body: JSON.stringify({ data, ...localizacao }) }),
      // Sinal independente da conclusão — "comecei a trabalhar nisso", sem
      // necessariamente já ter terminado. Alimenta o funil de aderência.
      iniciar: (id: string, data: string) =>
        request<{ iniciado: boolean; iniciadoEm?: string }>(`/pro-labore/agenda-itens/${id}/iniciar`, { method: 'POST', body: JSON.stringify({ data }) }),
    },
    conclusoes: {
      listar: (inicio: string, fim: string) => request<AgendaConclusao[]>(`/pro-labore/agenda-conclusoes?inicio=${inicio}&fim=${fim}`),
    },
    inicios: {
      listar: (inicio: string, fim: string) => request<AgendaInicio[]>(`/pro-labore/agenda-inicios?inicio=${inicio}&fim=${fim}`),
    },
    // Efetividade comercial por vendedor no período (conversão real do
    // funil de Leads — abordado → fechado) — complementa a aderência da
    // Agenda, que só mede se a rotina foi cumprida, não se gerou resultado.
    efetividade: {
      listar: (inicio: string, fim: string) => request<EfetividadeVendedor[]>(`/pro-labore/agenda/efetividade?inicio=${inicio}&fim=${fim}`),
    },
  },
  ocorrencias: {
    listar: (filtros?: { vendedorId?: string; tipo?: TipoOcorrencia; gravidade?: GravidadeOcorrencia; status?: StatusOcorrencia; inicio?: string; fim?: string }) => {
      const params = new URLSearchParams()
      if (filtros?.vendedorId) params.set('vendedorId', filtros.vendedorId)
      if (filtros?.tipo) params.set('tipo', filtros.tipo)
      if (filtros?.gravidade) params.set('gravidade', filtros.gravidade)
      if (filtros?.status) params.set('status', filtros.status)
      if (filtros?.inicio) params.set('inicio', filtros.inicio)
      if (filtros?.fim) params.set('fim', filtros.fim)
      const qs = params.toString()
      return request<Ocorrencia[]>(`/pro-labore/ocorrencias${qs ? `?${qs}` : ''}`)
    },
    resumo: () => request<ResumoOcorrencias>('/pro-labore/ocorrencias/resumo'),
    sugestaoMedida: (vendedorId: string, tipo: TipoOcorrencia) =>
      request<SugestaoMedidaOcorrencia>(`/pro-labore/ocorrencias/sugestao-medida?vendedorId=${vendedorId}&tipo=${tipo}`),
    obter: (id: string) => request<Ocorrencia>(`/pro-labore/ocorrencias/${id}`),
    criar: (data: {
      vendedorId: string
      tipo: TipoOcorrencia
      motivo: string
      gravidade: GravidadeOcorrencia
      descricao: string
      anexosCsv?: string
      dataOcorrencia: string
      registradoPor: string
      planoDeCorrecao?: string
      prazoCorrecao?: string
      ocorrenciaAnteriorId?: string
    }) => request<Ocorrencia>('/pro-labore/ocorrencias', { method: 'POST', body: JSON.stringify(data) }),
    editar: (id: string, data: Partial<{
      tipo: TipoOcorrencia
      motivo: string
      gravidade: GravidadeOcorrencia
      descricao: string
      anexosCsv: string | null
      dataOcorrencia: string
      planoDeCorrecao: string | null
      prazoCorrecao: string | null
      status: StatusOcorrencia
      medidaAplicada: MedidaDisciplinar
    }>) => request<Ocorrencia>(`/pro-labore/ocorrencias/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    registrarDesfecho: (id: string, data: { resultado: 'CORRIGIDO' | 'NAO_CORRIGIDO'; encaminhamento?: 'REINCIDENTE' | 'ESCALONADA'; medidaAplicada?: MedidaDisciplinar; observacao?: string }) =>
      request<Ocorrencia>(`/pro-labore/ocorrencias/${id}/desfecho`, { method: 'POST', body: JSON.stringify(data) }),
    // O PDF é gerado no próprio navegador (ver gerarDocumentoOcorrenciaPdf em
    // lib/ocorrenciaDocumento.ts) — isso só registra no backend que o
    // documento foi emitido, pra virar carimbo de auditoria.
    marcarDocumentoGerado: (id: string) => request<Ocorrencia>(`/pro-labore/ocorrencias/${id}/documento`, { method: 'POST' }),
    registrarAssinatura: (id: string, parte: 'VENDEDOR' | 'GESTOR', assinado: boolean) =>
      request<Ocorrencia>(`/pro-labore/ocorrencias/${id}/assinatura`, { method: 'POST', body: JSON.stringify({ parte, assinado }) }),
  },
  socialMedia: {
    conta: () => request<SocialMediaConta | null>('/pro-labore/social-media/conta'),
    conectar: (accessToken: string) =>
      request<SocialMediaConta>('/pro-labore/social-media/conectar', { method: 'POST', body: JSON.stringify({ accessToken }) }),
    conectarOAuth: (code: string) =>
      request<SocialMediaConta>('/pro-labore/social-media/conectar-oauth', { method: 'POST', body: JSON.stringify({ code }) }),
    desconectar: () => request<void>('/pro-labore/social-media/conta', { method: 'DELETE' }),
    sincronizar: () => request<{ conta: SocialMediaConta; resultado: ResultadoSyncSocialMedia }>('/pro-labore/social-media/sincronizar', { method: 'POST' }),
    resumo: (periodo?: { inicio: string; fim: string }) => {
      const params = new URLSearchParams()
      if (periodo) { params.set('inicio', periodo.inicio); params.set('fim', periodo.fim) }
      const qs = params.toString()
      return request<AnaliseSocialMedia>(`/pro-labore/social-media/resumo${qs ? `?${qs}` : ''}`)
    },
  },
  assistente: {
    config: (vendedorId?: string) =>
      request<ConfigAssistenteResposta>(`/pro-labore/assistente/config${vendedorId ? `?vendedorId=${vendedorId}` : ''}`),
    salvar: (data: { vendedorId?: string; atendimentoAutomatico?: boolean; configuracao?: ConfigRoteiroAssistente }) =>
      request<AssistenteComercial>('/pro-labore/assistente/config', { method: 'PUT', body: JSON.stringify(data) }),
    conectar: (data: { vendedorId?: string; numeroPareamento?: string }) =>
      request<ConexaoAssistente>('/pro-labore/assistente/conectar', { method: 'POST', body: JSON.stringify(data) }),
    conexao: (vendedorId?: string) =>
      request<{ status: StatusAssistente; aviso?: string }>(`/pro-labore/assistente/conexao${vendedorId ? `?vendedorId=${vendedorId}` : ''}`),
    desconectar: (vendedorId?: string) =>
      request<{ ok: boolean }>(`/pro-labore/assistente/config${vendedorId ? `?vendedorId=${vendedorId}` : ''}`, { method: 'DELETE' }),
    conversas: (params?: { vendedorId?: string; tipo?: TipoConversaAssistente; status?: StatusConversaAssistente; busca?: string }) => {
      const qs = new URLSearchParams()
      if (params?.vendedorId) qs.set('vendedorId', params.vendedorId)
      if (params?.tipo) qs.set('tipo', params.tipo)
      if (params?.status) qs.set('status', params.status)
      if (params?.busca) qs.set('busca', params.busca)
      const s = qs.toString()
      return request<AssistenteConversa[]>(`/pro-labore/assistente/conversas${s ? `?${s}` : ''}`)
    },
    conversa: (id: string) => request<AssistenteConversaDetalhe>(`/pro-labore/assistente/conversas/${id}`),
    enviar: (id: string, texto: string) =>
      request<AssistenteMensagem>(`/pro-labore/assistente/conversas/${id}/mensagens`, { method: 'POST', body: JSON.stringify({ texto }) }),
    acao: (id: string, acao: AcaoConversaAssistente) =>
      request<AssistenteConversa>(`/pro-labore/assistente/conversas/${id}/acao`, { method: 'POST', body: JSON.stringify({ acao }) }),
    resumo: (params: { vendedorId?: string; dias: number }) =>
      request<ResumoAssistente>(`/pro-labore/assistente/resumo?dias=${params.dias}${params.vendedorId ? `&vendedorId=${params.vendedorId}` : ''}`),
    simular: (data: { vendedorId?: string; configuracao?: ConfigRoteiroAssistente; estado: EstadoRoteiroAssistente | null; texto: string; nomeContato?: string }) =>
      request<SimulacaoAssistente>('/pro-labore/assistente/simular', { method: 'POST', body: JSON.stringify(data) }),
    ignorados: (vendedorId?: string) =>
      request<ContatoIgnoradoAssistente[]>(`/pro-labore/assistente/ignorados${vendedorId ? `?vendedorId=${vendedorId}` : ''}`),
    removerIgnorado: (id: string) => request<{ ok: boolean }>(`/pro-labore/assistente/ignorados/${id}`, { method: 'DELETE' }),
  },
  planoCrescimento: {
    obter: () => request<PlanoCrescimento>('/pro-labore/plano-crescimento'),
    criarAcao: (data: { pilar: ChavePilarCrescimento; texto: string }) =>
      request<ItemAcaoCrescimento>('/pro-labore/plano-crescimento/acoes', { method: 'POST', body: JSON.stringify(data) }),
    atualizarAcao: (id: string, data: { concluida?: boolean; texto?: string }) =>
      request<ItemAcaoCrescimento>(`/pro-labore/plano-crescimento/acoes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    excluirAcao: (id: string) => request<{ ok: boolean }>(`/pro-labore/plano-crescimento/acoes/${id}`, { method: 'DELETE' }),
    historico: (meses = 6) => request<HistoricoCrescimentoMes[]>(`/pro-labore/plano-crescimento/historico?meses=${meses}`),
  },
  apresentacoes: {
    listar: () => request<ApresentacaoResumo[]>('/pro-labore/apresentacoes').then(l => l.map(comAutoria)),
    aoVivo: () => request<Array<{ id: string; titulo: string; aoVivoDesde: string | null; bloqueado: boolean; departamento: { id: string; nome: string; cor: string } | null }>>('/pro-labore/apresentacoes/ao-vivo'),
    obter: (id: string) => request<ApresentacaoDetalhe>(`/pro-labore/apresentacoes/${id}`).then(comAutoria),
    criar: (data: { titulo: string; descricao?: string; icone?: string; arvore?: ArvoreApresentacao; configuracao?: ConfiguracaoApresentacao; departamentoId?: string | null; pastaId?: string | null }) =>
      request<ApresentacaoDetalhe>('/pro-labore/apresentacoes', { method: 'POST', body: JSON.stringify(data) }).then(comAutoria),
    atualizar: (id: string, data: Partial<{
      titulo: string; descricao: string | null; icone: string | null; arvore: ArvoreApresentacao; configuracao: ConfiguracaoApresentacao
      notas: Bloco[]; lembretes: LembreteApresentacao[]; notasPrivadas: string | null; visivelEquipe: boolean
      destino: { departamentoId: string | null; pastaId: string | null }
    }>) => request<{ versao: number; atualizadoEm: string }>(`/pro-labore/apresentacoes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    excluir: (id: string) => request<null>(`/pro-labore/apresentacoes/${id}`, { method: 'DELETE' }),
    pedir: (id: string, cancelar = false) =>
      request<ApresentacaoDetalhe>(`/pro-labore/apresentacoes/${id}/pedir`, { method: 'POST', body: JSON.stringify({ cancelar }) }).then(comAutoria),
    decidir: (id: string, decisao: 'APROVAR' | 'RECUSAR', motivo?: string) =>
      request<ApresentacaoDetalhe>(`/pro-labore/apresentacoes/${id}/decisao`, { method: 'POST', body: JSON.stringify({ decisao, motivo }) }).then(comAutoria),
    pendencias: () => request<{ pedidos: number }>('/pro-labore/apresentacoes/pendencias'),
    salvarMinhaNota: (id: string, texto: string) =>
      request<{ ok: boolean }>(`/pro-labore/apresentacoes/${id}/minha-nota`, { method: 'PUT', body: JSON.stringify({ texto }) }),
    definirAoVivo: (id: string, ativo: boolean) =>
      request<ApresentacaoDetalhe>(`/pro-labore/apresentacoes/${id}/ao-vivo`, { method: 'POST', body: JSON.stringify({ ativo }) }).then(comAutoria),
    enviarPalco: (id: string, palco: PalcoApresentacao) =>
      request<{ ok: boolean }>(`/pro-labore/apresentacoes/${id}/palco`, { method: 'PUT', body: JSON.stringify(palco) }),
    espectadores: (id: string) => request<EspectadorApresentacao[]>(`/pro-labore/apresentacoes/${id}/espectadores`),
    // Espera segurada: o servidor só responde quando algo mudar (ou em ~8s).
    estado: (id: string, versao: number, palcoVersao: number, aoVivo: boolean) =>
      request<EstadoPollApresentacao>(`/pro-labore/apresentacoes/${id}/estado?versao=${versao}&palcoVersao=${palcoVersao}&aoVivo=${aoVivo ? 1 : 0}&espera=1`),
    // A transmissão (SSE) é lida com fetch + stream no hook da tela, porque
    // EventSource não deixa mandar o cabeçalho de autorização.
    urlTransmissao: (id: string) => `${BASE}/pro-labore/apresentacoes/${id}/transmissao`,
    token: () => getToken(),
  },
  reunioesOrg: {
    estrutura: () => request<EstruturaReunioes>('/pro-labore/reunioes-departamentos'),
    criarDepartamento: (data: { nome: string; descricao?: string; cor?: string; senha: string }) =>
      request<{ id: string; nome: string }>('/pro-labore/reunioes-departamentos', { method: 'POST', body: JSON.stringify(data) }),
    atualizarDepartamento: (id: string, data: Partial<{ nome: string; descricao: string | null; cor: string; senha: string }>) =>
      request<{ ok: boolean }>(`/pro-labore/reunioes-departamentos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    excluirDepartamento: (id: string) => request<null>(`/pro-labore/reunioes-departamentos/${id}`, { method: 'DELETE' }),
    entrar: (id: string, senha: string) =>
      request<{ ok: boolean }>(`/pro-labore/reunioes-departamentos/${id}/entrar`, { method: 'POST', body: JSON.stringify({ senha }) }),
    criarPasta: (data: { nome: string; departamentoId: string | null }) =>
      request<{ id: string; nome: string }>('/pro-labore/reunioes-pastas', { method: 'POST', body: JSON.stringify(data) }),
    renomearPasta: (id: string, nome: string) => request<{ ok: boolean }>(`/pro-labore/reunioes-pastas/${id}`, { method: 'PUT', body: JSON.stringify({ nome }) }),
    excluirPasta: (id: string) => request<null>(`/pro-labore/reunioes-pastas/${id}`, { method: 'DELETE' }),
    permissoes: () => request<PermissaoApresentador[]>('/pro-labore/reunioes-permissoes'),
    definirPermissao: (vendedorId: string, modo: ModoApresentador) =>
      request<{ ok: boolean }>(`/pro-labore/reunioes-permissoes/${vendedorId}`, { method: 'PUT', body: JSON.stringify({ modo }) }),
  },
  reunioes: {
    listar: (tipo?: TipoReuniao) => request<ReuniaoResumo[]>(`/pro-labore/reunioes${tipo ? `?tipo=${tipo}` : ''}`),
    criar: (data: { titulo: string; tipo?: TipoReuniao; data?: string; duracaoSegundos?: number; nomeArquivoOriginal?: string; transcricao?: string }) =>
      request<Reuniao>('/pro-labore/reunioes', { method: 'POST', body: JSON.stringify(data) }),
    obter: (id: string) => request<ReuniaoDetalhe>(`/pro-labore/reunioes/${id}`),
    atualizar: (id: string, data: Partial<{ titulo: string; tipo: TipoReuniao; transcricao: string }>) =>
      request<Reuniao>(`/pro-labore/reunioes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    excluir: (id: string) => request<{ ok: boolean }>(`/pro-labore/reunioes/${id}`, { method: 'DELETE' }),
  },
  notas: {
    // pastaId: undefined = sem filtro de pasta; '' = raiz (sem pasta); string = dentro daquela pasta.
    listar: (params?: { reuniaoId?: string; categoria?: CategoriaNota; pastaId?: string }) => {
      const qs = new URLSearchParams()
      if (params?.reuniaoId) qs.set('reuniaoId', params.reuniaoId)
      if (params?.categoria) qs.set('categoria', params.categoria)
      if (params?.pastaId !== undefined) qs.set('pastaId', params.pastaId)
      const s = qs.toString()
      return request<Nota[]>(`/pro-labore/notas${s ? `?${s}` : ''}`)
    },
    criar: (data: { titulo?: string; conteudo?: string; blocos?: Bloco[]; icone?: string | null; categoria?: CategoriaNota; reuniaoId?: string; pastaId?: string | null }) =>
      request<Nota>('/pro-labore/notas', { method: 'POST', body: JSON.stringify(data) }),
    atualizar: (id: string, data: Partial<{ titulo: string; conteudo: string; blocos: Bloco[]; icone: string | null; categoria: CategoriaNota; pastaId: string | null }>) =>
      request<Nota>(`/pro-labore/notas/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    excluir: (id: string) => request<{ ok: boolean }>(`/pro-labore/notas/${id}`, { method: 'DELETE' }),
  },
  // Ações em lote da tela de Anotações (vários itens selecionados).
  anotacoes: {
    mover: (lote: LoteAnotacoes, destinoPastaId: string | null) =>
      request<{ movidos: number }>('/pro-labore/anotacoes/mover', { method: 'POST', body: JSON.stringify({ ...lote, destinoPastaId }) }),
    excluir: (lote: LoteAnotacoes) =>
      request<{ excluidos: number }>('/pro-labore/anotacoes/excluir', { method: 'POST', body: JSON.stringify(lote) }),
  },
  pastas: {
    listar: () => request<Pasta[]>('/pro-labore/pastas'),
    criar: (data: { nome: string; icone?: string | null; paiId?: string | null }) =>
      request<Pasta>('/pro-labore/pastas', { method: 'POST', body: JSON.stringify(data) }),
    atualizar: (id: string, data: Partial<{ nome: string; icone: string | null; paiId: string | null }>) =>
      request<Pasta>(`/pro-labore/pastas/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    excluir: (id: string) => request<{ ok: boolean }>(`/pro-labore/pastas/${id}`, { method: 'DELETE' }),
  },
  mapasMentais: {
    // pastaId: undefined = sem filtro (lista tudo, uso da árvore); '' = raiz; string = dentro daquela pasta.
    listar: (pastaId?: string) => request<MapaMental[]>(`/pro-labore/mapas-mentais${pastaId !== undefined ? `?pastaId=${pastaId}` : ''}`),
    lixeira: () => request<MapaMental[]>('/pro-labore/mapas-mentais/lixeira'),
    criar: (data: { titulo?: string; icone?: string | null; tema?: string | null; objetos?: BoardObjeto[]; conectores?: BoardConector[]; pastaId?: string | null; configuracao?: Record<string, unknown> | null }) =>
      request<MapaMental>('/pro-labore/mapas-mentais', { method: 'POST', body: JSON.stringify(data) }),
    atualizar: (id: string, data: Partial<{ titulo: string; icone: string | null; objetos: BoardObjeto[]; conectores: BoardConector[]; pastaId: string | null; configuracao: Record<string, unknown> | null }>) =>
      request<MapaMental>(`/pro-labore/mapas-mentais/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    // "excluir" move pra lixeira (soft delete); restaurar tira de lá;
    // excluirDefinitivo só funciona em algo que já está na lixeira.
    excluir: (id: string) => request<{ ok: boolean }>(`/pro-labore/mapas-mentais/${id}`, { method: 'DELETE' }),
    restaurar: (id: string) => request<MapaMental>(`/pro-labore/mapas-mentais/${id}/restaurar`, { method: 'POST' }),
    excluirDefinitivo: (id: string) => request<{ ok: boolean }>(`/pro-labore/mapas-mentais/${id}/definitivo`, { method: 'DELETE' }),
    versoes: {
      listar: (mapaId: string) => request<MapaMentalVersao[]>(`/pro-labore/mapas-mentais/${mapaId}/versoes`),
      restaurar: (mapaId: string, versaoId: string) =>
        request<MapaMental>(`/pro-labore/mapas-mentais/${mapaId}/versoes/${versaoId}/restaurar`, { method: 'POST' }),
    },
  },
}

export interface EfetividadeVendedor {
  vendedorId: string
  leadsAbordados: number
  leadsFechados: number
  efetividadePct: number
}

// --- Ocorrências (registro disciplinar/feedback da equipe comercial) ---

export const TIPOS_OCORRENCIA = ['DISCIPLINAR', 'INEFICIENCIA_PRODUCAO', 'FEEDBACK_MELHORIA', 'FEEDBACK_POSITIVO', 'OUTROS'] as const
export type TipoOcorrencia = (typeof TIPOS_OCORRENCIA)[number]

export const TIPO_OCORRENCIA_LABEL: Record<TipoOcorrencia, string> = {
  DISCIPLINAR: 'Disciplinar',
  INEFICIENCIA_PRODUCAO: 'Ineficiência de Produção',
  FEEDBACK_MELHORIA: 'Feedback de Melhoria',
  FEEDBACK_POSITIVO: 'Feedback Positivo',
  OUTROS: 'Outros',
}

export const GRAVIDADES_OCORRENCIA = ['LEVE', 'MODERADA', 'GRAVE', 'GRAVISSIMA'] as const
export type GravidadeOcorrencia = (typeof GRAVIDADES_OCORRENCIA)[number]

export const GRAVIDADE_OCORRENCIA_LABEL: Record<GravidadeOcorrencia, string> = {
  LEVE: 'Leve',
  MODERADA: 'Moderada',
  GRAVE: 'Grave',
  GRAVISSIMA: 'Gravíssima',
}

export const STATUS_OCORRENCIA = ['ABERTA', 'EM_PRAZO', 'EM_VERIFICACAO', 'RESOLVIDA', 'REINCIDENTE', 'ESCALONADA', 'ENCERRADA'] as const
export type StatusOcorrencia = (typeof STATUS_OCORRENCIA)[number]

export const STATUS_OCORRENCIA_LABEL: Record<StatusOcorrencia, string> = {
  ABERTA: 'Aberta',
  EM_PRAZO: 'Em prazo de correção',
  EM_VERIFICACAO: 'Em verificação',
  RESOLVIDA: 'Resolvida',
  REINCIDENTE: 'Reincidente',
  ESCALONADA: 'Escalonada',
  ENCERRADA: 'Encerrada',
}

export const MEDIDAS_DISCIPLINARES = ['NENHUMA', 'ADVERTENCIA_VERBAL', 'ADVERTENCIA_ESCRITA', 'SUSPENSAO', 'DESLIGAMENTO'] as const
export type MedidaDisciplinar = (typeof MEDIDAS_DISCIPLINARES)[number]

export const MEDIDA_DISCIPLINAR_LABEL: Record<MedidaDisciplinar, string> = {
  NENHUMA: 'Nenhuma',
  ADVERTENCIA_VERBAL: 'Advertência verbal',
  ADVERTENCIA_ESCRITA: 'Advertência escrita',
  SUSPENSAO: 'Suspensão',
  DESLIGAMENTO: 'Desligamento',
}

export interface OcorrenciaHistoricoItem {
  id: string
  autor: string
  acao: string
  statusAnterior?: string | null
  statusNovo?: string | null
  criadoEm: string
}

export interface Ocorrencia {
  id: string
  protocolo: string
  vendedorId: string
  vendedor?: { id: string; nome: string } | null
  tipo: TipoOcorrencia
  motivo: string
  gravidade: GravidadeOcorrencia
  descricao: string
  anexosCsv?: string | null
  dataOcorrencia: string
  dataRegistro: string
  registradoPor: string
  planoDeCorrecao?: string | null
  prazoCorrecao?: string | null
  status: StatusOcorrencia
  medidaAplicada: MedidaDisciplinar
  ocorrenciaAnteriorId?: string | null
  ocorrenciaAnterior?: { id: string; protocolo: string; status: StatusOcorrencia; dataOcorrencia: string } | null
  reincidencias?: { id: string; protocolo: string; status: StatusOcorrencia; dataOcorrencia: string }[]
  documentoGeradoUrl?: string | null
  documentoGeradoEm?: string | null
  assinaturaVendedorOk: boolean
  assinaturaVendedorData?: string | null
  assinaturaGestorOk: boolean
  assinaturaGestorData?: string | null
  historico: OcorrenciaHistoricoItem[]
  criadoEm: string
  atualizadoEm: string
}

export interface ResumoOcorrencias {
  abertas: number
  prazosVencendo: number
  reincidenciasAtivas: number
  resolvidasNoMes: number
}

export type SugestaoMedidaOcorrencia =
  | { aplicavel: false }
  | { aplicavel: true; categoria: 'DISCIPLINAR' | 'DESEMPENHO'; ordinal: number; medidaSugerida: MedidaDisciplinar; descricaoSugerida: string }

// --- Social Media (integração real com Instagram) ---

export interface SocialMediaConta {
  id: string
  instagramUserId: string
  nomeUsuario: string
  nomeExibicao?: string | null
  fotoUrl?: string | null
  biografia?: string | null
  site?: string | null
  tipoConta?: string | null
  seguidores: number
  seguindo: number
  publicacoesTotal: number
  conectadoEm: string
  atualizadoEm: string
  tokenExpiraEm: string
  ultimaSincronizacaoEm?: string | null
  ultimoErroSync?: string | null
}

export interface ResultadoSyncSocialMedia {
  midiasListadas: number
  insightsAtualizados: number
  insightsPendentes: number
  diasAtualizados: number
}

export type FormatoPostSocial = 'REELS' | 'CARROSSEL' | 'FOTO'
export type FaixaImpactoSocial = 'BAIXO' | 'MEDIO' | 'ALTO' | 'EXCEPCIONAL'

export interface PostSocial {
  id: string
  formato: FormatoPostSocial
  legenda: string | null
  thumbnail: string | null
  permalink: string | null
  publicadoEm: string
  dia: string // 'YYYY-MM-DD' (Brasília)
  diaSemana: number // 0 = domingo
  hora: number // 0..23 (Brasília)
  alcance: number
  visualizacoes: number
  curtidas: number
  comentarios: number
  compartilhamentos: number
  salvamentos: number
  interacoes: number
  visitasPerfil: number
  seguidoresGerados: number
  tempoMedioAssistidoSeg: number | null
  taxaEngajamento: number
  taxaSalvamento: number
  taxaCompartilhamento: number
  indiceImpacto: number | null
  faixaImpacto: FaixaImpactoSocial | null
  hashtags: string[]
  tamanhoLegenda: number
  semInsights: boolean
}

export interface AgregadoPostsSocial {
  quantidade: number
  alcanceMedio: number
  visualizacoesMedias: number
  interacoesMedias: number
  taxaEngajamento: number
  salvamentosMedios: number
  compartilhamentosMedios: number
  seguidoresGerados: number
}

export interface PontoSerieSocial {
  data: string
  temDados: boolean
  alcance: number
  visualizacoes: number
  interacoes: number
  contasEngajadas: number
  visitasPerfil: number
  toquesLinks: number
  seguidoresGanhos: number
  seguidoresPerdidos: number
  saldoSeguidores: number
  seguidores: number | null
  seguidoresEstimado: boolean
  publicacoes: number
}

export interface KpiComparadoSocial { atual: number | null; anterior: number | null }
export interface FatiaSocial { chave: string; valor: number }
export interface DemografiaPublicoSocial { idade: FatiaSocial[]; genero: FatiaSocial[]; cidade: FatiaSocial[]; pais: FatiaSocial[] }

export interface RecomendacaoSocial {
  id: string
  tipo: 'destaque' | 'oportunidade' | 'alerta' | 'info'
  titulo: string
  detalhe: string
}

export type AnaliseSocialMedia =
  | { conectado: false }
  | {
      conectado: true
      conta: {
        nomeUsuario: string
        nomeExibicao: string | null
        fotoUrl: string | null
        biografia: string | null
        site: string | null
        tipoConta: string | null
        seguidores: number
        seguindo: number
        publicacoesTotal: number
        ultimaSincronizacaoEm: string | null
        ultimoErroSync: string | null
      }
      periodo: { inicio: string; fim: string; dias: number; anteriorInicio: string; anteriorFim: string; diasComDadosConta: number }
      kpis: {
        seguidores: {
          atual: number; variacao: number | null; ganhos: number; perdidos: number
          ganhosAnterior: number | null; perdidosAnterior: number | null; taxaCrescimento: number | null
        }
        alcanceMedioDia: KpiComparadoSocial
        visualizacoes: KpiComparadoSocial
        interacoes: KpiComparadoSocial
        contasEngajadasMediaDia: KpiComparadoSocial
        visitasPerfil: KpiComparadoSocial & { fonte: 'conta' | 'posts' }
        toquesLinks: KpiComparadoSocial
        taxaEngajamento: KpiComparadoSocial
        alcanceMedioPost: KpiComparadoSocial
        publicacoes: { atual: number; anterior: number; meta: number; metaSemanal: number }
        stories: { atual: number }
      }
      serie: PontoSerieSocial[]
      serieAnterior: PontoSerieSocial[]
      composicaoInteracoes: {
        fonte: 'conta' | 'posts'
        curtidas: number; comentarios: number; compartilhamentos: number; salvamentos: number; respostas: number
      }
      porFormato: Array<{ formato: FormatoPostSocial } & AgregadoPostsSocial>
      porDiaSemana: Array<{ dia: number } & AgregadoPostsSocial>
      porHora: Array<{ hora: number } & AgregadoPostsSocial>
      heatmap: Array<{ dia: number; bloco: number; quantidade: number; alcanceMedio: number; taxaEngajamento: number }>
      radar: { medianaReferencia: number; diasReferencia: number }
      publicacoes: PostSocial[]
      postsSemInsights: number
      hashtags: Array<{ tag: string } & AgregadoPostsSocial>
      hashtagsComparativo: { com: AgregadoPostsSocial; sem: AgregadoPostsSocial }
      legendas: Array<{ faixa: string; taxaSalvamento: number } & AgregadoPostsSocial>
      reels: AgregadoPostsSocial & { tempoMedioAssistidoSeg: number; taxaCompartilhamento: number }
      stories: {
        quantidade: number; alcanceMedio: number; visualizacoesMedias: number; respostas: number
        compartilhamentos: number; visitasPerfil: number; seguidoresGerados: number
        avancos: number; retornos: number; saidas: number; proximoStory: number; visualizacoesTotais: number
      }
      demografia: { seguidores: DemografiaPublicoSocial | null; engajados: DemografiaPublicoSocial | null; atualizadoEm?: string } | null
      distribuicaoAlcance: {
        periodoDias: number; alcanceTotal: number; atualizadoEm?: string
        porTipoSeguidor: FatiaSocial[]; porFormato: FatiaSocial[]; shareDescoberta: number | null
      } | null
      seguidoresOnline: number[] | null
      relacaoVendas: { leadsGerados: number; leadsGanhos: number; valorNegociadoTotal: number }
      jornada: { alcance: number; visitasPerfil: number; novosSeguidores: number; leadsGerados: number }
      recomendacoes: RecomendacaoSocial[]
    }

// --- Assistente Comercial (WhatsApp) ---

export type StatusAssistente = 'NAO_CONECTADO' | 'AGUARDANDO_QR' | 'CONECTADO' | 'DESCONECTADO'
export type TipoConversaAssistente = 'SUPORTE' | 'LEAD'
export type StatusConversaAssistente = 'ATIVA' | 'AGUARDANDO_VENDEDOR' | 'ASSUMIDA' | 'ENCERRADA'
export type ResultadoConversaAssistente = 'QUALIFICADO' | 'PEDIU_ATENDENTE' | 'DESISTIU' | 'NAO_E_LEAD'
export type OrigemConversaAssistente = 'ANUNCIO' | 'GATILHO' | 'CONTATO_NOVO'
export type RemetenteMensagemAssistente = 'CONTATO' | 'ASSISTENTE' | 'VENDEDOR'
export type AcaoConversaAssistente = 'ASSUMIR' | 'DEVOLVER' | 'ENCERRAR' | 'NAO_E_LEAD' | 'CRIAR_LEAD'
export type CampoLeadAssistente = 'modeloInteresse' | 'formaPagamento' | 'valorEntrada' | 'veiculoTroca' | 'cidade' | 'melhorHorario' | 'nomeCompleto' | 'outro'

export interface PerguntaRoteiroAssistente {
  id: string
  rotulo: string
  texto: string
  campo: CampoLeadAssistente
  opcoes?: string[]
}

export interface ConfigRoteiroAssistente {
  nomeEmpresa: string
  responderContatosNovos: boolean
  gatilhos: string[]
  mensagemBoasVindas: string
  perguntas: PerguntaRoteiroAssistente[]
  mensagemEncerramento: string
  mensagemAtendente: string
  mensagemDespedida: string
  avisarVendedor: boolean
  criarLeadNoCrm: boolean
  atrasoSegundos: number
}

export interface AssistenteComercial {
  id: string
  vendedorId: string
  numeroWhatsapp?: string | null
  nomeExibicao?: string | null
  status: StatusAssistente
  fotoPerfilUrl?: string | null
  conectadoEm?: string | null
  ultimoEventoEm?: string | null
  atendimentoAutomatico: boolean
  configuracao: ConfigRoteiroAssistente
  criadoEm: string
  _count?: { ignorados: number }
}

export interface ConfigAssistenteResposta {
  assistente: AssistenteComercial | null
  vendedor: { id: string; nome: string } | null
  servidorConfigurado: boolean
  configuracaoPadrao: ConfigRoteiroAssistente
}

export interface ConexaoAssistente { status: StatusAssistente; qrBase64: string | null; pairingCode: string | null }

export interface AssistenteMensagem {
  id: string
  conversaId: string
  remetente: RemetenteMensagemAssistente
  texto: string
  criadoEm: string
}

export interface AssistenteConversa {
  id: string
  assistenteId: string
  tipo: TipoConversaAssistente
  nomeContato: string
  numeroContato: string
  status: StatusConversaAssistente
  resultado: ResultadoConversaAssistente | null
  origem: OrigemConversaAssistente | null
  etapaRoteiro: number
  leadId?: string | null
  lead?: { id: string; nomeCliente: string; estagio: EstagioLead } | null
  ultimaMensagemEm: string
  aguardandoVendedorEm?: string | null
  assumidaEm?: string | null
  criadoEm: string
  mensagens: AssistenteMensagem[] // só o último item na listagem
  _count?: { mensagens: number }
}

export interface AssistenteConversaDetalhe extends Omit<AssistenteConversa, 'mensagens'> {
  mensagens: AssistenteMensagem[] // histórico completo, em ordem cronológica
  resumo: Array<{ rotulo: string; valor: string }>
  totalPerguntas: number
}

export interface EstadoRoteiroAssistente { etapa: number; respostas: Record<string, string> }

export interface SimulacaoAssistente {
  mensagens: string[]
  estado: EstadoRoteiroAssistente
  desfecho: 'QUALIFICADO' | 'PEDIU_ATENDENTE' | 'DESISTIU' | null
  resumo: Array<{ rotulo: string; valor: string }>
  gatilho: string | null
}

export interface ContatoIgnoradoAssistente { id: string; numero: string; motivo: 'CONVERSA_PESSOAL' | 'MARCADO_PELO_VENDEDOR'; criadoEm: string }

export interface ResumoAssistente {
  periodo: { dias: number; inicio: string | null; fim: string | null }
  totais: {
    atendidos: number; concluidos: number; qualificados: number; pediramAtendente: number; desistiram: number; naoEraLead: number
    emAndamento: number; pararamDeResponder: number; assumidas: number; leadsNoCrm: number; vendas: number; aguardandoAgora: number
  }
  taxaConclusao: number | null
  tempoResposta: { medianaMin: number | null; ate15MinPct: number | null; amostras: number }
  porOrigem: Array<{ origem: OrigemConversaAssistente; total: number; concluidos: number }>
  funilRoteiro: Array<{ rotulo: string; total: number }>
  funilCrm: Array<{ estagio: EstagioLead; total: number }>
  serie: Array<{ data: string; atendidos: number; concluidos: number }>
  porHora: Array<{ hora: number; total: number }>
  porDiaSemana: Array<{ dia: number; total: number }>
}

export type EstagioCrescimento = 'INICIAR' | 'MANTER' | 'ESCALONAR' | 'ESCALAR'
export type FormatoMetricaCrescimento = 'moeda' | 'percentual' | 'numero'
export type ChavePilarCrescimento = 'aquisicao' | 'conversao' | 'execucao' | 'financeiro'

export interface MetricaPilarCrescimento {
  label: string
  valor: number
  formato: FormatoMetricaCrescimento
}

export interface GateCrescimento {
  descricao: string
  atingido: boolean
}

export type OrigemAcaoCrescimento = 'SUGERIDA' | 'CUSTOMIZADA'

export interface ItemAcaoCrescimento {
  id: string
  texto: string
  concluida: boolean
  origem: OrigemAcaoCrescimento
}

export interface PilarCrescimento {
  chave: ChavePilarCrescimento
  nome: string
  estagio: EstagioCrescimento
  resumo: string
  metricas: MetricaPilarCrescimento[]
  gates: GateCrescimento[]
  itens: ItemAcaoCrescimento[]
  ritmo: string
}

export interface PlanoCrescimento {
  estagioGeral: EstagioCrescimento
  resumoGeral: string
  gargalo: ChavePilarCrescimento
  pilares: PilarCrescimento[]
}

export interface HistoricoCrescimentoMes {
  mes: number
  ano: number
  label: string
  estagioGeral: EstagioCrescimento
  estagioAquisicao: EstagioCrescimento
  estagioConversao: EstagioCrescimento
  estagioExecucao: EstagioCrescimento
  estagioFinanceiro: EstagioCrescimento
}

export const TIPOS_REUNIAO = ['REUNIAO', 'AULA', 'VIDEO', 'OUTRO'] as const
export type TipoReuniao = (typeof TIPOS_REUNIAO)[number]

export const CATEGORIAS_NOTA = ['TRABALHO', 'IDEIA', 'APRENDIZADO', 'OUTRO'] as const
export type CategoriaNota = (typeof CATEGORIAS_NOTA)[number]

export interface ReuniaoResumo {
  id: string
  titulo: string
  tipo: TipoReuniao
  data: string
  duracaoSegundos?: number | null
  nomeArquivoOriginal?: string | null
  temTranscricao: boolean
  quantidadeNotas: number
}

export interface Reuniao {
  id: string
  titulo: string
  tipo: TipoReuniao
  data: string
  duracaoSegundos?: number | null
  nomeArquivoOriginal?: string | null
  transcricao?: string | null
  criadoEm: string
  atualizadoEm: string
}

// Tipos de bloco do editor estilo Notion (EditorBlocos.tsx). `marcado` só
// tem sentido pra 'checkbox'; `icone` só pra 'callout'; em 'imagem', `texto`
// guarda a URL da imagem (não um texto visível). Os demais tipos ignoram
// esses campos.
export const TIPOS_BLOCO = ['paragrafo', 'titulo1', 'titulo2', 'titulo3', 'lista', 'lista_numerada', 'checkbox', 'citacao', 'codigo', 'divisor', 'callout', 'imagem'] as const
export type TipoBloco = (typeof TIPOS_BLOCO)[number]

export interface Bloco {
  id: string
  tipo: TipoBloco
  texto: string
  marcado?: boolean
  icone?: string
}

export interface Nota {
  id: string
  titulo?: string | null
  conteudo: string
  blocos?: Bloco[] | null
  icone?: string | null
  categoria: CategoriaNota
  reuniaoId?: string | null
  pastaId?: string | null
  criadoEm: string
  atualizadoEm: string
}

export interface ReuniaoDetalhe extends Reuniao {
  notas: Nota[]
}

export interface Pasta {
  id: string
  nome: string
  icone?: string | null
  paiId?: string | null
  criadoEm: string
  atualizadoEm: string
}

// Mapa mental / board: outro "tipo de página" dentro da árvore de
// Anotações, ao lado de Nota. `raiz` é o formato legado (árvore de nós
// recursiva, só mapa mental puro) — mapas antigos que nunca foram
// reabertos no formato novo ainda vêm assim; o canvas converte pra
// objetos/conectores na primeira abertura e passa a salvar só no formato
// novo dali em diante (ver MapaMental.tsx). `objetos`/`conectores` é o
// formato atual: board plano onde qualquer objeto pode se conectar a
// qualquer outro, não só pai→filho.
export interface NoMapa {
  id: string
  texto: string
  x: number
  y: number
  filhos: NoMapa[]
}

export type TipoObjetoBoard =
  | 'noMapa' | 'forma' | 'sticky' | 'texto' | 'icone' | 'secao' | 'tabela'
  | 'desenho' | 'frame' | 'botao' | 'inputWireframe' | 'avatar' | 'pilha' | 'tarefa'
  | 'comentario' | 'imagem'

export interface BoardObjeto {
  id: string
  tipo: TipoObjetoBoard
  x: number
  y: number
  largura?: number
  altura?: number
  travado?: boolean
  zIndex?: number
  estilo?: Record<string, unknown>
  conteudo: Record<string, unknown>
}

export interface BoardConector {
  id: string
  origemId: string
  destinoId: string
  estilo?: Record<string, unknown>
  label?: string
}

export interface MapaMental {
  id: string
  titulo?: string | null
  icone?: string | null
  // Tema visual do canvas (fundo/pontilhado) — ver TEMAS_BOARD em MapaMental.tsx.
  // Tipado solto aqui (não o union) pra não criar dependência circular entre
  // este arquivo e o componente do canvas.
  tema?: string | null
  // Painel "Aparência" (layout persistente + paleta de cor + alinhamento
  // automático) — ver ConfiguracaoBoard em MapaMental.tsx. Tipado solto
  // (Record) pelo mesmo motivo do `tema` acima.
  configuracao?: Record<string, unknown> | null
  raiz?: NoMapa | null
  objetos?: BoardObjeto[] | null
  conectores?: BoardConector[] | null
  pastaId?: string | null
  excluidoEm?: string | null
  criadoEm: string
  atualizadoEm: string
}

export interface MapaMentalVersao {
  id: string
  criadoEm: string
}

// --- Apresentações ao vivo (aba Reuniões) ---

export interface ArvoreApresentacao { id: string; text: string; children: ArvoreApresentacao[]; collapsed: boolean }
export interface ConfiguracaoApresentacao { layout: 'mind' | 'org' | 'list'; tema: string; doisLados: boolean }
export interface LembreteApresentacao { id: string; texto: string; feito: boolean; data?: string | null }
export interface VistaApresentacao { x: number; y: number; w: number; h: number }
export interface PalcoApresentacao {
  vista: VistaApresentacao | null
  sel: string | null
  laser: { ativo: boolean; pontos: Array<{ x: number; y: number }> }
}

export interface PastaReuniao { id: string; nome: string; total: number }
export interface DepartamentoReuniao {
  id: string
  nome: string
  descricao: string | null
  cor: string
  liberado: boolean
  aoVivo: boolean
  total: number | null
  pastas: PastaReuniao[]
}
export interface EstruturaReunioes {
  // O que a pessoa logada pode fazer na aba: dono, ou o modo de quem é da equipe.
  permissao: 'DONO' | ModoApresentador
  pedidosPendentes: number
  geral: { total: number; pastas: PastaReuniao[]; aoVivo: boolean }
  departamentos: DepartamentoReuniao[]
}

export interface ApresentacaoResumo {
  id: string
  departamentoId: string | null
  pastaId: string | null
  titulo: string
  descricao: string | null
  icone: string | null
  visivelEquipe: boolean
  aoVivo: boolean
  aoVivoDesde: string | null
  criadoEm: string
  atualizadoEm: string
  totalIdeias: number
  lembretesPendentes: number
  // Autoria/autorização: autorNome só vem quando quem montou é da equipe.
  autorNome: string | null
  souAutor: boolean
  aprovacao: AprovacaoApresentacao
  aprovacaoMotivo: string | null
  pedidoEm: string | null
}

// Campos de autoria/autorização com valor padrão: se o site novo falar
// com um servidor ainda na versão anterior (deploy atrasado), a tela
// trata como apresentação do dono já autorizada em vez de quebrar.
function comAutoria<T extends Partial<Pick<ApresentacaoResumo, 'aprovacao' | 'souAutor' | 'autorNome' | 'aprovacaoMotivo' | 'pedidoEm'>> & { podeEditar?: boolean }>(a: T): T & Pick<ApresentacaoResumo, 'aprovacao' | 'souAutor' | 'autorNome' | 'aprovacaoMotivo' | 'pedidoEm'> {
  return {
    ...a,
    aprovacao: a.aprovacao ?? 'APROVADA',
    souAutor: a.souAutor ?? a.podeEditar ?? false,
    autorNome: a.autorNome ?? null,
    aprovacaoMotivo: a.aprovacaoMotivo ?? null,
    pedidoEm: a.pedidoEm ?? null,
  }
}

export type AprovacaoApresentacao = 'RASCUNHO' | 'PENDENTE' | 'APROVADA' | 'RECUSADA'
export type ModoApresentador = 'APROVACAO' | 'LIVRE' | 'BLOQUEADO'
export interface PermissaoApresentador { vendedorId: string; nome: string; papel: string; modo: ModoApresentador }
export interface LoteAnotacoes { pastas?: string[]; notas?: string[]; mapas?: string[] }

export interface ConteudoApresentacao {
  titulo: string
  descricao: string | null
  icone: string | null
  arvore: ArvoreApresentacao
  configuracao: ConfiguracaoApresentacao | null
  notas: Bloco[] | null
  lembretes: LembreteApresentacao[] | null
}

export interface ApresentacaoDetalhe extends ApresentacaoResumo {
  arvore: ArvoreApresentacao
  configuracao: ConfiguracaoApresentacao | null
  notas: Bloco[] | null
  lembretes: LembreteApresentacao[] | null
  versao: number
  palco: PalcoApresentacao | null
  palcoVersao: number
  podeEditar: boolean
  // Só pra quem assiste: o "Só pra mim" da própria pessoa.
  notaPessoal?: string
  notasPrivadas?: string | null
}

export interface EspectadorApresentacao { nome: string; entrouEm: string; ultimoSinalEm: string; assistindo: boolean }

export interface EstadoPollApresentacao {
  versao: number
  palcoVersao: number
  aoVivo: boolean
  conteudo?: ConteudoApresentacao
  palco?: PalcoApresentacao | null
}
