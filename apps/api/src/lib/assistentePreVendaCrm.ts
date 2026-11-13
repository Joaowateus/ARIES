// Pré-venda do robô ligada ao CRM (Ajuste 3): o que o cliente responde no
// WhatsApp vai para os campos do lead (sem apagar o que o vendedor já
// preencheu), o levantamento fica completo pelo critério da conta e, quando
// a ficha está pronta para simular, o vendedor recebe o bastão: aviso no
// chat "Você" e a atividade "Simular" no CRM.
import { prisma } from './prisma'
import { Prisma } from '@prisma/client'
import { lerConfig, type ConfigAssistente } from './assistenteRoteiro'
import { levantamentoDasRespostas, faltaParaSimular, type Levantamento } from './assistentePreVenda'
import { criteriosLevantamento, faltasDoLevantamento } from './jornadaRegras'
import { comAutor } from './autorAuditoria'
import { vitrineDaLoja } from './assistenteRespostas'
import { acharMotos, type MotoVitrine } from './assistenteVitrine'

const nomeMoto = (m: { marca: string | null; modelo: string; ano: number | null }) => [m.marca, m.modelo, m.ano].filter(Boolean).join(' ')
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const NOME_CNH: Record<string, string> = { TEM: 'tem CNH', EM_PROCESSO: 'tirando a CNH', NAO_TEM: 'sem CNH' }

export interface FichaPronta { levantamento: Levantamento; falta: string[]; moto: { id: string; nome: string; preco: number | null } | null }

/** Grava no lead o que a conversa apurou e devolve a ficha (o que falta para simular). */
export async function sincronizarLevantamento(conversaId: string): Promise<FichaPronta | null> {
  const c = await prisma.assistenteConversa.findUnique({ where: { id: conversaId }, select: { leadId: true, respostas: true, robo: true, assistente: { select: { configuracao: true } } } })
  if (!c?.leadId || !c.robo) return null
  const cfg: ConfigAssistente = lerConfig(c.assistente.configuracao)
  const lv = levantamentoDasRespostas(cfg.perguntas, (c.respostas ?? {}) as Record<string, string>)
  const lead = await prisma.lead.findUnique({ where: { id: c.leadId }, select: { id: true, usuarioId: true, modeloInteresse: true, formaPagamento: true, situacaoCnh: true, temEntrada: true, levantamento: true, levantamentoCompleto: true } })
  if (!lead) return null
  const antes = (lead.levantamento ?? {}) as Record<string, unknown>
  const extra: Record<string, unknown> = { ...antes }
  for (const k of ['motoId', 'entradaValor', 'parcelaDesejada', 'prazoMeses', 'troca', 'cidade', 'melhorHorario'] as const) if (extra[k] == null && lv[k] != null) extra[k] = lv[k]
  // A moto do estoque: a que o robô mostrou ou, se o cliente só citou o modelo, a disponível que bate com o nome.
  let motoId = lv.motoId ?? ((antes.motoId as string | undefined) ?? null)
  if (!motoId && lv.modeloInteresse) {
    const { motos } = await vitrineDaLoja(lead.usuarioId).catch(() => ({ motos: [] as MotoVitrine[] }))
    motoId = acharMotos(lv.modeloInteresse, motos.filter(m => m.situacao === 'DISPONIVEL'))[0]?.id ?? null
  }
  if (motoId) { lv.motoId = motoId; if (extra.motoId == null) extra.motoId = motoId }
  const moto = motoId ? await prisma.smMotoEstoque.findUnique({ where: { id: motoId }, select: { id: true, modelo: true, marca: true, ano: true, preco: true } }).catch(() => null) : null
  // O vendedor manda: só preenche o que está vazio.
  const data: Prisma.LeadUpdateInput = {
    ...(!lead.modeloInteresse && (moto || lv.modeloInteresse) && { modeloInteresse: moto ? nomeMoto(moto) : lv.modeloInteresse! }),
    ...(!lead.formaPagamento && lv.formaPagamento && { formaPagamento: lv.formaPagamento }),
    ...(!lead.situacaoCnh && lv.situacaoCnh && { situacaoCnh: lv.situacaoCnh }),
    ...(lead.temEntrada == null && lv.temEntrada != null && { temEntrada: lv.temEntrada }),
    ...(JSON.stringify(extra) !== JSON.stringify(antes) && { levantamento: extra as Prisma.InputJsonValue }),
  }
  if (Object.keys(data).length) await comAutor({ origem: 'AUTOMACAO' }, () => prisma.lead.update({ where: { id: lead.id }, data }))
  const atual = await prisma.lead.findUnique({ where: { id: lead.id }, select: { modeloInteresse: true, formaPagamento: true, situacaoCnh: true, temEntrada: true, levantamentoCompleto: true } })
  const completo = !!atual && faltasDoLevantamento(atual as never, await criteriosLevantamento(lead.usuarioId)).length === 0
  if (atual && completo !== atual.levantamentoCompleto) await prisma.lead.update({ where: { id: lead.id }, data: { levantamentoCompleto: completo } })
  const visto: Levantamento = { ...lv, modeloInteresse: atual?.modeloInteresse ?? lv.modeloInteresse, formaPagamento: (atual?.formaPagamento as Levantamento['formaPagamento']) ?? lv.formaPagamento, situacaoCnh: (atual?.situacaoCnh as Levantamento['situacaoCnh']) ?? lv.situacaoCnh, temEntrada: atual?.temEntrada ?? lv.temEntrada }
  return { levantamento: visto, falta: faltaParaSimular(visto), moto: moto ? { id: moto.id, nome: nomeMoto(moto), preco: moto.preco ?? null } : null }
}

