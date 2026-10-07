// Análise completa de uma conta num período (padrão: últimos 30 dias), já
// com o período anterior de mesma duração para comparação. Usada pela aba
// Social Media do painel e pela tela 05 · Desempenho do espaço do Social
// Media, para as duas mostrarem os mesmos números. Datas em 'YYYY-MM-DD' do
// calendário de Brasília; só lê do banco (trocar de período não gasta cota
// da API da Meta), exceto o alcance único, guardado por período.
import { SocialMediaConta } from '@prisma/client'
import { prisma } from './prisma'
import { buscarAlcanceUnicoPeriodo, comApiDaEmpresa, MAX_DIAS_ALCANCE_UNICO } from './instagramGraph'
import { diaBrasilia, inicioDoDiaBrasilia } from './socialMediaSync'
import { montarAnaliseSocialMedia } from './socialMediaAnalytics'
import { pagoPorMidia, type OrigemMetricas } from './socialMediaOrigem'
import { atribuicaoDasPublicacoes } from './smDesempenho'

const DIA = 24 * 60 * 60 * 1000
export const MAX_DIAS_ANALISE_SOCIAL = 366
const DIAS_JANELA_IMPACTO = 90

export function parseDataDia(valor: string | null | undefined): Date | null {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null
  const data = new Date(`${valor}T00:00:00.000Z`)
  return Number.isNaN(data.getTime()) ? null : data
}

// Alcance único do período (contas distintas), pro topo do funil — a API só
// calcula sob demanda e até 30 dias. Guardado por período: período fechado
// há mais de 3 dias não muda mais; o que inclui dias recentes é refeito a
// cada 6h. Se a API falhar, usa o último valor guardado (ou explica).
async function alcanceUnicoDoPeriodo(conta: { id: string; accessToken: string; tipoConexao: string; instagramUserId: string }, inicio: Date, fim: Date, hoje: Date) {
  const dias = Math.round((fim.getTime() - inicio.getTime()) / DIA) + 1
  if (dias > MAX_DIAS_ALCANCE_UNICO) {
    return { valor: null, motivo: `O Instagram só calcula o alcance único de períodos de até ${MAX_DIAS_ALCANCE_UNICO} dias. Escolha um período menor para ver essa etapa.` }
  }
  const cache = await prisma.socialMediaAlcancePeriodo.findUnique({ where: { contaId_inicio_fim: { contaId: conta.id, inicio, fim } } })
  const fechado = fim.getTime() < hoje.getTime() - 3 * DIA
  if (cache && (fechado ? cache.atualizadoEm.getTime() > fim.getTime() + 3 * DIA : Date.now() - cache.atualizadoEm.getTime() < 6 * 60 * 60 * 1000)) {
    return { valor: cache.alcance, motivo: null }
  }
  try {
    const ate = new Date(Math.min(Date.now(), inicioDoDiaBrasilia(new Date(fim.getTime() + DIA)).getTime()))
    // Como no sync: `me` no login do Instagram; o ID da conta (pelo Graph
    // do Facebook) na conta da empresa.
    const valor = conta.tipoConexao === 'EMPRESA'
      ? await comApiDaEmpresa(() => buscarAlcanceUnicoPeriodo(conta.instagramUserId, conta.accessToken, inicioDoDiaBrasilia(inicio), ate))
      : await buscarAlcanceUnicoPeriodo('me', conta.accessToken, inicioDoDiaBrasilia(inicio), ate)
    if (valor == null) return cache ? { valor: cache.alcance, motivo: null } : { valor: null, motivo: 'O Instagram não devolveu o alcance único desse período.' }
    await prisma.socialMediaAlcancePeriodo.upsert({
      where: { contaId_inicio_fim: { contaId: conta.id, inicio, fim } },
      create: { contaId: conta.id, inicio, fim, alcance: valor },
      update: { alcance: valor },
    })
    return { valor, motivo: null }
  } catch {
    return cache ? { valor: cache.alcance, motivo: null } : { valor: null, motivo: 'Não deu para buscar o alcance único no Instagram agora. Tente sincronizar de novo.' }
  }
}

/** Canais do Atendimento que são conversa iniciada no direct (o comentário público não conta). */
export const CANAIS_CONVERSA_INICIADA = ['DIRECT', 'RESPOSTA_STORY', 'COMENTARIO_AUTOMACAO']

