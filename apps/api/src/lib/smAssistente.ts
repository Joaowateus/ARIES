// Assistente da aba (seção 16): avatar, rótulo, a frase de leitura do momento,
// as 3 sugestões do motor de insights e a linha "Pergunte:". A frase é
// montada sobre os números do banco; a IA (seção 16.3) só redige por cima,
// com os mesmos números (fraseIA), e nunca é obrigatória.
import { prisma } from './prisma'
import type { ContextoSM } from './smAcesso'
import { atorDe, insightsDaAba, textoAmostra, type Aba, type InfoAba, type Insight } from './smInsights'
import { fraseGuardada, iaLigada, redigirFrase } from './smIA'
import { perguntasDaAba } from './smPerguntas'

export const NOME_ABA: Record<Aba, string> = { calendario: 'Calendário', producao: 'Produção', atendimento: 'Atendimento', desempenho: 'Desempenho', atribuicao: 'Vendas por post', permissoes: 'Acessos' }
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`
const num = (v: number, c = 1) => v.toLocaleString('pt-BR', { maximumFractionDigits: c })
const NUMERO_EXTENSO = ['Nenhum', 'Um', 'Dois', 'Três', 'Quatro', 'Cinco']
const NUMERAL_FEMININO = ['Nenhuma', 'Uma', 'Duas', 'Três', 'Quatro', 'Cinco']
function moedaCurta(v: number): string {
  if (v >= 1_000_000) return `R$ ${num(v / 1_000_000)} mi`
  if (v >= 1_000) return `R$ ${num(v / 1_000)} mil`
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`
}

/** Como chamar quem está vendo: o tratamento do Social Media, ou o primeiro nome do gestor. */
async function pessoas(sm: ContextoSM) {
  const [membro, dono] = await Promise.all([
    prisma.smMembro.findUnique({ where: { usuarioId: sm.usuarioId }, select: { nome: true, tratamento: true, ativadoEm: true, convidadoEm: true, ativo: true } }),
    prisma.proLaboreUsuario.findUnique({ where: { id: sm.usuarioId }, select: { nome: true } }),
  ])
  const nomeSM = membro?.tratamento ?? membro?.nome?.split(' ')[0] ?? null
  const nomeDono = dono?.nome?.split(' ')[0] ?? null
  return { membro, nomeSM, nomeDono, quem: sm.visao === 'GESTOR' && !sm.verComo ? nomeDono : nomeSM }
}

