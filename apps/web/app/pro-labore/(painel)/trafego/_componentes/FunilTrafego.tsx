'use client'

// Jornada do anúncio até o lead no CRM — mesma leitura do funil comercial
// (conversão da etapa anterior, perda, custo por etapa, meta com ok/fora),
// com o Connect rate em destaque. A silhueta usa escala logarítmica:
// impressões e leads têm ordens de grandeza muito diferentes.
import { useState } from 'react'
import type { AnaliseTrafego, EtapaFunilTrafego, EtapaTrafego, MetaEtapaTrafego, ModoEtapaTrafego } from '@/lib/proLaboreApi'
import { minuscula, moeda, num, pct } from './formato'

function Silhueta({ valores, cores }: { valores: number[]; cores: string[] }) {
  const n = valores.length
  const W = 1000, H = 190, MIN = 0.16
  const max = Math.max(1, ...valores)
  const visuais: number[] = []
  for (const v of valores) visuais.push(Math.min(v, visuais.at(-1) ?? v))
  const alturas = visuais.map(v => MIN + (1 - MIN) * (Math.log10(v + 1) / Math.log10(max + 1)))
  const passo = n > 1 ? W / (n - 1) : W
  const x = (i: number) => i * passo
  const meia = (i: number) => (alturas[i] * H) / 2
  const meio = H / 2
  let d = `M 0 ${meio - meia(0)}`
  for (let i = 0; i < n - 1; i++) {
    const mx = (x(i) + x(i + 1)) / 2
    d += ` C ${mx} ${meio - meia(i)}, ${mx} ${meio - meia(i + 1)}, ${x(i + 1)} ${meio - meia(i + 1)}`
  }
  d += ` L ${x(n - 1)} ${meio + meia(n - 1)}`
  for (let i = n - 1; i > 0; i--) {
    const mx = (x(i) + x(i - 1)) / 2
    d += ` C ${mx} ${meio + meia(i)}, ${mx} ${meio + meia(i - 1)}, ${x(i - 1)} ${meio + meia(i - 1)}`
  }
  d += ' Z'
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 170, display: 'block' }} aria-hidden="true">
      <defs>
        <linearGradient id="tfGrad" x1="0" y1="0" x2="1" y2="0">
          {cores.map((c, i) => <stop key={i} offset={`${n > 1 ? (i / (n - 1)) * 100 : 0}%`} stopColor={c} />)}
        </linearGradient>
      </defs>
      <path d={d} fill="url(#tfGrad)" />
    </svg>
  )
}

function rotuloMeta(m: MetaEtapaTrafego | null, rotuloConv: string | null, codigo: string) {
  if (!m) return 'Definir meta'
  return m.tipo === 'CONV_MIN' ? `Meta: ${rotuloConv ?? 'conv.'} ≥ ${pct(m.valor, Number.isInteger(Math.round(m.valor * 1e6) / 1e4) ? 0 : 1)}` : `Meta: custo ≤ ${moeda(m.valor, codigo)}`
}

function Variacao({ atual, anterior }: { atual: number; anterior: number }) {
  if (!anterior) return null
  const v = atual / anterior - 1
  if (Math.abs(v) < 0.005) return <span className="pl-tf-var">= anterior</span>
  return <span className="pl-tf-var">{v > 0 ? '▲' : '▼'} {pct(Math.abs(v), 0)} vs anterior</span>
}

