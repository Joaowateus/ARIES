'use client'

// Tela 12 · Captura na loja (seção 11.5, fluxo 2): a pauta em gravação com a
// tomada atual (instrução, formato e duração máxima), o checklist das tomadas
// (Enviada, Agora, Pendente) e o botão de gravar, que abre a câmera do
// celular. Com todas as tomadas enviadas, a pauta vai sozinha para Edição.
import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { put } from '@vercel/blob/client'
import { proLaboreApi, urlArquivoApi, type SmCaptura, type SmCapturaItem, type SmTomada } from '@/lib/proLaboreApi'
import { Botao, BotaoLink, CardEsqueleto, EstadoVazio, PILAR_ROTULO, Rotulo, quandoCurto, useToast } from '../../_ui'

export default function CapturaPage() {
  return <Suspense fallback={<CardEsqueleto linhas={5} />}><Captura /></Suspense>
}

function Captura() {
  const busca = useSearchParams()
  const id = busca.get('pauta')
  return id ? <CapturaDaPauta key={id} id={id} /> : <ListaDeGravacao />
}

// Sem pauta escolhida: o que está em gravação, com o progresso das tomadas.
function ListaDeGravacao() {
  const [lista, setLista] = useState<SmCapturaItem[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    proLaboreApi.sm.captura.lista().then(setLista).catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível carregar'))
  }, [])
  return (
    <>
      <header className="sm-pagina-cab">
        <div>
          <Rotulo>Captura na loja</Rotulo>
          <h1 className="sm-ttl sm-h1">Para gravar</h1>
          <p>Abra a pauta, siga a tomada da vez e grave pela câmera. A pauta anda sozinha no quadro.</p>
        </div>
      </header>
      {erro ? <EstadoVazio titulo="Não foi possível carregar">{erro}</EstadoVazio>
        : !lista ? <CardEsqueleto linhas={4} />
          : !lista.length ? (
            <EstadoVazio titulo="Nada em gravação" acao={<BotaoLink href="/pro-labore/sm/producao">Abrir a Produção</BotaoLink>}>
              Leve uma pauta para a coluna Gravação na Produção (ou abra a captura pelo briefing) e ela aparece aqui.
            </EstadoVazio>
          ) : (
            <ul className="sm-captura-lista">
              {lista.map(p => (
                <li key={p.id}>
                  <Link href={`/pro-labore/sm/captura?pauta=${p.id}`} className="sm-captura-item">
                    <span className="sm-mono">{PILAR_ROTULO[p.pilar]}{p.prazo ? ` · prazo ${quandoCurto(p.prazo, false)}` : ''}</span>
                    <b>{p.titulo}</b>
                    <span>{p.enviadas} de {p.total} {p.total === 1 ? 'tomada' : 'tomadas'}{p.proxima ? ` · agora: ${p.proxima}` : ''}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
    </>
  )
}

const SITUACAO: Record<SmTomada['situacao'], string> = { ENVIADA: 'Enviada', AGORA: 'Agora', PENDENTE: 'Pendente' }
// Arquivo de vídeo (Blob ou link direto) toca aqui; link de Drive e afins abre fora.
const videoDireto = (url: string) => /\.blob\.vercel-storage\.com\//.test(url) || /\.(mp4|mov|webm|m4v|3gp)(\?|$)/i.test(url)
const extensao = (f: File) => (f.name.split('.').pop() ?? '').toLowerCase() || (f.type.split('/')[1] ?? 'mp4')

function CapturaDaPauta({ id }: { id: string }) {
  const toast = useToast()
  const router = useRouter()
  const [c, setC] = useState<SmCaptura | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [escolhida, setEscolhida] = useState<number | null>(null)
  const [enviando, setEnviando] = useState<number | null>(null) // % do envio (vídeo) ou -1 (foto/registro)
  const [link, setLink] = useState('')
  const camera = useRef<HTMLInputElement>(null)
  const galeria = useRef<HTMLInputElement>(null)

  useEffect(() => {
    proLaboreApi.sm.captura.ver(id).then(setC).catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível abrir a pauta'))
  }, [id])

  if (erro) return <EstadoVazio titulo="Não foi possível abrir a captura" acao={<BotaoLink href="/pro-labore/sm/captura">Ver o que está em gravação</BotaoLink>}>{erro}</EstadoVazio>
  if (!c) return <CardEsqueleto linhas={6} texto="Abrindo a captura" />

  const { pauta, tomadas } = c
  const agora = tomadas.find(t => t.situacao === 'AGORA') ?? null
  const atual = tomadas.find(t => t.n === escolhida) ?? agora
  const completas = !agora
  const video = atual?.arquivo === 'VIDEO'
  const semVideoPeloApp = video && !c.videoPeloApp

  function depois(r: SmCaptura, n: number) {
    setC(r)
    setEscolhida(null)
    setLink('')
    if (r.avancou === 'EDICAO') toast({ mensagem: 'Tomadas completas: a pauta foi para Edição.' })
    else toast({ mensagem: `Tomada ${n} enviada.` })
  }

  async function enviar(arquivo: File | undefined) {
    if (!arquivo || !atual) return
    const n = atual.n
    try {
      if (atual.arquivo === 'FOTO') {
        setEnviando(-1)
        depois(await proLaboreApi.sm.captura.enviarFoto(pauta.id, n, arquivo), n)
      } else {
        setEnviando(0)
        const { token, pathname } = await proLaboreApi.sm.captura.tokenVideo(pauta.id, n, extensao(arquivo))
        // O progresso chega em intervalos: o último pode vir depois do fim do envio e não pode reabrir o "Enviando…".
        let terminou = false
        const blob = await put(pathname, arquivo, {
          access: 'public', token, contentType: arquivo.type || 'video/mp4', multipart: arquivo.size > 40 * 1024 * 1024,
          onUploadProgress: p => { if (!terminou) setEnviando(Math.round(p.percentage)) },
        })
        terminou = true
        setEnviando(-1)
        depois(await proLaboreApi.sm.captura.registrarVideo(pauta.id, n, blob.url, 'BLOB'), n)
      }
    } catch (e) {
      toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível enviar. Tente de novo.', tom: 'bad' })
    } finally { setEnviando(null) }
  }

  async function enviarLink(e: React.FormEvent) {
    e.preventDefault()
    if (!atual || !link.trim()) return
    setEnviando(-1)
    try { depois(await proLaboreApi.sm.captura.registrarVideo(pauta.id, atual.n, link.trim(), 'LINK'), atual.n) }
    catch (err) { toast({ mensagem: err instanceof Error ? err.message : 'Não foi possível salvar o link', tom: 'bad' }) }
    finally { setEnviando(null) }
  }

  async function refazer(n: number) {
    try { setC(await proLaboreApi.sm.captura.refazer(pauta.id, n)); setEscolhida(n); toast({ mensagem: `Tomada ${n} liberada para gravar de novo.` }) }
    catch (err) { toast({ mensagem: err instanceof Error ? err.message : 'Não foi possível refazer', tom: 'bad' }) }
  }

  const ocupado = enviando !== null
  return (
    <div className="sm-captura">
      <header className="sm-captura-cab">
        <Rotulo>{pauta.status === 'EDICAO' ? 'Edição' : 'Gravação'} · {PILAR_ROTULO[pauta.pilar]}</Rotulo>
        <h1 className="sm-ttl">{pauta.titulo}</h1>
      </header>

      {pauta.pilar === 'PROVA' && !pauta.autorizacaoImagem && (
        <div className="sm-status warn" role="status">Lembre de pegar a autorização de imagem do cliente antes de publicar.</div>
      )}

      <section className="sm-tomada-palco" aria-live="polite">
        {completas && !escolhida ? (
          <>
            <span className="sm-tomada-de">Tomadas completas</span>
            <b>{pauta.status === 'EDICAO' ? 'A pauta foi para Edição' : 'Tudo enviado'}</b>
            <span className="sm-tomada-formato">{tomadas.length} de {tomadas.length} enviadas</span>
            <BotaoLink href={`/pro-labore/sm/producao?pauta=${pauta.id}`}>Abrir na Produção</BotaoLink>
          </>
        ) : atual && (
          <>
            <span className="sm-tomada-de">Tomada {atual.n} de {tomadas.length}</span>
            <b>{atual.instrucao}</b>
            <span className="sm-tomada-formato">{atual.formato}</span>
            {atual.midia && (atual.arquivo === 'FOTO'
              // eslint-disable-next-line @next/next/no-img-element
              ? <img className="sm-tomada-previa" src={urlArquivoApi(atual.midia.url)} alt={`Foto da tomada ${atual.n}`} />
              : videoDireto(atual.midia.url)
                ? <video className="sm-tomada-previa" src={atual.midia.url} controls playsInline preload="metadata" aria-label={`Vídeo da tomada ${atual.n}`} />
                : <a className="sm-link-botao" href={atual.midia.url} target="_blank" rel="noreferrer">Abrir o vídeo enviado</a>)}
            {enviando !== null && <span className="sm-tomada-formato" role="status">{enviando >= 0 ? `Enviando… ${enviando}%` : 'Enviando…'}</span>}
          </>
        )}
      </section>

      <ol className="sm-tomadas" aria-label="Tomadas">
        {tomadas.map(t => (
          <li key={t.n}>
            <button type="button" className={`sm-tomada-linha${atual?.n === t.n && !(completas && !escolhida) ? ' atual' : ''}`} onClick={() => setEscolhida(t.n === agora?.n ? null : t.n)} aria-pressed={atual?.n === t.n && !(completas && !escolhida)}>
              <span>{t.n}. {t.nome}</span>
              <span className={`sm-tomada-situacao ${t.situacao.toLowerCase()}`}>{SITUACAO[t.situacao]}</span>
            </button>
          </li>
        ))}
      </ol>

      {!c.podeEnviar ? (
        <p className="sm-legenda">{pauta.status === 'APROVACAO' || pauta.status === 'AGENDADO' || pauta.status === 'PUBLICADO' ? 'A pauta já passou da edição: não recebe mais tomadas.' : 'Seu acesso à Produção é só leitura.'}</p>
      ) : atual && !(completas && !escolhida) && (
        <div className="sm-captura-acoes">
          {atual.midia ? (
            <Botao onClick={() => refazer(atual.n)} disabled={ocupado}>Refazer a tomada {atual.n}</Botao>
          ) : semVideoPeloApp ? (
            <form className="sm-captura-link" onSubmit={enviarLink}>
              <span className="sm-legenda">O envio de vídeo pelo app depende do armazenamento de arquivos. Grave, suba no Drive (ou similar) e cole o link público.</span>
              <label className="sm-sr" htmlFor="captura-link">Link público do vídeo</label>
              <input id="captura-link" className="sm-input" type="url" inputMode="url" placeholder="https:// link público do vídeo" value={link} onChange={e => setLink(e.target.value)} />
              <Botao type="submit" variante="pri" disabled={ocupado || !link.trim()}>Salvar a tomada {atual.n}</Botao>
            </form>
          ) : (
            <>
              <input ref={camera} type="file" accept={video ? 'video/*' : 'image/jpeg'} capture="environment" hidden onChange={e => { enviar(e.target.files?.[0]); e.target.value = '' }} />
              <input ref={galeria} type="file" accept={video ? 'video/*' : 'image/jpeg'} hidden onChange={e => { enviar(e.target.files?.[0]); e.target.value = '' }} />
              <button type="button" className="sm-gravar" onClick={() => camera.current?.click()} disabled={ocupado} aria-label={video ? `Gravar a tomada ${atual.n}` : `Fotografar a tomada ${atual.n}`}>
                <span className={video ? 'video' : 'foto'} />
              </button>
              <Botao variante="fantasma" onClick={() => galeria.current?.click()} disabled={ocupado}>Subir da galeria</Botao>
            </>
          )}
        </div>
      )}
      <div className="sm-captura-rodape">
        <button type="button" className="sm-link-botao" onClick={() => router.push('/pro-labore/sm/captura')}>Outras pautas em gravação</button>
      </div>
    </div>
  )
}
