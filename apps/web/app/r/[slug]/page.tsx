'use client'

// Link rastreado (seção 3.5): /r/{slug} registra o toque e abre o WhatsApp
// da loja com a mensagem que traz o código do post. Página pública, sem
// login. Robôs que só leem o HTML (prévias de link) não contam toque.
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { proLaboreApi, type ErroApi } from '@/lib/proLaboreApi'

type Estado = { tipo: 'abrindo' } | { tipo: 'pronto'; url: string } | { tipo: 'erro'; mensagem: string }

export default function LinkRastreadoPage() {
  const { slug } = useParams<{ slug: string }>()
  const [estado, setEstado] = useState<Estado>({ tipo: 'abrindo' })

  useEffect(() => {
    let ativo = true
    proLaboreApi.sm.abrirLink(slug)
      .then(r => {
        if (!ativo) return
        setEstado({ tipo: 'pronto', url: r.url })
        window.location.replace(r.url)
      })
      .catch((e: ErroApi) => {
        if (!ativo) return
        setEstado({ tipo: 'erro', mensagem: e.status === 404 ? 'Este link não existe mais.' : e.status === 409 ? 'O WhatsApp da loja ainda não foi configurado. Chame a loja pelo direct do Instagram.' : 'Não foi possível abrir o WhatsApp agora. Tente de novo em instantes.' })
      })
    return () => { ativo = false }
  }, [slug])

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: '#0A0A0B', color: '#EDEDEF', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 360, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {estado.tipo === 'erro'
          ? <p role="alert" style={{ margin: 0, fontSize: 16, lineHeight: 1.5 }}>{estado.mensagem}</p>
          : (
            <>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Abrindo o WhatsApp…</p>
              {estado.tipo === 'pronto' && (
                <a href={estado.url} style={{ color: '#0A0A0B', background: '#ECECEF', borderRadius: 10, padding: '12px 16px', fontWeight: 600, textDecoration: 'none' }}>
                  Abrir conversa
                </a>
              )}
            </>
          )}
      </div>
    </main>
  )
}
