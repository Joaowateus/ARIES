'use client'

// PDF 02 · 4.7 Matriz de quem pode fazer cada ação (consulta).
import { useEffect, useState } from 'react'
import { qualidadeApi } from '@/lib/proLaboreApi'

const PERFIL: Record<string, string> = { DONO: 'Dono', GERENTE: 'Gerente', SUPERVISOR: 'Supervisor', SDR: 'SDR', VENDEDOR: 'Vendedor', SOCIAL_MEDIA: 'Social Media', DESTINATARIO: 'Quem recebeu' }

export function MatrizAcoes() {
  const [m, setM] = useState<Awaited<ReturnType<typeof qualidadeApi.matriz>> | null>(null)
  useEffect(() => { qualidadeApi.matriz().then(setM).catch(() => setM(null)) }, [])
  if (!m) return null
  return (
    <section className="pl-card" id="matriz-acoes" style={{ marginBottom: 20 }} data-matriz-acoes>
      <div className="pl-card-head"><div>
        <div className="pl-card-title">Matriz de permissões</div>
        <div className="pl-card-sub">Quem pode fazer cada ação. Os perfis e o ajuste por módulo continuam como hoje. O perfil gerente ainda não existe: até ser criado, essas ações ficam com o dono.</div>
      </div></div>
      <div style={{ overflowX: 'auto' }}>
        <table className="pl-table"><thead><tr><th>Ação</th><th>Quem pode</th></tr></thead>
          <tbody>{m.acoes.map(a => (
            <tr key={a.chave}><td>{a.nome}</td><td>{a.perfis.map(p => PERFIL[p] ?? p).join(', ')}{a.nota ? <div className="pl-hint">{a.nota}</div> : null}</td></tr>
          ))}</tbody></table>
      </div>
    </section>
  )
}
