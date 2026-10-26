// Aries no WhatsApp: entender a mensagem, quebrar a resposta e o ritmo de "digitando".
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emPartes, entenderMensagem, intencaoDoRotulo, novoCodigo, saudacaoDoHorario, tempoDigitando, textoAjuda, variar } from '../src/lib/agenteConversa'

test('código de vínculo: "ARIES 482913" (com ou sem separador)', () => {
  assert.deepEqual(entenderMensagem('ARIES 482913'), { tipo: 'VINCULAR', codigo: '482913' })
  assert.deepEqual(entenderMensagem('aries-482913'), { tipo: 'VINCULAR', codigo: '482913' })
  assert.notEqual(entenderMensagem('aries 4829')?.tipo, 'VINCULAR')
})

test('saudação e agradecimento, com e sem o nome do agente', () => {
  for (const t of ['Oi', 'oiii', 'Bom dia!', 'boa noite aries', 'Olá, tudo bem?']) assert.equal(entenderMensagem(t)?.tipo, 'SAUDACAO', t)
  for (const t of ['Obrigado!', 'valeu', 'show', 'ok']) assert.equal(entenderMensagem(t)?.tipo, 'OBRIGADO', t)
})

test('saudação não esconde o pedido', () => {
  assert.equal(entenderMensagem('Bom dia, quem atendo primeiro?')?.tipo, 'AGORA')
  const p = entenderMensagem('oi, como estou hoje')
  assert.equal(p?.tipo, 'PESSOAL')
  assert.equal(p?.tipo === 'PESSOAL' && p.pergunta.tipo, 'HOJE')
})

test('sem "?": as perguntas do assistente pessoal valem do mesmo jeito', () => {
  const casos: Array<[string, string]> = [['quem está esperando', 'ESPERANDO'], ['leads quentes', 'QUENTES'], ['meus follows', 'FOLLOWS'], ['minha semana', 'SEMANA'], ['meu mês', 'MES']]
  for (const [t, tipo] of casos) {
    const r = entenderMensagem(t)
    assert.equal(r?.tipo === 'PESSOAL' && r.pergunta.tipo, tipo, t)
  }
  const s = entenderMensagem('simular CG 160 entrada 3 mil')
  assert.equal(s?.tipo === 'PESSOAL' && s.pergunta.tipo, 'SIMULAR')
})

test('agenda, plano e fila', () => {
  assert.deepEqual(entenderMensagem('minha agenda'), { tipo: 'AGENDA', amanha: false })
  assert.deepEqual(entenderMensagem('o que tenho pra amanhã?'), { tipo: 'AGENDA', amanha: true })
  assert.equal(entenderMensagem('por onde eu começo?')?.tipo, 'AGORA')
  assert.equal(entenderMensagem('meu plano')?.tipo, 'PLANO')
})

test('anotar: horário e "amanhã" saem do título, a grafia fica', () => {
  assert.deepEqual(entenderMensagem('anota: ligar pro Banco Pan às 15h'), { tipo: 'ANOTAR', titulo: 'Ligar pro Banco Pan', horario: '15:00', amanha: false })
  assert.deepEqual(entenderMensagem('me lembra de mandar a CNH da Ana amanhã 9:30'), { tipo: 'ANOTAR', titulo: 'Mandar a CNH da Ana', horario: '09:30', amanha: true })
  assert.deepEqual(entenderMensagem('lembrete separar documentos'), { tipo: 'ANOTAR', titulo: 'Separar documentos', horario: null, amanha: false })
})

test('números da loja (só o dono recebe) e avisos', () => {
  assert.equal(entenderMensagem('quanto a gente vendeu esse mês?')?.tipo, 'VENDAS')
  assert.equal(entenderMensagem('como está a equipe')?.tipo, 'EQUIPE')
  assert.equal(entenderMensagem('e o tráfego?')?.tipo, 'TRAFEGO')
  assert.equal(entenderMensagem('financeiro')?.tipo, 'FINANCEIRO')
  for (const t of ['para de me avisar', 'parar avisos', 'desligar os avisos', 'pausa avisos']) assert.equal(entenderMensagem(t)?.tipo, 'PAUSAR', t)
  for (const t of ['voltar a avisar', 'ligar avisos', 'retomar avisos']) assert.equal(entenderMensagem(t)?.tipo, 'RETOMAR', t)
  assert.equal(entenderMensagem('pode voltar a me avisar')?.tipo, 'RETOMAR')
})

test('o que não entende volta null (a IA tenta classificar) e o rótulo vira intenção', () => {
  assert.equal(entenderMensagem('qual a capital da França'), null)
  assert.deepEqual(intencaoDoRotulo('FOLLOWS'), { tipo: 'PESSOAL', pergunta: { tipo: 'FOLLOWS' } })
  assert.deepEqual(intencaoDoRotulo('AGENDA'), { tipo: 'AGENDA', amanha: false })
  assert.equal(intencaoDoRotulo('QUALQUER'), null)
})

test('resposta em partes: até 3 mensagens, título junto do bloco', () => {
  const texto = ['*Seu dia*', 'Bloco um '.repeat(40), 'Bloco dois '.repeat(40), 'Bloco três '.repeat(40), 'Bloco quatro '.repeat(40)].join('\n\n')
  const p = emPartes(texto)
  assert.ok(p.length <= 3)
  assert.ok(p[0].startsWith('*Seu dia*\n\nBloco um'))
  assert.equal(p.join('\n\n').replace(/\s+/g, ' ').trim(), texto.replace(/\s+/g, ' ').trim())
  assert.deepEqual(emPartes('curto'), ['curto'])
})

test('ritmo humano: digitando entre 1,2 e 6 s; saudação pelo horário de Brasília', () => {
  assert.equal(tempoDigitando('oi'), 1200)
  assert.equal(tempoDigitando('x'.repeat(1000)), 6000)
  assert.equal(saudacaoDoHorario(new Date('2026-10-26T11:00:00Z')), 'Bom dia')
  assert.equal(saudacaoDoHorario(new Date('2026-10-26T17:00:00Z')), 'Boa tarde')
  assert.equal(saudacaoDoHorario(new Date('2026-10-27T01:00:00Z')), 'Boa noite')
  assert.equal(variar(['a', 'b', 'c'], 'x'), variar(['a', 'b', 'c'], 'x'))
  assert.match(novoCodigo(() => 0), /^[1-9]\d{5}$/)
  assert.match(novoCodigo(() => 0.9999), /^\d{6}$/)
  assert.match(textoAjuda('Ana', true), /vendas do mês/)
  assert.doesNotMatch(textoAjuda('Ana', false), /vendas do mês/)
})
