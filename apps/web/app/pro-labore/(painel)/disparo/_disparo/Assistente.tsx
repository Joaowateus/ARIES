'use client'

// Criação/edição de campanha em 5 passos (redesign 26/11): identificação e canal, público, mensagens
// (com personalização), envio (quando, janela, ritmo e regras) e revisão/confirmação, com um resumo
// fixo ao lado. Os mesmos campos e chamadas de antes. Salvar em qualquer passo guarda o rascunho;
// "Preparar" manda o servidor montar o público (snapshot) e, se for o caso, pedir aprovação.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { disparoApi, type CanalDisparo, type CampanhaDisparo, type CampanhaDisparoEntrada, type ConfigEnvioDisparo, type FinalidadeDisparo, type MidiaDisparo, type ModeloDisparo, type PreviaPublicoDisparo, type PublicoSalvoDisparo } from '@/lib/proLaboreApi'
import { PublicoEditor } from './PublicoEditor'
import { PassosEditor } from './PassosEditor'
import { AvisoAutorizacao, DIAS, SeloStatus, avisoJanela, dataHora, erroDe, n, useMeta } from './util'
import { Hora, Interruptor, Segmentado } from './ui'

const PASSOS = ['Identificação e canal', 'Público', 'Mensagens', 'Envio', 'Revisão e confirmação']
const REVISAO = 4
const JA_PREPARADA = ['VALIDATING', 'NEEDS_REVIEW', 'READY', 'SCHEDULED', 'QUEUED', 'RUNNING']
const MIDIA: Record<string, string> = { IMAGEM: 'Imagem', AUDIO: 'Áudio', VIDEO: 'Vídeo', DOCUMENTO: 'Documento' }

