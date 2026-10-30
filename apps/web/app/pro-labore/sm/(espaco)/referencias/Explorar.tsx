'use client'

// Explorar: todos os posts monitorados (hashtags das motos, concorrentes,
// referências e a própria conta) num lugar só, com filtros e ordenação.
import { useMemo, useState } from 'react'
import type { SmFormatoPublico, SmPostReferencia, SmReferencias } from '@/lib/proLaboreApi'
import { Botao, EstadoVazio, Toggle } from '../../_ui'
import { CardPost, FORMATO, tipoDoPost } from './comum'

type Ordem = 'engajamento' | 'indice' | 'taxa' | 'recentes' | 'comentarios'
const ORDENS: Record<Ordem, { rotulo: string; valor: (p: SmPostReferencia) => number }> = {
  engajamento: { rotulo: 'Mais engajamento', valor: p => p.engajamento },
  indice: { rotulo: 'Mais acima da média da fonte', valor: p => p.indice ?? 0 },
  taxa: { rotulo: 'Maior taxa sobre seguidores', valor: p => p.taxa ?? -1 },
  comentarios: { rotulo: 'Mais comentários', valor: p => p.comentarios ?? 0 },
  recentes: { rotulo: 'Mais recentes', valor: p => (p.publicadoEm ? Date.parse(p.publicadoEm) : 0) },
}
const PAGINA = 24

export interface Filtros { q: string; fonte: string; moto: string; formatos: SmFormatoPublico[]; dias: number; ordem: Ordem; foraDaCurva: boolean }
export const FILTROS_INICIAIS: Filtros = { q: '', fonte: 'todas', moto: '', formatos: [], dias: 0, ordem: 'engajamento', foraDaCurva: false }

export function filtrar(dados: SmReferencias, f: Filtros, agora = Date.now()) {
  const q = f.q.trim().toLowerCase()
  return dados.posts
    .filter(p => {
      const tipo = tipoDoPost(p, dados.perfis)
      if (f.fonte === 'hashtags' && tipo !== 'HASHTAG') return false
      if (f.fonte === 'concorrentes' && tipo !== 'CONCORRENTE') return false
      if (f.fonte === 'referencias' && tipo !== 'REFERENCIA') return false
      if (f.fonte === 'eu' && tipo !== 'EU') return false
      if (f.fonte === 'todas' && tipo === 'EU') return false
      if (f.fonte.startsWith('@') && !(p.origem === 'PERFIL' && p.fonte === f.fonte.slice(1))) return false
      if (f.moto && p.motoChave !== f.moto) return false
      if (f.formatos.length && (!p.formato || !f.formatos.includes(p.formato))) return false
      if (f.dias && (!p.publicadoEm || agora - Date.parse(p.publicadoEm) > f.dias * 864e5)) return false
      if (f.foraDaCurva && !p.foraDaCurva) return false
      if (q && !`${p.legenda ?? ''} ${p.autor ?? ''} ${p.fonte}`.toLowerCase().includes(q)) return false
      return true
    })
    .sort((a, b) => ORDENS[f.ordem].valor(b) - ORDENS[f.ordem].valor(a))
}

export function GradePosts({ posts, podeEditar, aoAbrir, aoSalvar, numerar, vazio }: {
  posts: SmPostReferencia[]; podeEditar: boolean; aoAbrir: (p: SmPostReferencia) => void; aoSalvar: (p: SmPostReferencia) => void; numerar?: boolean; vazio?: React.ReactNode
}) {
  const [limite, setLimite] = useState(PAGINA)
  if (!posts.length) return <>{vazio ?? <EstadoVazio titulo="Nada com esses filtros">Tire algum filtro ou amplie o período.</EstadoVazio>}</>
  return (
    <>
      <ol className="sm-ref-cards">
        {posts.slice(0, limite).map((p, i) => <CardPost key={p.id} p={p} posicao={numerar ? i + 1 : undefined} podeEditar={podeEditar} aoAbrir={() => aoAbrir(p)} aoSalvar={() => aoSalvar(p)} />)}
      </ol>
      {posts.length > limite && <div className="sm-ref-mais"><Botao variante="sec" onClick={() => setLimite(l => l + PAGINA)} data-mostrar-mais>Mostrar mais ({posts.length - limite})</Botao></div>}
    </>
  )
}

