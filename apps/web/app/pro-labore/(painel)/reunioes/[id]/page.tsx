'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { proLaboreApi, type ApresentacaoDetalhe, type ErroApi } from '@/lib/proLaboreApi'
import Apresentador from '../_componentes/Apresentador'
import Espectador from '../_componentes/Espectador'
import { SenhaDepartamento } from '../_componentes/Organizacao'

// Mesma URL pra todo mundo: o dono abre como apresentador (edita e
// transmite), a equipe abre como espectador (só assiste).
export default function ProLaboreApresentacaoPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [dados, setDados] = useState<{ id: string; detalhe: ApresentacaoDetalhe } | null>(null)
  const [erro, setErro] = useState<{ id: string; mensagem: string; departamento?: { id: string; nome: string; cor: string } } | null>(null)
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let cancelado = false
    proLaboreApi.apresentacoes.obter(id)
      .then(detalhe => { if (!cancelado) setDados({ id, detalhe }) })
      .catch((e: ErroApi) => {
        if (cancelado) return
        const dep = e.codigo === 'SENHA_DEPARTAMENTO' ? (e.dados as { departamento?: { id: string; nome: string; cor: string } })?.departamento : undefined
        setErro({ id, mensagem: e.message, departamento: dep ?? undefined })
      })
    return () => { cancelado = true }
  }, [id, tentativa])

  if (erro?.id === id && erro.departamento) {
    return (
      <div style={{ maxWidth: 420, margin: '40px auto 0' }}>
        <SenhaDepartamento departamento={erro.departamento} onLiberado={() => { setErro(null); setTentativa(t => t + 1) }} />
        <Link href="/pro-labore/reunioes" className="pl-btn pl-btn-ghost" style={{ marginTop: 12, width: '100%' }}>Voltar pras reuniões</Link>
      </div>
    )
  }
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
