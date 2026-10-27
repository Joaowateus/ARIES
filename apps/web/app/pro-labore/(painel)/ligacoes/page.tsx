'use client'

// Ligações: o que ligar agora (atrasadas, hoje, próximos dias), a auditoria
// do dono (prazo, resultado e o que não fecha em cada registro) e as
// cadências (passos que viram lembretes sozinhos no lead novo).
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { proLaboreApi, type AuditoriaLigacoes, type CadenciaLigacao, type GatilhoCadencia, type Ligacao, type LigacaoComLead, type PassoCadencia, type Vendedor } from '@/lib/proLaboreApi'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { PageHeader } from '../../PageHeader'
import { ALERTA, BotaoLigar, GATILHO, RESULTADO, RegistrarLigacao, dataHora, duracao, horaBR, quandoLigar, rotuloPasso, telefoneLegivel } from '../_ligacoes/Ligacoes'

type Aba = 'ligar' | 'auditoria' | 'cadencias'
const ETAPA: Record<string, string> = { LEAD: 'Lead', ABORDADO: 'Abordado', NEGOCIACAO: 'Negociação', PROPOSTA: 'Proposta', FECHADO: 'Fechado', PERDIDO: 'Perdido' }
const H = 3600e3
const diaBR = (t: number) => new Date(t - 3 * H).toISOString().slice(0, 10)

export default function LigacoesPage() {
  const { usuario } = useProLaboreAuth()
  const isDono = usuario?.papel === 'DONO'
  const vejaEquipe = isDono || usuario?.papel === 'SUPERVISOR'
  const [aba, setAba] = useState<Aba>(() => {
    const a = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('aba')
    return a === 'auditoria' || a === 'cadencias' ? a : 'ligar'
  })
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  useEffect(() => {
    if (!vejaEquipe) return
    proLaboreApi.vendedores.listar().then(vs => setVendedores(vs.filter(v => v.ativo))).catch(() => undefined)
  }, [vejaEquipe])

  const abas: Array<{ valor: Aba; rotulo: string }> = [
    { valor: 'ligar', rotulo: 'Para ligar' },
    ...(vejaEquipe ? [{ valor: 'auditoria' as const, rotulo: 'Auditoria' }, { valor: 'cadencias' as const, rotulo: 'Cadências' }] : []),
  ]

  return (
    <div className="lg">
      <PageHeader
        eyebrow="Vendas"
        title="Ligações"
        subtitle="Quem ligar e quando, com o resultado registrado de cada ligação. Toque em Ligar: o sistema guarda a hora e abre o discador."
      />
      {abas.length > 1 && (
        <div className="cp-abas">
          <div className="pl-sv-tabs" role="tablist" aria-label="Seções de ligações">
            {abas.map(a => <button key={a.valor} type="button" role="tab" aria-selected={aba === a.valor} className={aba === a.valor ? 'ativo' : ''} onClick={() => setAba(a.valor)}>{a.rotulo}</button>)}
          </div>
        </div>
      )}
      {aba === 'ligar' && <ParaLigar vejaEquipe={vejaEquipe} vendedores={vendedores} />}
      {aba === 'auditoria' && vejaEquipe && <Auditoria vendedores={vendedores} />}
      {aba === 'cadencias' && vejaEquipe && <Cadencias podeEditar={isDono} />}
    </div>
  )
}