export function Explorar({ dados, filtros, setFiltros, aoAbrir, aoSalvar }: {
  dados: SmReferencias; filtros: Filtros; setFiltros: (f: Filtros) => void; aoAbrir: (p: SmPostReferencia) => void; aoSalvar: (p: SmPostReferencia) => void
}) {
  const lista = useMemo(() => filtrar(dados, filtros), [dados, filtros])
  const muda = <K extends keyof Filtros>(k: K, v: Filtros[K]) => setFiltros({ ...filtros, [k]: v })
  const perfis = dados.perfis.filter(p => p.tipo !== 'EU')
  const alterado = JSON.stringify(filtros) !== JSON.stringify(FILTROS_INICIAIS)
  return (
    <div className="sm-ref-explorar">
      <div className="sm-ref-filtros" role="search">
        <input className="sm-input sm-ref-busca" type="search" value={filtros.q} onChange={e => muda('q', e.target.value)} placeholder="Buscar na legenda, @perfil ou hashtag" aria-label="Buscar" data-filtro-busca />
        <select className="sm-input" value={filtros.fonte} onChange={e => muda('fonte', e.target.value)} aria-label="De quem" data-filtro-fonte>
          <option value="todas">Todas as fontes</option>
          <option value="concorrentes">Só concorrentes</option>
          <option value="referencias">Só referências</option>
          <option value="hashtags">Só hashtags das motos</option>
          <option value="eu">Só a nossa conta</option>
          {perfis.length > 0 && <optgroup label="Perfil">{perfis.map(p => <option key={p.id} value={`@${p.usuario}`}>@{p.usuario}</option>)}</optgroup>}
        </select>
        <select className="sm-input" value={filtros.moto} onChange={e => muda('moto', e.target.value)} aria-label="Moto" data-filtro-moto>
          <option value="">Todas as motos</option>
          {dados.motos.map(m => <option key={m.chave} value={m.chave}>{m.nome}</option>)}
        </select>
        <select className="sm-input" value={filtros.dias} onChange={e => muda('dias', Number(e.target.value))} aria-label="Período" data-filtro-periodo>
          <option value={0}>Qualquer data</option>
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
        <select className="sm-input" value={filtros.ordem} onChange={e => muda('ordem', e.target.value as Ordem)} aria-label="Ordenar por" data-filtro-ordem>
          {(Object.keys(ORDENS) as Ordem[]).map(o => <option key={o} value={o}>{ORDENS[o].rotulo}</option>)}
        </select>
      </div>
      <div className="sm-ref-filtros-2">
        <div className="sm-ref-formatos" role="group" aria-label="Formatos">
          {(Object.keys(FORMATO) as SmFormatoPublico[]).map(f => {
            const ligado = filtros.formatos.includes(f)
            return <button key={f} type="button" aria-pressed={ligado} className="sm-ref-filtro-chip" data-filtro-formato={f}
              onClick={() => muda('formatos', ligado ? filtros.formatos.filter(x => x !== f) : [...filtros.formatos, f])}>{FORMATO[f]}</button>
          })}
        </div>
        <Toggle mostrarRotulo rotulo="Só fora da curva (2× a média ou mais)" ligado={filtros.foraDaCurva} aoMudar={v => muda('foraDaCurva', v)} />
        <span className="sm-legenda" aria-live="polite" data-total-filtrado>{lista.length} {lista.length === 1 ? 'post' : 'posts'}</span>
        {alterado && <button type="button" className="sm-link-botao" onClick={() => setFiltros(FILTROS_INICIAIS)}>Limpar filtros</button>}
      </div>
      <GradePosts key={JSON.stringify(filtros)} posts={lista} podeEditar={dados.podeEditar} aoAbrir={aoAbrir} aoSalvar={aoSalvar} numerar={filtros.ordem !== 'recentes'} />
    </div>
  )
}
