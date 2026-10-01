'use client'

// Campanhas por dentro: como a verba se divide entre elas (e se o resultado
// acompanha) e como cada conjunto está configurado no Gerenciador — público,
// otimização, orçamento e fase de aprendizado — pra auditar sem abrir a Meta.
import { useState } from 'react'
import type { AnaliseTrafego, LinhaTabelaTrafego } from '@/lib/proLaboreApi'
import { CartaoViz, Vazio } from '../../social-media/_componentes/viz'
import { BarrasParticipacao, type LinhaParticipacao } from './Publicos'
import { StatusObjeto } from './Criativos'
import { SINGULAR_RESULTADO, moeda, pct } from './formato'

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
