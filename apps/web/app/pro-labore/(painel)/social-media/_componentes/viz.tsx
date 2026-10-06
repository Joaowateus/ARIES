'use client'

// Peças compartilhadas pelos gráficos da aba Social Media: formatação,
// escalas, cores por formato, medição de largura, tooltip e o cartão que
// alterna entre gráfico e tabela (todo gráfico tem uma tabela equivalente —
// o valor exato nunca depende de passar o mouse).
import { ReactNode, useEffect, useState } from 'react'
import type { FaixaImpactoSocial, FormatoPostSocial } from '@/lib/proLaboreApi'

export const COR_FORMATO: Record<FormatoPostSocial | 'STORY', string> = {
  REELS: 'var(--sv-1)',
  CARROSSEL: 'var(--sv-2)',
  FOTO: 'var(--sv-3)',
  STORY: 'var(--sv-4)',
}
export const ROTULO_FORMATO: Record<FormatoPostSocial | 'STORY', string> = {
  REELS: 'Reels',
  CARROSSEL: 'Carrossel',
  FOTO: 'Foto',
  STORY: 'Stories',
}
export const ORDEM_FORMATOS: FormatoPostSocial[] = ['REELS', 'CARROSSEL', 'FOTO']

export const ROTULO_FAIXA: Record<FaixaImpactoSocial, string> = {
  BAIXO: 'Baixo',
  MEDIO: 'Médio',
  ALTO: 'Alto',
  EXCEPCIONAL: 'Excepcional',
}

export const DIA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const DIA_LONGO = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
// Semana de segunda a domingo, como o calendário brasileiro de trabalho.
export const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0]

export function fmtNum(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—'
  return Math.round(v).toLocaleString('pt-BR')
}

// 1.284 / 12,9 mil / 1,2 mi — pra eixos e rótulos curtos.
export function fmtCompacto(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—'
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (abs >= 10_000) return `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return Math.round(v).toLocaleString('pt-BR')
}

// Nunca mostra "0,0%" pra um valor que não é zero: aumenta as casas até o
// número aparecer (ex.: 0,05%), e abaixo de 0,01% mostra "< 0,01%".
export function fmtPct(v: number | null | undefined, casas = 1): string {
  if (v == null || Number.isNaN(v)) return '—'
  const x = v * 100
  if (x === 0) return '0%'
  let c = casas
  while (x !== 0 && c < 2 && Math.abs(x) < 0.5 * 10 ** -c) c++
  if (x !== 0 && Math.abs(x) < 0.005) return '< 0,01%'
  return `${x.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c })}%`
}

export function fmtSeg(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v) || v <= 0) return '—'
  if (v < 60) return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}s`
  return `${Math.floor(v / 60)}min ${Math.round(v % 60)}s`
}

export function dataDeChave(dia: string): Date {
  const [a, m, d] = dia.split('-').map(Number)
  return new Date(a, m - 1, d)
}

export function chaveDeData(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function fmtDiaMes(dia: string): string {
  const d = dataDeChave(dia)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function fmtDataCompleta(dia: string): string {
  return dataDeChave(dia).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
}

export function fmtDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function variacao(atual: number | null, anterior: number | null): number | null {
  if (atual == null || anterior == null || anterior === 0) return null
  return (atual - anterior) / anterior
}

// Ticks "redondos" (0 / 2.000 / 4.000...) pro eixo Y.
export function ticksBonitos(max: number, quantidade = 4): number[] {
  if (max <= 0) return [0]
  const bruto = max / quantidade
  const magnitude = 10 ** Math.floor(Math.log10(bruto))
  const passo = [1, 2, 2.5, 5, 10].map(f => f * magnitude).find(p => p >= bruto) ?? bruto
  const topo = Math.ceil(max / passo) * passo
  const ticks: number[] = []
  for (let v = 0; v <= topo + passo / 2; v += passo) ticks.push(v)
  return ticks
}

// Largura do contêiner do gráfico. Ref por callback: o gráfico pode
// aparecer só depois (dados que chegam depois, cartão que alterna entre
// tabela e gráfico) e mesmo assim passa a ser medido.
export function useLargura<T extends HTMLElement>(): [(el: T | null) => void, number] {
  const [el, setEl] = useState<T | null>(null)
  const [largura, setLargura] = useState(0)
  useEffect(() => {
    if (!el) return
    // O ResizeObserver já avisa a medida inicial assim que começa a observar.
    const obs = new ResizeObserver(entradas => setLargura(Math.floor(entradas[0].contentRect.width)))
    obs.observe(el)
    return () => obs.disconnect()
  }, [el])
  return [setEl, largura]
}

export interface EstadoTooltip { x: number; y: number; conteudo: ReactNode }

// Tooltip posicionado dentro do wrapper relativo do gráfico — vira pro lado
// esquerdo do ponteiro quando chegaria perto da borda direita.
export function Tooltip({ estado, largura }: { estado: EstadoTooltip | null; largura: number }) {
  if (!estado) return null
  const largTip = 230
  const esquerda = estado.x + 14 + largTip > largura ? Math.max(0, estado.x - largTip - 14) : estado.x + 14
  return (
    <div className="pl-sv-tip" style={{ left: esquerda, top: Math.max(0, estado.y - 10) }} role="status">
      {estado.conteudo}
    </div>
  )
}

export function LinhaTip({ cor, valor, rotulo, tracejado }: { cor?: string; valor: ReactNode; rotulo: ReactNode; tracejado?: boolean }) {
  return (
    <div className="pl-sv-tip-linha">
      {cor && <span className="pl-sv-tip-key" style={{ borderTopColor: cor, borderTopStyle: tracejado ? 'dashed' : 'solid' }} />}
      <b>{valor}</b>
      <span>{rotulo}</span>
    </div>
  )
}

export interface DadosTabela { colunas: string[]; linhas: Array<Array<string | number>>; alinharDireita?: number[] }

function IconeTabela() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16" />
    </svg>
  )
}
function IconeGrafico() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  )
}

