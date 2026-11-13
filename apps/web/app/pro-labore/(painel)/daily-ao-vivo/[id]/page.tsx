'use client'

// PDF 06 · 4.2: o link do Daily ao vivo para a equipe. Fica fora da aba Reuniões
// para que toda a equipe assista mesmo sem acesso a Reuniões; o conteúdo é
// sempre o modo equipe (montado pela tela de quem conduz).
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { proLaboreApi, type ApresentacaoDetalhe } from '@/lib/proLaboreApi'
import EspectadorDaily from '../../reunioes/_componentes/EspectadorDaily'

export default function DailyAoVivoPage() {
  const { id } = useParams<{ id: string }>()
  const [d, setD] = useState<{ id: string; detalhe: ApresentacaoDetalhe } | null>(null)
  const [erro, setErro] = useState<{ id: string; msg: string } | null>(null)
  useEffect(() => {
    let vivo = true
    proLaboreApi.apresentacoes.obter(id).then(x => { if (vivo) setD({ id, detalhe: x }) }).catch(e => { if (vivo) setErro({ id, msg: e instanceof Error ? e.message : 'Não foi possível abrir' }) })
    return () => { vivo = false }
  }, [id])
  if (erro?.id === id) return <div className="pl-card"><p>{erro.msg}</p><Link className="pl-btn" href="/pro-labore/hoje">Voltar ao Hoje</Link></div>
  if (!d || d.id !== id) return <p className="pl-hint">Abrindo o Daily ao vivo…</p>
  if ((d.detalhe.configuracao as { tipo?: string } | null)?.tipo !== 'DAILY') return <div className="pl-card"><p>Este link não é de um Daily.</p></div>
  return <EspectadorDaily key={id} inicial={d.detalhe} />
}
