// Tela 05 · Desempenho (seção 8): os blocos novos sobre a análise da conta.
// - 6 sinais que o Instagram mais pesa (fórmulas da seção 12), com metas do gestor;
// - diagnóstico dos reels com o veredito da seção 8;
// - código, leads e vendas de cada publicação (a venda é creditada ao post
//   mesmo fora do período, como na tela 06).
// Os números saem do banco; nada aqui é estimado.
import { prisma } from './prisma'
import type { analisarContaSocialMedia } from './socialMediaResumo'
import type { ConfigCalendario } from './smCalendario'
import type { ContextoSM } from './smAcesso'

type Analise = Awaited<ReturnType<typeof analisarContaSocialMedia>>
type Post = Analise['publicacoes'][number]

export type StatusSinal = 'ok' | 'atencao' | 'sem_dados' | 'informativo'
export interface Sinal {
  chave: 'retencao' | 'pulo' | 'envios' | 'salvos' | 'curtidas' | 'naoSeguidores'
  rotulo: string
  valor: number | null
  unidade: '%' | 'por mil'
  meta: number | null
  metaTexto: string | null
  status: StatusSinal
  texto: string
  amostra: number
}

const soma = <T>(l: T[], f: (x: T) => number) => l.reduce((s, x) => s + f(x), 0)
const arred = (v: number, casas = 1) => Math.round(v * 10 ** casas) / 10 ** casas

export function sinaisDoPeriodo(analise: Analise, config: ConfigCalendario): Sinal[] {
  const posts = analise.publicacoes.filter(p => !p.semInsights)
  const reels = posts.filter(p => p.formato === 'REELS')
  const comRetencao = reels.filter(r => r.retencao != null)
  const comPulo = reels.filter(r => r.taxaPulo != null && r.visualizacoes > 0)
  const alcance = soma(posts, p => p.alcance)

  const retencao = comRetencao.length ? (soma(comRetencao, r => r.retencao!) / comRetencao.length) * 100 : null
  // Pulo nos 3 s: média ponderada pelas views (seção 12).
  const viewsPulo = soma(comPulo, r => r.visualizacoes)
  const pulo = viewsPulo ? (soma(comPulo, r => r.taxaPulo! * r.visualizacoes) / viewsPulo) * 100 : null
  const envios = alcance ? (soma(posts, p => p.compartilhamentos) / alcance) * 1000 : null
  const salvos = alcance ? (soma(posts, p => p.salvamentos) / alcance) * 1000 : null
  const curtidas = alcance ? (soma(posts, p => p.curtidas) / alcance) * 100 : null
  const descoberta = analise.distribuicaoAlcance?.shareDescoberta
  const naoSeguidores = descoberta != null ? descoberta * 100 : null

  const acima = (v: number | null, meta: number): StatusSinal => v == null ? 'sem_dados' : v >= meta ? 'ok' : 'atencao'
  const abaixo = (v: number | null, meta: number): StatusSinal => v == null ? 'sem_dados' : v < meta ? 'ok' : 'atencao'
  const num = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

  return [
    {
      chave: 'retencao', rotulo: 'Retenção média', unidade: '%', valor: retencao == null ? null : arred(retencao), meta: config.metaRetencao, metaTexto: `meta ${config.metaRetencao}%`,
      status: acima(retencao, config.metaRetencao), amostra: comRetencao.length,
      texto: retencao == null
        ? (reels.length ? 'Falta a duração dos reels: ela é lida do vídeo na próxima sincronização.' : 'Nenhum reel no período.')
        : `Quanto do reel as pessoas assistem, em média (${comRetencao.length} ${comRetencao.length === 1 ? 'reel' : 'reels'}).`,
    },
    {
      chave: 'pulo', rotulo: 'Pulo nos 3 primeiros segundos', unidade: '%', valor: pulo == null ? null : arred(pulo), meta: config.metaPuloPct, metaTexto: `meta abaixo de ${config.metaPuloPct}%`,
      status: abaixo(pulo, config.metaPuloPct), amostra: comPulo.length,
      texto: pulo == null ? (reels.length ? 'O Instagram ainda não devolveu a taxa de pulo desses reels.' : 'Nenhum reel no período.') : 'Quem passou o reel antes de 3 s. Mede a força do gancho.',
    },
    {
      chave: 'envios', rotulo: 'Envios por mil alcançados', unidade: 'por mil', valor: envios == null ? null : arred(envios, 2), meta: config.metaEnviosMil, metaTexto: `meta ${num(config.metaEnviosMil)}`,
      status: acima(envios, config.metaEnviosMil), amostra: posts.length,
      texto: 'Compartilhamentos a cada mil contas alcançadas. É o sinal que mais leva a não seguidores.',
    },
    {
      chave: 'salvos', rotulo: 'Salvos por mil alcançados', unidade: 'por mil', valor: salvos == null ? null : arred(salvos, 2), meta: config.metaSalvosMil, metaTexto: `meta ${num(config.metaSalvosMil)}`,
      status: acima(salvos, config.metaSalvosMil), amostra: posts.length,
      texto: 'Quem guardou o post para ver depois. Conteúdo útil puxa esse número.',
    },
    {
      chave: 'curtidas', rotulo: 'Curtidas por alcance', unidade: '%', valor: curtidas == null ? null : arred(curtidas, 2), meta: config.metaCurtidasPct, metaTexto: `meta ${num(config.metaCurtidasPct)}%`,
      status: acima(curtidas, config.metaCurtidasPct), amostra: posts.length,
      texto: 'Curtidas sobre as contas alcançadas pelos posts do período.',
    },
    {
      chave: 'naoSeguidores', rotulo: 'Alcance em não seguidores', unidade: '%', valor: naoSeguidores == null ? null : arred(naoSeguidores), meta: null, metaTexto: 'informativo',
      status: naoSeguidores == null ? 'sem_dados' : 'informativo', amostra: 0,
      texto: naoSeguidores == null
        ? 'O Instagram ainda não devolveu a divisão entre seguidores e não seguidores.'
        : `Da conta inteira nos últimos ${analise.distribuicaoAlcance?.periodoDias ?? 30} dias (o Instagram não separa por post nem por origem).`,
    },
  ]
}

