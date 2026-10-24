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

// ---------- Jornada: etiquetas + avanço ----------
import { etiquetasDoLead, proximaEtapa, rebaixadoHaPouco } from '../src/lib/assistenteJornada'

const agora = new Date('2026-10-23T15:00:00Z')
const horas = (h: number) => new Date(agora.getTime() - h * 3600e3)
const etq = (respostas: Record<string, string>, textos: string[], extra: Partial<Parameters<typeof etiquetasDoLead>[0]> = {}) =>
  etiquetasDoLead({ cfg: CONFIG_PADRAO, respostas, textosDoContato: textos, nota: null, ultimaDoContatoEm: horas(1), ultimaNossaEm: horas(2), agora, ...extra })

test('etiquetas pela conversa', () => {
  assert.deepEqual(etq({ pagamento: 'Financiado', entrada: 'Não' }, ['Quanto fica a parcela?']), ['FINANCIAMENTO', 'SEM_ENTRADA', 'PEDIU_SIMULACAO'])
  assert.deepEqual(etq({ pagamento: 'À vista' }, ['Achei caro, tem desconto?', 'Posso passar aí amanhã?']), ['A_VISTA', 'OBJECAO_PRECO', 'PEDIU_VISITA'])
  assert.deepEqual(etq({ pagamento: 'Tenho um veículo pra dar na troca' }, []), ['TEM_TROCA'])
  assert.deepEqual(etq({}, ['oi'], { nota: 80 }), ['QUENTE'])
  assert.deepEqual(etq({}, ['oi'], { ultimaDoContatoEm: horas(30), ultimaNossaEm: horas(26) }), ['SUMIU_24H'])
  assert.deepEqual(etq({}, ['oi'], { ultimaDoContatoEm: horas(20), ultimaNossaEm: horas(26) }), [], 'o cliente respondeu depois: não sumiu')
})

test('avanço: só para frente, uma etapa, e respeita o desfazer', () => {
  const base = { vendedorRespondeu: false, textosDoContato: [] as string[], textosDoVendedor: [] as string[], etiquetas: [] as never[], nota: null, desfeitos: [] as string[] }
  assert.deepEqual(proximaEtapa({ ...base, estagio: 'LEAD', vendedorRespondeu: true }), { para: 'ABORDADO', motivo: 'o vendedor respondeu' })
  assert.equal(proximaEtapa({ ...base, estagio: 'LEAD', etiquetas: ['PEDIU_SIMULACAO'] }), null, 'sem o vendedor responder, não pula para Negociação')
  assert.equal(proximaEtapa({ ...base, estagio: 'ABORDADO', etiquetas: ['PEDIU_SIMULACAO'] })?.para, 'NEGOCIACAO')
  assert.equal(proximaEtapa({ ...base, estagio: 'ABORDADO', textosDoContato: ['Quais documentos preciso levar?'] })?.motivo, 'perguntou da documentação')
  assert.equal(proximaEtapa({ ...base, estagio: 'ABORDADO', nota: 75 })?.motivo, 'nota 75 na conversa')
  assert.equal(proximaEtapa({ ...base, estagio: 'ABORDADO', nota: 60 }), null)
  assert.equal(proximaEtapa({ ...base, estagio: 'NEGOCIACAO', textosDoVendedor: ['Segue a proposta, Ana!'] })?.para, 'PROPOSTA')
  assert.equal(proximaEtapa({ ...base, estagio: 'NEGOCIACAO', textosDoContato: ['me manda a proposta'] }), null, 'proposta precisa vir do vendedor')
  assert.equal(proximaEtapa({ ...base, estagio: 'PROPOSTA', textosDoVendedor: ['Segue a proposta'] }), null, 'nunca vai para Fechado')
  assert.equal(proximaEtapa({ ...base, estagio: 'ABORDADO', etiquetas: ['PEDIU_SIMULACAO'], desfeitos: ['NEGOCIACAO'] }), null, 'avanço desfeito não volta')
  assert.ok(rebaixadoHaPouco([{ estagioAnterior: 'NEGOCIACAO', estagioNovo: 'ABORDADO', origem: null, criadoEm: horas(5) }], agora))
  assert.ok(!rebaixadoHaPouco([{ estagioAnterior: 'LEAD', estagioNovo: 'ABORDADO', origem: null, criadoEm: horas(5) }], agora))
  assert.ok(!rebaixadoHaPouco([{ estagioAnterior: 'PERDIDO', estagioNovo: 'LEAD', origem: null, criadoEm: horas(5) }], agora), 'reativação não conta como rebaixar')
})

