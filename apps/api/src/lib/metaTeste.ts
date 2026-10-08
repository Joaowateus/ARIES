// Teste ativo das conexões com a Meta (Tráfego e Instagram) e a recuperação
// automática: enquanto o app estiver bloqueado, o job de hora em hora testa
// com uma chamada leve; quando a Meta libera, as duas sincronizações voltam.
import { prisma } from './prisma'
import { ErroMetaAds, testarContaDeAnuncio } from './metaAds'
import { ErroGraphApi, buscarContaInstagram, buscarContaInstagramPorId, comApiDaEmpresa } from './instagramGraph'
import { causaDoErroMeta, registrarBloqueio, registrarLiberacao, type CausaMeta, type OrigemMeta } from './metaConexao'
import { sincronizarTrafego } from './trafegoSync'

export interface TesteConexao { modulo: OrigemMeta; nome: string; ok: boolean; causa: CausaMeta | null; detalhe: string }

async function testar(modulo: OrigemMeta, nome: string, f: () => Promise<unknown>): Promise<TesteConexao> {
  try {
    await f()
    return { modulo, nome, ok: true, causa: null, detalhe: 'A Meta respondeu normalmente.' }
  } catch (e) {
    const codigo = e instanceof ErroMetaAds || e instanceof ErroGraphApi ? e.codigo : undefined
    const original = e instanceof ErroMetaAds ? e.original ?? e.message : e instanceof Error ? e.message : 'Falhou'
    return { modulo, nome, ok: false, causa: causaDoErroMeta(codigo, original), detalhe: original }
  }
}

export async function testarConexoesMeta(usuarioId: string, agora = new Date()) {
  const [trafego, conta] = await Promise.all([
    prisma.trafegoConta.findUnique({ where: { usuarioId } }),
    prisma.socialMediaConta.findUnique({ where: { titular: `dono:${usuarioId}` } }),
  ])
  const testes: TesteConexao[] = []
  if (trafego) testes.push(await testar('TRAFEGO', `Tráfego · ${trafego.nome}`, () => testarContaDeAnuncio(trafego.adAccountId, trafego.accessToken)))
  if (conta) {
    testes.push(await testar('SOCIAL_MEDIA', `Instagram · @${conta.nomeUsuario}`, () => (conta.tipoConexao === 'EMPRESA'
      ? comApiDaEmpresa(() => buscarContaInstagramPorId(conta.instagramUserId, conta.accessToken))
      : buscarContaInstagram(conta.accessToken))))
  }
  const bloqueio = testes.find(t => t.causa === 'APP_BLOQUEADO')
  let liberou = false
  if (bloqueio) await registrarBloqueio(usuarioId, bloqueio.modulo, bloqueio.detalhe, agora)
  // Se alguma chamada passou e nenhuma acusou bloqueio, o app está liberado.
  else if (testes.some(t => t.ok)) liberou = await registrarLiberacao(usuarioId, agora)
  return { testes, bloqueado: !!bloqueio, liberou }
}

/** Job de hora em hora: testa quem está bloqueado; liberou, o Tráfego sincroniza já e o Instagram na próxima passada. */
export async function recuperarConexoesMeta(agora = new Date()) {
  const bloqueados = await prisma.metaSaude.findMany({
    where: { bloqueadoDesde: { not: null }, OR: [{ verificadoEm: null }, { verificadoEm: { lte: new Date(agora.getTime() - 50 * 60_000) } }] },
    select: { usuarioId: true },
  })
  let liberadas = 0
  for (const { usuarioId } of bloqueados) {
    const r = await testarConexoesMeta(usuarioId, agora)
    if (!r.liberou) continue
    liberadas++
    const t = await prisma.trafegoConta.findUnique({ where: { usuarioId } })
    if (t) await sincronizarTrafego(t).catch(() => undefined)
  }
  return { metaTestadas: bloqueados.length, metaLiberadas: liberadas }
}
