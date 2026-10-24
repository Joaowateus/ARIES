'use client'

// Aba "Simulação" do Assistente: as taxas de referência da loja para a
// simulação de financiamento (Tabela Price). O robô simula no fim do roteiro
// para quem vai financiar e o vendedor refaz pela conversa. Começa desligada
// e só liga depois de as taxas serem salvas.
import { useEffect, useState } from 'react'
import { proLaboreApi, type ConfigSimulacaoFinanciamento, type DadosSimulacaoFinanciamento } from '@/lib/proLaboreApi'
import { lerReais } from './util'

const REGRAS = [
  'O robô só simula para quem respondeu que vai financiar e cuja moto de interesse tem preço na aba Estoque.',
  'A renda é opcional (o cliente pode responder "pular"). Ela serve só para a leitura do vendedor e nunca vai para a IA.',
  'Entrada menor que a mínima: a simulação usa a mínima e avisa o cliente.',
  'É uma estimativa sem IOF e tarifas: a mensagem nunca diz que o crédito está aprovado.',
  'O preço da moto só aparece para o cliente se "Preço no WhatsApp" estiver ligado na aba Estoque.',
]
const PRAZOS = [6, 10, 12, 15, 18, 24, 30, 36, 42, 48, 60, 72]

type Previa = { texto: string; resumo: string } | { erro: string }