// ---------- Follow automático ----------
import { FOLLOW_PADRAO, baseDoFollow, dentroDoHorario, inicioDoDiaBrt, lerConfigFollow, proximoFollow, quandoDevido } from '../src/lib/assistenteFollow'

test('config do follow: padrão, ordem crescente e limites', () => {
  assert.deepEqual(lerConfigFollow(null), FOLLOW_PADRAO)
  const c = lerConfigFollow({ passos: [{ dias: 7, texto: 'c', midia: 'X' }, { dias: 1, texto: 'a', midia: 'FOTO_MOTO' }, { dias: 1, texto: 'repetido', midia: 'NENHUMA' }], tetoDiario: 500, horaInicio: 9, horaFim: 8 })
  assert.deepEqual(c.passos.map(p => [p.dias, p.texto, p.midia]), [[1, 'a', 'FOTO_MOTO'], [7, 'c', 'NENHUMA']])
  assert.equal(c.tetoDiario, 100)
  assert.ok(c.horaFim > c.horaInicio)
})

test('horário do follow: segunda a sábado, no horário de Brasília', () => {
  const cfg = FOLLOW_PADRAO
  assert.ok(dentroDoHorario(new Date('2026-10-23T15:00:00Z'), cfg), 'sexta 12h')
  assert.ok(dentroDoHorario(new Date('2026-10-24T15:00:00Z'), cfg), 'sábado 12h')
  assert.ok(!dentroDoHorario(new Date('2026-10-25T15:00:00Z'), cfg), 'domingo')
  assert.ok(!dentroDoHorario(new Date('2026-10-23T23:00:00Z'), cfg), 'sexta 20h')
  assert.ok(!dentroDoHorario(new Date('2026-10-23T11:30:00Z'), cfg), 'sexta 8h30')
  assert.equal(inicioDoDiaBrt(new Date('2026-10-24T02:00:00Z')).toISOString(), '2026-10-23T03:00:00.000Z', '23h de sexta ainda é sexta')
})

test('follow só depois da resposta do vendedor, e recomeça quando o cliente responde', () => {
  const t = (h: number) => new Date(agora.getTime() - h * 3600e3)
  assert.equal(baseDoFollow([{ remetente: 'CONTATO', criadoEm: t(50) }, { remetente: 'VENDEDOR', criadoEm: t(48) }, { remetente: 'ASSISTENTE', criadoEm: t(20) }])?.getTime(), t(48).getTime())
  assert.equal(baseDoFollow([{ remetente: 'VENDEDOR', criadoEm: t(48) }, { remetente: 'CONTATO', criadoEm: t(40) }]), null, 'cliente falou por último: a loja deve a resposta')
  assert.equal(baseDoFollow([{ remetente: 'CONTATO', criadoEm: t(50) }, { remetente: 'ASSISTENTE', criadoEm: t(49) }]), null, 'só o robô respondeu: não há follow')

  const cfg = FOLLOW_PADRAO
  const prox = (passo: number, baseH: number, ultimoH: number | null, parado: string | null = null) =>
    proximoFollow({ cfg, passo, parado, baseEm: t(baseH), ultimoFollowEm: ultimoH === null ? null : t(ultimoH), agora })
  assert.equal(prox(0, 25, null)?.indice, 0, '1 dia sem resposta: passo 1')
  assert.equal(prox(0, 23, null), null, 'ainda não deu 1 dia')
  assert.equal(prox(1, 73, 21)?.midia, 'FOTO_MOTO', '3 dias: passo 2 com a foto')
  assert.equal(prox(1, 73, 10), null, 'no máximo 1 por dia por lead')
  assert.equal(prox(3, 500, 100), null, 'acabaram os passos')
  assert.equal(prox(0, 25, null, 'PEDIU_PARAR'), null, 'pediu para parar')
  assert.equal(quandoDevido({ cfg, passo: 1, parado: null, baseEm: t(48), ultimoFollowEm: t(23) })?.getTime(), t(48).getTime() + 3 * 86_400_000)
})

