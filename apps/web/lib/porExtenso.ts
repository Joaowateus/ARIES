// Valor em reais por extenso, do jeito que vai num recibo:
// 1500.5 → "mil e quinhentos reais e cinquenta centavos".
const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

// 0–999
function ate999(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cem'
  const c = Math.floor(n / 100), r = n % 100
  const partes: string[] = []
  if (c) partes.push(CENTENAS[c])
  if (r) {
    if (r < 20) partes.push(UNIDADES[r])
    else {
      const d = Math.floor(r / 10), u = r % 10
      partes.push(u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d])
    }
  }
  return partes.join(' e ')
}

const ESCALAS: Array<[string, string]> = [['', ''], ['mil', 'mil'], ['milhão', 'milhões'], ['bilhão', 'bilhões']]

function inteiroPorExtenso(n: number): string {
  if (n === 0) return 'zero'
  const grupos: number[] = []
  while (n > 0) { grupos.push(n % 1000); n = Math.floor(n / 1000) }
  const partes: Array<{ texto: string; valor: number }> = []
  for (let i = grupos.length - 1; i >= 0; i--) {
    const g = grupos[i]
    if (!g) continue
    let texto: string
    if (i === 0) texto = ate999(g)
    else if (i === 1) texto = g === 1 ? 'mil' : `${ate999(g)} mil`
    else texto = `${ate999(g)} ${g === 1 ? ESCALAS[i][0] : ESCALAS[i][1]}`
    partes.push({ texto, valor: g })
  }
  // "e" antes do último grupo quando ele é menor que 100 ou centena redonda
  // (mil e quinhentos, dois mil e vinte); senão, vírgula/espaço.
  return partes.map((p, i) => {
    if (i === 0) return p.texto
    const ultimo = i === partes.length - 1
    return (ultimo && (p.valor < 100 || p.valor % 100 === 0) ? ' e ' : ' ') + p.texto
  }).join('')
}

export function reaisPorExtenso(valor: number): string {
  const centavosTotais = Math.round(Math.abs(valor) * 100)
  const reais = Math.floor(centavosTotais / 100)
  const centavos = centavosTotais % 100
  const partes: string[] = []
  if (reais > 0) {
    // "um milhão de reais", "dois mil reais"
    const texto = inteiroPorExtenso(reais)
    const de = reais % 1_000_000 === 0 ? ' de' : ''
    partes.push(`${texto}${de} ${reais === 1 ? 'real' : 'reais'}`)
  }
  if (centavos > 0) partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`)
  return partes.length ? partes.join(' e ') : 'zero real'
}
