'use client'

// PDF 04 · 4.2 Hoje por papel: a tela inicial de cada pessoa. Cabeçalho com a
// pergunta do papel, três números do dicionário, a fila de ação na ordem
// aprovada e a Lente do ARIES; o supervisor ganha o quadro da equipe e o dono,
// o painel por área. Nada aqui executa sozinho: cada item leva à ação.
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { bussolaApi, proLaboreApi, telasApi, type BussolaHoje, type HojeDados, type PainelHoje, type ItemFilaHoje, type LinhaQuadro } from '@/lib/proLaboreApi'
import { BussolaPorArea, FraseDoDia, ResumoCurto } from './Bussola'
import { CartaoRitmo, GraficosOperacao, LinhaKpis, montarKpis } from './PainelHoje'
import { Cabecalho, Detalhes, Lente, TelaVazia, fmtValor, useTelas } from '../_padrao/Padrao'
import { FraseDoDono } from './FraseDoDono'
import { Daily } from './Daily'
import { PainelDoDono } from './PainelDoDono'
import { DashboardAntigo } from '../_dashboard/DashboardAntigo'

// Ajuste 1: o Hoje do dono (e do supervisor) tem três sub-abas: Hoje · Daily · Painel.
type Sub = 'hoje' | 'daily' | 'painel'
const SUBS: Array<{ valor: Sub; rotulo: string }> = [{ valor: 'hoje', rotulo: 'Hoje' }, { valor: 'daily', rotulo: 'Daily' }, { valor: 'painel', rotulo: 'Painel' }]

export default function HojePage() {
  const [papel, setPapel] = useState<string | null>(null)
  const [sub, setSub] = useState<Sub>(() => {
    const q = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('sub')
    return q === 'daily' || q === 'painel' ? q : 'hoje'
  })
  function trocar(s: Sub) {
    setSub(s)
    const url = new URL(window.location.href)
    if (s === 'hoje') url.searchParams.delete('sub'); else url.searchParams.set('sub', s)
    window.history.replaceState(null, '', url.toString())
  }
  const comSubs = papel === 'DONO' || papel === 'SUPERVISOR'
  return (
    <div data-hoje-subabas={comSubs ? sub : undefined}>
      {comSubs && (
        <div className="pl-sv-tabs" role="tablist" aria-label="Partes do Hoje" style={{ marginBottom: 12 }} data-subabas-hoje>
          {SUBS.map(x => <button key={x.valor} type="button" role="tab" aria-selected={sub === x.valor} className={sub === x.valor ? 'ativo' : ''} onClick={() => trocar(x.valor)} data-subaba={x.valor}>{x.rotulo}</button>)}
        </div>
      )}
      {(!comSubs || sub === 'hoje') && <HojeDoPapel aoCarregar={setPapel} />}
      {comSubs && sub === 'daily' && <Daily papel={papel!} />}
      {comSubs && sub === 'painel' && <PainelComGraficos papel={papel!} />}
    </div>
  )
}

// O Painel no visual de sempre (todos os gráficos do Dashboard, a Jornada com 10 etapas) e, recolhido no fim,
// o Painel detalhado do Ajuste 1 (filtros por SDR, origem e forma de pagamento; ranking de SDRs; séries do dicionário).
function PainelComGraficos({ papel }: { papel: string }) {
  const [detalhado, setDetalhado] = useState(false)
  return (
    <div data-painel-graficos>
      <DashboardAntigo comoPainel />
      <div style={{ marginTop: 20 }}>
        <button type="button" className="pl-btn" onClick={() => setDetalhado(d => !d)} aria-expanded={detalhado} data-abrir-detalhado>{detalhado ? 'Fechar o Painel detalhado' : 'Painel detalhado: filtros por SDR, origem e forma de pagamento'}</button>
        {detalhado && <div style={{ marginTop: 12 }}><PainelDoDono papel={papel} /></div>}
      </div>
    </div>
  )
}

