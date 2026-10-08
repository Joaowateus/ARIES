'use client'

// Tela 05 · Desempenho (seção 8, protótipo Desempenho.html). No topo, os
// sinais que o Instagram mais pesa, consistência, funil até a venda,
// diagnóstico dos reels e o teste em andamento; embaixo, as seções da aba
// Social Media do painel (com as correções da seção 17), as mesmas da
// análise do gestor, filtradas pelo que o papel pode ver.
import { useEffect, useState } from 'react'
import { proLaboreApi, type AnaliseSocialConectada, type OrigemSocial, type SmDesempenho, type SmReelDiagnostico, type SmSinal } from '@/lib/proLaboreApi'
import { AssistenteAba, Banner, Botao, BotaoLink, CardEsqueleto, Chip, EstadoVazio, KpiCard, Modal, Rotulo, Segmentado, useToast } from '../../_ui'
import { useEspacoSM } from '../EspacoSM'
import { CartaoTeste } from './Testes'
import { periodoDoPreset, type Periodo, type PresetPeriodo } from '../../../(painel)/social-media/_componentes/FiltroPeriodo'
import { KpisSocial } from '../../../(painel)/social-media/_componentes/KpisSocial'
import { EvolucaoDiaria } from '../../../(painel)/social-media/_componentes/EvolucaoDiaria'
import { ComposicaoInteracoes } from '../../../(painel)/social-media/_componentes/ComposicaoInteracoes'
import { RadarImpacto } from '../../../(painel)/social-media/_componentes/RadarImpacto'
import { LequeDiasSemana } from '../../../(painel)/social-media/_componentes/LequeDiasSemana'
import { MapaCalorHorarios, SeguidoresOnline } from '../../../(painel)/social-media/_componentes/Horarios'
import { CrescimentoSeguidores } from '../../../(painel)/social-media/_componentes/CrescimentoSeguidores'
import { FormatosComparativo, OrigemAlcance } from '../../../(painel)/social-media/_componentes/Formatos'
import { CalendarioPublicacoes, TabelaPublicacoes, TopPublicacoes } from '../../../(painel)/social-media/_componentes/Publicacoes'
import { Audiencia } from '../../../(painel)/social-media/_componentes/Audiencia'
import { HashtagsELegendas, ReelsEStories } from '../../../(painel)/social-media/_componentes/Conteudo'

type Conectado = Extract<SmDesempenho, { conectado: true }>
type Sub = 'visao' | 'conteudo' | 'horarios' | 'crescimento' | 'publicacoes'

const PRESETS: ReadonlyArray<{ valor: PresetPeriodo; rotulo: string }> = [
  { valor: 'hoje', rotulo: 'Hoje' }, { valor: '7d', rotulo: '7 dias' }, { valor: 'semana', rotulo: 'Esta semana' }, { valor: '30d', rotulo: '30 dias' },
  { valor: 'mes', rotulo: 'Este mês' }, { valor: 'mes-anterior', rotulo: 'Mês passado' }, { valor: '90d', rotulo: '90 dias' }, { valor: 'custom', rotulo: 'Personalizado' },
]
const ORIGENS: ReadonlyArray<{ valor: OrigemSocial; rotulo: string }> = [{ valor: 'ORGANICO', rotulo: 'Orgânico' }, { valor: 'PAGO', rotulo: 'Pago' }, { valor: 'TOTAL', rotulo: 'Total' }]
const SUBS: ReadonlyArray<{ valor: Sub; rotulo: string }> = [
  { valor: 'visao', rotulo: 'Visão geral' }, { valor: 'conteudo', rotulo: 'Conteúdo' }, { valor: 'horarios', rotulo: 'Quando postar' },
  { valor: 'crescimento', rotulo: 'Crescimento e audiência' }, { valor: 'publicacoes', rotulo: 'Todas as publicações' },
]
const VEREDITO: Record<SmReelDiagnostico['veredito'], { texto: string; tom: 'ok' | 'bad' | 'warn' }> = {
  REPETIR: { texto: 'Repetir estrutura', tom: 'ok' }, BOM: { texto: 'Bom', tom: 'ok' }, GANCHO_FRACO: { texto: 'Gancho fraco', tom: 'bad' }, ABAIXO: { texto: 'Abaixo', tom: 'warn' },
}

