'use client'

// Áudio e foto de uma mensagem do WhatsApp dentro da bolha da conversa. O
// arquivo vem da API com login (proLaboreApi.midiasConversa) e vira um
// endereço local do navegador. Áudio só baixa quando a pessoa toca em
// "Ouvir"; a foto baixa quando a bolha aparece na tela.
import { useEffect, useRef, useState } from 'react'
import { proLaboreApi, type AssistenteMensagem } from '@/lib/proLaboreApi'

type Midia = NonNullable<AssistenteMensagem['midia']>
const duracao = (s: number | null) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : null)

function useArquivo(mensagemId: string) {
  const [url, setUrl] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const atual = useRef<string | null>(null)
  useEffect(() => () => { if (atual.current) URL.revokeObjectURL(atual.current) }, [])
  async function carregar() {
    if (url || carregando) return
    setCarregando(true); setErro('')
    try {
      const blob = await proLaboreApi.midiasConversa.arquivo(mensagemId)
      atual.current = URL.createObjectURL(blob)
      setUrl(atual.current)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setCarregando(false)
    }
  }
  return { url, erro, carregando, carregar }
}

function Audio({ mensagemId, midia }: { mensagemId: string; midia: Midia }) {
  const { url, erro, carregando, carregar } = useArquivo(mensagemId)
  const tempo = duracao(midia.duracaoSeg)
  if (url) {
    return (
      <div className="pl-as-midia-audio" data-midia-audio>
        <audio controls autoPlay src={url} preload="auto" />
        <a className="pl-as-midia-baixar" href={url} download={`audio-${mensagemId}`}>Baixar</a>
      </div>
    )
  }
  return (
    <div className="pl-as-midia-audio">
      <button type="button" className="pl-as-midia-ouvir" onClick={() => void carregar()} disabled={carregando} data-midia-ouvir>
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>
        {carregando ? 'Carregando…' : `Ouvir áudio${tempo ? ` · ${tempo}` : ''}`}
      </button>
      {erro && <span className="pl-as-midia-erro" role="alert">{erro}</span>}
    </div>
  )
}

function Imagem({ mensagemId }: { mensagemId: string }) {
  const { url, erro, carregando, carregar } = useArquivo(mensagemId)
  const caixa = useRef<HTMLDivElement>(null)
  const carregarRef = useRef(carregar)
  useEffect(() => { carregarRef.current = carregar })
  useEffect(() => {
    const el = caixa.current
    if (!el) return
    const obs = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { obs.disconnect(); void carregarRef.current() } }, { rootMargin: '200px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <div ref={caixa} className="pl-as-midia-imagem" data-midia-imagem>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" title="Abrir a foto em tamanho real">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="pl-as-bolha-foto" src={url} alt="Foto da conversa" />
        </a>
      ) : erro ? (
        <span className="pl-as-midia-erro" role="alert">{erro}</span>
      ) : (
        <span className="pl-as-midia-carregando">{carregando ? 'Carregando a foto…' : 'Foto'}</span>
      )}
    </div>
  )
}

export function MidiaMensagem({ mensagemId, midia }: { mensagemId: string; midia: Midia }) {
  if (midia.status === 'INDISPONIVEL') {
    return <span className="pl-as-midia-erro">{midia.tipo === 'AUDIO' ? 'Áudio' : 'Foto'} indisponível: o WhatsApp não tem mais esse arquivo.</span>
  }
  return midia.tipo === 'AUDIO' ? <Audio mensagemId={mensagemId} midia={midia} /> : <Imagem mensagemId={mensagemId} />
}

/** Rótulo que o WhatsApp põe no lugar da mídia ("[áudio]"): some quando o arquivo aparece. */
export const ehRotuloDeMidia = (texto: string) => texto === '[áudio]' || texto === '[imagem]'
