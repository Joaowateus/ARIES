// Pré-análise de crédito (nível 2 da simulação, sem API): a ficha autorizada
// pelo cliente e a resposta de cada banco parceiro, que o vendedor lança no
// portal do banco e registra aqui. Só o vendedor da conversa e a gestão veem
// o CPF; a IA e o aviso no WhatsApp nunca recebem.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { logger } from '../lib/logger'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { requireModulo } from '../lib/acessos'
import { ErroWhatsapp, enviarTexto } from '../lib/whatsappEvolution'
import { atualizarNota, avaliarJornada } from '../lib/assistenteMotor'
import { lerConfig, primeiroNome } from '../lib/assistenteRoteiro'
import { vitrineDaLoja } from '../lib/assistenteRespostas'
import { ResultadoSimulacao, STATUS_ANALISE, formatarCpf, lerCpf, lerNascimento, textoAprovacao, textoFicha } from '../lib/assistenteSimulacao'

const router = Router()
const ver = [requireProLaboreAuth, requireModulo('assistente', 'VER')]
const editar = [requireProLaboreAuth, requireModulo('assistente', 'EDITAR')]
const erro = (res: Response, status: number, mensagem: string) => res.status(status).json({ error: mensagem })
const DIA = 86_400_000

// Mesma regra das outras rotas da conversa: a loja dona, e vendedor ou
// supervisor só na conversa do próprio assistente.
async function conversaAutorizada(req: Request, res: Response) {
  const conversa = await prisma.assistenteConversa.findUnique({
    where: { id: String(req.params.id) },
    include: {
      assistente: { include: { vendedor: { select: { id: true, nome: true, usuarioId: true } } } },
      lead: { select: { id: true, nomeCliente: true, modeloInteresse: true } },
      ficha: { include: { analises: { orderBy: { criadoEm: 'asc' } } } },
    },
  })
  const { sub: usuarioId, papel, vendedorId } = req.proLaboreUser!
  if (!conversa || conversa.assistente.vendedor.usuarioId !== usuarioId) { erro(res, 404, 'Conversa não encontrada'); return null }
  if ((papel === 'VENDEDOR' || papel === 'SUPERVISOR') && conversa.assistente.vendedorId !== vendedorId) { erro(res, 403, 'Acesso restrito'); return null }
  if (conversa.tipo !== 'LEAD') { erro(res, 400, 'Só em conversas de lead'); return null }
  return conversa
}
type Conversa = NonNullable<Awaited<ReturnType<typeof conversaAutorizada>>>

async function recalcular(conversa: Conversa) {
  const cfg = lerConfig(conversa.assistente.configuracao)
  await atualizarNota(cfg, conversa.id).catch(e => logger.warn({ err: e }, 'assistente: falha na nota do lead'))
  await avaliarJornada(conversa.id).catch(e => logger.warn({ err: e }, 'assistente: falha na jornada do lead'))
}

async function resposta(conversa: Conversa) {
  const { simulacao: cfgSim } = await vitrineDaLoja(conversa.assistente.vendedor.usuarioId)
  const bancos = cfgSim?.bancos ?? []
  const f = await prisma.assistenteFichaCredito.findUnique({ where: { conversaId: conversa.id }, include: { analises: { orderBy: { criadoEm: 'asc' } } } })
  if (!f) return { ativa: !!cfgSim?.preAnalise, bancos, ficha: null, analises: [] }
  const sim = conversa.simulacao as unknown as ResultadoSimulacao & { moto?: string | null } | null
  const consentimento = f.consentimento as { em?: string; pergunta?: string; resposta?: string }
  // Banco cadastrado depois da ficha aparece como "a enviar".
  const analises = [...f.analises, ...bancos.filter(b => !f.analises.some(a => a.banco === b)).map(banco => ({ banco, status: 'A_ENVIAR', entrada: null, prazo: null, parcela: null, taxa: null, observacao: null, respondidoEm: null, enviadaAoClienteEm: null }))]
  return {
    ativa: !!cfgSim?.preAnalise, bancos,
    ficha: {
      cpf: formatarCpf(f.cpf), nascimento: f.nascimento, origem: f.origem, consentimento, criadoEm: f.criadoEm,
      texto: textoFicha({
        nome: conversa.lead?.nomeCliente ?? conversa.nomeContato, telefone: conversa.numeroContato, cpf: f.cpf, nascimento: f.nascimento,
        renda: sim?.renda ?? null, moto: sim?.moto ?? conversa.lead?.modeloInteresse ?? null, valor: sim?.valor ?? null, entrada: sim?.entrada ?? null,
        autorizadoEm: consentimento.em ? new Date(consentimento.em) : f.criadoEm,
      }),
    },
    analises: analises.map(a => ({ banco: a.banco, status: a.status, entrada: a.entrada, prazo: a.prazo, parcela: a.parcela, taxa: a.taxa, observacao: a.observacao, respondidoEm: a.respondidoEm, enviadaAoClienteEm: a.enviadaAoClienteEm })),
  }
}

