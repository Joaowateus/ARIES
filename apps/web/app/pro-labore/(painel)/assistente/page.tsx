'use client'

// Assistente Comercial. Para a gestão (dono e supervisor) é a Central de
// Inteligência da operação, com o assistente do WhatsApp como uma das abas;
// para o vendedor continua sendo o assistente do próprio WhatsApp.
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { Central } from './_central/Central'
import { WhatsApp } from './_componentes/WhatsApp'

export default function ProLaboreAssistentePage() {
  const { usuario } = useProLaboreAuth()
  if (!usuario) return <div className="pl-hint">Carregando…</div>
  if (usuario.papel === 'DONO' || usuario.papel === 'SUPERVISOR') return <Central />
  return <WhatsApp />
}
