'use client'

// "Baixar PDF do dia": monta o relatório com os dados da aba e baixa o arquivo.
// Com mais de uma versão (ex.: gestão e equipe), abre um menu para escolher.
import { useEffect, useRef, useState } from 'react'
import { baixarRelatorioPdf, type RelatorioPdf } from '@/lib/relatorioPdf'

type Montar = () => Promise<RelatorioPdf> | RelatorioPdf
export interface VersaoPdf { rotulo: string; descricao?: string; montar: Montar }

const Icone = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M12 18v-6" /><path d="M9 15l3 3 3-3" /></svg>
)

export function BotaoPdf({ montar, versoes, rotulo = 'Baixar PDF do dia', desabilitado }: {
  montar?: Montar
  versoes?: VersaoPdf[]
  rotulo?: string
  desabilitado?: boolean
}) {
  const [gerando, setGerando] = useState(false)
  const [menu, setMenu] = useState(false)
  // Botão perto da borda esquerda (celular): o menu abre para a direita.
  const [paraDireita, setParaDireita] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menu) return
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setMenu(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false) }
    document.addEventListener('mousedown', fora); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [menu])

  async function gerar(fn: Montar) {
    setMenu(false); setGerando(true)
    try { await baixarRelatorioPdf(await fn()) } catch (e) { alert(`Não deu para gerar o PDF: ${(e as Error).message}`) } finally { setGerando(false) }
  }

  if (!versoes?.length) {
    return (
      <button type="button" className="pl-btn pl-btn-ghost" onClick={() => montar && gerar(montar)} disabled={gerando || desabilitado} data-pdf-dia>
        <Icone />{gerando ? 'Gerando PDF…' : rotulo}
      </button>
    )
  }
  return (
    <div ref={caixa} style={{ position: 'relative' }}>
      <button type="button" className="pl-btn pl-btn-ghost" onClick={() => { setParaDireita((caixa.current?.getBoundingClientRect().right ?? 999) < 280); setMenu(m => !m) }} disabled={gerando || desabilitado} aria-haspopup="menu" aria-expanded={menu} data-pdf-dia>
        <Icone />{gerando ? 'Gerando PDF…' : rotulo}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {menu && (
        <div role="menu" className="pl-card" style={{ position: 'absolute', ...(paraDireita ? { left: 0 } : { right: 0 }), top: 'calc(100% + 6px)', zIndex: 40, padding: 6, minWidth: 260, maxWidth: 'calc(100vw - 32px)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {versoes.map(v => (
            <button key={v.rotulo} type="button" role="menuitem" className="pl-btn pl-btn-ghost" style={{ justifyContent: 'flex-start', textAlign: 'left', border: 'none', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '9px 11px' }} onClick={() => gerar(v.montar)} data-pdf-versao={v.rotulo}>
              <span>{v.rotulo}</span>
              {v.descricao && <span style={{ fontWeight: 500, fontSize: 12, color: 'var(--pl-ink-muted)' }}>{v.descricao}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Botões de ação lado a lado no cabeçalho da aba. */
export function AcoesCabecalho({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{children}</div>
}
