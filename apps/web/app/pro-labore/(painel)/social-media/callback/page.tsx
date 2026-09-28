'use client'

// Callback do login OAuth com o Instagram: a Meta redireciona pra cá depois
// do dono autorizar no diálogo do Facebook, trazendo `code` (e `state`, pra
// conferir contra o valor salvo antes de sair — ver socialMediaOAuth.ts) na
// própria URL. `useSearchParams` exige Suspense (ver ProLaboreOcorrenciasPage
// pro mesmo padrão já usado no resto do app).
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { proLaboreApi } from '@/lib/proLaboreApi'
import { consumirEstadoOAuth } from '@/lib/socialMediaOAuth'

function SocialMediaCallbackConteudo() {
  const router = useRouter()
  const params = useSearchParams()
  const [erro, setErro] = useState('')

  useEffect(() => {
    const erroMeta = params.get('error_description') || params.get('error')
    if (erroMeta) { setErro(erroMeta); return }

    const code = params.get('code')
    const stateValido = consumirEstadoOAuth(params.get('state'))
    if (!stateValido) { setErro('Sessão de autorização inválida ou expirada. Tente conectar de novo.'); return }
    if (!code) { setErro('Código de autorização não recebido.'); return }

    proLaboreApi.socialMedia.conectarOAuth(code)
      .then(() => router.replace('/pro-labore/social-media'))
      .catch(err => setErro(err instanceof Error ? err.message : 'Falha ao conectar com o Instagram'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="pl-card" style={{ maxWidth: 480, margin: '60px auto' }}>
      {erro ? (
        <>
          <div className="pl-card-title" style={{ color: 'var(--pl-critical)' }}>Não foi possível conectar</div>
          <p className="pl-card-sub" style={{ marginTop: 8 }}>{erro}</p>
          <a href="/pro-labore/social-media" className="pl-btn pl-btn-primary" style={{ marginTop: 14, display: 'inline-flex' }}>Voltar</a>
        </>
      ) : (
        <div className="pl-hint">Conectando sua conta do Instagram…</div>
      )}
    </div>
  )
}

export default function SocialMediaCallbackPage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--pl-ink-muted)', fontSize: 13 }}>Carregando...</div>}>
      <SocialMediaCallbackConteudo />
    </Suspense>
  )
}
