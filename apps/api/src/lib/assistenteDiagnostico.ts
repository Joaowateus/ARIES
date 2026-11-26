// Diagnóstico do Assistente Comercial (WhatsApp de cada vendedor): por que o lead não entrou no CRM
// ou o robô não fez a primeira abordagem. Confere, para cada número conectado, o servidor do WhatsApp
// (configurado? a sessão está aberta?), para onde ele manda os avisos (webhook), quando chegou o
// último aviso, as chaves de cadastro e de resposta automática e o que aconteceu nas últimas 24 h
// (mensagens recebidas, leads cadastrados, conversas com o robô, contatos que ficaram fora do CRM e
// mensagens do robô que não saíram). Só lê; a única correção é reapontar o webhook, a pedido do dono.
import { prisma } from './prisma'
import { ambienteDeTeste } from './ambiente'
import { lerConfig } from './assistenteRoteiro'
import { ErroWhatsapp, sessaoViva, estadoInstancia, evolutionConfigurada, listarInstancias, webhookDaInstancia } from './whatsappEvolution'
import { daMesmaPessoa } from './assistenteReparo'
import { explicarQueda, resumoEventos, textoDoMotivo, type EventoConexao } from './whatsappConexao'

const HORA = 3_600_000
export type Gravidade = 'CRITICO' | 'ATENCAO' | 'INFO'
export interface Problema { gravidade: Gravidade; texto: string; acao: string | null; corrigirWebhook?: boolean; corrigirDuplicadas?: boolean; sessaoAntiga?: boolean }

export interface DiagnosticoAssistente {
  assistenteId: string; vendedor: string; numero: string | null
  status: string; conectadoEm: Date | null; ultimoEventoEm: Date | null
  atendimentoAutomatico: boolean; cadastroAutomatico: boolean; responderContatosNovos: boolean
  /** Outras conexões no servidor com o mesmo número (uma derruba a outra) e os últimos avisos de conexão. */
  duplicadas: Array<{ nome: string; estado: string | null; doAgente: boolean; deOutroVendedor: boolean }>
  eventosConexao: EventoConexao[]
  motivoQueda: string | null
  aoVivo: { estado: string; erro: string | null; webhook: { configurado: boolean; ativo: boolean; recebeMensagens: boolean; apontaParaCa: boolean; endereco: string | null } | null }
  ultimas24h: { mensagensDeClientes: number; leadsCadastrados: number; conversasComRobo: number; foraDoCrm: number; enviosQueFalharam: number }
  problemas: Problema[]
}

