'use client'

// Barra flutuante do mapa mental (aparece com uma ideia selecionada):
// formatação do texto, cor de fundo, imagem (enviar do computador ou colar
// o link), link (do YouTube mostra a capa do vídeo) e "Conectar" — liga a
// ideia selecionada a qualquer outra com uma seta tracejada.
import { useCallback, useEffect, useRef, useState } from 'react'
import { proLaboreApi } from '@/lib/proLaboreApi'
import type { CamposNo, EstadoMotor, MotorMapaMental } from './motor'
import { idYoutube, urlSegura, type EstiloTexto, type FonteNo, type TamanhoNo } from './dados'
import { FONTES } from './constantes'

const CORES = ['#3b6cf6', '#0ea5e9', '#12a898', '#2e9e4f', '#84cc16', '#f08a1c', '#ee4f8a', '#a36cf0', '#ffffff', '#8b8f98', '#2a2f38', '#111317']
const FUNDOS = ['#e8efff', '#e0f2fe', '#ddf6f0', '#e3f5e6', '#fdf3d8', '#fde6d2', '#fde2ec', '#efe5fd', '#3b6cf6', '#12a898', '#ee4f8a', '#2a2f38']
const ROTULO_FONTE: Record<FonteNo, string> = { sans: 'Padrão', serif: 'Serifada', mao: 'Manuscrita', mono: 'Máquina' }
// A API aceita até 4 MB (a Vercel corta em 4,5); fica uma folga.
const LIMITE_BYTES = 3.5 * 1024 * 1024
const LADO_MAXIMO = 4096
const TIPOS_ACEITOS = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
// Larguras prontas pra imagem na ideia (o puxador no canto ajusta livre).
const TAMANHOS_IMAGEM: Array<[string, number]> = [['P', 200], ['M', 360], ['G', 560], ['GG', 800]]

type Painel = 'texto' | 'fundo' | 'imagem' | 'link' | null

// Manda o arquivo ORIGINAL sempre que cabe (até 3,5 MB e 4096px) — print de
// tela, gráfico e texto continuam nítidos mesmo com a imagem bem grande na
// apresentação. Só quando passa disso a imagem é reduzida, e PNG continua
// PNG (sem perda) enquanto couber.
async function prepararImagem(arquivo: File): Promise<{ blob: Blob; w: number; h: number }> {
  const url = URL.createObjectURL(arquivo)
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => {
      const i = new Image()
      i.onload = () => ok(i); i.onerror = () => erro(new Error('Esse arquivo não é uma imagem válida'))
      i.src = url
    })
    const w0 = img.naturalWidth, h0 = img.naturalHeight
    if (TIPOS_ACEITOS.includes(arquivo.type) && arquivo.size <= LIMITE_BYTES && Math.max(w0, h0) <= LADO_MAXIMO) return { blob: arquivo, w: w0, h: h0 }
    const comoBlob = (c: HTMLCanvasElement, tipo: string, q?: number) => new Promise<Blob | null>(ok => c.toBlob(ok, tipo, q))
    let lado = Math.min(2560, Math.max(w0, h0))
    for (let tentativa = 0; tentativa < 6; tentativa++) {
      const esc = Math.min(1, lado / Math.max(w0, h0))
      const w = Math.max(1, Math.round(w0 * esc)), h = Math.max(1, Math.round(h0 * esc))
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, w, h)
      if (arquivo.type === 'image/png') {
        const png = await comoBlob(canvas, 'image/png')
        if (png && png.size <= LIMITE_BYTES) return { blob: png, w, h }
      }
      // WebP guarda transparência e pesa menos; navegador sem WebP devolve PNG.
      const webp = await comoBlob(canvas, 'image/webp', 0.92)
      if (webp && webp.type === 'image/webp' && webp.size <= LIMITE_BYTES) return { blob: webp, w, h }
      const fundo = document.createElement('canvas')
      fundo.width = w; fundo.height = h
      const cf = fundo.getContext('2d')!
      cf.fillStyle = '#ffffff'; cf.fillRect(0, 0, w, h); cf.drawImage(canvas, 0, 0)
      const jpg = await comoBlob(fundo, 'image/jpeg', 0.92)
      if (jpg && jpg.size <= LIMITE_BYTES) return { blob: jpg, w, h }
      lado = Math.round(lado * 0.8)
    }
    throw new Error('Imagem grande demais mesmo depois de reduzida')
  } finally {
    URL.revokeObjectURL(url)
  }
}

