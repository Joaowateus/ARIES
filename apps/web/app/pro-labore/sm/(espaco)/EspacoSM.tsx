'use client'

// Contexto do espaço do Social Media: quem está vendo (papel, gestor ou
// gestor em "ver como"), níveis por módulo, regras e a conta do Instagram.
import { createContext, useContext } from 'react'
import type { SmEu, SmModulo, SmNivel } from '@/lib/proLaboreApi'

export interface EspacoSM {
  eu: SmEu
  recarregar: () => void
  pode: (m: SmModulo, minimo?: SmNivel) => boolean
}

export const EspacoSMCtx = createContext<EspacoSM | null>(null)

export function useEspacoSM(): EspacoSM {
  const ctx = useContext(EspacoSMCtx)
  if (!ctx) throw new Error('useEspacoSM fora do layout do espaço do Social Media')
  return ctx
}

const PESO: Record<SmNivel, number> = { SEM_ACESSO: 0, LEITURA: 1, COMPLETO: 2 }
export const atende = (nivel: SmNivel, minimo: SmNivel) => PESO[nivel] >= PESO[minimo]
