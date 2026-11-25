// ARIES DISPARO — testes de regras, público, motor, webhooks e integração com o CRM.
// Rodam num banco de teste (DATABASE_URL) com o provedor de teste (nenhuma mensagem sai de verdade).
// Cada execução cria uma loja nova e não toca em nenhuma outra. Sem banco, os de banco são pulados.
process.env.DISPARO_TESTE_SEM_RITMO = '1'
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../src/lib/prisma'
import { classificarErro, normalizarTelefone, pedeParaSair, podeIr, renderizar, esperaDaTentativa, lerConfigLoja } from '../src/lib/disparo/regras'
import { resolverPublico, passaGrupo, type Contato } from '../src/lib/disparo/publico'
import { registrarAutorizacao } from '../src/lib/disparo/autorizacao'
import { cancelarCampanha, distribuir, prepararCampanha, rodarDisparo, transicionar, atualizarStatusDoProvedor, reconciliar } from '../src/lib/disparo/motor'
import { resumoCampanha } from '../src/lib/disparo/relatorios'
import { ErroEnvio, criarProvedorFalso, definirProvedor, type ProvedorFalso } from '../src/lib/disparo/provedor'
import { processarWebhookAssistente } from '../src/lib/assistenteMotor'

let temBanco = false
let falso: ProvedorFalso
const loja = { id: '', ana: '', bruno: '', asAna: '', segredoAna: '', leads: [] as string[] }
const TEL = (i: number) => `55919${String(80000000 + i).padStart(8, '0')}`
const JANELA_TODA = { janela: { inicio: '00:00', fim: '23:59', dias: [0, 1, 2, 3, 4, 5, 6] }, intervaloSeg: 0 }
const dono = () => ({ usuarioId: loja.id, papel: 'DONO', vendedorId: null })

before(async () => {
  try { await prisma.$queryRaw`SELECT 1 FROM pro_labore_disparo_campanhas LIMIT 1`; temBanco = true } catch { return }
  falso = criarProvedorFalso()
  definirProvedor(falso)
  const u = await prisma.proLaboreUsuario.create({ data: { nome: 'Loja Disparo', email: `disparo-${randomUUID()}@t.local`, senhaHash: 'x' } })
  loja.id = u.id
  const [a, b] = await Promise.all([
    prisma.vendedor.create({ data: { usuarioId: u.id, nome: 'Naiza Vendedora', papel: 'VENDEDOR' } }),
    prisma.vendedor.create({ data: { usuarioId: u.id, nome: 'Bruno Vendedor', papel: 'VENDEDOR' } }),
  ])
  loja.ana = a.id; loja.bruno = b.id
  loja.segredoAna = randomUUID()
  const as = await prisma.assistenteComercial.create({ data: { vendedorId: a.id, instancia: `inst-${randomUUID()}`, webhookSegredo: loja.segredoAna, status: 'CONECTADO', numeroWhatsapp: '5591900000001' } })
  loja.asAna = as.id
  // 6 leads da Naiza (um sem telefone), 2 do Bruno; um cliente com o mesmo número de um lead (duplicado).
  const dados: Array<[string, string | null, string, string]> = [
    ['Carlos Souza', TEL(1), a.id, 'NEGOCIACAO'], ['Débora Lima', TEL(2), a.id, 'LEAD'], ['Eva Rocha', TEL(3), a.id, 'MQL'],
    ['Fábio Melo', TEL(4), a.id, 'PROPOSTA'], ['Sem Telefone', null, a.id, 'LEAD'], ['Gil Prado', `(91) ${TEL(6).slice(4, 9)}-${TEL(6).slice(9)}`, a.id, 'LEAD'],
    ['Helena Bruno', TEL(7), b.id, 'LEAD'], ['Igor Bruno', TEL(8), b.id, 'SQL'],
  ]
  for (const [nome, tel, vend, etapa] of dados) {
    const l = await prisma.lead.create({ data: { usuarioId: u.id, vendedorId: vend, nomeCliente: nome, telefone: tel, etapa, modeloInteresse: nome.startsWith('Carlos') ? 'Honda CG 160' : null, levantamento: nome.startsWith('Carlos') ? { cidade: 'Belém' } : undefined } })
    loja.leads.push(l.id)
  }
  await prisma.cliente.create({ data: { usuarioId: u.id, nome: 'Carlos Souza (cliente)', telefone: TEL(1) } })
})
after(() => definirProvedor(null))

