// ARIES DISPARO — canal Instagram: públicos de quem falou com a conta, janela da Meta (24 h no direct,
// 7 dias / uma resposta privada por comentário), envio pelo direct, histórico no Atendimento,
// resposta que para a sequência, "SAIR" e erros da Meta. A API do Instagram é um servidor falso local:
// nenhuma mensagem sai de verdade. Sem banco, pula.
process.env.DISPARO_TESTE_SEM_RITMO = '1'
import http from 'http'
import type { AddressInfo } from 'net'
const PORTA = 40000 + Math.floor(Math.random() * 900)
const FALSO = `http://127.0.0.1:${PORTA}`
process.env.INSTAGRAM_GRAPH_BASE = FALSO
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'crypto'
import type { Server } from 'http'
import { prisma } from '../src/lib/prisma'
import { signProLaboreToken } from '../src/lib/jwtProLabore'
import { resolverPublico } from '../src/lib/disparo/publico'
import { lerConfigLoja } from '../src/lib/disparo/regras'
import { registrarAutorizacao, situacaoDe } from '../src/lib/disparo/autorizacao'
import { prepararCampanha, rodarDisparo, transicionar, situacaoDoEnvio } from '../src/lib/disparo/motor'
import { enviarPeloInstagram, registrarRespostaInstagram, remetenteInstagram } from '../src/lib/disparo/instagram'
import { processarEventosPendentes } from '../src/lib/smAtendimento'
import app from '../src/app'

// ---------- Instagram Graph falso: grava cada envio; um id pode ser marcado para recusar ----------
const enviados: Array<{ recipient: Record<string, string>; message: Record<string, unknown> }> = []
let erroDaMeta: { code: number; message: string } | null = null
const falso = http.createServer((req, res) => {
  const u = new URL(req.url!, FALSO)
  const json = (s: number, j: unknown) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(j)) }
  if (req.method === 'POST' && u.pathname === '/me/messages') {
    if (erroDaMeta) return json(400, { error: erroDaMeta })
    const e = { recipient: JSON.parse(u.searchParams.get('recipient') ?? '{}'), message: JSON.parse(u.searchParams.get('message') ?? '{}') }
    enviados.push(e)
    return json(200, { recipient_id: e.recipient.id ?? 'x', message_id: `mid.${randomUUID()}` })
  }
  json(404, { error: { message: `rota falsa ausente: ${req.method} ${u.pathname}`, code: 100 } })
})

