'use client'

// Perfis e concorrentes: a comparação lado a lado (com a nossa conta) e, no
// perfil escolhido, o raio-x: ritmo, formatos, horários, hashtags e os posts
// que saíram da curva.
import { useMemo, useState } from 'react'
import { proLaboreApi, type SmPerfilReferencia, type SmPostReferencia, type SmReferencias } from '@/lib/proLaboreApi'
import { Banner, Botao, Chip, EstadoVazio, Segmentado, haQuanto } from '../../_ui'
import { Barras, DIAS, FORMATO, TIPO_PERFIL, dec, emBelem, hashtagsDe, num, sinal } from './comum'
import { GradePosts } from './Explorar'

type Coluna = 'seguidores' | 'crescimento30' | 'postsSemana' | 'engajamentoMedio' | 'taxaMedia' | 'reels' | 'foraDaCurva'
const COLUNAS: Array<{ chave: Coluna; rotulo: string; dica: string }> = [
  { chave: 'seguidores', rotulo: 'Seguidores', dica: 'Seguidores hoje' },
  { chave: 'crescimento30', rotulo: '30 dias', dica: 'Seguidores ganhos nos últimos 30 dias (desde que o perfil entrou aqui)' },
  { chave: 'postsSemana', rotulo: 'Posts/sem', dica: 'Posts por semana nos últimos 28 dias' },
  { chave: 'engajamentoMedio', rotulo: 'Engaj. médio', dica: 'Curtidas + comentários por post (últimos 28 dias)' },
  { chave: 'taxaMedia', rotulo: 'Taxa', dica: 'Engajamento médio ÷ seguidores' },
  { chave: 'reels', rotulo: 'Reels', dica: 'Parte dos posts em Reels/vídeo' },
  { chave: 'foraDaCurva', rotulo: 'Fora da curva', dica: 'Posts com 2× a mediana do perfil ou mais' },
]

function resumo(p: SmPerfilReferencia, posts: SmPostReferencia[]) {
  const dele = posts.filter(x => x.origem === 'PERFIL' && x.fonte === p.usuario)
  const reels = dele.length ? Math.round((dele.filter(x => x.video).length / dele.length) * 100) : null
  return { dele, reels, foraDaCurva: dele.filter(x => x.foraDaCurva).length }
}

/** Média do índice (engajamento ÷ mediana do perfil) por grupo: o que funciona para aquele perfil. */
function porGrupo(posts: SmPostReferencia[], chave: (p: SmPostReferencia) => string | null) {
  const m = new Map<string, number[]>()
  for (const p of posts) { const k = chave(p); if (k != null && p.indice != null) m.set(k, [...(m.get(k) ?? []), p.indice]) }
  return [...m].map(([k, l]) => ({ rotulo: k, valor: l.reduce((a, b) => a + b, 0) / l.length, n: l.length }))
}

