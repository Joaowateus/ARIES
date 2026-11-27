// Tela inicial do ARIES (especificação de 17/11): uma tela igual para toda a
// loja. Tarefas e notas são compartilhadas; os indicadores, os insights, a
// atividade recente e a busca respeitam o alcance de cada papel (vendedor vê o
// que é dele; cifras de tráfego só para quem já tem acesso). Nada é inventado:
// sem dado, o cartão mostra o estado vazio.
import { buscar as buscarNaCentral } from '../lib/centralConhecimento/indice'
import { contextoDoPedido } from '../lib/centralConhecimento/contexto'
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { nivelAtende } from '../lib/acessos'
import { leadWhereBase } from '../lib/escopoLead'
import { leadsPorDia, ler, mesCorrente, type Escopo } from '../lib/metricas'
import { lenteDaAba, principalDe } from '../lib/hoje'
import { NOME_ETAPA, type Etapa } from '../lib/etapasJornada'
import { pessoaDe } from './proLaboreHoje'

const router = Router()
const PESSOAL = new Set(['VENDEDOR', 'SDR'])
const NEGOCIACAO = ['NEGOCIACAO', 'PROPOSTA', 'AGENDAMENTO', 'VISITA']

const ve = (req: Request, modulo: string) => {
  const u = req.proLaboreUser!
  return u.papel === 'DONO' || nivelAtende(req.acessos?.[modulo], 'VER')
}
const nomeDe = (req: Request) => req.proLaboreUser!.nome ?? null

// --- Tudo da tela numa chamada ---
router.get('/inicio', requireProLaboreAuth, async (req: Request, res: Response) => {
  const pessoa = pessoaDe(req)
  const u = pessoa.usuarioId
  const agora = new Date()
  const pessoal = PESSOAL.has(pessoa.papel)
  const e: Escopo = { usuarioId: u, papel: pessoal ? pessoa.papel : 'DONO', vendedorId: pessoal ? pessoa.vendedorId ?? '__nenhum__' : null }
  const mes = mesCorrente(agora)
  const veCifra = pessoal || ['DONO', 'SUPERVISOR', 'FINANCEIRO'].includes(pessoa.papel)
  const veTrafego = pessoa.papel === 'DONO' || pessoa.papel === 'TRAFEGO' || ve(req, 'trafego')
  const leitura = (chave: string, pode: boolean) => (pode ? ler(chave, e, mes, agora, { faixas: false }).then(l => ({ chave, valor: l.valor, variacao: l.variacao, unidade: l.unidade })).catch(() => ({ chave, valor: null, variacao: null, unidade: null })) : Promise.resolve({ chave, valor: null, variacao: null, unidade: null, semAcesso: true }))
  const [parametros, tarefas, notas, indicadores, lente, atividade, leadsDia, saude] = await Promise.all([
    prisma.parametroLiquidez.findUnique({ where: { usuarioId: u }, select: { inicioFundo: true, inicioAtalhos: true } }).catch(() => null),
    prisma.inicioTarefa.findMany({ where: { usuarioId: u, excluidaEm: null }, orderBy: [{ feita: 'asc' }, { criadoEm: 'asc' }], take: 50 }),
    prisma.inicioNota.findMany({ where: { usuarioId: u, excluidaEm: null }, orderBy: { atualizadoEm: 'desc' }, take: 20 }),
    Promise.all([leitura('faturamento', veCifra), leitura('vendas', true), leitura('leads_novos', true), leitura('conversao_lead_venda', true), leitura('gasto_anuncio', veTrafego)]),
    lenteDaAba(pessoa, 'hoje', agora).catch(() => null),
    atividadeRecente(req, agora),
    leadsPorDia(e, mes).catch(() => null),
    // Saúde da loja: a mesma leitura da Lente, do Hoje e do Daily (a previsão é lida contra a meta). Quem não vê a métrica recebe semAcesso.
    Promise.all(['previsao_fechamento', 'vendas', 'conversao_lead_venda', 'atividades_atrasadas'].map(chave => principalDe(pessoa, chave, agora)
      .then(l => (l ? { chave, valor: l.valor, faixa: l.faixa, padrao: l.padrao, unidade: l.unidade } : { chave, valor: null, faixa: null, padrao: null, unidade: null, semAcesso: true }))
      .catch(() => ({ chave, valor: null, faixa: null, padrao: null, unidade: null })))),
  ])
  res.json({
    escopo: pessoal ? 'PROPRIO' : 'LOJA',
    fundo: parametros?.inicioFundo ?? null,
    atalhos: Array.isArray(parametros?.inicioAtalhos) ? parametros!.inicioAtalhos : null,
    podeConfigurar: pessoa.papel === 'DONO' || pessoa.papel === 'SUPERVISOR',
    tarefas, notas, indicadores,
    insights: (lente?.itens ?? []).filter(i => i.tipo !== 'NUMERO').slice(0, 6).map(i => ({ id: i.id ?? null, podeAceitar: !!i.podeAceitar, podeDescartar: !!i.podeDescartar, tipo: i.tipo, forca: i.forca, titulo: i.achado, texto: i.evidencia ? i.evidencia.replace(/\[\[[^\]]+\]\]/g, '').replace(/\s+/g, ' ').trim() || null : null, href: i.acao?.href ?? (i.tipo === 'REC' ? '/pro-labore/recomendacoes' : null) })),
    atividade, leadsPorDia: leadsDia, saude,
  })
})

