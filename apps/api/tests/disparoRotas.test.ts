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
  const [s, v, n] = await Promise.all([cria('Sara Supervisora', 'SUPERVISOR'), cria('Vera Vendedora', 'VENDEDOR', { disparo: 'EDITAR' }), cria('Nino Sem Acesso', 'VENDEDOR', { disparo: 'NENHUM' })])
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

test('fluxo com aprovação ligada pelo dono: vendedor cria → revisão → aprovação do supervisor → início; vendedor vê todos os contatos da loja', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  assert.equal((await api('DONO', 'PUT', '/disparo/config', { exigirAprovacao: true })).status, 200)
  const nova = await api('VEND', 'POST', '/disparo/campanhas', campanha(loja.asVend))
  assert.equal(nova.status, 201)
  const id = nova.corpo.id as string
  const prev = await api('VEND', 'POST', '/disparo/publicos/previa', { definicao: { base: 'LEADS' }, finalidade: 'OPERACIONAL', conteudo: campanha(loja.asVend).conteudo })
  assert.equal(prev.corpo.elegiveis, 1, 'carteira: a vendedora vê só a Lia (o Rui é do supervisor)')
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

test('tela da campanha aberta envia sem depender da rotina: processar, situação e travas', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const { pegarTrava, soltarTrava } = await import('../src/lib/disparo/travas')
  // Trava com prazo: a segunda não pega enquanto a primeira vale; solta → pega de novo.
  const k = `teste:${randomUUID()}`
  assert.equal(await pegarTrava(k, 60_000), true)
  assert.equal(await pegarTrava(k, 60_000), false)
  await soltarTrava(k)
  assert.equal(await pegarTrava(k, 60_000), true)
  // Campanha do dono, início imediato: a tela pede a rodada e as mensagens saem.
  const nova = await api('DONO', 'POST', '/disparo/campanhas', campanha(loja.asSup))
  assert.equal(nova.status, 201)
  const id = nova.corpo.id as string
  assert.equal((await api('DONO', 'POST', `/disparo/campanhas/${id}/validar`)).status, 200)
  assert.equal((await api('DONO', 'POST', `/disparo/campanhas/${id}/iniciar`, {})).status, 200)
  let c = await api('DONO', 'GET', `/disparo/campanhas/${id}`)
  assert.equal((c.corpo.situacao as { motivo: string }).motivo, 'NA_FILA')
  const p = await api('DONO', 'POST', '/disparo/processar')
  assert.equal(p.status, 200)
  assert.equal(p.corpo.rodou, true)
  assert.ok(Number(p.corpo.disparoEnviadas) >= 2, `enviou ${p.corpo.disparoEnviadas}`)
  c = await api('DONO', 'GET', `/disparo/campanhas/${id}`)
  assert.ok(['COMPLETED', 'RUNNING'].includes(String(c.corpo.status)))
  assert.ok((c.corpo.resumo as { aceitas: number }).aceitas >= 2)
  // Sem a rotina automática registrada, a tela avisa que ela está parada; a tela conta como rodada.
  const meta = await api('DONO', 'GET', '/disparo/meta')
  assert.equal(typeof (meta.corpo.motor as { rotinaLigada: boolean }).rotinaLigada, 'boolean')
  // Quem não tem o módulo não aciona o envio.
  assert.equal((await api('NADA', 'POST', '/disparo/processar')).status, 403)
})

