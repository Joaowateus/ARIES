// ARIES DISPARO — Biblioteca de arquivos: envio grande direto para o armazenamento (link assinado),
// plano B em pedaços pela API, conferência pelo conteúdo, capa, links temporários, importação do
// Instagram e o arquivo que vai para o WhatsApp (por link). Supabase e Instagram são simulados por um
// servidor local que segue os mesmos endereços e respostas das APIs reais. Sem banco, pula.
import http from 'http'
import type { AddressInfo } from 'net'
const PORTA_FALSA = 39000 + Math.floor(Math.random() * 900)
const FALSO = `http://127.0.0.1:${PORTA_FALSA}`
// Ids dos stories únicos por rodada (o id do Instagram é único no banco inteiro).
const RODADA = String(Date.now()).slice(-7)
const ST1 = `18${RODADA}1`, ST2 = `18${RODADA}2`, ST_VELHO = `18${RODADA}9`
process.env.INSTAGRAM_GRAPH_BASE = FALSO
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'crypto'
import type { Server } from 'http'
import { prisma } from '../src/lib/prisma'
import { signProLaboreToken } from '../src/lib/jwtProLabore'
import { arquivoParaEnvio, mimePeloConteudo } from '../src/lib/disparo/midias'
import app from '../src/app'

// ---------- Supabase Storage + Instagram Graph + CDN, falsos ----------
const objetos = new Map<string, Buffer>()
const pedidos: string[] = []
let recusarPutDireto = false
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 7)])
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(300, 3)])
const MP4 = (n: number) => { const b = Buffer.alloc(n, 1); b.write('ftypisom', 4, 'ascii'); b.writeUInt32BE(24, 0); return b }
const corpo = (req: http.IncomingMessage) => new Promise<Buffer>(ok => { const p: Buffer[] = []; req.on('data', d => p.push(d)); req.on('end', () => ok(Buffer.concat(p))) })
const falso = http.createServer(async (req, res) => {
  const u = new URL(req.url!, FALSO)
  const caminho = decodeURIComponent(u.pathname)
  pedidos.push(`${req.method} ${caminho}`)
  const json = (s: number, j: unknown) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(j)) }
  const b = await corpo(req)
  if (caminho === '/storage/v1/bucket') return json(200, { name: 'aries-arquivos' })
  let m = caminho.match(/^\/storage\/v1\/object\/upload\/sign\/aries-arquivos\/(.+)$/)
  if (m && req.method === 'POST') return json(200, { url: `/object/upload/sign/aries-arquivos/${m[1]}?token=tk-${m[1].length}` })
  if (m && req.method === 'PUT') {
    if (recusarPutDireto) return json(403, { error: 'cors' })
    if (u.searchParams.get('token') !== `tk-${m[1].length}`) return json(400, { error: 'token' })
    objetos.set(m[1], b); return json(200, { Key: m[1] })
  }
  m = caminho.match(/^\/storage\/v1\/object\/sign\/aries-arquivos$/)
  if (m && req.method === 'POST') { const j = JSON.parse(b.toString()) as { paths: string[] }; return json(200, j.paths.map(p => ({ path: p, signedURL: `/object/sign/aries-arquivos/${p}?token=leitura`, error: objetos.has(p) ? null : 'not found' }))) }
  m = caminho.match(/^\/storage\/v1\/object\/sign\/aries-arquivos\/(.+)$/)
  if (m && req.method === 'GET') { const o = objetos.get(m[1]); if (!o) return json(404, {}); res.writeHead(200); res.end(o); return }
  if (caminho === '/storage/v1/object/aries-arquivos' && req.method === 'DELETE') { for (const p of (JSON.parse(b.toString()) as { prefixes: string[] }).prefixes) objetos.delete(p); return json(200, []) }
  m = caminho.match(/^\/storage\/v1\/object\/aries-arquivos\/(.+)$/)
  if (m && req.method === 'POST') { objetos.set(m[1], b); return json(200, { Key: m[1] }) }
  if (m && req.method === 'GET') {
    const o = objetos.get(m[1]); if (!o) return json(404, { error: 'not found' })
    const r = req.headers.range?.match(/bytes=(\d+)-(\d+)/)
    if (r) { const fim = Math.min(o.length - 1, Number(r[2])); res.writeHead(206, { 'Content-Range': `bytes ${r[1]}-${fim}/${o.length}` }); res.end(o.subarray(Number(r[1]), fim + 1)); return }
    res.writeHead(200); res.end(o); return
  }
  // Instagram Graph
  if (caminho === '/me/media' && u.searchParams.get('after') === 'C2') return json(200, { data: [
    { id: '1790003', caption: 'Foto antiga', media_type: 'IMAGE', media_product_type: 'FEED', media_url: `${FALSO}/cdn/foto2.jpg`, permalink: 'https://instagram.com/p/z', timestamp: '2026-01-02T12:00:00+0000' },
  ] })
  if (caminho === '/me/stories') return json(200, { data: [
    { id: ST1, media_type: 'VIDEO', media_product_type: 'STORY', media_url: `${FALSO}/cdn/video.mp4`, thumbnail_url: `${FALSO}/cdn/capa.jpg`, timestamp: new Date(Date.now() - 3600e3).toISOString() },
    { id: ST2, media_type: 'IMAGE', media_product_type: 'STORY', media_url: `${FALSO}/cdn/foto.png`, timestamp: new Date(Date.now() - 7200e3).toISOString() },
  ] })
  if (caminho === '/me/media') return json(200, { paging: { cursors: { after: 'C2' }, next: `${FALSO}/me/media?after=C2` }, data: [
    { id: '1790001', caption: 'Reels da CG 160 nova\n#motos', media_type: 'VIDEO', media_product_type: 'REELS', media_url: `${FALSO}/cdn/video.mp4`, thumbnail_url: `${FALSO}/cdn/capa.jpg`, permalink: 'https://instagram.com/reel/x', timestamp: '2026-11-20T12:00:00+0000' },
    { id: '1790002', caption: 'Carrossel de ofertas', media_type: 'CAROUSEL_ALBUM', media_product_type: 'FEED', media_url: `${FALSO}/cdn/foto.png`, permalink: 'https://instagram.com/p/y', timestamp: '2026-11-19T12:00:00+0000' },
  ] })
  if (caminho === '/1790001') return json(200, { id: '1790001', media_type: 'VIDEO', media_product_type: 'REELS', media_url: `${FALSO}/cdn/video.mp4`, thumbnail_url: `${FALSO}/cdn/capa.jpg`, caption: 'Reels da CG 160 nova', permalink: 'https://instagram.com/reel/x', timestamp: '2026-11-20T12:00:00+0000' })
  if (caminho === '/1790002') return json(200, { id: '1790002', media_type: 'CAROUSEL_ALBUM', caption: 'Carrossel de ofertas', permalink: 'https://instagram.com/p/y', children: { data: [{ id: '1790011', media_type: 'IMAGE', media_url: `${FALSO}/cdn/foto.png` }, { id: '1790012', media_type: 'IMAGE', media_url: `${FALSO}/cdn/foto2.jpg` }] } })
  if (caminho === '/cdn/video.mp4') { res.writeHead(200); res.end(MP4(900_000)); return }
  if (caminho === '/cdn/capa.jpg' || caminho === '/cdn/foto2.jpg') { res.writeHead(200); res.end(JPG); return }
  if (caminho === '/cdn/foto.png') { res.writeHead(200); res.end(PNG); return }
  json(404, { error: { message: `rota falsa ausente: ${req.method} ${caminho}` } })
})

