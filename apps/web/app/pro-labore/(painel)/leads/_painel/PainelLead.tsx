'use client'

// Painel lateral do lead (abre com um clique no card): tudo que saiu do card
// para ele ficar enxuto — contato, etapas, nota e etiquetas, follow, última
// mensagem do WhatsApp, observação, histórico e as ações.
import { useEffect } from 'react'
import type { EstagioLead, Lead, TipoNegociacao } from '@/lib/proLaboreApi'
import { situacaoFollow } from '../../_follow/follow'
import { ChipNota } from '../../assistente/_componentes/SugestoesConversa'
import { EtiquetasLead } from '../../assistente/_componentes/jornada'

const ORIGEM_LEAD: Record<string, string> = { TRAFEGO: 'Tráfego pago', ORGANICO: 'Orgânico' }
const NEGOCIACAO: Record<TipoNegociacao, string> = { P: 'Pagamento integral', R: 'Renegociação' }
const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const soDigitos = (t: string) => t.replace(/\D/g, '')
// Último avanço foi do assistente, há menos de 3 dias e o lead continua lá: dá para desfazer.
function avancoDesfazivel(lead: Lead) {
  const ultimo = lead.historico?.at(-1)
  return !!ultimo && ultimo.origem === 'ASSISTENTE' && ultimo.estagioNovo === lead.estagio && !lead.vendaId && Date.now() - new Date(ultimo.criadoEm).getTime() < 3 * 86_400_000
}

