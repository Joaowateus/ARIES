'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, RotinaComExecucao, ItemExecucao } from '@/lib/api'

export default function MinhaRotinaPage() {
  const [dados, setDados] = useState<RotinaComExecucao[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(() => {
    api.rotinas.minha().then(setDados).finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function toggleItem(execucaoId: string, itensStatus: ItemExecucao[], idx: number) {
    const novos = itensStatus.map((it, i) => i === idx ? { ...it, status: it.status === 'CONCLUIDO' ? 'PENDENTE' : 'CONCLUIDO' } : it)
    // Atualiza local otimisticamente
    setDados(d => d.map(x => x.execucao.id === execucaoId ? { ...x, execucao: { ...x.execucao, itensStatus: novos } } : x))
    await api.rotinas.atualizarExecucao(execucaoId, { itensStatus: novos })
    carregar()
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Carregando...</div>

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Minha Rotina</h1>
        <p className="text-sm text-gray-500 mt-0.5">Checklist de hoje — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
      </div>

      {dados.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📋</div>
          <h3 className="font-medium text-gray-900">Nenhuma rotina diária atribuída ainda</h3>
          <p className="text-sm text-gray-500 mt-1">O gestor pode criar rotinas em &quot;Gestão de Rotinas&quot;.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {dados.map(({ rotina, execucao }) => {
            const total = execucao.itensStatus.length
            const feitos = execucao.itensStatus.filter(i => i.status === 'CONCLUIDO').length
            const blocos = Array.from(new Set(execucao.itensStatus.map(i => i.bloco)))
            return (
              <div key={execucao.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-semibold text-gray-900">{rotina.nome}</h2>
                    {rotina.descricao && <p className="text-xs text-gray-500 mt-0.5">{rotina.descricao}</p>}
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${feitos === total ? 'bg-green-100 text-green-700' : feitos > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                    {feitos}/{total}
                  </span>
                </div>
                {blocos.map(bloco => (
                  <div key={bloco} className="mb-4 last:mb-0">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{bloco}</div>
                    <div className="space-y-1.5">
                      {execucao.itensStatus.map((item, idx) => item.bloco === bloco && (
                        <label key={idx} className="flex items-center gap-2 text-sm cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={item.status === 'CONCLUIDO'}
                            onChange={() => toggleItem(execucao.id, execucao.itensStatus, idx)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className={item.status === 'CONCLUIDO' ? 'text-gray-400 line-through' : 'text-gray-800'}>
                            {item.item}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
