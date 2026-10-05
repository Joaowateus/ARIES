'use client'

// Confirma o pagamento das vendas escolhidas: data, forma, quem paga e
// (no pró-labore) quem recebe. Comissão de vendedores diferentes vira um
// comprovante pra cada vendedor; pró-labore vira um recibo só. Depois de
// registrar, mostra os comprovantes prontos pra imprimir.
import { useEffect, useState } from 'react'
import { proLaboreApi, type FormaPagamentoComissao, type PagamentoComissao, type TipoPagamentoVenda, type Venda } from '@/lib/proLaboreApi'
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

export const valorPago = (tipo: TipoPagamentoVenda, v: Venda) => (tipo === 'COMISSAO' ? v.valorComissao ?? 0 : v.valorProLabore)

export default function RegistrarPagamento({ tipo, vendas, nomeDono, onFechar, onRegistrado }: {
  tipo: TipoPagamentoVenda
  vendas: Venda[]
  nomeDono: string
  onFechar: () => void
  onRegistrado: () => void
}) {
  const proLabore = tipo === 'PROLABORE'
  const [pagoEm, setPagoEm] = useState(hojeLocal)
  const [forma, setForma] = useState<FormaPagamentoComissao>('PIX')
  // Comissão: quem paga é o dono. Pró-labore: quem recebe é o dono e quem
  // paga é a empresa (vem preenchido com a da última retirada).
  const [pagador, setPagador] = useState(proLabore ? '' : nomeDono)
  const [recebedor, setRecebedor] = useState(nomeDono)
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [feitos, setFeitos] = useState<PagamentoComissao[] | null>(null)

  useEffect(() => {
    if (!proLabore) return
    let cancelado = false
    proLaboreApi.pagamentosVendas.listar('PROLABORE')
      .then(l => { if (!cancelado && l[0]?.pagador) setPagador(atual => atual || l[0].pagador) })
      .catch(() => {})
    return () => { cancelado = true }
  }, [proLabore])

  const grupos = new Map<string, { nome: string; qtd: number; total: number }>()
  for (const v of vendas) {
    const k = proLabore ? 'dono' : v.vendedorId ?? ''
    const atual = grupos.get(k) ?? { nome: proLabore ? 'Pró-labore' : v.vendedor?.nome ?? '—', qtd: 0, total: 0 }
    grupos.set(k, { ...atual, qtd: atual.qtd + 1, total: atual.total + valorPago(tipo, v) })
  }
  const total = vendas.reduce((s, v) => s + valorPago(tipo, v), 0)

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      const r = await proLaboreApi.pagamentosVendas.pagar({
        tipo, vendaIds: vendas.map(v => v.id), pagoEm, formaPagamento: forma, pagador,
        recebedor: proLabore ? recebedor : null, observacao: observacao || null,
      })
      setFeitos(r)
      onRegistrado()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não deu pra registrar o pagamento')
    } finally {
      setSalvando(false)
    }
  }

  const n = (q: number) => `${q} venda${q > 1 ? 's' : ''}`
  return (
    <div className="pl-modal-backdrop" onClick={onFechar}>
      <div className="pl-card pl-modal-panel pl-pgc-modal" role="dialog" aria-modal="true" aria-labelledby="pgc-titulo" onClick={e => e.stopPropagation()}>
        {feitos ? (
          <>
            <div className="pl-card-title" id="pgc-titulo">Pagamento registrado</div>
            <div className="pl-card-sub">{proLabore ? 'Imprima o recibo e assine.' : 'Imprima o comprovante e peça pro vendedor assinar.'}</div>
            <ul className="pl-pgc-lista">
              {feitos.map(p => (
                <li key={p.id}>
                  <span><b>{proLabore ? p.recebedor : p.vendedor?.nome}</b><small>{proLabore ? 'Recibo' : 'Comprovante'} nº {p.numero} · {n(p._count?.vendas ?? 0)}</small></span>
                  <b className="pl-pgc-valor">{formatMoeda(p.valorTotal)}</b>
                  <button type="button" className="pl-btn pl-btn-primary pl-pgc-btn" onClick={() => abrirComprovante(p.id)}>{proLabore ? 'Abrir recibo' : 'Abrir comprovante'}</button>
                </li>
              ))}
            </ul>
            <div className="pl-pgc-acoes">
              <button type="button" className="pl-btn pl-btn-ghost" onClick={onFechar}>Fechar</button>
            </div>
          </>
        ) : (
          <form onSubmit={confirmar}>
            <div className="pl-card-title" id="pgc-titulo">{proLabore ? 'Marcar pró-labore como pago' : 'Marcar comissão como paga'}</div>
            <div className="pl-card-sub">
              {n(vendas.length)} · {formatMoeda(total)}
              {grupos.size > 1 && ` · um comprovante pra cada um dos ${grupos.size} vendedores`}
            </div>
            <ul className="pl-pgc-lista">
              {[...grupos.values()].map(g => (
                <li key={g.nome}>
                  <span><b>{g.nome}</b><small>{n(g.qtd)}</small></span>
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
              {proLabore && (
                <div className="pl-field pl-pgc-largo">
                  <label htmlFor="pgc-recebedor">Quem recebe (sai no recibo)</label>
                  <input id="pgc-recebedor" type="text" className="pl-input" value={recebedor} onChange={e => setRecebedor(e.target.value)} maxLength={120} required />
                </div>
              )}
              <div className="pl-field pl-pgc-largo">
                <label htmlFor="pgc-pagador">{proLabore ? 'Quem paga — nome da empresa (sai no recibo)' : 'Quem paga (sai no comprovante)'}</label>
                <input id="pgc-pagador" type="text" className="pl-input" value={pagador} onChange={e => setPagador(e.target.value)} maxLength={120} required
                  placeholder={proLabore ? 'Ex: Minha Empresa LTDA' : undefined} />
              </div>
              <div className="pl-field pl-pgc-largo">
                <label htmlFor="pgc-obs">Observação (opcional)</label>
                <input id="pgc-obs" type="text" className="pl-input" value={observacao} onChange={e => setObservacao(e.target.value)} maxLength={500}
                  placeholder={proLabore ? 'Ex: pró-labore de setembro' : 'Ex: comissões de setembro'} />
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
