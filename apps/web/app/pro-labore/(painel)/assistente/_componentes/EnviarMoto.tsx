'use client'

// Botão "Enviar moto" da conversa: escolhe uma moto do estoque e manda a
// ficha com as fotos pelo WhatsApp do vendedor.
import { useEffect, useRef, useState } from 'react'
import { proLaboreApi, urlArquivoApi, type MotoVitrine } from '@/lib/proLaboreApi'

// Use com key={conversaId}: trocar de conversa fecha a lista.
export function BotaoEnviarMoto({ desabilitado, onEnviar }: { desabilitado?: boolean; onEnviar: (motoId: string) => Promise<void> }) {
  const [aberto, setAberto] = useState(false)
  const [motos, setMotos] = useState<MotoVitrine[] | null>(null)
  const [busca, setBusca] = useState('')
  const [enviando, setEnviando] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto || motos) return
    proLaboreApi.assistente.vitrine().then(d => setMotos(d.motos.filter(m => m.situacao === 'DISPONIVEL'))).catch(() => setMotos([]))
  }, [aberto, motos])

  useEffect(() => {
    if (!aberto) return
    const fechar = (e: MouseEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false) }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [aberto])

  async function escolher(id: string) {
    setEnviando(true)
    try {
      await onEnviar(id)
      setAberto(false)
    } finally {
      setEnviando(false)
    }
  }

  const t = busca.trim().toLowerCase()
  const lista = (motos ?? []).filter(m => !t || m.nome.toLowerCase().includes(t))
  return (
    <div className="pl-as-enviar-moto" ref={caixa}>
      <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setAberto(a => !a)} disabled={desabilitado || enviando} aria-expanded={aberto} data-enviar-moto>
        {enviando ? 'Enviando moto…' : 'Enviar moto'}
      </button>
      {aberto && (
        <div className="pl-card pl-as-moto-lista" role="dialog" aria-label="Escolher moto do estoque">
          <input className="pl-input" type="search" placeholder="Buscar no estoque" value={busca} onChange={e => setBusca(e.target.value)} autoFocus aria-label="Buscar moto no estoque" />
          {!motos ? <div className="pl-hint">Carregando…</div> : lista.length === 0 ? (
            <div className="pl-hint">{motos.length ? 'Nenhuma moto com esse nome.' : 'Nenhuma moto disponível na aba Estoque.'}</div>
          ) : lista.map(m => (
            <button key={m.id} type="button" onClick={() => escolher(m.id)} disabled={enviando} data-escolher-moto={m.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {m.fotos[0] ? <img src={urlArquivoApi(m.fotos[0])} alt="" /> : <span className="pl-as-sug-moto-sem" aria-hidden="true" />}
              <span>{m.nome}<small>{[m.km !== null ? `${m.km.toLocaleString('pt-BR')} km` : null, m.cor, m.fotos.length ? `${m.fotos.length} foto${m.fotos.length > 1 ? 's' : ''}` : 'sem foto'].filter(Boolean).join(' · ')}</small></span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
