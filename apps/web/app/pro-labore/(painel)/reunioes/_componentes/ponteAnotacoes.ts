// Ponte entre as duas abas: apresentação de Reuniões (árvore do motor +
// configuração própria) <-> mapa mental das Anotações (board plano de
// objetos/conectores). Sempre gera uma CÓPIA — mexer numa não muda a outra.
import {
  TIPOS_BLOCO, type ArvoreApresentacao, type Bloco, type BoardConector, type BoardObjeto, type ConfiguracaoApresentacao,
} from '@/lib/proLaboreApi'
import { arvoreParaObjetosBoard, boardParaArvore } from '../../anotacoes/motor-mapa-mental/conversao'
import type { NoArvore } from '../../anotacoes/motor-mapa-mental/dados'

const TEMAS_MOTOR = ['meister', 'prism', 'ocean', 'sunset', 'noite']
// Limites da API de Anotações (ver mapaMentalSchema no backend).
export const LIMITE_IDEIAS_ANOTACOES = 500
const LIMITE_TEXTO_BLOCO = 5000

function contar(n: ArvoreApresentacao): number {
  return 1 + n.children.reduce((s, c) => s + contar(c), 0)
}

export function apresentacaoParaMapa(arvore: ArvoreApresentacao, cfg: ConfiguracaoApresentacao | null) {
  const total = contar(arvore)
  if (total > LIMITE_IDEIAS_ANOTACOES) {
    throw new Error(`Esse mapa tem ${total} ideias — nas Anotações cabem até ${LIMITE_IDEIAS_ANOTACOES} por mapa.`)
  }
  const { objetos, conectores } = arvoreParaObjetosBoard(arvore)
  const c = cfg ?? { layout: 'mind', tema: 'meister', doisLados: true }
  return {
    objetos, conectores,
    configuracao: {
      layout: c.layout === 'org' ? 'organograma' : c.layout === 'list' ? 'lista' : 'mapaMental',
      paleta: 'meister',
      temaMotor: TEMAS_MOTOR.includes(c.tema) ? c.tema : 'meister',
      doisLados: c.doisLados,
    } as Record<string, unknown>,
  }
}

// Só as ideias do mapa mental viajam pra apresentação; formas soltas,
// post-its etc. do board livre ficam de fora (`ignorados` avisa quantos).
export function mapaParaApresentacao(objetos: BoardObjeto[], conectores: BoardConector[], configuracao: Record<string, unknown> | null | undefined) {
  const { tree } = boardParaArvore(objetos, conectores)
  let n = 0
  const novoId = new Map<string, string>()
  // Ids novos e curtos (n1, n2…), no formato que o motor espera — levando
  // junto formatação, imagem e link de cada ideia.
  const renumerar = (no: NoArvore): ArvoreApresentacao => {
    const id = `n${++n}`
    novoId.set(no.id, id)
    return {
      id, text: no.text.slice(0, 2000), collapsed: no.collapsed, children: no.children.map(renumerar),
      ...(no.estilo ? { estilo: no.estilo } : {}), ...(no.imagem ? { imagem: no.imagem } : {}), ...(no.link ? { link: no.link } : {}),
    }
  }
  const arvore = renumerar(tree)
  const ligacoes = (tree.ligacoes ?? [])
    .filter(l => novoId.has(l.de) && novoId.has(l.para))
    .map(l => ({ id: l.id, de: novoId.get(l.de)!, para: novoId.get(l.para)! }))
  if (ligacoes.length) (arvore as ArvoreApresentacao & { ligacoes?: typeof ligacoes }).ligacoes = ligacoes
  if (tree.estiloNovas) (arvore as ArvoreApresentacao & { estiloNovas?: NoArvore['estiloNovas'] }).estiloNovas = tree.estiloNovas
  const layout = configuracao?.layout
  const tema = typeof configuracao?.temaMotor === 'string' ? configuracao.temaMotor : 'meister'
  return {
    arvore,
    ignorados: Math.max(0, objetos.length - n),
    configuracao: {
      layout: layout === 'organograma' ? 'org' : layout === 'lista' ? 'list' : 'mind',
      tema,
      doisLados: typeof configuracao?.doisLados === 'boolean' ? configuracao.doisLados : true,
    } as ConfiguracaoApresentacao,
  }
}

// Anotações compartilhadas da reunião (+ o "Só pra mim", se quiser levar)
// viram uma página de texto nas Anotações.
export function blocosParaPagina(notas: Bloco[], textoPessoal: string | null, rotuloPessoal: string): Bloco[] {
  const validos = new Set<string>(TIPOS_BLOCO)
  const blocos: Bloco[] = notas
    .filter(b => validos.has(b.tipo))
    .map(b => ({ ...b, texto: b.texto.slice(0, LIMITE_TEXTO_BLOCO) }))
  const pessoal = textoPessoal?.trim()
  if (pessoal) {
    if (blocos.length) blocos.push({ id: 'div-pessoal', tipo: 'divisor', texto: '' })
    blocos.push({ id: 'tit-pessoal', tipo: 'titulo2', texto: rotuloPessoal })
    pessoal.split('\n').forEach((linha, i) => blocos.push({ id: `pessoal-${i}`, tipo: 'paragrafo', texto: linha.slice(0, LIMITE_TEXTO_BLOCO) }))
  }
  return blocos.slice(0, 1000)
}

export function temConteudo(notas: Bloco[] | null | undefined): boolean {
  return (notas ?? []).some(b => b.texto.trim())
}
