import { ProLaboreAuthProvider } from '@/lib/proLaboreAuth'

export default function ProLaboreRootLayout({ children }: { children: React.ReactNode }) {
  return <ProLaboreAuthProvider>{children}</ProLaboreAuthProvider>
}
