// Quem está escrevendo (PDF 00, P5): o banco grava a trilha de auditoria
// sozinho (gatilho aries_auditar), e lê o autor da coluna "auditoriaAutor"
// que este módulo preenche em toda escrita das tabelas auditadas.
//
// Formato: ORIGEM|id|papel|marca — ORIGEM é USUARIO, AUTOMACAO, INTEGRACAO,
// MIGRACAO ou SISTEMA; a marca muda a cada escrita, para o gatilho saber
// que o autor é desta escrita e não de uma anterior.
import { AsyncLocalStorage } from 'node:async_hooks'
import type { Prisma } from '@prisma/client'

export type OrigemAutor = 'USUARIO' | 'AUTOMACAO' | 'INTEGRACAO' | 'MIGRACAO' | 'SISTEMA'
export interface Autor { origem: OrigemAutor; id?: string | null; papel?: string | null; nome?: string | null }

const contexto = new AsyncLocalStorage<Autor>()

/** Roda `fn` com este autor (o que for escrito dentro dela leva o nome dele). */
export function comAutor<T>(autor: Autor, fn: () => T): T {
  return contexto.run(autor, fn)
}
export const autorAtual = (): Autor => contexto.getStore() ?? { origem: 'SISTEMA' }

let marca = 0
export function carimbo(autor = autorAtual()) {
  marca = (marca + 1) % 1_000_000
  const limpo = (s?: string | null) => (s ?? '').replace(/\|/g, '/')
  return `${autor.origem}|${limpo(autor.id)}|${limpo(autor.papel)}|${Date.now().toString(36)}${marca.toString(36)}`
}

// Modelos do Prisma com gatilho de auditoria no banco.
export const MODELOS_AUDITADOS = new Set([
  'Cliente', 'Lead', 'LeadFollow', 'LigacaoTarefa', 'AgendaItem', 'CopilotoSugestao',
  'AssistenteFichaCredito', 'AssistenteAnaliseCredito', 'LeadProposta', 'LeadVisita',
  'LeadPassagem', 'RodizioLead', 'Venda',
])

type Dados = Record<string, unknown>
const comCarimbo = (d: unknown, c: string): unknown =>
  Array.isArray(d) ? d.map(x => comCarimbo(x, c)) : d && typeof d === 'object' ? { ...(d as Dados), auditoriaAutor: c } : d

const comAutorDaEtapa = (d: unknown, a: Autor): unknown =>
  Array.isArray(d) ? d.map(x => comAutorDaEtapa(x, a)) : d && typeof d === 'object'
    ? { autorOrigem: (d as Dados).origem === 'ASSISTENTE' ? 'AUTOMACAO' : a.origem, autorId: a.id ?? null, autorNome: a.nome ?? null, ...(d as Dados) }
    : d

/** Middleware do Prisma: põe o autor em toda criação e alteração dos modelos auditados. */
export const middlewareAutor: Prisma.Middleware = async (params, next) => {
  // Histórico de etapas: cada entrada guarda quem moveu (o banco fecha a anterior).
  if (params.model === 'LeadEstagioHistorico' && (params.action === 'create' || params.action === 'createMany')) {
    const a = params.args as Dados | undefined
    if (a?.data) a.data = comAutorDaEtapa(a.data, autorAtual())
  }
  if (params.model && MODELOS_AUDITADOS.has(params.model)) {
    const c = carimbo()
    const a = params.args as Dados | undefined
    if (a) {
      if (['create', 'update', 'updateMany', 'createMany'].includes(params.action) && a.data) a.data = comCarimbo(a.data, c)
      if (params.action === 'upsert') { a.create = comCarimbo(a.create, c); a.update = comCarimbo(a.update, c) }
    }
  }
  return next(params)
}
