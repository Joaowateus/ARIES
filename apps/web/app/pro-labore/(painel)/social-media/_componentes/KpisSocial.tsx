'use client'

import type { AnaliseSocialMedia } from '@/lib/proLaboreApi'
import { fmtCompacto, fmtNum, fmtPct, useLargura, variacao } from './viz'

type Analise = Extract<AnaliseSocialMedia, { conectado: true }>

function Seta({ sobe }: { sobe: boolean }) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true">
      <path d={sobe ? 'M5 1 L9 8 L1 8 Z' : 'M5 9 L9 2 L1 2 Z'} fill="currentColor" />
    </svg>
  )
}

// Variação vs período anterior — cor pelo sentido (em todas estas métricas
// subir é bom), sempre acompanhada de seta + sinal, nunca só da cor.
function Delta({ valor, formato = 'pct' }: { valor: number | null; formato?: 'pct' | 'pp' | 'abs' }) {
  if (valor == null) return <span className="pl-kpi-vs">sem período anterior pra comparar</span>
  if (Math.abs(valor) < 0.0005) return <span className="pl-delta neutral">= estável</span>
  const sobe = valor > 0
  const texto = formato === 'pct'
    ? fmtPct(Math.abs(valor), Math.abs(valor) < 0.1 ? 1 : 0)
    : formato === 'pp'
      ? `${(Math.abs(valor) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p.`
      : fmtNum(Math.abs(valor))
  return (
    <>
      <span className={`pl-delta ${sobe ? 'up' : 'down'}`}><Seta sobe={sobe} />{sobe ? '+' : '−'}{texto}</span>
      <span className="pl-kpi-vs">vs. período anterior</span>
    </>
  )
}

// Minigráfico de tendência: traço na cor de "segundo plano", só o último
// ponto no azul de destaque — o número grande do cartão é o protagonista.
function Sparkline({ valores }: { valores: number[] }) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const altura = 34
  const pontos = valores.length
  return (
    <div ref={ref}>
      {largura > 0 && pontos >= 2 && (() => {
        const max = Math.max(...valores)
        const min = Math.min(...valores)
        const amplitude = max - min || 1
        const x = (i: number) => 3 + (i / (pontos - 1)) * (largura - 6)
        const y = (v: number) => 4 + (1 - (v - min) / amplitude) * (altura - 8)
        const d = valores.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
        return (
          <svg className="pl-sv-spark" width={largura} height={altura} aria-hidden="true">
            <path d={d} fill="none" stroke="var(--pl-ink-muted)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.7} />
            <circle cx={x(pontos - 1)} cy={y(valores[pontos - 1])} r={3.5} fill="var(--sv-1)" stroke="var(--pl-surface)" strokeWidth={2} />
          </svg>
        )
      })()}
    </div>
  )
}

function Kpi({ rotulo, valor, unidade, delta, nota, serie, extra }: {
  rotulo: string
  valor: string
  unidade?: string
  delta?: React.ReactNode
  nota?: React.ReactNode
  serie?: number[]
  extra?: React.ReactNode
}) {
  return (
    <div className="pl-kpi pl-sv-kpi">
      <div className="pl-kpi-label">{rotulo}</div>
      <div className="pl-kpi-value">{valor}{unidade && <span className="pl-unit">{unidade}</span>}</div>
      {delta && <div className="pl-kpi-foot">{delta}</div>}
      {nota && <div className="pl-sv-kpi-nota">{nota}</div>}
      {extra}
      {serie && serie.length >= 2 && <Sparkline valores={serie} />}
    </div>
  )
}

