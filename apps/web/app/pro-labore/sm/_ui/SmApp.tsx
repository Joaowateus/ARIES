'use client'

// Raiz visual do espaço do Social Media: aplica os tokens --sm-* (escopados
// em .sm-app) e o provedor de toasts. O tema segue a preferência do
// Pró-Labore (data-theme em .pl-app).
import type { CSSProperties, ReactNode } from 'react'
import './sm.css'
import { ToastProvider } from './Toast'

export function SmApp({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={className ? `sm-app ${className}` : 'sm-app'} style={style}>
      <ToastProvider>{children}</ToastProvider>
    </div>
  )
}