export function PainelLead({ lead, colunas, isDono, vejaEquipe, onFechar, onMover, onConverter, onEditar, onPerdido, onFollow, onDesfazer, onRemover, onDefinirTipoNegociacao }: {
  lead: Lead
  colunas: Array<{ estagio: EstagioLead; titulo: string }>
  isDono: boolean
  vejaEquipe: boolean
  onFechar: () => void
  onMover: (estagio: EstagioLead) => void
  onConverter: () => void
  onEditar: () => void
  onPerdido: () => void
  onFollow: () => void
  onDesfazer: () => void
  onRemover: () => void
  onDefinirTipoNegociacao: (tipo: TipoNegociacao) => void
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onFechar])

  const indice = colunas.findIndex(c => c.estagio === lead.estagio)
  const proxima = indice >= 0 ? colunas[indice + 1] : undefined
  const follow = lead.follows?.[0] ?? null
  const sit = follow ? situacaoFollow(follow) : null
  const ultimoAuto = lead.historico?.at(-1)
  const desfazivel = avancoDesfazivel(lead)
  const conversa = lead.conversa
  const whats = lead.telefone && soDigitos(lead.telefone).length >= 10 ? `https://wa.me/${soDigitos(lead.telefone).replace(/^(?!55)/, '55')}` : null
  const linkConversa = conversa ? `/pro-labore/assistente?aba=whatsapp&conversa=${conversa.id}${lead.vendedorId ? `&vendedor=${lead.vendedorId}` : ''}` : null
  const aberto = !lead.vendaId && lead.estagio !== 'PERDIDO'

  return (
    <div className="pl-pn-fundo" onClick={onFechar}>
      <aside className="pl-pn" role="dialog" aria-label={`Lead ${lead.nomeCliente}`} onClick={e => e.stopPropagation()} data-painel-lead>
        <header className="pl-pn-topo">
          <div className="pl-pn-quem">
            <h2>{lead.nomeCliente}</h2>
            <div className="pl-pn-sub">
              {lead.telefone && <span className="pl-mono">{lead.telefone}</span>}
              {vejaEquipe && lead.vendedor && <span>· {lead.vendedor.nome}</span>}
              <span>· entrou em {dataHora(lead.criadoEm)}</span>
            </div>
          </div>
          <button type="button" className="pl-pn-fechar" onClick={onFechar} aria-label="Fechar painel">✕</button>
        </header>

        <ol className="pl-pn-etapas" aria-label="Etapa no funil">
          {colunas.map((c, i) => (
            <li key={c.estagio} className={i < indice ? 'feita' : i === indice ? 'atual' : ''}>
              <button type="button" disabled={!aberto || c.estagio === lead.estagio || (c.estagio === 'FECHADO' && !isDono)} onClick={() => onMover(c.estagio)} title={c.estagio === lead.estagio ? 'Etapa atual' : `Mover para ${c.titulo}`}>
                {c.titulo}
              </button>
            </li>
          ))}
        </ol>

        {aberto && (
          <div className="pl-pn-acoes">
            {proxima && proxima.estagio !== 'FECHADO' && <button type="button" className="pl-btn pl-btn-primary" onClick={() => onMover(proxima.estagio)} data-painel-avancar>Avançar para {proxima.titulo} →</button>}
            {isDono && <button type="button" className="pl-btn pl-btn-primary pl-pn-converter" onClick={onConverter}>✓ Converter em venda</button>}
            <button type="button" className="pl-btn pl-btn-ghost" onClick={onFollow}>{follow ? 'Ver follow' : 'Agendar follow'}</button>
            {whats && <a className="pl-btn pl-btn-ghost" href={whats} target="_blank" rel="noreferrer">WhatsApp</a>}
            <button type="button" className="pl-btn pl-btn-ghost" onClick={onEditar}>Editar</button>
          </div>
        )}
        {lead.vendaId && <div className="pl-pn-venda">✓ Convertido em venda</div>}

        {desfazivel && (
          <div className="pl-kanban-card-auto" style={{ marginTop: 12 }} data-avanco-auto>
            <span>Movido pelo assistente: {ultimoAuto!.motivo}</span>
            <button type="button" className="pl-link-action" onClick={onDesfazer} data-desfazer>Desfazer</button>
          </div>
        )}

        <dl className="pl-pn-dados">
          <div><dt>Moto de interesse</dt><dd>{lead.modeloInteresse || '—'}</dd></div>
          <div><dt>Valor da negociação</dt><dd className="pl-mono">{lead.valorNegociacao > 0 ? moeda(lead.valorNegociacao) : '—'}</dd></div>
          <div><dt>Origem</dt><dd>{[lead.origemCadastro === 'WHATSAPP' ? 'WhatsApp (entrou sozinho)' : 'Cadastro manual', lead.tipoLead ? ORIGEM_LEAD[lead.tipoLead] : null, lead.postCode ? `Instagram ${lead.postCode}` : null].filter(Boolean).join(' · ')}</dd></div>
          {lead.email && <div><dt>E-mail</dt><dd>{lead.email}</dd></div>}
          {isDono && (
            <div>
              <dt title="P = pagamento integral · R = renegociação">Negociação (P/R)</dt>
              <dd className="pl-pn-pr">
                {(['P', 'R'] as TipoNegociacao[]).map(t => (
                  <button key={t} type="button" className={`pl-chip ${lead.tipoNegociacao === t ? 'active' : ''}`} aria-pressed={lead.tipoNegociacao === t} onClick={() => onDefinirTipoNegociacao(t)} title={NEGOCIACAO[t]}>{t}</button>
                ))}
              </dd>
            </div>
          )}
        </dl>

        {(typeof lead.pontuacao === 'number' || (lead.etiquetas?.length ?? 0) > 0) && (
          <section className="pl-pn-bloco">
            <h3>Leitura do assistente</h3>
            <div className="pl-pn-linha">
              {typeof lead.pontuacao === 'number' && <ChipNota nota={lead.pontuacao} titulo={`Nota pela conversa do WhatsApp: ${lead.pontuacao} de 100`} />}
              <EtiquetasLead etiquetas={lead.etiquetas?.filter(e => e !== 'QUENTE')} max={12} />
            </div>
          </section>
        )}

        <section className="pl-pn-bloco">
          <h3>Follow</h3>
          {sit ? (
            <button type="button" className={`fw-selo ${sit.tipo.toLowerCase()}`} onClick={onFollow}>{sit.texto}{follow?.nota ? ` · ${follow.nota}` : ''}</button>
          ) : <p className="pl-hint">Nenhum follow agendado.</p>}
        </section>

        {conversa && (
          <section className="pl-pn-bloco" data-painel-conversa>
            <h3>WhatsApp</h3>
            {conversa.ultima ? (
              <blockquote className="pl-pn-msg">
                <span>{conversa.ultima.remetente === 'CONTATO' ? lead.nomeCliente.split(' ')[0] : conversa.ultima.remetente === 'VENDEDOR' ? 'Vendedor' : 'Assistente'} · {dataHora(conversa.ultima.criadoEm)}</span>
                {conversa.ultima.texto}
              </blockquote>
            ) : <p className="pl-hint">Sem mensagens.</p>}
            {/* Navegação completa: o Assistente lê ?conversa= ao montar. */}
            {linkConversa && <a className="pl-link-action" href={linkConversa}>Abrir a conversa →</a>}
          </section>
        )}

        {lead.observacao && (
          <section className="pl-pn-bloco">
            <h3>Observação</h3>
            <p className="pl-pn-obs">{lead.observacao}</p>
          </section>
        )}

        {(lead.historico?.length ?? 0) > 0 && (
          <section className="pl-pn-bloco">
            <h3>Histórico</h3>
            <ol className="pl-pn-hist">
              {[...lead.historico!].reverse().map((h, i) => (
                <li key={i}>
                  <b>{colunas.find(c => c.estagio === h.estagioNovo)?.titulo ?? (h.estagioNovo === 'PERDIDO' ? 'Perdido' : h.estagioNovo)}</b>
                  <span>{dataHora(h.criadoEm)}{h.origem === 'ASSISTENTE' ? ` · pelo assistente${h.motivo ? `: ${h.motivo}` : ''}` : ''}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {aberto && (
          <footer className="pl-pn-rodape">
            <button type="button" className="pl-btn pl-btn-ghost pl-as-perigo" onClick={onPerdido}>Marcar como perdido</button>
            <button type="button" className="pl-btn pl-btn-ghost pl-as-perigo" onClick={onRemover}>Remover</button>
          </footer>
        )}
      </aside>
    </div>
  )
}
