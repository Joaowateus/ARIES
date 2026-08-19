'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, Rotina, RotinaBloco } from '@/lib/api'
import { useAuth } from '@/lib/auth'

const FREQUENCIAS = [
  { value: 'DIARIA', label: 'Diária (gera checklist do dia)' },
  { value: 'SEMANAL', label: 'Semanal (referência)' },
  { value: 'MENSAL', label: 'Mensal (referência)' },
]

const PAPEIS = ['ADMINISTRADOR', 'DIRETOR_COMERCIAL', 'GERENTE_COMERCIAL', 'SUPERVISOR', 'COORDENADOR', 'VENDEDOR', 'CS', 'FINANCEIRO']

/** Formato de texto simples: título do bloco em uma linha, itens abaixo,
 * blocos separados por linha em branco. Evita construir um editor dinâmico
 * de formulário aninhado para algo que é mais rápido de digitar como texto. */
function parseBlocos(texto: string): RotinaBloco[] {
  return texto
    .split(/\n\s*\n/)
    .map(bloco => bloco.trim())
    .filter(Boolean)
    .map(bloco => {
      const linhas = bloco.split('\n').map(l => l.trim()).filter(Boolean)
      return { titulo: linhas[0] ?? '', itens: linhas.slice(1) }
    })
    .filter(b => b.titulo && b.itens.length > 0)
}

const EXEMPLO = `BLOCO 01 — ABERTURA
Conferir CRM
Conferir leads
Conferir follow-ups
Conferir agenda

BLOCO 02 — PROSPECÇÃO
Realizar contatos
Responder leads
Realizar follow-ups`

export default function RotinasPage() {
  const { user } = useAuth()
  const [rotinas, setRotinas] = useState<Rotina[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const [form, setForm] = useState({ nome: '', descricao: '', papelAlvo: '', frequencia: 'DIARIA', blocosTexto: '' })

  const podeGerenciar = ['ADMINISTRADOR', 'DIRETOR_COMERCIAL', 'GERENTE_COMERCIAL'].includes(user?.papel ?? '')

  const carregar = useCallback(() => {
    api.rotinas.listar().then(setRotinas).finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    const blocos = parseBlocos(form.blocosTexto)
    if (blocos.length === 0) {
      setErro('Defina ao menos um bloco com título e itens')
      return
    }
    setSalvando(true)
    try {
      await api.rotinas.criar({
        nome: form.nome,
        descricao: form.descricao || undefined,
        papelAlvo: form.papelAlvo || null,
        frequencia: form.frequencia,
        blocos,
      })
      setForm({ nome: '', descricao: '', papelAlvo: '', frequencia: 'DIARIA', blocosTexto: '' })
      setShowForm(false)
      carregar()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  async function arquivar(id: string) {
    await api.rotinas.arquivar(id)
    carregar()
  }

  if (!podeGerenciar) {
    return (
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Rotinas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Rotinas ativas da empresa (para editar, veja seu gestor)</p>
        </div>
        <RotinasLista rotinas={rotinas} loading={loading} />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gestão de Rotinas</h1>
          <p className="text-sm text-gray-500 mt-0.5">{rotinas.length} rotina{rotinas.length !== 1 ? 's' : ''} ativa{rotinas.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          {showForm ? 'Cancelar' : '+ Nova Rotina'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={salvar} className="bg-white rounded-xl border border-gray-200 p-6 mb-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Nova rotina</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
              <input value={form.nome} onChange={e => set('nome', e.target.value)} required placeholder="Ex: Rotina do Vendedor"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Papel alvo</label>
              <select value={form.papelAlvo} onChange={e => set('papelAlvo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                <option value="">Todos os papéis</option>
                {PAPEIS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Frequência</label>
            <select value={form.frequencia} onChange={e => set('frequencia', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              {FREQUENCIAS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Blocos e itens * <span className="text-xs text-gray-400 font-normal">(título do bloco numa linha, itens abaixo, linha em branco separa blocos)</span>
            </label>
            <textarea value={form.blocosTexto} onChange={e => set('blocosTexto', e.target.value)} rows={10} placeholder={EXEMPLO}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
          </div>
          {erro && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{erro}</div>}
          <button type="submit" disabled={salvando} className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {salvando ? 'Salvando...' : 'Criar Rotina'}
          </button>
        </form>
      )}

      <RotinasLista rotinas={rotinas} loading={loading} onArquivar={arquivar} />
    </div>
  )
}

function RotinasLista({ rotinas, loading, onArquivar }: { rotinas: Rotina[]; loading: boolean; onArquivar?: (id: string) => void }) {
  if (loading) return <div className="text-sm text-gray-400">Carregando...</div>
  if (rotinas.length === 0) return <div className="text-center py-16"><div className="text-4xl mb-3">📋</div><h3 className="font-medium text-gray-900">Nenhuma rotina cadastrada</h3></div>
  return (
    <div className="space-y-3">
      {rotinas.map(r => (
        <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-medium text-gray-900">{r.nome}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {r.frequencia} · {r.papelAlvo ?? 'Todos os papéis'} · {r.blocos.reduce((s, b) => s + b.itens.length, 0)} itens em {r.blocos.length} blocos
              </div>
            </div>
            {onArquivar && (
              <button onClick={() => onArquivar(r.id)} className="text-xs text-gray-400 hover:text-red-600">Arquivar</button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
