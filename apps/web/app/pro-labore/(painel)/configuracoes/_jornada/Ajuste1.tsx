'use client'

// Ajuste 1 · Configurações: blocos do Daily (ordem, tempo e ligado; só o dono)
// e o teste do Ajuste 1 calculado na produção.
import { useEffect, useState } from 'react'
import { ITENS_AJUSTE1, dailyApi, painelDonoApi, type AceiteAjuste1, type BlocoDaily } from '@/lib/proLaboreApi'

type Bloco = { chave: BlocoDaily; nome: string; minutos: number; ligado: boolean }

export function ConfigDaily() {
  const [blocos, setBlocos] = useState<Bloco[] | null>(null)
  const [just, setJust] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => { dailyApi.config().then(r => setBlocos(r.blocos)).catch(() => setBlocos(null)) }, [])
  if (!blocos) return null
  const mover = (i: number, d: -1 | 1) => setBlocos(bs => { if (!bs) return bs; const j = i + d; if (j < 0 || j >= bs.length) return bs; const c = [...bs]; [c[i], c[j]] = [c[j], c[i]]; return c })
  const total = blocos.filter(b => b.ligado).reduce((t, b) => t + b.minutos, 0)
  async function salvar() {
    if (just.trim().length < 5) { setMsg('Escreva o motivo (fica no histórico).'); return }
    try { await dailyApi.salvarConfig(blocos!.map(b => ({ chave: b.chave, minutos: b.minutos, ligado: b.ligado })), just.trim()); setMsg('Blocos do Daily salvos.'); setJust('') } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível salvar') }
  }
  return (
    <section className="pl-card" id="config-daily" style={{ marginBottom: 20 }} data-config-daily>
      <div className="pl-card-head"><div>
        <div className="pl-card-title">Daily: blocos, ordem e tempo</div>
        <div className="pl-card-sub">A reunião da manhã no Hoje. Só você muda; cada mudança fica no histórico. Total ligado: {total} min.</div>
      </div></div>
      <table className="pl-table"><thead><tr><th>Ordem</th><th>Bloco</th><th>Minutos</th><th>Ligado</th></tr></thead>
        <tbody>{blocos.map((b, i) => (
          <tr key={b.chave} data-bloco-config={b.chave}>
            <td style={{ whiteSpace: 'nowrap' }}><button type="button" className="pl-btn pl-btn-ghost" onClick={() => mover(i, -1)} aria-label={`Subir ${b.nome}`}>↑</button><button type="button" className="pl-btn pl-btn-ghost" onClick={() => mover(i, 1)} aria-label={`Descer ${b.nome}`}>↓</button></td>
            <td>{b.nome}</td>
            <td><input className="pl-input" type="number" min={1} max={30} value={b.minutos} onChange={e => setBlocos(bs => bs!.map(x => (x.chave === b.chave ? { ...x, minutos: Number(e.target.value) || 1 } : x)))} style={{ width: 80 }} aria-label={`Minutos de ${b.nome}`} /></td>
            <td><input type="checkbox" checked={b.ligado} onChange={e => setBlocos(bs => bs!.map(x => (x.chave === b.chave ? { ...x, ligado: e.target.checked } : x)))} aria-label={`Ligar ${b.nome}`} /></td>
          </tr>
        ))}</tbody></table>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <input className="pl-input" style={{ flex: 1, minWidth: 220 }} placeholder="Motivo da mudança (obrigatório)" value={just} onChange={e => setJust(e.target.value)} aria-label="Motivo" />
        <button type="button" className="pl-btn pl-btn-primary" onClick={() => void salvar()} data-salvar-daily>Salvar</button>
      </div>
      {msg && <p className="pl-hint" role="status">{msg}</p>}
    </section>
  )
}

function Selo({ passa }: { passa: boolean | null }) {
  if (passa == null) return <span className="pl-hint">sem casos ainda</span>
  return <span className={`pl-chip-faixa ${passa ? 'pl-faixa-bom' : 'pl-faixa-critico'}`}>{passa ? 'Passa' : 'Não passa'}</span>
}
const v = (x: number | null | undefined) => (x == null ? '—' : x.toLocaleString('pt-BR', { maximumFractionDigits: 2 }))