// ---------- Regras puras ----------

test('telefone: normaliza, recusa inválidos', () => {
  assert.equal(normalizarTelefone('(91) 98888-7777'), '5591988887777')
  assert.equal(normalizarTelefone('+55 91 98888-7777'), '5591988887777')
  assert.equal(normalizarTelefone('123'), null)
  assert.equal(normalizarTelefone('(91) 99999-9999'), null, 'número repetido não vale')
})

test('variáveis: troca, usa o alternativo e nunca deixa {{…}} sem valor', () => {
  const r = renderizar('Oi {{primeiro_nome}}, a {{modelo_interesse|moto}} chegou em {{cidade}}!', { primeiro_nome: 'Carlos', modelo_interesse: null, cidade: null })
  assert.equal(r.faltando.join(), 'cidade')
  assert.ok(!r.texto.includes('{{'))
  assert.match(r.texto, /Oi Carlos, a moto chegou/)
  assert.deepEqual(renderizar('Oi {{cidade}}', {}, { cidade: 'sua cidade' }).faltando, [])
  assert.deepEqual(renderizar('{{desconhecida}}', {}).desconhecidas, ['desconhecida'])
})

test('estados, erros, espera, descadastro', () => {
  assert.equal(podeIr('DRAFT', 'RUNNING'), false)
  assert.equal(podeIr('RUNNING', 'PAUSED'), true)
  assert.equal(podeIr('COMPLETED', 'RUNNING'), false)
  assert.equal(classificarErro({ message: 'number does not exist on WhatsApp' }), 'DEFINITIVO')
  assert.equal(classificarErro({ message: 'Connection Closed' }), 'CONEXAO')
  assert.equal(classificarErro({ message: 'x', talvezEnviado: true }), 'DESCONHECIDO')
  assert.equal(classificarErro({ message: 'Internal Server Error', status: 500 }), 'TEMPORARIO')
  assert.ok(esperaDaTentativa(1, 0) >= 45_000 && esperaDaTentativa(3, 1) <= 300_000)
  assert.equal(pedeParaSair('SAIR'), true)
  assert.equal(pedeParaSair('Não quero mais'), true)
  assert.equal(pedeParaSair('quero sair de casa e ir aí ver a moto amanhã cedo'), false)
})

test('filtros E/OU', () => {
  const c = { etapa: 'MQL', vendedorId: 'v1', situacao: 'ABERTO', autorizacao: null } as unknown as Contato
  assert.equal(passaGrupo(c, { op: 'E', itens: [{ campo: 'etapa', op: 'em', valor: ['MQL', 'SQL'] }, { campo: 'vendedor', op: 'igual', valor: 'v1' }] }), true)
  assert.equal(passaGrupo(c, { op: 'E', itens: [{ campo: 'etapa', op: 'igual', valor: 'LEAD' }, { campo: 'vendedor', op: 'igual', valor: 'v1' }] }), false)
  assert.equal(passaGrupo(c, { op: 'OU', itens: [{ campo: 'etapa', op: 'igual', valor: 'LEAD' }, { op: 'E', itens: [{ campo: 'situacao', op: 'igual', valor: 'ABERTO' }] }] }), true)
})

// ---------- Público ----------

test('público: um por número, sem telefone e duplicado contados uma vez; marketing exige autorização', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const cfg = lerConfigLoja({})
  const r = await resolverPublico(dono(), { base: 'TODOS' }, { finalidade: 'MARKETING', config: cfg })
  assert.equal(r.porMotivo.SEM_TELEFONE, 1)
  assert.equal(r.porMotivo.DUPLICADO, 1, 'o cliente com o mesmo número do lead')
  assert.equal(r.elegiveis.length, 0, 'sem autorização registrada, nada promocional sai')
  assert.equal(r.porMotivo.SEM_AUTORIZACAO, 7)
  assert.equal(r.selecionados, r.elegiveis.length + Object.values(r.porMotivo).reduce((a, b) => a + b, 0), 'cada contato em um motivo só')
  const op = await resolverPublico(dono(), { base: 'TODOS' }, { finalidade: 'OPERACIONAL', config: cfg })
  assert.equal(op.elegiveis.length, 7, 'aviso operacional não depende da autorização de marketing')
  const rel = await resolverPublico(dono(), { base: 'LEADS' }, { finalidade: 'MARKETING', config: lerConfigLoja({ baseMarketing: 'RELACAO' }) })
  assert.equal(rel.elegiveis.length, 7, 'com relação comercial (opção da loja) os leads entram')
})