// --- Atividade recente (dados reais, pelo alcance de quem vê) ---
async function atividadeRecente(req: Request, agora: Date) {
  const u = req.proLaboreUser!.sub
  const lead = ve(req, 'crm') || req.proLaboreUser!.papel === 'VENDEDOR' ? leadWhereBase(req) : null
  const desde = new Date(agora.getTime() - 30 * 86_400_000)
  type Item = { id: string; texto: string; modulo: string; em: Date; href: string }
  const itens: Item[] = []
  const [leads, etapas, vendas, motos, relatorios, campanhas] = await Promise.all([
    lead ? prisma.lead.findMany({ where: { ...lead, criadoEm: { gte: desde } }, orderBy: { criadoEm: 'desc' }, take: 8, select: { id: true, nomeCliente: true, criadoEm: true } }) : [],
    lead ? prisma.leadEstagioHistorico.findMany({ where: { criadoEm: { gte: desde }, estagioAnterior: { not: null }, lead: lead as Prisma.LeadWhereInput }, orderBy: { criadoEm: 'desc' }, take: 8, select: { id: true, estagioNovo: true, criadoEm: true, lead: { select: { id: true, nomeCliente: true } } } }) : [],
    prisma.venda.findMany({ where: { usuarioId: u, situacao: 'CONFIRMADA', criadoEm: { gte: desde }, ...(PESSOAL.has(pessoaDe(req).papel) ? { vendedorId: req.proLaboreUser!.vendedorId ?? '__nenhum__' } : {}) }, orderBy: { criadoEm: 'desc' }, take: 6, select: { id: true, criadoEm: true, moto: { select: { modelo: true } }, lead: { select: { nomeCliente: true } } } }),
    prisma.smMotoEstoque.findMany({ where: { usuarioId: u, criadoEm: { gte: desde } }, orderBy: { criadoEm: 'desc' }, take: 6, select: { id: true, modelo: true, ano: true, criadoEm: true } }),
    ['DONO', 'SUPERVISOR', 'FINANCEIRO'].includes(pessoaDe(req).papel) ? prisma.intelRelatorio.findMany({ where: { usuarioId: u, confirmadoEm: { gte: desde } }, orderBy: { confirmadoEm: 'desc' }, take: 4, select: { id: true, modulo: true, dia: true, confirmadoEm: true } }) : [],
    pessoaDe(req).papel === 'DONO' || ve(req, 'trafego')
      ? prisma.trafegoConta.findUnique({ where: { usuarioId: u }, select: { id: true } }).then(c => (c ? prisma.trafegoEstrutura.findMany({ where: { contaId: c.id, tipo: 'campanha', atualizadoEm: { gte: desde } }, orderBy: { atualizadoEm: 'desc' }, take: 4, select: { id: true, nome: true, atualizadoEm: true } }) : [])).catch(() => [])
      : [],
  ])
  for (const l of leads) itens.push({ id: `lead-${l.id}`, texto: `Lead cadastrado: ${l.nomeCliente}`, modulo: 'CRM', em: l.criadoEm, href: `/pro-labore/leads?lead=${l.id}` })
  for (const h of etapas) itens.push({ id: `etapa-${h.id}`, texto: `${h.lead.nomeCliente} foi para ${NOME_ETAPA[h.estagioNovo as Etapa] ?? h.estagioNovo}`, modulo: 'CRM', em: h.criadoEm, href: `/pro-labore/leads?lead=${h.lead.id}` })
  for (const v of vendas) itens.push({ id: `venda-${v.id}`, texto: `Venda concluída${v.moto?.modelo ? `: ${v.moto.modelo}` : ''}${v.lead?.nomeCliente ? ` para ${v.lead.nomeCliente}` : ''}`, modulo: 'Comercial', em: v.criadoEm, href: '/pro-labore/vendas' })
  for (const m of motos) itens.push({ id: `moto-${m.id}`, texto: `Moto incluída: ${m.modelo}${m.ano ? ` ${m.ano}` : ''}`, modulo: 'Estoque', em: m.criadoEm, href: '/pro-labore/aba/estoque-demanda' })
  for (const r of relatorios) itens.push({ id: `rel-${r.id}`, texto: `Relatório gerado: ${r.modulo.charAt(0) + r.modulo.slice(1).toLowerCase().replace('_', ' ')} de ${r.dia.split('-').reverse().join('/')}`, modulo: 'Relatórios', em: r.confirmadoEm, href: '/pro-labore/assistente' })
  for (const c of campanhas) itens.push({ id: `camp-${c.id}`, texto: `Campanha atualizada: ${c.nome}`, modulo: 'Tráfego', em: c.atualizadoEm, href: '/pro-labore/trafego' })
  return itens.sort((a, b) => b.em.getTime() - a.em.getTime()).slice(0, 8)
}