// ---------- Assistente pessoal no chat "Você" ----------
import { interpretarPergunta } from '../src/lib/assistentePessoal'

test('perguntas livres no chat "Você" (e anotação comum ignorada)', () => {
  assert.equal(interpretarPergunta('lembrar de comprar pão'), null)
  assert.equal(interpretarPergunta('ligar pro contador amanhã'), null)
  assert.equal(interpretarPergunta('comprar pão?'), null, 'pergunta sem assunto conhecido é anotação')
  assert.deepEqual(interpretarPergunta('Como estou hoje?'), { tipo: 'HOJE' })
  assert.deepEqual(interpretarPergunta('? meu dia'), { tipo: 'HOJE' })
  assert.deepEqual(interpretarPergunta('Quem está esperando?'), { tipo: 'ESPERANDO' })
  assert.deepEqual(interpretarPergunta('assistente, minha conversão da semana'), { tipo: 'SEMANA' })
  assert.deepEqual(interpretarPergunta('Como está meu mês?'), { tipo: 'MES' })
  assert.deepEqual(interpretarPergunta('leads quentes?'), { tipo: 'QUENTES' })
  assert.deepEqual(interpretarPergunta('meus follows?'), { tipo: 'FOLLOWS' })
  assert.deepEqual(interpretarPergunta('ficha da XRE 300?'), { tipo: 'FICHA', moto: 'XRE 300' })
  assert.deepEqual(interpretarPergunta('? tem a bros 160 no estoque'), { tipo: 'FICHA', moto: 'bros 160' })
  assert.deepEqual(interpretarPergunta('O que respondo para "tá caro"?'), { tipo: 'RESPOSTA', assunto: 'tá caro' })
  assert.deepEqual(interpretarPergunta('como respondo quando o cliente diz que vai pensar?'), { tipo: 'RESPOSTA', assunto: 'que vai pensar' })
  assert.deepEqual(interpretarPergunta('Como está a Ana Paula?'), { tipo: 'LEAD', nome: 'Ana Paula' })
  assert.deepEqual(interpretarPergunta('?'), { tipo: 'AJUDA' })
  assert.deepEqual(interpretarPergunta('? qualquer coisa estranha'), { tipo: 'AJUDA' })
})

// ---------- Simulação de financiamento ----------
import { SIMULACAO_PADRAO, lerConfigSimulacao, lerValor, parcelaPrice, resumoSimulacao, simular, textoSimulacao, vaiFinanciar } from '../src/lib/assistenteSimulacao'

test('valores escritos pelo cliente', () => {
  assert.equal(lerValor('3 mil'), 3000)
  assert.equal(lerValor('R$ 2.500,00'), 2500)
  assert.equal(lerValor('3,5 mil'), 3500)
  assert.equal(lerValor('uns 2 mil e 500'), 2500)
  assert.equal(lerValor('5k'), 5000)
  assert.equal(lerValor('18.900'), 18900)
  assert.equal(lerValor('minha renda é 4500 por mês'), 4500)
  assert.equal(lerValor('5'), 5000, 'número pequeno é milhar')
  assert.equal(lerValor('Não'), 0)
  assert.equal(lerValor('não tenho'), 0)
  assert.equal(lerValor('pular'), null)
  assert.equal(lerValor('prefiro não dizer'), null)
  assert.equal(lerValor('não sei ainda'), null)
  assert.equal(lerValor('depende'), null)
})

test('parcela pela Tabela Price', () => {
  assert.equal(parcelaPrice(10000, 2, 12), 945.6)
  assert.equal(parcelaPrice(12000, 0, 12), 1000)
})

