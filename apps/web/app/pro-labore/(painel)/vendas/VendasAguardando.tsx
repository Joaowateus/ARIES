'use client'

// Vendas registradas pelos vendedores aguardando a confirmação do dono (PDF 01,
// etapa 10). Só depois de confirmada a venda conta no faturamento, na
// comissão e no Dashboard, e o Pós-venda começa (entrega, documentação e
// primeira revisão).
import { useEffect, useState } from 'react'
import { proLaboreApi } from '@/lib/proLaboreApi'

type Item = Awaited<ReturnType<typeof proLaboreApi.jornada.vendasAguardando>>[number]
const MOTIVOS = [['CANCELADA_DESISTENCIA', 'Desistência'], ['CREDITO_NAO_LIBERADO', 'Crédito não liberado na formalização'], ['ERRO_REGISTRO', 'Erro de registro']] as const
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function VendasAguardando({ onMudou }: { onMudou: () => void }) {
  const [itens, setItens] = useState<Item[] | null>(null)
  const [cancelando, setCancelando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const carregar = () => proLaboreApi.jornada.vendasAguardando().then(setItens).catch(() => setItens(null))
  useEffect(() => { void carregar() }, [])
  if (!itens?.length) return null
  async function fazer(fn: () => Promise<unknown>) {
    setErro(null)
    try { await fn(); setCancelando(null); await carregar(); onMudou() } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível') }
  }
  return (
    <section className="pl-card" style={{ marginBottom: 16 }} data-vendas-aguardando>
      <div className="pl-card-title">Aguardando sua confirmação ({itens.length})</div>
      <div className="pl-card-sub">Registradas pelos vendedores. Só contam no faturamento, na comissão e no Dashboard depois de confirmadas; a confirmação abre o Pós-venda.</div>
      {erro && <div className="pl-alert" role="alert">{erro}</div>}
      <table className="pl-table"><tbody>{itens.map(v => (
        <tr key={v.id} data-venda-aguardando={v.id}>
          <td>{new Date(v.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
          <td>{v.lead?.nomeCliente ?? '—'}{v.placa ? ` · ${v.placa}` : ''}</td>
          <td>{v.vendedor?.nome ?? '—'}</td>
          <td style={{ textAlign: 'right' }}>{brl(v.valorVenda)}</td>
          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
            {cancelando === v.id ? (
              <>{MOTIVOS.map(([m, n]) => <button key={m} type="button" className="pl-btn pl-btn-ghost" style={{ padding: '2px 8px', marginLeft: 4 }} onClick={() => void fazer(() => proLaboreApi.jornada.cancelarVenda(v.id, m))} data-motivo-cancelamento={m}>{n}</button>)}
                <button type="button" className="pl-link-action" style={{ marginLeft: 6 }} onClick={() => setCancelando(null)}>voltar</button></>
            ) : (
              <><button type="button" className="pl-btn pl-btn-primary" style={{ padding: '2px 10px' }} onClick={() => void fazer(() => proLaboreApi.jornada.confirmarVenda(v.id))} data-confirmar-venda>Confirmar</button>
                <button type="button" className="pl-btn pl-btn-ghost" style={{ padding: '2px 10px', marginLeft: 6 }} onClick={() => setCancelando(v.id)} data-cancelar-venda>Cancelar</button></>
            )}
          </td>
        </tr>
      ))}</tbody></table>
    </section>
  )
}
