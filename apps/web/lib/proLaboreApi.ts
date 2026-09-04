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

export type ProLaborePapel = 'DONO' | 'VENDEDOR'

export interface ProLaboreUsuario {
  id: string
  nome: string
  email: string
  papel: ProLaborePapel
}

export interface ParametroLiquidez {
  // Pró-labore é sempre do dono, sacado de qualquer venda da operação.
  tetoProLaborePorVenda: number
  // Teto padrão de comissão, usado por vendedores sem comissão individual.
  tetoComissaoPadrao: number
  metaFaturamentoAnual: number
  fraseMotivacional?: string | null
}

export interface Vendedor {
  id: string
  nome: string
  ativo: boolean
  email?: string | null
  tetoComissaoPorVenda?: number | null
  criadoEm: string
}

export const ESTAGIOS_LEAD = ['LEAD', 'ABORDADO', 'NEGOCIACAO', 'PROPOSTA', 'FECHADO', 'PERDIDO'] as const
export type EstagioLead = (typeof ESTAGIOS_LEAD)[number]

export const TIPOS_LEAD = ['TRAFEGO', 'ORGANICO'] as const
export type TipoLead = (typeof TIPOS_LEAD)[number]

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

export const PERIODOS_RECEITA = ['hoje', '7', '15', '30'] as const
export type ReceitaPeriodo = (typeof PERIODOS_RECEITA)[number]

export interface PontoReceita {
  label: string
  receita: number
  vendas: number
}

export interface ReceitaDetalhada {
  totalReceita: number
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
  vendedores: {
    listar: () => request<Vendedor[]>('/pro-labore/vendedores'),
    criar: (nome: string) => request<Vendedor>('/pro-labore/vendedores', { method: 'POST', body: JSON.stringify({ nome }) }),
    editar: (id: string, data: { nome?: string; ativo?: boolean; tetoComissaoPorVenda?: number | null }) =>
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
    criar: (data: { nomeCliente: string; telefone?: string; email?: string; cpf?: string; endereco?: string; modeloInteresse?: string; observacao?: string; vendedorId?: string; tipoLead?: TipoLead }) =>
      request<Lead>('/pro-labore/leads', { method: 'POST', body: JSON.stringify(data) }),
    editar: (id: string, data: { nomeCliente?: string; telefone?: string; email?: string; cpf?: string; endereco?: string; modeloInteresse?: string; observacao?: string; vendedorId?: string | null; tipoLead?: TipoLead | null }) =>
      request<Lead>(`/pro-labore/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    mudarEstagio: (id: string, estagio: EstagioLead) =>
      request<Lead>(`/pro-labore/leads/${id}/estagio`, { method: 'POST', body: JSON.stringify({ estagio }) }),
    converter: (id: string, data: { data: string; valorVenda: number; valorProLabore: number; valorComissao?: number; observacao?: string }) =>
      request<{ lead: Lead; venda: Venda }>(`/pro-labore/leads/${id}/converter`, { method: 'POST', body: JSON.stringify(data) }),
    remover: (id: string) => request<{ ok: boolean }>(`/pro-labore/leads/${id}`, { method: 'DELETE' }),
  },
  painel: {
    get: (ano?: number) => request<PainelProLabore>(`/pro-labore/painel${ano ? `?ano=${ano}` : ''}`),
  },
  receitas: {
    porPeriodo: (periodo: ReceitaPeriodo) => request<ReceitaDetalhada>(`/pro-labore/receitas-periodo?periodo=${periodo}`),
  },
}
