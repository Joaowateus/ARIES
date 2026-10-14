// Testes das fórmulas da Central de Inteligência (npm run test:intel).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  atingimento, calendario, cenario, conversaoEtapa, conversaoTotal, cpl, cplMaximo, criteriosDe, custoAcumuladoPorEtapa, custoPorVenda,
  diasUteisDoMes, faturamentoProjetado, impactoDaPassagem, leadsNecessarios, margemContribuicao, metaVendas, perda, projetarMes, razao,
  ritmoNecessario, roas, severidadeDeConversao, CRITERIOS_PADRAO,
} from '../src/lib/intelMotor'

const perto = (a: number | null, b: number, tol = 1e-6) => assert.ok(a != null && Math.abs(a - b) <= tol, `${a} ≠ ${b}`)

test('9.1 meta de vendas: 500.000 ÷ 20.000 = 25 (para cima quando não é exato)', () => {
  assert.equal(metaVendas(500000, 20000), 25)
  assert.equal(metaVendas(510000, 20000), 26)
  assert.equal(metaVendas(500000, 0), null)
})

test('divisão por zero e dado ausente viram null, nunca Infinity/NaN/0', () => {
  assert.equal(razao(5, 0), null)
  assert.equal(razao(null, 5), null)
  assert.equal(razao(5, undefined), null)
  assert.equal(conversaoEtapa(10, 0), null)
  assert.equal(cpl(1000, 0), null)
  assert.equal(custoPorVenda(8000, 0), null)
  assert.equal(conversaoTotal([0.9, null, 0.25, 0.2]), null)
})

test('9.2 conversão de etapa do funil de setembro', () => {
  perto(conversaoEtapa(489, 635), 0.77007874)
  perto(conversaoEtapa(308, 489), 0.62985685)
  perto(conversaoEtapa(57, 308), 0.18506494)
  perto(conversaoEtapa(9, 57), 0.15789474)
})

test('9.3 conversão total observada de setembro ≈ 1,42%', () => {
  const t = conversaoTotal([489 / 635, 308 / 489, 57 / 308, 9 / 57])
  perto(t, 9 / 635)
  perto((t as number) * 100, 1.4173228, 1e-6)
})

test('10. metas gerenciais: 90% × 70% × 25% × 20% = 3,15%; 794 leads; CPL máx ≈ R$ 10,08', () => {
  const t = conversaoTotal([0.9, 0.7, 0.25, 0.2]) as number
  perto(t, 0.0315)
  assert.equal(leadsNecessarios(25, t), 794) // 793,65… para cima
  perto(cplMaximo(8000, 794), 10.0755668)
})

test('9.4 leads necessários arredonda para cima, e não erra quando é exato', () => {
  assert.equal(leadsNecessarios(25, 0.05), 500)
  assert.equal(leadsNecessarios(25, 9 / 635), 1764) // 1763,9 → 1764
  assert.equal(leadsNecessarios(25, 0), null)
})

test('9.7 custo de marketing por venda: 8.000 ÷ 25 = 320', () => {
  assert.equal(custoPorVenda(8000, 25), 320)
})

test('9.8 custo acumulado por etapa = investimento ÷ quem alcançou a etapa', () => {
  const c = custoAcumuladoPorEtapa(3651.25, { LEAD: 635, ABORDADO: 489, NEGOCIACAO: 308, PROPOSTA: 57, FECHADO: 0 })
  perto(c.LEAD, 5.75)
  perto(c.PROPOSTA, 64.0570175)
  assert.equal(c.FECHADO, null) // sem divisão por zero
})

test('9.9 perda entre etapas', () => {
  assert.deepEqual(perda(308, 57).absoluta, 251)
  perto(perda(308, 57).taxa, 251 / 308)
  assert.deepEqual(perda(null, 3), { absoluta: null, taxa: null })
})

test('9.10 / 9.11 / 9.13 / 9.14 faturamento, atingimento, ROAS e margem', () => {
  assert.equal(faturamentoProjetado(25, 20000), 500000)
  perto(atingimento(180000, 500000), 0.36)
  perto(roas(180000, 4000), 45)
  assert.equal(roas(180000, 0), null)
  assert.equal(margemContribuicao(100, 60), 40)
  assert.equal(margemContribuicao(null, 60), null)
})

