import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contarFollows, fimDoDiaBR, situacaoDoFollow } from '../src/lib/contagemFollows'

// 2026-11-19 15:00 em Brasília = 18:00 UTC.
const em = (hhmm: string, dia = '2026-11-19') => new Date(`${dia}T${hhmm}:00-03:00`)
const agora = em('15:00')

test('fim do dia é meia-noite de Brasília', () => {
  assert.equal(fimDoDiaBR(agora).toISOString(), '2026-11-20T03:00:00.000Z')
  assert.equal(fimDoDiaBR(em('23:59')).toISOString(), '2026-11-20T03:00:00.000Z')
  assert.equal(fimDoDiaBR(em('00:01')).toISOString(), '2026-11-20T03:00:00.000Z')
})

test('atrasado = antes de agora; hoje = ainda hoje e não vencido; o resto é futuro', () => {
  assert.equal(situacaoDoFollow(em('09:00', '2026-11-17'), agora), 'ATRASADO')
  assert.equal(situacaoDoFollow(em('14:59'), agora), 'ATRASADO')
  assert.equal(situacaoDoFollow(em('15:01'), agora), 'HOJE')
  assert.equal(situacaoDoFollow(em('23:59'), agora), 'HOJE')
  assert.equal(situacaoDoFollow(em('00:00', '2026-11-20'), agora), 'FUTURO')
})

test('contarFollows soma hoje e atrasados sem contar o futuro', () => {
  const fs = ['08:00', '14:00', '16:00', '22:00'].map(h => ({ agendadoPara: em(h) })).concat([{ agendadoPara: em('10:00', '2026-11-21') }, { agendadoPara: em('10:00', '2026-11-10') }])
  assert.deepEqual(contarFollows(fs, agora), { hoje: 2, atrasados: 3 })
  assert.deepEqual(contarFollows([], agora), { hoje: 0, atrasados: 0 })
})

import { PERFIS_CLIENTE, perfilClienteSchema } from '../src/lib/perfilCliente'

test('perfil do cliente aceita os 4 tipos, null para limpar e ausente para não mexer', () => {
  for (const p of PERFIS_CLIENTE) assert.equal(perfilClienteSchema.parse(p), p)
  assert.equal(perfilClienteSchema.parse(null), null)
  assert.equal(perfilClienteSchema.parse(undefined), undefined)
})

test('perfil do cliente recusa valor fora da lista', () => {
  for (const v of ['CALMO', 'indeciso', '', 3]) assert.equal(perfilClienteSchema.safeParse(v).success, false)
})
