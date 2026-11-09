'use client'

// Cabeçalho padrão de cada tela do painel — mesma estrutura (categoria,
// título, descrição, ações) em todas as páginas, pra dar a sensação de um
// sistema único em vez de telas montadas cada uma do seu jeito.
import { useTelas } from './(painel)/_padrao/Padrao'

export function PageHeader({ eyebrow, title, subtitle, actions }: {
  eyebrow: string
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  // Versão nova (PDF 04): o cabeçalho da ficha da aba já está no topo; aqui fica só o que a página faz.
  const { versao } = useTelas()
  if (versao === 'NOVA') return actions ? <div className="pl-section-head pl-page-head" style={{ justifyContent: 'flex-end' }}>{actions}</div> : null
  return (
    <div className="pl-section-head pl-page-head">
      <div>
        <div className="pl-eyebrow">{eyebrow}</div>
        <h1 className="pl-page-title">{title}</h1>
        {subtitle && <div className="pl-page-subtitle">{subtitle}</div>}
      </div>
      {actions}
    </div>
  )
}
