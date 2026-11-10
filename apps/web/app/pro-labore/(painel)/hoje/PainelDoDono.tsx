'use client'

// Ajuste 1 · Painel do Hoje do dono. De cima para baixo: Agora, Jornada de
// compra (10 etapas em 3 fases), Indicadores do mês, Faturamento, Pró-labore e
// comissões (só o dono), Equipe e Anúncios. Filtros valem para o Painel inteiro;
// todo gráfico alterna para tabela; todos os números vêm do dicionário.
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { painelDonoApi, type EtapaPainel, type FiltrosPainelWeb, type LeituraPainel, type PainelDono, type SerieMensal, type StatusFaixa } from '@/lib/proLaboreApi'
import { StatusChip, TelaVazia, fmtValor } from '../_padrao/Padrao'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const hoje = () => new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10)
const inicioDoMes = () => `${hoje().slice(0, 8)}01`
const NOME_ORIGEM: Record<string, string> = { ANUNCIO: 'Anúncio', ORGANICO: 'Orgânico', INDICACAO: 'Indicação', DESCONHECIDA: 'Desconhecida' }
const NOME_FORMA: Record<string, string> = { A_VISTA: 'À vista', FINANCIAMENTO: 'Financiamento', CONSORCIO: 'Consórcio' }
const st = (s: StatusFaixa) => s ?? undefined