test('simulação: entrada mínima, prazos e quanto pesa na renda', () => {
  const cfg = lerConfigSimulacao(null)
  const r = simular({ valor: 20000, entrada: 4000, renda: 3500, cfg })!
  assert.equal(r.financiado, 16000)
  assert.deepEqual(r.opcoes.map(o => o.prazo), [12, 24, 36, 48])
  assert.equal(r.avaliacao, 'CABE')
  assert.equal(r.melhorPrazo, 24, 'o prazo mais curto que fica até 30% da renda (24x ≈ 24%; 12x ≈ 43%)')
  const minima = simular({ valor: 20000, entrada: 0, renda: null, cfg })!
  assert.ok(minima.entradaAjustada && minima.entrada === 2000 && minima.avaliacao === 'SEM_RENDA')
  // 48x ≈ R$ 531: 53% de R$ 1.000 (não cabe), 35% de R$ 1.500 (apertada: até 10 pontos acima dos 30%).
  assert.equal(simular({ valor: 20000, entrada: 4000, renda: 1000, cfg })!.avaliacao, 'NAO_CABE')
  const apertada = simular({ valor: 20000, entrada: 4000, renda: 1500, cfg })!
  assert.ok(apertada.avaliacao === 'APERTADA' && apertada.melhorPrazo === 48)
  assert.equal(simular({ valor: 20000, entrada: 25000, renda: null, cfg }), null, 'entrada cobre tudo: não há o que financiar')
})

test('textos da simulação: cliente sem percentual da renda, vendedor com a leitura', () => {
  const cfg = lerConfigSimulacao(null)
  const r = simular({ valor: 20000, entrada: 4000, renda: 3500, cfg })!
  const t = textoSimulacao(r, { moto: 'Honda CG 160 2024', mostrarPreco: false, aviso: 'Simulação ilustrativa.', vendedor: 'Brenda' })
  assert.match(t, /^📊 \*Simulação de financiamento\* — Honda CG 160 2024\n\nEntrada: R\$ 4\.000\n• 12x de R\$ /)
  assert.ok(!t.includes('20.000'), 'preço da moto só com "Preço no WhatsApp" ligado')
  assert.ok(t.includes('a opção em 24x fica confortável') && !t.includes('% da renda') && t.endsWith('_Simulação ilustrativa._'))
  assert.ok(textoSimulacao(r, { moto: null, mostrarPreco: true, aviso: 'x', vendedor: 'B' }).includes('Valor: R$ 20.000'))
  assert.match(resumoSimulacao(r), /^entrada R\$ 4\.000 · 24x de R\$ [\d.]+ \([\d,]+% da renda de R\$ 3\.500\) → cabe no bolso$/)
})

test('config da simulação e quem vai financiar', () => {
  const c = lerConfigSimulacao({ taxas: [{ prazo: 36, taxa: 1.999 }, { prazo: 12, taxa: 1.5 }, { prazo: 12, taxa: 9 }, { prazo: 2, taxa: 1 }], comprometimentoMax: 90 })
  assert.deepEqual(c.taxas, [{ prazo: 12, taxa: 1.5 }, { prazo: 36, taxa: 2 }])
  assert.equal(c.comprometimentoMax, 60)
  assert.equal(c.aviso, SIMULACAO_PADRAO.aviso)
  assert.ok(vaiFinanciar('Financiado') && vaiFinanciar('quero parcelar') && !vaiFinanciar('À vista') && !vaiFinanciar(null))
})

// ---------- Simulação no robô, na nota e no chat "Você" ----------
import { respostasParaIA, simuladorDoRobo, textoParaIA, type VitrineLoja } from '../src/lib/assistenteRespostas'

const cg20 = moto({ id: 'cg20', modelo: 'CG 160 Titan', marca: 'Honda', ano: 2024, cilindrada: 160, preco: 20000 })
const vitrineSim = (extra: Partial<VitrineLoja> = {}): VitrineLoja => ({ motos: [cg20, lander], mostrarPreco: false, vitrineRobo: true, simulacao: lerConfigSimulacao(null), simulacaoAtiva: true, ...extra })
const ateOFim = (sim: ReturnType<typeof simuladorDoRobo>, pagamento: string, entrada: string) => {
  let p = avancarRoteiro(CONFIG_PADRAO, naEtapa(0), 'CG 160', ctx, undefined, sim)
  p = avancarRoteiro(CONFIG_PADRAO, p.estado, pagamento, ctx, undefined, sim)
  p = avancarRoteiro(CONFIG_PADRAO, p.estado, entrada, ctx, undefined, sim)
  return avancarRoteiro(CONFIG_PADRAO, p.estado, 'depois das 18h', ctx, undefined, sim)
}

