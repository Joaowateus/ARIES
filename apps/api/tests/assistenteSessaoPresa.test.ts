// Caso real (Naiza, 26/11/2026): a sessão morreu, o servidor do WhatsApp continua dizendo "open",
// RECUSA apagar ("precisa estar desconectada") e o logout falha ("Connection Closed"). Antes: o QR
// novo não aparecia, "Desconectar" dava "o servidor não apagou a sessão" e a tela voltava a mostrar
// "conectado". Servidor Evolution simulado por instância (cada nome com o próprio estado).
import http from 'http'
import type { AddressInfo } from 'net'
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'crypto'
import type { Server } from 'http'
import { prisma } from '../src/lib/prisma'
import { signProLaboreToken } from '../src/lib/jwtProLabore'
import { processarWebhookAssistente } from '../src/lib/assistenteMotor'
import app from '../src/app'

type Inst = { estado: 'open' | 'connecting' | 'close'; morta: boolean; aparelhoRemovido?: boolean }
const inst = new Map<string, Inst>()
const chamadas: string[] = []
const falso = http.createServer((req, res) => {
  const u = new URL(req.url!, 'http://x')
  const nome = decodeURIComponent(u.pathname.split('/').pop() ?? '')
  chamadas.push(`${req.method} ${u.pathname}`)
  const json = (s: number, j: unknown) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(j)) }
  let corpo = ''
  req.on('data', d => { corpo += d })
  req.on('end', () => {
    const i = inst.get(nome)
    if (u.pathname.startsWith('/instance/connectionState/')) return i ? json(200, { instance: { state: i.estado } }) : json(404, { response: { message: ['not found'] } })
    if (u.pathname === '/instance/fetchInstances') return json(200, [...inst.entries()].map(([n, x]) => ({ name: n, ownerJid: '559180713982@s.whatsapp.net', connectionStatus: x.estado })))
    if (u.pathname.startsWith('/chat/whatsappNumbers/')) return !i || i.morta || i.estado !== 'open' ? json(500, { response: { message: ['Error: Connection Closed'] } }) : json(200, [{ exists: true }])
    if (u.pathname.startsWith('/message/sendText/')) return !i || i.morta ? json(500, { response: { message: ['Error: Connection Closed'] } }) : json(201, { key: { id: 'OK' } })
    if (u.pathname.startsWith('/instance/logout/')) return !i || i.morta ? json(500, { response: { message: ['Error: Connection Closed'] } }) : (i.estado = 'close', json(200, {}))
    // Como a Evolution real: não apaga instância "open".
    if (u.pathname.startsWith('/instance/delete/')) { if (!i) return json(404, {}); if (i.estado === 'open') return json(400, { response: { message: [`The "${nome}" instance needs to be disconnected`] } }); inst.delete(nome); return json(200, {}) }
    // Reiniciar a morta: só cai para "close" se o aparelho já foi removido no celular.
    if (u.pathname.startsWith('/instance/restart/')) { if (i?.morta && i.aparelhoRemovido) i.estado = 'close'; return json(200, {}) }
    if (u.pathname === '/instance/create') { const n = (JSON.parse(corpo || '{}') as { instanceName: string }).instanceName; inst.set(n, { estado: 'connecting', morta: false }); return json(201, {}) }
    if (u.pathname.startsWith('/instance/connect/')) return i && i.estado !== 'open' ? json(200, { base64: `QR-${nome}`, pairingCode: null }) : json(200, {})
    if (u.pathname.startsWith('/webhook/set/')) return json(200, {})
    if (u.pathname.startsWith('/webhook/find/')) return json(200, { url: 'https://x/w', enabled: true, events: ['MESSAGES_UPSERT'] })
    if (u.pathname.startsWith('/instance/fetchInstances')) return json(200, [])
    json(404, { response: { message: [`rota ausente ${u.pathname}`] } })
  })
})

