'use client'

// Jornada de compra do cliente no formato visual de sempre (nomes, cartões de
// Oportunidade em R$, funil em faixa colorida com a % de cada etapa, volumes e,
// embaixo, conversão, perda, meta e custo), agora com as 10 etapas e os números
// do dicionário de métricas (Ajuste 1). Cor da faixa = situação da etapa.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { painelDonoApi, type EtapaPainel, type PainelDono } from '@/lib/proLaboreApi'
import { formatMoeda } from '@/lib/format'
import { FunilTrapezio } from './DashboardAntigo'
import { EditarMetas } from '../hoje/PainelDoDono'

const COR = { BOM: 'var(--pl-good)', ATENCAO: 'var(--pl-warning, #d97706)', CRITICO: 'var(--pl-critical)' } as const
const pct = (v: number | null | undefined) => (v == null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)
const COLS = { gridTemplateColumns: 'repeat(10, minmax(118px, 1fr))' }

// Mês do Dashboard (até hoje, no mês em andamento) ou o período escolhido no filtro da Jornada.
function periodoDe(periodo: { inicio: string; fim: string } | null, ano: number, mes: number) {
  if (periodo) return periodo
  const ult = new Date(Date.UTC(ano, mes + 1, 0)).toISOString().slice(0, 10)
  const hoje = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10)
  return { inicio: `${ano}-${String(mes + 1).padStart(2, '0')}-01`, fim: ult < hoje ? ult : hoje }
}

