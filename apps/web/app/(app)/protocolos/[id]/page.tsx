'use client'

import { useEffect, useState, useCallback, use } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import {
  api,
  ProtocoloDetalhe,
  ProtocoloCadencia,
} from '@/lib/api'

const PAPEIS_GESTAO = ['ADMINISTRADOR', 'DIRETOR_COMERCIAL', 'GERENTE_COMERCIAL']

const STATUS_NC_COR: Record<string, string> = {
  ABERTA: 'bg-red-100 text-red-700',
  EM_TRATAMENTO: 'bg-amber-100 text-amber-700',
  RESOLVIDA: 'bg-green-100 text-green-700',
}
const STATUS_PA_COR: Record<string, string> = {
  PENDENTE: 'bg-gray-100 text-gray-600',
  EM_ANDAMENTO: 'bg-blue-100 text-blue-700',
  CONCLUIDO: 'bg-green-100 text-green-700',
  ATRASADO: 'bg-red-100 text-red-700',
}
const STATUS_M_COR: Record<string, string> = {
  ABERTA: 'bg-gray-100 text-gray-600',
  EM_ANALISE: 'bg-blue-100 text-blue-700',
  IMPLEMENTADA: 'bg-green-100 text-green-700',
  DESCARTADA: 'bg-gray-100 text-gray-400',
}

function Secao({ titulo, nivel, children }: { titulo: string; nivel: string; children: React.ReactNode }) {
  return (
    <section id={nivel} className="bg-white rounded-xl border border-gray-200 p-5 mb-4 scroll-mt-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{nivel}</span>
        <h2 className="font-semibold text-gray-900 text-sm">{titulo}</h2>
      </div>
      {children}
    </section>
  )
}

function Lista({ itens }: { itens?: string[] }) {
  if (!itens || itens.length === 0) return <p className="text-xs text-gray-400">—</p>
  return (
    <ul className="space-y-1.5">
      {itens.map((it, i) => (
        <li key={i} className="text-sm text-gray-700 flex gap-2">
          <span className="text-gray-300">•</span><span>{it}</span>
        </li>
      ))}
    </ul>
  )
}

function ChaveValor({ dados }: { dados?: ProtocoloCadencia[] }) {
  if (!dados || dados.length === 0) return <p className="text-xs text-gray-400">—</p>
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {dados.map((par, i) => (
        <div key={i} className="bg-gray-50 rounded-lg p-3">
          <dt className="text-xs font-semibold text-gray-500">{par.chave}</dt>
          <dd className="text-sm text-gray-700 mt-0.5">{par.valor}</dd>
        </div>
      ))}
    </dl>
  )
}

function ParesItemPrazo({ pares }: { pares?: { item: string; prazo: string }[] }) {
  if (!pares || pares.length === 0) return <p className="text-xs text-gray-400">—</p>
  return (
    <div className="space-y-2">
      {pares.map((p, i) => (
        <div key={i} className="flex justify-between text-sm border-b border-gray-100 pb-2 last:border-0">
          <span className="text-gray-700">{p.item}</span>
          <span className="font-medium text-gray-900">{p.prazo}</span>
        </div>
      ))}
    </div>
  )
}

function ParesKpi({ pares }: { pares?: { categoria: string; indicador: string }[] }) {
  if (!pares || pares.length === 0) return <p className="text-xs text-gray-400">—</p>
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {pares.map((p, i) => (
        <div key={i} className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs font-semibold text-blue-600">{p.categoria}</div>
          <div className="text-sm text-gray-700">{p.indicador}</div>
        </div>
      ))}
    </div>
  )
}

function ParesContingencia({ pares }: { pares?: { cenario: string; acao: string }[] }) {
  if (!pares || pares.length === 0) return <p className="text-xs text-gray-400">—</p>
  return (
    <div className="space-y-3">
      {pares.map((p, i) => (
        <div key={i} className="border border-gray-100 rounded-lg p-3">
          <div className="text-xs font-semibold text-gray-500 mb-1">SE: {p.cenario}</div>
          <div className="text-sm text-gray-800">ENTÃO: {p.acao}</div>
        </div>
      ))}
    </div>
  )
}