export function Simulacao({ nomeVendedor }: { nomeVendedor?: string }) {
  const [dados, setDados] = useState<DadosSimulacaoFinanciamento | null>(null)
  const [cfg, setCfg] = useState<ConfigSimulacaoFinanciamento | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')
  const [exemplo, setExemplo] = useState({ valor: '20.000', entrada: '4.000', renda: '3.500' })
  const [previa, setPrevia] = useState<Previa | null>(null)

  useEffect(() => {
    let cancelado = false
    proLaboreApi.assistente.simulacao().then(d => { if (!cancelado) { setDados(d); setCfg(d.config) } }).catch(e => { if (!cancelado) setErro((e as Error).message) })
    return () => { cancelado = true }
  }, [])

  // Prévia com as taxas na tela, mesmo antes de salvar.
  useEffect(() => {
    if (!cfg) return
    let vivo = true
    const t = setTimeout(() => {
      const valor = lerReais(exemplo.valor)
      if (!valor) { setPrevia({ erro: 'Informe o valor da moto do exemplo.' }); return }
      proLaboreApi.assistente.previaSimulacao({ config: cfg, valor, entrada: lerReais(exemplo.entrada), renda: lerReais(exemplo.renda), vendedor: nomeVendedor })
        .then(r => { if (vivo) setPrevia({ texto: r.texto, resumo: r.resumo }) })
        .catch(e => { if (vivo) setPrevia({ erro: (e as Error).message }) })
    }, 350)
    return () => { vivo = false; clearTimeout(t) }
  }, [cfg, exemplo, nomeVendedor])

  if (!dados || !cfg) return erro ? <div className="pl-alert pl-alert-error">{erro}</div> : <div className="pl-hint">Carregando…</div>
  const editavel = dados.podeEditar
  const mudarTaxa = (i: number, campo: 'prazo' | 'taxa', valor: number) =>
    setCfg(c => c && ({ ...c, taxas: c.taxas.map((t, j) => (j === i ? { ...t, [campo]: valor } : t)) }))

  async function salvar(extra: { ativa?: boolean } = {}) {
    setSalvando(true)
    setErro('')
    setAviso('')
    try {
      const r = await proLaboreApi.assistente.salvarSimulacao({ ...extra, ...(extra.ativa === undefined && { config: cfg! }) })
      setDados(r)
      if (extra.ativa === undefined) setCfg(r.config)
      setAviso(extra.ativa === true ? 'Simulação ligada: o robô passa a simular para quem vai financiar.' : extra.ativa === false ? 'Simulação desligada no robô. O vendedor ainda pode simular pela conversa.' : 'Taxas salvas.')
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="pl-fu" data-simulacao>
      <div className="pl-card pl-fu-topo">
        <div>
          <div className="pl-card-title">Simulação de financiamento</div>
          <div className="pl-card-sub">O lead chega ao vendedor já com entrada, prazos e parcelas, e com a leitura de quanto a parcela pesa na renda dele. Cálculo pela Tabela Price com as taxas de referência da loja.</div>
          <div className="pl-fu-status">
            <span className={`pl-status-badge ${dados.ativa ? 'bom' : 'neutro'}`}>{dados.ativa ? 'Ligada no robô' : 'Desligada no robô'}</span>
            <span>{dados.salva ? 'Taxas salvas: o vendedor já pode simular pela conversa.' : 'Cadastre e salve as taxas para começar.'}</span>
          </div>
        </div>
        {editavel && (
          <button type="button" role="switch" aria-checked={dados.ativa} className={`pl-as-switch ${dados.ativa ? 'on' : ''}`} onClick={() => salvar({ ativa: !dados.ativa })} disabled={salvando || !dados.salva} data-chave-simulacao>
            <span className="pl-as-switch-trilho" aria-hidden="true"><span /></span>
            <span><b>{dados.ativa ? 'Robô simulando' : 'Ligar no robô'}</b><small>{!dados.salva ? 'Salve as taxas antes' : dados.ativa ? 'Toque para desligar' : 'Simula no fim do roteiro'}</small></span>
          </button>
        )}
      </div>

      <div className="pl-fu-grade">
        <div className="pl-card">
          <div className="pl-as-card-head"><div className="pl-card-title">Taxas de referência</div></div>
          <div className="pl-si-taxas" role="table" aria-label="Taxas por prazo">
            <div className="pl-si-taxa pl-si-taxa-cab" role="row"><span role="columnheader">Prazo</span><span role="columnheader">Taxa ao mês</span><span /></div>
            {cfg.taxas.map((t, i) => (
              <div key={i} className="pl-si-taxa" role="row" data-taxa={i + 1}>
                <select className="pl-input" value={t.prazo} disabled={!editavel} onChange={e => mudarTaxa(i, 'prazo', Number(e.target.value))} aria-label={`Prazo da linha ${i + 1}`}>
                  {PRAZOS.filter(p => p === t.prazo || !cfg.taxas.some(x => x.prazo === p)).map(p => <option key={p} value={p}>{p}x</option>)}
                </select>
                <label className="pl-si-pct">
                  <input className="pl-input" type="number" min={0} max={10} step={0.01} value={t.taxa} disabled={!editavel} onChange={e => mudarTaxa(i, 'taxa', Number(e.target.value) || 0)} aria-label={`Taxa ao mês em ${t.prazo}x`} />
                  <span>%</span>
                </label>
                {editavel && cfg.taxas.length > 1 ? <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setCfg(c => c && ({ ...c, taxas: c.taxas.filter((_, j) => j !== i) }))} aria-label={`Tirar ${t.prazo}x`}>✕</button> : <span />}
              </div>
            ))}
          </div>
          {editavel && cfg.taxas.length < 6 && (
            <button type="button" className="pl-vt-link" style={{ marginTop: 8 }} onClick={() => setCfg(c => {
              if (!c) return c
              const livre = PRAZOS.find(p => p > (c.taxas.at(-1)?.prazo ?? 0) && !c.taxas.some(x => x.prazo === p)) ?? PRAZOS.find(p => !c.taxas.some(x => x.prazo === p))
              return livre ? { ...c, taxas: [...c.taxas, { prazo: livre, taxa: c.taxas.at(-1)?.taxa ?? 2 }] } : c
            })}>+ Prazo</button>
          )}
          <div className="pl-hint" style={{ marginTop: 8 }}>Use as taxas que a financeira parceira pratica hoje. A mensagem sempre diz que é uma simulação ilustrativa.</div>

          <div className="pl-vt-grade" style={{ marginTop: 14 }}>
            <div className="pl-field">
              <label htmlFor="si-entrada">Entrada mínima (% do valor)</label>
              <input id="si-entrada" className="pl-input" type="number" min={0} max={90} value={cfg.entradaMinimaPct} disabled={!editavel} onChange={e => setCfg(c => c && ({ ...c, entradaMinimaPct: Number(e.target.value) || 0 }))} />
            </div>
            <div className="pl-field">
              <label htmlFor="si-comp">Parcela cabe até (% da renda)</label>
              <input id="si-comp" className="pl-input" type="number" min={10} max={60} value={cfg.comprometimentoMax} disabled={!editavel} onChange={e => setCfg(c => c && ({ ...c, comprometimentoMax: Number(e.target.value) || 30 }))} />
            </div>
          </div>
          <button type="button" role="switch" aria-checked={cfg.perguntarRenda} className={`pl-as-switch linha ${cfg.perguntarRenda ? 'on' : ''}`} disabled={!editavel} onClick={() => setCfg(c => c && ({ ...c, perguntarRenda: !c.perguntarRenda }))} data-perguntar-renda>
            <span className="pl-as-switch-trilho" aria-hidden="true"><span /></span>
            <span><b>Perguntar a renda aproximada</b><small>Antes de simular, o robô pergunta a renda (opcional) para dizer se a parcela cabe no bolso. Até {cfg.comprometimentoMax + 10}% da renda é &quot;apertada&quot;.</small></span>
          </button>
          <div className="pl-field" style={{ marginTop: 12 }}>
            <label htmlFor="si-aviso">Aviso no fim da mensagem</label>
            <textarea id="si-aviso" className="pl-input pl-textarea" rows={2} maxLength={300} value={cfg.aviso} disabled={!editavel} onChange={e => setCfg(c => c && ({ ...c, aviso: e.target.value }))} />
            <div className="pl-hint">Use {'{vendedor}'} para o nome do vendedor.</div>
          </div>
          {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 12 }}>{erro}</div>}
          {aviso && <div className="pl-hint" style={{ marginTop: 12 }} data-aviso-simulacao>{aviso}</div>}
          {editavel && <div className="pl-vt-rodape"><button type="button" className="pl-btn pl-btn-primary" onClick={() => salvar()} disabled={salvando} data-salvar-simulacao>{salvando ? 'Salvando…' : 'Salvar taxas'}</button></div>}
        </div>

        <div className="pl-fu-lateral">
          <div className="pl-card" data-previa-simulacao>
            <div className="pl-card-title" style={{ marginBottom: 8 }}>Prévia</div>
            <div className="pl-si-exemplo">
              {([['valor', 'Valor da moto'], ['entrada', 'Entrada'], ['renda', 'Renda']] as const).map(([k, rotulo]) => (
                <div key={k} className="pl-field">
                  <label htmlFor={`si-ex-${k}`}>{rotulo}</label>
                  <input id={`si-ex-${k}`} className="pl-input" inputMode="decimal" value={exemplo[k]} onChange={e => setExemplo(x => ({ ...x, [k]: e.target.value }))} placeholder={k === 'renda' ? 'opcional' : ''} />
                </div>
              ))}
            </div>
            {!previa ? <div className="pl-hint">Calculando…</div> : 'erro' in previa ? <div className="pl-hint">{previa.erro}</div> : (
              <>
                <div className="pl-as-subtitulo" style={{ marginTop: 10 }}>O cliente recebe</div>
                <pre className="pl-vt-previa" data-texto-previa>{previa.texto}</pre>
                <div className="pl-as-subtitulo" style={{ marginTop: 10 }}>O vendedor vê</div>
                <div className="pl-si-leitura" data-resumo-previa>{previa.resumo}</div>
              </>
            )}
          </div>
          <div className="pl-card">
            <div className="pl-card-title" style={{ marginBottom: 8 }}>Como funciona</div>
            <ul className="pl-fu-regras">{REGRAS.map(r => <li key={r}>{r}</li>)}</ul>
          </div>
        </div>
      </div>
    </div>
  )
}
