'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, Notificacao } from '@/lib/api'

export default function NotificacoesPage() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(() => {
    api.notificacoes.listar().then(setNotificacoes).finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function marcarLida(id: string) {
    await api.notificacoes.marcarLida(id)
    carregar()
  }

  async function marcarTodasLidas() {
    await api.notificacoes.marcarTodasLidas()
    carregar()
  }

  const naoLidas = notificacoes.filter(n => !n.lida).length

  if (loading) return <div className="p-8 text-sm text-gray-400">Carregando...</div>

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Notificações</h1>
          <p className="text-sm text-gray-500 mt-0.5">{naoLidas} não lida{naoLidas !== 1 ? 's' : ''}</p>
        </div>
        {naoLidas > 0 && (
          <button onClick={marcarTodasLidas} className="text-xs text-blue-600 hover:underline">Marcar todas como lidas</button>
        )}
      </div>

      {notificacoes.length === 0 ? (
        <div className="text-center py-16"><div className="text-4xl mb-3">🔔</div><h3 className="font-medium text-gray-900">Nenhuma notificação ainda</h3></div>
      ) : (
        <div className="space-y-2">
          {notificacoes.map(n => (
            <div key={n.id} onClick={() => !n.lida && marcarLida(n.id)}
              className={`rounded-xl border p-4 cursor-pointer ${n.lida ? 'bg-white border-gray-200' : 'bg-blue-50 border-blue-200'}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">{n.titulo}</span>
                {!n.lida && <span className="w-2 h-2 rounded-full bg-blue-500" />}
              </div>
              <p className="text-sm text-gray-600 mt-0.5">{n.mensagem}</p>
              <div className="text-xs text-gray-400 mt-1">{new Date(n.criadoEm).toLocaleString('pt-BR')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
