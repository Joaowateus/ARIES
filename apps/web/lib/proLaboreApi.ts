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

export interface ProLaboreUsuario {
  id: string
  nome: string
  email: string
}

export interface ParametroLiquidez {
  tetoProLaborePorVenda: number
}

export interface Venda {
  id: string
  data: string
  valorVenda: number
  valorProLabore: number
  observacao?: string | null
  criadoEm: string
}

export interface ResumoProLabore {
  ultimaVenda: Venda | null
  mes: { quantidadeVendas: number; valorVendas: number; proLaboreSacado: number; retidoCaixa: number; ticketMedio: number }
  ano: { quantidadeVendas: number; valorVendas: number; proLaboreSacado: number }
  serieMensal: { mes: number; label: string; quantidadeVendas: number; valorVendas: number; proLaboreSacado: number }[]
  ultimasVendas: Venda[]
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
  },
  parametros: {
    get: () => request<ParametroLiquidez>('/pro-labore/parametros'),
    atualizar: (data: ParametroLiquidez) =>
      request<ParametroLiquidez>('/pro-labore/parametros', { method: 'PUT', body: JSON.stringify(data) }),
  },
  vendas: {
    listar: (ano?: number) => request<Venda[]>(`/pro-labore/vendas${ano ? `?ano=${ano}` : ''}`),
    criar: (data: { data: string; valorVenda: number; valorProLabore: number; observacao?: string }) =>
      request<Venda>('/pro-labore/vendas', { method: 'POST', body: JSON.stringify(data) }),
    editar: (id: string, data: { valorVenda?: number; valorProLabore?: number; observacao?: string }) =>
      request<Venda>(`/pro-labore/vendas/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remover: (id: string) => request<{ ok: boolean }>(`/pro-labore/vendas/${id}`, { method: 'DELETE' }),
  },
  resumo: {
    get: () => request<ResumoProLabore>('/pro-labore/resumo'),
  },
}
