'use client'

// Referências (benchmark e espionagem): os posts públicos do Instagram dos
// concorrentes, dos perfis de inspiração e das hashtags de cada moto do
// estoque, num lugar só para filtrar, comparar, tirar padrões e guardar o
// que vale copiar (e virar pauta). A régua é curtidas + comentários: o
// Instagram não informa visualizações nem alcance de outras contas.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { proLaboreApi, type SmPostReferencia, type SmReferenciaSalva, type SmReferencias } from '@/lib/proLaboreApi'
import { Banner, Botao, CardEsqueleto, Chip, EstadoVazio, KpiCard, Modal, Rotulo, Segmentado, haQuanto, useToast } from '../../_ui'
import { useEspacoSM } from '../EspacoSM'
import { PainelPost, num, quem } from './comum'
import { Explorar, FILTROS_INICIAIS, GradePosts, type Filtros } from './Explorar'
import { Insights } from './Insights'
import { Perfis } from './Perfis'
import { Salvos } from './Salvos'

type Aba = 'explorar' | 'motos' | 'perfis' | 'insights' | 'salvos'

function Hashtags({ chave, hashtags, podeEditar, aoSalvar }: { chave: string; hashtags: string[]; podeEditar: boolean; aoSalvar: (lista: string[]) => Promise<boolean> }) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(hashtags.map(h => `#${h}`).join(' '))
  if (!editando) {
    return (
      <span className="sm-ref-tags">
        {hashtags.map(h => <Chip key={h}>#{h}</Chip>)}
        {podeEditar && <button type="button" className="sm-link-botao" onClick={() => setEditando(true)} data-editar-hashtags={chave}>editar</button>}
      </span>
    )
  }
  return (
    <form className="sm-ref-tags-form" onSubmit={async e => { e.preventDefault(); if (await aoSalvar(texto.split(/[\s,]+/).filter(Boolean))) setEditando(false) }}>
      <input className="sm-input" value={texto} onChange={e => setTexto(e.target.value)} placeholder="#cg160 #hondacg160" aria-label="Hashtags da moto (até 3)" data-hashtags-input />
      <Botao type="submit" variante="pri">Salvar</Botao>
      <Botao variante="fantasma" onClick={() => setEditando(false)}>Cancelar</Botao>
    </form>
  )
}

export default function ReferenciasPage() {
  const { pode } = useEspacoSM()
  const toast = useToast()
  const [dados, setDados] = useState<SmReferencias | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aba, setAba] = useState<Aba>('explorar')
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAIS)
  const [moto, setMoto] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [agora] = useState(() => Date.now())
  // O post aberto: guarda só o id (do post ou do salvo), para refletir as mudanças.
  const [aberto, setAberto] = useState<{ mediaId: string; postId: string | null } | null>(null)

  const carregar = useCallback(() => {
    proLaboreApi.sm.referencias.ver().then(d => { setDados(d); setErro(null) }).catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível carregar agora.'))
  }, [])
  useEffect(() => { if (pode('producao')) carregar() }, [carregar, pode])

  const acao = useCallback(async (fn: () => Promise<SmReferencias>, ok?: string) => {
    setOcupado(true)
    try { setDados(await fn()); if (ok) toast({ mensagem: ok }); return true }
    catch (e) { toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível concluir', tom: 'bad' }); return false }
    finally { setOcupado(false) }
  }, [toast])

  // "Atualizar agora": cada rodada tem tempo limitado; continua sozinho enquanto faltar moto ou perfil e houver progresso.
  const [rodada, setRodada] = useState(0)
  const atualizarTudo = async () => {
    setOcupado(true)
    try {
      for (let i = 1; i <= 6; i++) {
        setRodada(i)
        const r = await proLaboreApi.sm.referencias.atualizar()
        setDados(r)
        if (!r.rodada.pendentes || r.rodada.motos + r.rodada.perfis === 0) break
      }
      toast({ mensagem: 'Referências atualizadas.' })
    } catch (e) { toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível atualizar', tom: 'bad' }) }
    finally { setOcupado(false); setRodada(0) }
  }
  const salvar = (p: SmPostReferencia, nota?: string) => acao(() => proLaboreApi.sm.referencias.salvar(p.id, nota ?? null), 'Referência salva em "Salvos".')
  const criarPauta = async (salvoId: string) => {
    setOcupado(true)
    try {
      const r = await proLaboreApi.sm.referencias.criarPauta(salvoId)
      setDados(r)
      toast({ mensagem: 'Pauta criada na Produção (Ideias). A referência foi para "Para gravar".' })
    } catch (e) { toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível criar a pauta', tom: 'bad' }) }
    finally { setOcupado(false) }
  }
  const abrirPost = (p: SmPostReferencia) => setAberto({ mediaId: p.mediaId, postId: p.id })
  const abrirSalvo = (s: SmReferenciaSalva) => setAberto({ mediaId: s.mediaId, postId: null })

  const kpis = useMemo(() => {
    if (!dados) return null
    const semEu = dados.posts.filter(p => !(p.origem === 'PERFIL' && dados.perfis.find(x => x.usuario === p.fonte)?.tipo === 'EU'))
    const mes = agora - 30 * 864e5
    return {
      posts: semEu.length,
      curva: semEu.filter(p => p.foraDaCurva && p.publicadoEm && Date.parse(p.publicadoEm) >= mes).length,
      concorrentes: dados.perfis.filter(p => p.tipo === 'CONCORRENTE').length,
      referencias: dados.perfis.filter(p => p.tipo === 'REFERENCIA').length,
      ideias: dados.salvos.filter(s => s.status === 'IDEIA').length,
      gravar: dados.salvos.filter(s => s.status === 'GRAVAR').length,
      lido: dados.perfis.reduce<string | null>((u, p) => (p.atualizadoEm && (!u || p.atualizadoEm > u) ? p.atualizadoEm : u), null),
    }
  }, [dados, agora])

  if (!pode('producao')) return <div className="sm-card"><EstadoVazio titulo="Sem acesso às referências">O gestor pode liberar o módulo Produção em Equipe → Acessos e permissões.</EstadoVazio></div>
  const motoAtual = dados?.motos.find(m => m.chave === moto) ?? dados?.motos[0] ?? null
  // Por moto: só o que a busca do Instagram achou sobre o modelo (os perfis acompanhados ficam no Explorar e no raio-x).
  const postsDaMoto = motoAtual && dados ? dados.posts.filter(p => p.motoChave === motoAtual.chave && p.origem === 'HASHTAG') : []
  const postAberto = aberto && dados ? (aberto.postId ? dados.posts.find(p => p.id === aberto.postId) : null) ?? dados.posts.find(p => p.mediaId === aberto.mediaId) ?? null : null
  const salvoAberto = aberto && dados ? dados.salvos.find(s => s.mediaId === aberto.mediaId) ?? null : null

  return (
    <>
      <header className="sm-pagina-cab">
        <div>
          <Rotulo>Trabalho · Referências</Rotulo>
          <h1 className="sm-ttl sm-h1">Referências e concorrentes</h1>
          <p>O que os concorrentes e os melhores perfis estão postando, o que engaja nas hashtags de cada moto do estoque e o que vale copiar. Atualiza sozinho todo dia.</p>
        </div>
        {dados?.podeEditar && dados.disponivel && <Botao variante="sec" disabled={ocupado} onClick={atualizarTudo} data-atualizar-referencias>{rodada ? `Buscando… (${rodada}ª rodada)` : 'Atualizar agora'}</Botao>}
      </header>
      {erro && <p className="sm-erro" role="alert">{erro}</p>}
      {!dados && !erro && <CardEsqueleto linhas={6} texto="Buscando as referências" />}
      {dados && !dados.disponivel && (
        <Banner tom="warn" titulo="Conecte o Instagram da loja pela empresa (Meta)">A busca de posts públicos usa a API do Instagram ligada à página do Facebook da loja. O gestor conecta em Social Media → Conexão.</Banner>
      )}
      {dados && dados.disponivel && kpis && (
        <div className="sm-ref">
          <div className="sm-ref-kpis">
            <KpiCard rotulo="Posts monitorados" valor={num(kpis.posts)} legenda={`${dados.perfis.filter(p => p.tipo !== 'EU').length} perfis · ${dados.motos.length} motos`} />
            <KpiCard rotulo="Fora da curva (30 dias)" valor={num(kpis.curva)} legenda="2× a média da fonte ou mais" />
            <KpiCard rotulo="Concorrentes" valor={num(kpis.concorrentes)} legenda={`${kpis.referencias} referências de inspiração`} />
            <KpiCard rotulo="Salvos" valor={num(kpis.ideias + kpis.gravar)} legenda={`${kpis.ideias} ideias · ${kpis.gravar} para gravar`} />
            <KpiCard rotulo="Hashtags na semana" valor={`${dados.hashtagsSemana.usadas}/${dados.hashtagsSemana.limite}`} legenda={kpis.lido ? `perfis lidos ${haQuanto(kpis.lido)}` : 'limite do Instagram'} />
          </div>
          <p className="sm-legenda sm-ref-nota">
            Régua: <b>engajamento</b> (curtidas + comentários) e o <b>índice</b>, que compara cada post com a mediana da própria fonte (2× = o dobro do normal daquele perfil). O Instagram não informa visualizações nem alcance de posts de outras contas.
          </p>
          <Segmentado rotulo="Referências" valor={aba} aoMudar={setAba} className="sm-ref-abas" opcoes={[
            { valor: 'explorar', rotulo: 'Explorar' },
            { valor: 'motos', rotulo: `Por moto (${dados.motos.length})` },
            { valor: 'perfis', rotulo: `Perfis e concorrentes (${dados.perfis.filter(p => p.tipo !== 'EU').length})` },
            { valor: 'insights', rotulo: 'O que funciona' },
            { valor: 'salvos', rotulo: `Salvos (${dados.salvos.length})` },
          ]} />

          {aba === 'explorar' && <Explorar dados={dados} filtros={filtros} setFiltros={setFiltros} aoAbrir={abrirPost} aoSalvar={p => salvar(p)} />}

          {aba === 'motos' && (dados.motos.length === 0 ? (
            <EstadoVazio titulo="Nenhuma moto no estoque">Cadastre as motos em Estoque: cada modelo ganha as suas referências.</EstadoVazio>
          ) : (
            <div className="sm-ref-grade">
              <nav className="sm-ref-motos" aria-label="Motos do estoque">
                {dados.motos.map(m => (
                  <button key={m.chave} type="button" className={`sm-ref-moto ${motoAtual?.chave === m.chave ? 'ativo' : ''}`} onClick={() => setMoto(m.chave)} data-moto-ref={m.chave}>
                    <b>{m.nome}</b>
                    <span>{m.posts ? `${m.posts} posts · melhor ${num(m.melhor)}` : m.buscadoEm ? 'nada encontrado' : 'aguardando busca'}{m.quantidade > 1 ? ` · ${m.quantidade} no estoque` : ''}</span>
                  </button>
                ))}
              </nav>
              {motoAtual && (
                <section className="sm-card sm-ref-painel" aria-label={motoAtual.nome}>
                  <div className="sm-ref-painel-cab">
                    <h2 className="sm-h-card">{motoAtual.nome}</h2>
                    <Hashtags key={motoAtual.chave + motoAtual.hashtags.join()} chave={motoAtual.chave} hashtags={motoAtual.hashtags} podeEditar={dados.podeEditar} aoSalvar={lista => acao(() => proLaboreApi.sm.referencias.salvarHashtags(motoAtual.chave, lista), 'Hashtags salvas: a moto entra na próxima busca.')} />
                    <span className="sm-legenda">{motoAtual.buscadoEm ? `Buscado ${haQuanto(motoAtual.buscadoEm)}` : 'Ainda não buscado'}</span>
                    {postsDaMoto.length > 0 && <button type="button" className="sm-link-botao" onClick={() => { setFiltros({ ...FILTROS_INICIAIS, moto: motoAtual.chave, fonte: 'hashtags' }); setAba('explorar') }}>Filtrar no Explorar</button>}
                  </div>
                  {motoAtual.fontes.some(f => f.em) && (
                    <p className="sm-legenda" data-fontes-moto>
                      O Instagram devolveu: {motoAtual.fontes.map(f => `#${f.h} ${f.n == null ? (f.em ? '(buscada)' : '(na próxima busca)') : `${f.n} posts`}`).join(' · ')}.
                      {motoAtual.fontes.some(f => f.n === 0) && ' Hashtag com 0 posts quase não é usada: troque por outra em "editar".'}
                    </p>
                  )}
                  {motoAtual.ultimoErro && <Banner tom="warn" titulo="Busca da moto">{motoAtual.ultimoErro}</Banner>}
                  <GradePosts key={motoAtual.chave} posts={postsDaMoto} podeEditar={dados.podeEditar} aoAbrir={abrirPost} aoSalvar={p => salvar(p)} numerar
                    vazio={<EstadoVazio titulo="Sem posts ainda">{motoAtual.buscadoEm ? 'O Instagram não devolveu posts nas hashtags desta moto: troque as hashtags em "editar" (ex.: a do modelo com o ano ou com a marca).' : 'Toque em "Atualizar agora" ou espere a busca automática do dia.'}</EstadoVazio>} />
                </section>
              )}
            </div>
          ))}

          {aba === 'perfis' && <Perfis dados={dados} ocupado={ocupado} acao={acao} aoAbrir={abrirPost} aoSalvar={p => salvar(p)} />}
          {aba === 'insights' && <Insights dados={dados} aoAbrir={abrirPost} />}
          {aba === 'salvos' && (
            <Salvos dados={dados} ocupado={ocupado} aoAbrir={abrirSalvo} aoPauta={s => criarPauta(s.id)}
              aoStatus={(s, status) => acao(() => proLaboreApi.sm.referencias.atualizarSalvo(s.id, { status }))}
              aoRemover={s => acao(() => proLaboreApi.sm.referencias.removerSalvo(s.id), 'Referência tirada dos salvos.')} />
          )}
        </div>
      )}
      {dados && aberto && (postAberto || salvoAberto) && (
        <Modal largo titulo={quem((postAberto ?? salvoAberto)!)} aoFechar={() => setAberto(null)}>
          <PainelPost key={aberto.mediaId} p={(postAberto ?? salvoAberto)!} salvo={salvoAberto} dados={dados} podeEditar={dados.podeEditar} ocupado={ocupado}
            aoSalvar={nota => { if (postAberto) salvar(postAberto, nota) }}
            aoNota={nota => { if (salvoAberto) acao(() => proLaboreApi.sm.referencias.atualizarSalvo(salvoAberto.id, { nota }), 'Anotação salva.') }}
            aoPauta={async () => {
              if (salvoAberto) return criarPauta(salvoAberto.id)
              if (!postAberto) return
              const r = await proLaboreApi.sm.referencias.salvar(postAberto.id).catch(() => null)
              const s = r?.salvos.find(x => x.mediaId === postAberto.mediaId)
              if (s) await criarPauta(s.id)
            }} />
        </Modal>
      )}
    </>
  )
}
