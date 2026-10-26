// Aries no WhatsApp — funções puras da conversa: entender o que a pessoa
// escreveu (aqui não precisa de "?": toda mensagem é para o agente), quebrar
// a resposta em mensagens curtas e o tempo de "digitando..." de cada uma,
// no ritmo de uma pessoa. Os números saem do sistema (agenteRespostas.ts);
// a IA, quando ligada, só ajuda a classificar a pergunta.
import { interpretarPergunta, type Pergunta } from './assistentePessoal'
import { normalizar } from './assistenteRoteiro'

export type Intencao =
  | { tipo: 'VINCULAR'; codigo: string }
  | { tipo: 'SAUDACAO' }
  | { tipo: 'OBRIGADO' }
  | { tipo: 'AJUDA' }
  | { tipo: 'AGORA' }
  | { tipo: 'AGENDA'; amanha: boolean }
  | { tipo: 'PLANO' }
  | { tipo: 'ANOTAR'; titulo: string; horario: string | null; amanha: boolean }
  | { tipo: 'VENDAS' }
  | { tipo: 'EQUIPE' }
  | { tipo: 'TRAFEGO' }
  | { tipo: 'FINANCEIRO' }
  | { tipo: 'PAUSAR' }
  | { tipo: 'RETOMAR' }
  | { tipo: 'PESSOAL'; pergunta: Pergunta }

/** Intenções que só o dono pode pedir (números da loja inteira). */
export const SO_DONO = new Set<Intencao['tipo']>(['VENDAS', 'EQUIPE', 'TRAFEGO', 'FINANCEIRO'])
/** Rótulos que a IA pode devolver ao classificar uma mensagem livre. */
export const ROTULOS_IA = ['AGORA', 'AGENDA', 'PLANO', 'VENDAS', 'EQUIPE', 'TRAFEGO', 'FINANCEIRO', 'HOJE', 'SEMANA', 'MES', 'QUENTES', 'FOLLOWS', 'ESPERANDO', 'AJUDA', 'NENHUM'] as const

const SAUDACAO = /^(oi+e?|ola|ole|e ai|eai|opa|hey|salve|bom dia|boa tarde|boa noite|tudo bem|tudo bom|td bem)(\s+(aries|tudo bem|tudo bom|td bem))?$/
const PREFIXO_SAUDACAO = /^(oi+e?|ola|opa|bom dia|boa tarde|boa noite)\s*(aries)?\s*[,!.-]*\s+/
const OBRIGADO = /^(obrigad[oa]|muito obrigad[oa]|valeu|vlw|brigad[oa]|show|top|perfeito|beleza|blz|ok|okay|certo|tmj|fechou|massa|otimo)(\s+(aries|demais|mesmo))?$/

