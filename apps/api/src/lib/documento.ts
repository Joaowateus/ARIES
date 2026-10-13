// CPF ou CNPJ de quem recebe (vendedor, funcionário, prestador): valida os
// dígitos verificadores e guarda já formatado, do jeito que sai nos recibos,
// comprovantes e documentos de ocorrência.

const soDigitos = (t: string) => t.replace(/\D/g, '')

function cpfValido(d: string) {
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const dv = (n: number) => {
    let s = 0
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i)
    const r = (s * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10])
}

function cnpjValido(d: string) {
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false
  const dv = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const s = pesos.reduce((acc, p, i) => acc + Number(d[i]) * p, 0)
    const r = s % 11
    return r < 2 ? 0 : 11 - r
  }
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13])
}

export type ResultadoDocumento = { ok: true; valor: string | null } | { ok: false; erro: string }

/** Vazio = sem documento (null). Senão, CPF (11 dígitos) ou CNPJ (14) válido, formatado. */
export function normalizarDocumento(entrada: string | null | undefined): ResultadoDocumento {
  const d = soDigitos(entrada ?? '')
  if (!d) return { ok: true, valor: null }
  if (d.length === 11) {
    return cpfValido(d) ? { ok: true, valor: `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` } : { ok: false, erro: 'CPF inválido: confira os números' }
  }
  if (d.length === 14) {
    return cnpjValido(d) ? { ok: true, valor: `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` } : { ok: false, erro: 'CNPJ inválido: confira os números' }
  }
  return { ok: false, erro: 'Informe um CPF (11 dígitos) ou um CNPJ (14 dígitos)' }
}
