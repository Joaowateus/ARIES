'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  proLaboreApi, Reuniao, ReuniaoDetalhe, ReuniaoResumo, TIPOS_REUNIAO, TipoReuniao,
} from '@/lib/proLaboreApi'
import { PageHeader } from '../../PageHeader'

const TIPO_LABEL: Record<TipoReuniao, string> = { REUNIAO: 'Reunião', AULA: 'Aula', VIDEO: 'Vídeo', OUTRO: 'Outro' }

function formatarDuracao(segundos?: number | null): string | null {
  if (!segundos || segundos <= 0) return null
  const min = Math.floor(segundos / 60)
  const seg = Math.round(segundos % 60)
  if (min === 0) return `${seg}s`
  const h = Math.floor(min / 60)
  const minRestante = min % 60
  if (h > 0) return `${h}h${String(minRestante).padStart(2, '0')}`
  return `${min}min${String(seg).padStart(2, '0')}`
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Lê a duração de um arquivo de áudio/vídeo localmente, sem enviar os bytes
// pra lugar nenhum — só metadado, direto no navegador.
function lerDuracaoArquivo(file: File): Promise<number | null> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const elemento = document.createElement(file.type.startsWith('video') ? 'video' : 'audio')
    const limpar = () => URL.revokeObjectURL(url)
    elemento.preload = 'metadata'
    elemento.onloadedmetadata = () => { const d = elemento.duration; limpar(); resolve(Number.isFinite(d) ? d : null) }
    elemento.onerror = () => { limpar(); resolve(null) }
    elemento.src = url
  })
}

