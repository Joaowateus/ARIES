'use client'

// Painel de reunião (tráfego, comercial ou integrada): a pauta respondida com
// os números, os alertas do departamento, as ações pendentes, o que ficou da
// reunião anterior e o registro da ata (com o retrato dos números do dia).
import { useEffect, useState } from 'react'
import { proLaboreApi, type IntelReuniaoPauta, type IntelReuniaoRegistro, type IntelTipoReuniao } from '@/lib/proLaboreApi'
import { SEVERIDADE, STATUS_ACAO, brl, dataBR, num, pct, periodoDoMes } from './fmt'

const TIPOS: Array<{ valor: IntelTipoReuniao; rotulo: string; descricao: string }> = [
  { valor: 'TRAFEGO', rotulo: 'Tráfego', descricao: 'Investimento, entrega, custo por lead e qualidade dos leads de anúncio.' },
  { valor: 'COMERCIAL', rotulo: 'Comercial', descricao: 'Abordagem, funil, propostas, carteira de cada vendedor e ritmo de vendas.' },
  { valor: 'INTEGRADA', rotulo: 'Integrada', descricao: 'Meta do mês, gargalo do funil e o que cada departamento precisa fazer.' },
]
const STATUS_RESPOSTA: Record<string, string> = { OK: 'Em ordem', ATENCAO: 'Atenção', CRITICO: 'Crítico', SEM_DADOS: 'Sem dados' }

function Retrato({ r }: { r: Record<string, unknown> }) {
  const n = (k: string) => (typeof r[k] === 'number' ? (r[k] as number) : null)
  const conv = Array.isArray(r.conversoes) ? (r.conversoes as Array<number | null>) : []
  return (
    <p className="ic-legenda">
      Retrato do dia: {num(n('vendas'))} de {num(n('metaVendas'))} vendas · faturamento {brl(n('faturamento'))} · {num(n('leadsMes'))} leads
      {n('investimento') != null && <> · investimento {brl(n('investimento'))}</>}{n('cplMes') != null && <> · CPL {brl(n('cplMes'))}</>}
      {conv.length > 0 && <> · conversões {conv.map(c => pct(c, 0)).join(' / ')}</>}
    </p>
  )
}

