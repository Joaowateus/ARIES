'use client'

// Campanhas, conjuntos e anúncios lado a lado com as mesmas métricas do
// funil — pra achar onde está o dinheiro bem ou mal gasto. Clicar numa
// campanha ou conjunto filtra a aba inteira por ele.
import { useState } from 'react'
import type { AnaliseTrafego, LinhaTabelaTrafego } from '@/lib/proLaboreApi'
import { Abas } from '../../social-media/_componentes/viz'
import { ROTULO_RESULTADO, compacto, moeda, num, pct } from './formato'
import { StatusObjeto } from './Criativos'

type Nivel = 'campanhas' | 'conjuntos' | 'anuncios'
type Coluna = { chave: string; rotulo: string; valor: (l: LinhaTabelaTrafego) => number | null; fmt: (l: LinhaTabelaTrafego) => string; titulo?: string }

export default function TabelaTrafego({ analise, onFiltrar }: {
  analise: AnaliseTrafego
  onFiltrar: (f: { campanhaId?: string; adsetId?: string }) => void
}) {
  const c = analise.conta.moeda
  const [nivel, setNivel] = useState<Nivel>('campanhas')
  const [ordem, setOrdem] = useState<{ chave: string; desc: boolean }>({ chave: 'gasto', desc: true })
  const linhas = analise[nivel]
  const temVideo = analise.totais.videoViews > 0
  const temEngajadas = analise.totais.conversasProf2 > 0
  const colunas: Coluna[] = [
    ...(nivel !== 'anuncios' && analise.temEstrutura ? [{
      chave: 'orc', rotulo: 'Orç./dia', titulo: 'Orçamento diário atual (do conjunto ou da campanha)',
      valor: (l: LinhaTabelaTrafego) => l.estrutura?.orcamentoDiario ?? null,
      fmt: (l: LinhaTabelaTrafego) => (l.estrutura?.orcamentoDiario ? moeda(l.estrutura.orcamentoDiario, c, 0) : l.estrutura?.orcamentoTotal ? `${moeda(l.estrutura.orcamentoTotal, c, 0)} total` : '—'),
    }] : []),
    { chave: 'gasto', rotulo: 'Investimento', valor: l => l.metricas.gasto, fmt: l => moeda(l.metricas.gasto, c) },
    { chave: 'impressoes', rotulo: 'Impressões', valor: l => l.metricas.impressoes, fmt: l => compacto(l.metricas.impressoes) },
    ...(nivel === 'campanhas' ? [{ chave: 'freq', rotulo: 'Freq.', titulo: 'Frequência', valor: (l: LinhaTabelaTrafego) => l.derivadas.frequencia, fmt: (l: LinhaTabelaTrafego) => (l.derivadas.frequencia != null ? l.derivadas.frequencia.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '—') }] : []),
    { chave: 'cpm', rotulo: 'CPM', valor: l => l.derivadas.cpm, fmt: l => moeda(l.derivadas.cpm, c) },
    { chave: 'ctr', rotulo: 'CTR', titulo: 'CTR do link', valor: l => l.derivadas.ctr, fmt: l => pct(l.derivadas.ctr, 2) },
    { chave: 'cpc', rotulo: 'CPC', valor: l => l.derivadas.cpc, fmt: l => moeda(l.derivadas.cpc, c) },
    {
      chave: 'cr', rotulo: 'Connect', titulo: 'Connect rate: (visualizações + conversas) ÷ cliques no link',
      valor: l => (l.metricas.cliquesLink ? (l.metricas.lpv + l.metricas.conversas) / l.metricas.cliquesLink : null),
      fmt: l => pct(l.metricas.cliquesLink ? (l.metricas.lpv + l.metricas.conversas) / l.metricas.cliquesLink : null),
    },
    { chave: 'res', rotulo: 'Resultado', valor: l => l.metricas[l.resultado], fmt: l => `${num(l.metricas[l.resultado])} ${ROTULO_RESULTADO[l.resultado]}` },
    { chave: 'custo', rotulo: 'Custo/result.', titulo: 'Custo por resultado', valor: l => l.custoResultado, fmt: l => moeda(l.custoResultado, c) },
    ...(temEngajadas ? [{ chave: 'eng', rotulo: 'Conv. eng.', titulo: 'Conversas engajadas: 2+ mensagens da pessoa ÷ conversas iniciadas', valor: (l: LinhaTabelaTrafego) => l.derivadas.taxaConversaEngajada, fmt: (l: LinhaTabelaTrafego) => pct(l.derivadas.taxaConversaEngajada, 0) }] : []),
    ...(temVideo ? [
      { chave: 'hook', rotulo: 'Hook', titulo: 'Hook rate', valor: (l: LinhaTabelaTrafego) => l.derivadas.hookRate, fmt: (l: LinhaTabelaTrafego) => pct(l.derivadas.hookRate) },
      { chave: 'hold', rotulo: 'Hold', titulo: 'Hold rate', valor: (l: LinhaTabelaTrafego) => l.derivadas.holdRate, fmt: (l: LinhaTabelaTrafego) => pct(l.derivadas.holdRate) },
    ] : []),
  ]
  const col = colunas.find(x => x.chave === ordem.chave) ?? colunas[0]
  const ordenadas = [...linhas].sort((a, b) => {
    const va = col.valor(a), vb = col.valor(b)
    if (va == null) return 1
    if (vb == null) return -1
    return ordem.desc ? vb - va : va - vb
  })
  const podeFiltrar = nivel !== 'anuncios'

  return (
    <div className="pl-card pl-tf-tabela-card">
      <div className="pl-tf-tabela-topo">
        <div>
          <div className="pl-card-title">Campanhas, conjuntos e anúncios</div>
          <div className="pl-card-sub">Clique no título da coluna pra ordenar{podeFiltrar ? ' · clique na linha pra filtrar a aba por ela' : ''}.</div>
        </div>
        <Abas rotulo="Nível" opcoes={[{ valor: 'campanhas', rotulo: `Campanhas (${analise.campanhas.length})` }, { valor: 'conjuntos', rotulo: `Conjuntos (${analise.conjuntos.length})` }, { valor: 'anuncios', rotulo: `Anúncios (${analise.anuncios.length})` }]} valor={nivel} onChange={setNivel} />
      </div>
      {linhas.length === 0 ? <p className="pl-hint" style={{ padding: '14px 0' }}>Nenhum anúncio com dados no período.</p> : (
        <div className="pl-tf-tabela-scroll">
          <table className="pl-tf-tabela">
            <thead>
              <tr>
                <th className="nome">{nivel === 'campanhas' ? 'Campanha' : nivel === 'conjuntos' ? 'Conjunto' : 'Anúncio'}</th>
                {colunas.map(x => (
                  <th key={x.chave} title={x.titulo ?? x.rotulo} aria-sort={ordem.chave === x.chave ? (ordem.desc ? 'descending' : 'ascending') : 'none'}>
                    <button type="button" onClick={() => setOrdem(o => ({ chave: x.chave, desc: o.chave === x.chave ? !o.desc : true }))}>
                      {x.rotulo}{ordem.chave === x.chave ? (ordem.desc ? ' ↓' : ' ↑') : ''}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenadas.map(l => (
                <tr
                  key={l.id}
                  className={podeFiltrar ? 'clicavel' : ''}
                  onClick={podeFiltrar ? () => onFiltrar(nivel === 'campanhas' ? { campanhaId: l.id } : { campanhaId: l.campanhaId, adsetId: l.id }) : undefined}
                  tabIndex={podeFiltrar ? 0 : undefined}
                  onKeyDown={podeFiltrar ? e => { if (e.key === 'Enter') onFiltrar(nivel === 'campanhas' ? { campanhaId: l.id } : { campanhaId: l.campanhaId, adsetId: l.id }) } : undefined}
                >
                  <td className="nome">
                    <div className="pl-tf-nome-linha">
                      {nivel === 'anuncios' && (l.estrutura?.miniatura || l.estrutura?.imagem) && (
                        // eslint-disable-next-line @next/next/no-img-element -- miniatura do CDN da Meta
                        <img className="pl-tf-mini" src={(l.estrutura.miniatura ?? l.estrutura.imagem)!} alt="" loading="lazy" referrerPolicy="no-referrer" />
                      )}
                      <div>
                        <b>{l.nome}</b>
                        {nivel !== 'campanhas' && <small>{nivel === 'anuncios' ? `${l.campanhaNome} › ${l.adsetNome}` : l.campanhaNome}</small>}
                        {l.status && <small><StatusObjeto status={l.status} /></small>}
                      </div>
                    </div>
                  </td>
                  {colunas.map(x => <td key={x.chave} className="pl-mono">{x.fmt(l)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
