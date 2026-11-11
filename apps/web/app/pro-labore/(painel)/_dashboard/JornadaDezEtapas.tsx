'use client'

// Jornada de compra do cliente no formato visual de sempre (nomes, cartões de
// Oportunidade em R$, funil em faixa colorida com a % de cada etapa, volumes e,
// embaixo, conversão, perda, meta e custo), agora com as 10 etapas e os números
// do dicionário de métricas (Ajuste 1). Cor da faixa = situação da etapa.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { painelDonoApi, type EtapaPainel, type PainelDono } from '@/lib/proLaboreApi'
// Valor curto e uniforme para colunas estreitas: R$ 0 · R$ 830 · R$ 1,7 mil · R$ 155 mil · R$ 2,1 mi.
const formatMoedaCompacta = (v: number) => {
  const a = Math.abs(v), s = v < 0 ? '−' : ''
  const n = (x: number, c: number) => x.toLocaleString('pt-BR', { maximumFractionDigits: c })
  if (a >= 1_000_000) return `${s}R$ ${n(a / 1_000_000, 1)} mi`
  if (a >= 1_000) return `${s}R$ ${n(a / 1_000, a >= 10_000 ? 0 : 1)} mil`
  return `${s}R$ ${n(a, 0)}`
}
import { EditarMetas } from '../hoje/PainelDoDono'

const COR = { BOM: 'var(--pl-good)', ATENCAO: 'var(--pl-warning, #d97706)', CRITICO: 'var(--pl-critical)' } as const
const CURTO: Record<string, string> = { LEVANTAMENTO: 'Levantamento', MQL: 'MQL (Simulação)', SQL: 'SQL (Aprovado)', VISITA: 'Visita confirmada' }
const pct = (v: number | null | undefined) => (v == null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)