test('público: revogado e bloqueado saem; filtros e seleção manual; escopo do vendedor', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const cfg = lerConfigLoja({})
  for (let i = 1; i <= 4; i++) await registrarAutorizacao({ usuarioId: loja.id, telefone: TEL(i), situacao: 'AUTORIZADO', baseLegal: 'CONSENTIMENTO', evidencia: 'Formulário da loja', origem: 'MANUAL' })
  await registrarAutorizacao({ usuarioId: loja.id, telefone: TEL(3), situacao: 'REVOGADO', origem: 'MANUAL' })
  await registrarAutorizacao({ usuarioId: loja.id, telefone: TEL(4), situacao: 'BLOQUEADO', origem: 'MANUAL' })
  const r = await resolverPublico(dono(), { base: 'LEADS' }, { finalidade: 'MARKETING', config: cfg })
  assert.deepEqual(r.elegiveis.map(c => c.telefone).sort(), [TEL(1), TEL(2)])
  assert.equal(r.porMotivo.DESCADASTRADO, 1)
  assert.equal(r.porMotivo.BLOQUEADO, 1)
  const filtro = await resolverPublico(dono(), { base: 'LEADS', filtros: { op: 'E', itens: [{ campo: 'etapa', op: 'em', valor: ['NEGOCIACAO', 'PROPOSTA'] }] } }, { finalidade: 'OPERACIONAL', config: cfg })
  assert.equal(filtro.elegiveis.length, 1, 'Fábio (proposta) está bloqueado; fica o Carlos')
  const manual = await resolverPublico(dono(), { base: 'LEADS', manual: { apenasManual: true, incluir: [{ tipo: 'LEAD', id: loja.leads[1] }, { tipo: 'LEAD', id: loja.leads[6] }], excluir: [TEL(7)] } }, { finalidade: 'OPERACIONAL', config: cfg })
  assert.deepEqual(manual.elegiveis.map(c => c.nome), ['Débora Lima'])
  assert.equal(manual.porMotivo.RETIRADO, 1)
  const bruno = await resolverPublico({ usuarioId: loja.id, papel: 'VENDEDOR', vendedorId: loja.bruno }, { base: 'LEADS' }, { finalidade: 'OPERACIONAL', config: cfg })
  assert.ok(bruno.elegiveis.every(c => c.vendedorId === loja.bruno) && bruno.elegiveis.length === 2, 'vendedor vê só a própria carteira')
  const vars = await resolverPublico(dono(), { base: 'LEADS' }, { finalidade: 'OPERACIONAL', config: cfg, conteudo: { passos: [{ tipo: 'TEXTO', texto: 'Oi {{primeiro_nome}}, de {{cidade}}' }] } })
  assert.equal(vars.elegiveis.length, 1, 'só o Carlos tem cidade')
  assert.ok(vars.porMotivo.VARIAVEL_SEM_VALOR >= 4)
})

// ---------- Campanha de ponta a ponta ----------

async function criarCampanha(nome: string, extra: Partial<Prisma.DisparoCampanhaUncheckedCreateInput> = {}) {
  const c = await prisma.disparoCampanha.create({
    data: {
      usuarioId: loja.id, nome, finalidade: 'OPERACIONAL', assistenteId: loja.asAna,
      publico: { base: 'LEADS', filtros: { op: 'E', itens: [{ campo: 'vendedor', op: 'igual', valor: loja.ana }] } },
      conteudo: { passos: [{ tipo: 'TEXTO', texto: 'Oi {{primeiro_nome}}! Novidade na loja.' }, { tipo: 'TEXTO', texto: 'Quer que eu te mande as condições, {{primeiro_nome}}?', esperarMin: 0 }] },
      config: JANELA_TODA, preparo: { leitor: dono(), aprovacao: false }, status: 'VALIDATING', ...extra,
    },
  })
  return c
}
async function iniciarJa(id: string) {
  assert.ok(await prepararCampanha(id))
  assert.ok(await transicionar(id, 'QUEUED', { de: ['READY'] }))
}