router.get('/assistente/conversas/:id/credito', ...ver, async (req: Request, res: Response) => {
  const conversa = await conversaAutorizada(req, res)
  if (!conversa) return
  res.json(await resposta(conversa))
})

// Ficha registrada pelo vendedor (cliente passou os dados por ligação ou na
// loja): exige a confirmação de que o cliente autorizou a consulta.
const fichaSchema = z.object({
  cpf: z.string().trim().min(11).max(20),
  nascimento: z.string().trim().max(30).nullable().optional(),
  autorizado: z.literal(true, 'Confirme que o cliente autorizou a consulta'),
})
router.put('/assistente/conversas/:id/credito', ...editar, async (req: Request, res: Response) => {
  const p = fichaSchema.safeParse(req.body)
  if (!p.success) return erro(res, 400, p.error.issues[0].message)
  const conversa = await conversaAutorizada(req, res)
  if (!conversa) return
  const cpf = lerCpf(p.data.cpf)
  if (!cpf) return erro(res, 400, 'CPF inválido')
  const nascimento = p.data.nascimento ? lerNascimento(p.data.nascimento) : null
  if (p.data.nascimento && !nascimento) return erro(res, 400, 'Data de nascimento inválida (o cliente precisa ter 18 anos ou mais)')
  const usuarioId = conversa.assistente.vendedor.usuarioId
  const { simulacao: cfgSim } = await vitrineDaLoja(usuarioId)
  const consentimento = { em: new Date().toISOString(), pergunta: 'Autorização confirmada pelo vendedor', resposta: `registrada por ${req.proLaboreUser!.nome}` }
  const f = await prisma.assistenteFichaCredito.upsert({
    where: { conversaId: conversa.id },
    create: { conversaId: conversa.id, usuarioId, cpf, nascimento, consentimento, origem: 'VENDEDOR' },
    update: { cpf, nascimento, ...(conversa.ficha?.cpf !== cpf && { consentimento }) },
  })
  for (const banco of cfgSim?.bancos ?? []) {
    await prisma.assistenteAnaliseCredito.upsert({ where: { fichaId_banco: { fichaId: f.id, banco } }, create: { fichaId: f.id, usuarioId, banco }, update: {} })
  }
  if (conversa.leadId) await prisma.lead.updateMany({ where: { id: conversa.leadId, OR: [{ cpf: null }, { cpf: '' }] }, data: { cpf: formatarCpf(cpf) } })
  await recalcular(conversa)
  res.json(await resposta(conversa))
})

// Apagar a ficha (o cliente pediu, ou foi registrada por engano).
router.delete('/assistente/conversas/:id/credito', ...editar, async (req: Request, res: Response) => {
  const conversa = await conversaAutorizada(req, res)
  if (!conversa) return
  await prisma.assistenteFichaCredito.deleteMany({ where: { conversaId: conversa.id } })
  const respostas = (conversa.respostas ?? {}) as Record<string, string>
  if (respostas._ficha) await prisma.assistenteConversa.update({ where: { id: conversa.id }, data: { respostas: { ...respostas, _ficha: 'APAGADA' } as Prisma.InputJsonValue } })
  await recalcular(conversa)
  res.json(await resposta(conversa))
})

const analiseSchema = z.object({
  status: z.enum(STATUS_ANALISE),
  entrada: z.number().min(0).max(10_000_000).nullable().optional(),
  prazo: z.number().int().min(1).max(120).nullable().optional(),
  parcela: z.number().min(0).max(10_000_000).nullable().optional(),
  taxa: z.number().min(0).max(20).nullable().optional(),
  observacao: z.string().trim().max(300).nullable().optional(),
})
router.put('/assistente/conversas/:id/credito/analises/:banco', ...editar, async (req: Request, res: Response) => {
  const p = analiseSchema.safeParse(req.body)
  if (!p.success) return erro(res, 400, p.error.issues[0].message)
  const conversa = await conversaAutorizada(req, res)
  if (!conversa) return
  if (!conversa.ficha) return erro(res, 409, 'Registre a ficha de crédito antes')
  const banco = String(req.params.banco)
  const { simulacao: cfgSim } = await vitrineDaLoja(conversa.assistente.vendedor.usuarioId)
  if (!(cfgSim?.bancos ?? []).includes(banco) && !conversa.ficha.analises.some(a => a.banco === banco)) return erro(res, 404, 'Banco não cadastrado na aba Simulação')
  const respondida = p.data.status === 'APROVADA' || p.data.status === 'RECUSADA'
  const aprovada = p.data.status === 'APROVADA'
  const data = {
    status: p.data.status,
    entrada: aprovada ? p.data.entrada ?? null : null, prazo: aprovada ? p.data.prazo ?? null : null,
    parcela: aprovada ? p.data.parcela ?? null : null, taxa: aprovada ? p.data.taxa ?? null : null,
    observacao: p.data.observacao ?? null,
    respondidoEm: respondida ? new Date() : null,
  }
  await prisma.assistenteAnaliseCredito.upsert({
    where: { fichaId_banco: { fichaId: conversa.ficha.id, banco } },
    create: { fichaId: conversa.ficha.id, usuarioId: conversa.ficha.usuarioId, banco, ...data },
    update: data,
  })
  await recalcular(conversa)
  res.json(await resposta(conversa))
})

