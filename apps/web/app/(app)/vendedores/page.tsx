'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, Usuario } from '@/lib/api'
import { useAuth } from '@/lib/auth'

const PAPEIS = [
  { value: 'ADMINISTRADOR', label: 'Administrador' },
  { value: 'DIRETOR_COMERCIAL', label: 'Diretor Comercial' },
  { value: 'GERENTE_COMERCIAL', label: 'Gerente Comercial' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'COORDENADOR', label: 'Coordenador' },
  { value: 'VENDEDOR', label: 'Vendedor' },
  { value: 'CS', label: 'Customer Success' },
  { value: 'FINANCEIRO', label: 'Financeiro' },
  { value: 'LEITOR', label: 'Leitor' },
]

const PAPEL_COR: Record<string, string> = {
  ADMINISTRADOR: 'bg-red-100 text-red-700',
  DIRETOR_COMERCIAL: 'bg-purple-100 text-purple-700',
  GERENTE_COMERCIAL: 'bg-blue-100 text-blue-700',
  SUPERVISOR: 'bg-indigo-100 text-indigo-700',
  COORDENADOR: 'bg-cyan-100 text-cyan-700',
  VENDEDOR: 'bg-green-100 text-green-700',
  CS: 'bg-teal-100 text-teal-700',
  FINANCEIRO: 'bg-orange-100 text-orange-700',
  LEITOR: 'bg-gray-100 text-gray-700',
}

export default function VendedoresPage() {
  const { user: eu } = useAuth()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)

  const [form, setForm] = useState({ nome: '', email: '', senha: '', papel: 'VENDEDOR', departamento: '', gestorId: '' })

  const podeGerenciar = ['ADMINISTRADOR', 'DIRETOR_COMERCIAL', 'GERENTE_COMERCIAL'].includes(eu?.papel ?? '')

  const carregar = useCallback(() => {
    api.usuarios.listar().then(setUsuarios).finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      await api.usuarios.criar({ ...form, gestorId: form.gestorId || undefined, departamento: form.departamento || undefined })
      setForm({ nome: '', email: '', senha: '', papel: 'VENDEDOR', departamento: '', gestorId: '' })
      setShowForm(false)
      carregar()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  async function toggleStatus(id: string, status: string) {
    await api.usuarios.alterarStatus(id, status === 'ATIVO' ? 'INATIVO' : 'ATIVO')
    carregar()
  }

  async function atualizarCampo(id: string, campo: 'papel' | 'gestorId', valor: string) {
    await api.usuarios.editar(id, { [campo]: valor || null })
    carregar()
  }

  async function importarHistoricoWanderson() {
    setImportando(true)
    try {
      const resultado = await api.oportunidades.importarHistoricoWanderson()
      window.alert(
        resultado.importadas > 0
          ? `Importado: ${resultado.importadas} venda(s), R$ ${resultado.valorTotal.toLocaleString('pt-BR')}.${resultado.jaExistiam > 0 ? ` (${resultado.jaExistiam} já existiam e foram puladas)` : ''}`
          : `Nada a importar — as ${resultado.jaExistiam} venda(s) já estavam registradas.`
      )
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : 'Erro ao importar histórico')
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Equipe</h1>
          <p className="text-sm text-gray-500 mt-0.5">{usuarios.length} membro{usuarios.length !== 1 ? 's' : ''} — hierarquia usada para visão consolidada de supervisores e gerentes</p>
        </div>
        {podeGerenciar && (
          <button
            onClick={() => setShowForm(s => !s)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {showForm ? 'Cancelar' : '+ Novo Membro'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={salvar} className="bg-white rounded-xl border border-gray-200 p-6 mb-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Adicionar membro da equipe</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
            <input type="text" value={form.nome} onChange={e => set('nome', e.target.value)} required placeholder="Nome Sobrenome"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required placeholder="vendedor@empresa.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha provisória *</label>
              <input type="password" value={form.senha} onChange={e => set('senha', e.target.value)} required minLength={6} placeholder="Mínimo 6 caracteres"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Papel no sistema</label>
              <select value={form.papel} onChange={e => set('papel', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {PAPEIS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
              <input type="text" value={form.departamento} onChange={e => set('departamento', e.target.value)} placeholder="Ex: Comercial"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reporta para</label>
              <select value={form.gestorId} onChange={e => set('gestorId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">Sem gestor direto</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
          </div>
          {erro && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{erro}</div>}
          <button type="submit" disabled={salvando}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {salvando ? 'Salvando...' : 'Adicionar Membro'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-sm text-gray-400">Carregando...</div>
      ) : usuarios.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">👥</div>
          <h3 className="font-medium text-gray-900">Nenhum membro ainda</h3>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Papel</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Reporta para</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                {podeGerenciar && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usuarios.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium text-xs">
                        {u.nome[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{u.nome}</span>
                      {u.id === eu?.id && <span className="text-xs text-gray-400">(você)</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    {podeGerenciar && editandoId === u.id ? (
                      <select
                        value={u.papel}
                        onChange={e => atualizarCampo(u.id, 'papel', e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                      >
                        {PAPEIS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                    ) : (
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${PAPEL_COR[u.papel] ?? 'bg-gray-100 text-gray-700'}`}>
                        {PAPEIS.find(p => p.value === u.papel)?.label ?? u.papel}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {podeGerenciar && editandoId === u.id ? (
                      <select
                        value={u.gestorId ?? ''}
                        onChange={e => atualizarCampo(u.id, 'gestorId', e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                      >
                        <option value="">Sem gestor direto</option>
                        {usuarios.filter(x => x.id !== u.id).map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
                      </select>
                    ) : (
                      <span className="text-gray-500 text-xs">
                        {usuarios.find(x => x.id === u.gestorId)?.nome ?? '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${u.status === 'ATIVO' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.status === 'ATIVO' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  {podeGerenciar && (
                    <td className="px-4 py-3 text-right space-x-3">
                      <button
                        onClick={() => setEditandoId(editandoId === u.id ? null : u.id)}
                        className="text-xs text-gray-500 hover:text-blue-600"
                      >
                        {editandoId === u.id ? 'Concluir' : 'Editar'}
                      </button>
                      {u.id !== eu?.id && (
                        <button
                          onClick={() => toggleStatus(u.id, u.status ?? 'ATIVO')}
                          className="text-xs text-gray-500 hover:text-red-600"
                        >
                          {u.status === 'ATIVO' ? 'Desativar' : 'Reativar'}
                        </button>
                      )}
                      {u.email === 'consultorwandersonmmnegocios@gmail.com' && (
                        <button
                          onClick={importarHistoricoWanderson}
                          disabled={importando}
                          className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                        >
                          {importando ? 'Importando...' : 'Importar histórico'}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
