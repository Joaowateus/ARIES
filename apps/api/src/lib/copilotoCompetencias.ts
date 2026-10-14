// Competências que o Copiloto Comercial acompanha e a biblioteca de estudo
// de cada uma. A biblioteca nunca inventa endereço: os livros são obras
// conhecidas e o link é uma busca (Google Livros, YouTube, Google Acadêmico),
// que sempre abre. Conteúdos específicos (um vídeo, um artigo) só entram
// pela busca na web da IA, com o endereço que a própria busca devolveu.

export type Competencia =
  | 'ATENDIMENTO_RAPIDO' | 'ABORDAGEM' | 'QUALIFICACAO' | 'FOLLOW_UP' | 'NEGOCIACAO'
  | 'OBJECOES' | 'FECHAMENTO' | 'PROSPECCAO' | 'ORGANIZACAO' | 'WHATSAPP' | 'LIDERANCA'

export const COMPETENCIAS: Record<Competencia, { nome: string; descricao: string; busca: string }> = {
  ATENDIMENTO_RAPIDO: { nome: 'Velocidade de resposta', descricao: 'Responder o lead enquanto o interesse está quente.', busca: 'tempo de resposta ao lead vendas' },
  ABORDAGEM: { nome: 'Primeira abordagem', descricao: 'Abrir a conversa com o lead novo de um jeito que gere resposta.', busca: 'primeira abordagem ao cliente vendas' },
  QUALIFICACAO: { nome: 'Diagnóstico e perguntas', descricao: 'Entender a necessidade com perguntas antes de oferecer.', busca: 'perguntas de diagnóstico SPIN selling' },
  FOLLOW_UP: { nome: 'Follow-up e cadência', descricao: 'Retomar o contato no tempo certo sem deixar o lead esfriar.', busca: 'follow up em vendas cadência' },
  NEGOCIACAO: { nome: 'Negociação', descricao: 'Construir valor antes de falar de condição e conduzir a negociação.', busca: 'técnicas de negociação em vendas' },
  OBJECOES: { nome: 'Contorno de objeções', descricao: 'Tratar "está caro", "vou pensar" e "vou ver com a família".', busca: 'como contornar objeções em vendas' },
  FECHAMENTO: { nome: 'Fechamento', descricao: 'Pedir a decisão e conduzir o próximo passo com segurança.', busca: 'técnicas de fechamento de vendas' },
  PROSPECCAO: { nome: 'Prospecção e geração de leads', descricao: 'Manter a carteira cheia: indicação, base antiga, redes.', busca: 'prospecção de clientes vendedor' },
  ORGANIZACAO: { nome: 'Organização e rotina', descricao: 'Planejar o dia, cumprir a agenda e manter o CRM em dia.', busca: 'rotina e produtividade do vendedor' },
  WHATSAPP: { nome: 'Vendas pelo WhatsApp', descricao: 'Mensagens claras, perguntas abertas e próximos passos pelo WhatsApp.', busca: 'como vender pelo WhatsApp atendimento' },
  LIDERANCA: { nome: 'Gestão e coaching da equipe', descricao: 'Acompanhar números, dar feedback e desenvolver o time.', busca: 'gestão de equipe comercial feedback' },
}

export const COMPETENCIAS_LISTA = Object.keys(COMPETENCIAS) as Competencia[]

interface Livro { titulo: string; autor: string; porque: string }