export default function FunilTrafego({ analise, onMeta, onEtapas, onCrmSomenteTrafego, onAtualizarCustoTopo }: {
  analise: AnaliseTrafego
  onMeta: (etapa: EtapaTrafego, meta: MetaEtapaTrafego | null) => Promise<void>
  onEtapas: (etapas: Partial<Record<EtapaTrafego, ModoEtapaTrafego>>) => Promise<void>
  onCrmSomenteTrafego: (v: boolean) => Promise<void>
  onAtualizarCustoTopo: (valor: number) => Promise<void>
}) {
  const codigo = analise.conta.moeda
  const etapas = analise.funil
  const [editando, setEditando] = useState<EtapaTrafego | null>(null)
  const [tipo, setTipo] = useState<MetaEtapaTrafego['tipo']>('CONV_MIN')
  const [valor, setValor] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [ajustesAbertos, setAjustesAbertos] = useState(false)

  function editar(e: EtapaFunilTrafego) {
    setEditando(e.chave)
    const t = e.meta?.tipo ?? (e.convAnterior == null ? 'CUSTO_MAX' : 'CONV_MIN')
    setTipo(t)
    setValor(e.meta ? String(t === 'CONV_MIN' ? +(e.meta.valor * 100).toFixed(2) : e.meta.valor) : '')
  }
  async function salvar(e: EtapaFunilTrafego, remover = false) {
    setSalvando(true)
    try {
      if (remover) await onMeta(e.chave, null)
      else {
        const v = Number(valor.replace(',', '.'))
        if (!Number.isFinite(v) || v < 0) return
        await onMeta(e.chave, { tipo, valor: tipo === 'CONV_MIN' ? v / 100 : v })
      }
      setEditando(null)
    } finally {
      setSalvando(false)
    }
  }

  const cores = etapas.map(e => (e.status === true ? 'var(--pl-good)' : e.status === false ? 'var(--pl-critical)' : 'var(--sv-1)'))
  const colunas = { gridTemplateColumns: `repeat(${etapas.length}, minmax(96px, 1fr))` }
  const final = etapas.at(-1)
  const crmEtapa = etapas.find(e => e.chave === 'leadsCrm')
  const custoReal = analise.crm.custoReal
  const custoTopo = analise.crm.custoPorLeadTopo
  const diferente = custoReal != null && (custoTopo === 0 || Math.abs(custoReal / custoTopo - 1) > 0.02)
  const opcionais = (['destino', 'contatos'] as const)
  const modos = analise.conta.configuracao.etapas ?? {}

  return (
    <div>
      <div className="pl-tf-funil-topo">
        <div className="pl-tf-resumo">
          <span>Investimento <b>{moeda(analise.totais.gasto, codigo)}</b></span>
          {final && <span>→ <b>{num(final.valor)}</b> {minuscula(final.nome)}</span>}
          {final?.custo != null && final.chave !== 'impressoes' && <span>= <b>{moeda(final.custo, codigo)}</b> ({final.rotuloCusto})</span>}
        </div>
        <button type="button" className="pl-btn pl-btn-ghost pl-tf-btn-peq" onClick={() => setAjustesAbertos(a => !a)} aria-expanded={ajustesAbertos}>Ajustar etapas</button>
      </div>

      {ajustesAbertos && (
        <div className="pl-tf-ajustes">
          {opcionais.map(k => (
            <label key={k}>
              <span>{k === 'destino' ? 'Chegada (página / WhatsApp)' : 'Contatos da Meta (conversas / leads)'}</span>
              <select className="pl-select" value={modos[k] ?? 'auto'} onChange={e => void onEtapas({ [k]: e.target.value as ModoEtapaTrafego })}>
                <option value="auto">Automático (aparece se tiver dado)</option>
                <option value="sim">Sempre mostrar</option>
                <option value="nao">Esconder</option>
              </select>
            </label>
          ))}
          <label>
            <span>Leads no CRM</span>
            <select className="pl-select" value={analise.crm.somenteTrafego ? 'trafego' : 'todos'} onChange={e => void onCrmSomenteTrafego(e.target.value === 'trafego')}>
              <option value="trafego">Só os marcados como “Tráfego” (recomendado)</option>
              <option value="todos">Todos os leads cadastrados</option>
            </select>
          </label>
        </div>
      )}

      <div className="pl-journey-scroll">
        <div className="pl-journey-inner" style={{ minWidth: etapas.length * 110 }}>
          <div className="pl-journey-row" style={colunas}>
            {etapas.map((e, i) => (
              <div key={e.chave} style={{ textAlign: 'center', paddingBottom: 10, borderLeft: i > 0 ? '1px solid var(--pl-border)' : 'none' }}>
                <div className="pl-stage-name">{e.nome}</div>
              </div>
            ))}
          </div>

          <div style={{ position: 'relative' }}>
            <Silhueta valores={etapas.map(e => e.valor)} cores={cores} />
            <div className="pl-journey-row" style={{ ...colunas, position: 'absolute', inset: 0, alignItems: 'center' }}>
              {etapas.map(e => (
                <div key={e.chave} className="pl-tf-na-faixa">
                  {e.convAnterior == null ? <b>100%</b> : <><b>{pct(e.convAnterior, e.convAnterior < 0.1 ? 2 : 1)}</b><small>{e.rotuloConv}</small></>}
                </div>
              ))}
            </div>
          </div>

          <div className="pl-journey-row" style={{ ...colunas, marginTop: 10 }}>
            {etapas.map(e => (
              <div key={e.chave} style={{ textAlign: 'center' }}>
                <div className="pl-stage-value pl-mono" style={{ fontSize: 20 }}>{num(e.valor)}</div>
                <Variacao atual={e.valor} anterior={e.valorAnterior} />
              </div>
            ))}
          </div>

          <div className="pl-journey-details pl-journey-row" style={{ ...colunas, gap: 4, marginTop: 4 }}>
            {etapas.map((e, i) => (
              <div key={e.chave} style={{ textAlign: 'center' }}>
                {e.detalhe && <div className="pl-stage-conv pl-tf-detalhe">{e.detalhe}</div>}
                <div className="pl-stage-conv">
                  {i === 0 ? 'topo do funil' : <>{e.connectRate ? <span className="pl-tf-cr">Connect rate</span> : e.rotuloConv} <b>{pct(e.convAnterior, e.convAnterior != null && e.convAnterior < 0.1 ? 2 : 1)}</b></>}
                </div>
                {e.perda != null && <div className="pl-stage-conv">Perda <b>{num(e.perda)} ({pct(e.perdaPct, 0)})</b></div>}
                {editando === e.chave ? (
                  <div className="pl-tf-meta-edit">
                    <select className="pl-select" value={tipo} onChange={ev => setTipo(ev.target.value as MetaEtapaTrafego['tipo'])}>
                      {e.convAnterior != null && <option value="CONV_MIN">{e.rotuloConv ?? 'Conversão'} mín. (%)</option>}
                      <option value="CUSTO_MAX">{e.rotuloCusto} máx. (R$)</option>
                    </select>
                    <div>
                      <input className="pl-input" inputMode="decimal" autoFocus value={valor} onChange={ev => setValor(ev.target.value)} onKeyDown={ev => { if (ev.key === 'Enter') void salvar(e); if (ev.key === 'Escape') setEditando(null) }} aria-label="Valor da meta" />
                      <button type="button" className="pl-link-action" disabled={salvando} onClick={() => void salvar(e)}>OK</button>
                    </div>
                    {e.meta && !e.metaPadrao && <button type="button" className="pl-link-action" disabled={salvando} onClick={() => void salvar(e, true)}>Tirar meta</button>}
                  </div>
                ) : (
                  <div className="pl-stage-conv" style={{ marginTop: 6 }}>
                    <span className="pl-link-action" role="button" tabIndex={0} onClick={() => editar(e)} onKeyDown={ev => { if (ev.key === 'Enter') editar(e) }} title={e.metaPadrao ? 'Referência de mercado — clique pra definir a sua' : 'Editar meta'}>
                      {rotuloMeta(e.meta, e.rotuloConv, codigo)}{e.metaPadrao ? ' (ref.)' : ''} ✎
                    </span>
                    {e.status != null && <span className={`pl-delta ${e.status ? 'up' : 'down'}`}>{e.status ? 'ok' : 'fora'}</span>}
                  </div>
                )}
                <div className="pl-stage-conv">{e.rotuloCusto} <b>{moeda(e.custo, codigo)}</b></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {crmEtapa ? (
        <div className="pl-tf-ponte">
          <div>
            <b>Custo real por lead que chegou no CRM: {moeda(custoReal, codigo)}</b>
            <small>
              {moeda(analise.totais.gasto, codigo)} investidos ÷ {num(crmEtapa.valor)} leads {analise.crm.somenteTrafego ? 'marcados como “Tráfego”' : 'cadastrados'} no período.
              {' '}No funil comercial (Dashboard) o “custo por lead do topo” está em <b>{moeda(custoTopo, codigo)}</b>.
            </small>
          </div>
          {diferente && custoReal != null && (
            <button type="button" className="pl-btn pl-btn-primary pl-tf-btn-peq" onClick={() => void onAtualizarCustoTopo(Math.round(custoReal * 100) / 100)}>
              Usar {moeda(custoReal, codigo)} no funil comercial
            </button>
          )}
        </div>
      ) : analise.filtro.campanhaId || analise.filtro.adsetId ? (
        <div className="pl-tf-ponte"><small>Leads do CRM não sabem de qual campanha vieram, então a etapa “Leads no CRM” só aparece com todas as campanhas.</small></div>
      ) : null}
    </div>
  )
}
