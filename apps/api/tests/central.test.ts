// PDF 07 · Central de Conhecimento — testes de sincronização, permissões, privacidade e consultas.
// Rodam num banco de teste (DATABASE_URL apontando para um Postgres local com as migrações
// aplicadas). Cada execução cria uma loja nova e não toca em nenhuma outra; nada é apagado
// fora do que o próprio teste criou no índice. Sem banco, os testes são pulados.
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'crypto'
import { prisma } from '../src/lib/prisma'
import { processarEventos, cargaInicial, conferir, tentarDeNovo, TENTATIVAS_ALERTA } from '../src/lib/centralConhecimento/rotinas'
import { buscar, normalizar } from '../src/lib/centralConhecimento/indice'
import { FONTES, fontePorChave } from '../src/lib/centralConhecimento/fontes'
import { contextoDaPessoa, type CtxCentral } from '../src/lib/centralConhecimento/contexto'
import { Reservas, executarConsulta, CONSULTAS } from '../src/lib/centralConhecimento/consultas'
import { saude, topo } from '../src/lib/centralConhecimento/saude'
import { envioSeguro } from '../src/lib/pergunte'
import { textoDaIaSeguro } from '../src/lib/pergunteAgente'
import { FICHAS_PADRAO, ler, mesCorrente } from '../src/lib/metricas'

let temBanco = false
const loja = { id: '', vendA: '', vendB: '', sdr: '', leadA: '', leadB: '', moto: '', notaA: '', verbeteAtivo: '', verbeteRascunho: '' }
const CPF = '123.456.789-09'
const NASC = '1990-03-15'
const PRECO = 48_750
const VALOR_LEAD = 51_230

async function drenar() { for (let i = 0; i < 20; i++) { const r = await processarEventos(8000); if (!r.centralProcessados && !r.centralFalhas) break } }
async function ctxDe(vendedorId: string | null): Promise<CtxCentral> { return (await contextoDaPessoa(loja.id, vendedorId, 'Teste'))! }

before(async () => {
  try { await prisma.$queryRaw`SELECT 1 FROM pro_labore_cc_documentos LIMIT 1`; temBanco = true } catch { temBanco = false; return }
  const u = await prisma.proLaboreUsuario.create({ data: { nome: 'Loja Teste Central', email: `central-${randomUUID()}@teste.local`, senhaHash: 'x' } })
  loja.id = u.id
  const [a, b, s] = await Promise.all([
    prisma.vendedor.create({ data: { usuarioId: u.id, nome: 'Ana Vendedora', papel: 'VENDEDOR' } }),
    prisma.vendedor.create({ data: { usuarioId: u.id, nome: 'Bruno Vendedor', papel: 'VENDEDOR' } }),
    prisma.vendedor.create({ data: { usuarioId: u.id, nome: 'Sara SDR', papel: 'SDR' } }),
  ])
  loja.vendA = a.id; loja.vendB = b.id; loja.sdr = s.id
  const la = await prisma.lead.create({ data: { usuarioId: u.id, vendedorId: a.id, nomeCliente: 'Carlos Zéfiro', telefone: '91988887777', cpf: CPF, email: 'carlos@x.com', modeloInteresse: 'Honda CG 160', valorNegociacao: VALOR_LEAD, etapa: 'NEGOCIACAO', observacao: 'cliente disse que nasceu em 15/03/1990' } })
  const lb = await prisma.lead.create({ data: { usuarioId: u.id, vendedorId: b.id, nomeCliente: 'Débora Quintana', telefone: '91977776666', modeloInteresse: 'Yamaha Fazer 250', valorNegociacao: 30_000, etapa: 'LEAD' } })
  loja.leadA = la.id; loja.leadB = lb.id
  await prisma.cliente.create({ data: { usuarioId: u.id, nome: 'Carlos Zéfiro', telefone: '91988887777' } })
  const m = await prisma.smMotoEstoque.create({ data: { usuarioId: u.id, modelo: 'CB 500X', marca: 'Honda', ano: 2023, cor: 'vermelha', km: 8000, preco: PRECO, entradaEm: new Date(Date.now() - 90 * 86_400_000), placa: 'QWE1A23' } })
  loja.moto = m.id
  await prisma.venda.create({ data: { usuarioId: u.id, vendedorId: a.id, data: new Date(), valorVenda: 61_111, valorProLabore: 2_222, valorComissao: 1_333, motoId: m.id } })
  const n = await prisma.nota.create({ data: { usuarioId: u.id, vendedorId: a.id, titulo: 'Plano secreto da Ana', conteudo: 'Ligar para o cliente Zéfiro amanhã cedo' } })
  loja.notaA = n.id
  const va = await prisma.assistenteConhecimento.create({ data: { usuarioId: u.id, tipo: 'OBJECAO', titulo: 'Está caro demais', resposta: 'Entendo! Vamos ver a parcela que cabe no seu bolso.', palavrasChave: ['caro', 'preco alto'], status: 'ATIVO', aprovadoPor: 'Dono' } })
  const vr = await prisma.assistenteConhecimento.create({ data: { usuarioId: u.id, tipo: 'DUVIDA', titulo: 'Aceita consórcio contemplado?', rascunho: 'Sim, avaliamos.', palavrasChave: ['consorcio'], status: 'PARA_REVISAR' } })
  loja.verbeteAtivo = va.id; loja.verbeteRascunho = vr.id
  await prisma.lancamentoFinanceiro.create({ data: { usuarioId: u.id, categoria: 'CUSTO', numero: 1, favorecido: 'Oficina Boa', documento: CPF, pagador: 'Loja', descricao: 'Revisão da CB', itens: [], valorTotal: 7_391, pagoEm: new Date() } })
  await drenar()
  // Indicadores entram pela carga inicial (não há evento antes da primeira versão).
  for (let i = 0; i < 20; i++) { const r = await cargaInicial(20_000); if (!r.centralCarga) break }
})