test('campanha: prepara, envia a sequência sem {{…}}, conclui; duas rodadas ao mesmo tempo não repetem envio', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  falso.enviados.length = 0
  const c = await criarCampanha('Sequência')
  await iniciarJa(c.id)
  const pre = await prisma.disparoCampanha.findUnique({ where: { id: c.id }, select: { totais: true } })
  assert.equal((pre!.totais as { elegiveis: number }).elegiveis, 4, 'Carlos, Débora, Eva (revogou só o marketing; o aviso é operacional) e Gil; Fábio está bloqueado')
  await Promise.all([rodarDisparo(8000), rodarDisparo(8000)])
  await rodarDisparo(8000)
  const final = await prisma.disparoCampanha.findUnique({ where: { id: c.id }, select: { status: true } })
  assert.equal(final?.status, 'COMPLETED')
  const daCampanha = falso.enviados.filter(e => e.assistenteId === loja.asAna)
  const porDestinoPasso = new Map<string, number>()
  for (const e of daCampanha) porDestinoPasso.set(`${e.destino}:${e.texto.slice(0, 10)}`, (porDestinoPasso.get(`${e.destino}:${e.texto.slice(0, 10)}`) ?? 0) + 1)
  assert.ok([...porDestinoPasso.values()].every(n => n === 1), 'nenhum envio repetido')
  assert.equal(daCampanha.length, 8, '4 destinatários × 2 passos')
  assert.ok(daCampanha.every(e => !e.texto.includes('{{')))
  const r = await resumoCampanha(c.id)
  assert.equal(r?.aceitas, 8)
  assert.equal(r?.falhas, 0)
})

test('pausa, retomada e cancelamento', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  falso.enviados.length = 0
  const c = await criarCampanha('Pausa')
  await iniciarJa(c.id)
  await transicionar(c.id, 'PAUSED', { de: ['QUEUED'] })
  await rodarDisparo(4000)
  assert.equal(falso.enviados.length, 0, 'pausada não envia')
  await transicionar(c.id, 'QUEUED', { de: ['PAUSED'] })
  await rodarDisparo(6000)
  assert.ok(falso.enviados.length > 0, 'retomada envia')
  const c2 = await criarCampanha('Cancelar')
  await iniciarJa(c2.id)
  await distribuir(c2.id)
  await cancelarCampanha(c2.id, 'Teste')
  const pend = await prisma.disparoMensagem.count({ where: { campanhaId: c2.id, status: 'AGENDADA' } })
  assert.equal(pend, 0, 'nada agendado depois de cancelar')
  const antes = falso.enviados.length
  await rodarDisparo(4000)
  assert.equal(falso.enviados.filter((_, i) => i >= antes).filter(e => e.texto.includes('Novidade')).length, 0, 'cancelada não envia')
})