export function Reuniao({ mes }: { mes: string }) {
  const [tipo, setTipo] = useState<IntelTipoReuniao>('INTEGRADA')
  const [versao, setVersao] = useState(0)
  const [pauta, setPauta] = useState<{ chave: string; p: IntelReuniaoPauta } | null>(null)
  const [registros, setRegistros] = useState<IntelReuniaoRegistro[] | null>(null)
  const [erro, setErro] = useState<{ chave: string; texto: string } | null>(null)
  const [titulo, setTitulo] = useState('')
  const [notas, setNotas] = useState('')
  const [marcadas, setMarcadas] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const chave = `${tipo}|${mes}|${versao}`

  useEffect(() => {
    let cancelado = false
    const { inicio, fim } = periodoDoMes(mes)
    proLaboreApi.intel.reuniao(tipo, inicio, fim)
      .then(p => { if (!cancelado) setPauta({ chave, p }) })
      .catch(e => { if (!cancelado) setErro({ chave, texto: (e as Error).message }) })
    return () => { cancelado = true }
  }, [chave, tipo, mes])
  useEffect(() => { proLaboreApi.intel.reunioes().then(setRegistros).catch(() => setRegistros([])) }, [versao])

  const p = pauta?.chave === chave ? pauta.p : null
  const erroAtual = erro?.chave === chave ? erro.texto : ''
  const info = TIPOS.find(t => t.valor === tipo)!
  const tituloPadrao = `Reunião ${info.rotulo.toLowerCase()} · ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
  const trocar = (t: IntelTipoReuniao) => { setTipo(t); setMarcadas([]); setMsg(null) }

  async function registrar(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true); setMsg(null)
    try {
      await proLaboreApi.intel.registrarReuniao({ tipo, titulo: titulo.trim() || tituloPadrao, notas: notas.trim() || undefined, acoesIds: marcadas })
      setMsg({ ok: true, texto: 'Ata registrada com o retrato dos números de hoje. Na próxima reunião deste tipo, ela abre como "reunião anterior".' })
      setTitulo(''); setNotas(''); setMarcadas([]); setVersao(v => v + 1)
    } catch (x) { setMsg({ ok: false, texto: (x as Error).message }) } finally { setSalvando(false) }
  }

  return (
    <>
      <div className="pl-sv-tabs" role="tablist" aria-label="Tipo de reunião" style={{ alignSelf: 'flex-start' }}>
        {TIPOS.map(t => <button key={t.valor} type="button" role="tab" aria-selected={tipo === t.valor} className={tipo === t.valor ? 'ativo' : ''} onClick={() => trocar(t.valor)}>Reunião {t.rotulo.toLowerCase()}</button>)}
      </div>
      <p className="ic-legenda">{info.descricao}</p>

      {erroAtual ? <div className="pl-alert pl-alert-error">{erroAtual}</div> : !p ? <div className="pl-hint">Montando a pauta…</div> : (
        <>
          <section className="ic-card">
            <div className="ic-cab"><div><h2>Pauta respondida pelos números</h2><p className="ic-sub">Cada pergunta da reunião com a resposta que os dados dão hoje. Onde falta dado, a Central diz.</p></div></div>
            <ol className="ic-pauta">
              {p.pauta.map(q => (
                <li key={q.pergunta}>
                  <div>
                    <div className="ic-pauta-q">{q.pergunta}<span className={`ic-tag ${q.status}`}>{STATUS_RESPOSTA[q.status] ?? q.status}</span></div>
                    <div className="ic-pauta-r">{q.resposta}</div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <div className="ic-grade">
            <section className="ic-card">
              <div className="ic-cab"><div><h2>Alertas para discutir</h2></div></div>
              {p.diagnosticos.length === 0 ? <p className="ic-legenda">Nenhum alerta acima dos critérios.</p> : (
                <ul className="ic-lista">
                  {p.diagnosticos.slice(0, 8).map(x => (
                    <li key={x.chave}><span className={`ic-tag ${SEVERIDADE[x.severidade].classe}`} style={{ marginRight: 6 }}>{SEVERIDADE[x.severidade].rotulo}</span>{x.problema}<div className="ic-legenda">{x.acao}</div></li>
                  ))}
                </ul>
              )}
            </section>
            <section className="ic-card">
              <div className="ic-cab"><div><h2>Ações pendentes</h2><p className="ic-sub">Marque as que foram tratadas nesta reunião para ficarem na ata.</p></div></div>
              {p.pendentes.length === 0 ? <p className="ic-legenda">Nenhuma ação em aberto{tipo !== 'INTEGRADA' ? ' neste departamento' : ''}.</p> : p.pendentes.map(a => (
                <label key={a.id} className="ic-linha" style={{ cursor: 'pointer', justifyContent: 'flex-start' }}>
                  <input type="checkbox" checked={marcadas.includes(a.id)} onChange={e => setMarcadas(m => e.target.checked ? [...m, a.id] : m.filter(x => x !== a.id))} />
                  <span style={{ flex: 1 }}>{a.titulo}<small>{STATUS_ACAO[a.status]} · {a.responsavelNome ?? 'sem responsável'} · prazo {dataBR(a.prazo)}</small></span>
                </label>
              ))}
            </section>
          </div>

          {p.anterior && (
            <section className="ic-card">
              <div className="ic-cab"><div><h2>Reunião anterior · {dataBR(p.anterior.data)}</h2><p className="ic-sub">{p.anterior.titulo}</p></div></div>
              <Retrato r={p.anterior.retrato} />
              {p.anterior.notas && <p className="ic-bloco-texto" style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{p.anterior.notas}</p>}
              {p.anterior.acoes.length > 0 && <>
                <h3 style={{ margin: '12px 0 6px' }}>O que foi combinado e como está</h3>
                {p.anterior.acoes.map(a => <div key={a.id} className="ic-linha"><span>{a.titulo}<small>{a.responsavelNome ?? 'sem responsável'} · prazo {dataBR(a.prazo)}</small></span><b>{STATUS_ACAO[a.status]}</b></div>)}
              </>}
            </section>
          )}

          <section className="ic-card">
            <div className="ic-cab"><div><h2>Registrar a ata</h2><p className="ic-sub">Guarda as notas, as ações tratadas e o retrato dos números de hoje.</p></div></div>
            <Retrato r={p.retrato} />
            <form className="ic-form" onSubmit={registrar} style={{ marginTop: 10 }}>
              <div className="pl-field largo"><label htmlFor="ic-r-titulo">Título</label><input id="ic-r-titulo" className="pl-input" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder={tituloPadrao} /></div>
              <div className="pl-field largo"><label htmlFor="ic-r-notas">Decisões e combinados</label><textarea id="ic-r-notas" className="pl-input" rows={4} value={notas} onChange={e => setNotas(e.target.value)} placeholder="O que foi decidido, quem faz o quê e até quando" /></div>
              {msg && <div className={`pl-alert ${msg.ok ? 'pl-alert-success' : 'pl-alert-error'} largo`}>{msg.texto}</div>}
              <div className="largo" style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="submit" className="pl-btn pl-btn-primary" disabled={salvando}>{salvando ? 'Registrando…' : `Registrar ata${marcadas.length ? ` (${marcadas.length} ação${marcadas.length > 1 ? 'ões' : ''})` : ''}`}</button></div>
            </form>
          </section>
        </>
      )}

      <section className="ic-card">
        <div className="ic-cab"><div><h2>Atas registradas</h2></div></div>
        {!registros ? <div className="pl-hint">Carregando…</div> : registros.length === 0 ? <p className="ic-legenda">Nenhuma reunião registrada ainda.</p> : registros.slice(0, 20).map(r => (
          <div key={r.id} className="ic-linha"><span>{r.titulo}<small>{TIPOS.find(t => t.valor === r.tipo)?.rotulo} · {r.criadoPor} · {(r.acoesIds ?? []).length} ação(ões){r.notas ? ` · ${r.notas.slice(0, 90)}${r.notas.length > 90 ? '…' : ''}` : ''}</small></span><b>{dataBR(r.data)}</b></div>
        ))}
      </section>
    </>
  )
}
