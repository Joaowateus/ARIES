// Modelo da IA para o sistema inteiro (Social Media e Copiloto Comercial).
// Padrão: Claude Haiku 4.5, o mais barato da Anthropic (US$ 1 / US$ 5 por
// milhão de tokens de entrada / saída), que cobre o que o sistema pede:
// textos curtos sobre números prontos e saída estruturada (JSON validado).
// Para trocar sem mexer no código: IA_MODELO na Vercel (ou SM_IA_MODELO /
// COPILOTO_IA_MODELO para trocar só uma das partes), por exemplo
// claude-sonnet-5-5 (melhor e mais caro) ou claude-opus-5-5.
import type Anthropic from '@anthropic-ai/sdk'

export const MODELO_PADRAO = 'claude-haiku-4-5'

export function modeloDa(parte: 'SM' | 'COPILOTO'): string {
  const especifico = parte === 'SM' ? process.env.SM_IA_MODELO : process.env.COPILOTO_IA_MODELO
  return especifico?.trim() || process.env.IA_MODELO?.trim() || MODELO_PADRAO
}

// Os modelos Haiku e os da geração 4.5 e anteriores não têm o parâmetro de
// esforço nem a busca na web com filtro dinâmico (só a versão básica).
const GERACAO_ANTIGA = /haiku|claude-(opus|sonnet)-4-(0|1|5)\b|claude-3/

/** Esforço baixo onde o modelo aceita (pouco raciocínio: só redigir sobre fatos prontos). */
export function esforco(modelo: string): { effort?: 'low' } {
  return GERACAO_ANTIGA.test(modelo) ? {} : { effort: 'low' }
}

/** `output_config` só com o esforço, ou nada (sem campo vazio) quando o modelo não tem o parâmetro. */
export function saidaSimples(modelo: string): { output_config?: { effort: 'low' } } {
  return GERACAO_ANTIGA.test(modelo) ? {} : { output_config: { effort: 'low' } }
}

/** Ferramenta de busca na web na versão que o modelo aceita. */
export function ferramentaBusca(modelo: string): Anthropic.ToolUnion {
  const local = { type: 'approximate' as const, country: 'BR' }
  return GERACAO_ANTIGA.test(modelo)
    ? { type: 'web_search_20250305', name: 'web_search', max_uses: 3, user_location: local }
    : { type: 'web_search_20260209', name: 'web_search', max_uses: 3, allowed_callers: ['direct'], user_location: local }
}
