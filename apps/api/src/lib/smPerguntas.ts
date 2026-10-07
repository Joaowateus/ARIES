// Linha "Pergunte:" do assistente da aba (seção 16.2) e o contexto da IA
// (seção 16.3). Para cada aba:
// - 3 perguntas sugeridas, montadas com os dados reais (a moto parada, o
//   cliente esperando, o mês que caiu...);
// - os fatos da aba, só com o que o papel pode ver e sem dinheiro: é o que
//   a IA recebe;
// - a resposta por template para cada pergunta, usada sem IA (decisão P5)
//   ou quando a IA falha.
import { prisma } from './prisma'
import type { ContextoSM } from './smAcesso'
import { calendarioDoMes, carregarConfig, diaLocal, type DiaCalendario } from './smCalendario'
import { listarEstoque } from './smEstoque'
import { listarGanchos } from './smTestes'
import { melhoresJanelas, type JanelasResultado } from './smJanelas'
import { analisarContaSocialMedia } from './socialMediaResumo'
import { sinaisDoPeriodo, tituloDoPost } from './smDesempenho'
import { periodoDosUltimosDias, vendasPorPost } from './smAtribuicao'
import { inicioDaSemana, tempoRespostaSemana, textoExpediente } from './smAtendimento'
import { pagoPorMidia } from './socialMediaOrigem'
import { proximasDatasComerciais } from './smDatasComerciais'
import { INTENCAO, TEMAS, insightsDaAba, temaDaIntencao, type Aba } from './smInsights'
import { iaLigada } from './smIA'

export interface Pergunta { id: string; texto: string }
export interface Resposta { fatos: Record<string, unknown>; semIA: string | null; acao?: { rotulo: string; href: string }; conversa?: { nome: string; fatos: Record<string, unknown> } }

const DIA_MS = 864e5
const OFF = 3 * 3600e3
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const PILAR_NOME: Record<string, string> = { ESTOQUE: 'Estoque', PROVA: 'Prova social', EDUCACAO: 'Educação', BASTIDORES: 'Bastidores' }
const FORMATO_NOME: Record<string, string> = { REELS: 'Reels', CARROSSEL: 'Carrossel', FOTO: 'Foto', STORY: 'Story' }
const ETAPA_NOME: Record<string, string> = { IDEIA: 'Ideia', ROTEIRO: 'Roteiro', GRAVACAO: 'Gravação', EDICAO: 'Edição', APROVACAO: 'Aprovação', AGENDADO: 'Agendado', PUBLICADO: 'Publicado' }
const CANAL_NOME: Record<string, string> = { DIRECT: 'Direct', COMENTARIO: 'Comentário', COMENTARIO_AUTOMACAO: 'Comentário → Direct', RESPOSTA_STORY: 'Resposta ao story' }

