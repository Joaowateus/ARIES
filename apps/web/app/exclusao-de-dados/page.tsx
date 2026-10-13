// Instruções públicas de exclusão de dados: a Meta pede este endereço
// ("URL de instruções de exclusão de dados") para apps com Login do Facebook.
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Exclusão de dados — ARIES', description: 'Como pedir a exclusão dos dados no ARIES — Sistema Comercial.' }

export default function ExclusaoDeDadosPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 leading-relaxed">
      <p className="text-sm uppercase tracking-wide text-gray-500">ARIES — Sistema Comercial</p>
      <h1 className="mt-1 text-3xl font-bold">Exclusão de dados</h1>
      <p className="mt-4 text-gray-700">Você pode remover o acesso do ARIES às suas contas e pedir que os dados guardados sejam apagados.</p>

      <h2 className="mt-8 text-xl font-semibold">1. Remover o acesso pelo Facebook</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-gray-700">
        <li>No Facebook, abra <b>Configurações e privacidade → Configurações</b>.</li>
        <li>Entre em <b>Integrações comerciais</b> (ou <b>Apps e sites</b>).</li>
        <li>Encontre o app do ARIES e clique em <b>Remover</b>.</li>
      </ol>

      <h2 className="mt-8 text-xl font-semibold">2. Pedir a exclusão dos dados guardados</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-gray-700">
        <li>Se você é o responsável da empresa: no ARIES, use <b>Desconectar</b> nas abas Tráfego e Social Media e peça a exclusão ao suporte do sistema.</li>
        <li>Se você é cliente atendido pela empresa: peça a exclusão à empresa que te atendeu, pelo mesmo canal da conversa (direct do Instagram ou WhatsApp).</li>
        <li>Os dados são apagados em até 30 dias após o pedido, e você recebe a confirmação pelo mesmo canal.</li>
      </ol>

      <p className="mt-8 text-sm text-gray-500">Veja também a <Link className="text-blue-700 underline" href="/privacidade">Política de Privacidade</Link>.</p>
    </main>
  )
}
