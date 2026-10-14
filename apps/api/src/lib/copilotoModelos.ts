// Textos do Copiloto sem IA: o relatório montado direto dos achados, a dica
// do dia por competência, as sugestões de resposta por palavra-chave e a
// resposta da conversa quando a IA não está ligada.
import { COMPETENCIAS, type Competencia } from './copilotoCompetencias'
import type { Achado, AcaoPlano, Fatos } from './copilotoFatos'
import type { RelatorioIA, SugestaoIA } from './copilotoIA'

export const DICAS: Record<Competencia, { titulo: string; tecnica: string; exemplo: string; reflexao: string }> = {
  ATENDIMENTO_RAPIDO: {
    titulo: 'Resposta rápida, mesmo que curta', tecnica: 'Responda o lead que chegou em poucos minutos, nem que seja para dizer quando vai atender com calma. Lead que espera esfria e procura outra loja.',
    exemplo: 'Oi, [nome]! Vi sua mensagem agora. Já separo as informações da moto e te chamo em seguida, pode ser?', reflexao: 'Em que momento do dia os seus leads mais esperam por você?',
  },
  ABORDAGEM: {
    titulo: 'Abertura com pergunta fácil', tecnica: 'Comece lembrando por que o cliente chamou e termine com uma pergunta simples de responder. Pergunta fácil gera a primeira resposta.',
    exemplo: 'Oi, [nome], tudo bem? Aqui é da loja, você pediu informação da [moto]. Ela vai ser para o dia a dia ou para trabalhar?', reflexao: 'Qual foi a primeira mensagem que mais teve resposta com você nesta semana?',
  },
  QUALIFICACAO: {
    titulo: 'Pergunta de implicação (SPIN)', tecnica: 'Depois de entender a situação, pergunte o que o problema custa para o cliente hoje. É isso que transforma interesse em necessidade.',
    exemplo: 'E hoje, sem moto, como fica o seu deslocamento para o trabalho?', reflexao: 'O que você sabe de verdade sobre a necessidade de cada lead em negociação?',
  },
  FOLLOW_UP: {
    titulo: 'Follow-up com motivo novo', tecnica: 'Retome com algo novo (um vídeo, uma foto, uma informação confirmada) e um próximo passo, nunca só com "e aí, pensou?".',
    exemplo: '[nome], separei um vídeo da [moto] rodando para você ver o painel e o ronco. Faz sentido marcar um test-ride?', reflexao: 'Qual lead parado você conseguiria destravar hoje com uma informação nova?',
  },
  NEGOCIACAO: {
    titulo: 'Valor antes do preço', tecnica: 'Antes de falar de preço ou condição, confirme o que o cliente mais valoriza e repita com as palavras dele.',
    exemplo: 'Pelo que você me contou, economia e conforto são o principal, certo? Deixa eu te mostrar como a [moto] atende isso.', reflexao: 'Em quantas conversas o preço apareceu antes de você entender o cliente?',
  },
  OBJECOES: {
    titulo: 'Isolar a objeção', tecnica: 'Antes de responder a objeção, pergunte se ela é a única coisa que impede a decisão. Assim você trata o motivo real.',
    exemplo: 'Entendo. Fora a parcela, tem mais alguma coisa que te deixa em dúvida?', reflexao: 'Qual objeção você mais ouviu nesta semana, e como respondeu?',
  },
  FECHAMENTO: {
    titulo: 'Fechamento por alternativa', tecnica: 'Ofereça duas opções de próximo passo, as duas boas para a venda. O cliente escolhe o como, não o se.',
    exemplo: 'Prefere vir ver a moto amanhã de manhã ou no fim da tarde?', reflexao: 'Em quais propostas você ainda não pediu a decisão de forma clara?',
  },
  PROSPECCAO: {
    titulo: 'Pedido de indicação na entrega', tecnica: 'Peça indicação logo depois da entrega ou de um elogio, quando a satisfação está no alto.',
    exemplo: 'Que bom que você curtiu! Tem alguém da família ou do trabalho que também está pensando em trocar de moto?', reflexao: 'Quantos clientes antigos você poderia chamar esta semana?',
  },
  ORGANIZACAO: {
    titulo: 'Primeiro bloco do dia para a carteira', tecnica: 'Reserve o primeiro bloco do dia só para os leads parados e as conversas pendentes, antes de abrir qualquer outra coisa.',
    exemplo: 'Hoje, primeira hora: responder quem está esperando e fazer o follow-up das propostas.', reflexao: 'O que mais tira você da rotina de vendas durante o dia?',
  },
  WHATSAPP: {
    titulo: 'Uma ideia e uma pergunta por mensagem', tecnica: 'Mensagens curtas, uma ideia por vez e sempre uma pergunta no fim. Texto longo no WhatsApp não é lido.',
    exemplo: 'Consegui a ficha completa da [moto]. Quer que eu mande as fotos ou prefere um vídeo curto?', reflexao: 'Suas mensagens terminam com uma pergunta ou com um ponto final?',
  },
  LIDERANCA: {
    titulo: 'Feedback específico no mesmo dia', tecnica: 'Situação, comportamento e impacto: diga quando, o que a pessoa fez e o efeito disso. Elogio específico ensina mais que crítica genérica.',
    exemplo: 'Hoje cedo você respondeu os leads do assistente na hora, e um deles já marcou visita. É exatamente isso.', reflexao: 'Quem da equipe precisa de você hoje, e quem merece um reconhecimento?',
  },
}