export function PainelDoDono({ papel }: { papel: string }) {
  const dono = papel === 'DONO'
  const [f, setF] = useState<FiltrosPainelWeb>({ inicio: inicioDoMes(), fim: hoje() })
  const [d, setD] = useState<PainelDono | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ops, setOps] = useState<{ vendedores: Array<{ id: string; nome: string }>; sdrs: Array<{ id: string; nome: string }>; origens: string[]; formasPagamento: string[] } | null>(null)
  const [versao, setVersao] = useState(0)
  const carregar = useCallback(() => setVersao(v => v + 1), [])
  useEffect(() => {
    let vivo = true
    painelDonoApi.painel(f).then(x => { if (vivo) { setD(x); setErro(null) } }).catch(e => { if (vivo) setErro(e instanceof Error ? e.message : 'Não foi possível carregar o Painel') })
    return () => { vivo = false }
  }, [f, versao])
  useEffect(() => { painelDonoApi.opcoes().then(setOps).catch(() => setOps(null)) }, [])
  const set = (k: keyof FiltrosPainelWeb, v: string) => setF(x => ({ ...x, [k]: v || undefined }))

  return (
    <div data-painel-dono>
      <header style={{ marginBottom: 12 }}>
        <h1 className="ar-titulo" style={{ margin: 0 }}>Painel</h1>
        <p className="pl-hint" style={{ margin: '4px 0 0' }}>Como está o negócio no período, etapa por etapa? · {dono ? 'Dono' : 'Supervisor (sem as cifras do dono)'}</p>
      </header>
      <section className="pl-card" style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }} aria-label="Filtros do Painel" data-filtros-painel>
        <label className="pl-hint">De <input className="pl-input" type="date" value={f.inicio ?? ''} onChange={e => set('inicio', e.target.value)} style={{ width: 150 }} /></label>
        <label className="pl-hint">até <input className="pl-input" type="date" value={f.fim ?? ''} onChange={e => set('fim', e.target.value)} style={{ width: 150 }} /></label>
        <button type="button" className="pl-btn" onClick={() => setF(x => ({ ...x, inicio: inicioDoMes(), fim: hoje() }))}>Este mês</button>
        <select className="pl-input" style={{ width: 'auto' }} value={f.vendedorId ?? ''} onChange={e => set('vendedorId', e.target.value)} aria-label="Vendedor"><option value="">Todos os vendedores</option>{ops?.vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}</select>
        <select className="pl-input" style={{ width: 'auto' }} value={f.sdrId ?? ''} onChange={e => set('sdrId', e.target.value)} aria-label="SDR"><option value="">Todos os SDRs</option>{ops?.sdrs.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}</select>
        <select className="pl-input" style={{ width: 'auto' }} value={f.origem ?? ''} onChange={e => set('origem', e.target.value)} aria-label="Origem"><option value="">Todas as origens</option>{ops?.origens.map(o => <option key={o} value={o}>{NOME_ORIGEM[o] ?? o}</option>)}</select>
        <select className="pl-input" style={{ width: 'auto' }} value={f.formaPagamento ?? ''} onChange={e => set('formaPagamento', e.target.value)} aria-label="Forma de pagamento"><option value="">Todas as formas de pagamento</option>{ops?.formasPagamento.map(o => <option key={o} value={o}>{NOME_FORMA[o] ?? o}</option>)}</select>
      </section>
      {erro && <TelaVazia titulo="Não deu para montar o Painel">{erro}</TelaVazia>}
      {!d && !erro && <p className="pl-hint">Calculando o Painel pelo dicionário de métricas…</p>}
      {d && <>
        {d.avisos.length > 0 && <p className="pl-hint" data-avisos-painel>{d.avisos.join(' ')}</p>}
        <Secao n={1} titulo="Agora">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
            <Cartao l={d.agora.faturamento} extra={d.agora.faturamento.meta != null ? <>meta {fmtValor(d.agora.faturamento.meta, 'BRL')}{d.agora.faturamento.projecao != null ? ` · projeção ${fmtValor(d.agora.faturamento.projecao, 'BRL')}` : ''}</> : null} status={d.agora.faturamento.statusMeta} />
            {d.agora.conversao && <Cartao l={d.agora.conversao} />}
            {d.agora.custoPorVenda && <Cartao l={d.agora.custoPorVenda} />}
          </div>
        </Secao>
        <Jornada d={d} dono={dono} aoMudar={carregar} />
        <Secao n={3} titulo="Indicadores do mês">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>{d.indicadores.map(l => <Cartao key={l.chave} l={l} />)}</div>
        </Secao>
        <Secao n={4} titulo="Faturamento">
          <Grafico titulo="Receita mensal do ano" serie={d.faturamento.receitaMensal} unidade="BRL" />
          <p style={{ marginTop: 8 }} data-acumulado>Faturamento acumulado no ano: <b>{fmtValor(d.faturamento.acumulado, 'BRL')}</b>{d.faturamento.metaAnual ? <> contra a meta anual de <b>{fmtValor(d.faturamento.metaAnual, 'BRL')}</b> ({Math.round((d.faturamento.acumulado / d.faturamento.metaAnual) * 1000) / 10}%) <StatusChip status={st(d.faturamento.statusMeta)} /></> : ' (sem meta anual em Metas e premissas)'}</p>
        </Secao>
        {d.proLabore && (
          <Secao n={5} titulo="Pró-labore e comissões">
            <Grafico titulo="Pró-labore mensal" serie={d.proLabore.proLaboreMensal ?? []} unidade="BRL" />
            <Grafico titulo="Comissões pagas mês a mês" serie={d.proLabore.comissoesMensais ?? []} unidade="BRL" />
            <p data-ja-pago>Quanto você já pagou aos vendedores no ano: <b>{fmtValor(d.proLabore.jaPagoAosVendedores, 'BRL')}</b></p>
            <table className="pl-table"><thead><tr><th>Receita e pró-labore</th><th>Receita</th><th>Pró-labore</th></tr></thead>
              <tbody>{d.proLabore.detalhado.map(x => <tr key={x.nome}><td>{x.nome}</td><td>{fmtValor(x.receita, 'BRL')}</td><td>{fmtValor(x.proLabore, 'BRL')}</td></tr>)}</tbody></table>
          </Secao>
        )}
        <Secao n={6} titulo="Equipe">
          <Ranking titulo="Vendedores por faturamento" linhas={d.equipe.vendedores.map(v => ({ nome: v.nome, valor: v.valor, extra: `${v.vendas} venda(s)` }))} unidade="BRL" />
          <Ranking titulo="SDRs por leads passados ao vendedor" linhas={d.equipe.sdrs.map(v => ({ nome: v.nome, valor: v.valor }))} unidade="QTD" vazio="Nenhum SDR cadastrado." />
        </Secao>
        <Secao n={7} titulo="Anúncios">
          <Grafico titulo="ROAS mensal" serie={d.anuncios.roasMensal} unidade="X" />
          {d.anuncios.custoPorLeadMensal && <Grafico titulo="Custo por lead mensal" serie={d.anuncios.custoPorLeadMensal} unidade="BRL" />}
        </Secao>
        <p className="pl-hint">Todos os números vêm do dicionário de métricas; a comparação é com o mesmo intervalo do período anterior. Calculado às {new Date(d.geradoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.</p>
      </>}
    </div>
  )
}

function Secao({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return <section className="pl-card" style={{ marginBottom: 12 }} data-secao-painel={n}><div className="pl-card-title" style={{ marginBottom: 10 }}>{n}) {titulo}</div>{children}</section>
}