test('robô: quem vai financiar recebe a pergunta da renda e depois a simulação', () => {
  const sim = simuladorDoRobo(CONFIG_PADRAO, ctx, vitrineSim())
  const fim = ateOFim(sim, 'Financiado', '4 mil')
  assert.equal(fim.desfecho, null, 'ainda falta a renda')
  assert.match(fim.mensagens.at(-1)!, /renda mensal aproximada/)
  assert.equal(fim.estado.respostas._simulacao, 'RENDA')
  const r = avancarRoteiro(CONFIG_PADRAO, fim.estado, 'uns 3.500', ctx, undefined, sim)
  assert.equal(r.desfecho, 'QUALIFICADO')
  assert.equal(r.mensagens.length, 2)
  assert.match(r.mensagens[0], /^📊 \*Simulação de financiamento\* — Honda CG 160 Titan 2024\n\nEntrada: R\$ 4\.000\n/)
  assert.ok(!r.mensagens[0].includes('20.000'), 'sem "Preço no WhatsApp" o valor da moto não aparece')
  assert.match(r.mensagens[1], /^Perfeito, anotei tudo!/)
  assert.equal(r.simulacao?.avaliacao, 'CABE')
  assert.equal(r.simulacao?.renda, 3500)
  assert.equal(r.simulacao?.origem, 'ROBO')
  assert.equal(r.estado.respostas._simulacao, undefined)
})

test('robô: "pular" a renda simula sem a leitura; à vista, sem preço ou desligado não simula', () => {
  const sim = simuladorDoRobo(CONFIG_PADRAO, ctx, vitrineSim())
  const pulou = avancarRoteiro(CONFIG_PADRAO, ateOFim(sim, 'Financiado', 'não').estado, 'pular', ctx, undefined, sim)
  assert.equal(pulou.simulacao?.avaliacao, 'SEM_RENDA')
  assert.equal(pulou.simulacao?.entradaAjustada, true, 'sem entrada usa a mínima')
  const semPerguntar = ateOFim(simuladorDoRobo(CONFIG_PADRAO, ctx, vitrineSim({ simulacao: { ...lerConfigSimulacao(null), perguntarRenda: false } })), 'Financiado', '4 mil')
  assert.ok(semPerguntar.desfecho === 'QUALIFICADO' && semPerguntar.simulacao?.avaliacao === 'SEM_RENDA')
  const aVista = ateOFim(sim, 'À vista', '4 mil')
  assert.ok(aVista.desfecho === 'QUALIFICADO' && !aVista.simulacao && aVista.mensagens.length === 1)
  assert.equal(simuladorDoRobo(CONFIG_PADRAO, ctx, vitrineSim({ simulacaoAtiva: false })), undefined)
  const semPreco = ateOFim(simuladorDoRobo(CONFIG_PADRAO, ctx, vitrineSim({ motos: [lander] })), 'Financiado', '4 mil')
  assert.ok(semPreco.desfecho === 'QUALIFICADO' && !semPreco.simulacao)
  const pediu = avancarRoteiro(CONFIG_PADRAO, ateOFim(sim, 'Financiado', '4 mil').estado, 'prefiro falar com o vendedor', ctx, undefined, sim)
  assert.equal(pediu.desfecho, 'PEDIU_ATENDENTE')
})

test('simulação na nota e nas etiquetas do lead', () => {
  const nota = (simulacao: string | null) => calcularNota({ cfg: CONFIG_PADRAO, origem: null, respostas: {}, textosDoContato: ['oi'], simulacao }).nota
  assert.equal(nota(null), 0)
  assert.equal(nota('CABE'), 15)
  assert.equal(nota('APERTADA'), 5)
  assert.equal(nota('NAO_CABE'), 0, 'nunca abaixo de zero')
  assert.deepEqual(etq({}, ['oi'], { simulacao: 'CABE' }), ['SIMULOU', 'PARCELA_CABE'])
  assert.deepEqual(etq({}, ['oi'], { simulacao: 'APERTADA' }), ['SIMULOU', 'PARCELA_APERTADA'])
  assert.deepEqual(etq({}, ['oi'], { simulacao: 'NAO_CABE' }), ['SIMULOU', 'PARCELA_NAO_CABE'])
  assert.deepEqual(etq({}, ['oi'], { simulacao: 'SEM_RENDA' }), ['SIMULOU'])
})

