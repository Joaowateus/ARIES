'use client'

// Pergunte ao ARIES: responde qualquer pergunta, como um chat. Sobre a loja, o
// ARIES consulta o sistema (com as permissões de quem pergunta); sobre outros
// assuntos, usa o próprio conhecimento e a internet, citando as fontes. A conversa
// tem memória das últimas trocas. Sem a IA ligada, cai no Pergunte por regras
// (números do dicionário com período, comparação e link para a tela).
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { telasApi, type RespostaAries } from '@/lib/proLaboreApi'
import { StatusChip, useTelas } from './Padrao'

const SUGESTOES = ['Como está a previsão de fechamento do mês?', 'Quais leads quentes estão parados há mais de 3 dias?', 'Quanto falta para eu bater a meta?', 'Quais motos estão há mais tempo no estoque?', 'Como funciona o financiamento com CNH em processo?']

export function PergunteChat({ inicial, compacto }: { inicial?: string; compacto?: boolean }) {
  const { registrarAcao } = useTelas()
  const [texto, setTexto] = useState(inicial ?? '')
  const [conversa, setConversa] = useState<RespostaAries[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const fim = useRef<HTMLDivElement>(null)
  const enviado = useRef(false)
  async function perguntar(q: string) {
    const p = q.trim()
    if (p.length < 3 || carregando) return
    setErro(null); setCarregando(true)
    try { const r = await telasApi.perguntar(p, conversa.slice(-6).map(x => ({ pergunta: x.pergunta, resposta: x.resposta }))); setConversa(c => [...c, r]); setTexto(''); registrarAcao('pergunte:perguntar') } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível perguntar agora') } finally { setCarregando(false) }
  }
  useEffect(() => { if (inicial && !enviado.current) { enviado.current = true; void perguntar(inicial) } })
  useEffect(() => { fim.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }) }, [conversa.length])
  return (
    <div data-pergunte>
      {conversa.length === 0 && !carregando && (
        <div className="ar-vazio" style={{ marginBottom: 12 }}>
          <h3>Pergunte qualquer coisa</h3>
          <p style={{ margin: '0 0 10px' }}>Sobre a sua operação (leads, vendas, metas, estoque, atividades), o ARIES consulta o sistema com o seu acesso. Sobre qualquer outro assunto, responde como um chat e busca na internet quando precisa, citando as fontes.</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            {SUGESTOES.map(s => <button key={s} type="button" className="pl-btn" style={{ fontSize: '.8rem' }} onClick={() => void perguntar(s)}>{s}</button>)}
          </div>
        </div>
      )}
      {conversa.map(r => <Resposta key={r.id} r={r} compacto={compacto} />)}
      {carregando && <p className="pl-hint" data-pensando>O ARIES está pensando e consultando o que precisa…</p>}
      {erro && <p className="pl-hint" role="alert">{erro}</p>}
      <div ref={fim} />
      <form onSubmit={e => { e.preventDefault(); void perguntar(texto) }} style={{ display: 'flex', gap: 6, marginTop: 8, position: compacto ? 'sticky' : undefined, bottom: 0, background: 'var(--pl-bg)', paddingTop: 6 }}>
        <input className="pl-input" value={texto} onChange={e => setTexto(e.target.value)} placeholder={conversa.length ? 'Continue a conversa…' : 'Pergunte qualquer coisa ao ARIES'} aria-label="Sua pergunta" maxLength={2000} data-pergunta-campo />
        <button type="submit" className="pl-btn pl-btn-primary" disabled={carregando || texto.trim().length < 3} data-perguntar>Perguntar</button>
      </form>
    </div>
  )
}

function Resposta({ r, compacto }: { r: RespostaAries; compacto?: boolean }) {
  const { registrarAcao } = useTelas()
  const [acao, setAcao] = useState(r.acaoProposta)
  const [criada, setCriada] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  async function criar() {
    if (!acao) return
    try { const a = await telasApi.criarAcaoPergunta(r.id, acao.texto, acao.prazo); setCriada(a.codigo ?? 'criada'); registrarAcao('pergunte:criar-atividade') } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível') }
  }
  return (
    <>
      <div className="ar-pergunte-bolha ar-eu">{r.pergunta}</div>
      <div className="ar-pergunte-bolha" data-resposta={r.naoSabe ? 'nao-sabe' : 'numeros'}>
        <div style={{ fontSize: '.72rem', color: 'var(--pl-ink-muted)', marginBottom: 4 }}>ARIES</div>
        <TextoAries texto={r.resposta} />
        {!!r.consultas?.length && <div className="pl-hint" style={{ marginTop: 6 }} data-consultas>Consultou: {r.consultas.join(' · ')}</div>}
        {!!r.fontes?.length && (
          <div className="ar-pergunte-fontes" data-fontes>
            <span className="pl-hint">Fontes:</span>
            {r.fontes.map((f, i) => <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer" className="pl-hint" title={f.url}>{i + 1}. {f.titulo || f.url}</a>)}
          </div>
        )}
        {r.numeros.map(n => (
          <div className="ar-pergunte-num" key={n.id} data-numero-resposta={n.chave}>
            <span><b>{n.nome}</b> · {n.escopo} · {n.periodoTexto}</span><span><b>{n.valorTexto}</b> <StatusChip status={n.faixa} /></span>
            <span className="pl-hint">{n.comparacao ? `Mesmo intervalo anterior: ${n.comparacao.valorTexto}${n.comparacao.variacao != null ? ` (${n.comparacao.variacao > 0 ? '+' : ''}${n.comparacao.variacao.toLocaleString('pt-BR')}%)` : ''}` : 'Sem comparação (retrato de agora)'}{n.meta ? ` · meta ${n.meta.valorTexto}` : ''}</span>
            <Link href={n.link} className="pl-hint" data-link-origem onClick={() => registrarAcao('pergunte:abrir-origem')}>Abrir a tela →</Link>
            {n.aviso && <span className="pl-hint" style={{ gridColumn: '1 / -1', color: 'var(--ar-estado-atencao)' }} data-aviso-qualidade>{n.aviso}</span>}
          </div>
        ))}
        {acao && !criada && (
          <div style={{ marginTop: 8, borderTop: '1px solid var(--pl-border)', paddingTop: 8 }} data-acao-proposta>
            <div className="pl-hint" style={{ marginBottom: 4 }}>Ação sugerida (vira uma atividade só depois que você confirmar):</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: compacto ? 'wrap' : 'nowrap' }}>
              <input className="pl-input" value={acao.texto} onChange={e => setAcao({ ...acao, texto: e.target.value })} aria-label="O que fazer" />
              <button type="button" className="pl-btn pl-btn-primary" onClick={() => void criar()}>Criar a atividade</button>
            </div>
          </div>
        )}
        {criada && <p className="pl-hint" role="status" style={{ margin: '8px 0 0' }}>Atividade {criada} criada para você.</p>}
        {msg && <p className="pl-hint" role="alert">{msg}</p>}
      </div>
    </>
  )
}

