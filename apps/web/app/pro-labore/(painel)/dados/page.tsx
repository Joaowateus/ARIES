'use client'

// PDF 02 · Dados e auditoria (dono e supervisor): a Saúde dos dados
// (correções pendentes) e a trilha de auditoria imutável. O dono vê tudo;
// o supervisor, a da equipe (matriz 4.7).
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { PageHeader } from '../../PageHeader'
import { SaudeDados } from '../configuracoes/_jornada/SaudeDados'
import { TrilhaAuditoria } from '../configuracoes/_jornada/TrilhaAuditoria'

export default function DadosPage() {
  const { usuario } = useProLaboreAuth()
  const gestao = usuario?.papel === 'DONO' || usuario?.papel === 'SUPERVISOR'
  if (!usuario) return null
  if (!gestao) {
    return (
      <div className="pl-empty pl-card">
        <h3 style={{ margin: 0, color: 'var(--pl-ink-1)', fontWeight: 600 }}>Seu acesso não inclui essa área</h3>
        <p style={{ marginTop: 6 }}>As correções que são suas aparecem no próprio lead.</p>
      </div>
    )
  }
  return (
    <div>
      <PageHeader eyebrow="Equipe" title="Dados e auditoria" subtitle="O que precisa ser corrigido e quem mudou o quê" />
      <SaudeDados podeReavaliar />
      <TrilhaAuditoria />
    </div>
  )
}
