// Reparo da conexão do WhatsApp (caso real: servidor diz "open", sessão morta, todo envio "Connection
// Closed", "Conectar" não gerava QR e "Desconectar" travava no logout). Servidor Evolution simulado.
import http from 'http'
import type { AddressInfo } from 'net'
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'crypto'
import type { Server } from 'http'
import { prisma } from '../src/lib/prisma'
import { signProLaboreToken } from '../src/lib/jwtProLabore'
import { repararConexao } from '../src/lib/assistenteReparo'
import { diagnosticarAssistentes } from '../src/lib/assistenteDiagnostico'
import { removerInstancia } from '../src/lib/whatsappEvolution'
import app from '../src/app'

// ---------- Evolution falsa ----------
const ev = { existe: true, estado: 'open', morta: true, restartConserta: false, chamadas: [] as string[] }
const falso = http.createServer((req, res) => {
  const u = new URL(req.url!, 'http://x')
  ev.chamadas.push(`${req.method} ${u.pathname}`)
  const json = (s: number, j: unknown) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(j)) }
  req.resume()
  req.on('end', () => {
    if (u.pathname.startsWith('/instance/connectionState/')) return ev.existe ? json(200, { instance: { state: ev.estado } }) : json(404, { response: { message: ['not found'] } })
    if (u.pathname.startsWith('/chat/whatsappNumbers/')) return ev.morta ? json(500, { response: { message: ['Error: Connection Closed'] } }) : json(200, [{ exists: true }])
    if (u.pathname.startsWith('/instance/restart/')) { if (ev.restartConserta) ev.morta = false; return json(200, { ok: true }) }
    if (u.pathname.startsWith('/instance/logout/')) return ev.morta ? json(500, { response: { message: ['Error: Connection Closed'] } }) : json(200, {})
    if (u.pathname.startsWith('/instance/delete/')) { ev.existe = false; return json(200, {}) }
    if (u.pathname === '/instance/create') { ev.existe = true; ev.estado = 'connecting'; ev.morta = false; return json(201, {}) }
    if (u.pathname.startsWith('/instance/connect/')) return json(200, { base64: 'QRFALSO', pairingCode: null })
    if (u.pathname.startsWith('/webhook/set/')) return json(200, {})
    if (u.pathname.startsWith('/webhook/find/')) return json(200, { url: 'https://x/pro-labore/assistente/webhook/s', enabled: true, events: ['MESSAGES_UPSERT'] })
    json(404, { response: { message: [`rota ausente ${u.pathname}`] } })
  })
})

let temBanco = false
let servidor: Server
let base = ''
const loja = { id: '', vendedor: '', assistente: '' }
const reset = (x: Partial<typeof ev>) => Object.assign(ev, { existe: true, estado: 'open', morta: true, restartConserta: false, chamadas: [] }, x)

before(async () => {
  try { await prisma.$queryRaw`SELECT 1`; temBanco = true } catch { return }
  await new Promise<void>(ok => falso.listen(0, '127.0.0.1', () => ok()))
  process.env.EVOLUTION_API_URL = `http://127.0.0.1:${(falso.address() as AddressInfo).port}`
  process.env.EVOLUTION_API_KEY = 'chave'
  const u = await prisma.proLaboreUsuario.create({ data: { nome: 'Loja Reparo', email: `reparo-${randomUUID()}@t.local`, senhaHash: 'x' } })
  loja.id = u.id
  const v = await prisma.vendedor.create({ data: { usuarioId: u.id, nome: 'Naiza Reparo', papel: 'VENDEDOR' } })
  loja.vendedor = v.id
  loja.assistente = (await prisma.assistenteComercial.create({ data: { vendedorId: v.id, instancia: `aries-${v.id}`, webhookSegredo: randomUUID(), status: 'CONECTADO', numeroWhatsapp: '5591980713982' } })).id
  servidor = app.listen(0)
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`
})
after(() => { servidor?.close(); falso.close(); delete process.env.EVOLUTION_API_URL; delete process.env.EVOLUTION_API_KEY })
const tok = () => signProLaboreToken({ sub: loja.id, email: 'd@t.local', nome: 'Dono', papel: 'DONO' })
const api = async (m: string, c: string, b?: unknown) => { const r = await fetch(`${base}/pro-labore${c}`, { method: m, headers: { Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, corpo: await r.json().catch(() => null) as Record<string, unknown> } }

test('diagnóstico e card enxergam a sessão morta mesmo com o servidor dizendo "open"', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  reset({})
  const d = await diagnosticarAssistentes(loja.id, s => `https://x/pro-labore/assistente/webhook/${s}`)
  const a = d.assistentes.find(x => x.assistenteId === loja.assistente)!
  assert.equal(a.aoVivo.estado, 'sessao_caida')
  assert.ok(a.problemas.some(p => /caiu por baixo/.test(p.texto) && /Reparar conexão/.test(p.acao ?? '')))
  assert.equal((await api('GET', `/assistente/saude?vendedorId=${loja.vendedor}`)).corpo.viva, false)
})

test('reparar: reiniciar resolve → conectado, sem QR', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  reset({ restartConserta: true })
  const r = await repararConexao(loja.assistente, 'https://x/w')
  assert.equal(r.status, 'CONECTADO')
  assert.ok(ev.chamadas.some(c => c.startsWith('POST /instance/restart/')))
  assert.ok(!ev.chamadas.some(c => c.includes('/instance/delete/')), 'não apagou a sessão')
})

test('reparar: reiniciar não resolve → pede QR; QR novo mesmo com o logout falhando (Connection Closed)', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  reset({ restartConserta: false })
  const r = await api('POST', '/assistente/reparar', { vendedorId: loja.vendedor })
  assert.equal(r.status, 200)
  assert.equal(r.corpo.status, 'SESSAO_CAIDA')
  const qr = await api('POST', '/assistente/reparar', { vendedorId: loja.vendedor, gerarQr: true })
  assert.equal(qr.corpo.status, 'AGUARDANDO_QR', JSON.stringify(qr.corpo))
  assert.match(String(qr.corpo.qrBase64), /QRFALSO/)
  const a = await prisma.assistenteComercial.findUnique({ where: { id: loja.assistente } })
  assert.equal(a?.status, 'AGUARDANDO_QR')
  assert.equal(a?.numeroWhatsapp, '5591980713982', 'nada do cadastro foi apagado')
})

test('"Conectar" com sessão morta gera QR (antes respondia "conectado"); "Desconectar" não trava no logout', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  reset({})
  await prisma.assistenteComercial.update({ where: { id: loja.assistente }, data: { status: 'CONECTADO' } })
  const r = await api('POST', '/assistente/conectar', { vendedorId: loja.vendedor })
  assert.equal(r.corpo.status, 'AGUARDANDO_QR', JSON.stringify(r.corpo))
  reset({})
  await removerInstancia('qualquer')
  assert.ok(ev.chamadas.some(c => c.startsWith('DELETE /instance/delete/')), 'apagou mesmo com o logout falhando')
})
