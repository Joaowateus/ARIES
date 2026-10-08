'use client'

// Tela 10 · Paleta de comandos e atalhos (seção 11.3, protótipo Comandos.html).
// Ctrl/Cmd + K de qualquer tela: busca global agrupada em Ações, Estoque,
// Posts e Conversas; ↑ ↓ navega, Enter abre e Tab mostra as ações do item.
// As ações podem chamar a IA (ganchos) e o campo aceita perguntas em
// linguagem natural, que vão para o assistente da aba (seção 16.3).
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { proLaboreApi, type SmAbaAssistente, type SmAcaoBusca, type SmBusca, type SmGanchosBusca, type SmItemBusca } from '@/lib/proLaboreApi'
import { Kbd } from './componentes'
import { IcBusca } from './icones'
import { ConversaAssistente } from './Assistente'
import { Modal } from './Modal'
import { useToast } from './Toast'

export type TomPaleta = SmItemBusca['tom'] | 'nav'

/** Comandos do próprio espaço (navegação e atalhos), montados pelo layout com as permissões. */
export interface ComandoPaleta {
  id: string
  ini: ReactNode
  tom: TomPaleta
  titulo: string
  sub: string
  atalho?: string[]
  /** Outras palavras que acham o comando (ex.: "inicio" para Hoje). */
  palavras?: string
  executar: () => void
}

export const ATALHOS: Array<{ rotulo: string; teclas: string[] }> = [
  { rotulo: 'Abrir esta paleta', teclas: ['Ctrl', 'K'] },
  { rotulo: 'Começar modo foco', teclas: ['F'] },
  { rotulo: 'Nova pauta', teclas: ['N'] },
  { rotulo: 'Ir para Hoje', teclas: ['G', 'H'] },
  { rotulo: 'Ir para Calendário', teclas: ['G', 'C'] },
  { rotulo: 'Ir para Atendimento', teclas: ['G', 'A'] },
  { rotulo: 'Responder e virar lead', teclas: ['L'] },
  { rotulo: 'Ver todos os atalhos', teclas: ['?'] },
]

/** Minúsculas e sem acento, como no servidor. */
export function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const PERGUNTA = /\?\s*$|^(quant[oa]s?|qua(l|is)|como|por ?que|quando|onde|o que|quem|devo|vale a pena|tem |ta |esta |estou|me (diga|fala|mostra)|resum|explic|compar|sugir|sugest)/

/** Parece pergunta em linguagem natural (vai para o assistente)? */
export function parecePergunta(q: string): boolean {
  const n = normalizar(q.trim())
  return n.length >= 6 && PERGUNTA.test(n)
}

// A aba do assistente que responde, pelas palavras da pergunta (só as que o papel vê).
const ABAS_POR_PALAVRA: Array<[RegExp, SmAbaAssistente]> = [
  [/conversa|direct|mensage|respond|responder|cliente|atendimento|tempo de resposta|comentari|esperando/, 'atendimento'],
  [/venda|vendeu|vendi|crm|link|atribu|lead/, 'atribuicao'],
  [/calendario|semana|data|agend|horario|janela|mix|pilar|feriado/, 'calendario'],
  [/alcance|seguidor|desempenho|engaj|pulo|views|visualiza|melhor post|resultado|reels? (que|foi|rend)|cresc/, 'desempenho'],
  [/pauta|roteiro|gancho|producao|aprova|grava|edica|moto|estoque|ideia/, 'producao'],
]
export function abaDaPergunta(q: string, permitidas: SmAbaAssistente[]): SmAbaAssistente | null {
  const n = normalizar(q)
  for (const [re, aba] of ABAS_POR_PALAVRA) if (re.test(n) && permitidas.includes(aba)) return aba
  return (['producao', 'desempenho', 'calendario', 'atendimento', 'atribuicao'] as const).find(a => permitidas.includes(a)) ?? null
}