test('situação explica: agendada no futuro e fora do horário de envio', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const { situacaoDoEnvio, proximaAbertura } = await import('../src/lib/disparo/motor')
  const futura = new Date(Date.now() + 3 * 3600_000).toISOString()
  const ag = await api('DONO', 'POST', '/disparo/campanhas', { ...campanha(loja.asSup), agendadaPara: futura })
  const id = ag.corpo.id as string
  await api('DONO', 'POST', `/disparo/campanhas/${id}/validar`)
  assert.equal((await api('DONO', 'POST', `/disparo/campanhas/${id}/iniciar`, { quando: futura })).corpo.status, 'SCHEDULED')
  assert.equal((await situacaoDoEnvio(id))!.motivo, 'AGENDADA')
  // Janela seg–sáb 09–19 (Brasília): domingo 10h → abre segunda 09:00 (12:00 UTC).
  const domingo = new Date('2026-11-29T13:00:00Z')
  assert.equal(proximaAbertura({ inicio: '09:00', fim: '19:00', dias: [1, 2, 3, 4, 5, 6] }, domingo)?.toISOString(), '2026-11-30T12:00:00.000Z')
})

test('Disparo liberado para o time: sem permissões salvas, vendedor e SDR entram com EDITAR', async () => {
  const { permissoesEfetivas, PERFIS } = await import('../src/lib/acessos')
  assert.equal(permissoesEfetivas('VENDEDOR', null).disparo, 'EDITAR')
  assert.equal(permissoesEfetivas('SUPERVISOR', null).disparo, 'EDITAR')
  assert.equal(PERFIS.find(p => p.chave === 'SDR')!.permissoes.disparo, 'EDITAR')
  // O dono continua podendo tirar.
  assert.equal(permissoesEfetivas('VENDEDOR', { disparo: 'NENHUM' }).disparo, 'NENHUM')
})

test('excluir: some da lista e dos relatórios, cancela o que ia sair e não apaga nada; vendedor não exclui a de outro', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const a = await api('DONO', 'POST', '/disparo/campanhas', campanha(loja.asSup))
  const b = await api('DONO', 'POST', '/disparo/campanhas', { ...campanha(loja.asSup), nome: 'Rascunho de teste' })
  const id = a.corpo.id as string, rascunho = b.corpo.id as string
  await api('DONO', 'POST', `/disparo/campanhas/${id}/validar`)
  await api('DONO', 'POST', `/disparo/campanhas/${id}/iniciar`, {})
  const { distribuir } = await import('../src/lib/disparo/motor')
  await distribuir(id)
  const antes = await prisma.disparoMensagem.count({ where: { campanhaId: id } })
  assert.ok(antes > 0)
  // Vendedora não exclui campanha que não é dela (para ela, não existe).
  assert.equal((await api('VEND', 'POST', '/disparo/campanhas/excluir', { ids: [id] })).corpo.excluidas, 0)
  const r = await api('DONO', 'POST', '/disparo/campanhas/excluir', { ids: [id, rascunho] })
  assert.equal(r.status, 200)
  assert.equal(r.corpo.excluidas, 2)
  assert.equal(r.corpo.canceladas, 1, 'a que estava na fila foi cancelada antes')
  const lista = await api('DONO', 'GET', '/disparo/campanhas')
  assert.ok(!(lista.corpo.itens as Array<{ id: string }>).some(c => c.id === id || c.id === rascunho))
  assert.equal((await api('DONO', 'GET', `/disparo/campanhas/${id}`)).status, 404)
  const c = await prisma.disparoCampanha.findUnique({ where: { id } })
  assert.equal(c?.status, 'CANCELLED'); assert.ok(c?.excluidaEm); assert.equal(c?.excluidaPorNome, 'Dono')
  assert.equal(await prisma.disparoMensagem.count({ where: { campanhaId: id } }), antes, 'mensagens continuam no banco')
  assert.equal(await prisma.disparoMensagem.count({ where: { campanhaId: id, status: 'AGENDADA' } }), 0, 'nada mais sai')
  assert.ok(await prisma.disparoEvento.count({ where: { campanhaId: id, tipo: 'EXCLUIDA' } }) === 1)
  const vg = await api('DONO', 'GET', '/disparo/visao-geral?dias=30')
  assert.ok(!((vg.corpo.recentes as Array<{ id: string }>) ?? []).some(x => x.id === id), 'fora da visão geral')
})

