'use client'

import type { AgregadoPostsSocial, AnaliseSocialMedia, FormatoPostSocial } from '@/lib/proLaboreApi'
import { COR_FORMATO, CartaoViz, ORDEM_FORMATOS, ROTULO_FORMATO, Vazio, fmtNum, fmtPct } from './viz'

type Analise = Extract<AnaliseSocialMedia, { conectado: true }>
type LinhaFormato = { formato: FormatoPostSocial } & AgregadoPostsSocial

const METRICAS: Array<{ chave: keyof AgregadoPostsSocial; rotulo: string; fmt: (v: number) => string }> = [
  { chave: 'alcanceMedio', rotulo: 'Alcance médio', fmt: fmtNum },
  { chave: 'visualizacoesMedias', rotulo: 'Visualizações médias', fmt: fmtNum },
  { chave: 'taxaEngajamento', rotulo: 'Taxa de engajamento', fmt: v => fmtPct(v) },
  { chave: 'salvamentosMedios', rotulo: 'Salvamentos por post', fmt: v => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) },
  { chave: 'compartilhamentosMedios', rotulo: 'Compartilhamentos por post', fmt: v => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) },
  { chave: 'seguidoresGerados', rotulo: 'Seguidores gerados', fmt: fmtNum },
]

// Três colunas lado a lado (uma por formato) com a mesma régua em cada
// linha: a cápsula mostra o valor relativo ao melhor formato naquela
// métrica, e o melhor ganha a marca "melhor" (texto, não só cor).
export function FormatosComparativo({ porFormato, recarregando }: { porFormato: LinhaFormato[]; recarregando?: boolean }) {
  const total = porFormato.reduce((s, f) => s + f.quantidade, 0)
  const linhas = ORDEM_FORMATOS.map(f => porFormato.find(x => x.formato === f) ?? { formato: f, quantidade: 0, alcanceMedio: 0, visualizacoesMedias: 0, interacoesMedias: 0, taxaEngajamento: 0, salvamentosMedios: 0, compartilhamentosMedios: 0, seguidoresGerados: 0 })
  // A Meta não fornece "seguidores gerados" (follows) pra reels — mostrar 0
  // ali seria afirmar que reel não traz seguidor nenhum.
  const indisponivel = (f: FormatoPostSocial, chave: keyof AgregadoPostsSocial) => f === 'REELS' && chave === 'seguidoresGerados'
  const maximos = Object.fromEntries(METRICAS.map(m => [m.chave, Math.max(0, ...linhas.filter(l => l.quantidade > 0 && !indisponivel(l.formato, m.chave)).map(l => l[m.chave]))]))
  const comparaveis = linhas.filter(l => l.quantidade > 0).length >= 2

  return (
    <CartaoViz
      titulo="Desempenho por formato"
      subtitulo="Média por publicação de cada formato no período"
      recarregando={recarregando}
      tabela={{
        colunas: ['Formato', 'Posts', ...METRICAS.map(m => m.rotulo)],
        linhas: linhas.map(l => [ROTULO_FORMATO[l.formato], l.quantidade, ...METRICAS.map(m => (indisponivel(l.formato, m.chave) ? 'n/d' : m.fmt(l[m.chave])))]),
      }}
    >
      {total === 0 ? <Vazio>Nenhuma publicação no período.</Vazio> : (
        <div className="pl-sv-grid pl-sv-grid-3">
          {linhas.map(l => (
            <div key={l.formato} className="pl-sv-formato-col" style={{ opacity: l.quantidade === 0 ? 0.55 : 1 }}>
              <div className="pl-sv-formato-head">
                <span className="pl-sv-chave" style={{ background: COR_FORMATO[l.formato] }} />
                {ROTULO_FORMATO[l.formato]}
                <small>{l.quantidade} {l.quantidade === 1 ? 'post' : 'posts'} · {fmtPct(total > 0 ? l.quantidade / total : 0, 0)}</small>
              </div>
              {l.quantidade === 0 ? <div className="pl-hint" style={{ fontSize: 12 }}>Nenhum {ROTULO_FORMATO[l.formato].toLowerCase()} no período.</div> : METRICAS.map(m => {
                if (indisponivel(l.formato, m.chave)) {
                  return (
                    <div key={m.chave} className="pl-sv-capsula-linha" title="O Instagram não fornece essa métrica pra reels">
                      <span>{m.rotulo}</span>
                      <b style={{ color: 'var(--pl-ink-muted)' }}>n/d</b>
                      <div className="pl-sv-capsula" aria-hidden="true" />
                    </div>
                  )
                }
                const v = l[m.chave]
                const max = maximos[m.chave]
                const ehMelhor = comparaveis && max > 0 && v === max
                return (
                  <div key={m.chave} className="pl-sv-capsula-linha">
                    <span>{m.rotulo}{ehMelhor && <span className="pl-sv-melhor">melhor</span>}</span>
                    <b>{m.fmt(v)}</b>
                    <div className="pl-sv-capsula" aria-hidden="true">
                      <span style={{ width: `${max > 0 ? Math.max(2, (v / max) * 100) : 0}%`, background: COR_FORMATO[l.formato], opacity: ehMelhor || !comparaveis ? 1 : 0.55 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </CartaoViz>
  )
}

const ROTULO_ORIGEM: Record<string, string> = {
  REEL: 'Reels', POST: 'Posts (foto/vídeo)', CAROUSEL_CONTAINER: 'Carrosséis', STORY: 'Stories', AD: 'Anúncios', IGTV: 'Vídeos', LIVE: 'Lives',
}

export function OrigemAlcance({ distribuicao, recarregando }: { distribuicao: Analise['distribuicaoAlcance']; recarregando?: boolean }) {
  const naoSeg = distribuicao?.porTipoSeguidor.find(f => f.chave === 'NON_FOLLOWER')?.valor ?? 0
  const seg = distribuicao?.porTipoSeguidor.find(f => f.chave === 'FOLLOWER')?.valor ?? 0
  const totalTipo = naoSeg + seg
  const formatos = distribuicao?.porFormato ?? []
  const maxFormato = Math.max(1, ...formatos.map(f => f.valor))
  const somaFormato = formatos.reduce((s, f) => s + f.valor, 0)

  return (
    <CartaoViz
      titulo="De onde vem o alcance"
      subtitulo={distribuicao ? `Contas alcançadas nos últimos ${distribuicao.periodoDias} dias (janela fixa do Instagram, independe do filtro)` : 'Descoberta x base de seguidores'}
      recarregando={recarregando}
      tabela={distribuicao ? {
        colunas: ['Origem', 'Contas alcançadas', '%'],
        linhas: [
          ['Não seguidores (descoberta)', fmtNum(naoSeg), fmtPct(totalTipo > 0 ? naoSeg / totalTipo : 0)],
          ['Seguidores', fmtNum(seg), fmtPct(totalTipo > 0 ? seg / totalTipo : 0)],
          ...formatos.map(f => [ROTULO_ORIGEM[f.chave] ?? f.chave, fmtNum(f.valor), fmtPct(somaFormato > 0 ? f.valor / somaFormato : 0)]),
        ],
      } : undefined}
    >
      {!distribuicao ? <Vazio>Esse dado aparece depois da próxima sincronização.</Vazio> : (
        <>
          {totalTipo > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div className="pl-sv-split" role="img" aria-label={`${fmtPct(naoSeg / totalTipo, 0)} do alcance vem de não seguidores`}>
                <span style={{ width: `${(naoSeg / totalTipo) * 100}%`, background: 'var(--sv-1)' }} />
                <span style={{ width: `${(seg / totalTipo) * 100}%`, background: 'var(--sv-seq-1)' }} />
              </div>
              <div className="pl-sv-split-legenda">
                <span><i className="pl-sv-chave" style={{ background: 'var(--sv-1)', marginRight: 6 }} />Não seguidores (descoberta) <b>{fmtPct(naoSeg / totalTipo, 0)}</b> · {fmtNum(naoSeg)}</span>
                <span><i className="pl-sv-chave" style={{ background: 'var(--sv-seq-1)', marginRight: 6 }} />Seguidores <b>{fmtPct(seg / totalTipo, 0)}</b> · {fmtNum(seg)}</span>
              </div>
              <div className="pl-sv-rodape" style={{ marginTop: 8 }}>
                Alcance em quem ainda não segue é o que faz o perfil crescer; alcance na base mede fidelização.
              </div>
            </div>
          )}
          {formatos.length > 0 && (
            <>
              <div className="pl-card-sub" style={{ marginBottom: 8, fontWeight: 600, color: 'var(--pl-ink-2)' }}>Alcance por formato</div>
              {formatos.map(f => (
                <div key={f.chave} className="pl-sv-hbar">
                  <span className="nome">{ROTULO_ORIGEM[f.chave] ?? f.chave}</span>
                  <span className="pl-sv-hbar-trilho"><span style={{ width: `${(f.valor / maxFormato) * 100}%` }} /></span>
                  <b>{fmtPct(somaFormato > 0 ? f.valor / somaFormato : 0, 0)}</b>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </CartaoViz>
  )
}