const dec = (v: number, casas = 1) => v.toLocaleString('pt-BR', { maximumFractionDigits: casas })
const inteiro = (v: number) => v.toLocaleString('pt-BR')
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
/** Fração como %, sem nunca mostrar "0,0%" para um valor que não é zero (seção 12). */
function pctFracao(v: number | null): string {
  if (v == null) return '—'
  const x = v * 100
  if (x === 0) return '0%'
  if (x < 0.05) return '< 0,1%'
  return `${dec(x)}%`
}

export default function DesempenhoPage() {
  const { pode, eu } = useEspacoSM()
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoDoPreset('30d'))
  const [origem, setOrigem] = useState<OrigemSocial>('ORGANICO')
  const [sub, setSub] = useState<Sub>('visao')
  const [carregada, setCarregada] = useState<{ chave: string; dados: SmDesempenho } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [metasAbertas, setMetasAbertas] = useState(false)
  const [versao, setVersao] = useState(0)

  const chave = `${periodo.inicio}|${periodo.fim}|${origem}|${versao}`
  useEffect(() => {
    if (!pode('analise')) return
    let ativo = true
    proLaboreApi.sm.desempenho(periodo, origem)
      .then(d => { if (ativo) { setCarregada({ chave, dados: d }); setErro(null) } })
      .catch(e => { if (ativo) setErro(e instanceof Error ? e.message : 'Não foi possível carregar agora. Tente de novo em instantes.') })
    return () => { ativo = false }
  }, [chave, periodo, origem, pode])

  if (!pode('analise')) return <div className="sm-card"><EstadoVazio titulo="Sem acesso à análise">O gestor pode liberar o módulo Análise em Equipe → Acessos e permissões.</EstadoVazio></div>

  const dados = carregada?.dados
  const recarregando = !!carregada && carregada.chave !== chave

  return (
    <>
      <header className="sm-pagina-cab">
        <div>
          <Rotulo>Resultado · Desempenho · {ddmm(periodo.inicio)} a {ddmm(periodo.fim)}</Rotulo>
          <h1 className="sm-ttl sm-h1">Os sinais que o Instagram mais pesa</h1>
          <p>Retenção, envios e curtidas por alcance. Orgânico e pago sempre separados.</p>
        </div>
        <Segmentado rotulo="Origem do alcance" opcoes={ORIGENS} valor={origem} aoMudar={setOrigem} />
      </header>
      <AssistenteAba aba="desempenho" aoMudar={() => setVersao(v => v + 1)} />

      <div className="sm-desemp-periodo">
        <Segmentado rotulo="Período" opcoes={PRESETS} valor={periodo.preset} aoMudar={p => setPeriodo(p === 'custom' ? { ...periodo, preset: 'custom' } : periodoDoPreset(p))} />
        {periodo.preset === 'custom' && (
          <div className="sm-desemp-datas">
            <label className="sm-campo">De<input className="sm-input" type="date" value={periodo.inicio} max={periodo.fim} onChange={e => e.target.value && setPeriodo({ ...periodo, inicio: e.target.value })} /></label>
            <label className="sm-campo">Até<input className="sm-input" type="date" value={periodo.fim} min={periodo.inicio} onChange={e => e.target.value && setPeriodo({ ...periodo, fim: e.target.value })} /></label>
          </div>
        )}
        {dados?.conectado && <span className="sm-legenda">Comparado com {ddmm(dados.periodo.anteriorInicio)} a {ddmm(dados.periodo.anteriorFim)}</span>}
      </div>

      {erro && <p className="sm-erro" role="alert">{erro}</p>}
      {!dados && !erro && <><CardEsqueleto linhas={2} /><div className="sm-grade">{[0, 1, 2, 3, 4, 5].map(i => <CardEsqueleto key={i} linhas={2} />)}</div></>}
      {dados && !dados.conectado && <div className="sm-card"><EstadoVazio titulo="Instagram não conectado" acao={eu.visao === 'GESTOR' && !eu.verComo ? <BotaoLink href="/pro-labore/social-media" variante="pri">Conectar a conta da empresa</BotaoLink> : undefined}>{eu.visao === 'GESTOR' && !eu.verComo ? 'Conecte a conta da empresa para ver o desempenho com os números do Instagram.' : 'O gestor conecta a conta da empresa na aba Social Media do painel.'}</EstadoVazio></div>}
      {dados?.conectado && (
        <div className={recarregando ? 'sm-desemp sm-recarregando' : 'sm-desemp'} aria-busy={recarregando}>
          <BannerQualidadeSM q={dados.qualidade} />
          {origem !== 'ORGANICO' && <p className="sm-legenda" style={{ margin: 0 }}>{dados.origem.temPago ? `${dados.origem.postsImpulsionados} ${dados.origem.postsImpulsionados === 1 ? 'post usado' : 'posts usados'} em anúncio no período; o pago vem do Tráfego.` : 'Nenhum post usado em anúncio no período.'}</p>}

          <section aria-label="Sinais de distribuição" className="sm-grade sm-desemp-sinais">
            {dados.sinais.map(s => <CartaoSinal key={s.chave} s={s} />)}
          </section>
          {dados.souGestor && <div><Botao variante="fantasma" onClick={() => setMetasAbertas(true)}>Editar metas dos sinais</Botao></div>}

          <div className="sm-desemp-par">
            <ConsistenciaSM c={dados.consistencia} />
            <FunilSM f={dados.funil} dias={dados.periodo.dias} />
          </div>

          <DiagnosticoReels reels={dados.reelsDiagnostico} podeSalvarGancho={pode('producao', 'COMPLETO') && !eu.somenteLeitura} />

          <CartaoTeste teste={dados.testeEmAndamento} podeCriar={dados.podeCriarTeste} aoMudar={() => setVersao(v => v + 1)} />

          <section className="sm-desemp-completa" aria-label="Análise completa">
            <div className="sm-desemp-completa-cab">
              <h2 className="sm-h-card">Análise completa</h2>
              <Segmentado rotulo="Seções da análise" opcoes={SUBS} valor={sub} aoMudar={setSub} />
            </div>
            <AnaliseCompleta dados={dados} sub={sub} recarregando={recarregando} />
          </section>
        </div>
      )}
      {metasAbertas && dados?.conectado && <MetasSinais metas={dados.metas} aoFechar={() => setMetasAbertas(false)} aoSalvar={() => { setMetasAbertas(false); setVersao(v => v + 1) }} />}
    </>
  )
}

