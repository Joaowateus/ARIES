'use client'

// Aviso na tela quando chega a hora de uma ligação da própria pessoa (vem
// junto com os selos do menu, a cada 45 s): Ligar, Registrar, Adiar 15 min
// ou fechar por 10 min. Com a permissão do navegador, também aparece como
// notificação do computador (uma vez por ligação), mesmo com outra aba aberta.
import { useEffect, useState } from 'react'
import { proLaboreApi, type LigacaoAgora } from '@/lib/proLaboreApi'
import { BotaoLigar, RegistrarLigacao, horaBR, rotuloPasso } from './Ligacoes'

const CHAVE_FECHADOS = 'pl_aviso_ligacao_fechados'
const CHAVE_NOTIFICADOS = 'pl_aviso_ligacao_notificados'

function ler(chave: string, armazenamento: 'session' | 'local'): Record<string, number> {
  try { return JSON.parse((armazenamento === 'session' ? sessionStorage : localStorage).getItem(chave) ?? '{}') } catch { return {} }
}
function gravar(chave: string, armazenamento: 'session' | 'local', valor: Record<string, number>) {
  try { (armazenamento === 'session' ? sessionStorage : localStorage).setItem(chave, JSON.stringify(valor)) } catch { /* sem armazenamento */ }
}

export function AvisoLigacao({ itens, onMudou }: { itens: LigacaoAgora[]; onMudou: () => void }) {
  const [fechados, setFechados] = useState<Record<string, number>>(() => (typeof window === 'undefined' ? {} : ler(CHAVE_FECHADOS, 'session')))
  const [registrando, setRegistrando] = useState<LigacaoAgora | null>(null)
  const [permissao, setPermissao] = useState<NotificationPermission | 'indisponivel'>(() => (typeof window === 'undefined' || !('Notification' in window) ? 'indisponivel' : Notification.permission))
  const [erro, setErro] = useState('')
  const [agora, setAgora] = useState(() => Date.now())

  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 30_000); return () => clearInterval(t) }, [])
  const visiveis = itens.filter(l => !fechados[l.id] || fechados[l.id] < agora)
  const atual = visiveis[0] ?? null

  // Notificação do computador: uma vez por ligação, só com a permissão dada.
  useEffect(() => {
    if (permissao !== 'granted' || !itens.length) return
    const ja = ler(CHAVE_NOTIFICADOS, 'local')
    const limite = Date.now() - 2 * 864e5
    for (const l of itens) {
      if (ja[l.id]) continue
      ja[l.id] = Date.now()
      try {
        const n = new Notification('📞 Hora de ligar', { body: `${l.lead.nomeCliente} · ${horaBR(l.agendadaPara)}${l.instrucao ? `\n${l.instrucao}` : ''}`, tag: `ligacao-${l.id}` })
        n.onclick = () => { window.focus(); n.close() }
      } catch { /* navegador sem suporte (ex.: celular) */ }
    }
    gravar(CHAVE_NOTIFICADOS, 'local', Object.fromEntries(Object.entries(ja).filter(([, t]) => t > limite)))
  }, [itens, permissao])

  if (!atual && !registrando) return null

  function fechar(id: string) {
    const novos = { ...fechados, [id]: Date.now() + 10 * 60e3 }
    setFechados(novos); gravar(CHAVE_FECHADOS, 'session', novos)
  }
  async function adiar(id: string) {
    setErro('')
    try { await proLaboreApi.ligacoes.adiar(id, 15); onMudou() } catch (e) { setErro((e as Error).message) }
  }

  return (
    <>
      {atual && (
        <div className="lg-aviso" role="alertdialog" aria-label="Hora de ligar" data-aviso-ligacao={atual.id}>
          <div className="lg-aviso-cab">
            <b>{atual.discadaEm ? '📝 Registre como foi a ligação' : '📞 Hora de ligar'}{visiveis.length > 1 ? ` · ${visiveis.length}` : ''}</b>
            <button type="button" className="lg-aviso-fechar" onClick={() => fechar(atual.id)} aria-label="Fechar por 10 minutos" title="Fechar por 10 minutos">✕</button>
          </div>
          <div className="lg-aviso-quem"><b>{atual.lead.nomeCliente}</b> · {horaBR(atual.agendadaPara)} · {rotuloPasso({ ...atual, cadenciaNome: null })}</div>
          {atual.instrucao && <p className="lg-aviso-instrucao">{atual.instrucao}</p>}
          <div className="lg-aviso-acoes">
            <BotaoLigar ligacao={atual} telefone={atual.lead.telefone} onDiscou={() => onMudou()} />
            <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setRegistrando(atual)} data-aviso-registrar>Registrar</button>
            <button type="button" className="pl-btn pl-btn-ghost" onClick={() => void adiar(atual.id)} data-aviso-adiar>Adiar 15 min</button>
          </div>
          {erro && <span className="lg-aviso-erro" role="alert">{erro}</span>}
          {permissao === 'default' && (
            <button type="button" className="lg-aviso-permitir" onClick={() => { void Notification.requestPermission().then(setPermissao) }} data-aviso-permitir>
              Avisar também no computador (mesmo com outra aba aberta)
            </button>
          )}
        </div>
      )}
      {registrando && (
        <RegistrarLigacao
          ligacao={{ id: registrando.id, discadaEm: registrando.discadaEm, discagens: registrando.discagens, instrucao: registrando.instrucao }}
          nomeCliente={registrando.lead.nomeCliente}
          onFechar={() => setRegistrando(null)}
          onRegistrou={() => { setRegistrando(null); onMudou() }}
        />
      )}
    </>
  )
}
