'use client'

// Aba "Processo": o guia de atendimento da loja — links das redes, o fluxo
// padrão passo a passo, respostas prontas e regras. A equipe lê e copia; o
// dono edita. Nas respostas, {cliente} e {vendedor} viram os nomes quando a
// resposta é usada na conversa.
import { useEffect, useMemo, useState } from 'react'
import { proLaboreApi, type ConteudoProcesso, type EtapaProcesso, type LinkProcesso, type ProcessoAtendimento, type RegraProcesso, type RespostaProcesso } from '@/lib/proLaboreApi'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { nomeProprio } from './util'

const VAZIO: ConteudoProcesso = { links: [], etapas: [], respostas: [], regras: [] }

// Ponto de partida para uma loja de motos; o dono ajusta tudo.
const MODELO: ConteudoProcesso = {
  links: [],
  etapas: [
    { titulo: 'Primeiro contato', prazo: 'até 5 min', descricao: 'Responda rápido, se apresente pelo nome e pergunte qual moto interessou. Lead de anúncio esfria em minutos.' },
    { titulo: 'Qualificação', prazo: 'na mesma conversa', descricao: 'Descubra: moto e uso (trabalho ou lazer), forma de pagamento (à vista, financiamento, consórcio), entrada, se tem moto na troca e quando pretende comprar.' },
    { titulo: 'Apresentação da moto', prazo: '', descricao: 'Mande fotos e vídeo da moto. Destaque o que importa para o uso do cliente (economia, conforto, garantia).' },
    { titulo: 'Simulação e crédito', prazo: 'no mesmo dia', descricao: 'Faça a simulação. Com a autorização do cliente, peça os dados para a pré-análise e retorne com a resposta dos bancos.' },
    { titulo: 'Proposta', prazo: '', descricao: 'Envie a proposta por escrito, com condições e validade. Combine o próximo passo (visita ou assinatura).' },
    { titulo: 'Fechamento', prazo: '', descricao: 'Confirme a visita no dia, separe a documentação e acompanhe até a entrega.' },
    { titulo: 'Pós-venda', prazo: '7 dias após a entrega', descricao: 'Pergunte como está a moto, peça avaliação e indicação.' },
  ],
  respostas: [
    { titulo: 'Saudação', etapa: 'Primeiro contato', texto: 'Oi, {cliente}! Aqui é {vendedor}, da loja. Vi que você se interessou por uma moto — qual modelo você está procurando?' },
    { titulo: 'Forma de pagamento', etapa: 'Qualificação', texto: 'Você pensa em comprar à vista, financiado ou no consórcio? Tem algum valor de entrada ou moto para dar na troca?' },
    { titulo: 'Pedir dados para a pré-análise', etapa: 'Simulação e crédito', texto: 'Para eu ver as condições com os bancos, preciso do seu CPF e da data de nascimento. Posso consultar?' },
    { titulo: 'Retomar quem não respondeu', etapa: 'Proposta', texto: 'Oi, {cliente}! Conseguiu ver a proposta? Se ficou alguma dúvida, me chama que eu te ajudo.' },
  ],
  regras: [
    { titulo: 'Tempo de resposta', texto: 'Lead novo: responder em até 5 minutos no horário comercial. Nenhuma conversa fica sem resposta no fim do dia.' },
    { titulo: 'Descontos e condições', texto: 'Desconto ou condição fora da tabela só com o ok do gestor.' },
    { titulo: 'Registro no CRM', texto: 'Toda conversa importante vira nota no card do lead. Ligação feita é registrada com o resultado.' },
  ],
}

const preencher = (t: string, nomes: { cliente?: string; vendedor?: string }) =>
  t.replace(/\{cliente\}/gi, nomes.cliente || '{cliente}').replace(/\{vendedor\}/gi, nomes.vendedor || '{vendedor}')
