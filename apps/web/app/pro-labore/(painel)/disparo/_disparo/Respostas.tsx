'use client'

// Respostas às campanhas: quem respondeu, o que disse, quando e por qual campanha. Cada pessoa vê as
// respostas das próprias campanhas; dono e supervisor escolhem de quem (seletor "Mostrando").
// Redesign 26/11: caixa de entrada em dois painéis (lista e detalhe). Os mesmos dados e ações.
import { useCallback, useEffect, useState } from 'react'
import { disparoApi, type RespostaDisparo } from '@/lib/proLaboreApi'
import { Paginacao, dataHora, erroDe, n, useEscopo } from './util'
import { Quando, Segmentado } from './ui'

const iniciais = (nome: string | null) => (nome ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?'

export function Respostas({ abrir }: { abrir: (campanhaId: string) => void }) {
  const { de } = useEscopo()
  const [dias, setDias] = useState(30)
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(0)
  const [d, setD] = useState<{ total: number; porPagina: number; itens: RespostaDisparo[] } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [detalheMovel, setDetalheMovel] = useState(false)
  const carregar = useCallback((p: number) => {
    disparoApi.respostas({ dias, de, pagina: p, busca: busca.trim() || undefined }).then(r => { setD(r); setPagina(p); setErro(null) }).catch(e => setErro(erroDe(e)))
  }, [dias, de, busca])
  useEffect(() => { const t = setTimeout(() => carregar(0), 300); return () => clearTimeout(t) }, [carregar])
  const atual = d?.itens.find(r => r.id === sel) ?? d?.itens[0] ?? null

  return (
    <div data-disparo-respostas>
      <div className="dp-ferramentas">
        <Segmentado rotulo="Período" pequeno valor={dias} mudar={setDias} opcoes={[7, 30, 90].map(x => ({ valor: x, rotulo: `${x} dias` }))} />
        {d && <span className="pl-hint">{n(d.total)} pessoa(s) responderam</span>}
        <input className="pl-input dp-busca" type="search" placeholder="Buscar pelo nome" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar pelo nome" />
      </div>
      {erro && <div className="pl-alert pl-alert-error" role="alert">{erro}</div>}
      {!d ? <p className="pl-hint" aria-busy="true">Lendo as respostas…</p> : !d.itens.length ? (
        <div className="pl-card dp-vazio-grande"><h3>Nenhuma resposta no período</h3><p className="pl-hint">Quando alguém responder a uma campanha, aparece aqui e você recebe o aviso no WhatsApp.</p></div>
      ) : (
        <div className={`pl-card dp-caixa ${detalheMovel ? 'detalhe' : ''}`}>
          <div className="dp-caixa-lista">
            <ul role="listbox" aria-label="Respostas">
              {d.itens.map(r => (
                <li key={r.id}>
                  <button type="button" role="option" aria-selected={atual?.id === r.id} className={atual?.id === r.id ? 'on' : ''} onClick={() => { setSel(r.id); setDetalheMovel(true) }} data-resposta={r.id}>
                    <span className="dp-avatar" aria-hidden="true">{iniciais(r.nome)}</span>
                    <span className="dp-caixa-item">
                      <span className="dp-caixa-item-topo"><b>{r.nome ?? 'Contato'}</b><Quando iso={r.respondeuEm} /></span>
                      <span className="dp-caixa-trecho">{r.resposta ?? 'respondeu (sem texto)'}</span>
                      <span className="dp-caixa-camp">{r.campanha.nome}{r.descadastrou && <i className="dp-selo crit">saiu</i>}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <Paginacao pagina={pagina} total={d.total} porPagina={d.porPagina} ir={carregar} />
          </div>
          {atual && (
            <article className="dp-caixa-detalhe" aria-live="polite">
              <button type="button" className="pl-btn pl-btn-ghost dp-caixa-voltar" onClick={() => setDetalheMovel(false)}>← Respostas</button>
              <header className="dp-caixa-detalhe-topo">
                <span className="dp-avatar grande" aria-hidden="true">{iniciais(atual.nome)}</span>
                <div>
                  <h3>{atual.nome ?? 'Contato'}</h3>
                  <span className="pl-hint pl-mono">{atual.contato}</span>
                </div>
                {atual.descadastrou && <span className="dp-selo crit">Pediu para sair</span>}
              </header>
              <div className="dp-conversa">
                <span className="dp-conversa-quando">{dataHora(atual.respondeuEm)}</span>
                <div className="dp-balao entrada">{atual.resposta ? <p>{atual.resposta}</p> : <p className="dp-balao-vazio">respondeu sem texto (áudio, figurinha ou arquivo)</p>}</div>
              </div>
              <dl className="dp-caixa-dados">
                <dt>Campanha</dt><dd><button type="button" className="dp-link" onClick={() => abrir(atual.campanha.id)}>{atual.campanha.nome}</button></dd>
                <dt>Canal</dt><dd>{atual.campanha.canal === 'INSTAGRAM' ? 'Instagram (direct)' : 'WhatsApp'}</dd>
                {de !== 'minhas' && atual.campanha.criadoPor && <><dt>Campanha de</dt><dd>{atual.campanha.criadoPor}</dd></>}
              </dl>
              <p className="pl-hint">Responda pela conversa ({atual.campanha.canal === 'INSTAGRAM' ? 'Atendimento do Instagram' : 'WhatsApp'}). Quem respondeu sai da sequência{atual.descadastrou ? ' e, por ter pedido para sair, não recebe mais promoções' : ''}.</p>
              <div className="dp-linha">
                {atual.leadId && <a className="pl-btn pl-btn-primary" href={`/pro-labore/leads?lead=${atual.leadId}`}>Abrir o lead</a>}
                <button type="button" className="pl-btn" onClick={() => abrir(atual.campanha.id)}>Ver a campanha</button>
              </div>
            </article>
          )}
        </div>
      )}
    </div>
  )
}
