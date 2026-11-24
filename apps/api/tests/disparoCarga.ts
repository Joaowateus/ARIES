// ARIES DISPARO — teste de carga progressivo (100, 500, 1.000, 5.000, 10.000 destinatários de teste).
// Só no banco de teste, com o provedor de teste (nenhuma mensagem sai) e sem o ritmo de proteção do
// número (mede o motor, não o WhatsApp). 5.000 e 10.000 são divididos em 10 campanhas simultâneas
// (10 números), como numa loja com vários vendedores. Os volumes não são limites autorizados de envio.
// Uso: DATABASE_URL=... npx ts-node tests/disparoCarga.ts [tamanhos] > docs/disparo/carga.json
process.env.DISPARO_TESTE_SEM_RITMO = '1'
import { randomUUID } from 'crypto'
import { prisma } from '../src/lib/prisma'
import { criarProvedorFalso, definirProvedor } from '../src/lib/disparo/provedor'
import { prepararCampanha, transicionar, rodarDisparo } from '../src/lib/disparo/motor'
import { resumoCampanha } from '../src/lib/disparo/relatorios'

const tamanhos = (process.argv[2] ?? '100,500,1000,5000,10000').split(',').map(Number)
const mb = (b: number) => Math.round(b / 1024 / 1024)

async function rodar(n: number) {
  const falso = criarProvedorFalso()
  definirProvedor(falso)
  const u = await prisma.proLaboreUsuario.create({ data: { nome: `Carga ${n}`, email: `carga-${n}-${randomUUID()}@t.local`, senhaHash: 'x' } })
  const numeros = n >= 5000 ? 10 : 1
  const campanhas: string[] = []
  const t0 = Date.now()
  for (let k = 0; k < numeros; k++) {
    const v = await prisma.vendedor.create({ data: { usuarioId: u.id, nome: `Vendedor ${k}`, papel: 'VENDEDOR' } })
    const a = await prisma.assistenteComercial.create({ data: { vendedorId: v.id, instancia: `carga-${randomUUID()}`, status: 'CONECTADO', numeroWhatsapp: `55919000${String(k).padStart(5, '0')}` } })
    const porNumero = Math.ceil(n / numeros)
    const leads = Array.from({ length: porNumero }, (_, i) => ({ usuarioId: u.id, vendedorId: v.id, nomeCliente: `Contato ${k}-${i}`, telefone: `55919${String(10_000_000 + k * 1_000_000 + i).slice(-8)}`, etapa: 'LEAD' }))
    for (let i = 0; i < leads.length; i += 2000) await prisma.lead.createMany({ data: leads.slice(i, i + 2000) })
    const c = await prisma.disparoCampanha.create({ data: { usuarioId: u.id, nome: `Carga ${n} #${k}`, finalidade: 'OPERACIONAL', assistenteId: a.id, publico: { base: 'LEADS', filtros: { op: 'E', itens: [{ campo: 'vendedor', op: 'igual', valor: v.id }] } }, conteudo: { passos: [{ tipo: 'TEXTO', texto: 'Oi {{primeiro_nome}}, aviso de teste de carga.' }] }, config: { janela: { inicio: '00:00', fim: '23:59', dias: [0, 1, 2, 3, 4, 5, 6] }, intervaloSeg: 0, maxPorHora: 1_000_000, maxPorDia: 1_000_000 }, preparo: { leitor: { usuarioId: u.id, papel: 'DONO', vendedorId: null } }, status: 'VALIDATING' } })
    campanhas.push(c.id)
  }
  const tDados = Date.now() - t0
  let pico = process.memoryUsage().rss
  const medir = setInterval(() => { pico = Math.max(pico, process.memoryUsage().rss) }, 200)
  const t1 = Date.now()
  for (const id of campanhas) { await prepararCampanha(id); await transicionar(id, 'QUEUED', { de: ['READY'] }) }
  const tPreparo = Date.now() - t1
  // Rodadas como a rotina de cada minuto (prazo de 18 s), até terminar; mede uma consulta do CRM no meio.
  const t2 = Date.now()
  let rodadas = 0
  const latCrm: number[] = []
  for (;;) {
    rodadas += 1
    const crm = (async () => { await new Promise(ok => setTimeout(ok, 3000)); const s = Date.now(); await prisma.lead.findMany({ where: { usuarioId: u.id }, take: 50, orderBy: { criadoEm: 'desc' } }); latCrm.push(Date.now() - s) })()
    const [r] = await Promise.all([rodarDisparo(18_000), crm])
    const abertas = await prisma.disparoCampanha.count({ where: { id: { in: campanhas }, status: { in: ['QUEUED', 'RUNNING'] } } })
    if (!abertas || rodadas > 200) break
    if (!r.disparoEnviadas && !r.disparoIniciadas && !r.disparoConcluidas) { process.stderr.write('rodada sem progresso: parando\n'); break }
  }
  const tEnvio = Date.now() - t2
  clearInterval(medir)
  const resumos = await Promise.all(campanhas.map(id => resumoCampanha(id)))
  const aceitas = resumos.reduce((s, r) => s + (r?.aceitas ?? 0), 0), falhas = resumos.reduce((s, r) => s + (r?.falhas ?? 0), 0)
  const repetidos = falso.enviados.length - new Set(falso.enviados.map(e => `${e.destino}:${e.texto}`)).size
  return {
    destinatarios: n, numerosRemetentes: numeros, campanhasSimultaneas: numeros, criacaoDadosMs: tDados, preparacaoMs: tPreparo, envioMs: tEnvio, rodadasDeUmMinuto: rodadas,
    mensagensPorSegundo: Math.round((aceitas / Math.max(1, tEnvio / 1000)) * 10) / 10, aceitas, falhas, enviosRepetidos: repetidos,
    memoriaPicoMB: mb(pico), consultaCrmDuranteEnvioMs: { mediana: latCrm.sort((a, b) => a - b)[Math.floor(latCrm.length / 2)] ?? null, maxima: Math.max(...latCrm) },
  }
}

async function main() {
  const resultados = []
  for (const n of tamanhos) { const r = await rodar(n); resultados.push(r); process.stderr.write(`${JSON.stringify(r)}\n`) }
  process.stdout.write(JSON.stringify({ geradoEm: new Date().toISOString(), ambiente: 'Postgres 16 local, provedor de teste, sem ritmo de proteção', resultados }, null, 2))
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