test('o gatilho grava o evento na mesma transação e o processamento leva ao índice', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const doc = await prisma.centralDocumento.findUnique({ where: { fonte_registroId: { fonte: 'pro_labore_leads', registroId: loja.leadA } } })
  assert.ok(doc, 'lead no índice')
  assert.match(doc!.titulo, /Carlos/)
  await prisma.lead.update({ where: { id: loja.leadA }, data: { nomeCliente: 'Carlos Zéfiro Neto' } })
  const ev = await prisma.centralEvento.findUnique({ where: { fonte_registroId: { fonte: 'pro_labore_leads', registroId: loja.leadA } } })
  assert.equal(ev?.processadoEm, null, 'evento pendente logo após a gravação')
  await drenar()
  const doc2 = await prisma.centralDocumento.findUnique({ where: { fonte_registroId: { fonte: 'pro_labore_leads', registroId: loja.leadA } } })
  assert.match(doc2!.titulo, /Neto/)
})

test('reprocessar o mesmo evento não duplica nada', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const antes = await prisma.centralDocumento.count({ where: { usuarioId: loja.id } })
  await prisma.centralEvento.updateMany({ where: { usuarioId: loja.id }, data: { processadoEm: null } })
  await drenar()
  await prisma.centralEvento.updateMany({ where: { usuarioId: loja.id }, data: { processadoEm: null } })
  await drenar()
  assert.equal(await prisma.centralDocumento.count({ where: { usuarioId: loja.id } }), antes)
  const eventos = await prisma.centralEvento.count({ where: { fonte: 'pro_labore_leads', registroId: loja.leadA } })
  assert.equal(eventos, 1, 'uma linha de evento por registro')
})

test('falha gera nova tentativa e, a partir da 5ª, alerta na Saúde; "tentar de novo" recupera', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const def = fontePorChave('estoque')!
  const original = def.montar!
  def.montar = async () => { throw new Error('falha simulada') }
  try {
    for (let i = 0; i < TENTATIVAS_ALERTA; i++) {
      await prisma.smMotoEstoque.update({ where: { id: loja.moto }, data: { km: 8000 + i } }).catch(() => undefined)
      if (i === 0) await drenar()
      else { await prisma.centralEvento.updateMany({ where: { fonte: 'pro_labore_sm_motos_estoque', registroId: loja.moto }, data: { proximaTentativaEm: null, tentativas: i } }); await processarEventos(4000) }
    }
    const ev = await prisma.centralEvento.findUnique({ where: { fonte_registroId: { fonte: 'pro_labore_sm_motos_estoque', registroId: loja.moto } } })
    assert.equal(ev?.processadoEm, null)
    assert.ok((ev?.tentativas ?? 0) >= TENTATIVAS_ALERTA)
    assert.ok(ev?.proximaTentativaEm, 'nova tentativa agendada')
    const s = await saude(loja.id)
    assert.ok(s.eventosComErro.some(e => e.alerta), 'alerta na Saúde')
    assert.equal(s.fontes.find(f => f.chave === 'estoque')?.situacao, 'FALHA')
  } finally { def.montar = original }
  await tentarDeNovo(loja.id, { fonte: 'estoque' })
  await drenar()
  const ev = await prisma.centralEvento.findUnique({ where: { fonte_registroId: { fonte: 'pro_labore_sm_motos_estoque', registroId: loja.moto } } })
  assert.ok(ev?.processadoEm, 'processado depois de tentar de novo')
})