function Cartao({ l, extra, status }: { l: LeituraPainel; extra?: React.ReactNode; status?: StatusFaixa }) {
  return (
    <div style={{ border: '1px solid var(--pl-border)', borderRadius: 10, padding: 10, minWidth: 0 }} data-indicador={l.chave}>
      <div className="pl-hint" style={{ fontSize: 12 }}>{l.nome}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}><b style={{ fontSize: 20 }}>{fmtValor(l.valor, l.unidade)}</b><StatusChip status={st(status ?? l.status)} /></div>
      <div className="pl-hint" style={{ fontSize: 12 }}>{l.variacao != null ? `${l.variacao > 0 ? '+' : ''}${l.variacao.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% contra ${l.anterior ? `${l.anterior.periodo.inicio.slice(8)}/${l.anterior.periodo.inicio.slice(5, 7)} a ${l.anterior.periodo.fim.slice(8)}/${l.anterior.periodo.fim.slice(5, 7)}` : 'o período anterior'}` : l.anterior?.valor === 0 || l.anterior?.valor == null ? 'sem base para comparar' : ''}{extra ? <> · {extra}</> : null}</div>
    </div>
  )
}

function Jornada({ d, dono, aoMudar }: { d: PainelDono; dono: boolean; aoMudar: () => void }) {
  const [editando, setEditando] = useState<EtapaPainel | null>(null)
  const fases = d.jornada.fases
  return (
    <Secao n={2} titulo="Jornada de compra">
      {(d.jornada.excluidos.aVista > 0 || d.jornada.excluidos.semVisita > 0) && <p className="pl-hint" style={{ marginTop: 0 }}>Exclusões aprovadas aplicadas: {d.jornada.excluidos.aVista} à vista fora de MQL e SQL; {d.jornada.excluidos.semVisita} venda(s) sem visita fora de Agendamento e Visita.</p>}
      <div style={{ display: 'grid', gap: 14 }}>
        {fases.map(fa => (
          <div key={fa.fase} data-fase-painel={fa.fase}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 6 }}>
              <div className="pl-eyebrow">{fa.nome}</div>
              <span className="pl-hint" style={{ fontSize: 12 }} data-subtotal-fase>Subtotal: {fa.entraram} entraram{fa.conversao != null ? ` · ${fa.conversao}% seguiram para a fase seguinte` : ''} · {fa.perdidos} perdido(s){fa.custo != null ? ` · custo de entrada ${fmtValor(fa.custo, 'BRL')}` : ''}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8 }}>
              {d.jornada.etapas.filter(e => e.fase === fa.fase).map(e => <CartaoEtapa key={e.etapa} e={e} gargalo={d.jornada.gargalo === e.etapa} dono={dono} editar={() => setEditando(e)} />)}
            </div>
          </div>
        ))}
      </div>
      {editando && dono && <EditarMetas e={editando} fechar={() => setEditando(null)} aoSalvar={() => { setEditando(null); aoMudar() }} />}
      <TabelaJornada etapas={d.jornada.etapas} dono={dono} />
    </Secao>
  )
}

