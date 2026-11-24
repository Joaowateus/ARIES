'use client'

// Criação/edição de campanha em 8 passos: identificação, público, conteúdo, personalização,
// agendamento, revisão, confirmação e monitoramento. Salvar em qualquer passo guarda o rascunho;
// "Preparar" manda o servidor montar o público (snapshot) e, se for o caso, pedir aprovação.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { disparoApi, type CampanhaDisparo, type CampanhaDisparoEntrada, type ConfigEnvioDisparo, type FinalidadeDisparo, type MidiaDisparo, type ModeloDisparo, type PreviaPublicoDisparo, type PublicoSalvoDisparo } from '@/lib/proLaboreApi'
import { PublicoEditor } from './PublicoEditor'
import { PassosEditor } from './PassosEditor'
import { DIAS, SeloStatus, dataHora, erroDe, n, useMeta } from './util'

const PASSOS = ['Identificação', 'Público', 'Conteúdo', 'Personalização', 'Agendamento', 'Revisão', 'Confirmação', 'Monitoramento']
const RE_VAR = /\{\{\s*([a-z_]+)\s*(?:\|[^}]*)?\}\}/g
// O campo datetime-local trabalha na hora do navegador; o servidor guarda em UTC.
const paraLocal = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) }

function inicial(c: CampanhaDisparo | null, padrao: ConfigEnvioDisparo, remetente: string | null): CampanhaDisparoEntrada {
  if (c) return { nome: c.nome, descricao: c.descricao, objetivo: c.objetivo, finalidade: c.finalidade, assistenteId: c.assistenteId, publicoId: c.publicoId, publico: c.publico, conteudo: c.conteudo, config: { ...padrao, ...c.config }, agendadaPara: c.agendadaPara ? paraLocal(c.agendadaPara) : null, recorrencia: c.recorrencia }
  return { nome: '', descricao: '', objetivo: '', finalidade: 'MARKETING', assistenteId: remetente, publicoId: null, publico: { base: 'LEADS' }, conteudo: { passos: [{ tipo: 'TEXTO', texto: 'Oi, {{primeiro_nome}}! ' }], fallbacks: {}, rodapeSair: true }, config: { ...padrao }, agendadaPara: null, recorrencia: null }
}

