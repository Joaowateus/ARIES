// Dossiê Estratégico do AVATAR do mercado de motocicletas: a fonte principal
// da Central Estratégica de Conteúdo. A versão 1 nasce deste padrão; depois,
// cada edição do gestor vira uma versão nova (as antigas ficam no histórico).
// Os dados de desempenho nunca reescrevem o dossiê sozinhos: mudança
// estratégica é proposta, com justificativa, e o gestor aprova.
import { z } from 'zod'

export const LISTAS_DOSSIE = ['dores', 'desejos', 'objecoes', 'emocoes', 'crencas', 'lentes', 'personas', 'posicionamento', 'regras'] as const
export type ListaDossie = (typeof LISTAS_DOSSIE)[number]

export const dossieSchema = z.object({
  avatar: z.string().trim().min(10).max(3000),
  dores: z.array(z.string().trim().min(2).max(300)).min(1).max(60),
  desejos: z.array(z.string().trim().min(2).max(300)).min(1).max(60),
  objecoes: z.array(z.string().trim().min(2).max(300)).min(1).max(60),
  emocoes: z.array(z.string().trim().min(2).max(300)).max(60),
  crencas: z.array(z.string().trim().min(2).max(300)).max(60),
  lentes: z.array(z.string().trim().min(2).max(120)).min(1).max(30),
  personas: z.array(z.string().trim().min(2).max(300)).min(1).max(20),
  posicionamento: z.array(z.string().trim().min(2).max(300)).min(1).max(40),
  regras: z.array(z.string().trim().min(2).max(400)).max(60),
  promessa: z.object({
    texto: z.string().trim().max(400),
    aprovada: z.boolean(),
    condicoes: z.string().trim().max(2000),
  }),
})
export type Dossie = z.infer<typeof dossieSchema>

export const DOSSIE_PADRAO: Dossie = {
  avatar: 'Pessoas de 20 a 35 anos que querem comprar a primeira moto ou trocar a atual por uma mais nova, com uma negociação justa, uma parcela que caiba na realidade financeira, mais mobilidade e autonomia, sem problemas mecânicos, documentais ou financeiros, e com confiança na compra. Não são todos iguais: variam a situação de compra, o quanto entendem de moto e de financiamento, a necessidade de mobilidade, a condição financeira e o nível de confiança.',
  dores: [
    'Receber uma avaliação baixa pela moto usada',
    'Não conseguir uma parcela compatível com a realidade financeira',
    'Sentir dificuldade para negociar uma boa proposta',
    'Enfrentar uma negociação injusta, confusa ou pressionada',
    'Ter medo de comprar uma moto sem procedência',
    'Não saber avaliar a qualidade da moto',
    'Descobrir problemas depois da compra',
    'Não entender juros, entrada, prazo e custo total',
    'Desconfiar das promessas do vendedor',
    'Não saber se o preço pedido corresponde ao valor real da moto',
    'Ter dúvidas sobre documentação, garantia e pós-venda',
    'Sentir que pode perder dinheiro por falta de conhecimento',
  ],
  desejos: [
    'Parcela justa',
    'Avaliação justa da moto usada',
    'Negociação saudável',
    'Moto com procedência',
    'Qualidade e informações claras',
    'Profissionalismo no atendimento',
    'Suporte e pós-venda',
    'Mais mobilidade e independência',
    'Fazer uma compra da qual não se arrependa',
    'Sentir que tomou uma decisão inteligente',
    'Segurança para perguntar e negociar',
    'Uma moto compatível com a rotina e as possibilidades',
  ],
  objecoes: [
    'O valor da parcela',
    'A proposta e a oferta',
    'Os juros',
    'A qualidade da moto',
    'O valor percebido do produto',
    'A avaliação da moto usada',
    'A entrada e o prazo do financiamento',
    'A documentação',
    'A procedência',
    'A garantia',
    'O pós-venda',
    'O receio de fechar negócio e se arrepender',
    'A dúvida entre comprar agora ou esperar',
    'A comparação com ofertas concorrentes',
  ],
  emocoes: [
    'Medo de fazer um mau negócio',
    'Raiva de propostas percebidas como injustas',
    'Frustração por adiar a compra',
    'Vergonha de não conhecer aspectos técnicos',
    'Desejo de conquistar algo melhor',
    'Comparação com amigos e pessoas próximas',
    'Busca de liberdade e autonomia',
    'Necessidade de previsibilidade financeira',
    'Desejo de ser respeitado na negociação',
    'Receio de promessas que parecem boas demais',
  ],
  crencas: [
    'Uma parcela baixa não significa necessariamente um bom negócio',
    'A proposta mais barata nem sempre é a melhor',
    'É importante conhecer o custo total',
    'A avaliação da moto usada precisa ser explicada',
    'A procedência deve ser verificada',
    'Garantia e pós-venda precisam ter termos claros',
    'O comprador deve poder perguntar sem constrangimento',
    'Uma boa negociação deve ser compreensível para as duas partes',
  ],
  lentes: [
    'Liberdade e autonomia', 'Sobrevivência financeira', 'Autoproteção', 'Justiça e equilíbrio', 'Conquista pessoal', 'Status e pertencimento',
    'Validação social', 'Previsibilidade', 'Comparação entre alternativas', 'Custo de oportunidade', 'Responsabilidade', 'Respeito',
  ],
  personas: [
    'Jovem que quer comprar a primeira moto',
    'Trabalhador que precisa de mobilidade',
    'Quem quer trocar a moto usada por uma mais atual',
    'Comprador cauteloso que prioriza procedência e segurança',
    'Comprador aspiracional que quer evoluir para uma moto melhor',
  ],
  posicionamento: [
    'Negociação transparente',
    'Avaliação justa',
    'Clareza sobre as condições',
    'Qualidade e procedência',
    'Informações verificáveis',
    'Respeito ao comprador',
    'Atendimento profissional',
    'Garantia com condições claras',
    'Suporte e pós-venda',
    'Ajuda para comparar alternativas',
  ],
  regras: [
    'As dores, crenças e emoções são hipóteses de comunicação: não atribuir a todos os compradores.',
    'Personas são instrumentos de planejamento, não clientes reais: não inventar depoimentos nem histórias pessoais.',
    'Nunca inventar pesquisas, estatísticas, depoimentos, vendas, preços, taxas, estoque ou resultados.',
    'Não responder objeções com desconto: priorizar explicação, transparência, critérios de comparação e demonstração.',
    'Não usar humilhação, medo artificial, manipulação de inseguranças ou pressão financeira para vender.',
    'Não prometer aprovação de financiamento nem apresentar simulação hipotética como proposta real.',
    'Estoque, preço, taxa, garantia e condição comercial só são publicados depois de confirmados.',
    'Depoimentos e avaliações de clientes só com autorização registrada.',
    'Não inventar urgência ou escassez.',
  ],
  promessa: {
    texto: 'Motos com a melhor negociação do mercado. Se encontrar uma oferta comparável melhor, cobrimos.',
    aprovada: false,
    condicoes: 'Só pode ser publicada com regras comerciais formalmente aprovadas: critérios de comparação, condições, prazo e limitações.',
  },
}

/** Dossiê guardado (pode vir de uma versão antiga sem algum campo): completa com o padrão. */
export function lerDossie(conteudo: unknown): Dossie {
  const c = (conteudo && typeof conteudo === 'object' ? conteudo : {}) as Partial<Dossie>
  return { ...DOSSIE_PADRAO, ...c, promessa: { ...DOSSIE_PADRAO.promessa, ...(c.promessa ?? {}) } }
}