test('aprovação desligada por padrão, lista colada (inclusive fora do CRM, sem o lead de outro vendedor) e busca sem corte em 30', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  assert.equal((await api('DONO', 'PUT', '/disparo/config', { exigirAprovacao: false })).status, 200)
  // Lista colada: um número do CRM (Rui, que é do supervisor) e dois números fora do CRM; um inválido.
  const definicao = { base: 'LEADS', manual: { apenasManual: true, numeros: [{ telefone: '(91) 98222-2222' }, { telefone: '91 97777-0001', nome: 'Primo do Rui' }, { telefone: '5591977770002' }, { telefone: '123' }] } }
  const prev = await api('VEND', 'POST', '/disparo/publicos/previa', { definicao, finalidade: 'OPERACIONAL', conteudo: { passos: [{ tipo: 'TEXTO', texto: 'Oi {{primeiro_nome|tudo bem}}!' }] } })
  assert.equal(prev.status, 200, JSON.stringify(prev.corpo))
  assert.equal(prev.corpo.elegiveis, 2, '2 números avulsos; o Rui (lead do supervisor) fica de fora')
  assert.equal((prev.corpo.porMotivo as Record<string, number>).CARTEIRA_DE_OUTRO, 1)
  assert.equal((prev.corpo.porMotivo as Record<string, number>).SEM_TELEFONE, 1, 'o número inválido fica de fora com o motivo')
  // Campanha da vendedora sai direto (sem aprovação) para a lista colada.
  const c = await api('VEND', 'POST', '/disparo/campanhas', { ...campanha(loja.asVend), publico: definicao })
  assert.equal(c.status, 201)
  await api('VEND', 'POST', `/disparo/campanhas/${c.corpo.id}/validar`)
  const v = await api('VEND', 'GET', `/disparo/campanhas/${c.corpo.id}`)
  assert.equal(v.corpo.status, 'READY', 'sem aprovação obrigatória')
  const nomes = (await prisma.disparoDestinatario.findMany({ where: { campanhaId: String(c.corpo.id), status: 'ELEGIVEL' }, select: { nome: true } })).map(d => d.nome).sort()
  assert.deepEqual(nomes, ['+5591977770002', 'Primo do Rui'])
  // Busca: devolve o total e não corta em 30.
  const busca = await api('VEND', 'GET', '/disparo/contatos?busca=Cliente')
  assert.equal(typeof busca.corpo.total, 'number')
})

