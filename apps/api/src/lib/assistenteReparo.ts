// Reparo da conexão do WhatsApp de um vendedor (Evolution).
// O caso que motivou: o servidor diz "open" (conectado), mas a sessão morreu por baixo e todo envio volta
// "Connection Closed"; o ARIES mostrava "conectado", "Conectar" não gerava QR e "Desconectar" travava no
// logout. O reparo: 1) testa de verdade; 2) reinicia a sessão sem QR; 3) só se não voltar, gera um QR
// novo (a pessoa lê no celular). Conversas, leads e roteiro ficam: só a sessão do WhatsApp é refeita.
import { randomBytes } from 'crypto'
import { prisma } from './prisma'
import { logger } from './logger'
import { configurarWebhook, estadoInstancia, listarInstancias, prepararConexao, reiniciarInstancia, removerInstancia, sessaoViva, testarEnvio, ErroWhatsapp, type CodigoConexao } from './whatsappEvolution'

export type ResultadoReparo =
  | { status: 'CONECTADO'; mensagem: string }
  | { status: 'SESSAO_CAIDA'; mensagem: string }
  | { status: 'AGUARDANDO_QR'; mensagem: string; qrBase64: string | null; pairingCode: string | null }

const espera = (ms: number) => new Promise(ok => setTimeout(ok, ms))

export async function repararConexao(assistenteId: string, webhookUrl: string, opcoes: { gerarQr?: boolean; numeroPareamento?: string; forcarReinicio?: boolean } = {}): Promise<ResultadoReparo> {
  const a = await prisma.assistenteComercial.findUnique({ where: { id: assistenteId }, select: { id: true, instancia: true, numeroWhatsapp: true } })
  if (!a?.instancia) throw new ErroWhatsapp('Este WhatsApp ainda não foi conectado: gere o QR Code.')
  if (opcoes.gerarQr) {
    // Refaz a sessão do zero. Se o servidor não apagar a antiga (sessão morta presa em "open"), abre
    // uma sessão nova com outro nome: o QR aparece de qualquer jeito.
    const r = await novaSessao(a.id, () => webhookUrl, opcoes.numeroPareamento)
    return { status: 'AGUARDANDO_QR', mensagem: MSG_LER_QR, qrBase64: r.qrBase64, pairingCode: r.pairingCode }
  }
  // 1) Está mesmo funcionando?
  const estado = await estadoInstancia(a.instancia).catch(() => 'erro' as const)
  if (estado === 'inexistente') return { status: 'SESSAO_CAIDA', mensagem: 'O servidor do WhatsApp não tem mais a sessão deste número: é preciso ler um QR Code novo.' }
  // Só confia com resposta positiva do WhatsApp; resposta incerta = reinicia (não tem efeito colateral).
  const viva = estado === 'open' ? await sessaoViva(a.instancia, a.numeroWhatsapp) : false
  if (viva === true && !opcoes.forcarReinicio) {
    const teste = await provaDeEnvio(a)
    if (teste !== false) {
      await configurarWebhook(a.instancia, webhookUrl).catch(() => undefined)
      await prisma.assistenteComercial.update({ where: { id: a.id }, data: { status: 'CONECTADO' } })
      return { status: 'CONECTADO', mensagem: 'Teste de envio feito: uma mensagem de teste saiu para o próprio número. A conexão está funcionando e o aviso de mensagens foi reapontado.' }
    }
  }
  // 2) Reinicia a sessão sem QR e confere de novo.
  try { await reiniciarInstancia(a.instancia) } catch { /* segue para conferir */ }
  const fim = Date.now() + 12_000
  let aberta = false
  while (Date.now() < fim) {
    await espera(2000)
    if ((await estadoInstancia(a.instancia).catch(() => 'erro')) === 'open') { aberta = true; break }
  }
  if (aberta) {
    await espera(1500)
    if ((await sessaoViva(a.instancia, a.numeroWhatsapp)) === true && (await provaDeEnvio(a)) !== false) {
      await configurarWebhook(a.instancia, webhookUrl).catch(() => undefined)
      await prisma.assistenteComercial.update({ where: { id: a.id }, data: { status: 'CONECTADO' } })
      return { status: 'CONECTADO', mensagem: 'Sessão reiniciada e testada com um envio real para o próprio número. O envio e o assistente voltam a funcionar.' }
    }
  }
  // Não envia de verdade: marca como "precisa reconectar" (a tela pede o QR; o Disparo e o robô esperam).
  await prisma.assistenteComercial.update({ where: { id: a.id }, data: { status: 'SESSAO_CAIDA', motivoQueda: 'ENVIO_FALHOU' } })
  return { status: 'SESSAO_CAIDA', mensagem: 'O WhatsApp deste número não está enviando (a sessão no servidor está corrompida). Reiniciar não resolveu: é preciso ler um QR Code novo no celular deste número. Conversas, leads e campanhas ficam salvos e continuam de onde pararam.' }
}