export async function analisarContaSocialMedia(o: {
  usuarioId: string
  conta: SocialMediaConta
  vendedorTitular: string | null
  inicio: string | null
  fim: string | null
  origem: string | null
}) {
  const { usuarioId, conta, vendedorTitular } = o
  const hoje = diaBrasilia(new Date())
  const fim = parseDataDia(o.fim) ?? hoje
  let inicio = parseDataDia(o.inicio) ?? new Date(fim.getTime() - 29 * DIA)
  if (inicio.getTime() > fim.getTime()) inicio = fim
  if ((fim.getTime() - inicio.getTime()) / DIA >= MAX_DIAS_ANALISE_SOCIAL) inicio = new Date(fim.getTime() - (MAX_DIAS_ANALISE_SOCIAL - 1) * DIA)
  const dias = Math.round((fim.getTime() - inicio.getTime()) / DIA) + 1
  const anteriorInicio = new Date(inicio.getTime() - dias * DIA)
  const inicioBuscaMidias = new Date(Math.min(anteriorInicio.getTime(), fim.getTime() - (DIAS_JANELA_IMPACTO - 1) * DIA))
  const fimExclusivo = inicioDoDiaBrasilia(new Date(fim.getTime() + DIA))
  const noPeriodo = { gte: inicioDoDiaBrasilia(inicio), lt: fimExclusivo }

  const [midias, snapshots, parametro, leadsOrganicos, conversasDirect, leadsPorLink] = await Promise.all([
    prisma.socialMediaMidia.findMany({ where: { contaId: conta.id, publicadoEm: { gte: inicioDoDiaBrasilia(inicioBuscaMidias), lt: fimExclusivo } } }),
    prisma.socialMediaSnapshotDiario.findMany({ where: { contaId: conta.id, data: { gte: anteriorInicio, lte: fim } }, orderBy: { data: 'asc' } }),
    prisma.parametroLiquidez.upsert({ where: { usuarioId }, update: {}, create: { usuarioId } }),
    prisma.lead.findMany({
      // Instagram de vendedor: cruza só com os leads orgânicos dele.
      where: { usuarioId, ...(vendedorTitular && { vendedorId: vendedorTitular }), tipoLead: 'ORGANICO', criadoEm: noPeriodo },
      select: { criadoEm: true, valorNegociacao: true, estagio: true },
    }),
    // Conversas iniciadas (seção 12): direct novo + WhatsApp com código.
    // Só na conta da empresa: o Atendimento é da operação.
    vendedorTitular ? Promise.resolve(null) : prisma.smConversa.count({ where: { usuarioId, canal: { in: CANAIS_CONVERSA_INICIADA }, criadoEm: noPeriodo } }),
    vendedorTitular ? Promise.resolve(null) : prisma.lead.count({ where: { usuarioId, canalEntrada: 'LINK_WHATSAPP', criadoEm: noPeriodo } }),
  ])

  // Orgânico (padrão), pago ou total. O pago vem dos anúncios do Tráfego,
  // que é da operação: só entra na conta do dono (a da empresa), nunca no
  // Instagram pessoal de alguém da equipe.
  const origemQuery = (o.origem ?? 'ORGANICO').toUpperCase()
  const origem = (['ORGANICO', 'PAGO', 'TOTAL'].includes(origemQuery) ? origemQuery : 'ORGANICO') as OrigemMetricas
  const pagos = vendedorTitular ? new Map() : await pagoPorMidia(usuarioId)

  const analise = montarAnaliseSocialMedia({
    conta,
    periodo: { inicio, fim },
    midias,
    snapshots,
    metaPostagensSemanais: parametro.metaPostagensSemanais,
    leadsOrganicos,
    alcanceUnico: await alcanceUnicoDoPeriodo(conta, inicio, fim, hoje),
    origem,
    pagoPorMidia: pagos,
  })
  if (conversasDirect != null && leadsPorLink != null) {
    analise.funil.conversasIniciadas = conversasDirect + leadsPorLink
    analise.funil.conversasMotivo = `${conversasDirect} no direct e ${leadsPorLink} pelo WhatsApp com o código do post.`
  } else {
    analise.funil.conversasMotivo = 'As conversas iniciadas vêm do Atendimento da conta da empresa.'
  }
  // Código, leads e vendas de cada publicação (tabela "Todas as publicações").
  const atribuicao = vendedorTitular ? null : await atribuicaoDasPublicacoes(usuarioId, analise.publicacoes.map(p => p.instagramMediaId), true, true)
  return {
    ...analise,
    publicacoes: analise.publicacoes.map(p => ({ ...p, codigo: atribuicao?.get(p.instagramMediaId)?.codigo ?? null, leads: atribuicao?.get(p.instagramMediaId)?.leads ?? null, vendas: atribuicao?.get(p.instagramMediaId)?.vendas ?? null })),
  }
}