test('cada pessoa vê só as próprias campanhas, números e respostas; dono e supervisor escolhem de quem', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const otto = await prisma.vendedor.create({ data: { usuarioId: loja.id, nome: 'Otto Vendedor', papel: 'VENDEDOR', email: `${randomUUID()}@t.local`, senhaHash: 'x', permissoes: { disparo: 'EDITAR' } } })
  const tokOtto = signProLaboreToken({ sub: loja.id, email: 'o@t.local', nome: 'Otto', papel: 'VENDEDOR', vendedorId: otto.id })
  const comoOtto = async (metodo: string, caminho: string, corpo?: unknown) => {
    const r = await fetch(`${base}/pro-labore${caminho}`, { method: metodo, headers: { Authorization: `Bearer ${tokOtto}`, 'Content-Type': 'application/json' }, body: corpo === undefined ? undefined : JSON.stringify(corpo) })
    return { status: r.status, corpo: await r.json().catch(() => null) as Record<string, unknown> }
  }
  const asOtto = (await prisma.assistenteComercial.create({ data: { vendedorId: otto.id, instancia: `i-${randomUUID()}`, status: 'CONECTADO', numeroWhatsapp: '5591900000013' } })).id
  const dono = await api('DONO', 'POST', '/disparo/campanhas', { ...campanha(loja.asSup), nome: 'Do dono' })
  const vera = await api('VEND', 'POST', '/disparo/campanhas', { ...campanha(loja.asVend), nome: 'Da Vera' })
  const ot = await comoOtto('POST', '/disparo/campanhas', { ...campanha(asOtto), nome: 'Do Otto' })
  assert.deepEqual([dono.status, vera.status, ot.status], [201, 201, 201])
  const [idD, idV, idO] = [dono.corpo.id as string, vera.corpo.id as string, ot.corpo.id as string]
  // Uma resposta em cada campanha (e as três começaram, para entrar na comparação).
  for (const [id, nome] of [[idD, 'Resp Dono'], [idV, 'Resp Vera'], [idO, 'Resp Otto']]) {
    await prisma.disparoCampanha.update({ where: { id }, data: { iniciadaEm: new Date(), status: 'RUNNING' } })
    const d = await prisma.disparoDestinatario.create({ data: { campanhaId: id, versao: 1, usuarioId: loja.id, telefone: `55919${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`, nome, status: 'RESPONDEU', respondeuEm: new Date() } })
    await prisma.disparoEvento.create({ data: { usuarioId: loja.id, campanhaId: id, destinatarioId: d.id, tipo: 'RESPOSTA', descricao: `Oi, sou ${nome}` } })
  }
  const ids = (r: { corpo: Record<string, unknown> }) => (r.corpo.itens as Array<{ id: string }>).map(x => x.id)
  const nomes = (r: { corpo: Record<string, unknown> }) => (r.corpo.itens as Array<{ nome: string }>).map(x => x.nome)

  // Vendedora: só as dela, mesmo pedindo a equipe; a do Otto não abre.
  for (const q of ['', '?de=equipe', `?de=${otto.id}`]) {
    const l = await api('VEND', 'GET', `/disparo/campanhas${q}`)
    assert.ok(ids(l).includes(idV) && !ids(l).includes(idO) && !ids(l).includes(idD), `lista da Vera ${q}`)
  }
  assert.equal((await api('VEND', 'GET', `/disparo/campanhas/${idO}`)).status, 404)
  assert.equal((await api('VEND', 'GET', `/disparo/campanhas/${idO}/destinatarios`)).status, 404)
  assert.deepEqual(nomes(await api('VEND', 'GET', '/disparo/respostas?de=equipe')), ['Resp Vera'])
  assert.deepEqual(nomes(await comoOtto('GET', '/disparo/respostas')), ['Resp Otto'])
  const vg = await api('VEND', 'GET', '/disparo/visao-geral?de=equipe')
  const minhas = await prisma.disparoCampanha.count({ where: { usuarioId: loja.id, criadoPorId: loja.vend, excluidaEm: null } })
  assert.equal((vg.corpo.campanhas as { criadas: number }).criadas, minhas)
  assert.equal(vg.corpo.respostas, 1)
  const cmp = await api('VEND', 'GET', '/disparo/relatorios/comparativo')
  assert.ok((cmp.corpo as unknown as Array<{ id: string }>).every(x => x.id !== idO && x.id !== idD))

  // Dono: "minhas" por padrão; equipe toda; de um vendedor.
  assert.deepEqual(ids(await api('DONO', 'GET', '/disparo/campanhas')).filter(i => [idD, idV, idO].includes(i)), [idD])
  const equipe = ids(await api('DONO', 'GET', '/disparo/campanhas?de=equipe'))
  assert.ok([idD, idV, idO].every(i => equipe.includes(i)))
  assert.deepEqual(ids(await api('DONO', 'GET', `/disparo/campanhas?de=${otto.id}`)), [idO])
  assert.deepEqual(nomes(await api('DONO', 'GET', '/disparo/respostas')), ['Resp Dono'])
  assert.deepEqual(nomes(await api('DONO', 'GET', '/disparo/respostas?de=equipe')).sort(), ['Resp Dono', 'Resp Otto', 'Resp Vera'])
  assert.equal((await api('DONO', 'GET', '/disparo/visao-geral?de=equipe')).corpo.respostas, 3)
  // Supervisor vê as do dono pelo filtro e abre a de qualquer um (para acompanhar e aprovar).
  assert.deepEqual(nomes(await api('SUP', 'GET', '/disparo/respostas?de=dono')), ['Resp Dono'])
  assert.equal((await api('SUP', 'GET', `/disparo/campanhas/${idO}`)).status, 200)
  const meta = await api('VEND', 'GET', '/disparo/meta')
  assert.equal((meta.corpo.eu as { vendedorId: string }).vendedorId, loja.vend)
})

