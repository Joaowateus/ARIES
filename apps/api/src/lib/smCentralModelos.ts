// Gerador do calendário da Central Estratégica (prompt mestre, seções 13 a
// 19 e 25): 20 dias de produção × 9 vídeos, manhã = topo, tarde = meio,
// noite = fundo. Cada vídeo sai com roteiro completo por modelo (gancho,
// contexto, desenvolvimento, valor, CTA, gravação e legenda); a IA, quando
// ligada, reescreve por cima. Funções puras: testáveis sem banco.
import type { Dossie } from './smCentralDossie'
import { PILAR_DA_SEMANA, TEMAS, TEMAS_DA_SEMANA, type TemaBase } from './smCentralTemas'

export const PERIODOS = ['MANHA', 'TARDE', 'NOITE'] as const
export type Periodo = (typeof PERIODOS)[number]
export const ETAPA_DO_PERIODO: Record<Periodo, 'TOPO' | 'MEIO' | 'FUNDO'> = { MANHA: 'TOPO', TARDE: 'MEIO', NOITE: 'FUNDO' }
export const HORARIOS_PADRAO: Record<Periodo, string[]> = { MANHA: ['08:00', '09:30', '11:00'], TARDE: ['13:30', '15:00', '16:30'], NOITE: ['18:30', '20:00', '21:30'] }
export const DIAS_META = 20
export const VIDEOS_POR_PERIODO = 3

export const STATUS_VIDEO = [
  'PLANEJADO', 'ROTEIRIZADO', 'AGUARDANDO_APROVACAO', 'APROVADO', 'PRONTO_GRAVAR', 'GRAVADO', 'EM_EDICAO', 'PRONTO_PUBLICAR', 'AGENDADO', 'PUBLICADO', 'ANALISADO',
] as const
export type StatusVideo = (typeof STATUS_VIDEO)[number]

export const FORMATOS: Record<'TOPO' | 'MEIO' | 'FUNDO', Array<{ chave: string; nome: string }>> = {
  TOPO: [
    { chave: 'SITUACAO', nome: 'Situação cotidiana' }, { chave: 'MITO_VERDADE', nome: 'Mito ou verdade' }, { chave: 'ERRO_COMUM', nome: 'Erro comum' },
    { chave: 'PERGUNTA', nome: 'Pergunta provocativa' }, { chave: 'HISTORIA', nome: 'História curta' }, { chave: 'COMPARACAO_COMPORTAMENTO', nome: 'Comparação de comportamentos' },
    { chave: 'EXPECTATIVA_REALIDADE', nome: 'Expectativa x realidade' }, { chave: 'PROBLEMA_OCULTO', nome: 'Problema que ninguém percebe' }, { chave: 'DILEMA', nome: 'Dilema' },
    { chave: 'REFLEXAO', nome: 'Reflexão' },
  ],
  MEIO: [
    { chave: 'TUTORIAL', nome: 'Tutorial' }, { chave: 'CHECKLIST', nome: 'Checklist' }, { chave: 'COMPARACAO', nome: 'Comparação' },
    { chave: 'TERMO', nome: 'Explicação de termos' }, { chave: 'FAQ', nome: 'Pergunta frequente' }, { chave: 'CRITERIOS', nome: 'Demonstração de critérios' },
    { chave: 'CENARIO', nome: 'Cenário hipotético' }, { chave: 'ERRO_EVITAR', nome: 'Erro comum e como evitar' }, { chave: 'PERGUNTAS_FAZER', nome: 'Perguntas que você deve fazer' },
    { chave: 'PRECO_CUSTO', nome: 'Preço anunciado x custo total' },
  ],
  FUNDO: [
    { chave: 'MOTO_REAL', nome: 'Apresentação de moto real' }, { chave: 'DETALHES', nome: 'Demonstração de detalhes' }, { chave: 'PROCESSO_AVALIACAO', nome: 'Processo de avaliação' },
    { chave: 'OBJECAO_ESPECIFICA', nome: 'Resposta a objeção' }, { chave: 'CONDICOES', nome: 'Condições comerciais confirmadas' }, { chave: 'DEPOIMENTO', nome: 'Depoimento autorizado' },
    { chave: 'BASTIDORES', nome: 'Bastidores do atendimento' }, { chave: 'VISITA', nome: 'Convite para visitar' }, { chave: 'DISPONIBILIDADE', nome: 'Consulta de disponibilidade' },
    { chave: 'INICIAR_AVALIACAO', nome: 'Convite para avaliação' }, { chave: 'COMPARACAO_ALTERNATIVAS', nome: 'Comparação entre alternativas' },
  ],
}
export const NOME_FORMATO: Record<string, string> = Object.fromEntries(Object.values(FORMATOS).flat().map(f => [f.chave, f.nome]))

export const CTAS: Record<'TOPO' | 'MEIO' | 'FUNDO', string[]> = {
  TOPO: ['Comenta aqui: você já passou por isso?', 'Manda esse vídeo para alguém que está pensando em comprar moto.', 'Segue o perfil para acompanhar os próximos vídeos.', 'Responde nos comentários: o que você faria?'],
  MEIO: ['Salva esse vídeo para consultar antes de negociar.', 'Manda a sua dúvida no direct que a gente explica.', 'Compara esses critérios com a proposta que você tem em mãos.', 'Comenta a sua dúvida que ela pode virar o próximo vídeo.'],
  FUNDO: ['Chama no direct ou no WhatsApp para conversar com um consultor.', 'Consulta a disponibilidade pelo link da bio.', 'Agenda uma visita: a gente te mostra tudo de perto.', 'Pede a avaliação da sua moto pelo WhatsApp.', 'Conversa com um consultor sobre as condições atuais.'],
}

