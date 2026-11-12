// PDF 00 Estrutura e design · Menu (7 grupos) e ficha de cada aba: para quem é,
// a pergunta que responde e a ação principal. A ficha vira o cabeçalho da tela.
// `numeros`: até 3 métricas do dicionário no "Agora" (nenhum número fora dele).
// `lente`: a chave da Lente do ARIES da aba (Recomendações só daquela aba).
import type { PapelHoje } from './proLaboreApi'

export interface AbaAries {
  chave: string; nome: string; grupo: string; href: string
  paraQuem: string; pergunta: string; acaoPrincipal: string; acaoHref?: string
  numeros: string[]; lente: string
  // Quem vê no menu (vazio = todos). O acesso da página continua sendo o das permissões.
  papeis?: PapelHoje[]
  modulo?: string
  // A própria página já monta o padrão (Hoje, Pergunte, Atividades, Recomendações).
  proprio?: boolean
  /** Tela larga: números e Lente numa linha no topo, o trabalho ocupa a largura toda (ex.: CRM). */
  largo?: boolean
  // Outras rotas que pertencem a esta aba.
  tambem?: string[]
}

const GESTAO: PapelHoje[] = ['DONO', 'SUPERVISOR']
const COMERCIAL: PapelHoje[] = ['DONO', 'SUPERVISOR', 'SDR', 'VENDEDOR']

