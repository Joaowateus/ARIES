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

function formatDias(dias: number): string {
  const arredondado = Math.round(dias * 10) / 10
  return `${arredondado}d`
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  const primeiras = partes[0]?.[0] ?? ''
  const ultimas = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (primeiras + ultimas).toUpperCase()
}

function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

interface EtapaComDuracao {
  id: string
  estagioAnterior: string | null
  estagioNovo: string
  criadoEm: string
  dias: number
  atual: boolean
}

/** Histórico já vem do backend ordenado do mais recente pro mais antigo.
 * Duração em cada etapa = tempo entre entrar nela e sair pra próxima (ou,
 * pra etapa atual, entre entrar e agora). */
function comDuracao(historico: { id: string; estagioAnterior: string | null; estagioNovo: string; criadoEm: string }[]): EtapaComDuracao[] {
  return historico.map((h, i) => {
    const inicio = new Date(h.criadoEm).getTime()
    const fim = i === 0 ? Date.now() : new Date(historico[i - 1].criadoEm).getTime()
    return { ...h, dias: (fim - inicio) / (24 * 60 * 60 * 1000), atual: i === 0 }
  })
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

      {/* Identificação */}
      <div className="flex items-start justify-between mt-2 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-lg shrink-0">
            {iniciais(op.nomeCliente)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{op.nomeCliente}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ESTAGIO_COR[op.estagio]}`}>
                {ESTAGIO_LABEL[op.estagio] ?? op.estagio}
              </span>
              {op.tipoLead && (
                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                  op.tipoLead === 'TRAFEGO' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                }`}>
                  {op.tipoLead === 'TRAFEGO' ? 'Tráfego pago' : 'Orgânico'}
                </span>
              )}
              {op.campanhaTrafego && (
                <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                  📶 {op.campanhaTrafego}
                </span>
              )}
              {op.diasNaEtapaAtual != null && (
                <span className="text-xs text-gray-400">⏱ {formatDias(op.diasNaEtapaAtual)} nesta etapa</span>
              )}
            </div>
          </div>
        </div>
        {op.valor && <div className="text-lg font-semibold text-green-700">{formatMoeda(op.valor)}</div>}
      </div>

      {/* Contato rápido — ações reais e clicáveis */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {op.telefone && (
          <a href={`tel:${somenteDigitos(op.telefone)}`}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50">
            📞 Ligar
          </a>
        )}
        {op.telefone && (
          <a href={`https://wa.me/55${somenteDigitos(op.telefone)}`} target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 border border-green-200 text-green-700 hover:bg-green-100">
            💬 WhatsApp
          </a>
        )}
        {op.email && (
          <a href={`mailto:${op.email}`}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50">
            ✉️ E-mail
          </a>
        )}
        {!op.telefone && !op.email && (
          <span className="text-xs text-gray-400">Sem telefone ou e-mail cadastrado</span>
        )}
      </div>

      {/* Pipeline de vendas — maior destaque do card */}
      <div className="rounded-xl border-2 border-blue-200 bg-blue-50/40 p-4 mb-6">
        <div className="text-xs font-medium text-blue-700 mb-2">Pipeline de vendas</div>
        <div className="flex items-center gap-1 flex-wrap mb-3">
          {ETAPAS_FUNIL_ORDEM.map((e, i) => (
            <span key={e} className="flex items-center">
              <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                e === op.estagio ? 'bg-blue-600 text-white' : 'bg-white text-gray-400 border border-gray-200'
              }`}>
                {ESTAGIO_LABEL[e]}
              </span>
              {i < ETAPAS_FUNIL_ORDEM.length - 1 && <span className="text-gray-300 mx-0.5">›</span>}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs text-gray-600 mb-3">
          <div><span className="text-gray-400">Moto de interesse:</span> {op.unidade?.nome ?? '—'}</div>
          <div><span className="text-gray-400">Origem:</span> {op.origem}</div>
          <div><span className="text-gray-400">Responsável:</span> {op.responsavel?.nome ?? '—'}</div>
        </div>
        {!['COMPRADO', 'PERDIDO'].includes(op.estagio) && (
          <div className="flex gap-2 flex-wrap pt-2 border-t border-blue-100">
            {ETAPAS_FUNIL_ORDEM.filter(e => e !== op.estagio).map(e => (
              <button key={e} onClick={() => mover(e)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-300 text-gray-600 hover:bg-gray-50">
                Mover p/ {ESTAGIO_LABEL[e]}
              </button>
            ))}
            <button onClick={() => mover('PERDIDO')}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-red-200 text-red-600 hover:bg-red-50">
              Marcar como perdido
            </button>
          </div>
        )}
      </div>

      {/* Relacionamento */}
      <div className={`rounded-xl border p-4 mb-6 ${atrasado ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
        <div className="grid grid-cols-3 gap-3 text-xs text-gray-600 mb-3">
          <div><span className="text-gray-400">Cliente desde:</span> {formatData(op.criadaEm)}</div>
          <div><span className="text-gray-400">Última interação:</span> {formatData(op.ultimaInteracaoEm)}</div>
          <div><span className="text-gray-400">Interações:</span> {op.atividades.length}</div>
        </div>
        <div className="text-xs font-medium text-gray-500 mb-1">Próxima ação {atrasado && '— atrasada'}</div>
        <div className="text-sm text-gray-900">{op.proximaAcaoDescricao || 'Nenhuma ação agendada'}</div>
        {op.proximaAcaoEm && <div className="text-xs text-gray-500 mt-0.5">{formatData(op.proximaAcaoEm)}</div>}
      </div>

      {/* Observações */}
      {(op.observacoes || op.atividades.length > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="text-xs font-medium text-gray-500 mb-1">Observações</div>
          {op.observacoes && <div className="text-sm text-gray-800 mb-2">{op.observacoes}</div>}
          {op.atividades[0] && (
            <div className="text-xs text-gray-400">
              Última nota: "{op.atividades[0].descricao}"{op.atividades[0].usuario ? ` — ${op.atividades[0].usuario.nome}` : ''} em {formatData(op.atividades[0].criadoEm)}
            </div>
          )}
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

      {/* Jornada — registro de quando o card avançou pra cada etapa, e quanto
          tempo ele ficou em cada uma. */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="font-semibold text-gray-900 text-sm mb-3">Jornada do Cliente</h2>
        {op.historicoEstagio.length === 0 ? (
          <p className="text-sm text-gray-400">Sem registro de etapas ainda.</p>
        ) : (
          <div className="space-y-3">
            {comDuracao(op.historicoEstagio).map(h => (
              <div key={h.id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2 last:border-0">
                <div>
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ESTAGIO_COR[h.estagioNovo] ?? 'bg-gray-100 text-gray-600'}`}>
                    {ESTAGIO_LABEL[h.estagioNovo] ?? h.estagioNovo}
                  </span>
                  <span className="text-xs text-gray-400 ml-2">{formatData(h.criadoEm)}</span>
                </div>
                <span className={`text-xs ${h.atual ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                  {h.atual ? `há ${formatDias(h.dias)}, ainda aqui` : `ficou ${formatDias(h.dias)}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Interações */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 text-sm mb-3">Interações</h2>
        {op.atividades.length === 0 ? (
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