const primeiroNome = (n?: string | null) => nomeProprio((n ?? '').trim().split(/\s+/)[0] || '')
const dominio = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url } }
const comProtocolo = (url: string) => (url.trim() && !/^https?:\/\//i.test(url.trim()) ? `https://${url.trim()}` : url.trim())
const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

function useCopiar() {
  const [copiado, setCopiado] = useState<string | null>(null)
  async function copiar(chave: string, texto: string) {
    try { await navigator.clipboard.writeText(texto); setCopiado(chave); setTimeout(() => setCopiado(c => (c === chave ? null : c)), 1600) } catch { /* sem área de transferência */ }
  }
  return { copiado, copiar }
}

export function Processo() {
  const { usuario } = useProLaboreAuth()
  const [dados, setDados] = useState<ProcessoAtendimento | null>(null)
  const [erro, setErro] = useState('')
  const [editando, setEditando] = useState<ConteudoProcesso | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [filtroEtapa, setFiltroEtapa] = useState('')
  const { copiado, copiar } = useCopiar()
  const eu = primeiroNome(usuario?.nome)

  useEffect(() => {
    let cancelado = false
    proLaboreApi.processo.ler().then(d => { if (!cancelado) setDados(d) }).catch(e => { if (!cancelado) setErro((e as Error).message) })
    return () => { cancelado = true }
  }, [])

  async function salvar() {
    if (!editando) return
    setSalvando(true); setErro('')
    try {
      const limpo: ConteudoProcesso = { ...editando, links: editando.links.map(l => ({ ...l, url: comProtocolo(l.url) })) }
      setDados(await proLaboreApi.processo.salvar(limpo))
      setEditando(null)
    } catch (e) { setErro((e as Error).message) } finally { setSalvando(false) }
  }

  if (!dados) return erro ? <div className="pl-alert pl-alert-error">{erro}</div> : <p className="pl-hint">Carregando o processo…</p>
  if (editando) return <Editor valor={editando} onMudar={setEditando} onSalvar={() => void salvar()} onCancelar={() => { setEditando(null); setErro('') }} salvando={salvando} erro={erro} />

  const c = dados.conteudo
  const vazio = !c.links.length && !c.etapas.length && !c.respostas.length && !c.regras.length
  const etapasComResposta = [...new Set(c.respostas.map(r => r.etapa).filter(Boolean))]
  const respostas = filtroEtapa ? c.respostas.filter(r => r.etapa === filtroEtapa) : c.respostas

  return (
    <div className="pr" data-processo>
      <div className="pr-cab">
        <div>
          <h2>Processo de atendimento</h2>
          <p className="pl-hint">O jeito da loja atender: siga o fluxo, use as respostas prontas e os links oficiais.</p>
        </div>
        <div className="pr-cab-lado">
          {dados.atualizadoEm && <span className="pl-hint">Atualizado{dados.atualizadoPor ? ` por ${dados.atualizadoPor}` : ''} em {dataHora(dados.atualizadoEm)}</span>}
          {dados.podeEditar && !vazio && <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setEditando(structuredClone(c))} data-processo-editar>Editar processo</button>}
        </div>
      </div>

      {vazio ? (
        <div className="pl-card pl-empty">
          <div className="pl-emoji">🧭</div>
          {dados.podeEditar ? (
            <>
              <h3 style={{ margin: 0, color: 'var(--pl-ink-1)', fontWeight: 600 }}>Monte o processo de atendimento da loja</h3>
              <p style={{ margin: '6px 0 14px' }}>Links das redes, o passo a passo do atendimento, respostas prontas e as regras. A equipe vê aqui e usa as respostas direto na conversa.</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button type="button" className="pl-btn pl-btn-primary" onClick={() => setEditando(structuredClone(MODELO))} data-processo-modelo>Começar com um modelo</button>
                <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setEditando(structuredClone(VAZIO))}>Começar do zero</button>
              </div>
            </>
          ) : (
            <p style={{ margin: 0 }}>O gestor ainda não montou o processo de atendimento.</p>
          )}
        </div>
      ) : (
        <>
          {c.links.length > 0 && (
            <section className="pr-bloco">
              <h3>Links oficiais</h3>
              <div className="pr-links">
                {c.links.map((l, i) => (
                  <div key={i} className="pr-link" data-processo-link>
                    <a href={l.url} target="_blank" rel="noreferrer"><b>{l.rotulo}</b><span>{dominio(l.url)}</span></a>
                    <button type="button" className="pr-copiar" onClick={() => void copiar(`l${i}`, l.url)}>{copiado === `l${i}` ? 'Copiado' : 'Copiar'}</button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {c.etapas.length > 0 && (
            <section className="pr-bloco">
              <h3>Fluxo do atendimento</h3>
              <ol className="pr-etapas">
                {c.etapas.map((e, i) => (
                  <li key={i} data-processo-etapa>
                    <span className="pr-num">{i + 1}</span>
                    <div>
                      <div className="pr-etapa-cab"><b>{e.titulo}</b>{e.prazo && <span className="pr-prazo">{e.prazo}</span>}</div>
                      {e.descricao && <p>{e.descricao}</p>}
                      {c.respostas.some(r => r.etapa === e.titulo) && (
                        <button type="button" className="pl-link-action" onClick={() => setFiltroEtapa(e.titulo)}>Ver respostas desta etapa</button>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {c.respostas.length > 0 && (
            <section className="pr-bloco" id="pr-respostas">
              <h3>Respostas prontas</h3>
              {etapasComResposta.length > 0 && (
                <div className="pr-filtros" role="group" aria-label="Filtrar por etapa">
                  <button type="button" className={`pl-chip ${!filtroEtapa ? 'active' : ''}`} onClick={() => setFiltroEtapa('')}>Todas · {c.respostas.length}</button>
                  {etapasComResposta.map(e => (
                    <button key={e} type="button" className={`pl-chip ${filtroEtapa === e ? 'active' : ''}`} onClick={() => setFiltroEtapa(e)}>{e} · {c.respostas.filter(r => r.etapa === e).length}</button>
                  ))}
                </div>
              )}
              <div className="pr-respostas">
                {respostas.map(r => {
                  const i = c.respostas.indexOf(r)
                  return (
                    <div key={i} className="pr-resposta" data-processo-resposta>
                      <div className="pr-resposta-cab"><b>{r.titulo}</b>{r.etapa && <span className="pr-prazo">{r.etapa}</span>}</div>
                      <p>{preencher(r.texto, { vendedor: eu })}</p>
                      <button type="button" className="pl-btn pl-btn-ghost" onClick={() => void copiar(`r${i}`, preencher(r.texto, { vendedor: eu }))} data-processo-copiar>{copiado === `r${i}` ? 'Copiado ✓' : 'Copiar'}</button>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {c.regras.length > 0 && (
            <section className="pr-bloco">
              <h3>Regras e combinados</h3>
              <div className="pr-regras">
                {c.regras.map((r, i) => (
                  <div key={i} className="pr-regra" data-processo-regra><b>{r.titulo}</b>{r.texto && <p>{r.texto}</p>}</div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

/* ============ Edição (dono) ============ */

function mover<T>(lista: T[], i: number, d: -1 | 1): T[] {
  const j = i + d
  if (j < 0 || j >= lista.length) return lista
  const nova = [...lista]
  ;[nova[i], nova[j]] = [nova[j], nova[i]]
  return nova
}

function Controles({ i, total, onMover, onRemover, rotulo }: { i: number; total: number; onMover: (d: -1 | 1) => void; onRemover: () => void; rotulo: string }) {
  return (
    <div className="pr-ctrl">
      <button type="button" className="pl-icon-btn" onClick={() => onMover(-1)} disabled={i === 0} aria-label={`Subir ${rotulo}`} title="Subir">↑</button>
      <button type="button" className="pl-icon-btn" onClick={() => onMover(1)} disabled={i === total - 1} aria-label={`Descer ${rotulo}`} title="Descer">↓</button>
      <button type="button" className="pl-icon-btn pr-remover" onClick={onRemover} aria-label={`Remover ${rotulo}`} title="Remover">✕</button>
    </div>
  )
}

function Editor({ valor, onMudar, onSalvar, onCancelar, salvando, erro }: {
  valor: ConteudoProcesso
  onMudar: (v: ConteudoProcesso) => void
  onSalvar: () => void
  onCancelar: () => void
  salvando: boolean
  erro: string
}) {
  const set = <K extends keyof ConteudoProcesso>(k: K, lista: ConteudoProcesso[K]) => onMudar({ ...valor, [k]: lista })
  const muda = <K extends keyof ConteudoProcesso>(k: K, i: number, parcial: Partial<ConteudoProcesso[K][number]>) =>
    set(k, valor[k].map((x, j) => (j === i ? { ...x, ...parcial } : x)) as ConteudoProcesso[K])
  const titulosEtapas = useMemo(() => valor.etapas.map(e => e.titulo).filter(Boolean), [valor.etapas])

  return (
    <div className="pr pr-editor" data-processo-editor>
      <div className="pr-cab">
        <div>
          <h2>Editar o processo</h2>
          <p className="pl-hint">Nas respostas, use {'{cliente}'} e {'{vendedor}'}: na conversa, viram os nomes.</p>
        </div>
        <div className="pr-cab-lado">
          <button type="button" className="pl-btn pl-btn-ghost" onClick={onCancelar}>Cancelar</button>
          <button type="button" className="pl-btn pl-btn-primary" onClick={onSalvar} disabled={salvando} data-processo-salvar>{salvando ? 'Salvando…' : 'Salvar processo'}</button>
        </div>
      </div>
      {erro && <div className="pl-alert pl-alert-error" role="alert">{erro}</div>}

      <section className="pr-bloco">
        <h3>Links oficiais</h3>
        <p className="pl-hint">Instagram, site, catálogo, Google Maps, grupo de ofertas…</p>
        {valor.links.map((l: LinkProcesso, i) => (
          <div key={i} className="pr-linha">
            <input className="pl-input" placeholder="Nome (ex.: Instagram da loja)" value={l.rotulo} maxLength={80} onChange={e => muda('links', i, { rotulo: e.target.value })} aria-label={`Nome do link ${i + 1}`} />
            <input className="pl-input" placeholder="https://…" value={l.url} maxLength={500} onChange={e => muda('links', i, { url: e.target.value })} aria-label={`Endereço do link ${i + 1}`} />
            <Controles i={i} total={valor.links.length} rotulo="link" onMover={d => set('links', mover(valor.links, i, d))} onRemover={() => set('links', valor.links.filter((_, j) => j !== i))} />
          </div>
        ))}
        <button type="button" className="pl-btn pl-btn-ghost" onClick={() => set('links', [...valor.links, { rotulo: '', url: '' }])} data-processo-add="link">+ Link</button>
      </section>

      <section className="pr-bloco">
        <h3>Fluxo do atendimento</h3>
        {valor.etapas.map((e: EtapaProcesso, i) => (
          <div key={i} className="pr-item">
            <div className="pr-linha">
              <span className="pr-num">{i + 1}</span>
              <input className="pl-input" placeholder="Etapa (ex.: Qualificação)" value={e.titulo} maxLength={120} onChange={ev => muda('etapas', i, { titulo: ev.target.value })} aria-label={`Etapa ${i + 1}`} />
              <input className="pl-input pr-prazo-campo" placeholder="Prazo (ex.: até 5 min)" value={e.prazo} maxLength={80} onChange={ev => muda('etapas', i, { prazo: ev.target.value })} aria-label={`Prazo da etapa ${i + 1}`} />
              <Controles i={i} total={valor.etapas.length} rotulo="etapa" onMover={d => set('etapas', mover(valor.etapas, i, d))} onRemover={() => set('etapas', valor.etapas.filter((_, j) => j !== i))} />
            </div>
            <textarea className="pl-input" rows={3} placeholder="O que fazer nesta etapa" value={e.descricao} maxLength={4000} onChange={ev => muda('etapas', i, { descricao: ev.target.value })} aria-label={`O que fazer na etapa ${i + 1}`} />
          </div>
        ))}
        <button type="button" className="pl-btn pl-btn-ghost" onClick={() => set('etapas', [...valor.etapas, { titulo: '', descricao: '', prazo: '' }])} data-processo-add="etapa">+ Etapa</button>
      </section>

      <section className="pr-bloco">
        <h3>Respostas prontas</h3>
        {valor.respostas.map((r: RespostaProcesso, i) => (
          <div key={i} className="pr-item">
            <div className="pr-linha">
              <input className="pl-input" placeholder="Nome (ex.: Saudação)" value={r.titulo} maxLength={120} onChange={e => muda('respostas', i, { titulo: e.target.value })} aria-label={`Nome da resposta ${i + 1}`} />
              <select className="pl-select pr-prazo-campo" value={r.etapa} onChange={e => muda('respostas', i, { etapa: e.target.value })} aria-label={`Etapa da resposta ${i + 1}`}>
                <option value="">Sem etapa</option>
                {titulosEtapas.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <Controles i={i} total={valor.respostas.length} rotulo="resposta" onMover={d => set('respostas', mover(valor.respostas, i, d))} onRemover={() => set('respostas', valor.respostas.filter((_, j) => j !== i))} />
            </div>
            <textarea className="pl-input" rows={3} placeholder="Texto da resposta. Ex.: Oi, {cliente}! Aqui é {vendedor}…" value={r.texto} maxLength={4000} onChange={e => muda('respostas', i, { texto: e.target.value })} aria-label={`Texto da resposta ${i + 1}`} />
          </div>
        ))}
        <button type="button" className="pl-btn pl-btn-ghost" onClick={() => set('respostas', [...valor.respostas, { titulo: '', texto: '', etapa: '' }])} data-processo-add="resposta">+ Resposta</button>
      </section>

      <section className="pr-bloco">
        <h3>Regras e combinados</h3>
        {valor.regras.map((r: RegraProcesso, i) => (
          <div key={i} className="pr-item">
            <div className="pr-linha">
              <input className="pl-input" placeholder="Regra (ex.: Descontos)" value={r.titulo} maxLength={120} onChange={e => muda('regras', i, { titulo: e.target.value })} aria-label={`Regra ${i + 1}`} />
              <Controles i={i} total={valor.regras.length} rotulo="regra" onMover={d => set('regras', mover(valor.regras, i, d))} onRemover={() => set('regras', valor.regras.filter((_, j) => j !== i))} />
            </div>
            <textarea className="pl-input" rows={2} placeholder="Como funciona" value={r.texto} maxLength={6000} onChange={e => muda('regras', i, { texto: e.target.value })} aria-label={`Texto da regra ${i + 1}`} />
          </div>
        ))}
        <button type="button" className="pl-btn pl-btn-ghost" onClick={() => set('regras', [...valor.regras, { titulo: '', texto: '' }])} data-processo-add="regra">+ Regra</button>
      </section>

      <div className="pr-rodape">
        <button type="button" className="pl-btn pl-btn-ghost" onClick={onCancelar}>Cancelar</button>
        <button type="button" className="pl-btn pl-btn-primary" onClick={onSalvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar processo'}</button>
      </div>
    </div>
  )
}

/* ============ Na conversa: respostas do processo ============ */

let cacheProcesso: Promise<ProcessoAtendimento> | null = null

export function RespostasDoProcesso({ nomeCliente, nomeVendedor, onUsar, desativado }: { nomeCliente: string; nomeVendedor: string; onUsar: (texto: string) => void; desativado?: boolean }) {
  const [aberto, setAberto] = useState(false)
  const [lista, setLista] = useState<RespostaProcesso[] | null>(null)
  const [busca, setBusca] = useState('')

  function abrir() {
    setAberto(a => !a)
    if (lista) return
    cacheProcesso ??= proLaboreApi.processo.ler()
    cacheProcesso.then(d => setLista(d.conteudo.respostas)).catch(() => { cacheProcesso = null; setLista([]) })
  }
  const termo = busca.trim().toLowerCase()
  const filtradas = (lista ?? []).filter(r => !termo || `${r.titulo} ${r.etapa} ${r.texto}`.toLowerCase().includes(termo))

  return (
    <div className="pr-pop-wrap">
      <button type="button" className="pl-btn pl-btn-ghost" onClick={abrir} disabled={desativado} aria-expanded={aberto} data-respostas-processo>Respostas do processo</button>
      {aberto && (
        <div className="pr-pop" role="dialog" aria-label="Respostas do processo">
          <input className="pl-input" placeholder="Buscar resposta" value={busca} onChange={e => setBusca(e.target.value)} autoFocus />
          {lista === null ? <p className="pl-hint">Carregando…</p> : filtradas.length === 0 ? (
            <p className="pl-hint">{lista.length ? 'Nada com essa busca.' : 'O processo ainda não tem respostas prontas (aba Processo).'}</p>
          ) : (
            <ul>
              {filtradas.map((r, i) => (
                <li key={i}>
                  <button type="button" onClick={() => { onUsar(preencher(r.texto, { cliente: primeiroNome(nomeCliente), vendedor: primeiroNome(nomeVendedor) })); setAberto(false) }} data-usar-resposta>
                    <b>{r.titulo}{r.etapa ? <span> · {r.etapa}</span> : null}</b>
                    <small>{preencher(r.texto, { cliente: primeiroNome(nomeCliente), vendedor: primeiroNome(nomeVendedor) })}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
