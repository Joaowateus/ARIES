// Testes do atendimento do Assistente Comercial: respostas da base no meio
// do roteiro e nota do lead (npm run test:assistente).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CONFIG_PADRAO, avancarRoteiro, iniciarRoteiro, semPerguntaFinal, type BaseRespostas, type EstadoRoteiro } from '../src/lib/assistenteRoteiro'
import { MAX_RESPOSTAS_DA_BASE, parteAfirmativa, respostaDaBase } from '../src/lib/assistenteConhecimento'
import { calcularNota } from '../src/lib/assistenteNota'

const ctx = { nomeContato: 'Ana Paula', vendedor: 'Brenda Almeida', empresa: 'Aries Motos' }
const itens = [
  { id: 'troca', titulo: 'Aceita troca?', palavrasChave: ['troca', 'aceita minha moto'], resposta: 'Aceitamos sim, {nome}! {vendedor} avalia a sua. Qual moto você tem hoje?' },
  { id: 'entrada', titulo: 'Precisa de entrada?', palavrasChave: ['entrada', 'sem entrada', 'nao tenho entrada'], resposta: 'Dá pra fazer com ou sem entrada, depende da análise.' },
  { id: 'garantia', titulo: 'Tem garantia?', palavrasChave: ['garantia'], resposta: 'Tem garantia sim.' },
  { id: 'doc', titulo: 'Documentação', palavrasChave: ['documentacao', 'transferencia'], resposta: 'A documentação é com a gente.' },
]
const base: BaseRespostas = {
  responder: (texto, usados) => {
    const i = respostaDaBase(texto, itens, usados)
    return i ? { id: i.id, texto: i.resposta.replace('{nome}', 'Ana').replace('{vendedor}', 'Brenda'), resto: parteAfirmativa(texto) } : null
  },
}
const naEtapa = (etapa: number, respostas: Record<string, string> = {}): EstadoRoteiro => ({ etapa, respostas: { _inicial: 'oi', ...respostas } })

test('parteAfirmativa separa a resposta da pergunta', () => {
  assert.equal(parteAfirmativa('A CG 160, aceita troca?'), 'A CG 160')
  assert.equal(parteAfirmativa('Aceita troca?'), '')
  assert.equal(parteAfirmativa('Bom dia! Quanto fica a parcela?'), '')
  assert.equal(parteAfirmativa('Não tenho entrada'), 'Não tenho entrada')
  assert.equal(parteAfirmativa('oi, tudo bem? tem garantia?'), '')
})

test('semPerguntaFinal tira só a última pergunta', () => {
  assert.equal(semPerguntaFinal('Aceitamos sim! Brenda avalia a sua. Qual moto você tem hoje?'), 'Aceitamos sim! Brenda avalia a sua.')
  assert.equal(semPerguntaFinal('Quer que eu veja pra você?'), 'Quer que eu veja pra você?')
  assert.equal(semPerguntaFinal('Tem garantia sim.'), 'Tem garantia sim.')
})

test('respostaDaBase só responde pergunta/objeção, sem repetir e até o limite', () => {
  assert.equal(respostaDaBase('Vocês aceitam troca?', itens, [])?.id, 'troca')
  assert.equal(respostaDaBase('troca', itens, []), null, 'resposta curta de roteiro não é pergunta')
  assert.equal(respostaDaBase('Vocês aceitam troca?', itens, ['troca']), null)
  assert.equal(respostaDaBase('Tem garantia?', itens, ['a', 'b', 'c'].slice(0, MAX_RESPOSTAS_DA_BASE)), null)
  assert.equal(respostaDaBase('Qual o horário de vocês?', itens, []), null, 'sem resposta aprovada, não inventa')
})

test('pergunta no meio do roteiro: responde e repete a mesma pergunta', () => {
  const p = avancarRoteiro(CONFIG_PADRAO, naEtapa(0), 'Aceita troca?', ctx, base)
  assert.equal(p.estado.etapa, 0)
  assert.equal(p.conhecimentoUsado, 'troca')
  assert.equal(p.estado.respostas._kb, 'troca')
  assert.equal(p.estado.respostas.interesse, undefined)
  assert.equal(p.mensagens.length, 1)
  assert.match(p.mensagens[0], /^Aceitamos sim, Ana! Brenda avalia a sua\.\n\nQual veículo te interessou\?/)
  assert.doesNotMatch(p.mensagens[0], /Qual moto você tem hoje/, 'a pergunta do fim da resposta sai')
})

test('mensagem que responde e pergunta: guarda a resposta e anda', () => {
  const p = avancarRoteiro(CONFIG_PADRAO, naEtapa(0), 'A CG 160, aceita troca?', ctx, base)
  assert.equal(p.estado.etapa, 1)
  assert.equal(p.estado.respostas.interesse, 'A CG 160, aceita troca?')
  assert.match(p.mensagens[0], /^Aceitamos sim, Ana! .*\n\nComo você pensa em pagar\?/s)
})

