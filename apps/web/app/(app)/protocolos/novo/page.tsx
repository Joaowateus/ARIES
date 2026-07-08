'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import ProtocoloForm, { ProtocoloFormData } from '@/components/protocolos/ProtocoloForm'

export default function NovoProtocoloPage() {
  const router = useRouter()

  async function salvar(data: ProtocoloFormData) {
    const criado = await api.protocolos.criar(data)
    router.push(`/protocolos/${criado.id}`)
  }

  return (
    <div className="p-8">
      <Link href="/protocolos" className="text-xs text-gray-400 hover:text-gray-700">← Voltar para Protocolos</Link>
      <h1 className="text-xl font-bold text-gray-900 mt-2 mb-6">Novo Protocolo</h1>
      <ProtocoloForm onSubmit={salvar} textoBotao="Criar Protocolo" />
    </div>
  )
}
