'use client'

// Escolha de pasta das Anotações em árvore (mover itens, salvar cópia de
// uma reunião…). Dá pra abrir/fechar as subpastas e criar uma pasta nova
// ali mesmo, sem sair do diálogo.
import { useState } from 'react'
import { proLaboreApi, type Pasta } from '@/lib/proLaboreApi'

export default function EscolherPasta({ pastas, valor, onEscolher, bloqueadas, onPastaCriada }: {
  pastas: Pasta[]
  valor: string | null
  onEscolher: (id: string | null) => void
  // Pastas que não podem ser destino (ex.: a própria pasta sendo movida e
  // as que estão dentro dela).
  bloqueadas?: Set<string>
  onPastaCriada?: (p: Pasta) => void
}) {
  // Já abre mostrando o caminho até a pasta escolhida.
  const [abertas, setAbertas] = useState<Set<string>>(() => {
    const s = new Set<string>()
    for (let atual = pastas.find(p => p.id === valor); atual?.paiId; atual = pastas.find(p => p.id === atual!.paiId)) s.add(atual.paiId)
    return s
  })
  const [criandoEm, setCriandoEm] = useState<string | null | undefined>(undefined)
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState('')

  const filhas = (id: string | null) => pastas.filter(p => (p.paiId ?? null) === id).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const alternar = (id: string) => setAbertas(prev => {
    const s = new Set(prev)
    if (s.has(id)) s.delete(id); else s.add(id)
    return s
  })

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    const n = nome.trim()
    if (!n || criandoEm === undefined) return
    try {
      const p = await proLaboreApi.pastas.criar({ nome: n, paiId: criandoEm })
      onPastaCriada?.(p)
      if (criandoEm) setAbertas(prev => new Set(prev).add(criandoEm))
      onEscolher(p.id)
      setCriandoEm(undefined)
      setNome('')
      setErro('')
    } catch (err) {
      setErro((err as Error).message)
    }
  }

  function linha(p: Pasta, nivel: number): React.ReactNode {
    const sub = filhas(p.id)
    const bloqueada = bloqueadas?.has(p.id) ?? false
    const aberta = abertas.has(p.id)
    return (
      <div key={p.id} role="none">
        <div className={`pl-ep-linha ${valor === p.id ? 'ativo' : ''} ${bloqueada ? 'bloqueada' : ''}`} style={{ paddingLeft: 6 + nivel * 16 }}>
          <button type="button" className={`pl-ep-seta ${sub.length ? '' : 'vazia'}`} onClick={() => alternar(p.id)} aria-label={aberta ? 'Fechar' : 'Abrir'} tabIndex={sub.length ? 0 : -1}>
            {sub.length ? (aberta ? '▾' : '▸') : ''}
          </button>
          <button type="button" role="treeitem" aria-selected={valor === p.id} className="pl-ep-nome" disabled={bloqueada} onClick={() => onEscolher(p.id)} onDoubleClick={() => alternar(p.id)}>
            <span className="pl-ep-icone">{p.icone || '📁'}</span>{p.nome}
          </button>
          {!bloqueada && (
            <button type="button" className="pl-ep-mais" title={`Nova pasta dentro de ${p.nome}`} onClick={() => { setCriandoEm(p.id); setNome('') }}>+</button>
          )}
        </div>
        {criandoEm === p.id && formNova(nivel + 1)}
        {aberta && sub.map(f => linha(f, nivel + 1))}
      </div>
    )
  }

  function formNova(nivel: number) {
    return (
      <form className="pl-ep-nova" style={{ paddingLeft: 28 + nivel * 16 }} onSubmit={criar}>
        <input className="pl-input" autoFocus value={nome} maxLength={100} placeholder="Nome da pasta" onChange={e => setNome(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setCriandoEm(undefined) } }} />
        <button type="submit" className="pl-btn pl-btn-primary" disabled={!nome.trim()}>Criar</button>
      </form>
    )
  }

  return (
    <div className="pl-ep" role="tree" aria-label="Pastas das Anotações">
      <div className={`pl-ep-linha ${valor === null ? 'ativo' : ''}`} style={{ paddingLeft: 6 }}>
        <span className="pl-ep-seta vazia" />
        <button type="button" role="treeitem" aria-selected={valor === null} className="pl-ep-nome" onClick={() => onEscolher(null)}>
          <span className="pl-ep-icone">🏠</span>Todas as notas <small>(fora de pasta)</small>
        </button>
        <button type="button" className="pl-ep-mais" title="Nova pasta" onClick={() => { setCriandoEm(null); setNome('') }}>+</button>
      </div>
      {criandoEm === null && formNova(0)}
      {filhas(null).map(p => linha(p, 0))}
      {erro && <div className="pl-alert pl-alert-error" style={{ margin: 8 }}>{erro}</div>}
    </div>
  )
}
