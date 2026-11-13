'use client'

// PDF 06 · 4.2: o slide de um bloco do Daily (formato de apresentação
// comercial). Usado por quem conduz (com os botões Decidido, Tratado e Adiar)
// e pelo espectador da transmissão (sempre no modo equipe, só leitura).
import { useState } from 'react'
import type { BlocoPauta, NumeroDaily, TipoItemDaily } from '@/lib/proLaboreApi'
import { StatusChip, fmtValor } from '../_padrao/Padrao'

export interface AcoesItem {
  decidir: (item: ItemSlide) => void
  tratar: (item: ItemSlide) => Promise<void>
  adiar: (item: ItemSlide, motivo: string) => Promise<void>
}
export interface ItemSlide { tipo: TipoItemDaily; ref: string | null; texto: string; individual?: boolean }

const hora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const SIT: Record<string, string> = { FEITA: 'Feita', ATRASADA: 'Atrasada', VENCE_HOJE: 'Vence hoje', NO_PRAZO: 'No prazo', CANCELADA: 'Cancelada' }
const COR_SIT: Record<string, string> = { FEITA: 'var(--pl-good, #16a34a)', ATRASADA: 'var(--pl-critical, #dc2626)', VENCE_HOJE: 'var(--pl-warn, #ca8a04)', NO_PRAZO: 'var(--pl-ink-2)', CANCELADA: 'var(--pl-ink-3)' }

export function NumerosSlide({ numeros, grande }: { numeros: NumeroDaily[]; grande?: boolean }) {
  if (!numeros.length) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12, margin: '4px 0 16px' }}>
      {numeros.map(n => (
        <div key={n.rotulo} style={{ border: '1px solid var(--pl-border)', borderRadius: 12, padding: 12, background: 'var(--pl-surface)' }} data-numero-daily={n.chave} title={`${n.ficha.definicao}. ${n.ficha.formula}`}>
          <div className="pl-hint" style={{ fontSize: 13 }}>{n.rotulo}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <b style={{ fontSize: grande ? 30 : 22 }} data-valor>{n.naoDefinido ? '—' : n.unidade === 'TEXTO' ? (n.texto ?? '—') : fmtValor(n.valor, n.unidade)}</b>
            {n.junto && <span className="pl-hint">{n.junto.valor ?? 0} {n.junto.nome.toLowerCase()}</span>}
            <StatusChip status={n.status ?? undefined} />
          </div>
          <div className="pl-hint" style={{ fontSize: 12 }}>
            {n.unidade !== 'TEXTO' && n.texto ? n.texto : ''}
            {n.unidade !== 'TEXTO' && !n.texto && n.alvo?.valor != null ? `${n.alvo.rotulo}: ${fmtValor(n.alvo.valor, n.unidade)}` : ''}
            {n.variacao != null ? ` · ${n.variacao > 0 ? '+' : ''}${n.variacao.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% contra o mesmo período anterior` : ''}
          </div>
          {n.porPessoa && n.porPessoa.length > 0 && <div style={{ marginTop: 6, fontSize: 13 }} data-por-pessoa>{n.porPessoa.map(p => <span key={p.id} style={{ marginRight: 12, display: 'inline-block' }}>{p.nome}: <b>{fmtValor(p.valor, n.unidade)}</b></span>)}</div>}
          {n.semVenda && n.semVenda.total > 0 && (
            <details style={{ marginTop: 4, fontSize: 12 }} data-sem-venda>
              <summary style={{ cursor: 'pointer' }}>{n.semVenda.total} {n.semVenda.total === 1 ? 'vendedor sem venda ontem' : 'vendedores sem venda ontem'}</summary>
              <span className="pl-hint">{n.semVenda.nomes.join(', ')}</span>
            </details>
          )}
        </div>
      ))}
    </div>
  )
}