const LENTE_EXPLICA: Record<string, string> = {
  'Liberdade e autonomia': 'fala da vontade de ir e vir no próprio horário, sem depender de ninguém',
  'Sobrevivência financeira': 'toca na preocupação de não comprometer as contas do mês',
  'Autoproteção': 'responde ao medo de ser enganado ou de ter problema depois',
  'Justiça e equilíbrio': 'conversa com a vontade de uma negociação em que as duas partes saiam bem',
  'Conquista pessoal': 'valoriza a moto como uma conquista do próprio esforço',
  'Status e pertencimento': 'conversa com o desejo de evoluir e ser reconhecido',
  'Validação social': 'mostra que outras pessoas confiam no processo',
  'Previsibilidade': 'atende à necessidade de saber exatamente quanto e quando vai pagar',
  'Comparação entre alternativas': 'ajuda a pessoa a comparar opções com critério',
  'Custo de oportunidade': 'mostra o que se ganha ou se perde ao decidir agora ou depois',
  'Responsabilidade': 'reforça uma decisão consciente, que cabe na vida real',
  'Respeito': 'garante que a pessoa se sinta respeitada para perguntar e decidir no tempo dela',
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
const sem = (s: string) => s.replace(/[.?!]+$/, '')
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** Item do dossiê que fala do tema (pela palavra-chave), ou um da lista em rodízio. */
export function itemDoDossie(lista: string[], palavra: string, rodizio: number): string {
  const achado = lista.find(i => norm(i).includes(norm(palavra)))
  return achado ?? lista[rodizio % lista.length]
}

/** "de a parcela" → "da parcela", "em o trajeto" → "no trajeto" (os temas entram com artigo). */
export function contrair(t: string): string {
  return t.replace(/\b([Dd])e (o|a|os|as) /g, (_, d: string, art: string) => `${d}${art} `).replace(/\b([Ee])m (o|a|os|as) /g, (_, e: string, art: string) => `${e === 'E' ? 'N' : 'n'}${art} `)
}

export interface Roteiro {
  titulo: string; gancho: string; contexto: string; desenvolvimento: string; valor: string; cta: string
  gravacao: string; cenas: string[]; textosTela: string[]; duracaoSeg: number; legenda: string
  provaNecessaria: string | null; pendenteConfirmacao: string | null
}

interface Ctx { t: TemaBase; alvo: string; persona: string; lente: string; pergunta?: string; ctaIdx: number }

const GRAVACAO: Record<'TOPO' | 'MEIO' | 'FUNDO', string> = {
  TOPO: 'Vertical 9:16, câmera na altura dos olhos e fala direta para a lente. Gancho dito nos 2 primeiros segundos, com o texto na tela. Corte a cada frase para manter o ritmo; fundo da loja ou da rua, com uma moto aparecendo.',
  MEIO: 'Vertical 9:16, plano médio com a moto ao lado. Cada passo ou critério ganha um corte e um texto na tela. Use as mãos para mostrar o que está sendo explicado; tom de professor, sem pressa.',
  FUNDO: 'Vertical 9:16 na loja. Abra mostrando a moto ou o atendimento real, depois fale para a câmera. Mostre só informação confirmada; termine com o convite olhando para a lente.',
}

function legenda(r: { gancho: string; valor: string; cta: string }, extra?: string): string {
  return [r.gancho, r.valor, extra, r.cta].filter(Boolean).join('\n\n')
}

// ---------- Topo (manhã): identificação ----------

function topo(formato: string, c: Ctx): Omit<Roteiro, 'gravacao' | 'legenda' | 'provaNecessaria' | 'pendenteConfirmacao' | 'duracaoSeg'> & { duracaoSeg?: number } {
  const { t } = c
  const cta = CTAS.TOPO[c.ctaIdx % CTAS.TOPO.length]
  const cena0 = t.cena.split(',')[0]
  switch (formato) {
    case 'MITO_VERDADE': return {
      titulo: `Mito ou verdade: ${t.assunto}`,
      gancho: `Mito ou verdade: dá para resolver ${t.assunto} sem perguntar nada?`,
      contexto: `Muita gente pensa assim porque ${t.cena}.`,
      desenvolvimento: `Mito. ${cap(t.verdade)}. O problema começa quando a decisão é tomada sem critério, como ${t.erro}.`,
      valor: `A virada é simples: antes de decidir, pense em ${t.criterios[0]}.`, cta,
      cenas: ['Você segurando um cartaz ou mostrando "MITO?" na tela', 'Resposta para a câmera', 'Moto ao fundo enquanto fala da virada'], textosTela: ['MITO OU VERDADE?', 'MITO', cap(t.criterios[0])],
    }
    case 'ERRO_COMUM': return {
      titulo: `O erro mais comum com ${t.assunto}`,
      gancho: `O erro mais comum com ${t.assunto} não tem nada a ver com dinheiro.`,
      contexto: `É fácil cair nele: ${t.cena}.`,
      desenvolvimento: `O erro é ${t.erro}. Parece pequeno, mas é ele que transforma um sonho em arrependimento.`,
      valor: `${cap(t.verdade)}.`, cta,
      cenas: ['Você falando o gancho em close', 'Cena simples ilustrando o erro', 'Você explicando a virada'], textosTela: ['O ERRO MAIS COMUM', cap(sem(t.erro))],
    }
    case 'PERGUNTA': return {
      titulo: `Pergunta sincera sobre ${t.assunto}`,
      gancho: `Pergunta sincera: o que mais te preocupa quando o assunto é ${t.assunto}?`,
      contexto: `Eu pergunto porque muita gente me conta que ${t.cena}.`,
      desenvolvimento: `E quase sempre a preocupação tem fundamento: ${t.verdade}.`,
      valor: `Se você se identificou, já dá para começar pensando em ${t.criterios[0]}.`, cta: 'Responde nos comentários: qual é a sua maior preocupação?',
      cenas: ['Você fazendo a pergunta olhando para a câmera', 'Pausa curta com o texto na tela', 'Fechamento com convite para comentar'], textosTela: ['O QUE MAIS TE PREOCUPA?', cap(t.assunto)],
    }
    case 'HISTORIA': return {
      titulo: `Uma história que muita gente vive: ${t.assunto}`,
      gancho: `Imagina a cena: ${cena0}.`,
      contexto: `É uma situação ilustrativa, mas muita gente se reconhece nela: ${t.cena}.`,
      desenvolvimento: `O que muda o final dessa história é perceber que ${t.verdade}.`,
      valor: `Se fosse você, o primeiro passo seria olhar para ${t.criterios[0]}.`, cta,
      cenas: ['Cena encenada da situação (sem identificar ninguém real)', 'Você narrando', 'Fechamento com a moto'], textosTela: ['IMAGINA A CENA', 'Situação ilustrativa'],
    }
    case 'COMPARACAO_COMPORTAMENTO': return {
      titulo: `Dois jeitos de lidar com ${t.assunto}`,
      gancho: `Existem dois jeitos de lidar com ${t.assunto}. Qual é o seu?`,
      contexto: `Situação comum: ${t.cena}.`,
      desenvolvimento: `Um jeito é ${t.erro}. O outro é parar e olhar para ${t.criterios[0]} e ${t.criterios[1]}.`,
      valor: `${cap(t.verdade)}.`, cta,
      cenas: ['Tela dividida: jeito 1 e jeito 2', 'Você comentando cada um', 'Fechamento para a câmera'], textosTela: ['JEITO 1', 'JEITO 2', 'QUAL É O SEU?'],
    }
    case 'EXPECTATIVA_REALIDADE': return {
      titulo: `Expectativa x realidade: ${t.assunto}`,
      gancho: `Expectativa e realidade de ${t.assunto}.`,
      contexto: `A expectativa é resolver tudo rápido. A realidade, muitas vezes, é que ${t.cena}.`,
      desenvolvimento: `O que separa as duas coisas: ${t.verdade}.`,
      valor: `Para a realidade ficar perto da expectativa, comece por ${t.criterios[0]}.`, cta,
      cenas: ['Cena "expectativa" leve e animada', 'Cena "realidade"', 'Você explicando a diferença'], textosTela: ['EXPECTATIVA', 'REALIDADE'],
    }
    case 'PROBLEMA_OCULTO': return {
      titulo: `O detalhe que ninguém percebe em ${t.assunto}`,
      gancho: `Tem um detalhe sobre ${t.assunto} que quase ninguém percebe.`,
      contexto: `Normalmente a atenção vai toda para outra coisa, porque ${t.cena}.`,
      desenvolvimento: `O detalhe que passa batido é ${t.criterios[1]}. ${cap(t.verdade)}.`,
      valor: 'Agora que você sabe, já não decide no escuro.', cta,
      cenas: ['Você apontando para um detalhe da moto ou do papel', 'Close no detalhe', 'Fechamento'], textosTela: ['O DETALHE QUE NINGUÉM VÊ', cap(t.criterios[1])],
    }
    case 'DILEMA': return {
      titulo: `O dilema de ${t.assunto}`,
      gancho: `Resolver agora ou planejar melhor? O dilema de ${t.assunto}.`,
      contexto: `Quando o assunto é ${t.assunto}, ${t.cena}.`,
      desenvolvimento: `Não existe resposta única. ${cap(t.verdade)}. O que decide é ${t.criterios[1]}.`,
      valor: 'A melhor escolha é a que você consegue sustentar com tranquilidade.', cta: 'Comenta: você resolveria agora ou planejaria mais?',
      cenas: ['Você entre duas opções na tela', 'Explicação para a câmera', 'Pergunta final'], textosTela: ['AGORA?', 'OU DEPOIS?'],
    }
    case 'REFLEXAO': return {
      titulo: `Reflexão sobre ${t.assunto}`,
      gancho: `Antes de pensar em ${t.assunto}, pensa nisso.`,
      contexto: `Muita gente só percebe depois que ${t.cena}.`,
      desenvolvimento: `${cap(t.verdade)}. E isso ${LENTE_EXPLICA[c.lente] ? `${LENTE_EXPLICA[c.lente].replace(/^fala/, 'tem a ver com')}` : 'pesa na decisão'}.`,
      valor: `Uma pergunta para levar com você: ${t.pergunta}`, cta,
      cenas: ['Você em movimento ou em frente à loja, tom calmo', 'Close durante a reflexão', 'Fechamento olhando para a câmera'], textosTela: [cap(sem(t.verdade))],
    }
    default: return { // SITUACAO
      titulo: `Quando ${cena0}`,
      gancho: `Se ${cena0}, esse vídeo é para você.`,
      contexto: `Situação real de muita gente: ${t.cena}.`,
      desenvolvimento: `Faz sentido se sentir assim. Só que ${t.verdade}.`,
      valor: `Um bom começo é pensar em ${t.criterios[0]}.`, cta,
      cenas: ['Você contando a situação para a câmera', 'Cena do dia a dia que ilustra o problema', 'Fechamento com a moto'], textosTela: [cap(cena0), cap(sem(t.verdade))],
    }
  }
}

// ---------- Meio (tarde): educação e objeções ----------

function meio(formato: string, c: Ctx): Omit<Roteiro, 'gravacao' | 'legenda' | 'provaNecessaria' | 'pendenteConfirmacao' | 'duracaoSeg'> {
  const { t } = c
  const cta = CTAS.MEIO[c.ctaIdx % CTAS.MEIO.length]
  const [c0, c1, c2] = t.criterios
  const lista = `Primeiro: ${c0}. Segundo: ${c1}. Terceiro: ${c2}.`
  switch (formato) {
    case 'CHECKLIST': return {
      titulo: `Checklist de ${t.assunto}`,
      gancho: `Checklist rápido de ${t.assunto}: salva para usar depois.`,
      contexto: `Quem não confere isso acaba descobrindo tarde demais, porque ${t.cena}.`,
      desenvolvimento: `Confere três coisas. ${lista}`,
      valor: `Com isso em mãos, você negocia sabendo o que está olhando. E pergunta sem medo: ${t.pergunta}`, cta,
      cenas: ['Você mostrando uma lista na mão ou no celular', 'Um corte por item, com o item na tela', 'Fechamento'], textosTela: ['CHECKLIST', `1. ${cap(c0)}`, `2. ${cap(c1)}`, `3. ${cap(c2)}`],
    }
    case 'COMPARACAO': return {
      titulo: `Comparando do jeito certo: ${t.assunto}`,
      gancho: `Como comparar ${t.assunto} do jeito certo.`,
      contexto: `O jeito mais comum de comparar é ${t.erro}.`,
      desenvolvimento: `O jeito certo é colocar lado a lado ${c0}, ${c1} e ${c2}.`,
      valor: `${cap(t.verdade)}.`, cta,
      cenas: ['Tela dividida "jeito comum" e "jeito certo"', 'Você explicando cada critério', 'Fechamento'], textosTela: ['JEITO COMUM', 'JEITO CERTO', cap(c0), cap(c1), cap(c2)],
    }
    case 'TERMO': return {
      titulo: `Explicando ${t.assunto} sem complicação`,
      gancho: `O que ninguém te explica direito sobre ${t.assunto}.`,
      contexto: `Muita gente tem vergonha de perguntar e acaba ${t.erro}.`,
      desenvolvimento: `Em palavras simples: ${t.verdade}. Na prática, isso aparece em ${c0} e em ${c1}.`,
      valor: `Na próxima conversa, pergunta: ${t.pergunta}`, cta,
      cenas: ['Você explicando com um quadro ou papel', 'Exemplo visual simples', 'Fechamento com a pergunta na tela'], textosTela: [cap(t.assunto), 'EM PALAVRAS SIMPLES', cap(sem(t.pergunta))],
    }
    case 'FAQ': {
      const pergunta = c.pergunta ?? cap(t.pergunta)
      return {
        titulo: `Pergunta frequente: ${sem(pergunta)}`,
        gancho: `"${sem(pergunta)}?" Essa pergunta chega toda semana.`,
        contexto: c.pergunta ? 'Essa pergunta chegou de verdade no nosso atendimento.' : `Ela aparece porque ${t.cena}.`,
        desenvolvimento: c.pergunta
          ? `A resposta para o seu caso: [CONFIRMAR com a loja antes de gravar]. O que vale para qualquer caso: olhar ${c0} e ${c1}.`
          : `A resposta curta: depende de ${c0} e de ${c1}. ${cap(t.verdade)}.`,
        valor: `E um cuidado extra: ${c2}.`, cta,
        cenas: ['A pergunta escrita na tela', 'Você respondendo para a câmera', 'Fechamento'], textosTela: [sem(pergunta) + '?', 'A RESPOSTA'],
      }
    }
    case 'CRITERIOS': return {
      titulo: `3 critérios para não errar em ${t.assunto}`,
      gancho: `3 critérios para não errar em ${t.assunto}.`,
      contexto: `Sem critério, a decisão vira palpite, e o palpite costuma ser ${t.erro}.`,
      desenvolvimento: lista,
      valor: `${cap(t.verdade)}.`, cta,
      cenas: ['Você mostrando na moto cada critério', 'Corte por critério com o número na tela', 'Fechamento'], textosTela: ['3 CRITÉRIOS', cap(c0), cap(c1), cap(c2)],
    }
    case 'CENARIO': return {
      titulo: `Cenário hipotético: ${t.assunto}`,
      gancho: `Vamos a um cenário sobre ${t.assunto}, sem enrolação.`,
      contexto: `Exemplo ilustrativo, sem valores reais: imagina que ${t.cena}.`,
      desenvolvimento: `Nesse cenário, o que muda a decisão é ${c0} e ${c1}. ${cap(t.verdade)}.`,
      valor: 'Isso é só um exemplo para entender a lógica: valores e condições reais você confere na proposta.', cta,
      cenas: ['Você desenhando o cenário num papel ou quadro', 'Texto "exemplo ilustrativo" fixo na tela', 'Fechamento'], textosTela: ['CENÁRIO HIPOTÉTICO', 'Exemplo ilustrativo, sem valores reais'],
    }
    case 'ERRO_EVITAR': return {
      titulo: `Erro que custa caro em ${t.assunto}`,
      gancho: `Um erro que custa caro em ${t.assunto}, e como evitar.`,
      contexto: `O erro: ${t.erro}.`,
      desenvolvimento: `Como evitar: ${lista}`,
      valor: `${cap(t.verdade)}.`, cta,
      cenas: ['"ERRO" na tela com você explicando', '"COMO EVITAR" com os passos', 'Fechamento'], textosTela: ['O ERRO', 'COMO EVITAR'],
    }
    case 'PERGUNTAS_FAZER': return {
      titulo: `A pergunta que você precisa fazer sobre ${t.assunto}`,
      gancho: `A pergunta que você precisa fazer antes de fechar: ${sem(t.pergunta)}?`,
      contexto: `Pouca gente faz essa pergunta, e é por isso que ${t.cena}.`,
      desenvolvimento: `Ela importa porque mostra ${c0} e ${c1}. Se a resposta vier vaga, peça por escrito.`,
      valor: `${cap(t.verdade)}.`, cta,
      cenas: ['A pergunta escrita na tela', 'Você explicando por que ela importa', 'Fechamento'], textosTela: [cap(sem(t.pergunta)) + '?', 'PEÇA POR ESCRITO'],
    }
    case 'PRECO_CUSTO': return {
      titulo: `Preço anunciado não é custo total: ${t.assunto}`,
      gancho: `Preço anunciado não é custo total em ${t.assunto}. Olha o que fica de fora.`,
      contexto: `Quando o assunto é ${t.assunto}, é comum ${t.erro}.`,
      desenvolvimento: `O custo de verdade inclui ${c0}, ${c1} e ${c2}.`,
      valor: `${cap(t.verdade)}. Pergunta sempre: ${t.pergunta}`, cta,
      cenas: ['Você mostrando um anúncio genérico (sem marca de terceiros)', 'Lista do que fica de fora', 'Fechamento'], textosTela: ['PREÇO ANUNCIADO', 'CUSTO TOTAL'],
    }
    default: return { // TUTORIAL
      titulo: `Como avaliar ${t.assunto} em 3 passos`,
      gancho: `Como avaliar ${t.assunto} em 3 passos.`,
      contexto: `Isso evita uma situação comum: ${t.cena}.`,
      desenvolvimento: `Passo 1: ${c0}. Passo 2: ${c1}. Passo 3: ${c2}.`,
      valor: `${cap(t.verdade)}.`, cta,
      cenas: ['Você apresentando o tutorial', 'Um corte por passo, mostrando na moto ou no papel', 'Fechamento'], textosTela: ['PASSO 1', 'PASSO 2', 'PASSO 3'],
    }
  }
}

// ---------- Fundo (noite): decisão e conversa ----------

function fundo(formato: string, c: Ctx): Omit<Roteiro, 'gravacao' | 'legenda' | 'duracaoSeg'> {
  const { t } = c
  const ctaPor = (i: number) => CTAS.FUNDO[i]
  const conf = (motivo: string | null) => motivo
  switch (formato) {
    case 'MOTO_REAL': return {
      titulo: `De perto: ${t.assunto} numa moto real do estoque`,
      gancho: `Olha de perto essa moto que está aqui na loja, pensando em ${t.assunto}.`,
      contexto: `Para quem está decidindo, ver de perto resolve muita dúvida sobre ${t.assunto}.`,
      desenvolvimento: `Repara em ${t.criterios[0]} e em ${t.criterios[1]}: a gente mostra tudo, inclusive o que não está perfeito.`,
      valor: `Informações confirmadas da moto: [PREENCHER com modelo, ano e quilometragem confirmados].`, cta: ctaPor(1),
      cenas: ['Volta completa na moto', 'Close nos detalhes de conservação', 'Painel e documentos (sem dados pessoais)'], textosTela: ['DISPONÍVEL? CONFIRMAR', 'Modelo · ano · km (confirmar)'],
      provaNecessaria: 'Fotos e vídeos reais da moto do estoque', pendenteConfirmacao: conf('Escolher a moto e confirmar disponibilidade, ano, quilometragem e informações antes de publicar'),
    }
    case 'DETALHES': return {
      titulo: `Os detalhes de ${t.assunto} que a gente mostra antes de você decidir`,
      gancho: `Os detalhes de ${t.assunto} que a gente mostra antes de você decidir.`,
      contexto: `Muita gente compra sem ver isso e se arrepende. ${cap(t.verdade)}.`,
      desenvolvimento: `Aqui, antes da venda, a gente mostra ${t.criterios[0]}, ${t.criterios[1]} e ${t.criterios[2]}.`,
      valor: 'Você decide com a informação na mão, sem surpresa depois.', cta: ctaPor(2),
      cenas: ['Close em cada item conferido', 'Consultor explicando', 'Fechamento com convite'], textosTela: ['O QUE A GENTE MOSTRA', cap(t.criterios[0])],
      provaNecessaria: t.prova, pendenteConfirmacao: conf(t.comercial),
    }
    case 'PROCESSO_AVALIACAO': return {
      titulo: `Avaliação explicada: ${t.nome}`,
      gancho: `"${cap(sem(t.pergunta))}?" A gente responde mostrando como avalia a sua moto.`,
      contexto: 'Receber um valor sem explicação é uma das maiores frustrações de quem quer trocar de moto.',
      desenvolvimento: `Na avaliação a gente olha o estado geral, a quilometragem, o histórico de manutenção e a documentação. E, pensando em ${t.assunto}, explica ${t.criterios[0]}.`,
      valor: 'Você sai sabendo o que valorizou a sua moto e o que pesou contra.', cta: ctaPor(3),
      cenas: ['Consultor avaliando uma moto (com autorização do dono)', 'Close em cada critério', 'Explicação para a câmera'], textosTela: ['AVALIAÇÃO EXPLICADA', 'Estado · km · histórico · documentos'],
      provaNecessaria: 'Vídeo real do processo de avaliação da loja', pendenteConfirmacao: null,
    }
    case 'OBJECAO_ESPECIFICA': return {
      titulo: `Respondendo: ${c.alvo.toLowerCase()}`,
      gancho: `"${cap(sem(c.alvo))}" é a dúvida que mais aparece antes de fechar. Vamos falar dela.`,
      contexto: `É uma dúvida legítima: ${t.cena}.`,
      desenvolvimento: `O que a gente faz: explica ${t.criterios[0]} e ${t.criterios[1]}, coloca por escrito e deixa você comparar com calma. ${cap(t.verdade)}.`,
      valor: 'Sem desconto mágico e sem pressão: clareza para você decidir.', cta: ctaPor(0),
      cenas: ['A objeção escrita na tela', 'Consultor respondendo', 'Fechamento com convite'], textosTela: [cap(sem(c.alvo)) + '?', 'CLAREZA, SEM PRESSÃO'],
      provaNecessaria: t.prova, pendenteConfirmacao: conf(t.comercial),
    }
    case 'CONDICOES': return {
      titulo: `${t.nome}: condições do mês explicadas`,
      gancho: `${cap(sem(t.verdade))}. Por isso a gente explica as condições deste mês sem letra miúda.`,
      contexto: 'Antes de falar em parcela, a gente mostra o que está incluído e o que não está.',
      desenvolvimento: `Condição confirmada: [PREENCHER com a condição aprovada pela loja, com prazo e limitações]. Antes de fechar, confira ${t.criterios[0]} e ${t.criterios[1]}. Sem promessa de aprovação: o crédito passa pela análise.`,
      valor: `${cap(t.verdade)}.`, cta: ctaPor(4),
      cenas: ['Consultor apresentando a condição', 'Texto da condição e das limitações na tela', 'Fechamento'], textosTela: ['CONDIÇÃO CONFIRMADA', 'Sujeito à análise de crédito'],
      provaNecessaria: 'Condição comercial aprovada pela loja', pendenteConfirmacao: 'Condição comercial atual (taxa, entrada, prazo, validade e limitações) aprovada pela loja',
    }
    case 'DEPOIMENTO': return {
      titulo: `Depoimento autorizado: ${t.nome}`,
      gancho: `Quem já comprou aqui conta como foi ${t.assunto}.`,
      contexto: 'Depoimento real, gravado com autorização do cliente.',
      desenvolvimento: `[PREENCHER com o depoimento autorizado.] Pontos para o cliente comentar, se quiser: ${t.criterios[0]} e ${t.criterios[1]}.`,
      valor: 'Cada compra é diferente: converse com a gente sobre a sua.', cta: ctaPor(0),
      cenas: ['Cliente falando (com autorização)', 'Entrega da moto', 'Fechamento'], textosTela: ['DEPOIMENTO REAL', 'Publicado com autorização'],
      provaNecessaria: 'Depoimento com consentimento registrado em Provas', pendenteConfirmacao: 'Depoimento autorizado: sem ele, troque o formato deste vídeo',
    }
    case 'BASTIDORES': return {
      titulo: `Bastidores: ${t.nome} na prática`,
      gancho: `Bastidores de um atendimento de verdade: ${t.assunto} na prática.`,
      contexto: `Muita gente tem receio de ser pressionada. Por isso a gente mostra como funciona ${t.assunto} na prática.`,
      desenvolvimento: `Primeiro a gente entende o que você precisa. Depois explica ${t.criterios[0]} e ${t.criterios[1]}. A decisão é sua, no seu tempo.`,
      valor: 'Atendimento profissional é aquele em que você pode perguntar tudo.', cta: ctaPor(2),
      cenas: ['Recepção na loja', 'Consultor explicando (pessoas com autorização)', 'Fechamento'], textosTela: ['BASTIDORES', 'SEM PRESSÃO'],
      provaNecessaria: 'Imagens reais do atendimento com autorização das pessoas', pendenteConfirmacao: null,
    }
    case 'VISITA': return {
      titulo: `Vem ver de perto: ${t.nome}`,
      gancho: `Vem ver de perto, sem compromisso: ${t.convite}.`,
      contexto: `Ver pessoalmente tira dúvidas sobre ${t.assunto} que foto nenhuma resolve.`,
      desenvolvimento: `Aqui você pode ${t.convite}. A gente mostra ${t.criterios[0]} e responde o que você perguntar.`,
      valor: 'Você vem, olha, pergunta e decide no seu tempo.', cta: ctaPor(2),
      cenas: ['Fachada e entrada da loja', 'Motos expostas', 'Consultor convidando'], textosTela: ['VEM CONHECER', 'Endereço e horário (confirmar)'],
      provaNecessaria: 'Endereço e horário de funcionamento confirmados', pendenteConfirmacao: 'Endereço e horário de atendimento confirmados',
    }
    case 'DISPONIBILIDADE': return {
      titulo: `Disponibilidade: ${t.nome}`,
      gancho: `Procurando uma moto? Pergunta se tem, pensando em ${t.criterios[0]}.`,
      contexto: `Para ${c.persona.toLowerCase()}, a moto certa precisa combinar com ${t.criterios[0]}.`,
      desenvolvimento: 'Fala o modelo, o ano e o uso que você pretende. A gente confere o estoque e responde com informação confirmada.',
      valor: 'Se não tiver, a gente diz que não tem.', cta: ctaPor(1),
      cenas: ['Motos do estoque passando', 'Você falando para a câmera', 'Fechamento'], textosTela: ['TEM A MOTO QUE VOCÊ PROCURA?', 'Estoque sujeito a confirmação'],
      provaNecessaria: 'Imagens reais do estoque', pendenteConfirmacao: 'Motos mostradas precisam estar disponíveis na data da publicação',
    }
    case 'INICIAR_AVALIACAO': return {
      titulo: `Quanto vale a sua moto? ${t.nome}`,
      gancho: `${cap(sem(t.verdade))}. Quer saber quanto vale a sua moto?`,
      contexto: 'Trocar de moto começa por saber o valor da que você já tem.',
      desenvolvimento: `A gente avalia ${t.criterios.join(', ')}, e explica cada critério para você.`,
      valor: 'Você recebe o valor e o motivo dele. Sem compromisso de fechar.', cta: ctaPor(3),
      cenas: ['Moto do cliente chegando (com autorização)', 'Avaliação em andamento', 'Consultor explicando'], textosTela: ['QUANTO VALE A SUA MOTO?', 'Avaliação explicada'],
      provaNecessaria: 'Processo real de avaliação da loja', pendenteConfirmacao: null,
    }
    case 'COMPARACAO_ALTERNATIVAS': return {
      titulo: `Duas opções, um orçamento: ${t.nome}`,
      gancho: `Duas opções, um orçamento: qual faz mais sentido em ${t.assunto}?`,
      contexto: `Comparar com critério é o melhor jeito de não errar em ${t.assunto}.`,
      desenvolvimento: `Lado a lado: [PREENCHER com duas motos disponíveis]. Compare ${t.criterios[0]}, ${t.criterios[1]} e ${t.criterios[2]}.`,
      valor: 'A melhor opção é a que combina com o seu uso, não a mais cara.', cta: ctaPor(0),
      cenas: ['Duas motos lado a lado', 'Consultor apontando as diferenças', 'Fechamento'], textosTela: ['OPÇÃO A', 'OPÇÃO B', 'QUAL COMBINA COM VOCÊ?'],
      provaNecessaria: 'Informações verificadas das duas motos do estoque', pendenteConfirmacao: 'Escolher duas motos disponíveis e confirmar as informações',
    }
    default: throw new Error(`Formato de fundo desconhecido: ${formato}`)
  }
}

const DURACAO: Record<'TOPO' | 'MEIO' | 'FUNDO', number> = { TOPO: 30, MEIO: 50, FUNDO: 40 }

export function montarRoteiro(etapa: 'TOPO' | 'MEIO' | 'FUNDO', formato: string, c: Ctx): Roteiro {
  const base = etapa === 'TOPO' ? { ...topo(formato, c), provaNecessaria: null, pendenteConfirmacao: null } : etapa === 'MEIO' ? { ...meio(formato, c), provaNecessaria: null, pendenteConfirmacao: null } : fundo(formato, c)
  const r: Roteiro = {
    ...base,
    gravacao: GRAVACAO[etapa],
    duracaoSeg: DURACAO[etapa],
    legenda: legenda(base, etapa === 'MEIO' ? `${cap(c.t.criterios[0])}. ${cap(c.t.criterios[1])}. ${cap(c.t.criterios[2])}.` : undefined),
  }
  if (c.pergunta) r.pendenteConfirmacao = 'Pergunta real: confirmar a resposta com a loja antes de gravar'
  const fix = (x: string) => contrair(x)
  return { ...r, titulo: fix(r.titulo), gancho: fix(r.gancho), contexto: fix(r.contexto), desenvolvimento: fix(r.desenvolvimento), valor: fix(r.valor), legenda: fix(r.legenda), cenas: r.cenas.map(fix), textosTela: r.textosTela.map(fix) }
}

// ---------- Calendário ----------

export interface VideoGerado {
  codigo: string; semana: number; diaCiclo: number; data: string; horario: string; periodo: Periodo; ordem: number; etapa: 'TOPO' | 'MEIO' | 'FUNDO'
  tema: string; temaChave: string; pilar: string; formato: string; alvoTipo: string; alvo: string; lente: string; lenteMotivo: string; persona: string; objetivo: string
  roteiro: Roteiro
}

/** Dias de produção: os primeiros N dias de segunda a sexta do mês. */
export function diasDeProducao(mes: string, n = DIAS_META): string[] {
  const [a, m] = mes.split('-').map(Number)
  const dias: string[] = []
  for (let d = 1; d <= 31 && dias.length < n; d++) {
    const dt = new Date(Date.UTC(a, m - 1, d))
    if (dt.getUTCMonth() !== m - 1) break
    const sem = dt.getUTCDay()
    if (sem >= 1 && sem <= 5) dias.push(dt.toISOString().slice(0, 10))
  }
  return dias
}

const ALVO_POR_ORDEM: Record<'TOPO' | 'MEIO' | 'FUNDO', Array<'DOR' | 'DESEJO' | 'OBJECAO'>> = {
  TOPO: ['DOR', 'DESEJO', 'DOR'], MEIO: ['OBJECAO', 'DOR', 'OBJECAO'], FUNDO: ['OBJECAO', 'DESEJO', 'OBJECAO'],
}

const OBJETIVO: Record<'TOPO' | 'MEIO' | 'FUNDO', (alvo: string, t: TemaBase) => string> = {
  TOPO: alvo => `Alcançar pessoas novas e gerar identificação com: ${alvo.toLowerCase()}`,
  MEIO: alvo => `Educar e esclarecer: ${alvo.toLowerCase()}, construindo confiança`,
  FUNDO: (_, t) => `Gerar conversa qualificada: ${t.convite}`,
}

// Formatos de fundo que só fazem sentido em certos temas.
const FUNDO_SO_PARA: Record<string, (t: TemaBase) => boolean> = {
  PROCESSO_AVALIACAO: t => /avalia|valor|troca/.test(t.chave + t.nome.toLowerCase()),
  INICIAR_AVALIACAO: t => /avalia|valor|independ|moto-certa/.test(t.chave + t.nome.toLowerCase()),
  CONDICOES: t => /parcela|juros|entrada|financ|planejamento|oportunidades|garantia|pos-venda/.test(t.chave),
  MOTO_REAL: t => /moto|qualidade|procedencia|rotina|mobilidade|valor|provas/.test(t.chave),
  DISPONIBILIDADE: t => /moto|rotina|mobilidade|primeira|disponiveis/.test(t.chave),
  COMPARACAO_ALTERNATIVAS: t => /moto-certa|comparacao|valor|qualidade|mobilidade/.test(t.chave),
}

/** Formato da vez: compatível com o tema e sem repetir o par tema + formato na etapa. */
// Formatos de meio que listam os três critérios do tema: um por tema, para não repetir o conteúdo.
const MEIO_LISTA = new Set(['TUTORIAL', 'CHECKLIST', 'CRITERIOS', 'ERRO_EVITAR', 'PRECO_CUSTO', 'COMPARACAO'])
// Máximo de vídeos do mesmo formato por etapa no mês (depoimento exige prova real: poucos).
const MAX_FORMATO: Record<string, number> = { DEPOIMENTO: 3 }

function escolherFormato(etapa: 'TOPO' | 'MEIO' | 'FUNDO', t: TemaBase, inicio: number, usados: Set<string>, contagem: Map<string, number>): string {
  const lista = FORMATOS[etapa]
  const teto = (f: string) => MAX_FORMATO[f] ?? Math.ceil(60 / lista.length) + 1
  const jaListou = [...MEIO_LISTA].some(f => usados.has(`${etapa}|${t.chave}|${f}`))
  const candidatos = (relaxar: boolean) => {
    for (let d = 0; d < lista.length; d++) {
      const f = lista[(inicio + d) % lista.length].chave
      if (etapa === 'FUNDO' && FUNDO_SO_PARA[f] && !FUNDO_SO_PARA[f](t)) continue
      if (usados.has(`${etapa}|${t.chave}|${f}`)) continue
      if (!relaxar && etapa === 'MEIO' && jaListou && MEIO_LISTA.has(f)) continue
      if (!relaxar && (contagem.get(`${etapa}|${f}`) ?? 0) >= teto(f)) continue
      return f
    }
    return null
  }
  const f = candidatos(false) ?? candidatos(true) ?? lista[inicio % lista.length].chave
  contagem.set(`${etapa}|${f}`, (contagem.get(`${etapa}|${f}`) ?? 0) + 1)
  return f
}

/** Tema mais próximo da pergunta real (pelas palavras), para os critérios fazerem sentido. */
export function temaDaPergunta(texto: string): TemaBase | null {
  const p = palavras(texto)
  let melhor: TemaBase | null = null, nota = 0
  for (const t of TEMAS) {
    const w = palavras(`${t.nome} ${t.assunto} ${t.pergunta} ${Object.values(t.alvos).join(' ')}`)
    let n = 0
    for (const x of p) for (const y of w) if (x === y || (x.length > 4 && y.startsWith(x.slice(0, 5)))) { n++; break }
    if (n > nota) { nota = n; melhor = t }
  }
  return melhor
}

export interface OpcoesGeracao {
  mes: string
  dias: string[]
  horarios?: Record<Periodo, string[]>
  dossie: Dossie
  perguntasReais?: Array<{ id: string; texto: string }> // viram vídeos de meio (formato pergunta frequente)
}

/**
 * Os 180 vídeos do ciclo-base (ou 9 por dia de produção informado). O par
 * tema + formato não se repete dentro da mesma etapa no mês.
 */
export function gerarCalendario(o: OpcoesGeracao): Array<VideoGerado & { perguntaId?: string }> {
  const horarios = o.horarios ?? HORARIOS_PADRAO
  const { dossie } = o
  const perguntas = [...(o.perguntasReais ?? [])]
  const saida: Array<VideoGerado & { perguntaId?: string }> = []
  const [ano, mesN] = o.mes.split('-')
  const usados = new Set<string>()
  const contagem = new Map<string, number>()
  o.dias.forEach((data, i) => {
    const diaCiclo = i + 1
    const semana = Math.min(4, Math.floor(i / 5) + 1)
    const dSem = i % 5
    const temas = TEMAS_DA_SEMANA(semana)
    for (const periodo of PERIODOS) {
      const etapa = ETAPA_DO_PERIODO[periodo]
      const formatos = FORMATOS[etapa]
      const offEtapa = etapa === 'TOPO' ? 0 : etapa === 'MEIO' ? 2 : 4
      for (let k = 0; k < VIDEOS_POR_PERIODO; k++) {
        const s = dSem * 3 + k
        const tSlot = temas[(s + offEtapa) % temas.length]
        let temaUsado = tSlot
        let formato = escolherFormato(etapa, tSlot, (s + (semana - 1) * 3), usados, contagem)
        const alvoTipo = ALVO_POR_ORDEM[etapa][k]
        const listaAlvo = alvoTipo === 'DOR' ? dossie.dores : alvoTipo === 'DESEJO' ? dossie.desejos : dossie.objecoes
        let alvo = itemDoDossie(listaAlvo, tSlot.alvos[alvoTipo], i + k)
        let perguntaId: string | undefined
        let pergunta: string | undefined
        let tipoFinal: string = alvoTipo
        // Pergunta real do atendimento vira o 2º vídeo da tarde, enquanto houver.
        if (etapa === 'MEIO' && k === 1 && perguntas.length) {
          const p = perguntas.shift()!
          formato = 'FAQ'; perguntaId = p.id; pergunta = p.texto; alvo = p.texto; tipoFinal = 'PERGUNTA'
          temaUsado = temaDaPergunta(p.texto) ?? tSlot
        }
        const t = temaUsado
        const lente = itemDoDossie(dossie.lentes, t.lentes[k % 2], i + k)
        const persona = dossie.personas[(i * 3 + k + offEtapa) % dossie.personas.length]
        usados.add(`${etapa}|${t.chave}|${formato}`)
        const roteiro = montarRoteiro(etapa, formato, { t, alvo, persona, lente, pergunta, ctaIdx: i + k })
        saida.push({
          codigo: `V-${ano}${mesN}-S${semana}D${dSem + 1}-${periodo[0]}${k + 1}`,
          semana, diaCiclo, data, horario: horarios[periodo][k] ?? HORARIOS_PADRAO[periodo][k], periodo, ordem: k + 1, etapa,
          tema: pergunta ? `Pergunta real: ${sem(pergunta)}` : t.nome, temaChave: perguntaId ? `pergunta-${perguntaId}` : t.chave, pilar: PILAR_DA_SEMANA[semana], formato, alvoTipo: tipoFinal, alvo, lente,
          lenteMotivo: `${t.nome}: a lente "${lente}" ${LENTE_EXPLICA[lente] ?? 'ajuda a conectar o tema à decisão de compra'}.`,
          persona, objetivo: contrair(OBJETIVO[etapa](alvo, t)), roteiro, perguntaId,
        })
      }
    }
  })
  return saida
}

// ---------- Repetição (seção 25) ----------

const PARADAS = new Set('a o as os de da do das dos e em no na nos nas um uma para por com sem que se sua seu suas seus voce você isso esse essa este esta mais muito pra pro ao à é não ou'.split(' '))
function palavras(s: string): Set<string> {
  return new Set(norm(s).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !PARADAS.has(w)))
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let i = 0
  for (const x of a) if (b.has(x)) i++
  return i / (a.size + b.size - i)
}

