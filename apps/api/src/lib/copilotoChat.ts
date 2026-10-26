// Conversa livre com o Copiloto (aba "Conversar" e o Aries no WhatsApp):
// a IA responde como mentor, em cima dos fatos do dia, do plano, da fila e
// da memória — nunca com valores em reais. Sem IA, devolve o essencial do dia.
import { prisma } from './prisma'
import { primeiroNome } from './copilotoFatos'
import { fatosParaIA, gerarDia, memoriaParaIA, telaDoDia, type Relatorio } from './copiloto'
import { ROTULO_MOTIVO, filaDoCopiloto } from './copilotoFila'
import { iaLigada, responderChat } from './copilotoIA'
import { DICAS, pedidoDeMemoria } from './copilotoModelos'
import { semDinheiro } from './smIA'

export interface ResultadoChat {
  mensagem: { id: string; autor: string; texto: string; origem: string | null; criadoEm: Date }
  resposta: string
  origem: 'IA' | 'MODELO'
  lembrados: string[]
}

export async function conversarComCopiloto(c: { usuarioId: string; pessoa: string; nome: string }, pergunta: string): Promise<ResultadoChat> {
  await prisma.copilotoMensagem.create({ data: { usuarioId: c.usuarioId, pessoa: c.pessoa, autor: 'USUARIO', texto: pergunta } })
  const lembrete = pedidoDeMemoria(pergunta)
  let resposta: string, origem: 'IA' | 'MODELO' = 'MODELO'
  const lembrados: string[] = []
  if (lembrete) {
    await prisma.copilotoMemoria.create({ data: { usuarioId: c.usuarioId, pessoa: c.pessoa, tipo: 'PREFERENCIA', texto: lembrete, natureza: 'PEDIDO', origem: 'USUARIO' } })
    lembrados.push(lembrete)
    resposta = `Anotado, ${c.nome}. Vou levar isso em conta nas próximas análises e sugestões. Você pode ver e mudar o que eu lembro na aba Memória.`
  } else {
    if (!(await telaDoDia(c.usuarioId, c.pessoa))) await gerarDia(c.usuarioId, c.pessoa)
    const tela = (await telaDoDia(c.usuarioId, c.pessoa))!
    const historico = (await prisma.copilotoMensagem.findMany({ where: { usuarioId: c.usuarioId, pessoa: c.pessoa }, orderBy: { criadoEm: 'desc' }, take: 11, select: { autor: true, texto: true } })).reverse().slice(0, -1)
    // Quem atender agora, para a IA: primeiro nome, etapa, motivo e passo (sem valores; a nota do follow passa pelo semDinheiro).
    const fila = (await filaDoCopiloto(c.usuarioId, c.pessoa).catch(() => null))?.itens.slice(0, 8) ?? []
    const filaIA = semDinheiro(fila.map(i => ({ nome: primeiroNome(i.nome), etapa: i.estagio, motivo: ROTULO_MOTIVO[i.motivo.tipo], detalhe: i.motivo.texto, passo: i.passo, sinais: i.sinais, vendedor: i.vendedor })))
    const ia = iaLigada() ? await responderChat(c.usuarioId, {
      fatos: fatosParaIA(tela.fatos), achados: tela.achados.map(a => ({ tipo: a.tipo, texto: a.texto })), plano: tela.acoes.map(a => ({ texto: a.texto, status: a.status })), fila: filaIA,
      memoria: await memoriaParaIA(c.usuarioId, c.pessoa), historico, pergunta, nome: c.nome,
    }) : null
    if (ia) {
      resposta = ia.resposta; origem = 'IA'
      for (const l of ia.lembrar) {
        const ja = await prisma.copilotoMemoria.findFirst({ where: { usuarioId: c.usuarioId, pessoa: c.pessoa, texto: l.texto } })
        if (!ja) { await prisma.copilotoMemoria.create({ data: { usuarioId: c.usuarioId, pessoa: c.pessoa, tipo: l.tipo, texto: l.texto, natureza: 'FATO', origem: 'USUARIO' } }); lembrados.push(l.texto) }
      }
    } else {
      const r = tela.relatorio as Relatorio
      const d = DICAS[r.foco]
      resposta = [
        iaLigada() ? 'Não consegui responder com segurança agora. Enquanto isso, o essencial de hoje:' : 'A conversa livre usa a IA, que não está ligada neste sistema. Enquanto isso, o essencial de hoje:',
        fila.length
          ? `Quem atender agora: ${fila.slice(0, 3).map((x, i) => `${i + 1}. ${primeiroNome(x.nome)}: ${x.motivo.texto.charAt(0).toLowerCase()}${x.motivo.texto.slice(1)}`).join(' ')}`
          : tela.acoes.filter(a => a.status === 'PENDENTE').slice(0, 3).map((a, i) => `${i + 1}. ${a.texto}`).join(' '),
        `Técnica do dia: ${d.titulo}. ${d.tecnica}`,
        'Para eu lembrar de algo, escreva "lembre que ...".',
      ].filter(Boolean).join('\n')
    }
  }
  const mensagem = await prisma.copilotoMensagem.create({ data: { usuarioId: c.usuarioId, pessoa: c.pessoa, autor: 'COPILOTO', texto: resposta, origem } })
  return { mensagem, resposta, origem, lembrados }
}
