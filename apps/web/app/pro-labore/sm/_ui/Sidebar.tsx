'use client'

// Menu lateral do papel Social Media e o cartão de status da conta
// (protótipo: coluna esquerda de Main.html e das demais telas).
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { Chip, Rotulo } from './componentes'

export interface ItemMenu {
  href: string
  rotulo: string
  icone: ReactNode
  /** Contador azul à direita (ex.: conversas esperando). Zero não aparece. */
  contador?: number
}

export function SidebarSM({ grupos, conta, aoSair, preferencias, papel = 'Social Media', subtitulo = 'Social Media · acesso isolado' }: {
  grupos: Array<{ rotulo: string; itens: ItemMenu[] }>
  conta?: ReactNode
  aoSair?: () => void
  /** Link para as preferências da pessoa (seção 11.1: "Dá para mudar tudo depois em Preferências"). */
  preferencias?: string
  papel?: string
  subtitulo?: string
}) {
  const caminho = usePathname()
  // Item ativo: o href mais longo que é prefixo do caminho atual.
  const todos = grupos.flatMap(g => g.itens)
  const ativo = todos
    .filter(i => caminho === i.href || caminho.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href
  return (
    <aside className="sm-sidebar">
      <div className="sm-marca">
        <div className="sm-marca-logo" aria-hidden="true">A</div>
        <div><div className="sm-marca-nome">Pró-Labore</div><div className="sm-marca-sub">{subtitulo}</div></div>
      </div>
      <nav aria-label="Principal" className="sm-nav-lista">
        {grupos.map((g, gi) => (
          <div key={g.rotulo} style={{ display: 'contents' }}>
            <Rotulo as="div" className={gi === 0 ? 'sm-nav-grupo primeiro' : 'sm-nav-grupo'}>{g.rotulo}</Rotulo>
            {g.itens.map(i => (
              <Link key={i.href} href={i.href} className="sm-nav" aria-current={i.href === ativo ? 'page' : undefined}>
                {i.icone}{i.rotulo}
                {!!i.contador && <Chip contador titulo={`${i.contador} pendentes`}>{i.contador}</Chip>}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="sm-sidebar-rodape">
        {conta}
        <div className="sm-sidebar-sair">
          <Rotulo>{papel}</Rotulo>
          <span style={{ display: 'flex', gap: 12 }}>
            {preferencias && <Link href={preferencias} aria-current={caminho === preferencias ? 'page' : undefined}>Preferências</Link>}
            {aoSair && <button type="button" onClick={aoSair}>Sair</button>}
          </span>
        </div>
      </div>
    </aside>
  )
}

export type StatusConta = 'ok' | 'warn' | 'bad' | 'neutro'

/** "há 12 min", "há 3 h", "há 2 dias" — sempre a partir de dado real. */
export function haQuanto(iso: string | Date, agora: Date = new Date()): string {
  const ms = agora.getTime() - new Date(iso).getTime()
  const min = Math.max(0, Math.round(ms / 60000))
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.round(h / 24)
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`
}

const iniciais = (usuario: string) => usuario.replace(/^@/, '').split(/[^a-zA-Z0-9]+/).filter(Boolean).join('').slice(0, 2).toUpperCase() || '?'

export function CartaoStatusConta({ usuario, tipo, avatarUrl, status, texto, acao }: {
  usuario: string
  tipo: string
  avatarUrl?: string | null
  status: StatusConta
  texto: ReactNode
  acao?: ReactNode
}) {
  return (
    <div className="sm-card sm-conta">
      <div className="sm-conta-linha">
        <div className="sm-conta-avatar" aria-hidden="true">
          {avatarUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={avatarUrl} alt="" />
            : iniciais(usuario)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="sm-conta-nome">{usuario.startsWith('@') ? usuario : `@${usuario}`}</div>
          <div className="sm-conta-tipo">{tipo}</div>
        </div>
      </div>
      <div className={`sm-status ${status}`} role="status">{texto}</div>
      {acao}
    </div>
  )
}