export interface Repeticao { a: string; b: string; motivo: string; semelhanca: number }

/** Pares de vídeos parecidos demais: mesmo tema+formato+etapa, ou gancho/título quase iguais. */
export function repetidos(videos: Array<{ id: string; etapa: string; temaChave: string; formato: string; gancho: string; titulo: string; desenvolvimento: string }>, limite = 0.6): Repeticao[] {
  const r: Repeticao[] = []
  const pal = videos.map(v => palavras(`${v.titulo} ${v.gancho} ${v.desenvolvimento}`))
  for (let i = 0; i < videos.length; i++) {
    for (let j = i + 1; j < videos.length; j++) {
      const a = videos[i], b = videos[j]
      if (a.etapa === b.etapa && a.temaChave === b.temaChave && a.formato === b.formato) { r.push({ a: a.id, b: b.id, motivo: 'Mesmo tema, formato e etapa do funil', semelhanca: 1 }); continue }
      const s = jaccard(pal[i], pal[j])
      if (s >= limite && a.etapa === b.etapa) r.push({ a: a.id, b: b.id, motivo: 'Título e gancho muito parecidos', semelhanca: Math.round(s * 100) / 100 })
    }
  }
  return r
}

// ---------- Checklist de qualidade (seção 28) ----------

export interface ItemChecklistCiclo { chave: string; rotulo: string; ok: boolean; detalhe: string; essencial: boolean }