export function relatorioModelo(f: Fatos, achados: Achado[], plano: AcaoPlano[], indice: number, foco: Competencia): RelatorioIA {
  const fortes = achados.filter(a => a.tipo === 'FORTE').map(a => a.texto)
  const atencao = achados.filter(a => a.tipo === 'ATENCAO').map(a => a.texto)
  const erros = achados.filter(a => a.tipo === 'ERRO').map(a => a.texto)
  const nome = f.pessoa.nome
  const tom = indice >= 80 ? 'o dia começa em boa forma' : indice >= 60 ? 'tem pontos importantes para ajustar hoje' : 'hoje pede foco total no básico'
  const primeira = plano[0]
  const resumo = f.pessoa.tipo === 'EQUIPE'
    ? `${nome}, a equipe está com índice de execução ${indice} e ${f.carteira.total} leads em aberto, ${f.parados.total} deles parados. ${primeira ? `Comece por: ${primeira.texto.toLowerCase()}.` : ''}`.trim()
    : `${nome}, ${tom}: índice de execução ${indice}, com ${f.carteira.total} leads em aberto e ${f.parados.total} parados. ${primeira ? `Primeira ação: ${primeira.texto.toLowerCase()}.` : ''}`.trim()
  const d = DICAS[foco]
  return {
    resumo, indoBem: fortes.slice(0, 3), atencao: atencao.slice(0, 4), erros: erros.slice(0, 3),
    dica: { titulo: d.titulo, tecnica: d.tecnica, exemplo: d.exemplo },
    estudoPorque: `${COMPETENCIAS[foco].nome} foi o ponto que mais apareceu nos seus números de hoje.`,
    reflexao: d.reflexao, hipoteses: [],
  }
}

// ---------- Sugestões de resposta sem IA ----------

