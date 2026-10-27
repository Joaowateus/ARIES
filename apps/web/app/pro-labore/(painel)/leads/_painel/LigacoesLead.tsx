'use client'

// Ligações no painel do lead: a próxima (Ligar e Registrar), agendar uma
// avulsa, iniciar uma cadência e o histórico com o resultado de cada uma.
import { useEffect, useState } from 'react'
import { proLaboreApi, type Ligacao } from '@/lib/proLaboreApi'
import { ALERTA, BotaoLigar, RESULTADO, RegistrarLigacao, dataHora, duracao, quandoLigar, rotuloPasso } from '../../_ligacoes/Ligacoes'

export function LigacoesLead({ leadId, nomeCliente, telefone, podeEscrever, vejaAlertas, onMudou }: {
  leadId: string
  nomeCliente: string
  telefone: string | null | undefined
  podeEscrever: boolean
  vejaAlertas: boolean
  onMudou: () => void
}) {
  const [dados, setDados] = useState<{ ligacoes: Ligacao[]; cadencias: Array<{ id: string; nome: string; passos: number }> } | null>(null)
  const [erro, setErro] = useState('')
  const [registrando, setRegistrando] = useState<Ligacao | null>(null)
  const [novo, setNovo] = useState<'' | 'avulsa' | 'cadencia'>('')
  const [quando, setQuando] = useState('')
  const [instrucao, setInstrucao] = useState('')
  const [cadenciaId, setCadenciaId] = useState('')
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let cancelado = false
    proLaboreApi.ligacoes.doLead(leadId).then(d => { if (!cancelado) setDados(d) }).catch(e => { if (!cancelado) setErro((e as Error).message) })
    return () => { cancelado = true }
  }, [leadId, versao])
  const recarregar = () => { setVersao(v => v + 1); onMudou() }

  async function agendar() {
    setErro('')
    try {
      if (novo === 'avulsa') {
        if (!quando) { setErro('Escolha o dia e a hora'); return }
        await proLaboreApi.ligacoes.agendar(leadId, { agendadaPara: new Date(quando).toISOString(), ...(instrucao.trim() && { instrucao: instrucao.trim() }) })
      } else if (novo === 'cadencia') {
        if (!cadenciaId) { setErro('Escolha a cadência'); return }
        await proLaboreApi.ligacoes.iniciarCadencia(leadId, cadenciaId)
      }
      setNovo(''); setQuando(''); setInstrucao(''); setCadenciaId('')
      recarregar()
    } catch (e) { setErro((e as Error).message) }
  }

  const pendentes = (dados?.ligacoes ?? []).filter(l => l.status === 'PENDENTE').sort((a, b) => a.agendadaPara.localeCompare(b.agendadaPara))
  const feitas = (dados?.ligacoes ?? []).filter(l => l.status === 'FEITA').sort((a, b) => (b.registradaEm ?? '').localeCompare(a.registradaEm ?? ''))
  const proxima = pendentes[0]

  return (
    <section className="pl-pn-bloco" data-ligacoes-lead>
      <h3>Ligações</h3>
      {!dados ? (!erro && <p className="pl-hint">Carregando…</p>) : proxima ? (
        <div className="lg-pn-proxima" data-proxima-ligacao>
          <div>
            <b className={quandoLigar(proxima.agendadaPara).atrasada ? 'lg-quando atrasada' : 'lg-quando'}>{quandoLigar(proxima.agendadaPara).texto}</b>
            <span className="pl-hint"> · {rotuloPasso(proxima)}{pendentes.length > 1 ? ` · mais ${pendentes.length - 1} depois` : ''}</span>
          </div>
          {proxima.instrucao && <span className="lg-item-passo">{proxima.instrucao}</span>}
          {podeEscrever && (
            <div className="lg-item-acoes">
              <BotaoLigar ligacao={proxima} telefone={telefone} onDiscou={l => setDados(d => d && { ...d, ligacoes: d.ligacoes.map(x => (x.id === l.id ? { ...x, ...l } : x)) })} />
              <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setRegistrando(proxima)} data-registrar>Registrar</button>
            </div>
          )}
        </div>
      ) : <p className="pl-hint">Nenhuma ligação marcada.</p>}

      {podeEscrever && dados && (
        novo ? (
          <div className="lg-pn-novo">
            {novo === 'avulsa' ? (
              <>
                <input className="pl-input" type="datetime-local" value={quando} onChange={e => setQuando(e.target.value)} aria-label="Quando ligar" data-ligacao-quando />
                <input className="pl-input" placeholder="O que falar (opcional)" value={instrucao} maxLength={1000} onChange={e => setInstrucao(e.target.value)} aria-label="O que falar" />
              </>
            ) : (
              <select className="pl-select" value={cadenciaId} onChange={e => setCadenciaId(e.target.value)} aria-label="Cadência" data-ligacao-cadencia>
                <option value="">Escolha a cadência</option>
                {dados.cadencias.map(c => <option key={c.id} value={c.id}>{c.nome} · {c.passos} ligaç{c.passos > 1 ? 'ões' : 'ão'}</option>)}
              </select>
            )}
            <button type="button" className="pl-btn pl-btn-primary" onClick={() => void agendar()} data-ligacao-confirmar>{novo === 'avulsa' ? 'Agendar' : 'Iniciar'}</button>
            <button type="button" className="pl-btn pl-btn-ghost" onClick={() => { setNovo(''); setErro('') }}>Cancelar</button>
          </div>
        ) : (
          <div className="lg-pn-novo">
            <button type="button" className="pl-link-action" onClick={() => setNovo('avulsa')} data-agendar-ligacao>Agendar ligação</button>
            {dados.cadencias.length > 0 && <button type="button" className="pl-link-action" onClick={() => setNovo('cadencia')} data-iniciar-cadencia>Iniciar cadência</button>}
          </div>
        )
      )}
      {erro && <div className="pl-alert pl-alert-error" role="alert">{erro}</div>}

      {feitas.length > 0 && (
        <ol className="lg-pn-hist">
          {feitas.slice(0, 6).map(l => (
            <li key={l.id} data-ligacao-feita={l.resultado ?? ''}>
              <b>{l.resultado ? RESULTADO[l.resultado] : 'Feita'}</b>
              {l.resultado === 'ATENDEU' ? ` · ${duracao(l.duracaoSeg)}` : ''} · {l.registradaEm ? dataHora(l.registradaEm) : ''}{l.registradaPor ? ` · ${l.registradaPor}` : ''}
              {l.resumo && <div>{l.resumo}</div>}
              {vejaAlertas && l.alertas.length > 0 && (
                <span className="lg-alertas">{l.alertas.map(a => <span key={a} className={`lg-alerta ${a === 'ATRASADA' ? 'leve' : ''}`} title={ALERTA[a].explica}>{ALERTA[a].rotulo}</span>)}</span>
              )}
            </li>
          ))}
        </ol>
      )}

      {registrando && (
        <RegistrarLigacao ligacao={registrando} nomeCliente={nomeCliente} onFechar={() => setRegistrando(null)} onRegistrou={() => { setRegistrando(null); recarregar() }} />
      )}
    </section>
  )
}