const somarDias = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10)
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const rotuloDia = (d: string) => `${SEMANA[new Date(`${d}T12:00:00Z`).getUTCDay()]} ${ddmm(d)}`
const pct = (v: number) => `${Math.round(v * 100)}%`
const num = (v: number, c = 1) => v.toLocaleString('pt-BR', { maximumFractionDigits: c })
const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`
const lista = (itens: string[]) => itens.map(i => `- ${i}`).join('\n')
const inicioDoDia = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + OFF)
const nomeCliente = (c: { clienteNome: string | null; clienteUsuario: string | null }) => c.clienteNome ?? (c.clienteUsuario ? `@${c.clienteUsuario}` : 'Cliente')
const curto = (t: string, n: number) => { const x = t.replace(/\s+/g, ' ').trim(); return x.length > n ? `${x.slice(0, n - 1)}…` : x }
const nomeMoto = (m: { modelo: string; ano?: number | null; cor?: string | null }) => [m.modelo, m.ano, m.cor].filter(Boolean).join(' ')

/** Ganchos e roteiros pela IA: a regra "Assistente de roteiro com IA" vale para o Social Media; o gestor sempre pode. */
export function podeRoteiroIA(sm: ContextoSM): boolean {
  return iaLigada() && sm.pode('producao', 'LEITURA') && (sm.visao === 'GESTOR' || sm.permissoes.regras.assistenteIA)
}

function proximaSegunda(hoje: string): string {
  const w = new Date(`${hoje}T12:00:00Z`).getUTCDay()
  return somarDias(hoje, ((8 - w) % 7) || 7)
}

function horaSugerida(j: JanelasResultado, dia: string): number {
  const semana = new Date(`${dia}T12:00:00Z`).getUTCDay()
  const w = j.janelas.find(x => x.dia === semana) ?? (j.base === 'SEGUIDORES_ONLINE' ? j.janelas[0] : undefined)
  return w ? w.inicioHora + 1 : 18
}

function textoJanela(w: JanelasResultado['janelas'][number]): string {
  const st = w.status === 'COMPROVADA' ? 'comprovada' : w.status === 'PROMISSORA' ? 'promissora' : 'pelos seguidores online'
  return `${SEMANA[w.dia]} ${w.inicioHora}h–${w.fimHora}h: alcance ${num(w.indice, 1)}x a mediana dos posts, em ${plural(w.posts, 'post', 'posts')} (${st})`
}

// ---------- Perguntas sugeridas (leves: entram no GET do assistente) ----------

async function contaDoDono(usuarioId: string) {
  return prisma.socialMediaConta.findUnique({ where: { titular: `dono:${usuarioId}` }, select: { id: true, seguidoresOnline: true } })
}

/** Alcance médio da conta por dia nos dois últimos meses completos (e posts de cada um). */
async function alcanceDosMeses(contaId: string, hoje: string) {
  const mesAtual = hoje.slice(0, 7)
  const ini = (m: string, n: number) => { const d = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1)); return d.toISOString().slice(0, 10) }
  const meses = [ini(mesAtual, -2), ini(mesAtual, -1)]
  const [snaps, midias] = await Promise.all([
    prisma.socialMediaSnapshotDiario.findMany({ where: { contaId, data: { gte: new Date(`${meses[0]}T00:00:00Z`), lt: new Date(`${ini(mesAtual, 0)}T00:00:00Z`) } }, select: { data: true, alcanceContaDia: true } }),
    prisma.socialMediaMidia.findMany({ where: { contaId, publicadoEm: { gte: inicioDoDia(meses[0]), lt: inicioDoDia(ini(mesAtual, 0)) }, NOT: { formato: { in: ['STORY', 'AD'] } } }, select: { publicadoEm: true, formato: true, alcance: true } }),
  ])
  return meses.map(m => {
    const s = snaps.filter(x => x.data.toISOString().slice(0, 7) === m.slice(0, 7))
    const posts = midias.filter(x => diaLocal(x.publicadoEm).slice(0, 7) === m.slice(0, 7))
    return {
      mes: MESES[Number(m.slice(5, 7)) - 1],
      dias: s.length,
      alcanceDia: s.length ? Math.round(s.reduce((t, x) => t + x.alcanceContaDia, 0) / s.length) : null,
      posts: posts.length,
      reels: posts.filter(p => p.formato === 'REELS').length,
      alcancePost: posts.length ? Math.round(posts.reduce((t, p) => t + (p.alcance ?? 0), 0) / posts.length) : null,
    }
  })
}

/** Dois meses só se comparam com pelo menos 15 dias sincronizados em cada um (seção 13.2). */
const comparaveis = (a: { dias: number; alcanceDia: number | null }, b: { dias: number; alcanceDia: number | null }) => a.dias >= 15 && b.dias >= 15 && !!a.alcanceDia && b.alcanceDia != null

/** Alvo das perguntas de roteiro: a moto parada há mais tempo sem post, ou uma pauta em roteiro. */
async function alvoDoRoteiro(sm: ContextoSM, agora: Date): Promise<{ tipo: 'moto' | 'pauta'; id: string; nome: string } | null> {
  if (sm.pode('estoque', 'LEITURA')) {
    const m = (await listarEstoque(sm.usuarioId, agora)).filter(x => x.situacao !== 'VENDIDA').sort((a, b) => a.posts - b.posts || b.diasEmEstoque - a.diasEmEstoque)[0]
    if (m) return { tipo: 'moto', id: m.id, nome: m.modelo }
  }
  const p = await prisma.smPauta.findFirst({ where: { usuarioId: sm.usuarioId, status: { in: ['IDEIA', 'ROTEIRO'] } }, orderBy: { criadoEm: 'desc' }, select: { id: true, titulo: true, moto: { select: { modelo: true } } } })
  return p ? { tipo: 'pauta', id: p.id, nome: p.moto?.modelo ?? `“${curto(p.titulo, 40)}”` } : null
}

export async function perguntasDaAba(sm: ContextoSM, aba: Aba, agora = new Date()): Promise<Pergunta[]> {
  const hoje = diaLocal(agora)
  switch (aba) {
    case 'calendario':
      return [
        { id: 'cal:semana', texto: `Monte a semana de ${ddmm(proximaSegunda(hoje))}` },
        { id: 'cal:datas', texto: 'Quais datas comerciais vêm aí?' },
        { id: 'cal:mix', texto: 'Equilibre o mix de pilares' },
      ]
    case 'producao': {
      const alvo = podeRoteiroIA(sm) ? await alvoDoRoteiro(sm, agora) : null
      if (alvo) {
        const de = alvo.tipo === 'moto' ? `a ${alvo.nome}` : alvo.nome.startsWith('“') ? alvo.nome : `a ${alvo.nome}`
        return [
          { id: `prod:roteiro:${alvo.tipo}:${alvo.id}`, texto: `Escreva o roteiro d${de}` },
          { id: `prod:ganchos:${alvo.tipo}:${alvo.id}`, texto: `Gere 3 ganchos para ${de}` },
          { id: 'prod:destravar', texto: 'O que destravar primeiro?' },
        ]
      }
      return [
        { id: 'prod:destravar', texto: 'O que destravar primeiro?' },
        { id: 'prod:aprovacao', texto: 'O que está esperando aprovação?' },
        sm.pode('estoque', 'LEITURA') ? { id: 'prod:estoque', texto: 'Qual moto precisa de post?' } : { id: 'prod:semana', texto: 'O que vence esta semana?' },
      ]
    }
    case 'atendimento': {
      const c = await prisma.smConversa.findFirst({ where: { usuarioId: sm.usuarioId, aguardandoDesde: { not: null }, status: { not: 'ARQUIVADA' } }, orderBy: { aguardandoDesde: 'asc' }, select: { id: true, clienteNome: true, clienteUsuario: true } })
      return [
        { id: 'atd:quente', texto: 'Quem está mais perto de comprar?' },
        { id: 'atd:hoje', texto: 'Resuma as conversas de hoje' },
        c ? { id: `atd:sugira:${c.id}`, texto: `Sugira resposta para ${c.clienteUsuario ? `@${c.clienteUsuario}` : nomeCliente(c)}` } : { id: 'atd:temas', texto: 'Quais dúvidas mais aparecem?' },
      ]
    }
    case 'desempenho': {
      const conta = await contaDoDono(sm.usuarioId)
      const meses = conta ? await alcanceDosMeses(conta.id, hoje) : null
      const [a, b] = meses ?? []
      const mudou = a && b && comparaveis(a, b) ? (b.alcanceDia! - a.alcanceDia!) / a.alcanceDia! : null
      return [
        { id: 'des:alcance', texto: b && mudou != null && Math.abs(mudou) >= 0.05 ? `Por que o alcance ${mudou < 0 ? 'caiu' : 'subiu'} em ${b.mes}?` : `Como foi o alcance em ${b?.mes ?? 'o último mês'}?` },
        { id: 'des:origem', texto: 'Compare orgânico e pago' },
        { id: 'des:horario', texto: 'Qual meu melhor horário?' },
      ]
    }
    case 'atribuicao':
      // "Quanto vale um lead orgânico?" (protótipo) fica de fora: a IA não recebe valores (seção 16.3).
      return [
        { id: 'atr:moto', texto: 'Qual moto vende mais pelo Instagram?' },
        { id: 'atr:formato', texto: 'Qual formato traz mais leads?' },
        { id: 'atr:relatorio', texto: 'Monte o relatório do mês' },
      ]
    case 'permissoes': {
      const m = await prisma.smMembro.findUnique({ where: { usuarioId: sm.usuarioId }, select: { nome: true, tratamento: true } })
      const nome = m?.tratamento ?? m?.nome?.split(' ')[0] ?? null
      return [
        { id: 'perm:como', texto: nome ? `Como ${nome} está indo?` : 'Como está o Social Media?' },
        { id: 'perm:produzido', texto: 'O que foi produzido esta semana?' },
        { id: 'perm:metas', texto: 'Ajuste as metas da semana' },
      ]
    }
  }
}

// ---------- Fatos e respostas por template ----------

async function calendario(sm: ContextoSM, agora: Date) {
  const u = sm.usuarioId
  const hoje = diaLocal(agora)
  const fim = somarDias(hoje, 20)
  const [config, janelas] = await Promise.all([carregarConfig(u), melhoresJanelas(u, agora)])
  const meses = [...new Set([hoje.slice(0, 7), fim.slice(0, 7)])]
  const cals = await Promise.all(meses.map(m => calendarioDoMes(u, m, { podeArrastar: false }, agora)))
  const porData = new Map<string, DiaCalendario>()
  for (const c of cals) for (const d of c.semanas.flat()) if (!porData.has(d.data) || d.doMes) porData.set(d.data, d)
  const dias = [...porData.values()].filter(d => d.data >= hoje && d.data <= fim).sort((a, b) => a.data.localeCompare(b.data))
  const mix = cals[0].mix
  const datas = proximasDatasComerciais(hoje, 60)
  const ordemPilares = [...mix.pilares].sort((a, b) => (b.meta - b.percentual) - (a.meta - a.percentual))
  const itemTexto = (i: DiaCalendario['itens'][number]) => `${i.hora} · ${FORMATO_NOME[i.formato]}${i.pilar ? ` · ${PILAR_NOME[i.pilar]}` : ''} · ${i.titulo}${i.status === 'PUBLICADO' ? ' (publicado)' : ''}`

  // Semana que vem: completar a meta de dias com post nos dias livres, nos melhores horários.
  const seg = proximaSegunda(hoje)
  const semana = dias.filter(d => d.data >= seg && d.data <= somarDias(seg, 6))
  const ocupados = semana.filter(d => d.postsFeed > 0)
  const faltam = Math.max(0, config.minDiasSemana - ocupados.length)
  const comJanela = new Set(janelas.janelas.map(j => j.dia))
  const livres = semana.filter(d => d.postsFeed === 0)
    .sort((a, b) => Number(comJanela.has(new Date(`${b.data}T12:00:00Z`).getUTCDay())) - Number(comJanela.has(new Date(`${a.data}T12:00:00Z`).getUTCDay())) || Number(b.util) - Number(a.util) || a.data.localeCompare(b.data))
    .slice(0, faltam).sort((a, b) => a.data.localeCompare(b.data))
  const sugeridos = livres.map((d, i) => {
    const pilar = ordemPilares[i % Math.max(1, ordemPilares.length)]?.pilar ?? 'ESTOQUE'
    return `${rotuloDia(d.data)} às ${horaSugerida(janelas, d.data)}h: ${pilar === 'EDUCACAO' ? 'carrossel' : 'reel'} de ${PILAR_NOME[pilar]}`
  })
  const semanaTexto = semana.length
    ? [
      `Semana de ${ddmm(seg)} a ${ddmm(somarDias(seg, 6))}, com meta de ${plural(config.minDiasSemana, 'dia', 'dias')} com post.`,
      ocupados.length ? `Já planejado:\n${lista(ocupados.map(d => `${rotuloDia(d.data)}: ${d.itens.filter(i => i.contaNaCadencia).map(i => `“${i.titulo}”`).join(', ')}`))}` : 'Nada planejado ainda.',
      sugeridos.length ? `Para fechar a meta, sugiro:\n${lista(sugeridos)}\nOs pilares seguem o que mais falta no mix do mês.` : 'A meta da semana já está coberta.',
    ].join('\n')
    : 'A semana que vem ainda não aparece no calendário.'

  const datasTexto = datas.length
    ? `Nos próximos 60 dias:\n${lista(datas.slice(0, 4).map(d => `${d.nome} (${ddmm(d.data)}, ${d.emDias === 0 ? 'hoje' : `em ${plural(d.emDias, 'dia', 'dias')}`}): ${d.dica}`))}`
    : 'Nenhuma data comercial nos próximos 60 dias.'

  const slots = dias.filter(d => d.slotLivre && d.data > hoje).slice(0, 3).map(d => ddmm(d.data))
  const abaixo = mix.pilares.filter(p => p.meta - p.percentual >= 0.05).sort((a, b) => (b.meta - b.percentual) - (a.meta - a.percentual))
  const mixTexto = mix.total === 0
    ? 'Ainda não há posts com pilar neste mês para medir o mix.'
    : `Mix de ${MESES[Number(hoje.slice(5, 7)) - 1]} (${plural(mix.total, 'post', 'posts')}): ${mix.pilares.map(p => `${PILAR_NOME[p.pilar]} ${pct(p.percentual)} (meta ${pct(p.meta)})`).join(', ')}.`
      + (abaixo.length ? ` Para equilibrar, puxe ${abaixo.map(p => PILAR_NOME[p.pilar]).join(' e ')}${slots.length ? ` nos próximos slots livres (${slots.join(', ')})` : ''}.` : ' Está equilibrado: mantenha a proporção.')

  const fatos = {
    hoje: rotuloDia(hoje),
    regras: [`meta de ${config.minDiasSemana} dias com post por semana`, `no máximo ${config.maxPostsDia} posts por dia`, `no máximo ${config.maxDiasSemPost} dias seguidos sem post`],
    proximosDias: dias.slice(0, 14).map(d => ({ dia: rotuloDia(d.data), posts: d.itens.map(itemTexto) })),
    mixDoMes: mix.pilares.map(p => ({ pilar: PILAR_NOME[p.pilar], noMes: pct(p.percentual), meta: pct(p.meta), posts: p.quantidade })),
    melhoresHorarios: janelas.janelas.slice(0, 3).map(textoJanela),
    datasComerciais: datas.map(d => ({ data: ddmm(d.data), nome: d.nome, emDias: d.emDias, ideia: d.dica })),
  }
  return { fatos, respostas: { 'cal:semana': semanaTexto, 'cal:datas': datasTexto, 'cal:mix': mixTexto } as Record<string, string> }
}

async function producao(sm: ContextoSM, agora: Date, alvoId: string | null) {
  const u = sm.usuarioId
  const hoje = diaLocal(agora)
  const [pautas, { ganchos }, estoque] = await Promise.all([
    prisma.smPauta.findMany({
      where: { usuarioId: u, status: { not: 'PUBLICADO' } }, orderBy: [{ prazo: 'asc' }, { criadoEm: 'desc' }], take: 40,
      select: { id: true, titulo: true, status: true, prazo: true, aprovacao: true, enviadaAprovacaoEm: true, gancho: true, retencao: true, recompensa: true, cta: true, formato: true, pilar: true, moto: { select: { modelo: true, ano: true, cor: true } } },
    }),
    listarGanchos(u),
    sm.pode('estoque', 'LEITURA') ? listarEstoque(u, agora) : Promise.resolve(null),
  ])
  const atrasadas = pautas.filter(p => p.prazo && diaLocal(p.prazo) < hoje && p.status !== 'AGENDADO')
  const paradas = pautas.filter(p => p.status === 'APROVACAO' && p.aprovacao === 'PENDENTE')
  const semGancho = pautas.filter(p => ['ROTEIRO', 'GRAVACAO'].includes(p.status) && p.formato === 'REELS' && !p.gancho?.trim())
  const vencendo = pautas.filter(p => p.prazo && diaLocal(p.prazo) >= hoje && diaLocal(p.prazo) <= somarDias(hoje, 6) && p.status !== 'AGENDADO')
  const espera = (d: Date | null) => d ? Math.floor((agora.getTime() - d.getTime()) / DIA_MS) : 0

  const itens = [
    ...atrasadas.map(p => `“${p.titulo}” passou do prazo (${ddmm(diaLocal(p.prazo!))}).`),
    ...paradas.filter(p => espera(p.enviadaAprovacaoEm) >= 1).map(p => `“${p.titulo}” espera aprovação há ${plural(espera(p.enviadaAprovacaoEm), 'dia', 'dias')}.`),
    ...semGancho.map(p => `“${p.titulo}” está em ${ETAPA_NOME[p.status].toLowerCase()} sem gancho.`),
  ].slice(0, 5)
  const motosParadas = (estoque ?? []).filter(m => m.situacao !== 'VENDIDA' && m.emProducao === 0 && (m.posts === 0 || m.diasEmEstoque >= 20)).sort((a, b) => b.diasEmEstoque - a.diasEmEstoque)

  const respostas: Record<string, string> = {
    'prod:destravar': itens.length ? `Comece por aqui:\n${lista(itens)}` : 'Nada travado agora: nenhuma pauta atrasada, parada em aprovação ou sem gancho.',
    'prod:aprovacao': paradas.length ? `${plural(paradas.length, 'pauta espera', 'pautas esperam')} o gestor:\n${lista(paradas.map(p => `“${p.titulo}”${p.enviadaAprovacaoEm ? `, enviada em ${ddmm(diaLocal(p.enviadaAprovacaoEm))}` : ''}`))}` : 'Nenhuma pauta esperando aprovação.',
    'prod:estoque': motosParadas.length ? `Motos que precisam de post:\n${lista(motosParadas.slice(0, 3).map(m => `${nomeMoto(m)}: ${plural(m.diasEmEstoque, 'dia', 'dias')} na loja, ${m.posts ? plural(m.posts, 'post', 'posts') : 'nenhum post'}`))}\nO assistente da Produção gera a pauta com um clique.` : 'Todas as motos da loja já têm post recente ou estão em produção.',
    'prod:semana': vencendo.length ? `Vencem nos próximos 7 dias:\n${lista(vencendo.map(p => `“${p.titulo}” (${ETAPA_NOME[p.status].toLowerCase()}), prazo ${ddmm(diaLocal(p.prazo!))}`))}` : 'Nenhuma pauta vence nos próximos 7 dias.',
  }

  // Ficha do alvo das perguntas de roteiro e ganchos (sem preço: o estoque leve não tem).
  let ficha: Record<string, unknown> | null = null
  if (alvoId) {
    const [, , tipo, id] = alvoId.split(':')
    if (tipo === 'moto' && estoque) {
      const m = estoque.find(x => x.id === id)
      if (m) ficha = { moto: nomeMoto(m), marca: m.marca, diasNaLoja: m.diasEmEstoque, postsFeitos: m.posts, observacao: m.observacao }
    } else if (tipo === 'pauta') {
      const p = pautas.find(x => x.id === id)
      if (p) ficha = { pauta: p.titulo, formato: FORMATO_NOME[p.formato], pilar: PILAR_NOME[p.pilar], moto: p.moto ? nomeMoto(p.moto) : null, ganchoAtual: p.gancho, retencao: p.retencao, recompensa: p.recompensa, cta: p.cta }
    }
  }
  const gancho = ganchos.find(g => g.puloMedio != null)
  const semRoteiro = gancho ? `Não consegui escrever agora. Enquanto isso, o gancho com menor pulo da biblioteca é “${gancho.texto}”.` : 'Não consegui escrever agora. Tente de novo em instantes.'
  if (alvoId?.startsWith('prod:roteiro') || alvoId?.startsWith('prod:ganchos')) respostas[alvoId] = semRoteiro

  const fatos = {
    hoje: rotuloDia(hoje),
    pautasAbertas: pautas.slice(0, 25).map(p => ({
      pauta: p.titulo, etapa: ETAPA_NOME[p.status], formato: FORMATO_NOME[p.formato], pilar: PILAR_NOME[p.pilar],
      prazo: p.prazo ? ddmm(diaLocal(p.prazo)) : null, atrasada: atrasadas.includes(p), esperandoAprovacao: paradas.includes(p),
      moto: p.moto ? nomeMoto(p.moto) : null, temGancho: !!p.gancho?.trim(),
    })),
    ganchosDaBiblioteca: ganchos.filter(g => g.puloMedio != null).slice(0, 5).map(g => ({ gancho: g.texto, puloMedio: pct(g.puloMedio!), reels: g.comPulo })),
    ...(estoque ? { estoque: estoque.filter(m => m.situacao !== 'VENDIDA').slice(0, 15).map(m => ({ moto: nomeMoto(m), diasNaLoja: m.diasEmEstoque, posts: m.posts, emProducao: m.emProducao })) } : {}),
    ...(ficha ? { pedidoSobre: ficha } : {}),
  }
  return { fatos, respostas }
}

/** Conversa pronta para a resposta sugerida (Atendimento): só mensagens, post e moto. */
export async function fatosDaConversa(usuarioId: string, conversaId: string) {
  const c = await prisma.smConversa.findFirst({ where: { id: conversaId, usuarioId }, include: { mensagens: { orderBy: { enviadaEm: 'desc' }, take: 10 } } })
  if (!c) return null
  const [config, rapidas] = await Promise.all([carregarConfig(usuarioId), prisma.smRespostaRapida.findMany({ where: { usuarioId }, orderBy: { ordem: 'asc' }, take: 8, select: { texto: true } })])
  const primeiro = c.clienteNome?.split(' ')[0] ?? null
  const ultima = c.mensagens.find(m => m.direcao === 'IN')?.texto ?? ''
  return {
    conversa: c,
    nome: nomeCliente(c),
    fatos: {
      canal: CANAL_NOME[c.canal] ?? c.canal,
      cliente: primeiro ?? (c.clienteUsuario ? `@${c.clienteUsuario}` : 'cliente'),
      motoDeInteresse: c.motoInteresse,
      postDeOrigem: c.postTitulo,
      horarioDaLoja: textoExpediente(config),
      mensagens: [...c.mensagens].reverse().map(m => ({ de: m.direcao === 'IN' ? 'cliente' : 'loja', texto: curto(m.texto, 500) })),
      jeitoDaLojaResponder: rapidas.map(r => r.texto),
    },
    semIA: respostaPadrao(primeiro, ultima, c.motoInteresse),
  }
}

/** Resposta por template: o tema da pergunta (troca, financiamento, preço...) ou um convite para seguir a conversa. */
export function respostaPadrao(nome: string | null, texto: string, moto: string | null): string {
  const oi = nome ? `Oi, ${nome}! ` : 'Oi! '
  const t = TEMAS.find(x => x.re.test(texto))
  if (t) return `${oi}${t.resposta}`
  return `${oi}Obrigado pela mensagem${moto ? ` sobre a ${moto}` : ''}. Me conta o que você quer saber, ou me passa seu WhatsApp que o consultor fala com você.`
}

async function atendimento(sm: ContextoSM, agora: Date, perguntaId: string | null) {
  const u = sm.usuarioId
  const hoje = diaLocal(agora)
  const semana = new Date(agora.getTime() - 7 * DIA_MS)
  const desdeHoje = inicioDoDia(hoje)
  const [config, esperando, abertas, msgsHoje, recebidasSemana, tempo, leadsHoje] = await Promise.all([
    carregarConfig(u),
    prisma.smConversa.findMany({ where: { usuarioId: u, aguardandoDesde: { not: null }, status: { not: 'ARQUIVADA' } }, orderBy: { aguardandoDesde: 'asc' }, take: 15, select: { id: true, clienteNome: true, clienteUsuario: true, canal: true, motoInteresse: true, aguardandoDesde: true, mensagens: { where: { direcao: 'IN' }, orderBy: { enviadaEm: 'desc' }, take: 1, select: { texto: true } } } }),
    prisma.smConversa.findMany({ where: { usuarioId: u, leadId: null, status: { not: 'ARQUIVADA' }, ultimaEntradaEm: { gte: semana } }, select: { id: true, clienteNome: true, clienteUsuario: true, motoInteresse: true, mensagens: { where: { direcao: 'IN', enviadaEm: { gte: semana } }, orderBy: { enviadaEm: 'desc' }, select: { texto: true } } } }),
    prisma.smMensagem.findMany({ where: { enviadaEm: { gte: desdeHoje }, conversa: { usuarioId: u } }, select: { direcao: true, autor: true, conversaId: true } }),
    prisma.smMensagem.findMany({ where: { direcao: 'IN', enviadaEm: { gte: semana }, conversa: { usuarioId: u } }, select: { texto: true, conversaId: true } }),
    tempoRespostaSemana(u, agora),
    sm.pode('crm', 'LEITURA') ? prisma.lead.count({ where: { usuarioId: u, tipoLead: 'ORGANICO', criadoEm: { gte: desdeHoje } } }) : Promise.resolve(null),
  ])
  const espera = (d: Date) => { const min = Math.round((agora.getTime() - d.getTime()) / 60000); return min < 60 ? `${min} min` : min < 2880 ? `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}` : `${Math.floor(min / 1440)} dias` }
  const quentes = abertas.map(c => ({ c, m: c.mensagens.map(x => x.texto).find(t => INTENCAO.test(t)) })).filter((x): x is typeof x & { m: string } => !!x.m)
  const temas = TEMAS.map(t => ({ tema: t.tema, conversas: new Set(recebidasSemana.filter(m => t.re.test(m.texto)).map(m => m.conversaId)).size })).filter(x => x.conversas > 0).sort((a, b) => b.conversas - a.conversas)
  const conversasHoje = new Set(msgsHoje.map(m => m.conversaId)).size
  const recebidas = msgsHoje.filter(m => m.direcao === 'IN').length
  const respondidas = msgsHoje.filter(m => m.direcao === 'OUT' && m.autor !== 'AUTOMACAO').length

  const respostas: Record<string, string> = {
    'atd:quente': quentes.length
      ? `Quem já falou de compra nos últimos 7 dias:\n${lista(quentes.slice(0, 4).map(({ c, m }) => `${nomeCliente(c)}${c.motoInteresse ? ` (${c.motoInteresse})` : ''}: falou de ${temaDaIntencao(m)}, “${curto(m, 80)}”`))}\nSão as primeiras para virar lead.`
      : 'Ninguém falou de preço, simulação, financiamento ou visita nos últimos 7 dias.',
    'atd:hoje': conversasHoje
      ? `Hoje: ${plural(conversasHoje, 'conversa', 'conversas')} com mensagem, ${plural(recebidas, 'mensagem recebida', 'mensagens recebidas')} e ${plural(respondidas, 'resposta enviada', 'respostas enviadas')}.`
        + (esperando.length ? ` ${plural(esperando.length, 'conversa espera', 'conversas esperam')} resposta; a mais antiga é de ${nomeCliente(esperando[0])}, há ${espera(esperando[0].aguardandoDesde!)}.` : ' Ninguém esperando resposta.')
        + (leadsHoje ? ` ${plural(leadsHoje, 'lead orgânico entrou', 'leads orgânicos entraram')} no CRM.` : '')
      : 'Nenhuma mensagem hoje até agora.',
    'atd:temas': temas.length ? `Dúvidas da semana:\n${lista(temas.slice(0, 4).map(t => `${t.tema}: ${plural(t.conversas, 'conversa', 'conversas')}`))}` : 'Nenhuma dúvida repetida nos últimos 7 dias.',
  }

  let conversa: Awaited<ReturnType<typeof fatosDaConversa>> = null
  if (perguntaId?.startsWith('atd:sugira:')) {
    conversa = await fatosDaConversa(u, perguntaId.slice('atd:sugira:'.length))
    if (conversa) respostas[perguntaId] = `Sugestão para ${conversa.nome}:\n“${conversa.semIA}”\nAbra a conversa para revisar e enviar.`
  }

  const fatos = {
    agora: `${rotuloDia(hoje)}, ${new Date(agora.getTime() - OFF).toISOString().slice(11, 16)}`,
    metaDeResposta: `${config.metaRespostaMin} min`,
    tempoDeRespostaNaSemana: tempo != null ? `${tempo} min (mediana)` : 'sem respostas medidas na semana',
    esperandoResposta: esperando.map(c => ({ cliente: nomeCliente(c), canal: CANAL_NOME[c.canal] ?? c.canal, moto: c.motoInteresse, esperandoHa: espera(c.aguardandoDesde!), ultimaMensagem: c.mensagens[0] ? curto(c.mensagens[0].texto, 160) : null })),
    hoje: { conversasComMensagem: conversasHoje, mensagensRecebidas: recebidas, respostasEnviadas: respondidas, ...(leadsHoje != null ? { leadsOrganicos: leadsHoje } : {}) },
    falaramDeCompra: quentes.slice(0, 8).map(({ c, m }) => ({ cliente: nomeCliente(c), moto: c.motoInteresse, assunto: temaDaIntencao(m), mensagem: curto(m, 160) })),
    duvidasDaSemana: temas.map(t => ({ tema: t.tema, conversas: t.conversas })),
    ...(conversa ? { conversaPedida: conversa.fatos } : {}),
  }
  return { fatos, respostas, conversa }
}

async function desempenho(sm: ContextoSM, agora: Date) {
  const u = sm.usuarioId
  const hoje = diaLocal(agora)
  const conta = await prisma.socialMediaConta.findUnique({ where: { titular: `dono:${u}` } })
  if (!conta) {
    const t = 'A conta do Instagram ainda não está conectada: os números aparecem depois da primeira sincronização.'
    return { fatos: { conta: 'não conectada' }, respostas: { 'des:alcance': t, 'des:origem': t, 'des:horario': t } as Record<string, string> }
  }
  const verPago = sm.pode('trafego', 'LEITURA')
  const [analise, config, meses, janelas, pagos] = await Promise.all([
    analisarContaSocialMedia({ usuarioId: u, conta, vendedorTitular: null, inicio: null, fim: hoje, origem: 'ORGANICO' }),
    carregarConfig(u),
    alcanceDosMeses(conta.id, hoje),
    melhoresJanelas(u, agora),
    verPago ? pagoPorMidia(u) : Promise.resolve(null),
  ])
  const sinais = sinaisDoPeriodo(analise, config)
  const posts = analise.publicacoes
  const reels = posts.filter(p => p.formato === 'REELS')
  const linhaPost = (p: (typeof posts)[number]) => ({
    post: tituloDoPost(p), formato: FORMATO_NOME[p.formato] ?? p.formato, dia: ddmm(p.dia), hora: `${p.hora}h`, alcance: p.alcance,
    ...(p.taxaPulo != null ? { puloNos3s: pct(p.taxaPulo) } : {}), ...(p.retencao != null ? { retencao: pct(p.retencao) } : {}),
    envios: p.compartilhamentos, salvos: p.salvamentos,
  })
  const [a, b] = meses
  const variacao = comparaveis(a, b) ? Math.round(((b.alcanceDia! - a.alcanceDia!) / a.alcanceDia!) * 100) : null

  let alcanceTexto: string
  if (variacao == null || a.alcanceDia == null || b.alcanceDia == null) {
    alcanceTexto = b.alcanceDia != null
      ? `Alcance médio da conta em ${b.mes}: ${num(b.alcanceDia, 0)} pessoas por dia, com ${plural(b.posts, 'post', 'posts')} no feed.${b.dias < 15 ? ` Só ${plural(b.dias, 'dia sincronizado', 'dias sincronizados')}: ainda é cedo para conclusões.` : ` ${a.mes.charAt(0).toUpperCase()}${a.mes.slice(1)} tem ${a.dias ? `só ${plural(a.dias, 'dia sincronizado', 'dias sincronizados')}` : 'nenhum dia sincronizado'}, então não dá para comparar os dois meses.`}`
      : `Ainda não há dados de alcance de ${b.mes}.`
  } else {
    const caiu = variacao < 0
    const menos = b.posts < a.posts || b.reels < a.reels
    alcanceTexto = `Alcance médio da conta por dia em ${b.mes}: ${num(b.alcanceDia, 0)} (${a.mes}: ${num(a.alcanceDia, 0)}), ${caiu ? 'queda' : 'alta'} de ${Math.abs(variacao)}%.`
      + ` O que mudou junto: ${plural(b.posts, 'post', 'posts')} no feed (${a.mes}: ${a.posts}), ${plural(b.reels, 'reel', 'reels')} (${a.mes}: ${a.reels})`
      + (a.alcancePost != null && b.alcancePost != null ? ` e alcance médio por post de ${num(b.alcancePost, 0)} (${a.mes}: ${num(a.alcancePost, 0)})` : '') + '.'
      + (caiu ? (menos ? ' Menos posts e reels deixam a conta aparecer menos para quem não segue: é o primeiro ponto a recuperar.' : ' O volume de posts não caiu: vale olhar o gancho dos reels (pulo nos 3 primeiros segundos).') : (menos ? ' Com menos posts, cada um rendeu mais: vale entender quais puxaram.' : ' Mais posts e reels ajudaram a conta a aparecer mais.'))
  }

  let origemTexto: string
  let pago: Record<string, unknown> | null = null
  if (!pagos) origemTexto = 'A leitura do Tráfego não está liberada no seu acesso. O gestor pode liberar em Acessos para comparar orgânico e pago.'
  else {
    const imp = posts.filter(p => pagos.has(p.instagramMediaId))
    const naoImp = posts.filter(p => !pagos.has(p.instagramMediaId))
    const organico = posts.reduce((s, p) => s + p.alcance, 0)
    const pagoAlcance = imp.reduce((s, p) => s + (pagos.get(p.instagramMediaId)?.alcance ?? 0), 0)
    const media = (l: typeof posts) => l.length ? Math.round(l.reduce((s, p) => s + p.alcance, 0) / l.length) : null
    pago = { postsNoPeriodo: posts.length, impulsionados: imp.length, alcanceOrganicoDosPosts: organico, alcancePagoEstimado: pagoAlcance, organicoMedioImpulsionados: media(imp), organicoMedioDemais: media(naoImp) }
    origemTexto = !imp.length
      ? `Nos últimos 30 dias nenhum post foi impulsionado: o alcance dos ${plural(posts.length, 'post', 'posts')} (${num(organico, 0)} somados) foi todo orgânico.`
      : `Últimos 30 dias: ${imp.length} de ${plural(posts.length, 'post foi impulsionado', 'posts foram impulsionados')}. Alcance orgânico somado dos posts: ${num(organico, 0)}; alcance pago estimado dos impulsionados: ${num(pagoAlcance, 0)} (soma diária dos anúncios, a mesma pessoa pode contar mais de uma vez).`
        + (media(imp) != null && media(naoImp) != null ? ` O alcance orgânico médio foi ${num(media(imp)!, 0)} nos impulsionados e ${num(media(naoImp)!, 0)} nos demais.` : '')
  }

  const online = conta.seguidoresOnline as Record<string, number> | null
  const valores = online && typeof online === 'object' ? Array.from({ length: 24 }, (_, h) => Number(online[String(h)]) || 0) : []
  const pico = valores.length && Math.max(...valores) > 0 ? valores.indexOf(Math.max(...valores)) : null
  const horarioTexto = janelas.base === 'POSTS' && janelas.janelas.length
    ? `Pelos seus posts:\n${lista(janelas.janelas.slice(0, 3).map(textoJanela))}${pico != null ? `\nO pico de seguidores online é às ${pico}h.` : ''}`
    : pico != null ? `Ainda há poucos posts para medir por horário. Pelos seguidores online, o pico é às ${pico}h: vale publicar perto disso e comparar.` : 'Ainda não há dados de horário: publique em horários diferentes por algumas semanas para o sistema comparar.'

  const fatos = {
    periodo: 'últimos 30 dias',
    qualidadeDosDados: `${analise.qualidade.diasSincronizados} de ${analise.qualidade.diasPeriodo} dias sincronizados`,
    sinais: sinais.map(s => ({ sinal: s.rotulo, atual: s.valor != null ? `${num(s.valor, 2)} ${s.unidade}` : 'sem dados', meta: s.metaTexto, situacao: s.status === 'ok' ? 'na meta' : s.status === 'atencao' ? 'abaixo da meta' : s.status === 'sem_dados' ? 'sem dados' : 'informativo', amostra: s.amostra })),
    postsNoPeriodo: posts.length, reelsNoPeriodo: reels.length,
    maiorAlcance: [...posts].sort((x, y) => y.alcance - x.alcance).slice(0, 3).map(linhaPost),
    maiorPuloNosReels: [...reels].filter(p => p.taxaPulo != null).sort((x, y) => y.taxaPulo! - x.taxaPulo!).slice(0, 3).map(linhaPost),
    menorPuloNosReels: [...reels].filter(p => p.taxaPulo != null).sort((x, y) => x.taxaPulo! - y.taxaPulo!).slice(0, 3).map(linhaPost),
    alcancePorMes: meses.map(m => ({ mes: m.mes, alcanceMedioDaContaPorDia: m.alcanceDia, diasComDados: m.dias, posts: m.posts, reels: m.reels, alcanceMedioPorPost: m.alcancePost })),
    ...(variacao != null ? { variacaoDoAlcance: `${variacao > 0 ? '+' : ''}${variacao}% de ${a.mes} para ${b.mes}` } : {}),
    melhoresHorarios: janelas.janelas.slice(0, 3).map(textoJanela),
    ...(pico != null ? { picoDeSeguidoresOnline: `${pico}h` } : {}),
    ...(pago ? { organicoEPago: pago } : {}),
  }
  return { fatos, respostas: { 'des:alcance': alcanceTexto, 'des:origem': origemTexto, 'des:horario': horarioTexto } as Record<string, string> }
}

async function atribuicao(sm: ContextoSM) {
  // Sempre sem valores em R$: a IA não recebe financeiro, nem quando o gestor mostra valores na tela.
  const v = await vendasPorPost(sm.usuarioId, periodoDosUltimosDias(30), { mostrarValores: false })
  const reais = v.porPost.filter(l => !['OUTROS', 'BIO', 'PERFIL', 'SEM_CODIGO'].includes(l.chave))
  const porMoto = new Map<string, { leads: number; vendas: number; posts: number }>()
  for (const l of reais) if (l.moto) { const x = porMoto.get(l.moto) ?? { leads: 0, vendas: 0, posts: 0 }; x.leads += l.leads; x.vendas += l.vendas; x.posts++; porMoto.set(l.moto, x) }
  const motos = [...porMoto.entries()].sort((a, b) => b[1].vendas - a[1].vendas || b[1].leads - a[1].leads)
  const canal = [...v.porCanal].sort((a, b) => b.leads - a.leads)[0]
  const formato = v.leadsPorFormato[0]
  const topo = reais.find(l => l.leads > 0)

  const respostas: Record<string, string> = {
    'atr:moto': motos.length
      ? `Nos últimos 30 dias:\n${lista(motos.slice(0, 3).map(([m, x]) => `${m}: ${plural(x.vendas, 'venda', 'vendas')} e ${plural(x.leads, 'lead', 'leads')} (${plural(x.posts, 'post', 'posts')})`))}`
      : 'Nos últimos 30 dias, nenhum post com lead ou venda está ligado a uma moto do estoque. Ligue a moto na pauta (Produção) para ver isso aqui.',
    'atr:formato': !v.leadsPorFormato.length ? 'Ainda não há posts publicados no período para comparar formatos.'
      : !v.leadsPorFormato.some(f => f.leads) ? `Nenhum post dos últimos 30 dias tem lead identificado ainda (${v.leadsPorFormato.map(f => `${f.rotulo.toLowerCase()}: ${plural(f.posts, 'post', 'posts')}`).join(', ')}). Os leads aparecem por formato quando chegam com o código do post.`
      : `Leads por formato nos últimos 30 dias:\n${lista(v.leadsPorFormato.map(f => `${f.rotulo}: ${plural(f.leads, 'lead', 'leads')} em ${plural(f.posts, 'post', 'posts')} (${num(f.leadsPorPost, 1)} por post)${f.amostraPequena ? ', amostra pequena' : ''}`))}`,
    'atr:relatorio': [
      `Relatório dos últimos 30 dias (${v.periodo.rotulo}):`,
      lista([
        `${plural(v.kpis.leads, 'lead orgânico', 'leads orgânicos')} e ${plural(v.kpis.vendas, 'venda', 'vendas')}${v.kpis.conversao != null ? ` (conversão de ${num(v.kpis.conversao, 1)}%)` : ''}.`,
        topo ? `Post que mais trouxe leads: “${topo.nome}” (${plural(topo.leads, 'lead', 'leads')}).` : 'Nenhum post com lead identificado.',
        canal && canal.leads ? `Canal principal: ${canal.nome} (${plural(canal.leads, 'lead', 'leads')}).` : 'Sem leads por canal no período.',
        formato?.leads ? `Formato com mais leads: ${formato.rotulo} (${plural(formato.leads, 'lead', 'leads')} em ${plural(formato.posts, 'post', 'posts')}).` : 'Nenhum formato com lead identificado no período.',
        `${plural(v.ciclo.emNegociacao, 'lead segue', 'leads seguem')} em negociação no CRM.`,
      ]),
    ].join('\n'),
  }
  const fatos = {
    periodo: `últimos 30 dias (${v.periodo.rotulo})`,
    leadsOrganicos: v.kpis.leads, vendas: v.kpis.vendas,
    ...(v.kpis.conversao != null ? { conversaoDeLeadEmVenda: `${num(v.kpis.conversao, 1)}%` } : {}),
    posts: v.porPost.map(l => ({ post: l.nome, detalhe: l.sub, moto: l.moto ?? null, toques: l.toques, conversas: l.conversas, leads: l.leads, vendas: l.vendas })),
    canais: v.porCanal.map(l => ({ canal: l.nome, leads: l.leads, vendas: l.vendas })),
    formatos: v.leadsPorFormato.map(f => ({ formato: f.rotulo, posts: f.posts, leads: f.leads, leadsPorPost: num(f.leadsPorPost, 1), amostraPequena: f.amostraPequena })),
    ...(v.concentracao ? { concentracao: `${v.concentracao.titulo}. ${v.concentracao.detalhe}` } : {}),
    ...(v.ciclo.medianaDias != null ? { diasMedianosDoLeadAteAVenda: v.ciclo.medianaDias } : {}),
    leadsEmNegociacao: v.ciclo.emNegociacao,
  }
  return { fatos, respostas }
}

async function permissoes(sm: ContextoSM, agora: Date) {
  const u = sm.usuarioId
  const ini = inicioDaSemana(agora)
  const [membro, config, publicadas, criadas, abertas, tempo, leads, conta] = await Promise.all([
    prisma.smMembro.findUnique({ where: { usuarioId: u }, select: { nome: true, tratamento: true, ativo: true, ativadoEm: true } }),
    carregarConfig(u),
    prisma.smPauta.findMany({ where: { usuarioId: u, status: 'PUBLICADO', publicadaEm: { gte: ini } }, select: { titulo: true, formato: true, publicadaEm: true }, orderBy: { publicadaEm: 'asc' } }),
    prisma.smPauta.count({ where: { usuarioId: u, criadoEm: { gte: ini } } }),
    prisma.smPauta.findMany({ where: { usuarioId: u, status: { not: 'PUBLICADO' } }, select: { status: true, aprovacao: true } }),
    tempoRespostaSemana(u, agora),
    prisma.lead.findMany({ where: { usuarioId: u, tipoLead: 'ORGANICO', criadoEm: { gte: new Date(ini.getTime() - 28 * DIA_MS) } }, select: { criadoEm: true } }),
    prisma.socialMediaConta.findUnique({ where: { titular: `dono:${u}` }, select: { id: true } }),
  ])
  const feed = conta ? await prisma.socialMediaMidia.findMany({ where: { contaId: conta.id, publicadoEm: { gte: new Date(ini.getTime() - 28 * DIA_MS) }, NOT: { formato: { in: ['STORY', 'AD'] } } }, select: { publicadoEm: true } }) : []
  const nome = membro?.tratamento ?? membro?.nome?.split(' ')[0] ?? 'o Social Media'
  const naSemana = (d: Date, k: number) => d.getTime() >= ini.getTime() - k * 7 * DIA_MS && d.getTime() < ini.getTime() - (k - 1) * 7 * DIA_MS
  const diasComPost = (k: number) => new Set(feed.filter(m => naSemana(m.publicadoEm, k)).map(m => diaLocal(m.publicadoEm))).size
  const leadsDa = (k: number) => leads.filter(l => naSemana(l.criadoEm, k)).length
  const diasAgora = diasComPost(0), leadsAgora = leadsDa(0)
  const mediaDias = Math.round(([1, 2, 3, 4].reduce((s, k) => s + diasComPost(k), 0) / 4) * 10) / 10
  const mediaLeads = Math.round(([1, 2, 3, 4].reduce((s, k) => s + leadsDa(k), 0) / 4) * 10) / 10
  const pendentes = abertas.filter(p => p.status === 'APROVACAO' && p.aprovacao === 'PENDENTE').length
  const porEtapa = Object.entries(abertas.reduce<Record<string, number>>((m, p) => { m[p.status] = (m[p.status] ?? 0) + 1; return m }, {}))

  const sugestaoDias = mediaDias >= config.minDiasSemana ? Math.min(7, config.minDiasSemana + 1) : config.minDiasSemana
  const sugestaoLeads = mediaLeads >= config.metaLeadsSemana * 1.2 ? Math.round(mediaLeads) : mediaLeads < config.metaLeadsSemana * 0.5 && mediaLeads > 0 ? Math.max(1, Math.round(mediaLeads * 1.2)) : config.metaLeadsSemana
  const sugestao = [
    sugestaoDias !== config.minDiasSemana ? `subir a meta de dias com post para ${sugestaoDias}` : `manter ${config.minDiasSemana} dias com post`,
    sugestaoLeads !== config.metaLeadsSemana ? `${sugestaoLeads > config.metaLeadsSemana ? 'subir' : 'baixar'} a meta de leads para ${sugestaoLeads} por semana` : `manter ${config.metaLeadsSemana} leads por semana`,
  ]

  const respostas: Record<string, string> = {
    'perm:como': `Esta semana (desde ${ddmm(diaLocal(ini))}): ${plural(diasAgora, 'dia', 'dias')} com post no feed (meta ${config.minDiasSemana}), ${tempo != null ? `resposta mediana de ${tempo} min no Atendimento (meta ${config.metaRespostaMin} min)` : `nenhuma resposta medida no Atendimento (meta ${config.metaRespostaMin} min)`} e ${plural(leadsAgora, 'lead orgânico', 'leads orgânicos')} (meta ${config.metaLeadsSemana}).`
      + (pendentes ? ` ${plural(pendentes, 'pauta espera', 'pautas esperam')} sua aprovação.` : ' Nada esperando sua aprovação.'),
    'perm:produzido': (publicadas.length ? `Publicado esta semana:\n${lista(publicadas.map(p => `${rotuloDia(diaLocal(p.publicadaEm!))}: “${p.titulo}” (${FORMATO_NOME[p.formato]})`))}` : 'Nada publicado pela Produção esta semana ainda.')
      + `\n${criadas ? plural(criadas, 'pauta criada', 'pautas criadas') : 'Nenhuma pauta criada'} na semana.${porEtapa.length ? ` Em andamento: ${porEtapa.map(([s, n]) => `${n} em ${ETAPA_NOME[s]?.toLowerCase() ?? s}`).join(', ')}.` : ''}`,
    'perm:metas': `Metas atuais: ${config.minDiasSemana} dias com post por semana, resposta em até ${config.metaRespostaMin} min e ${config.metaLeadsSemana} leads orgânicos por semana. Nas últimas 4 semanas, a média foi de ${num(mediaDias, 1)} dias com post e ${num(mediaLeads, 1)} leads por semana. Sugestão: ${sugestao.join(' e ')}. As metas ficam nas configurações do Calendário.`,
  }
  const fatos = {
    socialMedia: membro ? { nome, acesso: !membro.ativo ? 'suspenso' : membro.ativadoEm ? `ativo desde ${ddmm(diaLocal(membro.ativadoEm))}` : 'convite ainda não aceito' } : 'ninguém convidado',
    semanaDesde: ddmm(diaLocal(ini)),
    estaSemana: { diasComPost: diasAgora, leadsOrganicos: leadsAgora, respostaMedianaMin: tempo, pautasPublicadas: publicadas.map(p => p.titulo), pautasCriadas: criadas, esperandoSuaAprovacao: pendentes },
    emAndamento: Object.fromEntries(porEtapa.map(([s, n]) => [ETAPA_NOME[s] ?? s, n])),
    metas: { diasComPostPorSemana: config.minDiasSemana, respostaAteMin: config.metaRespostaMin, leadsPorSemana: config.metaLeadsSemana, retencaoDosReels: `${config.metaRetencao}%`, puloAte: `${config.metaPuloPct}%` },
    mediaDasUltimas4Semanas: { diasComPost: num(mediaDias, 1), leads: num(mediaLeads, 1) },
    sugestaoDeMetas: sugestao,
  }
  return { fatos, respostas }
}

/** Ficha para os ganchos e o roteiro de uma pauta: pauta, moto e os ganchos que funcionaram. */
export async function fatosDoRoteiro(sm: ContextoSM, pautaId: string) {
  const p = await prisma.smPauta.findFirst({
    where: { id: pautaId, usuarioId: sm.usuarioId },
    select: { titulo: true, formato: true, pilar: true, gancho: true, retencao: true, recompensa: true, cta: true, moto: { select: { modelo: true, marca: true, ano: true, cor: true, observacao: true } } },
  })
  if (!p) return null
  const { ganchos } = await listarGanchos(sm.usuarioId)
  return {
    pauta: p.titulo, formato: FORMATO_NOME[p.formato], pilar: PILAR_NOME[p.pilar],
    moto: p.moto ? { moto: nomeMoto(p.moto), marca: p.moto.marca, ...(sm.pode('estoque', 'LEITURA') ? { observacao: p.moto.observacao } : {}) } : null,
    jaEscrito: { gancho: p.gancho, retencao: p.retencao, recompensa: p.recompensa, cta: p.cta },
    ganchosDaBiblioteca: ganchos.filter(g => g.puloMedio != null).slice(0, 5).map(g => ({ gancho: g.texto, puloMedio: pct(g.puloMedio!), reels: g.comPulo })),
  }
}

/** Fatos da aba (o que a IA recebe) e a resposta por template da pergunta sugerida, se houver. */
export async function respostaDaAba(sm: ContextoSM, aba: Aba, perguntaId: string | null, agora = new Date()): Promise<Resposta> {
  const sugestoes = (await insightsDaAba(sm, aba, agora)).slice(0, 5).map(i => i.texto)
  if (aba === 'atendimento') {
    const r = await atendimento(sm, agora, perguntaId)
    return {
      fatos: { ...r.fatos, sugestoesDoAssistente: sugestoes }, semIA: perguntaId ? r.respostas[perguntaId] ?? null : null,
      ...(r.conversa ? { conversa: { nome: r.conversa.nome, fatos: r.conversa.fatos }, acao: { rotulo: 'Abrir a conversa', href: `/pro-labore/sm/atendimento?conversa=${r.conversa.conversa.id}&sugerir=1` } } : {}),
    }
  }
  const r = aba === 'calendario' ? await calendario(sm, agora)
    : aba === 'producao' ? await producao(sm, agora, perguntaId?.startsWith('prod:roteiro:') || perguntaId?.startsWith('prod:ganchos:') ? perguntaId : null)
      : aba === 'desempenho' ? await desempenho(sm, agora)
        : aba === 'atribuicao' ? await atribuicao(sm)
          : await permissoes(sm, agora)
  return { fatos: { ...r.fatos, sugestoesDoAssistente: sugestoes }, semIA: perguntaId ? r.respostas[perguntaId] ?? null : null }
}