/** Texto da resposta com o básico de formatação (negrito, listas, títulos, links internos). */
function TextoAries({ texto }: { texto: string }) {
  const blocos: ReactNode[] = []
  let lista: { ordenada: boolean; itens: string[] } | null = null
  const fecharLista = () => {
    if (!lista) return
    const Tag = lista.ordenada ? 'ol' : 'ul'
    blocos.push(<Tag key={blocos.length} style={{ margin: '4px 0', paddingLeft: 20 }}>{lista.itens.map((t, i) => <li key={i}>{inline(t)}</li>)}</Tag>)
    lista = null
  }
  for (const linha of texto.split('\n')) {
    const l = linha.trimEnd()
    const item = /^\s*(?:([-*•])|(\d+)[.)])\s+(.*)$/.exec(l)
    if (item) {
      const ordenada = !!item[2]
      if (!lista || lista.ordenada !== ordenada) { fecharLista(); lista = { ordenada, itens: [] } }
      lista.itens.push(item[3])
      continue
    }
    fecharLista()
    if (!l.trim()) continue
    const titulo = /^#{1,4}\s+(.*)$/.exec(l)
    blocos.push(titulo ? <p key={blocos.length} style={{ margin: '8px 0 2px', fontWeight: 600 }}>{inline(titulo[1])}</p> : <p key={blocos.length} style={{ margin: '4px 0' }}>{inline(l)}</p>)
  }
  fecharLista()
  return <div className="ar-pergunte-texto" data-texto-resposta>{blocos}</div>
}

function inline(t: string): ReactNode {
  const partes = t.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\)|\/pro-labore\/[\w\-/?=&%.]+)/g)
  return partes.map((p, i) => {
    const negrito = /^\*\*([^*]+)\*\*$/.exec(p)
    if (negrito) return <b key={i}>{negrito[1]}</b>
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(p)
    if (link) return link[2].startsWith('/') ? <Link key={i} href={link[2]}>{link[1]}</Link> : <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>
    if (p.startsWith('/pro-labore/')) return <Link key={i} href={p}>{p}</Link>
    return <Fragment key={i}>{p}</Fragment>
  })
}

/** Atalho acessível de qualquer tela: abre o Pergunte ao ARIES numa gaveta. */
export function AtalhoAries() {
  const [aberto, setAberto] = useState(false)
  useEffect(() => {
    const abrir = () => setAberto(true)
    const tecla = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); setAberto(a => !a) } if (e.key === 'Escape') setAberto(false) }
    window.addEventListener('ar-abrir-pergunte', abrir); window.addEventListener('keydown', tecla)
    return () => { window.removeEventListener('ar-abrir-pergunte', abrir); window.removeEventListener('keydown', tecla) }
  }, [])
  return (
    <>
      {!aberto && <button type="button" className="pl-btn pl-btn-primary ar-atalho-aries" onClick={() => setAberto(true)} data-atalho-pergunte title="Pergunte ao ARIES (Ctrl+J)">Pergunte ao ARIES</button>}
      {aberto && (
        <div className="ar-gaveta" role="dialog" aria-label="Pergunte ao ARIES" data-gaveta-pergunte>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--pl-border)' }}>
            <b>Pergunte ao ARIES</b>
            <div style={{ display: 'flex', gap: 6 }}><Link className="pl-btn" href="/pro-labore/pergunte" onClick={() => setAberto(false)}>Abrir a aba</Link><button type="button" className="pl-btn" onClick={() => setAberto(false)} aria-label="Fechar">Fechar</button></div>
          </div>
          <div className="ar-gaveta-corpo"><PergunteChat compacto /></div>
        </div>
      )}
    </>
  )
}