/** Endereço sem o segredo (o final do caminho), para mostrar na tela. */
const semSegredo = (url: string | null) => (url ? url.replace(/(\/webhook\/)[^/?#]+/, '$1•••') : null)
const horasDesde = (d: Date | null, agora: Date) => (d ? (agora.getTime() - d.getTime()) / HORA : null)
const quanto = (h: number) => (h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} dias`)

export async function diagnosticarAssistentes(usuarioId: string, urlEsperada: (segredo: string) => string, agora = new Date()): Promise<{ servidor: { configurado: boolean; ambienteDeTeste: boolean }; assistentes: DiagnosticoAssistente[] }> {
  const servidor = { configurado: evolutionConfigurada(), ambienteDeTeste: ambienteDeTeste() }
  const lista = await prisma.assistenteComercial.findMany({
    where: { vendedor: { usuarioId } }, orderBy: { criadoEm: 'asc' },
    select: { id: true, vendedorId: true, instancia: true, webhookSegredo: true, numeroWhatsapp: true, status: true, conectadoEm: true, ultimoEventoEm: true, atendimentoAutomatico: true, cadastroAutomatico: true, configuracao: true, eventosConexao: true, motivoQueda: true, vendedor: { select: { nome: true, ativo: true } } },
  })
  // Todas as conexões do servidor: o mesmo número aberto em duas faz uma derrubar a outra sem parar.
  const instancias = servidor.configurado && !servidor.ambienteDeTeste ? await listarInstancias().catch(() => null) : null
  const [agentes, todosAssistentes] = await Promise.all([
    prisma.agenteWhatsapp.findMany({ select: { instancia: true } }),
    prisma.assistenteComercial.findMany({ where: { instancia: { not: null } }, select: { instancia: true } }),
  ])
  const doAgente = new Set(agentes.map(x => x.instancia))
  const deAssistente = new Set(todosAssistentes.map(x => x.instancia!))
  const desde = new Date(agora.getTime() - 24 * HORA)
  const assistentes = await Promise.all(lista.map(async a => {
    const cfg = lerConfig(a.configuracao)
    const [mensagensDeClientes, leadsCadastrados, conversasComRobo, foraDoCrm, enviosQueFalharam] = await Promise.all([
      prisma.assistenteMensagem.count({ where: { remetente: 'CONTATO', criadoEm: { gte: desde }, conversa: { assistenteId: a.id } } }),
      prisma.lead.count({ where: { usuarioId, vendedorId: a.vendedorId, origemCadastro: 'WHATSAPP', criadoEm: { gte: desde } } }),
      prisma.assistenteConversa.count({ where: { assistenteId: a.id, robo: true, criadoEm: { gte: desde } } }),
      prisma.assistenteContatoForaCrm.count({ where: { assistenteId: a.id, ultimaEm: { gte: desde } } }),
      // Registro gravado antes do envio; sem o id do WhatsApp depois de 2 min = o envio falhou.
      prisma.assistenteMensagem.count({ where: { remetente: 'ASSISTENTE', providerId: null, criadoEm: { gte: desde, lte: new Date(agora.getTime() - 2 * 60_000) }, conversa: { assistenteId: a.id } } }),
    ])

    let estado = 'nao_verificado', erro: string | null = null
    let webhook: DiagnosticoAssistente['aoVivo']['webhook'] = null
    if (servidor.configurado && !servidor.ambienteDeTeste && a.instancia) {
      try { estado = await estadoInstancia(a.instancia) } catch (e) { estado = 'erro'; erro = e instanceof ErroWhatsapp ? e.message : String(e) }
      if (estado !== 'erro' && estado !== 'inexistente') {
        try {
          const w = await webhookDaInstancia(a.instancia)
          const esperado = a.webhookSegredo ? urlEsperada(a.webhookSegredo) : null
          webhook = w
            ? { configurado: !!w.url, ativo: w.ativo, recebeMensagens: !w.eventos.length || w.eventos.some(x => x.toUpperCase().replace(/\./g, '_') === 'MESSAGES_UPSERT'), apontaParaCa: !!w.url && !!esperado && w.url.replace(/\/+$/, '') === esperado, endereco: semSegredo(w.url) }
            : { configurado: false, ativo: false, recebeMensagens: false, apontaParaCa: false, endereco: null }
        } catch (e) { erro = `Não consegui ler o webhook: ${e instanceof ErroWhatsapp ? e.message : String(e)}` }
      }
      // "open" nem sempre é verdade: confere se a sessão responde de fato (Connection Closed).
      if (estado === 'open' && (await sessaoViva(a.instancia, a.numeroWhatsapp)) === false) estado = 'sessao_caida'
    } else if (!a.instancia) estado = 'sem_instancia'

    const p: Problema[] = []
    const nome = a.vendedor.nome.split(/\s+/)[0]
    const numero = a.numeroWhatsapp?.replace(/\D/g, '') ?? null
    const duplicadas = numero && instancias ? instancias.filter(i => i.numero && i.numero.endsWith(numero.slice(-10)) && i.nome !== a.instancia).map(i => ({ nome: i.nome, estado: i.estado, doAgente: doAgente.has(i.nome), deOutroVendedor: deAssistente.has(i.nome) })) : []
    // Sessão antiga da mesma pessoa que sobrou no servidor (a que travou e foi trocada por uma nova):
    // não é outra conexão disputando o número; é só faxina.
    const antigas = duplicadas.filter(d => daMesmaPessoa(a.vendedorId, d.nome) && !d.doAgente && !d.deOutroVendedor)
    if (antigas.length) {
      p.push({ gravidade: 'ATENCAO', texto: `Sobrou no servidor a sessão antiga do WhatsApp de ${nome} (${antigas.map(d => d.nome).join(', ')}), a que travou e foi trocada pela nova. A conexão em uso é a nova; o ARIES apaga a antiga sozinho a cada 15 min.`, acao: `Para apagar agora: no celular de ${nome}, em WhatsApp › Aparelhos conectados, remova o aparelho antigo (o que não conecta há dias) e clique em "Apagar sessão antiga".`, corrigirDuplicadas: true, sessaoAntiga: true })
    }
    const outras = duplicadas.filter(d => !antigas.includes(d))
    if (outras.length) {
      const duplicadas = outras
      const soltas = duplicadas.filter(d => !d.doAgente && !d.deOutroVendedor)
      p.push({ gravidade: 'CRITICO', texto: `O número de ${nome} está aberto em ${duplicadas.length + 1} conexões no servidor do WhatsApp ao mesmo tempo (${duplicadas.map(d => d.nome).join(', ')}). Uma derruba a outra sem parar: é isso que causa a reconexão automática e o "Connection Closed".`, acao: soltas.length ? 'Clicar em "Desligar conexões duplicadas" aqui (desliga só as sobras; a conexão do ARIES fica). Depois, se pedir, ler o QR de novo.' : duplicadas.some(d => d.doAgente) ? `O mesmo número está como "ARIES no WhatsApp" em Configurações: use outro número para o ARIES.` : 'O mesmo número está ligado no WhatsApp de outro vendedor no ARIES: desconecte de um dos dois.', corrigirDuplicadas: soltas.length > 0 })
    }
    const eventos = (a.eventosConexao as unknown as EventoConexao[] | null) ?? []
    const r = resumoEventos(eventos, agora, 60)
    if (a.status === 'SESSAO_CAIDA') p.push({ gravidade: 'CRITICO', texto: `O WhatsApp de ${nome} precisa ser reconectado. ${explicarQueda(a.motivoQueda) ?? ''}`.trim(), acao: 'Em Conversas › Conexão, clicar em "Gerar QR Code" e ler no celular de quem usa esse número.' })
    else if (r.quedas >= 3) p.push({ gravidade: 'ATENCAO', texto: `A conexão de ${nome} caiu ${r.quedas} vez(es) na última hora (${textoDoMotivo(r.motivoComum)}).`, acao: r.motivoComum === 440 ? 'O número está aberto em outro lugar: no celular, em Aparelhos conectados, desconecte os aparelhos que não são o ARIES.' : 'Conferir a internet do celular; se continuar, "Reparar conexão".' })
    if (!a.vendedor.ativo) p.push({ gravidade: 'INFO', texto: `${nome} está inativo na equipe.`, acao: null })
    if (estado === 'sem_instancia') p.push({ gravidade: 'CRITICO', texto: `O WhatsApp de ${nome} nunca foi conectado.`, acao: 'Conectar em Conversas › Conexão (QR Code).' })
    if (estado === 'inexistente') p.push({ gravidade: 'CRITICO', texto: `O servidor do WhatsApp não tem mais a sessão de ${nome} (foi apagada lá).`, acao: 'Conectar de novo em Conversas › Conexão (QR Code).' })
    if (estado === 'close' || estado === 'connecting') p.push({ gravidade: 'CRITICO', texto: `O WhatsApp de ${nome} está desconectado no servidor${a.status === 'CONECTADO' ? ', mas o ARIES ainda mostra "conectado"' : ''}. Sem conexão, nenhuma mensagem chega: nem cadastro, nem resposta do robô.`, acao: 'Ler o QR Code de novo em Conversas › Conexão, no celular de quem usa esse número.' })
    if (estado === 'sessao_caida') p.push({ gravidade: 'CRITICO', texto: `A sessão do WhatsApp de ${nome} caiu por baixo: o servidor mostra "conectado", mas o WhatsApp não responde (Connection Closed). Nada chega e nada sai por esse número.`, acao: 'Clicar em "Reparar conexão" em Conversas › Conexão (no WhatsApp de quem usa esse número). Se pedir, ler o QR Code novo no celular.' })
    if (estado === 'erro') p.push({ gravidade: 'CRITICO', texto: `Não consegui falar com o servidor do WhatsApp: ${erro}`, acao: 'Conferir se o servidor da Evolution está no ar e se EVOLUTION_API_URL e EVOLUTION_API_KEY na Vercel estão certas.' })
    if (webhook && (!webhook.configurado || !webhook.ativo || !webhook.recebeMensagens)) p.push({ gravidade: 'CRITICO', texto: `O servidor do WhatsApp não está avisando o ARIES das mensagens de ${nome} (webhook ${!webhook.configurado ? 'sem endereço' : !webhook.ativo ? 'desligado' : 'sem o evento de mensagens'}).`, acao: 'Clicar em "Reapontar o aviso" aqui.', corrigirWebhook: true })
    else if (webhook && !webhook.apontaParaCa) p.push({ gravidade: 'CRITICO', texto: `O servidor do WhatsApp manda os avisos de ${nome} para outro endereço (${webhook.endereco ?? 'desconhecido'}), não para esta API.`, acao: 'Clicar em "Reapontar o aviso" aqui.', corrigirWebhook: true })
    const hEvento = horasDesde(a.ultimoEventoEm, agora)
    if (estado === 'open' && (hEvento == null || hEvento > 6)) p.push({ gravidade: 'ATENCAO', texto: hEvento == null ? `Nenhum aviso de mensagem de ${nome} chegou ao ARIES até hoje.` : `O último aviso de mensagem de ${nome} chegou há ${quanto(hEvento)}.`, acao: 'Se chegaram mensagens nesse tempo, reapontar o aviso aqui.', corrigirWebhook: true })
    if (!a.cadastroAutomatico) p.push({ gravidade: 'ATENCAO', texto: `O cadastro automático no CRM está desligado no WhatsApp de ${nome}: só entra lead de anúncio ou frase de campanha quando as respostas estão ligadas.`, acao: 'Ligar "Cadastrar contatos novos no CRM" em Conversas › Conexão.' })
    if (!a.atendimentoAutomatico) p.push({ gravidade: 'ATENCAO', texto: `As respostas automáticas estão pausadas no WhatsApp de ${nome}: o robô não faz a primeira abordagem.`, acao: 'Ligar as respostas automáticas em Conversas › Conexão.' })
    else if (!cfg.responderContatosNovos) p.push({ gravidade: 'INFO', texto: `O robô de ${nome} só aborda quem veio de anúncio ou mandou uma frase de campanha; contato novo comum entra no CRM sem a abordagem.`, acao: 'Ligar "Responder contatos novos" no roteiro, se quiser a abordagem para todos.' })
    if (foraDoCrm > 0) p.push({ gravidade: leadsCadastrados ? 'INFO' : 'ATENCAO', texto: `${foraDoCrm} contato(s) escreveram para ${nome} nas últimas 24 h e ficaram em "WhatsApp fora do CRM": o sistema achou conversa anterior com eles no celular e não falaram em compra. O robô não aborda quem já conversava com o vendedor.`, acao: 'Ver a lista "WhatsApp fora do CRM" em Conversas e marcar "virar lead" nos que são clientes.' })
    if (enviosQueFalharam > 0) p.push({ gravidade: 'CRITICO', texto: `${enviosQueFalharam} mensagem(ns) do robô de ${nome} não saíram nas últimas 24 h (o servidor do WhatsApp recusou o envio).`, acao: 'Conferir a conexão do número e o servidor da Evolution.' })
    if (!p.some(x => x.gravidade === 'CRITICO') && estado === 'open' && mensagensDeClientes === 0 && (hEvento ?? 99) > 1) p.push({ gravidade: 'INFO', texto: `Conectado e com o aviso no lugar, mas nenhuma mensagem de cliente chegou nas últimas 24 h no WhatsApp de ${nome}.`, acao: 'Mande uma mensagem de teste de outro número para conferir.' })

    return {
      assistenteId: a.id, vendedor: a.vendedor.nome, numero: a.numeroWhatsapp ? `final ${a.numeroWhatsapp.slice(-4)}` : null,
      status: a.status, conectadoEm: a.conectadoEm, ultimoEventoEm: a.ultimoEventoEm,
      atendimentoAutomatico: a.atendimentoAutomatico, cadastroAutomatico: a.cadastroAutomatico, responderContatosNovos: cfg.responderContatosNovos,
      duplicadas, eventosConexao: eventos.slice(-10).reverse(), motivoQueda: a.motivoQueda,
      aoVivo: { estado, erro, webhook }, ultimas24h: { mensagensDeClientes, leadsCadastrados, conversasComRobo, foraDoCrm, enviosQueFalharam },
      problemas: p.sort((x, y) => ['CRITICO', 'ATENCAO', 'INFO'].indexOf(x.gravidade) - ['CRITICO', 'ATENCAO', 'INFO'].indexOf(y.gravidade)),
    } satisfies DiagnosticoAssistente
  }))
  return { servidor, assistentes }
}