export function AceiteAjuste1Card() {
  const [a, setA] = useState<AceiteAjuste1 | null>(null)
  const [dia, setDia] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [rodando, setRodando] = useState(false)
  // Um item por chamada (cada um cabe no tempo da função); o cartão junta os resultados.
  async function rodar() {
    setRodando(true); setMsg(null)
    let junto: Partial<AceiteAjuste1> = {}
    const falhas: string[] = []
    for (const [k, item] of ITENS_AJUSTE1.entries()) {
      setMsg(`Conferindo ${k + 1} de ${ITENS_AJUSTE1.length}…`)
      try { const r = await painelDonoApi.aceiteItem(item, dia || undefined); junto = { ...junto, ...Object.fromEntries(Object.entries(r).filter(([, v]) => v != null)) } } catch (e) { falhas.push(`${item}: ${e instanceof Error ? e.message : 'falhou'}`) }
    }
    setA(junto as AceiteAjuste1); setMsg(falhas.length ? `Não deu para conferir: ${falhas.join('; ')}` : null); setRodando(false)
  }
  return (
    <section className="pl-card" id="aceite-ajuste1" style={{ marginBottom: 20 }} data-aceite-ajuste1-card>
      <div className="pl-card-head"><div>
        <div className="pl-card-title">Teste do Ajuste 1 (Hoje do dono)</div>
        <div className="pl-card-sub">Confere na produção: números do Daily e do Painel contra o dicionário e contra a contagem direta no banco, a jornada de um mês, o modo equipe, o &quot;Decidido&quot; e as cifras do supervisor.</div>
      </div></div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label className="pl-hint">Dia real <input className="pl-input" type="date" value={dia} onChange={e => setDia(e.target.value)} style={{ width: 160 }} /></label>
        <span className="pl-hint">(vazio = ontem)</span>
        <button type="button" className="pl-btn pl-btn-primary" onClick={() => void rodar()} disabled={rodando} data-rodar-aceite-ajuste1>{rodando ? 'Calculando…' : a ? 'Rodar de novo' : 'Rodar o teste'}</button>
      </div>
      {msg && <p className="pl-hint" role="alert">{msg}</p>}
      {a && a.numeros && a.jornada && a.modoEquipe && a.decidido && a.comparacao && a.cifras && (
        <div data-aceite-ajuste1>
          <table className="pl-table" style={{ marginTop: 10 }}><thead><tr><th>Item</th><th>Medido</th><th /></tr></thead><tbody>
            <tr><td>Números do Painel e do Daily (dia {a.dia})</td><td>{a.numeros.contagens.filter(x => x.bate).length} de {a.numeros.contagens.length} contagens diretas batem · {a.numeros.daily.filter(x => x.bate).length} de {a.numeros.daily.length} números do Daily · {a.numeros.painel.filter(x => x.bate).length} de {a.numeros.painel.length} do Painel</td><td><Selo passa={a.numeros.passa} /></td></tr>
            <tr><td>Jornada de compra ({a.mesConferido.inicio.slice(5, 7)}/{a.mesConferido.inicio.slice(0, 4)})</td><td>{a.jornada.total} etapas · {a.jornada.etapas.filter(x => x.bate).length} de {a.jornada.etapas.length} conferem com a contagem manual (volume, conversão, perda e custo)</td><td><Selo passa={a.jornada.passa} /></td></tr>
            <tr><td>Modo equipe</td><td>{a.modoEquipe.individuais} orientação(ões) individual(is) · {a.modoEquipe.porPessoa} número(s) por pessoa · {a.modoEquipe.atividadesPorPessoa} atividade(s) por pessoa</td><td><Selo passa={a.modoEquipe.passa} /></td></tr>
            <tr><td>&quot;Decidido&quot; e ata</td><td>{a.decidido.reunioes} Daily(s) encerrado(s) · {a.decidido.decisoes} decisão(ões) · {a.decidido.comOrigemReuniao} ATV com origem reunião</td><td><Selo passa={a.decidido.passa} /></td></tr>
            <tr><td>Comparação sem &quot;−100%&quot;</td><td>{a.comparacao.periodo.inicio.slice(8)}/{a.comparacao.periodo.inicio.slice(5, 7)} a {a.comparacao.periodo.fim.slice(8)}/{a.comparacao.periodo.fim.slice(5, 7)} contra {a.comparacao.anterior.inicio.slice(8)}/{a.comparacao.anterior.inicio.slice(5, 7)} a {a.comparacao.anterior.fim.slice(8)}/{a.comparacao.anterior.fim.slice(5, 7)}{a.comparacao.menos100.length ? ` · −100% em: ${a.comparacao.menos100.join(', ')}` : ''}</td><td><Selo passa={a.comparacao.passa} /></td></tr>
            <tr><td>Cifras do dono para o supervisor</td><td>{a.cifras.supervisorVe.length ? `aparecem: ${a.cifras.supervisorVe.join(', ')}` : 'nenhuma aparece'} (o vendedor não abre o Daily nem o Painel)</td><td><Selo passa={a.cifras.passa} /></td></tr>
          </tbody></table>
          <details style={{ marginTop: 8 }}><summary className="pl-hint" style={{ cursor: 'pointer' }}>Detalhe das conferências</summary>
            <table className="pl-table"><thead><tr><th>Conferência</th><th>Tela / dicionário</th><th>Banco / manual</th><th /></tr></thead><tbody>
              {a.numeros.contagens.map(x => <tr key={x.item}><td>{x.item}</td><td>{v(x.dicionario)}</td><td>{v(x.banco)}</td><td>{x.bate ? '✓' : '✗'}</td></tr>)}
              {a.numeros.painel.map(x => <tr key={x.numero}><td>Painel · {x.numero}</td><td>{v(x.tela)}</td><td>{v(x.dicionario)}</td><td>{x.bate ? '✓' : '✗'}</td></tr>)}
              {a.numeros.daily.map(x => <tr key={`${x.bloco}${x.numero}`}><td>Daily · {x.bloco} · {x.numero}</td><td>{v(x.tela)}</td><td>{v(x.dicionario)}</td><td>{x.bate ? '✓' : '✗'}</td></tr>)}
              {a.jornada.etapas.map(x => <tr key={x.etapa}><td>Jornada · {x.etapa}</td><td>{x.volume.tela} · {v(x.conversao.tela)}% · {x.perda.tela} perdidos · {v(x.custo.tela)}</td><td>{x.volume.manual} · {v(x.conversao.manual)}% · {x.perda.manual} perdidos · {v(x.custo.manual)}</td><td>{x.bate ? '✓' : '✗'}</td></tr>)}
            </tbody></table>
          </details>
        </div>
      )}
    </section>
  )
}