function BannerQualidadeSM({ q }: { q: Conectado['qualidade'] }) {
  if (q.status === 'completo') {
    return <Banner tom="ok" titulo="Dados completos">{q.diasSincronizados} de {q.diasPeriodo} dias sincronizados · {q.storiesCapturados} {q.storiesCapturados === 1 ? 'story capturado' : 'stories capturados'} · sem lacunas que afetem as comparações</Banner>
  }
  const dias = q.diasSemDados.map(ddmm)
  const lista = dias.length > 8 ? `${dias.slice(0, 8).join(', ')} e mais ${dias.length - 8}` : dias.join(', ')
  return (
    <Banner tom="warn" titulo={q.status === 'grave' ? `Dados incompletos: ${q.diasSemDados.length} de ${q.diasPeriodo} dias sem sincronização` : `${q.diasSemDados.length} ${q.diasSemDados.length === 1 ? 'dia' : 'dias'} sem sincronização`}>
      Sem dados em {lista}. {q.status === 'grave' ? 'Mais de 20% do período faltando: as comparações e os insights de alta e queda ficam suspensos.' : 'As comparações com o período anterior podem estar afetadas.'} {q.storiesCapturados} {q.storiesCapturados === 1 ? 'story capturado' : 'stories capturados'}.
    </Banner>
  )
}

