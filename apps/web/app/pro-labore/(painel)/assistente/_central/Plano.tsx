'use client'

// Blocos 8, 9 e 10 — Diagnóstico automático (com os 12 campos), priorização
// pelos critérios das Premissas e o plano de ação: aprovação, execução e
// validação pelo indicador (concluir a tarefa não basta: o número precisa
// chegar à meta). Nada é executado sozinho: a Central sugere, a gestão decide.
import { useEffect, useState } from 'react'
import { proLaboreApi, type IntelAcao, type IntelAcaoNova, type IntelCentral, type IntelDepartamento, type IntelDiagnostico, type IntelDiagnosticoHistorico, type IntelSeveridade, type IntelStatusAcao } from '@/lib/proLaboreApi'
import { DEPARTAMENTO, SEVERIDADE, STATUS_ABERTOS, STATUS_ACAO, dataBR, dataHoraBR, hojeBR, nomeMes, valorIndicador } from './fmt'

type Responsaveis = Awaited<ReturnType<typeof proLaboreApi.intel.responsaveis>>
const CONFIANCA: Record<string, string> = { ALTA: 'Alta', MEDIA: 'Média', BAIXA: 'Baixa' }
const FILTROS: Array<{ valor: string; rotulo: string; testa: (a: IntelAcao) => boolean }> = [
  { valor: 'abertas', rotulo: 'Em aberto', testa: a => STATUS_ABERTOS.includes(a.status) },
  { valor: 'aprovacao', rotulo: 'Aguardando aprovação', testa: a => a.status === 'AGUARDANDO_APROVACAO' },
  { valor: 'validacao', rotulo: 'Aguardando validação', testa: a => a.status === 'AGUARDANDO_VALIDACAO' },
  { valor: 'atrasadas', rotulo: 'Atrasadas', testa: a => !!a.atrasada },
  { valor: 'fechadas', rotulo: 'Concluídas e não atingidas', testa: a => a.status === 'CONCLUIDA' || a.status === 'NAO_ATINGIU' },
  { valor: 'todas', rotulo: 'Todas', testa: () => true },
]
const somaDias = (dias: number) => new Date(Date.parse(`${hojeBR()}T12:00:00Z`) + dias * 864e5).toISOString().slice(0, 10)
const unidadeDe = (chave: string | null, r: Responsaveis | null) => (!chave ? 'NUM' : chave.startsWith('conv:') || chave.startsWith('abordagem:') ? 'PCT' : r?.indicadores.find(i => i.chave === chave)?.unidade ?? 'NUM')

function Diagnostico({ x, onCriar }: { x: IntelDiagnostico; onCriar: () => void }) {
  const u = x.indicador.unidade
  return (
    <article className={`ic-diag ${SEVERIDADE[x.severidade].classe}`} data-diag={x.chave}>
      <div className="ic-diag-cab">
        <span className={`ic-tag ${SEVERIDADE[x.severidade].classe}`}>{SEVERIDADE[x.severidade].rotulo}</span>
        <span className="ic-dep">{x.departamentoNome}</span>
        {x.ocorrencias > 1 && <span className="ic-tag moderado sem">Recorrente · {x.ocorrencias} dias{x.desde ? ` desde ${dataBR(x.desde)}` : ''}</span>}
        <span className="ic-legenda" style={{ marginLeft: 'auto' }}>Confiança {CONFIANCA[x.confianca] ?? x.confianca}</span>
      </div>
      <h3>{x.problema}</h3>
      <p className="ic-bloco-texto"><b>Evidência: </b>{x.evidencia}</p>
      <div className="ic-campos">
        <div className="ic-campo"><span>Meta</span><b>{x.meta ?? '—'}</b></div>
        <div className="ic-campo"><span>Atual</span><b>{x.atual ?? '—'}</b></div>
        <div className="ic-campo"><span>Diferença</span><b>{x.diferenca ?? '—'}</b></div>
        <div className="ic-campo"><span>Prazo sugerido</span><b>{x.prazoDias} dia{x.prazoDias > 1 ? 's' : ''}</b></div>
      </div>
      {x.hipoteses.length > 0 && <div><p className="ic-bloco-texto"><b>Hipóteses a investigar</b></p><ul className="ic-pontos" style={{ marginTop: 4 }}>{x.hipoteses.map(h => <li key={h}>{h}</li>)}</ul></div>}
      <p className="ic-bloco-texto"><b>Impacto: </b>{x.impacto.texto}</p>
      <p className="ic-bloco-texto"><b>Ação recomendada: </b>{x.acao}</p>
      <p className="ic-legenda">Indicador de acompanhamento: {x.indicador.nome} — hoje {valorIndicador(x.indicador.atual, u)}, meta {valorIndicador(x.indicador.meta, u)} ({x.indicador.melhorQuando === 'MAIOR' ? 'quanto maior, melhor' : 'quanto menor, melhor'}).</p>
      <div className="ic-botoes">
        {x.acoes.length > 0 && <span className="ic-legenda">Ações ligadas: {x.acoes.map(a => STATUS_ACAO[a.status]).join(' · ')}</span>}
        <button type="button" className="pl-btn pl-btn-primary ic-btn-p" onClick={onCriar} disabled={!x.id}>{x.acoes.some(a => STATUS_ABERTOS.includes(a.status)) ? 'Criar outra ação' : 'Criar ação'}</button>
      </div>
    </article>
  )
}

