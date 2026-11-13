// PDF 06 · 5.2: o ARIES pode sugerir frases novas para a biblioteca, sempre com
// autor e fonte. A sugestão entra desligada e sem aprovação: só aparece no Hoje
// depois que o dono confere o autor e a fonte e aprova (governança do conhecimento).
// Nada da loja vai para a IA: só o tema pedido.
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { prisma } from './prisma'
import { iaLigada } from './smIA'
import { esforco, modeloDa } from './iaModelo'
import { sugerirFrase, type Tema } from './frases'

const MODELO = modeloDa('COPILOTO')
let cliente: Anthropic | null = null
const anthropic = () => (cliente ??= new Anthropic({ timeout: 20_000, maxRetries: 0 }))

const esquema = z.object({ frases: z.array(z.object({ texto: z.string(), autor: z.string(), fonte: z.string() })).max(3) })

export async function sugerirFrasesComIa(usuarioId: string, tema: Tema) {
  if (!iaLigada()) return { sugeridas: [], aviso: 'A IA não está ligada: cadastre as frases à mão.' }
  const sistema = [
    'Você sugere frases curtas de grandes empresários, executivos ou pensadores para uma loja de motos, em português do Brasil.',
    'Só sugira frases que você tem certeza de que a pessoa disse ou escreveu, com a fonte exata (livro e ano, discurso, carta, entrevista). Se não tiver certeza da autoria, não sugira.',
    'Nunca atribua a alguém uma frase de autoria duvidosa ou apócrifa. Na fonte, diga se é tradução livre.',
    'Devolva no máximo 3 frases. O dono vai conferir cada uma antes de usar.',
  ].join('\n')
  const usuario = `Tema: ${tema}`
  await prisma.iaEnvio.create({ data: { usuarioId, conversaId: null, finalidade: 'SUGERIR_FRASES', conteudo: `${sistema}\n\n${usuario}` } })
  try {
    const r = await anthropic().messages.parse({ model: MODELO, max_tokens: 700, system: sistema, messages: [{ role: 'user', content: usuario }], output_config: { ...esforco(MODELO), format: zodOutputFormat(esquema) } })
    const lista = r.parsed_output?.frases ?? []
    const sugeridas = []
    for (const f of lista) {
      try { sugeridas.push(await sugerirFrase(usuarioId, { ...f, temas: [tema] })) } catch { /* sem autor ou fonte: descarta */ }
    }
    return { sugeridas, aviso: 'Sugestões do ARIES: confira o autor e a fonte de cada uma antes de aprovar.' }
  } catch (e) {
    console.warn('[frases-ia]', e instanceof Error ? e.message : e)
    return { sugeridas: [], aviso: 'Não deu para sugerir agora.' }
  }
}