export function Assistente({ campanha, fechar, abrirMonitor }: { campanha: CampanhaDisparo | null; fechar: () => void; abrirMonitor: (id: string) => void }) {
  const meta = useMeta()
  const [passo, setPasso] = useState(0)
  const [f, setF] = useState<CampanhaDisparoEntrada>(() => inicial(campanha, meta.config.envio, meta.remetentes.find(r => r.conectado)?.id ?? meta.remetentes[0]?.id ?? null))
  const [id, setId] = useState<string | null>(campanha?.id ?? null)
  const [salva, setSalva] = useState<CampanhaDisparo | null>(campanha)
  const [midias, setMidias] = useState<MidiaDisparo[]>([])
  const [modelos, setModelos] = useState<ModeloDisparo[]>([])
  const [publicos, setPublicos] = useState<PublicoSalvoDisparo[]>([])
  const [exemplo, setExemplo] = useState<PreviaPublicoDisparo | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => { void Promise.all([disparoApi.midias.listar(), disparoApi.modelos.listar(), disparoApi.publicos.listar()]).then(([m, mo, p]) => { setMidias(m); setModelos(mo); setPublicos(p) }).catch(() => undefined) }, [])
  const cfg = { ...meta.config.envio, ...f.config } as ConfigEnvioDisparo
  const setCfg = (c: Partial<ConfigEnvioDisparo>) => setF(x => ({ ...x, config: { ...cfg, ...c } }))
  const usadas = useMemo(() => [...new Set(f.conteudo.passos.flatMap(p => [...(p.texto ?? '').matchAll(RE_VAR)].map(m => m[1])))], [f.conteudo])
  const remetente = meta.remetentes.find(r => r.id === f.assistenteId)

  // Prévia com o conteúdo (exemplo real com as variáveis trocadas) para Personalização e Revisão.
  const verPrevia = useCallback(() => {
    disparoApi.publicos.previa({ definicao: f.publico, finalidade: f.finalidade, conteudo: f.conteudo, assistenteId: f.assistenteId }).then(setExemplo).catch(e => setErro(erroDe(e)))
  }, [f.publico, f.finalidade, f.conteudo, f.assistenteId])
  useEffect(() => { if (passo === 3 || passo === 5) verPrevia() }, [passo, verPrevia])

  // Confirmação: acompanha a preparação até ficar pronta (ou ir para aprovação).
  useEffect(() => {
    if (!id || passo !== 6 || (salva && !['VALIDATING'].includes(salva.status))) return
    const t = setInterval(() => { disparoApi.campanhas.ver(id).then(setSalva).catch(() => undefined) }, 3000)
    return () => clearInterval(t)
  }, [id, passo, salva])

  async function salvar(): Promise<string | null> {
    setErro(null); setMsg(null)
    if (f.nome.trim().length < 2) { setErro('Dê um nome à campanha'); setPasso(0); return null }
    setOcupado(true)
    try {
      const corpo = { ...f, agendadaPara: f.agendadaPara ? new Date(f.agendadaPara).toISOString() : null }
      if (id) { await disparoApi.campanhas.salvar(id, corpo); setMsg('Rascunho salvo.'); return id }
      const c = await disparoApi.campanhas.criar(corpo)
      setId(c.id); setMsg('Rascunho salvo.')
      return c.id
    } catch (e) { setErro(erroDe(e)); return null } finally { setOcupado(false) }
  }
  async function preparar() {
    const cid = await salvar()
    if (!cid) return
    setOcupado(true)
    try {
      await disparoApi.campanhas.validar(cid)
      setSalva(await disparoApi.campanhas.ver(cid))
      setPasso(6)
    } catch (e) { setErro(erroDe(e)) } finally { setOcupado(false) }
  }
  async function agir(fn: () => Promise<unknown>, ok: string) {
    if (!id) return
    setOcupado(true); setErro(null)
    try { await fn(); setSalva(await disparoApi.campanhas.ver(id)); setMsg(ok) } catch (e) { setErro(erroDe(e)) } finally { setOcupado(false) }
  }

  return (
    <section className="pl-card" data-disparo-assistente>
      <div className="dp-linha" style={{ justifyContent: 'space-between' }}>
        <div className="pl-card-title">{campanha ? `Editar: ${campanha.nome}` : 'Nova campanha'}</div>
        <button type="button" className="pl-btn" onClick={fechar}>Fechar</button>
      </div>
      <ol className="dp-etapas" aria-label="Passos">
        {PASSOS.map((p, i) => <li key={p} className={i === passo ? 'atual' : i < passo ? 'feito' : ''}><button type="button" onClick={() => i < 6 && setPasso(i)} disabled={i >= 6 && !salva}>{i + 1}. {p}</button></li>)}
      </ol>
      {erro && <div className="pl-alert pl-alert-error" role="alert">{erro}</div>}
      {msg && <p className="pl-hint" role="status">{msg}</p>}

      {passo === 0 && (
        <div className="pl-field-grid">
          <div className="pl-field"><label htmlFor="dp-nome">Nome</label><input id="dp-nome" className="pl-input" maxLength={120} value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Feirão de dezembro" /></div>
          <div className="pl-field"><label htmlFor="dp-obj">Objetivo</label><input id="dp-obj" className="pl-input" maxLength={200} value={f.objetivo ?? ''} onChange={e => setF({ ...f, objetivo: e.target.value })} placeholder="Ex.: reativar quem não comprou" /></div>
          <div className="pl-field" style={{ gridColumn: '1 / -1' }}><label htmlFor="dp-desc">Descrição</label><textarea id="dp-desc" className="pl-input" rows={2} maxLength={1000} value={f.descricao ?? ''} onChange={e => setF({ ...f, descricao: e.target.value })} /></div>
          <div className="pl-field" style={{ gridColumn: '1 / -1' }}><label>Finalidade</label>
            <div className="cc-chips">{(Object.keys(meta.finalidades) as FinalidadeDisparo[]).map(k => <button key={k} type="button" className={`pl-chip ${f.finalidade === k ? 'active' : ''}`} onClick={() => setF({ ...f, finalidade: k })}>{meta.finalidades[k]}</button>)}</div>
            <p className="pl-hint">Promocional só vai para quem autorizou{meta.config.baseMarketing === 'RELACAO' ? ' ou já tem relação comercial com a loja' : ''} e sempre leva a opção de sair. Operacional e relacionamento são para assuntos que o cliente já tem com a loja; ninguém bloqueado recebe nada.</p>
          </div>
          <div className="pl-field"><label htmlFor="dp-rem">Número que envia</label>
            <select id="dp-rem" className="pl-select" value={f.assistenteId ?? ''} onChange={e => setF({ ...f, assistenteId: e.target.value || null })}>
              <option value="">Escolha…</option>
              {meta.remetentes.map(r => <option key={r.id} value={r.id}>{r.vendedor} {r.numero ? `(${r.numero})` : ''}{r.conectado ? '' : ' — desconectado'}</option>)}
            </select>
            {remetente && !remetente.conectado && <p className="pl-hint" style={{ color: 'var(--ar-estado-atencao)' }}>Este número está desconectado: a campanha espera a conexão voltar.</p>}
            {!meta.remetentes.length && <p className="pl-hint">Nenhum WhatsApp conectado. Conecte em Conversas › Conexão.</p>}
          </div>
        </div>
      )}

      {passo === 1 && (
        <>
          {publicos.length > 0 && (
            <div className="pl-field" style={{ marginBottom: 10 }}><label htmlFor="dp-pub">Usar um público salvo</label>
              <select id="dp-pub" className="pl-select" value={f.publicoId ?? ''} onChange={e => { const p = publicos.find(x => x.id === e.target.value); setF({ ...f, publicoId: p?.id ?? null, publico: p ? p.definicao : f.publico }) }}>
                <option value="">—</option>{publicos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
          )}
          <PublicoEditor definicao={f.publico} mudar={d => setF({ ...f, publico: d, publicoId: null })} finalidade={f.finalidade} conteudo={null} assistenteId={f.assistenteId} />
        </>
      )}

      {passo === 2 && (
        <>
          {modelos.length > 0 && (
            <div className="pl-field" style={{ marginBottom: 10 }}><label htmlFor="dp-mod">Começar de um modelo da Biblioteca</label>
              <select id="dp-mod" className="pl-select" value="" onChange={e => { const m = modelos.find(x => x.id === e.target.value); if (m) setF({ ...f, conteudo: { ...m.conteudo, rodapeSair: f.conteudo.rodapeSair } }) }}>
                <option value="">Escolha um modelo…</option>{modelos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </div>
          )}
          <PassosEditor conteudo={f.conteudo} mudar={c => setF({ ...f, conteudo: c })} midias={midias} />
          {!meta.capacidades.templates && <p className="pl-hint">Modelos aprovados pela Meta (templates) e botões interativos só existem na API oficial do WhatsApp Business; o número conectado hoje não tem.</p>}
        </>
      )}

      {passo === 3 && (
        <div>
          <p className="pl-hint">Variáveis usadas: {usadas.length ? usadas.map(v => `{{${v}}}`).join(', ') : 'nenhuma'}. Sem valor no CRM, o contato recebe o valor alternativo; sem alternativo, ele fica de fora (motivo “falta um dado usado na mensagem”) — nunca sai “{'{{'}nome{'}}'}” para o cliente.</p>
          <div className="pl-field-grid">
            {usadas.map(v => (
              <div key={v} className="pl-field"><label htmlFor={`fb-${v}`}>Se não houver {meta.variaveis.find(x => x.chave === v)?.rotulo.toLowerCase() ?? v}, usar</label>
                <input id={`fb-${v}`} className="pl-input" value={f.conteudo.fallbacks?.[v] ?? ''} maxLength={120} onChange={e => setF({ ...f, conteudo: { ...f.conteudo, fallbacks: { ...(f.conteudo.fallbacks ?? {}), [v]: e.target.value } } })} placeholder="deixe vazio para tirar o contato" />
              </div>
            ))}
          </div>
          {f.finalidade === 'MARKETING' && (
            <label className="pl-hint" style={{ display: 'flex', gap: 6, marginTop: 10 }}><input type="checkbox" checked={f.conteudo.rodapeSair !== false} onChange={e => setF({ ...f, conteudo: { ...f.conteudo, rodapeSair: e.target.checked } })} /> Colocar no fim da última mensagem: “{meta.config.rodapeSair}”</label>
          )}
          {exemplo?.exemplo && <div className="dp-exemplo"><span className="pl-hint">Exemplo real (primeiro contato do público):</span>{exemplo.exemplo.map((t, i) => <p key={i}>{t}</p>)}{f.finalidade === 'MARKETING' && f.conteudo.rodapeSair !== false && <p className="pl-hint">{meta.config.rodapeSair}</p>}</div>}
          {exemplo && <p className="pl-hint">{n(exemplo.porMotivo.VARIAVEL_SEM_VALOR ?? 0)} contato(s) ficariam de fora por falta de dado.</p>}
        </div>
      )}

      {passo === 4 && (
        <div className="pl-field-grid">
          <div className="pl-field"><label htmlFor="dp-quando">Quando começar</label>
            <input id="dp-quando" className="pl-input" type="datetime-local" value={f.agendadaPara ? f.agendadaPara.slice(0, 16) : ''} onChange={e => setF({ ...f, agendadaPara: e.target.value || null })} />
            <span className="pl-hint">Vazio = começa quando você confirmar.</span>
          </div>
          <div className="pl-field"><label htmlFor="dp-rec">Repetir</label>
            <select id="dp-rec" className="pl-select" value={f.recorrencia?.tipo ?? ''} onChange={e => setF({ ...f, recorrencia: e.target.value ? { tipo: e.target.value as 'DIARIA', ate: f.recorrencia?.ate } : null })}>
              <option value="">Não repetir</option><option value="DIARIA">Todo dia</option><option value="SEMANAL">Toda semana</option><option value="MENSAL">Todo mês</option>
            </select>
            {f.recorrencia && <input className="pl-input" type="date" value={f.recorrencia.ate ?? ''} onChange={e => setF({ ...f, recorrencia: { ...f.recorrencia!, ate: e.target.value || undefined } })} aria-label="Repetir até" />}
          </div>
          <div className="pl-field"><label>Janela de envio (horário de Brasília)</label>
            <div className="dp-linha"><input className="pl-input dp-curto" type="time" value={cfg.janela.inicio} onChange={e => setCfg({ janela: { ...cfg.janela, inicio: e.target.value } })} aria-label="Início" /><span className="pl-hint">até</span><input className="pl-input dp-curto" type="time" value={cfg.janela.fim} onChange={e => setCfg({ janela: { ...cfg.janela, fim: e.target.value } })} aria-label="Fim" /></div>
            <div className="cc-chips">{DIAS.map((d, i) => <button key={d} type="button" className={`pl-chip ${cfg.janela.dias.includes(i) ? 'active' : ''}`} onClick={() => setCfg({ janela: { ...cfg.janela, dias: cfg.janela.dias.includes(i) ? cfg.janela.dias.filter(x => x !== i) : [...cfg.janela.dias, i].sort() } })}>{d}</button>)}</div>
          </div>
          <div className="pl-field"><label>Ritmo do número (proteção)</label>
            <div className="dp-linha"><span className="pl-hint">1 mensagem a cada</span><input className="pl-input dp-curto" type="number" min={8} value={cfg.intervaloSeg} onChange={e => setCfg({ intervaloSeg: Number(e.target.value) })} aria-label="Segundos entre mensagens" /><span className="pl-hint">s</span></div>
            <div className="dp-linha"><span className="pl-hint">no máximo</span><input className="pl-input dp-curto" type="number" min={1} value={cfg.maxPorHora} onChange={e => setCfg({ maxPorHora: Number(e.target.value) })} aria-label="Máximo por hora" /><span className="pl-hint">por hora e</span><input className="pl-input dp-curto" type="number" min={1} value={cfg.maxPorDia} onChange={e => setCfg({ maxPorDia: Number(e.target.value) })} aria-label="Máximo por dia" /><span className="pl-hint">por dia</span></div>
            <span className="pl-hint">O servidor nunca passa de 1 a cada 8 s, 400 por hora e 3.000 por dia por número, e o atendimento do vendedor sempre vem antes.</span>
          </div>
          <div className="pl-field" style={{ gridColumn: '1 / -1' }}><label>Parar a sequência quando</label>
            <label className="pl-hint"><input type="checkbox" checked={cfg.pararAoResponder} onChange={e => setCfg({ pararAoResponder: e.target.checked })} /> o contato responder (e passar para o vendedor)</label>
            <label className="pl-hint"><input type="checkbox" checked={cfg.pararAoComprar} onChange={e => setCfg({ pararAoComprar: e.target.checked })} /> o contato comprar</label>
            <label className="pl-hint"><input type="checkbox" checked={cfg.pararSeVendedorAssumir} onChange={e => setCfg({ pararSeVendedorAssumir: e.target.checked })} /> o vendedor assumir a conversa</label>
            <span className="pl-hint">Descadastro, bloqueio e perda da autorização sempre param.</span>
          </div>
        </div>
      )}

      {passo === 5 && (
        <div data-revisao>
          <dl className="dp-resumo">
            <dt>Campanha</dt><dd>{f.nome || '—'} · {meta.finalidades[f.finalidade]}{f.objetivo ? ` · ${f.objetivo}` : ''}</dd>
            <dt>Número que envia</dt><dd>{remetente ? `${remetente.vendedor} ${remetente.numero ?? ''}${remetente.conectado ? '' : ' (desconectado)'}` : <b style={{ color: 'var(--ar-estado-critico)' }}>escolha no passo 1</b>}</dd>
            <dt>Público</dt><dd>{exemplo ? <>{n(exemplo.elegiveis)} vão receber · {n(exemplo.excluidos)} excluídos de {n(exemplo.selecionados)}</> : 'contando…'}</dd>
            <dt>Mensagens</dt><dd>{f.conteudo.passos.length} na sequência</dd>
            <dt>Quando</dt><dd>{f.agendadaPara ? dataHora(new Date(f.agendadaPara).toISOString()) : 'ao confirmar'} · das {cfg.janela.inicio} às {cfg.janela.fim} ({cfg.janela.dias.map(d => DIAS[d]).join(', ')}){f.recorrencia ? ` · repete ${f.recorrencia.tipo.toLowerCase()}${f.recorrencia.ate ? ` até ${f.recorrencia.ate}` : ''}` : ''}</dd>
            <dt>Ritmo</dt><dd>1 a cada {cfg.intervaloSeg} s · até {cfg.maxPorHora}/h e {cfg.maxPorDia}/dia</dd>
          </dl>
          {exemplo?.exemplo && <div className="dp-exemplo"><span className="pl-hint">Exemplo:</span>{exemplo.exemplo.map((t, i) => <p key={i}>{t}</p>)}</div>}
          <p className="pl-hint">Ao preparar, o servidor monta a lista final (um snapshot do público agora){meta.config.exigirAprovacao && !meta.gestao ? ' e manda para aprovação do dono ou do supervisor' : ''}. Nada é enviado antes da sua confirmação.</p>
        </div>
      )}

      {passo === 6 && salva && (
        <div data-confirmacao>
          <div className="dp-linha"><b>{salva.nome}</b> <SeloStatus status={salva.status} /></div>
          {salva.erro && <div className="pl-alert pl-alert-error">{salva.erro}</div>}
          {salva.status === 'VALIDATING' && <p className="pl-hint" aria-busy="true">Preparando o público…</p>}
          {salva.totais && <div className="dp-totais"><div><span>Selecionados</span><b>{n(salva.totais.selecionados)}</b></div><div><span>Vão receber</span><b>{n(salva.totais.elegiveis)}</b></div><div><span>Excluídos</span><b>{n(salva.totais.excluidos)}</b></div></div>}
          {salva.status === 'NEEDS_REVIEW' && (meta.gestao
            ? <div className="dp-linha"><button type="button" className="pl-btn pl-btn-primary" disabled={ocupado} onClick={() => void agir(() => disparoApi.campanhas.aprovar(salva.id), 'Aprovada.')}>Aprovar</button></div>
            : <p className="pl-hint">Aguardando aprovação do dono ou do supervisor.</p>)}
          {salva.status === 'READY' && (
            <div className="dp-linha">
              {salva.totais?.elegiveis ? <button type="button" className="pl-btn pl-btn-primary" disabled={ocupado || !meta.remetentes.find(r => r.id === salva.assistenteId)} onClick={() => void agir(() => disparoApi.campanhas.iniciar(salva.id, salva.agendadaPara), salva.agendadaPara ? 'Agendada.' : 'Na fila: o envio começa na próxima rodada (até 1 minuto).')}>{salva.agendadaPara && new Date(salva.agendadaPara) > new Date() ? `Confirmar agendamento (${dataHora(salva.agendadaPara)})` : `Confirmar e enviar para ${n(salva.totais.elegiveis)}`}</button> : <p className="pl-hint">Ninguém para receber: ajuste o público.</p>}
              <button type="button" className="pl-btn" onClick={() => setPasso(1)}>Ajustar</button>
            </div>
          )}
          {['QUEUED', 'SCHEDULED', 'RUNNING'].includes(salva.status) && <button type="button" className="pl-btn pl-btn-primary" onClick={() => abrirMonitor(salva.id)}>Acompanhar o envio</button>}
        </div>
      )}

      <div className="dp-linha dp-rodape">
        {passo > 0 && passo < 6 && <button type="button" className="pl-btn" onClick={() => setPasso(p => p - 1)}>Voltar</button>}
        {passo < 6 && <button type="button" className="pl-btn" disabled={ocupado} onClick={() => void salvar()}>Salvar rascunho</button>}
        {passo < 5 && <button type="button" className="pl-btn pl-btn-primary" onClick={() => setPasso(p => p + 1)}>Continuar</button>}
        {passo === 5 && <button type="button" className="pl-btn pl-btn-primary" disabled={ocupado} onClick={() => void preparar()}>{ocupado ? 'Preparando…' : 'Preparar o público'}</button>}
        {passo === 6 && salva && <button type="button" className="pl-btn" onClick={() => abrirMonitor(salva.id)}>Ver a campanha</button>}
      </div>
    </section>
  )
}
