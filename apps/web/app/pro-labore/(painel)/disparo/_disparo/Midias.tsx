'use client'

// ARIES Disparo — arquivos da Biblioteca: envio do computador (com progresso, arquivos grandes direto
// para o armazenamento), importação do Instagram da empresa, miniaturas em qualidade (imagem inteira,
// sem cortes; vídeo pela capa — um quadro do próprio vídeo) e o visualizador em tela cheia.
import { useCallback, useEffect, useRef, useState } from 'react'
import { disparoApi, enviarComProgresso, type MetaDisparo, type MidiaDisparo, type PublicacaoInstagramDisparo } from '@/lib/proLaboreApi'
import { dataHora, erroDe, useMeta } from './util'

export type TipoMidia = MidiaDisparo['tipo']
const MB = 1024 * 1024
export const ACEITOS: Record<TipoMidia | 'TODOS', string> = {
  TODOS: 'image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/3gpp,.mov,audio/mpeg,audio/ogg,audio/mp4,audio/aac,.m4a,application/pdf,.doc,.docx,.xls,.xlsx',
  IMAGEM: 'image/jpeg,image/png,image/webp', VIDEO: 'video/mp4,video/quicktime,video/3gpp,.mov', AUDIO: 'audio/mpeg,audio/ogg,audio/mp4,audio/aac,.m4a', DOCUMENTO: 'application/pdf,.doc,.docx,.xls,.xlsx',
}
const ROTULO_TIPO: Record<TipoMidia, string> = { IMAGEM: 'Imagem', VIDEO: 'Vídeo', AUDIO: 'Áudio', DOCUMENTO: 'Documento' }
const POR_EXTENSAO: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4', mov: 'video/quicktime', '3gp': 'video/3gpp', mp3: 'audio/mpeg', ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
const mimeDe = (f: File) => f.type || POR_EXTENSAO[(f.name.split('.').pop() ?? '').toLowerCase()] || ''
export function tipoDe(mime: string): TipoMidia | null {
  if (mime.startsWith('image/')) return 'IMAGEM'
  if (mime.startsWith('video/')) return 'VIDEO'
  if (mime.startsWith('audio/')) return 'AUDIO'
  if (/pdf|word|excel|sheet|officedocument|msword/.test(mime)) return 'DOCUMENTO'
  return null
}
export const tamanhoLegivel = (b: number) => (b >= MB ? `${(b / MB).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)
export const duracaoLegivel = (s: number | null | undefined) => { if (!s) return null; const t = Math.round(s); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }

// ---------- Análise no navegador: dimensões, duração e capa ----------

function esperar(el: HTMLMediaElement, evento: string, ms: number) {
  return new Promise<void>((ok, falha) => {
    const t = setTimeout(() => { el.removeEventListener(evento, fim); falha(new Error('tempo')) }, ms)
    const fim = () => { clearTimeout(t); el.removeEventListener(evento, fim); ok() }
    el.addEventListener(evento, fim)
    el.addEventListener('error', () => { clearTimeout(t); falha(new Error('formato')) }, { once: true })
  })
}
function paraJpeg(fonte: CanvasImageSource, w: number, h: number, maior = 1920): Promise<Blob | null> {
  const k = Math.min(1, maior / Math.max(w, h))
  const c = document.createElement('canvas')
  c.width = Math.round(w * k); c.height = Math.round(h * k)
  const ctx = c.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(fonte, 0, 0, c.width, c.height)
  return new Promise(ok => c.toBlob(b => ok(b), 'image/jpeg', 0.92))
}

/** Dimensões, duração e a capa (vídeo: um quadro do próprio vídeo; imagem grande: versão leve para as miniaturas). */
export async function analisar(f: File, tipo: TipoMidia): Promise<{ largura: number | null; altura: number | null; duracaoSeg: number | null; capa: Blob | null }> {
  const vazio = { largura: null, altura: null, duracaoSeg: null, capa: null }
  try {
    if (tipo === 'IMAGEM') {
      const bmp = await createImageBitmap(f)
      const r = { largura: bmp.width, altura: bmp.height, duracaoSeg: null, capa: Math.max(bmp.width, bmp.height) > 1920 || f.size > 1.5 * MB ? await paraJpeg(bmp, bmp.width, bmp.height) : null }
      bmp.close()
      return r
    }
    if (tipo === 'VIDEO') {
      const url = URL.createObjectURL(f)
      const v = document.createElement('video')
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url
      try {
        await esperar(v, 'loadedmetadata', 20_000)
        const duracao = Number.isFinite(v.duration) ? v.duration : null
        // Um quadro de verdade (não a tela preta do início): ~1 s, ou 10% de vídeos curtos.
        v.currentTime = duracao ? Math.min(1, duracao * 0.1) : 0.5
        await esperar(v, 'seeked', 15_000)
        const capa = v.videoWidth ? await paraJpeg(v, v.videoWidth, v.videoHeight) : null
        return { largura: v.videoWidth || null, altura: v.videoHeight || null, duracaoSeg: duracao, capa }
      } finally { v.removeAttribute('src'); v.load(); URL.revokeObjectURL(url) }
    }
  } catch { /* formato que o navegador não abre (ex.: vídeo HEVC): segue sem capa */ }
  return vazio
}

// ---------- Envio de um arquivo do computador ----------

export async function enviarArquivo(f: File, meta: MetaDisparo, aoProgredir: (fracao: number, etapa: string) => void): Promise<string> {
  const mime = mimeDe(f)
  const tipo = tipoDe(mime)
  if (!tipo) throw new Error('Formato não aceito: use JPG, PNG, WebP, MP4, MOV, MP3, OGG, M4A, PDF, Word ou Excel')
  const limite = meta.midias.limites[tipo]
  if (f.size > limite) throw new Error(`${tamanhoLegivel(f.size)}: maior que o máximo para ${ROTULO_TIPO[tipo].toLowerCase()} (${Math.round(limite / MB)} MB)`)
  aoProgredir(0, tipo === 'VIDEO' ? 'Gerando a capa do vídeo…' : 'Preparando…')
  const info = await analisar(f, tipo)
  let id: string
  if (!meta.midias.uploadDireto) {
    const q = new URLSearchParams({ nome: f.name, ...(info.largura ? { largura: String(info.largura) } : {}), ...(info.altura ? { altura: String(info.altura) } : {}), ...(info.duracaoSeg ? { duracao: String(info.duracaoSeg) } : {}) })
    const corpo = await enviarComProgresso({ api: `/pro-labore/disparo/midias?${q}` }, f, mime, e => aoProgredir(e / f.size, 'Enviando…'))
    id = (JSON.parse(corpo) as { id: string }).id
  } else {
    const ini = await disparoApi.midias.iniciar({ nome: f.name, mime, tamanho: f.size, largura: info.largura, altura: info.altura, duracaoSeg: info.duracaoSeg })
    id = ini.id
    let partes: number | null = null
    try {
      if (!ini.direto) throw new Error('sem link direto')
      await enviarComProgresso({ url: ini.direto }, f, mime, e => aoProgredir(e / f.size, 'Enviando…'))
    } catch {
      // Plano B: em pedaços pela API (o servidor monta o arquivo).
      partes = Math.ceil(f.size / ini.parteBytes)
      for (let k = 0; k < partes; k += 1) {
        const pedaco = f.slice(k * ini.parteBytes, Math.min(f.size, (k + 1) * ini.parteBytes))
        for (let tentativa = 1; ; tentativa += 1) {
          try { await enviarComProgresso({ api: `/pro-labore/disparo/midias/${ini.id}/parte?n=${k}` }, pedaco, 'application/octet-stream', e => aoProgredir((k * ini.parteBytes + e) / f.size, 'Enviando…')); break } catch (e) { if (tentativa >= 3) throw e }
        }
      }
    }
    aoProgredir(1, 'Conferindo o arquivo…')
    await disparoApi.midias.concluir(ini.id, partes)
  }
  if (info.capa) await disparoApi.midias.enviarCapa(id, info.capa).catch(() => undefined)
  aoProgredir(1, 'Pronto')
  return id
}

// ---------- Endereços para ver (link do armazenamento ou pela API com login) ----------

function useEndereco(m: MidiaDisparo, qual: 'capa' | 'arquivo', ligado = true): string | null {
  const direto = qual === 'capa' ? m.capaUrl ?? null : m.arquivoUrl ?? null
  const [local, setLocal] = useState<string | null>(null)
  const precisa = ligado && !direto && (qual === 'arquivo' || !!m.temCapa)
  useEffect(() => {
    if (!precisa) return
    let u: string | null = null
    let vivo = true
    const pedir = qual === 'capa' ? disparoApi.midias.capa(m.id).then(b => ({ url: URL.createObjectURL(b), local: true })) : disparoApi.midias.enderecoDoArquivo(m.id)
    pedir.then(r => { if (r.local) u = r.url; if (vivo) setLocal(r.url) }).catch(() => undefined)
    return () => { vivo = false; if (u) URL.revokeObjectURL(u) }
  }, [precisa, qual, m.id])
  return direto ?? (precisa ? local : null)
}

const Icone = ({ tipo }: { tipo: TipoMidia }) => <span className="dp-mini-icone" aria-hidden="true">{tipo === 'AUDIO' ? '🎵' : tipo === 'DOCUMENTO' ? '📄' : tipo === 'VIDEO' ? '🎬' : '🖼️'}</span>

/** Miniatura: imagem inteira (sem cortes); vídeo pela capa com ▶ e duração. */
export function Miniatura({ m, abrir, selecionada }: { m: MidiaDisparo; abrir?: () => void; selecionada?: boolean }) {
  const capa = useEndereco(m, 'capa')
  const arquivo = useEndereco(m, 'arquivo', m.tipo === 'IMAGEM' && !m.temCapa)
  const imagem = m.tipo === 'VIDEO' ? capa : m.tipo === 'IMAGEM' ? capa ?? arquivo : null
  const dur = duracaoLegivel(m.duracaoSeg)
  return (
    <button type="button" className={`dp-mini${selecionada ? ' selecionada' : ''}`} onClick={abrir} title={m.nome} data-midia={m.id}>
      <span className="dp-mini-quadro">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {imagem ? <img src={imagem} alt={m.nome} loading="lazy" decoding="async" /> : <Icone tipo={m.tipo} />}
        {m.tipo === 'VIDEO' && <span className="dp-mini-play" aria-hidden="true">▶</span>}
        {dur && <span className="dp-mini-dur">{dur}</span>}
        {m.origem === 'INSTAGRAM' && <span className="dp-mini-ig" title="Do Instagram">IG</span>}
        {selecionada && <span className="dp-mini-ok" aria-label="Escolhido">✓</span>}
      </span>
      <span className="dp-mini-nome">{m.nome}</span>
      <span className="dp-mini-info">{ROTULO_TIPO[m.tipo]} · {tamanhoLegivel(m.tamanho)}{m.largura && m.altura ? ` · ${m.largura}×${m.altura}` : ''}</span>
    </button>
  )
}

/** Visualizador em tela cheia: imagem inteira na resolução original; vídeo tocando com a capa. */
export function Visualizador({ m, fechar, acoes }: { m: MidiaDisparo; fechar: () => void; acoes?: React.ReactNode }) {
  const arquivo = useEndereco(m, 'arquivo')
  const capa = useEndereco(m, 'capa')
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [fechar])
  return (
    <div className="dp-visor" role="dialog" aria-label={m.nome} onClick={fechar}>
      <div className="dp-visor-painel" onClick={e => e.stopPropagation()}>
        <div className="dp-visor-midia">
          {!arquivo ? <p className="pl-hint" aria-busy="true">Carregando…</p>
            // eslint-disable-next-line @next/next/no-img-element
            : m.tipo === 'IMAGEM' ? <img src={arquivo} alt={m.nome} />
            : m.tipo === 'VIDEO' ? <video src={arquivo} poster={capa ?? undefined} controls autoPlay playsInline preload="metadata" />
            : m.tipo === 'AUDIO' ? <audio src={arquivo} controls autoPlay />
            : <a className="pl-btn pl-btn-primary" href={arquivo} target="_blank" rel="noreferrer" download={m.nome}>Abrir {m.nome}</a>}
        </div>
        <div className="dp-visor-rodape">
          <div>
            <b>{m.nome}</b>
            <div className="pl-hint">{ROTULO_TIPO[m.tipo]} · {tamanhoLegivel(m.tamanho)}{m.largura && m.altura ? ` · ${m.largura}×${m.altura}` : ''}{duracaoLegivel(m.duracaoSeg) ? ` · ${duracaoLegivel(m.duracaoSeg)}` : ''} · {dataHora(m.criadoEm)}{m.criadoPorNome ? ` · ${m.criadoPorNome}` : ''}{m.origem === 'INSTAGRAM' ? ' · do Instagram' : ''}</div>
            {m.origemLink && <a className="pl-hint" href={m.origemLink} target="_blank" rel="noreferrer">Ver a publicação no Instagram</a>}
          </div>
          <span className="cc-chips">{acoes}<button type="button" className="pl-btn" onClick={fechar}>Fechar</button></span>
        </div>
      </div>
    </div>
  )
}

// ---------- Envio do computador (vários arquivos, arrastar e soltar, progresso) ----------

interface Envio { chave: string; nome: string; tamanho: number; fracao: number; etapa: string; erro: string | null; pronto: boolean }

/** `soltos`: arquivos soltos fora daqui (ex.: em cima da Biblioteca inteira) — cada novo pedido é enviado. */
export function EnviarDoComputador({ aceitar = 'TODOS', aoConcluir, rotulo = 'Enviar do computador', multiplo = true, soltos }: { aceitar?: TipoMidia | 'TODOS'; aoConcluir: (ids: string[]) => void; rotulo?: string; multiplo?: boolean; soltos?: { arquivos: File[]; n: number } | null }) {
  const meta = useMeta()
  const [envios, setEnvios] = useState<Envio[]>([])
  const [sobre, setSobre] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const mudar = (chave: string, x: Partial<Envio>) => setEnvios(l => l.map(e => (e.chave === chave ? { ...e, ...x } : e)))
  const enviar = useCallback(async (lista: File[]) => {
    const fs = multiplo ? lista : lista.slice(0, 1)
    const novos = fs.map(f => ({ chave: `${f.name}-${f.size}-${Math.random()}`, nome: f.name, tamanho: f.size, fracao: 0, etapa: 'Na fila…', erro: null, pronto: false }))
    setEnvios(l => [...novos, ...l.filter(e => !e.pronto && !e.erro)])
    const ids: string[] = []
    // Um de cada vez: arquivos grandes não disputam a conexão.
    for (const [k, f] of fs.entries()) {
      const chave = novos[k].chave
      const tipo = tipoDe(mimeDe(f))
      if (aceitar !== 'TODOS' && tipo !== aceitar) { mudar(chave, { erro: `Escolha ${ROTULO_TIPO[aceitar].toLowerCase()}` }); continue }
      try { ids.push(await enviarArquivo(f, meta, (fracao, etapa) => mudar(chave, { fracao, etapa }))); mudar(chave, { pronto: true, fracao: 1, etapa: 'Pronto' }) } catch (e) { mudar(chave, { erro: erroDe(e) }) }
    }
    if (ids.length) aoConcluir(ids)
  }, [aceitar, aoConcluir, meta, multiplo])
  const ultimo = useRef(0)
  useEffect(() => { if (soltos && soltos.n !== ultimo.current) { ultimo.current = soltos.n; void enviar(soltos.arquivos) } }, [soltos, enviar])
  const max = aceitar === 'TODOS' ? Math.max(...Object.values(meta.midias.limites)) : meta.midias.limites[aceitar]
  return (
    <div className={`dp-envio${sobre ? ' sobre' : ''}`} onDragOver={e => { e.preventDefault(); e.stopPropagation(); setSobre(true) }} onDragLeave={() => setSobre(false)} onDrop={e => { e.preventDefault(); e.stopPropagation(); setSobre(false); void enviar([...e.dataTransfer.files]) }} data-envio-computador>
      <div className="dp-linha" style={{ justifyContent: 'space-between' }}>
        <span className="pl-hint">Arraste {multiplo ? 'os arquivos' : 'o arquivo'} para cá ou</span>
        <button type="button" className="pl-btn pl-btn-primary" onClick={() => input.current?.click()}>{rotulo}</button>
        <input ref={input} type="file" hidden multiple={multiplo} accept={ACEITOS[aceitar]} onChange={e => { const fs = [...(e.target.files ?? [])]; e.target.value = ''; void enviar(fs) }} />
      </div>
      <p className="pl-hint" style={{ margin: '4px 0 0' }}>Qualidade original, sem compressão. Até {Math.round(max / MB)} MB{aceitar === 'TODOS' || aceitar === 'VIDEO' ? ` (vídeo até ${Math.round(meta.midias.limites.VIDEO / MB)} MB; prefira MP4)` : ''}.</p>
      {envios.length > 0 && (
        <ul className="dp-envios">
          {envios.map(e => (
            <li key={e.chave} className={e.erro ? 'erro' : e.pronto ? 'pronto' : ''}>
              <div className="dp-linha" style={{ justifyContent: 'space-between' }}><span className="dp-envio-nome">{e.nome}</span><span className="pl-hint">{tamanhoLegivel(e.tamanho)}</span></div>
              {!e.erro && <div className="dp-progresso-barra"><span className="ok" style={{ width: `${Math.round(e.fracao * 100)}%` }} /></div>}
              <span className="pl-hint" style={e.erro ? { color: 'var(--ar-estado-critico)' } : undefined}>{e.erro ?? `${e.etapa}${!e.pronto && e.fracao > 0 && e.fracao < 1 ? ` ${Math.round(e.fracao * 100)}%` : ''}`}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------- Importar do Instagram da empresa ----------

const ROTULO_FORMATO = (p: PublicacaoInstagramDisparo) => (p.formato === 'STORY' ? 'Story' : p.tipo === 'CAROUSEL_ALBUM' ? 'Carrossel' : p.formato === 'REELS' ? 'Reels' : p.tipo === 'VIDEO' ? 'Vídeo' : 'Foto')
type FiltroIg = 'TODOS' | 'FOTOS' | 'VIDEOS' | 'CARROSSEL'
const FILTROS_IG: Array<[FiltroIg, string]> = [['TODOS', 'Tudo'], ['FOTOS', 'Fotos'], ['VIDEOS', 'Reels e vídeos'], ['CARROSSEL', 'Carrosséis']]
const passaFiltro = (p: PublicacaoInstagramDisparo, f: FiltroIg) => f === 'TODOS' || (f === 'FOTOS' ? p.tipo === 'IMAGE' : f === 'VIDEOS' ? p.tipo === 'VIDEO' : p.tipo === 'CAROUSEL_ALBUM')

/**
 * Importar do Instagram da empresa: publicações (todas, até a primeira, carregando conforme rola) e
 * stories (os no ar e os que o ARIES guardou). De um vídeo dá para trazer o vídeo ou só a capa.
 */
export function ImportarDoInstagram({ fechar, aoConcluir, contexto }: { fechar: () => void; aoConcluir: (ids: string[]) => void; contexto?: 'IMAGEM' | 'VIDEO' }) {
  const meta = useMeta()
  const [aba, setAba] = useState<'publicacoes' | 'stories'>('publicacoes')
  const [filtro, setFiltro] = useState<FiltroIg>(contexto === 'VIDEO' ? 'VIDEOS' : 'TODOS')
  const [dados, setDados] = useState<{ conta: string; itens: PublicacaoInstagramDisparo[]; proximo: string | null } | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [estado, setEstado] = useState<Record<string, 'trazendo' | 'ok' | string>>({})
  const fim = useRef<HTMLDivElement>(null)
  const pedindo = useRef(false)
  const carregar = useCallback((qual: 'publicacoes' | 'stories', apos: string | null) => {
    if (pedindo.current) return
    pedindo.current = true
    setCarregando(true)
    disparoApi.instagram.listar({ origem: qual, apos, limite: 24 })
      .then(r => setDados(d => ({ conta: r.conta, proximo: r.proximo, itens: apos && d ? [...d.itens, ...r.itens.filter(x => !d.itens.some(y => y.id === x.id))] : r.itens })))
      .catch(e => setErro(erroDe(e)))
      .finally(() => { pedindo.current = false; setCarregando(false) })
  }, [])
  useEffect(() => { carregar(aba, null) }, [aba, carregar])
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [fechar])
  // Carrega a próxima página quando o fim da lista aparece (sem limite de quantidade).
  useEffect(() => {
    const el = fim.current
    if (!el || !dados?.proximo) return
    const obs = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) carregar(aba, dados.proximo) }, { rootMargin: '400px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [dados?.proximo, aba, carregar])
  const trocarAba = (a: 'publicacoes' | 'stories') => { if (a === aba) return; setDados(null); setErro(null); setAba(a) }
  async function trazer(p: PublicacaoInstagramDisparo, comoImagem = false) {
    const chave = comoImagem ? `${p.id}:capa` : p.id
    setEstado(s => ({ ...s, [chave]: 'trazendo' }))
    try {
      const r = await disparoApi.instagram.importar(p.id, { comoImagem })
      setEstado(s => ({ ...s, [chave]: r.falhas.length ? `Trouxe ${r.criadas.length}; ${r.falhas.join(' · ')}` : 'ok' }))
      aoConcluir(r.criadas.map(c => c.id))
    } catch (e) { setEstado(s => ({ ...s, [chave]: erroDe(e) })) }
  }
  const itens = (dados?.itens ?? []).filter(p => aba === 'stories' || passaFiltro(p, filtro))
  const rotuloTrazer = (p: PublicacaoInstagramDisparo) => (p.tipo === 'CAROUSEL_ALBUM' ? 'Trazer tudo' : p.tipo === 'VIDEO' ? 'Trazer o vídeo' : 'Trazer a foto')
  return (
    <div className="dp-visor" role="dialog" aria-label="Importar do Instagram" onClick={fechar}>
      <div className="dp-visor-painel dp-ig" onClick={e => e.stopPropagation()} data-importar-instagram>
        <div className="dp-linha" style={{ justifyContent: 'space-between' }}>
          <div><b>Importar do Instagram</b>{dados && <span className="pl-hint"> · @{dados.conta}</span>}</div>
          <button type="button" className="pl-btn" onClick={fechar}>Fechar</button>
        </div>
        <div className="dp-linha" style={{ justifyContent: 'space-between', margin: '8px 0 4px' }}>
          <div className="pl-sv-tabs cc-subabas" role="tablist" aria-label="Origem">
            <button type="button" role="tab" aria-selected={aba === 'publicacoes'} className={aba === 'publicacoes' ? 'ativo' : ''} onClick={() => trocarAba('publicacoes')} data-ig-aba="publicacoes">Publicações</button>
            <button type="button" role="tab" aria-selected={aba === 'stories'} className={aba === 'stories' ? 'ativo' : ''} onClick={() => trocarAba('stories')} data-ig-aba="stories">Stories</button>
          </div>
          {aba === 'publicacoes' && <div className="cc-chips">{FILTROS_IG.map(([v, r]) => <button key={v} type="button" className={`pl-chip ${filtro === v ? 'active' : ''}`} onClick={() => setFiltro(v)}>{r}</button>)}</div>}
        </div>
        <p className="pl-hint" style={{ margin: '0 0 10px' }}>{aba === 'publicacoes'
          ? 'Todas as publicações, da mais recente até a primeira (role para carregar mais). Vem na qualidade original e fica guardado na Biblioteca. Carrossel traz cada foto e vídeo; de um vídeo dá para trazer só a capa como imagem.'
          : 'Os stories no ar agora e os que o ARIES guardou (ele guarda sozinho cada story enquanto está no ar, porque o Instagram apaga em 24 h). Stories de antes desta função só aparecem se ainda estiverem guardados.'}</p>
        {erro && <div className="pl-alert pl-alert-error" role="alert">{erro}</div>}
        {!dados && !erro && <p className="pl-hint" aria-busy="true">Buscando {aba === 'stories' ? 'os stories' : 'as publicações'} de {meta.midias.instagram ? `@${meta.midias.instagram}` : 'Instagram'}…</p>}
        {dados && !itens.length && !carregando && <p className="pl-hint">{aba === 'stories' ? 'Nenhum story no ar nem guardado ainda. A partir de agora, cada story publicado fica guardado sozinho.' : 'Nada deste tipo nas publicações carregadas.'}</p>}
        <div className="dp-galeria">
          {itens.map(p => {
            const st = estado[p.id], stCapa = estado[`${p.id}:capa`]
            const feito = st === 'ok' || (p.importada && !st)
            const indisponivel = p.formato === 'STORY' && !p.guardado && !p.noAr
            return (
              <div key={p.id} className="dp-mini dp-ig-item" data-publicacao={p.id}>
                <span className="dp-mini-quadro">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.capa ? <img src={p.capa} alt={p.legenda ?? 'Publicação'} loading="lazy" referrerPolicy="no-referrer" /> : <span className="dp-mini-icone">📷</span>}
                  {p.tipo === 'VIDEO' && <span className="dp-mini-play" aria-hidden="true">▶</span>}
                  <span className="dp-mini-dur">{ROTULO_FORMATO(p)}</span>
                  {p.formato === 'STORY' && <span className="dp-mini-ig" title={p.noAr ? 'No ar agora' : 'Guardado pelo ARIES'}>{p.noAr ? 'no ar' : 'guardado'}</span>}
                </span>
                <span className="dp-mini-nome">{p.legenda?.split('\n')[0] || (p.formato === 'STORY' ? 'Story' : 'Sem legenda')}</span>
                <span className="dp-mini-info">{dataHora(p.publicadoEm)}{p.link ? <> · <a href={p.link} target="_blank" rel="noreferrer">ver</a></> : null}</span>
                {indisponivel
                  ? <span className="pl-hint">Saiu do ar antes de ser guardado</span>
                  : <button type="button" className={`pl-btn ${feito ? '' : 'pl-btn-primary'}`} disabled={st === 'trazendo'} onClick={() => void trazer(p)}>{st === 'trazendo' ? 'Trazendo…' : feito ? 'Na Biblioteca ✓ (de novo)' : rotuloTrazer(p)}</button>}
                {p.tipo === 'VIDEO' && !indisponivel && <button type="button" className={`pl-btn ${contexto === 'IMAGEM' && stCapa !== 'ok' ? 'pl-btn-primary' : ''}`} disabled={stCapa === 'trazendo'} onClick={() => void trazer(p, true)}>{stCapa === 'trazendo' ? 'Trazendo…' : stCapa === 'ok' ? 'Capa na Biblioteca ✓' : 'Só a capa (imagem)'}</button>}
                {[st, stCapa].filter(x => x && x !== 'ok' && x !== 'trazendo').map(x => <span key={x} className="pl-hint" style={{ color: x!.startsWith('Trouxe') ? undefined : 'var(--ar-estado-critico)' }}>{x}</span>)}
              </div>
            )
          })}
        </div>
        <div ref={fim} className="dp-ig-fim">
          {carregando ? <span className="pl-hint" aria-busy="true">Carregando mais…</span>
            : dados?.proximo ? <button type="button" className="pl-btn" onClick={() => carregar(aba, dados.proximo)}>Carregar mais</button>
            : dados && dados.itens.length > 0 ? <span className="pl-hint">{dados.itens.length} {aba === 'stories' ? 'story(s)' : 'publicação(ões)'} · {aba === 'stories' ? 'são todos os guardados' : 'chegou à primeira postagem'}</span> : null}
        </div>
      </div>
    </div>
  )
}

/** Escolha do arquivo de um passo: o escolhido em destaque, a galeria do tipo e os atalhos de envio/importação. */
export function EscolherMidia({ tipo, midias, valor, mudar, recarregar }: { tipo: TipoMidia; midias: MidiaDisparo[]; valor: string | null | undefined; mudar: (id: string | null) => void; recarregar?: () => Promise<MidiaDisparo[]> | void }) {
  const meta = useMeta()
  const [ver, setVer] = useState<MidiaDisparo | null>(null)
  const [ig, setIg] = useState(false)
  const [enviar, setEnviar] = useState(false)
  const opcoes = midias.filter(m => m.tipo === tipo)
  const pode = meta.nivel === 'EDITAR'
  // Escolhe sozinho o último arquivo trazido que for do tipo desta mensagem (ex.: a capa de um reels numa mensagem de imagem).
  const novos = async (ids: string[]) => {
    const lista = (await recarregar?.()) ?? midias
    const doTipo = ids.filter(id => lista.some(m => m.id === id && m.tipo === tipo))
    if (doTipo.length) mudar(doTipo[doTipo.length - 1])
  }
  return (
    <div className="dp-escolha" data-escolher-midia={tipo}>
      <div className="dp-linha">
        <span className="pl-hint">{opcoes.length ? `Escolha ${tipo === 'IMAGEM' ? 'a imagem' : tipo === 'VIDEO' ? 'o vídeo' : tipo === 'AUDIO' ? 'o áudio' : 'o documento'} da Biblioteca` : 'Nada deste tipo na Biblioteca ainda'}</span>
        {pode && <button type="button" className="pl-btn" onClick={() => setEnviar(x => !x)}>Do computador</button>}
        {pode && meta.midias.instagram && (tipo === 'IMAGEM' || tipo === 'VIDEO') && <button type="button" className="pl-btn" onClick={() => setIg(true)}>Do Instagram</button>}
      </div>
      {enviar && <EnviarDoComputador aceitar={tipo} multiplo={false} rotulo={`Escolher ${tipo === 'VIDEO' ? 'vídeo' : 'arquivo'}`} aoConcluir={ids => { setEnviar(false); void novos(ids) }} />}
      {opcoes.length > 0 && <div className="dp-galeria dp-galeria-compacta">{opcoes.map(m => <Miniatura key={m.id} m={m} selecionada={m.id === valor} abrir={() => mudar(m.id)} />)}</div>}
      {valor && opcoes.some(m => m.id === valor) && <button type="button" className="pl-btn" style={{ marginTop: 6 }} onClick={() => setVer(opcoes.find(m => m.id === valor) ?? null)}>Ver em tamanho real</button>}
      {ver && <Visualizador m={ver} fechar={() => setVer(null)} />}
      {ig && <ImportarDoInstagram contexto={tipo === 'VIDEO' ? 'VIDEO' : 'IMAGEM'} fechar={() => setIg(false)} aoConcluir={ids => void novos(ids.filter(id => id))} />}
    </div>
  )
}