interface Linha {
  id: string
  ini: ReactNode
  tom: TomPaleta
  titulo: string
  sub: string
  atalho?: string[]
  principal: () => void
  acoes: Array<{ rotulo: string; executar: () => void }>
}

type Modo =
  | { tipo: 'lista' }
  | { tipo: 'acoes'; linha: Linha }
  | { tipo: 'ganchos'; chave: string; titulo: string; dados: SmGanchosBusca | null; erro: string | null }
  | { tipo: 'pergunta'; texto: string; aba: SmAbaAssistente }

const VAZIO: SmBusca = { acoes: [], estoque: [], posts: [], conversas: [] }

export function PaletaSM({ comandos, ia, abas, aoFechar }: {
  comandos: ComandoPaleta[]
  /** IA ligada: o campo aceita perguntas livres. */
  ia: boolean
  /** Abas do assistente que o papel pode abrir. */
  abas: SmAbaAssistente[]
  aoFechar: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [resultado, setResultado] = useState<SmBusca | null>(null)
  const [buscado, setBuscado] = useState<string | null>(null)
  const [sel, setSel] = useState(0)
  const [modo, setModo] = useState<Modo>({ tipo: 'lista' })
  const [ocupado, setOcupado] = useState(false)
  const campo = useRef<HTMLInputElement>(null)
  const seq = useRef(0)
  const pedidoGanchos = useRef(0)

  // O foco volta para quem abriu a paleta.
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null
    campo.current?.focus()
    return () => { anterior?.focus?.() }
  }, [])

  // Busca no servidor (com uma pequena espera enquanto a pessoa digita).
  useEffect(() => {
    const id = ++seq.current
    const termo = q.trim()
    const t = window.setTimeout(() => {
      proLaboreApi.sm.busca.buscar(termo)
        .then(r => { if (id === seq.current) { setResultado(r); setBuscado(termo) } })
        .catch(() => { if (id === seq.current) { setResultado(VAZIO); setBuscado(termo) } })
    }, termo ? 160 : 0)
    return () => window.clearTimeout(t)
  }, [q])

  function fechar() { aoFechar() }

  function rodar(a: SmAcaoBusca, titulo: string) {
    if (a.tipo === 'LINK' && a.href) {
      if (a.externo) window.open(a.href, '_blank', 'noopener,noreferrer')
      else router.push(a.href)
      fechar()
      return
    }
    if (a.tipo === 'CRIAR_PAUTA' && a.motoId) {
      setOcupado(true)
      proLaboreApi.sm.busca.criarPauta(a.motoId)
        .then(r => {
          toast({ mensagem: r.criada ? `Pauta criada em Ideias: ${r.titulo}` : `Esta moto já tem pauta aberta: ${r.titulo}` })
          window.dispatchEvent(new Event('sm:pautas-mudaram'))
          router.push(`/pro-labore/sm/producao?pauta=${r.id}`)
          fechar()
        })
        .catch(e => { setOcupado(false); toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível criar a pauta', tom: 'bad' }) })
      return
    }
    if (a.tipo === 'GANCHOS') {
      const chave = `${a.motoId ?? ''}:${a.pautaId ?? ''}:${++pedidoGanchos.current}`
      setModo({ tipo: 'ganchos', chave, titulo, dados: null, erro: null })
      proLaboreApi.sm.busca.ganchos({ motoId: a.motoId, pautaId: a.pautaId })
        .then(d => setModo(m => (m.tipo === 'ganchos' && m.chave === chave ? { ...m, dados: d } : m)))
        .catch(e => setModo(m => (m.tipo === 'ganchos' && m.chave === chave ? { ...m, erro: e instanceof Error ? e.message : 'Não foi possível agora' } : m)))
    }
  }

  const termo = q.trim()
  const atual = resultado ?? VAZIO
  const grupos = useMemo(() => {
    const deItem = (it: SmItemBusca): Linha => ({
      id: it.id, ini: it.ini, tom: it.tom, titulo: it.titulo, sub: it.sub,
      principal: () => rodar(it.acao, it.titulo),
      acoes: it.acoes.map(a => ({ rotulo: a.rotulo, executar: () => rodar(a, it.titulo) })),
    })
    const tokens = normalizar(termo).split(/\s+/).filter(Boolean)
    const proprios = comandos
      .filter(c => tokens.every(k => normalizar(`${c.titulo} ${c.palavras ?? ''}`).includes(k)))
      .map((c): Linha => ({ id: c.id, ini: c.ini, tom: c.tom, titulo: c.titulo, sub: c.sub, atalho: c.atalho, principal: () => { c.executar(); fechar() }, acoes: [] }))
    const pergunta = ia && termo.length >= 3 ? abaDaPergunta(termo, abas) : null
    const linhaPergunta: Linha | null = pergunta ? {
      id: 'perguntar', ini: '✦', tom: 'ia', titulo: 'Perguntar ao assistente', sub: `“${termo.length > 70 ? `${termo.slice(0, 69)}…` : termo}”`,
      principal: () => setModo({ tipo: 'pergunta', texto: termo, aba: pergunta }), acoes: [],
    } : null
    const lista: Array<{ nome: string; linhas: Linha[] }> = []
    const ehPergunta = parecePergunta(termo)
    if (linhaPergunta && ehPergunta) lista.push({ nome: 'Assistente', linhas: [linhaPergunta] })
    lista.push({ nome: 'Ações', linhas: [...atual.acoes.map(deItem), ...proprios].slice(0, termo ? 6 : 12) })
    lista.push({ nome: 'Estoque', linhas: atual.estoque.map(deItem) })
    lista.push({ nome: termo ? 'Posts' : 'Próximos posts', linhas: atual.posts.map(deItem) })
    lista.push({ nome: termo ? 'Conversas' : 'Conversas esperando', linhas: atual.conversas.map(deItem) })
    const comAlgo = lista.filter(g => g.linhas.length)
    // Nada encontrado: a pergunta ao assistente ainda pode ajudar.
    if (linhaPergunta && !ehPergunta && termo.split(/\s+/).length >= 2) comAlgo.push({ nome: 'Assistente', linhas: [linhaPergunta] })
    return comAlgo
    // rodar usa só router/toast/setters estáveis.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atual, comandos, termo, ia, abas])

  const linhas = modo.tipo === 'acoes'
    ? modo.linha.acoes.map((a, i): Linha => ({ id: `acao-${i}`, ini: '→', tom: 'nav', titulo: a.rotulo, sub: modo.linha.titulo, principal: a.executar, acoes: [] }))
    : grupos.flatMap(g => g.linhas)
  const indice = linhas.length ? Math.min(sel, linhas.length - 1) : -1
  const selecionada = indice >= 0 ? linhas[indice] : null

  useEffect(() => {
    if (indice >= 0) document.getElementById(`sm-paleta-op-${indice}`)?.scrollIntoView({ block: 'nearest' })
  }, [indice, modo.tipo])

  function voltar() {
    setModo({ tipo: 'lista' })
    setSel(0)
    window.setTimeout(() => campo.current?.focus(), 0)
  }

  function teclaNoCampo(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!linhas.length) return
      setSel((indice + (e.key === 'ArrowDown' ? 1 : -1) + linhas.length) % linhas.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selecionada && !ocupado) selecionada.principal()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      if (modo.tipo === 'acoes') { if (e.shiftKey) voltar(); return }
      if (!e.shiftKey && selecionada?.acoes.length) { setModo({ tipo: 'acoes', linha: selecionada }); setSel(0) }
    } else if (e.key === 'Backspace' && modo.tipo === 'acoes' && !q) {
      e.preventDefault(); voltar()
    }
  }

  function teclaNaJanela(e: React.KeyboardEvent) {
    // A paleta cuida das próprias teclas: nada vaza para a tela de trás (ex.: Esc do modo foco).
    e.stopPropagation()
    if (e.key === 'Escape') {
      e.preventDefault()
      if (modo.tipo === 'lista') fechar(); else voltar()
    }
  }

  const status = modo.tipo === 'lista' && buscado === termo
    ? (linhas.length ? `${linhas.length} ${linhas.length === 1 ? 'resultado' : 'resultados'}` : termo ? `Nada encontrado para “${termo}”` : '')
    : ''

  return (
    <div className="sm-paleta-fundo" onMouseDown={e => { if (e.target === e.currentTarget) fechar() }}>
      <section role="dialog" aria-modal="true" aria-label="Paleta de comandos" className="sm-paleta" onKeyDown={teclaNaJanela}>
        {(modo.tipo === 'lista' || modo.tipo === 'acoes') && (
          <>
            <div className="sm-paleta-busca">
              <IcBusca tamanho={20} />
              <label htmlFor="sm-paleta-campo" className="sm-sr">Buscar ou executar</label>
              <input
                id="sm-paleta-campo" ref={campo} type="text" autoComplete="off" spellCheck={false} maxLength={120}
                role="combobox" aria-expanded="true" aria-controls="sm-paleta-lista" aria-autocomplete="list"
                aria-activedescendant={indice >= 0 ? `sm-paleta-op-${indice}` : undefined}
                placeholder={modo.tipo === 'acoes' ? `Ações de ${modo.linha.titulo}` : ia ? 'Busque uma moto, post, conversa ou pergunte' : 'Busque uma moto, post ou conversa'}
                value={modo.tipo === 'acoes' ? '' : q} readOnly={modo.tipo === 'acoes'}
                onChange={e => { setQ(e.target.value); setSel(0) }}
                onKeyDown={teclaNoCampo}
              />
              <Kbd>Esc</Kbd>
            </div>
            <div className="sm-paleta-lista" id="sm-paleta-lista" role="listbox" aria-label={modo.tipo === 'acoes' ? `Ações de ${modo.linha.titulo}` : 'Resultados'}>
              {modo.tipo === 'acoes'
                ? (
                  <div role="group" aria-label={`Ações de ${modo.linha.titulo}`} className="sm-paleta-grupo">
                    <span className="sm-mono" aria-hidden="true">Ações de {modo.linha.titulo}</span>
                    {linhas.map((l, i) => <Opcao key={l.id} l={l} i={i} ativa={i === indice} aoPassar={() => setSel(i)} />)}
                  </div>
                )
                : grupos.map(g => {
                  const base = linhas.indexOf(g.linhas[0])
                  return (
                    <div key={g.nome} role="group" aria-label={g.nome} className="sm-paleta-grupo">
                      <span className="sm-mono" aria-hidden="true">{g.nome}</span>
                      {g.linhas.map((l, j) => <Opcao key={l.id} l={l} i={base + j} ativa={base + j === indice} aoPassar={() => setSel(base + j)} />)}
                    </div>
                  )
                })}
              {modo.tipo === 'lista' && !linhas.length && buscado === termo && (
                <p className="sm-paleta-vazio">{termo ? `Nada encontrado para “${termo}”. Tente o modelo da moto, o código do post ou o nome do cliente.` : 'Comece a digitar para buscar.'}</p>
              )}
            </div>
            <span className="sm-sr" role="status" aria-live="polite">{status}</span>
            <div className="sm-paleta-rodape">
              {modo.tipo === 'acoes'
                ? <><span><Kbd>Enter</Kbd> executar</span><span><Kbd>Shift</Kbd> <Kbd>Tab</Kbd> voltar</span><span><Kbd>Esc</Kbd> voltar</span></>
                : <><span><Kbd>↑</Kbd> <Kbd>↓</Kbd> navegar</span><span><Kbd>Enter</Kbd> abrir</span><span><Kbd>Tab</Kbd> ações do item</span></>}
            </div>
          </>
        )}
        {modo.tipo === 'ganchos' && (
          <div className="sm-paleta-painel">
            <div className="sm-paleta-painel-cab">
              <span className="sm-mono">{modo.dados?.ia === false ? 'Ganchos da biblioteca' : 'Ganchos'} · {modo.dados?.nome ?? modo.titulo}</span>
              <button type="button" className="sm-link-botao" onClick={voltar}>Voltar <Kbd>Esc</Kbd></button>
            </div>
            {modo.erro
              ? <p className="sm-erro" role="alert">{modo.erro}</p>
              : !modo.dados
                ? <p className="sm-legenda" role="status">Escrevendo os ganchos…</p>
                : modo.dados.ganchos.length
                  ? (
                    <>
                      <ol className="sm-paleta-ganchos" aria-label="Ganchos sugeridos">
                        {modo.dados.ganchos.map((g, i) => (
                          <li key={i}>
                            <span>{g.texto}{g.pulo && <small>{g.pulo}</small>}</span>
                            <button type="button" className="sm-btn" autoFocus={i === 0}
                              onClick={() => navigator.clipboard?.writeText(g.texto).then(() => toast({ mensagem: 'Gancho copiado.' })).catch(() => toast({ mensagem: 'Não foi possível copiar', tom: 'bad' }))}>Copiar</button>
                          </li>
                        ))}
                      </ol>
                      <span className="sm-legenda">{modo.dados.ia ? 'Escritos pela IA com a ficha e os ganchos que mais seguraram audiência. Revise antes de usar.' : 'Os ganchos da biblioteca com menor pulo nos 3 primeiros segundos. Adapte para a moto.'}</span>
                    </>
                  )
                  : <p className="sm-legenda">A biblioteca ainda não tem ganchos com dados de pulo. Salve os que funcionarem na Produção.</p>}
          </div>
        )}
        {modo.tipo === 'pergunta' && (
          <div className="sm-paleta-painel"
            // A ação da resposta leva para outra tela: a paleta fecha junto.
            onClickCapture={e => { if ((e.target as HTMLElement).closest('.sm-assist-r .sm-assist-acao')) fechar() }}>
            <ConversaAssistente aba={modo.aba} inicial={{ texto: modo.texto, id: null }} livre aoFechar={voltar} rotuloFechar="Voltar" />
          </div>
        )}
      </section>
    </div>
  )
}

function Opcao({ l, i, ativa, aoPassar }: { l: Linha; i: number; ativa: boolean; aoPassar: () => void }) {
  return (
    <button
      type="button" role="option" id={`sm-paleta-op-${i}`} aria-selected={ativa} tabIndex={-1}
      className={`sm-paleta-item${ativa ? ' ativo' : ''}`} onMouseMove={ativa ? undefined : aoPassar} onClick={l.principal}
    >
      <span className={`sm-paleta-ic ${l.tom}`} aria-hidden="true">{l.ini}</span>
      <span className="sm-paleta-texto"><span className="sm-paleta-titulo">{l.titulo}</span><span className="sm-paleta-sub">{l.sub}</span></span>
      {ativa
        ? <span className="sm-paleta-teclas" aria-hidden="true"><Kbd>Enter</Kbd>{l.acoes.length > 0 && <Kbd>Tab</Kbd>}</span>
        : l.atalho && <span className="sm-paleta-teclas fraco" aria-hidden="true">{l.atalho.map(k => <Kbd key={k}>{k}</Kbd>)}</span>}
    </button>
  )
}

/** "Atalhos do dia a dia" (tecla ?). */
export function ListaAtalhos({ aoFechar }: { aoFechar: () => void }) {
  return (
    <Modal titulo="Atalhos do dia a dia" aoFechar={aoFechar}>
      <ul className="sm-atalhos">
        {ATALHOS.map(a => (
          <li key={a.rotulo}>
            <span>{a.rotulo}</span>
            <span className="sm-paleta-teclas">{a.teclas.map(k => <Kbd key={k}>{k}</Kbd>)}</span>
          </li>
        ))}
      </ul>
      <p className="sm-legenda" style={{ margin: 0 }}>Tudo também funciona no mouse. Os atalhos aparecem como dica ao passar o cursor sobre cada botão.</p>
    </Modal>
  )
}
