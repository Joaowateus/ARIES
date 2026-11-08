'use client'

// PDF 02 · 4.8 "No registro": a oportunidade incompleta ou suspeita mostra
// o que falta corrigir; a origem não identificada se corrige aqui mesmo
// (lista fechada), preservando o histórico original.
import { useCallback, useEffect, useState } from 'react'
import { qualidadeApi, type CorrecaoPendente } from '@/lib/proLaboreApi'

const ORIGENS = [['INDICACAO', 'Indicação'], ['LOJA_FISICA', 'Loja física'], ['RETORNO_ESPONTANEO', 'Retorno espontâneo']] as const

export function QualidadeLead({ leadId }: { leadId: string }) {
  const [d, setD] = useState<{ classificacao: string; correcoes: CorrecaoPendente[] } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const carregar = useCallback(() => qualidadeApi.doLead(leadId).then(setD).catch(() => setD(null)), [leadId])
  useEffect(() => { void carregar() }, [carregar])
  if (!d || d.correcoes.length === 0) return null
  async function origem(v: (typeof ORIGENS)[number][0]) {
    setErro(null)
    try { await qualidadeApi.corrigirOrigem(leadId, v); await carregar() } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível corrigir') }
  }
  return (
    <section className="pl-pn-bloco" data-qualidade-lead={d.classificacao}>
      <h3>{d.classificacao === 'SUSPEITO' ? 'Dado suspeito' : 'Dado incompleto'} · o que corrigir</h3>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {d.correcoes.map(c => (
          <li key={c.id} data-correcao={c.regra}>
            <b>{c.problema}:</b> {c.oQueFalta}
            {c.regra === 'ORIGEM_NAO_IDENTIFICADA' && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {ORIGENS.map(([v, n]) => <button key={v} type="button" className="pl-btn" style={{ padding: '2px 10px' }} onClick={() => void origem(v)} data-corrigir-origem={v}>{n}</button>)}
              </div>
            )}
          </li>
        ))}
      </ul>
      {erro && <div className="pl-alert" role="alert" style={{ marginTop: 6 }}>{erro}</div>}
    </section>
  )
}