function Botoes({ item, resolvido, acoes }: { item: ItemSlide; resolvido: string | null; acoes?: AcoesItem }) {
  const [adiando, setAdiando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  if (!acoes) return null
  if (resolvido) return <span className="pl-hint" style={{ fontSize: 12, whiteSpace: 'nowrap' }} data-resolvido={resolvido}>{resolvido === 'DECIDIDO' ? '✓ Decidido' : resolvido === 'TRATADO' ? '✓ Tratado' : '↷ Adiado'}</span>
  if (adiando) return (
    <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }} data-form-adiar>
      <input className="pl-input" style={{ minWidth: 180 }} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo do adiamento" aria-label="Motivo do adiamento" autoFocus />
      <button type="button" className="pl-btn pl-btn-primary" data-salvar-adiar onClick={async () => { setErro(null); if (motivo.trim().length < 3) { setErro('Escreva o motivo'); return } try { await acoes.adiar(item, motivo.trim()); setAdiando(false) } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível') } }}>Adiar</button>
      <button type="button" className="pl-btn" onClick={() => setAdiando(false)}>Cancelar</button>
      {erro && <span className="pl-hint" role="alert">{erro}</span>}
    </span>
  )
  return (
    <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <button type="button" className="pl-btn pl-btn-primary" style={{ padding: '3px 10px' }} onClick={() => acoes.decidir(item)} data-decidido>Decidido</button>
      <button type="button" className="pl-btn" style={{ padding: '3px 10px' }} onClick={() => void acoes.tratar(item)} data-tratar>Tratado</button>
      <button type="button" className="pl-btn" style={{ padding: '3px 10px' }} onClick={() => setAdiando(true)} data-adiar>Adiar</button>
    </span>
  )
}

export function ItensSlide({ bloco, acoes, modoEquipe }: { bloco: BlocoPauta; acoes?: AcoesItem; modoEquipe: boolean }) {
  const resolvido = (tipo: string, ref: string | null) => bloco.resolvidos.find(r => r.tipo === tipo && r.ref === ref)?.situacao ?? null
  const enviados = bloco.enviados ?? []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {bloco.pendencias && (
        <div data-pendencias>
          <div className="ar-fila-grupo">{bloco.pendencias.reuniao ? `Decidido no ${bloco.pendencias.reuniao.titulo}` : 'Nenhum Daily anterior encerrado'}</div>
          {bloco.pendencias.reuniao && <p style={{ margin: '4px 0 8px', fontSize: 15 }} data-pendencias-totais><b>{bloco.pendencias.feitas}</b> feitas · <b style={{ color: COR_SIT.ATRASADA }}>{bloco.pendencias.atrasadas}</b> atrasadas · <b>{bloco.pendencias.venceHoje}</b> vencem hoje · <b>{bloco.pendencias.noPrazo}</b> no prazo</p>}
          <ul className="ar-fila">{bloco.pendencias.itens.map(p => (
            <li key={p.id} className="ar-fila-item" data-pendencia={p.situacao}>
              <div style={{ flex: 1 }}>
                <div className="ar-fila-titulo">{p.codigo ? `${p.codigo} · ` : ''}{p.oQue}</div>
                <div className="ar-fila-det">{p.responsavel} · prazo {hora(p.prazo)} · <b style={{ color: COR_SIT[p.situacao] }}>{SIT[p.situacao]}</b>{p.resultado ? ` · ${p.resultado}` : ''}</div>
              </div>
              {p.situacao !== 'FEITA' && p.situacao !== 'CANCELADA' && <Botoes item={{ tipo: 'PENDENCIA', ref: p.id, texto: `${p.oQue} (${p.responsavel})` }} resolvido={resolvido('PENDENCIA', p.id)} acoes={acoes} />}
            </li>
          ))}</ul>
        </div>
      )}
      {enviados.length > 0 && (
        <div data-itens-enviados>
          <div className="ar-fila-grupo">Levado ao Daily</div>
          <ul className="ar-fila">{enviados.map(i => (
            <li key={i.id} className="ar-fila-item" data-item-enviado={i.id} data-origem={i.origem}>
              <div style={{ flex: 1 }}>
                <div className="ar-fila-titulo">{i.texto}</div>
                <div className="ar-fila-det" data-enviado-por>{i.origem === 'ADIADO' ? `Adiado do Daily anterior${i.motivoAdiamento ? ` · motivo: ${i.motivoAdiamento}` : ''}` : `Enviado do Hoje${i.enviadoPor ? ` por ${i.enviadoPor}` : ''} em ${hora(i.enviadoEm)}`}</div>
              </div>
              <Botoes item={{ tipo: 'ITEM', ref: i.id, texto: i.texto }} resolvido={i.situacao !== 'ABERTO' ? i.situacao : resolvido('ITEM', i.id)} acoes={acoes} />
            </li>
          ))}</ul>
        </div>
      )}
      {bloco.chave !== 'PENDENCIAS' && (
        <div>
          <div className="ar-fila-grupo">Recomendações da área</div>
          {!bloco.recs.length ? <p className="pl-hint" style={{ margin: 0 }}>Nenhuma Recomendação aberta {modoEquipe ? 'de equipe ou de etapa ' : ''}neste bloco.</p> : (
            <ul className="ar-fila">{bloco.recs.map(r => (
              <li key={r.id} className="ar-fila-item" data-rec-daily={r.id}>
                <div style={{ flex: 1 }}>
                  <div className="ar-fila-titulo">{r.codigo ? `${r.codigo} · ` : ''}{r.titulo}</div>
                  <div className="ar-fila-det">{r.acao}{r.impacto ? ` · ${r.impacto}` : ''}{r.individual ? ' · orientação individual' : ''}</div>
                </div>
                <Botoes item={{ tipo: 'REC', ref: r.id, texto: r.titulo, individual: r.individual }} resolvido={resolvido('REC', r.id)} acoes={acoes} />
              </li>
            ))}</ul>
          )}
        </div>
      )}
      {!modoEquipe && bloco.atividades.length > 0 && (
        <div>
          <div className="ar-fila-grupo">Atividades críticas · {bloco.atividades.length}</div>
          <ul className="ar-fila">{bloco.atividades.map(a => (
            <li key={a.id} className="ar-fila-item" data-atv-daily={a.id}>
              <div style={{ flex: 1 }}>
                <div className="ar-fila-titulo">{a.codigo ? `${a.codigo} · ` : ''}{a.oQue}{a.cliente ? ` (${a.cliente})` : ''}</div>
                <div className="ar-fila-det" data-responsavel>{a.responsavel} · {a.atrasada ? 'atrasada desde' : 'vence'} {hora(a.prazo)}</div>
              </div>
              <Botoes item={{ tipo: 'ATV', ref: a.id, texto: `${a.oQue} (${a.responsavel})` }} resolvido={resolvido('ATV', a.id)} acoes={acoes} />
            </li>
          ))}</ul>
        </div>
      )}
      {bloco.decididas.length > 0 && (
        <div data-decididas>
          <div className="ar-fila-grupo">Decidido nesta reunião</div>
          <ul className="ar-fila">{bloco.decididas.map(d => <li key={d.id} className="ar-fila-item"><div style={{ flex: 1 }}><div className="ar-fila-titulo">{d.codigo ? `${d.codigo} · ` : ''}{d.oQue}</div><div className="ar-fila-det">{d.responsavel} · até {hora(d.prazo)}</div></div></li>)}</ul>
        </div>
      )}
    </div>
  )
}
