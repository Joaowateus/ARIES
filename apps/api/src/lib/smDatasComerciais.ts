// Datas comerciais que pedem conteúdo numa loja de motos. Fixas e móveis
// (Dias das Mães e dos Pais no 2º domingo; Black Friday na sexta depois
// da 4ª quinta de novembro). Base da pergunta "Quais datas comerciais vêm
// aí?" e do planejamento mensal da Fase 6.
const DIA_MS = 864e5

interface DataComercial { nome: string; dica: string; data: (ano: number) => string }

const iso = (ano: number, mes: number, dia: number) => `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
/** n-ésimo dia da semana (0 = domingo) do mês. */
function enesimo(ano: number, mes: number, semana: number, n: number): number {
  const primeiro = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay()
  return 1 + ((semana - primeiro + 7) % 7) + (n - 1) * 7
}

const DATAS: DataComercial[] = [
  { nome: 'Dia do Consumidor', dica: 'condição especial e prova social de clientes', data: a => iso(a, 3, 15) },
  { nome: 'Dia do Trabalhador', dica: 'a moto como ferramenta de trabalho', data: a => iso(a, 5, 1) },
  { nome: 'Dia das Mães', dica: 'entregas para mães e histórias de clientes', data: a => iso(a, 5, enesimo(a, 5, 0, 2)) },
  { nome: 'Dia do Motociclista', dica: 'a data mais nossa: comunidade, passeio e bastidores', data: a => iso(a, 7, 27) },
  { nome: 'Dia dos Pais', dica: 'pai e filho na garupa, entregas de presente', data: a => iso(a, 8, enesimo(a, 8, 0, 2)) },
  { nome: 'Dia do Cliente', dica: 'agradecimento e depoimentos', data: a => iso(a, 9, 15) },
  { nome: 'Dia das Crianças', dica: 'segurança e a família na moto', data: a => iso(a, 10, 12) },
  { nome: 'Black Friday', dica: 'estoque em destaque e chamadas para o direct', data: a => iso(a, 11, enesimo(a, 11, 4, 4) + 1) },
  { nome: 'Natal', dica: 'moto de presente e fim de ano na loja', data: a => iso(a, 12, 25) },
  { nome: 'Ano Novo', dica: 'metas do ano novo: a primeira moto', data: a => iso(a + 1, 1, 1) },
]

/** Próximas datas a partir de hoje (AAAA-MM-DD), dentro do horizonte em dias. */
export function proximasDatasComerciais(hoje: string, horizonteDias = 60) {
  const ano = Number(hoje.slice(0, 4))
  const t0 = Date.parse(`${hoje}T12:00:00Z`)
  return [ano - 1, ano]
    .flatMap(a => DATAS.map(d => ({ nome: d.nome, dica: d.dica, data: d.data(a) })))
    .map(d => ({ ...d, emDias: Math.round((Date.parse(`${d.data}T12:00:00Z`) - t0) / DIA_MS) }))
    .filter(d => d.emDias >= 0 && d.emDias <= horizonteDias)
    .sort((a, b) => a.emDias - b.emDias)
}

/** Datas comerciais de um mês (AAAA-MM), na ordem: base do planejamento do dia 25 e das marcas do Calendário. */
export function datasComerciaisDoMes(mes: string) {
  const ano = Number(mes.slice(0, 4))
  return [ano - 1, ano]
    .flatMap(a => DATAS.map(d => ({ nome: d.nome, dica: d.dica, data: d.data(a) })))
    .filter(d => d.data.startsWith(mes))
    .sort((a, b) => a.data.localeCompare(b.data))
}

/** Datas comerciais entre dois dias (AAAA-MM-DD, inclusive). */
export function datasComerciaisEntre(de: string, ate: string) {
  const anos = new Set([Number(de.slice(0, 4)), Number(ate.slice(0, 4))])
  return [...anos].flatMap(a => [a - 1, a]).filter((a, i, l) => l.indexOf(a) === i)
    .flatMap(a => DATAS.map(d => ({ nome: d.nome, dica: d.dica, data: d.data(a) })))
    .filter(d => d.data >= de && d.data <= ate)
    .sort((a, b) => a.data.localeCompare(b.data))
}