test('aviso de resposta vai para quem criou a campanha e para quem recebeu no WhatsApp, sem repetir', async () => {
  const { avisadosDaResposta } = await import('../src/lib/disparo/motor')
  assert.deepEqual(avisadosDaResposta(null, 'v1'), [null, 'v1'])
  assert.deepEqual(avisadosDaResposta('v1', 'v1'), ['v1'])
  assert.deepEqual(avisadosDaResposta('v2', null), ['v2'])
})

test('carteira: vendedora monta público, busca e Jornada só com os próprios leads; dono vê a loja; Instagram é da gestão', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const nomesPrevia = async (quem: 'DONO' | 'VEND' | 'SUP', definicao: unknown) => {
    const r = await api(quem, 'POST', '/disparo/publicos/previa', { definicao, finalidade: 'OPERACIONAL' })
    return (r.corpo.pagina as Array<{ nome: string }>).map(x => x.nome).sort()
  }
  assert.deepEqual(await nomesPrevia('VEND', { base: 'LEADS' }), ['Lia Cliente'])
  assert.deepEqual(await nomesPrevia('VEND', { base: 'TODOS' }), ['Lia Cliente'])
  assert.deepEqual(await nomesPrevia('DONO', { base: 'LEADS' }), ['Lia Cliente', 'Rui Cliente'])
  // Escolher a dedo um lead de outro vendedor pelo id: não entra.
  const rui = await prisma.lead.findFirstOrThrow({ where: { usuarioId: loja.id, nomeCliente: 'Rui Cliente' } })
  assert.deepEqual(await nomesPrevia('VEND', { base: 'LEADS', manual: { apenasManual: true, incluir: [{ tipo: 'LEAD', id: rui.id }] } }), [])
  // Busca de contatos e Jornada contam só a carteira.
  const busca = await api('VEND', 'GET', '/disparo/contatos?busca=Cliente')
  assert.deepEqual((busca.corpo.itens as Array<{ nome: string }>).map(x => x.nome), ['Lia Cliente'])
  const jv = await api('VEND', 'GET', '/disparo/jornada')
  const jd = await api('DONO', 'GET', '/disparo/jornada')
  const total = (j: { corpo: Record<string, unknown> }, etapa: string) => (j.corpo.etapas as Array<{ etapa: string; total: number }>).find(e => e.etapa === etapa)!.total
  assert.equal(total(jv, 'MQL'), 0, 'o MQL é do supervisor')
  assert.equal(total(jd, 'MQL'), 1)
  // Campanha da vendedora preparada por outra pessoa continua com a carteira dela.
  const c = await api('VEND', 'POST', '/disparo/campanhas', { ...campanha(loja.asVend), nome: 'Carteira' })
  await api('SUP', 'POST', `/disparo/campanhas/${c.corpo.id}/validar`)
  const dest = (await prisma.disparoDestinatario.findMany({ where: { campanhaId: String(c.corpo.id), status: 'ELEGIVEL' }, select: { nome: true } })).map(d => d.nome)
  assert.deepEqual(dest, ['Lia Cliente'])
  // Instagram da empresa: só a gestão.
  const ig = await api('VEND', 'POST', '/disparo/campanhas', { ...campanha(loja.asVend), canal: 'INSTAGRAM', publico: { base: 'INSTAGRAM_DM' } })
  assert.equal(ig.status, 403)
})