test('a renda do cliente não vai para a IA', () => {
  const respostas = { interesse: 'CG 160', _renda: 'uns 3.500', _kb: 'x', _simulacao: 'RENDA' }
  assert.deepEqual(respostasParaIA(respostas), { interesse: 'CG 160' })
  assert.equal(textoParaIA(' uns 3.500 ', respostas), '[renda informada para a simulação]')
  assert.equal(textoParaIA('quero a CG', respostas), 'quero a CG')
  assert.equal(respostasParaIA(null), null)
})

test('"? simular" no chat "Você"', () => {
  assert.deepEqual(interpretarPergunta('? simular CG 160 entrada 3 mil renda 2500'), { tipo: 'SIMULAR', alvo: 'CG 160', entrada: 3000, renda: 2500 })
  assert.deepEqual(interpretarPergunta('simular 15 mil com 2 mil de entrada?'), { tipo: 'SIMULAR', alvo: '15 mil', entrada: 2000, renda: null })
  assert.deepEqual(interpretarPergunta('? simulação da XRE 300 sem entrada'), { tipo: 'SIMULAR', alvo: 'XRE 300', entrada: 0, renda: null })
  assert.deepEqual(interpretarPergunta('? simula bros renda de 3 mil e entrada de 1.500'), { tipo: 'SIMULAR', alvo: 'bros', entrada: 1500, renda: 3000 })
  assert.equal(interpretarPergunta('simular a proposta amanhã'), null, 'anotação sem ? continua anotação')
})

// ---------- Pré-análise de crédito ----------
import { aceitaPreAnalise, lerCpf, lerNascimento, leituraCredito, recusaPreAnalise, textoAprovacao, textoFicha } from '../src/lib/assistenteSimulacao'
import { complementarResposta } from '../src/lib/assistenteRoteiro'
import { semDinheiro } from '../src/lib/smIA'

test('CPF e data de nascimento escritos pelo cliente', () => {
  assert.equal(lerCpf('529.982.247-25'), '52998224725')
  assert.equal(lerCpf('meu cpf é 111 444 777 35'), '11144477735')
  assert.equal(lerCpf('52998224724'), null, 'dígito verificador errado')
  assert.equal(lerCpf('111.111.111-11'), null, 'todos iguais')
  assert.equal(lerCpf('91988887777'), null, 'telefone não passa por CPF')
  const hoje = new Date('2026-10-24T12:00:00Z')
  assert.equal(lerNascimento('15/03/1990', hoje), '15/03/1990')
  assert.equal(lerNascimento('5-3-90', hoje), '05/03/1990')
  assert.equal(lerNascimento('nasci em 15 de março de 1990', hoje), '15/03/1990')
  assert.equal(lerNascimento('15031990', hoje), '15/03/1990')
  assert.equal(lerNascimento('31/02/1990', hoje), null, 'data que não existe')
  assert.equal(lerNascimento('10/10/2012', hoje), null, 'menor de 18')
  assert.equal(lerNascimento('amanhã', hoje), null)
  assert.ok(aceitaPreAnalise('Sim, pode') && aceitaPreAnalise('autorizo') && !aceitaPreAnalise('não quero') && recusaPreAnalise('Não quero') && recusaPreAnalise('agora não'))
})

const comFicha = (extra: Partial<VitrineLoja> = {}) => vitrineSim({ simulacao: { ...lerConfigSimulacao({ bancos: ['Santander', 'BV', 'PAN'], preAnalise: true }) }, ...extra })
const ateAutorizacao = () => {
  const sim = simuladorDoRobo(CONFIG_PADRAO, ctx, comFicha())
  return { sim, p: avancarRoteiro(CONFIG_PADRAO, ateOFim(sim, 'Financiado', '4 mil').estado, '3500', ctx, undefined, sim) }
}