export function KpisSocial({ analise }: { analise: Analise }) {
  const { kpis, serie } = analise
  const comDados = serie.filter(p => p.temDados)
  const serieDe = (f: (p: (typeof serie)[number]) => number) => comDados.map(f)
  const seguidoresSerie = serie.filter(p => p.seguidores != null).map(p => p.seguidores as number)
  const seg = kpis.seguidores
  const pub = kpis.publicacoes
  const dcp = kpis.diasComPost
  const semDadosConta = comDados.length === 0
  const er = kpis.taxaEngajamento

  return (
    <div className="pl-sv-kpis">
      <Kpi
        rotulo="Seguidores"
        valor={fmtNum(seg.atual)}
        delta={seg.variacao != null ? (
          <>
            <span className={`pl-delta ${seg.variacao >= 0 ? 'up' : 'down'}`}><Seta sobe={seg.variacao >= 0} />{seg.variacao >= 0 ? '+' : '−'}{fmtNum(Math.abs(seg.variacao))}</span>
            <span className="pl-kpi-vs">no período{seg.taxaCrescimento != null ? ` (${seg.taxaCrescimento >= 0 ? '+' : ''}${fmtPct(seg.taxaCrescimento)})` : ''}</span>
          </>
        ) : <span className="pl-kpi-vs">variação disponível após a próxima sincronização</span>}
        nota={seg.ganhos > 0 || seg.perdidos > 0 ? `${fmtNum(seg.ganhos)} novos · ${fmtNum(seg.perdidos)} deixaram de seguir` : undefined}
        serie={seguidoresSerie}
      />
      <Kpi
        rotulo="Alcance médio / dia"
        valor={kpis.alcanceMedioDia.atual != null ? fmtCompacto(kpis.alcanceMedioDia.atual) : '—'}
        unidade={kpis.alcanceMedioDia.atual != null ? ' contas' : undefined}
        delta={semDadosConta ? undefined : <Delta valor={variacao(kpis.alcanceMedioDia.atual, kpis.alcanceMedioDia.anterior)} />}
        nota={semDadosConta ? 'Sem métricas diárias da conta nesse período' : 'Contas únicas por dia (média)'}
        serie={serieDe(p => p.alcance)}
      />
      <Kpi
        rotulo="Visualizações"
        valor={fmtCompacto(kpis.visualizacoes.atual)}
        delta={semDadosConta ? undefined : <Delta valor={variacao(kpis.visualizacoes.atual, kpis.visualizacoes.anterior)} />}
        nota="Posts, reels e stories — inclui repetições"
        serie={serieDe(p => p.visualizacoes)}
      />
      <Kpi
        rotulo="Interações"
        valor={fmtCompacto(kpis.interacoes.atual)}
        delta={semDadosConta ? undefined : <Delta valor={variacao(kpis.interacoes.atual, kpis.interacoes.anterior)} />}
        nota="Curtidas, comentários, compart., salvos e respostas"
        serie={serieDe(p => p.interacoes)}
      />
      <Kpi
        rotulo="Taxa de engajamento"
        valor={fmtPct(er.atual)}
        delta={er.atual != null ? <Delta valor={er.anterior != null ? er.atual - er.anterior : null} formato="pp" /> : undefined}
        nota={er.atual != null ? 'Interações ÷ alcance dos posts do período' : 'Nenhum post com métricas no período'}
      />
      <Kpi
        rotulo="Visitas ao perfil"
        valor={fmtCompacto(kpis.visitasPerfil.atual)}
        delta={kpis.visitasPerfil.atual != null ? <Delta valor={variacao(kpis.visitasPerfil.atual, kpis.visitasPerfil.anterior)} /> : undefined}
        nota={kpis.visitasPerfil.fonte === 'posts'
          ? (kpis.visitasPerfil.atual != null ? 'Vindas dos posts do período (a métrica da conta não está disponível na API)' : 'Nenhum post com métricas no período')
          : 'Visitas totais ao perfil'}
        serie={kpis.visitasPerfil.fonte === 'conta' ? serieDe(p => p.visitasPerfil) : undefined}
      />
      <Kpi
        rotulo="Toques em links"
        valor={kpis.toquesLinks.atual != null ? fmtCompacto(kpis.toquesLinks.atual) : '—'}
        delta={kpis.toquesLinks.atual != null ? <Delta valor={variacao(kpis.toquesLinks.atual, kpis.toquesLinks.anterior)} /> : undefined}
        nota={kpis.toquesLinks.atual != null ? 'Link da bio, botões de contato e site' : 'Métrica não disponível pela API pra essa conta'}
        serie={kpis.toquesLinks.atual != null ? serieDe(p => p.toquesLinks) : undefined}
      />
      <Kpi
        rotulo="Dias com post"
        valor={fmtNum(dcp.atual)}
        unidade={` / ${dcp.meta}`}
        delta={<Delta valor={variacao(dcp.atual, dcp.anterior)} />}
        nota={`Meta de ${dcp.metaSemanal} dias por semana · maior intervalo ${dcp.maiorIntervalo} ${dcp.maiorIntervalo === 1 ? 'dia' : 'dias'} · ${fmtNum(pub.atual)} posts no feed${kpis.stories.atual > 0 ? ` e ${fmtNum(kpis.stories.atual)} stories` : ''}`}
        extra={(
          <div className="pl-sv-meter" role="meter" aria-valuemin={0} aria-valuemax={dcp.meta} aria-valuenow={dcp.atual} aria-label="Dias com post em relação à meta">
            <span style={{ width: `${Math.min(100, (dcp.atual / Math.max(1, dcp.meta)) * 100)}%`, background: dcp.atual >= dcp.meta && dcp.maiorIntervalo <= 2 ? 'var(--pl-good)' : 'var(--sv-1)' }} />
          </div>
        )}
      />
    </div>
  )
}
