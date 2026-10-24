// Motor do roteiro de pré-atendimento — funções puras (sem banco, sem
// WhatsApp), usadas tanto pelo webhook de verdade quanto pelo simulador da
// tela. Sem IA por enquanto: o assistente segue um roteiro de perguntas
// configurável, reconhece pedido de atendente/desistência por palavras-chave
// e entrega um resumo pronto pro vendedor.

export const CAMPOS_LEAD = ['modeloInteresse', 'formaPagamento', 'valorEntrada', 'veiculoTroca', 'cidade', 'melhorHorario', 'nomeCompleto', 'outro'] as const
export type CampoLead = (typeof CAMPOS_LEAD)[number]

export interface PerguntaRoteiro {
  id: string
  rotulo: string // nome curto usado no resumo pro vendedor e no CRM
  texto: string
  campo: CampoLead
  opcoes?: string[]
}

export interface ConfigAssistente {
  nomeEmpresa: string
  // Responder também quem chama pela primeira vez sem vir de anúncio nem
  // usar uma frase de campanha (ex.: achou o número no Instagram).
  responderContatosNovos: boolean
  gatilhos: string[]
  mensagemBoasVindas: string
  perguntas: PerguntaRoteiro[]
  mensagemEncerramento: string
  mensagemAtendente: string
  mensagemDespedida: string
  avisarVendedor: boolean
  criarLeadNoCrm: boolean
  atrasoSegundos: number
  // Assistente pessoal no chat "Você": avisa lead esperando há N min (0 =
  // desligado) e manda o resumo da manhã.
  alertaEsperaMin: number
  resumoManha: boolean
}

export const CONFIG_PADRAO: ConfigAssistente = {
  nomeEmpresa: '',
  responderContatosNovos: true,
  gatilhos: ['tenho interesse', 'quero saber mais', 'vi o anúncio', 'vi o anuncio', 'mais informações'],
  mensagemBoasVindas: 'Olá, {nome}! 👋 Aqui é o assistente virtual de {vendedor}{ da empresa}. Vou te fazer umas perguntas rápidas pra {vendedor} já te atender com tudo em mãos.',
  perguntas: [
    { id: 'interesse', rotulo: 'Veículo de interesse', campo: 'modeloInteresse', texto: 'Qual veículo te interessou? Pode mandar o modelo, o ano ou o anúncio que você viu.' },
    { id: 'pagamento', rotulo: 'Forma de pagamento', campo: 'formaPagamento', texto: 'Como você pensa em pagar?', opcoes: ['À vista', 'Financiado', 'Tenho um veículo pra dar na troca'] },
    { id: 'entrada', rotulo: 'Entrada', campo: 'valorEntrada', texto: 'Tem algum valor de entrada em mente? Se ainda não tiver, pode responder "não".' },
    { id: 'horario', rotulo: 'Melhor horário', campo: 'melhorHorario', texto: 'Qual o melhor horário pra {vendedor} te chamar?' },
  ],
  mensagemEncerramento: 'Perfeito, anotei tudo! ✅ Já passei suas respostas pra {vendedor}, que vai te chamar por aqui em instantes.',
  mensagemAtendente: 'Claro! Já avisei {vendedor}, que vai continuar o atendimento com você por aqui em instantes. 🙂',
  mensagemDespedida: 'Tudo bem, não vou mais te mandar mensagens. Se mudar de ideia, é só chamar por aqui. 👍',
  avisarVendedor: true,
  criarLeadNoCrm: true,
  atrasoSegundos: 3,
  alertaEsperaMin: 10,
  resumoManha: true,
}

