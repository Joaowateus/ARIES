'use client'

// Painel do lead na jornada de 10 etapas (PDF 01, seção 7): o que falta para
// avançar, atividades da etapa, propostas, visitas com check-in e falta, e
// a passagem do SDR para o vendedor (e a devolução, com motivo).
import { useCallback, useEffect, useState } from 'react'
import { proLaboreApi, type DetalheJornada, type ErroApi, type EtapaJornada, type Lead } from '@/lib/proLaboreApi'
import { ETAPAS_JORNADA, NOME_ETAPA } from '@/lib/etapasJornada'
import { FollowRoboModal, SeloRobo } from '../_jornada/FollowRobo'

const brl = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const quando = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—')
const num = (s: string) => { const n = Number(s.replace(/\./g, '').replace(',', '.')); return s.trim() && Number.isFinite(n) ? n : null }

export function JornadaPainel({ lead, onMudou }: { lead: Lead; onMudou: () => void }) {
  const [d, setD] = useState<DetalheJornada | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [msgProposta, setMsgProposta] = useState<{ id: string; texto: string } | null>(null)
  const [prop, setProp] = useState({ preco: '', entrada: '', parcela: '', prazo: '', validade: '' })
  const [visitaEm, setVisitaEm] = useState('')
  const [resultado, setResultado] = useState('')
  const [resumo, setResumo] = useState('')
  const [motivo, setMotivo] = useState('')
  const [destino, setDestino] = useState<EtapaJornada | ''>('')

  const carregar = useCallback(() => proLaboreApi.jornada.detalhe(lead.id).then(setD).catch(e => setErro(e instanceof Error ? e.message : 'Erro')), [lead.id])
  useEffect(() => { void carregar() }, [carregar])
  async function executar(fn: () => Promise<unknown>) {
    setErro(null)
    try { await fn(); await carregar(); onMudou() } catch (e) {
      const f = ((e as ErroApi).dados as { faltando?: string[] } | undefined)?.faltando
      setErro(f?.length ? `${(e as Error).message}: ${f.join(' · ')}` : e instanceof Error ? e.message : 'Não foi possível')
    }
  }
  if (!d) return erro ? <div className="pl-alert">{erro}</div> : null
  const etapa = d.checklist.etapa, i = ETAPAS_JORNADA.indexOf(etapa)
  const aberta = d.visitas.find(v => !v.checkinEm && !v.falta)
  const comCheckin = d.visitas.find(v => v.checkinEm && !v.resultado)

  return (
    <div data-jornada-painel>
      <section className="pl-pn-bloco">
        <h3>Jornada · {i + 1}. {NOME_ETAPA[etapa]}</h3>
        {(d.checklist.pendencias ?? []).length > 0 && (
          <div className="pn-pendencias" data-pendencias-painel>
            <b>Pendente nesta etapa</b>
            <ul>{d.checklist.pendencias!.map(p => <li key={p}>{p}</li>)}</ul>
            <span className="pl-hint">O lead avançou assim mesmo. Quando você registrar o que falta, o selo some sozinho.</span>
          </div>
        )}
        {d.checklist.proximas.map(p => (
          <div key={p.etapa} className="pn-proxima" data-proxima={p.etapa}>
            <b>{NOME_ETAPA[p.etapa]}</b>
            {p.faltando.length ? (
              <>
                <button type="button" className="pl-btn pl-btn-primary" style={{ padding: '2px 10px' }} onClick={() => void executar(() => proLaboreApi.jornada.mover(lead.id, p.etapa, undefined, true))} title="Avança e deixa o que falta como pendência" data-painel-forcar={p.etapa}>Avançar →</button>
                <span className="pl-hint">o que fazer: {p.faltando.join(' · ')}</span>
              </>
            ) : (
              <button type="button" className="pl-btn pl-btn-primary" style={{ padding: '2px 10px' }} onClick={() => void executar(() => proLaboreApi.jornada.mover(lead.id, p.etapa))} data-painel-mover={p.etapa}>Avançar →</button>
            )}
          </div>
        ))}
        {etapa !== 'VENDA' && (
          <div className="pn-mover-livre" data-mover-livre>
            <label className="pl-hint" htmlFor="pn-destino">Mover para outra etapa</label>
            <select id="pn-destino" className="pl-select" value={destino} onChange={e => setDestino(e.target.value as EtapaJornada | '')}>
              <option value="">Escolher…</option>
              {ETAPAS_JORNADA.filter(e => e !== etapa && e !== 'VENDA').map(e => <option key={e} value={e}>{ETAPAS_JORNADA.indexOf(e) + 1}. {NOME_ETAPA[e]}</option>)}
            </select>
            <button type="button" className="pl-btn" disabled={!destino} onClick={() => { if (destino) void executar(() => proLaboreApi.jornada.mover(lead.id, destino, undefined, true)).then(() => setDestino('')) }} data-mover-livre-ok>Mover</button>
          </div>
        )}
        {d.atividades.length > 0 && (
          <div style={{ marginTop: 8 }} data-atividades>
            <div className="pl-eyebrow">Atividades</div>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{d.atividades.map(a => <li key={a.id}>{a.nota} · {quando(a.agendadoPara)}</li>)}</ul>
          </div>
        )}
        {erro && <div className="pl-alert" role="alert" style={{ marginTop: 8 }}>{erro}</div>}
      </section>

      <PreVendaRobo lead={lead} onMudou={onMudou} />

      {(d.podePassar || d.podeDevolver || d.passagens.length > 0) && (
        <section className="pl-pn-bloco" data-passagem>
          <h3>Passagem SDR → vendedor</h3>
          {d.passagens.map(p => <p key={p.id} className="pl-hint">{quando(p.passadaEm)} · {p.sdrNome ?? 'SDR'} → {p.vendedorNome ?? 'vendedor'}{p.devolvida ? ` · devolvido: ${p.motivoDevolucao}` : ''}</p>)}
          {d.podePassar && (<>
            <textarea className="pl-input" rows={2} placeholder="Resumo da qualificação (modelo, pagamento, aprovação, observações)" value={resumo} onChange={e => setResumo(e.target.value)} data-resumo />
            <button type="button" className="pl-btn pl-btn-primary" style={{ marginTop: 6 }} onClick={() => void executar(() => proLaboreApi.jornada.acao(lead.id, 'passar', { resumo }))} data-passar>Passar ao vendedor</button>
          </>)}
          {d.podeDevolver && etapa !== 'VENDA' && (<>
            <input className="pl-input" placeholder="Por que o lead não estava qualificado?" value={motivo} onChange={e => setMotivo(e.target.value)} data-motivo-devolucao />
            <button type="button" className="pl-btn pl-btn-ghost" style={{ marginTop: 6 }} onClick={() => void executar(() => proLaboreApi.jornada.acao(lead.id, 'devolver', { motivo }))} data-devolver>Devolver ao SDR</button>
          </>)}
        </section>
      )}

      {(etapa === 'NEGOCIACAO' || etapa === 'PROPOSTA' || d.propostas.length > 0) && (
        <section className="pl-pn-bloco" data-propostas>
          <h3>Propostas</h3>
          {d.propostas.map(p => (
            <div key={p.id} className="pl-hint" style={{ marginBottom: 4 }}>
              {brl(p.preco)} · entrada {brl(p.entrada)} · parcela {brl(p.parcela)}{p.prazo ? ` em ${p.prazo}x` : ''}{p.validade ? ` · válida até ${new Date(p.validade).toLocaleDateString('pt-BR')}` : ''}
              {' · '}{p.enviadaEm ? `enviada ${quando(p.enviadaEm)}` : 'não enviada'}{p.resultado ? ` · ${p.resultado.toLowerCase()}` : ''}
              {p.enviadaEm && !p.resultado && <> {(['ACEITA', 'RECUSADA'] as const).map(r => <button key={r} type="button" className="pl-link-action" style={{ marginLeft: 8 }} onClick={() => void executar(() => proLaboreApi.jornada.respostaProposta(p.id, r))}>{r === 'ACEITA' ? 'aceitou' : 'recusou'}</button>)}</>}
            </div>
          ))}
          {(etapa === 'NEGOCIACAO' || etapa === 'PROPOSTA') && (
            <form onSubmit={e => { e.preventDefault(); const preco = num(prop.preco); if (!preco) { setErro('Informe o preço'); return }
              void executar(async () => { const r = await proLaboreApi.jornada.proposta(lead.id, { preco, entrada: num(prop.entrada), parcela: num(prop.parcela), prazo: num(prop.prazo), validade: prop.validade || null }); setMsgProposta({ id: r.proposta.id, texto: r.mensagem }); setProp({ preco: '', entrada: '', parcela: '', prazo: '', validade: '' }) }) }}
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }} data-form-proposta>
              <input className="pl-input" placeholder="Preço" value={prop.preco} onChange={e => setProp({ ...prop, preco: e.target.value })} data-preco />
              <input className="pl-input" placeholder="Entrada" value={prop.entrada} onChange={e => setProp({ ...prop, entrada: e.target.value })} />
              <input className="pl-input" placeholder="Parcela" value={prop.parcela} onChange={e => setProp({ ...prop, parcela: e.target.value })} />
              <input className="pl-input" placeholder="Prazo (meses)" value={prop.prazo} onChange={e => setProp({ ...prop, prazo: e.target.value })} />
              <label className="pl-hint" style={{ gridColumn: '1 / -1' }}>Válida até <input type="date" className="pl-input" value={prop.validade} onChange={e => setProp({ ...prop, validade: e.target.value })} /></label>
              <button type="submit" className="pl-btn pl-btn-primary" style={{ gridColumn: '1 / -1' }} data-registrar-proposta>Registrar proposta</button>
            </form>
          )}
          {msgProposta && (
            <div style={{ marginTop: 8 }} data-mensagem-proposta>
              <div className="pl-eyebrow">Mensagem para o cliente (confira antes de enviar)</div>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: '4px 0' }}>{msgProposta.texto}</pre>
              <button type="button" className="pl-btn pl-btn-ghost" onClick={() => { void navigator.clipboard?.writeText(msgProposta.texto) }}>Copiar</button>{' '}
              <button type="button" className="pl-btn pl-btn-primary" onClick={() => void executar(async () => { await proLaboreApi.jornada.propostaEnviada(msgProposta.id); setMsgProposta(null) })} data-proposta-enviada>Aprovei e enviei</button>
            </div>
          )}
        </section>
      )}

      {(etapa === 'PROPOSTA' || etapa === 'AGENDAMENTO' || etapa === 'VISITA' || d.visitas.length > 0) && (
        <section className="pl-pn-bloco" data-visitas>
          <h3>Visita à loja</h3>
          {d.visitas.map(v => <p key={v.id} className="pl-hint">{quando(v.marcadaPara)}{v.remarcacoes ? ` · ${v.remarcacoes} remarcação(ões)` : ''} · {v.checkinEm ? `chegou ${quando(v.checkinEm)}` : v.falta ? 'faltou' : 'marcada'}{v.resultado ? ` · ${v.resultado}` : ''}</p>)}
          {(etapa === 'PROPOSTA' || etapa === 'AGENDAMENTO') && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <input type="datetime-local" className="pl-input" value={visitaEm} onChange={e => setVisitaEm(e.target.value)} data-visita-em />
              <button type="button" className="pl-btn pl-btn-primary" onClick={() => void executar(() => proLaboreApi.jornada.acao(lead.id, 'visita', { marcadaPara: visitaEm ? new Date(visitaEm).toISOString() : '' }))} data-marcar-visita>{aberta ? 'Remarcar' : 'Marcar visita'}</button>
            </div>
          )}
          {aberta && (
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button type="button" className="pl-btn pl-btn-primary" onClick={() => void executar(() => proLaboreApi.jornada.acao(lead.id, 'checkin'))} data-checkin>Check-in: cliente chegou</button>
              <button type="button" className="pl-btn pl-btn-ghost" onClick={() => void executar(() => proLaboreApi.jornada.acao(lead.id, 'falta'))} data-falta>Faltou</button>
            </div>
          )}
          {comCheckin && (
            <div style={{ marginTop: 6 }}>
              <textarea className="pl-input" rows={2} placeholder="Resultado da visita (registre no mesmo dia)" value={resultado} onChange={e => setResultado(e.target.value)} data-resultado-visita />
              <button type="button" className="pl-btn pl-btn-ghost" style={{ marginTop: 6 }} onClick={() => void executar(() => proLaboreApi.jornada.acao(lead.id, 'resultado-visita', { resultado }))} data-salvar-resultado>Salvar resultado</button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

const NOME_CNH: Record<string, string> = { TEM: 'tem CNH', EM_PROCESSO: 'tirando a CNH', NAO_TEM: 'sem CNH' }
/** Pré-venda do robô (Ajuste 3): a ficha que ele levantou, o robô (pausar/retomar) e o follow pelo robô. */
function PreVendaRobo({ lead, onMudou }: { lead: Lead; onMudou: () => void }) {
  const [abrirFollow, setAbrirFollow] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const lv = lead.levantamento ?? {}
  const pv = lead.preVenda
  const temFicha = !!(lead.modeloInteresse || lead.formaPagamento || lead.situacaoCnh || lv.entradaValor || lv.parcelaDesejada)
  if (!pv && !temFicha) return null
  async function agir(fn: () => Promise<unknown>) { setErro(null); try { await fn(); onMudou() } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível') } }
  const cad = pv?.cadencia
  const linhas: Array<[string, string]> = [
    ['Moto', lead.modeloInteresse ?? '—'],
    ['Pagamento', lead.formaPagamento === 'A_VISTA' ? 'à vista' : lead.formaPagamento === 'FINANCIADO' ? 'financiado' : '—'],
    ...(lead.formaPagamento !== 'A_VISTA' ? [['Entrada', lead.temEntrada === false ? 'sem entrada' : lv.entradaValor ? brl(lv.entradaValor) : lead.temEntrada ? 'tem (valor a confirmar)' : '—'] as [string, string]] : []),
    ...(lv.parcelaDesejada ? [['Parcela que cabe', `até ${brl(lv.parcelaDesejada)}/mês`] as [string, string]] : []),
    ...(lv.prazoMeses ? [['Prazo', `${lv.prazoMeses} meses`] as [string, string]] : []),
    ['CNH', lead.situacaoCnh ? NOME_CNH[lead.situacaoCnh] ?? lead.situacaoCnh : '—'],
    ...(lv.troca ? [['Troca', lv.troca] as [string, string]] : []),
    ...(lv.cidade ? [['Cidade', lv.cidade] as [string, string]] : []),
    ...(lv.melhorHorario ? [['Melhor horário', lv.melhorHorario] as [string, string]] : []),
  ]
  return (
    <section className="pl-pn-bloco" data-prevenda-robo>
      <h3>Pré-venda do robô{lv.prontoEm ? ' · pronto para simular' : ''}</h3>
      <SeloRobo lead={lead} />
      <dl className="pn-ficha" data-ficha-simular>{linhas.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      <div className="pn-robo-botoes">
        {pv?.robo && pv.robo.codigo !== 'PAUSADO' && pv.robo.codigo === 'COLETANDO' && <button type="button" className="pl-btn" onClick={() => void agir(() => proLaboreApi.jornada.robo(lead.id, 'pausar'))} data-pausar-robo>Pausar robô</button>}
        {pv?.robo?.codigo === 'PAUSADO' && <button type="button" className="pl-btn" onClick={() => void agir(() => proLaboreApi.jornada.robo(lead.id, 'retomar'))} data-retomar-robo>Retomar robô</button>}
        {cad?.status === 'ATIVO' && <button type="button" className="pl-btn" onClick={() => void agir(() => proLaboreApi.jornada.mudarCadencia(lead.id, 'pausar'))} data-pausar-cadencia>Pausar follow</button>}
        {cad?.status === 'PAUSADO' && <button type="button" className="pl-btn" onClick={() => void agir(() => proLaboreApi.jornada.mudarCadencia(lead.id, 'retomar'))} data-retomar-cadencia>Retomar follow</button>}
        {(cad?.status === 'ATIVO' || cad?.status === 'PAUSADO') && <button type="button" className="pl-btn pl-btn-ghost" onClick={() => void agir(() => proLaboreApi.jornada.mudarCadencia(lead.id, 'cancelar'))} data-cancelar-cadencia>Cancelar follow</button>}
        {cad?.status !== 'ATIVO' && cad?.status !== 'PAUSADO' && <button type="button" className="pl-btn pl-btn-primary" onClick={() => setAbrirFollow(true)} data-abrir-follow-robo>Follow pelo robô</button>}
      </div>
      {erro && <div className="pl-alert" role="alert">{erro}</div>}
      {abrirFollow && <FollowRoboModal leads={[{ id: lead.id, nome: lead.nomeCliente }]} fechar={() => setAbrirFollow(false)} aoAplicar={onMudou} />}
    </section>
  )
}
