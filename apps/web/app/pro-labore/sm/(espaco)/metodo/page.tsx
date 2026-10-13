'use client'

// Método do Social Media: a cadência (três posts, três vezes ao dia: Topo,
// Meio e Fundo de manhã, à tarde e à noite), a escada do desejo (do
// conhecido ao idolatrado) e a hierarquia das métricas (do centro para fora).
// A cadência vem das pautas e dos posts publicados; o degrau da escada é o
// gestor quem marca; as métricas vêm do Desempenho, filtradas pelo papel.
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { proLaboreApi, type SmDesempenho, type SmDiaCadencia, type SmEtapaFunil, type SmMetodo, type SmPostCadencia } from '@/lib/proLaboreApi'
import { Banner, BarraProgresso, Botao, BotaoLink, Card, CardEsqueleto, Chip, ETAPA_MISSAO, ETAPA_ROTULO, EstadoVazio, FORMATO_ROTULO, Rotulo, Segmentado, TURNO_ROTULO, useToast } from '../../_ui'
import { useEspacoSM } from '../EspacoSM'
import { periodoDoPreset, type PresetPeriodo } from '../../../(painel)/social-media/_componentes/FiltroPeriodo'
import { Hierarquia } from './Hierarquia'

const ETAPAS: SmEtapaFunil[] = ['TOPO', 'MEIO', 'FUNDO']
const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const diaSemana = (iso: string) => SEMANA[new Date(`${iso}T12:00:00Z`).getUTCDay()]

export default function MetodoPage() {
  const { pode } = useEspacoSM()
  const [dados, setDados] = useState<SmMetodo | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const carregar = useCallback(() => {
    proLaboreApi.sm.metodo.ver().then(d => { setDados(d); setErro(null) }).catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível carregar agora.'))
  }, [])
  useEffect(() => { if (pode('producao')) carregar() }, [carregar, pode])

  if (!pode('producao')) return <div className="sm-card"><EstadoVazio titulo="Sem acesso ao método">O gestor pode liberar o módulo Produção em Equipe → Acessos e permissões.</EstadoVazio></div>

  return (
    <>
      <header className="sm-pagina-cab">
        <div>
          <Rotulo>Trabalho · Método</Rotulo>
          <h1 className="sm-ttl sm-h1">Cadência, escada do desejo e métricas</h1>
          <p>O jeito de trabalhar o perfil: o que postar em cada turno, onde a marca está na escada e em que ordem ler os números.</p>
        </div>
      </header>
      {erro && <p className="sm-erro" role="alert">{erro}</p>}
      {!dados && !erro && <><CardEsqueleto linhas={6} texto="Abrindo o método" /><CardEsqueleto linhas={4} /></>}
      {dados && (
        <div className="sm-metodo">
          <Cadencia c={dados.cadencia} souGestor={dados.souGestor} podeEditar={dados.podeEditarPauta} aoMudar={carregar} />
          <QuatroQuatroQuatro />
          <Escada e={dados.escada} souGestor={dados.souGestor} aoSalvar={escada => setDados(d => d && { ...d, escada })} />
          {pode('analise') ? <HierarquiaDoPeriodo /> : (
            <Card titulo="A hierarquia das métricas"><EstadoVazio titulo="Sem acesso à análise">O gestor pode liberar o módulo Análise para ver os números na ordem do método.</EstadoVazio></Card>
          )}
          <blockquote className="sm-metodo-citacao">“A gente não precisa de ego, precisa dominar a frequência para formar a opinião do cara.”</blockquote>
        </div>
      )}
    </>
  )
}

// ---------- Cadência ----------