function HojeDoPapel({ aoCarregar }: { aoCarregar: (papel: string) => void }) {
  const [d, setD] = useState<HojeDados | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const carregar = useCallback(() => { telasApi.hoje().then(x => { setD(x); setErro(null); aoCarregar(x.papel) }).catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível carregar')) }, [aoCarregar])
  useEffect(() => { carregar() }, [carregar])
  // PDF 06: frase do dia, resumo do ARIES e bússola por área (chamada separada: calcula as áreas).
  const [b, setB] = useState<BussolaHoje | null>(null)
  const [atualizando, setAtualizando] = useState(false)
  const carregarBussola = useCallback((atualizar = false) => { setAtualizando(atualizar); bussolaApi.carregar(atualizar).then(setB).catch(() => undefined).finally(() => setAtualizando(false)) }, [])
  useEffect(() => { bussolaApi.carregar().then(setB).catch(() => undefined) }, [])
  // Painel de comando: dados dos gráficos (ritmo do mês, tendências, funil, equipe, origem).
  const [pg, setPg] = useState<PainelHoje | null>(null)
  useEffect(() => { bussolaApi.painel().then(setPg).catch(() => undefined) }, [])
  if (erro) return <TelaVazia titulo="Não deu para montar o seu Hoje agora">{erro}</TelaVazia>
  if (!d) return <p className="pl-hint">Montando o seu Hoje…</p>
  const ficha = { nome: 'Hoje', pergunta: d.pergunta, paraQuem: d.nomePapel, acaoPrincipal: 'Executar a próxima atividade' }
  const proxima = d.fila.find(i => i.acao && !i.extensao)
  return (
    <div data-hoje={d.papel}>
      {d.papel === 'DONO' && <FraseDoDono />}
      {b && <FraseDoDia frase={b.frase} />}
      <Cabecalho aba={ficha} acao={proxima?.acao?.href ? <Link className="pl-btn pl-btn-primary ar-acao-principal" href={proxima.acao.href} data-acao-principal>Fazer a próxima: {proxima.acao.rotulo}</Link> : undefined} />
      <div className="ar-tela">
        <div className="ar-trabalho">
          <LinhaKpis kpis={montarKpis(d.papel, d.numeros, b, pg)} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 12, marginBottom: 16 }} data-topo-painel>
            {pg ? <CartaoRitmo p={pg} papel={d.papel} /> : <div className="pl-card pl-hint">Montando o ritmo do mês…</div>}
            {b ? <ResumoCurto d={b} atualizando={atualizando} aoAtualizar={() => carregarBussola(true)} /> : <div className="pl-card pl-hint" data-resumo-carregando>O ARIES está montando o resumo do dia…</div>}
          </div>
          {b && <BussolaPorArea d={b} aoMudar={() => undefined} series={pg?.series} />}
          {pg && <GraficosOperacao p={pg} papel={d.papel} />}
          <div className="pl-card-title" style={{ margin: '4px 0 8px' }} data-titulo-fila>O que depende de mim{d.fila.length ? ` · ${d.fila.filter(i => !i.extensao).length}` : ''}</div>
          {d.papel === 'SOCIAL_MEDIA'
            ? <TelaVazia titulo="Seu Hoje fica no espaço do Social Media" passo={<Link className="pl-btn pl-btn-primary" href="/pro-labore/sm">Abrir o meu espaço</Link>}>Pautas do dia, aprovações pedidas e Directs sem resposta estão lá.</TelaVazia>
            : <Fila itens={d.fila} aoMudar={carregar} />}
          {d.quadro && <QuadroEquipe linhas={d.quadro} aoMudar={carregar} />}
          <Detalhes titulo="Como a fila é ordenada">
            <ol style={{ margin: 0, paddingLeft: 18 }}>{d.ordemFila.map(g => <li key={g.grupo}>{g.nome}</li>)}</ol>
            <p className="pl-hint" style={{ marginBottom: 0 }}>Os números vêm do dicionário de métricas (toque em um número para ver a ficha). Atualizado às {new Date(d.geradoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.</p>
          </Detalhes>
        </div>
        <Lente aba="hoje" dados={d.lente} aoMudar={carregar} />
      </div>
    </div>
  )
}

function Fila({ itens, aoMudar }: { itens: ItemFilaHoje[]; aoMudar: () => void }) {
  if (!itens.length) return <TelaVazia titulo="Fila limpa por agora">Quando um cliente esperar resposta, uma visita estiver marcada ou uma atividade vencer, ela aparece aqui, na ordem do que importa primeiro.</TelaVazia>
  const grupos: Array<{ nome: string; itens: ItemFilaHoje[] }> = []
  for (const i of itens) { const g = grupos.find(x => x.nome === i.grupoNome); if (g) g.itens.push(i); else grupos.push({ nome: i.grupoNome, itens: [i] }) }
  return (
    <section aria-label="Fila de ação" data-fila>
      {grupos.map(g => (
        <div key={g.nome} data-fila-grupo={g.itens[0].grupo}>
          <div className="ar-fila-grupo">{g.nome} · {g.itens.length}</div>
          <ul className="ar-fila">{g.itens.slice(0, 12).map((i, k) => <ItemFila key={`${i.grupo}-${i.ref?.id ?? k}`} i={i} aoMudar={aoMudar} />)}</ul>
          {g.itens.length > 12 && <p className="pl-hint">+ {g.itens.length - 12} no mesmo grupo</p>}
        </div>
      ))}
    </section>
  )
}

function ItemFila({ i, aoMudar }: { i: ItemFilaHoje; aoMudar: () => void }) {
  const { registrarAcao } = useTelas()
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  async function confirmar() {
    setMsg(null)
    try {
      if (i.acao?.tipo === 'PASSAR_AO_VENDEDOR' && i.ref) await proLaboreApi.jornada.acao(i.ref.id, 'passar', { resumo: texto })
      else if (i.acao?.tipo === 'CONCLUIR_ATV' && i.ref) await telasApi.concluirAtividade(i.ref.id, texto)
      registrarAcao(`hoje:${i.acao?.tipo ?? 'acao'}`)
      setAberto(false); aoMudar()
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível') }
  }
  const botao = i.extensao ? <span className="pl-hint">Ponto de extensão</span>
    : i.acao?.tipo === 'LINK' || i.acao?.tipo === 'REC' ? <Link className="pl-btn" href={i.acao.href ?? i.href ?? '#'} onClick={() => registrarAcao('hoje:link')}>{i.acao.rotulo}</Link>
      : i.acao ? <button type="button" className="pl-btn pl-btn-primary" onClick={() => setAberto(a => !a)} data-acao-fila={i.acao.tipo}>{i.acao.rotulo}</button> : null
  return (
    <li className={`ar-fila-item${i.extensao ? ' ar-extensao' : ''}`} data-item-fila={i.grupo}>
      <div className="ar-fila-texto" style={{ flex: 1 }}>
        <div className="ar-fila-titulo">{i.href && !i.extensao ? <Link href={i.href}>{i.titulo}</Link> : i.titulo}</div>
        <div className="ar-fila-det">{i.detalhe}</div>
        {aberto && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <input className="pl-input" style={{ flex: 1, minWidth: 180 }} value={texto} onChange={e => setTexto(e.target.value)} placeholder={i.acao?.tipo === 'PASSAR_AO_VENDEDOR' ? 'Resumo para o vendedor (o que o cliente quer)' : 'Resultado (o que foi feito)'} aria-label="Resumo ou resultado" />
            <button type="button" className="pl-btn pl-btn-primary" onClick={() => void confirmar()}>Confirmar</button>
            {i.href && <Link className="pl-btn" href={i.href}>Abrir</Link>}
          </div>
        )}
        {msg && <div className="pl-hint" role="alert">{msg}{i.href ? <> · <Link href={i.href}>abrir no lugar de origem</Link></> : null}</div>}
      </div>
      {!aberto && botao}
    </li>
  )
}

function QuadroEquipe({ linhas, aoMudar }: { linhas: LinhaQuadro[]; aoMudar: () => void }) {
  const { registrarAcao } = useTelas()
  const [acao, setAcao] = useState<{ tipo: 'REDISTRIBUIR' | 'REPRIORIZAR' | 'INTERVIR' | 'PLANO'; pessoa: LinhaQuadro } | null>(null)
  const [para, setPara] = useState(''), [texto, setTexto] = useState(''), [atvId, setAtvId] = useState(''), [prazo, setPrazo] = useState('')
  const [atvs, setAtvs] = useState<Array<{ id: string; codigo: string | null; oQueFazer: string | null; prazo: string }>>([])
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => { if (acao?.tipo === 'REPRIORIZAR' || acao?.tipo === 'REDISTRIBUIR') telasApi.equipeAtividades(acao.pessoa.id).then(setAtvs).catch(() => setAtvs([])) }, [acao])
  async function enviar() {
    if (!acao) return
    setMsg(null)
    try {
      const r = await telasApi.acaoSupervisor(acao.tipo === 'REDISTRIBUIR' ? { acao: 'REDISTRIBUIR', de: acao.pessoa.id, para, ...(atvId ? { atividadeId: atvId } : {}) }
        : acao.tipo === 'REPRIORIZAR' ? { acao: 'REPRIORIZAR', atividadeId: atvId, prazo: prazo ? new Date(prazo).toISOString() : '' }
          : { acao: acao.tipo, vendedorId: acao.pessoa.id, texto })
      registrarAcao(`equipe:${acao.tipo}`)
      setMsg(r.redistribuidas != null ? `${r.redistribuidas} atividade(s) redistribuída(s).` : r.repriorizadas ? 'Prazo ajustado.' : `Atividade ${r.atividade?.codigo ?? ''} criada.`)
      setAcao(null); setTexto(''); setAtvId(''); setPara(''); aoMudar()
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível') }
  }
  return (
    <section style={{ marginTop: 20 }} aria-label="Quadro da equipe" data-quadro-equipe>
      <div className="ar-fila-grupo">Quadro da equipe</div>
      <div style={{ overflowX: 'auto' }}>
        <table className="pl-table ar-quadro">
          <thead><tr><th>Pessoa</th><th>Ritmo contra a meta</th><th>Tempo de resposta</th><th>Atrasadas</th><th /></tr></thead>
          <tbody>{linhas.map(p => (
            <tr key={p.id} data-pessoa-fora={p.foraDoPadrao ? 'sim' : 'nao'}>
              <td><b>{p.nome}</b><div className="pl-hint">{p.papel}{p.foraDoPadrao ? ' · fora do próprio padrão' : ''}</div></td>
              <td className={p.ritmo.valor != null && p.ritmo.valor < 80 ? 'ar-fora' : ''}>{p.ritmo.valor != null ? `${p.ritmo.valor}%` : '—'}<div className="pl-hint">{p.ritmo.rotulo}</div></td>
              <td className={p.tempoResposta.fora ? 'ar-fora' : ''}>{fmtValor(p.tempoResposta.valor, 'MIN')}<div className="pl-hint">padrão {fmtValor(p.tempoResposta.padrao, 'MIN')}</div></td>
              <td className={p.atrasadas.fora ? 'ar-fora' : ''}>{p.atrasadas.valor ?? '—'}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <select className="pl-input" style={{ width: 'auto', padding: '3px 6px' }} value="" onChange={e => { if (e.target.value) setAcao({ tipo: e.target.value as 'REDISTRIBUIR', pessoa: p }) }} aria-label={`Ação para ${p.nome}`} data-acao-equipe={p.id}>
                  <option value="">Agir…</option><option value="REDISTRIBUIR">Redistribuir</option><option value="REPRIORIZAR">Repriorizar</option><option value="INTERVIR">Intervir</option><option value="PLANO">Criar plano de ação</option>
                </select>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {acao && (
        <div className="pl-card" style={{ marginTop: 10 }} data-form-acao={acao.tipo}>
          <b>{acao.tipo === 'REDISTRIBUIR' ? 'Redistribuir' : acao.tipo === 'REPRIORIZAR' ? 'Repriorizar' : acao.tipo === 'INTERVIR' ? 'Intervir' : 'Criar plano de ação'} · {acao.pessoa.nome}</b>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {(acao.tipo === 'REDISTRIBUIR' || acao.tipo === 'REPRIORIZAR') && (
              <select className="pl-input" style={{ width: 'auto' }} value={atvId} onChange={e => setAtvId(e.target.value)} aria-label="Atividade">
                <option value="">{acao.tipo === 'REDISTRIBUIR' ? 'Todas as atrasadas' : 'Escolha a atividade'}</option>
                {atvs.map(a => <option key={a.id} value={a.id}>{a.codigo} · {(a.oQueFazer ?? '').slice(0, 50)}</option>)}
              </select>
            )}
            {acao.tipo === 'REDISTRIBUIR' && (
              <select className="pl-input" style={{ width: 'auto' }} value={para} onChange={e => setPara(e.target.value)} aria-label="Para quem">
                <option value="">Para quem…</option>{linhas.filter(x => x.id !== acao.pessoa.id).map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
              </select>
            )}
            {acao.tipo === 'REPRIORIZAR' && <input className="pl-input" style={{ width: 'auto' }} type="datetime-local" value={prazo} onChange={e => setPrazo(e.target.value)} aria-label="Novo prazo" />}
            {(acao.tipo === 'INTERVIR' || acao.tipo === 'PLANO') && <input className="pl-input" style={{ flex: 1, minWidth: 220 }} value={texto} onChange={e => setTexto(e.target.value)} placeholder={acao.tipo === 'INTERVIR' ? 'O que você vai fazer' : 'O plano, em uma frase'} aria-label="Descrição" />}
            <button type="button" className="pl-btn pl-btn-primary" onClick={() => void enviar()}>Confirmar</button>
            <button type="button" className="pl-btn" onClick={() => setAcao(null)}>Cancelar</button>
          </div>
          <p className="pl-hint" style={{ margin: '6px 0 0' }}>Toda ação fica registrada na auditoria.</p>
        </div>
      )}
      {msg && <p className="pl-hint" role="status">{msg}</p>}
    </section>
  )
}
