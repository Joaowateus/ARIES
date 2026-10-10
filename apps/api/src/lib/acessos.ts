// Acessos da equipe: o que cada login enxerga e pode mexer, módulo a módulo.
// Cada acesso tem um nível por módulo (sem acesso, ver, ver e editar) e um
// escopo de dados (só os próprios ou a equipe toda). O escopo é o `papel`
// do vendedor que já existia (VENDEDOR = próprios, SUPERVISOR = equipe), então
// todo o recorte por pessoa que as rotas já fazem continua valendo.
// `Vendedor.permissoes` guarda o mapa escolhido pelo dono; sem ele, vale o
// padrão do escopo (o mesmo comportamento de antes desta tela existir).
import { Request, Response, NextFunction } from 'express'

export type Nivel = 'NENHUM' | 'VER' | 'EDITAR'
export type Escopo = 'PROPRIO' | 'EQUIPE'
const ORDEM: Record<Nivel, number> = { NENHUM: 0, VER: 1, EDITAR: 2 }

export interface ModuloAcesso {
  chave: string
  rotulo: string
  grupo: string
  descricao: string
  /** O que "Ver" permite nesse módulo, quando é mais do que só olhar. */
  ver?: string
  /** Níveis que fazem sentido (o Dashboard, por exemplo, não tem edição). */
  niveis: Nivel[]
}

const TODOS: Nivel[] = ['NENHUM', 'VER', 'EDITAR']

export const MODULOS: ModuloAcesso[] = [
  { chave: 'painel', rotulo: 'Dashboard', grupo: 'Geral', descricao: 'Resumo do mês, metas e ranking (as cifras do dono nunca aparecem).', niveis: ['NENHUM', 'VER'] },
  { chave: 'crm', rotulo: 'CRM', grupo: 'Operação', descricao: 'Leads e funil de vendas.', niveis: TODOS },
  { chave: 'agenda', rotulo: 'Agenda', grupo: 'Operação', descricao: 'Tarefas e rotinas da equipe.', ver: 'Ver e concluir as tarefas; editar é criar e mudar tarefas.', niveis: TODOS },
  { chave: 'reunioes', rotulo: 'Reuniões', grupo: 'Operação', descricao: 'Reuniões e apresentações (cada um vê as próprias e as compartilhadas).', niveis: TODOS },
  { chave: 'anotacoes', rotulo: 'Anotações', grupo: 'Operação', descricao: 'Notas, pastas e mapas mentais pessoais.', niveis: TODOS },
  { chave: 'vendas', rotulo: 'Vendas', grupo: 'Operação', descricao: 'Vendas registradas, comissões e recibos.', niveis: TODOS },
  { chave: 'financeiro', rotulo: 'Financeiro', grupo: 'Operação', descricao: 'Salários, investimentos, custos e outros gastos, com recibo. Quem vê só os próprios dados vê só os recibos dele.', niveis: TODOS },
  { chave: 'socialMedia', rotulo: 'Social Media', grupo: 'Operação', descricao: 'Instagram da própria pessoa.', niveis: TODOS },
  { chave: 'trafego', rotulo: 'Tráfego', grupo: 'Operação', descricao: 'Anúncios da Meta. Conectar ou trocar a conta continua só com o dono.', niveis: TODOS },
  { chave: 'assistente', rotulo: 'Assistente Comercial', grupo: 'Operação', descricao: 'Assistente do WhatsApp da própria pessoa.', niveis: TODOS },
  { chave: 'vendedores', rotulo: 'Vendedores', grupo: 'Equipe', descricao: 'Cadastro da equipe, metas e tetos. Dar login continua só com o dono.', niveis: TODOS },
  { chave: 'ocorrencias', rotulo: 'Ocorrências', grupo: 'Equipe', descricao: 'Registro de ocorrências da equipe.', niveis: TODOS },
  { chave: 'indicadores', rotulo: 'Indicadores', grupo: 'Sistema', descricao: 'Funil mensal e gastos com anúncio.', niveis: TODOS },
  { chave: 'planoCrescimento', rotulo: 'Plano de Crescimento', grupo: 'Sistema', descricao: 'Ações e histórico do plano.', niveis: TODOS },
  { chave: 'configuracoes', rotulo: 'Configurações', grupo: 'Sistema', descricao: 'Parâmetros, tetos e metas da operação.', niveis: TODOS },
]
const CHAVES = new Set(MODULOS.map(m => m.chave))
export type Permissoes = Record<string, Nivel>