function CartaoSinal({ s }: { s: SmSinal }) {
  const valor = s.valor == null ? '—' : s.unidade === '%' ? `${dec(s.valor)}%` : dec(s.valor, 2)
  const chip = s.status === 'ok' ? { tom: 'ok' as const, texto: `Dentro · ${s.metaTexto}` }
    : s.status === 'atencao' ? { tom: 'bad' as const, texto: `Fora · ${s.metaTexto}` }
      : s.status === 'informativo' ? { tom: 'info' as const, texto: 'Informativo' }
        : { tom: 'neutro' as const, texto: s.metaTexto ? `Sem dados · ${s.metaTexto}` : 'Sem dados' }
  return <KpiCard rotulo={s.rotulo} valor={valor} unidade={s.valor != null && s.unidade === 'por mil' ? 'por mil' : undefined} chip={chip} legenda={s.texto} />
}

/** Cor por posts no dia (seção 8): 0 · 1 a 2 · 3 a 4 · mais de 4 (rajada). */
function classeConsistencia(n: number): string {
  return n === 0 ? 'c0' : n <= 2 ? 'c1' : n <= 4 ? 'c2' : 'c3'
}

function ConsistenciaSM({ c }: { c: Conectado['consistencia'] }) {
  const primeiro = c.dias[0] ? new Date(`${c.dias[0].data}T12:00:00Z`).getUTCDay() : 1
  const vazios = (primeiro + 6) % 7
  const abaixo = c.diasComPost < c.metaDiasPeriodo || c.maiorIntervalo > c.maxDiasSemPost
  return (
    <section className="sm-card sm-desemp-meio" aria-label="Consistência">
      <div className="sm-card-cab">
        <h2 className="sm-h-card">Consistência</h2>
        <Chip tom={abaixo ? 'bad' : 'ok'}>{abaixo ? 'Abaixo da meta' : 'Dentro da meta'}</Chip>
      </div>
      <div className="sm-cons-grade" role="img" aria-label={`${c.diasComPost} de ${c.diasNoPeriodo} dias com post. Maior intervalo: ${c.maiorIntervalo} dias.`}>
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => <span key={d} className="sm-mono">{d}</span>)}
        {Array.from({ length: vazios }, (_, i) => <span key={`v${i}`} />)}
        {c.dias.map(d => (
          <span key={d.data} className={`sm-cons-cel ${d.futuro ? 'futuro' : classeConsistencia(d.posts)}`} title={`${ddmm(d.data)}: ${d.futuro ? 'ainda não chegou' : `${d.posts} ${d.posts === 1 ? 'post' : 'posts'}`}`}>
            {Number(d.data.slice(8, 10))}{d.posts > 0 ? ` · ${d.posts}` : ''}
          </span>
        ))}
      </div>
      <div className="sm-cons-numeros">
        <div><b className="sm-num">{c.diasComPost} <small>/ {c.diasNoPeriodo}</small></b><span>dias com post (meta {c.metaDiasPeriodo})</span></div>
        <div><b className={`sm-num${c.maiorIntervalo > c.maxDiasSemPost ? ' ruim' : ''}`}>{c.maiorIntervalo} {c.maiorIntervalo === 1 ? 'dia' : 'dias'}</b><span>maior intervalo (máx. {c.maxDiasSemPost})</span></div>
        <div><b className={`sm-num${c.pico && c.pico.posts > c.maxPostsPorDia ? ' ruim' : ''}`}>{c.pico?.posts ?? 0}</b><span>{c.pico ? `posts em ${ddmm(c.pico.data)}` : 'pico de posts num dia'}</span></div>
      </div>
    </section>
  )
}

