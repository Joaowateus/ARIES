// CPF e data de nascimento (PDF 01, seção 5): mascarados em todo o sistema e
// nunca enviados à IA. Completos só dentro da ficha de crédito dos próprios
// leads, e cada acesso fica registrado (tabela imutável).
import { prisma } from './prisma'

export function mascararCpf(v: string) {
  const d = v.replace(/\D/g, '')
  return d.length >= 2 ? `***.***.***-${d.slice(-2)}` : '***'
}
export const mascararNascimento = (v: string) => (v ? '**/**/****' : v)
const MASCARADO = /\*/

/** Substitui no JSON de toda resposta da API os campos de CPF e nascimento. */
export function mascararResposta(chave: string, valor: unknown) {
  if (typeof valor !== 'string' || !valor) return valor
  if (chave === 'cpf') return mascararCpf(valor)
  if (chave === 'nascimento') return mascararNascimento(valor)
  return valor
}
/** Valor que voltou mascarado de uma tela não pode sobrescrever o verdadeiro. */
export const ehMascarado = (v: string | null | undefined) => !!v && MASCARADO.test(v)

export async function registrarAcesso(a: { usuarioId: string; leadId?: string | null; fichaId?: string | null; dados: Array<'CPF' | 'NASCIMENTO'>; quemId: string; quemNome?: string | null; quemPapel?: string | null }) {
  await prisma.acessoDadoSensivel.createMany({ data: a.dados.map(dado => ({ usuarioId: a.usuarioId, leadId: a.leadId ?? null, fichaId: a.fichaId ?? null, dado, quemId: a.quemId, quemNome: a.quemNome ?? null, quemPapel: a.quemPapel ?? null })) })
}