const nada = (): Permissoes => Object.fromEntries(MODULOS.map(m => [m.chave, 'NENHUM'])) as Permissoes
const com = (base: Permissoes, extra: Permissoes): Permissoes => ({ ...base, ...extra })

// O mesmo que vendedor e supervisor já viam antes desta tela.
const PADRAO_VENDEDOR = com(nada(), { painel: 'VER', crm: 'EDITAR', agenda: 'VER', reunioes: 'EDITAR', anotacoes: 'EDITAR', socialMedia: 'EDITAR', assistente: 'EDITAR' })
const PADRAO_SUPERVISOR = com(PADRAO_VENDEDOR, { agenda: 'EDITAR', ocorrencias: 'EDITAR' })

export interface PerfilPronto { chave: string; rotulo: string; descricao: string; escopo: Escopo; vende: boolean; permissoes: Permissoes }

export const PERFIS: PerfilPronto[] = [
  { chave: 'VENDEDOR', rotulo: 'Vendedor', descricao: 'Só a própria produção: os próprios leads, tarefas e resultados.', escopo: 'PROPRIO', vende: true, permissoes: PADRAO_VENDEDOR },
  { chave: 'SUPERVISOR', rotulo: 'Supervisor', descricao: 'Vê a equipe toda no CRM e no Dashboard, cuida da agenda e das ocorrências.', escopo: 'EQUIPE', vende: true, permissoes: PADRAO_SUPERVISOR },
  { chave: 'GERENTE', rotulo: 'Gerente', descricao: 'Toca a operação: tudo liberado, menos mexer nas configurações.', escopo: 'EQUIPE', vende: false,
    permissoes: com(Object.fromEntries(MODULOS.map(m => [m.chave, m.niveis.includes('EDITAR') ? 'EDITAR' : 'VER'])) as Permissoes, { configuracoes: 'VER' }) },
  { chave: 'FINANCEIRO', rotulo: 'Financeiro', descricao: 'Vendas, comissões, pagamentos e indicadores. Não entra no CRM nem no marketing.', escopo: 'EQUIPE', vende: false,
    permissoes: com(nada(), { painel: 'VER', vendas: 'EDITAR', financeiro: 'EDITAR', vendedores: 'VER', indicadores: 'VER', configuracoes: 'VER', reunioes: 'EDITAR', anotacoes: 'EDITAR' }) },
  { chave: 'MARKETING', rotulo: 'Marketing', descricao: 'Instagram, tráfego e indicadores; vê o CRM para acompanhar os leads.', escopo: 'EQUIPE', vende: false,
    permissoes: com(nada(), { painel: 'VER', crm: 'VER', socialMedia: 'EDITAR', trafego: 'EDITAR', indicadores: 'VER', reunioes: 'EDITAR', anotacoes: 'EDITAR' }) },
  { chave: 'LEITURA', rotulo: 'Só leitura', descricao: 'Vê tudo da equipe e não muda nada.', escopo: 'EQUIPE', vende: false,
    permissoes: Object.fromEntries(MODULOS.map(m => [m.chave, 'VER'])) as Permissoes },
]

export const escopoDoPapel = (papel: string): Escopo => (papel === 'SUPERVISOR' ? 'EQUIPE' : 'PROPRIO')
export const papelDoEscopo = (escopo: Escopo) => (escopo === 'EQUIPE' ? 'SUPERVISOR' : 'VENDEDOR')

