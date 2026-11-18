import { ProLaboreAuthProvider } from '@/lib/proLaboreAuth'
import { PLThemeShell } from '@/lib/proLaboreTheme'
import './pro-labore.css'
// Design System: tokens de cor e fonte. Carregado por último para valer sobre as camadas antigas.
import './ds/tokens.css'
import { AvisoAmbiente } from './AvisoAmbiente'

export default function ProLaboreRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProLaboreAuthProvider>
      <PLThemeShell><AvisoAmbiente />{children}</PLThemeShell>
    </ProLaboreAuthProvider>
  )
}
