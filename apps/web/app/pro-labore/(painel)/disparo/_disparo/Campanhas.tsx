'use client'

// Campanhas: lista (paginada no servidor), criação/edição (Assistente) e o acompanhamento de uma
// campanha (atualiza sozinho a cada 5 s enquanto ela está ativa): números, destinatários, o histórico
// de cada um (tentativas, eventos, falhas), decisões sobre envios sem confirmação e o resultado comercial.
import { useCallback, useEffect, useRef, useState } from 'react'
import { disparoApi, type CampanhaDisparoEntrada, type CampanhaDisparo, type ComercialDisparo, type DestinatarioDisparo, type DetalheDestinatarioDisparo, type EventoDisparo, type SituacaoEnvioDisparo, type StatusCampanhaDisparo } from '@/lib/proLaboreApi'
import { Assistente } from './Assistente'
import { MenuAcoes, Quando, quandoTexto, useAvisar, useConfirmar, usePerguntar } from './ui'
import { Paginacao, Progresso, erroAmigavel, ROTULO_DESTINATARIO, ROTULO_INTERRUPCAO, ROTULO_MENSAGEM, SeloStatus, dataHora, duracao, erroDe, n, pct, useEscopo, useMeta } from './util'

const ATIVAS: StatusCampanhaDisparo[] = ['VALIDATING', 'QUEUED', 'RUNNING', 'SCHEDULED']
const FILTROS: Array<{ rotulo: string; status?: string }> = [
  { rotulo: 'Todas' }, { rotulo: 'Em andamento', status: 'QUEUED,RUNNING,PAUSED' }, { rotulo: 'Aguardando aprovação', status: 'NEEDS_REVIEW' }, { rotulo: 'Agendadas', status: 'SCHEDULED' },
  { rotulo: 'Preparação', status: 'DRAFT,VALIDATING,NEEDS_REVIEW,READY' }, { rotulo: 'Concluídas', status: 'COMPLETED,COMPLETED_WITH_ERRORS' }, { rotulo: 'Canceladas', status: 'CANCELLED' }, { rotulo: 'Arquivadas', status: 'ARCHIVED' },
]

