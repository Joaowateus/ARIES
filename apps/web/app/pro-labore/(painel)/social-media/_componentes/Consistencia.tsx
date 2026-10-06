'use client'

// Qualidade dos dados, consistência de publicação e o funil do Instagram
// até a venda (seções 8 e 17 da especificação do Social Media):
// - o banner diz, sem enfeite, quantos dias do período têm dados;
// - a consistência mede DIAS com post e o maior intervalo, não contagem
//   de posts (assim "meta cumprida" nunca aparece ao lado de "18 dias sem
//   publicar");
// - o funil começa no alcance ÚNICO do período, não na soma diária.
import type { AnaliseSocialMedia } from '@/lib/proLaboreApi'
import { CartaoViz, fmtDiaMes, fmtNum, fmtPct } from './viz'

type Analise = Extract<AnaliseSocialMedia, { conectado: true }>

export function BannerQualidade({ qualidade }: { qualidade: Analise['qualidade'] }) {
  const { status, diasPeriodo, diasSincronizados, diasSemDados, storiesCapturados } = qualidade
  const stories = `${fmtNum(storiesCapturados)} ${storiesCapturados === 1 ? 'story capturado' : 'stories capturados'}`
  if (status === 'completo') {
    return (
      <div className="pl-sv-qualidade ok" role="status">
        <span className="ponto" aria-hidden="true" />
        <b>Dados completos</b>
        <span>{diasSincronizados} de {diasPeriodo} dias sincronizados · {stories} · sem lacunas que afetem as comparações</span>
      </div>
    )
  }
  const lista = diasSemDados.length <= 8
    ? diasSemDados.map(fmtDiaMes).join(', ')
    : `${diasSemDados.slice(0, 6).map(fmtDiaMes).join(', ')} e mais ${diasSemDados.length - 6}`
  return (
    <div className={`pl-sv-qualidade ${status === 'grave' ? 'grave' : 'lacunas'}`} role="status">
      <span className="ponto" aria-hidden="true" />
      <b>{status === 'grave' ? 'Dados com lacunas graves' : 'Dados com lacunas'}</b>
      <span>
        {diasSincronizados} de {diasPeriodo} dias sincronizados · {stories}. Sem dados em {lista}.{' '}
        {status === 'grave'
          ? 'Com mais de 20% dos dias faltando, as comparações com o período anterior ficam escondidas.'
          : 'As comparações com o período anterior podem estar afetadas.'}
      </span>
    </div>
  )
}

const classeDia = (n: number, max: number) => (n === 0 ? 'c0' : n <= max ? 'c1' : n <= 4 ? 'c2' : 'c3')

export function Consistencia({ consistencia, recarregando }: { consistencia: Analise['consistencia']; recarregando?: boolean }) {
  const c = consistencia
  // Grade de segunda a domingo: completa a primeira semana com dias vazios.
  const primeiro = c.dias[0] ? new Date(`${c.dias[0].data}T12:00:00Z`).getUTCDay() : 1
  const vazios = (primeiro + 6) % 7
  const abaixo = c.diasComPost < c.metaDiasPeriodo || c.maiorIntervalo > c.maxDiasSemPost
  return (
    <CartaoViz
      titulo="Consistência"
      subtitulo={`Dias com post no feed contra a meta de ${c.metaDiasSemana} por semana`}
      recarregando={recarregando}
      acoes={<span className={`pl-sv-chip ${abaixo ? 'ruim' : 'bom'}`}>{abaixo ? 'Abaixo da meta' : 'Dentro da meta'}</span>}
      tabela={{
        colunas: ['Dia', 'Posts no feed'],
        linhas: c.dias.filter(d => !d.futuro).map(d => [fmtDiaMes(d.data), d.posts]),
      }}
    >
      <div className="pl-sv-cons-grade" role="img" aria-label={`${c.diasComPost} de ${c.diasNoPeriodo} dias com post. Maior intervalo: ${c.maiorIntervalo} dias.`}>
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => <span key={d} className="pl-sv-cons-dia">{d}</span>)}
        {Array.from({ length: vazios }, (_, i) => <span key={`v${i}`} />)}
        {c.dias.map(d => (
          <span
            key={d.data}
            className={`pl-sv-cons-cel ${d.futuro ? 'futuro' : classeDia(d.posts, c.maxPostsPorDia)}`}
            title={d.futuro ? `${fmtDiaMes(d.data)}: ainda não chegou` : `${fmtDiaMes(d.data)}: ${d.posts} ${d.posts === 1 ? 'post' : 'posts'}`}
          >
            {Number(d.data.slice(8, 10))}{d.posts > 0 && <small> · {d.posts}</small>}
          </span>
        ))}
      </div>
      <div className="pl-sv-cons-legenda" aria-hidden="true">
        <span><i className="c0" />sem post</span>
        <span><i className="c1" />1 a {c.maxPostsPorDia}</span>
        <span><i className="c2" />{c.maxPostsPorDia + 1} a 4</span>
        <span><i className="c3" />mais de 4 (rajada)</span>
      </div>
      <div className="pl-sv-cons-numeros">
        <div><b>{c.diasComPost} <small>/ {c.diasNoPeriodo}</small></b><span>dias com post (meta {c.metaDiasPeriodo})</span></div>
        <div><b className={c.maiorIntervalo > c.maxDiasSemPost ? 'ruim' : ''}>{c.maiorIntervalo} {c.maiorIntervalo === 1 ? 'dia' : 'dias'}</b><span>maior intervalo (máx. {c.maxDiasSemPost})</span></div>
        <div><b className={c.pico && c.pico.posts > c.maxPostsPorDia ? 'ruim' : ''}>{c.pico ? c.pico.posts : 0}</b><span>{c.pico ? `posts em ${fmtDiaMes(c.pico.data)}` : 'pico de posts num dia'}</span></div>
      </div>
    </CartaoViz>
  )
}