// --- Tarefas compartilhadas ---
const textoTarefa = z.object({ texto: z.string('Escreva a tarefa').trim().min(1, 'Escreva a tarefa').max(200, 'Use até 200 caracteres') })
router.post('/inicio/tarefas', requireProLaboreAuth, async (req: Request, res: Response) => {
  const p = textoTarefa.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  const u = req.proLaboreUser!
  res.status(201).json(await prisma.inicioTarefa.create({ data: { usuarioId: u.sub, texto: p.data.texto, autorId: u.vendedorId ?? u.sub, autorNome: nomeDe(req) } }))
})
router.patch('/inicio/tarefas/:id', requireProLaboreAuth, async (req: Request, res: Response) => {
  const p = z.object({ texto: z.string().trim().min(1).max(200).optional(), feita: z.boolean().optional() }).safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: 'Confira a tarefa' }); return }
  const r = await prisma.inicioTarefa.updateMany({ where: { id: String(req.params.id), usuarioId: req.proLaboreUser!.sub, excluidaEm: null }, data: { ...(p.data.texto != null && { texto: p.data.texto }), ...(p.data.feita != null && { feita: p.data.feita, feitaEm: p.data.feita ? new Date() : null }) } })
  if (!r.count) { res.status(404).json({ error: 'Tarefa não encontrada' }); return }
  res.json(await prisma.inicioTarefa.findUnique({ where: { id: String(req.params.id) } }))
})
router.delete('/inicio/tarefas/:id', requireProLaboreAuth, async (req: Request, res: Response) => {
  const r = await prisma.inicioTarefa.updateMany({ where: { id: String(req.params.id), usuarioId: req.proLaboreUser!.sub, excluidaEm: null }, data: { excluidaEm: new Date() } })
  if (!r.count) { res.status(404).json({ error: 'Tarefa não encontrada' }); return }
  res.json({ ok: true })
})

