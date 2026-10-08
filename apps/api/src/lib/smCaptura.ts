// Fase 5 · Captura na loja (seção 11.5, fluxo 2): a pauta em gravação vira
// uma lista de tomadas com instrução, formato e duração máxima, tirada do
// próprio roteiro (gancho, retenção, recompensa). Cada tomada recebe um
// arquivo; com todas enviadas, a pauta vai para Edição.
//
// Arquivos: foto vai para o armazenamento próprio (Postgres, como as demais
// imagens). Vídeo exige o Vercel Blob (decisão P8): o celular sobe direto
// para o Blob com um token de uso único e depois registra o endereço aqui.
// Sem o Blob configurado, o vídeo entra por link público (https).
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client'
import { prisma } from './prisma'
import { ROTEIRO_ENTREGA } from './smPautasAuto'

export const STATUS_CAPTURA = ['IDEIA', 'ROTEIRO', 'GRAVACAO', 'EDICAO'] as const
const ANTES_DA_EDICAO = ['IDEIA', 'ROTEIRO', 'GRAVACAO']
const MAX_VIDEO = 300 * 1024 * 1024
export const TIPOS_VIDEO = ['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp', 'video/x-m4v']

export interface Tomada {
  n: number
  nome: string
  instrucao: string
  /** "Vertical · até 8 segundos" ou "Foto vertical 4:5" */
  formato: string
  duracaoMaxSeg: number | null
  arquivo: 'VIDEO' | 'FOTO'
}

type PautaDaCaptura = { titulo: string; formato: string; origem: string; gancho: string | null; retencao: string | null; recompensa: string | null; cta: string | null }

const vertical = (s: number) => `Vertical · até ${s} segundos`
const FOTO = 'Foto vertical 4:5'
const texto = (v: string | null | undefined, padrao: string) => v?.trim() || padrao

/** As tomadas da pauta, na ordem de gravação. */
export function tomadasDaPauta(p: PautaDaCaptura): Tomada[] {
  const entrega = p.origem === 'VENDA' || (p.gancho === ROTEIRO_ENTREGA.gancho && p.recompensa === ROTEIRO_ENTREGA.recompensa)
  const fechamento = `Feche com o que a pessoa ganha${p.cta?.trim() ? ` e a chamada: “${p.cta.trim()}”` : ''}.`
  if (p.formato === 'FOTO') {
    return [{ n: 1, nome: 'Foto principal', instrucao: texto(p.gancho, 'A moto inteira, de lado, com luz boa e fundo limpo.'), formato: FOTO, duracaoMaxSeg: null, arquivo: 'FOTO' }]
  }
  if (p.formato === 'CARROSSEL') {
    return [
      { n: 1, nome: 'Capa', instrucao: texto(p.gancho, 'A foto que para a rolagem: a moto inteira ou o resultado.'), formato: FOTO, duracaoMaxSeg: null, arquivo: 'FOTO' },
      { n: 2, nome: 'Detalhes', instrucao: texto(p.retencao, 'Um detalhe por foto: painel, banco, roda, acabamento.'), formato: FOTO, duracaoMaxSeg: null, arquivo: 'FOTO' },
      { n: 3, nome: 'Fechamento', instrucao: texto(p.recompensa, fechamento), formato: FOTO, duracaoMaxSeg: null, arquivo: 'FOTO' },
    ]
  }
  if (p.formato === 'STORY') {
    return [{ n: 1, nome: 'Story', instrucao: texto(p.gancho, 'Mostre a moto ou o momento em um plano só, já com o assunto nos 2 primeiros segundos.'), formato: vertical(15), duracaoMaxSeg: 15, arquivo: 'VIDEO' }]
  }
  if (entrega) {
    return [
      { n: 1, nome: 'Chave na mão', instrucao: texto(p.gancho, ROTEIRO_ENTREGA.gancho), formato: vertical(5), duracaoMaxSeg: 5, arquivo: 'VIDEO' },
      { n: 2, nome: 'Frase do cliente', instrucao: texto(p.retencao, ROTEIRO_ENTREGA.retencao), formato: vertical(8), duracaoMaxSeg: 8, arquivo: 'VIDEO' },
      { n: 3, nome: 'Saindo com a moto', instrucao: texto(p.recompensa, ROTEIRO_ENTREGA.recompensa), formato: vertical(6), duracaoMaxSeg: 6, arquivo: 'VIDEO' },
    ]
  }
  return [
    { n: 1, nome: 'Gancho', instrucao: texto(p.gancho, 'Abra com a moto ou o resultado, sem narração nos 2 primeiros segundos.'), formato: vertical(3), duracaoMaxSeg: 3, arquivo: 'VIDEO' },
    { n: 2, nome: 'Desenvolvimento', instrucao: texto(p.retencao, 'Mostre os detalhes, um por corte.'), formato: vertical(15), duracaoMaxSeg: 15, arquivo: 'VIDEO' },
    { n: 3, nome: 'Fechamento', instrucao: texto(p.recompensa, fechamento), formato: vertical(6), duracaoMaxSeg: 6, arquivo: 'VIDEO' },
  ]
}

