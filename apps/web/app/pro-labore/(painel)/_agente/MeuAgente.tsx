'use client'

// Cartão pessoal do Aries no WhatsApp (no Copiloto): cada pessoa gera o
// próprio código, abre a conversa com o agente já com o código escrito e
// liga/desliga o resumo da manhã e os avisos. Some se o gestor ainda não
// conectou o número do agente.
import { useCallback, useEffect, useState } from 'react'
import { proLaboreApi, type AgenteMeu } from '@/lib/proLaboreApi'
import './agente.css'

export function MeuAgente() {
  const [dados, setDados] = useState<AgenteMeu | null>(null)
  const [erro, setErro] = useState('')
  const carregar = useCallback(() => proLaboreApi.agente.meu().then(setDados).catch(() => setDados(null)), [])
  useEffect(() => { carregar() }, [carregar])

  if (!dados?.agente || dados.agente.status !== 'CONECTADO') return null
  const { agente, vinculo } = dados
  const vinculado = !!vinculo?.verificadoEm && !!vinculo.numero
  async function acao(f: () => Promise<unknown>) {
    setErro('')
    try { await f(); await carregar() } catch (e) { setErro((e as Error).message) }
  }

  return (
    <section className={`ag-meu ${vinculado ? 'vinculado' : ''}`} aria-label={`${agente.nome} no WhatsApp`} data-meu-agente>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/sm-icone-192.png" alt="" width={36} height={36} className="ag-foto" />
      {vinculado ? (
        <div className="ag-meu-texto">
          <b>Você conversa com o {agente.nome} no WhatsApp</b>
          <span>Pergunte quem atender, sua agenda, seus números — ou peça para anotar algo.</span>
          <div className="ag-meu-acoes">
            <label className="ag-toggle"><input type="checkbox" checked={vinculo!.manha} onChange={e => acao(() => proLaboreApi.agente.meuPreferencias({ manha: e.target.checked }))} /> Resumo às {agente.manhaHora}</label>
            <label className="ag-toggle"><input type="checkbox" checked={vinculo!.alertas} onChange={e => acao(() => proLaboreApi.agente.meuPreferencias({ alertas: e.target.checked }))} /> Avisos</label>
            {agente.numero && <a className="pl-link-action" href={`https://wa.me/${agente.numero}`} target="_blank" rel="noreferrer">Abrir a conversa</a>}
          </div>
        </div>
      ) : (
        <div className="ag-meu-texto">
          <b>Converse com o {agente.nome} no WhatsApp</b>
          <span>Seu assistente em outra conversa, com a logo da loja: resumo da manhã, quem atender agora, sua agenda e avisos de lead esperando.</span>
          <div className="ag-meu-acoes">
            {vinculo ? (
              <>
                <span>Mande <b className="pl-mono" data-meu-codigo>ARIES {vinculo.codigo}</b> para o {agente.nome}</span>
                {vinculo.link && <a className="pl-btn pl-btn-primary" href={vinculo.link} target="_blank" rel="noreferrer">Abrir no WhatsApp</a>}
                <button type="button" className="pl-link-action" onClick={() => acao(() => proLaboreApi.agente.meuCodigo())}>Novo código</button>
              </>
            ) : <button type="button" className="pl-btn pl-btn-primary" onClick={() => acao(() => proLaboreApi.agente.meuCodigo())} data-meu-gerar>Ativar no meu WhatsApp</button>}
          </div>
        </div>
      )}
      {erro && <div className="pl-alert pl-alert-error">{erro}</div>}
    </section>
  )
}
