'use client'

// "Pagar salários": o mesmo fluxo do "marcar comissão como paga" de Vendas.
// Marca as pessoas da equipe, confere o valor de cada uma (vem o salário
// lembrado do último pagamento) e sai um recibo para cada uma.
import { useEffect, useState } from 'react'
import { proLaboreApi, type FormaPagamentoFinanceiro, type LancamentoFinanceiro, type SalariosDoMes } from '@/lib/proLaboreApi'
import { formatMoeda } from '@/lib/format'
import { abrirRecibo, hojeLocal, lerValor, mesExtenso, ROTULO_FORMA } from './util'

export function PagarSalarios({ mesInicial, formas, nomeDono, onFechar, onRegistrado }: {
  mesInicial: string
  formas: FormaPagamentoFinanceiro[]
  nomeDono: string
  onFechar: () => void
  onRegistrado: () => void
}) {
  const [competencia, setCompetencia] = useState(mesInicial)
  const [dados, setDados] = useState<SalariosDoMes | null>(null)
  const [marcados, setMarcados] = useState<Record<string, boolean>>({})
  const [valores, setValores] = useState<Record<string, string>>({})
  const [pagoEm, setPagoEm] = useState(hojeLocal)
  const [forma, setForma] = useState<FormaPagamentoFinanceiro>('PIX')
  const [pagador, setPagador] = useState('')
  const [observacao, setObservacao] = useState('')
  const [lembrar, setLembrar] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [feitos, setFeitos] = useState<LancamentoFinanceiro[] | null>(null)

  useEffect(() => {
    let cancelado = false
    proLaboreApi.financeiro.salarios(competencia).then(d => {
      if (cancelado) return
      setDados(d)
      setPagador(atual => atual || d.pagador || nomeDono)
      // Vem marcado quem tem salário lembrado e ainda não recebeu neste mês.
      setMarcados(Object.fromEntries(d.equipe.map(p => [p.id, !p.pago && !!p.salarioBase])))
      setValores(Object.fromEntries(d.equipe.map(p => [p.id, p.salarioBase ? String(p.salarioBase) : ''])))
    }).catch(e => { if (!cancelado) setErro(e instanceof Error ? e.message : 'Não deu pra carregar a equipe') })
    return () => { cancelado = true }
  }, [competencia, nomeDono])

  const carregando = !dados || dados.competencia !== competencia
  const escolhidos = carregando ? [] : dados.equipe.filter(p => !p.pago && marcados[p.id])
  const total = escolhidos.reduce((s, p) => s + lerValor(valores[p.id] ?? ''), 0)
  const semValor = escolhidos.filter(p => lerValor(valores[p.id] ?? '') <= 0)

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (semValor.length) { setErro(`Informe o salário de ${semValor.map(p => p.nome).join(', ')}.`); return }
    setSalvando(true)
    try {
      const r = await proLaboreApi.financeiro.pagarSalarios({
        competencia, pagoEm, formaPagamento: forma, pagador: pagador.trim(), observacao: observacao.trim() || null, lembrar,
        pagamentos: escolhidos.map(p => ({ vendedorId: p.id, valor: Math.round(lerValor(valores[p.id]) * 100) / 100 })),
      })
      setFeitos(r)
      onRegistrado()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não deu pra registrar os salários')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="pl-modal-backdrop" onClick={onFechar}>
      <div className="pl-card pl-modal-panel pl-fin-modal" role="dialog" aria-modal="true" aria-labelledby="fin-sal-titulo" onClick={e => e.stopPropagation()}>
        {feitos ? (
          <>
            <div className="pl-card-title" id="fin-sal-titulo">Salários registrados</div>
            <div className="pl-card-sub">Imprima cada recibo e peça para a pessoa assinar.</div>
            <ul className="pl-pgc-lista">
              {feitos.map(f => (
                <li key={f.id}>
                  <span><b>{f.favorecido}</b><small>Recibo de salário nº {f.numero}</small></span>
                  <b className="pl-pgc-valor">{formatMoeda(f.valorTotal)}</b>
                  <button type="button" className="pl-btn pl-btn-primary pl-pgc-btn" onClick={() => abrirRecibo(f.id)}>Abrir recibo</button>
                </li>
              ))}
            </ul>
            <div className="pl-pgc-acoes"><button type="button" className="pl-btn pl-btn-ghost" onClick={onFechar}>Fechar</button></div>
          </>
        ) : (
          <form onSubmit={confirmar}>
            <div className="pl-card-title" id="fin-sal-titulo">Pagar salários</div>
            <div className="pl-card-sub">Marque quem vai receber. Sai um recibo para cada pessoa.</div>
            <div className="pl-pgc-campos">
              <div className="pl-field">
                <label htmlFor="sal-comp">Salário do mês</label>
                <input id="sal-comp" type="month" className="pl-input" value={competencia} onChange={e => setCompetencia(e.target.value)} required />
              </div>
              <div className="pl-field">
                <label htmlFor="sal-data">Data do pagamento</label>
                <input id="sal-data" type="date" className="pl-input" value={pagoEm} onChange={e => setPagoEm(e.target.value)} required />
              </div>
            </div>

            {carregando ? <p className="pl-hint" style={{ marginTop: 14 }}>Carregando a equipe…</p> : dados.equipe.length === 0 ? (
              <p className="pl-hint" style={{ marginTop: 14 }}>Ninguém na equipe ainda. Cadastre as pessoas em Vendedores ou em Acessos e permissões.</p>
            ) : (
              <ul className="pl-fin-equipe" aria-label={`Equipe · salário de ${mesExtenso(competencia)}`}>
                {dados.equipe.map(p => (
                  <li key={p.id} className={p.pago ? 'pago' : undefined}>
                    <label className="pl-fin-equipe-nome">
                      <input type="checkbox" checked={!p.pago && !!marcados[p.id]} disabled={!!p.pago} onChange={e => setMarcados(m => ({ ...m, [p.id]: e.target.checked }))} />
                      <span><b>{p.nome}</b><small>{p.pago ? `Já recebeu: recibo nº ${p.pago.numero} · ${formatMoeda(p.pago.valorTotal)}` : p.vende ? 'Vendedor' : 'Equipe'}</small></span>
                    </label>
                    {!p.pago && (
                      <input className="pl-input pl-fin-valor" inputMode="decimal" aria-label={`Salário de ${p.nome}`} value={valores[p.id] ?? ''} placeholder="0,00"
                        onChange={e => { const v = e.target.value; setValores(x => ({ ...x, [p.id]: v })); if (lerValor(v) > 0) setMarcados(m => ({ ...m, [p.id]: true })) }} />
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="pl-pgc-campos">
              <div className="pl-field">
                <label htmlFor="sal-forma">Forma de pagamento</label>
                <select id="sal-forma" className="pl-select" value={forma} onChange={e => setForma(e.target.value as FormaPagamentoFinanceiro)}>
                  {formas.map(f => <option key={f} value={f}>{ROTULO_FORMA[f]}</option>)}
                </select>
              </div>
              <div className="pl-field">
                <label htmlFor="sal-pagador">Quem paga (empresa)</label>
                <input id="sal-pagador" className="pl-input" value={pagador} onChange={e => setPagador(e.target.value)} maxLength={120} required />
              </div>
              <div className="pl-field pl-pgc-largo">
                <label htmlFor="sal-obs">Observação (opcional)</label>
                <input id="sal-obs" className="pl-input" value={observacao} onChange={e => setObservacao(e.target.value)} maxLength={500} />
              </div>
              <label className="pl-fin-lembrar pl-pgc-largo"><input type="checkbox" checked={lembrar} onChange={e => setLembrar(e.target.checked)} /> Lembrar esses valores para o próximo mês</label>
            </div>
            {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 12 }}>{erro}</div>}
            <div className="pl-pgc-acoes">
              <button type="button" className="pl-btn pl-btn-ghost" onClick={onFechar}>Cancelar</button>
              <button type="submit" className="pl-btn pl-btn-primary" disabled={salvando || escolhidos.length === 0}>
                {salvando ? 'Registrando…' : `Pagar ${escolhidos.length} ${escolhidos.length === 1 ? 'salário' : 'salários'} · ${formatMoeda(total)}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
