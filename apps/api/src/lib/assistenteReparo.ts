// Reparo da conexão do WhatsApp de um vendedor (Evolution).
// O caso que motivou: o servidor diz "open" (conectado), mas a sessão morreu por baixo e todo envio volta
// "Connection Closed"; o ARIES mostrava "conectado", "Conectar" não gerava QR e "Desconectar" travava no
// logout. O reparo: 1) testa de verdade; 2) reinicia a sessão sem QR; 3) só se não voltar, gera um QR
// novo (a pessoa lê no celular). Conversas, leads e roteiro ficam: só a sessão do WhatsApp é refeita.
import { prisma } from './prisma'
import { configurarWebhook, estadoInstancia, prepararConexao, reiniciarInstancia, removerInstancia, sessaoViva, testarEnvio, ErroWhatsapp } from './whatsappEvolution'

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

/** Envio real para o próprio número. true = saiu; false = recusado; null = sem número para testar. */
async function provaDeEnvio(a: { instancia: string | null; numeroWhatsapp: string | null }): Promise<boolean | null> {
  if (!a.instancia || !a.numeroWhatsapp) return null
  return (await testarEnvio(a.instancia, a.numeroWhatsapp)).ok
}
