// Origem automática de pautas (seção 6):
// - Venda no CRM: venda fechada gera "Entrega: {modelo}" (Prova social) com o
//   roteiro de 3 tomadas — criada sozinha, uma por venda;
// - Audiência: sugestões a partir da demografia dos seguidores;
// - Estoque e Calendário: pelos botões "Gerar pauta" e "+ slot livre";
// - Insight: pelo botão do cartão de insight (tela Hoje).
// Sempre a partir de dados reais; nenhuma pauta repete a mesma origem.
import { prisma } from './prisma'
import { notificar } from './smPautas'
import { carregarPermissoes } from './smAcesso'

const DIA_MS = 24 * 3600 * 1000
export const DIAS_VENDA_RECENTE = 14

export const ROTEIRO_ENTREGA = {
  gancho: 'Cliente recebendo a chave, sem narração nos 2 primeiros segundos.',
  retencao: 'Depoimento curto de 1 frase do cliente.',
  recompensa: 'Cliente saindo com a moto.',
  cta: 'Marque quem também merece a moto nova',
}

/** Cria as pautas de entrega das vendas recentes que ainda não têm uma. */
export async function gerarPautasDeVendas(usuarioId: string, agora = new Date()): Promise<number> {
  // Sem acesso a vendas, o papel não fica sabendo de venda nenhuma (nem pela pauta).
  const perm = await carregarPermissoes(usuarioId)
  if (perm.niveis.vendas === 'SEM_ACESSO' || perm.niveis.producao === 'SEM_ACESSO') return 0
  const vendas = await prisma.venda.findMany({
    where: { usuarioId, data: { gte: new Date(agora.getTime() - DIAS_VENDA_RECENTE * DIA_MS) } },
    select: { id: true, data: true, lead: { select: { modeloInteresse: true } } },
  })
  if (!vendas.length) return 0
  const jaTem = new Set((await prisma.smPauta.findMany({
    where: { usuarioId, origem: 'VENDA', origemRef: { in: vendas.map(v => v.id) } },
    select: { origemRef: true },
  })).map(p => p.origemRef))
  let criadas = 0
  for (const v of vendas.filter(x => !jaTem.has(x.id))) {
    const modelo = v.lead?.modeloInteresse?.trim()
    const local = new Date(v.data.getTime() - 3 * 3600 * 1000)
    const titulo = modelo ? `Entrega: ${modelo}` : `Entrega do dia ${String(local.getUTCDate()).padStart(2, '0')}/${String(local.getUTCMonth() + 1).padStart(2, '0')}`
    await prisma.smPauta.create({
      data: {
        usuarioId, titulo, pilar: 'PROVA', formato: 'REELS', status: 'IDEIA', origem: 'VENDA', origemRef: v.id,
        ...ROTEIRO_ENTREGA, prazo: new Date(v.data.getTime() + 3 * DIA_MS), ordem: Date.now(), criadoPor: 'GESTOR',
      },
    })
    criadas++
  }
  if (criadas) {
    await notificar(usuarioId, 'SOCIAL_MEDIA', 'PAUTA_AUTOMATICA', 'pautas-entrega', criadas === 1 ? 'Nova pauta de entrega' : `${criadas} novas pautas de entrega`,
      'Venda fechada no CRM vira pauta de Prova social em Ideias, com o roteiro de 3 tomadas. Lembre de pegar a autorização de imagem do cliente.')
  }
  return criadas
}

export interface SugestaoAudiencia {
  ref: string // origemRef: evita sugerir de novo o que já virou pauta
  titulo: string
  pilar: 'EDUCACAO' | 'ESTOQUE' | 'PROVA' | 'BASTIDORES'
  formato: 'REELS' | 'CARROSSEL'
  motivo: string
  gancho: string
}

type Fatia = { chave: string; valor: number }
const pct = (v: number) => `${Math.round(v * 100)}%`

/** Sugestões a partir de quem segue a conta (demografia dos seguidores). */
export async function sugestoesDeAudiencia(usuarioId: string): Promise<SugestaoAudiencia[]> {
  const conta = await prisma.socialMediaConta.findUnique({ where: { titular: `dono:${usuarioId}` }, select: { demografia: true } })
  const demo = conta?.demografia as { seguidores?: { genero?: Fatia[]; idade?: Fatia[]; cidade?: Fatia[] } } | null
  const seg = demo?.seguidores
  if (!seg) return []
  const sugestoes: SugestaoAudiencia[] = []
  const total = (l?: Fatia[]) => (l ?? []).reduce((s, f) => s + f.valor, 0)

  const totalGenero = total(seg.genero)
  const mulheres = (seg.genero ?? []).find(f => f.chave === 'F')?.valor ?? 0
  if (totalGenero > 0 && mulheres / totalGenero >= 0.3) {
    const p = pct(mulheres / totalGenero)
    sugestoes.push({
      ref: 'audiencia:mulheres', titulo: 'Mulheres na moto: a primeira scooter', pilar: 'EDUCACAO', formato: 'CARROSSEL',
      motivo: `${p} de quem segue a conta são mulheres.`, gancho: `"${p} de quem nos segue são mulheres. Essa é pra vocês."`,
    })
  }
  const totalIdade = total(seg.idade)
  const faixa = [...(seg.idade ?? [])].sort((a, b) => b.valor - a.valor)[0]
  if (faixa && totalIdade > 0 && faixa.valor / totalIdade >= 0.25) {
    const jovem = ['18-24', '13-17'].includes(faixa.chave)
    sugestoes.push({
      ref: `audiencia:idade:${faixa.chave}`,
      titulo: jovem ? 'Primeira moto: como sair da loja pilotando' : `Moto para o dia a dia de quem tem ${faixa.chave.replace('-', ' a ')} anos`,
      pilar: jovem ? 'EDUCACAO' : 'ESTOQUE', formato: 'REELS',
      motivo: `A maior faixa de seguidores é ${faixa.chave} anos (${pct(faixa.valor / totalIdade)}).`,
      gancho: jovem ? '"Ainda não tem habilitação? Começa por aqui."' : '"Gastando demais com transporte? Faz a conta comigo."',
    })
  }
  const totalCidade = total(seg.cidade)
  const segunda = [...(seg.cidade ?? [])].sort((a, b) => b.valor - a.valor)[1]
  if (segunda && totalCidade > 0 && segunda.valor / totalCidade >= 0.1) {
    const nome = segunda.chave.split(',')[0]
    sugestoes.push({
      ref: `audiencia:cidade:${nome}`, titulo: `Entregamos em ${nome}`, pilar: 'PROVA', formato: 'REELS',
      motivo: `${pct(segunda.valor / totalCidade)} dos seguidores são de ${nome}.`, gancho: `"Mora em ${nome}? Olha quem já saiu daqui de moto nova."`,
    })
  }
  if (!sugestoes.length) return []
  const usadas = new Set((await prisma.smPauta.findMany({
    where: { usuarioId, origem: 'AUDIENCIA', origemRef: { in: sugestoes.map(s => s.ref) } },
    select: { origemRef: true },
  })).map(p => p.origemRef))
  return sugestoes.filter(s => !usadas.has(s.ref))
}