// Faixa do funil: um ponto no centro de cada coluna (x = (i + ½) / n), plana até as bordas; altura pela raiz do volume.
function FaixaFunil({ valores, cores }: { valores: number[]; cores: string[] }) {
  const n = valores.length, W = 1000, H = 140, mid = H / 2, max = Math.max(1, ...valores)
  const vis: number[] = []
  for (const v of valores) vis.push(Math.min(v, vis[vis.length - 1] ?? v))
  const meia = vis.map(v => ((0.14 + 0.86 * Math.sqrt(v / max)) * H) / 2)
  const x = (i: number) => ((i + 0.5) / n) * W
  let d = `M 0 ${mid - meia[0]} L ${x(0)} ${mid - meia[0]}`
  for (let i = 0; i < n - 1; i++) { const m = (x(i) + x(i + 1)) / 2; d += ` C ${m} ${mid - meia[i]}, ${m} ${mid - meia[i + 1]}, ${x(i + 1)} ${mid - meia[i + 1]}` }
  d += ` L ${W} ${mid - meia[n - 1]} L ${W} ${mid + meia[n - 1]} L ${x(n - 1)} ${mid + meia[n - 1]}`
  for (let i = n - 1; i > 0; i--) { const m = (x(i) + x(i - 1)) / 2; d += ` C ${m} ${mid + meia[i]}, ${m} ${mid + meia[i - 1]}, ${x(i - 1)} ${mid + meia[i - 1]}` }
  d += ` L 0 ${mid + meia[0]} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="jd-faixa" aria-hidden="true">
      <defs><linearGradient id="jd-grad" x1="0" y1="0" x2="1" y2="0">{cores.map((c, i) => <stop key={i} offset={`${((i + 0.5) / n) * 100}%`} stopColor={c} />)}</linearGradient></defs>
      <path d={d} fill="url(#jd-grad)" />
    </svg>
  )
}

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
  const metaTxt = (e: EtapaPainel) => [e.metas.conversaoMin != null ? `conv. ${e.metas.conversaoMin}%` : '', e.metas.perdaMax != null ? `perda ${e.metas.perdaMax}%` : '', e.metas.custoMax != null ? `custo ${formatMoedaCompacta(e.metas.custoMax)}` : ''].filter(Boolean).join(' · ')
  return (
    <div data-jornada-10 className="jd">
      {(d.excluidos.aVista > 0 || d.excluidos.semVisita > 0) && <p className="pl-hint jd-aviso">Exclusões aprovadas: {d.excluidos.aVista} à vista fora de MQL e SQL · {d.excluidos.semVisita} venda(s) sem visita fora de Agendamento e Visita.</p>}
      <div className="jd-rola">
        <div className="jd-grade">
          {/* Fases, com o subtotal */}
          {d.fases.map(f => (
            <div key={f.fase} className="jd-fase" style={{ gridColumn: `span ${d.etapas.filter(e => e.fase === f.fase).length}` }}>
              <b>{f.nome}</b>{d.etapas.filter(e => e.fase === f.fase).length > 1 ? <> · {f.entraram} entraram{f.conversao != null ? ` · ${pct(f.conversao)} seguiram` : ''} · {f.perdidos} perdido(s)</> : null}
            </div>
          ))}
          {/* Nomes (abrem o CRM na etapa) e o selo do gargalo, numa altura fixa */}
          {d.etapas.map(e => (
            <div key={`n-${e.etapa}`} className="jd-nome">
              <Link href={e.crm} data-abrir-crm title={`Abrir ${e.nome} no CRM`}>{CURTO[e.etapa] ?? e.nome}</Link>
              {d.gargalo === e.etapa ? <span className="pl-delta down jd-selo" data-gargalo>gargalo</span> : <span className="jd-selo-vazio" />}
            </div>
          ))}
          {/* Cartões em R$ (só o dono) */}
          {isDono && d.etapas.map(e => (
            <div key={`v-${e.etapa}`} className="jd-valores" data-valores-etapa title={rotuloPeriodo}>
              <span>Oportunidade</span><b className="jd-oport">{formatMoedaCompacta(e.valores?.oportunidade ?? 0)}</b>
              <span>Pró-labore</span><b>{formatMoedaCompacta(e.valores?.proLaborePrevisto ?? 0)}</b>
              <span>Comissão</span><b>{formatMoedaCompacta(e.valores?.comissaoPrevista ?? 0)}</b>
              <span>Com. perdida</span><b>{formatMoedaCompacta(e.valores?.comissaoPerdida ?? 0)}</b>
            </div>
          ))}
          {/* Funil em faixa: cada ponto no centro da coluna da etapa, a % do topo por cima */}
          <div className="jd-funil" style={{ gridColumn: '1 / -1' }}>
            <FaixaFunil valores={d.etapas.map(e => e.volume)} cores={d.etapas.map(e => (e.situacao ? COR[e.situacao] : 'var(--pl-ink-2)'))} />
            <div className="jd-funil-pct">
              {d.etapas.map(e => <span key={e.etapa}>{topo ? pct(Math.round((e.volume / topo) * 1000) / 10) : '—'}</span>)}
            </div>
          </div>
          {/* Volumes */}
          {d.etapas.map(e => <div key={`q-${e.etapa}`} className="jd-volume pl-mono">{e.volume.toLocaleString('pt-BR')}</div>)}
          {/* Conversão, perda, tempo, meta e custo */}
          {d.etapas.map(e => (
            <div key={`d-${e.etapa}`} className="jd-det" data-etapa-painel={e.etapa} data-situacao={e.situacao ?? ''}>
              {/* Linhas fixas, na mesma altura em todas as colunas (vazio = traço). */}
              <div><span>Conv.</span><b>{e.etapa !== 'VENDA' ? pct(e.conversao) : '—'}</b></div>
              <div><span>Perda</span><b>{e.etapa !== 'VENDA' ? `${e.perda.n} (${pct(e.perda.pct)})` : '—'}</b></div>
              <div className="jd-motivo" title={e.perda.motivos.map(m => `${m.nome} (${m.n})`).join(' · ')}>{e.perda.motivos[0] ? `${e.perda.motivos[0].nome} (${e.perda.motivos[0].n})` : '\u00a0'}</div>
              <div><span>Tempo</span><b>{e.etapa !== 'VENDA' && e.tempoMediano != null ? `${e.tempoMediano.toLocaleString('pt-BR')} d` : '—'}</b></div>
              <div className="jd-motivo">{e.metas.tempoMax.valor != null ? `máx. ${e.metas.tempoMax.valor} ${e.metas.tempoMax.unidade.toLowerCase()}` : '\u00a0'}</div>
              {isDono && <div><span>Custo</span><b>{e.custo != null ? formatMoedaCompacta(e.custo) : '—'}</b></div>}
              <div className="jd-meta">
                {isDono
                  ? <button type="button" className="pl-link-action" onClick={() => setEditando(e)} data-editar-metas={e.etapa} title={metaTxt(e) || 'Definir meta'}>{metaTxt(e) ? `Meta: ${metaTxt(e)} ✎` : 'Definir meta ✎'}</button>
                  : <span>{e.metas.conversaoMin != null ? `Meta: ${e.metas.conversaoMin}% (mín.)` : e.conversaoHistorico != null ? `histórico ${pct(e.conversaoHistorico)}` : 'sem meta'}</span>}
                {e.situacao && <span className={`pl-delta ${e.situacao === 'BOM' ? 'up' : 'down'}`}>{e.situacao === 'BOM' ? 'ok' : e.situacao === 'ATENCAO' ? 'atenção' : 'fora'}</span>}
              </div>
              {e.rec && d.gargalo === e.etapa && <div><Link href={`/pro-labore/recomendacoes?rec=${e.rec.id}`}>{e.rec.codigo ?? 'Recomendação'}</Link></div>}
            </div>
          ))}
        </div>
      </div>
      {editando && isDono && <EditarMetas e={editando} fechar={() => setEditando(null)} aoSalvar={() => { setEditando(null); setVersao(v => v + 1) }} />}
    </div>
  )
}
