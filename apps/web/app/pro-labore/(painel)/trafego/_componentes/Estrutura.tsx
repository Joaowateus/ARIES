'use client'

// Campanhas por dentro: como a verba se divide entre elas (e se o resultado
// acompanha) e como cada conjunto está configurado no Gerenciador — público,
// otimização, orçamento e fase de aprendizado — pra auditar sem abrir a Meta.
import { useState } from 'react'
import type { AnaliseTrafego, LinhaTabelaTrafego } from '@/lib/proLaboreApi'
import { CartaoViz, Vazio, useLargura } from '../../social-media/_componentes/viz'
import { BarrasParticipacao, SeloCusto, type LinhaParticipacao } from './Publicos'
import { corIndice } from './GraficosPublico'
import { StatusObjeto } from './Criativos'
import { SINGULAR_RESULTADO, moeda, num, pct, singular } from './formato'

const OTIMIZACAO: Record<string, string> = {
  CONVERSATIONS: 'Conversas', LEAD_GENERATION: 'Leads (formulário)', QUALITY_LEAD: 'Leads de qualidade', OFFSITE_CONVERSIONS: 'Conversões no site',
  LINK_CLICKS: 'Cliques no link', LANDING_PAGE_VIEWS: 'Visualizações da página', REACH: 'Alcance', IMPRESSIONS: 'Impressões', THRUPLAY: 'ThruPlay',
  POST_ENGAGEMENT: 'Engajamento', PROFILE_VISIT: 'Visitas ao perfil', MESSAGING_PURCHASE_CONVERSION: 'Compras por mensagem', VALUE: 'Valor',
  APP_INSTALLS: 'Instalações', PAGE_LIKES: 'Curtidas na página', VISIT_INSTAGRAM_PROFILE: 'Visitas ao perfil', MESSAGING_APPOINTMENT_CONVERSION: 'Agendamentos por mensagem',
}
const APRENDIZADO: Record<string, { rotulo: string; classe: string }> = {
  LEARNING: { rotulo: 'Em aprendizado', classe: 'medio' },
  SUCCESS: { rotulo: 'Fora do aprendizado', classe: 'bom' },
  FAIL: { rotulo: 'Aprendizado limitado', classe: 'ruim' },
}

// Resultado comparável entre campanhas: contatos (conversas + leads) se a
// conta tem; senão visualizações; senão cliques.
function resultadoDe(analise: AnaliseTrafego) {
  const t = analise.totais
  if (t.conversas + t.leads > 0) return { valor: (l: LinhaTabelaTrafego) => l.metricas.conversas + l.metricas.leads, nome: t.leads === 0 ? 'conversas' : t.conversas === 0 ? 'leads' : 'contatos' }
  if (t.lpv > 0) return { valor: (l: LinhaTabelaTrafego) => l.metricas.lpv, nome: 'visualizações' }
  return { valor: (l: LinhaTabelaTrafego) => l.metricas.cliquesLink, nome: 'cliques' }
}