// Mescla o que está salvo com o padrão — config antiga (ou incompleta)
// nunca quebra o fluxo.
export function lerConfig(salva: unknown): ConfigAssistente {
  const c = (salva && typeof salva === 'object' ? salva : {}) as Partial<ConfigAssistente>
  const perguntas = Array.isArray(c.perguntas)
    ? c.perguntas.filter(p => p && typeof p.texto === 'string' && p.texto.trim()).map((p, i) => ({
      id: String(p.id || `p${i + 1}`),
      rotulo: String(p.rotulo || p.texto).slice(0, 60),
      texto: String(p.texto),
      campo: (CAMPOS_LEAD as readonly string[]).includes(p.campo) ? p.campo : 'outro',
      opcoes: Array.isArray(p.opcoes) ? p.opcoes.map(String).map(o => o.trim()).filter(Boolean).slice(0, 9) : undefined,
    }))
    : CONFIG_PADRAO.perguntas
  const texto = (v: unknown, padrao: string) => (typeof v === 'string' && v.trim() ? v : padrao)
  return {
    nomeEmpresa: typeof c.nomeEmpresa === 'string' ? c.nomeEmpresa.trim() : CONFIG_PADRAO.nomeEmpresa,
    responderContatosNovos: typeof c.responderContatosNovos === 'boolean' ? c.responderContatosNovos : CONFIG_PADRAO.responderContatosNovos,
    gatilhos: Array.isArray(c.gatilhos) ? c.gatilhos.map(String).map(g => g.trim()).filter(Boolean) : CONFIG_PADRAO.gatilhos,
    mensagemBoasVindas: texto(c.mensagemBoasVindas, CONFIG_PADRAO.mensagemBoasVindas),
    perguntas,
    mensagemEncerramento: texto(c.mensagemEncerramento, CONFIG_PADRAO.mensagemEncerramento),
    mensagemAtendente: texto(c.mensagemAtendente, CONFIG_PADRAO.mensagemAtendente),
    mensagemDespedida: texto(c.mensagemDespedida, CONFIG_PADRAO.mensagemDespedida),
    avisarVendedor: typeof c.avisarVendedor === 'boolean' ? c.avisarVendedor : CONFIG_PADRAO.avisarVendedor,
    criarLeadNoCrm: typeof c.criarLeadNoCrm === 'boolean' ? c.criarLeadNoCrm : CONFIG_PADRAO.criarLeadNoCrm,
    atrasoSegundos: Math.min(15, Math.max(0, Number(c.atrasoSegundos ?? CONFIG_PADRAO.atrasoSegundos) || 0)),
    alertaEsperaMin: Math.min(120, Math.max(0, Math.round(Number(c.alertaEsperaMin ?? CONFIG_PADRAO.alertaEsperaMin)) || 0)),
    resumoManha: typeof c.resumoManha === 'boolean' ? c.resumoManha : CONFIG_PADRAO.resumoManha,
  }
}

export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

