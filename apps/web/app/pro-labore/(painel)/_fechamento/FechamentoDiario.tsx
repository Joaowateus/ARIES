'use client'

// "Enviar relatório para o Assistente Comercial": o fechamento diário de cada
// aba. A pessoa vê o resumo do dia montado com os mesmos cálculos da Central,
// confere, escreve uma observação se quiser e confirma. Reenviar o mesmo dia
// com os mesmos números não duplica nada; números diferentes viram a versão
// seguinte (a anterior fica no histórico). Só a gestão (dono e supervisor).
import './fechamento.css'
import { useEffect, useState } from 'react'
import { proLaboreApi, type ErroApi, type IntelModuloRelatorio, type IntelPrevia } from '@/lib/proLaboreApi'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'

const NOME_MODULO: Record<IntelModuloRelatorio, string> = { JORNADA: 'Jornada de compra', TRAFEGO: 'Tráfego', SOCIAL_MEDIA: 'Social Media', VENDAS: 'Vendas', FINANCEIRO: 'Financeiro' }
const NATUREZA: Record<string, string> = { REALIZADO: 'Realizado', META: 'Meta', PROJECAO: 'Projeção', PLATAFORMA: 'Plataforma', CRM: 'CRM' }
const SEVERIDADE: Record<string, string> = { CRITICO: 'Crítico', ALTO: 'Alto', MODERADO: 'Moderado', MONITORAMENTO: 'Monitorar' }

const hojeBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10)
function valor(v: number | null, unidade: string): string {
  if (v == null || !Number.isFinite(v)) return '—'
  if (unidade === 'BRL') return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: Math.abs(v) < 100 ? 2 : 0 })
  if (unidade === 'PCT') return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}
const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** Botão + janela de confirmação. Some para quem não é da gestão. */
export function FechamentoDiario({ modulo, compacto }: { modulo: IntelModuloRelatorio; compacto?: boolean }) {
  const { usuario } = useProLaboreAuth()
  const [aberto, setAberto] = useState(false)
  if (usuario?.papel !== 'DONO' && usuario?.papel !== 'SUPERVISOR') return null
  return (
    <>
      <button type="button" className={`pl-btn pl-btn-ghost fd-botao${compacto ? ' compacto' : ''}`} onClick={() => setAberto(true)} data-fechamento={modulo}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" /></svg>
        Enviar relatório para o Assistente Comercial
      </button>
      {aberto && <JanelaFechamento modulo={modulo} onFechar={() => setAberto(false)} />}
    </>
  )
}