export function DistribuicaoVerba({ analise, nivel, onFiltrar }: { analise: AnaliseTrafego; nivel: 'campanhas' | 'conjuntos'; onFiltrar: (f: { campanhaId?: string; adsetId?: string }) => void }) {
  const r = resultadoDe(analise)
  const linhas = analise[nivel]
  const totG = linhas.reduce((s, l) => s + l.metricas.gasto, 0), totR = linhas.reduce((s, l) => s + r.valor(l), 0)
  const medio = totR > 0 ? totG / totR : null
  const dados: Array<LinhaParticipacao & { orig: LinhaTabelaTrafego }> = linhas.map(l => {
    const res = r.valor(l)
    const custo = res > 0 ? l.metricas.gasto / res : null
    return {
      chave: l.id, rotulo: l.nome, sub: nivel === 'conjuntos' ? l.campanhaNome : null, orig: l,
      gasto: l.metricas.gasto, resultados: res, partGasto: totG > 0 ? l.metricas.gasto / totG : 0, partResultados: totR > 0 ? res / totR : 0,
      custoResultado: custo, indiceCusto: custo != null && medio ? custo / medio : null,
      ctr: l.derivadas.ctr, connectRate: l.metricas.cliquesLink ? (l.metricas.lpv + l.metricas.conversas) / l.metricas.cliquesLink : null,
    }
  })
  return (
    <BarrasParticipacao
      titulo={nivel === 'campanhas' ? 'Divisão da verba entre campanhas' : 'Divisão da verba entre conjuntos'}
      subtitulo="Quem leva mais investimento do que devolve em resultado aparece com a barra laranja menor que a azul. Clique pra filtrar a aba."
      linhas={dados} moedaConta={analise.conta.moeda} nomeResultado={r.nome} limite={8}
      onClicar={l => { const o = (l as typeof dados[number]).orig; onFiltrar(nivel === 'campanhas' ? { campanhaId: o.id } : { campanhaId: o.campanhaId, adsetId: o.id }) }}
    />
  )
}

// ---------- Treemap: onde está a verba ----------
type Caixa<T> = T & { x: number; y: number; w: number; h: number }
// Treemap "squarified": blocos o mais quadrados possível, área = investimento.
function squarify<T extends { area: number }>(itens: T[], x: number, y: number, w: number, h: number): Array<Caixa<T>> {
  const out: Array<Caixa<T>> = []
  let resto = [...itens].sort((a, b) => b.area - a.area)
  const pior = (linha: T[], lado: number) => {
    const soma = linha.reduce((s, i) => s + i.area, 0)
    const mx = Math.max(...linha.map(i => i.area)), mn = Math.min(...linha.map(i => i.area))
    return Math.max((lado * lado * mx) / (soma * soma), (soma * soma) / (lado * lado * mn))
  }
  while (resto.length && w > 0 && h > 0) {
    const lado = Math.min(w, h)
    let n = 1
    while (n < resto.length && pior(resto.slice(0, n + 1), lado) <= pior(resto.slice(0, n), lado)) n++
    const linha = resto.slice(0, n)
    const soma = linha.reduce((s, i) => s + i.area, 0)
    if (w >= h) {
      const cw = soma / h
      let yy = y
      for (const i of linha) { const ih = i.area / cw; out.push({ ...i, x, y: yy, w: cw, h: ih }); yy += ih }
      x += cw; w -= cw
    } else {
      const rh = soma / w
      let xx = x
      for (const i of linha) { const iw = i.area / rh; out.push({ ...i, x: xx, y, w: iw, h: rh }); xx += iw }
      y += rh; h -= rh
    }
    resto = resto.slice(n)
  }
  return out
}

