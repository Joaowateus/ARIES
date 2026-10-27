'use client'

// Notas da negociação no painel do lead: o que foi combinado, o que o
// cliente pediu, o que falta. A mais nova em cima, com quem escreveu e
// quando. Ctrl+Enter salva. Só o autor (e o dono) edita ou apaga.
import { useEffect, useRef, useState } from 'react'
import { proLaboreApi, type NotaLead } from '@/lib/proLaboreApi'

const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
const editada = (n: NotaLead) => new Date(n.atualizadoEm).getTime() - new Date(n.criadoEm).getTime() > 1000
const salvarComAtalho = (fn: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); fn() }
}

export function NotasLead({ leadId, focar, podeEscrever, onContagem }: {
  leadId: string
  // Veio do botão "Notas" do card: rola até aqui e já abre o campo.
  focar: boolean
  podeEscrever: boolean
  onContagem: (n: number) => void
}) {
  const [notas, setNotas] = useState<NotaLead[] | null>(null)
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null)
  const secao = useRef<HTMLElement>(null)
  const campo = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let cancelado = false
    proLaboreApi.notasLead.doLead(leadId)
      .then(n => { if (!cancelado) setNotas(n) })
      .catch(e => { if (!cancelado) setErro((e as Error).message) })
    return () => { cancelado = true }
  }, [leadId])

  useEffect(() => {
    if (!focar) return
    secao.current?.scrollIntoView({ block: 'start' })
    campo.current?.focus()
  }, [focar])

  async function salvar() {
    const t = texto.trim()
    if (!t || salvando) return
    setSalvando(true); setErro('')
    try {
      const nova = await proLaboreApi.notasLead.criar(leadId, t)
      const lista = [nova, ...(notas ?? [])]
      setNotas(lista); setTexto(''); onContagem(lista.length)
    } catch (e) { setErro((e as Error).message) } finally { setSalvando(false) }
  }

  async function salvarEdicao() {
    if (!editando || !editando.texto.trim() || salvando) return
    setSalvando(true); setErro('')
    try {
      const nova = await proLaboreApi.notasLead.editar(editando.id, editando.texto.trim())
      setNotas(atual => (atual ?? []).map(n => (n.id === nova.id ? nova : n)))
      setEditando(null)
    } catch (e) { setErro((e as Error).message) } finally { setSalvando(false) }
  }

  async function apagar(n: NotaLead) {
    if (!confirm('Apagar esta nota?')) return
    setErro('')
    try {
      await proLaboreApi.notasLead.remover(n.id)
      const lista = (notas ?? []).filter(x => x.id !== n.id)
      setNotas(lista); onContagem(lista.length)
    } catch (e) { setErro((e as Error).message) }
  }

  return (
    <section className="pl-pn-bloco pl-pn-notas" ref={secao} data-notas-lead>
      <h3>Notas da negociação{notas && notas.length > 0 ? ` · ${notas.length}` : ''}</h3>
      {podeEscrever && (
        <div className="pl-pn-nota-nova">
          <textarea
            ref={campo} className="pl-input" rows={3} maxLength={4000}
            placeholder="O que foi combinado, o que o cliente pediu, o que falta…"
            value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={salvarComAtalho(() => void salvar())}
            aria-label="Nova nota da negociação" data-nota-campo
          />
          <div className="pl-pn-nota-barra">
            <span className="pl-hint">Ctrl + Enter salva</span>
            <button type="button" className="pl-btn pl-btn-primary" disabled={!texto.trim() || salvando} onClick={() => void salvar()} data-nota-salvar>
              {salvando && !editando ? 'Salvando…' : 'Salvar nota'}
            </button>
          </div>
        </div>
      )}
      {erro && <div className="pl-alert pl-alert-error" role="alert">{erro}</div>}
      {notas === null ? (
        !erro && <p className="pl-hint">Carregando as notas…</p>
      ) : notas.length === 0 ? (
        <p className="pl-hint">Nenhuma nota ainda.</p>
      ) : (
        <ol className="pl-pn-notas-lista">
          {notas.map(n => (
            <li key={n.id} data-nota={n.id}>
              <div className="pl-pn-nota-cab">
                <b>{n.autorNome ?? 'Equipe'}</b>
                <span>{dataHora(n.criadoEm)}{editada(n) ? ' · editada' : ''}</span>
              </div>
              {editando?.id === n.id ? (
                <>
                  <textarea
                    className="pl-input" rows={3} maxLength={4000} autoFocus
                    value={editando.texto} onChange={e => setEditando({ id: n.id, texto: e.target.value })}
                    onKeyDown={salvarComAtalho(() => void salvarEdicao())} aria-label="Editar nota"
                  />
                  <div className="pl-pn-nota-acoes">
                    <button type="button" className="pl-btn pl-btn-primary" disabled={!editando.texto.trim() || salvando} onClick={() => void salvarEdicao()}>Salvar</button>
                    <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setEditando(null)}>Cancelar</button>
                  </div>
                </>
              ) : (
                <p>{n.texto}</p>
              )}
              {podeEscrever && n.podeEditar && editando?.id !== n.id && (
                <div className="pl-pn-nota-acoes">
                  <button type="button" className="pl-link-action" onClick={() => setEditando({ id: n.id, texto: n.texto })}>Editar</button>
                  <button type="button" className="pl-link-action pl-danger" onClick={() => void apagar(n)}>Apagar</button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