test('robô: depois da simulação pede a autorização, o CPF e a data de nascimento', () => {
  const { sim, p } = ateAutorizacao()
  assert.equal(p.desfecho, null)
  assert.equal(p.mensagens.length, 2)
  assert.match(p.mensagens[0], /^📊 \*Simulação de financiamento\*/)
  assert.match(p.mensagens[1], /pré-análise de crédito\* nos bancos parceiros \(Santander, BV e PAN\)\? .*CPF.*Responda \*sim\*/)
  assert.ok(p.simulacao, 'a simulação já fica guardada')
  let q = avancarRoteiro(CONFIG_PADRAO, p.estado, 'Sim, pode', ctx, undefined, sim)
  assert.equal(q.mensagens[0], 'Combinado! Me manda o seu CPF (só os números).')
  q = avancarRoteiro(CONFIG_PADRAO, q.estado, '529.982.247-24', ctx, undefined, sim)
  assert.match(q.mensagens[0], /não parece certo/)
  q = avancarRoteiro(CONFIG_PADRAO, q.estado, '529.982.247-25', ctx, undefined, sim)
  assert.equal(q.ficha?.cpf, '52998224725')
  assert.equal(q.ficha?.consentimento?.resposta, 'Sim, pode')
  assert.match(q.ficha!.consentimento!.pergunta, /pré-análise/)
  assert.ok(!JSON.stringify(q.estado.respostas).includes('52998224725'), 'o CPF não fica nas respostas do roteiro')
  assert.match(q.mensagens[0], /data de nascimento/)
  const fim = avancarRoteiro(CONFIG_PADRAO, q.estado, '15/03/1990', ctx, undefined, sim)
  assert.equal(fim.desfecho, 'QUALIFICADO')
  assert.equal(fim.ficha?.nascimento, '15/03/1990')
  assert.match(fim.mensagens[0], /^🔒 Recebido! Brenda faz a pré-análise/)
  assert.match(fim.mensagens[1], /^Perfeito, anotei tudo!/)
  assert.ok(!fim.mensagens.some(m => m.includes('📊')), 'a simulação não se repete')
  assert.equal(fim.estado.respostas._ficha, 'COMPLETA')
})

test('robô: "não quero" na autorização encerra normal (não é pedido para parar)', () => {
  const { sim, p } = ateAutorizacao()
  const nao = avancarRoteiro(CONFIG_PADRAO, p.estado, 'Não quero', ctx, undefined, sim)
  assert.ok(nao.desfecho === 'QUALIFICADO' && /^Perfeito, anotei tudo!/.test(nao.mensagens[0]) && !nao.ficha)
  assert.equal(nao.estado.respostas._ficha, 'RECUSOU')
  assert.equal(avancarRoteiro(CONFIG_PADRAO, p.estado, 'parar', ctx, undefined, sim).desfecho, 'DESISTIU')
  assert.equal(avancarRoteiro(CONFIG_PADRAO, p.estado, 'quero falar com a vendedora', ctx, undefined, sim).desfecho, 'PEDIU_ATENDENTE')
  const cpf = avancarRoteiro(CONFIG_PADRAO, p.estado, 'sim', ctx, undefined, sim)
  const duasVezes = avancarRoteiro(CONFIG_PADRAO, avancarRoteiro(CONFIG_PADRAO, cpf.estado, '123', ctx, undefined, sim).estado, '456', ctx, undefined, sim)
  assert.ok(duasVezes.desfecho === 'QUALIFICADO' && duasVezes.estado.respostas._ficha === 'SEM_CPF', 'CPF errado duas vezes: o vendedor segue')
  assert.deepEqual(complementarResposta(CONFIG_PADRAO, cpf.estado, '529.982.247-25').respostas, cpf.estado.respostas, 'mensagem extra no passo do CPF não vai para a resposta anterior')
  const sem = ateOFim(simuladorDoRobo(CONFIG_PADRAO, ctx, comFicha({ simulacao: lerConfigSimulacao({ bancos: ['BV'], preAnalise: false }) })), 'Financiado', '4 mil')
  assert.ok(!avancarRoteiro(CONFIG_PADRAO, sem.estado, '3500', ctx, undefined, simuladorDoRobo(CONFIG_PADRAO, ctx, comFicha({ simulacao: lerConfigSimulacao({ bancos: ['BV'], preAnalise: false }) }))).mensagens.some(m => /pré-análise/.test(m)), 'desligada: não pede')
  assert.equal(lerConfigSimulacao({ bancos: [], preAnalise: true }).preAnalise, false, 'sem banco cadastrado não liga')
  assert.deepEqual(lerConfigSimulacao({ bancos: [' Santander ', 'santander', 'BV', '', 3] }).bancos, ['Santander', 'BV'])
})

