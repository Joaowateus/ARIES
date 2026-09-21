'use client'

import { useCallback, useEffect, useState } from 'react'
import { proLaboreApi, AssistenteComercial, AssistenteConversa, AssistenteConversaDetalhe, Vendedor } from '@/lib/proLaboreApi'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { PageHeader } from '../../PageHeader'

const ABAS = [
  { valor: 'LEAD' as const, rotulo: 'Leads' },
  { valor: 'SUPORTE' as const, rotulo: 'Suporte' },
]

const STATUS_CONVERSA_LABEL: Record<string, string> = {
  ATIVA: 'Em andamento',
  QUALIFICADO: 'Qualificado',
  ENCERRADA: 'Encerrada',
}
const STATUS_CONVERSA_CLASSE: Record<string, string> = {
  ATIVA: 'atencao',
  QUALIFICADO: 'bom',
  ENCERRADA: 'neutro',
}

function iniciais(nome: string) {
  return nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

function formatarTempoRelativo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min}min`
  const horas = Math.floor(min / 60)
  if (horas < 24) return `há ${horas}h`
  const dias = Math.floor(horas / 24)
  return `há ${dias}d`
}

export default function ProLaboreAssistentePage() {
  const { usuario } = useProLaboreAuth()
  const isDono = usuario?.papel === 'DONO'

  // Só o dono escolhe de quem quer ver o assistente — vendedor/supervisor
  // só têm acesso ao próprio (o backend já restringe isso; aqui é só pra
  // saber se mostra o seletor ou não).
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [vendedorSelecionadoId, setVendedorSelecionadoId] = useState('')

  const [carregando, setCarregando] = useState(true)
  const [assistente, setAssistente] = useState<AssistenteComercial | null>(null)
  const [vendedorAtual, setVendedorAtual] = useState<{ id: string; nome: string } | null>(null)

  const [numeroInput, setNumeroInput] = useState('')
  const [nomeInput, setNomeInput] = useState('')
  const [conectando, setConectando] = useState(false)
  const [erro, setErro] = useState('')

  const [abaAtiva, setAbaAtiva] = useState<'LEAD' | 'SUPORTE'>('LEAD')
  const [conversas, setConversas] = useState<AssistenteConversa[]>([])
  const [conversaSelecionadaId, setConversaSelecionadaId] = useState<string | null>(null)
  const [conversaDetalhe, setConversaDetalhe] = useState<AssistenteConversaDetalhe | null>(null)

  useEffect(() => {
    if (!isDono) return
    proLaboreApi.vendedores.listar().then(vs => {
      setVendedores(vs)
      setVendedorSelecionadoId(atual => atual || vs[0]?.id || '')
    })
  }, [isDono])

  const vendedorIdConsulta = isDono ? (vendedorSelecionadoId || undefined) : undefined

  const carregar = useCallback(() => {
    if (isDono && !vendedorSelecionadoId) { setCarregando(false); return }
    setCarregando(true)
    proLaboreApi.assistente.config(vendedorIdConsulta)
      .then(({ assistente, vendedor }) => { setAssistente(assistente); setVendedorAtual(vendedor) })
      .finally(() => setCarregando(false))
  }, [isDono, vendedorSelecionadoId, vendedorIdConsulta])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    setConversaSelecionadaId(null)
    if (!assistente || assistente.status !== 'CONECTADO') { setConversas([]); return }
    proLaboreApi.assistente.conversas({ vendedorId: vendedorIdConsulta, tipo: abaAtiva }).then(cs => {
      setConversas(cs)
      if (cs.length > 0) setConversaSelecionadaId(cs[0].id)
    })
  }, [assistente, abaAtiva, vendedorIdConsulta])

  useEffect(() => {
    if (!conversaSelecionadaId) { setConversaDetalhe(null); return }
    proLaboreApi.assistente.conversa(conversaSelecionadaId).then(setConversaDetalhe)
  }, [conversaSelecionadaId])

  async function conectar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!numeroInput.trim()) return
    setConectando(true)
    try {
      await proLaboreApi.assistente.conectar({ numeroWhatsapp: numeroInput.trim(), nomeExibicao: nomeInput.trim() || undefined, vendedorId: vendedorIdConsulta })
      setNumeroInput('')
      setNomeInput('')
      carregar()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao conectar o número')
    } finally {
      setConectando(false)
    }
  }

  async function desconectar() {
    if (!confirm('Desconectar esse número do assistente? O histórico de conversas fica guardado — só a conexão é desfeita.')) return
    await proLaboreApi.assistente.desconectar(vendedorIdConsulta)
    carregar()
  }

  const conectado = assistente?.status === 'CONECTADO'

  return (
    <div>
      <PageHeader
        eyebrow="Operação"
        title="Assistente Comercial"
        subtitle="Um assistente de WhatsApp por vendedor — dá suporte pra quem já é da equipe e pré-atende os leads que chegam de campanha"
        actions={conectado && (
          <button type="button" className="pl-btn pl-btn-ghost" onClick={desconectar}>Desconectar</button>
        )}
      />

      {isDono && vendedores.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span className="pl-hint">Vendedor</span>
          <select className="pl-select-chip active" value={vendedorSelecionadoId} onChange={e => setVendedorSelecionadoId(e.target.value)}>
            {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>
        </div>
      )}

      {carregando && <div className="pl-hint" style={{ marginTop: 16 }}>Carregando...</div>}

      {!carregando && isDono && vendedores.length === 0 && (
        <div className="pl-empty pl-card" style={{ marginTop: 16 }}>
          <div className="pl-emoji">🧑‍💼</div>
          <h3 style={{ margin: 0, color: 'var(--pl-ink-1)', fontWeight: 600 }}>Cadastre um vendedor primeiro</h3>
          <p style={{ marginTop: 6 }}>O Assistente Comercial é pessoal — cada vendedor conecta o próprio número.</p>
        </div>
      )}

      {!carregando && (!isDono || vendedorSelecionadoId) && !conectado && (
        <div className="pl-card" style={{ maxWidth: 560, marginTop: 16 }}>
          <div className="pl-card-head">
            <div>
              <div className="pl-card-title">Conectar {isDono ? `o número de ${vendedorAtual?.nome ?? 'vendedor'}` : 'seu WhatsApp'}</div>
              <div className="pl-card-sub">O mesmo número atende dois papéis: dá suporte quando {isDono ? 'o próprio vendedor' : 'você'} escreve, e pré-qualifica quem chega de campanha.</div>
            </div>
          </div>
          <form onSubmit={conectar} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="pl-field">
              <label>Número de WhatsApp</label>
              <input className="pl-input" placeholder="+55 91 9XXXX-XXXX" value={numeroInput} onChange={e => setNumeroInput(e.target.value)} />
            </div>
            <div className="pl-field">
              <label>Nome de exibição (opcional)</label>
              <input className="pl-input" placeholder="Ex: Ana — Vendas" value={nomeInput} onChange={e => setNomeInput(e.target.value)} />
            </div>
            {erro && <div className="pl-alert pl-alert-error">{erro}</div>}
            <div>
              <button type="submit" className="pl-btn pl-btn-primary" disabled={conectando}>{conectando ? 'Conectando...' : 'Conectar'}</button>
            </div>
          </form>
          <div className="pl-hint" style={{ marginTop: 14, lineHeight: 1.5 }}>
            A conexão real com o WhatsApp Business API ainda depende da mesma conta Meta usada no Social Media. Por enquanto, conectar aqui simula a ligação e povoa a tela com conversas de exemplo, pra já dar pra testar o fluxo.
          </div>
        </div>
      )}

      {!carregando && conectado && assistente && (
        <>
          <div className="pl-card" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="pl-chat-item-avatar" style={{ width: 40, height: 40, fontSize: 14 }}>
              {iniciais(assistente.nomeExibicao || vendedorAtual?.nome || '?')}
            </div>
            <div style={{ flex: 1 }}>
              <div className="pl-card-title">{assistente.nomeExibicao || vendedorAtual?.nome}</div>
              <div className="pl-card-sub pl-mono">{assistente.numeroWhatsapp}</div>
            </div>
            <span className="pl-status-badge bom">Conectado (simulado)</span>
          </div>

          <div className="pl-period-row" style={{ marginTop: 24, marginBottom: 16 }}>
            {ABAS.map(a => (
              <button key={a.valor} type="button" className={`pl-chip ${abaAtiva === a.valor ? 'active' : ''}`} onClick={() => setAbaAtiva(a.valor)}>
                {a.rotulo}
              </button>
            ))}
          </div>

          <div className="pl-grid-2">
            <div className="pl-card" style={{ padding: '14px 10px' }}>
              {conversas.length === 0 ? (
                <div className="pl-empty">
                  <div className="pl-emoji">💬</div>
                  Nenhuma conversa de {abaAtiva === 'LEAD' ? 'lead' : 'suporte'} ainda.
                </div>
              ) : (
                <div className="pl-chat-list">
                  {conversas.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      className={`pl-chat-item ${conversaSelecionadaId === c.id ? 'active' : ''}`}
                      onClick={() => setConversaSelecionadaId(c.id)}
                    >
                      <div className="pl-chat-item-avatar">{iniciais(c.nomeContato)}</div>
                      <div className="pl-chat-item-body">
                        <div className="pl-chat-item-top">
                          <span className="pl-chat-item-name">{c.nomeContato}</span>
                          <span className="pl-chat-item-time">{formatarTempoRelativo(c.ultimaMensagemEm)}</span>
                        </div>
                        <div className="pl-chat-item-snippet">{c.mensagens[0]?.texto ?? '—'}</div>
                        <span className={`pl-status-badge ${STATUS_CONVERSA_CLASSE[c.status]}`} style={{ marginTop: 6 }}>{STATUS_CONVERSA_LABEL[c.status]}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="pl-card">
              {!conversaDetalhe ? (
                <div className="pl-empty">Selecione uma conversa pra ver o histórico.</div>
              ) : (
                <>
                  <div className="pl-card-head">
                    <div>
                      <div className="pl-card-title">{conversaDetalhe.nomeContato}</div>
                      <div className="pl-card-sub pl-mono">{conversaDetalhe.numeroContato}</div>
                    </div>
                    <span className={`pl-status-badge ${STATUS_CONVERSA_CLASSE[conversaDetalhe.status]}`}>{STATUS_CONVERSA_LABEL[conversaDetalhe.status]}</span>
                  </div>
                  <div className="pl-chat-thread">
                    {conversaDetalhe.mensagens.map(m => (
                      <div key={m.id} className={`pl-chat-bubble-row ${m.remetente === 'ASSISTENTE' ? 'assistente' : 'contato'}`}>
                        <div className="pl-chat-bubble">
                          {m.texto}
                          <span className="pl-chat-bubble-time">{new Date(m.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