export function Perfis({ dados, ocupado, acao, aoAbrir, aoSalvar }: {
  dados: SmReferencias
  ocupado: boolean
  acao: (fn: () => Promise<SmReferencias>, ok?: string) => Promise<boolean>
  aoAbrir: (p: SmPostReferencia) => void
  aoSalvar: (p: SmPostReferencia) => void
}) {
  const [novo, setNovo] = useState('')
  const [tipoNovo, setTipoNovo] = useState<'CONCORRENTE' | 'REFERENCIA'>('CONCORRENTE')
  const [filtro, setFiltro] = useState<'todos' | 'CONCORRENTE' | 'REFERENCIA'>('todos')
  const [ordem, setOrdem] = useState<Coluna>('engajamentoMedio')
  const [aberto, setAberto] = useState<string | null>(null)

  const linhas = useMemo(() => dados.perfis
    .filter(p => filtro === 'todos' || p.tipo === filtro || p.tipo === 'EU')
    .map(p => ({ p, ...resumo(p, dados.posts) }))
    .sort((a, b) => {
      const v = (x: typeof a) => (ordem === 'reels' ? x.reels : ordem === 'foraDaCurva' ? x.foraDaCurva : x.p[ordem]) ?? -Infinity
      return v(b) - v(a)
    }), [dados, filtro, ordem])
  const sel = linhas.find(l => l.p.id === aberto) ?? null
  const usados = dados.perfis.filter(p => p.tipo !== 'EU').length

  return (
    <div className="sm-ref-perfis">
      {dados.podeEditar && (
        <form className="sm-ref-novo" onSubmit={async e => { e.preventDefault(); if (await acao(() => proLaboreApi.sm.referencias.adicionarPerfil(novo, tipoNovo), 'Perfil adicionado.')) setNovo('') }}>
          <input className="sm-input" value={novo} onChange={e => setNovo(e.target.value)} placeholder="@perfil ou link do Instagram" aria-label="Perfil para acompanhar" data-novo-perfil-ref />
          <Segmentado rotulo="Tipo do perfil" valor={tipoNovo} aoMudar={setTipoNovo} opcoes={[{ valor: 'CONCORRENTE', rotulo: 'Concorrente' }, { valor: 'REFERENCIA', rotulo: 'Referência' }]} />
          <Botao type="submit" variante="pri" disabled={ocupado || !novo.trim() || usados >= dados.maxPerfis}>Acompanhar</Botao>
          <span className="sm-legenda">{usados} de {dados.maxPerfis} perfis</span>
          {dados.importaveis > 0 && <Botao variante="fantasma" disabled={ocupado} onClick={() => acao(() => proLaboreApi.sm.referencias.importarConcorrentes(), 'Concorrentes do Desempenho trazidos.')} data-importar-concorrentes>Trazer {dados.importaveis} concorrente{dados.importaveis > 1 ? 's' : ''} do Desempenho</Botao>}
        </form>
      )}
      {usados === 0 && <EstadoVazio titulo="Nenhum perfil acompanhado">Adicione as lojas concorrentes (para espionar o que postam e o que funciona) e os perfis que servem de inspiração. Precisam ser contas profissionais.</EstadoVazio>}
      {dados.perfis.length > 0 && (
        <>
          <div className="sm-ref-perfis-cab">
            <Segmentado rotulo="Mostrar" valor={filtro} aoMudar={setFiltro} opcoes={[{ valor: 'todos', rotulo: 'Todos' }, { valor: 'CONCORRENTE', rotulo: 'Concorrentes' }, { valor: 'REFERENCIA', rotulo: 'Referências' }]} />
            <span className="sm-legenda">Clique num perfil para ver o raio-x. Toque no título da coluna para ordenar.</span>
          </div>
          <div className="sm-card sm-tabela-rola">
            <table className="sm-tabela sm-ref-tabela" data-comparacao>
              <thead>
                <tr>
                  <th scope="col">Perfil</th>
                  {COLUNAS.map(c => (
                    <th key={c.chave} scope="col" aria-sort={ordem === c.chave ? 'descending' : 'none'} title={c.dica}>
                      <button type="button" className="sm-ref-ordenar" onClick={() => setOrdem(c.chave)} data-ordenar={c.chave}>{c.rotulo}{ordem === c.chave ? ' ↓' : ''}</button>
                    </th>
                  ))}
                  <th scope="col">Último post</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map(({ p, reels, foraDaCurva }) => (
                  <tr key={p.id} className={`${p.tipo === 'EU' ? 'eu' : ''} ${aberto === p.id ? 'ativo' : ''}`} data-linha-perfil={p.usuario}>
                    <td>
                      <button type="button" className="sm-ref-perfil-botao" onClick={() => setAberto(aberto === p.id ? null : p.id)} aria-expanded={aberto === p.id}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.fotoUrl ? <img className="sm-ref-foto" src={p.fotoUrl} alt="" /> : <span className="sm-ref-foto" aria-hidden="true">{p.usuario.slice(0, 1).toUpperCase()}</span>}
                        <span><b>@{p.usuario}</b><Chip tom={p.tipo === 'CONCORRENTE' ? 'bad' : p.tipo === 'EU' ? 'ok' : 'info'}>{TIPO_PERFIL[p.tipo]}</Chip></span>
                      </button>
                      {p.ultimoErro && <small className="sm-ref-erro">{p.ultimoErro}</small>}
                    </td>
                    <td>{num(p.seguidores)}</td>
                    <td>{sinal(p.crescimento30)}</td>
                    <td>{dec(p.postsSemana)}</td>
                    <td>{num(p.engajamentoMedio)}</td>
                    <td>{p.taxaMedia == null ? '—' : `${dec(p.taxaMedia, 2)}%`}</td>
                    <td>{reels == null ? '—' : `${reels}%`}</td>
                    <td>{foraDaCurva || '—'}</td>
                    <td>{p.ultimoPostEm ? haQuanto(p.ultimoPostEm) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {sel && <RaioX key={sel.p.id} p={sel.p} posts={sel.dele} dados={dados} ocupado={ocupado} acao={acao} aoAbrir={aoAbrir} aoSalvar={aoSalvar} aoFechar={() => setAberto(null)} />}
    </div>
  )
}

function RaioX({ p, posts, dados, ocupado, acao, aoAbrir, aoSalvar, aoFechar }: {
  p: SmPerfilReferencia; posts: SmPostReferencia[]; dados: SmReferencias; ocupado: boolean
  acao: (fn: () => Promise<SmReferencias>, ok?: string) => Promise<boolean>
  aoAbrir: (p: SmPostReferencia) => void; aoSalvar: (p: SmPostReferencia) => void; aoFechar: () => void
}) {
  const formatos = porGrupo(posts, x => (x.formato ? FORMATO[x.formato] : null)).sort((a, b) => b.valor - a.valor)
  const dias = porGrupo(posts, x => (x.publicadoEm ? DIAS[emBelem(x.publicadoEm).getUTCDay()] : null)).filter(d => d.n >= 2).sort((a, b) => b.valor - a.valor).slice(0, 4)
  const tags = new Map<string, number>()
  for (const x of posts) for (const t of hashtagsDe(x.legenda)) tags.set(t, (tags.get(t) ?? 0) + 1)
  const topTags = [...tags].sort((a, b) => b[1] - a[1]).slice(0, 10)
  const curva = posts.filter(x => x.foraDaCurva).sort((a, b) => (b.indice ?? 0) - (a.indice ?? 0))
  const melhores = [...posts].sort((a, b) => b.engajamento - a.engajamento)
  return (
    <section className="sm-card sm-ref-raiox" aria-label={`Raio-x de @${p.usuario}`} data-raiox={p.usuario}>
      <div className="sm-ref-painel-cab">
        <div>
          <h2 className="sm-h-card"><a href={`https://www.instagram.com/${p.usuario}/`} target="_blank" rel="noreferrer">@{p.usuario} ↗</a></h2>
          <span className="sm-legenda">{[p.nome, p.totalPosts != null ? `${num(p.totalPosts)} posts no perfil` : null, p.atualizadoEm ? `lido ${haQuanto(p.atualizadoEm)}` : 'ainda não lido'].filter(Boolean).join(' · ')}</span>
        </div>
        {dados.podeEditar && p.tipo !== 'EU' && (
          <>
            <Segmentado rotulo="Tipo" valor={p.tipo} aoMudar={v => acao(() => proLaboreApi.sm.referencias.tipoPerfil(p.id, v as 'CONCORRENTE' | 'REFERENCIA'), 'Tipo atualizado.')} desabilitado={ocupado}
              opcoes={[{ valor: 'CONCORRENTE', rotulo: 'Concorrente' }, { valor: 'REFERENCIA', rotulo: 'Referência' }]} />
            <Botao variante="fantasma" disabled={ocupado} onClick={() => acao(() => proLaboreApi.sm.referencias.removerPerfil(p.id), `@${p.usuario} saiu da lista.`)}>Parar de acompanhar</Botao>
          </>
        )}
        <Botao variante="fantasma" onClick={aoFechar}>Fechar</Botao>
      </div>
      {p.ultimoErro && <Banner tom="warn" titulo="Perfil">{p.ultimoErro}</Banner>}
      <div className="sm-ref-raiox-nums">
        <div><b>{num(p.seguidores)}</b><span>seguidores</span></div>
        <div><b>{sinal(p.crescimento7)}</b><span>em 7 dias</span></div>
        <div><b>{sinal(p.crescimento30)}</b><span>em 30 dias</span></div>
        <div><b>{dec(p.postsSemana)}</b><span>posts por semana</span></div>
        <div><b>{num(p.engajamentoMedio)}</b><span>engajamento médio</span></div>
        <div><b>{p.taxaMedia == null ? '—' : `${dec(p.taxaMedia, 2)}%`}</b><span>taxa de engajamento</span></div>
      </div>
      {posts.length > 0 && (
        <div className="sm-ref-raiox-grade">
          <div>
            <h3 className="sm-ref-h3">Formato que mais funciona</h3>
            <Barras rotulo="Índice médio por formato" itens={formatos.map((f, i) => ({ rotulo: f.rotulo, valor: f.valor, extra: `${f.n} posts`, destaque: i === 0 }))} formatar={v => `${dec(v)}×`} />
          </div>
          <div>
            <h3 className="sm-ref-h3">Melhores dias para postar</h3>
            {dias.length ? <Barras rotulo="Índice médio por dia" itens={dias.map((d, i) => ({ rotulo: d.rotulo, valor: d.valor, extra: `${d.n} posts`, destaque: i === 0 }))} formatar={v => `${dec(v)}×`} /> : <p className="sm-legenda">Poucos posts para comparar.</p>}
          </div>
          <div>
            <h3 className="sm-ref-h3">Hashtags que mais usa</h3>
            {topTags.length ? <div className="sm-ref-tags">{topTags.map(([t, n]) => <Chip key={t}>{t} · {n}</Chip>)}</div> : <p className="sm-legenda">Quase não usa hashtags.</p>}
          </div>
        </div>
      )}
      {curva.length > 0 && (
        <>
          <h3 className="sm-ref-h3">Fora da curva: o que bombou ({curva.length})</h3>
          <GradePosts posts={curva} podeEditar={dados.podeEditar} aoAbrir={aoAbrir} aoSalvar={aoSalvar} />
        </>
      )}
      <h3 className="sm-ref-h3">Todos os posts lidos, do melhor para o pior ({posts.length})</h3>
      <GradePosts posts={melhores} podeEditar={dados.podeEditar} aoAbrir={aoAbrir} aoSalvar={aoSalvar} numerar vazio={<EstadoVazio titulo="Sem posts ainda">Toque em &quot;Atualizar agora&quot; ou espere a leitura automática do dia.</EstadoVazio>} />
    </section>
  )
}
