'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth'

const PAPEL_LABEL: Record<string, string> = {
  ADMINISTRADOR: 'Admin',
  DIRETOR_COMERCIAL: 'Diretor',
  GERENTE_COMERCIAL: 'Gerente',
  SUPERVISOR: 'Supervisor',
  COORDENADOR: 'Coordenador',
  VENDEDOR: 'Vendedor',
  CS: 'CS',
  FINANCEIRO: 'Financeiro',
  LEITOR: 'Leitor',
}

const nav = [
  { href: '/meu-painel', label: 'Meu Painel', icon: '🙋' },
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/funil', label: 'Funil de Vendas', icon: '🔽' },
  { href: '/oportunidades', label: 'Oportunidades', icon: '🎯' },
  { href: '/conversao', label: 'Funil & Conversão', icon: '📈' },
  { href: '/insights', label: 'Insights', icon: '💡' },
  { href: '/contratos', label: 'Contratos', icon: '📄' },
  { href: '/financeiro', label: 'Financeiro', icon: '💰' },
  { href: '/estoque', label: 'Estoque', icon: '🏍️' },
  { href: '/precificacao', label: 'Precificação', icon: '💲' },
  { href: '/protocolos', label: 'Protocolos', icon: '📋' },
  { href: '/processos', label: 'Processos', icon: '🗺️' },
  { href: '/treinamentos', label: 'Treinamentos', icon: '🎓' },
  { href: '/auditorias', label: 'Auditorias', icon: '🕵️' },
  { href: '/painel-gerencial', label: 'Painel Gerencial', icon: '👔' },
  { href: '/metas', label: 'Metas', icon: '🎯' },
  { href: '/minha-rotina', label: 'Minha Rotina', icon: '✅' },
  { href: '/rotinas', label: 'Gestão de Rotinas', icon: '🔁' },
  { href: '/tarefas', label: 'Tarefas', icon: '📌' },
  { href: '/marketplace', label: 'Marketplace', icon: '🛵' },
  { href: '/social-media', label: 'Social Media', icon: '📱' },
  { href: '/vendedores', label: 'Equipe', icon: '👥' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-white border-r border-gray-200 min-h-screen">
      {/* Logo */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <div>
            <div className="font-semibold text-sm text-gray-900">ARIES</div>
            <div className="text-xs text-gray-400">Sistema Comercial</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5">
        {nav.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname === item.href || pathname.startsWith(item.href + '/')
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-gray-100">
        <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium text-xs">
            {user?.nome?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-gray-900 truncate">{user?.nome}</div>
            <div className="text-xs text-gray-400">{PAPEL_LABEL[user?.papel ?? ''] ?? user?.papel}</div>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full text-left px-3 py-1.5 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          Sair
        </button>
      </div>
    </aside>
  )
}