// Condição aprovada vai para o cliente pelo WhatsApp do vendedor (e conta
// como proposta enviada no funil).
router.post('/assistente/conversas/:id/credito/analises/:banco/enviar', ...editar, async (req: Request, res: Response) => {
  const conversa = await conversaAutorizada(req, res)
  if (!conversa) return
  const analise = conversa.ficha?.analises.find(a => a.banco === String(req.params.banco))
  if (!analise || analise.status !== 'APROVADA') return erro(res, 409, 'Só dá para enviar uma pré-análise aprovada')
  const { assistente } = conversa
  if (!assistente.instancia || assistente.status !== 'CONECTADO') return erro(res, 409, 'O WhatsApp desse vendedor não está conectado agora')
  const texto = textoAprovacao(
    { banco: analise.banco, status: 'APROVADA', entrada: analise.entrada, prazo: analise.prazo, parcela: analise.parcela, taxa: analise.taxa },
    { nome: primeiroNome(conversa.lead?.nomeCliente ?? conversa.nomeContato), vendedor: primeiroNome(assistente.vendedor.nome) || assistente.vendedor.nome },
  )
  const registro = await prisma.assistenteMensagem.create({ data: { conversaId: conversa.id, remetente: 'VENDEDOR', texto } })
  try {
    const providerId = await enviarTexto(assistente.instancia, conversa.jid ?? conversa.numeroContato, texto)
    if (providerId) await prisma.assistenteMensagem.update({ where: { id: registro.id }, data: { providerId } }).catch(() => undefined)
  } catch (e) {
    await prisma.assistenteMensagem.delete({ where: { id: registro.id } })
    return erro(res, 502, e instanceof ErroWhatsapp ? e.message : 'Falha inesperada ao falar com o servidor do WhatsApp')
  }
  const agora = new Date()
  await prisma.$transaction([
    prisma.assistenteAnaliseCredito.update({ where: { id: analise.id }, data: { enviadaAoClienteEm: agora } }),
    prisma.assistenteConversa.update({
      where: { id: conversa.id },
      data: { ultimaMensagemEm: agora, ...((conversa.status === 'ATIVA' || conversa.status === 'AGUARDANDO_VENDEDOR') && { status: 'ASSUMIDA', assumidaEm: agora }) },
    }),
  ])
  await recalcular(conversa)
  res.status(201).json(await resposta(conversa))
})

// Placar por banco (aba Simulação): quanto cada um aprova e a taxa que sai,
// para o vendedor saber onde lançar primeiro.
router.get('/assistente/credito/resumo', ...ver, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const dias = Math.min(365, Math.max(1, Number(req.query.dias) || 30))
  const desde = new Date(Date.now() - dias * DIA)
  const [analises, fichas] = await Promise.all([
    prisma.assistenteAnaliseCredito.findMany({ where: { usuarioId, criadoEm: { gte: desde } }, select: { banco: true, status: true, taxa: true } }),
    prisma.assistenteFichaCredito.count({ where: { usuarioId, criadoEm: { gte: desde } } }),
  ])
  const porBanco = new Map<string, { banco: string; lancadas: number; emAnalise: number; aprovadas: number; recusadas: number; taxas: number[] }>()
  for (const a of analises) {
    const b = porBanco.get(a.banco) ?? { banco: a.banco, lancadas: 0, emAnalise: 0, aprovadas: 0, recusadas: 0, taxas: [] }
    if (a.status !== 'A_ENVIAR') b.lancadas++
    if (a.status === 'EM_ANALISE') b.emAnalise++
    if (a.status === 'APROVADA') { b.aprovadas++; if (a.taxa !== null) b.taxas.push(a.taxa) }
    if (a.status === 'RECUSADA') b.recusadas++
    porBanco.set(a.banco, b)
  }
  res.json({
    dias, fichas,
    bancos: [...porBanco.values()].map(({ taxas, ...b }) => ({
      ...b,
      aprovacaoPct: b.aprovadas + b.recusadas ? Math.round((b.aprovadas / (b.aprovadas + b.recusadas)) * 100) : null,
      taxaMedia: taxas.length ? Math.round((taxas.reduce((t, x) => t + x, 0) / taxas.length) * 100) / 100 : null,
    })).sort((a, b) => b.lancadas - a.lancadas),
  })
})

export default router