let temBanco = false
let servidor: Server
let base = ''
let lojaId = ''
const supa = (ligado: boolean) => { if (ligado) { process.env.SUPABASE_URL = FALSO; process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave-falsa' } else { delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY } }
const tok = () => signProLaboreToken({ sub: lojaId, email: 'd@t.local', nome: 'Dono', papel: 'DONO' })
async function api(metodo: string, caminho: string, corpoReq?: unknown, tipo = 'application/json') {
  const r = await fetch(`${base}/pro-labore/disparo${caminho}`, { method: metodo, headers: { Authorization: `Bearer ${tok()}`, 'Content-Type': tipo }, body: corpoReq === undefined ? undefined : Buffer.isBuffer(corpoReq) ? corpoReq : JSON.stringify(corpoReq) })
  return { status: r.status, corpo: await r.json().catch(() => null) as Record<string, unknown> & Array<Record<string, unknown>> }
}

before(async () => {
  try { await prisma.$queryRaw`SELECT "capaMime" FROM pro_labore_disparo_midias LIMIT 1`; temBanco = true } catch { return }
  await new Promise<void>(ok => falso.listen(PORTA_FALSA, '127.0.0.1', () => ok()))
  lojaId = (await prisma.proLaboreUsuario.create({ data: { nome: 'Loja Mídias', email: `midias-${randomUUID()}@t.local`, senhaHash: 'x' } })).id
  servidor = app.listen(0)
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`
})
after(() => { servidor?.close(); falso.close(); supa(false) })

test('tipo pelo conteúdo: MP4, MOV (iPhone), 3GP e imagem disfarçada', () => {
  const mov = MP4(64); mov.write('qt  ', 8, 'ascii')
  assert.equal(mimePeloConteudo(MP4(64), 'video/mp4'), 'video/mp4')
  assert.equal(mimePeloConteudo(mov, 'video/quicktime'), 'video/quicktime')
  assert.equal(mimePeloConteudo(Buffer.from('<svg>oi</svg>'), 'image/png'), null)
})

test('vídeo grande: direto para o armazenamento, conferido pelo conteúdo, com capa e link temporário; WhatsApp recebe link', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  supa(true)
  const video = MP4(20 * 1024 * 1024)
  const ini = await api('POST', '/midias/iniciar', { nome: 'Feirão.mp4', mime: 'video/mp4', tamanho: video.length, largura: 1080, altura: 1920, duracaoSeg: 14.5 })
  assert.equal(ini.status, 201, JSON.stringify(ini.corpo))
  assert.match(String(ini.corpo.direto), /\/object\/upload\/sign\/aries-arquivos\/disparo\/.+token=/)
  // Enquanto não conclui, não aparece na lista.
  assert.equal((await api('GET', '/midias')).corpo.length, 0)
  // O navegador manda direto (PUT no link assinado).
  const put = await fetch(String(ini.corpo.direto), { method: 'PUT', headers: { 'Content-Type': 'video/mp4' }, body: video })
  assert.equal(put.status, 200)
  assert.equal((await api('POST', `/midias/${ini.corpo.id}/concluir`, { partes: null })).status, 200)
  assert.equal((await api('POST', `/midias/${ini.corpo.id}/capa`, JPG, 'image/jpeg')).status, 200)
  const lista = await api('GET', '/midias')
  const m = lista.corpo.find(x => x.id === ini.corpo.id)!
  assert.equal(m.tipo, 'VIDEO'); assert.equal(m.largura, 1080); assert.equal(m.duracaoSeg, 14.5); assert.equal(m.tamanho, video.length)
  assert.match(String(m.arquivoUrl), /\/object\/sign\/aries-arquivos\/.+token=leitura/)
  assert.match(String(m.capaUrl), /\/object\/sign\/aries-arquivos\/disparo\/.+\/capas\//)
  // Link do arquivo e da capa abrem de verdade.
  assert.equal((await fetch(String(m.arquivoUrl))).status, 200)
  // Para o WhatsApp: link (o servidor do WhatsApp baixa), nada de 20 MB em base64.
  const env = await arquivoParaEnvio(String(ini.corpo.id))
  assert.ok(env?.url && !env.dados, 'vai por link')
  // A tela pede o arquivo grande: recebe o link, não o conteúdo.
  const arq = await api('GET', `/midias/${ini.corpo.id}/arquivo`)
  assert.match(String(arq.corpo.url), /token=leitura/)
})

test('plano B: o navegador não consegue mandar direto → pedaços de 3,5 MB pela API, o servidor monta e apaga os pedaços', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  supa(true)
  recusarPutDireto = true
  const video = MP4(9 * 1024 * 1024)
  const ini = await api('POST', '/midias/iniciar', { nome: 'grande.mp4', mime: 'video/mp4', tamanho: video.length })
  const direto = await fetch(String(ini.corpo.direto), { method: 'PUT', body: video })
  assert.equal(direto.status, 403)
  const parte = Number(ini.corpo.parteBytes)
  const n = Math.ceil(video.length / parte)
  for (let k = 0; k < n; k += 1) assert.equal((await api('POST', `/midias/${ini.corpo.id}/parte?n=${k}`, video.subarray(k * parte, (k + 1) * parte), 'application/octet-stream')).status, 200)
  assert.equal((await api('POST', `/midias/${ini.corpo.id}/concluir`, { partes: n })).status, 200)
  const m = (await api('GET', '/midias')).corpo.find(x => x.id === ini.corpo.id)!
  assert.equal(m.tamanho, video.length)
  const montado = await (await fetch(String(m.arquivoUrl))).arrayBuffer()
  assert.ok(Buffer.from(montado).equals(video), 'arquivo montado idêntico ao original')
  assert.equal([...objetos.keys()].filter(k => k.startsWith('disparo-partes/')).length, 0, 'pedaços temporários removidos')
  recusarPutDireto = false
})

test('recusa: conteúdo que não confere, tamanho acima do limite e formato não aceito', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  supa(true)
  const ini = await api('POST', '/midias/iniciar', { nome: 'falso.mp4', mime: 'video/mp4', tamanho: 100 })
  await fetch(String(ini.corpo.direto), { method: 'PUT', body: Buffer.from('isto é texto, não vídeo').toString() })
  const c = await api('POST', `/midias/${ini.corpo.id}/concluir`, {})
  assert.equal(c.status, 400)
  assert.match(String(c.corpo.error), /não confere/)
  assert.equal((await api('POST', '/midias/iniciar', { nome: 'enorme.mp4', mime: 'video/mp4', tamanho: 65 * 1024 * 1024 })).status, 413)
  assert.equal((await api('POST', '/midias/iniciar', { nome: 'x.gif', mime: 'image/gif', tamanho: 100 })).status, 400)
  // Sem armazenamento externo: até 4 MB, pela API.
  supa(false)
  assert.equal((await api('POST', '/midias/iniciar', { nome: 'v.mp4', mime: 'video/mp4', tamanho: 5 * 1024 * 1024 })).status, 413)
  const pequeno = await api('POST', '/midias/iniciar', { nome: 'v.mp4', mime: 'video/mp4', tamanho: 300_000 })
  assert.equal(pequeno.corpo.pelaApi, true)
  assert.equal((await api('POST', `/midias/${pequeno.corpo.id}/parte?n=0`, MP4(300_000), 'application/octet-stream')).status, 200)
  assert.equal((await api('POST', `/midias/${pequeno.corpo.id}/concluir`, { partes: 1 })).status, 200)
  const env = await arquivoParaEnvio(String(pequeno.corpo.id))
  assert.ok(env?.dados && !env.url, 'arquivo pequeno do banco vai pelo conteúdo')
})

test('Instagram: sem conta conectada explica; com conta lista e traz reels (com capa) e carrossel (cada foto)', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  supa(true)
  const sem = await api('GET', '/instagram')
  assert.equal(sem.status, 409)
  assert.match(String(sem.corpo.error), /Instagram da empresa não está conectado/)
  await prisma.socialMediaConta.create({ data: { usuarioId: lojaId, titular: `dono:${lojaId}`, instagramUserId: `ig-${randomUUID()}`, nomeUsuario: 'ariesmotos', accessToken: 'tk', tokenExpiraEm: new Date(Date.now() + 864e5) } })
  const meta = await api('GET', '/meta')
  assert.equal((meta.corpo.midias as { instagram: string }).instagram, 'ariesmotos')
  const l = await api('GET', '/instagram')
  assert.equal(l.status, 200)
  const itens = l.corpo.itens as Array<{ id: string; tipo: string; capa: string; importada: boolean }>
  assert.equal(itens.length, 2)
  assert.match(itens[0].capa, /capa\.jpg/, 'vídeo mostra a capa (thumbnail)')
  const reels = await api('POST', '/instagram/importar', { mediaId: '1790001' })
  assert.equal(reels.status, 201, JSON.stringify(reels.corpo))
  const id = (reels.corpo.criadas as Array<{ id: string; tipo: string }>)[0]
  assert.equal(id.tipo, 'VIDEO')
  const m = (await api('GET', '/midias')).corpo.find(x => x.id === id.id)!
  assert.equal(m.origem, 'INSTAGRAM'); assert.ok(m.capaUrl, 'capa do reels guardada'); assert.equal(m.origemLink, 'https://instagram.com/reel/x')
  const car = await api('POST', '/instagram/importar', { mediaId: '1790002' })
  assert.equal((car.corpo.criadas as unknown[]).length, 2, 'carrossel traz cada foto')
  assert.equal(((await api('GET', '/instagram')).corpo.itens as Array<{ importada: boolean }>).filter(x => x.importada).length, 2, 'marca as já trazidas')
})

test('Instagram sem limite: página a página até a primeira postagem; capa do reels como imagem', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  supa(true)
  const p1 = await api('GET', '/instagram?limite=12')
  assert.equal((p1.corpo.itens as unknown[]).length, 2)
  assert.equal(p1.corpo.proximo, 'C2')
  const p2 = await api('GET', `/instagram?limite=12&apos=${p1.corpo.proximo}`)
  assert.equal((p2.corpo.itens as Array<{ id: string }>)[0].id, '1790003')
  assert.equal(p2.corpo.proximo, null, 'chegou na primeira postagem')
  const capa = await api('POST', '/instagram/importar', { mediaId: '1790001', comoImagem: true })
  assert.equal(capa.status, 201, JSON.stringify(capa.corpo))
  assert.equal((capa.corpo.criadas as Array<{ tipo: string; nome: string }>)[0].tipo, 'IMAGEM')
  assert.match((capa.corpo.criadas as Array<{ nome: string }>)[0].nome, /\(capa\)/)
})

test('Stories: guardados enquanto estão no ar; importados do arquivo guardado (vídeo, ou a capa como imagem); o que saiu sem guardar explica', async t => {
  if (!temBanco) return t.skip('sem banco de teste')
  supa(true)
  const r = await api('GET', '/instagram?origem=stories')
  assert.equal(r.status, 200, JSON.stringify(r.corpo))
  const itens = r.corpo.itens as Array<{ id: string; tipo: string; guardado: boolean; noAr: boolean; capa: string | null }>
  assert.equal(itens.length, 2)
  assert.ok(itens.every(i => i.guardado && i.noAr), 'os dois stories no ar foram guardados')
  assert.match(String(itens.find(i => i.id === ST1)!.capa), /token=leitura/, 'capa vem do arquivo guardado')
  const st = await prisma.socialMediaMidia.findUnique({ where: { instagramMediaId: ST1 } })
  assert.ok(st?.arquivoBlobUrl && st.capaBlobUrl)
  // Depois que sai do ar (simulado: publicado há 3 dias), ainda importa do arquivo guardado.
  await prisma.socialMediaMidia.update({ where: { instagramMediaId: ST1 }, data: { publicadoEm: new Date(Date.now() - 3 * 864e5) } })
  const v = await api('POST', '/instagram/importar', { mediaId: ST1 })
  assert.equal(v.status, 201, JSON.stringify(v.corpo))
  assert.equal((v.corpo.criadas as Array<{ tipo: string }>)[0].tipo, 'VIDEO')
  const m = (await api('GET', '/midias')).corpo.find(x => x.id === (v.corpo.criadas as Array<{ id: string }>)[0].id)!
  assert.ok(m.arquivoUrl && m.capaUrl, 'vídeo do story com arquivo e capa')
  const c = await api('POST', '/instagram/importar', { mediaId: ST1, comoImagem: true })
  assert.equal((c.corpo.criadas as Array<{ tipo: string }>)[0].tipo, 'IMAGEM')
  // Story antigo que nunca foi guardado: explica.
  const conta = await prisma.socialMediaConta.findUnique({ where: { titular: `dono:${lojaId}` } })
  await prisma.socialMediaMidia.create({ data: { contaId: conta!.id, instagramMediaId: ST_VELHO, tipo: 'IMAGE', formato: 'STORY', publicadoEm: new Date(Date.now() - 10 * 864e5) } })
  const velho = await api('POST', '/instagram/importar', { mediaId: ST_VELHO })
  assert.equal(velho.status, 410)
  assert.match(String(velho.corpo.error), /saiu do ar antes/)
  const pag = await api('GET', '/instagram?origem=stories&limite=6')
  assert.ok((pag.corpo.itens as Array<{ id: string; guardado: boolean }>).some(i => i.id === ST_VELHO && !i.guardado), 'aparece como não guardado')
})
