'use client'

// Faixa do CRM sobre o cadastro automático: o lead que chama o WhatsApp
// conectado do vendedor entra sozinho na etapa Leads. Mostra quem ainda
// precisa conectar e quantos entraram hoje.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { proLaboreApi, type CapturaWhatsappCrm } from '@/lib/proLaboreApi'

const IconeWhats = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
)

export function FaixaWhatsapp({ gestao, versao }: { gestao: boolean; versao: number }) {
  const [d, setD] = useState<CapturaWhatsappCrm | null>(null)
  useEffect(() => {
    let cancelado = false
    proLaboreApi.leads.capturaWhatsapp().then(r => { if (!cancelado) setD(r) }).catch(() => undefined)
    return () => { cancelado = true }
  }, [versao])
  if (!d || !d.servidorConfigurado || !d.vendedores.length) return null

  const hoje = d.cadastradosHoje > 0 ? ` · ${d.cadastradosHoje} ${d.cadastradosHoje === 1 ? 'entrou' : 'entraram'} hoje` : ''
  const linkConectar = gestao ? '/pro-labore/assistente?aba=whatsapp' : '/pro-labore/assistente'

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
        <span>{eu.cadastroAutomatico ? `Contatos novos do seu WhatsApp entram sozinhos em Leads${hoje}.` : 'Os contatos novos não estão entrando sozinhos no CRM.'}</span>
        {!eu.cadastroAutomatico && <Link className="pl-link-action pl-leads-textlink" href={linkConectar}>Ligar de novo →</Link>}
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
      </span>
      {faltam.length > 0 && <Link className="pl-btn pl-btn-ghost" href={linkConectar}>Conectar WhatsApp</Link>}
    </div>
  )
}
