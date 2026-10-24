'use client'

// Botão "Simular financiamento" da conversa: refaz a conta com as taxas da
// loja (moto de interesse, entrada e renda já vêm da conversa) e manda ao
// cliente pelo WhatsApp do vendedor.
import { useState } from 'react'
import { proLaboreApi, type SimulacaoDaConversa } from '@/lib/proLaboreApi'
import { fmtReais, lerReais } from './util'

type Campos = { valor: string; entrada: string; renda: string }

// Use com key={conversaId}: trocar de conversa fecha o painel.
export function BotaoSimular({ conversaId, conectado, onEnviada }: { conversaId: string; conectado: boolean; onEnviada: () => void }) {
  const [aberto, setAberto] = useState(false)
  const [campos, setCampos] = useState<Campos>({ valor: '', entrada: '', renda: '' })
  const [res, setRes] = useState<SimulacaoDaConversa | null>(null)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function calcular(enviar = false, inicial = false) {
    setOcupado(true)
    setErro('')
    try {
      const r = await proLaboreApi.assistente.simularConversa(conversaId, inicial ? {} : {
        valor: lerReais(campos.valor), entrada: lerReais(campos.entrada), renda: lerReais(campos.renda), enviar,
      })
      if (enviar) { setAberto(false); onEnviada(); return }
      setRes(r)
      if (inicial) setCampos({ valor: fmtReais(r.simulacao.valor), entrada: fmtReais(r.simulacao.entradaInformada), renda: fmtReais(r.simulacao.renda) })
    } catch (e) {
      setErro((e as Error).message)
      if (inicial) setRes(null)
    } finally {
      setOcupado(false)
    }
  }

  function abrir() {
    setAberto(true)
    setRes(null)
    setCampos({ valor: '', entrada: '', renda: '' })
    calcular(false, true)
  }

  const mudar = (k: keyof Campos, v: string) => { setCampos(c => ({ ...c, [k]: v })); setRes(null) }

  return (
    <>
      <button type="button" className="pl-btn pl-btn-ghost" onClick={abrir} data-simular-financiamento>Simular financiamento</button>
      {aberto && (
        <div className="pl-modal-backdrop" onClick={() => !ocupado && setAberto(false)}>
          <form className="pl-card pl-modal-panel" style={{ maxWidth: 520 }} role="dialog" aria-label="Simular financiamento" onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); calcular() }}>
            <div className="pl-card-title" style={{ marginBottom: 4 }}>Simular financiamento</div>
            <div className="pl-card-sub" style={{ marginBottom: 14 }}>{res?.moto ? res.moto.nome : 'Com as taxas da aba Simulação'}. Entrada e renda vêm da conversa; mude se o cliente passou outros números.</div>
            <div className="pl-si-exemplo">
              {([['valor', 'Valor da moto (R$)'], ['entrada', 'Entrada (R$)'], ['renda', 'Renda (R$)']] as const).map(([k, rotulo]) => (
                <div key={k} className="pl-field">
                  <label htmlFor={`sc-${k}`}>{rotulo}</label>
                  <input id={`sc-${k}`} className="pl-input" inputMode="decimal" value={campos[k]} onChange={e => mudar(k, e.target.value)} placeholder={k === 'valor' ? '' : k === 'entrada' ? 'mínima' : 'opcional'} data-campo-simulacao={k} />
                </div>
              ))}
            </div>
            {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 12 }} data-erro-simulacao>{erro}</div>}
            {res && (
              <>
                <div className="pl-as-subtitulo" style={{ marginTop: 12 }}>Vai para o cliente</div>
                <pre className="pl-vt-previa" data-texto-simulacao>{res.texto}</pre>
                <div className="pl-si-leitura" style={{ marginTop: 8 }} data-resumo-simulacao>{res.resumo}</div>
              </>
            )}
            <div className="pl-vt-rodape">
              <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setAberto(false)} disabled={ocupado}>Fechar</button>
              {!res
                ? <button type="submit" className="pl-btn pl-btn-primary" disabled={ocupado || !lerReais(campos.valor)} data-recalcular>{ocupado ? 'Calculando…' : 'Calcular'}</button>
                : <button type="button" className="pl-btn pl-btn-primary" onClick={() => calcular(true)} disabled={ocupado || !conectado} title={conectado ? undefined : 'WhatsApp desconectado'} data-enviar-simulacao>{ocupado ? 'Enviando…' : 'Enviar ao cliente'}</button>}
            </div>
          </form>
        </div>
      )}
    </>
  )
}
