'use client'

// Respostas às campanhas: quem respondeu, o que disse, quando e por qual campanha. Cada pessoa vê as
// respostas das próprias campanhas; dono e supervisor escolhem de quem (seletor "Mostrando").
import { useCallback, useEffect, useState } from 'react'
import { disparoApi, type RespostaDisparo } from '@/lib/proLaboreApi'
import { Paginacao, dataHora, erroDe, n, useEscopo } from './util'

export function Respostas({ abrir }: { abrir: (campanhaId: string) => void }) {
  const { de } = useEscopo()
  const [dias, setDias] = useState(30)
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(0)
  const [d, setD] = useState<{ total: number; porPagina: number; itens: RespostaDisparo[] } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const carregar = useCallback((p: number) => {
    disparoApi.respostas({ dias, de, pagina: p, busca: busca.trim() || undefined }).then(r => { setD(r); setPagina(p); setErro(null) }).catch(e => setErro(erroDe(e)))
  }, [dias, de, busca])
  useEffect(() => { const t = setTimeout(() => carregar(0), 300); return () => clearTimeout(t) }, [carregar])
  return (
    <div data-disparo-respostas>
      <div className="dp-linha" style={{ justifyContent: 'space-between' }}>
        <span className="dp-linha">
          <span className="pl-hint">Período:</span>
          {[7, 30, 90].map(x => <button key={x} type="button" className={`pl-chip ${dias === x ? 'active' : ''}`} onClick={() => setDias(x)}>{x} dias</button>)}
        </span>
        <input className="pl-input" style={{ maxWidth: 240 }} placeholder="Buscar pelo nome" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar pelo nome" />
      </div>
      {erro && <div className="pl-alert pl-alert-error" role="alert">{erro}</div>}
      {!d ? <p className="pl-hint" aria-busy="true">Lendo as respostas…</p> : !d.itens.length ? (
        <div className="pl-empty pl-card"><h3 style={{ margin: 0 }}>Nenhuma resposta no período</h3><p>Quando alguém responder a uma campanha, aparece aqui e você recebe o aviso no WhatsApp.</p></div>
      ) : (
        <>
          <p className="pl-hint">{n(d.total)} pessoa(s) responderam. Responda pela conversa (WhatsApp ou Atendimento do Instagram); quem respondeu sai da sequência.</p>
          <ul className="ar-fila">
            {d.itens.map(r => (
              <li key={r.id} className="ar-fila-item" data-resposta={r.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="ar-fila-titulo">{r.nome ?? 'Contato'} <span className="pl-hint pl-mono">{r.contato}</span>{r.descadastrou && <span className="pl-status-badge" style={{ marginLeft: 6 }}>pediu para sair</span>}</div>
                  {r.resposta && <div className="dp-resposta">“{r.resposta}”</div>}
                  <div className="pl-hint">{dataHora(r.respondeuEm)} · campanha <button type="button" className="dp-link" onClick={() => abrir(r.campanha.id)}>{r.campanha.nome}</button>{r.campanha.canal === 'INSTAGRAM' ? ' · Instagram' : ''}{de !== 'minhas' && r.campanha.criadoPor ? ` · de ${r.campanha.criadoPor}` : ''}</div>
                </div>
                {r.leadId && <a className="pl-btn" href={`/pro-labore/leads?lead=${r.leadId}`}>Abrir o lead</a>}
              </li>
            ))}
          </ul>
          <Paginacao pagina={pagina} total={d.total} porPagina={d.porPagina} ir={carregar} />
        </>
      )}
    </div>
  )
}
