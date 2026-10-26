// Copiloto: a fila de "próxima melhor ação" (regras puras, sem banco).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { itemDaFila, motivosDe, type EntradaFila } from '../src/lib/copilotoFilaRegras'

const base = (x: Partial<EntradaFila> = {}): EntradaFila => ({
  leadId: 'l1', nome: 'Ana Dias', estagio: 'ABORDADO', modelo: 'CG 160', vendedor: null, pontuacao: null, etiquetas: [],
  diasParado: 0, semAbordagem: false, horasDesdeCriacao: 48, follow: null, conversa: null, ...x,
})

test('lead em dia, sem sinal nenhum, fica fora da fila', () => {
  assert.equal(itemDaFila(base()), null)
})

test('WhatsApp esperando vem antes de tudo e diz há quanto tempo', () => {
  const i = itemDaFila(base({ conversa: { id: 'c1', situacao: 'ESPERANDO', horas: 0.5 }, etiquetas: ['PEDIU_SIMULACAO'] }))!
  assert.equal(i.motivo.tipo, 'WHATS_ESPERANDO')
  assert.match(i.motivo.texto, /há 30 min/)
  assert.equal(i.conversaId, 'c1')
  assert.deepEqual(i.sinais, ['Pediu simulação'])
  assert.equal(i.grupo, 'WHATSAPP')
})

test('crédito aprovado supera follow atrasado e proposta parada', () => {
  const i = itemDaFila(base({ estagio: 'PROPOSTA', diasParado: 5, etiquetas: ['CREDITO_APROVADO', 'FICHA_CREDITO'], follow: { id: 'f1', atrasoDias: 2, nota: 'ligar', canal: 'LIGACAO' } }))!
  assert.equal(i.motivo.tipo, 'CREDITO_APROVADO')
  assert.ok(i.sinais.includes('Follow atrasado'))
  assert.ok(i.sinais.includes('Parado'))
  // ficha com resposta do banco não pede mais "mandar para os bancos"
  assert.ok(!i.sinais.includes('Ficha de crédito'))
  assert.equal(i.followId, 'f1')
})

test('follow: atrasado x hoje, com a nota e o canal', () => {
  const atrasado = itemDaFila(base({ follow: { id: 'f1', atrasoDias: 1, nota: 'mandar fotos da Biz', canal: 'WHATSAPP' } }))!
  assert.equal(atrasado.motivo.tipo, 'FOLLOW_ATRASADO')
  assert.match(atrasado.motivo.texto, /há 1 dia: mandar fotos da Biz/)
  assert.match(atrasado.passo, /WhatsApp/)
  const hoje = itemDaFila(base({ follow: { id: 'f2', atrasoDias: 0, nota: null, canal: 'LIGACAO' } }))!
  assert.equal(hoje.motivo.tipo, 'FOLLOW_HOJE')
  assert.ok(atrasado.prioridade > hoje.prioridade)
})

test('pediu simulação some depois que simulou', () => {
  assert.ok(motivosDe(base({ etiquetas: ['PEDIU_SIMULACAO'] })).some(m => m.tipo === 'PEDIU_SIMULACAO'))
  assert.ok(!motivosDe(base({ etiquetas: ['PEDIU_SIMULACAO', 'SIMULOU'] })).some(m => m.tipo === 'PEDIU_SIMULACAO'))
})

test('lead novo sem abordagem: entra depois de 30 min; o mais novo pesa mais', () => {
  assert.equal(itemDaFila(base({ estagio: 'LEAD', semAbordagem: true, horasDesdeCriacao: 0.2 })), null)
  const novo = itemDaFila(base({ estagio: 'LEAD', semAbordagem: true, horasDesdeCriacao: 3 }))!
  const velho = itemDaFila(base({ estagio: 'LEAD', semAbordagem: true, horasDesdeCriacao: 30, diasParado: 1 }))!
  assert.equal(novo.motivo.tipo, 'NOVO_SEM_ABORDAGEM')
  assert.ok(novo.prioridade > velho.prioridade)
})

