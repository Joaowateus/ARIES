'use client'

// Quem escreveu no WhatsApp do vendedor e não virou lead (contato antigo que
// não falou de compra). Só nome, número e quando — a conversa não é guardada.
// O vendedor decide: vira lead ou não é lead (sai da lista).
import { useEffect, useState } from 'react'
import { proLaboreApi, type ContatoForaDoCrm } from '@/lib/proLaboreApi'

const quando = (iso: string) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  return h < 24 ? `há ${h}h` : `há ${Math.round(h / 24)} dia(s)`
}

export function ForaDoCrm({ onFechar, onMudou }: { onFechar: () => void; onMudou: () => void }) {
  const [itens, setItens] = useState<ContatoForaDoCrm[] | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let cancelado = false
    proLaboreApi.leads.foraDoCrm().then(r => { if (!cancelado) setItens(r.itens) }).catch(e => { if (!cancelado) { setErro((e as Error).message); setItens([]) } })
    return () => { cancelado = true }
  }, [])

  async function decidir(item: ContatoForaDoCrm, acao: 'lead' | 'ignorar') {
    setOcupado(item.id)
    setErro('')
    try {
      if (acao === 'lead') await proLaboreApi.leads.foraDoCrmVirarLead(item.id)
      else await proLaboreApi.leads.foraDoCrmIgnorar(item.id)
      setItens(l => (l ?? []).filter(x => x.id !== item.id))
      onMudou()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setOcupado(null)
    }
  }

  return (
    <div className="pl-modal-backdrop" onClick={() => !ocupado && onFechar()}>
      <div className="pl-card pl-modal-panel" style={{ maxWidth: 560 }} role="dialog" aria-label="WhatsApp fora do CRM" onClick={e => e.stopPropagation()} data-fora-crm>
        <div className="pl-card-title" style={{ marginBottom: 4 }}>WhatsApp fora do CRM</div>
        <div className="pl-card-sub" style={{ marginBottom: 14 }}>
          Contatos que já conversavam com o vendedor e escreveram nos últimos 14 dias sem falar de compra. Todo contato novo, anúncio, frase de campanha ou conversa de compra já entra sozinho no CRM.
        </div>
        {!itens ? <div className="pl-hint">Carregando…</div> : itens.length === 0 ? (
          <div className="pl-hint" data-fora-crm-vazio>Nada pendente: todo mundo que escreveu está no CRM ou foi marcado como “não é lead”.</div>
        ) : (
          <ul className="pl-fc-lista">
            {itens.map(i => (
              <li key={i.id} data-fora-crm-item={i.telefone ?? i.id}>
                <div className="pl-fc-quem">
                  <b>{i.nome || i.telefone || 'Contato do WhatsApp'}</b>
                  <span>{[i.nome ? i.telefone : null, `${i.mensagens} mensage${i.mensagens === 1 ? 'm' : 'ns'}`, quando(i.ultimaEm), i.vendedor.nome].filter(Boolean).join(' · ')}</span>
                </div>
                <div className="pl-fc-acoes">
                  <button type="button" className="pl-btn pl-btn-primary" disabled={!!ocupado} onClick={() => decidir(i, 'lead')} data-virar-lead>Virar lead</button>
                  <button type="button" className="pl-btn pl-btn-ghost" disabled={!!ocupado} onClick={() => decidir(i, 'ignorar')} data-nao-e-lead>Não é lead</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 12 }}>{erro}</div>}
        <div className="pl-vt-rodape"><button type="button" className="pl-btn pl-btn-ghost" onClick={onFechar} disabled={!!ocupado}>Fechar</button></div>
      </div>
    </div>
  )
}