function FormNovaReuniao({ onCriada, onCancelar }: { onCriada: (r: Reuniao) => void; onCancelar: () => void }) {
  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState<TipoReuniao>('REUNIAO')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [duracaoSegundos, setDuracaoSegundos] = useState<number | null>(null)
  const [transcricao, setTranscricao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function selecionarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setArquivo(file)
    if (file) {
      if (!titulo) setTitulo(file.name.replace(/\.[^/.]+$/, ''))
      setDuracaoSegundos(await lerDuracaoArquivo(file))
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!titulo.trim()) { setErro('Dê um título pra reunião'); return }
    setSalvando(true)
    try {
      const reuniao = await proLaboreApi.reunioes.criar({
        titulo: titulo.trim(), tipo,
        duracaoSegundos: duracaoSegundos ?? undefined,
        nomeArquivoOriginal: arquivo?.name,
        transcricao: transcricao.trim() || undefined,
      })
      onCriada(reuniao)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={salvar} className="pl-card" style={{ marginBottom: 16 }}>
      <div className="pl-card-title" style={{ marginBottom: 12 }}>Nova reunião</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="pl-field">
          <label>Título</label>
          <input className="pl-input" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Call com fornecedor de motos" />
        </div>

        <div className="pl-field">
          <label>Tipo</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TIPOS_REUNIAO.map(t => (
              <button key={t} type="button" className={`pl-chip ${tipo === t ? 'active' : ''}`} onClick={() => setTipo(t)}>
                {TIPO_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="pl-field">
          <label>Arquivo de áudio/vídeo já gravado (opcional)</label>
          <input type="file" accept="audio/*,video/*" className="pl-input" onChange={selecionarArquivo} />
          {arquivo && (
            <span className="pl-hint">
              {arquivo.name}{duracaoSegundos ? ` — ${formatarDuracao(duracaoSegundos)}` : ''}
            </span>
          )}
        </div>

        <div className="pl-field">
          <label>Transcrição</label>
          <textarea
            className="pl-input pl-textarea"
            rows={6}
            value={transcricao}
            onChange={e => setTranscricao(e.target.value)}
            placeholder="Cole ou digite aqui o que foi conversado. A transcrição automática por IA ainda não está integrada — por enquanto esse texto é seu."
          />
          <span className="pl-hint">A transcrição automática por IA ainda depende de uma integração paga (ex: Whisper) que não está configurada. Por enquanto, escreva/cole aqui.</span>
        </div>

        {erro && <div className="pl-alert pl-alert-error">{erro}</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="pl-btn pl-btn-primary" disabled={salvando}>{salvando ? 'Salvando...' : 'Criar'}</button>
          <button type="button" className="pl-btn pl-btn-ghost" onClick={onCancelar}>Cancelar</button>
        </div>
      </div>
    </form>
  )
}

function PainelReuniao({ id, onExcluida }: { id: string; onExcluida: () => void }) {
  const [reuniao, setReuniao] = useState<ReuniaoDetalhe | null>(null)
  const [editandoTranscricao, setEditandoTranscricao] = useState(false)
  const [rascunhoTranscricao, setRascunhoTranscricao] = useState('')
  const [novaNota, setNovaNota] = useState('')

  const carregar = useCallback(() => { proLaboreApi.reunioes.obter(id).then(r => { setReuniao(r); setRascunhoTranscricao(r.transcricao ?? '') }) }, [id])
  useEffect(() => { carregar() }, [carregar])

  async function salvarTranscricao() {
    await proLaboreApi.reunioes.atualizar(id, { transcricao: rascunhoTranscricao })
    setEditandoTranscricao(false)
    carregar()
  }

  async function adicionarNota(e: React.FormEvent) {
    e.preventDefault()
    if (!novaNota.trim()) return
    await proLaboreApi.notas.criar({ conteudo: novaNota.trim(), reuniaoId: id })
    setNovaNota('')
    carregar()
  }

  async function excluir() {
    if (!confirm('Excluir essa reunião e o vínculo das notas associadas?')) return
    await proLaboreApi.reunioes.excluir(id)
    onExcluida()
  }

  if (!reuniao) return <div className="pl-card"><div className="pl-hint">Carregando...</div></div>

  return (
    <div className="pl-card">
      <div className="pl-card-head">
        <div>
          <div className="pl-card-title">{reuniao.titulo}</div>
          <div className="pl-card-sub">{TIPO_LABEL[reuniao.tipo]} · {formatarData(reuniao.data)}{formatarDuracao(reuniao.duracaoSegundos) ? ` · ${formatarDuracao(reuniao.duracaoSegundos)}` : ''}</div>
        </div>
        <button type="button" className="pl-btn pl-btn-ghost" onClick={excluir}>Excluir</button>
      </div>

      <div className="pl-plano-secao-titulo">Transcrição</div>
      {editandoTranscricao ? (
        <>
          <textarea className="pl-input pl-textarea" rows={10} value={rascunhoTranscricao} onChange={e => setRascunhoTranscricao(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" className="pl-btn pl-btn-primary" onClick={salvarTranscricao}>Salvar</button>
            <button type="button" className="pl-btn pl-btn-ghost" onClick={() => { setEditandoTranscricao(false); setRascunhoTranscricao(reuniao.transcricao ?? '') }}>Cancelar</button>
          </div>
        </>
      ) : (
        <div onClick={() => setEditandoTranscricao(true)} style={{ cursor: 'text', whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.6, color: reuniao.transcricao ? 'var(--pl-ink-2)' : 'var(--pl-ink-muted)', minHeight: 60 }}>
          {reuniao.transcricao || 'Sem transcrição ainda — clique aqui pra escrever.'}
        </div>
      )}

      <div className="pl-plano-secao-titulo" style={{ marginTop: 20 }}>Notas dessa reunião</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
        {reuniao.notas.length === 0 && <div className="pl-hint">Nenhuma nota ainda.</div>}
        {reuniao.notas.map(n => (
          <div key={n.id} className="pl-card" style={{ padding: '10px 14px' }}>
            <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', color: 'var(--pl-ink-2)' }}>{n.conteudo}</div>
          </div>
        ))}
      </div>
      <form onSubmit={adicionarNota} style={{ display: 'flex', gap: 8 }}>
        <input className="pl-input" placeholder="Adicionar uma nota..." value={novaNota} onChange={e => setNovaNota(e.target.value)} />
        <button type="submit" className="pl-btn pl-btn-ghost">Adicionar</button>
      </form>
    </div>
  )
}

function AbaReunioes() {
  const [reunioes, setReunioes] = useState<ReuniaoResumo[]>([])
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(() => {
    proLaboreApi.reunioes.listar().then(rs => {
      setReunioes(rs)
      setSelecionadaId(atual => atual ?? rs[0]?.id ?? null)
    }).finally(() => setCarregando(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  return (
    <div className="pl-grid-2">
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          {!mostrarForm && <button type="button" className="pl-btn pl-btn-primary" onClick={() => setMostrarForm(true)}>Nova reunião</button>}
        </div>
        {mostrarForm && (
          <FormNovaReuniao
            onCriada={r => { setMostrarForm(false); setSelecionadaId(r.id); carregar() }}
            onCancelar={() => setMostrarForm(false)}
          />
        )}
        <div className="pl-card" style={{ padding: '14px 10px' }}>
          {carregando && <div className="pl-hint">Carregando...</div>}
          {!carregando && reunioes.length === 0 && (
            <div className="pl-empty">
              <div className="pl-emoji">🎙️</div>
              Nenhuma reunião registrada ainda.
            </div>
          )}
          <div className="pl-chat-list">
            {reunioes.map(r => (
              <button key={r.id} type="button" className={`pl-chat-item ${selecionadaId === r.id ? 'active' : ''}`} onClick={() => setSelecionadaId(r.id)}>
                <div className="pl-chat-item-body">
                  <div className="pl-chat-item-top">
                    <span className="pl-chat-item-name">{r.titulo}</span>
                    <span className="pl-chat-item-time">{formatarData(r.data)}</span>
                  </div>
                  <div className="pl-chat-item-snippet">
                    {TIPO_LABEL[r.tipo]}{formatarDuracao(r.duracaoSegundos) ? ` · ${formatarDuracao(r.duracaoSegundos)}` : ''}{r.quantidadeNotas > 0 ? ` · ${r.quantidadeNotas} nota${r.quantidadeNotas > 1 ? 's' : ''}` : ''}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        {selecionadaId ? (
          <PainelReuniao key={selecionadaId} id={selecionadaId} onExcluida={() => { setSelecionadaId(null); carregar() }} />
        ) : (
          <div className="pl-card"><div className="pl-empty">Selecione uma reunião pra ver os detalhes.</div></div>
        )}
      </div>
    </div>
  )
}

export default function ProLaboreReunioesPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Operação"
        title="Reuniões"
        subtitle="Registro pessoal de reuniões, aulas e vídeos, com transcrição — privado, só você vê"
      />

      <AbaReunioes />
    </div>
  )
}
