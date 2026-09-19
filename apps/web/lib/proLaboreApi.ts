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
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Erro inesperado')
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
