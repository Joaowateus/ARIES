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
  departamento?: string | null
  gestorId?: string | null
  criadoEm?: string
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
  ultimaInteracaoEm?: string | null
  proximaAcaoEm?: string | null
  proximaAcaoDescricao?: string | null
  criadaEm: string
  atualizadaEm: string
  diasNaEtapaAtual?: number | null
}

export interface MetaFunilEtapa {
  id: string
  etapa: string
  metaPct: number
  tipoMeta: 'MINIMO' | 'MAXIMO_PERDA'
  tempoMaximoDias?: number | null
}

export interface EtapaConversao {
  estagio: string
  label: string
  quantidade: number
  conversaoReal: number
  meta: number
  tipoMeta: 'MINIMO' | 'MAXIMO_PERDA'
  diferenca: number
  status: 'verde' | 'amarelo' | 'vermelho'
  tempoMedioDias: number | null
  tempoMaximoDias: number | null
}

export interface ConversaoFunil {
  totalLeads: number
  etapas: EtapaConversao[]
}

export interface Notificacao {
  id: string
  tipo: string
  titulo: string
  mensagem: string
  lida: boolean
  criadoEm: string
}

export interface EventoCalendario {
  tipo: string
  titulo: string
  data: string
  entidadeId: string
}

export interface EquipeResumo {
  usuario: { id: string; nome: string; papel: string }
  vendasNoMes: number
  faturamentoNoMes: number
  leadsAtivos: number
  tarefasPendentes: number
  rotinaCumpridaHoje: number | null
}

export interface ScoreConfig {
  pesoComercial: number
  pesoProdutividade: number
  pesoProcessos: number
  pesoCrm: number
  pesoConteudo: number
  pesoTreinamentos: number
  pesoRotinas: number
}

export interface ScorePessoa {
  usuario: { id: string; nome: string; papel: string }
  dimensoes: { comercial: number; produtividade: number; processos: number; crm: number; conteudo: number; treinamentos: number }
  score: number
}

export interface AuditoriaGenerica {
  id: string
  entidadeTipo: string
  entidadeId: string
  conforme: boolean
  observacoes?: string | null
  data: string
  responsavel?: { id: string; nome: string }
}

export interface ResumoAuditoriaArea {
  entidadeTipo: string
  total: number
  percentualConformidade: number
}

export interface PlanoAcaoGenerico {
  id: string
  problema: string
  causa?: string | null
  solucao?: string | null
  prazo?: string | null
  status: string
  responsavel?: { id: string; nome: string }
}

export interface Processo {
  id: string
  nome: string
  departamento?: string | null
  cargo?: string | null
  objetivo?: string | null
  fluxo?: string[] | null
  pop?: { titulo: string; descricao?: string; checklist?: string[] }[] | null
  ferramentas?: string[] | null
  kpis?: { categoria: string; indicador: string }[] | null
  contingencia?: { cenario: string; acao: string }[] | null
  protocolo?: { id: string; nome: string } | null
  rotinas?: { id: string; nome: string }[]
}

export interface Treinamento {
  id: string
  nome: string
  categoria?: string | null
  descricao?: string | null
  videoUrl?: string | null
  pdfUrl?: string | null
  documentoUrl?: string | null
  link?: string | null
}

export interface TreinamentoProgresso {
  id: string
  status: 'DISPONIVEL' | 'INICIADO' | 'CONCLUIDO'
  percentual: number
  nota?: number | null
}

export interface TreinamentoComProgresso {
  treinamento: Treinamento
  progresso: TreinamentoProgresso
}

export interface ProgressoEquipeTreinamento {
  usuario: { id: string; nome: string }
  total: number
  concluidos: number
  percentual: number
}

export interface ContaAnuncio {
  id: string
  nome: string
  plataforma: string
}

export interface AnuncioProducao {
  id: string
  contaId: string
  conta?: { id: string; nome: string }
  produto?: string | null
  quantidade: number
  data: string
}

export interface ResumoMarketplace {
  meta: number
  produzido: number
  restante: number
  percentual: number
  porConta: { contaId: string; nome: string; meta: number; produzido: number }[]
}

export interface ConteudoSocialMedia {
  id: string
  tipo: string
  plataforma: string
  status: string
  link?: string | null
  alcance?: number | null
  visualizacoes?: number | null
  interacoes?: number | null
  leadsGerados?: number | null
  vendasOriginadas?: number | null
  observacoes?: string | null
  data: string
  usuario?: { id: string; nome: string }
}

