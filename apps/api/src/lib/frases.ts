// PDF 06 · 5.2: frases e lições de grandes nomes. O ARIES nunca inventa nem
// atribui uma frase por conta própria: só exibe frases da biblioteca, cada uma
// com autor e fonte, aprovadas e ligadas pelo dono. Escolhe pelo momento do
// negócio e não repete a mesma frase em menos de 30 dias. O ARIES pode sugerir
// frases novas (com autor e fonte), que só entram depois da aprovação do dono.
// A biblioteca começa com um conjunto inicial DESLIGADO, para o dono revisar.
import { prisma } from './prisma'

const DIA = 86_400_000
export const TEMAS = ['constância', 'foco', 'liderança', 'vendas', 'superação', 'cliente'] as const
export type Tema = typeof TEMAS[number]
export class ErroFrase extends Error { constructor(public status: number, m: string) { super(m) } }

// Conjunto inicial (tradução livre): frases conhecidas, com a fonte de onde saíram.
// Ficam desligadas e sem aprovação até o dono conferir uma por uma.
export const CONJUNTO_INICIAL: Array<{ texto: string; autor: string; fonte: string; temas: Tema[] }> = [
  { texto: 'O bom é inimigo do ótimo.', autor: 'Jim Collins', fonte: 'Empresas Feitas para Vencer (Good to Great), 2001 — primeira frase do livro; tradução livre', temas: ['foco', 'liderança'] },
  { texto: 'A única maneira de fazer um excelente trabalho é amar o que você faz.', autor: 'Steve Jobs', fonte: 'Discurso de formatura na Universidade Stanford, 12 de junho de 2005; tradução livre', temas: ['superação'] },
  { texto: 'Só existe uma definição válida para o propósito de uma empresa: criar um cliente.', autor: 'Peter Drucker', fonte: 'The Practice of Management (A Prática da Administração), 1954; tradução livre', temas: ['vendas', 'cliente'] },
  { texto: 'Executivos eficazes fazem primeiro as coisas mais importantes, e uma de cada vez.', autor: 'Peter Drucker', fonte: 'The Effective Executive (O Executivo Eficaz), 1967; tradução livre', temas: ['foco'] },
  { texto: 'Procure primeiro compreender, depois ser compreendido.', autor: 'Stephen R. Covey', fonte: 'Os 7 Hábitos das Pessoas Altamente Eficazes, 1989 — hábito 5', temas: ['vendas', 'cliente'] },
  { texto: 'Comece com o objetivo em mente.', autor: 'Stephen R. Covey', fonte: 'Os 7 Hábitos das Pessoas Altamente Eficazes, 1989 — hábito 2', temas: ['foco', 'constância'] },
  { texto: 'Lembre-se de que o nome de uma pessoa é, para ela, o som mais doce e mais importante em qualquer idioma.', autor: 'Dale Carnegie', fonte: 'Como Fazer Amigos e Influenciar Pessoas, 1936', temas: ['vendas', 'cliente'] },
  { texto: 'As pessoas não compram o que você faz; elas compram o porquê de você fazer.', autor: 'Simon Sinek', fonte: 'Comece pelo Porquê (Start with Why), 2009; tradução livre', temas: ['vendas', 'liderança'] },
  { texto: 'Dor mais reflexão é igual a progresso.', autor: 'Ray Dalio', fonte: 'Princípios (Principles), 2017 — "Pain + Reflection = Progress"; tradução livre', temas: ['superação', 'constância'] },
  { texto: 'Tudo gira em torno do longo prazo.', autor: 'Jeff Bezos', fonte: 'Carta aos acionistas da Amazon, 1997 — seção "It\'s All About the Long Term"; tradução livre', temas: ['constância', 'liderança'] },
  { texto: 'Só os paranoicos sobrevivem.', autor: 'Andrew S. Grove', fonte: 'Only the Paranoid Survive (Só os Paranoicos Sobrevivem), 1996 — título do livro', temas: ['foco', 'liderança'] },
  { texto: 'Sonhar grande e sonhar pequeno dá o mesmo trabalho.', autor: 'Jorge Paulo Lemann', fonte: 'Citado em Sonho Grande, de Cristiane Correa, 2013', temas: ['liderança', 'superação'] },
]

/** Lista da biblioteca; na primeira vez, cria o conjunto inicial desligado para o dono revisar. */
export async function listarFrases(usuarioId: string) {
  const n = await prisma.fraseBiblioteca.count({ where: { usuarioId } })
  if (!n) await prisma.fraseBiblioteca.createMany({ data: CONJUNTO_INICIAL.map(f => ({ usuarioId, ...f, ativa: false, origem: 'INICIAL' })) })
  return prisma.fraseBiblioteca.findMany({ where: { usuarioId }, orderBy: [{ ativa: 'desc' }, { criadoEm: 'asc' }] })
}

