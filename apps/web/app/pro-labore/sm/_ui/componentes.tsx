'use client'

// Componentes base do espaço do Social Media (seção 2.4 da especificação).
// Visual tirado do protótipo; acessibilidade da seção 2.5: botões e links
// reais, aria-pressed nos segmentados, role="switch" no toggle, aria-label em
// botão só com ícone e alvo de toque de 44px.
import Link from 'next/link'
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import { IcAtencao, IcInsight, IcSucesso, IcVazio } from './icones'

export type Tom = 'ok' | 'warn' | 'bad' | 'info' | 'learn' | 'neutro'
export type Pilar = 'estoque' | 'prova' | 'educacao' | 'bastidores'

export const PILARES: Record<Pilar, string> = {
  estoque: 'Estoque e produto',
  prova: 'Prova social',
  educacao: 'Educação',
  bastidores: 'Bastidores',
}

const juntar = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ')

export function Card({ titulo, subtitulo, acoes, children, className, style, as: Tag = 'section', rotulo }: {
  titulo?: ReactNode
  subtitulo?: ReactNode
  acoes?: ReactNode
  children?: ReactNode
  className?: string
  style?: CSSProperties
  as?: 'section' | 'div' | 'article'
  rotulo?: string
}) {
  return (
    <Tag className={juntar('sm-card', className)} style={style} aria-label={rotulo}>
      {(titulo || acoes) && (
        <div className="sm-card-cab">
          <div>
            {titulo && <h2 className="sm-h-card">{titulo}</h2>}
            {subtitulo && <p>{subtitulo}</p>}
          </div>
          {acoes}
        </div>
      )}
      {children}
    </Tag>
  )
}

export function Rotulo({ children, className, as: Tag = 'span' }: { children: ReactNode; className?: string; as?: 'span' | 'div' | 'h2' | 'h3' }) {
  return <Tag className={juntar('sm-mono', className)}>{children}</Tag>
}

export function Chip({ tom, pilar, contador, children, titulo }: { tom?: Tom; pilar?: Pilar; contador?: boolean; children: ReactNode; titulo?: string }) {
  const classe = contador ? 'contador' : pilar ? `p-${pilar}` : tom && tom !== 'neutro' ? tom : ''
  return <span className={juntar('sm-chip', classe)} title={titulo}>{children}</span>
}

export function ChipPilar({ pilar }: { pilar: Pilar }) {
  return <Chip pilar={pilar}>{PILARES[pilar]}</Chip>
}

type Variante = 'pri' | 'sec' | 'fantasma'