export interface ResumoSocialMedia {
  produzido: number
  publicado: number
  pendente: number
  alcance: number
  visualizacoes: number
  interacoes: number
  leadsGerados: number
  vendasOriginadas: number
  porTipo: { tipo: string; quantidade: number }[]
}

export interface RotinaBloco { titulo: string; itens: string[] }

export interface Rotina {
  id: string
  nome: string
  descricao?: string | null
  papelAlvo?: string | null
  departamento?: string | null
  frequencia: 'DIARIA' | 'SEMANAL' | 'MENSAL'
  horario?: string | null
  blocos: RotinaBloco[]
  evidenciaNecessaria: boolean
  status: string
}

export interface ItemExecucao { bloco: string; item: string; status: string }

export interface RotinaExecucao {
  id: string
  rotinaId: string
  data: string
  itensStatus: ItemExecucao[]
  status: string
  evidencia?: string | null
  observacao?: string | null
  concluidoEm?: string | null
}

export interface RotinaComExecucao {
  rotina: Rotina
  execucao: RotinaExecucao
}

export interface Tarefa {
  id: string
  titulo: string
  descricao?: string | null
  prazo?: string | null
  prioridade: 'BAIXA' | 'NORMAL' | 'ALTA' | 'URGENTE'
  status: string
  responsavel?: { id: string; nome: string }
  criadoPor?: { id: string; nome: string }
  criadoEm: string
}

export interface ProducaoMensal {
  mes: number
  label: string
  vendas: number
  faturamento: number
}

export interface MetasComerciais {
  supermetaVendasMes: number
  vendasMes: number
  metaAnunciosMes: number
  anunciosMes: number
  metaAnunciosQuinzena: number
  anunciosQuinzenaAtual: number
  quinzenaAtual: 1 | 2
}

export interface MeuPainel {
  metas: { dia: MetaComProgresso | null; semana: MetaComProgresso | null; mes: MetaComProgresso[] }
  leadsPendentes: number
  followUpsPendentes: number
  vendas: number
  faturamentoGerado: number
  anunciosProduzidosSemana: number
  conteudosProduzidosSemana: number
  tarefasPendentes: number
  producaoMensal: ProducaoMensal[]
  metasComerciais: MetasComerciais
  funilProprio: ConversaoFunil
}

export interface MetaComercialPadrao {
  supermetaVendasMes: number
  metaAnunciosMes: number
}

export interface Insight {
  tipo: string
  severidade: 'alto' | 'medio' | 'baixo'
  mensagem: string
}

export interface AtividadeOportunidade {
  id: string
  tipo: string
  descricao: string
  criadoEm: string
  usuario?: { id: string; nome: string }
}

export interface OportunidadeDetalhe extends Oportunidade {
  atividades: AtividadeOportunidade[]
  historicoEstagio: { id: string; estagioAnterior: string | null; estagioNovo: string; criadoEm: string }[]
}

export interface Meta {
  id: string
  usuarioId?: string | null
  titulo: string
  tipo: 'QUANTIDADE' | 'FATURAMENTO'
  valor: number
  periodo: 'DIARIA' | 'SEMANAL' | 'MENSAL'
  inicioEm: string
  fimEm: string
  status: string
  criadaEm: string
}

export interface MetaComProgresso extends Meta {
  realizado: number
  percentual: number
}

export interface FunilEtapa {
  estagio: string
  label: string
  quantidade: number
  conversaoDoTopo: number
  tempoMedioDias: number | null
}