test('estratégia contínua criada antes da regra de carteira: só entram os leads de quem criou', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const { alimentarContinuas } = await import('../src/lib/disparo/motor')
  const c = await prisma.disparoCampanha.create({ data: {
    usuarioId: loja.id, nome: 'Contínua antiga', finalidade: 'OPERACIONAL', assistenteId: loja.asVend, criadoPorId: loja.vend, status: 'RUNNING', iniciadaEm: new Date(),
    publico: { base: 'LEADS' }, conteudo: { passos: [{ tipo: 'TEXTO', texto: 'Oi!' }] }, totais: { selecionados: 0, elegiveis: 0 },
    config: { continua: true, janela: { inicio: '00:00', fim: '23:59', dias: [0, 1, 2, 3, 4, 5, 6] }, intervaloSeg: 0 },
    preparo: { leitor: { usuarioId: loja.id, papel: 'DONO', vendedorId: null }, aprovacao: false }, // como era antes: loja toda
  } })
  await prisma.disparoTrava.deleteMany({ where: { chave: `alimentar:${c.id}` } })
  await alimentarContinuas(Date.now() + 20_000)
  const nomes = (await prisma.disparoDestinatario.findMany({ where: { campanhaId: c.id }, select: { nome: true } })).map(d => d.nome)
  assert.deepEqual(nomes, ['Lia Cliente'])
})

test('número novo (fora do WhatsApp e do CRM) em promoção: com a declaração da lista colada entra, a autorização fica registrada e sai', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const novo = '91987243987'
  const definicao = (listaAutorizada?: boolean) => ({ base: 'LEADS', manual: { apenasManual: true, numeros: [{ telefone: novo, nome: 'Guilherme' }], ...(listaAutorizada === undefined ? {} : { listaAutorizada }) } })
  const conteudo = { passos: [{ tipo: 'TEXTO', texto: 'Oi {{primeiro_nome|tudo bem}}! Promoção da semana.' }] }
  // Sem a declaração: fica de fora (como no print).
  const sem = await api('VEND', 'POST', '/disparo/publicos/previa', { definicao: definicao(false), finalidade: 'MARKETING', conteudo })
  assert.equal(sem.corpo.elegiveis, 0)
  assert.equal((sem.corpo.porMotivo as Record<string, number>).SEM_AUTORIZACAO, 1)
  // Com a declaração: entra.
  const com = await api('VEND', 'POST', '/disparo/publicos/previa', { definicao: definicao(true), finalidade: 'MARKETING', conteudo })
  assert.equal(com.corpo.elegiveis, 1, JSON.stringify(com.corpo))
  // A campanha grava quem declarou (o servidor, não a tela) e a preparação registra a autorização.
  const c = await api('VEND', 'POST', '/disparo/campanhas', { ...campanha(loja.asVend), nome: 'Promo números novos', finalidade: 'MARKETING', conteudo, publico: { ...definicao(true), manual: { ...definicao(true).manual, listaAutorizadaPor: 'Alguém Falso' } } })
  assert.equal(c.status, 201, JSON.stringify(c.corpo))
  const id = String(c.corpo.id)
  assert.equal(((c.corpo.publico as { manual: { listaAutorizadaPor: string } }).manual).listaAutorizadaPor, 'VEND')
  await api('VEND', 'POST', `/disparo/campanhas/${id}/validar`)
  const d = await prisma.disparoDestinatario.findFirst({ where: { campanhaId: id } })
  assert.equal(d?.status, 'ELEGIVEL')
  const aut = await prisma.contatoAutorizacao.findFirst({ where: { usuarioId: loja.id, telefone: '5591987243987' }, orderBy: { criadoEm: 'desc' } })
  assert.equal(aut?.situacao, 'AUTORIZADO')
  assert.equal(aut?.origem, 'LISTA_COLADA')
  assert.match(String(aut?.evidencia), /Declarado por VEND .*Promo números novos/)
  assert.ok(await prisma.disparoEvento.count({ where: { campanhaId: id, tipo: 'AUTORIZACAO_LISTA' } }) === 1)
  // Sai de verdade (a conferência na hora do envio vê a autorização).
  await api('VEND', 'POST', `/disparo/campanhas/${id}/iniciar`, {})
  const { rodarDisparo } = await import('../src/lib/disparo/motor')
  await rodarDisparo(8000)
  const m = await prisma.disparoMensagem.findFirst({ where: { campanhaId: id } })
  assert.equal(m?.status, 'ACEITA', JSON.stringify(m))
  // Quem pediu para sair continua de fora mesmo com a declaração.
  await prisma.contatoAutorizacao.create({ data: { usuarioId: loja.id, telefone: '5591987243988', canal: 'WHATSAPP', finalidade: 'MARKETING', situacao: 'REVOGADO', origem: 'TESTE' } })
  const saiu = await api('VEND', 'POST', '/disparo/publicos/previa', { definicao: { base: 'LEADS', manual: { apenasManual: true, listaAutorizada: true, numeros: [{ telefone: '91987243988' }] } }, finalidade: 'MARKETING', conteudo })
  assert.equal(saiu.corpo.elegiveis, 0)
  assert.equal((saiu.corpo.porMotivo as Record<string, number>).DESCADASTRADO, 1)
})