export const ABAS: AbaAries[] = [
  // Início
  { chave: 'hoje', nome: 'Hoje', grupo: 'Início', href: '/pro-labore/hoje', paraQuem: 'Todos', pergunta: 'O que eu preciso fazer agora para bater a meta?', acaoPrincipal: 'Executar a próxima atividade', numeros: [], lente: 'hoje', proprio: true },
  { chave: 'pergunte', nome: 'Pergunte ao ARIES', grupo: 'Início', href: '/pro-labore/pergunte', paraQuem: 'Todos', pergunta: 'O que está acontecendo na operação, e por quê?', acaoPrincipal: 'Fazer uma pergunta', numeros: [], lente: 'pergunte', proprio: true },
  { chave: 'recomendacoes', nome: 'Recomendações', grupo: 'Início', href: '/pro-labore/recomendacoes', paraQuem: 'Gestão', pergunta: 'Onde está o maior ganho que ainda não pegamos?', acaoPrincipal: 'Aceitar e atribuir uma recomendação', numeros: [], lente: 'recomendacoes', papeis: GESTAO, proprio: true },
  // Comercial
  { chave: 'crm', nome: 'CRM', grupo: 'Comercial', href: '/pro-labore/leads', paraQuem: 'SDRs, vendedores, supervisão', pergunta: 'Em que etapa está cada cliente?', acaoPrincipal: 'Avançar o lead e agendar o próximo passo', numeros: ['leads_novos', 'taxa_abordagem', 'leads_parados'], lente: 'crm', papeis: COMERCIAL, modulo: 'crm', largo: true },
  { chave: 'conversas', nome: 'Conversas', grupo: 'Comercial', href: '/pro-labore/whatsapp', paraQuem: 'SDRs, vendedores', pergunta: 'Quem está esperando resposta?', acaoPrincipal: 'Responder', numeros: ['clientes_esperando', 'tempo_primeira_resposta', 'taxa_resposta'], lente: 'conversas', papeis: COMERCIAL, modulo: 'assistente' },
  { chave: 'credito', nome: 'Crédito', grupo: 'Comercial', href: '/pro-labore/credito', paraQuem: 'SDRs, gestão', pergunta: 'Qual ficha está parada e em qual banco?', acaoPrincipal: 'Enviar ou cobrar a ficha', numeros: ['fichas_aguardando_banco', 'aprovacao_credito', 'tempo_resposta_banco'], lente: 'credito', papeis: COMERCIAL, modulo: 'crm' },
  { chave: 'atividades', nome: 'Atividades', grupo: 'Comercial', href: '/pro-labore/atividades', paraQuem: 'Todos', pergunta: 'O que está atrasado ou vence hoje?', acaoPrincipal: 'Concluir e registrar o resultado', numeros: ['atividades_atrasadas'], lente: 'atividades', proprio: true, tambem: ['/pro-labore/ligacoes', '/pro-labore/agenda'] },
  { chave: 'reativacao', nome: 'Reativação', grupo: 'Comercial', href: '/pro-labore/reativacao', paraQuem: 'SDRs, vendedores', pergunta: 'Quem já perdemos e vale tentar de novo?', acaoPrincipal: 'Reaquecer o cliente', numeros: ['faturamento_por_origem'], lente: 'reativacao', papeis: COMERCIAL, modulo: 'crm' },
  { chave: 'estoque-demanda', nome: 'Estoque e demanda', grupo: 'Comercial', href: '/pro-labore/aba/estoque-demanda', paraQuem: 'Gestão, vendas, social media', pergunta: 'O que temos, o que está parado e o que os clientes pedem?', acaoPrincipal: 'Conectar moto e lead', numeros: ['objecoes_frequentes'], lente: 'estoque-demanda', papeis: COMERCIAL },
  { chave: 'pos-venda', nome: 'Pós-venda', grupo: 'Comercial', href: '/pro-labore/aba/pos-venda', paraQuem: 'Vendedores, gestão', pergunta: 'Quem comprou e o que ainda falta entregar ou pedir?', acaoPrincipal: 'Concluir a etapa e pedir indicação', numeros: ['vendas'], lente: 'pos-venda', papeis: COMERCIAL },
  // Marketing
  { chave: 'trafego', nome: 'Tráfego', grupo: 'Marketing', href: '/pro-labore/trafego', paraQuem: 'Gestor de tráfego, dono', pergunta: 'O dinheiro em anúncio está virando venda?', acaoPrincipal: 'Pausar, trocar ou escalar', numeros: ['gasto_anuncio', 'custo_por_lead', 'roas'], lente: 'trafego', papeis: ['DONO', 'TRAFEGO'], modulo: 'trafego' },
  { chave: 'social-media', nome: 'Social Media', grupo: 'Marketing', href: '/pro-labore/social-media', paraQuem: 'Social media', pergunta: 'O que publicar hoje e o que funcionou?', acaoPrincipal: 'Produzir e publicar a pauta', numeros: ['posts_publicados', 'leads_dos_posts', 'vendas_por_post'], lente: 'social-media', papeis: ['DONO', 'SOCIAL_MEDIA'], modulo: 'socialMedia', tambem: ['/pro-labore/sm'] },
  { chave: 'origem-vendas', nome: 'Origem das vendas', grupo: 'Marketing', href: '/pro-labore/aba/origem-vendas', paraQuem: 'Marketing, dono', pergunta: 'De onde vêm as vendas e quanto custa cada uma?', acaoPrincipal: 'Mover esforço para a origem que vende', numeros: ['faturamento_por_origem', 'custo_por_lead', 'roas'], lente: 'origem-vendas', papeis: ['DONO', 'TRAFEGO'], tambem: ['/pro-labore/indicadores'] },
  // Pessoas
  { chave: 'equipe', nome: 'Equipe', grupo: 'Pessoas', href: '/pro-labore/vendedores', paraQuem: 'Supervisão, dono', pergunta: 'Como cada pessoa está indo e onde precisa de ajuda?', acaoPrincipal: 'Abrir treino ou conversa individual', numeros: ['tempo_primeira_resposta', 'atividades_atrasadas', 'conversao_lead_venda'], lente: 'equipe', papeis: GESTAO, tambem: ['/pro-labore/equipe'] },
  { chave: 'desenvolvimento', nome: 'Desenvolvimento', grupo: 'Pessoas', href: '/pro-labore/copiloto', paraQuem: 'SDRs, vendedores', pergunta: 'No que eu preciso melhorar e como treinar?', acaoPrincipal: 'Fazer o treino', numeros: ['tempo_primeira_resposta', 'taxa_resposta', 'conversao_lead_venda'], lente: 'desenvolvimento', papeis: COMERCIAL, modulo: 'copiloto' },
  { chave: 'rotina-auditoria', nome: 'Rotina e auditoria', grupo: 'Pessoas', href: '/pro-labore/dados', paraQuem: 'Supervisão, equipe', pergunta: 'A equipe está cumprindo o combinado?', acaoPrincipal: 'Cobrar ou ajustar a rotina', numeros: ['atividades_atrasadas'], lente: 'rotina-auditoria', papeis: GESTAO },
  { chave: 'ocorrencias', nome: 'Ocorrências', grupo: 'Pessoas', href: '/pro-labore/ocorrencias', paraQuem: 'Supervisão, dono', pergunta: 'O que precisa ser corrigido e até quando?', acaoPrincipal: 'Registrar e acompanhar', numeros: [], lente: 'ocorrencias', modulo: 'ocorrencias' },
  { chave: 'reunioes', nome: 'Reuniões', grupo: 'Pessoas', href: '/pro-labore/reunioes', paraQuem: 'Gestão, equipe', pergunta: 'O que discutir e decidir nesta reunião?', acaoPrincipal: 'Conduzir e transformar em ações', numeros: [], lente: 'reunioes', modulo: 'reunioes' },
  // Gestão
  { chave: 'vendas-pagamentos', nome: 'Vendas e pagamentos', grupo: 'Gestão', href: '/pro-labore/vendas', paraQuem: 'Dono, financeiro', pergunta: 'O que foi vendido e o que falta pagar?', acaoPrincipal: 'Registrar venda e pagar', numeros: ['vendas', 'faturamento', 'comissoes_a_pagar'], lente: 'vendas-pagamentos', papeis: ['DONO', 'FINANCEIRO'], modulo: 'vendas' },
  { chave: 'financeiro', nome: 'Financeiro', grupo: 'Gestão', href: '/pro-labore/financeiro', paraQuem: 'Dono, financeiro', pergunta: 'O que sai do caixa fora das vendas?', acaoPrincipal: 'Lançar e pagar', numeros: ['saidas_financeiro'], lente: 'financeiro', papeis: ['DONO', 'FINANCEIRO'], modulo: 'financeiro' },
  { chave: 'metas-premissas', nome: 'Metas e premissas', grupo: 'Gestão', href: '/pro-labore/aba/metas-premissas', paraQuem: 'Dono', pergunta: 'Quais metas e regras o sistema usa?', acaoPrincipal: 'Ajustar uma meta', acaoHref: '/pro-labore/configuracoes', numeros: ['previsao_fechamento'], lente: 'metas-premissas', papeis: ['DONO'] },
  { chave: 'plano-crescimento', nome: 'Plano de Crescimento', grupo: 'Gestão', href: '/pro-labore/plano-crescimento', paraQuem: 'Dono', pergunta: 'Em que estágio o negócio está e o que trava o próximo?', acaoPrincipal: 'Atacar o pilar mais fraco', numeros: [], lente: 'plano-crescimento', papeis: ['DONO'], modulo: 'planoCrescimento' },
  { chave: 'relatorios', nome: 'Relatórios', grupo: 'Gestão', href: '/pro-labore/assistente', paraQuem: 'Gestão', pergunta: 'Como foi o dia, a semana e o mês?', acaoPrincipal: 'Ler e enviar', numeros: ['faturamento', 'vendas', 'leads_novos'], lente: 'relatorios', papeis: GESTAO },
  // Conhecimento
  { chave: 'playbook', nome: 'Playbook', grupo: 'Conhecimento', href: '/pro-labore/aba/playbook', paraQuem: 'Todos', pergunta: 'Como a loja atende?', acaoPrincipal: 'Usar a resposta pronta', numeros: [], lente: 'playbook' },
  { chave: 'base-conhecimento', nome: 'Base de conhecimento', grupo: 'Conhecimento', href: '/pro-labore/aba/base-conhecimento', paraQuem: 'Todos', pergunta: 'Como responder esta dúvida ou objeção?', acaoPrincipal: 'Aprovar ou usar um verbete', numeros: ['objecoes_frequentes'], lente: 'base-conhecimento' },
  { chave: 'anotacoes', nome: 'Anotações', grupo: 'Conhecimento', href: '/pro-labore/anotacoes', paraQuem: 'Todos', pergunta: 'Onde guardo minhas ideias e planos?', acaoPrincipal: 'Escrever ou transformar em ação', numeros: [], lente: 'anotacoes', modulo: 'anotacoes' },
  // Sistema
  { chave: 'configuracoes', nome: 'Configurações', grupo: 'Sistema', href: '/pro-labore/configuracoes', paraQuem: 'Dono', pergunta: 'Como o sistema está configurado?', acaoPrincipal: 'Ajustar e conectar', numeros: [], lente: 'configuracoes', papeis: ['DONO'], tambem: ['/pro-labore/equipe/acessos'] },
]
export const GRUPOS = ['Início', 'Comercial', 'Marketing', 'Pessoas', 'Gestão', 'Conhecimento', 'Sistema'] as const

const bate = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`)
/** A aba da página aberta (a rota mais longa que bate). */
export function abaDaRota(pathname: string): AbaAries | null {
  let melhor: { aba: AbaAries; tam: number } | null = null
  for (const a of ABAS) for (const h of [a.href, ...(a.tambem ?? [])]) if (bate(pathname, h) && (!melhor || h.length > melhor.tam)) melhor = { aba: a, tam: h.length }
  return melhor?.aba ?? null
}
export const abaPorChave = (chave: string) => ABAS.find(a => a.chave === chave) ?? null
