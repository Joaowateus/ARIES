'use client'

// Escolha da moto do estoque ao lançar a venda: preenche a placa (e o valor,
// se a moto tem preço) e, ao registrar, a moto sai do estoque como vendida.
import { useEffect, useState } from 'react'
import { proLaboreApi, type MotoParaVenda } from '@/lib/proLaboreApi'

export const nomeMotoVenda = (m: MotoParaVenda) => [m.marca, m.modelo, m.versao, m.ano, m.cor].filter(Boolean).join(' ')

export function SeletorMoto({ valor, onEscolher, id = 'venda-moto' }: { valor: string; onEscolher: (moto: MotoParaVenda | null) => void; id?: string }) {
  const [motos, setMotos] = useState<MotoParaVenda[] | null>(null)
  useEffect(() => { proLaboreApi.vendas.estoque().then(setMotos).catch(() => setMotos([])) }, [])
  return (
    <div className="pl-field">
      <label htmlFor={id}>Moto do estoque</label>
      <select id={id} className="pl-select" value={valor} onChange={e => onEscolher(motos?.find(m => m.id === e.target.value) ?? null)} data-seletor-moto>
        <option value="">{motos === null ? 'Carregando…' : motos.length ? '— Não está no estoque —' : 'Nenhuma moto no estoque'}</option>
        {(motos ?? []).map(m => <option key={m.id} value={m.id}>{nomeMotoVenda(m)}{m.placa ? ` · ${m.placa}` : ''}{m.situacao === 'RESERVADA' ? ' · reservada' : ''}</option>)}
      </select>
      <span className="pl-hint">{valor ? 'Ao registrar, a moto sai do estoque como vendida' : 'Escolha para dar baixa no estoque sozinho'}</span>
    </div>
  )
}