test('conferência diária acha o que falta, corrige sozinha e depois dá a divergência como resolvida', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  await prisma.centralDocumento.deleteMany({ where: { fonte: 'pro_labore_leads', registroId: loja.leadB } })
  await conferir(30_000, new Date(), loja.id)
  const abertas = await prisma.centralDivergencia.findMany({ where: { usuarioId: loja.id, resolvidaEm: null } })
  assert.ok(abertas.some(d => d.registroId === loja.leadB))
  await drenar()
  assert.ok(await prisma.centralDocumento.findUnique({ where: { fonte_registroId: { fonte: 'pro_labore_leads', registroId: loja.leadB } } }))
  await conferir(30_000, new Date(), loja.id)
  assert.equal(await prisma.centralDivergencia.count({ where: { usuarioId: loja.id, resolvidaEm: null } }), 0)
})

test('privacidade: o índice não tem CPF, nascimento, R$, valores, e-mail nem observação', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const docs = await prisma.centralDocumento.findMany({ where: { usuarioId: loja.id } })
  assert.ok(docs.length >= 10)
  const tudo = docs.map(d => [d.titulo, d.resumo, d.textoBusca, ...d.palavrasChave].join(' ')).join('\n')
  for (const proibido of [CPF, CPF.replace(/\D/g, ''), '15/03/1990', NASC, 'R$', String(PRECO), '48.750', String(VALOR_LEAD), '51.230', '61.111', '61111', '2.222', '1.333', '7.391', '7391', 'carlos@x.com', 'nasceu', '91988887777']) {
    assert.ok(!tudo.includes(proibido), `não pode conter ${proibido}`)
  }
  assert.ok(tudo.includes('final 7777'), 'telefone só com os 4 últimos dígitos')
})

test('permissões: vendedor não acha lead de outro; anotação só para a autora; rascunho só para a gestão', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const [dono, ana, bruno] = await Promise.all([ctxDe(null), ctxDe(loja.vendA), ctxDe(loja.vendB)])
  const titulos = async (c: CtxCentral, q: string) => (await buscar(c, q)).grupos.flatMap(g => g.itens.map(i => i.titulo))
  assert.ok((await titulos(dono, 'carlos')).some(x => /Carlos/.test(x)))
  assert.ok((await titulos(ana, 'carlos')).some(x => /Carlos/.test(x)))
  assert.ok(!(await titulos(bruno, 'carlos')).some(x => /Carlos/.test(x)), 'Bruno não vê lead da Ana')
  assert.ok((await titulos(bruno, 'debora')).some(x => /Débora/.test(x)), 'busca sem acento')
  assert.ok((await titulos(ana, 'plano secreto')).length > 0, 'a autora acha a própria anotação')
  assert.equal((await titulos(bruno, 'plano secreto')).length, 0)
  assert.equal((await titulos(dono, 'plano secreto')).length, 0, 'nem o dono vê anotação da equipe')
  assert.ok((await titulos(dono, 'consorcio')).some(x => /consórcio/.test(x)), 'gestão vê rascunho')
  assert.ok(!(await titulos(ana, 'consorcio')).some(x => /consórcio/.test(x)), 'vendedora não vê rascunho')
  assert.ok((await titulos(ana, 'caro')).some(x => /caro/.test(x)), 'verbete aprovado é de todos')
  assert.equal((await buscar(bruno, 'oficina')).total, 0, 'lançamento do Financeiro fora do alcance do vendedor')
  assert.ok((await titulos(dono, 'oficina')).length > 0)
})

test('busca tolera erro de digitação (com pg_trgm) e acha pelos 4 últimos dígitos do telefone', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const dono = await ctxDe(null)
  const r = await buscar(dono, 'quintanna')
  const ext = await prisma.$queryRaw<Array<{ n: bigint }>>`SELECT count(*) n FROM pg_extension WHERE extname = 'pg_trgm'`
  if (Number(ext[0].n)) assert.ok(r.total > 0, 'erro de digitação')
  assert.ok((await buscar(dono, '6666')).grupos.some(g => g.itens.some(i => /Débora/.test(i.titulo))))
  assert.equal(normalizar('Ação Çedo'), 'acao cedo')
})

