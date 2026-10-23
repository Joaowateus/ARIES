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

// ---------- Vitrine do estoque ----------
import { acharMotos, fichaParaIA, fichaTexto, perguntaDeEstoque, pontosDaMoto, respostaDeEstoque, type MotoVitrine } from '../src/lib/assistenteVitrine'

const moto = (m: Partial<MotoVitrine> & { id: string; modelo: string }): MotoVitrine => ({
  marca: null, ano: null, cor: null, situacao: 'DISPONIVEL', versao: null, km: null, cilindrada: null, preco: null, destaques: [], ficha: [], fotos: [], videoUrl: null, ...m,
})
const xre = moto({ id: 'xre', modelo: 'XRE 300 Sahara', marca: 'Honda', ano: 2023, cor: 'Vermelha', km: 12000, cilindrada: 300, preco: 25900, destaques: ['Revisada'], ficha: [{ rotulo: 'Freio', valor: 'ABS' }], fotos: ['/pro-labore/imagens/xre1'] })
const cg = moto({ id: 'cg', modelo: 'CG 160 Titan', marca: 'Honda', ano: 2022, km: 8000, cilindrada: 160 })
const fazer = moto({ id: 'fazer', modelo: 'Fazer 250', marca: 'Yamaha', cilindrada: 250, situacao: 'VENDIDA' })
const lander = moto({ id: 'lander', modelo: 'Lander 250', marca: 'Yamaha', cilindrada: 250, km: 20000, fotos: ['/pro-labore/imagens/lander1'] })
const estoque = [xre, cg, fazer, lander]

test('vitrine reconhece a moto pedida pelo nome', () => {
  assert.ok(pontosDaMoto('tem a XRE 300?', xre) > 0)
  assert.equal(acharMotos('vocês têm cg 160?', estoque)[0]?.id, 'cg')
  assert.equal(pontosDaMoto('tem alguma de 160?', cg), 0, 'só a cilindrada não basta')
  assert.equal(acharMotos('tem honda?', estoque).length, 0, 'só a marca não basta')
  assert.equal(perguntaDeEstoque('XRE 300', estoque), null, 'resposta de roteiro não é pergunta de estoque')
  assert.equal(perguntaDeEstoque('Ainda tem a XRE 300?', estoque)?.id, 'xre')
})

test('ficha do WhatsApp: preço só se a loja ligar; IA nunca recebe preço', () => {
  const sem = fichaTexto(xre, { mostrarPreco: false })
  assert.match(sem, /^\*Honda XRE 300 Sahara 2023\* · Vermelha\n12\.000 km · 300 cc\n✅ Revisada\n• Freio: ABS$/)
  assert.ok(fichaTexto(xre, { mostrarPreco: true }).includes('💰 R$ 25.900'))
  const ia = JSON.stringify(fichaParaIA(xre))
  assert.ok(!ia.includes('25900') && !ia.includes('preco') && ia.includes('Freio: ABS'))
})

test('resposta de estoque: disponível com foto; vendida oferece parecidas; sem parecidas não responde', () => {
  const r = respostaDeEstoque(xre, estoque, { mostrarPreco: false, nome: 'Ana' })!
  assert.ok(r.disponivel && r.foto === '/pro-labore/imagens/xre1' && r.texto.startsWith('Temos sim, Ana! 😍'))
  const v = respostaDeEstoque(fazer, estoque, { mostrarPreco: false, nome: '' })!
  assert.ok(!v.disponivel && v.texto.startsWith('A Yamaha Fazer 250 já foi vendida, mas temos opções parecidas:') && v.texto.includes('• Yamaha Lander 250 · 20.000 km'))
  assert.equal(v.foto, '/pro-labore/imagens/lander1')
  assert.equal(respostaDeEstoque(moto({ id: 'x', modelo: 'Ninja 1000', situacao: 'VENDIDA', cilindrada: 1000 }), [cg], { mostrarPreco: false, nome: '' }), null)
})

const baseVitrine: BaseRespostas = {
  responder: (texto, usados) => {
    const alvo = perguntaDeEstoque(texto, estoque)
    if (!alvo || usados.includes(`moto:${alvo.id}`)) return null
    const r = respostaDeEstoque(alvo, estoque, { mostrarPreco: false, nome: 'Ana' })
    return r && { id: `moto:${alvo.id}`, motoId: alvo.id, texto: r.texto, foto: r.foto, resto: parteAfirmativa(texto), ...(r.disponivel && { valeComo: { campo: 'modeloInteresse' as const, valor: 'Honda XRE 300 Sahara 2023' } }) }
  },
}

test('robô: "tem a XRE?" na 1ª mensagem manda a foto e já pula a pergunta do veículo', () => {
  const p = iniciarRoteiro(CONFIG_PADRAO, ctx, 'Oi, ainda tem a XRE 300?', baseVitrine)
  assert.equal(p.estado.etapa, 1)
  assert.equal(p.estado.respostas.interesse, 'Honda XRE 300 Sahara 2023')
  assert.equal(p.motoUsada, 'xre')
  assert.equal(p.conhecimentoUsado, null)
  assert.equal(p.mensagens.length, 2)
  assert.match(p.mensagens[0], /^Olá, Ana!/)
  assert.match(p.mensagens[1], /^Como você pensa em pagar\?/)
  assert.deepEqual(p.midias?.map(m => [m.url, m.antesDe]), [['/pro-labore/imagens/xre1', 1]])
  assert.match(p.midias![0].legenda, /^Temos sim, Ana!/)
})

test('robô: estoque no meio do roteiro', () => {
  const p = avancarRoteiro(CONFIG_PADRAO, naEtapa(0), 'Tem a XRE 300?', ctx, baseVitrine)
  assert.equal(p.estado.etapa, 1, 'a moto responde "Qual veículo te interessou?"')
  assert.equal(p.midias?.[0].antesDe, 0)
  const q = avancarRoteiro(CONFIG_PADRAO, naEtapa(1), 'E a Fazer 250, ainda tem?', ctx, baseVitrine)
  assert.equal(q.estado.etapa, 1, 'na pergunta do pagamento, repete a pergunta')
  assert.equal(q.motoUsada, 'fazer')
  assert.match(q.midias![0].legenda, /já foi vendida/)
  assert.match(q.mensagens[0], /^Como você pensa em pagar\?/)
})
