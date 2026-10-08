// Fase 5 · Notificações "Pulso" (seção 11.5) por Web Push, com agrupamento.
// - Gatilhos: post decolando na 1ª hora (≥ 2× a mediana da 1ª hora), venda
//   creditada a um post, cliente esperando acima da meta, pauta enviada para
//   aprovação (gestor) e falha de sincronização ou de publicação (os dois).
// - Agrupados para não virar barulho: no máximo um aviso a cada 30 min por
//   pessoa, juntando o que chegou no meio. Só "Cliente esperando" interrompe
//   na hora. Sem as chaves VAPID, nada vai para o celular, mas os avisos
//   ficam na lista "Avisos" do próprio espaço.
import webpush from 'web-push'
import { prisma } from './prisma'
import { carregarPermissoes, type ModuloSM } from './smAcesso'
import { carregarConfig, diaLocal } from './smCalendario'
import { dentroDoExpediente } from './smAtendimento'
import { atribuicaoDasPublicacoes, tituloDoPost } from './smDesempenho'

const MIN_MS = 60_000
const INTERVALO_RESUMO_MS = 30 * MIN_MS
const DIA_MS = 864e5
const OFF = 3 * 3600e3
const ddmm = (d: Date) => { const l = new Date(d.getTime() - OFF).toISOString(); return `${l.slice(8, 10)}/${l.slice(5, 7)}` }
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
const num = (v: number, c = 1) => v.toLocaleString('pt-BR', { maximumFractionDigits: c })
const mediana = (v: number[]) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

export type TipoPulso = 'DECOLANDO' | 'VENDA' | 'CLIENTE' | 'APROVACAO' | 'FALHA'
export interface AvisoPulso { tipo: TipoPulso; chave: string; titulo: string; texto: string; href?: string | null; urgente?: boolean }
type Destino = 'SOCIAL_MEDIA' | 'GESTOR'

// ---------- Web Push ----------

export function pushConfigurado(): boolean {
  return !!process.env.VAPID_PUBLIC_KEY?.trim() && !!process.env.VAPID_PRIVATE_KEY?.trim()
}
export function chavePublicaPush(): string | null {
  return pushConfigurado() ? process.env.VAPID_PUBLIC_KEY!.trim() : null
}
let vapidPronto = false
function prepararVapid() {
  if (vapidPronto) return
  webpush.setVapidDetails(process.env.VAPID_SUBJECT?.trim() || 'mailto:contato@ariessales.com.br', process.env.VAPID_PUBLIC_KEY!.trim(), process.env.VAPID_PRIVATE_KEY!.trim())
  vapidPronto = true
}

/** Manda para todos os aparelhos inscritos da pessoa; inscrições vencidas (404/410) saem. */
async function enviarParaAparelhos(usuarioId: string, ator: string, carga: { titulo: string; texto: string; href: string | null; tag: string; urgente: boolean }) {
  if (!pushConfigurado()) return 0
  prepararVapid()
  const inscricoes = await prisma.smPushInscricao.findMany({ where: { usuarioId, ator } })
  let enviados = 0
  for (const i of inscricoes) {
    try {
      await webpush.sendNotification(
        { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
        JSON.stringify({ title: carga.titulo, body: carga.texto, href: carga.href ?? '/pro-labore/sm', tag: carga.tag }),
        { TTL: carga.urgente ? 1800 : 6 * 3600, urgency: carga.urgente ? 'high' : 'normal', topic: carga.tag.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || undefined, timeout: 8000 },
      )
      enviados++
      await prisma.smPushInscricao.update({ where: { id: i.id }, data: { ultimoUsoEm: new Date() } })
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) await prisma.smPushInscricao.delete({ where: { id: i.id } }).catch(() => undefined)
    }
  }
  return enviados
}

/** Aviso de teste ("Enviar um aviso de teste" nas Preferências): sai na hora, fora da fila. */
export async function avisoDeTeste(usuarioId: string, ator: string) {
  return enviarParaAparelhos(usuarioId, ator, {
    titulo: 'Avisos ligados neste aparelho',
    texto: 'É assim que chegam o post decolando, a venda creditada e o cliente esperando. Os outros avisos vêm juntos, no máximo a cada 30 min.',
    href: '/pro-labore/sm', tag: 'pulso-teste', urgente: true,
  })
}

// ---------- Fila ----------