const REGRAS: Array<{ teste: RegExp; leitura: string; etapa: string; tecnica: string; opcoes: Array<{ texto: string; quando: string }>; cuidado: string | null }> = [
  {
    teste: /pre[cç]o|valor|quanto|parcela|entrada|financ|à vista|a vista/i, leitura: 'O cliente está perguntando de preço ou condição.', etapa: 'negociação', tecnica: 'Valor antes do preço: responda e devolva uma pergunta que entenda a necessidade.',
    opcoes: [
      { texto: 'Te passo sim! Ela sai por [valor]. Pra eu montar a melhor condição: você pensa em dar entrada ou prefere financiar tudo?', quando: 'Quando o cliente já sabe qual moto quer.' },
      { texto: 'Consigo condições bem diferentes dependendo da entrada. Me conta: a moto vai ser para o dia a dia ou para trabalho? Assim te mando a opção que mais faz sentido.', quando: 'Quando ainda não ficou claro o uso da moto.' },
      { texto: 'Te mando a simulação agora. Quer vir ver a moto de perto e já sair com tudo encaminhado? Tenho horário hoje à tarde ou amanhã cedo.', quando: 'Quando o cliente já está decidido e falta o próximo passo.' },
    ], cuidado: 'Não mande só o preço solto: termine sempre com uma pergunta.',
  },
  {
    teste: /dispon|ainda tem|tem a|tem essa|estoque|cor/i, leitura: 'O cliente quer saber se a moto está disponível.', etapa: 'apresentação', tecnica: 'Confirmar e convidar para o próximo passo.',
    opcoes: [
      { texto: '[confirmar disponibilidade] Quer que eu te mande um vídeo dela agora ou prefere vir ver pessoalmente?', quando: 'Para levar o cliente à loja.' },
      { texto: 'Deixa eu confirmar aqui pra você. Enquanto isso: é a primeira moto ou você vai trocar a atual?', quando: 'Para ganhar tempo e entender o cliente.' },
    ], cuidado: 'Não confirme estoque sem checar.',
  },
  {
    teste: /troca|minha moto|usad|avalia/i, leitura: 'O cliente quer dar a moto atual na troca.', etapa: 'negociação', tecnica: 'Coletar dados para a avaliação e marcar a visita.',
    opcoes: [
      { texto: 'Aceitamos sim! Me manda o modelo, o ano e umas fotos dela que eu já peço a avaliação. Consegue trazer ela aqui para a gente ver?', quando: 'Para avançar a avaliação.' },
      { texto: 'Boa! A troca ajuda bastante na entrada. Qual é a moto e o ano? E a ideia é trocar já este mês?', quando: 'Para entender a urgência.' },
    ], cuidado: null,
  },
  {
    teste: /visit|endere|loja|test|ver pessoal|ir a[ií]/i, leitura: 'O cliente quer visitar a loja ou ver a moto.', etapa: 'fechamento', tecnica: 'Fechamento por alternativa: ofereça dois horários.',
    opcoes: [
      { texto: 'Vai ser ótimo te receber! Fica melhor para você hoje à tarde ou amanhã de manhã? Já deixo a moto separada.', quando: 'Para marcar a visita.' },
      { texto: 'Te mando a localização agora. Me avisa o horário que você vem que eu mesmo te atendo.', quando: 'Quando o cliente já disse que vem.' },
    ], cuidado: null,
  },
  {
    teste: /pensar|depois|ver com|esposa|marido|famil/i, leitura: 'O cliente pediu um tempo para pensar ou consultar alguém.', etapa: 'objeção', tecnica: 'Isolar a objeção e combinar o retorno.',
    opcoes: [
      { texto: 'Claro, decisão importante. Pra eu te ajudar: o que ainda te deixa em dúvida, a moto ou a condição?', quando: 'Para descobrir a objeção real.' },
      { texto: 'Sem problema! Se ajudar, posso mandar um resumo com as fotos e a condição pra você mostrar em casa. Te chamo amanhã para ver o que acharam?', quando: 'Quando há outra pessoa na decisão.' },
    ], cuidado: 'Não pressione: combine um retorno com data.',
  },
]

const PADRAO = {
  leitura: 'A conversa precisa de um próximo passo.', etapa: 'diagnóstico', tecnica: 'Pergunta aberta para entender a necessidade.', cuidado: null,
  opcoes: [
    { texto: 'Oi, [nome]! Pra eu te indicar a melhor opção: a moto vai ser para o dia a dia, trabalho ou passeio?', quando: 'Para entender a necessidade.' },
    { texto: '[nome], separei umas fotos e um vídeo da moto para você. Quer que eu mande agora?', quando: 'Para retomar com valor.' },
  ],
}

export function sugestaoModelo(ultimaDoCliente: string, nomeCliente: string, conteudoId: string | null): SugestaoIA {
  const r = REGRAS.find(x => x.teste.test(ultimaDoCliente)) ?? PADRAO
  return {
    leitura: r.leitura, etapa: r.etapa, tecnica: r.tecnica, cuidado: r.cuidado,
    opcoes: r.opcoes.map(o => ({ ...o, texto: o.texto.replace(/\[nome\]/g, nomeCliente) })),
    conteudoId, conteudoPorque: conteudoId ? 'Conteúdo da loja sobre a moto de interesse, para mostrar em vez de só descrever.' : null,
  }
}

/** "Lembre que ..." funciona mesmo sem IA. */
export function pedidoDeMemoria(texto: string): string | null {
  const m = texto.match(/^\s*(?:lembr[ae](?:-se)?|anota|guarda|memoriza)\s+(?:que\s+|disso:?\s*)?(.{4,400})$/i)
  return m ? m[1].trim().replace(/[.!]+$/, '') : null
}
