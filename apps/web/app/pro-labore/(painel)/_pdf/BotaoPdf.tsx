'use client'

// "Baixar PDF do dia": monta o relatório com os dados da aba e baixa o arquivo.
import { useState } from 'react'
import { baixarRelatorioPdf, type RelatorioPdf } from '@/lib/relatorioPdf'

export function BotaoPdf({ montar, rotulo = 'Baixar PDF do dia', desabilitado }: {
  montar: () => Promise<RelatorioPdf> | RelatorioPdf
  rotulo?: string
  desabilitado?: boolean
}) {
  const [gerando, setGerando] = useState(false)
  async function gerar() {
    setGerando(true)
    try { await baixarRelatorioPdf(await montar()) } catch (e) { alert(`Não deu para gerar o PDF: ${(e as Error).message}`) } finally { setGerando(false) }
  }
  return (
    <button type="button" className="pl-btn pl-btn-ghost" onClick={gerar} disabled={gerando || desabilitado} data-pdf-dia>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M12 18v-6" /><path d="M9 15l3 3 3-3" /></svg>
      {gerando ? 'Gerando PDF…' : rotulo}
    </button>
  )
}

/** Botões de ação lado a lado no cabeçalho da aba. */
export function AcoesCabecalho({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{children}</div>
}
