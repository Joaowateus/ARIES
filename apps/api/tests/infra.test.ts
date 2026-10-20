import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Prisma } from '@prisma/client'
import { madrugada, pularHora, pularMinuto, vezDoMinuto } from '../src/lib/cronEconomia'
import { bancoIndisponivel, motivoDoBanco } from '../src/lib/bancoDisponivel'

// 2026-10-20 15:00 em Brasília = 18:00 UTC.
const em = (hhmm: string, dia = '2026-10-20') => new Date(`${dia}T${hhmm}:00-03:00`)

test('madrugada vai de 0h até 6h de Brasília', () => {
  assert.equal(madrugada(em('00:10')), true)
  assert.equal(madrugada(em('05:59')), true)
  assert.equal(madrugada(em('06:00')), false)
  assert.equal(madrugada(em('23:55')), false)
})

test('job de minuto roda 1 vez a cada 15 min com o cron de 5 em 5', () => {
  const rodadas = ['15:00', '15:05', '15:10', '15:15', '15:20', '15:25', '15:30', '15:35', '15:40', '15:45', '15:50', '15:55'].filter(h => vezDoMinuto(em(h), 15))
  assert.deepEqual(rodadas, ['15:00', '15:15', '15:30', '15:45'])
  assert.equal(['15:00', '15:05', '15:10'].every(h => vezDoMinuto(em(h), 5)), true)
  assert.deepEqual(['15:00', '15:10', '15:20', '15:30'].filter(h => vezDoMinuto(em(h), 30)), ['15:00', '15:30'])
})

test('economia só vale em produção e desliga com CRON_ECONOMIA=0', () => {
  const env = { ...process.env }
  try {
    process.env.NODE_ENV = 'development'
    assert.equal(pularMinuto(em('03:00')), null)
    process.env.NODE_ENV = 'production'
    assert.equal(pularMinuto(em('03:00')), 'madrugada')
    assert.equal(pularHora(em('03:00')), 'madrugada')
    assert.equal(pularHora(em('09:00')), null)
    assert.equal(pularMinuto(em('09:05')), 'intervalo')
    assert.equal(pularMinuto(em('09:15')), null)
    process.env.CRON_ECONOMIA = '0'
    assert.equal(pularMinuto(em('03:00')), null)
  } finally { process.env = env }
})

test('reconhece banco fora do ar e dá o motivo sem dados sensíveis', () => {
  const quota = new Prisma.PrismaClientInitializationError('Your project has exceeded the compute time quota. Upgrade your plan to increase limits.', '5.22.0')
  assert.equal(bancoIndisponivel(quota), true)
  assert.match(motivoDoBanco(quota), /Cota mensal/)
  assert.equal(bancoIndisponivel(Object.assign(new Error("Can't reach database server at `ep-x.neon.tech:5432`"), { code: 'P1001' })), true)
  assert.equal(motivoDoBanco(new Error("Can't reach database server at `ep-x.neon.tech:5432`")).includes('neon.tech'), false)
  assert.equal(bancoIndisponivel(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })), false)
  assert.equal(bancoIndisponivel(new Error('Falha qualquer')), false)
  assert.equal(bancoIndisponivel(null), false)
})

test('nível do banco: alerta a partir de 400 MB e crítico a partir de 95% de 500 MB', async () => {
  const { nivelDoBanco, tamanhoDoBanco, limparCacheDoBanco } = await import('../src/lib/bancoDisponivel')
  assert.equal(nivelDoBanco(120, 500, 400), 'OK')
  assert.equal(nivelDoBanco(400, 500, 400), 'ALERTA')
  assert.equal(nivelDoBanco(474.9, 500, 400), 'ALERTA')
  assert.equal(nivelDoBanco(475, 500, 400), 'CRITICO')
  limparCacheDoBanco()
  let consultas = 0
  const medir = async () => { consultas++; return 412 * 1024 * 1024 }
  const r1 = await tamanhoDoBanco(medir, 1_000_000)
  assert.equal(r1.usadoMB, 412)
  assert.equal(r1.nivel, 'ALERTA')
  await tamanhoDoBanco(medir, 1_000_000 + 5 * 60_000)
  assert.equal(consultas, 1, 'a medida fica guardada por 10 minutos')
  await tamanhoDoBanco(medir, 1_000_000 + 11 * 60_000)
  assert.equal(consultas, 2)
  limparCacheDoBanco()
})
