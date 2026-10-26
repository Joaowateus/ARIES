'use client'

// Faixa do CRM sobre o cadastro automático: o lead que chama o WhatsApp
// conectado do vendedor entra sozinho na etapa Leads. Mostra quem ainda
// precisa conectar e quantos entraram hoje.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { proLaboreApi, type CapturaWhatsappCrm, type PreferenciasLojaAssistente } from '@/lib/proLaboreApi'
import { ForaDoCrm } from './ForaDoCrm'

const IconeWhats = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
)

// Chave da gestão: o Assistente move o lead no funil sozinho (só para
// frente, com aviso no WhatsApp do vendedor e "Desfazer" no card).
function ChaveAvanco() {
  const [p, setP] = useState<PreferenciasLojaAssistente | null>(null)
  const [salvando, setSalvando] = useState(false)
  useEffect(() => { proLaboreApi.assistente.loja().then(setP).catch(() => undefined) }, [])
  if (!p?.podeEditar) return null
  async function alternar() {
    setSalvando(true)
    try { setP(await proLaboreApi.assistente.salvarLoja({ avancoAutomatico: !p!.avancoAutomatico })) } finally { setSalvando(false) }
  }
  return (
    <button type="button" role="switch" aria-checked={p.avancoAutomatico} className={`pl-as-switch ${p.avancoAutomatico ? 'on' : ''}`} onClick={alternar} disabled={salvando} data-chave-avanco
      title="Lead → Abordado quando o vendedor responde; Abordado → Negociação com pedido de simulação, visita ou documentos (ou nota alta); Negociação → Proposta quando o vendedor manda a proposta. Nunca para Fechado ou Perdido.">
      <span className="pl-as-switch-trilho" aria-hidden="true"><span /></span>
      <span><b>{p.avancoAutomatico ? 'Avanço automático ligado' : 'Avanço automático desligado'}</b><small>O assistente move o lead e avisa o vendedor</small></span>
    </button>
  )
}

// Conferência dos leads: quem escreveu e ficou fora do CRM, para revisar.
function BotaoForaDoCrm({ total, onMudou }: { total: number; onMudou: () => void }) {
  const [aberto, setAberto] = useState(false)
  if (!total) return null
  return (
    <>
      <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setAberto(true)} data-abrir-fora-crm
        title="Contatos antigos que escreveram sem falar de compra: revise se algum é lead">
        {total} fora do CRM · revisar
      </button>
      {aberto && <ForaDoCrm onFechar={() => setAberto(false)} onMudou={onMudou} />}
    </>
  )
}

export function FaixaWhatsapp({ gestao, versao, onMudou }: { gestao: boolean; versao: number; onMudou?: () => void }) {
  const [d, setD] = useState<CapturaWhatsappCrm | null>(null)
  const [recarga, setRecarga] = useState(0)
  useEffect(() => {
    let cancelado = false
    proLaboreApi.leads.capturaWhatsapp().then(r => { if (!cancelado) setD(r) }).catch(() => undefined)
    return () => { cancelado = true }
  }, [versao, recarga])
  if (!d || !d.vendedores.length) return null
  const mudou = () => { setRecarga(r => r + 1); onMudou?.() }
  const conferido = d.ultimaVarreduraEm ? ` Conferido no WhatsApp às ${new Date(d.ultimaVarreduraEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.` : ''
  const linkConectar = gestao ? '/pro-labore/assistente?aba=whatsapp' : '/pro-labore/assistente'

  // Sem o servidor do WhatsApp (Evolution) ninguém consegue conectar: diz o
  // que falta em vez de esconder a faixa.
  if (!d.servidorConfigurado) {
    return gestao ? (
      <div className="pl-alert pl-alert-info" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }} data-faixa-whatsapp="sem-servidor">
        <IconeWhats />
        <span style={{ flex: '1 1 300px' }}>
          <b>Cadastro automático pelo WhatsApp:</b> falta ligar o servidor do WhatsApp (um só para a equipe toda). Depois disso, cada vendedor conecta o próprio número por QR Code e os leads passam a entrar sozinhos aqui.
        </span>
        <Link className="pl-btn pl-btn-ghost" href={linkConectar}>Ver o que falta</Link>
      </div>
    ) : (
      <div className="pl-section-note" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }} data-faixa-whatsapp="sem-servidor">
        <span className="pl-status-badge atencao">Em ativação</span>
        <span>Cadastro automático pelo WhatsApp: quando o gestor ligar, você conecta seu WhatsApp e os leads passam a entrar sozinhos aqui.</span>
      </div>
    )
  }

  const hoje = d.cadastradosHoje > 0 ? ` · ${d.cadastradosHoje} ${d.cadastradosHoje === 1 ? 'entrou' : 'entraram'} hoje` : ''

  if (!gestao) {
    const eu = d.vendedores[0]
    if (!eu.conectado) {
      return (
        <div className="pl-alert pl-alert-info" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }} data-faixa-whatsapp="desconectado">
          <IconeWhats />
          <span style={{ flex: '1 1 260px' }}><b>Conecte seu WhatsApp</b> e todo contato novo que te chamar entra sozinho aqui, na etapa Leads — sem cadastrar na mão.</span>
          <Link className="pl-btn pl-btn-primary" href={linkConectar}>Conectar meu WhatsApp</Link>
        </div>
      )
    }
    return (
      <div className="pl-section-note" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }} data-faixa-whatsapp={eu.cadastroAutomatico ? 'ativo' : 'pausado'}>
        <span className={`pl-status-badge ${eu.cadastroAutomatico ? 'bom' : 'atencao'}`}>{eu.cadastroAutomatico ? 'WhatsApp conectado' : 'Cadastro automático pausado'}</span>
        <span>{eu.cadastroAutomatico ? `Contatos novos do seu WhatsApp entram sozinhos em Leads${hoje}.${conferido}` : 'Os contatos novos não estão entrando sozinhos no CRM.'}</span>
        {!eu.cadastroAutomatico && <Link className="pl-link-action pl-leads-textlink" href={linkConectar}>Ligar de novo →</Link>}
        <BotaoForaDoCrm total={d.foraDoCrm} onMudou={mudou} />
      </div>
    )
  }

  const conectados = d.vendedores.filter(v => v.conectado && v.cadastroAutomatico)
  const faltam = d.vendedores.filter(v => !v.conectado || !v.cadastroAutomatico)
  return (
    <div className={faltam.length ? 'pl-alert pl-alert-info' : 'pl-section-note'} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }} data-faixa-whatsapp="gestao">
      <IconeWhats />
      <span style={{ flex: '1 1 300px' }}>
        <b>Cadastro automático pelo WhatsApp:</b> {conectados.length} de {d.vendedores.length} vendedor{d.vendedores.length !== 1 ? 'es' : ''} com os leads entrando sozinhos{hoje}.
        {faltam.length > 0 && <> Falta{faltam.length > 1 ? 'm' : ''}: {faltam.map(v => `${v.nome}${v.conectado ? ' (pausado)' : ''}`).join(', ')}.</>}
        {conferido}
      </span>
      {faltam.length > 0 && <Link className="pl-btn pl-btn-ghost" href={linkConectar}>Conectar WhatsApp</Link>}
      <BotaoForaDoCrm total={d.foraDoCrm} onMudou={mudou} />
      {conectados.length > 0 && <ChaveAvanco />}
    </div>
  )
}