/** Linhas da ficha pronta para simular (aviso ao vendedor e atividade). Preço só aqui, nunca para a IA. */
export function linhasDaFicha(f: FichaPronta): string[] {
  const l = f.levantamento
  return [
    `Moto: ${f.moto ? `${f.moto.nome}${f.moto.preco ? ` · ${brl(f.moto.preco)} (estoque)` : ''}` : l.modeloInteresse ?? '—'}`,
    `Pagamento: ${l.formaPagamento === 'A_VISTA' ? 'à vista' : l.formaPagamento === 'FINANCIADO' ? 'financiado' : '—'}${l.troca ? ` · troca: ${l.troca}` : ''}`,
    ...(l.formaPagamento === 'A_VISTA' ? [] : [`Entrada: ${l.temEntrada === false ? 'sem entrada' : l.entradaValor ? brl(l.entradaValor) : l.temEntrada ? 'tem (valor a confirmar)' : '—'}`]),
    ...(l.parcelaDesejada ? [`Parcela que cabe: até ${brl(l.parcelaDesejada)}/mês`] : []),
    ...(l.prazoMeses ? [`Prazo: ${l.prazoMeses} meses`] : []),
    `CNH: ${l.situacaoCnh ? NOME_CNH[l.situacaoCnh] : '—'}`,
    ...(l.cidade ? [`Cidade: ${l.cidade}`] : []),
    ...(l.melhorHorario ? [`Melhor horário: ${l.melhorHorario}`] : []),
  ]
}

/** Passa o bastão: atividade "Simular" no CRM (ou "Primeiro contato" se a ficha ainda tem buraco). */
export async function criarAtividadeDoBastao(leadId: string, f: FichaPronta) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, usuarioId: true, vendedorId: true, nomeCliente: true } })
  if (!lead) return
  const pronta = !f.falta.length
  const titulo = pronta ? (f.levantamento.formaPagamento === 'A_VISTA' ? 'Montar a proposta à vista' : 'Simular') : 'Completar o levantamento'
  await prisma.leadFollow.updateMany({ where: { leadId, tipo: 'JORNADA', status: 'PENDENTE', contexto: { path: ['atividade'], equals: 'BASTAO_ROBO' } }, data: { status: 'CANCELADO', resultado: 'Substituída' } })
  await prisma.leadFollow.create({
    data: {
      usuarioId: lead.usuarioId, leadId, vendedorId: lead.vendedorId, agendadoPara: new Date(), tipo: 'JORNADA', canal: 'WHATSAPP',
      nota: `${titulo} para ${lead.nomeCliente} (o robô fez o levantamento): ${linhasDaFicha(f).join(' · ')}${pronta ? '' : ` · falta: ${f.falta.join(', ')}`}`.slice(0, 900),
      contexto: { atividade: 'BASTAO_ROBO', pronta },
    },
  })
}
