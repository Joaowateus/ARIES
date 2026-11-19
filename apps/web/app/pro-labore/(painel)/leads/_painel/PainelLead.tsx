'use client'

// Painel lateral do lead (abre com um clique no card). 19/11: gaveta de 480px
// (tela cheia no celular) com cabeçalho fixo — nome, etapa, temperatura, tempo
// na etapa, "O que fazer", Avançar, WhatsApp e + Follow — e quatro abas:
// Resumo (linha do tempo das etapas, ficha única do cliente, passagem,
// propostas e visita), Conversa (WhatsApp e robô), Atividades (follows,
// ligações e notas numa lista só) e Histórico. As ações menos usadas ficam no "⋯".
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { proLaboreApi, type DetalheJornada, type EstagioLead, type EtapaJornada, type Lead, type PremissasJornada, type TipoNegociacao } from '@/lib/proLaboreApi'
import { ETAPAS_JORNADA, NOME_ETAPA } from '@/lib/etapasJornada'
import { linkWhatsapp } from '../../_follow/follow'
import { ChipNota } from '../../assistente/_componentes/SugestoesConversa'
import { EtiquetasLead } from '../../assistente/_componentes/jornada'
import { QualidadeLead } from './QualidadeLead'
import { JornadaPainel } from './JornadaPainel'
import { AtividadesLead } from './AtividadesLead'
import { PerfilCliente, PrepararComAries } from './PerfilEPrompts'
import { ModalLevantamento, NOME_TEMP, O_QUE_FAZER, calorDe, motoValida, nomeLimpo } from '../_jornada/QuadroJornada'
import { estourou, tempoNaEtapa } from '../_jornada/tempo'

const ORIGEM_LEAD: Record<string, string> = { TRAFEGO: 'Tráfego pago', ORGANICO: 'Orgânico' }
const NEGOCIACAO: Record<TipoNegociacao, string> = { P: 'Pagamento integral', R: 'Renegociação' }
const NOME_CNH: Record<string, string> = { TEM: 'Tem CNH', EM_PROCESSO: 'Tirando a CNH', NAO_TEM: 'Sem CNH' }
const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
// Último avanço foi do assistente, há menos de 3 dias e o lead continua lá: dá para desfazer.
function avancoDesfazivel(lead: Lead) {
  const ultimo = lead.historico?.at(-1)
  return !!ultimo && ultimo.origem === 'ASSISTENTE' && (ultimo.estagioNovo === lead.estagio || ultimo.estagioNovo === (lead.etapa as string)) && !lead.vendaId && Date.now() - new Date(ultimo.criadoEm).getTime() < 3 * 86_400_000
}

type Aba = 'resumo' | 'conversa' | 'atividades' | 'historico'
const ABAS: Array<[Aba, string]> = [['resumo', 'Resumo'], ['conversa', 'Conversa'], ['atividades', 'Atividades'], ['historico', 'Histórico']]
const abaSalva = (): Aba => { try { const a = sessionStorage.getItem('pl_lead_aba'); return (ABAS.some(([k]) => k === a) ? a : 'resumo') as Aba } catch { return 'resumo' } }

export interface PainelLeadProps {
  onJornadaMudou?: () => void
  lead: Lead
  colunas: Array<{ estagio: EstagioLead; titulo: string }>
  isDono: boolean
  vejaEquipe: boolean
  // Aberto pelo botão "Notas" do card: já leva para o campo da nota (aba Atividades).
  focarNota: boolean
  podeEscrever: boolean
  premissas?: PremissasJornada | null
  onContagemNotas: (n: number) => void
  // Ligação agendada/registrada: o card atualiza o selo da próxima ligação.
  onLigacoesMudaram: () => void
  onFechar: () => void
  onMover: (estagio: EstagioLead) => void
  onConverter: () => void
  onEditar: () => void
  onPerdido: () => void
  onFollow: () => void
  onDesfazer: () => void
  onRemover: () => void
  onDefinirTipoNegociacao: (tipo: TipoNegociacao) => void
  /** Conteúdo extra no cabeçalho (perfil do cliente) e no Resumo (preparar com o ARIES). */
  extraCabecalho?: React.ReactNode
  extraResumo?: React.ReactNode
}

