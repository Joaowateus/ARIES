// ARIES DISPARO — adaptador do provedor de WhatsApp (WhatsAppProviderAdapter).
// O motor de campanhas fala só com este contrato; a implementação de hoje usa a conexão que o ARIES
// já tem (Evolution API, uma instância por vendedor — AssistenteComercial), sem conexão paralela e
// sem credencial nova. Trocar para a API oficial (WhatsApp Cloud API) é escrever outra implementação.
import { randomUUID } from 'crypto'
import { ErroWhatsapp, enviadasParaContato, enviarMidia, enviarTexto, estadoInstancia, evolutionConfigurada, numerosComWhatsapp } from '../whatsappEvolution'
import { ambienteDeTeste } from '../ambiente'
import { classificarErro, type ClasseErro, type TipoPasso } from './regras'

export interface Remetente { assistenteId: string; instancia: string | null }
export interface Capacidades {
  provedor: string; texto: boolean; imagem: boolean; audio: boolean; video: boolean; documento: boolean
  /** Modelos aprovados pela Meta existem só na API oficial. */
  templates: boolean; interativos: boolean
  /** Eventos que o provedor informa (nem todos informam leitura). */
  eventos: { aceita: boolean; entregue: boolean; lida: boolean; resposta: boolean }
  maxMidiaBytes: number
  observacoes: string[]
}
export interface Envio { tipo: TipoPasso; texto: string; midia?: { mime: string; dados: Buffer; nomeArquivo: string } | null; digitandoMs?: number }
export type EstadoRemetente = 'CONECTADO' | 'DESCONECTADO' | 'SEM_SERVIDOR' | 'ERRO'

export class ErroEnvio extends Error {
  constructor(message: string, readonly classe: ClasseErro, readonly codigo: string | null = null) { super(message) }
}

export interface ProvedorWhatsapp {
  nome: string
  capacidades(): Capacidades
  verificarConexao(r: Remetente): Promise<EstadoRemetente>
  /** Envia; devolve o id da mensagem no provedor. Falha → ErroEnvio com a classe do erro. */
  enviar(r: Remetente, destino: string, e: Envio): Promise<{ providerId: string | null }>
  /** Procura no provedor uma mensagem já enviada a esse destino desde o instante (resultado desconhecido). */
  reconciliar(r: Remetente, destino: string, texto: string, desde: Date): Promise<string | null>
  /** Quais números têm WhatsApp (quando o provedor sabe responder). */
  numerosExistentes(r: Remetente, numeros: string[]): Promise<Set<string> | null>
}

const MB = 1024 * 1024
const TIPO_EVOLUTION: Record<Exclude<TipoPasso, 'TEXTO'>, 'image' | 'audio' | 'video' | 'document'> = { IMAGEM: 'image', AUDIO: 'audio', VIDEO: 'video', DOCUMENTO: 'document' }

function paraErroEnvio(e: unknown): ErroEnvio {
  if (e instanceof ErroEnvio) return e
  const w = e as ErroWhatsapp
  const classe = classificarErro({ message: w?.message, status: w?.status, talvezEnviado: w instanceof ErroWhatsapp ? w.talvezEnviado : false })
  return new ErroEnvio((w?.message ?? String(e)).slice(0, 500), classe, w?.status ? String(w.status) : null)
}