/** Quanto tempo a primeira mensagem leva para chegar a todos, pelo ritmo e pela janela da campanha. */
function estimativa(qtd: number, cfg: ConfigEnvioDisparo, porHoraIg: number | null): string | null {
  if (!qtd) return null
  const porHora = porHoraIg ?? Math.max(1, Math.min(cfg.maxPorHora, Math.floor(3600 / Math.max(8, cfg.intervaloSeg))))
  const min = (h: string) => { const [a, b] = h.split(':').map(Number); return (a || 0) * 60 + (b || 0) }
  const horasJanela = Math.max(0.5, (min(cfg.janela.fim) - min(cfg.janela.inicio)) / 60)
  const porDia = Math.max(1, Math.floor(Math.min(porHoraIg ? Infinity : cfg.maxPorDia, porHora * horasJanela)))
  if (qtd <= porDia) {
    const m = Math.max(1, Math.ceil((qtd / porHora) * 60))
    return m < 60 ? `cerca de ${m} min` : `cerca de ${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')} min` : ''}`
  }
  return `cerca de ${Math.ceil(qtd / porDia)} dias de envio (até ${n(porDia)} por dia)`
}
const RE_VAR = /\{\{\s*([a-z_]+)\s*(?:\|[^}]*)?\}\}/g
// O campo datetime-local trabalha na hora do navegador; o servidor guarda em UTC.
const paraLocal = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) }

function inicial(c: CampanhaDisparo | null, padrao: ConfigEnvioDisparo, remetente: string | null): CampanhaDisparoEntrada {
  if (c) return { nome: c.nome, descricao: c.descricao, objetivo: c.objetivo, finalidade: c.finalidade, canal: c.canal ?? 'WHATSAPP', assistenteId: c.assistenteId, publicoId: c.publicoId, publico: c.publico, conteudo: c.conteudo, config: { ...padrao, ...c.config }, agendadaPara: c.agendadaPara ? paraLocal(c.agendadaPara) : null, recorrencia: c.recorrencia }
  return { nome: '', descricao: '', objetivo: '', finalidade: 'MARKETING', canal: 'WHATSAPP', assistenteId: remetente, publicoId: null, publico: { base: 'LEADS' }, conteudo: { passos: [{ tipo: 'TEXTO', texto: 'Oi, {{primeiro_nome}}! ' }], fallbacks: {}, rodapeSair: true }, config: { ...padrao }, agendadaPara: null, recorrencia: null }
}

export function Assistente({ campanha, fechar, abrirMonitor, preset }: { campanha: CampanhaDisparo | null; fechar: () => void; abrirMonitor: (id: string) => void; preset?: Partial<CampanhaDisparoEntrada> | null }) {
  const meta = useMeta()
  const [passo, setPasso] = useState(0)
  const [f, setF] = useState<CampanhaDisparoEntrada>(() => {
    const base = inicial(campanha, meta.config.envio, meta.remetentes.find(r => r.conectado)?.id ?? meta.remetentes[0]?.id ?? null)
    // Estratégia criada a partir da Jornada do CRM: já vem com público, mensagens e regras da etapa.
    return !campanha && preset ? { ...base, ...preset, config: { ...base.config, ...(preset.config ?? {}) } } : base
  })
  const [id, setId] = useState<string | null>(campanha?.id ?? null)
  const [salva, setSalva] = useState<CampanhaDisparo | null>(campanha)
  const [midias, setMidias] = useState<MidiaDisparo[]>([])
  const [modelos, setModelos] = useState<ModeloDisparo[]>([])
  const [publicos, setPublicos] = useState<PublicoSalvoDisparo[]>([])
  const [exemplo, setExemplo] = useState<PreviaPublicoDisparo | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [contando, setContando] = useState(false)
  const [erroPrevia, setErroPrevia] = useState<string | null>(null)
  // A confirmação vale para o que foi preparado: mudou algo depois, a revisão volta e pede preparar de novo.
  const assinatura = useMemo(() => JSON.stringify(f), [f])
  const [preparadaCom, setPreparadaCom] = useState<string | null>(() => (campanha && JA_PREPARADA.includes(campanha.status) ? JSON.stringify(f) : null))
  const confirmando = passo === REVISAO && !!salva && preparadaCom === assinatura
  useEffect(() => { void Promise.all([disparoApi.midias.listar(), disparoApi.modelos.listar(), disparoApi.publicos.listar()]).then(([m, mo, p]) => { setMidias(m); setModelos(mo); setPublicos(p) }).catch(() => undefined) }, [])
  const cfg = { ...meta.config.envio, ...f.config } as ConfigEnvioDisparo
  const setCfg = (c: Partial<ConfigEnvioDisparo>) => setF(x => ({ ...x, config: { ...cfg, ...c } }))
  const usadas = useMemo(() => [...new Set(f.conteudo.passos.flatMap(p => [...(p.texto ?? '').matchAll(RE_VAR)].map(m => m[1])))], [f.conteudo])
  const remetente = meta.remetentes.find(r => r.id === f.assistenteId)
  const ig = f.canal === 'INSTAGRAM'
  // Trocar o canal troca o público (os do Instagram são só de quem falou com a conta) e tira o que o direct não aceita.
  const trocarCanal = (canal: CanalDisparo) => setF(x => (x.canal === canal ? x : {
    ...x, canal, publicoId: null,
    publico: canal === 'INSTAGRAM' ? { base: 'INSTAGRAM_DM', predefinido: 'IG_DM' } : { base: 'LEADS' },
    config: { ...x.config, remetentePorVendedor: false },
    conteudo: canal === 'INSTAGRAM' ? { ...x.conteudo, passos: x.conteudo.passos.map(p => (p.tipo === 'DOCUMENTO' ? { ...p, tipo: 'TEXTO' as const, midiaId: null } : p)) } : x.conteudo,
  }))

  // Prévia com o conteúdo (contagem e exemplo real com as variáveis trocadas) para o resumo ao lado.
  const verPrevia = useCallback(() => {
    setContando(true)
    disparoApi.publicos.previa({ definicao: f.publico, finalidade: f.finalidade, conteudo: f.conteudo, assistenteId: f.assistenteId })
      .then(r => { setExemplo(r); setErroPrevia(null) }).catch(e => setErroPrevia(erroDe(e))).finally(() => setContando(false))
  }, [f.publico, f.finalidade, f.conteudo, f.assistenteId])
  useEffect(() => { const t = setTimeout(verPrevia, 900); return () => clearTimeout(t) }, [verPrevia])

  // Confirmação: acompanha a preparação até ficar pronta (ou ir para aprovação).
  useEffect(() => {
    if (!id || !confirmando || (salva && !['VALIDATING'].includes(salva.status))) return
    const t = setInterval(() => { disparoApi.campanhas.ver(id).then(setSalva).catch(() => undefined) }, 3000)
    return () => clearInterval(t)
  }, [id, confirmando, salva])

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
      setPreparadaCom(assinatura)
      setMsg(null)
      setPasso(REVISAO)
    } catch (e) { setErro(erroDe(e)) } finally { setOcupado(false) }
  }
  async function agir(fn: () => Promise<unknown>, ok: string) {
    if (!id) return
    setOcupado(true); setErro(null)
    try { await fn(); setSalva(await disparoApi.campanhas.ver(id)); setMsg(ok) } catch (e) { setErro(erroDe(e)) } finally { setOcupado(false) }
  }

  const numero = (v: number, set: (x: number) => void, rotulo: string, min: number, max?: number) => (
    <input className="pl-input dp-num" type="number" inputMode="numeric" min={min} max={max} value={v} aria-label={rotulo} onChange={e => set(Number(e.target.value))} />
  )
  const envioPor = ig ? `Instagram${meta.instagram?.usuario ? ` @${meta.instagram.usuario}` : ''}` : remetente ? `${remetente.vendedor}${remetente.numero ? ` · ${remetente.numero}` : ''}` : null
  const quantos = exemplo?.elegiveis ?? 0
  const tempo = estimativa(quantos, cfg, ig ? (meta.instagram?.maxPorHora ?? 180) : null)
  const rodape = f.finalidade === 'MARKETING' && f.conteudo.rodapeSair !== false
  const baloes = f.conteudo.passos.slice(0, 3)

  return (
    <section className="pl-card dp-assistente" data-disparo-assistente data-passo={passo}>
      <header className="dp-assist-topo">
        <div>
          <h2>{campanha ? `Editar: ${campanha.nome}` : 'Nova campanha'}</h2>
          <p className="pl-hint">Passo {passo + 1} de {PASSOS.length} · {PASSOS[passo]}</p>
        </div>
        <button type="button" className="pl-btn pl-btn-ghost" onClick={fechar}>Fechar</button>
      </header>
      <ol className="dp-trilha" aria-label="Passos">
        {PASSOS.map((p, i) => <li key={p} className={i === passo ? 'atual' : i < passo ? 'feito' : ''}><button type="button" onClick={() => setPasso(i)} aria-current={i === passo ? 'step' : undefined}><i>{i < passo ? '✓' : i + 1}</i><span>{p}</span></button></li>)}
      </ol>

      <div className="dp-assist-corpo">
        <div className="dp-assist-form">
          {erro && <div className="pl-alert pl-alert-error" role="alert">{erro}</div>}
          {msg && <p className="pl-hint" role="status">{msg}</p>}
          {passo === 0 && (
            <div className="pl-field-grid">
              <div className="pl-field"><label htmlFor="dp-nome">Nome</label><input id="dp-nome" className="pl-input" maxLength={120} value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Feirão de dezembro" /></div>
              <div className="pl-field"><label htmlFor="dp-obj">Objetivo</label><input id="dp-obj" className="pl-input" maxLength={200} value={f.objetivo ?? ''} onChange={e => setF({ ...f, objetivo: e.target.value })} placeholder="Ex.: reativar quem não comprou" /></div>
              <div className="pl-field" style={{ gridColumn: '1 / -1' }}><label htmlFor="dp-desc">Descrição</label><textarea id="dp-desc" className="pl-input" rows={2} maxLength={1000} value={f.descricao ?? ''} onChange={e => setF({ ...f, descricao: e.target.value })} /></div>
              <div className="pl-field" style={{ gridColumn: '1 / -1' }}><label>Finalidade</label>
                <Segmentado rotulo="Finalidade" valor={f.finalidade} mudar={k => setF({ ...f, finalidade: k })} opcoes={(Object.keys(meta.finalidades) as FinalidadeDisparo[]).map(k => ({ valor: k, rotulo: meta.finalidades[k] }))} />
                <p className="pl-hint">Promocional só vai para quem autorizou{meta.config.baseMarketing === 'RELACAO' ? ' ou já tem relação comercial com a loja' : ''} e sempre leva a opção de sair. Operacional e relacionamento são para assuntos que o cliente já tem com a loja; ninguém bloqueado recebe nada.</p>
              </div>
              {(meta.gestao || ig) && <div className="pl-field" style={{ gridColumn: '1 / -1' }}><label>Canal</label>
                <div data-canal><Segmentado rotulo="Canal" valor={ig ? 'INSTAGRAM' : 'WHATSAPP'} mudar={c => trocarCanal(c as CanalDisparo)} opcoes={[{ valor: 'WHATSAPP', rotulo: 'WhatsApp' }, { valor: 'INSTAGRAM', rotulo: 'Instagram (direct)' }]} /></div>
                {ig && <p className="pl-hint">Pelo direct do Instagram da empresa{meta.instagram?.usuario ? ` (@${meta.instagram.usuario})` : ''}, só para quem falou com a conta: mandou mensagem, respondeu story (até 24 h) ou comentou (resposta privada em até 7 dias). Até {meta.instagram?.maxPorHora ?? 180} mensagens por hora. Quem responde cai no Atendimento do Social Media.</p>}
                {ig && !meta.instagram?.conectado && <div className="pl-alert pl-alert-error" role="alert">O Instagram da empresa não está conectado. Conecte em Social Media › Conexão.</div>}
              </div>}
              {!ig && <div className="pl-field"><label htmlFor="dp-rem">Número que envia</label>
                <select id="dp-rem" className="pl-select" value={f.assistenteId ?? ''} onChange={e => setF({ ...f, assistenteId: e.target.value || null })}>
                  <option value="">Escolha…</option>
                  {meta.remetentes.map(r => <option key={r.id} value={r.id}>{r.vendedor} {r.numero ? `(${r.numero})` : ''}{r.conectado ? '' : ' — desconectado'}</option>)}
                </select>
                {remetente && !remetente.conectado && <p className="pl-hint" style={{ color: 'var(--ar-estado-atencao)' }}>Este número está desconectado: a campanha espera a conexão voltar.</p>}
                {!meta.remetentes.length && <p className="pl-hint">Nenhum WhatsApp conectado. Conecte em Conversas › Conexão.</p>}
              </div>}
            </div>
          )}

          {passo === 1 && (
            <>
              {publicos.length > 0 && !ig && (
                <div className="pl-field" style={{ marginBottom: 10 }}><label htmlFor="dp-pub">Usar um público salvo</label>
                  <select id="dp-pub" className="pl-select" value={f.publicoId ?? ''} onChange={e => { const p = publicos.find(x => x.id === e.target.value); setF({ ...f, publicoId: p?.id ?? null, publico: p ? p.definicao : f.publico }) }}>
                    <option value="">—</option>{publicos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
              )}
              <PublicoEditor definicao={f.publico} mudar={d => setF({ ...f, publico: d, publicoId: null })} finalidade={f.finalidade} conteudo={null} assistenteId={ig ? null : f.assistenteId} canal={f.canal ?? 'WHATSAPP'} />
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
              <PassosEditor canal={f.canal ?? 'WHATSAPP'} comentarios={f.publico.base === 'INSTAGRAM_COMENTARIOS'} conteudo={f.conteudo} mudar={c => setF({ ...f, conteudo: c })} midias={midias} recarregarMidias={() => disparoApi.midias.listar().then(m => { setMidias(m); return m })} />
              {!meta.capacidades.templates && <p className="pl-hint">Modelos aprovados pela Meta (templates) e botões interativos só existem na API oficial do WhatsApp Business; o número conectado hoje não tem.</p>}
              <div className="dp-assist-secao" data-personalizacao>
                <h3>Personalização</h3>
                <p className="pl-hint">Variáveis usadas: {usadas.length ? usadas.map(v => `{{${v}}}`).join(', ') : 'nenhuma'}. Sem valor no CRM, o contato recebe o valor alternativo; sem alternativo, ele fica de fora (motivo “falta um dado usado na mensagem”) — nunca sai “{'{{'}nome{'}}'}” para o cliente.</p>
                {usadas.length > 0 && (
                  <div className="pl-field-grid">
                    {usadas.map(v => (
                      <div key={v} className="pl-field"><label htmlFor={`fb-${v}`}>Se não houver {meta.variaveis.find(x => x.chave === v)?.rotulo.toLowerCase() ?? v}, usar</label>
                        <input id={`fb-${v}`} className="pl-input" value={f.conteudo.fallbacks?.[v] ?? ''} maxLength={120} onChange={e => setF({ ...f, conteudo: { ...f.conteudo, fallbacks: { ...(f.conteudo.fallbacks ?? {}), [v]: e.target.value } } })} placeholder="deixe vazio para tirar o contato" />
                      </div>
                    ))}
                  </div>
                )}
                {exemplo && (exemplo.porMotivo.VARIAVEL_SEM_VALOR ?? 0) > 0 && <p className="pl-hint">{n(exemplo.porMotivo.VARIAVEL_SEM_VALOR ?? 0)} contato(s) ficariam de fora por falta de dado.</p>}
                {f.finalidade === 'MARKETING' && <Interruptor id="rodape-sair" ligado={f.conteudo.rodapeSair !== false} mudar={v => setF({ ...f, conteudo: { ...f.conteudo, rodapeSair: v } })} rotulo="Opção de sair no fim da última mensagem" detalhe={`“${meta.config.rodapeSair}”`} />}
              </div>
            </>
          )}

          {passo === 3 && (
            <div className="dp-assist-envio">
              <div className="dp-assist-secao">
                <h3>Quando</h3>
                <div className="pl-field-grid">
                  <div className="pl-field"><label htmlFor="dp-quando">Começar</label>
                    <input id="dp-quando" className="pl-input" type="datetime-local" value={f.agendadaPara ? f.agendadaPara.slice(0, 16) : ''} onChange={e => setF({ ...f, agendadaPara: e.target.value || null })} />
                    <span className="pl-hint">Vazio = começa quando você confirmar.</span>
                  </div>
                  <div className="pl-field"><label htmlFor="dp-rec">Repetir</label>
                    <select id="dp-rec" className="pl-select" value={f.recorrencia?.tipo ?? ''} onChange={e => setF({ ...f, recorrencia: e.target.value ? { tipo: e.target.value as 'DIARIA', ate: f.recorrencia?.ate } : null })}>
                      <option value="">Não repetir</option><option value="DIARIA">Todo dia</option><option value="SEMANAL">Toda semana</option><option value="MENSAL">Todo mês</option>
                    </select>
                    {f.recorrencia && <input className="pl-input" type="date" value={f.recorrencia.ate ?? ''} onChange={e => setF({ ...f, recorrencia: { ...f.recorrencia!, ate: e.target.value || undefined } })} aria-label="Repetir até" />}
                  </div>
                </div>
              </div>
              <div className="dp-assist-secao">
                <h3>Janela e ritmo</h3>
                <div className="dp-config-linhas">
                  <div className="dp-config-linha">
                    <span className="dp-config-rotulo">Horário (Brasília)</span>
                    <div className="dp-linha"><Hora valor={cfg.janela.inicio} mudar={v => setCfg({ janela: { ...cfg.janela, inicio: v } })} rotulo="Início" id="as-ini" /><span className="pl-hint">até</span><Hora valor={cfg.janela.fim} mudar={v => setCfg({ janela: { ...cfg.janela, fim: v } })} rotulo="Fim" id="as-fim" /></div>
                  </div>
                  <div className="dp-config-linha">
                    <span className="dp-config-rotulo">Dias</span>
                    <div className="dp-dias" role="group" aria-label="Dias de envio">{DIAS.map((d, i) => <button key={d} type="button" aria-pressed={cfg.janela.dias.includes(i)} className={cfg.janela.dias.includes(i) ? 'on' : ''} onClick={() => setCfg({ janela: { ...cfg.janela, dias: cfg.janela.dias.includes(i) ? cfg.janela.dias.filter(x => x !== i) : [...cfg.janela.dias, i].sort() } })}>{d}</button>)}</div>
                  </div>
                  <div className="dp-config-linha">
                    <span className="dp-config-rotulo">Ritmo do número</span>
                    <p className="dp-frase">1 mensagem a cada {numero(cfg.intervaloSeg, v => setCfg({ intervaloSeg: v }), 'Segundos entre mensagens', 8)} s, até {numero(cfg.maxPorHora, v => setCfg({ maxPorHora: v }), 'Máximo por hora', 1)} por hora e {numero(cfg.maxPorDia, v => setCfg({ maxPorDia: v }), 'Máximo por dia', 1)} por dia.</p>
                  </div>
                </div>
                <p className="pl-hint">O servidor nunca passa de 1 a cada 8 s, 400 por hora e 3.000 por dia por número, e o atendimento do vendedor sempre vem antes.</p>
              </div>
              <div className="dp-assist-secao">
                <h3>Parar a sequência quando</h3>
                <Interruptor id="as-responder" ligado={cfg.pararAoResponder} mudar={v => setCfg({ pararAoResponder: v })} rotulo="O contato responder" detalhe="A conversa passa para o vendedor." />
                <Interruptor id="as-comprar" ligado={cfg.pararAoComprar} mudar={v => setCfg({ pararAoComprar: v })} rotulo="O contato comprar" />
                <Interruptor id="as-vendedor" ligado={cfg.pararSeVendedorAssumir} mudar={v => setCfg({ pararSeVendedorAssumir: v })} rotulo="O vendedor assumir a conversa" />
                <Interruptor id="as-saiu" ligado={!!cfg.pararAoSairDoPublico} mudar={v => setCfg({ pararAoSairDoPublico: v })} rotulo="O contato sair do público" detalhe="Ex.: mudou de etapa no CRM." />
                <p className="pl-hint">Descadastro, bloqueio e perda da autorização sempre param.</p>
              </div>
              <div className="dp-assist-secao dp-estrategia-opcoes" data-opcoes-estrategia>
                <h3>Estratégia</h3>
                <Interruptor id="as-continua" ligado={!!cfg.continua} mudar={v => setCfg({ continua: v, ...(v ? { pararAoSairDoPublico: true } : {}) })} rotulo="Contínua" detalhe="Fica ligada e quem passar a fazer parte do público (ex.: lead que entrar na etapa) entra sozinho, a cada 10 min. Desligada, envia uma vez para a lista de agora." />
                {!ig && <Interruptor id="as-por-vendedor" ligado={!!cfg.remetentePorVendedor} mudar={v => setCfg({ remetentePorVendedor: v })} rotulo="Pelo WhatsApp do vendedor de cada contato" detalhe="Quem já conversa com o cliente. Se o dele não estiver conectado, sai pelo número escolhido no passo 1." />}
              </div>
            </div>
          )}

          {passo === REVISAO && !confirmando && (
            <div data-revisao>
              <dl className="dp-resumo">
                <dt>Campanha</dt><dd>{f.nome || '—'} · {meta.finalidades[f.finalidade]}{f.objetivo ? ` · ${f.objetivo}` : ''}</dd>
                <dt>{ig ? 'Envia por' : 'Número que envia'}</dt><dd>{ig ? `Instagram${meta.instagram?.usuario ? ` @${meta.instagram.usuario}` : ''} (direct, dentro da janela da Meta)` : remetente ? `${remetente.vendedor} ${remetente.numero ?? ''}${remetente.conectado ? '' : ' (desconectado)'}` : <b style={{ color: 'var(--ar-estado-critico)' }}>escolha no passo 1</b>}</dd>
                <dt>Público</dt><dd>{exemplo ? <>{n(exemplo.elegiveis)} vão receber · {n(exemplo.excluidos)} excluídos de {n(exemplo.selecionados)}</> : 'contando…'}</dd>
                <dt>Mensagens</dt><dd>{f.conteudo.passos.length} na sequência</dd>
                <dt>Quando</dt><dd>{f.agendadaPara ? dataHora(new Date(f.agendadaPara).toISOString()) : 'ao confirmar'} · das {cfg.janela.inicio} às {cfg.janela.fim} ({cfg.janela.dias.map(d => DIAS[d]).join(', ')}){f.recorrencia ? ` · repete ${f.recorrencia.tipo.toLowerCase()}${f.recorrencia.ate ? ` até ${f.recorrencia.ate}` : ''}` : ''}</dd>
                <dt>Ritmo</dt><dd>1 a cada {cfg.intervaloSeg} s · até {cfg.maxPorHora}/h e {cfg.maxPorDia}/dia</dd>
                <dt>Tipo</dt><dd>{cfg.continua ? 'Estratégia contínua — novos contatos do público entram sozinhos' : 'Envio único para a lista de agora'}{cfg.pararAoSairDoPublico ? ' · para quando o contato sai do público' : ''}{cfg.remetentePorVendedor ? ' · pelo WhatsApp do vendedor de cada contato' : ''}</dd>
              </dl>
              {preparadaCom && preparadaCom !== assinatura && <div className="pl-alert" role="status">Você mudou a campanha depois de preparar. Prepare de novo para conferir a lista final.</div>}
              <p className="pl-hint">Ao preparar, o servidor monta a lista final (um snapshot do público agora){meta.config.exigirAprovacao && !meta.gestao ? ' e manda para aprovação do dono ou do supervisor' : ''}. Nada é enviado antes da sua confirmação.</p>
            </div>
          )}

          {confirmando && salva && (
            <div data-confirmacao>
              <div className="dp-linha"><b>{salva.nome}</b> <SeloStatus status={salva.status} /></div>
              {salva.erro && <div className="pl-alert pl-alert-error">{salva.erro}</div>}
              {salva.status === 'VALIDATING' && <p className="pl-hint" aria-busy="true">Preparando o público…</p>}
              {salva.totais && <div className="dp-totais"><div><span>Selecionados</span><b>{n(salva.totais.selecionados)}</b></div><div><span>Vão receber</span><b>{n(salva.totais.elegiveis)}</b></div><div><span>Excluídos</span><b>{n(salva.totais.excluidos)}</b></div></div>}
              {salva.totais && Object.keys(salva.totais.porMotivo ?? {}).length > 0 && (
                <ul className="pl-hint" style={{ margin: '6px 0', paddingLeft: 18 }} data-motivos-exclusao>
                  {Object.entries(salva.totais.porMotivo).sort((a, b) => b[1] - a[1]).map(([m, q]) => <li key={m}>{meta.motivos[m] ?? m}: <b>{n(q)}</b></li>)}
                </ul>
              )}
              {salva.finalidade === 'MARKETING' && ['READY', 'NEEDS_REVIEW'].includes(salva.status) && <AvisoAutorizacao quantos={salva.totais?.porMotivo?.SEM_AUTORIZACAO ?? 0} aoMudar={() => void preparar()} />}
              {salva.status === 'READY' && (() => {
                // Antes de confirmar: o que pode atrasar o envio (número desconectado, fora do horário).
                const rem = meta.remetentes.find(r => r.id === salva.assistenteId)
                const agendadaFutura = !!salva.agendadaPara && new Date(salva.agendadaPara) > new Date()
                const janela = agendadaFutura ? null : avisoJanela(cfg.janela)
                return (
                  <>
                    {rem && !rem.conectado && <div className="pl-alert pl-alert-error" role="alert">O WhatsApp de {rem.vendedor} está desconectado. A campanha fica na fila e só envia quando ele for reconectado em Conversas › Conexão.</div>}
                    {janela && <div className="pl-alert" role="status">{janela}</div>}
                  </>
                )
              })()}
              {salva.status === 'NEEDS_REVIEW' && (meta.gestao
                ? <div className="dp-linha"><button type="button" className="pl-btn pl-btn-primary" disabled={ocupado} onClick={() => void agir(() => disparoApi.campanhas.aprovar(salva.id), 'Aprovada.')}>Aprovar</button></div>
                : <p className="pl-hint">Aguardando aprovação do dono ou do supervisor.</p>)}
              {salva.status === 'READY' && (
                <div className="dp-linha">
                  {salva.totais?.elegiveis ? <button type="button" className="pl-btn pl-btn-primary" disabled={ocupado || (salva.canal === 'INSTAGRAM' ? !meta.instagram?.conectado : !meta.remetentes.find(r => r.id === salva.assistenteId))} onClick={() => void agir(async () => { await disparoApi.campanhas.iniciar(salva.id, salva.agendadaPara); abrirMonitor(salva.id) }, 'Começou.')}>{salva.agendadaPara && new Date(salva.agendadaPara) > new Date() ? `Confirmar agendamento (${dataHora(salva.agendadaPara)})` : `Confirmar e enviar para ${n(salva.totais.elegiveis)}`}</button> : <p className="pl-hint">Ninguém para receber: ajuste o público.</p>}
                  <button type="button" className="pl-btn" onClick={() => setPasso(1)}>Ajustar o público</button>
                </div>
              )}
              {['QUEUED', 'SCHEDULED', 'RUNNING'].includes(salva.status) && <button type="button" className="pl-btn pl-btn-primary" onClick={() => abrirMonitor(salva.id)}>Acompanhar o envio</button>}
            </div>
          )}

          <div className="dp-linha dp-rodape">
            {passo > 0 && !confirmando && <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setPasso(p => p - 1)}>Voltar</button>}
            {!confirmando && <button type="button" className="pl-btn" disabled={ocupado} onClick={() => void salvar()}>Salvar rascunho</button>}
            {passo < REVISAO && <button type="button" className="pl-btn pl-btn-primary" onClick={() => setPasso(p => p + 1)}>Continuar</button>}
            {passo === REVISAO && !confirmando && <button type="button" className="pl-btn pl-btn-primary" disabled={ocupado} onClick={() => void preparar()}>{ocupado ? 'Preparando…' : 'Preparar o público'}</button>}
            {confirmando && salva && <button type="button" className="pl-btn" onClick={() => abrirMonitor(salva.id)}>Ver a campanha</button>}
          </div>
        </div>

        <aside className="dp-assist-resumo" aria-label="Resumo da campanha" data-resumo-fixo>
          <div className="dp-assist-resumo-num" aria-live="polite">
            <span>Vão receber</span>
            <b data-resumo-elegiveis>{exemplo ? n(exemplo.elegiveis) : '—'}</b>
            <small>{contando && !exemplo ? 'contando…' : exemplo ? `${n(exemplo.excluidos)} de fora de ${n(exemplo.selecionados)} selecionados` : erroPrevia ?? ''}</small>
          </div>
          <div className="dp-assist-resumo-linha chave"><span>Envia por</span><b>{envioPor ?? <em>escolha no passo 1</em>}</b>{remetente && !ig && !remetente.conectado && <small className="dp-txt-warn">desconectado</small>}</div>
          <div className="dp-assist-resumo-linha"><span>Finalidade</span><b>{meta.finalidades[f.finalidade]}</b></div>
          <div className="dp-balao-area" data-balao>
            <span className="dp-assist-resumo-rotulo">Como chega{exemplo?.exemplo ? ' (primeiro contato)' : ''}</span>
            {baloes.map((p, i) => (
              <div key={i}>
                {i > 0 && (p.esperarMin ?? 0) > 0 && <div className="dp-balao-espera">depois de {(p.esperarMin ?? 0) >= 1440 ? `${Math.round((p.esperarMin ?? 0) / 1440)} dia(s)` : (p.esperarMin ?? 0) >= 60 ? `${Math.round((p.esperarMin ?? 0) / 60)} h` : `${p.esperarMin} min`}</div>}
                <div className="dp-balao">
                  {p.tipo !== 'TEXTO' && <span className="dp-balao-midia">{MIDIA[p.tipo] ?? p.tipo}</span>}
                  {(exemplo?.exemplo?.[i] ?? p.texto) ? <p>{exemplo?.exemplo?.[i] ?? p.texto}</p> : p.tipo === 'TEXTO' ? <p className="dp-balao-vazio">mensagem vazia</p> : null}
                  {rodape && i === f.conteudo.passos.length - 1 && <p className="dp-balao-rodape">{meta.config.rodapeSair}</p>}
                </div>
              </div>
            ))}
            {f.conteudo.passos.length > baloes.length && <small className="pl-hint">+ {f.conteudo.passos.length - baloes.length} mensagem(ns) na sequência</small>}
          </div>
          <div className="dp-assist-resumo-linha"><span>Quando</span><b>{f.agendadaPara ? dataHora(new Date(f.agendadaPara).toISOString()) : 'ao confirmar'}</b><small>{cfg.janela.inicio}–{cfg.janela.fim} · {cfg.janela.dias.map(d => DIAS[d]).join(' ')}</small></div>
          {tempo && <div className="dp-assist-resumo-linha" data-estimativa><span>Duração estimada</span><b>{tempo}</b><small>{cfg.continua ? 'Para quem está no público agora; os novos entram depois. ' : ''}Primeira mensagem para todos, se o número não estiver enviando outra campanha ao mesmo tempo.</small></div>}
        </aside>
      </div>
    </section>
  )
}
