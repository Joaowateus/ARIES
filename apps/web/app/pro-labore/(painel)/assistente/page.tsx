'use client'

// Central de Inteligência da operação (gestão), no item Análise do menu.
// O assistente do WhatsApp ganhou a própria tela (/pro-labore/whatsapp): o
// vendedor e os links antigos (?aba=whatsapp) vão para lá.
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { Central } from './_central/Central'

export default function ProLaboreAssistentePage() {
  const { usuario } = useProLaboreAuth()
  const router = useRouter()
  const gestao = usuario?.papel === 'DONO' || usuario?.papel === 'SUPERVISOR'
  const paraWhatsApp = !!usuario && (!gestao || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('aba') === 'whatsapp'))
  useEffect(() => {
    if (!paraWhatsApp) return
    const q = new URLSearchParams(window.location.search); q.delete('aba')
    router.replace(`/pro-labore/whatsapp${q.toString() ? `?${q}` : ''}`)
  }, [paraWhatsApp, router])
  if (!usuario || paraWhatsApp) return <div className="pl-hint">Carregando…</div>
  return <Central />
}