let temBanco = false
let servidor: Server
let base = ''
const loja = { id: '', vendedor: '', assistente: '' }
before(async () => {
  try { await prisma.$queryRaw`SELECT 1`; temBanco = true } catch { return }
  await new Promise<void>(ok => falso.listen(0, '127.0.0.1', () => ok()))
  process.env.EVOLUTION_API_URL = `http://127.0.0.1:${(falso.address() as AddressInfo).port}`
  process.env.EVOLUTION_API_KEY = 'chave'
  loja.id = (await prisma.proLaboreUsuario.create({ data: { nome: 'Loja Sessão Presa', email: `presa-${randomUUID()}@t.local`, senhaHash: 'x' } })).id
  loja.vendedor = (await prisma.vendedor.create({ data: { usuarioId: loja.id, nome: 'Naiza Presa', papel: 'VENDEDOR' } })).id
  loja.assistente = (await prisma.assistenteComercial.create({ data: { vendedorId: loja.vendedor, instancia: `aries-${loja.vendedor}`, webhookSegredo: randomUUID(), status: 'SESSAO_CAIDA', motivoQueda: 'ENVIO_FALHOU', numeroWhatsapp: '559180713982' } })).id
  servidor = app.listen(0)
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`
})
after(() => { servidor?.close(); falso.close(); delete process.env.EVOLUTION_API_URL; delete process.env.EVOLUTION_API_KEY })
const tok = () => signProLaboreToken({ sub: loja.id, email: 'd@t.local', nome: 'Dono', papel: 'DONO' })
const api = async (m: string, c: string, b?: unknown) => { const r = await fetch(`${base}/pro-labore${c}`, { method: m, headers: { Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, corpo: await r.json().catch(() => null) as Record<string, unknown> } }
const atual = async () => (await prisma.assistenteComercial.findUniqueOrThrow({ where: { id: loja.assistente } }))

test('"Gerar QR Code novo" com a sessão presa: abre sessão com outro nome e o QR aparece', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const antiga = `aries-${loja.vendedor}`
  inst.clear(); inst.set(antiga, { estado: 'open', morta: true })
  const segredoAntigo = (await atual()).webhookSegredo
  const r = await api('POST', '/assistente/reparar', { vendedorId: loja.vendedor, gerarQr: true })
  assert.equal(r.status, 200, JSON.stringify(r.corpo))
  assert.equal(r.corpo.status, 'AGUARDANDO_QR')
  const a = await atual()
  assert.notEqual(a.instancia, antiga, 'sessão nova com outro nome')
  assert.ok(a.instancia!.startsWith(`aries-${loja.vendedor}-`))
  assert.equal(r.corpo.qrBase64, `data:image/png;base64,QR-${a.instancia}`)
  assert.notEqual(a.webhookSegredo, segredoAntigo, 'aviso da sessão antiga cai no vazio')
  assert.equal(a.numeroWhatsapp, '559180713982', 'nada do cadastro foi apagado')
  // O acompanhamento da tela NÃO volta a dizer "conectado" (a nova ainda espera o QR; a antiga é ignorada).
  assert.equal((await api('GET', `/assistente/conexao?vendedorId=${loja.vendedor}`)).corpo.status, 'AGUARDANDO_QR')
  // Aviso de conexão vindo da sessão antiga não mexe no status.
  assert.equal(await processarWebhookAssistente(a.webhookSegredo!, { event: 'connection.update', instance: antiga, data: { state: 'close', statusReason: 401 } }), 200)
  assert.equal((await atual()).status, 'AGUARDANDO_QR')
})

test('leu o QR: conecta e apaga a sessão antiga que estava presa (depois de remover o aparelho no celular)', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const a = await atual()
  const antiga = `aries-${loja.vendedor}`
  inst.get(antiga)!.aparelhoRemovido = true
  inst.set(a.instancia!, { estado: 'open', morta: false })
  assert.equal((await api('GET', `/assistente/conexao?vendedorId=${loja.vendedor}`)).corpo.status, 'CONECTADO')
  assert.equal((await atual()).status, 'CONECTADO')
  assert.ok(!inst.has(antiga), 'a sessão antiga foi apagada')
  assert.ok(inst.has(a.instancia!), 'a sessão atual continua')
})

test('"Desconectar" com a sessão presa não trava: desconecta do ARIES e avisa; "Conectar" depois gera QR', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const a = await atual()
  inst.set(a.instancia!, { estado: 'open', morta: true }) // morreu de novo e o servidor não deixa apagar
  const d = await api('DELETE', `/assistente/config?vendedorId=${loja.vendedor}`)
  assert.equal(d.status, 200, JSON.stringify(d.corpo))
  assert.match(String(d.corpo.aviso), /Aparelhos conectados/)
  const depois = await atual()
  assert.equal(depois.status, 'NAO_CONECTADO')
  assert.notEqual(depois.webhookSegredo, a.webhookSegredo)
  const c = await api('POST', '/assistente/conectar', { vendedorId: loja.vendedor })
  assert.equal(c.corpo.status, 'AGUARDANDO_QR', JSON.stringify(c.corpo))
  assert.match(String(c.corpo.qrBase64), /QR-aries-/)
  assert.notEqual((await atual()).instancia, a.instancia, 'não reaproveita a sessão presa')
})

test('sessão fechada (não presa): apaga de verdade e reaproveita o nome de sempre', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const nome = `aries-${loja.vendedor}`
  inst.clear(); inst.set(nome, { estado: 'close', morta: true })
  await prisma.assistenteComercial.update({ where: { id: loja.assistente }, data: { instancia: nome, status: 'SESSAO_CAIDA' } })
  const r = await api('POST', '/assistente/reparar', { vendedorId: loja.vendedor, gerarQr: true })
  assert.equal(r.corpo.status, 'AGUARDANDO_QR')
  assert.equal((await atual()).instancia, nome)
  assert.equal(r.corpo.qrBase64, `data:image/png;base64,QR-${nome}`)
})

test('diagnóstico: a sessão antiga que sobrou aparece como faxina (não como conflito); "Apagar sessão antiga" e a faxina automática apagam', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const antiga = `aries-${loja.vendedor}`
  const nova = `aries-${loja.vendedor}-nova`
  inst.clear()
  inst.set(antiga, { estado: 'open', morta: true })
  inst.set(nova, { estado: 'open', morta: false })
  await prisma.assistenteComercial.update({ where: { id: loja.assistente }, data: { instancia: nova, status: 'CONECTADO', numeroWhatsapp: '559180713982' } })
  const { diagnosticarAssistentes } = await import('../src/lib/assistenteDiagnostico')
  const d = (await diagnosticarAssistentes(loja.id, s => `https://x/${s}`)).assistentes.find(x => x.assistenteId === loja.assistente)!
  const p = d.problemas.find(x => x.sessaoAntiga)
  assert.ok(p, JSON.stringify(d.problemas))
  assert.equal(p!.gravidade, 'ATENCAO')
  assert.ok(!d.problemas.some(x => /Uma derruba a outra/.test(x.texto)), 'não acusa conflito')
  // Ainda no celular: o servidor não solta (fica "presa") e a tela explica o que fazer.
  const r1 = await api('POST', `/assistente/diagnostico/${loja.assistente}/duplicadas`)
  assert.deepEqual(r1.corpo.presas, [antiga])
  assert.ok(inst.has(nova), 'a conexão em uso nunca é tocada')
  // Removeu o aparelho no celular: a faxina automática apaga.
  inst.get(antiga)!.aparelhoRemovido = true
  const { limparSobrasDeTodos } = await import('../src/lib/assistenteReparo')
  await prisma.disparoTrava.deleteMany({ where: { chave: 'whatsapp:limpar-sobras' } })
  const f = await limparSobrasDeTodos(8000)
  assert.ok(f.sobrasApagadas >= 1, JSON.stringify(f))
  assert.ok(!inst.has(antiga) && inst.has(nova))
})