test('pré-análise na nota, nas etiquetas, no funil e fora da IA', () => {
  const credito = (st: string[]) => leituraCredito({ analises: st.map(status => ({ status })) })
  assert.deepEqual(credito(['A_ENVIAR', 'APROVADA']), { ficha: true, aprovado: true, recusado: false })
  assert.deepEqual(credito(['RECUSADA', 'RECUSADA']), { ficha: true, aprovado: false, recusado: true })
  assert.equal(leituraCredito(null), null)
  const nota = (c: ReturnType<typeof credito>) => calcularNota({ cfg: CONFIG_PADRAO, origem: 'ANUNCIO', respostas: {}, textosDoContato: ['oi'], credito: c }).nota
  assert.equal(nota(credito(['EM_ANALISE'])), 25)
  assert.equal(nota(credito(['APROVADA'])), 45)
  assert.equal(nota(credito(['RECUSADA'])), 5)
  assert.deepEqual(etq({}, ['oi'], { credito: credito(['APROVADA', 'RECUSADA']) }), ['FICHA_CREDITO', 'CREDITO_APROVADO'])
  assert.deepEqual(etq({}, ['oi'], { credito: credito(['RECUSADA']) }), ['FICHA_CREDITO', 'CREDITO_RECUSADO'])
  const base = { vendedorRespondeu: true, textosDoContato: ['oi'], textosDoVendedor: [] as string[], nota: 40, desfeitos: [] as string[] }
  assert.deepEqual(proximaEtapa({ ...base, estagio: 'ABORDADO', etiquetas: ['CREDITO_APROVADO'] }), { para: 'NEGOCIACAO', motivo: 'crédito pré-aprovado no banco' })
  const aprovacao = textoAprovacao({ banco: 'BV', status: 'APROVADA', entrada: 3000, prazo: 36, parcela: 612.4, taxa: 2.1 }, { nome: 'Ana', vendedor: 'Brenda' })
  assert.match(aprovacao, /^✅ Boa notícia, Ana! Sua pré-análise foi aprovada no BV: entrada de R\$ 3\.000 e 36x de R\$ 612,40\./)
  assert.ok(aprovacao.includes('Sujeito à confirmação dos documentos'))
  assert.deepEqual(proximaEtapa({ ...base, estagio: 'NEGOCIACAO', etiquetas: [], textosDoVendedor: [aprovacao] }), { para: 'PROPOSTA', motivo: 'você enviou a proposta' })
  const ficha = textoFicha({ nome: 'Ana Paula', telefone: '5591999990000', cpf: '52998224725', nascimento: '15/03/1990', renda: 3500, moto: 'Honda CG 160', valor: 20000, entrada: 4000, autorizadoEm: new Date('2026-10-24T15:30:00Z') })
  assert.match(ficha, /^Nome: Ana Paula\nCPF: 529\.982\.247-25\nNascimento: 15\/03\/1990\n.*Renda informada: R\$ 3\.500\nVeículo: Honda CG 160 · R\$ 20\.000\nEntrada: R\$ 4\.000\nAutorizou a consulta em 24\/10\/2026, 12:30$/s)
  const ia = JSON.stringify(semDinheiro({ conversa: ['meu cpf: 529.982.247-25', 'nasci 15/03/1990', 'pode ser dia 15/11?'], cpf: '52998224725', renda: 3500 }))
  assert.ok(!ia.includes('529') && !ia.includes('1990') && !ia.includes('3500') && ia.includes('[CPF]') && ia.includes('[data de nascimento]') && ia.includes('15/11'), ia)
})