function medidasDoLink(src: string): Promise<{ w: number; h: number }> {
  return new Promise(ok => {
    const i = new Image()
    i.onload = () => ok({ w: i.naturalWidth, h: i.naturalHeight })
    i.onerror = () => ok({ w: 0, h: 0 })
    i.src = src
  })
}

export default function BarraFormatacao({ obterMotor, estado }: { obterMotor: () => MotorMapaMental | null; estado: EstadoMotor }) {
  const [painel, setPainel] = useState<Painel>(null)
  const [urlImagem, setUrlImagem] = useState('')
  const [urlLink, setUrlLink] = useState('')
  const [tituloLink, setTituloLink] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const raizRef = useRef<HTMLDivElement>(null)
  const arquivoRef = useRef<HTMLInputElement>(null)
  const no = estado.noSelecionado
  const est: EstiloTexto = no?.estilo ?? {}

  // Fecha o painel aberto ao clicar fora da barra.
  useEffect(() => {
    if (!painel) return
    const fora = (e: MouseEvent) => { if (raizRef.current && !raizRef.current.contains(e.target as Node)) setPainel(null) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [painel])

  // Print/imagem copiada: Ctrl+V com o mapa em foco cola na ideia
  // selecionada (se ela já tem imagem, vira uma ideia nova, filha dela).
  const [colando, setColando] = useState(false)
  const [avisoColar, setAvisoColar] = useState('')
  const colarImagem = useCallback(async (arquivo: File) => {
    const motor = obterMotor()
    const alvo = motor?.idSelecionado()
    if (!motor || !alvo) return
    setColando(true); setAvisoColar('')
    try {
      const { blob, w, h } = await prepararImagem(arquivo)
      const src = await proLaboreApi.imagens.enviar(blob)
      const m = obterMotor()
      if (!m) return
      if (m.temImagem(alvo)) m.adicionarFilhoCom(alvo, { imagem: { src, w, h } })
      else m.atualizarNo(alvo, { imagem: { src, w, h } })
    } catch (e) {
      setAvisoColar((e as Error).message)
    } finally {
      setColando(false)
    }
  }, [obterMotor])
  useEffect(() => {
    const aoColar = (ev: ClipboardEvent) => {
      const motor = obterMotor()
      const alvo = ev.target as Node | null
      if (!motor || !(motor.contem(alvo) || alvo === document.body)) return
      const item = [...(ev.clipboardData?.items ?? [])].find(i => i.kind === 'file' && i.type.startsWith('image/'))
      const arquivo = item?.getAsFile()
      if (!arquivo) return
      ev.preventDefault()
      void colarImagem(arquivo)
    }
    document.addEventListener('paste', aoColar)
    return () => document.removeEventListener('paste', aoColar)
  }, [obterMotor, colarImagem])
  async function colarDaArea() {
    setErro('')
    try {
      for (const item of await navigator.clipboard.read()) {
        const tipo = item.types.find(t => t.startsWith('image/'))
        if (!tipo) continue
        const blob = await item.getType(tipo)
        setPainel(null)
        await colarImagem(new File([blob], 'print.png', { type: tipo }))
        return
      }
      setErro('Não tem imagem copiada. Tire o print (ou copie uma imagem) e tente de novo.')
    } catch {
      setErro('O navegador não deixou ler a área de transferência — clique no mapa e aperte Ctrl+V.')
    }
  }

  const aplicar = (c: CamposNo) => obterMotor()?.atualizarSelecionado(c)
  const estilo = (patch: Partial<EstiloTexto>) => {
    const novo: EstiloTexto = { ...est, ...patch }
    for (const k of Object.keys(novo) as Array<keyof EstiloTexto>) if (novo[k] === undefined) delete novo[k]
    aplicar({ estilo: novo })
  }
  function abrir(p: Painel) {
    setErro('')
    if (p === 'link') { setUrlLink(no?.link?.url ?? ''); setTituloLink(no?.link?.titulo ?? '') }
    if (p === 'imagem') setUrlImagem('')
    setPainel(atual => (atual === p ? null : p))
  }

  async function enviarArquivo(f: File | undefined) {
    if (!f) return
    setEnviando(true); setErro('')
    try {
      const { blob, w, h } = await prepararImagem(f)
      const src = await proLaboreApi.imagens.enviar(blob)
      aplicar({ imagem: { src, w, h } })
      setPainel(null)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setEnviando(false)
      if (arquivoRef.current) arquivoRef.current.value = ''
    }
  }
  async function usarLinkImagem() {
    const src = urlSegura(urlImagem.trim())
    if (!src) { setErro('Cole um endereço que comece com https://'); return }
    setEnviando(true)
    const m = await medidasDoLink(src)
    setEnviando(false)
    if (!m.w) { setErro('Não deu pra abrir essa imagem. Confira o link (precisa ser o endereço da imagem em si).'); return }
    aplicar({ imagem: { src, ...m } })
    setPainel(null)
  }
  function salvarLink() {
    const u = urlLink.trim()
    const url = urlSegura(/^https?:\/\//i.test(u) ? u : `https://${u}`)
    if (!url) { setErro('Link inválido'); return }
    aplicar({ link: { url, ...(tituloLink.trim() ? { titulo: tituloLink.trim().slice(0, 60) } : {}) } })
    setPainel(null)
  }

  if (estado.ligando) {
    return (
      <div className="pl-mf-barra pl-mf-aviso" role="status">
        <span>Clique na ideia que você quer conectar</span>
        <button type="button" onClick={() => obterMotor()?.cancelarLigacao()}>Cancelar <kbd>Esc</kbd></button>
      </div>
    )
  }
  if (estado.ligacaoSelecionada) {
    const id = estado.ligacaoSelecionada
    return (
      <div className="pl-mf-barra pl-mf-aviso">
        <span>Conexão selecionada</span>
        <button type="button" className="perigo" onClick={() => obterMotor()?.removerLigacao(id)}>Remover conexão <kbd>Del</kbd></button>
      </div>
    )
  }
  if (!no) return null

  return (
    <div className="pl-mf-barra" ref={raizRef} onPointerDown={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
      {(colando || avisoColar) && (
        <div className={`pl-mf-colando ${avisoColar ? 'erro' : ''}`} role="status">
          {colando ? 'Colando imagem…' : avisoColar}
          {avisoColar && <button type="button" onClick={() => setAvisoColar('')} aria-label="Fechar">×</button>}
        </div>
      )}
      <button type="button" className={painel === 'texto' ? 'ativo' : ''} onClick={() => abrir('texto')} title="Texto: fonte, negrito, itálico, tamanho e cor" aria-expanded={painel === 'texto'}>
        <IconeTexto cor={est.cor} />
      </button>
      <button type="button" className={painel === 'fundo' ? 'ativo' : ''} onClick={() => abrir('fundo')} title="Cor de fundo da ideia" aria-expanded={painel === 'fundo'}>
        <IconeBalde cor={est.fundo} />
      </button>
      <span className="sep" />
      <button type="button" className={`${painel === 'imagem' ? 'ativo' : ''} ${no.imagem ? 'tem' : ''}`} onClick={() => abrir('imagem')} title="Imagem" aria-expanded={painel === 'imagem'}>
        <IconeImagem />
      </button>
      <button type="button" className={`${painel === 'link' ? 'ativo' : ''} ${no.link ? 'tem' : ''}`} onClick={() => abrir('link')} title="Link (do YouTube mostra a capa do vídeo)" aria-expanded={painel === 'link'}>
        <IconeLink />
      </button>
      <span className="sep" />
      <button type="button" onClick={() => { setPainel(null); obterMotor()?.iniciarLigacao() }} title="Conectar com outra ideia">
        <IconeConectar /><span className="rot">Conectar</span>
      </button>

      {painel === 'texto' && (
        <div className="pl-mf-pop" role="dialog" aria-label="Formatação do texto">
          <div className="pl-mf-fontes">
            {(Object.keys(FONTES) as FonteNo[]).map(f => (
              <button key={f} type="button" className={(est.fonte ?? 'sans') === f ? 'ativo' : ''} style={{ fontFamily: FONTES[f] }} title={ROTULO_FONTE[f]} onClick={() => estilo({ fonte: f === 'sans' ? undefined : f })}>Abc</button>
            ))}
          </div>
          <div className="pl-mf-linha">
            <button type="button" className={est.negrito ? 'ativo' : ''} aria-pressed={!!est.negrito} onClick={() => estilo({ negrito: est.negrito ? undefined : true })} title="Negrito"><b>B</b></button>
            <button type="button" className={est.italico ? 'ativo' : ''} aria-pressed={!!est.italico} onClick={() => estilo({ italico: est.italico ? undefined : true })} title="Itálico"><i style={{ fontFamily: 'Georgia, serif' }}>i</i></button>
            <span className="sep" />
            {(['p', 'm', 'g'] as TamanhoNo[]).map((t, i) => (
              <button key={t} type="button" className={(est.tamanho ?? 'm') === t ? 'ativo' : ''} onClick={() => estilo({ tamanho: t === 'm' ? undefined : t })} title={['Pequeno', 'Médio', 'Grande'][i]}>
                <span style={{ fontSize: [11, 14, 18][i], fontWeight: 700 }}>A</span>
              </button>
            ))}
          </div>
          <div className="pl-mf-titulo">Largura do texto</div>
          <div className="pl-mf-largura">
            <span>{est.largura ? `${est.largura}px` : 'Automática'}</span>
            {est.largura ? <button type="button" onClick={() => estilo({ largura: undefined })}>Voltar ao automático</button> : <small>arraste a alça ⟷ na lateral da ideia</small>}
          </div>
          <div className="pl-mf-titulo">Cor do texto</div>
          <div className="pl-mf-cores">
            <button type="button" className={`auto ${!est.cor ? 'ativo' : ''}`} onClick={() => estilo({ cor: undefined })} title="Cor do tema" aria-label="Cor do tema" />
            {CORES.map(c => <button key={c} type="button" className={est.cor === c ? 'ativo' : ''} style={{ background: c }} onClick={() => estilo({ cor: c })} aria-label={`Cor ${c}`} />)}
            <label className="pl-mf-custom" title="Outra cor">✎<input type="color" value={est.cor ?? '#3b6cf6'} onChange={e => estilo({ cor: e.target.value })} /></label>
          </div>
        </div>
      )}

      {painel === 'fundo' && (
        <div className="pl-mf-pop" role="dialog" aria-label="Cor de fundo">
          <div className="pl-mf-titulo">Fundo da ideia</div>
          <div className="pl-mf-cores">
            <button type="button" className={`nenhum ${!est.fundo ? 'ativo' : ''}`} onClick={() => estilo({ fundo: undefined })} title="Sem fundo" aria-label="Sem fundo" />
            {FUNDOS.map(c => <button key={c} type="button" className={est.fundo === c ? 'ativo' : ''} style={{ background: c }} onClick={() => estilo({ fundo: c })} aria-label={`Fundo ${c}`} />)}
            <label className="pl-mf-custom" title="Outra cor">✎<input type="color" value={est.fundo ?? '#e8efff'} onChange={e => estilo({ fundo: e.target.value })} /></label>
          </div>
        </div>
      )}

      {painel === 'imagem' && (
        <div className="pl-mf-pop pl-mf-pop-largo" role="dialog" aria-label="Imagem">
          <input ref={arquivoRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={e => void enviarArquivo(e.target.files?.[0])} />
          <button type="button" className="pl-btn pl-btn-primary pl-mf-btn" disabled={enviando || colando} onClick={() => arquivoRef.current?.click()}>{enviando ? 'Enviando…' : 'Enviar do computador'}</button>
          <button type="button" className="pl-btn pl-btn-ghost pl-mf-btn pl-mf-btn-colar" disabled={enviando || colando} onClick={() => void colarDaArea()}>{colando ? 'Colando…' : 'Colar print copiado'}</button>
          <div className="pl-mf-dica">Atalho: tire o print e aperte <kbd>Ctrl</kbd>+<kbd>V</kbd> com a ideia selecionada.{no.imagem ? ' Como esta ideia já tem imagem, o print vira uma ideia nova ligada a ela.' : ''}</div>
          <div className="pl-mf-ou">ou cole o link de uma imagem</div>
          <div className="pl-mf-linha-input">
            <input className="pl-input" placeholder="https://…/imagem.jpg" value={urlImagem} onChange={e => setUrlImagem(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void usarLinkImagem() }} />
            <button type="button" className="pl-btn pl-btn-ghost" disabled={enviando || !urlImagem.trim()} onClick={() => void usarLinkImagem()}>Usar</button>
          </div>
          {no.imagem && (
            <>
              <div className="pl-mf-titulo">Tamanho na ideia</div>
              <div className="pl-mf-linha pl-mf-tamanhos">
                {TAMANHOS_IMAGEM.map(([rot, larg]) => (
                  <button key={rot} type="button" className={no.imagem!.largura === larg ? 'ativo' : ''} onClick={() => aplicar({ imagem: { ...no.imagem!, largura: larg } })} title={`${larg}px de largura`}>{rot}</button>
                ))}
                <button type="button" className={!no.imagem.largura ? 'ativo' : ''} onClick={() => aplicar({ imagem: { src: no.imagem!.src, w: no.imagem!.w, h: no.imagem!.h } })} title="Tamanho padrão">Padrão</button>
              </div>
              <div className="pl-mf-dica">Ou arraste o puxador no canto da imagem.</div>
            </>
          )}
          {no.imagem && <button type="button" className="pl-mf-remover" onClick={() => { aplicar({ imagem: null }); setPainel(null) }}>Remover imagem</button>}
          {erro && <div className="pl-mf-erro">{erro}</div>}
        </div>
      )}

      {painel === 'link' && (
        <div className="pl-mf-pop pl-mf-pop-largo" role="dialog" aria-label="Link">
          <label className="pl-mf-campo"><span>Link</span>
            <input className="pl-input" autoFocus placeholder="https://youtube.com/watch?v=…" value={urlLink} onChange={e => setUrlLink(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') salvarLink() }} />
          </label>
          {idYoutube(urlSegura(urlLink.trim())) ? (
            <div className="pl-mf-dica">▶ Vídeo do YouTube — a capa aparece na ideia, e o play abre o vídeo.</div>
          ) : (
            <label className="pl-mf-campo"><span>Texto do link (opcional)</span>
              <input className="pl-input" placeholder="Ex.: Planilha de metas" value={tituloLink} maxLength={60} onChange={e => setTituloLink(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') salvarLink() }} />
            </label>
          )}
          <div className="pl-mf-acoes">
            {no.link && <button type="button" className="pl-mf-remover" onClick={() => { aplicar({ link: null }); setPainel(null) }}>Remover link</button>}
            <button type="button" className="pl-btn pl-btn-primary pl-mf-btn" disabled={!urlLink.trim()} onClick={salvarLink}>Salvar</button>
          </div>
          {erro && <div className="pl-mf-erro">{erro}</div>}
        </div>
      )}
    </div>
  )
}

const svg = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
function IconeTexto({ cor }: { cor?: string }) {
  return <svg {...svg}><path d="M6 16 12 4l6 12M8.5 11h7" /><path d="M4 20h16" stroke={cor ?? 'currentColor'} strokeWidth={3} /></svg>
}
function IconeBalde({ cor }: { cor?: string }) {
  return <svg {...svg}><path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2a2 2 0 0 0 2.8 0Z" /><path d="m5 2 5 5M2 13h15" /><path d="M22 20a2 2 0 1 1-4 0c0-1.6 2-3 2-3s2 1.4 2 3" fill={cor ?? 'none'} /></svg>
}
function IconeImagem() {
  return <svg {...svg}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></svg>
}
function IconeLink() {
  return <svg {...svg}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>
}
function IconeConectar() {
  return <svg {...svg}><circle cx="5" cy="19" r="2" /><circle cx="19" cy="5" r="2" /><path d="M6.5 17.5C9 10 13 9 17 6.5" strokeDasharray="3 3" /></svg>
}
