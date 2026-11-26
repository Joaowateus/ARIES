'use client'

// Diagnóstico do WhatsApp (só o dono): para cada número, o que impede o cadastro automático no CRM
// e a primeira abordagem do robô — conexão no servidor, aviso de mensagens (webhook), chaves e as
// últimas 24 h. A única correção daqui é reapontar o aviso para esta API.
import { useCallback, useState } from 'react'
import { proLaboreApi, type DiagnosticoWhatsapp } from '@/lib/proLaboreApi'
import { tempoRelativo } from './util'
import { useConfirmarTexto } from '../../_ui/ui'

const SELO: Record<string, { rotulo: string; classe: string }> = { CRITICO: { rotulo: 'impede', classe: 'critico' }, ATENCAO: { rotulo: 'atenção', classe: 'atencao' }, INFO: { rotulo: 'informação', classe: '' } }
const ESTADO: Record<string, string> = { open: 'conectado no servidor', close: 'desconectado no servidor', connecting: 'reconectando no servidor', inexistente: 'sessão apagada no servidor', erro: 'servidor sem resposta', sem_instancia: 'nunca conectado', sessao_caida: 'conectado, mas sem enviar (sessão caída)', nao_verificado: 'não verificado' }

export function DiagnosticoWhatsappCard() {
  const confirmarTexto = useConfirmarTexto()
  const [d, setD] = useState<DiagnosticoWhatsapp | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const rodar = useCallback(async () => {
    setCarregando(true); setErro(null)
    try { setD(await proLaboreApi.assistente.diagnostico()) } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível diagnosticar') } finally { setCarregando(false) }
  }, [])
  async function desligarDuplicadas(id: string) {
    if (!(await confirmarTexto('Apagar as conexões que sobraram no servidor com este mesmo número? A conexão em uso no ARIES fica; só as sobras são apagadas.'))) return
    setMsg(null)
    try {
      const r = await proLaboreApi.assistente.desligarDuplicadas(id)
      const presas = r.presas ?? []
      setMsg(presas.length
        ? `${r.desligadas.length ? `Apagadas: ${r.desligadas.join(', ')}. ` : ''}Ainda presa: ${presas.join(', ')}. O servidor só solta a sessão antiga depois que ela é removida no celular: em WhatsApp › Aparelhos conectados, remova o aparelho antigo e clique de novo (ou espere: o ARIES tenta sozinho a cada 15 min).`
        : r.desligadas.length ? `Apagadas: ${r.desligadas.join(', ')}. A conexão em uso continua.` : 'Nenhuma sobra para apagar.')
      await rodar()
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível desligar') }
  }
  async function reapontar(id: string) {
    setMsg(null)
    try { await proLaboreApi.assistente.reapontarAviso(id); setMsg('Aviso reapontado para o ARIES. Mande uma mensagem de teste de outro número.'); await rodar() } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível reapontar') }
  }
  return (
    <section className="pl-card" style={{ marginTop: 16 }} data-diagnostico-whatsapp>
      <div className="pl-as-conexao-linha" style={{ justifyContent: 'space-between' }}>
        <div>
          <div className="pl-card-title">Diagnóstico do WhatsApp</div>
          <div className="pl-card-sub">Por que um lead não entrou no CRM ou o robô não fez a primeira abordagem, número por número.</div>
        </div>
        <button type="button" className="pl-btn" onClick={() => void rodar()} disabled={carregando}>{carregando ? 'Verificando…' : d ? 'Verificar de novo' : 'Verificar agora'}</button>
      </div>
      {erro && <div className="pl-alert pl-alert-error" role="alert" style={{ marginTop: 10 }}>{erro}</div>}
      {msg && <p className="pl-hint" role="status">{msg}</p>}
      {d && (
        <div style={{ marginTop: 12, display: 'grid', gap: 14 }}>
          {!d.servidor.configurado && <div className="pl-alert pl-alert-error" role="alert">O servidor do WhatsApp não está configurado na API (EVOLUTION_API_URL e EVOLUTION_API_KEY na Vercel). Sem ele nada chega nem sai.</div>}
          {d.servidor.ambienteDeTeste && <div className="pl-alert pl-alert-error" role="alert">Esta API está em modo de teste (AMBIENTE=teste): o WhatsApp fica desligado de propósito.</div>}
          {!d.assistentes.length && <p className="pl-hint">Nenhum WhatsApp de vendedor foi conectado ainda.</p>}
          {d.assistentes.map(a => (
            <div key={a.assistenteId} data-diagnostico-assistente>
              <div className="pl-as-conexao-linha">
                <b>{a.vendedor}</b>{a.numero && <span className="pl-hint">{a.numero}</span>}
                <span className={`pl-status-badge ${a.aoVivo.estado === 'open' ? 'bom' : 'critico'}`}>{ESTADO[a.aoVivo.estado] ?? a.aoVivo.estado}</span>
              </div>
              <div className="pl-hint">
                Último aviso de mensagem: {a.ultimoEventoEm ? tempoRelativo(a.ultimoEventoEm) : 'nunca'} · cadastro automático {a.cadastroAutomatico ? 'ligado' : 'desligado'} · respostas do robô {a.atendimentoAutomatico ? 'ligadas' : 'pausadas'}
                {a.aoVivo.webhook && <> · aviso {a.aoVivo.webhook.apontaParaCa && a.aoVivo.webhook.ativo ? 'apontado para o ARIES' : 'fora do lugar'}</>}
              </div>
              {a.eventosConexao.length > 0 && (
                <details className="pl-hint" style={{ margin: '2px 0' }}>
                  <summary>Últimos avisos de conexão ({a.eventosConexao.length})</summary>
                  <ul style={{ margin: '4px 0', paddingLeft: 18 }}>{a.eventosConexao.map((e, i) => <li key={i}>{new Date(e.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })} · {e.estado === 'open' ? 'conectou' : e.estado === 'close' ? `caiu${e.motivo != null ? ` (código ${e.motivo})` : ''}` : e.estado}</li>)}</ul>
                </details>
              )}
              <div className="pl-hint">Últimas 24 h: {a.ultimas24h.mensagensDeClientes} mensagem(ns) de clientes · {a.ultimas24h.leadsCadastrados} lead(s) cadastrado(s) · {a.ultimas24h.conversasComRobo} abordagem(ns) do robô · {a.ultimas24h.foraDoCrm} fora do CRM · {a.ultimas24h.enviosQueFalharam} envio(s) que falharam</div>
              {!a.problemas.length ? <p className="pl-hint" style={{ color: 'var(--ar-estado-bom)' }}>Nada impede o cadastro nem a abordagem neste número.</p> : (
                <ul className="ar-fila" style={{ marginTop: 6 }}>
                  {a.problemas.map((p, i) => (
                    <li key={i} className="ar-fila-item">
                      <div>
                        <div className="ar-fila-titulo"><span className={`pl-status-badge ${SELO[p.gravidade].classe}`}>{SELO[p.gravidade].rotulo}</span> {p.texto}</div>
                        {p.acao && <div className="pl-hint">O que fazer: {p.acao}</div>}
                      </div>
                      {p.corrigirWebhook && <button type="button" className="pl-btn" onClick={() => void reapontar(a.assistenteId)}>Reapontar o aviso</button>}
                      {p.corrigirDuplicadas && <button type="button" className="pl-btn pl-btn-primary" onClick={() => void desligarDuplicadas(a.assistenteId)} data-desligar-duplicadas>{p.sessaoAntiga ? 'Apagar sessão antiga' : 'Desligar conexões duplicadas'}</button>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