export interface DadosFrase { texto: string; autor: string; fonte: string; temas: string[] }
function validar(d: DadosFrase) {
  const texto = d.texto.trim(), autor = d.autor.trim(), fonte = d.fonte.trim()
  if (texto.length < 5) throw new ErroFrase(400, 'Escreva a frase')
  if (autor.length < 2) throw new ErroFrase(400, 'Toda frase precisa do autor')
  if (fonte.length < 3) throw new ErroFrase(400, 'Toda frase precisa da fonte (livro, discurso, entrevista)')
  const temas = d.temas.filter(t => (TEMAS as readonly string[]).includes(t))
  return { texto: texto.slice(0, 400), autor: autor.slice(0, 120), fonte: fonte.slice(0, 300), temas }
}
/** O dono cadastra: já entra aprovada por ele (e ligada, se quiser). */
export async function criarFrase(usuarioId: string, quem: string, d: DadosFrase & { ativa?: boolean }) {
  const v = validar(d)
  return prisma.fraseBiblioteca.create({ data: { usuarioId, ...v, origem: 'DONO', ativa: d.ativa ?? true, aprovadaPor: quem, aprovadaEm: new Date() } })
}
export async function editarFrase(usuarioId: string, id: string, quem: string, d: Partial<DadosFrase> & { ativa?: boolean; aprovar?: boolean }) {
  const f = await prisma.fraseBiblioteca.findFirst({ where: { id, usuarioId } })
  if (!f) throw new ErroFrase(404, 'Frase não encontrada')
  const v = validar({ texto: d.texto ?? f.texto, autor: d.autor ?? f.autor, fonte: d.fonte ?? f.fonte, temas: d.temas ?? f.temas })
  const mudouTexto = v.texto !== f.texto || v.autor !== f.autor || v.fonte !== f.fonte
  // Ligar exige aprovação; aprovar é sempre do dono. Mudar o texto, o autor ou a fonte de uma frase do ARIES pede nova aprovação.
  const aprovada = d.aprovar ? true : mudouTexto && f.origem === 'ARIES' ? false : !!f.aprovadaEm
  const ativa = d.ativa ?? f.ativa
  if (ativa && !aprovada && !d.aprovar) throw new ErroFrase(409, 'Aprove a frase (confira o autor e a fonte) antes de ligar')
  return prisma.fraseBiblioteca.update({ where: { id }, data: { ...v, ativa, ...(aprovada ? { aprovadaPor: d.aprovar ? quem : f.aprovadaPor ?? quem, aprovadaEm: d.aprovar ? new Date() : f.aprovadaEm ?? new Date() } : { aprovadaPor: null, aprovadaEm: null }) } })
}
/** Sugestão do ARIES: entra desligada e sem aprovação, com autor e fonte para o dono conferir. */
export async function sugerirFrase(usuarioId: string, d: DadosFrase) {
  const v = validar(d)
  const ja = await prisma.fraseBiblioteca.findFirst({ where: { usuarioId, texto: v.texto } })
  if (ja) return ja
  return prisma.fraseBiblioteca.create({ data: { usuarioId, ...v, origem: 'ARIES', ativa: false } })
}

/** Tema que combina com o momento: queda pede constância; muitas pendências, foco; dia bom, vendas e liderança. */
export function temaDoMomento(m: { metaFaixa: string | null; pendencias: number; queda: boolean }): Tema[] {
  if (m.queda || m.metaFaixa === 'CRITICO') return ['constância', 'superação']
  if (m.pendencias >= 8) return ['foco']
  if (m.metaFaixa === 'ATENCAO') return ['foco', 'constância']
  return ['vendas', 'liderança', 'cliente']
}

/**
 * Frase do dia da conta (a mesma para todos no dia): só aprovada e ligada, nunca
 * repetida em menos de 30 dias, preferindo o tema do momento. Sem frase possível, nada aparece.
 */
export async function fraseDoDia(usuarioId: string, dia: string, temas: Tema[]) {
  const uso = await prisma.fraseUso.findUnique({ where: { usuarioId_dia: { usuarioId, dia } } })
  if (uso) {
    const f = await prisma.fraseBiblioteca.findFirst({ where: { id: uso.fraseId, usuarioId } })
    return f && f.ativa && f.aprovadaEm ? f : null
  }
  const limite = new Date(new Date(`${dia}T12:00:00Z`).getTime() - 30 * DIA).toISOString().slice(0, 10)
  const recentes = new Set((await prisma.fraseUso.findMany({ where: { usuarioId, dia: { gt: limite } }, select: { fraseId: true } })).map(u => u.fraseId))
  const livres = (await prisma.fraseBiblioteca.findMany({ where: { usuarioId, ativa: true, aprovadaEm: { not: null } }, orderBy: [{ ultimaVezUsada: { sort: 'asc', nulls: 'first' } }, { criadoEm: 'asc' }] })).filter(f => !recentes.has(f.id))
  if (!livres.length) return null
  const escolhida = livres.find(f => f.temas.some(t => temas.includes(t as Tema))) ?? livres[0]
  try {
    await prisma.fraseUso.create({ data: { usuarioId, fraseId: escolhida.id, dia } })
  } catch {
    // Outra tela escolheu no mesmo instante: vale a que foi gravada.
    return fraseDoDia(usuarioId, dia, temas)
  }
  await prisma.fraseBiblioteca.update({ where: { id: escolhida.id }, data: { ultimaVezUsada: new Date(`${dia}T12:00:00Z`) } })
  return escolhida
}
