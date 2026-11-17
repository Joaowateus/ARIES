'use client'

// Redesenho do Hoje (referências aprovadas em 17/11): abertura com a estrada ao
// entardecer, um número em destaque (a previsão do mês ou o primeiro número do
// papel), a faixa dos próximos 7 dias, os gráficos num cartão com abas, a frase
// do dia em cartão próprio e a Lente numa gaveta. Os números continuam vindo do
// dicionário (montarKpis); só a organização e o visual mudaram.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { BussolaHoje, PainelHoje, Lente as LenteDados } from '@/lib/proLaboreApi'
import { Lente } from '../_padrao/Padrao'
import { Paisagem, PaisagemRetrato } from './Paisagem'
import { EquipeGrafico, FunilDoMes, OrigemGrafico, RitmoDoMes, Variacao, corFaixa } from './Graficos'
import type { montarKpis } from './PainelHoje'

type Kpi = ReturnType<typeof montarKpis>[number]

function saudacao(agora = new Date()) {
  const h = Number(agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }))
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}
function primeiroNome(): string | null {
  try { const u = JSON.parse(localStorage.getItem('pro_labore_usuario') ?? 'null') as { nome?: string } | null; return (u?.nome ?? '').trim().split(/\s+/)[0] || null } catch { return null }
}
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

