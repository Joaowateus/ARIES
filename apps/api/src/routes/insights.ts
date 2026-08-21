import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { escopoVisibilidade, escopoWhereDono, veEquipe } from '../lib/permissoes'
import { ESTAGIOS_FINAIS, ESTAGIO_LABEL, ETAPAS_FUNIL_ORDEM, METAS_FUNIL_PADRAO, SLA_PADRAO_DIAS, diasNaEtapaAtualPorOportunidade } from '../lib/funil'
import { classificacaoSaude, diasEmEstoque, obterParametros, SAUDE } from '../lib/precificacao'

export interface Insight {
  tipo: string
  severidade: 'alto' | 'medio' | 'baixo'
  mensagem: string
}

/**
 * Central de Insights — regras determinísticas sobre dados reais (não é um
 * LLM: não existe integração de IA na plataforma hoje, então nada aqui é
 * "gerado"; é matemática simples sobre o banco). Ponto único de extensão:
 * outras tarefas (rotina atrasada, ritmo de anúncios, treinamento pendente)
 * vão adicionar mais regras aqui conforme esses módulos forem construídos.
 */
export async function gerarInsights(empresaId: string, usuarioAuth: { sub: string; papel: string; empresaId: string }): Promise<Insight[]> {
  const insights: Insight[] = []
  const escopo = await escopoVisibilidade(prisma, usuarioAuth)
  const whereDono = escopoWhereDono(escopo, 'responsavelId')

  // --- Leads sem follow-up há mais de 24h ---
  const ha24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const oportunidadesAtivas = await prisma.oportunidade.findMany({
    where: {
      empresaId,
      ...whereDono,
      estagio: { notIn: [...ESTAGIOS_FINAIS] },
      OR: [{ proximaAcaoEm: { lt: new Date() } }, { proximaAcaoEm: null, ultimaInteracaoEm: { lt: ha24h } }, { proximaAcaoEm: null, ultimaInteracaoEm: null, criadaEm: { lt: ha24h } }],
    },
    select: { id: true },
  })
  if (oportunidadesAtivas.length > 0) {
    insights.push({
      tipo: 'LEADS_SEM_FOLLOWUP',
      severidade: oportunidadesAtivas.length >= 10 ? 'alto' : 'medio',
      mensagem: `${oportunidadesAtivas.length} lead${oportunidadesAtivas.length > 1 ? 's estão' : ' está'} sem follow-up agendado ou com a próxima ação vencida.`,
    })
  }

  // --- Leads parados além do prazo (SLA) da etapa atual ---
  const oportunidadesParaSla = await prisma.oportunidade.findMany({
    where: { empresaId, ...whereDono, estagio: { notIn: [...ESTAGIOS_FINAIS] } },
    select: { id: true, nomeCliente: true, estagio: true, responsavel: { select: { nome: true } } },
  })
  if (oportunidadesParaSla.length > 0) {
    const historicoSla = await prisma.estagioHistorico.findMany({
      where: { oportunidadeId: { in: oportunidadesParaSla.map(o => o.id) } },
      select: { oportunidadeId: true, estagioNovo: true, criadoEm: true },
    })
    const diasPorOportunidade = diasNaEtapaAtualPorOportunidade(historicoSla)
    const metasSla = await prisma.metaFunilEtapa.findMany({ where: { empresaId } })
    const slaPorEtapa = new Map(metasSla.map(m => [m.etapa, m.tempoMaximoDias]))

    const parados = oportunidadesParaSla
      .map(o => ({ ...o, dias: diasPorOportunidade.get(o.id) }))
      .filter(o => {
        const sla = slaPorEtapa.get(o.estagio) ?? SLA_PADRAO_DIAS[o.estagio]
        return sla != null && o.dias != null && o.dias > sla
      })
      .sort((a, b) => (b.dias ?? 0) - (a.dias ?? 0))

    if (parados.length > 0) {
      const listados = parados.slice(0, 5).map(o => {
        const quemNome = escopo.tipo === 'proprio' ? '' : ` (${o.responsavel?.nome ?? 'sem responsável'})`
        return `${o.nomeCliente}${quemNome} — ${ESTAGIO_LABEL[o.estagio]}, ${Math.round(o.dias!)}d`
      })
      const resto = parados.length > 5 ? ` e mais ${parados.length - 5}` : ''
      insights.push({
        tipo: 'LEADS_PARADOS_SLA',
        severidade: parados.length >= 5 ? 'alto' : 'medio',
        mensagem: `${parados.length} lead${parados.length > 1 ? 's estão' : ' está'} parado${parados.length > 1 ? 's' : ''} além do prazo da etapa: ${listados.join('; ')}${resto}.`,
      })
    }
  }

  // --- Conversão do funil abaixo da meta (via /funil/conversao) ---
  const historico = await prisma.estagioHistorico.findMany({
    where: { empresaId },
    select: { oportunidadeId: true, estagioNovo: true },
  })
  const totalLeads = new Set(historico.filter(h => h.estagioNovo === 'NOVO_LEAD').map(h => h.oportunidadeId)).size
  if (totalLeads >= 5) {
    const alcancados = new Map<string, Set<string>>()
    for (const h of historico) {
      if (!alcancados.has(h.estagioNovo)) alcancados.set(h.estagioNovo, new Set())
      alcancados.get(h.estagioNovo)!.add(h.oportunidadeId)
    }
    const metasCfg = await prisma.metaFunilEtapa.findMany({ where: { empresaId } })
    const metaPorEtapa = new Map(metasCfg.map(m => [m.etapa, m]))

    for (const etapa of ETAPAS_FUNIL_ORDEM) {
      const quantidade = alcancados.get(etapa)?.size ?? 0
      const conversaoReal = quantidade / totalLeads
      const cfg = metaPorEtapa.get(etapa) ?? METAS_FUNIL_PADRAO[etapa]
      if (!cfg) continue
      const metaPct = cfg.metaPct
      const abaixo = cfg.tipoMeta === 'MAXIMO_PERDA' ? conversaoReal > metaPct * 1.15 : conversaoReal < metaPct * 0.85
      if (abaixo) {
        const pontos = Math.round(Math.abs(conversaoReal - metaPct) * 100)
        insights.push({
          tipo: 'CONVERSAO_ABAIXO_DA_META',
          severidade: 'alto',
          mensagem: `Sua conversão de "${ESTAGIO_LABEL[etapa]}" está em ${Math.round(conversaoReal * 100)}%. Meta: ${Math.round(metaPct * 100)}%. Você está ${pontos} pontos ${cfg.tipoMeta === 'MAXIMO_PERDA' ? 'acima' : 'abaixo'} da meta.`,
        })
      }
    }
  }

  // --- Estoque parado (reaproveita a classificação de saúde da Precificação) ---
  if (veEquipe(usuarioAuth.papel)) {
    const params = await obterParametros(prisma, empresaId)
    const unidades = await prisma.unidade.findMany({ where: { empresaId, situacao: { not: 'INATIVO' } } })
    let criticas = 0
    for (const u of unidades) {
      const dias = diasEmEstoque(u.dataCompra)
      if (classificacaoSaude(dias, params) === SAUDE.CRITICO && u.situacao !== 'VENDIDA') criticas++
    }
    if (criticas > 0) {
      insights.push({
        tipo: 'ESTOQUE_CRITICO',
        severidade: criticas >= 3 ? 'alto' : 'medio',
        mensagem: `${criticas} moto${criticas > 1 ? 's estão' : ' está'} em estoque crítico (muito tempo parada) — considere reprecificar.`,
      })
    }
  }

  return insights
}

const router = Router()

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const insights = await gerarInsights(req.user!.empresaId, req.user!)
  res.json(insights)
})

export default router
