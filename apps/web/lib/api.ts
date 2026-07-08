const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('aries_token')
}

export function setToken(token: string) {
  localStorage.setItem('aries_token', token)
}

export function clearToken() {
  localStorage.removeItem('aries_token')
  localStorage.removeItem('aries_user')
}

export function getUser(): Usuario | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('aries_user')
  return raw ? JSON.parse(raw) : null
}

export function setUser(user: Usuario) {
  localStorage.setItem('aries_user', JSON.stringify(user))
}

export interface Usuario {
  id: string
  nome: string
  email: string
  papel: string
  empresaId: string
  status?: string
}

export interface Oportunidade {
  id: string
  nomeCliente: string
  telefone?: string
  email?: string
  estagio: string
  origem: string
  valor?: number
  observacoes?: string
  responsavel?: { id: string; nome: string }
  unidade?: { id: string; nome: string; marca?: string; modelo?: string; ano?: number; cor?: string; precoBase?: number }
  criadaEm: string
  atualizadaEm: string
}

export interface Produto {
  id: string
  nome: string
  categoria: string
  marca?: string
  modelo?: string
  ano?: number
  cor?: string
  chassi?: string
  placa?: string
  km?: number
  precoBase?: number
  situacao: string
}

export interface Contrato {
  id: string
  nomeCliente: string
  cpfCliente?: string
  telefoneCliente?: string
  valorTotal: number
  entrada: number
  parcelas: number
  status: string
  criadoEm: string
  unidade?: { id: string; nome: string; marca?: string; modelo?: string }
  vendedor?: { id: string; nome: string }
  contasReceber: ContaReceber[]
}

export interface ContaReceber {
  id: string
  descricao: string
  valor: number
  vencimento: string
  status: string
  pago?: number
  pagoEm?: string
}

export interface ParametrosPrecificacao {
  id: string
  margemEstrategica: number
  margemComercial: number
  margemNegociacao: number
  margemLP: number
  impostosPct: number
  comissaoPadraoPct: number
  marketingProvisionadoPct: number
  reservaFinanceiraPct: number
  taxaFinanceiraMensal: number
  taxaOportunidadeMensal: number
  diasEstoqueMeta: number
  custoOperacionalRateio: number
  fase1MaxDias: number
  fase2MaxDias: number
  fase3MaxDias: number
  saudePremiumMaxDias: number
  saudeSaudavelMaxDias: number
  saudeAtencaoMaxDias: number
}

export interface PrecificacaoMoto {
  id: string
  nome: string
  situacao: string
  dadosIncompletos: boolean
  mensagem?: string
  dataCompra?: string
  diasEmEstoque?: number | null
  fase?: string
  classificacaoSaude?: string
  capitalParado?: number
  custosDiretos?: number
  custoFinanceiroProvisionado?: number
  custoOperacionalRateado?: number
  custoBase?: number
  precoEstrategico?: number
  precoComercial?: number
  precoNegociacao?: number
  lp?: number
  precoSugeridoHoje?: number | null
  revisaoGerencialObrigatoria?: boolean
}

export interface KpisPrecificacao {
  lucroMedioPorMotoVendida: number
  margemLiquidaMediaRealizada: number
  descontoMedioPraticado: number
  capitalInvestidoTotal: number
  capitalParado: number
  tempoMedioEstoqueVendidas: number
  motosAcima90Dias: number
  motosEstoqueCritico: number
  motosEstoquePremium: number
  pctVendasPrecoComercialOuAcima: number
  vendasAbaixoDoLP: number
  totalVendasAnalisadas: number
}

export interface RankingVendedor {
  vendedorId: string
  nome: string
  qtdeVendas: number
  ticketMedio: number
  descontoMedio: number
  margemLiquidaMediaRealizada: number
  lucroTotalEntregue: number
  pctVendasPrecoCheioOuAcima: number
  rankingFinanceiro: number
  rankingComercial: number
}

export interface HistoricoPrecificacao {
  id: string
  precoAnterior?: number
  precoNovo: number
  margemUtilizada: string
  motivo: string
  nivelAprovacao: string
  criadoEm: string
  solicitante?: { id: string; nome: string }
  aprovador?: { id: string; nome: string }
}

