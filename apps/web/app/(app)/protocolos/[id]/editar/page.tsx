'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, ProtocoloDetalhe } from '@/lib/api'
import ProtocoloForm, { ProtocoloFormData } from '@/components/protocolos/ProtocoloForm'

export default function EditarProtocoloPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [protocolo, setProtocolo] = useState<ProtocoloDetalhe | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.protocolos.detalhe(id).then(setProtocolo).finally(() => setLoading(false))
  }, [id])

  async function salvar(data: ProtocoloFormData) {
    await api.protocolos.editar(id, data)
    router.push(`/protocolos/${id}`)
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Carregando...</div>
  if (!protocolo) return <div className="p-8 text-sm text-red-600">Protocolo não encontrado.</div>

  return (
    <div className="p-8">
      <Link href={`/protocolos/${id}`} className="text-xs text-gray-400 hover:text-gray-700">← Voltar</Link>
      <h1 className="text-xl font-bold text-gray-900 mt-2 mb-6">Editar Protocolo</h1>
      <ProtocoloForm inicial={protocolo} onSubmit={salvar} textoBotao="Salvar Alterações" />
    </div>
  )
}