function FunilSM({ f, dias }: { f: Conectado['funil']; dias: number }) {
  const etapas: Array<{ rotulo: string; valor: number | null; motivo?: string | null }> = [
    { rotulo: 'Alcance único', valor: f.alcanceUnico, motivo: f.alcanceUnicoMotivo },
    { rotulo: 'Visitas ao perfil', valor: f.visitasPerfil },
    { rotulo: 'Conversas iniciadas', valor: f.conversasIniciadas, motivo: f.conversasMotivo },
    { rotulo: 'Leads no CRM', valor: f.leads, motivo: f.leads == null ? 'Sem acesso ao CRM.' : null },
    { rotulo: 'Vendas', valor: f.vendas, motivo: f.vendas == null ? 'Sem acesso a vendas.' : null },
  ]
  const topo = Math.max(1, ...etapas.map(e => e.valor ?? 0))
  let anterior: number | null = null
  return (
    <section className="sm-card sm-desemp-meio" aria-label="Funil do Instagram até a venda">
      <h2 className="sm-h-card">Funil do Instagram até a venda</h2>
      {etapas.map(e => {
        // Etapa maior que a anterior (ex.: leads cadastrados sem passar pelo direct): sem taxa, com a explicação.
        const razao = e.valor != null && anterior ? e.valor / anterior : null
        const taxa = razao != null && razao <= 1 ? pctFracao(razao) : null
        const acima = razao != null && razao > 1
        if (e.valor != null) anterior = e.valor
        return (
          <div key={e.rotulo} className="sm-funil-etapa">
            <div className="sm-atrib-par"><span>{e.rotulo}</span><span className="sm-num"><b>{e.valor != null ? inteiro(e.valor) : '—'}</b>{taxa && <small> {taxa}</small>}</span></div>
            <div className="sm-atrib-trilho"><span style={{ width: `${e.valor ? Math.max(2, Math.sqrt(e.valor / topo) * 100) : 0}%`, background: 'var(--sm-data-blue)' }} /></div>
            {e.valor == null && e.motivo && <span className="sm-legenda">{e.motivo}</span>}
            {acima && <span className="sm-legenda">Maior que a etapa anterior: parte chegou por outros caminhos (ex.: cadastro direto no CRM).</span>}
          </div>
        )
      })}
      <p className="sm-legenda" style={{ margin: 0 }}>
        Alcance único dos {dias} dias, não a soma diária. Conversas = direct + WhatsApp vindos de links rastreados{f.conversasIniciadas != null ? ` (${f.conversasMotivo.replace(/\.$/, '')})` : ''}. Barras em escala de raiz para as etapas pequenas aparecerem.
      </p>
    </section>
  )
}