export function JornadaDezEtapas({ periodo, ano, mes, vendedorId, isDono, rotuloPeriodo }: { periodo: { inicio: string; fim: string } | null; ano: number; mes: number; vendedorId: string; isDono: boolean; rotuloPeriodo: string }) {
  const [d, setD] = useState<PainelDono['jornada'] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [versao, setVersao] = useState(0)
  const [editando, setEditando] = useState<EtapaPainel | null>(null)
  useEffect(() => {
    let vivo = true
    const { inicio, fim } = periodoDe(periodo, ano, mes)
    painelDonoApi.topo({ inicio, fim, vendedorId: vendedorId || undefined }).then(p => { if (vivo) { setD(p.jornada); setErro(null) } }).catch(e => { if (vivo) setErro(e instanceof Error ? e.message : 'Não foi possível carregar a jornada') })
    return () => { vivo = false }
  }, [periodo, ano, mes, vendedorId, versao])
  if (erro) return <p className="pl-hint">{erro}</p>
  if (!d) return <p className="pl-hint">Calculando a jornada…</p>
  const topo = d.etapas[0]?.volume ?? 0
  return (
    <div data-jornada-10>
      {(d.excluidos.aVista > 0 || d.excluidos.semVisita > 0) && <p className="pl-hint" style={{ marginTop: 0 }}>Exclusões aprovadas: {d.excluidos.aVista} à vista fora de MQL e SQL · {d.excluidos.semVisita} venda(s) sem visita fora de Agendamento e Visita.</p>}
      <div className="pl-journey-scroll pl-dash-etapas">
        <div className="pl-dash-etapas-inner" style={{ minWidth: 1180 }}>
          {/* Fases */}
          <div className="pl-journey-row" style={{ ...COLS, marginBottom: 2 }}>
            {d.fases.map(f => <div key={f.fase} className="pl-eyebrow" style={{ gridColumn: `span ${d.etapas.filter(e => e.fase === f.fase).length}`, textAlign: 'center' }}>{f.nome} · {f.entraram} entraram{f.conversao != null ? ` · ${pct(f.conversao)} seguiram` : ''} · {f.perdidos} perdido(s)</div>)}
          </div>
          {/* Nomes (abrem o CRM na etapa) */}
          <div className="pl-journey-row" style={{ ...COLS, marginBottom: 4 }}>
            {d.etapas.map((e, i) => (
              <div key={e.etapa} style={{ textAlign: 'center', borderLeft: i > 0 ? '1px solid var(--pl-border)' : 'none' }}>
                <Link href={e.crm} className="pl-stage-name" data-abrir-crm>{e.nome}</Link>
                {d.gargalo === e.etapa && <div className="pl-delta down" style={{ display: 'inline-block', marginLeft: 4 }} data-gargalo>gargalo</div>}
              </div>
            ))}
          </div>
          {/* Cartões em R$ (só o dono) */}
          {isDono && (
            <div className="pl-crm-fin-row" style={{ ...COLS, marginBottom: 14 }}>
              {d.etapas.map(e => (
                <div key={e.etapa} className="pl-crm-fin-card" data-valores-etapa>
                  <div className="pl-crm-fin-item"><span>Oportunidade</span><b className="pl-crm-fin-oportunidade">{formatMoeda(e.valores?.oportunidade ?? 0)}</b></div>
                  <div className="pl-crm-perf-divider" />
                  <div className="pl-stage-conv">Pró-labore previsto <b>{formatMoeda(e.valores?.proLaborePrevisto ?? 0)}</b></div>
                  <div className="pl-stage-conv">Comissão prevista <b>{formatMoeda(e.valores?.comissaoPrevista ?? 0)}</b></div>
                  <div className="pl-stage-conv">Comissão perdida <b>{formatMoeda(e.valores?.comissaoPerdida ?? 0)}</b></div>
                  <div className="pl-crm-fin-periodo">{rotuloPeriodo}</div>
                </div>
              ))}
            </div>
          )}
          {/* Funil em faixa, com a % de cada etapa sobre o topo */}
          <div style={{ position: 'relative' }}>
            <FunilTrapezio valores={d.etapas.map(e => e.volume)} cores={d.etapas.map(e => (e.situacao ? COR[e.situacao] : 'var(--pl-accent)'))} />
            <div className="pl-journey-row" style={{ ...COLS, position: 'absolute', inset: 0, alignItems: 'center' }}>
              {d.etapas.map(e => <div key={e.etapa} className="pl-mono" style={{ textAlign: 'center', fontWeight: 800, fontSize: 16, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,.45)' }}>{topo ? pct(Math.round((e.volume / topo) * 1000) / 10) : '—'}</div>)}
            </div>
          </div>
          {/* Volumes */}
          <div className="pl-journey-row" style={{ ...COLS, marginTop: 10 }}>
            {d.etapas.map(e => <div key={e.etapa} className="pl-stage-value pl-mono" style={{ textAlign: 'center', fontSize: 20 }}>{e.volume.toLocaleString('pt-BR')}</div>)}
          </div>
          {/* Conversão, perda, tempo, meta e custo */}
          <div className="pl-journey-details pl-journey-row" style={{ ...COLS, gap: 4, marginTop: 4 }}>
            {d.etapas.map((e, i) => (
              <div key={e.etapa} style={{ textAlign: 'center' }} data-etapa-painel={e.etapa} data-situacao={e.situacao ?? ''}>
                {e.etapa !== 'VENDA' ? <div className="pl-stage-conv">conv. para a seguinte <b>{pct(e.conversao)}</b></div> : <div className="pl-stage-conv">{i === 0 ? 'topo do funil' : 'vendas confirmadas'}</div>}
                {e.etapa !== 'VENDA' && <div className="pl-stage-conv">Perda <b>{e.perda.n} ({pct(e.perda.pct)})</b></div>}
                {e.perda.motivos.length > 0 && <div className="pl-hint" style={{ fontSize: 11 }}>{e.perda.motivos.map(m => `${m.nome} (${m.n})`).join(' · ')}</div>}
                {e.etapa !== 'VENDA' && <div className="pl-stage-conv">Tempo <b>{e.tempoMediano != null ? `${e.tempoMediano.toLocaleString('pt-BR')} d` : '—'}</b>{e.metas.tempoMax.valor != null ? <span className="pl-hint"> · máx. {e.metas.tempoMax.valor} {e.metas.tempoMax.unidade.toLowerCase()}</span> : null}</div>}
                <div className="pl-stage-conv" style={{ marginTop: 6 }}>
                  {isDono
                    ? <span className="pl-link-action" onClick={() => setEditando(e)} data-editar-metas={e.etapa}>{e.metas.conversaoMin != null || e.metas.perdaMax != null || e.metas.custoMax != null ? `Meta: ${[e.metas.conversaoMin != null ? `${e.metas.conversaoMin}% (mín.)` : '', e.metas.perdaMax != null ? `perda ${e.metas.perdaMax}% (máx.)` : '', e.metas.custoMax != null ? `custo ${formatMoeda(e.metas.custoMax)} (máx.)` : ''].filter(Boolean).join(' · ')} ✎` : 'Definir meta ✎'}</span>
                    : <span>{e.metas.conversaoMin != null ? `Meta: ${e.metas.conversaoMin}% (mín.)` : e.conversaoHistorico != null ? `histórico ${pct(e.conversaoHistorico)}` : 'sem meta'}</span>}
                  {e.situacao && <span className={`pl-delta ${e.situacao === 'BOM' ? 'up' : 'down'}`} style={{ marginLeft: 6 }}>{e.situacao === 'BOM' ? 'ok' : e.situacao === 'ATENCAO' ? 'atenção' : 'fora'}</span>}
                </div>
                {isDono && e.custo != null && <div className="pl-stage-conv">Custo/{e.etapa === 'LEAD' ? 'lead' : 'etapa'} <b>{formatMoeda(e.custo)}</b></div>}
                {e.rec && d.gargalo === e.etapa && <div className="pl-stage-conv"><Link href={`/pro-labore/recomendacoes?rec=${e.rec.id}`}>{e.rec.codigo ?? 'Recomendação'}</Link></div>}
              </div>
            ))}
          </div>
        </div>
      </div>
      {editando && isDono && <EditarMetas e={editando} fechar={() => setEditando(null)} aoSalvar={() => { setEditando(null); setVersao(v => v + 1) }} />}
    </div>
  )
}
