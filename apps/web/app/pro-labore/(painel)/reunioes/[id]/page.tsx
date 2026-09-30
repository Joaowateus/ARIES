'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { proLaboreApi, type ApresentacaoDetalhe } from '@/lib/proLaboreApi'
import Apresentador from '../_componentes/Apresentador'
import Espectador from '../_componentes/Espectador'

// Mesma URL pra todo mundo: o dono abre como apresentador (edita e
// transmite), a equipe abre como espectador (só assiste).
export default function ProLaboreApresentacaoPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [dados, setDados] = useState<{ id: string; detalhe: ApresentacaoDetalhe } | null>(null)
  const [erro, setErro] = useState<{ id: string; mensagem: string } | null>(null)

  useEffect(() => {
    let cancelado = false
    proLaboreApi.apresentacoes.obter(id)
      .then(detalhe => { if (!cancelado) setDados({ id, detalhe }) })
      .catch(e => { if (!cancelado) setErro({ id, mensagem: (e as Error).message }) })
    return () => { cancelado = true }
  }, [id])

  if (erro?.id === id) {
    return (
      <div className="pl-empty pl-card">
        <div className="pl-emoji">🔒</div>
        <h3 style={{ margin: 0, color: 'var(--pl-ink-1)', fontWeight: 600 }}>{erro.mensagem}</h3>
        <p style={{ marginTop: 6 }}>Ela pode ter sido excluída ou não estar disponível pra equipe agora.</p>
        <Link href="/pro-labore/reunioes" className="pl-btn pl-btn-ghost" style={{ marginTop: 12 }}>Voltar pras apresentações</Link>
      </div>
    )
  }
  if (!dados || dados.id !== id) return <div className="pl-hint">Carregando apresentação…</div>
  return dados.detalhe.podeEditar
    ? <Apresentador key={id} inicial={dados.detalhe} />
    : <Espectador key={id} inicial={dados.detalhe} />
}
