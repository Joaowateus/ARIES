import { ProLaboreAuthProvider } from '@/lib/proLaboreAuth'
import { PLThemeShell } from '@/lib/proLaboreTheme'
import './pro-labore.css'

export default function ProLaboreRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProLaboreAuthProvider>
      <PLThemeShell>{children}</PLThemeShell>
    </ProLaboreAuthProvider>
  )
}