function Cadencia({ c, souGestor, podeEditar, aoMudar }: { c: SmMetodo['cadencia']; souGestor: boolean; podeEditar: boolean; aoMudar: () => void }) {
  const toast = useToast()
  const [escolhido, setEscolhido] = useState(c.hoje)
  const dia = c.dias.find(d => d.data === escolhido) ?? c.dias.find(d => d.hoje)!
  const { preenchidos, total, diasCompletos } = c.aderencia7d
  const pct = total > 0 ? preenchidos / total : 0
  async function aplicar() {
    try { await proLaboreApi.sm.metodo.aplicarCadencia(); toast({ mensagem: `Regras do Calendário: até ${c.postsDiaMetodo} posts por dia.` }); aoMudar() } catch (e) { toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível salvar', tom: 'bad' }) }
  }
  return (
    <Card rotulo="Cadência" titulo={<>Três posts, <span className="sm-metodo-acento">três vezes ao dia</span></>}
      subtitulo="Topo, Meio e Fundo de manhã, à tarde e à noite. Cada vaga é ocupada por uma pauta agendada ou um post publicado.">
      {c.maxPostsDiaRegra < c.postsDiaMetodo && (
        <Banner tom="info" titulo={`As regras do Calendário ainda pedem no máximo ${c.maxPostsDiaRegra} ${c.maxPostsDiaRegra === 1 ? 'post' : 'posts'} por dia`}
          acao={souGestor ? <Botao onClick={aplicar}>Usar {c.postsDiaMetodo} por dia</Botao> : undefined}>
          {souGestor ? 'Com a cadência do método, dias com 9 posts deixam de aparecer como rajada.' : 'O gestor pode alinhar as regras com a cadência do método.'}
        </Banner>
      )}

      <div className="sm-cad-dias" role="group" aria-label="Escolher o dia">
        {c.dias.map(d => (
          <button key={d.data} type="button" className={`sm-cad-dia${d.data === dia.data ? ' sel' : ''}${d.hoje ? ' hoje' : ''}`} aria-pressed={d.data === dia.data}
            onClick={() => setEscolhido(d.data)} aria-label={`${diaSemana(d.data)} ${ddmm(d.data)}: ${d.preenchidos} de 9 vagas`}>
            <span className="sm-cad-dia-ttl">{d.hoje ? 'Hoje' : diaSemana(d.data)}</span>
            <span className="sm-cad-dia-num sm-mono">{ddmm(d.data)}</span>
            <MiniGrade d={d} />
            <span className="sm-cad-dia-num sm-num">{d.preenchidos}/9</span>
          </button>
        ))}
      </div>

      <GradeDoDia dia={dia} podeEditar={podeEditar} />

      <div className="sm-cad-rodape">
        <BarraProgresso rotulo="Últimos 7 dias" valor={preenchidos} max={total} texto={`${preenchidos} de ${total} vagas`} tom={pct >= 0.8 ? 'ok' : pct >= 0.5 ? 'warn' : 'bad'} />
        <span className="sm-legenda">{diasCompletos === 0 ? 'Nenhum dia com as 9 vagas ocupadas na última semana.' : `${diasCompletos} ${diasCompletos === 1 ? 'dia completo' : 'dias completos'} (9 de 9) na última semana.`} Pauta sem etapa marcada entra pela etapa do pilar: Educação no Topo, Bastidores e Prova social no Meio, Estoque no Fundo.</span>
      </div>
    </Card>
  )
}

function MiniGrade({ d }: { d: SmDiaCadencia }) {
  return (
    <span className="sm-cad-mini" aria-hidden="true">
      {d.turnos.flatMap(t => ETAPAS.map(e => <i key={`${t.turno}${e}`} className={t.etapas[e].length > 0 ? 'on' : ''} />))}
    </span>
  )
}

function GradeDoDia({ dia, podeEditar }: { dia: SmDiaCadencia; podeEditar: boolean }) {
  return (
    <div className="sm-cad-grade-rola">
      <table className="sm-cad-grade">
        <caption className="sm-sr">Vagas de {ddmm(dia.data)} por turno e etapa</caption>
        <thead>
          <tr>
            <th scope="col"><span className="sm-sr">Turno</span></th>
            {ETAPAS.map(e => (
              <th key={e} scope="col">
                <span className={`sm-cad-bola e-${e.toLowerCase()}`}>{ETAPA_ROTULO[e]}</span>
                <span className="sm-cad-missao">{ETAPA_MISSAO[e].titulo}<small>{ETAPA_MISSAO[e].chamada}</small></span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dia.turnos.map((t, i) => (
            <tr key={t.turno}>
              <th scope="row"><span className="sm-mono">0{i + 1}</span> {TURNO_ROTULO[t.turno]}</th>
              {ETAPAS.map(e => (
                <td key={e} className={t.etapas[e].length > 0 ? 'cheia' : 'vazia'} data-etapa={`${ETAPA_ROTULO[e]} · ${ETAPA_MISSAO[e].titulo.toLowerCase()}`}>
                  {t.etapas[e].length > 0 ? t.etapas[e].map(p => <PostNaVaga key={p.id} p={p} />) : (
                    <span className="sm-cad-livre">{dia.passado ? 'Ficou vazia' : 'Vaga livre'}
                      {!dia.passado && podeEditar && <Link href="/pro-labore/sm/producao?nova=1" className="sm-cad-planejar">Planejar</Link>}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {dia.turnos.some(t => t.semEtapa.length > 0) && (
        <p className="sm-legenda" style={{ margin: '8px 0 0' }}>
          Publicados direto no Instagram, sem pauta (sem etapa): {dia.turnos.flatMap(t => t.semEtapa.map(p => `${p.hora} ${FORMATO_ROTULO[p.formato]}`)).join(' · ')}
        </p>
      )}
    </div>
  )
}

function PostNaVaga({ p }: { p: SmPostCadencia }) {
  return (
    <div className="sm-cad-post">
      <span className="sm-mono">{p.hora}</span> {p.tipo === 'PAUTA' ? <Link href={`/pro-labore/sm/producao?pauta=${p.id}`}>{p.titulo}</Link> : p.titulo}
      <div className="sm-cad-post-tags">
        <Chip>{FORMATO_ROTULO[p.formato]}</Chip>
        {p.status === 'PUBLICADO' ? <Chip tom="ok">Publicado</Chip> : <Chip tom="info">Agendado</Chip>}
        {p.estimada && <Chip titulo="Etapa estimada pelo pilar da pauta">pelo pilar</Chip>}
      </div>
    </div>
  )
}

const MISSOES_444: Array<{ titulo: string; etapa: SmEtapaFunil }> = [
  { titulo: 'Que eu existo', etapa: 'TOPO' }, { titulo: 'Quem eu sou', etapa: 'MEIO' }, { titulo: 'O que eu faço', etapa: 'MEIO' }, { titulo: 'O que eu vendo', etapa: 'FUNDO' },
]

function QuatroQuatroQuatro() {
  return (
    <Card rotulo="Variação 4-4-4" titulo={<>No perfil pessoal: <span className="sm-metodo-acento">4-4-4</span></>}
      subtitulo="Quatro posts, cada um com uma missão. A sequência se repete três vezes por dia.">
      <div className="sm-cad-grade-rola">
        <table className="sm-444">
          <thead>
            <tr><th scope="col"><Rotulo>Para saberem</Rotulo></th>{MISSOES_444.map(m => <th key={m.titulo} scope="col">{m.titulo}<small>{ETAPA_ROTULO[m.etapa]}</small></th>)}</tr>
          </thead>
          <tbody>
            {['1ª rodada', '2ª rodada', '3ª rodada'].map(r => (
              <tr key={r}><th scope="row">{r}</th>{MISSOES_444.map(m => <td key={m.titulo}><span className={`sm-cad-ponto e-${m.etapa.toLowerCase()}`} aria-label={`${m.titulo} (${ETAPA_ROTULO[m.etapa]})`} /></td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sm-metodo-destaque">São 12 posts por dia, mas conteúdo novo só três.</p>
    </Card>
  )
}

// ---------- Escada do desejo ----------

function Escada({ e, souGestor, aoSalvar }: { e: SmMetodo['escada']; souGestor: boolean; aoSalvar: (e: SmMetodo['escada']) => void }) {
  const toast = useToast()
  const [editando, setEditando] = useState(false)
  const [degrau, setDegrau] = useState<number | null>(e.atual)
  const [nota, setNota] = useState(e.nota ?? '')
  const [salvando, setSalvando] = useState(false)
  async function salvar() {
    setSalvando(true)
    try {
      const r = await proLaboreApi.sm.metodo.escada(degrau, nota.trim() || null)
      aoSalvar(r); setEditando(false); toast({ mensagem: 'Degrau da escada salvo.' })
    } catch (err) { toast({ mensagem: err instanceof Error ? err.message : 'Não foi possível salvar', tom: 'bad' }) } finally { setSalvando(false) }
  }
  const atual = e.degraus.find(d => d.n === e.atual)
  const proximo = e.degraus.find(d => d.n === (e.atual ?? 0) + 1)
  return (
    <Card rotulo="Escada do desejo" titulo={<>A escada <span className="sm-metodo-acento">do desejo</span></>} subtitulo="Do conhecido ao idolatrado: onde a marca está hoje e qual é o próximo degrau."
      acoes={souGestor && !editando ? <Botao onClick={() => { setDegrau(e.atual); setNota(e.nota ?? ''); setEditando(true) }}>{e.atual ? 'Mudar o degrau' : 'Marcar o degrau'}</Botao> : undefined}>
      <div className="sm-escada">
        <ol className="sm-escada-lista">
          {[...e.degraus].reverse().map(d => (
            <li key={d.n} className={d.n === e.atual ? 'atual' : e.atual && d.n < e.atual ? 'feito' : ''}>
              <span className="sm-escada-n sm-mono">0{d.n}</span>
              <div><b>{d.nome}</b>{d.n === e.atual && <Chip tom="info">Hoje</Chip>}<span className="sm-legenda">{d.texto}</span></div>
            </li>
          ))}
        </ol>
        <div className="sm-escada-degraus" aria-hidden="true">
          {e.degraus.map(d => (
            <span key={d.n} className={d.n === e.atual ? 'atual' : e.atual && d.n < e.atual ? 'feito' : ''} style={{ height: `${(d.n / 6) * 100}%` }}>
              {d.n === e.atual && <i className="sm-escada-marca">Hoje</i>}
            </span>
          ))}
        </div>
      </div>
      {!editando && (atual
        ? <p className="sm-escada-resumo">Hoje: <b>{atual.nome}</b>{proximo ? <> · próximo degrau: <b>{proximo.nome}</b> ({proximo.texto.replace(/\.$/, '').toLowerCase()})</> : ' · topo da escada: cuidado para o herói não virar vilão'}.{e.nota && <><br /><span className="sm-legenda">{e.nota}</span></>}</p>
        : <p className="sm-legenda" style={{ margin: 0 }}>{souGestor ? 'Marque o degrau em que a marca está hoje para a equipe trabalhar o próximo.' : 'O gestor ainda não marcou em que degrau a marca está.'}</p>)}
      {editando && (
        <form className="sm-escada-form" onSubmit={ev => { ev.preventDefault(); salvar() }}>
          <Segmentado rotulo="Degrau atual" className="sm-escada-seg" valor={String(degrau ?? '')} aoMudar={v => setDegrau(v ? Number(v) : null)}
            opcoes={[...e.degraus.map(d => ({ valor: String(d.n), rotulo: d.nome })), { valor: '', rotulo: 'Sem degrau' }]} />
          <label className="sm-campo">Por que esse degrau (opcional)
            <textarea className="sm-input" rows={2} maxLength={500} value={nota} onChange={ev => setNota(ev.target.value)} placeholder="Ex.: já nos reconhecem pela revisão completa; falta virar referência de opinião." />
          </label>
          <div className="sm-linha-acoes" style={{ justifyContent: 'flex-end' }}>
            <Botao onClick={() => setEditando(false)}>Cancelar</Botao>
            <Botao type="submit" variante="pri" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar degrau'}</Botao>
          </div>
        </form>
      )}
    </Card>
  )
}

// ---------- Hierarquia das métricas ----------

type PresetMetodo = Exclude<PresetPeriodo, 'custom'>
const PERIODOS: ReadonlyArray<{ valor: PresetMetodo; rotulo: string }> = [{ valor: '7d', rotulo: '7 dias' }, { valor: '30d', rotulo: '30 dias' }, { valor: '90d', rotulo: '90 dias' }]

function HierarquiaDoPeriodo() {
  const { eu } = useEspacoSM()
  const [preset, setPreset] = useState<PresetMetodo>('30d')
  const [carregada, setCarregada] = useState<{ preset: PresetMetodo; d: SmDesempenho } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    let ativo = true
    proLaboreApi.sm.desempenho(periodoDoPreset(preset))
      .then(d => { if (ativo) { setCarregada({ preset, d }); setErro(null) } })
      .catch(e => { if (ativo) setErro(e instanceof Error ? e.message : 'Não foi possível carregar.') })
    return () => { ativo = false }
  }, [preset])
  const d = carregada?.d
  return (
    <Card rotulo="Hierarquia das métricas" titulo={<>A hierarquia <span className="sm-metodo-acento">das métricas</span></>}
      subtitulo="A ordem em que o perfil é lido, do centro para fora. Primeiro o que vende; seguidores por último."
      acoes={<Segmentado rotulo="Período" opcoes={PERIODOS} valor={preset} aoMudar={setPreset} />}>
      {erro && <p className="sm-erro" role="alert">{erro}</p>}
      {!d && !erro && <CardEsqueleto linhas={4} />}
      {d && !d.conectado && <EstadoVazio titulo="Instagram não conectado" acao={eu.visao === 'GESTOR' && !eu.verComo ? <BotaoLink href="/pro-labore/social-media">Conectar a conta</BotaoLink> : undefined}>Os números aparecem quando a conta da empresa estiver conectada.</EstadoVazio>}
      {d?.conectado && (
        <div className={carregada?.preset !== preset ? 'sm-recarregando' : undefined}>
          <Hierarquia metricas={d.hierarquia} legenda="Leads, MQL e vendas: só os que vieram do Instagram (MQL = chegou a Negociação ou além no CRM). Encaminhamentos: envios dos posts publicados no período." />
        </div>
      )}
    </Card>
  )
}