test('resultado desconhecido é reconciliado sem reenviar; temporário repete; definitivo não', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  falso.enviados.length = 0
  falso.falhas.set(TEL(1), 'DESCONHECIDO')
  falso.falhas.set(TEL(2), 'DEFINITIVO')
  const c = await criarCampanha('Falhas', { conteudo: { passos: [{ tipo: 'TEXTO', texto: 'Aviso para {{primeiro_nome}}' }] } })
  await iniciarJa(c.id)
  await rodarDisparo(6000)
  const ms = await prisma.disparoMensagem.findMany({ where: { campanhaId: c.id }, include: { destinatario: { select: { telefone: true } } } })
  const de = (tel: string) => ms.find(m => m.destinatario.telefone === tel)!
  assert.equal(de(TEL(2)).status, 'FALHOU')
  assert.equal(de(TEL(2)).erroClasse, 'DEFINITIVO')
  // O desconhecido já foi reconciliado na própria rodada seguinte (o provedor de teste "tinha enviado").
  await reconciliar()
  const desc = await prisma.disparoMensagem.findUnique({ where: { id: de(TEL(1)).id } })
  assert.equal(desc?.status, 'ACEITA', 'confirmada no WhatsApp')
  assert.equal(falso.enviados.filter(e => e.destino === TEL(1) && e.texto.startsWith('Aviso')).length, 1, 'não reenviou')
  const tents = await prisma.disparoTentativa.findMany({ where: { mensagemId: desc!.id } })
  assert.ok(tents.some(x => x.resultado === 'RECONCILIADA'))
  falso.falhas.clear()
  // Temporário: volta para a fila com espera.
  falso.falhas.set(TEL(6), 'TEMPORARIO')
  const c2 = await criarCampanha('Temporario', { conteudo: { passos: [{ tipo: 'TEXTO', texto: 'Outro aviso {{primeiro_nome}}' }] } })
  await iniciarJa(c2.id)
  await rodarDisparo(5000)
  const tmp = await prisma.disparoMensagem.findFirst({ where: { campanhaId: c2.id, destinatario: { telefone: TEL(6) } } })
  assert.equal(tmp?.status, 'AGENDADA')
  assert.equal(tmp?.tentativas, 1)
  assert.ok(tmp!.proximaTentativaEm! > new Date(), 'espera antes de repetir')
  falso.falhas.clear()
})

test('processo caiu no meio do envio: vira desconhecido e é reconciliado', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const c = await criarCampanha('Queda', { conteudo: { passos: [{ tipo: 'TEXTO', texto: 'Queda {{primeiro_nome}}' }] } })
  await iniciarJa(c.id)
  await distribuir(c.id)
  const m = await prisma.disparoMensagem.findFirst({ where: { campanhaId: c.id } })
  await prisma.disparoMensagem.update({ where: { id: m!.id }, data: { status: 'ENVIANDO', travadaEm: new Date(Date.now() - 10 * 60_000) } })
  const r = await reconciliar()
  assert.ok(r.recuperadas >= 1)
  const depois = await prisma.disparoMensagem.findUnique({ where: { id: m!.id } })
  assert.equal(depois?.status, 'DESCONHECIDO', 'não manda de novo às cegas (o provedor de teste não tem registro dela)')
})

test('revogação durante a campanha cancela o que ainda não saiu', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const c = await criarCampanha('Revogação', { finalidade: 'MARKETING', conteudo: { passos: [{ tipo: 'TEXTO', texto: 'Promo 1 {{primeiro_nome}}' }, { tipo: 'TEXTO', texto: 'Promo 2', esperarMin: 600 }] } })
  await iniciarJa(c.id)
  await rodarDisparo(5000)
  const prox = await prisma.disparoMensagem.findFirst({ where: { campanhaId: c.id, passo: 1, destinatario: { telefone: TEL(1) } } })
  assert.equal(prox?.status, 'AGENDADA')
  await registrarAutorizacao({ usuarioId: loja.id, telefone: TEL(1), situacao: 'REVOGADO', origem: 'MANUAL' })
  const depois = await prisma.disparoMensagem.findUnique({ where: { id: prox!.id } })
  assert.equal(depois?.status, 'CANCELADA')
})