/** "15h", "15:30", "às 9h", "as 9:15" dentro de um texto → "HH:MM". */
function horarioNoTexto(n: string): { horario: string | null } {
  const m = n.match(/(?:^|\s)(?:as\s+|a\s+partir\s+das\s+)?(\d{1,2})(?::(\d{2})|h(\d{2})?)(?=\s|$)/)
  if (!m) return { horario: null }
  const h = Number(m[1]), min = Number(m[2] ?? m[3] ?? 0)
  return h > 23 || min > 59 ? { horario: null } : { horario: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}` }
}

export function entenderMensagem(bruto: string): Intencao | null {
  const original = bruto.trim()
  if (!original || original.length > 500) return null
  const codigo = original.match(/^aries\s*[-:#]?\s*(\d{6})$/i)
  if (codigo) return { tipo: 'VINCULAR', codigo: codigo[1] }

  let n = normalizar(original).replace(/[?!.…]+$/g, '').trim()
  const curta = n.replace(/[,;:!.]/g, ' ').replace(/\s+/g, ' ').trim()
  if (SAUDACAO.test(curta)) return { tipo: 'SAUDACAO' }
  if (OBRIGADO.test(curta)) return { tipo: 'OBRIGADO' }
  // "Bom dia, quem está esperando?" → a saudação não esconde o pedido.
  n = n.replace(PREFIXO_SAUDACAO, '').trim()
  const semSaudacao = original.replace(/^(oi+e?|olá|ola|opa|bom dia|boa tarde|boa noite)\s*(aries)?\s*[,!.-]*\s+/i, '').trim()

  if (/^(ajuda|menu|comandos|o que (voce|vc) (faz|sabe( fazer)?)|como (voce|vc) funciona|o que (eu )?posso (te )?perguntar)$/.test(n)) return { tipo: 'AJUDA' }
  if (/(para|pare|parar|chega) de (me )?(mandar|avisar|enviar)|sem avisos|(pausa|pausar|parar|pare|desliga|desligar|desativa|desativar) (os )?avisos|silencia/.test(n)) return { tipo: 'PAUSAR' }
  if (/(volta|voltar|pode voltar) a (me )?(avisar|mandar)|(liga|ligar|ativa|ativar|retoma|retomar|volta|voltar) (os )?avisos/.test(n)) return { tipo: 'RETOMAR' }

  const anotar = semSaudacao.match(/^(?:anota(?:r)?|anote|me lembr[ae] de|me lembrar de|lembra(?:r)? de|lembrete|adiciona(?:r)? na (?:minha )?agenda|coloca(?:r)? na (?:minha )?agenda|agenda(?:r)?)\s*:?\s+(.{2,200})$/i)
  if (anotar) {
    // \b não funciona depois do "ã": a borda é espaço, pontuação ou o fim.
    const amanha = /(?:^|\s)amanh[aã](?=$|[\s,.!?])/i.test(anotar[1])
    const { horario } = horarioNoTexto(normalizar(anotar[1]))
    // Mantém a grafia original (acentos, maiúsculas) e tira só "amanhã" e o horário.
    let titulo = anotar[1].replace(/(?:^|\s)(?:para |pra )?amanh[aã](?=$|[\s,.!?])/i, ' ')
    if (horario) titulo = titulo.replace(/(?:^|\s)(?:[àa]s\s+|a\s+partir\s+das\s+)?\d{1,2}(?::\d{2}|h(?:\d{2})?)(?=\s|$)/i, ' ')
    titulo = titulo.replace(/\s+/g, ' ').replace(/^[,:\s-]+|[,:\s-]+$/g, '').trim()
    if (titulo.length >= 2) return { tipo: 'ANOTAR', titulo: titulo.charAt(0).toUpperCase() + titulo.slice(1), horario, amanha }
  }

  if (/(quem (eu )?(atendo|atender|chamo|respondo) (primeiro|agora)|por onde (eu )?comec|o que (eu )?(faco|fazer) (agora|primeiro)|minhas? prioridades?|^prioridades?$|^fila$|quem (esta|ta) pedindo atencao)/.test(n)) return { tipo: 'AGORA' }
  if (/(minha agenda|^agenda( (de|pra|para) (hoje|amanha))?$|o que (eu )?tenho (pra|para|hoje|amanha)|^meu dia$|(meus )?compromissos|minhas tarefas|tarefas (de|pra|para) (hoje|amanha)|agenda (de|pra|para) amanha)/.test(n)) return { tipo: 'AGENDA', amanha: /amanha/.test(n) }
  if (/(meu plano|plano (do dia|de hoje)|^plano$|o que o copiloto)/.test(n)) return { tipo: 'PLANO' }

  if (/(vendas? (da loja|do mes|de hoje|da semana|da equipe)|quanto (a gente |nos |a loja )?(vend|fatur)|faturamento|faturei|faturou|quantas motos (vendemos|saiu|sairam))/.test(n)) return { tipo: 'VENDAS' }
  if (/(como (esta|ta) (a )?(equipe|time)|^(equipe|time|ranking)$|ranking|desempenho (da equipe|do time|dos vendedores)|quem (esta|ta) (melhor|pior|vendendo mais))/.test(n)) return { tipo: 'EQUIPE' }
  if (/(trafego|anuncios?|campanhas?|meta ads|custo por lead|\bcpl\b|gasto com anuncio)/.test(n)) return { tipo: 'TRAFEGO' }
  if (/(financeiro|pagamentos?|despesas?|gastos do mes|quanto (eu )?paguei|salarios?)/.test(n)) return { tipo: 'FINANCEIRO' }

  // As perguntas do assistente pessoal (o chat "Você"), sem precisar do "?".
  const pergunta = interpretarPergunta(/[?]$/.test(semSaudacao) ? semSaudacao : `${semSaudacao}?`)
  if (pergunta && pergunta.tipo !== 'AJUDA') return { tipo: 'PESSOAL', pergunta }
  return null
}

/** Rótulo devolvido pela IA → intenção (só os rótulos conhecidos). */
export function intencaoDoRotulo(rotulo: string): Intencao | null {
  switch (rotulo) {
    case 'AGORA': case 'PLANO': case 'VENDAS': case 'EQUIPE': case 'TRAFEGO': case 'FINANCEIRO': case 'AJUDA': return { tipo: rotulo }
    case 'AGENDA': return { tipo: 'AGENDA', amanha: false }
    case 'HOJE': case 'SEMANA': case 'MES': case 'QUENTES': case 'FOLLOWS': case 'ESPERANDO': return { tipo: 'PESSOAL', pergunta: { tipo: rotulo } }
    default: return null
  }
}

/**
 * Quebra a resposta em até `max` mensagens, pelos parágrafos, como alguém
 * que manda em partes em vez de um textão (cada parte até ~700 caracteres).
 */
export function emPartes(texto: string, max = 3, limite = 700): string[] {
  const blocos = texto.split(/\n{2,}/).map(b => b.trim()).filter(Boolean)
  const partes: string[] = []
  for (const b of blocos) {
    const ultima = partes[partes.length - 1]
    // Título curto ("*Seu dia*") fica junto do bloco seguinte.
    if (ultima !== undefined && (ultima.length < 60 || ultima.length + b.length + 2 <= limite / 2)) partes[partes.length - 1] = `${ultima}\n\n${b}`
    else partes.push(b)
  }
  while (partes.length > max) { const fim = partes.pop()!; partes[partes.length - 1] += `\n\n${fim}` }
  return partes.length ? partes : [texto.trim()]
}

/** Tempo de "digitando..." proporcional ao tamanho, entre 1,2 s e 6 s. */
export const tempoDigitando = (texto: string) => Math.min(6000, Math.max(1200, 700 + texto.length * 28))

export function saudacaoDoHorario(agora = new Date()): string {
  const h = new Date(agora.getTime() - 3 * 3600e3).getUTCHours()
  return h >= 5 && h < 12 ? 'Bom dia' : h >= 12 && h < 18 ? 'Boa tarde' : 'Boa noite'
}

/** Escolha estável entre variações (mesma semente, mesma frase): conversa menos robótica, teste previsível. */
export function variar<T>(opcoes: readonly T[], semente: string): T {
  let h = 0
  for (const c of semente) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return opcoes[h % opcoes.length]
}

/** Código de vínculo: 6 dígitos, sem começar por zero. */
export const novoCodigo = (aleatorio: () => number = Math.random) => String(100000 + Math.floor(aleatorio() * 900000))

export function textoAjuda(nome: string, dono: boolean): string {
  return [
    `Posso te ajudar com isso, ${nome}:`,
    [
      '• *quem atendo agora?* — quem está esperando e os sinais de compra',
      '• *minha agenda* (ou *agenda de amanhã*) — rotinas, follows e tarefas',
      '• *anota: ligar pro banco às 15h* — eu coloco na sua agenda',
      '• *como estou hoje?* / *minha semana?* / *meu mês?*',
      '• *leads quentes?* / *meus follows?* / *como está a Ana?*',
      '• *ficha da CG 160* / *simular CG 160 entrada 3 mil*',
      ...(dono ? ['• *vendas do mês* / *como está a equipe?* / *tráfego* / *financeiro*'] : []),
    ].join('\n'),
    'Se não quiser os avisos, é só dizer *parar avisos*.',
  ].join('\n\n')
}
