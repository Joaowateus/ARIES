'use client'

// PDF 03 · Recomendações (dono e supervisor): a lista com filtros por área,
// status e destinatário, e o detalhe de cada REC. Base da semana em modo
// silencioso e da futura aba Recomendações (onda 3).
import { useCallback, useEffect, useState } from 'react'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { recApi, type RecResumo } from '@/lib/proLaboreApi'
import { abaPorChave } from '@/lib/abasAries'
import { Cabecalho, Lente } from '../_padrao/Padrao'
import { AREA, DetalheRec, ForcaChip, STATUS } from './DetalheRec'

export default function RecomendacoesPage() {
  const { usuario } = useProLaboreAuth()
  const gestao = usuario?.papel === 'DONO' || usuario?.papel === 'SUPERVISOR'
  const [d, setD] = useState<{ modo: string; itens: RecResumo[] } | null>(null)
  const [f, setF] = useState({ area: '', status: '', destinatarioId: '' })
  const [aberta, setAberta] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const carregar = useCallback(() => recApi.listar(f).then(setD).catch(() => setD(null)), [f])
  useEffect(() => { if (gestao) void carregar() }, [carregar, gestao])
  // Vindo do Hoje ou da Lente (?rec=): abre o detalhe direto.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { const r = new URLSearchParams(window.location.search).get('rec'); if (r) setAberta(r) }, [])
  if (!usuario) return null
  if (!gestao) return <div className="pl-empty pl-card"><h3 style={{ margin: 0 }}>Seu acesso não inclui essa área</h3><p>As orientações para você aparecem no Hoje e em Desenvolvimento.</p></div>
  const destinatarios = [...new Map((d?.itens ?? []).filter(x => x.destinatarioId).map(x => [x.destinatarioId!, x.destinatario ?? x.destinatarioId!])).entries()]
  async function rodar() {
    setMsg(null)
    try { const r = await recApi.rodar(); setMsg(`${r.filter(x => x.criada).length} nova(s) recomendação(ões).`); await carregar() } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível rodar') }
  }
  return (
    <div>
      <Cabecalho aba={abaPorChave('recomendacoes')!} />
      <div className="ar-tela"><div className="ar-trabalho">
      {d?.modo === 'SILENCIOSO' && <div className="pl-alert" style={{ marginBottom: 12 }} data-modo-silencioso>Modo silencioso: as recomendações estão indo só para o dono e o supervisor. O roteamento para a equipe é ligado pelo dono em Configurações.</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <select className="pl-input" style={{ width: 'auto' }} value={f.area} onChange={e => setF({ ...f, area: e.target.value })} aria-label="Área" data-filtro-area>
          <option value="">Todas as áreas</option>{Object.entries(AREA).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        </select>
        <select className="pl-input" style={{ width: 'auto' }} value={f.status} onChange={e => setF({ ...f, status: e.target.value })} aria-label="Status" data-filtro-status>
          <option value="">Todos os status</option>{Object.entries(STATUS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        </select>
        <select className="pl-input" style={{ width: 'auto' }} value={f.destinatarioId} onChange={e => setF({ ...f, destinatarioId: e.target.value })} aria-label="Destinatário" data-filtro-destinatario>
          <option value="">Todos os destinatários</option>{destinatarios.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
        {usuario.papel === 'DONO' && <button type="button" className="pl-btn" onClick={() => void rodar()} data-rodar-detectores>Rodar os detectores agora</button>}
        {msg && <span className="pl-hint" role="status">{msg}</span>}
      </div>
      {d && d.itens.length === 0 && <div className="pl-empty pl-card"><p style={{ margin: 0 }}>Nenhuma recomendação no filtro. Os detectores rodam todo dia e só disparam com volume mínimo de casos.</p></div>}
      {d && d.itens.length > 0 && (
        <div className="pl-card" style={{ overflowX: 'auto' }}>
          <table className="pl-table"><thead><tr><th>REC</th><th>O que foi achado</th><th>Força</th><th>Impacto (estimativa)</th><th>Para</th><th>Status</th><th>Prazo</th></tr></thead>
            <tbody>{d.itens.map(x => (
              <tr key={x.id} data-rec={x.detector} style={{ cursor: 'pointer' }} onClick={() => setAberta(x.id)}>
                <td>{x.codigo}</td>
                <td><b>{x.titulo}</b><div className="pl-hint">{AREA[x.area] ?? x.area}{x.tipo === 'FUNCIONANDO' ? ' · está funcionando' : ''} · {x.resumo}</div></td>
                <td><ForcaChip forca={x.forca} /></td>
                <td className="pl-hint">{x.impacto?.texto ?? '—'}</td>
                <td>{x.destinatario ?? '—'}</td>
                <td>{STATUS[x.status]}</td>
                <td className="pl-hint">{new Date(x.prazo).toLocaleDateString('pt-BR')}</td>
              </tr>
            ))}</tbody></table>
        </div>
      )}
      {aberta && <DetalheRec id={aberta} onFechar={() => setAberta(null)} onMudou={() => void carregar()} avaliarPertinencia />}
      </div><Lente aba="recomendacoes" aoMudar={() => void carregar()} /></div>
    </div>
  )
}
