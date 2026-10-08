'use client'

// Tela 11 · Retrospectiva da semana (seção 11.4, protótipo Retro.html): tela
// cheia em formato de stories, 5 partes com a barra de progresso clicável e
// Anterior/Próximo (← → no teclado, Esc fecha). Gerada sozinha na sexta;
// antes disso, abre a da semana anterior. "Enviar ao gestor" vira aviso no
// painel dele e "Baixar como imagem" exporta as 5 partes num PNG.
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { proLaboreApi, type SmRetrospectiva } from '@/lib/proLaboreApi'
import { Botao, EstadoVazio, Kbd, useToast } from '../../_ui'

const PARTES = ['Título e conquistas', 'Metas da semana', 'Post da semana', 'O que você aprendeu', 'Próxima semana']
const TOM_CONQUISTA = ['ok', 'info', 'warn'] as const
const num = (v: number, c = 1) => v.toLocaleString('pt-BR', { maximumFractionDigits: c })
const sinal = (v: number) => (v > 0 ? `+${num(v)}` : v < 0 ? `−${num(-v)}` : '0')
const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Belem', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function RetrospectivaPage() {
  return <Suspense fallback={<div className="sm-retro-fundo"><p className="sm-legenda" role="status">Carregando…</p></div>}><Retrospectiva /></Suspense>
}