/** Quem recebe: o Social Media (membro ativo) e/ou o gestor. Sem membro, o que seria dele vai ao gestor. */
async function atores(usuarioId: string, destinos: Destino[], modulo: ModuloSM | null): Promise<string[]> {
  const lista = new Set<string>()
  const membro = destinos.includes('SOCIAL_MEDIA') ? await prisma.smMembro.findUnique({ where: { usuarioId }, select: { id: true, ativo: true, senhaHash: true } }) : null
  if (destinos.includes('SOCIAL_MEDIA')) {
    const podeVer = modulo ? (await carregarPermissoes(usuarioId)).niveis[modulo] !== 'SEM_ACESSO' : true
    if (membro?.ativo && membro.senhaHash && podeVer) lista.add(membro.id)
    else if (!membro?.ativo || !membro?.senhaHash) lista.add('GESTOR')
  }
  if (destinos.includes('GESTOR')) lista.add('GESTOR')
  return [...lista]
}

/** Entra na fila (uma vez por chave e por pessoa). O urgente sai na hora. */
export async function enfileirar(usuarioId: string, destinos: Destino[], aviso: AvisoPulso, modulo: ModuloSM | null = null, agora = new Date()) {
  const quem = await atores(usuarioId, destinos, modulo)
  let novos = 0
  for (const ator of quem) {
    const r = await prisma.smPulso.createMany({
      data: [{ usuarioId, ator, tipo: aviso.tipo, chave: aviso.chave, titulo: aviso.titulo, texto: aviso.texto, href: aviso.href ?? null, urgente: !!aviso.urgente, criadoEm: agora }],
      skipDuplicates: true,
    })
    novos += r.count
    if (r.count && aviso.urgente) await entregar(usuarioId, ator, agora)
  }
  return novos
}

async function querCelular(usuarioId: string, ator: string): Promise<boolean> {
  const p = await prisma.smPreferencia.findUnique({ where: { usuarioId_ator: { usuarioId, ator } }, select: { avisos: true } })
  return (p?.avisos as { celular?: boolean } | null)?.celular !== false
}

/** Entrega o que está pendente para a pessoa: urgente sozinho e na hora; o resto junto, a cada 30 min. */
export async function entregar(usuarioId: string, ator: string, agora = new Date()) {
  const pendentes = await prisma.smPulso.findMany({ where: { usuarioId, ator, enviadoEm: null }, orderBy: { criadoEm: 'asc' } })
  if (!pendentes.length) return { push: 0, avisos: 0 }
  const celular = await querCelular(usuarioId, ator)
  let push = 0
  const urgentes = pendentes.filter(p => p.urgente)
  for (const u of urgentes) {
    if (celular) push += await enviarParaAparelhos(usuarioId, ator, { titulo: u.titulo, texto: u.texto, href: u.href, tag: u.chave, urgente: true })
  }
  if (urgentes.length) await prisma.smPulso.updateMany({ where: { id: { in: urgentes.map(u => u.id) } }, data: { enviadoEm: agora } })

  // O que já foi lido no próprio espaço não vai mais para o celular.
  const normais = pendentes.filter(p => !p.urgente)
  const paraOCelular = normais.filter(p => !p.lidoEm)
  if (normais.length) {
    const ultimo = await prisma.smPulso.findFirst({ where: { usuarioId, ator, urgente: false, enviadoEm: { not: null } }, orderBy: { enviadoEm: 'desc' }, select: { enviadoEm: true } })
    const espera = ultimo?.enviadoEm ? INTERVALO_RESUMO_MS - (agora.getTime() - ultimo.enviadoEm.getTime()) : 0
    if (espera <= 0) {
      if (celular && paraOCelular.length) {
        const carga = paraOCelular.length === 1
          ? { titulo: paraOCelular[0].titulo, texto: paraOCelular[0].texto, href: paraOCelular[0].href, tag: paraOCelular[0].chave, urgente: false }
          : { titulo: `${paraOCelular.length} novidades no Pró-Labore`, texto: paraOCelular.slice(0, 3).map(n => n.titulo).join(' · ') + (paraOCelular.length > 3 ? ` e mais ${paraOCelular.length - 3}` : ''), href: '/pro-labore/sm?avisos=1', tag: 'pulso-resumo', urgente: false }
        push += await enviarParaAparelhos(usuarioId, ator, carga)
      }
      await prisma.smPulso.updateMany({ where: { id: { in: normais.map(n => n.id) } }, data: { enviadoEm: agora } })
    }
  }
  return { push, avisos: pendentes.length }
}

