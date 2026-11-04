import { ProLaboreAuthProvider } from '@/lib/proLaboreAuth'
import { PLThemeShell } from '@/lib/proLaboreTheme'
import './pro-labore.css'
import { AvisoAmbiente } from './AvisoAmbiente'

export default function ProLaboreRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProLaboreAuthProvider>
      <PLThemeShell><AvisoAmbiente />{children}</PLThemeShell>
    </ProLaboreAuthProvider>
  )
}