// --- Notas compartilhadas (salvas sozinhas pela tela) ---
router.post('/inicio/notas', requireProLaboreAuth, async (req: Request, res: Response) => {
  const texto = String(req.body?.texto ?? '').slice(0, 4000)
  const u = req.proLaboreUser!
  res.status(201).json(await prisma.inicioNota.create({ data: { usuarioId: u.sub, texto, autorId: u.vendedorId ?? u.sub, autorNome: nomeDe(req) } }))
})
router.patch('/inicio/notas/:id', requireProLaboreAuth, async (req: Request, res: Response) => {
  const texto = String(req.body?.texto ?? '').slice(0, 4000)
  const u = req.proLaboreUser!
  const r = await prisma.inicioNota.updateMany({ where: { id: String(req.params.id), usuarioId: u.sub, excluidaEm: null }, data: { texto, autorId: u.vendedorId ?? u.sub, autorNome: nomeDe(req) } })
  if (!r.count) { res.status(404).json({ error: 'Nota não encontrada' }); return }
  res.json(await prisma.inicioNota.findUnique({ where: { id: String(req.params.id) } }))
})
router.delete('/inicio/notas/:id', requireProLaboreAuth, async (req: Request, res: Response) => {
  const r = await prisma.inicioNota.updateMany({ where: { id: String(req.params.id), usuarioId: req.proLaboreUser!.sub, excluidaEm: null }, data: { excluidaEm: new Date() } })
  if (!r.count) { res.status(404).json({ error: 'Nota não encontrada' }); return }
  res.json({ ok: true })
})

// --- Preferências da tela (iguais para todos; quem muda: dono e supervisor) ---
router.put('/inicio/config', requireProLaboreAuth, async (req: Request, res: Response) => {
  const u = req.proLaboreUser!
  if (u.papel !== 'DONO' && u.papel !== 'SUPERVISOR') { res.status(403).json({ error: 'Só o dono e o supervisor mudam a tela inicial.' }); return }
  const p = z.object({
    fundo: z.string().max(500).regex(/^\/pro-labore\/imagens\/[\w.-]+$/, 'Envie a imagem pela tela').nullable().optional(),
    atalhos: z.array(z.string().max(40)).max(12).optional(),
  }).safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  const data = { ...(p.data.fundo !== undefined && { inicioFundo: p.data.fundo }), ...(p.data.atalhos && { inicioAtalhos: p.data.atalhos }) }
  const r = await prisma.parametroLiquidez.upsert({ where: { usuarioId: u.sub }, create: { usuarioId: u.sub, ...data }, update: data, select: { inicioFundo: true, inicioAtalhos: true } })
  res.json({ fundo: r.inicioFundo, atalhos: r.inicioAtalhos })
})