function SeletorVendedor({ vendedores, valor, onMudar }: { vendedores: Vendedor[]; valor: string; onMudar: (v: string) => void }) {
  if (!vendedores.length) return null
  return (
    <label className="lg-filtro">
      <span className="pl-hint">Vendedor</span>
      <select className={`pl-select-chip ${valor ? 'active' : ''}`} value={valor} onChange={e => onMudar(e.target.value)}>
        <option value="">Toda a equipe</option>
        {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
      </select>
    </label>
  )
}

/* ============ Para ligar ============ */

function ParaLigar({ vejaEquipe, vendedores }: { vejaEquipe: boolean; vendedores: Vendedor[] }) {
  const [lista, setLista] = useState<LigacaoComLead[] | null>(null)
  const [erro, setErro] = useState('')
  const [vendedorId, setVendedorId] = useState('')
  const [registrando, setRegistrando] = useState<LigacaoComLead | null>(null)
  // Hora da última carga: separa atrasadas, hoje e próximos dias.
  const [agora, setAgora] = useState(() => Date.now())

  const carregar = useCallback(() => proLaboreApi.ligacoes.pendentes(vendedorId || undefined).then(l => { setLista(l); setAgora(Date.now()); setErro('') }).catch(e => setErro((e as Error).message)), [vendedorId])
  useEffect(() => {
    let cancelado = false
    proLaboreApi.ligacoes.pendentes(vendedorId || undefined).then(l => { if (!cancelado) { setLista(l); setAgora(Date.now()); setErro('') } }).catch(e => { if (!cancelado) setErro((e as Error).message) })
    const t = setInterval(() => { if (!document.hidden) void carregar() }, 60_000)
    return () => { cancelado = true; clearInterval(t) }
  }, [vendedorId, carregar])

  const discou = (l: Ligacao) => setLista(ls => (ls ?? []).map(x => (x.id === l.id ? { ...x, ...l } : x)))
  const hoje = diaBR(agora)
  const grupos = lista ? [
    { titulo: 'Atrasadas', itens: lista.filter(l => quandoLigar(l.agendadaPara, agora).atrasada) },
    { titulo: 'Hoje', itens: lista.filter(l => !quandoLigar(l.agendadaPara, agora).atrasada && diaBR(new Date(l.agendadaPara).getTime()) === hoje) },
    { titulo: 'Próximos dias', itens: lista.filter(l => diaBR(new Date(l.agendadaPara).getTime()) > hoje) },
  ] : []

  return (
    <section className="lg-secao" data-para-ligar>
      {vejaEquipe && <SeletorVendedor vendedores={vendedores} valor={vendedorId} onMudar={setVendedorId} />}
      {erro && <div className="pl-alert pl-alert-error">{erro}</div>}
      {!lista ? <p className="pl-hint">Carregando…</p> : lista.length === 0 ? (
        <div className="pl-card pl-empty"><div className="pl-emoji">📞</div><p style={{ margin: 0 }}>Nenhuma ligação pendente. As cadências e as ligações agendadas no painel do lead aparecem aqui.</p></div>
      ) : grupos.filter(g => g.itens.length).map(g => (
        <div key={g.titulo} className="lg-grupo">
          <h3>{g.titulo} <span>{g.itens.length}</span></h3>
          <ul className="lg-lista">
            {g.itens.map(l => {
              const q = quandoLigar(l.agendadaPara, agora)
              return (
                <li key={l.id} className={`lg-item ${q.atrasada ? 'atrasada' : ''}`} data-ligacao={l.id}>
                  <div className="lg-item-quando"><span className={`lg-quando ${q.atrasada ? 'atrasada' : ''}`}>{q.texto}</span></div>
                  <div className="lg-item-corpo">
                    <div className="lg-item-quem">
                      <Link href={`/pro-labore/leads?lead=${l.lead.id}`}><b>{l.lead.nomeCliente}</b></Link>
                      <span>{[telefoneLegivel(l.lead.telefone), ETAPA[l.lead.estagio] ?? l.lead.estagio, l.lead.modeloInteresse, vejaEquipe ? l.lead.vendedor?.nome : null].filter(Boolean).join(' · ')}</span>
                    </div>
                    <div className="lg-item-passo">{rotuloPasso(l)}{l.instrucao ? ` — ${l.instrucao}` : ''}</div>
                    {l.discadaEm && <div className="lg-item-discou">Tocou em Ligar às {horaBR(l.discadaEm)}{l.discagens > 1 ? ` · ${l.discagens} vezes` : ''}</div>}
                  </div>
                  <div className="lg-item-acoes">
                    <BotaoLigar ligacao={l} telefone={l.lead.telefone} onDiscou={discou} />
                    <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setRegistrando(l)} data-registrar>Registrar</button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      {registrando && (
        <RegistrarLigacao
          ligacao={registrando} nomeCliente={registrando.lead.nomeCliente} onFechar={() => setRegistrando(null)}
          onRegistrou={() => { setRegistrando(null); void carregar() }}
        />
      )}
    </section>
  )
}

/* ============ Auditoria ============ */

function Alertas({ l }: { l: Ligacao }) {
  if (!l.alertas.length) return null
  return (
    <span className="lg-alertas">
      {l.alertas.map(a => <span key={a} className={`lg-alerta ${a === 'ATRASADA' ? 'leve' : ''}`} title={ALERTA[a].explica} data-alerta={a}>{ALERTA[a].rotulo}</span>)}
    </span>
  )
}

function LinhaAuditoria({ l, agora }: { l: LigacaoComLead; agora: number }) {
  const vencida = l.status === 'PENDENTE'
  return (
    <tr data-auditoria-linha={l.id}>
      <td><Link href={`/pro-labore/leads?lead=${l.lead.id}`}>{l.lead.nomeCliente}</Link><small>{rotuloPasso(l)}</small></td>
      <td>{l.lead.vendedor?.nome ?? '—'}</td>
      <td>{dataHora(l.agendadaPara)}{l.adiamentos > 0 && <small className={l.adiamentos >= 3 ? 'lg-adiou muito' : 'lg-adiou'} title="Vezes que tocou em Adiar no aviso: a hora marcada mostrada já é a nova" data-adiamentos={l.adiamentos}>adiou {l.adiamentos}x</small>}</td>
      <td>{l.discadaEm ? `${dataHora(l.discadaEm)}${l.dispositivo ? ` · ${l.dispositivo === 'CELULAR' ? 'celular' : 'computador'}` : ''}` : '—'}</td>
      <td>{vencida ? <span className="lg-alerta" data-alerta="NAO_FEITA">Não feita · {quandoLigar(l.agendadaPara, agora).texto.replace('atrasada ', '')}</span> : l.registradaEm ? dataHora(l.registradaEm) : '—'}</td>
      <td>{l.resultado ? RESULTADO[l.resultado] : '—'}{l.resultado === 'ATENDEU' && <small>{duracao(l.duracaoSeg)}</small>}</td>
      <td className="lg-td-resumo">{l.resumo ?? ''}<Alertas l={l} /></td>
    </tr>
  )
}

function Auditoria({ vendedores }: { vendedores: Vendedor[] }) {
  const [dias, setDias] = useState(30)
  const [vendedorId, setVendedorId] = useState('')
  const [carga, setCarga] = useState<{ dados: AuditoriaLigacoes; agora: number } | null>(null)
  const [erro, setErro] = useState('')
  useEffect(() => {
    let cancelado = false
    proLaboreApi.ligacoes.auditoria(dias, vendedorId || undefined).then(d => { if (!cancelado) { setCarga({ dados: d, agora: Date.now() }); setErro('') } }).catch(e => { if (!cancelado) setErro((e as Error).message) })
    return () => { cancelado = true }
  }, [dias, vendedorId])
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—')
  const dados = carga?.dados ?? null
  const agora = carga?.agora ?? 0

  return (
    <section className="lg-secao" data-auditoria>
      <div className="lg-filtros">
        <div className="pl-period-row" role="group" aria-label="Período">
          {[7, 30, 90].map(d => <button key={d} type="button" className={`pl-chip ${dias === d ? 'active' : ''}`} onClick={() => setDias(d)}>{d} dias</button>)}
        </div>
        <SeletorVendedor vendedores={vendedores} valor={vendedorId} onMudar={setVendedorId} />
      </div>
      {erro && <div className="pl-alert pl-alert-error">{erro}</div>}
      {!dados ? <p className="pl-hint">Carregando…</p> : (
        <>
          <div className="pl-table-wrap">
            <table className="pl-table lg-tabela" data-auditoria-resumo>
              <thead><tr><th>Quem liga</th><th className="pl-right">Previstas</th><th className="pl-right">Feitas no prazo</th><th className="pl-right">Atrasadas</th><th className="pl-right">Não feitas</th><th className="pl-right">Atendidas</th><th className="pl-right">Com alerta</th><th className="pl-right">Até ligar</th><th className="pl-right">Duração média</th></tr></thead>
              <tbody>
                {dados.resumo.length === 0 ? <tr><td colSpan={9} className="pl-hint">Nenhuma ligação prevista no período.</td></tr> : dados.resumo.map(p => (
                  <tr key={p.vendedorId ?? 'dono'} data-auditoria-pessoa={p.nome}>
                    <td><b>{p.nome}</b></td>
                    <td className="pl-right">{p.previstas}</td>
                    <td className="pl-right">{p.noPrazo} <small>{pct(p.noPrazo, p.previstas)}</small></td>
                    <td className="pl-right">{p.atrasadas}</td>
                    <td className={`pl-right ${p.naoFeitas ? 'lg-ruim' : ''}`}>{p.naoFeitas}</td>
                    <td className="pl-right">{p.atendidas} <small>{pct(p.atendidas, p.feitas)}</small></td>
                    <td className={`pl-right ${p.comAlerta ? 'lg-ruim' : ''}`}>{p.comAlerta}</td>
                    <td className="pl-right">{p.minutosAteLigar != null ? `${p.minutosAteLigar} min` : '—'}</td>
                    <td className="pl-right">{duracao(p.duracaoMediaSeg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="pl-hint lg-nota">
            O sistema registra quando a pessoa toca em Ligar (o discador abre no aparelho), quantas vezes, quando registra e o que registra. Os alertas mostram o que não fecha.
            Para provar a ligação com a operadora (registro e gravação), é preciso ligar por uma central telefônica integrada.
          </p>

          <h3 className="lg-sub">Para conferir <span>{dados.atencao.length}</span></h3>
          {dados.atencao.length === 0 ? <p className="pl-hint">Nada fora do esperado no período.</p> : (
            <div className="pl-table-wrap"><table className="pl-table lg-tabela" data-auditoria-atencao>
              <thead><tr><th>Lead</th><th>Vendedor</th><th>Marcada</th><th>Tocou em Ligar</th><th>Registrou</th><th>Resultado</th><th>Resumo e alertas</th></tr></thead>
              <tbody>{dados.atencao.map(l => <LinhaAuditoria key={l.id} l={l} agora={agora} />)}</tbody>
            </table></div>
          )}

          <h3 className="lg-sub">Últimas registradas</h3>
          {dados.recentes.length === 0 ? <p className="pl-hint">Nenhuma ligação registrada no período.</p> : (
            <div className="pl-table-wrap"><table className="pl-table lg-tabela">
              <thead><tr><th>Lead</th><th>Vendedor</th><th>Marcada</th><th>Tocou em Ligar</th><th>Registrou</th><th>Resultado</th><th>Resumo e alertas</th></tr></thead>
              <tbody>{dados.recentes.map(l => <LinhaAuditoria key={l.id} l={l} agora={agora} />)}</tbody>
            </table></div>
          )}
        </>
      )}
    </section>
  )
}

/* ============ Cadências ============ */

type CadenciaEditavel = Omit<CadenciaLigacao, 'id' | 'criadoEm' | 'atualizadoEm'> & { id?: string }
const NOVA: CadenciaEditavel = {
  nome: '', ativa: true, gatilho: null, pararAoAtender: true,
  passos: [
    { aposMinutos: 5, dia: 0, hora: null, instrucao: 'Primeiro contato: apresente-se e descubra a moto e a forma de pagamento.' },
    { aposMinutos: null, dia: 1, hora: '10:00', instrucao: 'Retome a conversa e ofereça a simulação.' },
    { aposMinutos: null, dia: 3, hora: '10:00', instrucao: 'Última tentativa: pergunte se ainda tem interesse.' },
  ],
}
const resumoPasso = (p: PassoCadencia) => (p.aposMinutos != null && p.hora == null ? `${p.aposMinutos} min depois` : `${p.dia === 0 ? 'no dia' : `D+${p.dia}`} às ${p.hora}`)

function Cadencias({ podeEditar }: { podeEditar: boolean }) {
  const [lista, setLista] = useState<CadenciaLigacao[] | null>(null)
  const [editando, setEditando] = useState<CadenciaEditavel | null>(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const carregar = () => proLaboreApi.ligacoes.cadencias.listar().then(setLista).catch(e => setErro((e as Error).message))
  useEffect(() => { proLaboreApi.ligacoes.cadencias.listar().then(setLista).catch(e => setErro((e as Error).message)) }, [])

  async function salvar() {
    if (!editando) return
    setSalvando(true); setErro('')
    const { id, ...dados } = editando
    try {
      await (id ? proLaboreApi.ligacoes.cadencias.editar(id, dados) : proLaboreApi.ligacoes.cadencias.criar(dados))
      setEditando(null); await carregar()
    } catch (e) { setErro((e as Error).message) } finally { setSalvando(false) }
  }
  async function alternar(c: CadenciaLigacao) {
    const { id, criadoEm: _c, atualizadoEm: _a, ...dados } = c
    void _c; void _a
    try { await proLaboreApi.ligacoes.cadencias.editar(id, { ...dados, ativa: !c.ativa }); await carregar() } catch (e) { setErro((e as Error).message) }
  }
  async function remover(c: CadenciaLigacao) {
    if (!confirm(`Remover a cadência "${c.nome}"? As ligações pendentes dela são canceladas.`)) return
    try { await proLaboreApi.ligacoes.cadencias.remover(c.id); await carregar() } catch (e) { setErro((e as Error).message) }
  }
  const mudarPasso = (i: number, p: Partial<PassoCadencia>) => editando && setEditando({ ...editando, passos: editando.passos.map((x, j) => (j === i ? { ...x, ...p } : x)) })

  return (
    <section className="lg-secao" data-cadencias>
      {erro && <div className="pl-alert pl-alert-error">{erro}</div>}
      {editando ? (
        <div className="pl-card lg-editor" data-cadencia-editor>
          <div className="pl-card-title">{editando.id ? 'Editar cadência' : 'Nova cadência'}</div>
          <div className="lg-editor-campos">
            <label className="pl-field"><span>Nome</span><input className="pl-input" value={editando.nome} maxLength={80} onChange={e => setEditando({ ...editando, nome: e.target.value })} placeholder="Ex.: Lead novo de anúncio" data-cadencia-nome /></label>
            <label className="pl-field"><span>Começa sozinha</span>
              <select className="pl-select" value={editando.gatilho ?? ''} onChange={e => setEditando({ ...editando, gatilho: (e.target.value || null) as GatilhoCadencia | null })} data-cadencia-gatilho>
                <option value="">Só quando iniciar no lead</option>
                {(Object.keys(GATILHO) as GatilhoCadencia[]).map(g => <option key={g} value={g}>{GATILHO[g]}</option>)}
              </select>
            </label>
          </div>
          <label className="lg-check"><input type="checkbox" checked={editando.pararAoAtender} onChange={e => setEditando({ ...editando, pararAoAtender: e.target.checked })} /> Parar a cadência quando o cliente atender</label>
          <label className="lg-check"><input type="checkbox" checked={editando.ativa} onChange={e => setEditando({ ...editando, ativa: e.target.checked })} /> Ativa</label>
          <h4>Passos</h4>
          <ol className="lg-passos">
            {editando.passos.map((p, i) => {
              const relativo = p.aposMinutos != null && p.hora == null
              return (
                <li key={i} data-cadencia-passo={i + 1}>
                  <span className="pr-num">{i + 1}</span>
                  <select className="pl-select" value={relativo ? 'min' : 'dia'} onChange={e => mudarPasso(i, e.target.value === 'min' ? { aposMinutos: 5, hora: null, dia: 0 } : { aposMinutos: null, hora: '10:00', dia: Math.max(1, p.dia) })} aria-label={`Quando, passo ${i + 1}`}>
                    <option value="min">Minutos depois de entrar</option>
                    <option value="dia">Dia e horário</option>
                  </select>
                  {relativo ? (
                    <input className="pl-input lg-num" type="number" min={0} max={1440} value={p.aposMinutos ?? 0} onChange={e => mudarPasso(i, { aposMinutos: Number(e.target.value) })} aria-label={`Minutos, passo ${i + 1}`} />
                  ) : (
                    <>
                      <span className="pl-hint">D+</span>
                      <input className="pl-input lg-num" type="number" min={0} max={90} value={p.dia} onChange={e => mudarPasso(i, { dia: Number(e.target.value) })} aria-label={`Dias depois, passo ${i + 1}`} />
                      <input className="pl-input lg-hora" type="time" value={p.hora ?? '10:00'} onChange={e => mudarPasso(i, { hora: e.target.value })} aria-label={`Horário, passo ${i + 1}`} />
                    </>
                  )}
                  <input className="pl-input lg-instrucao" placeholder="O que falar nesta ligação" value={p.instrucao} maxLength={1000} onChange={e => mudarPasso(i, { instrucao: e.target.value })} aria-label={`O que falar, passo ${i + 1}`} />
                  <button type="button" className="pl-icon-btn pr-remover" onClick={() => setEditando({ ...editando, passos: editando.passos.filter((_, j) => j !== i) })} aria-label={`Remover passo ${i + 1}`}>✕</button>
                </li>
              )
            })}
          </ol>
          <p className="pl-hint">“Minutos depois” fora do horário (antes das 8h ou depois das 20h) vai para as 9h seguintes. D+0 é o dia em que o lead entrou.</p>
          <div className="lg-modal-acoes">
            <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setEditando({ ...editando, passos: [...editando.passos, { aposMinutos: null, dia: (editando.passos.at(-1)?.dia ?? 0) + 2, hora: '10:00', instrucao: '' }] })} disabled={editando.passos.length >= 15}>+ Passo</button>
            <span style={{ flex: 1 }} />
            <button type="button" className="pl-btn pl-btn-ghost" onClick={() => { setEditando(null); setErro('') }}>Cancelar</button>
            <button type="button" className="pl-btn pl-btn-primary" onClick={() => void salvar()} disabled={salvando} data-cadencia-salvar>{salvando ? 'Salvando…' : 'Salvar cadência'}</button>
          </div>
        </div>
      ) : (
        <>
          {podeEditar && <div><button type="button" className="pl-btn pl-btn-primary" onClick={() => setEditando(structuredClone(NOVA))} data-nova-cadencia>+ Nova cadência</button></div>}
          {!lista ? <p className="pl-hint">Carregando…</p> : lista.length === 0 ? (
            <div className="pl-card pl-empty"><div className="pl-emoji">🔁</div><p style={{ margin: 0 }}>Nenhuma cadência ainda. Monte uma sequência de ligações (ex.: 5 min depois, D+1 às 10h, D+3 às 10h) e escolha se ela começa sozinha no lead novo.</p></div>
          ) : (
            <div className="lg-cadencias">
              {lista.map(c => (
                <div key={c.id} className={`pl-card lg-cadencia ${c.ativa ? '' : 'inativa'}`} data-cadencia={c.nome}>
                  <div className="lg-cadencia-cab">
                    <b>{c.nome}</b>
                    <span className={`pl-status-badge ${c.ativa ? '' : 'pl-badge-off'}`}>{c.ativa ? 'Ativa' : 'Pausada'}</span>
                  </div>
                  <p className="pl-hint">{c.gatilho ? `Começa sozinha: ${GATILHO[c.gatilho].toLowerCase()}` : 'Só quando iniciar no lead'}{c.pararAoAtender ? ' · para quando o cliente atende' : ''}</p>
                  <ol className="lg-cadencia-passos">{c.passos.map((p, i) => <li key={i}><b>{resumoPasso(p)}</b>{p.instrucao ? ` — ${p.instrucao}` : ''}</li>)}</ol>
                  {podeEditar && (
                    <div className="lg-cadencia-acoes">
                      <button type="button" className="pl-link-action" onClick={() => setEditando(structuredClone(c))}>Editar</button>
                      <button type="button" className="pl-link-action" onClick={() => void alternar(c)}>{c.ativa ? 'Pausar' : 'Ativar'}</button>
                      <button type="button" className="pl-link-action pl-danger" onClick={() => void remover(c)}>Remover</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