export function Campanhas({ aberta, abrir, nova = false }: { aberta: string | null; abrir: (id: string | null) => void; nova?: boolean }) {
  const meta = useMeta()
  const [filtro, setFiltro] = useState(0)
  const [pagina, setPagina] = useState(0)
  const [lista, setLista] = useState<Awaited<ReturnType<typeof disparoApi.campanhas.listar>> | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [editando, setEditando] = useState<CampanhaDisparo | null | 'nova'>(nova ? 'nova' : null)
  // Campanha nova a partir de outra (ex.: só para quem respondeu / não respondeu).
  const [preset, setPreset] = useState<Partial<CampanhaDisparoEntrada> | null>(null)
  // "+ Nova campanha" da barra do topo (?nova=1) abre o assistente.
  const [novaAntes, setNovaAntes] = useState(nova)
  if (nova !== novaAntes) { setNovaAntes(nova); if (nova) setEditando('nova') }
  const [marcadas, setMarcadas] = useState<string[]>([])
  const [busca, setBusca] = useState('')
  const { de, setDe } = useEscopo()
  const carregar = useCallback(() => { disparoApi.campanhas.listar({ status: FILTROS[filtro].status, pagina, de, busca: busca.trim() || undefined }).then(setLista).catch(e => setErro(erroDe(e))) }, [filtro, pagina, de, busca])
  useEffect(() => { if (aberta || editando) return; const t = setTimeout(carregar, busca ? 300 : 0); return () => clearTimeout(t) }, [carregar, aberta, editando, busca])
  const pode = meta.nivel === 'EDITAR'
  // Gestão: campanhas da equipe esperando aprovação (aviso no topo da lista).
  const [aprovar, setAprovar] = useState(0)
  useEffect(() => { if (meta.gestao && !aberta && !editando) disparoApi.campanhas.listar({ status: 'NEEDS_REVIEW', de: 'equipe' }).then(r => setAprovar(r.total)).catch(() => undefined) }, [meta.gestao, aberta, editando, lista])

  const confirmar = useConfirmar()
  const avisar = useAvisar()
  async function excluir(ids: string[]) {
    const ativas = (lista?.itens ?? []).filter(c => ids.includes(c.id) && ['SCHEDULED', 'QUEUED', 'RUNNING', 'PAUSED'].includes(c.status)).length
    if (!(await confirmar({ titulo: `Excluir ${ids.length} campanha(s)?`, texto: `${ativas ? `${ativas} ainda está(ão) enviando ou agendada(s): o que não saiu será cancelado.\n\n` : ''}Elas somem da lista e dos relatórios. Os registros (quem recebeu o quê) continuam guardados.`, acao: 'Excluir', perigo: true }))) return
    try { const r = await disparoApi.campanhas.excluir(ids); avisar(`${r.excluidas} campanha(s) excluída(s)${r.canceladas ? `, ${r.canceladas} cancelada(s) antes` : ''}`); setMarcadas([]); carregar() } catch (e) { setErro(erroDe(e)) }
  }

  if (preset) return <Assistente campanha={null} preset={preset} fechar={() => setPreset(null)} abrirMonitor={id => { setPreset(null); abrir(id) }} />
  if (editando) return <Assistente campanha={editando === 'nova' ? null : editando} fechar={() => { setEditando(null); if (nova) abrir(null) }} abrirMonitor={id => { setEditando(null); abrir(id) }} />
  if (aberta) return <Monitor id={aberta} voltar={() => abrir(null)} editar={c => setEditando(c)} abrir={abrir} novaCom={setPreset} />
  const contagens = lista?.contagens ?? {}
  const contar = (st?: string) => st ? st.split(',').reduce((a, x) => a + (contagens[x as StatusCampanhaDisparo] ?? 0), 0) : Object.entries(contagens).filter(([k]) => k !== 'ARCHIVED').reduce((a, [, v]) => a + (v ?? 0), 0)
  return (
    <div data-disparo-campanhas className="dp-campanhas">
      <div className="dp-filtros">
        <div className="dp-chips-filtro" role="group" aria-label="Filtrar por situação">
          {FILTROS.map((x, i) => <button key={x.rotulo} type="button" aria-pressed={filtro === i} className={filtro === i ? 'on' : ''} onClick={() => { setFiltro(i); setPagina(0) }}>{x.rotulo}{lista?.contagens && <small>{contar(x.status)}</small>}</button>)}
        </div>
        <input className="pl-input dp-busca" type="search" placeholder="Buscar campanha pelo nome" value={busca} onChange={e => { setBusca(e.target.value); setPagina(0) }} aria-label="Buscar campanha pelo nome" />
      </div>
      {erro && <div className="pl-alert pl-alert-error" role="alert">{erro}</div>}
      {aprovar > 0 && FILTROS[filtro].status !== 'NEEDS_REVIEW' && (
        <div className="dp-faixa-aviso" role="status" data-aviso-aprovar>
          <span><b>{aprovar} {aprovar === 1 ? 'campanha da equipe está' : 'campanhas da equipe estão'} esperando sua aprovação.</b> Nada é enviado antes disso.</span>
          <button type="button" className="pl-btn pl-btn-primary" onClick={() => { setDe('equipe'); setFiltro(FILTROS.findIndex(x => x.status === 'NEEDS_REVIEW')); setPagina(0) }}>Ver e aprovar</button>
        </div>
      )}
      {pode && marcadas.length > 0 && (
        <div className="dp-faixa-aviso selecao" role="status" data-barra-excluir>
          <span><b>{marcadas.length} selecionada(s).</b> Excluir tira da lista e dos relatórios; o que ainda ia sair é cancelado. Os registros ficam guardados.</span>
          <span className="dp-linha">
            <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setMarcadas([])}>Limpar seleção</button>
            <button type="button" className="pl-btn pl-btn-perigo" data-excluir-selecionadas onClick={() => void excluir(marcadas)}>Excluir {marcadas.length}</button>
          </span>
        </div>
      )}
      {!lista ? <div className="pl-card" aria-busy="true">{[0, 1, 2, 3].map(i => <div key={i} className="dp-esq alto" />)}</div> : !lista.itens.length ? (
        <div className="pl-card dp-vazio-grande"><h3>{busca ? 'Nenhuma campanha com esse nome' : 'Nenhuma campanha aqui'}</h3><p className="pl-hint">{pode ? 'Crie uma em “+ Nova campanha”, no topo.' : 'Seu acesso é só para acompanhar.'}</p></div>
      ) : (
        <div className="pl-table-wrap dp-tabela-campanhas">
          <table className="pl-table">
            <thead><tr>{pode && <th style={{ width: 36 }}><input type="checkbox" aria-label="Selecionar todas desta página" checked={lista.itens.length > 0 && lista.itens.every(c => marcadas.includes(c.id))} onChange={e => setMarcadas(e.target.checked ? [...new Set([...marcadas, ...lista.itens.map(c => c.id)])] : marcadas.filter(id => !lista.itens.some(c => c.id === id)))} /></th>}<th>Campanha</th><th>Situação</th><th style={{ minWidth: 150 }}>Progresso</th><th>Envia por</th><th>Quando</th><th>Responsável</th></tr></thead>
            <tbody>
              {lista.itens.map(c => {
                const tot = c.totais?.elegiveis ?? 0
                const pg = c.progresso ?? { enviadas: 0, falhas: 0, paradas: 0 }
                const pr = (x: number) => `${tot ? Math.min(100, (x / tot) * 100) : 0}%`
                return (
                  <tr key={c.id} className={c.erro ? 'problema' : ''} style={{ cursor: 'pointer' }} onClick={() => abrir(c.id)} data-campanha={c.id}>
                    {pode && <td onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={`Selecionar ${c.nome}`} checked={marcadas.includes(c.id)} onChange={e => setMarcadas(m => (e.target.checked ? [...m, c.id] : m.filter(x => x !== c.id)))} /></td>}
                    <td className="dp-col-nome"><b>{c.nome}</b><div className="pl-hint">{meta.finalidades[c.finalidade]}{c.objetivo ? ` · ${c.objetivo}` : ''}</div>{c.erro && <div className="dp-erro-linha" title={erroAmigavel(c.erro)}>{erroAmigavel(c.erro)}</div>}</td>
                    <td><div className="dp-linha" style={{ gap: 4 }}><SeloStatus status={c.status} parada={!!c.erro} />{c.config?.continua && <span className="dp-selo tipo" title="Estratégia contínua: quem entra no público entra sozinho">Contínua</span>}</div></td>
                    <td>{tot ? <><div className="dp-barra-prog"><i className="ok" style={{ width: pr(pg.enviadas) }} /><i className="falha" style={{ width: pr(pg.falhas) }} /><i className="parada" style={{ width: pr(pg.paradas) }} /></div><div className="dp-item-sub">{n(pg.enviadas)} de {n(tot)}{pg.falhas ? ` · ${n(pg.falhas)} falha(s)` : ''}</div></> : <span className="pl-hint">{c.totais ? 'ninguém para receber' : 'público não preparado'}</span>}</td>
                    <td>{c.canal === 'INSTAGRAM' ? 'Instagram' : c.assistente?.vendedor.nome ?? '—'}</td>
                    <td>{c.concluidaEm ? <Quando iso={c.concluidaEm} prefixo="terminou" /> : c.iniciadaEm ? <Quando iso={c.iniciadaEm} prefixo="começou" /> : c.agendadaPara ? <Quando iso={c.agendadaPara} prefixo="agendada" /> : <Quando iso={c.atualizadoEm} prefixo="editada" />}</td>
                    <td>{c.responsavelNome ?? c.criadoPorNome ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <Paginacao pagina={pagina} total={lista.total} porPagina={lista.porPagina} ir={setPagina} />
        </div>
      )}
    </div>
  )
}

function Monitor({ id, voltar, editar, abrir, novaCom }: { id: string; voltar: () => void; editar: (c: CampanhaDisparo) => void; abrir: (id: string) => void; novaCom: (p: Partial<CampanhaDisparoEntrada>) => void }) {
  const meta = useMeta()
  const [c, setC] = useState<CampanhaDisparo | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [filtro, setFiltro] = useState<string>('')
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(0)
  const [dest, setDest] = useState<{ total: number; porPagina: number; itens: DestinatarioDisparo[] } | null>(null)
  const [detalhe, setDetalhe] = useState<string | null>(null)
  const [eventos, setEventos] = useState<EventoDisparo[]>([])
  const [comercial, setComercial] = useState<ComercialDisparo | null>(null)
  const pode = meta.nivel === 'EDITAR'

  const carregar = useCallback(() => Promise.all([disparoApi.campanhas.ver(id), disparoApi.campanhas.destinatarios(id, { status: filtro || undefined, busca: busca || undefined, pagina }), disparoApi.campanhas.eventos(id)])
    .then(([cc, d, ev]) => {
      setC(cc); setDest(d); setEventos(ev); setErro(null)
      if (cc.iniciadaEm) disparoApi.campanhas.comercial(id).then(setComercial).catch(() => undefined)
    })
    .catch(e => setErro(erroDe(e))), [id, filtro, busca, pagina])
  useEffect(() => { void carregar() }, [carregar])
  const ativa = !!c && ATIVAS.includes(c.status)
  useEffect(() => { if (!ativa) return; const t = setInterval(() => void carregar(), 5000); return () => clearInterval(t) }, [ativa, carregar])
  // Com a campanha aberta, a própria tela pede as rodadas do envio (a cada 20 s): o envio não fica
  // parado esperando a rotina automática. Uma rodada por vez; o servidor respeita intervalo e limites.
  const enviando = !!c && (['VALIDATING', 'QUEUED', 'RUNNING'].includes(c.status) || (c.status === 'SCHEDULED' && !!c.agendadaPara && new Date(c.agendadaPara) <= new Date()))
  const emRodada = useRef(false)
  const [rodada, setRodada] = useState<{ em: number; texto: string; erro: boolean } | null>(null)
  const rodar = useCallback(() => {
    if (emRodada.current) return
    emRodada.current = true
    disparoApi.processar()
      .then(r => setRodada({ em: Date.now(), erro: false, texto: r.rodou ? `enviou ${r.disparoEnviadas ?? 0}${r.disparoFalhas ? `, ${r.disparoFalhas} falha(s)` : ''}` : (r.motivo ?? 'nada a fazer') }))
      .catch(e => setRodada({ em: Date.now(), erro: true, texto: erroDe(e) }))
      .finally(() => { emRodada.current = false; void carregar() })
  }, [carregar])
  useEffect(() => { if (!enviando) return; rodar(); const t = setInterval(rodar, 20_000); return () => clearInterval(t) }, [enviando, rodar])

  const confirmarUi = useConfirmar()
  const perguntar = usePerguntar()
  const avisar = useAvisar()
  async function agir(fn: () => Promise<unknown>, ok: string, confirmar?: Parameters<typeof confirmarUi>[0]) {
    if (confirmar && !(await confirmarUi(confirmar))) return
    setOcupado(true); setMsg(null)
    try { await fn(); avisar(ok); await carregar() } catch (e) { avisar(erroDe(e), 'erro'); setMsg(erroDe(e)) } finally { setOcupado(false) }
  }
  if (erro) return <div><button type="button" className="pl-btn" onClick={voltar}>Voltar</button><div className="pl-alert pl-alert-error" role="alert">{erro}</div></div>
  if (!c) return <p className="pl-hint" aria-busy="true">Carregando a campanha…</p>
  const r = c.resumo
  const st = c.status
  return (
    <div data-disparo-monitor={st}>
      <button type="button" className="pl-btn pl-btn-ghost dp-voltar" onClick={voltar}>← Campanhas</button>
      <header className="dp-monitor-topo">
        <div style={{ minWidth: 0 }}>
          <h2 className="dp-monitor-nome">{c.nome} <SeloStatus status={st} parada={c.situacao?.motivo === 'SEM_CONEXAO'} />{c.config?.continua && <span className="dp-selo tipo">Contínua</span>}</h2>
          <div className="dp-monitor-meta">
            <span>{meta.finalidades[c.finalidade]}</span>
            {c.objetivo && <span>{c.objetivo}</span>}
            <span>{c.canal === 'INSTAGRAM' ? `direct do ${c.remetente?.vendedor ?? 'Instagram'}` : c.remetente ? <>WhatsApp de {c.remetente.vendedor} {c.remetente.numero ?? ''}{!c.remetente.conectado && <b className="dp-txt-crit"> · desconectado</b>}</> : 'sem número'}</span>
            <span>criada por {c.criadoPorNome ?? '—'}{c.aprovadoPorNome ? ` · aprovada por ${c.aprovadoPorNome}` : ''}</span>
            <span>versão {c.versao}{ativa ? ' · atualiza a cada 5 s' : ''}</span>
          </div>
        </div>
        {pode && (
          <div className="dp-monitor-acoes">
            {['DRAFT', 'NEEDS_REVIEW', 'READY', 'SCHEDULED'].includes(st) && <button type="button" className="pl-btn" onClick={() => editar(c)}>Editar</button>}
            {st === 'NEEDS_REVIEW' && meta.gestao && <button type="button" className="pl-btn" disabled={ocupado} onClick={() => void perguntar({ titulo: 'Devolver a campanha ao rascunho?', texto: 'Quem criou recebe o motivo e pode ajustar e mandar de novo.', acao: 'Devolver', campo: { rotulo: 'Por que devolver?', minimo: 3 } }).then(m => { if (m) void agir(() => disparoApi.campanhas.reprovar(c.id, m), 'Devolvida ao rascunho') })}>Devolver</button>}
            {(st === 'RUNNING' || st === 'QUEUED') && <button type="button" className="pl-btn" disabled={ocupado} onClick={() => void agir(() => disparoApi.campanhas.pausar(c.id), 'Pausada: nenhum envio novo até retomar')}>Pausar</button>}
            {st === 'DRAFT' && <button type="button" className="pl-btn pl-btn-primary" disabled={ocupado} onClick={() => void agir(() => disparoApi.campanhas.validar(c.id), 'Público em preparação')}>Preparar o público</button>}
            {st === 'NEEDS_REVIEW' && meta.gestao && <button type="button" className="pl-btn pl-btn-primary" disabled={ocupado} onClick={() => void agir(() => disparoApi.campanhas.aprovar(c.id), 'Aprovada')}>Aprovar</button>}
            {st === 'READY' && <button type="button" className="pl-btn pl-btn-primary" disabled={ocupado} onClick={() => void agir(async () => { const r = await disparoApi.campanhas.iniciar(c.id, c.agendadaPara); if (r.status === 'QUEUED') rodar() }, c.agendadaPara && new Date(c.agendadaPara) > new Date() ? 'Agendada' : 'Começou: a primeira mensagem sai em instantes', { titulo: c.agendadaPara && new Date(c.agendadaPara) > new Date() ? 'Confirmar o agendamento?' : `Enviar para ${n(c.totais?.elegiveis)} contato(s)?`, texto: 'As mensagens saem no ritmo de proteção do número, dentro da janela de envio. Você pode pausar a qualquer momento.', acao: c.agendadaPara && new Date(c.agendadaPara) > new Date() ? 'Agendar' : 'Começar o envio' })}>{c.agendadaPara && new Date(c.agendadaPara) > new Date() ? 'Confirmar agendamento' : 'Iniciar agora'}</button>}
            {st === 'PAUSED' && <button type="button" className="pl-btn pl-btn-primary" disabled={ocupado} onClick={() => void agir(() => disparoApi.campanhas.retomar(c.id), 'Retomada')}>Retomar</button>}
            <MenuAcoes itens={[
              { rotulo: 'Duplicar', desabilitado: ocupado, aoClicar: () => void agir(async () => { const nova = await disparoApi.campanhas.duplicar(c.id); abrir(nova.id) }, 'Cópia criada') },
              ['COMPLETED', 'COMPLETED_WITH_ERRORS', 'CANCELLED', 'DRAFT'].includes(st) && { rotulo: 'Arquivar', desabilitado: ocupado, aoClicar: () => void agir(() => disparoApi.campanhas.arquivar(c.id), 'Arquivada') },
              !['COMPLETED', 'COMPLETED_WITH_ERRORS', 'CANCELLED', 'ARCHIVED'].includes(st) && { rotulo: 'Cancelar a campanha', perigo: true, desabilitado: ocupado, aoClicar: () => void agir(() => disparoApi.campanhas.cancelar(c.id), 'Cancelada: o que não saiu foi cancelado', { titulo: 'Cancelar a campanha?', texto: 'O que ainda não foi enviado não sai mais. O que já saiu e os registros continuam.', acao: 'Cancelar a campanha', perigo: true }) },
              { rotulo: 'Excluir', perigo: true, desabilitado: ocupado, aoClicar: () => void confirmarUi({ titulo: `Excluir “${c.nome}”?`, texto: `${['SCHEDULED', 'QUEUED', 'RUNNING', 'PAUSED'].includes(st) ? 'Ela ainda está enviando ou agendada: o que não saiu será cancelado.\n\n' : ''}Ela some da lista e dos relatórios; os registros continuam guardados.`, acao: 'Excluir', perigo: true }).then(ok => { if (ok) void disparoApi.campanhas.excluir([c.id]).then(() => { avisar('Campanha excluída'); voltar() }).catch(e => setMsg(erroDe(e))) }) },
            ]} />
          </div>
        )}
      </header>
      {msg && <p className="pl-hint" role="status">{msg}</p>}
      {c.config?.continua && <div className="pl-alert" role="status" data-estrategia-continua><b>Estratégia contínua.</b> Quem passar a fazer parte do público entra sozinho (conferido a cada 10 min){c.config.pararAoSairDoPublico ? ', e quem sair do público (ex.: mudou de etapa) para de receber' : ''}{c.config.remetentePorVendedor ? '. Cada contato recebe pelo WhatsApp do próprio vendedor' : ''}. Ela fica ligada até você pausar ou cancelar.</div>}
      {c.situacao && <PainelAgora s={c.situacao} status={st} rodada={enviando ? rodada : null} />}
      {(c.erro || r?.erro) && c.situacao?.motivo !== 'SEM_CONEXAO' && <div className="pl-alert pl-alert-error" role="alert">{erroAmigavel(c.erro ?? r?.erro)}</div>}
      {r && r.aDecidir > 0 && <div className="pl-alert" role="status">{r.aDecidir} mensagem(ns) sem confirmação ou com as tentativas esgotadas: decida na lista abaixo (filtro “Falhou”) se reenvia ou considera enviada. O sistema nunca reenvia sozinho o que pode já ter saído.</div>}

      {r && r.elegiveis > 0 && !['DRAFT', 'VALIDATING', 'NEEDS_REVIEW', 'READY'].includes(st) && <Progresso total={r.elegiveis} enviadas={(r.destinatarios.CONCLUIDO ?? 0) + (r.destinatarios.RESPONDEU ?? 0)} falhas={r.destinatarios.FALHOU ?? 0} outras={r.destinatarios.INTERROMPIDO ?? 0} />}
      {r && (
        <section className="pl-card dp-monitor-numeros" aria-label="Números da campanha">
          <div className="dp-ph"><b>Mensagens</b><span title={r.origem}>destinatários desta versão · tempo de envio {duracao(r.tempoMs)}</span></div>
          <div className="dp-funil">
            {[
              { rotulo: 'Elegíveis', v: r.elegiveis, t: null as number | null, sub: `${n(r.selecionados)} selecionados · ${n(r.excluidos)} excluídos` },
              { rotulo: 'Aceitas', v: r.aceitas, t: r.elegiveis ? (r.aceitas / r.elegiveis) * 100 : null, sub: `${n(r.pendentes)} pendentes · ${n(r.naFila)} na fila` },
              { rotulo: 'Entregues', v: r.entregues, t: r.taxaEntrega, sub: '' },
              { rotulo: 'Lidas', v: r.lidas, t: r.taxaLeitura, sub: '' },
              { rotulo: 'Respostas', v: r.respostas, t: r.taxaResposta, sub: r.descadastros ? `${n(r.descadastros)} pediram para sair` : '' },
            ].map(f => (
              <div key={f.rotulo} className="dp-funil-linha" title={f.sub || undefined}>
                <span>{f.rotulo}</span>
                <div className="dp-funil-trilha"><i style={{ width: `${(f.v / Math.max(1, r.elegiveis, r.aceitas)) * 100}%` }} /></div>
                <span className="dp-funil-valor">{n(f.v)}{f.t != null ? ` · ${pct(f.t)}` : ''}</span>
              </div>
            ))}
          </div>
          <div className="dp-monitor-rodape">
            <span className={r.falhas ? 'dp-txt-crit' : ''}><b>{n(r.falhas)}</b> falha(s)</span>
            <span><b>{n(r.desconhecidas)}</b> sem confirmação</span>
            <span><b>{n(r.puladas)}</b> não enviadas por regra</span>
            {r.excluidos > 0 && <span title={Object.entries(r.porMotivo).map(([m, q]) => `${meta.motivos[m] ?? m}: ${q}`).join('\n')}><b>{n(r.excluidos)}</b> fora do público (passe o mouse para ver os motivos)</span>}
          </div>
          <p className="dp-nota">{r.origem}</p>
        </section>
      )}

      {c.iniciadaEm && (c.canal ?? 'WHATSAPP') === 'WHATSAPP' && <Separar c={c} pode={pode} novaCom={novaCom} verQuemRespondeu={() => { setFiltro('RESPONDEU'); setPagina(0) }} />}

      <section className="pl-card" style={{ marginTop: 12 }}>
        <div className="dp-linha" style={{ justifyContent: 'space-between' }}>
          <div className="pl-card-title">Destinatários</div>
          <input className="pl-input" style={{ maxWidth: 240 }} placeholder="Buscar por nome ou final do telefone" value={busca} onChange={e => { setBusca(e.target.value); setPagina(0) }} />
        </div>
        <div className="dp-chips-filtro" role="group" aria-label="Filtrar destinatários">
          {[['', 'Todos'], ['EM_ANDAMENTO', 'Em andamento'], ['CONCLUIDO', 'Concluídos'], ['RESPONDEU', 'Responderam'], ['FALHOU', 'Falhou'], ['INTERROMPIDO', 'Interrompidos'], ['EXCLUIDO', 'Excluídos']].map(([v, rot]) => <button key={v} type="button" aria-pressed={filtro === v} className={filtro === v ? 'on' : ''} onClick={() => { setFiltro(v); setPagina(0) }}>{rot}</button>)}
        </div>
        {dest && (
          <div className="pl-table-wrap" style={{ marginTop: 8 }}>
            <table className="pl-table">
              <thead><tr><th>Contato</th><th>Situação</th><th>Última mensagem</th><th>Detalhe</th></tr></thead>
              <tbody>
                {dest.itens.map(d => {
                  const m = d.mensagens[0]
                  return (
                    <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => setDetalhe(d.id)} data-destinatario={d.status}>
                      <td>{d.nome ?? '—'} <span className="pl-hint pl-mono">{d.telefone.startsWith('ig:') ? 'Instagram' : d.telefone}</span></td>
                      <td>{ROTULO_DESTINATARIO[d.status] ?? d.status}{d.respondeuEm ? ` · respondeu ${dataHora(d.respondeuEm)}` : ''}</td>
                      <td>{m ? `${ROTULO_MENSAGEM[m.status] ?? m.status}${m.lidaEm ? ` ${dataHora(m.lidaEm)}` : m.entregueEm ? ` ${dataHora(m.entregueEm)}` : m.aceitaEm ? ` ${dataHora(m.aceitaEm)}` : ''}` : '—'}</td>
                      <td className="pl-hint">{d.motivoExclusao ? meta.motivos[d.motivoExclusao] ?? d.motivoExclusao : d.interrompidoPor ? `parou: ${ROTULO_INTERRUPCAO[d.interrompidoPor] ?? d.interrompidoPor}` : erroAmigavel(m?.ultimoErro)}</td>
                    </tr>
                  )
                })}
                {!dest.itens.length && <tr><td colSpan={4} className="pl-hint">{c.totais ? 'Ninguém neste filtro.' : 'O público ainda não foi preparado.'}</td></tr>}
              </tbody>
            </table>
            <Paginacao pagina={pagina} total={dest.total} porPagina={dest.porPagina} ir={setPagina} />
          </div>
        )}
      </section>

      {comercial && (
        <section className="pl-card" style={{ marginTop: 12 }} data-disparo-comercial>
          <div className="dp-ph"><b>Depois da campanha</b><span>{comercial.janelaDias} dias depois do início · correlação, não atribuição</span></div>
          <div className="dp-mini-numeros">
            {[['Leads que receberam', n(comercial.destinatariosComLead)], ['Avançaram de etapa', n(comercial.oportunidades)], ['Reativados', n(comercial.leadsReativados)], ['Fichas · aprovações', `${n(comercial.fichasDeCredito)} · ${n(comercial.aprovacoes)}`], ['Visitas', n(comercial.visitas)], ['Vendas', `${n(comercial.vendas)}${comercial.receita != null ? ` · ${comercial.receita.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ''}`]].map(([r1, v]) => <div key={r1}><span>{r1}</span><b>{v}</b></div>)}
          </div>
          <p className="pl-hint">{comercial.origem}</p>
        </section>
      )}

      <section className="pl-card" style={{ marginTop: 12 }} aria-label="Histórico da campanha">
        <div className="dp-ph"><b>Histórico da campanha</b><span>{eventos.length} registro(s)</span></div>
        <ul className="dp-linha-tempo">{eventos.map(e => <li key={e.id}><time title={new Date(e.criadoEm).toLocaleString('pt-BR')}>{quandoTexto(e.criadoEm)}</time><span>{e.descricao ?? e.tipo}{e.autorNome ? <span className="pl-hint"> · {e.autorNome}</span> : ''}</span></li>)}</ul>
        <details className="dp-detalhes" style={{ marginTop: 12 }}>
          <summary>Versões ({(c.versoes ?? []).length})</summary>
          <ul className="pl-hint">{(c.versoes ?? []).map(v => <li key={v.versao}>v{v.versao} · {dataHora(v.criadoEm)} · {v.motivo ?? ''}{v.autorNome ? ` · ${v.autorNome}` : ''}</li>)}</ul>
        </details>
      </section>
      {detalhe && <DetalheDestinatario id={detalhe} fechar={() => setDetalhe(null)} pode={pode} aoMudar={() => void carregar()} />}
    </div>
  )
}

function DetalheDestinatario({ id, fechar, pode, aoMudar }: { id: string; fechar: () => void; pode: boolean; aoMudar: () => void }) {
  const [d, setD] = useState<DetalheDestinatarioDisparo | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const carregar = useCallback(() => { disparoApi.destinatario(id).then(setD).catch(e => setErro(erroDe(e))) }, [id])
  useEffect(() => { carregar() }, [carregar])
  const confirmar = useConfirmar()
  async function decidir(mid: string, dec: 'REENVIAR' | 'CONSIDERAR_ENVIADA') {
    try { await disparoApi.decidir(mid, dec); carregar(); aoMudar() } catch (e) { setErro(erroDe(e)) }
  }
  return (
    <div className="pl-modal-backdrop" onClick={fechar}>
      <div className="pl-modal-panel pl-card dp-detalhe" onClick={e => e.stopPropagation()} role="dialog" aria-label="Destinatário">
        <div className="dp-linha" style={{ justifyContent: 'space-between' }}><b>{d?.nome ?? 'Destinatário'}</b><button type="button" className="pl-btn" onClick={fechar}>Fechar</button></div>
        {erro && <div className="pl-alert pl-alert-error">{erro}</div>}
        {!d ? <p className="pl-hint">Carregando…</p> : (
          <>
            <p className="pl-hint">{d.telefone.startsWith('ig:') ? 'Instagram (direct)' : d.telefone} · {ROTULO_DESTINATARIO[d.status] ?? d.status}{d.interrompidoPor ? ` (${ROTULO_INTERRUPCAO[d.interrompidoPor] ?? d.interrompidoPor})` : ''}{d.respondeuEm ? ` · respondeu ${dataHora(d.respondeuEm)}` : ''}{d.leadId ? ' · ' : ''}{d.leadId && <a href={`/pro-labore/leads?lead=${d.leadId}`}>abrir o lead</a>}</p>
            {d.mensagens.map(m => (
              <div key={m.id} className="dp-passo">
                <div className="dp-linha" style={{ justifyContent: 'space-between' }}><b>Mensagem {m.passo + 1}</b><span>{ROTULO_MENSAGEM[m.status] ?? m.status}</span></div>
                {m.texto && <p style={{ whiteSpace: 'pre-wrap', margin: '4px 0' }}>{m.texto}</p>}
                <p className="pl-hint">Na fila desde {dataHora(m.enviarApos)}{m.aceitaEm ? ` · aceita ${dataHora(m.aceitaEm)}` : ''}{m.entregueEm ? ` · entregue ${dataHora(m.entregueEm)}` : ''}{m.lidaEm ? ` · lida ${dataHora(m.lidaEm)}` : ''}{m.falhouEm ? ` · falhou ${dataHora(m.falhouEm)}` : ''}</p>
                {m.ultimoErro && <p className="pl-hint" style={{ color: 'var(--ar-estado-critico)' }} title={m.ultimoErro}>{erroAmigavel(m.ultimoErro)}</p>}
                {m.tentativasRegistro.length > 0 && <ul className="pl-hint" style={{ margin: 0, paddingLeft: 18 }}>{m.tentativasRegistro.map(t => <li key={`${t.numero}-${t.inicio}`}>tentativa {t.numero} · {dataHora(t.inicio)} · {t.resultado.toLowerCase().replace(/_/g, ' ')}{t.erro ? ` · ${erroAmigavel(t.erro)}` : ''}</li>)}</ul>}
                {pode && (m.status === 'DESCONHECIDO' || (m.status === 'FALHOU' && m.erroClasse === 'ESGOTOU')) && (
                  <div className="dp-linha">
                    <button type="button" className="pl-btn" onClick={() => void confirmar({ titulo: 'Reenviar esta mensagem?', texto: 'Se ela já tiver chegado, o cliente recebe duas vezes.', acao: 'Reenviar' }).then(ok => { if (ok) void decidir(m.id, 'REENVIAR') })}>Reenviar</button>
                    <button type="button" className="pl-btn" onClick={() => void decidir(m.id, 'CONSIDERAR_ENVIADA')}>Considerar enviada</button>
                  </div>
                )}
              </div>
            ))}
            {d.eventos.length > 0 && <><b>Eventos</b><ul className="pl-hint" style={{ margin: 0, paddingLeft: 18 }}>{d.eventos.map(e => <li key={e.id}>{dataHora(e.criadoEm)} · {e.descricao ?? e.tipo}</li>)}</ul></>}
          </>
        )}
      </div>
    </div>
  )
}

const ETAPAS: Array<{ rotulo: string; status: StatusCampanhaDisparo[] }> = [
  { rotulo: 'Montar', status: ['DRAFT', 'VALIDATING'] }, { rotulo: 'Revisar', status: ['NEEDS_REVIEW', 'READY'] }, { rotulo: 'Agendada / na fila', status: ['SCHEDULED', 'QUEUED'] }, { rotulo: 'Enviando', status: ['RUNNING', 'PAUSED'] }, { rotulo: 'Concluída', status: ['COMPLETED', 'COMPLETED_WITH_ERRORS', 'CANCELLED', 'ARCHIVED'] },
]
const TOM: Partial<Record<SituacaoEnvioDisparo['motivo'], string>> = { SEM_CONEXAO: 'critico', LIMITE_DIA: 'atencao', LIMITE_HORA: 'atencao', FORA_DA_JANELA: 'atencao', PAUSADA: 'atencao', ENVIANDO: 'bom', INTERVALO: 'bom' }
const haQuanto = (iso: string | null) => { if (!iso) return 'nunca'; const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000)); return s < 60 ? `há ${s} s` : s < 3600 ? `há ${Math.round(s / 60)} min` : `há ${Math.round(s / 3600)} h` }
const daquiA = (iso: string | null) => { if (!iso) return null; const s = Math.round((new Date(iso).getTime() - Date.now()) / 1000); return s <= 5 ? 'agora' : s < 60 ? `em ${s} s` : s < 3600 ? `em ${Math.round(s / 60)} min` : dataHora(iso) }

/** O que está acontecendo com o envio agora, em linguagem simples, e o caminho da campanha. */
function PainelAgora({ s, status, rodada }: { s: SituacaoEnvioDisparo; status: StatusCampanhaDisparo; rodada: { em: number; texto: string; erro: boolean } | null }) {
  const atual = ETAPAS.findIndex(e => e.status.includes(status))
  const prox = ['ENVIANDO', 'INTERVALO', 'NA_FILA', 'NA_HORA', 'ATENDIMENTO'].includes(s.motivo) ? daquiA(s.proximoEnvioEm) : null
  const ativo = ['PREPARANDO', 'NA_HORA', 'NA_FILA', 'ENVIANDO', 'INTERVALO', 'LIMITE_HORA', 'LIMITE_DIA', 'FORA_DA_JANELA', 'SEM_CONEXAO'].includes(s.motivo)
  return (
    <section className={`pl-card dp-agora ${TOM[s.motivo] ?? ''}`} aria-label="Situação do envio" data-situacao={s.motivo}>
      <ol className="dp-caminho">{ETAPAS.map((e, i) => <li key={e.rotulo} className={i < atual ? 'feita' : i === atual ? 'atual' : ''}>{e.rotulo}</li>)}</ol>
      <div className="dp-agora-titulo"><b>{s.titulo}</b>{prox && <span className="pl-hint"> · próxima mensagem {prox}</span>}</div>
      <p style={{ margin: '4px 0' }}>{s.texto}</p>
      <Cronometros s={s} status={status} proximaRodada={rodada ? rodada.em + 20_000 : null} />
      {rodada && <p className="pl-hint" style={{ margin: '0 0 4px', color: rodada.erro ? 'var(--ar-estado-critico)' : undefined }} role="status">Última rodada pedida por esta tela: {haQuanto(new Date(rodada.em).toISOString())} · {rodada.erro ? `erro: ${rodada.texto}` : rodada.texto}</p>}
      {ativo && (
        <p className="pl-hint" style={{ margin: 0 }}>
          {s.motor.rotinaParada
            ? <>Envio funcionando pelas telas abertas do ARIES (esta e as da equipe){s.motor.ultimaRodadaEm ? ` · última rodada ${haQuanto(s.motor.ultimaRodadaEm)}` : ''}. Para enviar mesmo com o sistema fechado por todos, ligue o “Envio automático” em Configurações.</>
            : <>Envio automático ligado (última rodada {haQuanto(s.motor.ultimaRotinaEm)}): pode fechar esta tela, o envio continua.</>}
        </p>
      )}
    </section>
  )
}

const relogio = (ms: number | null) => { if (ms == null || !Number.isFinite(ms)) return '—'; const t = Math.max(0, Math.round(ms / 1000)); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sg = t % 60; const p2 = (x: number) => String(x).padStart(2, '0'); if (h >= 24) return `${Math.floor(h / 24)} d ${h % 24} h`; return h ? `${h} h ${p2(m)} min` : `${p2(m)}:${p2(sg)}` }

/** Cronômetros ao vivo (atualizam a cada segundo): próxima mensagem, desde a última, tempo de envio e ritmo médio. */
function Cronometros({ s, status, proximaRodada }: { s: SituacaoEnvioDisparo; status: StatusCampanhaDisparo; proximaRodada: number | null }) {
  const [agora, setAgora] = useState(() => Date.now())
  const vivo = ['QUEUED', 'RUNNING', 'SCHEDULED', 'VALIDATING'].includes(status)
  useEffect(() => { if (!vivo) return; const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t) }, [vivo])
  const t = s.tempos
  if (!t) return null
  const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : null)
  // Se a hora prevista já passou, a mensagem sai na próxima rodada pedida pela tela (a cada 20 s).
  const previsto = ms(s.proximoEnvioEm)
  const prox = previsto != null && previsto <= agora && proximaRodada != null && proximaRodada > agora ? proximaRodada : previsto, ult = ms(t.ultimaEnviadaEm), prim = ms(t.primeiraEnviadaEm), ini = ms(t.iniciadaEm)
  const fimRef = vivo ? agora : (ult ?? agora)
  const ritmo = prim != null && ult != null && t.enviadas > 1 ? (ult - prim) / (t.enviadas - 1) : null
  const mostraProx = vivo && prox != null && ['ENVIANDO', 'INTERVALO', 'NA_FILA', 'NA_HORA', 'ATENDIMENTO', 'AGENDADA', 'FORA_DA_JANELA'].includes(s.motivo)
  return (
    <div className="dp-cronometros" aria-label="Cronômetros do envio" data-cronometros>
      <div><span>Próxima mensagem</span><b className="pl-mono">{mostraProx ? (prox! - agora <= 0 ? 'agora' : prox! - agora > 3600_000 ? new Date(prox!).toLocaleString('pt-BR', { weekday: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '') : relogio(prox! - agora)) : '—'}</b></div>
      <div><span>Desde a última enviada</span><b className="pl-mono">{ult != null ? relogio(fimRef - ult) : 'nenhuma ainda'}</b></div>
      <div><span>Tempo de envio</span><b className="pl-mono">{ini != null ? relogio(fimRef - ini) : '—'}</b></div>
      <div><span>Ritmo médio</span><b className="pl-mono">{ritmo != null ? `${relogio(ritmo)} / msg` : '—'}</b>{t.intervaloSeg != null && <small className="pl-hint">mínimo {t.intervaloSeg} s · {t.enviadas} enviada(s)</small>}</div>
    </div>
  )
}

/**
 * Depois do envio: separar quem respondeu de quem não respondeu, cada grupo virando o público de uma
 * campanha nova (base "contatos da campanha"). Os números são a prévia do servidor, com as mesmas
 * regras do envio (autorização, carteira, quem pediu para sair).
 */
function Separar({ c, pode, novaCom, verQuemRespondeu }: { c: CampanhaDisparo; pode: boolean; novaCom: (p: Partial<CampanhaDisparoEntrada>) => void; verQuemRespondeu: () => void }) {
  const [q, setQ] = useState<{ RESPONDERAM: number | null; NAO_RESPONDERAM: number | null }>({ RESPONDERAM: null, NAO_RESPONDERAM: null })
  const contar = useCallback(() => {
    for (const quem of ['RESPONDERAM', 'NAO_RESPONDERAM'] as const) {
      disparoApi.publicos.previa({ definicao: { base: 'CAMPANHA', campanha: { id: c.id, quem } }, finalidade: c.finalidade, conteudo: null, assistenteId: c.assistenteId })
        .then(r => setQ(x => ({ ...x, [quem]: r.elegiveis }))).catch(() => undefined)
    }
  }, [c.id, c.finalidade, c.assistenteId])
  useEffect(() => { contar() }, [contar])
  const nova = (quem: 'RESPONDERAM' | 'NAO_RESPONDERAM') => novaCom({
    nome: `${c.nome} · ${quem === 'RESPONDERAM' ? 'quem respondeu' : 'quem não respondeu'}`.slice(0, 120),
    objetivo: quem === 'RESPONDERAM' ? 'Dar sequência a quem respondeu' : 'Retomar quem não respondeu',
    finalidade: c.finalidade, canal: 'WHATSAPP', assistenteId: c.assistenteId, publicoId: null,
    publico: { base: 'CAMPANHA', campanha: { id: c.id, quem } },
    // Quem não respondeu e responder à primeira depois sai da sequência nova.
    config: quem === 'NAO_RESPONDERAM' ? { pararAoSairDoPublico: true } : {},
  })
  return (
    <section className="pl-card dp-separar" style={{ marginTop: 12 }} data-separar-respostas>
      <div className="dp-ph"><b>Separar quem respondeu</b><span>cada grupo pode virar uma campanha nova, com a mensagem certa para ele</span></div>
      <div className="dp-separar-grupos">
        {([['RESPONDERAM', 'Responderam', 'Dê sequência: condições, simulação, convite para a loja.'], ['NAO_RESPONDERAM', 'Não responderam', 'Receberam e não responderam. Tente outra abordagem, em outro dia ou horário.']] as const).map(([quem, titulo, dica]) => (
          <div key={quem} className="dp-separar-grupo" data-grupo={quem}>
            <span className="dp-config-rotulo">{titulo}</span>
            <b>{q[quem] == null ? '…' : n(q[quem]!)}</b>
            <small className="pl-hint">{dica}</small>
            <div className="dp-linha">
              {pode && <button type="button" className="pl-btn pl-btn-primary" disabled={!q[quem]} onClick={() => nova(quem)} data-nova-para={quem}>Criar campanha</button>}
              {quem === 'RESPONDERAM' && <button type="button" className="pl-btn pl-btn-ghost" onClick={verQuemRespondeu}>Ver quem</button>}
            </div>
          </div>
        ))}
      </div>
      <p className="pl-hint">Conta só quem recebeu esta campanha e ainda pode receber agora (quem pediu para sair fica de fora). Também dá para montar esses públicos em Públicos › Novo público › aba “De uma campanha”.</p>
    </section>
  )
}