// Primeiro nome "apresentável" do contato — nome de perfil do WhatsApp às
// vezes é emoji, apelido com símbolo ou o próprio número.
export function primeiroNome(nome: string | null | undefined): string {
  const palavra = (nome ?? '').trim().split(/\s+/)[0] ?? ''
  const limpa = palavra.replace(/[^\p{L}'-]/gu, '')
  if (limpa.length < 2) return ''
  return limpa.charAt(0).toUpperCase() + limpa.slice(1).toLowerCase()
}

export interface ContextoRoteiro { nomeContato: string; vendedor: string; empresa: string }

// Placeholders: {nome}, {vendedor}, {empresa}. Trechos entre chaves com
// texto em volta — "{ da empresa}" — somem inteiros quando o valor não
// existe, pra não sobrar "Olá, !" nem "de Ana da ".
export function preencher(modelo: string, ctx: ContextoRoteiro): string {
  const valores: Record<string, string> = { nome: primeiroNome(ctx.nomeContato), vendedor: primeiroNome(ctx.vendedor) || ctx.vendedor.trim(), empresa: ctx.empresa.trim() }
  let r = modelo.replace(/\{ da empresa\}/g, valores.empresa ? ` da ${valores.empresa}` : '')
  if (!valores.nome) r = r.replace(/,\s*\{nome\}/g, '').replace(/\s*\{nome\}/g, '')
  r = r.replace(/\{(nome|vendedor|empresa)\}/g, (_, k: string) => valores[k] ?? '')
  return r.replace(/[ \t]+([,.!?])/g, '$1').replace(/[ \t]{2,}/g, ' ').trim()
}

const NUMEROS_EMOJI = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣']

export function textoPergunta(p: PerguntaRoteiro, ctx: ContextoRoteiro): string {
  const base = preencher(p.texto, ctx)
  if (!p.opcoes?.length) return base
  return `${base}\n\n${p.opcoes.map((o, i) => `${NUMEROS_EMOJI[i]} ${o}`).join('\n')}`
}

// Resposta a uma pergunta com opções: aceita o número ("2", "2️⃣", "opção 2")
// ou o texto da opção; qualquer outra coisa fica como o contato escreveu.
export function interpretarResposta(p: PerguntaRoteiro, texto: string): string {
  const bruto = texto.trim()
  if (!p.opcoes?.length) return bruto
  const n = normalizar(bruto)
  const emoji = NUMEROS_EMOJI.findIndex(e => bruto.startsWith(e))
  if (emoji >= 0 && emoji < p.opcoes.length) return p.opcoes[emoji]
  const numero = n.match(/^(?:opcao\s*)?(\d)\b/)
  if (numero) {
    const i = Number(numero[1]) - 1
    if (i >= 0 && i < p.opcoes.length) return p.opcoes[i]
  }
  const achada = p.opcoes.find(o => n.includes(normalizar(o)) || normalizar(o).startsWith(n) && n.length >= 4)
  return achada ?? bruto
}

const PEDE_ATENDENTE = [/\batendente\b/, /\bhumano\b/, /\bpessoa de verdade\b/, /\bfalar com (o |a )?(vendedor|vendedora|alguem|uma pessoa|atendente)\b/, /\bme (liga|ligue|ligar)\b/, /\bpode me ligar\b/]
const DESISTE = [/^(parar|pare|sair|cancelar|stop|remover)\b/, /\bnao (quero|tenho) (mais )?interesse\b/, /\bnao me mande\b/, /\bpara de (me )?mandar\b/, /^nao quero$/]

export function pedeAtendente(texto: string): boolean {
  const n = normalizar(texto)
  return PEDE_ATENDENTE.some(r => r.test(n))
}

export function desiste(texto: string): boolean {
  const n = normalizar(texto)
  return n.length <= 60 && DESISTE.some(r => r.test(n))
}

export function casaGatilho(texto: string, gatilhos: string[]): string | null {
  const n = normalizar(texto)
  return gatilhos.find(g => {
    const ng = normalizar(g)
    return ng.length >= 3 && n.includes(ng)
  }) ?? null
}

export type Desfecho = 'QUALIFICADO' | 'PEDIU_ATENDENTE' | 'DESISTIU'
export interface EstadoRoteiro { etapa: number; respostas: Record<string, string> }
// Foto (vitrine do estoque) enviada antes de mensagens[antesDe], com a ficha na legenda.
export interface MidiaPasso { url: string; legenda: string; antesDe: number }
export interface PassoRoteiro {
  mensagens: string[]
  estado: EstadoRoteiro
  desfecho: Desfecho | null
  conhecimentoUsado?: string | null
  motoUsada?: string | null
  midias?: MidiaPasso[]
}

// Respostas aprovadas da base de conhecimento: quando o cliente pergunta
// algo no meio do roteiro, o assistente responde com o texto da loja e
// volta para a pergunta em que estava. `usados` evita repetir a mesma;
// `resto` é o que a mensagem tem além da pergunta ("A CG 160, aceita
// troca?" → "A CG 160"), que ainda vale como resposta do roteiro.
// Da vitrine: `motoId`, a `foto` de capa e `valeComo` (a moto pedida já
// responde "Qual veículo te interessou?").
export interface RespostaDaBase { id: string; texto: string; resto: string; motoId?: string; foto?: string | null; valeComo?: { campo: CampoLead; valor: string } }
export interface BaseRespostas { responder: (texto: string, usados: string[]) => RespostaDaBase | null }
const usadosDaBase = (respostas: Record<string, string>) => (respostas._kb ?? '').split(',').filter(Boolean)

// Resposta da base seguida de outra mensagem do roteiro: a pergunta do fim
// da resposta sai, pra não chegarem duas perguntas no mesmo balão.
export function semPerguntaFinal(texto: string): string {
  const t = texto.trim()
  return t.match(/^([\s\S]*[.!])\s+[^.!?\n]*\?$/)?.[1].trim() ?? t
}

// Resposta da base na frente da próxima mensagem do roteiro: no mesmo balão,
// ou como legenda da foto enviada antes dela.
function comResposta(daBase: RespostaDaBase | null, mensagens: string[], antesDe = 0): Pick<PassoRoteiro, 'mensagens' | 'midias' | 'conhecimentoUsado' | 'motoUsada'> {
  const usado = { conhecimentoUsado: daBase && !daBase.motoId ? daBase.id : null, motoUsada: daBase?.motoId ?? null }
  if (!daBase) return { mensagens, ...usado }
  if (daBase.foto) return { mensagens, midias: [{ url: daBase.foto, legenda: daBase.texto, antesDe }], ...usado }
  const i = Math.min(antesDe, mensagens.length - 1)
  return { mensagens: mensagens.map((m, j) => (j === i ? `${semPerguntaFinal(daBase.texto)}\n\n${m}` : m)), ...usado }
}

function tambemResponde(p: PerguntaRoteiro, texto: string, daBase: RespostaDaBase): boolean {
  if (p.opcoes?.length) return p.opcoes.includes(interpretarResposta(p, texto))
  return !!daBase.resto
}

export function iniciarRoteiro(cfg: ConfigAssistente, ctx: ContextoRoteiro, textoInicial: string, base?: BaseRespostas): PassoRoteiro {
  const estado: EstadoRoteiro = { etapa: 0, respostas: { _inicial: textoInicial.trim() } }
  if (desiste(textoInicial)) return { mensagens: [preencher(cfg.mensagemDespedida, ctx)], estado, desfecho: 'DESISTIU' }
  const boasVindas = preencher(cfg.mensagemBoasVindas, ctx)
  if (pedeAtendente(textoInicial)) {
    return { mensagens: [preencher(cfg.mensagemAtendente, ctx)], estado, desfecho: 'PEDIU_ATENDENTE' }
  }
  // Primeira mensagem já com uma dúvida ("Aceita troca?", "Tem a XRE?"): responde junto.
  const daBase = base?.responder(textoInicial, []) ?? null
  if (daBase) estado.respostas._kb = daBase.id
  // A moto pedida já responde a primeira pergunta ("Qual veículo te interessou?").
  const p0 = cfg.perguntas[0]
  if (p0 && daBase?.valeComo?.campo === p0.campo) {
    estado.respostas[p0.id] = daBase.valeComo.valor
    estado.etapa = 1
  }
  const proxima = cfg.perguntas[estado.etapa]
  const fim = proxima ? null : preencher(cfg.mensagemEncerramento, ctx)
  if (daBase?.foto) {
    // Com foto: boas-vindas, a foto com a ficha e, depois, a pergunta.
    return { ...comResposta(daBase, [boasVindas, proxima ? textoPergunta(proxima, ctx) : fim!], 1), estado, desfecho: proxima ? null : 'QUALIFICADO' }
  }
  const abertura = daBase ? `${boasVindas}\n\n${semPerguntaFinal(daBase.texto)}` : boasVindas
  const usado = comResposta(daBase, [])
  if (!proxima) return { mensagens: [abertura, fim!], estado, desfecho: 'QUALIFICADO', conhecimentoUsado: usado.conhecimentoUsado, motoUsada: usado.motoUsada }
  // Boas-vindas e primeira pergunta num balão só: se fossem dois, uma
  // resposta rápida no meio viraria resposta de uma pergunta ainda não feita.
  return { mensagens: [`${abertura}\n\n${textoPergunta(proxima, ctx)}`], estado, desfecho: null, conhecimentoUsado: usado.conhecimentoUsado, motoUsada: usado.motoUsada }
}

export function avancarRoteiro(cfg: ConfigAssistente, atual: EstadoRoteiro, texto: string, ctx: ContextoRoteiro, base?: BaseRespostas): PassoRoteiro {
  const estado: EstadoRoteiro = { etapa: atual.etapa, respostas: { ...atual.respostas } }
  if (desiste(texto)) return { mensagens: [preencher(cfg.mensagemDespedida, ctx)], estado, desfecho: 'DESISTIU' }
  const pergunta = cfg.perguntas[estado.etapa]
  const usados = usadosDaBase(estado.respostas)
  const daBase = base?.responder(texto, usados) ?? null
  if (daBase) estado.respostas._kb = [...usados, daBase.id].join(',')
  const valeComo = pergunta && daBase?.valeComo?.campo === pergunta.campo ? daBase.valeComo.valor : null
  // O cliente só perguntou, sem responder: resposta da loja e a mesma
  // pergunta de novo (a etapa não anda).
  if (pergunta && daBase && !valeComo && !pedeAtendente(texto) && !tambemResponde(pergunta, texto, daBase)) {
    return { ...comResposta(daBase, [textoPergunta(pergunta, ctx)]), estado, desfecho: null }
  }
  // "Pode me ligar às 18h" responde a pergunta E pede atendimento — guarda
  // a resposta antes de passar a conversa pro vendedor.
  if (pergunta) estado.respostas[pergunta.id] = valeComo ?? interpretarResposta(pergunta, texto)
  if (pedeAtendente(texto)) return { ...comResposta(daBase, [preencher(cfg.mensagemAtendente, ctx)]), estado, desfecho: 'PEDIU_ATENDENTE' }

  estado.etapa += 1
  const proxima = cfg.perguntas[estado.etapa]
  if (proxima) return { ...comResposta(daBase, [textoPergunta(proxima, ctx)]), estado, desfecho: null }
  return { ...comResposta(daBase, [preencher(cfg.mensagemEncerramento, ctx)]), estado, desfecho: 'QUALIFICADO' }
}

// Contato mandou mais de uma mensagem antes do assistente responder a
// anterior ("Onix" + "2020 prata") — junta na resposta da pergunta que ele
// estava respondendo, em vez de tratar como resposta da próxima.
export function complementarResposta(cfg: ConfigAssistente, atual: EstadoRoteiro, texto: string): EstadoRoteiro {
  const pergunta = cfg.perguntas[atual.etapa - 1]
  if (!pergunta) return atual
  const anterior = atual.respostas[pergunta.id]
  return { ...atual, respostas: { ...atual.respostas, [pergunta.id]: anterior ? `${anterior} ${texto.trim()}` : texto.trim() } }
}

export function linhasResumo(cfg: ConfigAssistente, respostas: Record<string, string>): Array<{ rotulo: string; valor: string }> {
  const linhas: Array<{ rotulo: string; valor: string }> = []
  for (const p of cfg.perguntas) {
    const v = respostas[p.id]
    if (v) linhas.push({ rotulo: p.rotulo, valor: v })
  }
  // Respostas de perguntas que saíram do roteiro depois continuam no resumo.
  for (const [chave, valor] of Object.entries(respostas)) {
    if (chave.startsWith('_') || cfg.perguntas.some(p => p.id === chave) || !valor) continue
    linhas.push({ rotulo: chave, valor })
  }
  return linhas
}

export function respostaDoCampo(cfg: ConfigAssistente, respostas: Record<string, string>, campo: CampoLead): string | null {
  const p = cfg.perguntas.find(x => x.campo === campo && respostas[x.id])
  return p ? respostas[p.id] : null
}

// ---------- Suporte ao vendedor (chat "Você") ----------

export type ComandoSuporte = 'MENU' | 'RESUMO' | 'PENDENTES' | 'PAUSAR' | 'ATIVAR'

// Só reage a mensagem que é exatamente um comando — o chat "Você" é onde
// muita gente anota coisas; qualquer outro texto é ignorado e não é guardado.
export function interpretarComando(texto: string): ComandoSuporte | null {
  const n = normalizar(texto).replace(/^[/!#]/, '').replace(/[.!?]+$/, '')
  if (['menu', 'ajuda', 'assistente', 'comandos'].includes(n)) return 'MENU'
  if (['resumo', 'resumo do dia', 'hoje'].includes(n)) return 'RESUMO'
  if (['pendentes', 'pendente', 'leads', 'fila'].includes(n)) return 'PENDENTES'
  if (['pausar', 'pausar assistente', 'desligar'].includes(n)) return 'PAUSAR'
  if (['ativar', 'ativar assistente', 'ligar', 'retomar'].includes(n)) return 'ATIVAR'
  return null
}

export const TEXTO_MENU = [
  '🤖 *Assistente Comercial* — comandos (mande só a palavra):',
  '',
  '*resumo* — números de hoje',
  '*pendentes* — leads esperando você responder',
  '*pausar* — parar as respostas automáticas',
  '*ativar* — voltar a responder leads novos',
  '',
  'Também respondo perguntas: *como estou hoje?*, *quem está esperando?*, *ficha da XRE?*… Mande *? ajuda* pra ver tudo.',
  '',
  'Quando um lead terminar as perguntas, eu te aviso aqui com o resumo. Assim que você responder a conversa dele, eu saio de cena.',
].join('\n')
