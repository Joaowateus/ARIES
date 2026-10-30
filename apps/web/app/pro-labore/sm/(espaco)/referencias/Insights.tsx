'use client'

// O que funciona: padrões tirados dos posts monitorados. A régua é o índice
// de cada post (engajamento ÷ mediana da própria fonte), para um perfil
// grande não pesar mais que um pequeno.
import { useMemo, useState } from 'react'
import type { SmPostReferencia, SmReferencias } from '@/lib/proLaboreApi'
import { EstadoVazio, Segmentado, useToast } from '../../_ui'
import { Barras, DIAS, FORMATO, dec, emBelem, gancho, hashtagsDe, quem, tipoDoPost } from './comum'

type Escopo = 'todos' | 'CONCORRENTE' | 'REFERENCIA' | 'HASHTAG' | 'EU'
const FAIXAS = [{ de: 0, ate: 6, rotulo: 'Madrugada (0h–6h)' }, { de: 6, ate: 12, rotulo: 'Manhã (6h–12h)' }, { de: 12, ate: 18, rotulo: 'Tarde (12h–18h)' }, { de: 18, ate: 24, rotulo: 'Noite (18h–24h)' }]
const TAMANHOS = [{ ate: 80, rotulo: 'Curta (até 80 caracteres)' }, { ate: 300, rotulo: 'Média (80–300)' }, { ate: Infinity, rotulo: 'Longa (mais de 300)' }]
const MIN = 3

function media(posts: SmPostReferencia[], chave: (p: SmPostReferencia) => string | null) {
  const m = new Map<string, number[]>()
  for (const p of posts) { const k = chave(p); if (k != null && p.indice != null) m.set(k, [...(m.get(k) ?? []), p.indice]) }
  return [...m].map(([rotulo, l]) => ({ rotulo, valor: l.reduce((a, b) => a + b, 0) / l.length, n: l.length })).filter(g => g.n >= MIN)
}
const comDestaque = (l: Array<{ rotulo: string; valor: number; n: number }>) => {
  const melhor = Math.max(...l.map(g => g.valor))
  return l.map(g => ({ rotulo: g.rotulo, valor: g.valor, extra: `${g.n} posts`, destaque: g.valor === melhor }))
}