function Retrospectiva() {
  const router = useRouter()
  const toast = useToast()
  const semanaURL = useSearchParams().get('semana')
  const [r, setR] = useState<SmRetrospectiva | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [parte, setParte] = useState(0)
  const [enviando, setEnviando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [carregadaPara, setCarregadaPara] = useState<string | null>(null)
  const exportar = useRef<HTMLDivElement>(null)

  // Outra semana na URL: volta para a primeira parte e busca de novo (sem mostrar a semana anterior enquanto carrega).
  const chave = semanaURL ?? ''
  if (carregadaPara !== chave) { setCarregadaPara(chave); setParte(0); setR(null); setErro(null) }
  useEffect(() => {
    proLaboreApi.sm.retrospectiva.ver(semanaURL ?? undefined)
      .then(d => { setR(d); setErro(null) })
      .catch(e => { setR(null); setErro(e instanceof Error ? e.message : 'Não foi possível abrir a retrospectiva') })
  }, [semanaURL])

  const ir = useCallback((n: number) => setParte(Math.max(0, Math.min(PARTES.length - 1, n))), [])
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"][aria-modal="true"]')) { router.push('/pro-labore/sm'); return }
      if (e.key === 'ArrowRight') { e.preventDefault(); setParte(p => Math.min(PARTES.length - 1, p + 1)) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); setParte(p => Math.max(0, p - 1)) }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [router])

  async function enviar() {
    if (!r) return
    setEnviando(true)
    try {
      const x = await proLaboreApi.sm.retrospectiva.enviar(r.semana)
      setR({ ...r, enviadaGestorEm: x.enviadaGestorEm })
      toast({ mensagem: 'Retrospectiva enviada ao gestor.' })
    } catch (e) {
      toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível enviar', tom: 'bad' })
    } finally { setEnviando(false) }
  }

  async function salvarGancho() {
    if (!r?.post) return
    try {
      await proLaboreApi.sm.retrospectiva.salvarGancho(r.semana)
      setR({ ...r, podeSalvarGancho: false, post: { ...r.post, ganchoSalvo: true } })
      toast({ mensagem: 'Gancho salvo na biblioteca.' })
    } catch (e) { toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível salvar', tom: 'bad' }) }
  }

  async function baixar() {
    if (!r || !exportar.current) return
    setExportando(true)
    try {
      const { toPng } = await import('html-to-image')
      const fundo = getComputedStyle(exportar.current).backgroundColor
      // A cópia para a imagem fica fora da tela: no clone, volta para a posição normal.
      const url = await toPng(exportar.current, {
        pixelRatio: 1, cacheBust: true, backgroundColor: fundo,
        width: exportar.current.offsetWidth, height: exportar.current.offsetHeight,
        style: { position: 'static', left: 'auto', top: 'auto' },
      })
      const a = document.createElement('a')
      a.href = url
      a.download = `retrospectiva-${r.semana}.png`
      a.click()
      toast({ mensagem: 'Imagem baixada.' })
    } catch {
      toast({ mensagem: 'Não foi possível gerar a imagem', tom: 'bad' })
    } finally { setExportando(false) }
  }

  if (erro) {
    return (
      <main className="sm-retro-fundo">
        <div className="sm-retro" style={{ minHeight: 0 }}>
          <EstadoVazio titulo="Retrospectiva indisponível" acao={<Link href="/pro-labore/sm" className="sm-btn">Voltar para Hoje</Link>}>{erro}</EstadoVazio>
        </div>
      </main>
    )
  }
  if (!r) return <main className="sm-retro-fundo"><p className="sm-legenda" role="status">Montando a retrospectiva…</p></main>

  const ultima = parte === PARTES.length - 1
  return (
    <main className="sm-retro-fundo">
      <section className="sm-retro" aria-label="Retrospectiva" aria-roledescription="stories">
        <div className="sm-retro-barras" role="group" aria-label="Partes da retrospectiva">
          {PARTES.map((p, i) => (
            <button key={p} type="button" className={`sm-retro-barra${i <= parte ? ' feita' : ''}`} aria-label={`Ir para a parte ${i + 1}: ${p}`} aria-current={i === parte ? 'step' : undefined} onClick={() => ir(i)} />
          ))}
        </div>
        <div className="sm-retro-topo">
          <span className="sm-mono">Retrospectiva · {r.rotulo}</span>
          <Link href="/pro-labore/sm" className="sm-link-botao">Fechar <Kbd>Esc</Kbd></Link>
        </div>
        <div className="sm-retro-parte" aria-live="polite">
          <Parte r={r} n={parte} aoSalvarGancho={salvarGancho} />
          {ultima && (
            <div className="sm-retro-acoes">
              {r.podeEnviar && (
                <Botao variante="pri" onClick={enviar} disabled={enviando}>
                  {enviando ? 'Enviando…' : r.enviadaGestorEm ? 'Enviar de novo ao gestor' : 'Enviar ao gestor'}
                </Botao>
              )}
              <Botao onClick={baixar} disabled={exportando}>{exportando ? 'Gerando…' : 'Baixar como imagem'}</Botao>
              {r.enviadaGestorEm && <span className="sm-legenda" role="status">Enviada ao gestor em {dataHora(r.enviadaGestorEm)}.</span>}
            </div>
          )}
        </div>
        <div className="sm-retro-rodape">
          <Botao onClick={() => ir(parte - 1)} disabled={parte === 0}>Anterior</Botao>
          <span className="sm-legenda">{parte + 1} de {PARTES.length}</span>
          <Botao variante="pri" onClick={() => ir(ultima ? 0 : parte + 1)}>{ultima ? 'Recomeçar' : 'Próximo'}</Botao>
        </div>
      </section>
      <nav className="sm-retro-semanas" aria-label="Outras semanas">
        <Link href={`/pro-labore/sm/retrospectiva?semana=${r.anterior}`}>← Semana anterior</Link>
        {r.proxima && <Link href={`/pro-labore/sm/retrospectiva?semana=${r.proxima}`}>Próxima semana →</Link>}
      </nav>
      {/* Versão para a imagem: as 5 partes, uma embaixo da outra. */}
      <div className="sm-retro-export" ref={exportar} aria-hidden="true">
        <span className="sm-mono">Retrospectiva · {r.rotulo}</span>
        {PARTES.map((_, i) => <div key={i} className="sm-retro-export-parte"><Parte r={r} n={i} exportando /></div>)}
      </div>
    </main>
  )
}