type BotaoProps = {
  variante?: Variante
  /** Botão só com ícone: obrigatório para o leitor de tela. */
  rotulo?: string
  icone?: ReactNode
  children?: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>

export function Botao({ variante = 'sec', rotulo, icone, children, className, type = 'button', ...resto }: BotaoProps) {
  const soIcone = !children
  return (
    <button
      type={type}
      className={juntar('sm-btn', variante !== 'sec' && variante, soIcone && 'icone', className)}
      aria-label={soIcone ? rotulo : undefined}
      title={soIcone ? rotulo : undefined}
      {...resto}
    >
      {icone}{children}
    </button>
  )
}

export function BotaoLink({ href, variante = 'sec', icone, children, className, onClick, title, atalho }: { href: string; variante?: Variante; icone?: ReactNode; children: ReactNode; className?: string; onClick?: () => void; title?: string; atalho?: string }) {
  return (
    <Link href={href} className={juntar('sm-btn', variante !== 'sec' && variante, className)} onClick={onClick} title={title} aria-keyshortcuts={atalho}>
      {icone}{children}
    </Link>
  )
}

export function Segmentado<T extends string>({ opcoes, valor, aoMudar, rotulo, className, variante, desabilitado }: {
  opcoes: ReadonlyArray<{ valor: T; rotulo: ReactNode; dica?: string; tom?: 'ok' | 'info' | 'bad' }>
  valor: T
  aoMudar: (v: T) => void
  rotulo: string
  className?: string
  /** "nivel": opção marcada colorida pelo tom (Completo / Leitura / Sem acesso). */
  variante?: 'nivel'
  desabilitado?: boolean
}) {
  return (
    <div className={juntar('sm-seg', variante, className)} role="group" aria-label={rotulo}>
      {opcoes.map(o => (
        <button key={o.valor} type="button" className={o.tom ? `t-${o.tom}` : undefined} disabled={desabilitado} aria-pressed={o.valor === valor} title={o.dica} onClick={() => aoMudar(o.valor)}>
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ ligado, aoMudar, rotulo, mostrarRotulo, desabilitado }: {
  ligado: boolean
  aoMudar: (v: boolean) => void
  rotulo: string
  /** Mostra o texto ao lado; senão ele vai só no aria-label. */
  mostrarRotulo?: boolean
  desabilitado?: boolean
}) {
  const botao = (
    <button
      type="button"
      role="switch"
      className="sm-tog"
      aria-checked={ligado}
      aria-label={mostrarRotulo ? undefined : rotulo}
      disabled={desabilitado}
      onClick={() => aoMudar(!ligado)}
    >
      <span />
    </button>
  )
  if (!mostrarRotulo) return botao
  return <label className="sm-toggle">{botao}<span>{rotulo}</span></label>
}

export function KpiCard({ rotulo, valor, unidade, legenda, chip, rodape }: {
  rotulo: string
  valor: ReactNode
  unidade?: ReactNode
  legenda?: ReactNode
  chip?: { tom: Tom; texto: ReactNode }
  rodape?: ReactNode
}) {
  return (
    <div className="sm-card sm-kpi">
      <Rotulo>{rotulo}</Rotulo>
      <div className="sm-kpi-valor">{valor}{unidade != null && <> <small>{unidade}</small></>}</div>
      {legenda && <span className="sm-legenda">{legenda}</span>}
      {chip && <Chip tom={chip.tom}>{chip.texto}</Chip>}
      {rodape}
    </div>
  )
}

export function BarraProgresso({ valor, max, rotulo, texto, tom, ocultarCabecalho }: {
  valor: number
  max: number
  rotulo: string
  /** Texto à direita; padrão "valor / max". */
  texto?: ReactNode
  tom?: 'ok' | 'warn' | 'bad'
  ocultarCabecalho?: boolean
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (valor / max) * 100)) : 0
  return (
    <div className={juntar('sm-progresso', tom)}>
      {!ocultarCabecalho && (
        <div className="sm-progresso-cab"><span>{rotulo}</span><span className="sm-num">{texto ?? `${valor} / ${max}`}</span></div>
      )}
      <div
        className="sm-progresso-trilho"
        role="progressbar"
        aria-label={rotulo}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={valor}
        aria-valuetext={typeof texto === 'string' ? texto : `${valor} de ${max}`}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

const ICONE_BANNER = { warn: IcAtencao, ok: IcSucesso, info: IcInsight }

export function Banner({ tom, titulo, children, extra, acao, icone }: {
  tom: 'warn' | 'ok' | 'info'
  titulo: ReactNode
  children?: ReactNode
  /** Bloco à direita (ex.: barra de progresso). */
  extra?: ReactNode
  acao?: ReactNode
  icone?: ReactNode
}) {
  const Ic = ICONE_BANNER[tom]
  return (
    <section className={juntar('sm-banner', tom)} role={tom === 'warn' ? 'alert' : 'status'}>
      <div className="sm-banner-icone">{icone ?? <Ic tamanho={22} />}</div>
      <div className="sm-banner-corpo">
        <div className="sm-banner-titulo">{titulo}</div>
        {children && <div>{children}</div>}
      </div>
      {extra && <div className="sm-banner-extra">{extra}</div>}
      {acao}
    </section>
  )
}

export function Kbd({ children, rotulo }: { children: ReactNode; rotulo?: string }) {
  return <kbd className="sm-kbd" aria-label={rotulo}>{children}</kbd>
}

export function EstadoVazio({ titulo, children, acao, icone }: { titulo: ReactNode; children?: ReactNode; acao?: ReactNode; icone?: ReactNode }) {
  return (
    <div className="sm-vazio">
      <div className="sm-vazio-icone">{icone ?? <IcVazio tamanho={22} />}</div>
      <div className="sm-vazio-titulo">{titulo}</div>
      {children && <p>{children}</p>}
      {acao}
    </div>
  )
}

export function Esqueleto({ largura = '100%', altura = 14, raio, className }: { largura?: number | string; altura?: number | string; raio?: number; className?: string }) {
  return <span className={juntar('sm-skel', className)} style={{ width: largura, height: altura, borderRadius: raio }} aria-hidden="true" />
}

/** Cartão inteiro em carregamento, com o texto para o leitor de tela. */
export function CardEsqueleto({ linhas = 3, texto = 'Carregando' }: { linhas?: number; texto?: string }) {
  return (
    <div className="sm-card" aria-busy="true">
      <span className="sm-sr" role="status">{texto}</span>
      <Esqueleto largura="40%" altura={11} />
      <Esqueleto largura="55%" altura={30} />
      {Array.from({ length: Math.max(0, linhas - 2) }, (_, i) => <Esqueleto key={i} largura={`${80 - i * 15}%`} />)}
    </div>
  )
}
