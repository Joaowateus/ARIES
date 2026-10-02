'use client'

// "Diagnosticar conexão": testa cada etapa com a Meta (token, permissão,
// acesso à conta, situação da conta, leitura dos dados) e mostra o que
// falhou — com a mensagem da própria Meta — e o passo a passo pra resolver.
import { useState } from 'react'
import { proLaboreApi, type DiagnosticoTrafego } from '@/lib/proLaboreApi'

export default function DiagnosticoConexao({ automatico, onTrocarToken, onFechar }: { automatico?: boolean; onTrocarToken: () => void; onFechar?: () => void }) {
  const [resultado, setResultado] = useState<DiagnosticoTrafego | null>(null)
  const [rodando, setRodando] = useState(false)
  const [erro, setErro] = useState('')
  async function rodar() {
    setRodando(true); setErro('')
    try { setResultado(await proLaboreApi.trafego.diagnostico()) } catch (e) { setErro((e as Error).message) } finally { setRodando(false) }
  }
  const falhou = resultado?.passos.some(p => !p.ok)
  const pedeToken = resultado?.passos.find(p => !p.ok)?.chave === 'token' || resultado?.passos.find(p => !p.ok)?.chave === 'permissoes'
  return (
    <div className="pl-card pl-tf-diagcon">
      <div className="pl-tf-diagcon-topo">
        <div>
          <div className="pl-card-title">Diagnóstico da conexão com a Meta</div>
          <div className="pl-card-sub">{automatico ? 'A última atualização falhou. ' : ''}Testa cada etapa e mostra exatamente o que está bloqueando.</div>
        </div>
        <div className="pl-tf-diagcon-acoes">
          <button type="button" className="pl-btn pl-btn-primary pl-tf-btn-peq" disabled={rodando} onClick={() => void rodar()}>{rodando ? 'Testando…' : resultado ? 'Testar de novo' : 'Diagnosticar conexão'}</button>
          {onFechar && <button type="button" className="pl-btn pl-btn-ghost pl-tf-btn-peq" onClick={onFechar}>Fechar</button>}
        </div>
      </div>
      {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 10 }}>{erro}</div>}
      {resultado && (
        <div className="pl-tf-diagcon-corpo">
          <ul className="pl-tf-diagcon-passos">
            {resultado.passos.map(p => (
              <li key={p.chave} className={p.ok ? 'ok' : 'falhou'}>
                <span className="icone" aria-hidden="true">{p.ok ? '✓' : '!'}</span>
                <div>
                  <b>{p.titulo}</b>
                  <small>{p.detalhe}{p.codigo ? ` (código ${p.codigo})` : ''}</small>
                </div>
              </li>
            ))}
          </ul>
          <div className={`pl-tf-diagcon-resolver ${falhou ? 'falhou' : 'ok'}`}>
            <b>{resultado.resolver.titulo}</b>
            <ol>{resultado.resolver.passos.map((t, i) => <li key={i}>{t}</li>)}</ol>
            {pedeToken && <button type="button" className="pl-btn pl-btn-primary pl-tf-btn-peq" onClick={onTrocarToken}>Colar token novo</button>}
          </div>
        </div>
      )}
    </div>
  )
}