/** Tipo do arquivo da tomada: o reel junta as tomadas na edição (TOMADA); foto e story já servem para publicar. */
export function tipoDaMidia(formato: string, arquivo: Tomada['arquivo']): 'TOMADA' | 'VIDEO' | 'IMAGEM' {
  if (arquivo === 'FOTO') return 'IMAGEM'
  return formato === 'STORY' ? 'VIDEO' : 'TOMADA'
}

type MidiaDaTomada = { id: string; tipo: string; url: string; tomada: number | null; criadoEm: Date }

/** Situação de cada tomada: Enviada, Agora (a primeira sem arquivo) ou Pendente. */
export function situacaoDasTomadas(p: PautaDaCaptura, midias: MidiaDaTomada[]) {
  const tomadas = tomadasDaPauta(p)
  const daTomada = new Map(midias.filter(m => m.tomada != null).map(m => [m.tomada!, m]))
  const agora = tomadas.find(t => !daTomada.has(t.n))?.n ?? null
  return tomadas.map(t => {
    const m = daTomada.get(t.n)
    return { ...t, situacao: m ? 'ENVIADA' as const : t.n === agora ? 'AGORA' as const : 'PENDENTE' as const, midia: m ? { id: m.id, url: m.url, tipo: m.tipo, enviadaEm: m.criadoEm } : null }
  })
}

/** Depois de enviar ou refazer: a pauta entra em Gravação e, com tudo enviado, vai para Edição. */
export async function avancarPelaCaptura(pautaId: string): Promise<'GRAVACAO' | 'EDICAO' | null> {
  const p = await prisma.smPauta.findUnique({ where: { id: pautaId }, include: { midias: true } })
  if (!p || !ANTES_DA_EDICAO.includes(p.status)) return null
  const completas = situacaoDasTomadas(p, p.midias).every(t => t.situacao === 'ENVIADA')
  const destino = completas ? 'EDICAO' : 'GRAVACAO'
  if (p.status === destino) return null
  await prisma.smPauta.update({ where: { id: p.id }, data: { status: destino, ordem: Date.now() } })
  return destino
}

// ---------- Vercel Blob (vídeo) ----------

const tokenBlob = () => process.env.BLOB_READ_WRITE_TOKEN?.trim() || null
export const videoPeloApp = () => !!tokenBlob()
const lojaDoBlob = () => tokenBlob()?.split('_')[3] ?? null
const pastaDaPauta = (usuarioId: string, pautaId: string) => `sm/${usuarioId}/${pautaId}/`

/** Token de uso único para o celular subir o vídeo da tomada direto no Blob. */
export async function tokenDeEnvio(usuarioId: string, pautaId: string, n: number, extensao: string) {
  const token = tokenBlob()
  if (!token) return null
  const ext = /^[a-z0-9]{2,5}$/.test(extensao) ? extensao : 'mp4'
  const pathname = `${pastaDaPauta(usuarioId, pautaId)}tomada-${n}.${ext}`
  const clientToken = await generateClientTokenFromReadWriteToken({
    token, pathname, allowedContentTypes: TIPOS_VIDEO, maximumSizeInBytes: MAX_VIDEO, addRandomSuffix: true, validUntil: Date.now() + 15 * 60_000,
  })
  return { token: clientToken, pathname }
}

/** O endereço veio do nosso Blob, na pasta desta pauta? */
export function enderecoDoBlob(url: string, usuarioId: string, pautaId: string): boolean {
  const loja = lojaDoBlob()
  if (!loja) return false
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname.toLowerCase() === `${loja.toLowerCase()}.public.blob.vercel-storage.com` && u.pathname.startsWith(`/${pastaDaPauta(usuarioId, pautaId)}`)
  } catch { return false }
}
