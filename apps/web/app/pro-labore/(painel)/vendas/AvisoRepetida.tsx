'use client'

// Aviso antes de gravar uma venda que parece repetida (mesma placa em 60
// dias ou mesmo valor e vendedor em 3 dias). Mostra as que já existem e
// deixa registrar mesmo assim quando é outra venda.
import type { ErroApi, VendaParecida } from '@/lib/proLaboreApi'

const moeda = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })

/** As vendas parecidas que vieram no erro da API (ou null se o erro é outro). */
export function parecidasDoErro(e: unknown): { mensagem: string; parecidas: VendaParecida[] } | null {
  const erro = e as ErroApi
  if (erro?.codigo !== 'VENDA_REPETIDA') return null
  const dados = erro.dados as { parecidas?: VendaParecida[] } | undefined
  return { mensagem: erro.message, parecidas: dados?.parecidas ?? [] }
}

export function AvisoRepetida({ aviso, ocupado, onConfirmar, onCancelar }: { aviso: { mensagem: string; parecidas: VendaParecida[] }; ocupado?: boolean; onConfirmar: () => void; onCancelar: () => void }) {
  return (
    <div className="pl-alert" role="alert" style={{ marginTop: 14, borderColor: 'var(--pl-warning, #c90)' }} data-aviso-repetida>
      <b>{aviso.mensagem}</b>
      <ul style={{ margin: '8px 0', paddingLeft: 18 }}>
        {aviso.parecidas.map(p => (
          <li key={p.id}>{dia(p.data)} · {moeda(p.valorVenda)}{p.vendedor ? ` · ${p.vendedor}` : ''}{p.placa ? ` · placa ${p.placa}` : ''}{p.observacao ? ` · ${p.observacao}` : ''}</li>
        ))}
      </ul>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="pl-btn pl-btn-ghost" onClick={onCancelar}>Não registrar (é a mesma)</button>
        <button type="button" className="pl-btn pl-btn-primary" disabled={ocupado} onClick={onConfirmar} data-confirmar-repetida>É outra venda: registrar mesmo assim</button>
      </div>
    </div>
  )
}