export function PainelLead(p: PainelLeadProps) {
  const { lead, colunas, isDono, vejaEquipe, focarNota, podeEscrever, premissas = null, onFechar } = p
  const [aba, setAbaEstado] = useState<Aba>(() => (focarNota ? 'atividades' : abaSalva()))
  const setAba = (a: Aba) => { setAbaEstado(a); try { sessionStorage.setItem('pl_lead_aba', a) } catch { /* sem armazenamento */ } }
  useEffect(() => { if (focarNota) setAbaEstado('atividades') }, [focarNota])
  const [menu, setMenu] = useState(false)
  const [moverLista, setMoverLista] = useState(false)
  const [levantamento, setLevantamento] = useState(false)
  const [d, setD] = useState<DetalheJornada | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [nAtiv, setNAtiv] = useState<number | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const recarregar = useCallback(() => (lead.etapa ? proLaboreApi.jornada.detalhe(lead.id).then(setD).catch(e => setErro(e instanceof Error ? e.message : 'Erro')) : Promise.resolve()), [lead.id, lead.etapa])
  // Recarrega o detalhe quando o lead muda de etapa (a lista do CRM atualiza por baixo).
  useEffect(() => { void recarregar() }, [recarregar, lead.etapa, lead.entrouNaEtapaEm])

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; if (menu) { setMenu(false); setMoverLista(false) } else onFechar() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onFechar, menu])
  useEffect(() => {
    if (!menu) return
    const fora = (e: PointerEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) { setMenu(false); setMoverLista(false) } }
    document.addEventListener('pointerdown', fora)
    return () => document.removeEventListener('pointerdown', fora)
  }, [menu])

  const aberto = !lead.vendaId && lead.estagio !== 'PERDIDO'
  const etapa = (lead.etapa ?? null) as EtapaJornada | null
  const idx = etapa ? ETAPAS_JORNADA.indexOf(etapa) : colunas.findIndex(c => c.estagio === lead.estagio)
  const total = etapa ? ETAPAS_JORNADA.length : colunas.length
  const limite = estourou(lead, premissas)
  const temp = calorDe(lead)
  const desfazivel = avancoDesfazivel(lead)
  const conversa = lead.conversa
  const whats = linkWhatsapp(lead.telefone)
  const linkConversa = conversa ? `/pro-labore/whatsapp?conversa=${conversa.id}${lead.vendedorId ? `&vendedor=${lead.vendedorId}` : ''}` : null
  // Próxima etapa: a do checklist da API (à vista pula para a Negociação) ou a seguinte na ordem.
  const proxEtapa: EtapaJornada | null = etapa ? (d?.checklist.proximas[0]?.etapa ?? (idx + 1 < ETAPAS_JORNADA.length ? ETAPAS_JORNADA[idx + 1] : null)) : null
  const proxColuna = !etapa && idx >= 0 ? colunas[idx + 1] : undefined
  const pend = d?.checklist.pendencias ?? lead.pendenciasEtapa ?? []
  const faltando = d?.checklist.proximas[0]?.faltando ?? []
  const oQueFazer = etapa === 'VENDA' ? 'Venda concluída' : pend.length ? `resolver ${pend.join(' · ')}` : faltando.length ? faltando.join(' · ') : etapa ? O_QUE_FAZER[etapa] : null
  // Data de entrada em cada etapa (do histórico que já existe).
  const entradaEm = (e: string) => [...(lead.historico ?? [])].reverse().find(h => h.estagioNovo === e)?.criadoEm ?? null

  async function avancar() {
    if (etapa && proxEtapa) {
      if (proxEtapa === 'VENDA') { p.onConverter(); return }
      setOcupado(true); setErro(null)
      try { await proLaboreApi.jornada.mover(lead.id, proxEtapa, undefined, true); await recarregar(); p.onJornadaMudou?.() } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível avançar') } finally { setOcupado(false) }
    } else if (proxColuna) p.onMover(proxColuna.estagio)
  }
  async function moverPara(e: EtapaJornada) {
    setMenu(false); setMoverLista(false); setErro(null)
    try { await proLaboreApi.jornada.mover(lead.id, e, undefined, true); await recarregar(); p.onJornadaMudou?.() } catch (er) { setErro(er instanceof Error ? er.message : 'Não foi possível mover') }
  }
  const rotuloAvancar = etapa ? (proxEtapa ? (proxEtapa === 'VENDA' ? 'Registrar venda' : `Avançar para ${NOME_ETAPA[proxEtapa]}`) : null) : proxColuna && proxColuna.estagio !== 'FECHADO' ? `Avançar para ${proxColuna.titulo}` : null

  const lv = lead.levantamento ?? {}
  const ficha: Array<[string, React.ReactNode]> = [
    ['Moto', motoValida(lead.modeloInteresse) ? lead.modeloInteresse : <i className="pl-hint" title={lead.modeloInteresse ?? ''}>não informada</i>],
    ['Valor', lead.valorNegociacao > 0 ? <span className="pl-mono">{moeda(lead.valorNegociacao)}</span> : '—'],
    ['Pagamento', lead.formaPagamento === 'A_VISTA' ? 'À vista' : lead.formaPagamento === 'FINANCIADO' ? 'Financiado' : '—'],
    ...(lead.formaPagamento !== 'A_VISTA' ? [['Entrada', lead.temEntrada === false ? 'Sem entrada' : lv.entradaValor ? moeda(lv.entradaValor) : lead.temEntrada ? 'Tem (valor a confirmar)' : '—'] as [string, React.ReactNode]] : []),
    ...(lv.parcelaDesejada ? [['Parcela que cabe', `até ${moeda(lv.parcelaDesejada)}/mês`] as [string, React.ReactNode]] : []),
    ...(lv.prazoMeses ? [['Prazo', `${lv.prazoMeses} meses`] as [string, React.ReactNode]] : []),
    ['CNH', lead.situacaoCnh ? NOME_CNH[lead.situacaoCnh] ?? lead.situacaoCnh : '—'],
    ...(lv.troca ? [['Troca', lv.troca] as [string, React.ReactNode]] : []),
    ...(lv.cidade ? [['Cidade', lv.cidade] as [string, React.ReactNode]] : []),
    ['Melhor horário', lv.melhorHorario ?? '—'],
    ['Origem', [lead.origemCadastro === 'WHATSAPP' ? 'WhatsApp (entrou sozinho)' : 'Cadastro manual', lead.tipoLead ? ORIGEM_LEAD[lead.tipoLead] : null, lead.origemCampanha ? `anúncio ${lead.origemCampanha}` : null, lead.postCode ? `Instagram ${lead.postCode}` : null].filter(Boolean).join(' · ')],
    ...(lead.email ? [['E-mail', lead.email] as [string, React.ReactNode]] : []),
  ]

  return (
    <>
    <div className="pl-pn-fundo" onClick={onFechar}>
      <aside className="pl-pn pn2" role="dialog" aria-modal="true" aria-label={`Lead ${lead.nomeCliente}`} onClick={e => e.stopPropagation()} data-painel-lead>
        <header className="pn2-cab">
          <div className="pn2-l1">
            <div className="pl-pn-quem">
              <h2>{nomeLimpo(lead) ?? 'Sem nome'}</h2>
              <div className="pl-pn-sub">
                {lead.telefone && <span className="pl-mono">{lead.telefone}</span>}
                {vejaEquipe && lead.vendedor && <span>· {lead.vendedor.nome}</span>}
                <span>· entrou em {dataHora(lead.criadoEm)}</span>
              </div>
            </div>
            <div className="qj-menu-wrap" ref={menuRef}>
              <button type="button" className="pl-pn-fechar" onClick={() => setMenu(v => !v)} aria-label="Mais ações do lead" aria-expanded={menu} data-menu-painel>⋯</button>
              {menu && (
                <div className="qj-menu pn2-menu" role="menu">
                  {isDono && aberto && <button type="button" role="menuitem" onClick={() => { setMenu(false); p.onConverter() }} className="pl-pn-converter" data-converter>✓ Converter em venda</button>}
                  {podeEscrever && <button type="button" role="menuitem" onClick={() => { setMenu(false); p.onEditar() }} data-editar>Editar</button>}
                  {aberto && podeEscrever && <button type="button" role="menuitem" aria-expanded={moverLista} onClick={() => setMoverLista(v => !v)} data-mover-livre>Mover para outra etapa {moverLista ? '▴' : '▾'}</button>}
                  {moverLista && (etapa
                    ? ETAPAS_JORNADA.filter(e => e !== etapa && e !== 'VENDA').map(e => <button key={e} type="button" role="menuitem" className="pn2-sub" onClick={() => void moverPara(e)} data-mover-para={e}>{ETAPAS_JORNADA.indexOf(e) + 1}. {NOME_ETAPA[e]}</button>)
                    : colunas.filter(c => c.estagio !== lead.estagio && (c.estagio !== 'FECHADO' || isDono)).map(c => <button key={c.estagio} type="button" role="menuitem" className="pn2-sub" onClick={() => { setMenu(false); p.onMover(c.estagio) }}>{c.titulo}</button>))}
                  {aberto && podeEscrever && !!etapa && <button type="button" role="menuitem" onClick={() => { setMenu(false); setLevantamento(true) }} data-levantamento>Levantamento</button>}
                  {desfazivel && <button type="button" role="menuitem" onClick={() => { setMenu(false); p.onDesfazer() }} data-desfazer>Desfazer avanço automático</button>}
                  {aberto && podeEscrever && <button type="button" role="menuitem" className="pl-as-perigo" onClick={() => { setMenu(false); p.onPerdido() }} data-perdido>Marcar como perdido</button>}
                  {aberto && podeEscrever && <button type="button" role="menuitem" className="pl-as-perigo" onClick={() => { setMenu(false); p.onRemover() }} data-remover>Remover</button>}
                </div>
              )}
            </div>
            <button type="button" className="pl-pn-fechar" onClick={onFechar} aria-label="Fechar painel">✕</button>
          </div>

          <div className="pn2-l2">
            {idx >= 0 && <span className="pn2-etapa" data-etapa-painel>Etapa {idx + 1} · {etapa ? NOME_ETAPA[etapa] : colunas[idx]?.titulo}</span>}
            {lead.estagio === 'PERDIDO' && <span className="pn2-etapa">Perdido</span>}
            <span className={`pn2-temp qj-${temp.toLowerCase()}`} title={lead.calor?.motivo ?? ''}><i aria-hidden />{NOME_TEMP[temp]}{typeof lead.pontuacao === 'number' ? ` · ${lead.pontuacao} pts` : ''}</span>
            {aberto && <span className={`pl-kanban-card-time ${limite?.parado ? 'stale' : ''}`} title={limite ? `Tempo nesta etapa · máx. ${limite.max}` : 'Tempo nesta etapa'} data-tempo-etapa={limite?.parado ? 'parado' : 'ok'}>{tempoNaEtapa(lead)} na etapa</span>}
          </div>
          {aberto && <PerfilCliente key={lead.id} lead={lead} podeEscrever={podeEscrever} onMudou={() => p.onJornadaMudou?.()} />}
          {p.extraCabecalho}
          {aberto && oQueFazer && <div className={`pn2-fazer ${pend.length ? 'pend' : ''}`} data-o-que-fazer><b>O que fazer:</b> {oQueFazer}</div>}
          {lead.vendaId && <div className="pl-pn-venda">✓ Convertido em venda</div>}
          {desfazivel && (
            <div className="pl-kanban-card-auto" data-avanco-auto>
              <span>Movido pelo assistente: {lead.historico?.at(-1)?.motivo}</span>
              <button type="button" className="pl-link-action" onClick={p.onDesfazer} data-desfazer>Desfazer</button>
            </div>
          )}
          {aberto && (
            <div className="pn2-botoes">
              {rotuloAvancar && podeEscrever && <button type="button" className="pl-btn pl-btn-primary pn2-avancar" disabled={ocupado} onClick={() => void avancar()} data-painel-avancar>{rotuloAvancar} →</button>}
              {linkConversa ? <Link className="pl-btn" href={linkConversa}>WhatsApp</Link> : whats ? <a className="pl-btn" href={whats} target="_blank" rel="noreferrer">WhatsApp</a> : null}
              <button type="button" className="pl-btn" onClick={p.onFollow} data-painel-follow>+ Follow</button>
            </div>
          )}
          {erro && <div className="pl-alert" role="alert">{erro}</div>}
          <div className="pn2-abas" role="tablist" aria-label="Seções do lead">
            {ABAS.map(([k, nome]) => (
              <button key={k} type="button" role="tab" id={`pn2-aba-${k}`} aria-selected={aba === k} aria-controls={`pn2-pagina-${k}`} tabIndex={aba === k ? 0 : -1} className={aba === k ? 'ativo' : ''}
                onClick={() => setAba(k)}
                onKeyDown={e => { if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; const i = ABAS.findIndex(([x]) => x === k); const n = ABAS[(i + (e.key === 'ArrowRight' ? 1 : ABAS.length - 1)) % ABAS.length][0]; setAba(n); document.getElementById(`pn2-aba-${n}`)?.focus() }}
                data-aba-painel={k}>
                {nome}{k === 'atividades' && nAtiv ? ` (${nAtiv})` : ''}
              </button>
            ))}
          </div>
        </header>

        <div className="pn2-corpo" role="tabpanel" id={`pn2-pagina-${aba}`} aria-labelledby={`pn2-aba-${aba}`}>
          {aba === 'resumo' && (
            <>
              {idx >= 0 && (
                <section className="pl-pn-bloco" data-linha-tempo>
                  <div className="pn2-progresso">
                    <svg viewBox="0 0 36 36" width="40" height="40" aria-hidden><circle cx="18" cy="18" r="15" className="trilha" /><circle cx="18" cy="18" r="15" className="feito" strokeDasharray={`${((idx + 1) / total) * 94.2} 94.2`} /></svg>
                    <span>Etapa {idx + 1} de {total}</span>
                  </div>
                  <ol className="pn2-tempo">
                    {(etapa ? ETAPAS_JORNADA.map(e => ({ k: e as string, nome: NOME_ETAPA[e] })) : colunas.map(c => ({ k: c.estagio as string, nome: c.titulo }))).map((x, i) => {
                      const estado = i < idx ? 'feita' : i === idx ? (limite?.parado ? 'estourada' : 'atual') : 'futura'
                      const quando = i <= idx ? entradaEm(x.k) : null
                      return (
                        <li key={x.k} className={estado} data-etapa-linha={estado}>
                          <span className="pn2-bola" aria-hidden>{estado === 'feita' ? '✓' : estado === 'estourada' ? '!' : i + 1}</span>
                          <div>
                            <b>{x.nome}</b>{quando && <span className="pl-hint"> · {estado === 'feita' ? 'entrou em ' : 'desde '}{dia(quando)}</span>}
                            {i === idx && aberto && (estado === 'estourada' || !!oQueFazer || pend.length > 0) && (
                              <div className="pn2-tempo-caixa">
                                {estado === 'estourada' && <div className="pn2-tempo-aviso">Passou do tempo máximo da etapa ({limite?.max}).</div>}
                                {oQueFazer && <div>O que fazer: {oQueFazer}</div>}
                                {pend.length > 0 && <ul className="qj-faltas">{pend.map(x2 => <li key={x2}>{x2}</li>)}</ul>}
                              </div>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                </section>
              )}
              <section className="pl-pn-bloco" data-ficha-cliente>
                <h3>Ficha do cliente</h3>
                <dl className="pl-pn-dados pn2-ficha">
                  {ficha.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
                  {isDono && (
                    <div>
                      <dt title="P = pagamento integral · R = renegociação">Negociação (P/R)</dt>
                      <dd className="pl-pn-pr">{(['P', 'R'] as TipoNegociacao[]).map(t => <button key={t} type="button" className={`pl-chip ${lead.tipoNegociacao === t ? 'active' : ''}`} aria-pressed={lead.tipoNegociacao === t} onClick={() => p.onDefinirTipoNegociacao(t)} title={NEGOCIACAO[t]}>{t}</button>)}</dd>
                    </div>
                  )}
                </dl>
              </section>
              {aberto && <PrepararComAries lead={lead} />}
              {p.extraResumo}
              {etapa && <JornadaPainel lead={lead} onMudou={() => p.onJornadaMudou?.()} parte="resumo" detalhe={d} recarregar={recarregar} />}
            </>
          )}

          {aba === 'conversa' && (
            <>
              <section className="pl-pn-bloco" data-painel-conversa>
                <h3>WhatsApp</h3>
                {conversa?.ultima ? (
                  <blockquote className="pl-pn-msg">
                    <span>{conversa.ultima.remetente === 'CONTATO' ? (nomeLimpo(lead) ?? 'Cliente').split(' ')[0] : conversa.ultima.remetente === 'VENDEDOR' ? 'Vendedor' : 'Assistente'} · {dataHora(conversa.ultima.criadoEm)}</span>
                    {conversa.ultima.texto}
                  </blockquote>
                ) : <p className="pl-hint">{conversa ? 'Sem mensagens.' : 'Nenhuma conversa do WhatsApp ligada a este lead.'}</p>}
                {/* Navegação completa: o Assistente lê ?conversa= ao montar. */}
                {linkConversa ? <a className="pl-link-action" href={linkConversa}>Abrir a conversa →</a> : whats ? <a className="pl-link-action" href={whats} target="_blank" rel="noreferrer">Abrir no WhatsApp →</a> : null}
              </section>
              <JornadaPainel lead={lead} onMudou={() => p.onJornadaMudou?.()} parte="conversa" detalhe={null} />
            </>
          )}

          {aba === 'atividades' && (
            <AtividadesLead key={lead.id} leadId={lead.id} nomeCliente={lead.nomeCliente} telefone={lead.telefone} follows={lead.follows ?? []} atividadesEtapa={d?.atividades ?? []}
              focarNota={focarNota} podeEscrever={podeEscrever} vejaAlertas={vejaEquipe} onFollow={p.onFollow} onContagemNotas={p.onContagemNotas} onLigacoesMudaram={p.onLigacoesMudaram} onContagem={setNAtiv} />
          )}

          {aba === 'historico' && (
            <>
              {(lead.historico?.length ?? 0) > 0 && (
                <section className="pl-pn-bloco" data-historico>
                  <h3>Histórico</h3>
                  <ol className="pl-pn-hist">
                    {[...lead.historico!].reverse().map((h, i) => (
                      <li key={i}>
                        <b>{NOME_ETAPA[h.estagioNovo as EtapaJornada] ?? colunas.find(c => c.estagio === h.estagioNovo)?.titulo ?? (h.estagioNovo === 'PERDIDO' ? 'Perdido' : h.estagioNovo)}</b>
                        <span>{dataHora(h.criadoEm)}{h.origem === 'ASSISTENTE' ? ` · pelo assistente${h.motivo ? `: ${h.motivo}` : ''}` : h.motivo ? ` · ${h.motivo}` : ''}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
              {(typeof lead.pontuacao === 'number' || (lead.etiquetas?.length ?? 0) > 0 || lead.calor?.motivo) && (
                <section className="pl-pn-bloco" data-leitura-assistente>
                  <h3>Leitura do assistente</h3>
                  <div className="pl-pn-linha">
                    {typeof lead.pontuacao === 'number' && <ChipNota nota={lead.pontuacao} titulo={`Nota pela conversa do WhatsApp: ${lead.pontuacao} de 100`} />}
                    <EtiquetasLead etiquetas={lead.etiquetas?.filter(e => e !== 'QUENTE')} max={12} />
                  </div>
                  {lead.calor?.motivo && <p className="pl-hint" style={{ margin: '6px 0 0' }}>{NOME_TEMP[temp]}: {lead.calor.motivo}</p>}
                </section>
              )}
              <QualidadeLead leadId={lead.id} />
              {lead.observacao && (
                <section className="pl-pn-bloco">
                  <details>
                    <summary className="pl-link-action" data-ver-cadastro>Ver texto do cadastro</summary>
                    <p className="pl-pn-obs">{lead.observacao}</p>
                  </details>
                </section>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
    {levantamento && <ModalLevantamento lead={lead} onFechar={() => setLevantamento(false)} onSalvo={() => { setLevantamento(false); void recarregar(); p.onJornadaMudou?.() }} />}
    </>
  )
}
