// Saúde da conexão com a Meta, compartilhada pelo Tráfego e pelo Social Media.
// Os dois módulos usam o mesmo app da Meta (decisão P1). Quando a própria
// Meta bloqueia o app ("API access blocked"), os dois param juntos e nenhum
// token novo resolve: a pendência está no painel do app. Aqui o erro é
// classificado do mesmo jeito nos dois módulos, o bloqueio fica registrado
// uma vez só, e a conexão é testada sozinha de hora em hora até voltar,
// quando as duas sincronizações retomam sem ninguém precisar clicar.
import { prisma } from './prisma'
import { notificar } from './smPautas'

export type CausaMeta = 'APP_BLOQUEADO' | 'TOKEN' | 'PERMISSAO' | 'LIMITE' | 'OUTRO'

// Mensagens que a Meta devolve quando o problema é o app, não o token.
const APP_BLOQUEADO = /api access blocked|app(lication)? (has been |is )?(restricted|disabled|deleted|blocked|not active|inactive)|app not active|not accessible right now/i

export function causaDoErroMeta(codigo: number | undefined, mensagem = ''): CausaMeta {
  if (APP_BLOQUEADO.test(mensagem)) return 'APP_BLOQUEADO'
  if (codigo === 190 || codigo === 102) return 'TOKEN'
  if ([4, 17, 32, 613, 80000, 80004].includes(codigo ?? 0)) return 'LIMITE'
  if (codigo === 10 || (codigo != null && codigo >= 200 && codigo < 300)) return 'PERMISSAO'
  return 'OUTRO'
}

export const TITULO_APP_BLOQUEADO = 'A Meta bloqueou o app ARIES (não é o token nem a permissão)'
export const MENSAGEM_APP_BLOQUEADO = 'A Meta bloqueou o acesso do app ARIES à API ("API access blocked"). Não é o token nem a permissão: é uma pendência no painel do app na Meta. O passo a passo está no aviso do topo.'
export const PASSOS_APP_BLOQUEADO = [
  'Entre em developers.facebook.com/apps com a conta que administra o app e abra o app usado pelo ARIES (o mesmo do Tráfego e do Instagram).',
  'No Painel do app, procure o aviso em vermelho ou "Ação necessária". Os motivos mais comuns: a Verificação anual de uso de dados venceu, a verificação da empresa ficou pendente ou o app saiu do modo Ativo.',
  'Conclua o que a Meta pedir. Na verificação de uso de dados: confirme para que o app usa cada permissão e aceite os termos. Confira também se o "Modo do app" está em Ativo.',
  'Volte aqui e clique em "Já resolvi: testar agora". Os tokens continuam valendo: não precisa gerar outro. Se você não fizer nada aqui, o sistema testa sozinho de hora em hora e volta a sincronizar quando a Meta liberar.',
]

export type OrigemMeta = 'TRAFEGO' | 'SOCIAL_MEDIA'

/** O app foi bloqueado: guarda desde quando (a primeira vez) e a mensagem da Meta. */
export async function registrarBloqueio(usuarioId: string, origem: OrigemMeta, mensagemMeta: string, agora = new Date()) {
  const atual = await prisma.metaSaude.findUnique({ where: { usuarioId } })
  if (atual?.bloqueadoDesde) {
    await prisma.metaSaude.update({ where: { usuarioId }, data: { verificadoEm: agora } })
    return
  }
  await prisma.metaSaude.upsert({
    where: { usuarioId },
    create: { usuarioId, bloqueadoDesde: agora, bloqueioOrigem: origem, bloqueioMensagem: mensagemMeta.slice(0, 500), verificadoEm: agora },
    update: { bloqueadoDesde: agora, bloqueioOrigem: origem, bloqueioMensagem: mensagemMeta.slice(0, 500), verificadoEm: agora },
  })
}

/**
 * A Meta respondeu: se estava bloqueado, libera e põe a outra sincronização
 * para tentar já. Uma sincronização que deu certo só libera o bloqueio que o
 * próprio módulo registrou; o do outro módulo espera o teste dos dois (botão
 * ou job de hora em hora), para o aviso não ficar indo e voltando.
 */
export async function registrarLiberacao(usuarioId: string, agora = new Date(), origem?: OrigemMeta): Promise<boolean> {
  const atual = await prisma.metaSaude.findUnique({ where: { usuarioId }, select: { bloqueadoDesde: true, bloqueioOrigem: true } })
  if (!atual?.bloqueadoDesde) return false
  if (origem && atual.bloqueioOrigem !== origem) return false
  await prisma.metaSaude.update({ where: { usuarioId }, data: { bloqueadoDesde: null, liberadoEm: agora, verificadoEm: agora } })
  // O Instagram tenta de novo na próxima passada do job de 5 em 5 minutos.
  await prisma.socialMediaConta.updateMany({ where: { titular: `dono:${usuarioId}`, falhasSeguidas: { gt: 0 } }, data: { proximaTentativaEm: agora } })
  return true
}

export async function estadoDaConexao(usuarioId: string) {
  const s = await prisma.metaSaude.findUnique({ where: { usuarioId } })
  return {
    bloqueado: !!s?.bloqueadoDesde,
    bloqueadoDesde: s?.bloqueadoDesde ?? null,
    origem: s?.bloqueioOrigem ?? null,
    mensagemMeta: s?.bloqueioMensagem ?? null,
    verificadoEm: s?.verificadoEm ?? null,
    liberadoEm: s?.liberadoEm ?? null,
    titulo: TITULO_APP_BLOQUEADO,
    passos: PASSOS_APP_BLOQUEADO,
  }
}

// ---------- Lembrete anual ----------

const DIA_MS = 864e5

/**
 * A verificação anual de uso de dados da Meta vence um ano depois da última.
 * 30 dias antes do aniversário do último desbloqueio, o gestor é lembrado de
 * conferir o painel do app, para não perder o acesso de novo.
 */
export async function lembretesAnuais(agora = new Date()) {
  const lista = await prisma.metaSaude.findMany({ where: { bloqueadoDesde: null, liberadoEm: { not: null, lte: new Date(agora.getTime() - 335 * DIA_MS) } } })
  let n = 0
  for (const s of lista) {
    if (s.lembreteEm && s.lembreteEm > s.liberadoEm!) continue
    const vence = new Date(s.liberadoEm!.getTime() + 365 * DIA_MS)
    const data = vence.toLocaleDateString('pt-BR', { timeZone: 'America/Belem' })
    await notificar(s.usuarioId, 'GESTOR', 'META_REVISAO', `meta-revisao:${s.liberadoEm!.toISOString().slice(0, 10)}`,
      'Confira o painel do app na Meta antes de vencer',
      `No ano passado a Meta bloqueou o app ARIES por uma pendência no painel (Tráfego e Instagram pararam juntos). A revisão anual costuma vencer perto de ${data}: abra developers.facebook.com/apps e conclua o que estiver em "Ação necessária".`,
      { href: '/pro-labore/trafego' })
    await prisma.metaSaude.update({ where: { id: s.id }, data: { lembreteEm: agora } })
    n++
  }
  return { lembretesMeta: n }
}
