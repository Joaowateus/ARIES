import type { Metadata, Viewport } from 'next'

// Fase 5 (seção 11.5): o espaço do Social Media é instalável como PWA, com
// Web Push. O manifesto e os ícones ficam em public/ (sm.webmanifest).
export const metadata: Metadata = {
  title: 'Pró-Labore · Social Media',
  manifest: '/sm.webmanifest',
  appleWebApp: { capable: true, title: 'Social Media', statusBarStyle: 'black-translucent' },
  icons: { apple: '/sm-icone-180.png' },
}

export const viewport: Viewport = {
  themeColor: '#0A0A0B',
}

export default function LayoutSocialMedia({ children }: { children: React.ReactNode }) {
  return children
}