function DiagnosticoReels({ reels, podeSalvarGancho }: { reels: SmReelDiagnostico[]; podeSalvarGancho: boolean }) {
  const { pode, eu } = useEspacoSM()
  const [salvando, setSalvando] = useState<SmReelDiagnostico | null>(null)
  return (
    <section id="reels" className="sm-card" aria-label="Diagnóstico dos reels">
      <div className="sm-card-cab">
        <h2 className="sm-h-card">Diagnóstico dos reels</h2>
        <Rotulo>Gancho = pulo nos 3 primeiros segundos</Rotulo>
      </div>
      {reels.length === 0 ? <EstadoVazio titulo="Nenhum reel no período" acao={pode('producao', 'COMPLETO') && !eu.somenteLeitura ? <BotaoLink href="/pro-labore/sm/producao?nova=1">Planejar um reel</BotaoLink> : undefined}>O diagnóstico aparece quando houver reels com métricas. Um reel nesta semana já entra na conta.</EstadoVazio> : (
        <div className="sm-tabela-rola">
          <table className="sm-tabela" style={{ minWidth: 720 }}>
            <thead><tr><th scope="col">Reel</th><th scope="col">Duração</th><th scope="col">Retenção</th><th scope="col">Pulo 3s</th><th scope="col">Envios / mil</th><th scope="col">vs. mediana</th><th scope="col">Veredito</th>{podeSalvarGancho && <th scope="col"><span className="sm-sr">Biblioteca</span></th>}</tr></thead>
            <tbody>
              {reels.map(r => (
                <tr key={r.id}>
                  <td><div className="sm-atrib-nome">{r.permalink ? <a href={r.permalink} target="_blank" rel="noreferrer">{r.nome}</a> : r.nome}</div><div className="sm-legenda">{ddmm(r.publicadoEm.slice(0, 10))} · {inteiro(r.alcance)} alcançados</div></td>
                  <td>{r.duracaoSeg != null ? `${Math.round(r.duracaoSeg)}s` : '—'}</td>
                  <td>{pctFracao(r.retencao)}</td>
                  <td>{pctFracao(r.pulo)}</td>
                  <td>{r.enviosMil != null ? dec(r.enviosMil, 2) : '—'}</td>
                  <td>{r.multiplo != null ? `${dec(r.multiplo)}×` : '—'}</td>
                  <td><Chip tom={VEREDITO[r.veredito].tom}>{VEREDITO[r.veredito].texto}</Chip></td>
                  {podeSalvarGancho && <td>{(r.veredito === 'REPETIR' || r.veredito === 'BOM') && <Botao variante="fantasma" onClick={() => setSalvando(r)}>Salvar gancho</Botao>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="sm-legenda" style={{ margin: 0 }}>Repetir estrutura: 2,5× a mediana de 90 dias e pulo abaixo de 40%. Bom: 1,3× ou mais. Gancho fraco: pulo de 60% ou mais.</p>
      {salvando && <SalvarGancho reel={salvando} aoFechar={() => setSalvando(null)} />}
    </section>
  )
}

function AnaliseCompleta({ dados, sub, recarregando }: { dados: Conectado; sub: Sub; recarregando: boolean }) {
  // As seções antigas leem só os campos de análise; leads, vendas e R$ já vêm filtrados pelo papel.
  const analise = dados as unknown as AnaliseSocialConectada
  return (
    <div className="pl-sv-grid sm-desemp-legado">
      {sub === 'visao' && (
        <>
          <KpisSocial analise={analise} />
          <div className="pl-sv-grid pl-sv-grid-2">
            <EvolucaoDiaria serie={analise.serie} serieAnterior={analise.serieAnterior} recarregando={recarregando} />
            <ComposicaoInteracoes composicao={analise.composicaoInteracoes} recarregando={recarregando} />
          </div>
        </>
      )}
      {sub === 'conteudo' && (
        <>
          <RadarImpacto posts={analise.publicacoes} medianaReferencia={analise.radar.medianaReferencia} diasReferencia={analise.radar.diasReferencia} periodo={analise.periodo} recarregando={recarregando} />
          <div className="pl-sv-grid pl-sv-grid-2">
            <FormatosComparativo porFormato={analise.porFormato} recarregando={recarregando} />
            <OrigemAlcance distribuicao={analise.distribuicaoAlcance} recarregando={recarregando} />
          </div>
          <TopPublicacoes posts={analise.publicacoes} recarregando={recarregando} />
          <HashtagsELegendas analise={analise} recarregando={recarregando} />
          <ReelsEStories analise={analise} recarregando={recarregando} />
        </>
      )}
      {sub === 'horarios' && (
        <>
          <div className="pl-sv-grid pl-sv-grid-2-eq">
            <LequeDiasSemana porDiaSemana={analise.porDiaSemana} recarregando={recarregando} />
            <MapaCalorHorarios heatmap={analise.heatmap} recarregando={recarregando} />
          </div>
          <div className="pl-sv-grid pl-sv-grid-2-eq">
            <SeguidoresOnline valores={analise.seguidoresOnline} recarregando={recarregando} />
            <CalendarioPublicacoes posts={analise.publicacoes} periodo={analise.periodo} recarregando={recarregando} />
          </div>
        </>
      )}
      {sub === 'crescimento' && (
        <>
          <CrescimentoSeguidores serie={analise.serie} kpis={analise.kpis} recarregando={recarregando} />
          <Audiencia demografia={analise.demografia} recarregando={recarregando} />
        </>
      )}
      {sub === 'publicacoes' && <TabelaPublicacoes posts={analise.publicacoes} periodo={analise.periodo} recarregando={recarregando} />}
    </div>
  )
}

function MetasSinais({ metas, aoFechar, aoSalvar }: { metas: Conectado['metas']; aoFechar: () => void; aoSalvar: () => void }) {
  const toast = useToast()
  const [m, setM] = useState(metas)
  const [erro, setErro] = useState<string | null>(null)
  const campo = (chave: keyof typeof metas, rotulo: string, passo: number, max: number) => (
    <label className="sm-campo">{rotulo}
      <input className="sm-input" type="number" step={passo} min={0} max={max} value={m[chave]} onChange={e => setM({ ...m, [chave]: Number(e.target.value) })} required />
    </label>
  )
  return (
    <Modal titulo="Metas dos sinais" aoFechar={aoFechar}>
      <form style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={async e => {
        e.preventDefault()
        try { await proLaboreApi.sm.calendario.salvarConfig(m); toast({ mensagem: 'Metas salvas.' }); aoSalvar() } catch (err) { setErro(err instanceof Error ? err.message : 'Não foi possível salvar') }
      }}>
        <div className="sm-grade-2">
          {campo('metaRetencao', 'Retenção média (%)', 1, 100)}
          {campo('metaPuloPct', 'Pulo nos 3 s abaixo de (%)', 1, 100)}
          {campo('metaEnviosMil', 'Envios por mil', 0.1, 1000)}
          {campo('metaSalvosMil', 'Salvos por mil', 0.1, 1000)}
          {campo('metaCurtidasPct', 'Curtidas por alcance (%)', 0.1, 100)}
        </div>
        {erro && <p className="sm-erro" role="alert">{erro}</p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="pri" type="submit">Salvar metas</Botao>
        </div>
      </form>
    </Modal>
  )
}

/** "Salvar o gancho na biblioteca" a partir de um reel que foi bem. */
function SalvarGancho({ reel, aoFechar }: { reel: SmReelDiagnostico; aoFechar: () => void }) {
  const toast = useToast()
  const [texto, setTexto] = useState(reel.nome.replace(/…$/, ''))
  const [erro, setErro] = useState<string | null>(null)
  return (
    <Modal titulo="Salvar gancho na biblioteca" aoFechar={aoFechar}>
      <form className="sm-form" onSubmit={async e => {
        e.preventDefault()
        try {
          const r = await proLaboreApi.sm.ganchos.salvar(texto.trim(), [reel.instagramMediaId])
          toast({ mensagem: r.novo ? 'Gancho salvo na biblioteca.' : 'Reel juntado ao gancho que já estava na biblioteca.' })
          aoFechar()
        } catch (err) { setErro(err instanceof Error ? err.message : 'Não foi possível salvar') }
      }}>
        <p className="sm-legenda" style={{ margin: 0 }}>Descreva a abertura do reel (o que aparece e o que se diz nos 3 primeiros segundos). O pulo deste reel ({pctFracao(reel.pulo)}) entra na média do gancho.</p>
        <label className="sm-campo">Gancho
          <textarea className="sm-input" rows={3} required minLength={3} maxLength={300} value={texto} onChange={e => setTexto(e.target.value)} />
        </label>
        {erro && <p className="sm-erro" role="alert">{erro}</p>}
        <div className="sm-linha-acoes" style={{ justifyContent: 'flex-end' }}>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" variante="pri">Salvar</Botao>
        </div>
      </form>
    </Modal>
  )
}
