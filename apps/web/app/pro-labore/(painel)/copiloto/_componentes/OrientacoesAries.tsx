'use client'

// PDF 03 · orientações individuais do ARIES para a própria pessoa, no ponto
// já usado pelo Copiloto (até as telas Hoje da onda 3). Tom de
// desenvolvimento; aceitar cria as atividades, descartar pede motivo.
import { useCallback, useEffect, useState } from 'react'
import { recApi } from '@/lib/proLaboreApi'
import { DetalheRec, ForcaChip } from '../../recomendacoes/DetalheRec'

export function OrientacoesAries() {
  const [itens, setItens] = useState<Awaited<ReturnType<typeof recApi.minhas>>>([])
  const [aberta, setAberta] = useState<string | null>(null)
  const carregar = useCallback(() => recApi.minhas().then(setItens).catch(() => setItens([])), [])
  useEffect(() => { void carregar() }, [carregar])
  if (!itens.length) return null
  return (
    <section className="pl-card" style={{ marginBottom: 16 }} data-orientacoes-aries>
      <div className="pl-card-title" style={{ marginBottom: 8 }}>O ARIES recomenda para você</div>
      <div style={{ display: 'grid', gap: 10 }}>
        {itens.map(o => (
          <div key={o.id} data-orientacao-rec={o.id} style={{ borderTop: '1px solid var(--pl-border)', paddingTop: 8 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}><b>{o.titulo}</b><ForcaChip forca={o.forca} /></div>
            {o.orientacao && <p style={{ margin: '4px 0' }}>{o.orientacao}</p>}
            <button type="button" className="pl-btn" onClick={() => setAberta(o.id)} data-ver-orientacao>{o.status === 'NOVA' ? 'Ver e decidir' : 'Ver as atividades'}</button>
            <span className="pl-hint" style={{ marginLeft: 8 }}>prazo {new Date(o.prazo).toLocaleDateString('pt-BR')}</span>
          </div>
        ))}
      </div>
      {aberta && <DetalheRec id={aberta} onFechar={() => setAberta(null)} onMudou={() => void carregar()} />}
    </section>
  )
}