export const MSG_LER_QR = 'Leia o QR Code no celular deste número (WhatsApp › Aparelhos conectados › Conectar um aparelho). Antes, nesse mesmo lugar, remova os aparelhos antigos que aparecem como desconectados ou "Chrome/Ubuntu" de outra data.'

/**
 * Apaga a instância e CONFERE que sumiu. Com a sessão morta e o estado "open", o servidor recusa
 * apagar e o logout falha: aí devolve false (quem chama abre uma sessão com outro nome).
 */
export async function apagarInstancia(instancia: string, prazoMs = 7000): Promise<boolean> {
  try { await removerInstancia(instancia, prazoMs) } catch { /* confere abaixo */ }
  await espera(600)
  return (await estadoInstancia(instancia).catch(() => 'erro' as const)) === 'inexistente'
}

/** Nome da sessão de um vendedor no servidor: o de sempre ou um novo com sufixo (quando o antigo ficou preso). */
export const nomeDaSessao = (vendedorId: string, nova = false) => (nova ? `aries-${vendedorId}-${Date.now().toString(36)}` : `aries-${vendedorId}`)
const daMesmaPessoa = (vendedorId: string, nome: string) => nome === `aries-${vendedorId}` || nome.startsWith(`aries-${vendedorId}-`)

/**
 * Sessão nova do WhatsApp com QR, sem depender de apagar a antiga. Tenta apagar a antiga; se o
 * servidor recusar, usa outro nome. O segredo do aviso (webhook) é trocado: o que a sessão antiga
 * mandar cai no vazio e não derruba o status. Conversas, leads, roteiro e campanhas ficam.
 */
export async function novaSessao(assistenteId: string, webhookDe: (segredo: string) => string, numeroPareamento?: string): Promise<CodigoConexao & { instancia: string; antigaPresa: string | null }> {
  const a = await prisma.assistenteComercial.findUniqueOrThrow({ where: { id: assistenteId }, select: { id: true, vendedorId: true, instancia: true } })
  const antiga = a.instancia
  const estadoAntiga = antiga ? await estadoInstancia(antiga).catch(() => 'erro' as const) : 'inexistente'
  // "open" com a sessão morta: o servidor não deixa apagar; nem tenta (economiza o tempo do pedido).
  const livre = !antiga || estadoAntiga === 'inexistente' || (estadoAntiga !== 'open' && await apagarInstancia(antiga))
  const instancia = livre ? (antiga ?? nomeDaSessao(a.vendedorId)) : nomeDaSessao(a.vendedorId, true)
  const segredo = randomBytes(24).toString('hex')
  await prisma.assistenteComercial.update({ where: { id: a.id }, data: { instancia, webhookSegredo: segredo, status: 'AGUARDANDO_QR' } })
  if (!livre) logger.warn({ antiga, nova: instancia }, 'whatsapp: sessão antiga presa no servidor; aberta uma nova')
  const codigo = await prepararConexao(instancia, webhookDe(segredo), numeroPareamento)
  return { ...codigo, instancia, antigaPresa: livre ? null : antiga }
}

/**
 * Sobras deste vendedor no servidor (sessões antigas que não apagaram na hora): reinicia (com o
 * aparelho removido no celular, ela cai para "close") e apaga. Nunca toca na sessão atual.
 */
export async function limparSobras(vendedorId: string, atual: string | null, prazoMs = 9000): Promise<{ apagadas: string[]; presas: string[] }> {
  const fim = Date.now() + prazoMs
  const sobras = (await listarInstancias().catch(() => [])).filter(i => daMesmaPessoa(vendedorId, i.nome) && i.nome !== atual)
  const apagadas: string[] = [], presas: string[] = []
  for (const s of sobras) {
    if (Date.now() > fim) { presas.push(s.nome); continue }
    if (await apagarInstancia(s.nome, 4000)) { apagadas.push(s.nome); continue }
    await reiniciarInstancia(s.nome).catch(() => undefined)
    await espera(1500)
    if (Date.now() < fim && await apagarInstancia(s.nome, 3000)) apagadas.push(s.nome)
    else presas.push(s.nome)
  }
  if (apagadas.length || presas.length) logger.info({ vendedorId, apagadas, presas }, 'whatsapp: limpeza de sessões antigas')
  return { apagadas, presas }
}

/** Envio real para o próprio número. true = saiu; false = recusado; null = sem número para testar. */
async function provaDeEnvio(a: { instancia: string | null; numeroWhatsapp: string | null }): Promise<boolean | null> {
  if (!a.instancia || !a.numeroWhatsapp) return null
  return (await testarEnvio(a.instancia, a.numeroWhatsapp)).ok
}
