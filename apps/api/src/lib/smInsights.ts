// Motor de insights e sugestões (seção 13) para o assistente da aba (seção 16).
// - Cada regra da seção 13.4 gera insights com tipo, aba, texto, confiança,
//   amostra, ação executável e validade. Os números saem do banco.
// - Regras de qualidade (13.2): grupos com menos de 3 posts não geram
//   insight; com 3 ou 4, viram hipótese; dias sem dados avisam ou suprimem.
// - A ação nunca vem do navegador: o servidor recalcula os insights da aba,
//   acha a chave e executa a operação dela, checando a permissão do papel.
// - Toda ação guarda como desfazer; o insight feito some por 7 dias.
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import type { ContextoSM, ModuloSM } from './smAcesso'
import { calendarioDoMes, carregarConfig, diaLocal, type DiaCalendario } from './smCalendario'
import { listarEstoque } from './smEstoque'
import { gerarCodigo, notificar } from './smPautas'
import { listarGanchos } from './smTestes'
import { melhoresJanelas } from './smJanelas'
import { analisarContaSocialMedia } from './socialMediaResumo'
import { sinaisDoPeriodo } from './smDesempenho'
import { periodoDosUltimosDias, vendasPorPost } from './smAtribuicao'

export const ABAS = ['calendario', 'producao', 'atendimento', 'desempenho', 'atribuicao', 'permissoes'] as const
export type Aba = (typeof ABAS)[number]
export type TipoInsight = 'URGENTE' | 'ATENCAO' | 'OPORTUNIDADE' | 'PONTO_FORTE' | 'APRENDIZADO' | 'OBSERVACAO'
export type Confianca = 'alta' | 'media' | 'baixa' | 'hipotese'

type PautaNova = { titulo: string; pilar: string; formato: string; origem: string; origemRef?: string | null; motoId?: string | null; agendadoPara?: string | null; prazo?: string | null; gancho?: string | null }
export type Operacao =
  | { tipo: 'MOVER_PAUTA'; pautaId: string; para: string }
  | { tipo: 'CRIAR_PAUTAS'; pautas: PautaNova[] }
  | { tipo: 'CRIAR_TESTE'; teste: { hipotese: string; descricao?: string; variavel: string; grupoA: string; grupoB: string; horaA?: number | null; horaB?: number | null; metrica: string; amostraAlvo: number } }
  | { tipo: 'APLICAR_GANCHO'; pautaId: string; gancho: string }
  | { tipo: 'NOTIFICAR'; destinatario: 'GESTOR' | 'SOCIAL_MEDIA'; chave: string; titulo: string; texto: string }
  | { tipo: 'CRIAR_RESPOSTA_E_PAUTA'; titulo: string; texto: string; pauta: PautaNova }
  | { tipo: 'REGRA'; niveis?: Partial<Record<ModuloSM, string>>; regras?: Record<string, boolean> }
  | { tipo: 'ABRIR'; href: string }

/** Números que os geradores encontram e que a frase do assistente usa (seção 16.2). */
export type InfoAba = Record<string, unknown>

export interface Insight {
  chave: string
  aba: Aba
  tipo: TipoInsight
  rotulo: string
  texto: string
  confianca: Confianca
  amostra: number | null
  acao: { rotulo: string; operacao: Operacao } | null
  validade: string
  prioridade: number
}

const DIA_MS = 864e5
const OFF = 3 * 3600e3
const PESO: Record<TipoInsight, number> = { URGENTE: 100, ATENCAO: 80, OPORTUNIDADE: 60, APRENDIZADO: 50, PONTO_FORTE: 40, OBSERVACAO: 30 }
const PILAR_NOME: Record<string, string> = { ESTOQUE: 'Estoque', PROVA: 'Prova social', EDUCACAO: 'Educação', BASTIDORES: 'Bastidores' }
const FORMATO_PLURAL: Record<string, string> = { REELS: 'reels', CARROSSEL: 'carrosséis', FOTO: 'fotos', STORY: 'stories' }

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const somarDias = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10)
const emLocal = (d: string, hora: number, minuto = 0) => new Date(Date.parse(`${d}T${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}:00Z`) + OFF).toISOString()
const fimDoDia = (d: string) => new Date(Date.parse(`${d}T23:59:59Z`) + OFF).toISOString()
const pct = (v: number, c = 0) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: c })}%`
const num = (v: number, c = 1) => v.toLocaleString('pt-BR', { maximumFractionDigits: c })
const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`

function insight(i: Omit<Insight, 'prioridade' | 'validade'> & { validade?: string; peso?: number }): Insight {
  const { peso, validade, ...resto } = i
  return { ...resto, validade: validade ?? new Date(Date.now() + 7 * DIA_MS).toISOString(), prioridade: PESO[i.tipo] + (peso ?? 0) }
}

/** Quem está agindo: o membro Social Media, ou o gestor. */
export function atorDe(sm: ContextoSM): string { return sm.visao === 'GESTOR' ? 'GESTOR' : sm.membroId ?? 'GESTOR' }
const podeAgir = (sm: ContextoSM, modulo: ModuloSM) => !sm.somenteLeitura && sm.pode(modulo, 'COMPLETO')

/** Hora da melhor janela para o dia da semana (ou 18h sem histórico). */
async function horaDaJanela(usuarioId: string) {
  const j = await melhoresJanelas(usuarioId)
  return (dia: string) => {
    const semana = new Date(`${dia}T12:00:00Z`).getUTCDay()
    const w = j.janelas.find(x => x.dia === semana) ?? (j.base === 'SEGUIDORES_ONLINE' ? j.janelas[0] : undefined)
    return w ? w.inicioHora + 1 : 18
  }
}

// ---------- Calendário (e Hoje) ----------