test('webhook: entregue e lida (só avança); resposta para a sequência, entra no CRM e avisa; SAIR descadastra; eco não vira conversa pessoal', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  falso.enviados.length = 0
  await registrarAutorizacao({ usuarioId: loja.id, telefone: TEL(2), situacao: 'AUTORIZADO', baseLegal: 'CONSENTIMENTO', evidencia: 'teste', origem: 'MANUAL' })
  const c = await criarCampanha('Respostas', { publico: { base: 'LEADS', manual: { apenasManual: true, incluir: [{ tipo: 'LEAD', id: loja.leads[1] }] } }, conteudo: { passos: [{ tipo: 'TEXTO', texto: 'Oi {{primeiro_nome}}' }, { tipo: 'TEXTO', texto: 'Segunda', esperarMin: 600 }] } })
  await iniciarJa(c.id)
  await rodarDisparo(5000)
  const m = await prisma.disparoMensagem.findFirst({ where: { campanhaId: c.id, passo: 0 } })
  assert.ok(m?.providerId)
  // Eco do envio (fromMe) não marca o contato como conversa pessoal do vendedor.
  await processarWebhookAssistente(loja.segredoAna, { event: 'messages.upsert', data: { key: { remoteJid: `${TEL(2)}@s.whatsapp.net`, fromMe: true, id: m!.providerId }, message: { conversation: 'Oi Débora' }, messageTimestamp: Math.floor(Date.now() / 1000) } })
  assert.equal(await prisma.assistenteContatoIgnorado.count({ where: { assistenteId: loja.asAna, numero: TEL(2) } }), 0)
  await atualizarStatusDoProvedor([{ providerId: m!.providerId!, status: 'READ' }])
  await atualizarStatusDoProvedor([{ providerId: m!.providerId!, status: 'DELIVERY_ACK' }])
  const lida = await prisma.disparoMensagem.findUnique({ where: { id: m!.id } })
  assert.equal(lida?.status, 'LIDA', 'entregue depois de lida não volta')
  assert.ok(lida?.entregueEm)
  // Resposta do cliente pelo webhook normal do WhatsApp.
  await processarWebhookAssistente(loja.segredoAna, { event: 'messages.upsert', data: { key: { remoteJid: `${TEL(2)}@s.whatsapp.net`, fromMe: false, id: `R${randomUUID()}` }, pushName: 'Débora', message: { conversation: 'Tenho interesse sim!' }, messageTimestamp: Math.floor(Date.now() / 1000) } })
  const d = await prisma.disparoDestinatario.findFirst({ where: { campanhaId: c.id } })
  assert.equal(d?.status, 'RESPONDEU')
  assert.ok(d?.respostaConversaId, 'ligada à conversa do ARIES')
  assert.equal(await prisma.disparoMensagem.count({ where: { campanhaId: c.id, status: 'AGENDADA' } }), 0, 'a sequência parou')
  const conv = await prisma.assistenteConversa.findUnique({ where: { id: d!.respostaConversaId! }, include: { mensagens: { orderBy: { criadoEm: 'asc' } } } })
  assert.equal(conv?.leadId, loja.leads[1], 'mesmo lead, sem duplicar')
  assert.equal(conv?.robo, false, 'o robô não se apresenta para quem respondeu campanha')
  assert.ok(conv!.mensagens.some(x => x.origem === 'DISPARO'), 'a mensagem da campanha está no histórico da conversa')
  assert.equal(await prisma.lead.count({ where: { usuarioId: loja.id } }), 8, 'nenhum lead novo (a resposta caiu no lead que já existia)')
  assert.equal(await prisma.leadFollow.count({ where: { leadId: loja.leads[1], status: 'PENDENTE' } }), 1, 'follow para o vendedor responder')
  // SAIR
  await processarWebhookAssistente(loja.segredoAna, { event: 'messages.upsert', data: { key: { remoteJid: `${TEL(2)}@s.whatsapp.net`, fromMe: false, id: `S${randomUUID()}` }, message: { conversation: 'SAIR' }, messageTimestamp: Math.floor(Date.now() / 1000) } })
  const ult = await prisma.contatoAutorizacao.findFirst({ where: { usuarioId: loja.id, telefone: TEL(2) }, orderBy: { criadoEm: 'desc' } })
  assert.equal(ult?.situacao, 'REVOGADO')
  assert.equal(ult?.origem, 'RESPOSTA_SAIR')
})

