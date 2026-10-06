// Ícones de traço do protótipo (referencia-visual/*.html): 24×24, traço 1,8,
// sempre com aria-hidden — quem dá nome é o texto ou o aria-label do botão.
import type { ReactNode, SVGProps } from 'react'

function Icone({ tamanho = 18, children, ...resto }: { tamanho?: number; children: ReactNode } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...resto}>
      {children}
    </svg>
  )
}

type P = { tamanho?: number }

export const IcHoje = (p: P) => <Icone {...p}><path d="M3 10.5 12 3l9 7.5V21H3z" /></Icone>
export const IcCalendario = (p: P) => <Icone {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></Icone>
export const IcProducao = (p: P) => <Icone {...p}><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="10" rx="1.5" /><rect x="17" y="4" width="4" height="13" rx="1.5" /></Icone>
export const IcAtendimento = (p: P) => <Icone {...p}><path d="M4 5h16v11H9l-5 4z" /></Icone>
export const IcDesempenho = (p: P) => <Icone {...p}><path d="M5 20V11M11 20V5M17 20v-6M3 20h18" /></Icone>
export const IcVendasPorPost = (p: P) => <Icone {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /></Icone>
export const IcBusca = (p: P) => <Icone {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></Icone>
export const IcAtencao = (p: P) => <Icone {...p}><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17h.01" /></Icone>
export const IcFeito = (p: P) => <Icone {...p}><path d="m5 12 5 5L20 7" /></Icone>
export const IcSucesso = (p: P) => <Icone {...p}><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></Icone>
export const IcInsight = (p: P) => <Icone {...p}><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z" /></Icone>
export const IcFechar = (p: P) => <Icone {...p}><path d="M6 6l12 12M18 6 6 18" /></Icone>
export const IcMais = (p: P) => <Icone {...p}><path d="M12 5v14M5 12h14" /></Icone>
export const IcVazio = (p: P) => <Icone {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 14h5l1.5 2h5L16 14h5" /></Icone>
export const IcEscudo = (p: P) => <Icone {...p}><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z" /></Icone>
export const IcEstoque = (p: P) => <Icone {...p}><circle cx="6" cy="16" r="3" /><circle cx="18" cy="16" r="3" /><path d="M9 16h6l-3-7h4M6 16l3-7h3" /></Icone>