async function insightsCalendario(sm: ContextoSM, agora: Date, info: InfoAba = {}): Promise<Insight[]> {
  if (!sm.pode('producao', 'LEITURA')) return []
  const usuarioId = sm.usuarioId
  const hoje = diaLocal(agora)
  const config = await carregarConfig(usuarioId)
  const limite = somarDias(hoje, config.horizonteDias)
  const meses = [...new Set([hoje.slice(0, 7), limite.slice(0, 7)])]
  const cals = await Promise.all(meses.map(m => calendarioDoMes(usuarioId, m, { podeArrastar: false }, agora)))
  const porData = new Map<string, DiaCalendario>()
  // A grade de cada mês traz dias vizinhos sem os itens deles: vale o dia do próprio mês.
  for (const c of cals) for (const d of c.semanas.flat()) if (!porData.has(d.data) || d.doMes) porData.set(d.data, d)
  const futuros = [...porData.values()].filter(d => d.data >= hoje && d.data <= limite).sort((a, b) => a.data.localeCompare(b.data))
  const editar = podeAgir(sm, 'producao')
  const hora = await horaDaJanela(usuarioId)
  // Só horários que ainda não passaram (o slot de hoje pode já ter passado da janela).
  const aindaDa = (d: string) => Date.parse(emLocal(d, hora(d))) > agora.getTime() + 30 * 60000
  // Quanto do resto do mês já está planejado contra a meta de dias com post.
  const fimMes = somarDias(`${somarDias(`${hoje.slice(0, 7)}-01`, 32).slice(0, 7)}-01`, -1)
  const restantes = [...porData.values()].filter(d => d.data >= hoje && d.data <= fimMes)
  const precisa = Math.max(1, Math.round(restantes.length * config.minDiasSemana / 7))
  info.mes = hoje.slice(0, 7)
  info.planejado = Math.min(1, restantes.filter(d => d.postsFeed > 0).length / precisa)
  const r: Insight[] = []

  // Rajada: mover o último post planejado do dia para o dia livre mais próximo.
  for (const d of futuros.filter(x => x.rajada)) {
    const movivel = [...d.itens].reverse().find(i => i.tipo === 'PAUTA' && i.contaNaCadencia && i.status !== 'PUBLICADO')
    const livre = futuros.find(x => x.data > d.data && x.postsFeed === 0) ?? futuros.find(x => x.postsFeed === 0)
    if (!movivel || !livre) continue
    const [h, m] = movivel.hora.split(':').map(Number)
    r.push(insight({
      chave: `cal:rajada:${d.data}:${movivel.id}`, aba: 'calendario', tipo: 'ATENCAO', rotulo: 'Rajada',
      texto: `${ddmm(d.data)} tem ${d.postsFeed} posts (máximo ${config.maxPostsDia}). Sugiro mover “${movivel.titulo}” para ${ddmm(livre.data)}, no mesmo horário.`,
      confianca: 'alta', amostra: d.postsFeed, validade: fimDoDia(d.data),
      acao: editar ? { rotulo: 'Mover', operacao: { tipo: 'MOVER_PAUTA', pautaId: movivel.id, para: emLocal(livre.data, h, m) } } : null,
    }))
  }

  // Dias sem post que quebram o intervalo máximo: separar pautas do estoque.
  const trechos: Array<{ de: string; ate: string; dias: number }> = []
  for (const d of futuros) {
    if (d.postsFeed > 0) continue
    const u = trechos[trechos.length - 1]
    if (u && u.ate === somarDias(d.data, -1)) { u.ate = d.data; u.dias++ } else trechos.push({ de: d.data, ate: d.data, dias: 1 })
  }
  const buraco = trechos.find(t => t.dias > config.maxDiasSemPost)
  if (buraco) {
    const n = Math.max(1, Math.floor(buraco.dias / (config.maxDiasSemPost + 1)))
    const motos = sm.pode('estoque', 'LEITURA')
      ? (await listarEstoque(usuarioId, agora)).filter(m => m.situacao !== 'VENDIDA' && m.emProducao === 0).sort((a, b) => a.posts - b.posts || b.diasEmEstoque - a.diasEmEstoque).slice(0, n)
      : []
    const passo = Math.max(1, Math.floor(buraco.dias / (n + 1)))
    // Sem moto do estoque, os pilares seguem o que mais falta no mix do mês.
    const mixMes = cals[0].mix
    const ordemPilares = mixMes.pilares.map(p => ({ p: p.pilar, falta: p.meta - p.percentual })).sort((a, b) => b.falta - a.falta).map(x => x.p)
    const pautas: PautaNova[] = Array.from({ length: n }, (_, i) => {
      let dia = somarDias(buraco.de, Math.min(buraco.dias - 1, passo * (i + 1) - 1))
      if (!aindaDa(dia) && dia < buraco.ate) dia = somarDias(dia, 1)
      const m = motos[i]
      return m
        ? { titulo: `${m.modelo}${m.ano ? ` ${m.ano}` : ''}: ${m.posts ? 'de volta ao feed' : 'primeiro post'}`, pilar: 'ESTOQUE', formato: 'REELS', origem: 'ESTOQUE', origemRef: m.id, motoId: m.id, agendadoPara: emLocal(dia, hora(dia)) }
        : (() => { const pilar = ordemPilares[(i - motos.length) % ordemPilares.length] ?? 'BASTIDORES'; return { titulo: `${PILAR_NOME[pilar]}: pauta para ${ddmm(dia)}`, pilar, formato: pilar === 'EDUCACAO' ? 'CARROSSEL' : 'REELS', origem: 'CALENDARIO', origemRef: `buraco:${dia}`, agendadoPara: emLocal(dia, hora(dia)) } })()
    })
    r.push(insight({
      chave: `cal:buraco:${buraco.de}`, aba: 'calendario', tipo: 'OPORTUNIDADE', rotulo: buraco.dias >= 5 ? 'Semana vazia' : 'Dias sem post',
      texto: `${ddmm(buraco.de)} a ${ddmm(buraco.ate)} sem posts (máximo de ${config.maxDiasSemPost} dias seguidos). ${motos.length ? `Separei ${plural(pautas.length, 'pauta', 'pautas')} do estoque para preencher.` : `Separei ${plural(pautas.length, 'pauta', 'pautas')} para preencher.`}`,
      confianca: 'alta', amostra: buraco.dias, validade: fimDoDia(buraco.ate), peso: Math.min(10, buraco.dias),
      acao: editar ? { rotulo: motos.length ? 'Criar pautas do estoque' : 'Criar pautas', operacao: { tipo: 'CRIAR_PAUTAS', pautas } } : null,
    }))
  }

  // Pilar abaixo da meta do mix por 5 pontos ou mais: uma pauta do pilar num slot livre.
  const mix = cals[0].mix
  const slot = futuros.find(d => d.slotLivre && aindaDa(d.data))
  if (mix.total >= 4) {
    const abaixo = mix.pilares.map(p => ({ ...p, falta: p.meta - p.percentual })).filter(p => p.falta >= 0.05).sort((a, b) => b.falta - a.falta)[0]
    if (abaixo && slot) {
      const formato = abaixo.pilar === 'EDUCACAO' ? 'CARROSSEL' : 'REELS'
      r.push(insight({
        chave: `cal:mix:${hoje.slice(0, 7)}:${abaixo.pilar}`, aba: 'calendario', tipo: 'APRENDIZADO', rotulo: 'Mix',
        texto: `${PILAR_NOME[abaixo.pilar]} está em ${pct(abaixo.percentual)} do mês (meta ${pct(abaixo.meta)}). Sugiro ${formato === 'CARROSSEL' ? 'um carrossel' : 'um reel'} de ${PILAR_NOME[abaixo.pilar].toLowerCase()} em ${ddmm(slot.data)}.`,
        confianca: mix.total >= 10 ? 'alta' : 'media', amostra: mix.total,
        acao: editar ? { rotulo: 'Agendar', operacao: { tipo: 'CRIAR_PAUTAS', pautas: [{ titulo: `${PILAR_NOME[abaixo.pilar]}: pauta para ${ddmm(slot.data)}`, pilar: abaixo.pilar, formato, origem: 'CALENDARIO', origemRef: `mix:${slot.data}`, agendadoPara: emLocal(slot.data, hora(slot.data)) }] } } : null,
      }))
    }
  }

  // Retomada: 3+ dias sem post no feed (mesma regra do banner da tela Hoje).
  const conta = await prisma.socialMediaConta.findUnique({ where: { titular: `dono:${usuarioId}` }, select: { id: true, seguidoresOnline: true } })
  if (conta) {
    const ultimo = await prisma.socialMediaMidia.findFirst({ where: { contaId: conta.id, NOT: { formato: { in: ['STORY', 'AD'] } } }, orderBy: { publicadoEm: 'desc' }, select: { publicadoEm: true } })
    const semPost = ultimo ? Math.floor((Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${diaLocal(ultimo.publicadoEm)}T12:00:00Z`)) / DIA_MS) : null
    const proximo = futuros.find(d => d.postsFeed > 0)
    if (semPost != null && semPost >= 3 && (!proximo || proximo.data > somarDias(hoje, 1))) {
      const amanha = somarDias(hoje, 1)
      r.push(insight({
        chave: `cal:retomada:${hoje}`, aba: 'calendario', tipo: 'URGENTE', rotulo: 'Retomada',
        texto: `${semPost} dias sem post no feed${proximo ? ` e o próximo só em ${ddmm(proximo.data)}` : ''}. Um post amanhã já retoma a cadência.`,
        confianca: 'alta', amostra: semPost, validade: fimDoDia(hoje), peso: 5,
        acao: editar ? { rotulo: 'Agendar para amanhã', operacao: { tipo: 'CRIAR_PAUTAS', pautas: [{ titulo: `Retomada: post de ${ddmm(amanha)}`, pilar: 'ESTOQUE', formato: 'REELS', origem: 'CALENDARIO', origemRef: `retomada:${amanha}`, agendadoPara: emLocal(amanha, hora(amanha)) }] } } : null,
      }))
    }

    // Pico de seguidores online fora das faixas onde se publica: hipótese para testar.
    const online = conta.seguidoresOnline as Record<string, number> | null
    if (online && typeof online === 'object') {
      const valores = Array.from({ length: 24 }, (_, h) => Number(online[String(h)]) || 0)
      const pico = valores.indexOf(Math.max(...valores))
      const posts = await prisma.socialMediaMidia.findMany({ where: { contaId: conta.id, publicadoEm: { gte: new Date(agora.getTime() - 30 * DIA_MS) }, NOT: { formato: { in: ['STORY', 'AD'] } } }, select: { publicadoEm: true } })
      const horas = posts.map(p => new Date(p.publicadoEm.getTime() - OFF).getUTCHours())
      const perto = horas.filter(h => Math.abs(h - pico) <= 1).length
      const usual = horas.length ? [...horas.reduce((m, h) => m.set(h, (m.get(h) ?? 0) + 1), new Map<number, number>())].sort((a, b) => b[1] - a[1])[0][0] : null
      const testeHorario = await prisma.smTeste.count({ where: { usuarioId, status: 'ATIVO', variavel: 'HORARIO' } })
      if (valores[pico] > 0 && horas.length >= 5 && perto / horas.length < 0.2 && usual != null && Math.abs(usual - pico) > 1 && !testeHorario) {
        r.push(insight({
          chave: `cal:pico:${pico}:${usual}`, aba: 'calendario', tipo: 'APRENDIZADO', rotulo: 'Horário',
          texto: `Pico de seguidores online às ${pico}h, mas só ${perto} de ${horas.length} posts dos últimos 30 dias saíram perto desse horário (a maioria às ${usual}h). Vale testar.`,
          confianca: 'hipotese', amostra: horas.length,
          acao: podeAgir(sm, 'analise') ? { rotulo: 'Criar teste', operacao: { tipo: 'CRIAR_TESTE', teste: { hipotese: `Posts às ${pico}h alcançam mais que às ${usual}h`, descricao: 'Mesmo formato e pilar nos dois horários.', variavel: 'HORARIO', grupoA: `${pico}h`, grupoB: `${usual}h`, horaA: pico, horaB: usual, metrica: 'ALCANCE', amostraAlvo: 6 } } } : null,
        }))
      }
    }
  }
  return r
}

// ---------- Produção ----------

async function insightsProducao(sm: ContextoSM, agora: Date, info: InfoAba = {}): Promise<Insight[]> {
  if (!sm.pode('producao', 'LEITURA')) return []
  const usuarioId = sm.usuarioId
  const hoje = diaLocal(agora)
  const souGestor = sm.visao === 'GESTOR'
  const pautas = await prisma.smPauta.findMany({ where: { usuarioId, status: { not: 'PUBLICADO' } }, select: { id: true, titulo: true, status: true, prazo: true, origem: true, formato: true, gancho: true, aprovacao: true, enviadaAprovacaoEm: true, motoId: true } })
  const r: Insight[] = []

  // Atrasadas: avisar quem coordena (o gestor; ou o Social Media, se quem vê é o gestor).
  const atrasadas = pautas.filter(p => p.prazo && diaLocal(p.prazo) < hoje && p.status !== 'AGENDADO').sort((a, b) => a.prazo!.getTime() - b.prazo!.getTime())
  info.atrasadas = atrasadas.length
  info.emAprovacao = pautas.filter(p => p.status === 'APROVACAO' && p.aprovacao === 'PENDENTE').length
  for (const p of atrasadas.slice(0, 2)) {
    const entrega = p.origem === 'VENDA'
    r.push(insight({
      chave: `prod:atrasada:${p.id}`, aba: 'producao', tipo: 'URGENTE', rotulo: 'Atrasada',
      texto: `“${p.titulo}” passou do prazo (${ddmm(diaLocal(p.prazo!))}).${entrega ? ' É a entrega de um cliente: combine a gravação com o consultor.' : ''}`,
      confianca: 'alta', amostra: atrasadas.length, peso: 5,
      acao: sm.somenteLeitura ? null : { rotulo: souGestor ? 'Avisar o Social Media' : entrega ? 'Avisar o gestor e o consultor' : 'Avisar o gestor', operacao: { tipo: 'NOTIFICAR', destinatario: souGestor ? 'SOCIAL_MEDIA' : 'GESTOR', chave: `atrasada:${p.id}`, titulo: `Pauta atrasada: ${p.titulo}`, texto: entrega ? 'Entrega de cliente atrasada: combinar a gravação com o consultor da venda.' : `Prazo era ${ddmm(diaLocal(p.prazo!))}.` } },
    }))
  }

  // Em aprovação há mais de 24 h: lembrar o gestor.
  const paradas = pautas.filter(p => p.status === 'APROVACAO' && p.aprovacao === 'PENDENTE' && p.enviadaAprovacaoEm && agora.getTime() - p.enviadaAprovacaoEm.getTime() > DIA_MS)
  if (paradas.length) {
    r.push(insight({
      chave: `prod:aprovacao:${paradas.map(p => p.id).sort().join(',')}`, aba: 'producao', tipo: 'ATENCAO', rotulo: 'Aprovação',
      texto: `${plural(paradas.length, 'pauta parada', 'pautas paradas')} há mais de 1 dia aguardando o gestor: ${paradas.slice(0, 2).map(p => `“${p.titulo}”`).join(', ')}${paradas.length > 2 ? '…' : '.'}`,
      confianca: 'alta', amostra: paradas.length,
      acao: sm.somenteLeitura ? null : souGestor
        ? { rotulo: 'Revisar agora', operacao: { tipo: 'ABRIR', href: `/pro-labore/sm/producao?pauta=${paradas[0].id}` } }
        : { rotulo: 'Enviar lembrete', operacao: { tipo: 'NOTIFICAR', destinatario: 'GESTOR', chave: `lembrete-aprovacao:${hoje}`, titulo: `${plural(paradas.length, 'pauta espera', 'pautas esperam')} sua aprovação`, texto: `Há mais de 1 dia: ${paradas.map(p => p.titulo).join(', ')}.` } },
    }))
  }

  // Roteiro sem gancho: sugerir o gancho com menor pulo médio da biblioteca.
  const { ganchos } = await listarGanchos(usuarioId)
  const melhor = ganchos.find(g => g.puloMedio != null)
  const semGancho = pautas.filter(p => ['ROTEIRO', 'GRAVACAO'].includes(p.status) && p.formato === 'REELS' && !p.gancho?.trim())
  if (melhor && semGancho.length) {
    const p = semGancho[0]
    r.push(insight({
      chave: `prod:gancho:${p.id}:${melhor.id}`, aba: 'producao', tipo: 'APRENDIZADO', rotulo: 'Gancho',
      texto: `O roteiro de “${p.titulo}” está sem gancho. “${melhor.texto}” teve o menor pulo da biblioteca (${pct(melhor.puloMedio!, 1)} em ${plural(melhor.comPulo, 'reel', 'reels')}).`,
      confianca: melhor.comPulo >= 5 ? 'alta' : melhor.comPulo >= 3 ? 'media' : 'baixa', amostra: melhor.comPulo,
      acao: podeAgir(sm, 'producao') ? { rotulo: 'Aplicar gancho', operacao: { tipo: 'APLICAR_GANCHO', pautaId: p.id, gancho: melhor.texto } } : null,
    }))
  }

  // Moto com 20+ dias na loja e sem post: gerar pauta.
  if (sm.pode('estoque', 'LEITURA')) {
    const paradasEstoque = (await listarEstoque(usuarioId, agora)).filter(m => m.situacao !== 'VENDIDA' && m.diasEmEstoque >= 20 && m.posts === 0 && m.emProducao === 0).sort((a, b) => b.diasEmEstoque - a.diasEmEstoque)
    const m = paradasEstoque[0]
    if (m) {
      r.push(insight({
        chave: `prod:estoque:${m.id}`, aba: 'producao', tipo: 'OPORTUNIDADE', rotulo: 'Estoque',
        texto: `${m.modelo}${m.ano ? ` ${m.ano}` : ''} está há ${m.diasEmEstoque} dias na loja sem nenhum post${paradasEstoque.length > 1 ? ` (e mais ${plural(paradasEstoque.length - 1, 'moto', 'motos')} assim)` : ''}.`,
        confianca: 'alta', amostra: paradasEstoque.length,
        acao: podeAgir(sm, 'producao') ? { rotulo: 'Gerar pauta', operacao: { tipo: 'CRIAR_PAUTAS', pautas: [{ titulo: `${m.modelo}${m.ano ? ` ${m.ano}` : ''}: parada há ${m.diasEmEstoque} dias`, pilar: 'ESTOQUE', formato: 'REELS', origem: 'ESTOQUE', origemRef: m.id, motoId: m.id }] } } : null,
      }))
    }
  }
  return r
}

// ---------- Atendimento ----------

export const TEMAS: Array<{ tema: string; re: RegExp; resposta: string }> = [
  { tema: 'troca', re: /\btroca|aceita.{0,12}(moto|carro).{0,12}(entrada|parte)/i, resposta: 'Me conta o modelo, o ano e a quilometragem da sua moto que eu passo para o consultor avaliar a troca.' },
  { tema: 'financiamento', re: /financ|parcel|presta[çc]/i, resposta: 'Consigo simular para você. Me passa o valor de entrada que você pensa em dar e em quantas vezes prefere pagar.' },
  { tema: 'entrada', re: /\bentrada\b/i, resposta: 'A entrada depende da moto e da forma de pagamento. Me diz qual moto te interessou que eu simulo com você.' },
  { tema: 'consórcio', re: /cons[óo]rcio/i, resposta: 'Trabalhamos com opções de pagamento diferentes. Me conta qual moto te interessou que o consultor explica como fica no consórcio.' },
  { tema: 'preço', re: /pre[çc]o|quanto (custa|fica|sai|t[áa])|qual (o )?valor/i, resposta: 'O valor depende da forma de pagamento. Me diz se seria à vista ou financiado que eu te passo certinho.' },
  { tema: 'documentação e CNH', re: /\bcnh\b|habilita|document/i, resposta: 'Posso te explicar o que precisa. Me conta se a ideia é financiar ou pagar à vista.' },
  { tema: 'garantia e revisão', re: /garantia|revis[ãa]o/i, resposta: 'Te explico direitinho as condições de garantia e revisão. Qual moto te interessou?' },
]
const TEMAS_INTENCAO: Array<[RegExp, string]> = [
  [/simula/i, 'simulação'], [/financ|parcel|presta[çc]/i, 'financiamento'], [/\bentrada\b/i, 'entrada'], [/[àa] vista/i, 'pagamento à vista'],
  [/cons[óo]rcio/i, 'consórcio'], [/reserv/i, 'reservar a moto'], [/test.?drive/i, 'test drive'], [/visitar a loja/i, 'visitar a loja'],
  [/pre[çc]o|valor|quanto (custa|fica|sai)/i, 'preço'],
]
export function temaDaIntencao(texto: string): string { return TEMAS_INTENCAO.find(([re]) => re.test(texto))?.[1] ?? 'compra' }
export const INTENCAO = /simula|financ|parcel|entrada|[àa] vista|pre[çc]o|valor|quanto (custa|fica|sai)|cons[óo]rcio|reserv|test.?drive|visitar a loja/i

async function insightsAtendimento(sm: ContextoSM, agora: Date, info: InfoAba = {}): Promise<Insight[]> {
  if (!sm.pode('atendimento', 'LEITURA')) return []
  const usuarioId = sm.usuarioId
  const config = await carregarConfig(usuarioId)
  const r: Insight[] = []
  const esperando = await prisma.smConversa.findMany({
    where: { usuarioId, aguardandoDesde: { not: null }, status: { not: 'ARQUIVADA' } },
    orderBy: { aguardandoDesde: 'asc' },
    select: { id: true, clienteNome: true, clienteUsuario: true, motoInteresse: true, aguardandoDesde: true, mensagens: { where: { direcao: 'IN' }, orderBy: { enviadaEm: 'desc' }, take: 1, select: { texto: true } } },
  })
  const nome = (c: { clienteNome: string | null; clienteUsuario: string | null }) => c.clienteNome ?? (c.clienteUsuario ? `@${c.clienteUsuario}` : 'Cliente')
  const espera = (d: Date) => { const min = Math.round((agora.getTime() - d.getTime()) / 60000); return min < 60 ? `${min} min` : min < 2880 ? `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}` : `${Math.floor(min / 1440)} dias` }

  info.esperando = esperando.length
  if (esperando[0]) { info.maisAntiga = nome(esperando[0]); info.espera = espera(esperando[0].aguardandoDesde!) }
  // Acima da meta de resposta: a mais antiga primeiro.
  const atrasadas = esperando.filter(c => agora.getTime() - c.aguardandoDesde!.getTime() > config.metaRespostaMin * 60000)
  if (atrasadas.length) {
    const c = atrasadas[0]
    const msg = c.mensagens[0]?.texto?.replace(/\s+/g, ' ').trim()
    r.push(insight({
      chave: `atd:resposta:${c.id}:${c.aguardandoDesde!.toISOString()}`, aba: 'atendimento', tipo: 'URGENTE', rotulo: `${espera(c.aguardandoDesde!)} sem resposta`,
      texto: `${nome(c)}${c.motoInteresse ? ` · ${c.motoInteresse}` : ''}${msg ? `: “${msg.length > 80 ? `${msg.slice(0, 77)}…` : msg}”` : ''}${atrasadas.length > 1 ? ` (e mais ${plural(atrasadas.length - 1, 'conversa', 'conversas')} acima da meta de ${config.metaRespostaMin} min)` : ''}`,
      confianca: 'alta', amostra: atrasadas.length, peso: 10,
      acao: { rotulo: 'Responder agora', operacao: { tipo: 'ABRIR', href: `/pro-labore/sm/atendimento?conversa=${c.id}&sugerir=1` } },
    }))
  }

  // Intenção de compra sem lead: pronta para o CRM.
  const semana = new Date(agora.getTime() - 7 * DIA_MS)
  const abertas = await prisma.smConversa.findMany({
    where: { usuarioId, leadId: null, status: { not: 'ARQUIVADA' }, ultimaEntradaEm: { gte: semana } },
    select: { id: true, clienteNome: true, clienteUsuario: true, motoInteresse: true, mensagens: { where: { direcao: 'IN', enviadaEm: { gte: semana } }, select: { texto: true } } },
  })
  const quentes = abertas.map(c => ({ c, m: c.mensagens.map(x => x.texto).find(t => INTENCAO.test(t)) })).filter(x => x.m)
  if (quentes.length && sm.pode('crm', 'LEITURA')) {
    const { c, m } = quentes[0]
    const tema = temaDaIntencao(m!)
    r.push(insight({
      chave: `atd:lead:${c.id}`, aba: 'atendimento', tipo: 'PONTO_FORTE', rotulo: 'Pronta para lead',
      texto: `${nome(c)}${c.motoInteresse ? ` (${c.motoInteresse})` : ''} já falou de ${tema}: “${m!.length > 70 ? `${m!.slice(0, 67)}…` : m}”${quentes.length > 1 ? ` · mais ${plural(quentes.length - 1, 'conversa', 'conversas')} assim` : ''}.`,
      confianca: 'media', amostra: quentes.length,
      acao: podeAgir(sm, 'atendimento') ? { rotulo: 'Enviar ao CRM', operacao: { tipo: 'ABRIR', href: `/pro-labore/sm/atendimento?conversa=${c.id}&lead=1` } } : null,
    }))
  }

  // Mesma pergunta 3+ vezes na semana: resposta rápida e uma pauta sobre o tema.
  const recebidas = await prisma.smMensagem.findMany({ where: { direcao: 'IN', enviadaEm: { gte: semana }, conversa: { usuarioId } }, select: { texto: true, conversaId: true } })
  const contagem = TEMAS.map(t => ({ t, conversas: new Set(recebidas.filter(m => t.re.test(m.texto)).map(m => m.conversaId)).size })).filter(x => x.conversas >= 3).sort((a, b) => b.conversas - a.conversas)
  if (contagem.length) {
    const { t, conversas } = contagem[0]
    const jaTem = await prisma.smRespostaRapida.findFirst({ where: { usuarioId, titulo: { equals: `Dúvida: ${t.tema}`, mode: 'insensitive' } }, select: { id: true } })
    if (!jaTem) {
      const pautaTema: PautaNova = { titulo: `Dúvida da semana: ${t.tema}`, pilar: 'EDUCACAO', formato: 'CARROSSEL', origem: 'INSIGHT', origemRef: `duvida:${t.tema}` }
      r.push(insight({
        chave: `atd:tema:${t.tema}:${diaLocal(semana)}`, aba: 'atendimento', tipo: 'APRENDIZADO', rotulo: 'Padrão da semana',
        texto: `${conversas} pessoas perguntaram sobre ${t.tema} esta semana. Vale uma resposta rápida e um post sobre isso.`,
        confianca: conversas >= 5 ? 'alta' : 'media', amostra: conversas,
        acao: podeAgir(sm, 'producao') ? { rotulo: sm.visao === 'GESTOR' ? 'Criar resposta e pauta' : 'Criar pauta e sugerir a resposta', operacao: { tipo: 'CRIAR_RESPOSTA_E_PAUTA', titulo: `Dúvida: ${t.tema}`, texto: t.resposta, pauta: pautaTema } } : null,
      }))
    }
  }
  return r
}

// ---------- Desempenho ----------

async function insightsDesempenho(sm: ContextoSM, agora: Date, info: InfoAba = {}): Promise<Insight[]> {
  if (!sm.pode('analise', 'LEITURA')) return []
  const usuarioId = sm.usuarioId
  const conta = await prisma.socialMediaConta.findUnique({ where: { titular: `dono:${usuarioId}` } })
  if (!conta) return []
  const [analise, config, testes] = await Promise.all([
    analisarContaSocialMedia({ usuarioId, conta, vendedorTitular: null, inicio: null, fim: diaLocal(agora), origem: 'ORGANICO' }),
    carregarConfig(usuarioId),
    prisma.smTeste.findMany({ where: { usuarioId, status: 'ATIVO' }, select: { variavel: true } }),
  ])
  const r: Insight[] = []
  const q = analise.qualidade
  const aviso = q.status === 'lacunas' ? ` Pode estar afetado por ${plural(q.diasSemDados.length, 'dia', 'dias')} sem dados.` : ''

  if (q.status === 'completo') {
    r.push(insight({ chave: `des:dados:${diaLocal(agora)}`, aba: 'desempenho', tipo: 'PONTO_FORTE', rotulo: 'Dados confiáveis', texto: `${q.diasSincronizados} de ${q.diasPeriodo} dias sincronizados. As comparações deste período valem.`, confianca: 'alta', amostra: q.diasPeriodo, acao: null }))
  } else {
    r.push(insight({ chave: `des:lacunas:${diaLocal(agora)}`, aba: 'desempenho', tipo: 'ATENCAO', rotulo: 'Dados incompletos', texto: `${plural(q.diasSemDados.length, 'dia', 'dias')} sem sincronização nos últimos ${q.diasPeriodo}. ${q.status === 'grave' ? 'Mais de 20% faltando: insights de alta e queda ficam suspensos.' : 'As comparações podem estar afetadas.'}`, confianca: 'alta', amostra: q.diasPeriodo, acao: null }))
  }
  // Com mais de 20% dos dias faltando, nada de afirmação sobre o período (seção 13.2).
  if (q.status === 'grave') return r

  const sinais = Object.fromEntries(sinaisDoPeriodo(analise, config).map(s => [s.chave, s]))
  info.sinais = sinais
  const reels = analise.publicacoes.filter(p => p.formato === 'REELS' && p.taxaPulo != null)
  if (sinais.pulo.status === 'atencao' && reels.length >= 3) {
    const ord = [...reels].sort((a, b) => a.taxaPulo! - b.taxaPulo!)
    const t = (p: (typeof reels)[number]) => { const l = p.legenda?.split('\n')[0]?.trim() ?? 'sem legenda'; return l.length > 40 ? `${l.slice(0, 37)}…` : l }
    r.push(insight({
      chave: `des:pulo:${diaLocal(agora)}`, aba: 'desempenho', tipo: 'ATENCAO', rotulo: 'Gancho',
      texto: `${num(sinais.pulo.valor!)}% pulam nos 3 primeiros segundos (meta abaixo de ${config.metaPuloPct}%). Menor pulo: “${t(ord[0])}” (${pct(ord[0].taxaPulo!)}); maior: “${t(ord[ord.length - 1])}” (${pct(ord[ord.length - 1].taxaPulo!)}).${aviso}`,
      confianca: reels.length >= 5 ? 'media' : 'baixa', amostra: reels.length, peso: 5,
      acao: { rotulo: 'Ver comparação', operacao: { tipo: 'ABRIR', href: '/pro-labore/sm/desempenho#reels' } },
    }))
  }
  if (sinais.envios.status === 'atencao' && sinais.envios.amostra >= 3 && !testes.some(t => t.variavel === 'CTA')) {
    r.push(insight({
      chave: `des:envios:${diaLocal(agora)}`, aba: 'desempenho', tipo: 'ATENCAO', rotulo: 'Envios',
      texto: `${num(sinais.envios.valor!, 2)} envios por mil alcançados (meta ${num(config.metaEnviosMil)}). Teste um final “mande para quem…”.${aviso}`,
      confianca: sinais.envios.amostra >= 5 ? 'media' : 'baixa', amostra: sinais.envios.amostra,
      acao: podeAgir(sm, 'analise') ? { rotulo: 'Criar teste', operacao: { tipo: 'CRIAR_TESTE', teste: { hipotese: 'Terminar pedindo “mande para quem…” aumenta os envios', descricao: 'Mesmo formato nos dois grupos; só muda o final.', variavel: 'CTA', grupoA: '“Mande para quem…”', grupoB: 'Sem pedido', metrica: 'ENVIOS', amostraAlvo: 6 } } } : null,
    }))
  }
  // Aprendizados por regra (formato, horário, hashtags...), já com as regras de amostra da seção 13.2.
  for (const rec of analise.recomendacoes.filter(x => x.tipo !== 'info').slice(0, 3)) {
    r.push(insight({
      chave: `des:rec:${rec.id}`, aba: 'desempenho', tipo: rec.tipo === 'alerta' ? 'ATENCAO' : rec.tipo === 'destaque' ? 'PONTO_FORTE' : 'APRENDIZADO',
      rotulo: rec.confianca === 'hipotese' ? 'Hipótese' : rec.tipo === 'destaque' ? 'Destaque' : rec.tipo === 'alerta' ? 'Alerta' : 'Descoberta',
      texto: `${rec.titulo}. ${rec.detalhe}${rec.confianca === 'hipotese' && rec.amostra ? ` (hipótese · ${plural(rec.amostra, 'post', 'posts')})` : ''}`,
      confianca: rec.confianca, amostra: rec.amostra, peso: -10, acao: null,
    }))
  }
  return r
}

// ---------- Vendas por post ----------

async function insightsAtribuicao(sm: ContextoSM, info: InfoAba = {}): Promise<Insight[]> {
  if (!sm.pode('vendas', 'LEITURA')) return []
  const usuarioId = sm.usuarioId
  const mostrarValores = sm.visao === 'GESTOR' || sm.permissoes.regras.mostrarValores
  const v = await vendasPorPost(usuarioId, periodoDosUltimosDias(30), { mostrarValores })
  info.kpis = v.kpis
  info.concentracao = v.concentracao?.titulo ?? null
  const r: Insight[] = []
  if (v.concentracao) {
    const codigos = v.concentracao.posts.map(p => p.codigo).filter((c): c is string => !!c)
    const origens = codigos.length ? await prisma.smPauta.findMany({ where: { usuarioId, codigo: { in: codigos } }, select: { codigo: true, titulo: true, formato: true, pilar: true, gancho: true } }) : []
    const jaCriadas = new Set((await prisma.smPauta.findMany({ where: { usuarioId, origemRef: { in: origens.map(o => `atribuicao:${o.codigo}`) }, status: { not: 'PUBLICADO' } }, select: { origemRef: true } })).map(p => p.origemRef))
    const novas = origens.filter(o => !jaCriadas.has(`atribuicao:${o.codigo}`))
    r.push(insight({
      chave: `atr:repetir:${codigos.join(',')}`, aba: 'atribuicao', tipo: 'OPORTUNIDADE', rotulo: 'Repetir',
      texto: `${v.concentracao.titulo}. Vale repetir o formato.`,
      confianca: v.leadsComPost >= 10 ? 'media' : 'baixa', amostra: v.leadsComPost,
      acao: novas.length && podeAgir(sm, 'producao') ? { rotulo: 'Criar pauta igual', operacao: { tipo: 'CRIAR_PAUTAS', pautas: novas.map(o => ({ titulo: `No formato de "${o.titulo}"`.slice(0, 120), pilar: o.pilar, formato: o.formato, gancho: o.gancho, origem: 'INSIGHT', origemRef: `atribuicao:${o.codigo}` })) } } : null,
    }))
  }
  if (v.ciclo.emNegociacao > 0) {
    r.push(insight({
      chave: `atr:negociacao:${v.ciclo.emNegociacao}`, aba: 'atribuicao', tipo: 'ATENCAO', rotulo: 'Em negociação',
      texto: `${plural(v.ciclo.emNegociacao, 'lead orgânico segue aberto', 'leads orgânicos seguem abertos')} no CRM, dos últimos 30 dias.`,
      confianca: 'alta', amostra: v.ciclo.emNegociacao,
      acao: sm.somenteLeitura ? null : sm.visao === 'GESTOR'
        ? { rotulo: 'Ver leads', operacao: { tipo: 'ABRIR', href: '/pro-labore/leads' } }
        : { rotulo: 'Avisar o time comercial', operacao: { tipo: 'NOTIFICAR', destinatario: 'GESTOR', chave: `negociacao:${diaLocal(new Date())}`, titulo: `${plural(v.ciclo.emNegociacao, 'lead orgânico em negociação', 'leads orgânicos em negociação')}`, texto: 'Leads que vieram do Instagram nos últimos 30 dias e ainda não fecharam. Vale o time comercial retomar o contato.' } },
    }))
  }
  const testeFormato = await prisma.smTeste.count({ where: { usuarioId, status: 'ATIVO', variavel: 'FORMATO' } })
  const pequeno = v.leadsPorFormato.find(f => f.amostraPequena && f.formato !== 'REELS' && f.formato !== 'STORY')
  if (pequeno && !testeFormato) {
    r.push(insight({
      chave: `atr:amostra:${pequeno.formato}`, aba: 'atribuicao', tipo: 'APRENDIZADO', rotulo: 'Amostra pequena',
      texto: `Só ${plural(pequeno.posts, pequeno.rotulo.toLowerCase(), FORMATO_PLURAL[pequeno.formato])} no período. Mais alguns dizem se ${FORMATO_PLURAL[pequeno.formato]} trazem tanto resultado quanto os reels.`,
      confianca: 'hipotese', amostra: pequeno.posts,
      acao: podeAgir(sm, 'analise') ? { rotulo: 'Agendar teste', operacao: { tipo: 'CRIAR_TESTE', teste: { hipotese: `${pequeno.rotulo} de estoque alcança tanto quanto reels`, descricao: 'Mesmo pilar e mesma moto nos dois formatos.', variavel: 'FORMATO', grupoA: pequeno.rotulo, grupoB: 'Reels', metrica: 'ALCANCE', amostraAlvo: 6 } } } : null,
    }))
  }
  return r
}

// ---------- Permissões (gestor) ----------

async function insightsPermissoes(sm: ContextoSM, agora: Date, info: InfoAba = {}): Promise<Insight[]> {
  if (sm.visao !== 'GESTOR') return []
  const usuarioId = sm.usuarioId
  const r: Insight[] = []
  const regras = sm.permissoes.regras
  r.push(regras.mostrarValores
    ? insight({ chave: 'perm:valores:ok', aba: 'permissoes', tipo: 'PONTO_FORTE', rotulo: 'Motivação', texto: 'Os valores em R$ das vendas atribuídas estão visíveis: ver a venda que o post gerou engaja quem produz.', confianca: 'alta', amostra: null, acao: null, peso: -20 })
    : insight({ chave: 'perm:valores', aba: 'permissoes', tipo: 'OPORTUNIDADE', rotulo: 'Motivação', texto: 'Mostrar os valores em R$ das vendas atribuídas ajuda o Social Media a ver a venda que o post gerou. Custo e margem continuam fora.', confianca: 'alta', amostra: null, acao: sm.somenteLeitura ? null : { rotulo: 'Mostrar valores', operacao: { tipo: 'REGRA', regras: { mostrarValores: true } } } }))
  const paradas = await prisma.smPauta.count({ where: { usuarioId, status: 'APROVACAO', aprovacao: 'PENDENTE', enviadaAprovacaoEm: { lt: new Date(agora.getTime() - DIA_MS) } } })
  if (paradas) {
    r.push(insight({
      chave: `perm:gargalo:${paradas}`, aba: 'permissoes', tipo: 'ATENCAO', rotulo: 'Gargalo',
      texto: `${plural(paradas, 'pauta espera', 'pautas esperam')} sua aprovação há mais de 1 dia. O aviso no celular chega com o app (Fase 5); até lá, a Produção mostra a fila.`,
      confianca: 'alta', amostra: paradas, acao: { rotulo: 'Revisar agora', operacao: { tipo: 'ABRIR', href: '/pro-labore/sm/producao' } },
    }))
  }
  if (sm.permissoes.niveis.trafego === 'SEM_ACESSO') {
    r.push(insight({
      chave: 'perm:trafego', aba: 'permissoes', tipo: 'APRENDIZADO', rotulo: 'Leitura',
      texto: 'Liberar a leitura do Tráfego ajuda a separar orgânico de pago nos relatórios (só o que foi impulsionado, sem o financeiro).',
      confianca: 'alta', amostra: null, acao: sm.somenteLeitura ? null : { rotulo: 'Liberar', operacao: { tipo: 'REGRA', niveis: { trafego: 'LEITURA' } } },
    }))
  }
  return r
}

// ---------- Montagem ----------

/** Insights da aba, sem os já feitos (e não desfeitos) nos últimos 7 dias, em ordem de prioridade. */
export async function insightsDaAba(sm: ContextoSM, aba: Aba, agora = new Date(), info: InfoAba = {}): Promise<Insight[]> {
  const gerados = aba === 'calendario' ? await insightsCalendario(sm, agora, info)
    : aba === 'producao' ? await insightsProducao(sm, agora, info)
      : aba === 'atendimento' ? await insightsAtendimento(sm, agora, info)
        : aba === 'desempenho' ? await insightsDesempenho(sm, agora, info)
          : aba === 'atribuicao' ? await insightsAtribuicao(sm, info)
            : await insightsPermissoes(sm, agora, info)
  const feitos = new Set((await prisma.smInsightAcao.findMany({
    where: { usuarioId: sm.usuarioId, desfeitoEm: null, executadoEm: { gte: new Date(agora.getTime() - 7 * DIA_MS) }, chave: { in: gerados.map(g => g.chave) } },
    select: { chave: true },
  })).map(f => f.chave))
  return gerados
    .filter(g => !feitos.has(g.chave) && Date.parse(g.validade) > agora.getTime())
    .sort((a, b) => b.prioridade - a.prioridade)
}

// ---------- Execução e desfazer ----------

// Unidade da amostra de cada regra (seção 13.2: "Hipótese · confiança baixa (N posts)").
const UNIDADES: Array<[string, string, string]> = [
  ['cal:rajada', 'post no dia', 'posts no dia'], ['cal:buraco', 'dia vazio', 'dias vazios'], ['cal:mix', 'post no mês', 'posts no mês'],
  ['cal:retomada', 'dia sem post', 'dias sem post'], ['cal:pico', 'post', 'posts'], ['prod:atrasada', 'pauta atrasada', 'pautas atrasadas'],
  ['prod:aprovacao', 'pauta', 'pautas'], ['prod:gancho', 'reel medido', 'reels medidos'], ['prod:estoque', 'moto', 'motos'],
  ['atd:resposta', 'conversa', 'conversas'], ['atd:lead', 'conversa', 'conversas'], ['atd:tema', 'conversa', 'conversas'],
  ['des:pulo', 'reel', 'reels'], ['des:envios', 'post', 'posts'], ['des:rec', 'post', 'posts'], ['des:dados', 'dia', 'dias'], ['des:lacunas', 'dia', 'dias'],
  ['atr:repetir', 'lead com post', 'leads com post'], ['atr:negociacao', 'lead', 'leads'], ['atr:amostra', 'post', 'posts'], ['perm:gargalo', 'pauta', 'pautas'],
]
export function textoAmostra(chave: string, n: number | null): string | null {
  if (n == null) return null
  const u = UNIDADES.find(([prefixo]) => chave.startsWith(prefixo))
  return u ? `${n} ${n === 1 ? u[1] : u[2]}` : `amostra de ${n}`
}

export class ErroAcao extends Error { constructor(msg: string, public status = 409) { super(msg) } }

async function criarPautas(sm: ContextoSM, pautas: PautaNova[]) {
  const criadoPor = sm.visao === 'GESTOR' ? 'GESTOR' : 'SOCIAL_MEDIA'
  const ids: string[] = []
  for (const p of pautas) {
    const motoId = p.motoId && (await prisma.smMotoEstoque.findFirst({ where: { id: p.motoId, usuarioId: sm.usuarioId }, select: { id: true } })) ? p.motoId : null
    const criada = await prisma.smPauta.create({
      data: { usuarioId: sm.usuarioId, titulo: p.titulo, pilar: p.pilar, formato: p.formato, origem: p.origem, origemRef: p.origemRef ?? null, motoId, gancho: p.gancho ?? null, agendadoPara: p.agendadoPara ? new Date(p.agendadoPara) : null, prazo: p.prazo ? new Date(p.prazo) : null, criadoPor },
      include: { moto: { select: { modelo: true } } },
    })
    if (criada.agendadoPara) await prisma.smPauta.update({ where: { id: criada.id }, data: { codigo: await gerarCodigo(sm.usuarioId, { ...criada, agendadoPara: criada.agendadoPara }) } })
    ids.push(criada.id)
  }
  return ids
}

/** Executa a operação do insight; devolve a mensagem e como desfazer. */
export async function executar(sm: ContextoSM, op: Operacao): Promise<{ mensagem: string; desfazer: Prisma.InputJsonValue | null; href?: string }> {
  if (op.tipo === 'ABRIR') return { mensagem: 'Abrindo…', desfazer: null, href: op.href }
  if (sm.somenteLeitura) throw new ErroAcao('Modo "ver como" é só leitura', 403)
  const usuarioId = sm.usuarioId
  const exigir = (m: ModuloSM) => { if (!podeAgir(sm, m)) throw new ErroAcao('Seu acesso a este módulo é só leitura', 403) }
  switch (op.tipo) {
    case 'MOVER_PAUTA': {
      exigir('producao')
      const p = await prisma.smPauta.findFirst({ where: { id: op.pautaId, usuarioId }, include: { moto: { select: { modelo: true } } } })
      if (!p || p.status === 'PUBLICADO' || p.publicacaoStatus === 'PROCESSANDO') throw new ErroAcao('A pauta não pode mais ser movida')
      const antes = { agendadoPara: p.agendadoPara?.toISOString() ?? null, status: p.status, aprovacao: p.aprovacao, aprovadaEm: p.aprovadaEm?.toISOString() ?? null, enviadaAprovacaoEm: p.enviadaAprovacaoEm?.toISOString() ?? null, publicacaoStatus: p.publicacaoStatus, codigo: p.codigo }
      // Mesma regra da edição: o Social Media mudar a data de uma pauta aprovada volta para aprovação.
      const voltaAprovacao = sm.visao !== 'GESTOR' && sm.permissoes.regras.aprovacaoGestor && (p.status === 'AGENDADO' || (p.status === 'APROVACAO' && p.aprovacao === 'APROVADA'))
      const para = new Date(op.para)
      const atual = await prisma.smPauta.update({
        where: { id: p.id },
        data: { agendadoPara: para, ...(voltaAprovacao && { status: 'APROVACAO', aprovacao: 'PENDENTE', aprovadaEm: null, enviadaAprovacaoEm: new Date(), publicacaoStatus: null }) },
        include: { moto: { select: { modelo: true } } },
      })
      await prisma.smPauta.update({ where: { id: p.id }, data: { codigo: await gerarCodigo(usuarioId, { ...atual, agendadoPara: para }) } })
      if (voltaAprovacao) await notificar(usuarioId, 'GESTOR', 'APROVACAO', `aprovacao:${p.id}`, `Pauta alterada depois de aprovada: ${p.titulo}`, 'A data mudou depois da sua aprovação. Confira de novo antes de ir ao ar.', { pautaId: p.id })
      return { mensagem: `“${p.titulo}” movida para ${ddmm(diaLocal(para))}${voltaAprovacao ? ' e de volta para aprovação' : ''}.`, desfazer: { tipo: 'MOVER_PAUTA', pautaId: p.id, antes } }
    }
    case 'CRIAR_PAUTAS': {
      exigir('producao')
      const ids = await criarPautas(sm, op.pautas)
      return { mensagem: `${plural(ids.length, 'pauta criada', 'pautas criadas')} na Produção.`, desfazer: { tipo: 'APAGAR_PAUTAS', ids } }
    }
    case 'CRIAR_TESTE': {
      exigir('analise')
      const ativos = await prisma.smTeste.count({ where: { usuarioId, status: 'ATIVO' } })
      if (ativos >= 3) throw new ErroAcao('Já há 3 testes em andamento. Conclua ou cancele um antes.')
      const t = await prisma.smTeste.create({ data: { usuarioId, ...op.teste, horaA: op.teste.horaA ?? null, horaB: op.teste.horaB ?? null, descricao: op.teste.descricao ?? null, origem: 'INSIGHT', criadoPor: sm.visao === 'GESTOR' ? 'GESTOR' : 'SOCIAL_MEDIA' } })
      return { mensagem: 'Teste criado. Marque as pautas de cada grupo no briefing.', desfazer: { tipo: 'APAGAR_TESTE', id: t.id } }
    }
    case 'APLICAR_GANCHO': {
      exigir('producao')
      const p = await prisma.smPauta.findFirst({ where: { id: op.pautaId, usuarioId }, select: { id: true, gancho: true, status: true } })
      if (!p || p.status === 'PUBLICADO') throw new ErroAcao('A pauta não pode mais ser editada')
      await prisma.smPauta.update({ where: { id: p.id }, data: { gancho: op.gancho } })
      return { mensagem: 'Gancho aplicado no roteiro.', desfazer: { tipo: 'GANCHO', pautaId: p.id, anterior: p.gancho } }
    }
    case 'NOTIFICAR': {
      const aberta = await prisma.smNotificacao.findFirst({ where: { usuarioId, destinatario: op.destinatario, chave: op.chave, lidaEm: null }, select: { id: true } })
      if (aberta) return { mensagem: op.destinatario === 'GESTOR' ? 'O gestor já tinha sido avisado.' : 'O Social Media já tinha sido avisado.', desfazer: null }
      const n = await prisma.smNotificacao.create({ data: { usuarioId, destinatario: op.destinatario, tipo: 'INSIGHT', chave: op.chave, titulo: op.titulo, texto: op.texto } })
      return { mensagem: op.destinatario === 'GESTOR' ? 'Gestor avisado.' : 'Social Media avisado.', desfazer: { tipo: 'APAGAR_AVISO', id: n.id } }
    }
    case 'CRIAR_RESPOSTA_E_PAUTA': {
      exigir('producao')
      const [pautaId] = await criarPautas(sm, [op.pauta])
      if (sm.visao === 'GESTOR') {
        const ultima = await prisma.smRespostaRapida.findFirst({ where: { usuarioId }, orderBy: { ordem: 'desc' }, select: { ordem: true } })
        const rr = await prisma.smRespostaRapida.create({ data: { usuarioId, titulo: op.titulo, texto: op.texto, ordem: (ultima?.ordem ?? 0) + 1 } })
        return { mensagem: 'Resposta rápida e pauta criadas.', desfazer: { tipo: 'APAGAR_RESPOSTA_E_PAUTA', respostaId: rr.id, pautaId } }
      }
      // O Social Media não edita as respostas rápidas: sugere ao gestor.
      const n = await prisma.smNotificacao.create({ data: { usuarioId, destinatario: 'GESTOR', tipo: 'INSIGHT', chave: `resposta-rapida:${op.titulo}`, titulo: `Sugestão de resposta rápida: ${op.titulo}`, texto: op.texto } })
      return { mensagem: 'Pauta criada e resposta rápida sugerida ao gestor.', desfazer: { tipo: 'APAGAR_RESPOSTA_E_PAUTA', avisoId: n.id, pautaId } }
    }
    case 'REGRA': {
      if (sm.visao !== 'GESTOR') throw new ErroAcao('Só o gestor muda as permissões', 403)
      const atual = await prisma.smPermissao.findUnique({ where: { usuarioId } })
      const niveisAntes = sm.permissoes.niveis
      const regrasAntes = sm.permissoes.regras
      const data: Prisma.SmPermissaoUncheckedCreateInput = {
        usuarioId,
        niveis: { ...niveisAntes, ...(op.niveis ?? {}) } as Prisma.InputJsonValue,
        aprovacaoGestor: op.regras?.aprovacaoGestor ?? regrasAntes.aprovacaoGestor,
        mostrarValores: op.regras?.mostrarValores ?? regrasAntes.mostrarValores,
        relatorioSemanal: op.regras?.relatorioSemanal ?? regrasAntes.relatorioSemanal,
        assistenteIA: op.regras?.assistenteIA ?? regrasAntes.assistenteIA,
      }
      if (atual) await prisma.smPermissao.update({ where: { usuarioId }, data })
      else await prisma.smPermissao.create({ data })
      return { mensagem: 'Permissão atualizada.', desfazer: { tipo: 'REGRA', niveis: niveisAntes, regras: regrasAntes as unknown as Prisma.InputJsonValue, existia: !!atual } as Prisma.InputJsonValue }
    }
  }
}

/** Desfaz uma ação (até 10 minutos depois). */
export async function desfazer(sm: ContextoSM, acaoId: string) {
  const a = await prisma.smInsightAcao.findFirst({ where: { id: acaoId, usuarioId: sm.usuarioId } })
  if (!a) throw new ErroAcao('Ação não encontrada', 404)
  if (a.desfeitoEm) return
  if (Date.now() - a.executadoEm.getTime() > 10 * 60 * 1000) throw new ErroAcao('Passou o tempo para desfazer')
  const d = a.desfazer as Record<string, unknown> | null
  const usuarioId = sm.usuarioId
  if (d) {
    switch (d.tipo) {
      case 'MOVER_PAUTA': {
        const b = d.antes as Record<string, string | null>
        const data = (v: string | null) => (v ? new Date(v) : null)
        await prisma.smPauta.updateMany({ where: { id: String(d.pautaId), usuarioId }, data: { agendadoPara: data(b.agendadoPara), status: b.status!, aprovacao: b.aprovacao, aprovadaEm: data(b.aprovadaEm), enviadaAprovacaoEm: data(b.enviadaAprovacaoEm), publicacaoStatus: b.publicacaoStatus, codigo: b.codigo } })
        break
      }
      case 'APAGAR_PAUTAS': await prisma.smPauta.deleteMany({ where: { id: { in: d.ids as string[] }, usuarioId, status: { not: 'PUBLICADO' } } }); break
      case 'APAGAR_TESTE': {
        const t = await prisma.smTeste.findFirst({ where: { id: String(d.id), usuarioId }, include: { pautas: { select: { id: true } } } })
        if (t && !t.pautas.length) await prisma.smTeste.delete({ where: { id: t.id } })
        else if (t) { await prisma.smPauta.updateMany({ where: { testeId: t.id }, data: { testeId: null, testeGrupo: null } }); await prisma.smTeste.update({ where: { id: t.id }, data: { status: 'CANCELADO' } }) }
        break
      }
      case 'GANCHO': await prisma.smPauta.updateMany({ where: { id: String(d.pautaId), usuarioId }, data: { gancho: (d.anterior as string | null) ?? null } }); break
      case 'APAGAR_AVISO': await prisma.smNotificacao.deleteMany({ where: { id: String(d.id), usuarioId } }); break
      case 'APAGAR_RESPOSTA_E_PAUTA':
        if (d.respostaId) await prisma.smRespostaRapida.deleteMany({ where: { id: String(d.respostaId), usuarioId } })
        if (d.avisoId) await prisma.smNotificacao.deleteMany({ where: { id: String(d.avisoId), usuarioId } })
        await prisma.smPauta.deleteMany({ where: { id: String(d.pautaId), usuarioId, status: { not: 'PUBLICADO' } } })
        break
      case 'REGRA': {
        const n = d.niveis as Record<string, string>, r = d.regras as Record<string, boolean>
        if (!d.existia) await prisma.smPermissao.deleteMany({ where: { usuarioId } })
        else await prisma.smPermissao.update({ where: { usuarioId }, data: { niveis: n, aprovacaoGestor: r.aprovacaoGestor, mostrarValores: r.mostrarValores, relatorioSemanal: r.relatorioSemanal, assistenteIA: r.assistenteIA } })
        break
      }
    }
  }
  await prisma.smInsightAcao.update({ where: { id: a.id }, data: { desfeitoEm: new Date() } })
}