export function TabelaSimples({ dados }: { dados: DadosTabela }) {
  const direita = new Set(dados.alinharDireita ?? dados.colunas.map((_, i) => i).slice(1))
  return (
    <div className="pl-sv-tabela">
      <table className="pl-table">
        <thead>
          <tr>{dados.colunas.map((c, i) => <th key={c} className={direita.has(i) ? 'pl-right' : ''}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {dados.linhas.map((linha, i) => (
            <tr key={i}>{linha.map((v, j) => <td key={j} className={direita.has(j) ? 'pl-right' : ''}>{v}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CartaoViz({ id, titulo, subtitulo, acoes, tabela, recarregando, children, rodape, className }: {
  id?: string
  titulo: string
  subtitulo?: ReactNode
  acoes?: ReactNode
  tabela?: DadosTabela
  recarregando?: boolean
  children: ReactNode
  rodape?: ReactNode
  className?: string
}) {
  const [verTabela, setVerTabela] = useState(false)
  return (
    <section id={id} className={`pl-card pl-sv-card ${recarregando ? 'recarregando' : ''} ${className ?? ''}`}>
      <div className="pl-card-head">
        <div>
          <div className="pl-card-title">{titulo}</div>
          {subtitulo && <div className="pl-card-sub">{subtitulo}</div>}
        </div>
        <div className="pl-sv-card-acoes">
          {!verTabela && acoes}
          {tabela && (
            <button type="button" className="pl-sv-btn-tabela" onClick={() => setVerTabela(v => !v)} aria-pressed={verTabela}>
              {verTabela ? <><IconeGrafico /> Gráfico</> : <><IconeTabela /> Tabela</>}
            </button>
          )}
        </div>
      </div>
      <div className="pl-sv-card-body">
        {verTabela && tabela ? <TabelaSimples dados={tabela} /> : children}
      </div>
      {rodape && <div className="pl-sv-rodape">{rodape}</div>}
    </section>
  )
}

export function Abas<T extends string>({ opcoes, valor, onChange, rotulo }: {
  opcoes: Array<{ valor: T; rotulo: string }>
  valor: T
  onChange: (v: T) => void
  rotulo: string
}) {
  return (
    <div className="pl-sv-tabs" role="tablist" aria-label={rotulo}>
      {opcoes.map(o => (
        <button key={o.valor} type="button" role="tab" aria-selected={valor === o.valor} className={valor === o.valor ? 'ativo' : ''} onClick={() => onChange(o.valor)}>
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="pl-sv-vazio">{children}</div>
}

// Arco de anel (setor com furo) entre dois ângulos, em radianos, com 0 no
// eixo X positivo e crescendo no sentido anti-horário (y do SVG invertido).
export function caminhoSetor(cx: number, cy: number, rInterno: number, rExterno: number, a0: number, a1: number): string {
  const p = (r: number, a: number) => `${cx + r * Math.cos(a)} ${cy - r * Math.sin(a)}`
  const grande = Math.abs(a1 - a0) > Math.PI ? 1 : 0
  return [
    `M ${p(rExterno, a0)}`,
    `A ${rExterno} ${rExterno} 0 ${grande} 0 ${p(rExterno, a1)}`,
    `L ${p(rInterno, a1)}`,
    `A ${rInterno} ${rInterno} 0 ${grande} 1 ${p(rInterno, a0)}`,
    'Z',
  ].join(' ')
}

export function caminhoArco(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p = (a: number) => `${cx + r * Math.cos(a)} ${cy - r * Math.sin(a)}`
  const grande = Math.abs(a1 - a0) > Math.PI ? 1 : 0
  const sentido = a1 > a0 ? 0 : 1
  return `M ${p(a0)} A ${r} ${r} 0 ${grande} ${sentido} ${p(a1)}`
}