test('consultas seguras: valores em R$ só como espaço reservado; preenchimento pelo sistema', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const dono = await ctxDe(null)
  for (const c of CONSULTAS) {
    const r = new Reservas()
    const entrada = c.nome === 'metricas' ? { chaves: ['faturamento', 'vendas', 'dias_em_estoque'], periodo: 'MES', sobre: 'LOJA' } : c.nome === 'ver_lead' ? { id: loja.leadA } : c.nome === 'atividades' ? { quando: 'ATRASADAS' } : c.nome === 'pesquisar' ? { texto: 'carlos' } : {}
    const ex = await executarConsulta(dono, c.nome, entrada, r)
    const json = JSON.stringify(ex.dados)
    assert.ok(envioSeguro(json), `${c.nome}: envio seguro`)
    for (const proibido of [CPF, 'carlos@x.com', '48.750', '51.230', '61.111', 'nasceu', '91988887777']) assert.ok(!json.includes(proibido), `${c.nome} não pode conter ${proibido}`)
  }
  const r = new Reservas()
  const ex = await executarConsulta(dono, 'buscar_vendas', {}, r)
  const json = JSON.stringify(ex.dados)
  const k = json.match(/\{\{v\d+\}\}/)?.[0]
  assert.ok(k, 'valor reservado')
  assert.match(r.preencher(`Faturou ${k}`), /R\$/)
})

test('consultas seguras: parâmetro inválido não executa; consulta fora do catálogo é recusada', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const dono = await ctxDe(null)
  const r = new Reservas()
  assert.match(JSON.stringify((await executarConsulta(dono, 'buscar_leads', { limite: 9999 }, r)).dados), /Parâmetros inválidos/)
  assert.match(JSON.stringify((await executarConsulta(dono, 'DROP TABLE', {}, r)).dados), /desconhecida/)
  const bruno = await ctxDe(loja.vendB)
  const v = JSON.stringify((await executarConsulta(bruno, 'ver_lead', { id: loja.leadA }, r)).dados)
  assert.match(v, /fora do acesso/)
})

test('texto da IA com R$ ou CPF fora dos espaços reservados é recusado', () => {
  assert.equal(textoDaIaSeguro('O faturamento foi {{v1}}, acima da meta.'), true)
  assert.equal(textoDaIaSeguro('O faturamento foi R$ 12.000.'), false)
  assert.equal(textoDaIaSeguro('CPF 123.456.789-09'), false)
  assert.equal(textoDaIaSeguro('Foram 12 vendas.'), true)
})

test('as 9 métricas novas calculam sem erro e o topo/Saúde respondem', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const novas = FICHAS_PADRAO.filter(f => f.lote === 6)
  assert.equal(novas.length, 9)
  for (const f of novas) await ler(f.chave, { usuarioId: loja.id, papel: 'DONO', vendedorId: null }, mesCorrente(), new Date(), { faixas: false })
  const l = await ler('motos_paradas', { usuarioId: loja.id, papel: 'DONO', vendedorId: null }, mesCorrente(), new Date(), { faixas: false })
  assert.equal(l.valor, 1, 'a moto com 90 dias está parada')
  assert.ok(FICHAS_PADRAO.every(f => Array.isArray(f.sinonimos)), 'sinônimos na ficha (fonte única)')
  const dono = await ctxDe(null)
  const tp = await topo(dono)
  assert.equal(tp.numeros.length, 3)
  const s = await saude(loja.id)
  assert.equal(s.fontes.length, FONTES.length)
  assert.ok(s.cobertura >= 99, `cobertura ${s.cobertura}%`)
})

test('verbete: cada mudança vira versão; excluir nunca apaga', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  await prisma.assistenteConhecimento.update({ where: { id: loja.verbeteAtivo }, data: { resposta: 'Nova resposta aprovada.' } })
  const vs = await prisma.assistenteConhecimentoVersao.findMany({ where: { conhecimentoId: loja.verbeteAtivo }, orderBy: { versao: 'asc' } })
  assert.ok(vs.length >= 2)
  assert.equal(vs[vs.length - 1].resposta, 'Nova resposta aprovada.')
  const v = await prisma.assistenteConhecimento.findUnique({ where: { id: loja.verbeteAtivo } })
  assert.equal(v?.versaoAtual, vs[vs.length - 1].versao)
  await assert.rejects(prisma.assistenteConhecimentoVersao.deleteMany({ where: { conhecimentoId: loja.verbeteAtivo } }), 'versões são imutáveis')
})

// --- Catálogo de todos os dados (consulta direta) ---
import { listarEntidades, consultarDados, agregarDados } from '../src/lib/centralConhecimento/catalogoDados'