test('prioridade do atendimento e número desconectado', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  falso.enviados.length = 0
  const c = await criarCampanha('Prioridade', { conteudo: { passos: [{ tipo: 'TEXTO', texto: 'Prioridade {{primeiro_nome}}' }] } })
  await iniciarJa(c.id)
  falso.conectado = false
  await rodarDisparo(8000)
  assert.equal(falso.enviados.length, 0)
  const cc = await prisma.disparoCampanha.findUnique({ where: { id: c.id }, select: { erro: true, status: true } })
  assert.match(String(cc?.erro), /desconectado/)
  assert.equal(await prisma.disparoTentativa.count({ where: { mensagem: { campanhaId: c.id } } }), 0, 'sem conexão não gasta tentativa')
  falso.conectado = true
  // Atendimento em curso neste número: a campanha espera.
  const conv = await prisma.assistenteConversa.create({ data: { assistenteId: loja.asAna, tipo: 'LEAD', nomeContato: 'Cliente atendido', numeroContato: '5591911112222', mensagens: { create: { remetente: 'CONTATO', texto: 'Oi' } } } })
  await rodarDisparo(8000)
  assert.equal(falso.enviados.length, 0, 'atendimento individual tem prioridade')
  const est = await prisma.disparoTrava.findUnique({ where: { chave: `estado:remetente:${loja.asAna}` } })
  assert.equal((est?.dados as { motivo: string }).motivo, 'ATENDIMENTO', 'a tela fica sabendo por que não saiu')
  // Número movimentado: a rodada espera o silêncio (8 s) e envia na mesma rodada, sem desistir.
  await prisma.assistenteMensagem.updateMany({ where: { conversa: { assistenteId: loja.asAna } }, data: { criadoEm: new Date(Date.now() - 4000) } })
  await rodarDisparo(15_000)
  assert.ok(falso.enviados.length > 0, 'depois do silêncio do atendimento, a campanha segue na mesma rodada')
  void conv
})

test('"Connection Closed": o motor religa a sessão uma vez e continua; se não voltar, avisa na campanha', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  await prisma.assistenteMensagem.updateMany({ where: { conversa: { assistenteId: loja.asAna } }, data: { criadoEm: new Date(Date.now() - 120_000) } })
  await prisma.disparoTrava.updateMany({ where: { chave: `reiniciar:${loja.asAna}` }, data: { ate: new Date(0) } })
  falso.enviados.length = 0
  const c = await criarCampanha('Sessão caída', { conteudo: { passos: [{ tipo: 'TEXTO', texto: 'Sessão {{primeiro_nome}}' }] } })
  await iniciarJa(c.id)
  // verificarConexao diz conectado, mas o envio falha com "connection closed" até religar.
  const enviarOriginal = falso.enviar.bind(falso)
  let caida = true
  falso.enviar = async (r, d, e) => { if (caida) throw new ErroEnvio('Connection Closed', 'CONEXAO'); return enviarOriginal(r, d, e) }
  falso.religaAoReconectar = true
  const antes = falso.reconexoes
  const reconectarOriginal = falso.reconectar.bind(falso)
  falso.reconectar = async r => { caida = false; return reconectarOriginal(r) }
  await rodarDisparo(20_000)
  assert.ok(falso.reconexoes > antes, 'religou a sessão')
  assert.equal(await prisma.disparoEvento.count({ where: { campanhaId: c.id, tipo: 'RECONEXAO' } }), 1, 'uma vez só por número nesta janela de 5 min')
  assert.ok(falso.enviados.length > 0, 'depois de religar, enviou')
  assert.equal(await prisma.disparoTentativa.count({ where: { mensagem: { campanhaId: c.id }, resultado: 'FALHA_DEFINITIVA' } }), 0)
  assert.ok(await prisma.disparoEvento.count({ where: { campanhaId: c.id, tipo: 'RECONEXAO' } }) >= 1)
  // Caiu de novo dentro de 5 min: não reinicia outra vez; a campanha mostra o aviso e nada é perdido.
  caida = true
  falso.reconectar = async () => { caida = true; return false }
  const c2 = await criarCampanha('Sessão caída 2', { conteudo: { passos: [{ tipo: 'TEXTO', texto: 'Outra {{primeiro_nome}}' }] } })
  await iniciarJa(c2.id)
  await rodarDisparo(20_000)
  const cc = await prisma.disparoCampanha.findUnique({ where: { id: c2.id }, select: { erro: true } })
  assert.match(String(cc?.erro), /precisa ser reconectado/)
  // Reiniciou há pouco e continua recusando: "precisa reconectar" — a tela pede o QR e o motor para de tentar.
  assert.equal((await prisma.assistenteComercial.findUnique({ where: { id: loja.asAna }, select: { status: true } }))?.status, 'SESSAO_CAIDA')
  const tentativasAntes = await prisma.disparoTentativa.count({ where: { mensagem: { campanhaId: c2.id } } })
  await rodarDisparo(8000)
  assert.equal(await prisma.disparoTentativa.count({ where: { mensagem: { campanhaId: c2.id } } }), tentativasAntes, 'não fica batendo no número caído')
  await prisma.assistenteComercial.update({ where: { id: loja.asAna }, data: { status: 'CONECTADO' } })
  assert.ok(await prisma.disparoMensagem.count({ where: { campanhaId: c2.id, status: 'AGENDADA' } }) > 0, 'as mensagens esperam na fila')
  assert.ok(falso.preparados >= 1, 'o número foi preparado (aviso de entregue/lida conferido)')
  falso.enviar = enviarOriginal
  falso.reconectar = reconectarOriginal
  falso.religaAoReconectar = false
  await prisma.disparoCampanha.updateMany({ where: { id: { in: [c.id, c2.id] } }, data: { status: 'CANCELLED' } })
})

