// Cabeçalho padrão de cada tela do painel — mesma estrutura (categoria,
// título, descrição, ações) em todas as páginas, pra dar a sensação de um
// sistema único em vez de telas montadas cada uma do seu jeito.
export function PageHeader({ eyebrow, title, subtitle, actions }: {
  eyebrow: string
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="pl-section-head" style={{ marginTop: 0 }}>
      <div>
        <div className="pl-eyebrow">{eyebrow}</div>
        <h1 className="pl-page-title">{title}</h1>
        {subtitle && <div className="pl-page-subtitle">{subtitle}</div>}
      </div>
      {actions}
    </div>
  )
}