export type Veredito = 'REPETIR' | 'BOM' | 'GANCHO_FRACO' | 'ABAIXO'

/** Veredito do reel (seção 8), na ordem da especificação. */
export function vereditoDoReel(multiplo: number | null, pulo: number | null): Veredito {
  if (multiplo != null && multiplo >= 2.5 && pulo != null && pulo < 0.4) return 'REPETIR'
  if (multiplo != null && multiplo >= 1.3) return 'BOM'
  if (pulo != null && pulo >= 0.6) return 'GANCHO_FRACO'
  return 'ABAIXO'
}

export function diagnosticoDosReels(analise: Analise) {
  const mediana = analise.radar.medianaReferencia
  return analise.publicacoes
    .filter(p => p.formato === 'REELS' && !p.semInsights)
    .map(p => {
      const multiplo = mediana > 0 ? arred(p.alcance / mediana, 2) : null
      return {
        id: p.id,
        instagramMediaId: p.instagramMediaId,
        nome: tituloDoPost(p),
        permalink: p.permalink,
        publicadoEm: p.publicadoEm,
        duracaoSeg: p.duracaoSeg,
        retencao: p.retencao,
        pulo: p.taxaPulo,
        enviosMil: p.alcance ? arred((p.compartilhamentos / p.alcance) * 1000, 2) : null,
        alcance: p.alcance,
        multiplo,
        veredito: vereditoDoReel(multiplo, p.taxaPulo),
      }
    })
    .sort((a, b) => (b.multiplo ?? 0) - (a.multiplo ?? 0))
}

export function tituloDoPost(p: Pick<Post, 'legenda'>): string {
  const l = p.legenda?.split('\n')[0]?.trim() ?? ''
  return !l ? 'Reel sem legenda' : l.length > 60 ? `${l.slice(0, 57).trimEnd()}…` : l
}

/** Código, leads e vendas de cada publicação (por id da mídia no Instagram). */
export async function atribuicaoDasPublicacoes(usuarioId: string, midiaIds: string[], verLeads: boolean, verVendas: boolean) {
  const pautas = await prisma.smPauta.findMany({ where: { usuarioId, igMediaId: { in: midiaIds } }, select: { igMediaId: true, codigo: true } })
  const codigoDaMidia = new Map(pautas.map(p => [p.igMediaId!, p.codigo]))
  const midiaDoCodigo = new Map(pautas.filter(p => p.codigo).map(p => [p.codigo!, p.igMediaId!]))
  const resultado = new Map<string, { codigo: string | null; leads: number | null; vendas: number | null }>()
  for (const id of midiaIds) resultado.set(id, { codigo: codigoDaMidia.get(id) ?? null, leads: verLeads ? 0 : null, vendas: verVendas ? 0 : null })
  if (!verLeads && !verVendas) return resultado
  const codigos = [...midiaDoCodigo.keys()]
  const leads = await prisma.lead.findMany({
    where: { usuarioId, OR: [{ midiaId: { in: midiaIds } }, ...(codigos.length ? [{ postCode: { in: codigos } }] : [])] },
    select: { midiaId: true, postCode: true, vendaId: true },
  })
  for (const l of leads) {
    const midia = (l.midiaId && resultado.has(l.midiaId) ? l.midiaId : null) ?? (l.postCode ? midiaDoCodigo.get(l.postCode) : undefined)
    const r = midia ? resultado.get(midia) : undefined
    if (!r) continue
    if (r.leads != null) r.leads++
    if (r.vendas != null && l.vendaId) r.vendas++
  }
  return resultado
}

/** Tira da análise o que o papel não pode ver (gasto de anúncio, R$, CRM sem acesso). */
export function filtrarParaOPapel(analise: Analise, sm: ContextoSM) {
  const gestor = sm.visao === 'GESTOR' && !sm.verComo
  const verCrm = sm.pode('crm', 'LEITURA')
  const verVendas = sm.pode('vendas', 'LEITURA')
  const verValores = gestor || sm.permissoes.regras.mostrarValores
  return {
    ...analise,
    // Gasto com anúncio é financeiro: só o gestor vê.
    publicacoes: analise.publicacoes.map(p => ({ ...p, gastoPago: gestor ? p.gastoPago : null, leads: verCrm ? p.leads : null, vendas: verCrm && verVendas ? p.vendas : null })),
    origem: { ...analise.origem, gastoImpulsionamento: gestor ? analise.origem.gastoImpulsionamento : null },
    relacaoVendas: verCrm
      ? { ...analise.relacaoVendas, leadsGanhos: verVendas ? analise.relacaoVendas.leadsGanhos : null, valorNegociadoTotal: verVendas && verValores ? analise.relacaoVendas.valorNegociadoTotal : null }
      : null,
    funil: {
      ...analise.funil,
      leads: verCrm ? analise.funil.leads : null,
      vendas: verCrm && verVendas ? analise.funil.vendas : null,
    },
  }
}
