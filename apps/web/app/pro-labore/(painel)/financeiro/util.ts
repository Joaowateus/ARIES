// Utilidades do Financeiro (tela, formulários e recibo).
import type { FormaPagamentoFinanceiro } from '@/lib/proLaboreApi'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export const ROTULO_FORMA: Record<FormaPagamentoFinanceiro, string> = {
  PIX: 'Pix', DINHEIRO: 'Dinheiro', TRANSFERENCIA: 'Transferência', BOLETO: 'Boleto', CARTAO: 'Cartão', OUTRO: 'Outro',
}

/** "2026-10" → "outubro de 2026" */
export const mesExtenso = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`
/** Datas ISO lidas direto da string, sem trocar de dia pelo fuso do navegador. */
export const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
export const dataLonga = (iso: string) => `${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`

export function hojeLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const mesAtualLocal = () => hojeLocal().slice(0, 7)
export function somarMes(mes: string, n: number) {
  const d = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1 + n, 1))
  return d.toISOString().slice(0, 7)
}

export function abrirRecibo(id: string) {
  window.open(`/pro-labore/recibo/${id}`, '_blank', 'noopener')
}

/** Valor digitado ("1.234,56" ou "1234.56") → número. */
export function lerValor(texto: string): number {
  const t = texto.trim().replace(/\s|R\$/g, '')
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t)
  return Number.isFinite(n) ? n : 0
}