export default function ProtocoloDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user } = useAuth()
  const podeGerir = !!user && PAPEIS_GESTAO.includes(user.papel)

  const [protocolo, setProtocolo] = useState<ProtocoloDetalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState<'auditoria' | 'nc' | 'pa' | 'melhoria'>('auditoria')

  const carregar = useCallback(() => {
    api.protocolos.detalhe(id).then(setProtocolo).finally(() => setLoading(false))
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  if (loading) return <div className="p-8 text-sm text-gray-400">Carregando protocolo...</div>
  if (!protocolo) return <div className="p-8 text-sm text-red-600">Protocolo não encontrado.</div>

  const p = protocolo

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/protocolos" className="text-xs text-gray-400 hover:text-gray-700">← Voltar para Protocolos</Link>
      <div className="flex items-start justify-between mt-2 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{p.nome}</h1>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
            <span className="bg-gray-100 px-2 py-0.5 rounded">{p.categoria}</span>
            <span>v{p.versao}</span>
            <span className="capitalize">{p.status.replace('_', ' ')}</span>
            {p.criadoPor && <span>· criado por {p.criadoPor.nome}</span>}
          </div>
        </div>
        {podeGerir && (
          <Link href={`/protocolos/${p.id}/editar`}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1.5">
            Editar
          </Link>
        )}
      </div>

      <Secao titulo="Identidade do Processo" nivel="Nível 1">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1">Objetivo</div>
            <p className="text-sm text-gray-700">{p.objetivo || '—'}</p>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1">Resultado Esperado</div>
            <Lista itens={p.resultadoEsperado} />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1">Responsáveis</div>
            <Lista itens={p.responsaveis} />
          </div>
        </div>
      </Secao>

      <Secao titulo="Estrutura Operacional" nivel="Nível 2">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-2">Processo (fluxo macro)</div>
            <ol className="space-y-1.5">
              {(p.processo ?? []).map((step, i) => (
                <li key={i} className="text-sm text-gray-700 flex gap-2">
                  <span className="text-gray-300 font-mono text-xs mt-0.5">{i + 1}.</span><span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-2">POP — Procedimento Operacional Padrão</div>
            <div className="space-y-3">
              {(p.pop ?? []).map((etapa, i) => (
                <div key={i} className="border border-gray-100 rounded-lg p-3">
                  <div className="text-sm font-medium text-gray-900">{etapa.titulo}</div>
                  {etapa.descricao && <p className="text-sm text-gray-600 mt-1">{etapa.descricao}</p>}
                  {etapa.checklist && etapa.checklist.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {etapa.checklist.map((c, j) => (
                        <li key={j} className="text-xs text-gray-600 flex gap-1.5">
                          <span>☐</span><span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1">Regras Obrigatórias</div>
            <Lista itens={p.regras} />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1">Ferramentas</div>
            <div className="flex flex-wrap gap-1.5">
              {(p.ferramentas ?? []).map((f, i) => (
                <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{f}</span>
              ))}
            </div>
          </div>
        </div>
      </Secao>

      <Secao titulo="Gestão de Execução" nivel="Nível 3">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-2">Rotina</div>
            <ChaveValor dados={p.rotina} />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-2">SLA</div>
            <ParesItemPrazo pares={p.sla} />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-2">KPIs</div>
            <ParesKpi pares={p.kpis} />
          </div>
        </div>
      </Secao>

      <Secao titulo="Controle e Auditoria" nivel="Nível 4">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1">O que verificar</div>
            <Lista itens={p.auditoriaItens} />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1">Frequência de Auditoria</div>
            <p className="text-sm text-gray-700">{p.frequenciaAuditoria || '—'}</p>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1">Critérios de Conformidade</div>
            <Lista itens={p.criteriosConformidade} />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1">Catálogo de Não Conformidades</div>
            <Lista itens={p.naoConformidadesCatalogo} />
          </div>
        </div>
      </Secao>

      <Secao titulo="Gestão" nivel="Nível 5">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-2">Reuniões</div>
            <ChaveValor dados={p.reunioes} />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1">Perguntas Obrigatórias de Análise</div>
            <Lista itens={p.perguntasAnalise} />
          </div>
        </div>
      </Secao>

      <Secao titulo="Risco e Contingência" nivel="Nível 6">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1">Riscos</div>
            <Lista itens={p.riscos} />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-2">Plano de Contingência</div>
            <ParesContingencia pares={p.planoContingencia} />
          </div>
        </div>
      </Secao>

      <Secao titulo="Melhoria Contínua" nivel="Nível 7">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1">Notas de Melhoria</div>
            <Lista itens={p.oportunidadesMelhoriaNotas} />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1">Automações Possíveis</div>
            <Lista itens={p.automacoesPossiveis} />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1">IA Aplicável</div>
            <Lista itens={p.iaAplicavel} />
          </div>
          <div className="flex gap-6">
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-1">Frequência de Revisão</div>
              <p className="text-sm text-gray-700">{p.revisaoFrequencia || '—'}</p>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-1">Responsável pela Revisão</div>
              <p className="text-sm text-gray-700">{p.revisaoResponsavel || '—'}</p>
            </div>
          </div>
        </div>
      </Secao>

      {p.anexos && p.anexos.length > 0 && (
        <Secao titulo="Anexos e Checklists" nivel="Anexo">
          <div className="space-y-4">
            {p.anexos.map((a, i) => (
              <div key={i}>
                <div className="text-xs font-semibold text-gray-500 mb-2">{a.titulo}</div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {a.itens.map((it, j) => (
                    <li key={j} className="text-sm text-gray-700 flex gap-1.5">
                      <span>☐</span><span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Secao>
      )}

      {/* Registros vivos */}
      <div className="mt-8">
        <h2 className="text-sm font-bold text-gray-900 mb-3">Registros de Execução</h2>
        <div className="flex gap-2 mb-4 border-b border-gray-200">
          {([
            ['auditoria', `Auditorias (${p.auditorias.length})`],
            ['nc', `Não Conformidades (${p.naoConformidades.length})`],
            ['pa', `Planos de Ação (${p.planosAcao.length})`],
            ['melhoria', `Melhorias (${p.melhorias.length})`],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setAba(key)}
              className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                aba === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {aba === 'auditoria' && <AbaAuditorias protocoloId={p.id} auditorias={p.auditorias} onAtualizado={carregar} />}
        {aba === 'nc' && <AbaNaoConformidades protocoloId={p.id} lista={p.naoConformidades} catalogo={p.naoConformidadesCatalogo} onAtualizado={carregar} />}
        {aba === 'pa' && <AbaPlanosAcao protocoloId={p.id} lista={p.planosAcao} naoConformidades={p.naoConformidades} onAtualizado={carregar} />}
        {aba === 'melhoria' && <AbaMelhorias protocoloId={p.id} lista={p.melhorias} onAtualizado={carregar} />}
      </div>
    </div>
  )
}

function AbaAuditorias({ protocoloId, auditorias, onAtualizado }: {
  protocoloId: string
  auditorias: ProtocoloDetalhe['auditorias']
  onAtualizado: () => void
}) {
  const [mostrarForm, setMostrarForm] = useState(false)
  const [conforme, setConforme] = useState(true)
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    try {
      await api.protocolos.registrarAuditoria(protocoloId, { conforme, observacoes: observacoes || undefined })
      setObservacoes('')
      setMostrarForm(false)
      onAtualizado()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div>
      <button onClick={() => setMostrarForm(s => !s)}
        className="text-xs font-medium text-blue-600 hover:text-blue-800 mb-3">
        {mostrarForm ? 'Cancelar' : '+ Registrar Auditoria'}
      </button>
      {mostrarForm && (
        <form onSubmit={salvar} className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={conforme} onChange={() => setConforme(true)} /> Conforme
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={!conforme} onChange={() => setConforme(false)} /> Não conforme
            </label>
          </div>
          <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Observações (opcional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" rows={2} />
          <button type="submit" disabled={salvando}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {salvando ? 'Salvando...' : 'Registrar'}
          </button>
        </form>
      )}
      {auditorias.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhuma auditoria registrada ainda.</p>
      ) : (
        <div className="space-y-2">
          {auditorias.map(a => (
            <div key={a.id} className="bg-white rounded-lg border border-gray-200 p-3 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-800">{new Date(a.data).toLocaleString('pt-BR')}</div>
                {a.observacoes && <div className="text-xs text-gray-500 mt-0.5">{a.observacoes}</div>}
                {a.responsavel && <div className="text-xs text-gray-400 mt-0.5">Responsável: {a.responsavel.nome}</div>}
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${a.conforme ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {a.conforme ? 'Conforme' : 'Não conforme'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AbaNaoConformidades({ protocoloId, lista, catalogo, onAtualizado }: {
  protocoloId: string
  lista: ProtocoloDetalhe['naoConformidades']
  catalogo?: string[]
  onAtualizado: () => void
}) {
  const [mostrarForm, setMostrarForm] = useState(false)
  const [tipo, setTipo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!tipo) return
    setSalvando(true)
    try {
      await api.protocolos.registrarNaoConformidade(protocoloId, { tipo, descricao: descricao || undefined })
      setTipo(''); setDescricao(''); setMostrarForm(false)
      onAtualizado()
    } finally {
      setSalvando(false)
    }
  }

  async function mudarStatus(ncId: string, status: string) {
    await api.protocolos.atualizarNaoConformidade(protocoloId, ncId, status)
    onAtualizado()
  }

  return (
    <div>
      <button onClick={() => setMostrarForm(s => !s)} className="text-xs font-medium text-blue-600 hover:text-blue-800 mb-3">
        {mostrarForm ? 'Cancelar' : '+ Registrar Não Conformidade'}
      </button>
      {mostrarForm && (
        <form onSubmit={salvar} className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo (do catálogo do protocolo, ou descreva o novo)</label>
            <input list="catalogo-nc" value={tipo} onChange={e => setTipo(e.target.value)} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <datalist id="catalogo-nc">
              {(catalogo ?? []).map((c, i) => <option key={i} value={c} />)}
            </datalist>
          </div>
          <textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição (opcional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" rows={2} />
          <button type="submit" disabled={salvando}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {salvando ? 'Salvando...' : 'Registrar'}
          </button>
        </form>
      )}
      {lista.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhuma não conformidade registrada.</p>
      ) : (
        <div className="space-y-2">
          {lista.map(nc => (
            <div key={nc.id} className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-900">{nc.tipo}</div>
                <select value={nc.status} onChange={e => mudarStatus(nc.id, e.target.value)}
                  className={`text-xs font-medium px-2 py-0.5 rounded border-0 ${STATUS_NC_COR[nc.status]}`}>
                  <option value="ABERTA">Aberta</option>
                  <option value="EM_TRATAMENTO">Em tratamento</option>
                  <option value="RESOLVIDA">Resolvida</option>
                </select>
              </div>
              {nc.descricao && <p className="text-xs text-gray-500 mt-1">{nc.descricao}</p>}
              <div className="text-xs text-gray-400 mt-1">{new Date(nc.data).toLocaleDateString('pt-BR')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AbaPlanosAcao({ protocoloId, lista, naoConformidades, onAtualizado }: {
  protocoloId: string
  lista: ProtocoloDetalhe['planosAcao']
  naoConformidades: ProtocoloDetalhe['naoConformidades']
  onAtualizado: () => void
}) {
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState({ problema: '', causa: '', solucao: '', prazo: '', naoConformidadeId: '' })
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.problema) return
    setSalvando(true)
    try {
      await api.protocolos.registrarPlanoAcao(protocoloId, {
        problema: form.problema,
        causa: form.causa || undefined,
        solucao: form.solucao || undefined,
        prazo: form.prazo || undefined,
        naoConformidadeId: form.naoConformidadeId || undefined,
      })
      setForm({ problema: '', causa: '', solucao: '', prazo: '', naoConformidadeId: '' })
      setMostrarForm(false)
      onAtualizado()
    } finally {
      setSalvando(false)
    }
  }

  async function mudarStatus(planoId: string, status: string) {
    await api.protocolos.atualizarPlanoAcao(protocoloId, planoId, { status })
    onAtualizado()
  }

  return (
    <div>
      <button onClick={() => setMostrarForm(s => !s)} className="text-xs font-medium text-blue-600 hover:text-blue-800 mb-3">
        {mostrarForm ? 'Cancelar' : '+ Novo Plano de Ação'}
      </button>
      {mostrarForm && (
        <form onSubmit={salvar} className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
          <input value={form.problema} onChange={e => setForm(f => ({ ...f, problema: e.target.value }))} placeholder="Problema" required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input value={form.causa} onChange={e => setForm(f => ({ ...f, causa: e.target.value }))} placeholder="Causa"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input value={form.solucao} onChange={e => setForm(f => ({ ...f, solucao: e.target.value }))} placeholder="Solução"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <div className="flex gap-3">
            <input type="date" value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            {naoConformidades.length > 0 && (
              <select value={form.naoConformidadeId} onChange={e => setForm(f => ({ ...f, naoConformidadeId: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">Vincular a uma não conformidade (opcional)</option>
                {naoConformidades.map(nc => <option key={nc.id} value={nc.id}>{nc.tipo}</option>)}
              </select>
            )}
          </div>
          <button type="submit" disabled={salvando}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {salvando ? 'Salvando...' : 'Registrar'}
          </button>
        </form>
      )}
      {lista.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhum plano de ação registrado.</p>
      ) : (
        <div className="space-y-2">
          {lista.map(pa => (
            <div key={pa.id} className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-900">{pa.problema}</div>
                <select value={pa.status} onChange={e => mudarStatus(pa.id, e.target.value)}
                  className={`text-xs font-medium px-2 py-0.5 rounded border-0 ${STATUS_PA_COR[pa.status]}`}>
                  <option value="PENDENTE">Pendente</option>
                  <option value="EM_ANDAMENTO">Em andamento</option>
                  <option value="CONCLUIDO">Concluído</option>
                  <option value="ATRASADO">Atrasado</option>
                </select>
              </div>
              {pa.causa && <p className="text-xs text-gray-500 mt-1">Causa: {pa.causa}</p>}
              {pa.solucao && <p className="text-xs text-gray-500">Solução: {pa.solucao}</p>}
              <div className="text-xs text-gray-400 mt-1">
                {pa.responsavel && `Responsável: ${pa.responsavel.nome} · `}
                {pa.prazo && `Prazo: ${new Date(pa.prazo).toLocaleDateString('pt-BR')}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AbaMelhorias({ protocoloId, lista, onAtualizado }: {
  protocoloId: string
  lista: ProtocoloDetalhe['melhorias']
  onAtualizado: () => void
}) {
  const [descricao, setDescricao] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!descricao) return
    setSalvando(true)
    try {
      await api.protocolos.registrarMelhoria(protocoloId, descricao)
      setDescricao('')
      onAtualizado()
    } finally {
      setSalvando(false)
    }
  }

  async function mudarStatus(melhoriaId: string, status: string) {
    await api.protocolos.atualizarMelhoria(protocoloId, melhoriaId, status)
    onAtualizado()
  }

  return (
    <div>
      <form onSubmit={salvar} className="flex gap-2 mb-4">
        <input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Nova oportunidade de melhoria"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        <button type="submit" disabled={salvando}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          Adicionar
        </button>
      </form>
      {lista.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhuma melhoria registrada.</p>
      ) : (
        <div className="space-y-2">
          {lista.map(m => (
            <div key={m.id} className="bg-white rounded-lg border border-gray-200 p-3 flex items-center justify-between">
              <div className="text-sm text-gray-800">{m.descricao}</div>
              <select value={m.status} onChange={e => mudarStatus(m.id, e.target.value)}
                className={`text-xs font-medium px-2 py-0.5 rounded border-0 ${STATUS_M_COR[m.status]}`}>
                <option value="ABERTA">Aberta</option>
                <option value="EM_ANALISE">Em análise</option>
                <option value="IMPLEMENTADA">Implementada</option>
                <option value="DESCARTADA">Descartada</option>
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