// Obras conhecidas, com edição em português.
const LIVROS: Record<Competencia, Livro[]> = {
  ATENDIMENTO_RAPIDO: [{ titulo: 'Prospecção Fanática', autor: 'Jeb Blount', porque: 'Disciplina de contato: atender e retomar rápido, todo dia.' }],
  ABORDAGEM: [
    { titulo: 'Como Fazer Amigos e Influenciar Pessoas', autor: 'Dale Carnegie', porque: 'Base de relacionamento para a primeira conversa.' },
    { titulo: 'A Bíblia de Vendas', autor: 'Jeffrey Gitomer', porque: 'Abordagens práticas e o que dizer no começo da conversa.' },
  ],
  QUALIFICACAO: [
    { titulo: 'Alcançando Excelência em Vendas: SPIN Selling', autor: 'Neil Rackham', porque: 'O método de perguntas de situação, problema, implicação e necessidade.' },
    { titulo: 'Gap Selling', autor: 'Keenan', porque: 'Vender a distância entre onde o cliente está e onde quer chegar.' },
  ],
  FOLLOW_UP: [{ titulo: 'Prospecção Fanática', autor: 'Jeb Blount', porque: 'Cadência de contato e como não deixar o lead esfriar.' }],
  NEGOCIACAO: [
    { titulo: 'Negocie Como Se Sua Vida Dependesse Disso', autor: 'Chris Voss', porque: 'Escuta tática, perguntas calibradas e como não ceder cedo demais.' },
    { titulo: 'A Venda Desafiadora', autor: 'Matthew Dixon e Brent Adamson', porque: 'Ensinar algo ao cliente e conduzir a conversa.' },
  ],
  OBJECOES: [
    { titulo: 'Objeções', autor: 'Jeb Blount', porque: 'Roteiros para as objeções mais comuns, sem brigar com o cliente.' },
    { titulo: 'As Armas da Persuasão', autor: 'Robert Cialdini', porque: 'Os princípios que fazem alguém dizer sim.' },
  ],
  FECHAMENTO: [
    { titulo: 'As Armas da Persuasão', autor: 'Robert Cialdini', porque: 'Reciprocidade, compromisso, prova social e escassez de forma ética.' },
    { titulo: 'A Bíblia de Vendas', autor: 'Jeffrey Gitomer', porque: 'Como pedir a decisão e combinar o próximo passo.' },
  ],
  PROSPECCAO: [
    { titulo: 'Receita Previsível', autor: 'Aaron Ross e Marylou Tyler', porque: 'Organizar a geração de leads como processo.' },
    { titulo: 'Prospecção Fanática', autor: 'Jeb Blount', porque: 'Prospecção diária e indicação.' },
  ],
  ORGANIZACAO: [
    { titulo: 'Hábitos Atômicos', autor: 'James Clear', porque: 'Pequenas rotinas diárias que somam resultado.' },
    { titulo: 'A Única Coisa', autor: 'Gary Keller e Jay Papasan', porque: 'Escolher a prioridade do dia e proteger o tempo dela.' },
  ],
  WHATSAPP: [
    { titulo: 'Comunicação Não Violenta', autor: 'Marshall Rosenberg', porque: 'Escrever com clareza e empatia, sem soar insistente.' },
    { titulo: 'Alcançando Excelência em Vendas: SPIN Selling', autor: 'Neil Rackham', porque: 'Perguntas que funcionam também por mensagem.' },
  ],
  LIDERANCA: [
    { titulo: 'O Gerente Minuto', autor: 'Ken Blanchard e Spencer Johnson', porque: 'Metas curtas, elogio e correção no dia a dia.' },
    { titulo: 'Coaching para Performance', autor: 'John Whitmore', porque: 'Conversas de desenvolvimento com o modelo GROW.' },
  ],
}

const enc = (s: string) => encodeURIComponent(s)

export interface ItemBiblioteca { titulo: string; tipo: 'LIVRO' | 'BUSCA'; url: string; fonte: string; porque: string }

/** Livros da competência (link para a busca do livro) e buscas prontas de vídeo e pesquisa. */
export function bibliotecaDa(c: Competencia): ItemBiblioteca[] {
  const comp = COMPETENCIAS[c]
  return [
    ...LIVROS[c].map(l => ({
      titulo: `${l.titulo} — ${l.autor}`, tipo: 'LIVRO' as const, url: `https://www.google.com/search?tbm=bks&q=${enc(`${l.titulo} ${l.autor}`)}`,
      fonte: 'Google Livros (busca)', porque: l.porque,
    })),
    { titulo: `Vídeos: ${comp.nome.toLowerCase()}`, tipo: 'BUSCA', url: `https://www.youtube.com/results?search_query=${enc(comp.busca)}`, fonte: 'YouTube (busca)', porque: `Aulas e exemplos práticos sobre ${comp.nome.toLowerCase()}.` },
    { titulo: `Pesquisas: ${comp.nome.toLowerCase()}`, tipo: 'BUSCA', url: `https://scholar.google.com/scholar?q=${enc(comp.busca)}`, fonte: 'Google Acadêmico (busca)', porque: 'Estudos e artigos sobre o tema, para ir além da opinião.' },
  ]
}