export function Insights({ dados, aoAbrir }: { dados: SmReferencias; aoAbrir: (p: SmPostReferencia) => void }) {
  const toast = useToast()
  const [escopo, setEscopo] = useState<Escopo>('todos')
  const posts = useMemo(() => dados.posts.filter(p => {
    const t = tipoDoPost(p, dados.perfis)
    return escopo === 'todos' ? t !== 'EU' : t === escopo
  }), [dados, escopo])

  const formatos = media(posts, p => (p.formato ? FORMATO[p.formato] : null)).sort((a, b) => b.valor - a.valor)
  const dias = media(posts, p => (p.publicadoEm ? DIAS[emBelem(p.publicadoEm).getUTCDay()] : null)).sort((a, b) => DIAS.indexOf(a.rotulo) - DIAS.indexOf(b.rotulo))
  const faixas = media(posts, p => (p.publicadoEm ? FAIXAS.find(f => emBelem(p.publicadoEm!).getUTCHours() < f.ate)!.rotulo : null)).sort((a, b) => FAIXAS.findIndex(f => f.rotulo === a.rotulo) - FAIXAS.findIndex(f => f.rotulo === b.rotulo))
  const tamanhos = media(posts, p => TAMANHOS.find(t => (p.legenda ?? '').length <= t.ate)!.rotulo).sort((a, b) => TAMANHOS.findIndex(t => t.rotulo === a.rotulo) - TAMANHOS.findIndex(t => t.rotulo === b.rotulo))
  // Hashtags repetidas, pelo índice médio dos posts em que aparecem.
  const porTag = new Map<string, number[]>()
  for (const p of posts) for (const t of hashtagsDe(p.legenda)) if (p.indice != null) porTag.set(t, [...(porTag.get(t) ?? []), p.indice])
  const topTags = [...porTag].filter(([, l]) => l.length >= 2).map(([t, l]) => ({ t, v: l.reduce((a, b) => a + b, 0) / l.length, n: l.length })).sort((a, b) => b.v - a.v).slice(0, 12)
  const ganchos = [...posts].filter(p => gancho(p.legenda)).sort((a, b) => (b.indice ?? 0) - (a.indice ?? 0)).slice(0, 10)

  return (
    <div className="sm-ref-insights">
      <div className="sm-ref-perfis-cab">
        <Segmentado rotulo="Analisar" valor={escopo} aoMudar={setEscopo} opcoes={[
          { valor: 'todos', rotulo: 'Todos' }, { valor: 'CONCORRENTE', rotulo: 'Concorrentes' }, { valor: 'REFERENCIA', rotulo: 'Referências' }, { valor: 'HASHTAG', rotulo: 'Hashtags' }, { valor: 'EU', rotulo: 'Nossa conta' },
        ]} />
        <span className="sm-legenda">{posts.length} posts analisados. 1× = o normal da fonte; 2× = o dobro.</span>
      </div>
      {posts.length < MIN ? <EstadoVazio titulo="Poucos posts para tirar conclusões">Acompanhe mais perfis ou espere a próxima leitura.</EstadoVazio> : (
        <div className="sm-ref-insights-grade">
          <section className="sm-card" data-insight="formato">
            <h3 className="sm-ref-h3">Formato que mais engaja</h3>
            {formatos.length ? <Barras rotulo="Índice médio por formato" itens={comDestaque(formatos)} formatar={v => `${dec(v)}×`} /> : <p className="sm-legenda">Poucos posts por formato.</p>}
          </section>
          <section className="sm-card" data-insight="dia">
            <h3 className="sm-ref-h3">Dia da semana</h3>
            {dias.length ? <Barras rotulo="Índice médio por dia" itens={comDestaque(dias)} formatar={v => `${dec(v)}×`} /> : <p className="sm-legenda">Poucos posts por dia.</p>}
          </section>
          <section className="sm-card" data-insight="horario">
            <h3 className="sm-ref-h3">Horário da postagem (Belém)</h3>
            {faixas.length ? <Barras rotulo="Índice médio por horário" itens={comDestaque(faixas)} formatar={v => `${dec(v)}×`} /> : <p className="sm-legenda">Poucos posts por horário.</p>}
          </section>
          <section className="sm-card" data-insight="legenda">
            <h3 className="sm-ref-h3">Tamanho da legenda</h3>
            {tamanhos.length ? <Barras rotulo="Índice médio por tamanho de legenda" itens={comDestaque(tamanhos)} formatar={v => `${dec(v)}×`} /> : <p className="sm-legenda">Poucos posts para comparar.</p>}
          </section>
          <section className="sm-card" data-insight="hashtags">
            <h3 className="sm-ref-h3">Hashtags dos posts que mais engajam</h3>
            {topTags.length ? (
              <ul className="sm-ref-lista-simples">{topTags.map(x => <li key={x.t}><b>{x.t}</b><span>{dec(x.v)}× · {x.n} posts</span></li>)}</ul>
            ) : <p className="sm-legenda">Hashtags pouco repetidas para comparar.</p>}
          </section>
          <section className="sm-card sm-ref-ganchos" data-insight="ganchos">
            <h3 className="sm-ref-h3">Ganchos dos melhores posts</h3>
            <ol>
              {ganchos.map(p => (
                <li key={p.id}>
                  <button type="button" className="sm-ref-gancho-texto" onClick={() => aoAbrir(p)}>{gancho(p.legenda)}</button>
                  <span className="sm-legenda">{quem(p)} · {dec(p.indice)}× · {p.formato ? FORMATO[p.formato] : ''}</span>
                  <button type="button" className="sm-link-botao" onClick={() => navigator.clipboard?.writeText(gancho(p.legenda)).then(() => toast({ mensagem: 'Gancho copiado.' }), () => {})}>Copiar</button>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </div>
  )
}
