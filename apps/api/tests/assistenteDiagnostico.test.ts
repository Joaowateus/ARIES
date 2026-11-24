// Diagnóstico do WhatsApp: aponta o que impede o cadastro no CRM e a primeira abordagem do robô.
// Roda num banco de teste (DATABASE_URL); sem banco, é pulado. Sem o servidor do WhatsApp configurado.
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'crypto'
import { prisma } from '../src/lib/prisma'
import { diagnosticarAssistentes } from '../src/lib/assistenteDiagnostico'
import { processarWebhookAssistente } from '../src/lib/assistenteMotor'

let temBanco = false
const loja = { id: '', segredo: '', assistente: '' }
before(async () => {
  delete process.env.EVOLUTION_API_URL; delete process.env.EVOLUTION_API_KEY
  try { await prisma.$queryRaw`SELECT 1`; temBanco = true } catch { return }
  const u = await prisma.proLaboreUsuario.create({ data: { nome: 'Loja Diag', email: `diag-${randomUUID()}@t.local`, senhaHash: 'x' } })
  loja.id = u.id
  const v = await prisma.vendedor.create({ data: { usuarioId: u.id, nome: 'Naiza Teste', papel: 'VENDEDOR' } })
  loja.segredo = randomUUID()
  const a = await prisma.assistenteComercial.create({ data: { vendedorId: v.id, webhookSegredo: loja.segredo, status: 'CONECTADO', numeroWhatsapp: '5591988880000' } })
  loja.assistente = a.id
})

test('mensagem nova pelo webhook: lead no CRM e primeira abordagem do robô', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const corpo = { event: 'messages.upsert', data: { key: { remoteJid: '5591977771234@s.whatsapp.net', fromMe: false, id: `ID${randomUUID()}` }, pushName: 'Cliente Simulado', message: { conversation: 'Oi! Quero saber da CG 160' }, messageTimestamp: Math.floor(Date.now() / 1000) } }
  assert.equal(await processarWebhookAssistente(loja.segredo, corpo), 200)
  const lead = await prisma.lead.findFirst({ where: { usuarioId: loja.id }, select: { nomeCliente: true, origemCadastro: true } })
  assert.equal(lead?.nomeCliente, 'Cliente Simulado')
  assert.equal(lead?.origemCadastro, 'WHATSAPP')
  const conv = await prisma.assistenteConversa.findFirst({ where: { assistenteId: loja.assistente }, include: { mensagens: { orderBy: { criadoEm: 'asc' } } } })
  assert.equal(conv?.robo, true)
  assert.equal(conv?.mensagens[1]?.remetente, 'ASSISTENTE', 'o robô escreveu a primeira abordagem')
})

test('diagnóstico: servidor sem configuração, cadastro desligado e contatos fora do CRM aparecem com o que fazer', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  await prisma.assistenteComercial.update({ where: { id: loja.assistente }, data: { cadastroAutomatico: false } })
  await prisma.assistenteContatoForaCrm.create({ data: { assistenteId: loja.assistente, numero: '5591900001111', jid: '5591900001111@s.whatsapp.net', nome: 'Conhecido', ultimaEm: new Date() } })
  const d = await diagnosticarAssistentes(loja.id, s => `https://api.teste/pro-labore/assistente/webhook/${s}`)
  assert.equal(d.servidor.configurado, false)
  const a = d.assistentes[0]
  assert.equal(a.ultimas24h.leadsCadastrados, 1)
  assert.equal(a.ultimas24h.conversasComRobo, 1)
  assert.equal(a.ultimas24h.foraDoCrm, 1)
  assert.equal(a.ultimas24h.enviosQueFalharam, 0, 'a mensagem do robô acabou de ser gravada (menos de 2 min)')
  const textos = a.problemas.map(p => p.texto).join('\n')
  assert.match(textos, /cadastro automático no CRM está desligado/)
  assert.match(textos, /fora do CRM/)
  assert.match(textos, /nunca foi conectado/, 'sem instância no servidor')
  assert.ok(a.problemas.every(p => p.acao), 'todo problema diz o que fazer')
})