function CartaoEtapa({ e, gargalo, dono, editar }: { e: EtapaPainel; gargalo: boolean; dono: boolean; editar: () => void }) {
  const borda = e.situacao === 'CRITICO' ? 'var(--pl-critical)' : e.situacao === 'ATENCAO' ? 'var(--pl-warning, #b7791f)' : 'var(--pl-border)'
  return (
    <div style={{ border: `1px solid ${borda}`, borderWidth: gargalo ? 2 : 1, borderRadius: 10, padding: 10, fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 4 }} data-etapa-painel={e.etapa} data-situacao={e.situacao ?? ''}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center' }}>
        <Link href={e.crm} style={{ fontWeight: 600, fontSize: 14 }} data-abrir-crm>{e.nome}</Link>
        <StatusChip status={st(e.situacao)} />
      </div>
      {gargalo && <div style={{ fontWeight: 600 }} data-gargalo>Gargalo{e.rec ? <> · <Link href={`/pro-labore/recomendacoes?rec=${e.rec.id}`}>{e.rec.codigo ?? 'Recomendação'}</Link></> : ''}</div>}
      <div>Volume: <b>{e.volume}</b></div>
      {e.etapa !== 'VENDA' && <>
        <div>Conversão: <b>{e.conversao != null ? `${e.conversao.toLocaleString('pt-BR')}%` : '—'}</b> <span className="pl-hint">{e.metas.conversaoMin != null ? `meta ${e.metas.conversaoMin}%` : e.conversaoHistorico != null ? `histórico ${e.conversaoHistorico}%` : 'sem meta'}</span></div>
        <div>Perda: <b>{e.perda.pct != null ? `${e.perda.pct.toLocaleString('pt-BR')}%` : '—'} ({e.perda.n})</b> <span className="pl-hint">{e.metas.perdaMax != null ? `máx. ${e.metas.perdaMax}%` : ''}</span></div>
        {e.perda.motivos.length > 0 && <div className="pl-hint">{e.perda.motivos.map(m => `${m.nome} (${m.n})`).join(' · ')}</div>}
        <div>Tempo (mediana): <b>{e.tempoMediano != null ? `${e.tempoMediano.toLocaleString('pt-BR')} d` : '—'}</b> <span className="pl-hint">{e.metas.tempoMaxDias != null ? `máx. ${e.metas.tempoMax.valor} ${e.metas.tempoMax.unidade.toLowerCase()}` : 'sem tempo máximo'}</span></div>
      </>}
      {dono && <div>Custo: <b>{fmtValor(e.custo, 'BRL')}</b> <span className="pl-hint">{e.metas.custoMax != null ? `máx. ${fmtValor(e.metas.custoMax, 'BRL')}` : ''}</span></div>}
      {dono && e.valores && <div className="pl-hint" data-valores-etapa>Oportunidade {fmtValor(e.valores.oportunidade, 'BRL')} · Pró-labore previsto {fmtValor(e.valores.proLaborePrevisto, 'BRL')} · Comissão prevista {fmtValor(e.valores.comissaoPrevista, 'BRL')} · Comissão perdida {fmtValor(e.valores.comissaoPerdida, 'BRL')}</div>}
      {dono && <button type="button" className="pl-link" style={{ alignSelf: 'flex-start', fontSize: 12 }} onClick={editar} data-editar-metas={e.etapa}>Metas da etapa</button>}
    </div>
  )
}

export function EditarMetas({ e, fechar, aoSalvar }: { e: EtapaPainel; fechar: () => void; aoSalvar: () => void }) {
  const [c, setC] = useState(e.metas.conversaoMin?.toString() ?? ''), [p, setP] = useState(e.metas.perdaMax?.toString() ?? ''), [k, setK] = useState(e.metas.custoMax?.toString() ?? '')
  const [j, setJ] = useState(''), [msg, setMsg] = useState<string | null>(null)
  const n = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')))
  async function salvar() {
    try { await painelDonoApi.salvarMeta(e.etapa, { conversaoMin: n(c), perdaMax: n(p), custoMax: n(k), justificativa: j }); aoSalvar() } catch (x) { setMsg(x instanceof Error ? x.message : 'Não foi possível salvar') }
  }
  return (
    <div className="pl-card" style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }} data-form-metas={e.etapa}>
      <b style={{ width: '100%' }}>Metas de {e.nome}</b>
      <label className="pl-hint">Conversão mínima (%)<input className="pl-input" inputMode="decimal" value={c} onChange={x => setC(x.target.value)} style={{ width: 110 }} /></label>
      <label className="pl-hint">Perda máxima (%)<input className="pl-input" inputMode="decimal" value={p} onChange={x => setP(x.target.value)} style={{ width: 110 }} /></label>
      <label className="pl-hint">Custo máximo (R$)<input className="pl-input" inputMode="decimal" value={k} onChange={x => setK(x.target.value)} style={{ width: 120 }} /></label>
      <label className="pl-hint" style={{ flex: 1, minWidth: 200 }}>Motivo (fica no histórico)<input className="pl-input" value={j} onChange={x => setJ(x.target.value)} /></label>
      <button type="button" className="pl-btn pl-btn-primary" onClick={() => void salvar()} data-salvar-metas>Salvar</button>
      <button type="button" className="pl-btn" onClick={fechar}>Cancelar</button>
      <span className="pl-hint" style={{ width: '100%' }}>O tempo máximo de cada etapa fica em Metas e premissas (o mesmo número que marca o lead parado).</span>
      {msg && <span className="pl-hint" role="alert">{msg}</span>}
    </div>
  )
}