function NovaAcao({ diag, r, onFechar, onCriada }: { diag: IntelDiagnostico | null; r: Responsaveis; onFechar: () => void; onCriada: () => void }) {
  const indicadores = [...r.indicadores]
  if (diag && !indicadores.some(i => i.chave === diag.indicador.chave)) indicadores.push({ chave: diag.indicador.chave, nome: diag.indicador.nome, melhorQuando: diag.indicador.melhorQuando, unidade: diag.indicador.unidade })
  const [f, setF] = useState<IntelAcaoNova>({
    diagnosticoId: diag?.id ?? null,
    titulo: diag?.acao ?? '', problema: diag?.problema ?? '',
    evidencias: diag ? `${diag.evidencia}${diag.hipoteses.length ? `\nHipóteses: ${diag.hipoteses.join('; ')}` : ''}` : '',
    objetivo: diag && diag.indicador.meta != null ? `Levar "${diag.indicador.nome}" de ${valorIndicador(diag.indicador.atual, diag.indicador.unidade)} para ${valorIndicador(diag.indicador.meta, diag.indicador.unidade)}.` : '',
    departamento: diag?.departamento ?? 'COMERCIAL', responsavelId: 'DONO', prazo: somaDias(diag?.prazoDias ?? 5), prioridade: diag?.severidade ?? 'MODERADO',
    indicadorChave: diag?.indicador.chave ?? null, metaEsperada: diag?.indicador.meta ?? null,
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const set = <K extends keyof IntelAcaoNova>(k: K, v: IntelAcaoNova[K]) => setF(x => ({ ...x, [k]: v }))
  const ind = indicadores.find(i => i.chave === f.indicadorChave)
  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true); setErro('')
    try { await proLaboreApi.intel.criarAcao(f); onCriada() } catch (x) { setErro((x as Error).message) } finally { setSalvando(false) }
  }
  return (
    <div className="pl-modal-backdrop" onClick={onFechar}>
      <form className="pl-card pl-modal-panel ic-modal" onClick={e => e.stopPropagation()} onSubmit={salvar} role="dialog" aria-modal="true" aria-labelledby="ic-nova-titulo">
        <div className="ic-modal-corpo">
          <div><div className="pl-eyebrow">Plano de ação</div><h2 id="ic-nova-titulo" style={{ margin: '4px 0 0', fontFamily: 'Sora', fontSize: 18 }}>{diag ? 'Criar ação a partir do diagnóstico' : 'Nova ação'}</h2>
            <p className="ic-sub">A ação nasce planejada quando o dono cria; quando vem da supervisão, espera a aprovação do dono.</p></div>
          <div className="ic-form">
            <div className="pl-field largo"><label htmlFor="ic-a-titulo">Ação</label><input id="ic-a-titulo" className="pl-input" value={f.titulo} onChange={e => set('titulo', e.target.value)} required minLength={3} /></div>
            <div className="pl-field largo"><label htmlFor="ic-a-prob">Problema</label><textarea id="ic-a-prob" className="pl-input" value={f.problema} onChange={e => set('problema', e.target.value)} required minLength={3} /></div>
            <div className="pl-field largo"><label htmlFor="ic-a-evid">Evidências</label><textarea id="ic-a-evid" className="pl-input" value={f.evidencias ?? ''} onChange={e => set('evidencias', e.target.value)} /></div>
            <div className="pl-field largo"><label htmlFor="ic-a-obj">Objetivo</label><input id="ic-a-obj" className="pl-input" value={f.objetivo ?? ''} onChange={e => set('objetivo', e.target.value)} /></div>
            <div className="pl-field"><label htmlFor="ic-a-dep">Departamento</label>
              <select id="ic-a-dep" className="pl-select" value={f.departamento} onChange={e => set('departamento', e.target.value as IntelDepartamento)}>{(Object.keys(DEPARTAMENTO) as IntelDepartamento[]).map(k => <option key={k} value={k}>{DEPARTAMENTO[k]}</option>)}</select></div>
            <div className="pl-field"><label htmlFor="ic-a-resp">Responsável</label>
              <select id="ic-a-resp" className="pl-select" value={f.responsavelId ?? ''} onChange={e => set('responsavelId', e.target.value || null)}><option value="">Sem responsável</option>{r.responsaveis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
            <div className="pl-field"><label htmlFor="ic-a-prazo">Prazo</label><input id="ic-a-prazo" type="date" className="pl-input" value={f.prazo ?? ''} min={hojeBR()} onChange={e => set('prazo', e.target.value || null)} /></div>
            <div className="pl-field"><label htmlFor="ic-a-prio">Prioridade</label>
              <select id="ic-a-prio" className="pl-select" value={f.prioridade} onChange={e => set('prioridade', e.target.value as IntelSeveridade)}>{(Object.keys(SEVERIDADE) as IntelSeveridade[]).map(k => <option key={k} value={k}>{SEVERIDADE[k].rotulo}</option>)}</select></div>
            <div className="pl-field"><label htmlFor="ic-a-ind">Indicador que valida</label>
              <select id="ic-a-ind" className="pl-select" value={f.indicadorChave ?? ''} onChange={e => set('indicadorChave', e.target.value || null)}><option value="">Sem indicador</option>{indicadores.map(i => <option key={i.chave} value={i.chave}>{i.nome}</option>)}</select>
              <small>Sem indicador e meta, a ação não pode ser validada.</small></div>
            <div className="pl-field"><label htmlFor="ic-a-meta">Meta esperada{ind ? ` (${ind.unidade === 'PCT' ? '%' : ind.unidade === 'BRL' ? 'R$' : ind.unidade === 'HORAS' ? 'horas' : 'número'})` : ''}</label>
              <input id="ic-a-meta" type="number" step="any" className="pl-input" value={f.metaEsperada ?? ''} onChange={e => set('metaEsperada', e.target.value === '' ? null : Number(e.target.value))} disabled={!f.indicadorChave} />
              {ind && <small>{ind.melhorQuando === 'MAIOR' ? 'Atinge quando o indicador chegar a este valor ou mais.' : 'Atinge quando o indicador cair a este valor ou menos.'}</small>}</div>
          </div>
          {erro && <div className="pl-alert pl-alert-error">{erro}</div>}
          <div className="fd-rodape" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="pl-btn pl-btn-ghost" onClick={onFechar}>Cancelar</button>
            <button type="submit" className="pl-btn pl-btn-primary" disabled={salvando}>{salvando ? 'Salvando…' : 'Criar ação'}</button>
          </div>
        </div>
      </form>
    </div>
  )
}

function Acao({ a, r, dono, onMudou }: { a: IntelAcao; r: Responsaveis | null; dono: boolean; onMudou: (nova?: IntelAcao) => void }) {
  const [comentario, setComentario] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [cancelando, setCancelando] = useState(false)
  const [evidencias, setEvidencias] = useState(a.evidenciasExecucao ?? '')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const u = unidadeDe(a.indicadorChave, r)
  const aberta = STATUS_ABERTOS.includes(a.status)
  async function rodar(fn: () => Promise<IntelAcao>) {
    setOcupado(true); setErro('')
    try { onMudou(await fn()) } catch (e) { setErro((e as Error).message) } finally { setOcupado(false) }
  }
  const mudar = (status: IntelStatusAcao, extra?: Record<string, unknown>) => rodar(() => proLaboreApi.intel.editarAcao(a.id, { status, ...extra }))
  return (
    <article className={`ic-acao${a.atrasada ? ' atrasada' : ''}`} data-acao={a.id}>
      <div className="ic-diag-cab">
        <span className={`ic-tag ${a.status === 'CONCLUIDA' ? 'OK' : a.status === 'NAO_ATINGIU' || a.status === 'CANCELADA' ? 'critico' : a.status === 'AGUARDANDO_APROVACAO' || a.status === 'AGUARDANDO_VALIDACAO' ? 'moderado' : 'sem'}`} data-status={a.status}>{STATUS_ACAO[a.status]}</span>
        <span className={`ic-tag ${SEVERIDADE[a.prioridade].classe}`}>{SEVERIDADE[a.prioridade].rotulo}</span>
        <span className="ic-dep">{DEPARTAMENTO[a.departamento]}</span>
        {a.atrasada && <span className="ic-tag critico sem">Atrasada</span>}
      </div>
      <h3 style={{ fontSize: 14.5 }}>{a.titulo}</h3>
      <p className="ic-bloco-texto"><b>Problema: </b>{a.problema}</p>
      {a.objetivo && <p className="ic-bloco-texto"><b>Objetivo: </b>{a.objetivo}</p>}
      <div className="ic-acao-meta">
        <span>Responsável: <b>{a.responsavelNome ?? '—'}</b></span>
        <span>Prazo: <b>{dataBR(a.prazo)}</b></span>
        <span>Criada por {a.criadoPor} em {dataBR(a.criadoEm)}{a.aprovadoPor ? ` · aprovada por ${a.aprovadoPor}` : ''}</span>
      </div>
      {a.indicadorChave && (
        <div className="ic-campos">
          <div className="ic-campo"><span>{a.indicadorNome}</span><b>{valorIndicador(a.valorInicial, u)} → {valorIndicador(a.resultadoValor ?? a.indicadorAtual, u)}</b></div>
          <div className="ic-campo"><span>Meta esperada</span><b>{valorIndicador(a.metaEsperada, u)}</b></div>
          <div className="ic-campo"><span>{a.resultadoEm ? 'Resultado validado' : 'Situação hoje'}</span><b>{a.atingiu == null ? 'sem meta' : a.atingiu ? 'na meta' : 'abaixo da meta'}</b></div>
        </div>
      )}
      {a.justificativa && <p className="ic-legenda">Justificativa: {a.justificativa}</p>}

      {aberta && (
        <div className="ic-botoes">
          {a.status === 'IDENTIFICADA' && (dono
            ? <button type="button" className="pl-btn pl-btn-primary ic-btn-p" disabled={ocupado} onClick={() => mudar('PLANEJADA')}>Aprovar e planejar</button>
            : <button type="button" className="pl-btn pl-btn-primary ic-btn-p" disabled={ocupado} onClick={() => mudar('AGUARDANDO_APROVACAO')}>Enviar para aprovação</button>)}
          {a.status === 'AGUARDANDO_APROVACAO' && (dono
            ? <button type="button" className="pl-btn pl-btn-primary ic-btn-p" disabled={ocupado} onClick={() => mudar('PLANEJADA')}>Aprovar</button>
            : <span className="ic-legenda">Esperando a aprovação do dono.</span>)}
          {a.status === 'PLANEJADA' && <button type="button" className="pl-btn pl-btn-primary ic-btn-p" disabled={ocupado} onClick={() => mudar('EM_EXECUCAO')}>Iniciar execução</button>}
          {a.status === 'EM_EXECUCAO' && <button type="button" className="pl-btn pl-btn-primary ic-btn-p" disabled={ocupado} onClick={() => mudar('AGUARDANDO_VALIDACAO', { evidenciasExecucao: evidencias.trim() || null })}>Marcar como executada</button>}
          {a.status === 'AGUARDANDO_VALIDACAO' && <>
            <button type="button" className="pl-btn pl-btn-primary ic-btn-p" disabled={ocupado} onClick={() => rodar(() => proLaboreApi.intel.validarAcao(a.id))}>Validar pelo indicador</button>
            <button type="button" className="pl-btn pl-btn-ghost ic-btn-p" disabled={ocupado} onClick={() => mudar('EM_EXECUCAO')}>Voltar para execução</button>
          </>}
          {!cancelando && <button type="button" className="pl-btn pl-btn-ghost ic-btn-p" disabled={ocupado} onClick={() => setCancelando(true)}>Cancelar ação</button>}
        </div>
      )}
      {a.status === 'NAO_ATINGIU' && <div className="ic-botoes"><button type="button" className="pl-btn pl-btn-primary ic-btn-p" disabled={ocupado} onClick={() => mudar('EM_EXECUCAO')}>Retomar a execução</button></div>}
      {a.status === 'EM_EXECUCAO' && (
        <div className="pl-field"><label htmlFor={`ev-${a.id}`}>Evidências da execução</label><textarea id={`ev-${a.id}`} className="pl-input" rows={2} value={evidencias} onChange={e => setEvidencias(e.target.value)} placeholder="O que foi feito, com data e quem fez" /></div>
      )}
      {a.evidenciasExecucao && a.status !== 'EM_EXECUCAO' && <p className="ic-legenda">Evidências da execução: {a.evidenciasExecucao}</p>}
      {cancelando && (
        <div className="ic-botoes">
          <input className="pl-input" style={{ flex: 1, minWidth: 180 }} value={justificativa} onChange={e => setJustificativa(e.target.value)} placeholder="Por que cancelar? (obrigatório)" aria-label="Justificativa do cancelamento" />
          <button type="button" className="pl-btn pl-btn-ghost ic-btn-p" disabled={ocupado || !justificativa.trim()} onClick={() => mudar('CANCELADA', { justificativa: justificativa.trim() })}>Confirmar cancelamento</button>
          <button type="button" className="pl-btn pl-btn-ghost ic-btn-p" onClick={() => setCancelando(false)}>Voltar</button>
        </div>
      )}
      {erro && <div className="pl-alert pl-alert-error">{erro}</div>}
      <div className="ic-comentarios">
        {(a.comentarios ?? []).map((c, i) => <div key={i} className="ic-comentario"><b>{c.autor}</b> <small>{dataHoraBR(c.em)}</small><div>{c.texto}</div></div>)}
        <form className="ic-botoes" onSubmit={e => { e.preventDefault(); if (comentario.trim()) rodar(() => proLaboreApi.intel.comentarAcao(a.id, comentario.trim())).then(() => setComentario('')) }}>
          <input className="pl-input" style={{ flex: 1, minWidth: 180 }} value={comentario} onChange={e => setComentario(e.target.value)} placeholder="Comentar" aria-label="Comentário" />
          <button type="submit" className="pl-btn pl-btn-ghost ic-btn-p" disabled={ocupado || !comentario.trim()}>Enviar</button>
        </form>
      </div>
    </article>
  )
}

export function Plano({ d, onMudou }: { d: IntelCentral; onMudou: () => void }) {
  const [acoes, setAcoes] = useState<IntelAcao[] | null>(null)
  const [r, setR] = useState<Responsaveis | null>(null)
  const [historico, setHistorico] = useState<IntelDiagnosticoHistorico[] | null>(null)
  const [versao, setVersao] = useState(0)
  const [filtroDep, setFiltroDep] = useState<IntelDepartamento | ''>('')
  const [filtro, setFiltro] = useState('abertas')
  const [nova, setNova] = useState<{ diag: IntelDiagnostico | null } | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => { proLaboreApi.intel.responsaveis().then(setR).catch(e => setErro((e as Error).message)) }, [])
  useEffect(() => {
    let cancelado = false
    Promise.all([proLaboreApi.intel.acoes(), proLaboreApi.intel.diagnosticosHistorico()])
      .then(([a, h]) => { if (!cancelado) { setAcoes(a); setHistorico(h) } })
      .catch(e => { if (!cancelado) setErro((e as Error).message) })
    return () => { cancelado = true }
  }, [versao])

  const diags = d.diagnosticos.filter(x => !filtroDep || x.departamento === filtroDep)
  const f = FILTROS.find(x => x.valor === filtro) ?? FILTROS[0]
  const lista = (acoes ?? []).filter(f.testa)
  const recarregar = () => { setVersao(v => v + 1); onMudou() }
  const crit = d.premissas.criterios

  return (
    <>
      <section className="ic-card">
        <div className="ic-cab">
          <div>
            <h2>Diagnóstico automático</h2>
            <p className="ic-sub">Ordenado por prioridade: severidade pelos critérios das Premissas (desvio alto ≥ {crit.desvioAltoPP} p.p., moderado ≥ {crit.desvioModeradoPP} p.p., atingimento crítico abaixo de {crit.atingimentoCriticoPct}%, amostra mínima de {crit.amostraMinima} leads) e o impacto estimado em vendas.</p>
          </div>
        </div>
        <div className="ic-filtros" role="group" aria-label="Filtrar por departamento" style={{ marginBottom: 12 }}>
          <button type="button" className={`pl-chip ${filtroDep === '' ? 'active' : ''}`} onClick={() => setFiltroDep('')} aria-pressed={filtroDep === ''}>Todos ({d.diagnosticos.length})</button>
          {(Object.keys(DEPARTAMENTO) as IntelDepartamento[]).map(k => {
            const n = d.diagnosticos.filter(x => x.departamento === k).length
            return n > 0 && <button key={k} type="button" className={`pl-chip ${filtroDep === k ? 'active' : ''}`} onClick={() => setFiltroDep(k)} aria-pressed={filtroDep === k}>{DEPARTAMENTO[k]} ({n})</button>
          })}
        </div>
        {diags.length === 0 ? <p className="ic-legenda">Nenhum desvio acima dos critérios{filtroDep ? ' neste departamento' : ''}.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {diags.map(x => <Diagnostico key={x.chave} x={x} onCriar={() => setNova({ diag: x })} />)}
          </div>
        )}
        {d.periodo.mes !== hojeBR().slice(0, 7) && <p className="ic-legenda" style={{ marginTop: 10 }}>Mês fechado: os diagnósticos aparecem para leitura; o histórico e as ações ficam com o mês corrente.</p>}
      </section>

      <section className="ic-card">
        <div className="ic-cab">
          <div><h2>Plano de ação</h2><p className="ic-sub">Identificada → aprovação → planejada → em execução → aguardando validação → concluída ou não atingiu. A validação compara o indicador com a meta esperada.</p></div>
          <button type="button" className="pl-btn pl-btn-ghost ic-btn-p" onClick={() => setNova({ diag: null })} disabled={!r}>Nova ação</button>
        </div>
        <div className="ic-filtros" role="group" aria-label="Filtrar ações" style={{ marginBottom: 12 }}>
          {FILTROS.map(x => <button key={x.valor} type="button" className={`pl-chip ${filtro === x.valor ? 'active' : ''}`} onClick={() => setFiltro(x.valor)} aria-pressed={filtro === x.valor}>{x.rotulo} ({(acoes ?? []).filter(x.testa).length})</button>)}
        </div>
        {erro && <div className="pl-alert pl-alert-error">{erro}</div>}
        {!acoes ? <div className="pl-hint">Carregando as ações…</div> : lista.length === 0 ? <p className="ic-legenda">Nenhuma ação neste filtro.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {lista.map(a => <Acao key={a.id} a={a} r={r} dono={d.dono} onMudou={() => recarregar()} />)}
          </div>
        )}
      </section>

      <section className="ic-card">
        <div className="ic-cab"><div><h2>Histórico de alertas</h2><p className="ic-sub">Cada diagnóstico fica guardado: quando apareceu, quantos dias se repetiu e quando saiu do alerta.</p></div></div>
        {!historico ? <div className="pl-hint">Carregando…</div> : historico.length === 0 ? <p className="ic-legenda">Ainda sem histórico.</p> : (
          <div className="ic-rola">
            <table className="ic-tabela" style={{ minWidth: 680 }}>
              <thead><tr><th>Mês</th><th>Alerta</th><th>Severidade</th><th>Situação</th><th className="num">Dias</th><th className="num">Desde</th><th className="num">Resolvido</th></tr></thead>
              <tbody>{historico.slice(0, 60).map(h => (
                <tr key={h.id}><td>{nomeMes(h.periodo)}</td><td>{h.problema}<small className="fraco" style={{ display: 'block' }}>{DEPARTAMENTO[h.departamento]}</small></td><td><span className={`ic-tag ${SEVERIDADE[h.severidade].classe}`}>{SEVERIDADE[h.severidade].rotulo}</span></td><td>{h.status === 'ATIVO' ? 'Ativo' : 'Resolvido'}</td><td className="num">{h.ocorrencias}</td><td className="num">{dataBR(h.primeiraVezEm)}</td><td className="num">{dataBR(h.resolvidoEm)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      {nova && r && <NovaAcao diag={nova.diag} r={r} onFechar={() => setNova(null)} onCriada={() => { setNova(null); setFiltro('abertas'); recarregar() }} />}
    </>
  )
}
