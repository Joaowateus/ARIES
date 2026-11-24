// ARIES DISPARO — rotas pela API (tokens de dono, supervisor e vendedor): permissões, aprovação,
// prévia do público, biblioteca e autorizações. Banco de teste (DATABASE_URL); sem banco, pula.
process.env.DISPARO_TESTE_SEM_RITMO = '1'
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'crypto'
import type { AddressInfo } from 'net'
import type { Server } from 'http'
import { prisma } from '../src/lib/prisma'
import { signProLaboreToken } from '../src/lib/jwtProLabore'
import { criarProvedorFalso, definirProvedor } from '../src/lib/disparo/provedor'
import app from '../src/app'

let temBanco = false
let servidor: Server
let base = ''
const loja = { id: '', sup: '', vend: '', semAcesso: '', asVend: '', asSup: '' }

before(async () => {
  try { await prisma.$queryRaw`SELECT 1 FROM pro_labore_disparo_campanhas LIMIT 1`; temBanco = true } catch { return }
  definirProvedor(criarProvedorFalso())
  const u = await prisma.proLaboreUsuario.create({ data: { nome: 'Loja Rotas', email: `rotas-${randomUUID()}@t.local`, senhaHash: 'x' } })
  loja.id = u.id
  const cria = (nome: string, papel: string, permissoes?: object) => prisma.vendedor.create({ data: { usuarioId: u.id, nome, papel, email: `${randomUUID()}@t.local`, senhaHash: 'x', ...(permissoes ? { permissoes } : {}) } })
  const [s, v, n] = await Promise.all([cria('Sara Supervisora', 'SUPERVISOR'), cria('Vera Vendedora', 'VENDEDOR', { disparo: 'EDITAR' }), cria('Nino Sem Acesso', 'VENDEDOR')])
  loja.sup = s.id; loja.vend = v.id; loja.semAcesso = n.id
  loja.asVend = (await prisma.assistenteComercial.create({ data: { vendedorId: v.id, instancia: `i-${randomUUID()}`, status: 'CONECTADO', numeroWhatsapp: '5591900000011' } })).id
  loja.asSup = (await prisma.assistenteComercial.create({ data: { vendedorId: s.id, instancia: `i-${randomUUID()}`, status: 'CONECTADO', numeroWhatsapp: '5591900000012' } })).id
  await prisma.lead.create({ data: { usuarioId: u.id, vendedorId: v.id, nomeCliente: 'Lia Cliente', telefone: '5591981111111', etapa: 'LEAD' } })
  await prisma.lead.create({ data: { usuarioId: u.id, vendedorId: s.id, nomeCliente: 'Rui Cliente', telefone: '5591982222222', etapa: 'MQL' } })
  servidor = app.listen(0)
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`
})
after(() => { servidor?.close(); definirProvedor(null) })

const tok = (quem: 'DONO' | 'SUP' | 'VEND' | 'NADA') => quem === 'DONO'
  ? signProLaboreToken({ sub: loja.id, email: 'd@t.local', nome: 'Dono', papel: 'DONO' })
  : signProLaboreToken({ sub: loja.id, email: 'x@t.local', nome: quem, papel: quem === 'SUP' ? 'SUPERVISOR' : 'VENDEDOR', vendedorId: quem === 'SUP' ? loja.sup : quem === 'VEND' ? loja.vend : loja.semAcesso })
async function api(quem: 'DONO' | 'SUP' | 'VEND' | 'NADA', metodo: string, caminho: string, corpo?: unknown, tipo = 'application/json') {
  const r = await fetch(`${base}/pro-labore${caminho}`, { method: metodo, headers: { Authorization: `Bearer ${tok(quem)}`, 'Content-Type': tipo }, body: corpo === undefined ? undefined : Buffer.isBuffer(corpo) ? corpo : JSON.stringify(corpo) })
  return { status: r.status, corpo: await r.json().catch(() => null) as Record<string, unknown> }
}
const campanha = (assistenteId: string) => ({ nome: 'Aviso de oficina', finalidade: 'OPERACIONAL', assistenteId, publico: { base: 'LEADS' }, conteudo: { passos: [{ tipo: 'TEXTO', texto: 'Oi {{primeiro_nome}}, sua revisão está chegando.' }] }, config: { janela: { inicio: '00:00', fim: '23:59', dias: [0, 1, 2, 3, 4, 5, 6] }, intervaloSeg: 0 } })

test('permissões: sem o módulo não entra; vendedor com o módulo vê só o próprio número e não aprova', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  assert.equal((await api('NADA', 'GET', '/disparo/meta')).status, 403)
  const meta = await api('VEND', 'GET', '/disparo/meta')
  assert.equal(meta.status, 200)
  assert.deepEqual((meta.corpo.remetentes as Array<{ id: string }>).map(r => r.id), [loja.asVend])
  assert.equal((await api('VEND', 'POST', '/disparo/campanhas', campanha(loja.asSup))).status, 403, 'não envia pelo número de outra pessoa')
  assert.equal((await api('VEND', 'PUT', '/disparo/config', { exigirAprovacao: false })).status, 403, 'configuração é do dono')
  assert.equal((await api('SUP', 'POST', '/disparo/autorizacoes', { telefones: ['5591981111111', '5591982222222'], situacao: 'AUTORIZADO', baseLegal: 'CONSENTIMENTO', evidencia: 'lista' })).status, 403, 'lote é do dono')
})

test('fluxo: vendedor cria → revisão → aprovação do supervisor → início; vendedor vê só a própria carteira', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const nova = await api('VEND', 'POST', '/disparo/campanhas', campanha(loja.asVend))
  assert.equal(nova.status, 201)
  const id = nova.corpo.id as string
  const prev = await api('VEND', 'POST', '/disparo/publicos/previa', { definicao: { base: 'LEADS' }, finalidade: 'OPERACIONAL', conteudo: campanha(loja.asVend).conteudo })
  assert.equal(prev.corpo.elegiveis, 1, 'a vendedora vê só a Lia')
  assert.match(String((prev.corpo.exemplo as string[])[0]), /^Oi Lia, sua revisão/)
  const val = await api('VEND', 'POST', `/disparo/campanhas/${id}/validar`)
  assert.equal(val.status, 200)
  let c = await api('VEND', 'GET', `/disparo/campanhas/${id}`)
  assert.equal(c.corpo.status, 'NEEDS_REVIEW', 'de quem não é da gestão, passa por aprovação')
  assert.equal((await api('VEND', 'POST', `/disparo/campanhas/${id}/aprovar`)).status, 403)
  assert.equal((await api('VEND', 'POST', `/disparo/campanhas/${id}/iniciar`)).status, 409, 'não inicia sem aprovação')
  assert.equal((await api('SUP', 'POST', `/disparo/campanhas/${id}/aprovar`)).status, 200)
  assert.equal((await api('VEND', 'POST', `/disparo/campanhas/${id}/iniciar`, {})).status, 200)
  c = await api('VEND', 'GET', `/disparo/campanhas/${id}`)
  assert.equal(c.corpo.status, 'QUEUED')
  assert.equal(c.corpo.aprovadoPorNome, 'SUP')
  // Editar depois de começar não pode; duplicar pode.
  assert.equal((await api('VEND', 'PUT', `/disparo/campanhas/${id}`, campanha(loja.asVend))).status, 409)
  assert.equal((await api('VEND', 'POST', `/disparo/campanhas/${id}/duplicar`)).status, 201)
  // O supervisor vê a campanha da vendedora; outro vendedor sem módulo, não.
  assert.equal((await api('SUP', 'GET', `/disparo/campanhas/${id}`)).status, 200)
  const eventos = await api('SUP', 'GET', `/disparo/campanhas/${id}/eventos`)
  assert.ok((eventos.corpo as unknown as Array<{ tipo: string }>).some(e => e.tipo === 'STATUS_READY'))
})

test('biblioteca: arquivo é conferido pelo conteúdo; texto disfarçado de imagem é recusado', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)])
  const ok = await api('SUP', 'POST', '/disparo/midias?nome=foto.png', png, 'image/png')
  assert.equal(ok.status, 201)
  assert.equal(ok.corpo.tipo, 'IMAGEM')
  const falso = await api('SUP', 'POST', '/disparo/midias?nome=x.png', Buffer.from('não sou imagem'), 'image/png')
  assert.equal(falso.status, 400)
  const arq = await fetch(`${base}/pro-labore/disparo/midias/${ok.corpo.id}/arquivo`, { headers: { Authorization: `Bearer ${tok('SUP')}` } })
  assert.equal(arq.status, 200)
  assert.equal((await fetch(`${base}/pro-labore/disparo/midias/${ok.corpo.id}/arquivo`)).status, 401, 'sem login não sai')
})

test('autorização: precisa de base legal e evidência; revogar é de qualquer um com o módulo', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  assert.equal((await api('SUP', 'POST', '/disparo/autorizacoes', { telefones: ['5591981111111'], situacao: 'AUTORIZADO' })).status, 400)
  assert.equal((await api('SUP', 'POST', '/disparo/autorizacoes', { telefones: ['5591981111111'], situacao: 'AUTORIZADO', baseLegal: 'CONSENTIMENTO', evidencia: 'Assinou o termo na loja' })).status, 200)
  assert.equal((await api('VEND', 'POST', '/disparo/autorizacoes', { telefones: ['5591981111111'], situacao: 'AUTORIZADO', baseLegal: 'CONSENTIMENTO', evidencia: 'x x x x x' })).status, 403)
  assert.equal((await api('VEND', 'POST', '/disparo/autorizacoes', { telefones: ['5591981111111'], situacao: 'REVOGADO' })).status, 200)
  const h = await api('DONO', 'GET', '/disparo/autorizacoes?telefone=5591981111111')
  assert.equal((h.corpo.atual as { situacao: string }).situacao, 'REVOGADO')
  assert.equal(h.corpo.total, 2, 'o histórico guarda as duas linhas')
})

test('rotina própria do Disparo: exige o segredo e roda só quando há campanha ativa', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  process.env.SOCIAL_MEDIA_CRON_SECRET = 'segredo-teste'
  const sem = await fetch(`${base}/pro-labore/sm/cron/disparo`, { method: 'POST' })
  assert.equal(sem.status, 401)
  const r = await fetch(`${base}/pro-labore/sm/cron/disparo`, { method: 'POST', headers: { 'x-cron-secret': 'segredo-teste' } })
  assert.equal(r.status, 200)
  const j = await r.json() as Record<string, unknown>
  assert.ok('disparo' in j || 'disparoEnviadas' in j)
})