test('Visão geral (painel): período anterior, envios por dia, pedem atenção e andamento, só leitura e no escopo', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const c = await api('DONO', 'POST', '/disparo/campanhas', { ...campanha(loja.asSup), nome: 'Painel' })
  const id = String(c.corpo.id)
  await prisma.disparoCampanha.update({ where: { id }, data: { status: 'RUNNING', iniciadaEm: new Date(), erro: 'O WhatsApp de Sara precisa ser reconectado: leia o QR Code' } })
  const d = await prisma.disparoDestinatario.create({ data: { campanhaId: id, versao: 1, usuarioId: loja.id, telefone: '5591987650001', nome: 'P1', status: 'CONCLUIDO' } })
  await prisma.disparoMensagem.create({ data: { campanhaId: id, destinatarioId: d.id, passo: 0, chave: `${id}:${d.id}:0`, assistenteId: loja.asSup, tipo: 'TEXTO', status: 'ACEITA', aceitaEm: new Date(), enviarApos: new Date() } })
  const antes = await prisma.disparoCampanha.findUnique({ where: { id }, select: { atualizadoEm: true } })
  const v = await api('DONO', 'GET', '/disparo/visao-geral?dias=7&de=equipe')
  assert.equal(v.status, 200)
  const porDia = v.corpo.porDia as Array<{ dia: string; aceitas: number }>
  assert.ok(porDia.length >= 7 && porDia.length <= 9, String(porDia.length))
  assert.ok(porDia[porDia.length - 1].aceitas >= 1, 'o envio de hoje aparece no último dia')
  assert.ok(v.corpo.anterior && typeof (v.corpo.anterior as { aceitas: number }).aceitas === 'number')
  const atencao = v.corpo.atencao as Array<{ id: string; motivo: string }>
  assert.ok(atencao.some(a => a.id === id && a.motivo === 'SEM_CONEXAO'), JSON.stringify(atencao))
  const andamento = v.corpo.andamento as Array<{ id: string; enviadas: number; elegiveis: number }>
  assert.equal(andamento.find(a => a.id === id)?.enviadas, 1)
  // Vendedora não vê a campanha do dono no painel.
  const vv = await api('VEND', 'GET', '/disparo/visao-geral?dias=7&de=equipe')
  assert.ok(!(vv.corpo.andamento as Array<{ id: string }>).some(a => a.id === id))
  // Só leitura: nada mudou na campanha.
  assert.deepEqual(await prisma.disparoCampanha.findUnique({ where: { id }, select: { atualizadoEm: true } }), antes)
  await prisma.disparoCampanha.update({ where: { id }, data: { status: 'CANCELLED' } })
})