export function TreemapCampanhas({ analise, onFiltrar }: { analise: AnaliseTrafego; onFiltrar: (f: { campanhaId?: string }) => void }) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const [ativo, setAtivo] = useState<string | null>(null)
  const c = analise.conta.moeda
  const r = resultadoDe(analise)
  const linhas = analise.campanhas.filter(l => l.metricas.gasto > 0)
  const totG = linhas.reduce((s, l) => s + l.metricas.gasto, 0), totR = linhas.reduce((s, l) => s + r.valor(l), 0)
  const medio = totR > 0 ? totG / totR : null
  const ALT = 300
  const itens = linhas.map(l => {
    const res = r.valor(l)
    const custo = res > 0 ? l.metricas.gasto / res : null
    return { l, res, custo, indice: custo != null && medio ? custo / medio : null, area: totG > 0 ? (l.metricas.gasto / totG) * largura * ALT : 0 }
  })
  const caixas = largura > 0 ? squarify(itens, 0, 0, largura, ALT) : []
  const sel = itens.find(i => i.l.id === ativo)
  return (
    <CartaoViz
      titulo="Onde está a verba"
      subtitulo={`Cada bloco é uma campanha: o tamanho é o investimento e a cor, o custo por ${singular(r.nome)} contra a média. Clique pra filtrar a aba.`}
      tabela={{
        colunas: ['Campanha', 'Investimento', '% invest.', r.nome, 'Custo/result.', 'vs média'],
        linhas: itens.map(i => [i.l.nome, moeda(i.l.metricas.gasto, c), pct(totG ? i.l.metricas.gasto / totG : 0), num(i.res), moeda(i.custo, c), i.indice != null ? `${i.indice.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}x` : '—']),
      }}
    >
      {linhas.length === 0 ? <Vazio>Nenhuma campanha com investimento no período.</Vazio> : (
        <>
          <div ref={ref} className="pl-tf-treemap" style={{ height: ALT }}>
            {caixas.map(b => {
              const cor = b.res === 0 ? { bg: 'var(--pl-surface-2)', ink: 'var(--pl-ink-2)' } : corIndice(b.indice)
              const cabe = b.w > 86 && b.h > 40
              return (
                <button key={b.l.id} type="button" className={`pl-tf-tm-bloco ${ativo === b.l.id ? 'ativo' : ''} ${b.res === 0 ? 'sem' : ''}`}
                  style={{ left: b.x, top: b.y, width: b.w, height: b.h, background: cor.bg, color: cor.ink }}
                  onMouseEnter={() => setAtivo(b.l.id)} onMouseLeave={() => setAtivo(null)} onFocus={() => setAtivo(b.l.id)} onBlur={() => setAtivo(null)}
                  onClick={() => onFiltrar({ campanhaId: b.l.id })}
                  aria-label={`${b.l.nome}: ${moeda(b.l.metricas.gasto, c)}, ${num(b.res)} ${r.nome}, ${moeda(b.custo, c)} cada`}>
                  {cabe && (
                    <>
                      <b>{b.l.nome}</b>
                      <span>{moeda(b.l.metricas.gasto, c, 0)} · {pct(totG ? b.l.metricas.gasto / totG : 0, 0)}</span>
                      {b.h > 64 && <span>{b.res === 0 ? `sem ${r.nome}` : `${moeda(b.custo, c)} por ${singular(r.nome)}`}</span>}
                    </>
                  )}
                </button>
              )
            })}
          </div>
          <div className="pl-tf-tm-rodape">
            <div className="pl-tf-heat-legenda" aria-hidden="true" style={{ justifyContent: 'flex-start', marginTop: 0 }}>
              <span>mais barato</span><i className="b2" /><i className="b1" /><i className="n" /><i className="c1" /><i className="c2" /><span>mais caro</span>
            </div>
            <span className="pl-tf-tm-info">
              {sel ? <><b>{sel.l.nome}</b> · {moeda(sel.l.metricas.gasto, c)} · {num(sel.res)} {r.nome} · {moeda(sel.custo, c)} cada <SeloCusto indice={sel.indice} /></> : `Média: ${moeda(medio, c)} por ${singular(r.nome)}`}
            </span>
          </div>
        </>
      )}
    </CartaoViz>
  )
}

function Lista({ itens, max = 4 }: { itens: string[]; max?: number }) {
  if (!itens.length) return null
  const resto = itens.length - max
  return <>{itens.slice(0, max).join(', ')}{resto > 0 && <span title={itens.slice(max).join(', ')}> +{resto}</span>}</>
}