test('auditoria: eventos e tentativas não podem ser apagados', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  await assert.rejects(prisma.disparoEvento.deleteMany({ where: { usuarioId: loja.id } }))
  await assert.rejects(prisma.contatoAutorizacao.deleteMany({ where: { usuarioId: loja.id } }))
})

test('equipe: comunicado para os números conectados; não vira lead nem aciona o robô; resposta fica na campanha', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  falso.enviados.length = 0
  const segredoBruno = randomUUID()
  const asBruno = await prisma.assistenteComercial.create({ data: { vendedorId: loja.bruno, instancia: `inst-${randomUUID()}`, webhookSegredo: segredoBruno, status: 'CONECTADO', numeroWhatsapp: '5591900000002' } })
  const r = await resolverPublico(dono(), { base: 'EQUIPE' }, { finalidade: 'OPERACIONAL', config: lerConfigLoja({}), remetenteNumero: '5591900000001' })
  assert.deepEqual(r.elegiveis.map(c => c.telefone), ['5591900000002'], 'o número da equipe recebe; o próprio remetente não')
  assert.equal(r.porMotivo.NUMERO_REMETENTE, 1)
  const c = await criarCampanha('Comunicado', { publico: { base: 'EQUIPE' }, conteudo: { passos: [{ tipo: 'TEXTO', texto: 'Reunião geral às 18h, {{primeiro_nome}}.' }] } })
  await iniciarJa(c.id)
  await rodarDisparo(6000)
  assert.equal(falso.enviados.filter(e => e.destino === '5591900000002').length, 1)
  const leadsAntes = await prisma.lead.count({ where: { usuarioId: loja.id } })
  // Chega no WhatsApp do Bruno (vindo do número da Naiza): não vira lead nem conversa com robô.
  await processarWebhookAssistente(segredoBruno, { event: 'messages.upsert', data: { key: { remoteJid: '5591900000001@s.whatsapp.net', fromMe: false, id: `E${randomUUID()}` }, pushName: 'Naiza', message: { conversation: 'Reunião geral às 18h, Bruno.' }, messageTimestamp: Math.floor(Date.now() / 1000) } })
  assert.equal(await prisma.assistenteConversa.count({ where: { assistenteId: asBruno.id } }), 0)
  // O Bruno responde: chega no WhatsApp da Naiza, fica na campanha, sem lead novo.
  await processarWebhookAssistente(loja.segredoAna, { event: 'messages.upsert', data: { key: { remoteJid: '5591900000002@s.whatsapp.net', fromMe: false, id: `F${randomUUID()}` }, pushName: 'Bruno', message: { conversation: 'Ok, estarei lá' }, messageTimestamp: Math.floor(Date.now() / 1000) } })
  assert.equal(await prisma.lead.count({ where: { usuarioId: loja.id } }), leadsAntes, 'nenhum lead novo para a equipe')
  const d = await prisma.disparoDestinatario.findFirst({ where: { campanhaId: c.id, telefone: '5591900000002' } })
  assert.ok(d?.respondeuEm, 'a resposta ficou registrada na campanha')
})