export function checklistDoCiclo(c: {
  dias: string[]
  videos: Array<{ id: string; data: string; periodo: string; etapa: string; tema: string; objetivo: string; gancho: string; contexto: string; desenvolvimento: string; valor: string; cta: string; gravacao: string; temaChave: string; formato: string; titulo: string; pendenteConfirmacao: string | null; status: string; provaNecessaria: string | null; provaId: string | null }>
  repeticoes: number
  provasAprovadas: Set<string>
  historicoPreservado: boolean
}): ItemChecklistCiclo[] {
  const v = c.videos
  const n = v.length
  const meta = c.dias.length * 9
  const porDia = new Map<string, number>()
  for (const x of v) porDia.set(x.data, (porDia.get(x.data) ?? 0) + 1)
  const conta = (f: (x: typeof v[number]) => boolean) => v.filter(f).length
  const diasCertos = c.dias.every(d => porDia.get(d) === 9)
  const periodoCerto = (p: string) => c.dias.every(d => v.filter(x => x.data === d && x.periodo === p).length === 3)
  const etapaCerta = v.every(x => ETAPA_DO_PERIODO[x.periodo as Periodo] === x.etapa)
  const porEtapa = (e: string) => conta(x => x.etapa === e)
  const temas = new Set(v.map(x => x.temaChave)).size
  const pendentes = v.filter(x => x.pendenteConfirmacao && ['APROVADO', 'PRONTO_GRAVAR', 'GRAVADO', 'EM_EDICAO', 'PRONTO_PUBLICAR', 'AGENDADO', 'PUBLICADO'].includes(x.status))
  const semProva = v.filter(x => x.provaNecessaria && /depoimento/i.test(x.provaNecessaria) && !(x.provaId && c.provasAprovadas.has(x.provaId)) && ['PRONTO_PUBLICAR', 'AGENDADO', 'PUBLICADO'].includes(x.status))
  const faltando = (campo: 'gancho' | 'cta' | 'gravacao' | 'tema' | 'objetivo') => conta(x => !x[campo]?.trim())
  const roteiroIncompleto = conta(x => ![x.contexto, x.desenvolvimento, x.valor].every(t => t?.trim()))
  return [
    { chave: 'total', rotulo: `Existem ${meta} vídeos no ciclo`, ok: n === meta, detalhe: `${n} de ${meta}${c.dias.length !== 20 ? ` (ciclo ajustado para ${c.dias.length} dias de produção; a meta-base é 180)` : ''}`, essencial: true },
    { chave: 'porDia', rotulo: 'Existem 9 vídeos por dia de produção', ok: diasCertos, detalhe: diasCertos ? 'Todos os dias com 9' : 'Há dia com mais ou menos de 9', essencial: true },
    { chave: 'manha', rotulo: 'Existem 3 vídeos pela manhã', ok: periodoCerto('MANHA'), detalhe: '', essencial: true },
    { chave: 'tarde', rotulo: 'Existem 3 vídeos à tarde', ok: periodoCerto('TARDE'), detalhe: '', essencial: true },
    { chave: 'noite', rotulo: 'Existem 3 vídeos à noite', ok: periodoCerto('NOITE'), detalhe: '', essencial: true },
    { chave: 'funil', rotulo: 'Manhã = topo, tarde = meio, noite = fundo', ok: etapaCerta, detalhe: '', essencial: true },
    { chave: 'distribuicao', rotulo: `Distribuição de ${meta / 3} vídeos por etapa`, ok: ['TOPO', 'MEIO', 'FUNDO'].every(e => porEtapa(e) === meta / 3), detalhe: `Topo ${porEtapa('TOPO')} · Meio ${porEtapa('MEIO')} · Fundo ${porEtapa('FUNDO')}`, essencial: true },
    { chave: 'temaObjetivo', rotulo: 'Todos têm tema e objetivo', ok: faltando('tema') + faltando('objetivo') === 0, detalhe: '', essencial: true },
    { chave: 'gancho', rotulo: 'Todos têm gancho', ok: faltando('gancho') === 0, detalhe: faltando('gancho') ? `${faltando('gancho')} sem gancho` : '', essencial: true },
    { chave: 'roteiro', rotulo: 'Todos têm roteiro completo', ok: roteiroIncompleto === 0, detalhe: roteiroIncompleto ? `${roteiroIncompleto} incompletos` : '', essencial: true },
    { chave: 'cta', rotulo: 'Todos têm CTA apropriado', ok: faltando('cta') === 0, detalhe: '', essencial: true },
    { chave: 'gravacao', rotulo: 'Todos têm orientação de gravação', ok: faltando('gravacao') === 0, detalhe: '', essencial: true },
    { chave: 'variedade', rotulo: 'Temas variados e coerentes com o dossiê', ok: temas >= Math.min(20, Math.ceil(c.dias.length * 1.2)), detalhe: `${temas} temas diferentes`, essencial: false },
    { chave: 'repeticao', rotulo: 'Repetição superficial evitada', ok: c.repeticoes === 0, detalhe: c.repeticoes ? `${c.repeticoes} pares parecidos para revisar` : 'Nenhum par parecido', essencial: true },
    { chave: 'comercial', rotulo: 'Condições comerciais verificadas quando necessário', ok: pendentes.length === 0, detalhe: pendentes.length ? `${pendentes.length} vídeos aprovados ainda dependem de confirmação comercial` : `${conta(x => !!x.pendenteConfirmacao)} vídeos dependem de confirmação antes de gravar`, essencial: true },
    { chave: 'provas', rotulo: 'Nenhum depoimento ou prova inventado', ok: semProva.length === 0, detalhe: semProva.length ? `${semProva.length} vídeos com depoimento sem prova aprovada` : 'Depoimentos só com prova aprovada', essencial: true },
    { chave: 'metricas', rotulo: 'Métricas não inventadas', ok: true, detalhe: 'As métricas vêm só do Instagram sincronizado e do registro manual', essencial: true },
    { chave: 'posicionamento', rotulo: 'Conteúdos respeitam o posicionamento', ok: true, detalhe: 'Roteiros-base escritos a partir do dossiê; revise os editados à mão', essencial: false },
    { chave: 'historico', rotulo: 'Dados dos meses anteriores preservados', ok: c.historicoPreservado, detalhe: 'Ciclos anteriores ficam no histórico; nada é apagado', essencial: true },
  ]
}