function frase(aba: Aba, info: InfoAba, insights: Insight[], p: Awaited<ReturnType<typeof pessoas>>, sm: ContextoSM): string {
  const comAcao = insights.filter(i => i.acao && i.acao.operacao.tipo !== 'ABRIR').length
  const vocativo = p.quem ? `${p.quem}, ` : ''
  switch (aba) {
    case 'calendario': {
      const mes = typeof info.mes === 'string' ? MESES[Number(info.mes.slice(5, 7)) - 1] : 'o mês'
      const pl = typeof info.planejado === 'number' ? Math.round(info.planejado * 100) : null
      const base = `${vocativo}${mes} está ${pl ?? 0}% planejado.`
      const k = Math.min(3, comAcao)
      return k ? `${base} ${k === 1 ? 'Um ajuste deixa' : `${NUMERO_EXTENSO[k]} ajustes deixam`} o mês sem buracos.` : `${base} Nada para ajustar agora.`
    }
    case 'producao': {
      const a = Number(info.atrasadas ?? 0), b = Number(info.emAprovacao ?? 0)
      if (!a && !b) return 'Produção em dia: nada atrasado nem parado em aprovação.'
      const partes = [a ? plural(a, 'pauta atrasada', 'pautas atrasadas') : null, b ? `${b} esperando aprovação` : null].filter(Boolean).join(' e ')
      const COMECE: Record<string, string> = { Atrasada: 'Comece pela pauta atrasada.', 'Aprovação': 'Comece pelas aprovações paradas.', Gancho: 'Comece pelo roteiro sem gancho.', Estoque: 'Comece pela moto parada no estoque.' }
      const dica = insights[0] ? COMECE[insights[0].rotulo] : undefined
      return `${partes.charAt(0).toUpperCase()}${partes.slice(1)}.${dica ? ` ${dica}` : ''}`
    }
    case 'atendimento': {
      const n = Number(info.esperando ?? 0)
      if (!n) return 'Nenhum cliente esperando resposta agora.'
      return `${plural(n, 'conversa esperando', 'conversas esperando')}. A mais antiga é de ${info.maisAntiga}, há ${info.espera}.`
    }
    case 'desempenho': {
      const s = info.sinais as Record<string, { valor: number | null; status: string; meta: number | null }> | undefined
      if (!s) return 'Os sinais aparecem quando a conta do Instagram estiver conectada e sincronizada.'
      if (s.pulo?.status === 'atencao') return `O gancho é o gargalo: ${num(s.pulo.valor!)}% das pessoas pulam nos 3 primeiros segundos.`
      if (s.envios?.status === 'atencao') return `Os envios estão abaixo da meta: ${num(s.envios.valor!, 2)} por mil alcançados.`
      if (s.retencao?.status === 'atencao') return `A retenção dos reels está em ${num(s.retencao.valor!)}%, abaixo da meta de ${s.retencao.meta}%.`
      return 'Os sinais dos últimos 30 dias estão dentro das metas. Hora de testar algo novo.'
    }
    case 'atribuicao': {
      const k = info.kpis as { leads: number; vendas: number; valor: number | null } | undefined
      if (!k) return 'Leads e vendas do CRM voltam para o post que os gerou.'
      const base = k.valor != null && k.valor > 0 ? `Seu conteúdo ajudou a gerar ${moedaCurta(k.valor)} em vendas nos últimos 30 dias.` : `${plural(k.leads, 'lead orgânico', 'leads orgânicos')} e ${plural(k.vendas, 'venda', 'vendas')} nos últimos 30 dias.`
      const c = typeof info.concentracao === 'string' ? info.concentracao.match(/^(\d+)% dos leads vieram de (\d+)/) : null
      return c ? `${base} ${c[2] === '1' ? 'Um post concentra' : `${NUMERO_EXTENSO[Number(c[2])] ?? c[2]} posts concentram`} ${c[1]}% dos leads.` : base
    }
    case 'permissoes': {
      if (!p.membro) return `${vocativo}ainda não há um Social Media convidado. Envie o convite abaixo.`
      // Ativado = aceitou o convite e criou a senha.
      const dia = (p.membro.ativadoEm ?? p.membro.convidadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Belem' })
      const quem = p.nomeSM ?? 'o Social Media'
      const base = `${vocativo}${!p.membro.ativo ? `o acesso de ${quem} está suspenso.` : p.membro.ativadoEm ? `${quem} está com acesso desde ${dia}.` : `o convite de ${quem} foi enviado em ${dia} e ainda não foi aceito.`}`
      const k = Math.min(3, comAcao)
      return k ? `${base} ${k === 1 ? 'Uma mudança ajuda' : `${NUMERAL_FEMININO[k]} mudanças ajudam`} a render mais sem abrir dados sensíveis.` : base
    }
  }
  return ''
}

async function base(sm: ContextoSM, aba: Aba, agora: Date) {
  const info: InfoAba = {}
  const [insights, p] = await Promise.all([insightsDaAba(sm, aba, agora, info), pessoas(sm)])
  return { info, insights, frase: frase(aba, info, insights, p, sm) }
}

/** Frase do momento redigida pela IA (null: fica a do template). */
export async function fraseDaIA(sm: ContextoSM, aba: Aba, agora = new Date()): Promise<string | null> {
  if (!iaLigada()) return null
  const b = await base(sm, aba, agora)
  return redigirFrase(sm.usuarioId, aba, NOME_ABA[aba], b.frase, { numeros: b.info, sugestoes: b.insights.slice(0, 3).map(i => i.texto) })
}

export async function montarAssistente(sm: ContextoSM, aba: Aba, agora = new Date()) {
  const [{ insights, frase: texto }, estado, perguntas] = await Promise.all([
    base(sm, aba, agora),
    prisma.smAssistenteEstado.findUnique({ where: { usuarioId_ator_aba: { usuarioId: sm.usuarioId, ator: atorDe(sm), aba } }, select: { recolhido: true } }),
    perguntasDaAba(sm, aba, agora),
  ])
  return {
    aba,
    rotulo: `Assistente · ${NOME_ABA[aba]}`,
    frase: texto,
    // Já redigida antes para estes mesmos números; senão a tela pede em /frase.
    fraseIA: await fraseGuardada(sm.usuarioId, aba, texto),
    ia: iaLigada(),
    perguntas,
    sugestoes: insights.slice(0, 3).map(i => ({
      chave: i.chave, tipo: i.tipo, rotulo: i.rotulo, texto: i.texto, confianca: i.confianca, amostra: i.amostra, amostraTexto: textoAmostra(i.chave, i.amostra),
      acao: i.acao ? { rotulo: i.acao.rotulo, navega: i.acao.operacao.tipo === 'ABRIR' } : null,
    })),
    total: insights.length,
    recolhido: estado?.recolhido ?? false,
    somenteLeitura: sm.somenteLeitura,
  }
}