export function FunilInstagram({ funil, recarregando }: { funil: Analise['funil']; recarregando?: boolean }) {
  const etapas: Array<{ rotulo: string; valor: number | null; motivo?: string | null }> = [
    { rotulo: 'Alcance único', valor: funil.alcanceUnico, motivo: funil.alcanceUnicoMotivo },
    { rotulo: 'Visitas ao perfil', valor: funil.visitasPerfil },
    { rotulo: 'Conversas iniciadas', valor: funil.conversasIniciadas, motivo: funil.conversasMotivo },
    { rotulo: 'Leads no CRM', valor: funil.leads },
    { rotulo: 'Vendas', valor: funil.vendas },
  ]
  // Taxa de cada etapa sobre a anterior que tem número.
  const comTaxa = etapas.map((e, i) => {
    const anterior = etapas.slice(0, i).reverse().find(x => x.valor != null)
    return { ...e, taxa: e.valor != null && anterior?.valor ? e.valor / anterior.valor : null, sobre: anterior?.rotulo ?? null }
  })
  // Escala logarítmica: em escala linear, as etapas de baixo (leads e
  // vendas) ficariam invisíveis ao lado do alcance.
  const max = Math.max(1, ...etapas.map(e => e.valor ?? 0))
  const largura = (v: number) => Math.max(2, (Math.log10(v + 1) / Math.log10(max + 1)) * 100)
  return (
    <CartaoViz
      titulo="Funil do Instagram até a venda"
      subtitulo="Cada taxa é sobre a etapa anterior que tem número"
      recarregando={recarregando}
      tabela={{
        colunas: ['Etapa', 'Valor', 'Taxa sobre a anterior'],
        linhas: comTaxa.map(e => [e.rotulo, e.valor != null ? fmtNum(e.valor) : '—', e.taxa != null ? fmtPct(e.taxa) : '—']),
      }}
      rodape="Alcance único do período, não a soma diária. Conversas = direct + WhatsApp vindos de links rastreados. Leads e vendas: leads com canal Orgânico no CRM criados no período; a venda conta mesmo se fechou depois. Barras em escala logarítmica."
    >
      <ol className="pl-sv-funil">
        {comTaxa.map(e => (
          <li key={e.rotulo}>
            <div className="pl-sv-funil-linha">
              <span>{e.rotulo}</span>
              <span className="pl-sv-funil-num">
                <b>{e.valor != null ? fmtNum(e.valor) : '—'}</b>
                {e.taxa != null && <small title={`sobre ${e.sobre?.toLowerCase()}`}>{fmtPct(e.taxa)}</small>}
              </span>
            </div>
            <div className="pl-sv-funil-trilho" aria-hidden="true">
              {e.valor != null && <span style={{ width: `${largura(e.valor)}%` }} />}
            </div>
            {e.valor == null && e.motivo && <div className="pl-sv-funil-motivo">{e.motivo}</div>}
          </li>
        ))}
      </ol>
    </CartaoViz>
  )
}