test('pergunta com opções: só anda se escolheu uma opção', () => {
  const so = avancarRoteiro(CONFIG_PADRAO, naEtapa(1), 'Precisa de entrada?', ctx, base)
  assert.equal(so.estado.etapa, 1)
  assert.match(so.mensagens[0], /1️⃣ À vista/)
  const misto = avancarRoteiro(CONFIG_PADRAO, naEtapa(1), 'Financiado, precisa de entrada?', ctx, base)
  assert.equal(misto.estado.etapa, 2)
  assert.equal(misto.estado.respostas.pagamento, 'Financiado')
})

test('objeção que é a própria resposta ("Não tenho entrada") anda', () => {
  const p = avancarRoteiro(CONFIG_PADRAO, naEtapa(2), 'Não tenho entrada', ctx, base)
  assert.equal(p.estado.etapa, 3)
  assert.equal(p.estado.respostas.entrada, 'Não tenho entrada')
  assert.equal(p.conhecimentoUsado, 'entrada')
})

test('a mesma resposta não se repete na conversa', () => {
  const p = avancarRoteiro(CONFIG_PADRAO, naEtapa(0, { _kb: 'troca' }), 'E aceita troca mesmo?', ctx, base)
  assert.equal(p.conhecimentoUsado, null)
  assert.equal(p.estado.etapa, 1, 'sem resposta da base, vale como resposta (comportamento antigo)')
})

test('pedido de atendente com dúvida: responde e passa pro vendedor', () => {
  const p = avancarRoteiro(CONFIG_PADRAO, naEtapa(0), 'Tem garantia? Pode me ligar?', ctx, base)
  assert.equal(p.desfecho, 'PEDIU_ATENDENTE')
  assert.match(p.mensagens[0], /^Tem garantia sim\.\n\nClaro! Já avisei/)
})

test('primeira mensagem com dúvida: boas-vindas, resposta e primeira pergunta', () => {
  const p = iniciarRoteiro(CONFIG_PADRAO, ctx, 'Oi, vocês aceitam troca?', base)
  assert.equal(p.estado.respostas._kb, 'troca')
  assert.equal(p.mensagens.length, 1)
  const [boasVindas, resposta, pergunta] = p.mensagens[0].split('\n\n')
  assert.match(boasVindas, /^Olá, Ana!/)
  assert.equal(resposta, 'Aceitamos sim, Ana! Brenda avalia a sua.')
  assert.match(pergunta, /^Qual veículo/)
})

test('sem base, o roteiro segue igual', () => {
  const p = avancarRoteiro(CONFIG_PADRAO, naEtapa(0), 'Aceita troca?', ctx)
  assert.equal(p.estado.etapa, 1)
  assert.equal(p.conhecimentoUsado, null)
})

test('nota do lead: quente, morno, frio e desistência', () => {
  const quente = calcularNota({
    cfg: CONFIG_PADRAO, origem: 'ANUNCIO',
    respostas: { interesse: 'CG 160', pagamento: 'À vista', entrada: '5 mil', horario: 'agora' },
    textosDoContato: ['Quero comprar hoje', 'CG 160', 'À vista'],
  })
  assert.ok(quente.nota >= 70, `quente: ${quente.nota}`)
  assert.equal(quente.faixa, 'QUENTE')
  assert.ok(quente.sinais.some(s => s.chave === 'urgencia') && quente.sinais.some(s => s.chave === 'intencao'))

  const morno = calcularNota({ cfg: CONFIG_PADRAO, origem: 'CONTATO_NOVO', respostas: { interesse: 'Fan', pagamento: 'Financiado' }, textosDoContato: ['Fan', '2'] })
  assert.equal(morno.faixa, 'FRIO', `5 + 15 + 12 = ${morno.nota}`)
  const comEntrada = calcularNota({ cfg: CONFIG_PADRAO, origem: 'CONTATO_NOVO', respostas: { interesse: 'Fan', pagamento: 'Financiado', entrada: 'sim, 2 mil' }, textosDoContato: ['Fan', '2', 'sim, 2 mil'] })
  assert.equal(comEntrada.faixa, 'MORNO')

  const semEntrada = calcularNota({ cfg: CONFIG_PADRAO, origem: null, respostas: { entrada: 'Não' }, textosDoContato: ['Não'] })
  assert.ok(!semEntrada.sinais.some(s => s.chave === 'entrada'))

  const objecao = calcularNota({ cfg: CONFIG_PADRAO, origem: 'ANUNCIO', respostas: {}, textosDoContato: ['Achei caro, vou pensar'] })
  assert.equal(objecao.nota, 0, '15 - 10 - 10, nunca negativa')
  assert.equal(objecao.sinais.filter(s => s.pontos < 0).length, 2)

  const parou = calcularNota({ cfg: CONFIG_PADRAO, origem: 'ANUNCIO', respostas: { interesse: 'CG' }, textosDoContato: ['parar'], resultado: 'DESISTIU' })
  assert.equal(parou.nota, 0)
})
