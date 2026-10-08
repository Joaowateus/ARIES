// Regras da Produção (seção 6 da especificação): colunas, código do post,
// checklist antes de aprovar e o que a pauta precisa ter para ser publicada.
import { Prisma, SmPauta, SmPautaMidia } from '@prisma/client'
import { prisma } from './prisma'
import { pulsoDoAviso } from './smPulso'
import { dentroDaJanela, type JanelasResultado } from './smJanelas'

export const PILARES = ['ESTOQUE', 'PROVA', 'EDUCACAO', 'BASTIDORES'] as const
export const FORMATOS = ['REELS', 'CARROSSEL', 'FOTO', 'STORY'] as const
export const COLUNAS = ['IDEIA', 'ROTEIRO', 'GRAVACAO', 'EDICAO', 'APROVACAO', 'AGENDADO'] as const
export const STATUS_PAUTA = [...COLUNAS, 'PUBLICADO'] as const
export const ORIGENS = ['MANUAL', 'ESTOQUE', 'VENDA', 'INSIGHT', 'AUDIENCIA', 'CALENDARIO'] as const
export const TAMANHO_MIN_LEGENDA = 300
export type StatusPauta = (typeof STATUS_PAUTA)[number]
export type Ator = 'GESTOR' | 'SOCIAL_MEDIA'

const OFFSET_BRASILIA_MS = 3 * 60 * 60 * 1000

/** Campos que, mudados pelo Social Media depois da aprovação, pedem aprovação de novo. */
export const CAMPOS_DE_CONTEUDO = ['titulo', 'formato', 'gancho', 'retencao', 'recompensa', 'cta', 'legenda', 'agendadoPara', 'trial'] as const

// ---------- Código do post (seção 3.5) ----------

function siglaDoModelo(texto: string): string {
  const palavras = texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(p => p && !['A', 'O', 'E', 'DE', 'DA', 'DO', 'EM', 'NA', 'NO', 'PARA', 'COM', 'ENTREGA', 'MOTO'].includes(p))
  // Primeira palavra com letra (ex.: "XRE 300 Sahara" -> XRE; "CB Twister" -> CB).
  const p = palavras.find(x => /[A-Z]/.test(x)) ?? palavras[0] ?? 'POST'
  return p.slice(0, 6)
}

/** #P-DDMM-MODELO (stories: #S-...). Repetido no mesmo dia ganha -2, -3. */
export async function gerarCodigo(usuarioId: string, pauta: { id: string; formato: string; agendadoPara: Date; titulo: string; moto?: { modelo: string } | null }): Promise<string> {
  const local = new Date(pauta.agendadoPara.getTime() - OFFSET_BRASILIA_MS)
  const ddmm = `${String(local.getUTCDate()).padStart(2, '0')}${String(local.getUTCMonth() + 1).padStart(2, '0')}`
  const base = `#${pauta.formato === 'STORY' ? 'S' : 'P'}-${ddmm}-${siglaDoModelo(pauta.moto?.modelo ?? pauta.titulo)}`
  const usados = new Set((await prisma.smPauta.findMany({
    where: { usuarioId, codigo: { startsWith: base }, NOT: { id: pauta.id } },
    select: { codigo: true },
  })).map(p => p.codigo))
  if (!usados.has(base)) return base
  for (let i = 2; ; i++) if (!usados.has(`${base}-${i}`)) return `${base}-${i}`
}

// ---------- Checklist antes de aprovar ----------

export interface ItemChecklist { chave: string; rotulo: string; ok: boolean | null; automatico: boolean; detalhe?: string }

export function checklistDaPauta(p: Pick<SmPauta, 'codigo' | 'legenda' | 'checklist' | 'agendadoPara'>, janelas: JanelasResultado): ItemChecklist[] {
  const manual = (p.checklist ?? {}) as Record<string, boolean>
  const tamanho = p.legenda?.trim().length ?? 0
  const naJanela = p.agendadoPara ? dentroDaJanela(p.agendadoPara, janelas) : false
  return [
    { chave: 'link', rotulo: 'Link rastreado gerado', ok: !!p.codigo, automatico: true, detalhe: p.codigo ? `Código ${p.codigo}` : 'O código sai quando a pauta ganha data e hora' },
    { chave: 'legenda', rotulo: `Legenda com ${TAMANHO_MIN_LEGENDA}+ caracteres`, ok: tamanho >= TAMANHO_MIN_LEGENDA, automatico: true, detalhe: `${tamanho} caracteres` },
    { chave: 'capaTexto', rotulo: 'Capa e texto na tela', ok: !!manual.capaTexto, automatico: false },
    {
      chave: 'janela', rotulo: 'Horário dentro da janela', automatico: true,
      ok: p.agendadoPara ? naJanela : false,
      detalhe: !p.agendadoPara ? 'Sem data e hora ainda' : naJanela === null ? 'Ainda sem posts suficientes para calcular as janelas' : undefined,
    },
  ]
}

// ---------- O que precisa para publicar ----------

export function pendenciasParaPublicar(p: Pick<SmPauta, 'formato' | 'agendadoPara' | 'legenda' | 'trial'>, midias: Pick<SmPautaMidia, 'tipo'>[], agora = new Date()): string[] {
  const falta: string[] = []
  if (!p.agendadoPara) falta.push('Defina a data e a hora da publicação')
  else if (p.agendadoPara.getTime() < agora.getTime() - 60_000) falta.push('A data da publicação já passou')
  if (p.formato !== 'STORY' && !p.legenda?.trim()) falta.push('Escreva a legenda')
  const imagens = midias.filter(m => m.tipo === 'IMAGEM').length
  const videos = midias.filter(m => m.tipo === 'VIDEO').length
  if (p.formato === 'REELS' && videos !== 1) falta.push('Reels precisa de 1 vídeo')
  if (p.formato === 'FOTO' && imagens !== 1) falta.push('Foto precisa de 1 imagem')
  if (p.formato === 'CARROSSEL' && (imagens + videos < 2 || imagens + videos > 10)) falta.push('Carrossel precisa de 2 a 10 arquivos')
  if (p.formato === 'STORY' && imagens + videos !== 1) falta.push('Story precisa de 1 imagem ou vídeo')
  if (p.trial && p.formato !== 'REELS') falta.push('Trial Reel só vale para Reels')
  return falta
}

// ---------- Avisos ----------

export async function notificar(usuarioId: string, destinatario: 'GESTOR' | 'SOCIAL_MEDIA', tipo: string, chave: string, titulo: string, texto: string, payload?: Prisma.InputJsonValue) {
  const aberta = await prisma.smNotificacao.findFirst({ where: { usuarioId, destinatario, chave, lidaEm: null } })
  if (aberta) {
    await prisma.smNotificacao.update({ where: { id: aberta.id }, data: { titulo, texto, ocorrencias: { increment: 1 }, payload } })
  } else {
    await prisma.smNotificacao.create({ data: { usuarioId, destinatario, tipo, chave, titulo, texto, payload } })
  }
  // Seção 11.5: aprovação e falhas também vão para o celular (agrupadas).
  await pulsoDoAviso(usuarioId, destinatario, tipo, chave, titulo, texto, payload).catch(e => console.error('[sm] pulso do aviso', e))
}

export async function marcarAvisosLidos(usuarioId: string, chave: string) {
  await prisma.smNotificacao.updateMany({ where: { usuarioId, chave, lidaEm: null }, data: { lidaEm: new Date() } })
}