export interface DashboardExecutivo {
  periodo: { inicio: string; fim: string; label: string }
  resumo: {
    faturamento: number
    vendas: number
    conversao: number
    ticketMedio: number
    lucro: number
  }
  segundaLinha: { leads: number; simulacoes: number; fechamentos: number }
  funil: FunilEtapa[]
  recentes: Array<{ id: string; nomeCliente: string; estagio: string; valor?: number }>
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

// --- Protocolos Comerciais ---

export interface ProtocoloResumo {
  id: string
  categoria: string
  nome: string
  versao: string
  status: string
  naoConformidadesAbertas: number
  planosAcaoPendentes: number
  ultimaAuditoria: { protocoloId: string; data: string; conforme: boolean } | null
}

export interface ProtocoloPop { titulo: string; descricao?: string; checklist?: string[] }
export interface ProtocoloSlaItem { item: string; prazo: string }
export interface ProtocoloKpi { categoria: string; indicador: string }
export interface ProtocoloContingencia { cenario: string; acao: string }
export interface ProtocoloCadencia { chave: string; valor: string }
export interface ProtocoloAnexo { titulo: string; itens: string[] }

export interface AuditoriaProtocolo {
  id: string
  data: string
  responsavel?: { id: string; nome: string }
  conforme: boolean
  itensVerificados?: { item: string; ok: boolean }[]
  observacoes?: string
}

export interface PlanoAcaoProtocolo {
  id: string
  naoConformidadeId?: string
  problema: string
  causa?: string
  solucao?: string
  responsavel?: { id: string; nome: string }
  prazo?: string
  status: string
  concluidoEm?: string
  criadoEm: string
}

export interface NaoConformidadeProtocolo {
  id: string
  tipo: string
  descricao?: string
  data: string
  status: string
  planosAcao?: PlanoAcaoProtocolo[]
}

export interface MelhoriaProtocolo {
  id: string
  descricao: string
  status: string
  criadoEm: string
}

export interface ProtocoloDetalhe {
  id: string
  categoria: string
  nome: string
  versao: string
  status: string
  ordem?: number
  objetivo?: string
  resultadoEsperado?: string[]
  responsaveis?: string[]
  processo?: string[]
  pop?: ProtocoloPop[]
  regras?: string[]
  ferramentas?: string[]
  rotina?: ProtocoloCadencia[]
  sla?: ProtocoloSlaItem[]
  kpis?: ProtocoloKpi[]
  auditoriaItens?: string[]
  frequenciaAuditoria?: string
  criteriosConformidade?: string[]
  naoConformidadesCatalogo?: string[]
  reunioes?: ProtocoloCadencia[]
  perguntasAnalise?: string[]
  riscos?: string[]
  planoContingencia?: ProtocoloContingencia[]
  oportunidadesMelhoriaNotas?: string[]
  automacoesPossiveis?: string[]
  iaAplicavel?: string[]
  revisaoFrequencia?: string
  revisaoResponsavel?: string
  anexos?: ProtocoloAnexo[]
  criadoPor?: { id: string; nome: string }
  criadoEm: string
  atualizadoEm: string
  auditorias: AuditoriaProtocolo[]
  naoConformidades: NaoConformidadeProtocolo[]
  planosAcao: PlanoAcaoProtocolo[]
  melhorias: MelhoriaProtocolo[]
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
    editar: (id: string, data: object) =>
      request<{ ok: boolean }>(`/usuarios/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
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
    detalhe: (id: string) => request<OportunidadeDetalhe>(`/oportunidades/${id}`),
    criar: (data: object) =>
      request<Oportunidade>('/oportunidades', { method: 'POST', body: JSON.stringify(data) }),
    editar: (id: string, data: object) =>
      request<{ ok: boolean }>(`/oportunidades/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    moverEstagio: (id: string, estagio: string) =>
      request<Oportunidade>(`/oportunidades/${id}/estagio`, {
        method: 'PATCH',
        body: JSON.stringify({ estagio }),
      }),
    registrarAtividade: (id: string, data: { tipo: string; descricao: string; proximaAcaoEm?: string; proximaAcaoDescricao?: string }) =>
      request<AtividadeOportunidade>(`/oportunidades/${id}/atividades`, { method: 'POST', body: JSON.stringify(data) }),
  },
  dashboard: {
    get: () => request<DashboardExecutivo>('/dashboard'),
  },
  metas: {
    listar: (status?: string) => request<Meta[]>(`/metas${status ? `?status=${status}` : ''}`),
    progresso: (status?: string) => request<MetaComProgresso[]>(`/metas/progresso${status ? `?status=${status}` : ''}`),
    criar: (data: object) => request<Meta>('/metas', { method: 'POST', body: JSON.stringify(data) }),
    atualizar: (id: string, data: object) =>
      request<{ ok: boolean }>(`/metas/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    encerrar: (id: string) => request<{ ok: boolean }>(`/metas/${id}/encerrar`, { method: 'PATCH' }),
    remover: (id: string) => request<{ ok: boolean }>(`/metas/${id}`, { method: 'DELETE' }),
  },
  notificacoes: {
    listar: () => request<Notificacao[]>('/notificacoes'),
    marcarLida: (id: string) => request<{ ok: boolean }>(`/notificacoes/${id}/lida`, { method: 'PATCH' }),
    marcarTodasLidas: () => request<{ ok: boolean }>('/notificacoes/marcar-todas-lidas', { method: 'PATCH' }),
  },
  calendario: {
    listar: (de?: string, ate?: string) => {
      const qs = new URLSearchParams()
      if (de) qs.set('de', de)
      if (ate) qs.set('ate', ate)
      const s = qs.toString()
      return request<EventoCalendario[]>(`/calendario${s ? `?${s}` : ''}`)
    },
  },
  relatorios: {
    baixarCsv: async (tipo: 'oportunidades' | 'contratos' | 'tarefas') => {
      const token = getToken()
      const res = await fetch(`${BASE}/relatorios/${tipo}.csv`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('Erro ao gerar relatório')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${tipo}.csv`
      a.click()
      URL.revokeObjectURL(url)
    },
  },
  gestao: {
    equipe: () => request<EquipeResumo[]>('/gestao/equipe'),
    scoreConfig: () => request<ScoreConfig>('/gestao/score-config'),
    atualizarScoreConfig: (data: object) => request<ScoreConfig>('/gestao/score-config', { method: 'PUT', body: JSON.stringify(data) }),
    score: () => request<ScorePessoa[]>('/gestao/score'),
  },
  auditorias: {
    listar: (entidadeTipo?: string) => request<AuditoriaGenerica[]>(`/auditorias${entidadeTipo ? `?entidadeTipo=${entidadeTipo}` : ''}`),
    criar: (data: object) => request<AuditoriaGenerica>('/auditorias', { method: 'POST', body: JSON.stringify(data) }),
    resumo: () => request<ResumoAuditoriaArea[]>('/auditorias/resumo'),
    planosAcao: () => request<PlanoAcaoGenerico[]>('/auditorias/planos-acao'),
    criarPlanoAcao: (data: object) => request<PlanoAcaoGenerico>('/auditorias/planos-acao', { method: 'POST', body: JSON.stringify(data) }),
    atualizarStatusPlano: (id: string, status: string) =>
      request<{ ok: boolean }>(`/auditorias/planos-acao/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  },
  processos: {
    listar: () => request<Processo[]>('/processos'),
    detalhe: (id: string) => request<Processo>(`/processos/${id}`),
    criar: (data: object) => request<Processo>('/processos', { method: 'POST', body: JSON.stringify(data) }),
    editar: (id: string, data: object) => request<{ ok: boolean }>(`/processos/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  treinamentos: {
    listar: () => request<Treinamento[]>('/treinamentos'),
    criar: (data: object) => request<Treinamento>('/treinamentos', { method: 'POST', body: JSON.stringify(data) }),
    progresso: () => request<TreinamentoComProgresso[]>('/treinamentos/progresso'),
    atualizarProgresso: (treinamentoId: string, data: object) =>
      request<{ ok: boolean }>(`/treinamentos/progresso/${treinamentoId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    progressoEquipe: () => request<ProgressoEquipeTreinamento[]>('/treinamentos/progresso/equipe'),
  },
  marketplace: {
    contas: () => request<ContaAnuncio[]>('/marketplace/contas'),
    criarConta: (data: { nome: string; plataforma?: string }) =>
      request<ContaAnuncio>('/marketplace/contas', { method: 'POST', body: JSON.stringify(data) }),
    producao: () => request<AnuncioProducao[]>('/marketplace/producao'),
    registrarProducao: (data: { contaId: string; unidadeId?: string; produto?: string; quantidade?: number }) =>
      request<AnuncioProducao>('/marketplace/producao', { method: 'POST', body: JSON.stringify(data) }),
    resumo: () => request<ResumoMarketplace>('/marketplace/resumo'),
  },
  socialMedia: {
    listar: () => request<ConteudoSocialMedia[]>('/social-media'),
    criar: (data: object) => request<ConteudoSocialMedia>('/social-media', { method: 'POST', body: JSON.stringify(data) }),
    resumo: () => request<ResumoSocialMedia>('/social-media/resumo'),
  },
  rotinas: {
    listar: () => request<Rotina[]>('/rotinas'),
    criar: (data: object) => request<Rotina>('/rotinas', { method: 'POST', body: JSON.stringify(data) }),
    editar: (id: string, data: object) => request<{ ok: boolean }>(`/rotinas/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    arquivar: (id: string) => request<{ ok: boolean }>(`/rotinas/${id}/arquivar`, { method: 'PATCH' }),
    minha: () => request<RotinaComExecucao[]>('/rotinas/minha'),
    atualizarExecucao: (id: string, data: object) =>
      request<RotinaExecucao>(`/rotinas/execucoes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  tarefas: {
    listar: (status?: string) => request<Tarefa[]>(`/tarefas${status ? `?status=${status}` : ''}`),
    criar: (data: object) => request<Tarefa>('/tarefas', { method: 'POST', body: JSON.stringify(data) }),
    atualizarStatus: (id: string, status: string) =>
      request<{ ok: boolean }>(`/tarefas/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    remover: (id: string) => request<{ ok: boolean }>(`/tarefas/${id}`, { method: 'DELETE' }),
  },
  meuPainel: {
    get: () => request<MeuPainel>('/meu-painel'),
  },
  metasComerciais: {
    get: () => request<MetaComercialPadrao>('/metas-comerciais'),
    atualizar: (dados: Partial<MetaComercialPadrao>) =>
      request<MetaComercialPadrao>('/metas-comerciais', { method: 'PUT', body: JSON.stringify(dados) }),
  },
  funil: {
    metas: () => request<MetaFunilEtapa[]>('/funil/metas'),
    atualizarMeta: (etapa: string, dados: { metaPct?: number; tempoMaximoDias?: number | null }) =>
      request<MetaFunilEtapa>(`/funil/metas/${etapa}`, { method: 'PUT', body: JSON.stringify(dados) }),
    conversao: () => request<ConversaoFunil>('/funil/conversao'),
  },
  insights: {
    listar: () => request<Insight[]>('/insights'),
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
  protocolos: {
    listar: () => request<ProtocoloResumo[]>('/protocolos'),
    detalhe: (id: string) => request<ProtocoloDetalhe>(`/protocolos/${id}`),
    criar: (data: object) => request<ProtocoloDetalhe>('/protocolos', { method: 'POST', body: JSON.stringify(data) }),
    editar: (id: string, data: object) =>
      request<{ ok: boolean }>(`/protocolos/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    carregarPadrao: () =>
      request<{ criados: number; existentes: number; total: number }>('/protocolos/seed-padrao', { method: 'POST' }),
    registrarAuditoria: (id: string, data: { conforme: boolean; itensVerificados?: { item: string; ok: boolean }[]; observacoes?: string }) =>
      request<AuditoriaProtocolo>(`/protocolos/${id}/auditorias`, { method: 'POST', body: JSON.stringify(data) }),
    registrarNaoConformidade: (id: string, data: { tipo: string; descricao?: string }) =>
      request<NaoConformidadeProtocolo>(`/protocolos/${id}/nao-conformidades`, { method: 'POST', body: JSON.stringify(data) }),
    atualizarNaoConformidade: (id: string, ncId: string, status: string) =>
      request<{ ok: boolean }>(`/protocolos/${id}/nao-conformidades/${ncId}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    registrarPlanoAcao: (id: string, data: { naoConformidadeId?: string; problema: string; causa?: string; solucao?: string; responsavelId?: string; prazo?: string }) =>
      request<PlanoAcaoProtocolo>(`/protocolos/${id}/planos-acao`, { method: 'POST', body: JSON.stringify(data) }),
    atualizarPlanoAcao: (id: string, planoId: string, data: { status?: string; causa?: string; solucao?: string }) =>
      request<{ ok: boolean }>(`/protocolos/${id}/planos-acao/${planoId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    registrarMelhoria: (id: string, descricao: string) =>
      request<MelhoriaProtocolo>(`/protocolos/${id}/melhorias`, { method: 'POST', body: JSON.stringify({ descricao }) }),
    atualizarMelhoria: (id: string, melhoriaId: string, status: string) =>
      request<{ ok: boolean }>(`/protocolos/${id}/melhorias/${melhoriaId}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  },
}
