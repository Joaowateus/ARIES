// Painel pessoal (23/11/2026): todos voltam a ter o Painel. Quem não é da gestão lê só o topo da
// própria produção pela rota /pro-labore/painel-dono; dono e supervisor continuam vendo a equipe.
// Roda num banco de teste (DATABASE_URL); sem banco, é pulado. Cria uma loja nova e não toca em outras.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'crypto'
import type { AddressInfo } from 'net'
import type { Server } from 'http'
import { prisma } from '../src/lib/prisma'
import { signProLaboreToken } from '../src/lib/jwtProLabore'
import app from '../src/app'

let temBanco = false
let servidor: Server
let base = ''
const loja = { id: '', ana: '', bruno: '', sara: '' }

before(async () => {
  try { await prisma.$queryRaw`SELECT 1`; temBanco = true } catch { return }
  const u = await prisma.proLaboreUsuario.create({ data: { nome: 'Loja Painel', email: `painel-${randomUUID()}@teste.local`, senhaHash: 'x' } })
  loja.id = u.id
  const cria = (nome: string, papel: string) => prisma.vendedor.create({ data: { usuarioId: u.id, nome, papel, email: `${randomUUID()}@teste.local`, senhaHash: 'x' } })
  const [a, b, s] = await Promise.all([cria('Ana Vendedora', 'VENDEDOR'), cria('Bruno Vendedor', 'VENDEDOR'), cria('Sara SDR', 'SDR')])
  loja.ana = a.id; loja.bruno = b.id; loja.sara = s.id
  const hoje = new Date()
  // A Jornada conta pelo histórico de etapas: cada lead entra em LEAD hoje.
  const leads: Array<[string, string]> = [[a.id, 'Cliente da Ana 1'], [a.id, 'Cliente da Ana 2'], [b.id, 'Cliente do Bruno 1'], [b.id, 'Cliente do Bruno 2'], [b.id, 'Cliente do Bruno 3']]
  for (const [vendedorId, nomeCliente] of leads) {
    await prisma.lead.create({ data: { usuarioId: u.id, vendedorId, nomeCliente, etapa: 'LEAD', criadoEm: hoje, historico: { create: { estagioNovo: 'LEAD', criadoEm: hoje } } } })
  }
  servidor = app.listen(0)
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`
})
after(() => { servidor?.close() })

const token = (vendedorId: string | null) => signProLaboreToken(vendedorId ? { sub: loja.id, email: 'x@teste.local', nome: 'Teste', papel: 'VENDEDOR', vendedorId } : { sub: loja.id, email: 'dono@teste.local', nome: 'Dono', papel: 'DONO' })
async function painelDe(vendedorId: string | null, extra = '') {
  const r = await fetch(`${base}/pro-labore/painel-dono?parte=TOPO${extra}`, { headers: { Authorization: `Bearer ${token(vendedorId)}` } })
  return { status: r.status, corpo: await r.json() as { jornada?: { etapas?: Array<{ etapa: string; volume: number; custo: unknown; valores: unknown }> }; agora?: { custoPorVenda: unknown } } }
}
const volumeLead = (c: Awaited<ReturnType<typeof painelDe>>['corpo']) => c.jornada?.etapas?.find(e => e.etapa === 'LEAD')?.volume ?? -1

test('vendedora abre o próprio Painel e vê só a própria produção, sem custos nem valores do dono', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const ana = await painelDe(loja.ana)
  assert.equal(ana.status, 200, JSON.stringify(ana.corpo).slice(0, 200))
  const dono = await painelDe(null)
  assert.equal(dono.status, 200)
  assert.equal(volumeLead(dono.corpo), 5, `dono vê a loja: ${volumeLead(dono.corpo)}`)
  assert.equal(volumeLead(ana.corpo), 2, 'Ana vê só os 2 leads dela')
  // Tentar ver o Bruno pelo filtro não muda nada: o servidor força o próprio vendedor.
  const tentativa = await painelDe(loja.ana, `&vendedorId=${loja.bruno}`)
  assert.equal(volumeLead(tentativa.corpo), volumeLead(ana.corpo))
  assert.equal(ana.corpo.agora?.custoPorVenda ?? null, null)
  assert.ok(ana.corpo.jornada!.etapas!.every(e => e.custo === null && e.valores === null), 'sem custo e valores por etapa')
})

test('SDR abre o Painel pelo que qualifica; dono continua vendo a equipe', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  assert.equal((await painelDe(loja.sara)).status, 200)
  const filtrado = await painelDe(null, `&vendedorId=${loja.bruno}`)
  assert.equal(filtrado.status, 200)
})
