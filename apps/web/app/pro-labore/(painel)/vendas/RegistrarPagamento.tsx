'use client'

// Confirma o pagamento das comissões escolhidas: data, forma e quem paga.
// Vendas de vendedores diferentes viram um comprovante pra cada vendedor.
// Depois de registrar, mostra os comprovantes prontos pra imprimir.
import { useState } from 'react'
import { proLaboreApi, type FormaPagamentoComissao, type PagamentoComissao, type Venda } from '@/lib/proLaboreApi'
import { formatMoeda } from '@/lib/format'

export const FORMAS_PAGAMENTO: Array<{ valor: FormaPagamentoComissao; rotulo: string }> = [
  { valor: 'PIX', rotulo: 'Pix' },
  { valor: 'DINHEIRO', rotulo: 'Dinheiro' },
  { valor: 'TRANSFERENCIA', rotulo: 'Transferência' },
  { valor: 'OUTRO', rotulo: 'Outro' },
]

function hojeLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function abrirComprovante(id: string) {
  window.open(`/pro-labore/comprovante/${id}`, '_blank', 'noopener')
}

export default function RegistrarPagamento({ vendas, pagadorPadrao, onFechar, onRegistrado }: {
  vendas: Venda[]
  pagadorPadrao: string
  onFechar: () => void
  onRegistrado: () => void
}) {
  const [pagoEm, setPagoEm] = useState(hojeLocal)
  const [forma, setForma] = useState<FormaPagamentoComissao>('PIX')
  const [pagador, setPagador] = useState(pagadorPadrao)
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [feitos, setFeitos] = useState<PagamentoComissao[] | null>(null)

  const porVendedor = new Map<string, { nome: string; qtd: number; total: number }>()
  for (const v of vendas) {
    const k = v.vendedorId ?? ''
    const atual = porVendedor.get(k) ?? { nome: v.vendedor?.nome ?? '—', qtd: 0, total: 0 }
    porVendedor.set(k, { ...atual, qtd: atual.qtd + 1, total: atual.total + (v.valorComissao ?? 0) })
  }
  const total = vendas.reduce((s, v) => s + (v.valorComissao ?? 0), 0)

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      const r = await proLaboreApi.comissoes.pagar({ vendaIds: vendas.map(v => v.id), pagoEm, formaPagamento: forma, pagador, observacao: observacao || null })
      setFeitos(r)
      onRegistrado()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não deu pra registrar o pagamento')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="pl-modal-backdrop" onClick={onFechar}>
      <div className="pl-card pl-modal-panel pl-pgc-modal" role="dialog" aria-modal="true" aria-labelledby="pgc-titulo" onClick={e => e.stopPropagation()}>
        {feitos ? (
          <>
            <div className="pl-card-title" id="pgc-titulo">Pagamento registrado</div>
            <div className="pl-card-sub">Imprima o comprovante e peça pro vendedor assinar.</div>
            <ul className="pl-pgc-lista">
              {feitos.map(p => (
                <li key={p.id}>
                  <span><b>{p.vendedor.nome}</b><small>Comprovante nº {p.numero} · {p._count?.vendas ?? 0} venda{(p._count?.vendas ?? 0) > 1 ? 's' : ''}</small></span>
                  <b className="pl-pgc-valor">{formatMoeda(p.valorTotal)}</b>
                  <button type="button" className="pl-btn pl-btn-primary pl-pgc-btn" onClick={() => abrirComprovante(p.id)}>Abrir comprovante</button>
                </li>
              ))}
            </ul>
            <div className="pl-pgc-acoes">
              <button type="button" className="pl-btn pl-btn-ghost" onClick={onFechar}>Fechar</button>
            </div>
          </>
        ) : (
          <form onSubmit={confirmar}>
            <div className="pl-card-title" id="pgc-titulo">Marcar comissão como paga</div>
            <div className="pl-card-sub">
              {vendas.length === 1 ? '1 venda' : `${vendas.length} vendas`} · {formatMoeda(total)}
              {porVendedor.size > 1 && ` · um comprovante pra cada um dos ${porVendedor.size} vendedores`}
            </div>
            <ul className="pl-pgc-lista">
              {[...porVendedor.values()].map(g => (
                <li key={g.nome}>
                  <span><b>{g.nome}</b><small>{g.qtd} venda{g.qtd > 1 ? 's' : ''}</small></span>
                  <b className="pl-pgc-valor">{formatMoeda(g.total)}</b>
                </li>
              ))}
            </ul>
            <div className="pl-pgc-campos">
              <div className="pl-field">
                <label htmlFor="pgc-data">Data do pagamento</label>
                <input id="pgc-data" type="date" className="pl-input" value={pagoEm} onChange={e => setPagoEm(e.target.value)} required />
              </div>
              <div className="pl-field">
                <label htmlFor="pgc-forma">Forma de pagamento</label>
                <select id="pgc-forma" className="pl-select" value={forma} onChange={e => setForma(e.target.value as FormaPagamentoComissao)}>
                  {FORMAS_PAGAMENTO.map(f => <option key={f.valor} value={f.valor}>{f.rotulo}</option>)}
                </select>
              </div>
              <div className="pl-field pl-pgc-largo">
                <label htmlFor="pgc-pagador">Quem paga (sai no comprovante)</label>
                <input id="pgc-pagador" type="text" className="pl-input" value={pagador} onChange={e => setPagador(e.target.value)} maxLength={120} required />
              </div>
              <div className="pl-field pl-pgc-largo">
                <label htmlFor="pgc-obs">Observação (opcional)</label>
                <input id="pgc-obs" type="text" className="pl-input" value={observacao} onChange={e => setObservacao(e.target.value)} maxLength={500} placeholder="Ex: comissões de setembro" />
              </div>
            </div>
            {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 12 }}>{erro}</div>}
            <div className="pl-pgc-acoes">
              <button type="button" className="pl-btn pl-btn-ghost" onClick={onFechar}>Cancelar</button>
              <button type="submit" className="pl-btn pl-btn-primary" disabled={salvando}>{salvando ? 'Registrando…' : 'Confirmar pagamento'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