/** Permissões que valem: o que o dono escolheu, completado pelo padrão do escopo. */
export function permissoesEfetivas(papel: string, salvas: unknown): Permissoes {
  const base = papel === 'SUPERVISOR' ? PADRAO_SUPERVISOR : PADRAO_VENDEDOR
  const r: Permissoes = { ...base }
  if (salvas && typeof salvas === 'object') {
    for (const [k, v] of Object.entries(salvas as Record<string, unknown>)) {
      const m = MODULOS.find(x => x.chave === k)
      if (m && typeof v === 'string' && m.niveis.includes(v as Nivel)) r[k] = v as Nivel
    }
  }
  return r
}

export const TUDO: Permissoes = Object.fromEntries(MODULOS.map(m => [m.chave, m.niveis.includes('EDITAR') ? 'EDITAR' : 'VER'])) as Permissoes

/** Valida o mapa vindo da tela: só módulos conhecidos e níveis que o módulo aceita. */
export function limparPermissoes(entrada: Record<string, string>): Permissoes {
  const r = nada()
  for (const [k, v] of Object.entries(entrada)) {
    if (!CHAVES.has(k)) continue
    const m = MODULOS.find(x => x.chave === k)!
    if (m.niveis.includes(v as Nivel)) r[k] = v as Nivel
  }
  return r
}

declare global {
  namespace Express {
    interface Request {
      acessos?: Permissoes
    }
  }
}

export const nivelAtende = (tem: Nivel | undefined, precisa: Nivel) => ORDEM[tem ?? 'NENHUM'] >= ORDEM[precisa]

/**
 * Barra a rota pelo nível do módulo. O dono passa sempre; o papel Social
 * Media tem o próprio espaço e a própria guarda (lib/smAcesso.ts).
 */
export function requireModulo(chave: string, precisa: Nivel = 'VER') {
  const modulo = MODULOS.find(m => m.chave === chave)
  if (!modulo) throw new Error(`Módulo desconhecido: ${chave}`)
  return (req: Request, res: Response, next: NextFunction): void => {
    const papel = req.proLaboreUser?.papel
    if (papel === 'DONO' || papel === 'SOCIAL_MEDIA') { next(); return }
    const tem = req.acessos?.[chave]
    if (nivelAtende(tem, precisa)) { next(); return }
    res.status(403).json({
      error: tem === 'VER'
        ? `Seu acesso a ${modulo.rotulo} é só para ver. Peça ao gestor para liberar a edição.`
        : `Seu acesso não inclui ${modulo.rotulo}. Peça ao gestor para liberar.`,
    })
  }
}

/** Ferramentas pessoais usadas por mais de um módulo (ex.: copiar da Reunião para as Anotações). */
export function requireAlgumModulo(chaves: string[], precisa: Nivel = 'VER') {
  const rotulos = chaves.map(c => MODULOS.find(m => m.chave === c)?.rotulo ?? c).join(' ou ')
  return (req: Request, res: Response, next: NextFunction): void => {
    const papel = req.proLaboreUser?.papel
    if (papel === 'DONO' || papel === 'SOCIAL_MEDIA' || chaves.some(c => nivelAtende(req.acessos?.[c], precisa))) { next(); return }
    res.status(403).json({ error: `Seu acesso não permite isso em ${rotulos}. Peça ao gestor para liberar.` })
  }
}

/** Dados da equipe inteira: dono ou acesso com escopo de equipe. */
export function requireEscopoEquipe(req: Request, res: Response, next: NextFunction): void {
  const papel = req.proLaboreUser?.papel
  if (papel === 'DONO' || papel === 'SUPERVISOR') { next(); return }
  res.status(403).json({ error: 'Essa informação é da equipe toda, e o seu acesso mostra só os seus dados.' })
}