test('parado: proposta pesa mais que abordado, e respeita o prazo de cada etapa', () => {
  assert.equal(itemDaFila(base({ estagio: 'NEGOCIACAO', diasParado: 3 })), null)
  const prop = itemDaFila(base({ estagio: 'PROPOSTA', diasParado: 3 }))!
  const abord = itemDaFila(base({ estagio: 'ABORDADO', diasParado: 3 }))!
  assert.equal(prop.motivo.tipo, 'PARADO')
  assert.ok(prop.prioridade > abord.prioridade)
  assert.match(prop.passo, /falta para decidir/)
})

test('lead quente parado e a nota somam prioridade; objeção de preço muda o passo', () => {
  const frio = itemDaFila(base({ estagio: 'PROPOSTA', diasParado: 3, pontuacao: 20 }))!
  const quente = itemDaFila(base({ estagio: 'PROPOSTA', diasParado: 3, pontuacao: 90, etiquetas: ['OBJECAO_PRECO'] }))!
  assert.equal(quente.motivo.tipo, 'QUENTE_PARADO')
  assert.ok(quente.prioridade > frio.prioridade)
  assert.ok(quente.sinais.includes('Objeção de preço'))
  assert.match(quente.passo, /parcela que cabe/)
})

test('conversa sem lead no CRM entra pela conversa', () => {
  const i = itemDaFila(base({ leadId: null, estagio: null, conversa: { id: 'c9', situacao: 'SEM_RESPOSTA', horas: 3 } }))!
  assert.equal(i.chave, 'conversa:c9')
  assert.equal(i.motivo.tipo, 'WHATS_SEM_RESPOSTA')
  assert.match(i.motivo.texto, /há 3h/)
})

test('prioridade nunca passa de 100 e nenhum texto leva valor em reais', () => {
  const i = itemDaFila(base({ estagio: 'PROPOSTA', diasParado: 9, pontuacao: 100, etiquetas: ['CREDITO_APROVADO', 'PEDIU_VISITA', 'OBJECAO_PRECO'], conversa: { id: 'c1', situacao: 'ESPERANDO', horas: 5 }, follow: { id: 'f', atrasoDias: 3, nota: null, canal: null } }))!
  assert.ok(i.prioridade <= 100)
  assert.ok(![i.motivo.texto, i.passo, ...i.sinais].some(t => /R\$/.test(t)))
})

test('plano da manhã: sinais de compra e follows entram depois do WhatsApp, sem repetir lead', async () => {
  const { juntarSinaisNoPlano } = await import('../src/lib/copilotoFilaRegras')
  const plano = [
    { tipo: 'RESPONDER', texto: 'Responder Bia no WhatsApp', porque: '', refTipo: 'CONVERSA', refId: 'c1' },
    { tipo: 'FOLLOW_UP', texto: 'Follow-up da proposta de Caio', porque: '', refTipo: 'LEAD', refId: 'l2' },
    { tipo: 'ESTUDO', texto: '15 minutos de estudo', porque: '' },
  ]
  const itens = [
    itemDaFila(base({ leadId: 'l1', nome: 'BRUNO LIMA', estagio: 'PROPOSTA', etiquetas: ['CREDITO_APROVADO'], vendedor: 'Brenda' }))!,
    itemDaFila(base({ leadId: 'l2', nome: 'Caio', etiquetas: ['PEDIU_VISITA'] }))!,
    itemDaFila(base({ leadId: 'l3', nome: 'Duda', estagio: 'PROPOSTA', diasParado: 4 }))!,
  ]
  const r = juntarSinaisNoPlano(plano, itens)
  assert.deepEqual(r.map(a => a.tipo), ['RESPONDER', 'FECHAR', 'FOLLOW_UP', 'ESTUDO'])
  assert.equal(r[1].texto, 'Fechar com Bruno: crédito aprovado (Brenda)')
  assert.equal(r[1].refId, 'l1')
  assert.equal(r[1].estagioNaHora, 'PROPOSTA')
  // lead parado comum não entra por aqui (o plano já cuida dos parados)
  assert.ok(!r.some(a => a.refId === 'l3'))
})
