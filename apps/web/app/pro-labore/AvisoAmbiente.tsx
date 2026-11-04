'use client'

// Faixa fixa no topo quando o sistema está rodando no ambiente de teste.
import { useEffect, useState } from 'react'
import { proLaboreApi } from '@/lib/proLaboreApi'

export function AvisoAmbiente() {
  const [teste, setTeste] = useState(false)
  useEffect(() => { proLaboreApi.sistema.ambiente().then(a => setTeste(a.ambiente === 'teste')).catch(() => undefined) }, [])
  if (!teste) return null
  return (
    <div role="status" data-ambiente-teste style={{ position: 'sticky', top: 0, zIndex: 1000, background: 'var(--pl-warning, #c90)', color: '#111', textAlign: 'center', fontSize: 13, fontWeight: 700, padding: '6px 12px' }}>
      AMBIENTE DE TESTE · dados copiados da produção · nada daqui é enviado a clientes, à Meta ou à IA
    </div>
  )
}