function TabelaJornada({ etapas, dono }: { etapas: EtapaPainel[]; dono: boolean }) {
  return (
    <details style={{ marginTop: 10 }}>
      <summary className="pl-hint" style={{ cursor: 'pointer' }}>Ver a jornada em tabela</summary>
      <div style={{ overflowX: 'auto' }}><table className="pl-table" data-tabela-jornada><thead><tr><th>Etapa</th><th>Volume</th><th>Conversão</th><th>Perda</th><th>Tempo (mediana)</th>{dono && <th>Custo</th>}<th>Situação</th></tr></thead>
        <tbody>{etapas.map(e => <tr key={e.etapa}><td>{e.nome}</td><td>{e.volume}</td><td>{e.conversao != null ? `${e.conversao}%` : '—'}</td><td>{e.perda.pct != null ? `${e.perda.pct}%` : '—'} ({e.perda.n})</td><td>{e.tempoMediano != null ? `${e.tempoMediano} d` : '—'}</td>{dono && <td>{fmtValor(e.custo, 'BRL')}</td>}<td><StatusChip status={st(e.situacao)} /></td></tr>)}</tbody></table></div>
    </details>
  )
}

// Gráfico de barras de uma série mensal (uma cor só, eixos discretos, valor ao passar o mouse) com alternância para tabela.
function Grafico({ titulo, serie, unidade }: { titulo: string; serie: SerieMensal; unidade: string }) {
  const [tabela, setTabela] = useState(false)
  const max = Math.max(0, ...serie.map(x => x.valor ?? 0))
  const W = 560, H = 150, pad = 18, bw = Math.min(34, (W - pad * 2) / Math.max(1, serie.length) - 8)
  return (
    <div style={{ marginBottom: 12 }} data-grafico={titulo}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{titulo}</div>
        <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setTabela(t => !t)} data-alternar-tabela aria-pressed={tabela}>{tabela ? 'Ver gráfico' : 'Ver tabela'}</button>
      </div>
      {tabela ? (
        <table className="pl-table" data-tabela-grafico><thead><tr><th>Mês</th><th>{titulo}</th></tr></thead><tbody>{serie.map(x => <tr key={x.mes}><td>{MESES[x.mes - 1]}</td><td>{fmtValor(x.valor, unidade)}</td></tr>)}</tbody></table>
      ) : !serie.some(x => (x.valor ?? 0) > 0) ? <p className="pl-hint">Sem valores no ano ainda.</p> : (
        <svg viewBox={`0 0 ${W} ${H + 22}`} role="img" aria-label={titulo} style={{ width: '100%', maxWidth: W, height: 'auto' }} data-svg-grafico>
          <line x1={pad} x2={W - pad} y1={H} y2={H} stroke="var(--pl-border)" strokeWidth={1} />
          {serie.map((x, i) => {
            const h = max > 0 ? ((x.valor ?? 0) / max) * (H - 16) : 0
            const cx = pad + i * ((W - pad * 2) / serie.length) + 4
            return (
              <g key={x.mes}>
                <rect x={cx} y={H - h} width={bw} height={Math.max(0, h)} rx={4} fill="var(--pl-ink-2)"><title>{`${MESES[x.mes - 1]}: ${fmtValor(x.valor, unidade)}`}</title></rect>
                <text x={cx + bw / 2} y={H + 14} textAnchor="middle" fontSize="10" fill="var(--pl-ink-muted)">{MESES[x.mes - 1]}</text>
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

function Ranking({ titulo, linhas, unidade, vazio }: { titulo: string; linhas: Array<{ nome: string; valor: number; extra?: string }>; unidade: string; vazio?: string }) {
  const max = Math.max(1, ...linhas.map(l => l.valor))
  return (
    <div style={{ marginBottom: 12 }} data-ranking={titulo}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{titulo}</div>
      {!linhas.length ? <p className="pl-hint">{vazio ?? 'Sem dados no período.'}</p> : (
        <table className="pl-table"><tbody>{linhas.map((l, i) => (
          <tr key={l.nome}><td style={{ width: 28 }}>{i + 1}º</td><td>{l.nome}</td>
            <td style={{ width: '40%' }}><div style={{ background: 'var(--pl-surface-2)', borderRadius: 4, height: 8 }}><div style={{ width: `${(l.valor / max) * 100}%`, background: 'var(--pl-ink-2)', height: 8, borderRadius: 4 }} /></div></td>
            <td style={{ textAlign: 'right' }}>{fmtValor(l.valor, unidade)}{l.extra ? <span className="pl-hint"> · {l.extra}</span> : null}</td></tr>
        ))}</tbody></table>
      )}
    </div>
  )
}