test('calendário de dias úteis (seg a sáb) de outubro de 2026', () => {
  const uteis = diasUteisDoMes('2026-10', [1, 2, 3, 4, 5, 6])
  assert.equal(uteis.length, 27) // 31 dias − 4 domingos
  const cal = calendario('2026-10', '2026-10-14', [1, 2, 3, 4, 5, 6])
  assert.deepEqual(cal, { total: 27, decorridos: 12, restantes: 15 })
  assert.equal(diasUteisDoMes('2026-02', [1, 2, 3, 4, 5]).length, 20)
})

test('9.12 ritmo necessário', () => {
  const r = ritmoNecessario(25, 10, 15)
  assert.equal(r.falta, 15)
  assert.equal(r.porDia, 1)
  assert.deepEqual(ritmoNecessario(25, 30, 5), { falta: 0, porDia: 0 })
  assert.equal(ritmoNecessario(25, 10, 0).porDia, null) // sem dias restantes
})

test('projeção: cenários e dados insuficientes', () => {
  const p = projetarMes(10, { decorridos: 12, restantes: 15 }, { vendas: 3, diasUteis: 12 })
  assert.ok(p.suficiente)
  perto(p.base, 22.5, 0.05)
  perto(p.conservador, 13.8, 0.05) // ritmo recente 0,25/dia
  perto(p.otimista, 22.5, 0.05)
  assert.ok((p.conservador as number) <= (p.base as number) && (p.base as number) <= (p.otimista as number))
  assert.equal(projetarMes(1, { decorridos: 2, restantes: 25 }, { vendas: 1, diasUteis: 12 }).suficiente, false)
  assert.equal(projetarMes(0, { decorridos: 10, restantes: 17 }, { vendas: 0, diasUteis: 12 }).suficiente, false)
})

test('cenário de planejamento: volumes, vendas esperadas e custos', () => {
  const c = cenario('Metas', [0.9, 0.7, 0.25, 0.2], 25, 8000, 20000)
  assert.equal(c.leadsNecessarios, 794)
  assert.equal(c.volumes.LEAD, 794)
  perto(c.volumes.ABORDADO, 714.6, 0.05)
  perto(c.vendasEsperadas, 25, 0.05)
  perto(c.cplMaximo, 10.0755668)
  perto(c.faturamentoProjetado, 500000, 1000)
  const atual = cenario('Atual', [489 / 635, 308 / 489, 57 / 308, 9 / 57], 25, 8000, 20000)
  assert.equal(atual.leadsNecessarios, 1764)
  perto(atual.cplMaximo, 8000 / 1764)
})

test('impacto do gargalo: elegíveis × (meta − atual) × conversões seguintes', () => {
  const atuais = [489 / 635, 308 / 489, 57 / 308, 9 / 57]
  const metas = [0.9, 0.7, 0.25, 0.2]
  perto(impactoDaPassagem(2, 308, atuais, metas), 308 * (0.25 - 57 / 308) * (9 / 57))
  assert.equal(impactoDaPassagem(0, 635, [0.95, ...atuais.slice(1)], metas), 0) // acima da meta: sem impacto
  assert.equal(impactoDaPassagem(1, 489, [0.77, 0.6, null, 0.15], metas), null) // falta dado depois: não estima
})

test('severidade segue os critérios configurados', () => {
  const c = CRITERIOS_PADRAO
  assert.equal(severidadeDeConversao(18.5, 25, 308, 1.0, 25, c), 'MODERADO') // 6,5 p.p.
  assert.equal(severidadeDeConversao(10, 25, 308, 1.0, 25, c), 'ALTO')
  assert.equal(severidadeDeConversao(10, 25, 308, 6, 25, c), 'CRITICO') // recupera 24% da meta
  assert.equal(severidadeDeConversao(10, 25, 12, 6, 25, c), 'MONITORAMENTO') // amostra pequena
  assert.equal(severidadeDeConversao(30, 25, 308, 0, 25, c), null) // acima da meta
  const custom = criteriosDe({ desvioModeradoPP: 7, amostraMinima: -3, inventado: 9 })
  assert.equal(custom.desvioModeradoPP, 7)
  assert.equal(custom.amostraMinima, 30) // negativo ignorado
  assert.equal(severidadeDeConversao(18.5, 25, 308, 1, 25, custom), 'MONITORAMENTO')
})
