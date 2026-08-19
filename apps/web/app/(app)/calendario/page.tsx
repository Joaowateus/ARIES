'use client'

import { useEffect, useState } from 'react'
import { api, EventoCalendario } from '@/lib/api'

const TIPO_ICONE: Record<string, string> = { TAREFA: '📌', FOLLOW_UP: '🎯', AUDITORIA: '🕵️' }
const TIPO_LABEL: Record<string, string> = { TAREFA: 'Tarefa', FOLLOW_UP: 'Follow-up', AUDITORIA: 'Auditoria' }

export default function CalendarioPage() {
  const [eventos, setEventos] = useState<EventoCalendario[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.calendario.listar().then(setEventos).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-sm text-gray-400">Carregando...</div>

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const grupos = eventos.reduce<Record<string, EventoCalendario[]>>((acc, e) => {
    const dia = new Date(e.data).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
    if (!acc[dia]) acc[dia] = []
    acc[dia].push(e)
    return acc
  }, {})

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Calendário</h1>
        <p className="text-sm text-gray-500 mt-0.5">Tarefas, follow-ups e auditorias — dos últimos 7 dias aos próximos 30</p>
      </div>

      {eventos.length === 0 ? (
        <div className="text-center py-16"><div className="text-4xl mb-3">📅</div><h3 className="font-medium text-gray-900">Nada agendado no período</h3></div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grupos).map(([dia, itens]) => (
            <div key={dia}>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{dia}</div>
              <div className="space-y-2">
                {itens.map((e, i) => {
                  const atrasado = new Date(e.data) < hoje
                  return (
                    <div key={i} className={`bg-white rounded-xl border p-3 flex items-center gap-3 ${atrasado ? 'border-red-200' : 'border-gray-200'}`}>
                      <span>{TIPO_ICONE[e.tipo] ?? '•'}</span>
                      <div className="flex-1">
                        <div className="text-sm text-gray-900">{e.titulo}</div>
                        <div className="text-xs text-gray-400">{TIPO_LABEL[e.tipo] ?? e.tipo} · {new Date(e.data).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                      {atrasado && <span className="text-xs text-red-600 font-medium">Atrasado</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