/** Avisos que já existiam viram Pulso: aprovação (gestor) e falhas (os dois). */
export async function pulsoDoAviso(usuarioId: string, destinatario: Destino, tipo: string, chave: string, titulo: string, texto: string, payload?: unknown) {
  const pautaId = (payload as { pautaId?: string } | null)?.pautaId
  if (tipo === 'APROVACAO' && destinatario === 'GESTOR') {
    await enfileirar(usuarioId, ['GESTOR'], { tipo: 'APROVACAO', chave: `${chave}:${Date.now()}`, titulo, texto, href: '/pro-labore/sm/aprovar' })
  } else if (tipo === 'PUBLICACAO_FALHA' || tipo === 'SYNC_FALHA') {
    const dia = diaLocal(new Date())
    await enfileirar(usuarioId, [destinatario], {
      tipo: 'FALHA', chave: `${chave}:${dia}`, titulo, texto,
      href: tipo === 'PUBLICACAO_FALHA' && pautaId ? `/pro-labore/sm/producao?pauta=${pautaId}` : destinatario === 'GESTOR' ? '/pro-labore/social-media' : '/pro-labore/sm',
    })
  }
}

// ---------- Gatilhos (job de 5 em 5 minutos) ----------

/** Cliente esperando acima da meta de resposta, dentro do expediente: interrompe na hora. */
async function clientesEsperando(usuarioId: string, agora: Date) {
  const config = await carregarConfig(usuarioId)
  if (!dentroDoExpediente(agora, config)) return 0
  const limite = new Date(agora.getTime() - config.metaRespostaMin * MIN_MS)
  const conversas = await prisma.smConversa.findMany({
    // A meta de resposta é do direct (e das respostas a story, que chegam no direct); comentário não interrompe.
    where: { usuarioId, canal: { in: ['DIRECT', 'RESPOSTA_STORY'] }, aguardandoDesde: { not: null, lte: limite, gte: new Date(agora.getTime() - DIA_MS) }, status: { not: 'ARQUIVADA' } },
    select: { id: true, clienteNome: true, clienteUsuario: true, motoInteresse: true, aguardandoDesde: true },
    orderBy: { aguardandoDesde: 'asc' }, take: 10,
  })
  let n = 0
  for (const c of conversas) {
    const min = Math.round((agora.getTime() - c.aguardandoDesde!.getTime()) / MIN_MS)
    const nome = c.clienteNome?.trim() || (c.clienteUsuario ? `@${c.clienteUsuario}` : 'Um cliente')
    n += await enfileirar(usuarioId, ['SOCIAL_MEDIA'], {
      tipo: 'CLIENTE', urgente: true, chave: `cliente:${c.id}:${c.aguardandoDesde!.toISOString()}`,
      titulo: `Cliente esperando há ${min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}`}`,
      texto: `${nome} ${c.motoInteresse ? `perguntou sobre a ${c.motoInteresse}` : 'está esperando resposta'}. Toque para responder.`,
      href: `/pro-labore/sm/atendimento?conversa=${c.id}`,
    }, 'atendimento', agora)
  }
  return n
}

/** Venda creditada a um post (origem Instagram orgânico), nos últimos 3 dias. */
async function vendasCreditadas(usuarioId: string, agora: Date) {
  const vendas = await prisma.venda.findMany({
    where: { usuarioId, origem: 'INSTAGRAM_ORGANICO', data: { gte: new Date(agora.getTime() - 3 * DIA_MS), lte: agora } },
    select: { id: true, data: true, postCode: true, lead: { select: { modeloInteresse: true, midiaId: true } } },
  })
  let n = 0
  for (const v of vendas) {
    const pauta = v.postCode ? await prisma.smPauta.findFirst({ where: { usuarioId, codigo: v.postCode }, select: { igMediaId: true, publicadaEm: true, formato: true } }) : null
    const midia = pauta?.igMediaId ?? v.lead?.midiaId ?? null
    const leads = midia ? (await atribuicaoDasPublicacoes(usuarioId, [midia], true, false)).get(midia)?.leads ?? null : null
    const modelo = v.lead?.modeloInteresse?.trim()
    const quando = diaLocal(v.data) === diaLocal(agora) ? 'hoje' : `em ${ddmm(v.data)}`
    const formato = pauta?.formato === 'REELS' ? 'reel' : pauta?.formato === 'CARROSSEL' ? 'carrossel' : 'post'
    n += await enfileirar(usuarioId, ['SOCIAL_MEDIA'], {
      tipo: 'VENDA', chave: `venda:${v.id}`, titulo: 'Venda creditada ao seu post',
      texto: `${modelo ? `A ${modelo} vendida` : 'A venda fechada'} ${quando} veio do ${pauta?.publicadaEm ? `${formato} de ${ddmm(pauta.publicadaEm)}` : `post ${v.postCode ?? 'do Instagram'}`}.${leads ? ` Esse post já soma ${plural(leads, 'lead', 'leads')}.` : ''}`,
      href: '/pro-labore/sm/vendas-por-post',
    }, 'vendas', agora)
  }
  return n
}

/** Post decolando: alcance na 1ª hora ≥ 2× a mediana da 1ª hora (com 5+ posts de base). */
async function postsDecolando(usuarioId: string, agora: Date) {
  const conta = await prisma.socialMediaConta.findUnique({ where: { titular: `dono:${usuarioId}` }, select: { id: true } })
  if (!conta) return 0
  // Guarda o alcance da 1ª hora: a primeira leitura de métricas depois de 50 min no ar.
  const recentes = await prisma.socialMediaMidia.findMany({
    where: { contaId: conta.id, alcance1h: null, publicadoEm: { gte: new Date(agora.getTime() - 3 * 3600e3), lte: new Date(agora.getTime() - 50 * MIN_MS) }, NOT: { formato: { in: ['STORY', 'AD'] } }, insightsAtualizadoEm: { not: null } },
    select: { id: true, publicadoEm: true, insightsAtualizadoEm: true, alcance: true },
  })
  for (const m of recentes) {
    if (m.insightsAtualizadoEm!.getTime() - m.publicadoEm.getTime() >= 50 * MIN_MS) await prisma.socialMediaMidia.update({ where: { id: m.id }, data: { alcance1h: m.alcance } })
  }
  const base = await prisma.socialMediaMidia.findMany({ where: { contaId: conta.id, alcance1h: { not: null }, publicadoEm: { lt: new Date(agora.getTime() - 3 * 3600e3) } }, select: { alcance1h: true }, orderBy: { publicadoEm: 'desc' }, take: 30 })
  const med = base.length >= 5 ? mediana(base.map(b => b.alcance1h!)) : null
  if (!med) return 0
  const candidatas = await prisma.socialMediaMidia.findMany({
    where: { contaId: conta.id, alcance1h: { not: null }, publicadoEm: { gte: new Date(agora.getTime() - 3 * 3600e3) } },
    select: { instagramMediaId: true, legenda: true, alcance1h: true },
  })
  let n = 0
  for (const m of candidatas) {
    const x = m.alcance1h! / med
    if (x < 2) continue
    const esperando = await prisma.smConversa.count({ where: { usuarioId, canal: { in: ['COMENTARIO', 'COMENTARIO_AUTOMACAO'] }, midiaIgId: m.instagramMediaId, aguardandoDesde: { not: null } } })
    n += await enfileirar(usuarioId, ['SOCIAL_MEDIA'], {
      tipo: 'DECOLANDO', chave: `decolando:${m.instagramMediaId}`, titulo: `${tituloDoPost(m)} está decolando`,
      texto: `${num(x)}× acima da mediana na 1ª hora. ${esperando > 1 ? `Responda os ${esperando} comentários` : esperando === 1 ? 'Responda o comentário' : 'Responda quem comentar'} agora para manter o ritmo.`,
      href: esperando ? '/pro-labore/sm/atendimento' : '/pro-labore/sm/desempenho',
    }, 'analise', agora)
  }
  return n
}

/** Job de 5 em 5 minutos: gatilhos de todas as operações e a entrega agrupada. */
export async function rodarPulso(agora = new Date()) {
  const operacoes = await prisma.proLaboreUsuario.findMany({ where: { OR: [{ smMembro: { isNot: null } }, { smPushInscricoes: { some: {} } }] }, select: { id: true } })
  let novos = 0, push = 0
  for (const { id } of operacoes) {
    novos += await clientesEsperando(id, agora)
    novos += await vendasCreditadas(id, agora)
    novos += await postsDecolando(id, agora)
  }
  const pendentes = await prisma.smPulso.findMany({ where: { enviadoEm: null }, distinct: ['usuarioId', 'ator'], select: { usuarioId: true, ator: true } })
  for (const p of pendentes) push += (await entregar(p.usuarioId, p.ator, agora)).push
  return { pulsoNovos: novos, pulsoPush: push }
}
