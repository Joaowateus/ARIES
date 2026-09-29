'use client'

import { useEffect, useRef, useState } from 'react'
import { proLaboreApi, type AssistenteComercial, type ConexaoAssistente } from '@/lib/proLaboreApi'
import { fmtTelefone, iniciais, tempoRelativo } from './util'

const INTERVALO_STATUS_MS = 3000
const RENOVAR_QR_MS = 45_000

export function Conexao({ assistente, vendedorId, nomeVendedor, servidorConfigurado, isDono, onAtualizar }: {
  assistente: AssistenteComercial | null
  vendedorId?: string
  nomeVendedor: string
  servidorConfigurado: boolean
  isDono: boolean
  onAtualizar: () => void
}) {
  const [codigo, setCodigo] = useState<ConexaoAssistente | null>(null)
  const [modoCodigo, setModoCodigo] = useState(false)
  const [numero, setNumero] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [salvandoToggle, setSalvandoToggle] = useState(false)
  const atualizar = useRef(onAtualizar)
  useEffect(() => { atualizar.current = onAtualizar }, [onAtualizar])

  const status = assistente?.status ?? 'NAO_CONECTADO'
  const conectado = status === 'CONECTADO'
  const quem = isDono ? nomeVendedor : 'você'

  async function gerar(numeroPareamento?: string) {
    setCarregando(true)
    setErro('')
    try {
      const r = await proLaboreApi.assistente.conectar({ vendedorId, numeroPareamento })
      if (r.status === 'CONECTADO') {
        setCodigo(null)
        atualizar.current()
      } else {
        setCodigo(r)
      }
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setCarregando(false)
    }
  }

  // Enquanto o QR/código está na tela: confere a conexão a cada 3s e troca
  // o QR antes de ele expirar (o WhatsApp invalida em ~1 min).
  const exibindoCodigo = !!codigo && !conectado
  useEffect(() => {
    if (!exibindoCodigo) return
    const status = setInterval(async () => {
      try {
        const r = await proLaboreApi.assistente.conexao(vendedorId)
        if (r.status === 'CONECTADO') {
          setCodigo(null)
          atualizar.current()
        }
      } catch { /* tenta de novo no próximo ciclo */ }
    }, INTERVALO_STATUS_MS)
    const renovar = modoCodigo ? null : setInterval(async () => {
      try {
        const r = await proLaboreApi.assistente.conectar({ vendedorId })
        if (r.status === 'CONECTADO') { setCodigo(null); atualizar.current() } else setCodigo(r)
      } catch { /* mantém o QR atual */ }
    }, RENOVAR_QR_MS)
    return () => { clearInterval(status); if (renovar) clearInterval(renovar) }
  }, [exibindoCodigo, modoCodigo, vendedorId])

  async function desconectar() {
    if (!confirm(`Desconectar o WhatsApp de ${nomeVendedor}? O assistente para de responder; conversas e roteiro continuam salvos.`)) return
    setCarregando(true)
    setErro('')
    try {
      await proLaboreApi.assistente.desconectar(vendedorId)
      setCodigo(null)
      atualizar.current()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setCarregando(false)
    }
  }

  async function alternarAtendimento() {
    if (!assistente) return
    setSalvandoToggle(true)
    try {
      await proLaboreApi.assistente.salvar({ vendedorId, atendimentoAutomatico: !assistente.atendimentoAutomatico })
      atualizar.current()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvandoToggle(false)
    }
  }

  if (!servidorConfigurado) {
    return (
      <div className="pl-card pl-as-conexao">
        <div className="pl-as-conexao-icone neutro" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" /></svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pl-card-title">Falta ligar o servidor do WhatsApp</div>
          <div className="pl-card-sub" style={{ lineHeight: 1.55 }}>
            A conexão por QR Code precisa de um servidor que mantenha o WhatsApp aberto 24h (a Evolution API).
            {isDono ? ' Depois de configurado na Vercel, o botão de conectar aparece aqui.' : ' Peça pro dono da conta configurar — depois é só ler o QR Code aqui.'}
            {' '}Enquanto isso, dá pra montar e testar o roteiro na aba “Roteiro e teste”.
          </div>
        </div>
      </div>
    )
  }

  if (conectado && assistente) {
    return (
      <div className="pl-card pl-as-conexao">
        <div className="pl-as-avatar">
          {assistente.fotoPerfilUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={assistente.fotoPerfilUrl} alt="" referrerPolicy="no-referrer" />
            : iniciais(assistente.nomeExibicao || nomeVendedor)}
          <span className="pl-as-ponto on" aria-hidden="true" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pl-as-conexao-linha">
            <span className="pl-card-title">{assistente.nomeExibicao || nomeVendedor}</span>
            <span className="pl-status-badge bom">WhatsApp conectado</span>
          </div>
          <div className="pl-card-sub pl-mono">{fmtTelefone(assistente.numeroWhatsapp)}</div>
          <div className="pl-as-meta">
            Conectado {tempoRelativo(assistente.conectadoEm)}
            {assistente.ultimoEventoEm && <> · última mensagem recebida {tempoRelativo(assistente.ultimoEventoEm)}</>}
          </div>
        </div>
        <div className="pl-as-conexao-acoes">
          <button
            type="button"
            role="switch"
            aria-checked={assistente.atendimentoAutomatico}
            className={`pl-as-switch ${assistente.atendimentoAutomatico ? 'on' : ''}`}
            onClick={alternarAtendimento}
            disabled={salvandoToggle}
          >
            <span className="pl-as-switch-trilho" aria-hidden="true"><span /></span>
            <span>
              <b>{assistente.atendimentoAutomatico ? 'Respondendo leads novos' : 'Respostas pausadas'}</b>
              <small>{assistente.atendimentoAutomatico ? 'Toque pra pausar' : 'Toque pra voltar a responder'}</small>
            </span>
          </button>
          <button type="button" className="pl-btn pl-btn-ghost" onClick={desconectar} disabled={carregando}>Desconectar</button>
        </div>
        {erro && <div className="pl-alert pl-alert-error" style={{ width: '100%' }}>{erro}</div>}
      </div>
    )
  }

  return (
    <div className="pl-card pl-as-conectar">
      <div className="pl-as-conectar-texto">
        <div className="pl-card-title">
          {status === 'DESCONECTADO' ? 'A conexão com o WhatsApp caiu' : `Conectar o WhatsApp de ${isDono ? nomeVendedor : 'você'}`}
        </div>
        <div className="pl-card-sub" style={{ lineHeight: 1.55, marginTop: 4 }}>
          {status === 'DESCONECTADO'
            ? `O aparelho foi desconectado pelo celular ou ficou tempo demais sem internet. Leia o QR Code de novo pra ${quem === 'você' ? 'voltar' : `${nomeVendedor} voltar`} a ter o assistente.`
            : 'Funciona igual ao WhatsApp Web: o número continua normal no celular, e o assistente passa a responder só os leads novos.'}
        </div>

        {!codigo ? (
          <>
            <ol className="pl-as-passos">
              <li>Clique em <b>Gerar QR Code</b></li>
              <li>No celular: WhatsApp → <b>⋮</b> ou <b>Configurações</b> → <b>Aparelhos conectados</b></li>
              <li>Toque em <b>Conectar um aparelho</b> e aponte a câmera pro QR</li>
            </ol>
            <div className="pl-as-botoes">
              <button type="button" className="pl-btn pl-btn-primary" disabled={carregando} onClick={() => { setModoCodigo(false); gerar() }}>
                {carregando && !modoCodigo ? 'Gerando…' : 'Gerar QR Code'}
              </button>
              <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setModoCodigo(m => !m)} aria-expanded={modoCodigo}>
                Estou no celular — conectar com código
              </button>
            </div>
            {modoCodigo && (
              <form className="pl-as-codigo-form" onSubmit={e => { e.preventDefault(); gerar(numero) }}>
                <label className="pl-field" style={{ flex: 1, minWidth: 200 }}>
                  <span>Número do WhatsApp (com DDD)</span>
                  <input className="pl-input" inputMode="tel" placeholder="55 91 98888-7777" value={numero} onChange={e => setNumero(e.target.value)} />
                </label>
                <button type="submit" className="pl-btn pl-btn-primary" disabled={carregando || numero.replace(/\D/g, '').length < 10}>
                  {carregando ? 'Gerando…' : 'Gerar código'}
                </button>
              </form>
            )}
          </>
        ) : codigo.pairingCode && modoCodigo ? (
          <div className="pl-as-pareamento">
            <div className="pl-as-codigo" aria-label={`Código de pareamento ${codigo.pairingCode}`}>
              {codigo.pairingCode.slice(0, 4)}<span>-</span>{codigo.pairingCode.slice(4)}
            </div>
            <ol className="pl-as-passos">
              <li>WhatsApp → <b>Aparelhos conectados</b> → <b>Conectar um aparelho</b></li>
              <li>Toque em <b>Conectar com número de telefone</b></li>
              <li>Digite o código acima</li>
            </ol>
            <div className="pl-as-aguardando"><span className="pl-as-spinner" aria-hidden="true" />Esperando a confirmação no celular…</div>
            <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setCodigo(null)}>Cancelar</button>
          </div>
        ) : (
          <div className="pl-as-aguardando" style={{ marginTop: 18 }}>
            <span className="pl-as-spinner" aria-hidden="true" />
            Esperando a leitura do QR Code… ele é renovado sozinho a cada 45 segundos.
            <button type="button" className="pl-btn pl-btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => setCodigo(null)}>Cancelar</button>
          </div>
        )}
        {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 12 }}>{erro}</div>}
        <div className="pl-as-aviso">
          Conexão não oficial (tipo WhatsApp Web). O assistente só responde contatos novos, com pausa de “digitando…” — ainda assim, evite usar o número pra disparo em massa, que é o que leva o WhatsApp a bloquear.
        </div>
      </div>

      {codigo?.qrBase64 && !modoCodigo && (
        <div className="pl-as-qr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={codigo.qrBase64} alt="QR Code pra conectar o WhatsApp" width={240} height={240} />
        </div>
      )}
    </div>
  )
}
