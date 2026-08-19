'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api, OportunidadeDetalhe } from '@/lib/api'
import { ESTAGIO_COR, ESTAGIO_LABEL, ETAPAS_FUNIL_ORDEM } from '@/lib/funil'

const TIPO_ATIVIDADE = [
  { value: 'LIGACAO', label: '📞 Ligação' },
  { value: 'WHATSAPP', label: '💬 WhatsApp' },
  { value: 'VISITA', label: '🏍️ Visita' },
  { value: 'SIMULACAO', label: '🧮 Simulação' },
  { value: 'EMAIL', label: '✉️ Email' },
  { value: 'OUTRO', label: 'Outro' },
]

function formatMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatData(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function OportunidadeDetalhePage() {
  const params = useParams<{ id: string }>()
  const [op, setOp] = useState<OportunidadeDetalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ tipo: 'LIGACAO', descricao: '', proximaAcaoEm: '', proximaAcaoDescricao: '' })

  const carregar = useCallback(() => {
    api.oportunidades.detalhe(params.id).then(setOp).catch(e => setErro(e.message)).finally(() => setLoading(false))
  }, [params.id])

  useEffect(() => { carregar() }, [carregar])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function mover(estagio: string) {
    await api.oportunidades.moverEstagio(params.id, estagio)
    carregar()
  }

  async function registrarAtividade(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      await api.oportunidades.registrarAtividade(params.id, {
        tipo: form.tipo,
        descricao: form.descricao,
        proximaAcaoEm: form.proximaAcaoEm ? new Date(form.proximaAcaoEm).toISOString() : undefined,
        proximaAcaoDescricao: form.proximaAcaoDescricao || undefined,
      })
      setForm({ tipo: 'LIGACAO', descricao: '', proximaAcaoEm: '', proximaAcaoDescricao: '' })
      carregar()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar')
    } finally {
      setSalvando(false)
    }
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Carregando...</div>
  if (!op) return <div className="p-8 text-sm text-red-600">{erro || 'Oportunidade não encontrada'}</div>

  const atrasado = op.proximaAcaoEm && new Date(op.proximaAcaoEm) < new Date()

  return (
    <div className="p-8 max-w-4xl">
      <Link href="/oportunidades" className="text-sm text-gray-400 hover:text-gray-600">← Oportunidades</Link>

      <div className="flex items-start justify-between mt-2 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{op.nomeCliente}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ESTAGIO_COR[op.estagio]}`}>
              {ESTAGIO_LABEL[op.estagio] ?? op.estagio}
            </span>
            {op.telefone && <span className="text-sm text-gray-500">{op.telefone}</span>}
          </div>
        </div>
        {op.valor && <div className="text-lg font-semibold text-green-700">{formatMoeda(op.valor)}</div>}
      </div>

      {/* Próxima ação */}
      <div className={`rounded-xl border p-4 mb-6 ${atrasado ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
        <div className="text-xs font-medium text-gray-500 mb-1">Próxima ação {atrasado && '— atrasada'}</div>
        <div className="text-sm text-gray-900">{op.proximaAcaoDescricao || 'Nenhuma ação agendada'}</div>
        {op.proximaAcaoEm && <div className="text-xs text-gray-500 mt-0.5">{formatData(op.proximaAcaoEm)}</div>}
        <div className="text-xs text-gray-400 mt-1">Última interação: {formatData(op.ultimaInteracaoEm)}</div>
      </div>

      {/* Mover estágio */}
      {!['COMPRADO', 'PERDIDO'].includes(op.estagio) && (
        <div className="mb-6">
          <div className="text-xs font-medium text-gray-500 mb-2">Mover para</div>
          <div className="flex gap-2 flex-wrap">
            {ETAPAS_FUNIL_ORDEM.filter(e => e !== op.estagio).map(e => (
              <button key={e} onClick={() => mover(e)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-300 text-gray-600 hover:bg-gray-50">
                {ESTAGIO_LABEL[e]}
              </button>
            ))}
            <button onClick={() => mover('PERDIDO')}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-red-200 text-red-600 hover:bg-red-50">
              Marcar como perdido
            </button>
          </div>
        </div>
      )}

      {/* Registrar atividade */}
      <form onSubmit={registrarAtividade} className="bg-white rounded-xl border border-gray-200 p-5 mb-6 space-y-3">
        <h2 className="font-semibold text-gray-900 text-sm">Registrar interação</h2>
        <div className="grid grid-cols-2 gap-3">
          <select value={form.tipo} onChange={e => set('tipo', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            {TIPO_ATIVIDADE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input type="datetime-local" value={form.proximaAcaoEm} onChange={e => set('proximaAcaoEm', e.target.value)}
            placeholder="Próxima ação (opcional)"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <textarea value={form.descricao} onChange={e => set('descricao', e.target.value)} required placeholder="O que aconteceu?"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" rows={2} />
        <input type="text" value={form.proximaAcaoDescricao} onChange={e => set('proximaAcaoDescricao', e.target.value)}
          placeholder="Descrição da próxima ação (opcional)"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        {erro && <div className="text-xs text-red-600">{erro}</div>}
        <button type="submit" disabled={salvando}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {salvando ? 'Salvando...' : 'Registrar'}
        </button>
      </form>

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 text-sm mb-3">Histórico</h2>
        {op.atividades.length === 0 && op.historicoEstagio.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma interação registrada ainda.</p>
        ) : (
          <div className="space-y-3">
            {op.atividades.map(a => (
              <div key={a.id} className="text-sm border-b border-gray-50 pb-2 last:border-0">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>{TIPO_ATIVIDADE.find(t => t.value === a.tipo)?.label ?? a.tipo}</span>
                  <span>·</span>
                  <span>{formatData(a.criadoEm)}</span>
                  {a.usuario && <><span>·</span><span>{a.usuario.nome}</span></>}
                </div>
                <div className="text-gray-800 mt-0.5">{a.descricao}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
