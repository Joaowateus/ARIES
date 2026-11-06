'use client'

// Rodízio da jornada (PDF 01, seção 5): quem recebe leads e passagens. Pessoa
// ausente ou de folga sai do rodízio enquanto estiver marcada como indisponível.
import { useEffect, useState } from 'react'
import { proLaboreApi, type PessoaRodizio } from '@/lib/proLaboreApi'

export function RodizioLeads() {
  const [equipe, setEquipe] = useState<PessoaRodizio[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => { proLaboreApi.jornada.rodizio().then(setEquipe).catch(() => setEquipe(null)) }, [])
  if (!equipe) return null
  async function alternar(p: PessoaRodizio) {
    setErro(null)
    try { setEquipe(await proLaboreApi.jornada.disponivel(p.vendedorId, !p.disponivel)) } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível') }
  }
  return (
    <section className="pl-card" id="rodizio" style={{ marginBottom: 20 }} data-rodizio>
      <div className="pl-card-head"><div>
        <div className="pl-card-title">Rodízio de leads</div>
        <div className="pl-card-sub">Quem recebe as passagens do SDR (e, quando houver SDRs, os leads novos). Marque como indisponível quem estiver de folga ou ausente.</div>
      </div></div>
      {erro && <div className="pl-alert" role="alert">{erro}</div>}
      <table className="pl-table"><thead><tr><th>Pessoa</th><th>Papel</th><th>Último lead recebido</th><th /></tr></thead>
        <tbody>{equipe.map(p => (
          <tr key={p.vendedorId}>
            <td>{p.nome}</td><td>{p.papel === 'SDR' ? 'SDR' : 'Vendedor'}</td>
            <td>{p.ultimoRecebidoEm ? new Date(p.ultimoRecebidoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
            <td style={{ textAlign: 'right' }}><button type="button" className={`pl-chip ${p.disponivel ? 'active' : ''}`} aria-pressed={p.disponivel} onClick={() => void alternar(p)} data-disponivel={p.vendedorId}>{p.disponivel ? 'Disponível' : 'Indisponível'}</button></td>
          </tr>
        ))}</tbody></table>
    </section>
  )
}