// --- Busca global (cada fonte só para quem já tem acesso a ela) ---
router.get('/inicio/busca', requireProLaboreAuth, async (req: Request, res: Response) => {
  const q = String(req.query.q ?? '').trim()
  if (q.length < 2) { res.json([]); return }
  const u = req.proLaboreUser!.sub
  const papel = pessoaDe(req).papel
  const RELATORIOS_INDICE = [{ nome: 'Relatórios', href: '/pro-labore/assistente' }, { nome: 'Painel do mês', href: '/pro-labore/hoje?sub=painel' }, { nome: 'Indicadores', href: '/pro-labore/indicadores' }, { nome: 'Origem das vendas', href: '/pro-labore/aba/origem-vendas' }]
  // PDF 07 (C7): com o índice da Central carregado, a busca do Início usa ele (sem acento, tolerante
  // a erro de digitação, com as mesmas permissões). Antes da carga inicial, segue a busca de sempre.
  if (await prisma.centralDocumento.findFirst({ where: { usuarioId: u }, select: { id: true } })) {
    const r = await buscarNaCentral(contextoDoPedido(req), q, { limitePorTipo: 6 })
    const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const rel = papel === 'DONO' || ve(req, 'indicadores') ? RELATORIOS_INDICE.filter(x => semAcento(x.nome).includes(semAcento(q)) || 'relatorio'.includes(semAcento(q))) : []
    res.json([
      ...r.grupos.flatMap(g => g.itens.map(i => ({ id: `${g.tipo.toLowerCase()}-${i.id}`, origem: g.nome, titulo: i.titulo, detalhe: i.resumo, href: i.link }))),
      ...rel.map(x => ({ id: `rel-${x.href}`, origem: 'Relatório', titulo: x.nome, detalhe: null, href: x.href })),
    ].slice(0, 20))
    return
  }
  const like = { contains: q, mode: 'insensitive' as const }
  const digitos = q.replace(/\D/g, '')
  const podeCrm = ve(req, 'crm') || papel === 'VENDEDOR'
  const lead = podeCrm ? leadWhereBase(req) : null
  const [leads, clientes, motos, vendas, campanhas] = await Promise.all([
    lead ? prisma.lead.findMany({ where: { ...lead, OR: [{ nomeCliente: like }, { modeloInteresse: like }, ...(digitos.length >= 4 ? [{ telefone: { contains: digitos } }] : [])] } as Prisma.LeadWhereInput, take: 8, orderBy: { atualizadoEm: 'desc' }, select: { id: true, nomeCliente: true, modeloInteresse: true, etapa: true } }) : [],
    podeCrm && !PESSOAL.has(papel) ? prisma.cliente.findMany({ where: { usuarioId: u, OR: [{ nome: like }, ...(digitos.length >= 4 ? [{ telefone: { contains: digitos } }] : [])] }, take: 5, select: { id: true, nome: true } }) : [],
    prisma.smMotoEstoque.findMany({ where: { usuarioId: u, OR: [{ modelo: like }, { marca: like }, { placa: like }] }, take: 6, orderBy: { entradaEm: 'desc' }, select: { id: true, modelo: true, ano: true, situacao: true } }),
    ve(req, 'vendas') || PESSOAL.has(papel) ? prisma.venda.findMany({ where: { usuarioId: u, ...(PESSOAL.has(papel) ? { vendedorId: req.proLaboreUser!.vendedorId ?? '__nenhum__' } : {}), OR: [{ lead: { nomeCliente: like } }, { moto: { modelo: like } }, { placa: like }] }, take: 5, orderBy: { data: 'desc' }, select: { id: true, data: true, moto: { select: { modelo: true } }, lead: { select: { nomeCliente: true } } } }) : [],
    papel === 'DONO' || ve(req, 'trafego') ? prisma.trafegoConta.findUnique({ where: { usuarioId: u }, select: { id: true } }).then(c => (c ? prisma.trafegoEstrutura.findMany({ where: { contaId: c.id, tipo: 'campanha', nome: like }, take: 5, select: { id: true, nome: true } }) : [])).catch(() => []) : [],
  ])
  const RELATORIOS = [{ nome: 'Relatórios', href: '/pro-labore/assistente' }, { nome: 'Painel do mês', href: '/pro-labore/hoje?sub=painel' }, { nome: 'Indicadores', href: '/pro-labore/indicadores' }, { nome: 'Origem das vendas', href: '/pro-labore/aba/origem-vendas' }]
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const relatorios = papel === 'DONO' || ve(req, 'indicadores') ? RELATORIOS.filter(r => norm(r.nome).includes(norm(q)) || norm('relatorio').includes(norm(q))) : []
  res.json([
    ...leads.map(l => ({ id: `lead-${l.id}`, origem: l.etapa && NEGOCIACAO.includes(l.etapa) ? 'Negociação' : 'Lead', titulo: l.nomeCliente, detalhe: [l.modeloInteresse, l.etapa ? NOME_ETAPA[l.etapa as Etapa] : null].filter(Boolean).join(' · ') || null, href: `/pro-labore/leads?lead=${l.id}` })),
    ...clientes.map(c => ({ id: `cli-${c.id}`, origem: 'Cliente', titulo: c.nome, detalhe: null, href: `/pro-labore/leads?busca=${encodeURIComponent(c.nome)}` })),
    ...motos.map(m => ({ id: `moto-${m.id}`, origem: 'Estoque', titulo: `${m.modelo}${m.ano ? ` ${m.ano}` : ''}`, detalhe: m.situacao === 'DISPONIVEL' ? 'Disponível' : m.situacao === 'RESERVADA' ? 'Reservada' : 'Vendida', href: '/pro-labore/aba/estoque-demanda' })),
    ...vendas.map(v => ({ id: `venda-${v.id}`, origem: 'Venda', titulo: [v.moto?.modelo, v.lead?.nomeCliente].filter(Boolean).join(' · ') || 'Venda', detalhe: v.data.toISOString().slice(0, 10).split('-').reverse().join('/'), href: '/pro-labore/vendas' })),
    ...campanhas.map(c => ({ id: `camp-${c.id}`, origem: 'Campanha', titulo: c.nome, detalhe: null, href: '/pro-labore/trafego' })),
    ...relatorios.map(r => ({ id: `rel-${r.href}`, origem: 'Relatório', titulo: r.nome, detalhe: null, href: r.href })),
  ].slice(0, 20))
})

export default router