export function HeroHoje({ kpis, resumo, acao, nLente, aoAbrirLente, frase }: {
  kpis: Kpi[]; resumo: string | null; acao: React.ReactNode; nLente: number; aoAbrirLente: () => void; frase?: React.ReactNode
}) {
  const [nome, setNome] = useState<string | null>(null)
  useEffect(() => { setNome(primeiroNome()) }, [])
  const [destaque, ...outros] = kpis
  const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <section className="hx-hero" aria-label="Abertura do dia" data-hero>
      <Paisagem className="hx-hero-arte" />
      <div className="hx-hero-texto">
        <p className="hx-data">{capital(hoje)}</p>
        <h1 className="hx-titulo">{saudacao()}{nome ? `, ${capital(nome)}` : ''}.</h1>
        {resumo && <p className="hx-resumo" data-como-estamos-hero>{resumo}</p>}
        {frase}
        <div className="hx-hero-acoes">
          {acao}
          <button type="button" className="hx-btn-vidro" onClick={aoAbrirLente} data-abrir-lente aria-haspopup="dialog">
            Lente do ARIES{nLente > 0 && <span className="hx-contador">{nLente}</span>}
          </button>
        </div>
      </div>
      {destaque && (
        <div className="hx-hero-numero" data-numero-hero={destaque.chave}>
          <span className="hx-numero-nome">{destaque.nome}</span>
          <b className="hx-numero-valor" data-kpi={destaque.chave} data-numero={destaque.chave}>{destaque.valor}</b>
          {destaque.meta?.pct != null
            ? <span className="hx-numero-sub">{destaque.meta.pct}% da meta{destaque.meta.esperado != null ? ` · o ideal hoje é ${Math.round(destaque.meta.esperado)}%` : ''}</span>
            : destaque.sub && <span className="hx-numero-sub">{destaque.sub}</span>}
          {destaque.meta?.pct != null && (
            <span className="hx-meta-barra" aria-hidden><span style={{ width: `${Math.min(100, Math.max(0, destaque.meta.pct))}%`, background: corFaixa(destaque.faixa) }} />{destaque.meta.esperado != null && <i style={{ left: `${Math.min(100, destaque.meta.esperado)}%` }} />}</span>
          )}
          {outros.length > 0 && (
            <dl className="hx-numeros-menores" data-agora data-kpis>
              {outros.map(k => (
                <div key={k.chave} data-kpi={k.chave} data-numero={k.chave} title={k.sub ?? undefined}>
                  <dt>{k.nome}</dt>
                  <dd>{k.valor} <Variacao v={k.variacao} melhor={k.melhor} /></dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </section>
  )
}

const DIA_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
function IconeDia({ tipo }: { tipo: 'visita' | 'follow' | 'livre' }) {
  if (tipo === 'visita') return <svg viewBox="0 0 24 24" aria-hidden><path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
  if (tipo === 'follow') return <svg viewBox="0 0 24 24" aria-hidden><path d="M4 6.5h16v10H9l-5 4v-14Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
  return <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
}

/** Próximos 7 dias: o que vence em cada dia (visitas, follows, ligações e outras atividades). */
export function SemanaHoje({ semana }: { semana: NonNullable<PainelHoje['semana']> }) {
  return (
    <section className="hx-semana" aria-label="Próximos 7 dias" data-semana>
      {semana.map((d, i) => {
        const total = d.visitas + d.follows + d.ligacoes + d.outras
        const data = new Date(`${d.dia}T12:00:00Z`)
        const tipo = d.visitas ? 'visita' : total ? 'follow' : 'livre'
        const partes = [d.visitas && `${d.visitas} ${d.visitas === 1 ? 'visita' : 'visitas'}`, d.follows && `${d.follows} ${d.follows === 1 ? 'follow' : 'follows'}`, d.ligacoes && `${d.ligacoes} ${d.ligacoes === 1 ? 'ligação' : 'ligações'}`, d.outras && `${d.outras} ${d.outras === 1 ? 'outra' : 'outras'}`].filter(Boolean)
        return (
          <Link key={d.dia} href="/pro-labore/atividades" className={`hx-dia${i === 0 ? ' hx-dia-hoje' : ''}`} data-dia={d.dia} aria-label={`${i === 0 ? 'Hoje' : DIA_SEMANA[data.getUTCDay()]}: ${partes.join(', ') || 'nada marcado'}`}>
            <span className="hx-dia-topo"><IconeDia tipo={tipo} /><span><b>{i === 0 ? 'Hoje' : DIA_SEMANA[data.getUTCDay()]}</b><small>{data.getUTCDate()}/{data.getUTCMonth() + 1}</small></span></span>
            <span className="hx-dia-total">{total}<small>{total === 1 ? 'tarefa' : 'tarefas'}</small></span>
            <span className="hx-dia-det">{partes.length ? partes.join(' · ') : 'Nada marcado'}</span>
            {i === 0 && d.atrasadas > 0 && <span className="hx-dia-atraso">{d.atrasadas} {d.atrasadas === 1 ? 'atividade atrasada' : 'atividades atrasadas'}</span>}
          </Link>
        )
      })}
    </section>
  )
}

type AbaGrafico = 'ritmo' | 'funil' | 'equipe' | 'origem'
/** Um cartão, várias leituras: ritmo do mês, funil, equipe e origem (cada uma com o seu link). */
export function CartaoGraficos({ p, papel }: { p: PainelHoje; papel: string }) {
  const [aba, setAba] = useState<AbaGrafico>('ritmo')
  const emPct = papel !== 'DONO' && papel !== 'SUPERVISOR' && papel !== 'FINANCEIRO'
  const abas: Array<{ v: AbaGrafico; r: string; href: string }> = [
    { v: 'ritmo', r: 'Ritmo do mês', href: '/pro-labore/hoje?sub=painel' },
    { v: 'funil', r: papel === 'VENDEDOR' || papel === 'SDR' ? 'Meu funil' : 'Funil', href: '/pro-labore/leads' },
    ...(p.equipe ? [{ v: 'equipe' as const, r: 'Equipe', href: '/pro-labore/vendedores' }] : []),
    ...(p.origem ? [{ v: 'origem' as const, r: 'Origem', href: '/pro-labore/aba/origem-vendas' }] : []),
  ]
  const atual = abas.find(a => a.v === aba) ?? abas[0]
  const r = p.ritmo
  return (
    <section className="hx-cartao hx-graficos" aria-label="Gráficos da operação" data-cartao-ritmo data-graficos-operacao>
      <div className="hx-cartao-topo">
        <h2 className="hx-cartao-titulo">{atual.r}</h2>
        <div className="hx-abas" role="tablist" aria-label="Escolher o gráfico">
          {abas.map(a => <button key={a.v} type="button" role="tab" aria-selected={a.v === atual.v} className={a.v === atual.v ? 'ativo' : ''} onClick={() => setAba(a.v)} data-aba-grafico={a.v}>{a.r.replace('Ritmo do mês', 'Ritmo')}</button>)}
        </div>
      </div>
      {atual.v === 'ritmo' && <>
        {r.pct != null && <p className="hx-ritmo-texto" style={{ color: corFaixa(r.faixa) }}>{r.pct}% da meta · {r.texto}</p>}
        <RitmoDoMes dias={r.dias} totalDias={r.totalDias} meta={r.meta} previsao={r.previsao} emPct={emPct} />
      </>}
      {atual.v === 'funil' && <div data-grafico="funil"><FunilDoMes etapas={p.funil.etapas} gargalo={p.funil.gargalo} /></div>}
      {atual.v === 'equipe' && p.equipe && <div data-grafico="equipe"><EquipeGrafico pessoas={p.equipe} /></div>}
      {atual.v === 'origem' && p.origem && <div data-grafico="origem"><OrigemGrafico partes={p.origem} emPct={papel !== 'DONO'} /></div>}
      <Link className="hx-link" href={atual.href}>Abrir {atual.r.toLowerCase()}</Link>
    </section>
  )
}

/** Frase do dia (biblioteca aprovada, com autor e fonte) sobre a estrada. */
export function CartaoFrase({ frase }: { frase: BussolaHoje['frase'] }) {
  if (!frase) return null
  return (
    <figure className="hx-cartao hx-frase" data-frase-do-dia={frase.id}>
      <PaisagemRetrato className="hx-frase-arte" />
      <div className="hx-frase-texto">
        <span className="hx-frase-rotulo">Frase do dia</span>
        <blockquote>“{frase.texto}”</blockquote>
        <figcaption>{frase.autor}<span data-frase-fonte>{frase.fonte}</span></figcaption>
      </div>
    </figure>
  )
}

/** A Lente numa gaveta lateral: abre pelo botão do topo e fecha com Esc ou clicando fora. */
export function GavetaLente({ aberta, aoFechar, dados, aoMudar }: { aberta: boolean; aoFechar: () => void; dados: LenteDados; aoMudar: () => void }) {
  useEffect(() => {
    if (!aberta) return
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') aoFechar() }
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f)
  }, [aberta, aoFechar])
  return (
    <div className={`hx-gaveta${aberta ? ' aberta' : ''}`} role="dialog" aria-modal="true" aria-label="Lente do ARIES" aria-hidden={!aberta} onClick={e => { if (e.target === e.currentTarget) aoFechar() }} data-gaveta-lente>
      <div className="hx-gaveta-painel">
        <button type="button" className="hx-gaveta-fechar" onClick={aoFechar} aria-label="Fechar a Lente">✕</button>
        <Lente aba="hoje" dados={dados} aoMudar={aoMudar} />
      </div>
    </div>
  )
}