export interface CustosMoto {
  dataCompra?: string
  valorCompra?: number
  custoRevisao?: number
  custoEstetica?: number
  custoDocumentacao?: number
  custoFrete?: number
  custoCombustivel?: number
  custoAcessorios?: number
  custoOutros?: number
  marketingInvestido?: number
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

export const api = {
  auth: {
    login: (email: string, senha: string) =>
      request<{ token: string; usuario: Usuario }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, senha }),
      }),
    me: () => request<Usuario>('/auth/me'),
  },
  empresa: {
    setup: (data: object) =>
      request<{ token: string; empresa: object; usuario: Usuario }>('/empresa/setup', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    get: () => request<object>('/empresa'),
  },
  usuarios: {
    listar: () => request<Usuario[]>('/usuarios'),
    criar: (data: object) =>
      request<Usuario>('/usuarios', { method: 'POST', body: JSON.stringify(data) }),
    alterarStatus: (id: string, status: string) =>
      request<{ ok: boolean }>(`/usuarios/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
  },
  produtos: {
    listar: (situacao?: string) => {
      const qs = situacao ? `?situacao=${situacao}` : ''
      return request<Produto[]>(`/produtos${qs}`)
    },
    criar: (data: object) =>
      request<Produto>('/produtos', { method: 'POST', body: JSON.stringify(data) }),
    editar: (id: string, data: object) =>
      request<{ ok: boolean }>(`/produtos/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remover: (id: string) =>
      request<{ ok: boolean }>(`/produtos/${id}`, { method: 'DELETE' }),
  },
  contratos: {
    listar: () => request<Contrato[]>('/contratos'),
    criar: (data: object) => request<Contrato>('/contratos', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: string) => request<Contrato>(`/contratos/${id}`),
  },
  financeiro: {
    contasReceber: (status?: string) => {
      const qs = status ? `?status=${status}` : ''
      return request<(ContaReceber & { contrato: { id: string; nomeCliente: string; unidade?: { nome: string } } })[]>(`/financeiro/contas-receber${qs}`)
    },
    baixar: (id: string, valorPago: number) =>
      request<ContaReceber>(`/financeiro/contas-receber/${id}/baixa`, {
        method: 'PATCH',
        body: JSON.stringify({ valorPago }),
      }),
    resumo: () => request<{
      totalRecebido: number
      totalPendente: number
      totalAtrasado: number
      contasAtrasadas: number
      receitaMes: number
      previsaoMes: number
    }>('/financeiro/resumo'),
  },
  oportunidades: {
    listar: (params?: { estagio?: string; responsavelId?: string }) => {
      const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : ''
      return request<Oportunidade[]>(`/oportunidades${qs}`)
    },
    criar: (data: object) =>
      request<Oportunidade>('/oportunidades', { method: 'POST', body: JSON.stringify(data) }),
    moverEstagio: (id: string, estagio: string) =>
      request<Oportunidade>(`/oportunidades/${id}/estagio`, {
        method: 'PATCH',
        body: JSON.stringify({ estagio }),
      }),
  },
  dashboard: {
    get: () => request<{
      funil: Record<string, number>
      totais: {
        oportunidadesAtivas: number
        vendasFechadas: number
        taxaConversao: number
        receitaFechada: number
        vendedoresAtivos: number
        produtosCadastrados: number
      }
      recentes: Array<{ id: string; nomeCliente: string; estagio: string; valor?: number }>
    }>('/dashboard'),
  },
  precificacao: {
    parametros: () => request<ParametrosPrecificacao>('/precificacao/parametros'),
    atualizarParametros: (data: Partial<ParametrosPrecificacao>) =>
      request<ParametrosPrecificacao>('/precificacao/parametros', { method: 'PUT', body: JSON.stringify(data) }),
    listar: () => request<PrecificacaoMoto[]>('/precificacao'),
    detalhe: (id: string) => request<PrecificacaoMoto>(`/precificacao/${id}`),
    atualizarCustos: (id: string, data: CustosMoto) =>
      request<{ ok: boolean }>(`/precificacao/${id}/custos`, { method: 'PATCH', body: JSON.stringify(data) }),
    kpis: () => request<KpisPrecificacao>('/precificacao/relatorios/kpis'),
    rankingVendedores: () => request<RankingVendedor[]>('/precificacao/relatorios/ranking-vendedores'),
    historico: (unidadeId: string) => request<HistoricoPrecificacao[]>(`/precificacao/historico/${unidadeId}`),
    registrarAlteracao: (data: { unidadeId: string; precoNovo: number; motivo: string; margemUtilizada?: string; aprovadorId?: string }) =>
      request<HistoricoPrecificacao>('/precificacao/historico', { method: 'POST', body: JSON.stringify(data) }),
  },
}
