'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getUser } from '@/lib/api'

export default function Home() {
  const router = useRouter()

  // Abrir o endereço do sistema leva à tela inicial do ARIES (Início › Início) — ou ao login dele.
  // Quem só tem a sessão da base antiga continua indo para o painel dela.
  useEffect(() => {
    let destino = '/pro-labore/login'
    try {
      if (localStorage.getItem('pro_labore_token')) {
        const u = JSON.parse(localStorage.getItem('pro_labore_usuario') ?? 'null') as { papel?: string } | null
        destino = u?.papel === 'SOCIAL_MEDIA' ? '/pro-labore/sm' : '/pro-labore/hoje'
      } else if (getUser()) destino = '/dashboard'
    } catch { /* sem armazenamento: vai ao login */ }
    router.replace(destino)
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-400 text-sm">Carregando...</div>
    </div>
  )
}
