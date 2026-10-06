// Publicação agendada pela Content Publishing API (seção 6): a pauta
// aprovada e agendada vai ao ar sozinha no horário, já com o código.
//
// Roda no job de minuto (/sm/cron/minuto, a cada 5 min), uma etapa por
// passada, para caber nos 30 s da função serverless:
//   AGUARDANDO  -> cria o(s) contêiner(es) na Meta -> PROCESSANDO
//   PROCESSANDO -> contêiner FINISHED -> publica -> PUBLICADA
// Falha de API conta tentativa; na 3ª, ou com contêiner em ERROR/EXPIRED,
// vira FALHA e avisa gestor e Social Media.
import { SmPauta, SmPautaMidia } from '@prisma/client'
import { prisma } from './prisma'
import {
  buscarPermalink, comApiDaEmpresa, criarContainerMidia, ErroGraphApi, publicarContainer, statusContainer, type ParametrosContainer,
} from './instagramGraph'
import { notificar, marcarAvisosLidos } from './smPautas'

export const MAX_TENTATIVAS_PUBLICACAO = 3

type PautaComMidias = SmPauta & { midias: SmPautaMidia[] }

function urlAbsoluta(url: string, baseApi: string): string {
  return /^https?:\/\//.test(url) ? url : `${baseApi.replace(/\/+$/, '')}${url.startsWith('/') ? '' : '/'}${url}`
}

export function legendaFinal(p: Pick<SmPauta, 'legenda' | 'codigo'>): string {
  const legenda = (p.legenda ?? '').trim()
  return p.codigo ? `${legenda}\n\n${p.codigo}`.trim() : legenda
}

async function criarContainers(p: PautaComMidias, conta: string, token: string, baseApi: string): Promise<string> {
  const midias = [...p.midias].filter(m => m.tipo === 'IMAGEM' || m.tipo === 'VIDEO').sort((a, b) => a.ordem - b.ordem)
  const legenda = legendaFinal(p)
  const daMidia = (m: SmPautaMidia): ParametrosContainer => m.tipo === 'VIDEO' ? { video_url: urlAbsoluta(m.url, baseApi) } : { image_url: urlAbsoluta(m.url, baseApi) }
  if (p.formato === 'CARROSSEL') {
    const filhos: string[] = []
    for (const m of midias) filhos.push(await criarContainerMidia(conta, token, { ...daMidia(m), ...(m.tipo === 'VIDEO' ? { media_type: 'REELS' as const } : {}), is_carousel_item: 'true' }))
    return criarContainerMidia(conta, token, { media_type: 'CAROUSEL', children: filhos.join(','), caption: legenda })
  }
  const m = midias[0]
  if (p.formato === 'STORY') return criarContainerMidia(conta, token, { ...daMidia(m), media_type: 'STORIES' })
  if (p.formato === 'REELS') {
    return criarContainerMidia(conta, token, {
      ...daMidia(m),
      media_type: 'REELS',
      caption: legenda,
      // Trial Reel: vai só para quem não segue; a Meta promove ao feed se performar bem.
      ...(p.trial ? { trial_params: JSON.stringify({ graduation_strategy: 'SS_PERFORMANCE' }) } : { share_to_feed: 'true' as const }),
    })
  }
  return criarContainerMidia(conta, token, { ...daMidia(m), caption: legenda })
}

async function falhar(p: SmPauta, mensagem: string, definitiva: boolean) {
  const tentativas = p.publicacaoTentativas + 1
  const final = definitiva || tentativas >= MAX_TENTATIVAS_PUBLICACAO
  await prisma.smPauta.update({
    where: { id: p.id },
    data: { publicacaoTentativas: tentativas, publicacaoErro: mensagem, ...(final ? { publicacaoStatus: 'FALHA', publicacaoContainerId: null } : {}) },
  })
  if (final) {
    for (const d of ['GESTOR', 'SOCIAL_MEDIA'] as const) {
      await notificar(p.usuarioId, d, 'PUBLICACAO_FALHA', `publicacao-falha:${p.id}`, `Não publicou: ${p.titulo}`, `${mensagem} Abra a pauta na Produção para tentar de novo.`, { pautaId: p.id })
    }
  }
  return final ? 'FALHA' : 'NOVA_TENTATIVA'
}

/** Uma etapa da publicação de uma pauta. Devolve o que aconteceu. */
export async function avancarPublicacao(p: PautaComMidias, baseApi: string): Promise<string> {
  const conta = await prisma.socialMediaConta.findUnique({ where: { titular: `dono:${p.usuarioId}` } })
  if (!conta) return falhar(p, 'Instagram não conectado.', true)
  const empresa = conta.tipoConexao === 'EMPRESA'
  const idConta = empresa ? conta.instagramUserId : 'me'
  const naApi = <T>(fn: () => Promise<T>) => (empresa ? comApiDaEmpresa(fn) : fn())
  try {
    if (!p.publicacaoContainerId) {
      const container = await naApi(() => criarContainers(p, idConta, conta.accessToken, baseApi))
      await prisma.smPauta.update({ where: { id: p.id }, data: { publicacaoContainerId: container, publicacaoStatus: 'PROCESSANDO', publicacaoErro: null } })
      p = { ...p, publicacaoContainerId: container }
    }
    const st = await naApi(() => statusContainer(p.publicacaoContainerId!, conta.accessToken))
    if (st.status === 'ERROR' || st.status === 'EXPIRED') {
      return falhar(p, `A Meta recusou o arquivo (${st.detalhe ?? st.status}). Confira o formato e o tamanho do arquivo.`, true)
    }
    if (st.status !== 'FINISHED') return 'PROCESSANDO'
    const mediaId = await naApi(() => publicarContainer(idConta, conta.accessToken, p.publicacaoContainerId!))
    const permalink = await naApi(() => buscarPermalink(mediaId, conta.accessToken))
    await prisma.smPauta.update({
      where: { id: p.id },
      data: { status: 'PUBLICADO', publicacaoStatus: 'PUBLICADA', publicadaEm: new Date(), igMediaId: mediaId, permalink, publicacaoErro: null, publicacaoContainerId: null },
    })
    await marcarAvisosLidos(p.usuarioId, `publicacao-falha:${p.id}`)
    return 'PUBLICADA'
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha ao publicar'
    // Token inválido ou sem permissão de publicar: não adianta insistir.
    const definitiva = e instanceof ErroGraphApi && (e.codigo === 190 || e.codigo === 10 || e.codigo === 200)
    return falhar(p, msg, definitiva)
  }
}

/** Job de minuto: avança todas as pautas agendadas que já venceram. */
export async function publicarPautasVencidas(baseApi: string, agora = new Date()) {
  const pautas = await prisma.smPauta.findMany({
    where: {
      status: 'AGENDADO',
      agendadoPara: { lte: agora },
      publicacaoStatus: { in: ['AGUARDANDO', 'PROCESSANDO'] },
    },
    include: { midias: true },
    orderBy: { agendadoPara: 'asc' },
    take: 10,
  })
  const resultados: Record<string, number> = {}
  for (const p of pautas) {
    const r = await avancarPublicacao(p, baseApi)
    resultados[r] = (resultados[r] ?? 0) + 1
  }
  return { pautas: pautas.length, ...resultados }
}
