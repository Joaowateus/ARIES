'use client'

// PDF 04 · 4.4 Pergunte ao ARIES: a pergunta vai ao ARIES, os números vêm
// preenchidos pelo sistema (do dicionário, com as permissões de quem pergunta)
// e cada número mostra a métrica, o período, a comparação e o link para a tela
// de origem. Ação sugerida só vira atividade depois da sua confirmação.
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { telasApi, type RespostaAries } from '@/lib/proLaboreApi'
import { StatusChip, useTelas } from './Padrao'

const SUGESTOES = ['Como está a previsão de fechamento do mês?', 'Qual o tempo de primeira resposta da semana?', 'Quantos leads novos chegaram este mês?', 'Quantas atividades estão atrasadas?']

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
    try { const r = await telasApi.perguntar(p); setConversa(c => [...c, r]); setTexto(''); registrarAcao('pergunte:perguntar') } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível perguntar agora') } finally { setCarregando(false) }
  }
  useEffect(() => { if (inicial && !enviado.current) { enviado.current = true; void perguntar(inicial) } })
  useEffect(() => { fim.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }) }, [conversa.length])
  return (
    <div data-pergunte>
      {conversa.length === 0 && !carregando && (
        <div className="ar-vazio" style={{ marginBottom: 12 }}>
          <h3>Pergunte sobre a operação</h3>
          <p style={{ margin: '0 0 10px' }}>Os números vêm do dicionário de métricas, com o período, a comparação e o link para a tela. Se a pergunta sair do que o ARIES sabe, ele diz que não sabe e onde procurar.</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            {SUGESTOES.map(s => <button key={s} type="button" className="pl-btn" style={{ fontSize: '.8rem' }} onClick={() => void perguntar(s)}>{s}</button>)}
          </div>
        </div>
      )}
      {conversa.map(r => <Resposta key={r.id} r={r} compacto={compacto} />)}
      {carregando && <p className="pl-hint">O ARIES está buscando os números…</p>}
      {erro && <p className="pl-hint" role="alert">{erro}</p>}
      <div ref={fim} />
      <form onSubmit={e => { e.preventDefault(); void perguntar(texto) }} style={{ display: 'flex', gap: 6, marginTop: 8, position: compacto ? 'sticky' : undefined, bottom: 0, background: 'var(--pl-bg)', paddingTop: 6 }}>
        <input className="pl-input" value={texto} onChange={e => setTexto(e.target.value)} placeholder="Ex.: por que a conversão caiu esta semana?" aria-label="Sua pergunta" maxLength={600} data-pergunta-campo />
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
        <p style={{ margin: 0 }}>{r.resposta}</p>
        {r.numeros.map(n => (
          <div className="ar-pergunte-num" key={n.id} data-numero-resposta={n.chave}>
            <span><b>{n.nome}</b> · {n.escopo} · {n.periodoTexto}</span><span><b>{n.valorTexto}</b> <StatusChip status={n.faixa} /></span>
            <span className="pl-hint">{n.comparacao ? `Mesmo intervalo anterior: ${n.comparacao.valorTexto}${n.comparacao.variacao != null ? ` (${n.comparacao.variacao > 0 ? '+' : ''}${n.comparacao.variacao.toLocaleString('pt-BR')}%)` : ''}` : 'Sem comparação (retrato de agora)'}{n.meta ? ` · meta ${n.meta.valorTexto}` : ''}</span>
            <Link href={n.link} className="pl-hint" data-link-origem onClick={() => registrarAcao('pergunte:abrir-origem')}>Abrir a tela →</Link>
            {n.aviso && <span className="pl-hint" style={{ gridColumn: '1 / -1', color: 'var(--pl-warning, #b7791f)' }} data-aviso-qualidade>{n.aviso}</span>}
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