function Parte({ r, n, exportando, aoSalvarGancho }: { r: SmRetrospectiva; n: number; exportando?: boolean; aoSalvarGancho?: () => void }) {
  const Titulo = exportando ? 'h2' : 'h1'
  if (n === 0) {
    const abertas = r.conquistas.filter(c => c.desbloqueada)
    const subtitulo = abertas.length === 0 ? 'Nenhuma marca profissional desbloqueada nesta semana.'
      : `${abertas.length === 1 ? 'Uma marca profissional desbloqueada' : `${['', '', 'Duas', 'Três'][abertas.length] ?? abertas.length} marcas profissionais desbloqueadas`}.`
    return (
      <>
        <Titulo className="sm-ttl sm-retro-h1 grande">{r.titulo}</Titulo>
        <p className="sm-retro-sub">{subtitulo} Elas medem processo, não curtida.</p>
        <div className="sm-retro-grade conquistas">
          {r.conquistas.map((c, i) => (
            <div key={c.chave} className={`sm-retro-tile${c.desbloqueada ? '' : ' bloqueada'}`}>
              <span className={`sm-ttl sm-retro-conquista ${c.desbloqueada ? TOM_CONQUISTA[i % 3] : ''}`}>{c.titulo}</span>
              <span className="sm-retro-detalhe">{c.desbloqueada ? c.detalhe : `Ainda não: ${c.detalhe.charAt(0).toLowerCase()}${c.detalhe.slice(1)}`}</span>
            </div>
          ))}
        </div>
        {r.tituloIA && !exportando && <span className="sm-legenda">Título escrito pela IA com os números da semana.</span>}
      </>
    )
  }
  if (n === 1) {
    const m = r.metas
    const tiles: Array<{ rotulo: string; valor: string; meta?: string; status: string; ok: boolean }> = []
    const d = m.diasComPost
    const varDias = d.atual - d.anterior
    tiles.push({ rotulo: 'Dias com post', valor: String(d.atual), meta: `/ ${d.meta}`, ok: d.atual >= d.meta && d.rajadas === 0, status: `${d.atual >= d.meta ? 'Meta batida' : `Faltou ${d.meta - d.atual}`}${d.rajadas ? ` · ${d.rajadas} ${d.rajadas === 1 ? 'dia' : 'dias'} com rajada` : ''}${varDias ? ` · ${sinal(varDias)} vs. semana anterior` : ''}` })
    if (m.leads) {
      const v = m.leads.atual - m.leads.anterior
      tiles.push({ rotulo: 'Leads orgânicos', valor: String(m.leads.atual), meta: `/ ${m.leads.meta}`, ok: m.leads.atual >= m.leads.meta, status: `${m.leads.atual >= m.leads.meta ? 'Meta batida' : `Faltaram ${m.leads.meta - m.leads.atual}`}${v ? ` · ${sinal(v)} vs. semana anterior` : ''}` })
    }
    if (m.resposta) {
      const x = m.resposta.atualMin
      const v = x != null && m.resposta.anteriorMin != null ? x - m.resposta.anteriorMin : 0
      tiles.push({ rotulo: 'Resposta no direct', valor: x != null ? `${x} min` : '—', ok: x != null && x <= m.resposta.meta, status: x == null ? 'Nenhuma conversa respondida' : `${x <= m.resposta.meta ? 'Meta' : 'Acima da meta de'} ≤ ${m.resposta.meta} min${v ? ` · ${sinal(v)} min vs. semana anterior` : ''}` })
    }
    if (m.retencao) {
      const x = m.retencao.pct
      const v = x != null && m.retencao.anteriorPct != null ? x - m.retencao.anteriorPct : null
      tiles.push({ rotulo: 'Retenção dos reels', valor: x != null ? `${x}%` : '—', ok: x != null && x >= m.retencao.meta, status: x == null ? 'Sem reels com a duração medida' : `${v ? `${v > 0 ? 'Subiu' : 'Caiu'} ${Math.abs(v)} ${Math.abs(v) === 1 ? 'ponto' : 'pontos'} · ` : ''}meta ${m.retencao.meta}%` })
    }
    return (
      <>
        <Titulo className="sm-ttl sm-retro-h1">Metas da semana</Titulo>
        <div className="sm-retro-grade metas">
          {tiles.map(t => (
            <div key={t.rotulo} className="sm-retro-tile">
              <span className="sm-mono">{t.rotulo}</span>
              <span className="sm-ttl sm-retro-valor">{t.valor}{t.meta && <span> {t.meta}</span>}</span>
              <span className={`sm-retro-status ${t.ok ? 'ok' : 'warn'}`}>{t.status}</span>
            </div>
          ))}
        </div>
      </>
    )
  }
  if (n === 2) {
    const p = r.post
    if (!p) {
      return (
        <>
          <span className="sm-mono sm-retro-kicker info">Post da semana</span>
          <Titulo className="sm-ttl sm-retro-h1">Nenhum post no feed nesta semana.</Titulo>
          <p className="sm-retro-texto">Sem post, sem comparação. A próxima semana começa pelo calendário.</p>
        </>
      )
    }
    return (
      <>
        <span className="sm-mono sm-retro-kicker info">Post da semana</span>
        <Titulo className="sm-ttl sm-retro-h1">{p.titulo}</Titulo>
        <div className="sm-retro-grade post">
          <div className="sm-retro-tile"><span className="sm-ttl sm-retro-num">{num(p.multiplo)}×</span><span className="sm-retro-detalhe">a mediana de alcance</span></div>
          {p.pulo != null && <div className="sm-retro-tile"><span className="sm-ttl sm-retro-num">{p.pulo}%</span><span className="sm-retro-detalhe">pulo nos 3s{p.puloMenorDoMes ? ', o menor do mês' : ''}</span></div>}
          {p.leads != null && <div className="sm-retro-tile"><span className="sm-ttl sm-retro-num">{p.leads}</span><span className="sm-retro-detalhe">{p.leads === 1 ? 'lead no CRM' : 'leads no CRM'}</span></div>}
        </div>
        <p className="sm-retro-texto">
          {p.porque}
          {p.ganchoSalvo ? ' O gancho já está salvo na biblioteca.' : ''}
        </p>
        {!exportando && (
          <div className="sm-retro-links">
            {r.podeSalvarGancho && aoSalvarGancho && <Botao onClick={aoSalvarGancho}>Salvar o gancho na biblioteca</Botao>}
            {p.permalink && <a href={p.permalink} target="_blank" rel="noreferrer">Ver no Instagram</a>}
          </div>
        )}
      </>
    )
  }
  if (n === 3) {
    const a = r.aprendizado
    if (!a) {
      return (
        <>
          <span className="sm-mono sm-retro-kicker learn">O que você aprendeu</span>
          <Titulo className="sm-ttl sm-retro-h1">Ainda sem aprendizado com amostra suficiente.</Titulo>
          <p className="sm-retro-texto">Nenhum teste A/B fechou nesta semana e nenhum formato ou horário se destacou com 3 posts ou mais. Um teste na próxima semana resolve isso.</p>
          {!exportando && <div className="sm-retro-links"><Link href="/pro-labore/sm/desempenho#testes">Criar um teste A/B</Link></div>}
        </>
      )
    }
    const max = Math.max(...a.barras.map(b => b.medida), 1)
    return (
      <>
        <span className="sm-mono sm-retro-kicker learn">O que você aprendeu{a.tipo === 'TESTE' ? ' · teste A/B' : ''}</span>
        <Titulo className="sm-ttl sm-retro-h1">{a.titulo}</Titulo>
        <div className="sm-retro-tile sm-retro-barras-teste" role="img" aria-label={a.barras.map(b => `${b.rotulo}: ${b.texto}`).join('; ')}>
          {a.barras.map((b, i) => (
            <div key={b.rotulo} className="sm-retro-barra-linha">
              <div><span>{b.rotulo}</span><span>{b.texto}</span></div>
              <div className="sm-retro-trilho"><div className={i === 0 ? 'a' : 'b'} style={{ width: `${Math.max(4, (b.medida / max) * 100)}%` }} /></div>
            </div>
          ))}
        </div>
        <p className="sm-retro-nota">{a.nota}</p>
      </>
    )
  }
  const focos = r.focos
  return (
    <>
      <span className="sm-mono">Próxima semana</span>
      <Titulo className="sm-ttl sm-retro-h1">{focos.length === 3 ? 'Três focos, nada mais.' : focos.length === 2 ? 'Dois focos, nada mais.' : 'Um foco, nada mais.'}</Titulo>
      <ol className="sm-retro-focos">{focos.map(f => <li key={f}>{f}</li>)}</ol>
    </>
  )
}