export const provedorEvolution: ProvedorWhatsapp = {
  nome: 'Evolution API (WhatsApp do vendedor)',
  capacidades: () => ({
    provedor: 'EVOLUTION', texto: true, imagem: true, audio: true, video: true, documento: true, templates: false, interativos: false,
    eventos: { aceita: true, entregue: true, lida: true, resposta: true },
    // A Vercel aceita pedidos de até 4,5 MB: o arquivo da biblioteca vai até 4 MB.
    maxMidiaBytes: 4 * MB,
    observacoes: [
      'Conexão não oficial (WhatsApp Web do número do vendedor): o WhatsApp pode restringir ou banir o número se receber muitas denúncias ou envios em massa para quem não conhece o número.',
      'Modelos aprovados (templates) e botões só existem na API oficial do WhatsApp Business (Cloud API).',
      'Entregue e lida chegam pelo aviso de mensagens (MESSAGES_UPDATE); quem desligou a confirmação de leitura nunca aparece como lida.',
    ],
  }),
  async verificarConexao(r) {
    if (ambienteDeTeste() || !evolutionConfigurada()) return 'SEM_SERVIDOR'
    if (!r.instancia) return 'DESCONECTADO'
    try { return (await estadoInstancia(r.instancia)) === 'open' ? 'CONECTADO' : 'DESCONECTADO' } catch { return 'ERRO' }
  },
  async enviar(r, destino, e) {
    if (!r.instancia) throw new ErroEnvio('Número remetente sem conexão', 'CONEXAO')
    try {
      if (e.tipo === 'TEXTO' || !e.midia) return { providerId: await enviarTexto(r.instancia, destino, e.texto, e.digitandoMs ?? 0) }
      return { providerId: await enviarMidia(r.instancia, destino, { tipo: TIPO_EVOLUTION[e.tipo as Exclude<TipoPasso, 'TEXTO'>], ...e.midia }, e.texto, e.digitandoMs ?? 0) }
    } catch (err) { throw paraErroEnvio(err) }
  },
  async reconciliar(r, destino, texto, desde) {
    if (!r.instancia) return null
    const lista = await enviadasParaContato(r.instancia, destino, desde)
    const alvo = texto.trim().slice(0, 120)
    return lista.find(m => !alvo || m.texto.trim().startsWith(alvo))?.id ?? null
  },
  async numerosExistentes(r, numeros) {
    if (!r.instancia || !numeros.length) return null
    try { return await numerosComWhatsapp(r.instancia, numeros) } catch { return null }
  },
}

// ---------- Provedor de teste (sem rede): grava o que "enviou" e simula falhas ----------

export interface ProvedorFalso extends ProvedorWhatsapp {
  enviados: Array<{ assistenteId: string; destino: string; tipo: TipoPasso; texto: string; providerId: string }>
  /** Destinos que falham sempre com a classe dada; 'DESCONHECIDO' simula a mensagem que saiu mas a resposta não voltou. */
  falhas: Map<string, ClasseErro>
  conectado: boolean
  atrasoMs: number
}
export function criarProvedorFalso(): ProvedorFalso {
  let n = 0
  const p: ProvedorFalso = {
    nome: 'Provedor de teste', enviados: [], falhas: new Map(), conectado: true, atrasoMs: 0,
    capacidades: () => ({ ...provedorEvolution.capacidades(), provedor: 'TESTE' }),
    async verificarConexao() { return p.conectado ? 'CONECTADO' : 'DESCONECTADO' },
    async enviar(r, destino, e) {
      if (p.atrasoMs) await new Promise(ok => setTimeout(ok, p.atrasoMs))
      if (!p.conectado) throw new ErroEnvio('connection closed', 'CONEXAO')
      const f = p.falhas.get(destino)
      const providerId = `TESTE${++n}-${randomUUID().slice(0, 8)}`
      if (f === 'DESCONHECIDO') { p.enviados.push({ assistenteId: r.assistenteId, destino, tipo: e.tipo, texto: e.texto, providerId }); throw new ErroEnvio('O servidor do WhatsApp demorou demais pra responder.', 'DESCONHECIDO') }
      if (f) throw new ErroEnvio(f === 'DEFINITIVO' ? 'number does not exist on WhatsApp' : 'Internal Server Error', f, f === 'DEFINITIVO' ? '400' : '500')
      p.enviados.push({ assistenteId: r.assistenteId, destino, tipo: e.tipo, texto: e.texto, providerId })
      return { providerId }
    },
    async reconciliar(_r, destino, texto) { return p.enviados.find(x => x.destino === destino && x.texto === texto)?.providerId ?? null },
    async numerosExistentes() { return null },
  }
  return p
}

// Só fora da Vercel (demonstração local e testes de ponta a ponta): DISPARO_PROVEDOR_TESTE=1 usa o provedor de teste.
let atual: ProvedorWhatsapp = process.env.DISPARO_PROVEDOR_TESTE === '1' && process.env.VERCEL !== '1' ? criarProvedorFalso() : provedorEvolution
export const provedor = () => atual
/** Só para testes: troca o provedor. */
export function definirProvedor(p: ProvedorWhatsapp | null) { atual = p ?? provedorEvolution }