export function JanelaFechamento({ modulo, onFechar, onEnviado }: { modulo: IntelModuloRelatorio; onFechar: () => void; onEnviado?: () => void }) {
  const [dia, setDia] = useState(hojeBR())
  const [versao, setVersao] = useState(0)
  const [previa, setPrevia] = useState<{ chave: string; p: IntelPrevia } | null>(null)
  const [erro, setErro] = useState<{ chave: string; texto: string } | null>(null)
  const [observacao, setObservacao] = useState('')
  const [conferido, setConferido] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ tipo: 'ok' | 'aviso' | 'erro'; texto: string } | null>(null)
  const chave = `${dia}|${versao}`

  useEffect(() => {
    let cancelado = false
    proLaboreApi.intel.previaRelatorio(modulo, dia)
      .then(p => { if (!cancelado) setPrevia({ chave, p }) })
      .catch(e => { if (!cancelado) setErro({ chave, texto: (e as Error).message }) })
    return () => { cancelado = true }
  }, [modulo, dia, chave])

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onFechar])

  const p = previa?.chave === chave ? previa.p : null
  const erroAtual = erro?.chave === chave ? erro.texto : ''
  const trocarDia = (d: string) => { setDia(d); setConferido(false); setResultado(null) }

  async function enviar() {
    if (!p) return
    setEnviando(true); setResultado(null)
    try {
      const r = await proLaboreApi.intel.confirmarRelatorio({ modulo, dia: p.dia, hash: p.hash, observacao: observacao.trim() || undefined })
      setResultado(r.duplicado
        ? { tipo: 'aviso', texto: `Este fechamento já estava enviado com os mesmos números (versão ${r.relatorio.versao}). Nada foi duplicado.` }
        : { tipo: 'ok', texto: `Relatório enviado ao Assistente Comercial · versão ${r.relatorio.versao}${r.relatorio.versao > 1 ? ' (a anterior ficou no histórico)' : ''}.` })
      setConferido(false)
      setVersao(v => v + 1)
      onEnviado?.()
    } catch (e) {
      const conflito = (e as ErroApi).status === 409
      setResultado({ tipo: 'erro', texto: (e as Error).message })
      if (conflito) { setConferido(false); setVersao(v => v + 1) }
    } finally { setEnviando(false) }
  }

  return (
    <div className="pl-modal-backdrop" onClick={onFechar}>
      <div className="pl-card pl-modal-panel fd-janela" role="dialog" aria-modal="true" aria-labelledby="fd-titulo" onClick={e => e.stopPropagation()}>
        <div className="fd-cab">
          <div>
            <div className="pl-eyebrow">Fechamento diário · {NOME_MODULO[modulo]}</div>
            <h2 id="fd-titulo">Enviar relatório para o Assistente Comercial</h2>
            <p className="fd-sub">Confira os números do dia. Ao confirmar, eles entram na Central como dado validado, com o seu nome e a hora.</p>
          </div>
          <button type="button" className="fd-fechar" onClick={onFechar} aria-label="Fechar">×</button>
        </div>

        <div className="fd-dia">
          <label htmlFor="fd-dia">Dia</label>
          <input id="fd-dia" type="date" className="pl-input" value={dia} max={hojeBR()} onChange={e => e.target.value && trocarDia(e.target.value)} />
        </div>

        {erroAtual ? <div className="pl-alert pl-alert-error">{erroAtual}</div> : !p ? <div className="pl-hint">Montando o resumo do dia…</div> : (
          <>
            {p.ultimo && (
              <div className={`fd-ultimo ${p.ultimo.igual ? 'igual' : 'mudou'}`}>
                <b>{p.ultimo.igual ? 'Já enviado, sem mudança desde então' : 'Os números mudaram desde o último envio'}</b>
                <span>Versão {p.ultimo.versao} confirmada por {p.ultimo.geradoPorNome} em {dataHora(p.ultimo.confirmadoEm)}.{!p.ultimo.igual && ' Confirmar agora cria a versão seguinte; a anterior fica no histórico.'}</span>
                {p.ultimo.diferencas.length > 0 && (
                  <div className="fd-rola">
                    <table className="fd-tabela">
                      <thead><tr><th>Mudou</th><th className="num">Validado</th><th className="num">Ao vivo</th></tr></thead>
                      <tbody>{p.ultimo.diferencas.map(d => {
                        const u = p.indicadores.find(i => i.chave === d.chave)?.unidade ?? 'NUM'
                        return <tr key={d.chave}><td>{d.nome}</td><td className="num">{valor(d.confirmado, u)}</td><td className="num">{valor(d.aoVivo, u)}</td></tr>
                      })}</tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {p.incompletos.length > 0 && (
              <div className="fd-incompleto" role="note">
                <b>Dados incompletos</b>
                <ul>{p.incompletos.map(t => <li key={t}>{t}</li>)}</ul>
              </div>
            )}

            <div className="fd-rola">
              <table className="fd-tabela">
                <thead><tr><th>Indicador</th><th className="num">Valor</th><th className="num">Meta</th><th className="num">Desvio</th><th>Origem</th></tr></thead>
                <tbody>
                  {p.indicadores.map(i => (
                    <tr key={i.chave}>
                      <td>{i.nome}<small>{i.formula}</small></td>
                      <td className="num"><b>{valor(i.valor, i.unidade)}</b></td>
                      <td className="num">{valor(i.meta, i.unidade)}</td>
                      <td className="num">{i.desvio == null ? '—' : `${i.desvio > 0 ? '+' : ''}${valor(i.desvio, i.unidade)}`}</td>
                      <td><span className="fd-natureza">{NATUREZA[i.natureza] ?? i.natureza}</span><small>{i.fonte}</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {p.alertas.length > 0 && (
              <div>
                <div className="fd-rotulo">Alertas que vão junto</div>
                <ul className="fd-alertas">{p.alertas.map(a => <li key={a.problema}><span className={`fd-sev ${a.severidade}`}>{SEVERIDADE[a.severidade] ?? a.severidade}</span>{a.problema}</li>)}</ul>
              </div>
            )}

            <div className="pl-field">
              <label htmlFor="fd-obs">Observação (opcional)</label>
              <textarea id="fd-obs" className="pl-input" rows={2} maxLength={1000} value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Algo que explique os números do dia (ex.: feriado, campanha pausada, sistema fora do ar)" />
            </div>

            <label className="fd-confere">
              <input type="checkbox" checked={conferido} onChange={e => setConferido(e.target.checked)} />
              Conferi os números acima e confirmo o envio
            </label>

            {resultado && <div className={`pl-alert ${resultado.tipo === 'ok' ? 'pl-alert-success' : resultado.tipo === 'erro' ? 'pl-alert-error' : 'fd-alerta-aviso'}`} role="status">{resultado.texto}</div>}

            <div className="fd-rodape">
              <button type="button" className="pl-btn pl-btn-ghost" onClick={onFechar}>Fechar</button>
              <button type="button" className="pl-btn pl-btn-primary" disabled={!conferido || enviando} onClick={enviar}>{enviando ? 'Enviando…' : 'Confirmar envio'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
