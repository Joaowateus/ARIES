'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Tema = 'light' | 'dark'

const PLThemeContext = createContext<{ tema: Tema; setTema: (t: Tema) => void } | null>(null)

function getTemaSalvo(): Tema {
  if (typeof window === 'undefined') return 'dark'
  return (localStorage.getItem('pro_labore_theme') as Tema | null) ?? 'dark'
}

export function PLThemeShell({ children }: { children: ReactNode }) {
  const [tema, setTemaState] = useState<Tema>('dark')

  useEffect(() => { setTemaState(getTemaSalvo()) }, [])

  function setTema(novoTema: Tema) {
    setTemaState(novoTema)
    localStorage.setItem('pro_labore_theme', novoTema)
  }

  return (
    <PLThemeContext.Provider value={{ tema, setTema }}>
      <div className="pl-app" data-theme={tema}>
        {children}
      </div>
    </PLThemeContext.Provider>
  )
}

export function PLThemeToggle() {
  const ctx = useContext(PLThemeContext)
  if (!ctx) return null
  const { tema, setTema } = ctx

  return (
    <div className="pl-theme-toggle" role="group" aria-label="Tema">
      <button type="button" aria-label="Tema claro" title="Tema claro" className={tema === 'light' ? 'active' : ''} onClick={() => setTema('light')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" />
        </svg>
      </button>
      <button type="button" aria-label="Tema escuro" title="Tema escuro" className={tema === 'dark' ? 'active' : ''} onClick={() => setTema('dark')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      </button>
    </div>
  )
}
