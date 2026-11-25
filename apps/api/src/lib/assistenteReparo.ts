// Reparo da conexão do WhatsApp de um vendedor (Evolution).
// O caso que motivou: o servidor diz "open" (conectado), mas a sessão morreu por baixo e todo envio volta
// "Connection Closed"; o ARIES mostrava "conectado", "Conectar" não gerava QR e "Desconectar" travava no
// logout. O reparo: 1) testa de verdade; 2) reinicia a sessão sem QR; 3) só se não voltar, gera um QR
// novo (a pessoa lê no celular). Conversas, leads e roteiro ficam: só a sessão do WhatsApp é refeita.
import { prisma } from './prisma'
import { configurarWebhook, estadoInstancia, prepararConexao, reiniciarInstancia, removerInstancia, sessaoViva, ErroWhatsapp } from './whatsappEvolution'

export type ResultadoReparo =
  | { status: 'CONECTADO'; mensagem: string }
  | { status: 'SESSAO_CAIDA'; mensagem: string }
  | { status: 'AGUARDANDO_QR'; mensagem: string; qrBase64: string | null; pairingCode: string | null }

const espera = (ms: number) => new Promise(ok => setTimeout(ok, ms))

export async function repararConexao(assistenteId: string, webhookUrl: string, opcoes: { gerarQr?: boolean; numeroPareamento?: string; forcarReinicio?: boolean } = {}): Promise<ResultadoReparo> {
  const a = await prisma.assistenteComercial.findUnique({ where: { id: assistenteId }, select: { id: true, instancia: true, numeroWhatsapp: true } })
  if (!a?.instancia) throw new ErroWhatsapp('Este WhatsApp ainda não foi conectado: gere o QR Code.')
  if (opcoes.gerarQr) {
    // Refaz a sessão do zero: apaga a instância no servidor (mesmo com o logout falhando) e gera o QR.
    await removerInstancia(a.instancia)
    const codigo = await prepararConexao(a.instancia, webhookUrl, opcoes.numeroPareamento)
    await prisma.assistenteComercial.update({ where: { id: a.id }, data: { status: 'AGUARDANDO_QR' } })
    return { status: 'AGUARDANDO_QR', mensagem: 'Leia o QR Code no celular deste número (WhatsApp › Aparelhos conectados › Conectar um aparelho).', ...codigo }
  }
  // 1) Está mesmo funcionando?
  const estado = await estadoInstancia(a.instancia).catch(() => 'erro' as const)
  if (estado === 'inexistente') return { status: 'SESSAO_CAIDA', mensagem: 'O servidor do WhatsApp não tem mais a sessão deste número: é preciso ler um QR Code novo.' }
  // Só confia com resposta positiva do WhatsApp; resposta incerta = reinicia (não tem efeito colateral).
  const viva = estado === 'open' ? await sessaoViva(a.instancia, a.numeroWhatsapp) : false
  if (viva === true && !opcoes.forcarReinicio) {
    await configurarWebhook(a.instancia, webhookUrl).catch(() => undefined)
    await prisma.assistenteComercial.update({ where: { id: a.id }, data: { status: 'CONECTADO' } })
    return { status: 'CONECTADO', mensagem: 'A conexão respondeu ao teste e está funcionando. Também reapontei o aviso de mensagens para o ARIES.' }
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
    if ((await sessaoViva(a.instancia, a.numeroWhatsapp)) === true) {
      await configurarWebhook(a.instancia, webhookUrl).catch(() => undefined)
      await prisma.assistenteComercial.update({ where: { id: a.id }, data: { status: 'CONECTADO' } })
      return { status: 'CONECTADO', mensagem: 'Sessão reiniciada e conferida: o WhatsApp respondeu. O envio e o assistente voltam a funcionar.' }
    }
  }
  return { status: 'SESSAO_CAIDA', mensagem: 'Reiniciei a sessão, mas o WhatsApp não voltou: o celular provavelmente encerrou este aparelho conectado. É preciso ler um QR Code novo no celular deste número.' }
}
