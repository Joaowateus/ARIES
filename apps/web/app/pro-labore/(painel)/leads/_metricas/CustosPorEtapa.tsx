'use client'

// Custos e desempenho por etapa no CRM, nas 10 etapas da jornada (os mesmos
// números do Painel do Hoje, vindos do dicionário de métricas): oportunidade
// em R$, pró-labore e comissão (só o dono), conversão, perda, custo por lead
// que chega à etapa, tempo e a meta. Cinco cartões por linha, sem rolagem.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { painelDonoApi, type EtapaPainel, type PainelDono } from '@/lib/proLaboreApi'
import { formatMoeda } from '@/lib/format'
import { EditarMetas } from '../../hoje/PainelDoDono'

const curta = (v: number) => {
  const a = Math.abs(v), n = (x: number, c: number) => x.toLocaleString('pt-BR', { maximumFractionDigits: c })
  if (a >= 1_000_000) return `R$ ${n(a / 1_000_000, 1)} mi`
  if (a >= 10_000) return `R$ ${n(a / 1_000, 0)} mil`
  if (a >= 1_000) return `R$ ${n(a / 1_000, 1)} mil`
  return `R$ ${n(a, 0)}`
}
const pct = (v: number | null | undefined) => (v == null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)
const metaTxt = (e: EtapaPainel) => [e.metas.conversaoMin != null ? `conv. ${e.metas.conversaoMin}% (mín.)` : '', e.metas.perdaMax != null ? `perda ${e.metas.perdaMax}% (máx.)` : '', e.metas.custoMax != null ? `custo ${curta(e.metas.custoMax)} (máx.)` : ''].filter(Boolean).join(' · ')

function mesAteHoje() {
  const hoje = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10)
  return { inicio: `${hoje.slice(0, 7)}-01`, fim: hoje }
}

export function CustosPorEtapa({ isDono, vendedorId, semDados }: { isDono: boolean; vendedorId: string; semDados: React.ReactNode }) {
  const [d, setD] = useState<PainelDono['jornada'] | null>(null)
  const [falhou, setFalhou] = useState(false)
  const [versao, setVersao] = useState(0)
  const [editando, setEditando] = useState<EtapaPainel | null>(null)
  useEffect(() => {
    let vivo = true
    painelDonoApi.topo({ ...mesAteHoje(), vendedorId: vendedorId || undefined }).then(p => { if (vivo) { setD(p.jornada); setFalhou(false) } }).catch(() => { if (vivo) setFalhou(true) })
    return () => { vivo = false }
  }, [vendedorId, versao])
  // Quem não abre o Painel (vendedor, SDR) continua com a visão que já tinha.
  if (falhou) return <>{semDados}</>
  if (!d) return <p className="pl-hint" data-custos-etapa-carregando>Calculando os custos por etapa…</p>
  const topo = d.etapas[0]
  return (
    <section className="crm-custos" data-custos-etapa>
      <div className="crm-custos-topo">
        <div>
          <div className="pl-eyebrow">Custos e desempenho por etapa · mês até hoje</div>
          {isDono && <span className="crm-custos-cpl">Custo por lead (topo do funil): <b>{topo?.custo != null ? formatMoeda(topo.custo) : '—'}</b></span>}
        </div>
        {d.gargalo && <span className="pl-delta down" title="Etapa mais longe da meta">gargalo: {d.etapas.find(e => e.etapa === d.gargalo)?.nome}</span>}
      </div>
      <div className="crm-custos-grade">
        {d.etapas.map((e, i) => (
          <div key={e.etapa} className={`crm-etapa ${e.situacao === 'CRITICO' ? 'fora-meta' : ''}`} data-custo-etapa={e.etapa} data-situacao={e.situacao ?? ''}>
            <div className="crm-etapa-nome"><Link href={e.crm} title={`Ver ${e.nome} no quadro`}>{i + 1}. {e.nome}</Link><span className="pl-mono">{e.volume.toLocaleString('pt-BR')}</span></div>
            <dl className="crm-linhas">
              <div><dt>Custo/lead</dt><dd className="crm-custo-valor">{isDono ? (e.custo != null ? formatMoeda(e.custo) : '—') : '—'}</dd></div>
              <div><dt>Conv. anterior</dt><dd>{i === 0 ? '—' : pct(d.etapas[i - 1].conversao)}</dd></div>
              <div><dt>Segue adiante</dt><dd>{e.etapa === 'VENDA' ? '—' : pct(e.conversao)}</dd></div>
              <div><dt>Perda na etapa</dt><dd title={e.perda.motivos.map(m => `${m.nome} (${m.n})`).join(' · ')}>{e.etapa === 'VENDA' ? '—' : `${e.perda.n} (${pct(e.perda.pct)})`}</dd></div>
              <div><dt>Tempo</dt><dd>{e.etapa !== 'VENDA' && e.tempoMediano != null ? `${e.tempoMediano.toLocaleString('pt-BR')} d` : '—'}</dd></div>
            </dl>
            {isDono && e.valores && (
              <dl className="crm-linhas">
                <div><dt>Oportunidade</dt><dd className="pl-crm-fin-oportunidade" title={formatMoeda(e.valores.oportunidade)}>{curta(e.valores.oportunidade)}</dd></div>
                <div><dt>Pró-labore</dt><dd title={formatMoeda(e.valores.proLaborePrevisto)}>{curta(e.valores.proLaborePrevisto)}</dd></div>
                <div><dt>Comissão prev.</dt><dd title={formatMoeda(e.valores.comissaoPrevista)}>{curta(e.valores.comissaoPrevista)}</dd></div>
                <div className="pl-crm-fin-perdida"><dt>Comissão perdida</dt><dd title={formatMoeda(e.valores.comissaoPerdida)}>{curta(e.valores.comissaoPerdida)}</dd></div>
              </dl>
            )}
            <div className="crm-etapa-meta">
              {isDono
                ? <button type="button" className="pl-link-action" onClick={() => setEditando(e)} data-editar-metas={e.etapa} title={metaTxt(e) || 'Definir meta'}>{metaTxt(e) ? `Meta: ${metaTxt(e)} ✎` : 'Definir meta ✎'}</button>
                : <span className="pl-hint">{metaTxt(e) ? `Meta: ${metaTxt(e)}` : 'sem meta'}</span>}
              {e.situacao && <span className={`pl-delta ${e.situacao === 'BOM' ? 'up' : 'down'}`}>{e.situacao === 'BOM' ? 'ok' : e.situacao === 'ATENCAO' ? 'atenção' : 'fora'}</span>}
            </div>
          </div>
        ))}
      </div>
      {editando && isDono && <EditarMetas e={editando} fechar={() => setEditando(null)} aoSalvar={() => { setEditando(null); setVersao(v => v + 1) }} />}
    </section>
  )
}