const R = String(Date.now()).slice(-8)
const IG = (n: number) => `17${R}${n}`
const H = 3_600_000
let temBanco = false
let servidor: Server
let base = ''
const loja = { id: '', conta: '' }
const conv: Record<string, string> = {}
const tok = () => signProLaboreToken({ sub: loja.id, email: 'ig@t.local', nome: 'Dono', papel: 'DONO' })
async function api(metodo: string, caminho: string, corpoReq?: unknown) {
  const r = await fetch(`${base}/pro-labore/disparo${caminho}`, { method: metodo, headers: { Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' }, body: corpoReq === undefined ? undefined : JSON.stringify(corpoReq) })
  return { status: r.status, corpo: await r.json().catch(() => null) as Record<string, unknown> }
}
const JANELA_TODA = { janela: { inicio: '00:00', fim: '23:59', dias: [0, 1, 2, 3, 4, 5, 6] }, intervaloSeg: 0 }

/** Conversa do Atendimento com a última mensagem da pessoa há `horas` horas. */
async function conversa(nome: string, canal: string, igId: string, horas: number, extra: { comentario?: string; criadoHaHoras?: number; soComentario?: boolean; moto?: string } = {}) {
  const quando = new Date(Date.now() - horas * H)
  const c = await prisma.smConversa.create({ data: {
    usuarioId: loja.id, canal, chave: extra.comentario ?? igId, clienteIgId: igId, clienteNome: nome, clienteUsuario: nome.toLowerCase().replace(/\s+/g, ''),
    comentarioIgId: extra.comentario ?? null, motoInteresse: extra.moto ?? null, ultimaMsgEm: quando, ultimaEntradaEm: quando, criadoEm: new Date(Date.now() - (extra.criadoHaHoras ?? horas) * H),
  } })
  await prisma.smMensagem.create({ data: { conversaId: c.id, direcao: 'IN', autor: 'CLIENTE', texto: 'Oi, quero saber da moto', igMensagemId: extra.comentario && extra.soComentario ? extra.comentario : `in.${randomUUID()}`, enviadaEm: quando } })
  conv[nome] = c.id
  return c
}

before(async () => {
  try { await prisma.$queryRaw`SELECT 1 FROM pro_labore_sm_conversas LIMIT 1`; temBanco = true } catch { return }
  await new Promise<void>(ok => falso.listen(PORTA, '127.0.0.1', () => ok()))
  loja.id = (await prisma.proLaboreUsuario.create({ data: { nome: 'Loja Instagram', email: `ig-${randomUUID()}@t.local`, senhaHash: 'x' } })).id
  loja.conta = (await prisma.socialMediaConta.create({ data: { usuarioId: loja.id, titular: `dono:${loja.id}`, instagramUserId: `9${R}`, nomeUsuario: 'ariesmotos', accessToken: 'tk', tokenExpiraEm: new Date(Date.now() + 864e5) } })).id
  await conversa('Ana Direct', 'DIRECT', IG(1), 2) // janela aberta (22 h)
  await conversa('Bia Story', 'RESPOSTA_STORY', IG(2), 30) // passou de 24 h
  await conversa('Caio Quero', 'COMENTARIO_AUTOMACAO', IG(3), 1, { comentario: `c3${R}`, soComentario: true }) // só comentou: não abre DM
  await conversa('Duda Comentou', 'COMENTARIO', IG(4), 48, { comentario: `c4${R}` }) // comentário de 2 dias: resposta privada
  await conversa('Edu Antigo', 'COMENTARIO', IG(5), 240, { comentario: `c5${R}` }) // 10 dias: fora
  await conversa('Fê Saiu', 'DIRECT', IG(6), 1) // aberta, mas pediu para sair
  await registrarAutorizacao({ usuarioId: loja.id, telefone: `ig:${IG(6)}`, situacao: 'REVOGADO', origem: 'TESTE' })
  servidor = app.listen(0)
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`
})
after(() => { servidor?.close(); falso.close() })

const leitor = () => ({ usuarioId: loja.id, papel: 'DONO', vendedorId: null })

test('público do direct: só quem está na janela de 24 h; comentário do "Comente QUERO" não abre DM; SAIR vale', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const r = await resolverPublico(leitor(), { base: 'INSTAGRAM_DM' }, { finalidade: 'MARKETING', config: lerConfigLoja({}) })
  assert.deepEqual(r.elegiveis.map(c => c.nome), ['Ana Direct'])
  const motivo = (nome: string) => r.excluidos.find(x => x.contato.nome === nome)?.motivo
  assert.equal(motivo('Bia Story'), 'JANELA_FECHADA')
  assert.equal(motivo('Caio Quero'), 'JANELA_FECHADA')
  assert.equal(motivo('Fê Saiu'), 'DESCADASTRADO')
  // Promocional pelo Instagram não pede a autorização do WhatsApp: a pessoa falou com a conta.
  assert.equal(r.porMotivo.SEM_AUTORIZACAO ?? 0, 0)
  const ana = r.elegiveis[0]
  assert.equal(ana.telefone, `ig:${IG(1)}`)
  assert.ok(ana.instagram!.janelaAte!.getTime() > Date.now() + 21 * H && ana.instagram!.janelaAte!.getTime() < Date.now() + 23 * H)
  // Filtro "respondeu story" (origem).
  const s = await resolverPublico(leitor(), { base: 'INSTAGRAM_DM', filtros: { op: 'E', itens: [{ campo: 'origem', op: 'igual', valor: 'RESPOSTA_STORY' }] } }, { finalidade: 'MARKETING', config: lerConfigLoja({}) })
  assert.equal(s.elegiveis.length, 0)
  assert.equal(s.porMotivo.JANELA_FECHADA, 1)
})

test('público de comentários: 7 dias, resposta privada', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const r = await resolverPublico(leitor(), { base: 'INSTAGRAM_COMENTARIOS' }, { finalidade: 'MARKETING', config: lerConfigLoja({}) })
  assert.deepEqual(r.elegiveis.map(c => c.nome), ['Duda Comentou'])
  assert.equal(r.elegiveis[0].instagram!.comentarioId, `c4${R}`)
  // Comentário de 10 dias nem entra (a Meta não deixa responder no privado).
  assert.ok(!r.excluidos.some(x => x.contato.nome === 'Edu Antigo'))
})

test('rotas: canal e público precisam combinar; documento e resposta privada com arquivo são recusados', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const corpoBase = { nome: 'IG', finalidade: 'MARKETING', conteudo: { passos: [{ tipo: 'TEXTO', texto: 'Oi!' }] }, config: JANELA_TODA }
  assert.equal((await api('POST', '/campanhas', { ...corpoBase, canal: 'INSTAGRAM', publico: { base: 'LEADS' } })).status, 400)
  assert.equal((await api('POST', '/campanhas', { ...corpoBase, canal: 'WHATSAPP', publico: { base: 'INSTAGRAM_DM' } })).status, 400)
  assert.equal((await api('POST', '/campanhas', { ...corpoBase, canal: 'INSTAGRAM', publico: { base: 'INSTAGRAM_DM' }, conteudo: { passos: [{ tipo: 'DOCUMENTO', midiaId: 'x' }] } })).status, 400)
  assert.equal((await api('POST', '/campanhas', { ...corpoBase, canal: 'INSTAGRAM', publico: { base: 'INSTAGRAM_COMENTARIOS' }, conteudo: { passos: [{ tipo: 'IMAGEM', midiaId: 'x' }] } })).status, 400)
  const meta = await api('GET', '/meta')
  assert.equal((meta.corpo.instagram as { conectado: boolean }).conectado, true)
  // Prévia: mostra o @ e até quando a janela fica aberta (nunca "ig:<id>").
  const p = await api('POST', '/publicos/previa', { definicao: { base: 'INSTAGRAM_DM' }, finalidade: 'MARKETING' })
  const item = (p.corpo.pagina as Array<{ telefone: string; instagram: { janelaAte: string; modo: string } }>)[0]
  assert.equal(item.telefone, '@anadirect')
  assert.equal(item.instagram.modo, 'DM')
})

test('campanha pelo direct: sai pela conta da empresa, entra no histórico do Atendimento e a resposta para a sequência', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  enviados.length = 0
  const criada = await api('POST', '/campanhas', { nome: 'Feirão IG', finalidade: 'MARKETING', canal: 'INSTAGRAM', publico: { base: 'INSTAGRAM_DM' }, config: JANELA_TODA,
    conteudo: { passos: [{ tipo: 'TEXTO', texto: 'Oi {{primeiro_nome}}! Feirão hoje.' }, { tipo: 'TEXTO', texto: 'Quer as condições?', esperarMin: 0 }], rodapeSair: false } })
  assert.equal(criada.status, 201, JSON.stringify(criada.corpo))
  const id = String(criada.corpo.id)
  assert.equal(criada.corpo.canal, 'INSTAGRAM')
  assert.equal(criada.corpo.assistenteId, null)
  const v = await api('POST', `/campanhas/${id}/validar`)
  assert.equal(v.status, 200, JSON.stringify(v.corpo))
  if (!v.corpo.preparada) await prepararCampanha(id)
  const ini = await api('POST', `/campanhas/${id}/iniciar`, {})
  assert.equal(ini.status, 200, JSON.stringify(ini.corpo))
  await rodarDisparo(8000)
  await rodarDisparo(8000)
  const paraAna = enviados.filter(e => e.recipient.id === IG(1))
  assert.equal(paraAna.length, 2, JSON.stringify(enviados))
  assert.equal(paraAna[0].message.text, 'Oi Ana! Feirão hoje.')
  assert.ok(!enviados.some(e => [IG(2), IG(3), IG(6)].includes(e.recipient.id)), 'ninguém fora da janela ou descadastrado recebe')
  const ms = await prisma.disparoMensagem.findMany({ where: { campanhaId: id } })
  assert.ok(ms.every(m => m.assistenteId === remetenteInstagram(loja.conta) && m.status === 'ACEITA'))
  // Histórico do Atendimento: as duas saídas como automação do Disparo (não contam como resposta humana).
  const hist = await prisma.smMensagem.findMany({ where: { conversaId: conv['Ana Direct'], direcao: 'OUT' } })
  assert.equal(hist.length, 2)
  assert.ok(hist.every(h => h.autor === 'AUTOMACAO' && h.automacao === 'DISPARO'))
  const sit = await situacaoDoEnvio(id)
  assert.notEqual(sit?.motivo, 'SEM_CONEXAO')
  // Chega pelo webhook do Instagram: o eco da nossa mensagem (não duplica) e a resposta da pessoa (liga à campanha).
  await prisma.smWebhookEvento.create({ data: { contaId: loja.conta, objeto: 'instagram', campo: 'messages', payload: { messaging: [
    { sender: { id: `9${R}` }, recipient: { id: IG(1) }, timestamp: Date.now() - 1000, message: { mid: hist[0].igMensagemId, text: hist[0].texto, is_echo: true } },
    { sender: { id: IG(1) }, recipient: { id: `9${R}` }, timestamp: Date.now(), message: { mid: `in.${randomUUID()}`, text: 'Quero sim!' } },
  ] } } })
  await processarEventosPendentes(500)
  assert.equal(await prisma.smMensagem.count({ where: { conversaId: conv['Ana Direct'], direcao: 'OUT', OR: [{ automacao: 'DISPARO' }, { autor: 'HUMANO' }] } }), 2, 'o eco não vira mensagem nova')
  assert.equal((await prisma.disparoEvento.count({ where: { campanhaId: id, tipo: 'RESPOSTA' } })), 1)
  const d = await prisma.disparoDestinatario.findFirst({ where: { campanhaId: id, telefone: `ig:${IG(1)}` } })
  assert.ok(d?.respondeuEm)
  // "SAIR" pelo Instagram descadastra das promocionais (canal INSTAGRAM, sem telefone).
  await registrarRespostaInstagram(loja.id, IG(1), 'SAIR', conv['Ana Direct'])
  assert.equal((await situacaoDe(loja.id, `ig:${IG(1)}`))?.situacao, 'REVOGADO')
  const aut = await prisma.contatoAutorizacao.findFirst({ where: { usuarioId: loja.id, telefone: `ig:${IG(1)}` }, orderBy: { criadoEm: 'desc' } })
  assert.equal(aut?.canal, 'INSTAGRAM')
})

test('janela fecha entre a preparação e o envio: a mensagem não sai (fica "fora da janela")', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  enviados.length = 0
  const g = await conversa('Gabi Quase', 'DIRECT', IG(7), 23.5, { moto: `marca-gabi-${R}` })
  const c = await prisma.disparoCampanha.create({ data: {
    usuarioId: loja.id, nome: 'Janela', finalidade: 'OPERACIONAL', canal: 'INSTAGRAM', publico: { base: 'INSTAGRAM_DM', filtros: { op: 'E', itens: [{ campo: 'modelo', op: 'igual', valor: `marca-gabi-${R}` }] } },
    conteudo: { passos: [{ tipo: 'TEXTO', texto: 'Oi!' }] }, config: JANELA_TODA, preparo: { leitor: leitor(), aprovacao: false }, status: 'VALIDATING',
  } })
  const p = await prepararCampanha(c.id)
  assert.equal(p?.elegiveis, 1)
  await transicionar(c.id, 'QUEUED', { de: ['READY'] })
  // Passa da janela antes do envio.
  await prisma.smMensagem.updateMany({ where: { conversaId: g.id }, data: { enviadaEm: new Date(Date.now() - 25 * H) } })
  await rodarDisparo(6000)
  assert.equal(enviados.filter(e => e.recipient.id === IG(7)).length, 0)
  const d = await prisma.disparoDestinatario.findFirst({ where: { campanhaId: c.id } })
  assert.equal(d?.interrompidoPor, 'JANELA_FECHADA')
})

test('comentário: uma resposta privada (só texto); a segunda campanha não responde de novo', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  enviados.length = 0
  const criar = async (nome: string) => {
    const c = await prisma.disparoCampanha.create({ data: {
      usuarioId: loja.id, nome, finalidade: 'MARKETING', canal: 'INSTAGRAM', publico: { base: 'INSTAGRAM_COMENTARIOS' },
      conteudo: { passos: [{ tipo: 'TEXTO', texto: 'Oi! Vi seu comentário, posso te mandar o valor?' }, { tipo: 'TEXTO', texto: 'Segue o link', esperarMin: 0 }], rodapeSair: false }, config: JANELA_TODA, preparo: { leitor: leitor(), aprovacao: false }, status: 'VALIDATING',
    } })
    await prepararCampanha(c.id)
    await transicionar(c.id, 'QUEUED', { de: ['READY'] })
    return c
  }
  const c1 = await criar('Comentários 1')
  await rodarDisparo(8000)
  await rodarDisparo(6000)
  assert.equal(enviados.length, 1, JSON.stringify(enviados))
  assert.deepEqual(enviados[0].recipient, { comment_id: `c4${R}` })
  // O 2º passo não sai: a pessoa não respondeu (sem janela de DM).
  const d = await prisma.disparoDestinatario.findFirst({ where: { campanhaId: c1.id } })
  assert.equal(d?.interrompidoPor, 'JANELA_FECHADA')
  const hist = await prisma.smMensagem.findMany({ where: { conversaId: conv['Duda Comentou'], direcao: 'OUT', automacao: 'DISPARO' } })
  assert.equal(hist.length, 1)
  const c2 = await criar('Comentários 2')
  const t2 = await prisma.disparoCampanha.findUnique({ where: { id: c2.id }, select: { totais: true } })
  assert.equal((t2?.totais as { elegiveis: number }).elegiveis, 0, 'já recebeu a resposta privada')
})

test('foto + texto: duas mensagens no direct (anexo por link); token vencido para a conta sem gastar tentativa', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  enviados.length = 0
  await conversa('Hugo Foto', 'DIRECT', IG(8), 1, { moto: `marca-hugo-${R}` })
  const r = await enviarPeloInstagram(remetenteInstagram(loja.conta), loja.id, { _igId: IG(8) }, 0, { tipo: 'IMAGEM', texto: 'Olha a CG 160', midia: { url: 'https://arquivos.exemplo/cg.jpg' }, prazoMs: 5000 })
  assert.ok(r.providerId)
  assert.equal(enviados.length, 2)
  assert.deepEqual(enviados[0].message, { attachment: { type: 'image', payload: { url: 'https://arquivos.exemplo/cg.jpg' } } })
  assert.equal(enviados[1].message.text, 'Olha a CG 160')
  await assert.rejects(enviarPeloInstagram(remetenteInstagram(loja.conta), loja.id, { _igId: IG(8) }, 0, { tipo: 'DOCUMENTO', texto: '', midia: { url: 'https://x/a.pdf' }, prazoMs: 5000 }), (e: { classe: string }) => e.classe === 'DEFINITIVO')

  // Token vencido: a mensagem volta para a fila e a campanha mostra o motivo.
  const c = await prisma.disparoCampanha.create({ data: {
    usuarioId: loja.id, nome: 'Token', finalidade: 'OPERACIONAL', canal: 'INSTAGRAM', publico: { base: 'INSTAGRAM_DM', filtros: { op: 'E', itens: [{ campo: 'modelo', op: 'igual', valor: `marca-hugo-${R}` }] } },
    conteudo: { passos: [{ tipo: 'TEXTO', texto: 'Oi!' }] }, config: JANELA_TODA, preparo: { leitor: leitor(), aprovacao: false }, status: 'VALIDATING',
  } })
  await prepararCampanha(c.id)
  await transicionar(c.id, 'QUEUED', { de: ['READY'] })
  erroDaMeta = { code: 190, message: 'Error validating access token' }
  try { await rodarDisparo(6000) } finally { erroDaMeta = null }
  const m = await prisma.disparoMensagem.findFirst({ where: { campanhaId: c.id } })
  assert.equal(m?.status, 'AGENDADA')
  assert.equal(m?.tentativas, 0)
  const camp = await prisma.disparoCampanha.findUnique({ where: { id: c.id }, select: { erro: true } })
  assert.match(String(camp?.erro), /reconecte/i)
  // Acesso de volta: sai na próxima rodada e o aviso some.
  await rodarDisparo(6000)
  assert.equal((await prisma.disparoMensagem.findFirst({ where: { campanhaId: c.id } }))?.status, 'ACEITA')
  assert.equal((await prisma.disparoCampanha.findUnique({ where: { id: c.id }, select: { erro: true } }))?.erro, null)
})