export function ConjuntosConfigurados({ analise }: { analise: AnaliseTrafego }) {
  const [todos, setTodos] = useState(false)
  const c = analise.conta.moeda
  const lista = analise.conjuntos
  const visiveis = todos ? lista : lista.slice(0, 6)
  return (
    <CartaoViz
      titulo="Como cada conjunto está configurado"
      subtitulo="Público, otimização, orçamento e aprendizado — como está agora no Gerenciador"
      tabela={{
        colunas: ['Conjunto', 'Status', 'Idade', 'Gênero', 'Locais', 'Interesses', 'Públicos', 'Otimização', 'Orç./dia', 'Aprendizado', 'Custo/result.'],
        linhas: lista.map(l => {
          const e = l.estrutura, p = e?.publico
          return [l.nome, l.status ?? '—', p?.idade ?? '—', p?.generos ?? '—', p?.locais.join(', ') || '—', p?.interesses.join(', ') || (p?.advantage ? 'Advantage+' : 'Aberto'),
            p?.publicosPersonalizados.join(', ') || '—', OTIMIZACAO[e?.otimizacao ?? ''] ?? e?.otimizacao ?? '—', e?.orcamentoDiario ? moeda(e.orcamentoDiario, c) : '—',
            APRENDIZADO[e?.aprendizado ?? '']?.rotulo ?? '—', moeda(l.custoResultado, c)]
        }),
      }}
      rodape={lista.length > 6 ? <button type="button" className="pl-link-action" onClick={() => setTodos(v => !v)}>{todos ? 'Mostrar menos' : `Ver todos (${lista.length})`}</button> : undefined}
    >
      {lista.length === 0 ? <Vazio>Nenhum conjunto com entrega no período.</Vazio> : (
        <ul className="pl-tf-conjuntos">
          {visiveis.map(l => {
            const e = l.estrutura, p = e?.publico
            const ap = APRENDIZADO[e?.aprendizado ?? '']
            return (
              <li key={l.id}>
                <div className="pl-tf-conj-topo">
                  <div><b>{l.nome}</b><small>{l.campanhaNome}</small></div>
                  <div className="pl-tf-conj-status">
                    <StatusObjeto status={l.status} />
                    {ap && <span className={`pl-tf-rank ${ap.classe}`}>{ap.rotulo}{e?.aprendizado === 'LEARNING' && e.conversoesAprendizado != null ? ` (${e.conversoesAprendizado}/50)` : ''}</span>}
                  </div>
                </div>
                {!e ? <p className="pl-hint">Sem detalhes do Gerenciador ainda — clique em &quot;Atualizar agora&quot;.</p> : (
                  <dl className="pl-tf-conj-dados">
                    {p && <div><dt>Quem</dt><dd>{p.generos === 'Todos' ? 'Todos os gêneros' : p.generos}, {p.idade} anos{p.advantage && <span className="pl-tf-chip">Advantage+</span>}</dd></div>}
                    {p && p.locais.length > 0 && <div><dt>Onde</dt><dd><Lista itens={p.locais} /></dd></div>}
                    {p && <div><dt>Interesses</dt><dd>{p.interesses.length ? <Lista itens={p.interesses} max={5} /> : <span className="pl-hint">Nenhum (público aberto{p.advantage ? ', a Meta expande' : ''})</span>}</dd></div>}
                    {p && (p.publicosPersonalizados.length > 0 || p.excluidos.length > 0) && <div><dt>Públicos</dt><dd><Lista itens={p.publicosPersonalizados} />{p.excluidos.length > 0 && <> · <span className="pl-hint">excluindo</span> <Lista itens={p.excluidos} /></>}</dd></div>}
                    <div><dt>Posicionamentos</dt><dd>{p?.posicionamentos ? p.posicionamentos.map(x => x.replace('_', ' ')).join(', ') : 'Automáticos (Advantage+)'}</dd></div>
                    <div><dt>Otimizando pra</dt><dd>{OTIMIZACAO[e.otimizacao ?? ''] ?? e.otimizacao ?? '—'}</dd></div>
                    <div><dt>Orçamento</dt><dd>{e.orcamentoDiario ? `${moeda(e.orcamentoDiario, c)}/dia` : e.orcamentoTotal ? `${moeda(e.orcamentoTotal, c)} no total` : 'Na campanha (CBO)'}</dd></div>
                    <div><dt>No período</dt><dd>{moeda(l.metricas.gasto, c)} · {moeda(l.custoResultado, c)} por {SINGULAR_RESULTADO[l.resultado]} · CTR {pct(l.derivadas.ctr, 2)}</dd></div>
                  </dl>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </CartaoViz>
  )
}