test('catálogo: o dono vê todas as entidades da loja, menos as que nunca vão à IA', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const dono = await ctxDe(null)
  const nomes = listarEntidades(dono).map(e => e.nome)
  for (const n of ['Lead', 'Venda', 'PagamentoComissao', 'LancamentoFinanceiro', 'SocialMediaConta', 'TrafegoInsightDiario', 'AssistenteMensagem', 'Ocorrencia', 'AgendaItem', 'EventoAuditoria', 'ParametroLiquidez']) assert.ok(nomes.includes(n), `inclui ${n}`)
  for (const n of ['LeadNota', 'Nota', 'ProcessoAtendimento', 'IaEnvio', 'ProLaboreUsuario', 'AgenteMensagem']) assert.ok(!nomes.includes(n), `não inclui ${n}`)
  assert.ok(nomes.length >= 100, `${nomes.length} entidades`)
  const lead = listarEntidades(dono, 'Lead').find(e => e.nome === 'Lead')!
  for (const c of ['cpf', 'email', 'endereco', 'observacao']) assert.ok(!lead.campos.some(x => x.nome === c), `Lead sem ${c}`)
  assert.equal(lead.campos.find(c => c.nome === 'valorNegociacao')?.tipo, 'dinheiro')
})

test('catálogo: varre TODAS as entidades como dono sem erro e sem dado sensível', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const dono = await ctxDe(null)
  for (const e of listarEntidades(dono)) {
    const r = new Reservas()
    const out = await consultarDados(dono, { entidade: e.nome, limite: 5 }, r)
    const json = JSON.stringify(out)
    assert.ok(!(out as { erro?: string }).erro, `${e.nome}: ${json.slice(0, 200)}`)
    assert.ok(envioSeguro(json), `${e.nome}: envio seguro`)
    for (const proibido of [CPF, 'carlos@x.com', '91988887777', '48.750', '51.230', '61.111', 'nasceu', 'senhaHash']) assert.ok(!json.includes(proibido), `${e.nome} não pode conter ${proibido}`)
  }
})

test('catálogo: último lead de uma vendedora, soma do pró-labore e contagem por vendedor', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const dono = await ctxDe(null)
  const r = new Reservas()
  const ult = await consultarDados(dono, { entidade: 'Lead', filtros: [{ campo: 'vendedor.nome', op: 'contem', valor: 'Ana' }], ordenar: { campo: 'criadoEm', direcao: 'desc' }, campos: ['nomeCliente', 'vendedor.nome', 'valorNegociacao', 'telefone'], limite: 1 }, r) as { linhas: Array<Record<string, string>> }
  assert.match(ult.linhas[0].nomeCliente, /Carlos/)
  assert.match(ult.linhas[0].valorNegociacao, /^\{\{v\d+\}\}$/)
  assert.equal(ult.linhas[0].telefone, 'final 7777')
  const soma = await agregarDados(dono, { entidade: 'Venda', medida: 'somar', campoMedida: 'valorProLabore' }, r) as { valor: string }
  assert.match(r.preencher(soma.valor), /R\$\s*2\.222/)
  const porVend = await agregarDados(dono, { entidade: 'Lead', medida: 'contar', agruparPor: 'vendedorId' }, r) as { grupos: Array<{ grupo: string; valor: number }> }
  assert.ok(porVend.grupos.some(g => /Ana/.test(g.grupo)), 'grupo pelo nome do vendedor')
})

test('catálogo: permissões e escopo pessoal no servidor', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  const bruno = await ctxDe(loja.vendB)
  const r = new Reservas()
  const leads = await consultarDados(bruno, { entidade: 'Lead', campos: ['nomeCliente'] }, r) as { linhas: Array<{ nomeCliente: string }> }
  assert.ok(leads.linhas.every(l => !/Carlos/.test(l.nomeCliente)), 'Bruno não vê o lead da Ana')
  assert.match(JSON.stringify(await consultarDados(bruno, { entidade: 'Venda', campos: ['valorProLabore'] }, r)), /fora da Central/)
  assert.match(JSON.stringify(await consultarDados(bruno, { entidade: 'LancamentoFinanceiro' }, r)), /erro/)
  assert.match(JSON.stringify(await consultarDados(bruno, { entidade: 'ParametroLiquidez' }, r)), /não fica visível/)
  assert.match(JSON.stringify(await consultarDados(await ctxDe(null), { entidade: 'LeadNota' }, r)), /notas da negociação/)
  assert.match(JSON.stringify(await consultarDados(await ctxDe(null), { entidade: 'Lead', filtros: [{ campo: 'cpf', op: 'igual', valor: '1' }] }, r)), /fora da Central/)
})
