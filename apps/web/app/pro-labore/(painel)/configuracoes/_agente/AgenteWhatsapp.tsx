'use client'

// Configurações › Aries no WhatsApp: o gestor conecta um número só do agente
// (chip próprio), que aparece com a logo da loja e conversa com ele e com a
// equipe como uma pessoa. Aqui também saem os códigos de vínculo de cada um.
import { useCallback, useEffect, useState } from 'react'
import { proLaboreApi, type AgentePainel, type AgenteVinculoInfo } from '@/lib/proLaboreApi'
import '../../_agente/agente.css'

const fone = (n: string | null) => {
  if (!n) return ''
  const d = n.replace(/\D/g, '')
  return d.length >= 12 ? `+${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, -4)}-${d.slice(-4)}` : n
}

export function AgenteWhatsapp() {
  const [painel, setPainel] = useState<AgentePainel | null>(null)
  const [codigo, setCodigo] = useState<{ qrBase64: string | null; pairingCode: string | null } | null>(null)
  const [numeroPareamento, setNumeroPareamento] = useState('')
  const [nome, setNome] = useState('')
  const [manhaHora, setManhaHora] = useState('08:00')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const carregar = useCallback(() => proLaboreApi.agente.painel().then(p => {
    setPainel(p)
    if (p.agente) { setNome(p.agente.nome); setManhaHora(p.agente.manhaHora) }
  }).catch(e => setErro((e as Error).message)), [])
  useEffect(() => { carregar() }, [carregar])

  // Enquanto o QR está na tela, confirma a conexão a cada 3 s.
  useEffect(() => {
    if (!codigo) return
    const t = setInterval(() => {
      proLaboreApi.agente.conexao().then(r => { if (r.status === 'CONECTADO') { setCodigo(null); carregar() } }).catch(() => undefined)
    }, 3000)
    return () => clearInterval(t)
  }, [codigo, carregar])

  async function acao(f: () => Promise<unknown>, ok?: string) {
    setOcupado(true); setErro(''); setAviso('')
    try { await f(); if (ok) setAviso(ok); await carregar() } catch (e) { setErro((e as Error).message) } finally { setOcupado(false) }
  }
  async function conectar() {
    setOcupado(true); setErro('')
    try {
      const r = await proLaboreApi.agente.conectar(numeroPareamento ? { numeroPareamento } : {})
      if (r.status === 'CONECTADO') { setCodigo(null); await carregar() } else setCodigo({ qrBase64: r.qrBase64 ?? null, pairingCode: r.pairingCode ?? null })
    } catch (e) { setErro((e as Error).message) } finally { setOcupado(false) }
  }

  if (!painel) return <section className="pl-card ag-card"><p className="pl-hint">{erro || 'Carregando o agente…'}</p></section>
  const a = painel.agente
  const conectado = a?.status === 'CONECTADO'

  return (
    <section className="pl-card ag-card" aria-label="Aries no WhatsApp" data-agente-config>
      <div className="pl-card-head">
        <div className="ag-cab">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sm-icone-192.png" alt="" width={44} height={44} className="ag-foto" />
          <div>
            <div className="pl-card-title">{a?.nome ?? 'Aries'} no WhatsApp</div>
            <div className="pl-card-sub">Um número só do agente, com a logo da loja. Conversa com você e com a equipe como uma pessoa: responde com os números do sistema, anota na agenda, manda o resumo da manhã e avisa quando um lead está esperando.</div>
          </div>
        </div>
        {conectado && <span className="ag-selo ok" data-agente-status>Conectado · {fone(a!.numero)}</span>}
      </div>

      {!painel.configurado && <div className="pl-alert pl-alert-error">O servidor do WhatsApp ainda não foi configurado (EVOLUTION_API_URL / EVOLUTION_API_KEY na Vercel).</div>}

      {!conectado && painel.configurado && (
        codigo ? (
          <div className="ag-qr">
            {codigo.qrBase64 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={codigo.qrBase64} alt="QR Code para conectar o número do agente" width={220} height={220} />
            )}
            <div>
              <ol className="ag-passos">
                <li>Use um chip só para o agente (não o seu WhatsApp pessoal nem o de vendas).</li>
                <li>No celular desse chip: WhatsApp › Aparelhos conectados › Conectar aparelho.</li>
                <li>{codigo.pairingCode ? <>Escolha &quot;conectar com número de telefone&quot; e digite <b className="pl-mono">{codigo.pairingCode}</b>.</> : 'Aponte a câmera para o QR Code.'}</li>
              </ol>
              <div className="pl-as-aguardando"><span className="pl-as-spinner" aria-hidden="true" />Esperando a confirmação no celular…</div>
              <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setCodigo(null)}>Cancelar</button>
            </div>
          </div>
        ) : (
          <div className="ag-conectar">
            <input className="pl-input" value={numeroPareamento} onChange={e => setNumeroPareamento(e.target.value)} placeholder="Número do chip (opcional, para conectar por código)" aria-label="Número do chip do agente" />
            <button type="button" className="pl-btn pl-btn-primary" onClick={conectar} disabled={ocupado} data-agente-conectar>{ocupado ? 'Gerando…' : 'Conectar número do agente'}</button>
          </div>
        )
      )}

      {conectado && (
        <>
          <div className="ag-config">
            <div className="pl-field">
              <label htmlFor="ag-nome">Nome no WhatsApp</label>
              <input id="ag-nome" className="pl-input" value={nome} maxLength={25} onChange={e => setNome(e.target.value)} />
            </div>
            <div className="pl-field">
              <label htmlFor="ag-manha">Resumo da manhã às</label>
              <input id="ag-manha" type="time" min="05:00" max="11:59" className="pl-input" value={manhaHora} onChange={e => setManhaHora(e.target.value)} />
            </div>
            <div className="ag-botoes">
              <button type="button" className="pl-btn pl-btn-primary" disabled={ocupado} onClick={() => acao(() => proLaboreApi.agente.config({ nome, manhaHora }), 'Salvo.')}>Salvar</button>
              <button type="button" className="pl-btn pl-btn-ghost" disabled={ocupado} onClick={() => acao(() => proLaboreApi.agente.perfil(), 'Foto e nome enviados ao WhatsApp.')} data-agente-perfil>{a!.perfilEm ? 'Reaplicar foto e nome' : 'Aplicar foto e nome'}</button>
              <button type="button" className="pl-btn pl-btn-ghost pl-as-perigo" disabled={ocupado} onClick={() => { if (confirm('Desconectar o número do agente? A equipe deixa de receber as mensagens até conectar de novo.')) acao(() => proLaboreApi.agente.desconectar()) }}>Desconectar</button>
            </div>
          </div>

          <div className="ag-pessoas">
            <h3>Quem conversa com o {a!.nome}</h3>
            <p className="pl-hint">Cada pessoa vincula o próprio WhatsApp mandando o código para o número do agente (o link já abre a conversa com o código escrito). Só números vinculados recebem dados.</p>
            <ul>
              {painel.pessoas.map(p => <LinhaPessoa key={p.pessoa} nome={p.nome} dono={p.papel === 'DONO'} vinculo={p.vinculo} ocupado={ocupado}
                onCodigo={() => acao(() => proLaboreApi.agente.codigo(p.pessoa))}
                onPreferencia={d => acao(() => proLaboreApi.agente.preferencias(p.pessoa, d))}
                onDesvincular={() => acao(() => proLaboreApi.agente.desvincular(p.pessoa))} />)}
            </ul>
          </div>
        </>
      )}

      {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 12 }}>{erro}</div>}
      {aviso && <div className="pl-alert pl-alert-success" style={{ marginTop: 12 }}>{aviso}</div>}
    </section>
  )
}

function LinhaPessoa({ nome, dono, vinculo, ocupado, onCodigo, onPreferencia, onDesvincular }: {
  nome: string; dono: boolean; vinculo: AgenteVinculoInfo | null; ocupado: boolean
  onCodigo: () => void; onPreferencia: (d: { manha?: boolean; alertas?: boolean }) => void; onDesvincular: () => void
}) {
  const vinculado = !!vinculo?.verificadoEm && !!vinculo.numero
  return (
    <li className="ag-pessoa" data-agente-pessoa={nome}>
      <div className="ag-pessoa-quem">
        <b>{nome}{dono ? ' (você)' : ''}</b>
        <span className={`ag-selo ${vinculado ? 'ok' : ''}`}>{vinculado ? `Vinculado · ${fone(vinculo!.numero)}` : vinculo ? 'Aguardando o código' : 'Sem vínculo'}</span>
      </div>
      {vinculo && !vinculado && (
        <div className="ag-codigo">
          Código <b className="pl-mono" data-agente-codigo>{vinculo.codigo}</b>
          {vinculo.link && <a className="pl-link-action" href={vinculo.link} target="_blank" rel="noreferrer">Abrir no WhatsApp</a>}
          <button type="button" className="pl-link-action" onClick={() => navigator.clipboard?.writeText(`Para falar com o Aries no WhatsApp, mande ARIES ${vinculo.codigo}${vinculo.link ? ` por este link: ${vinculo.link}` : ''}`).catch(() => undefined)}>Copiar convite</button>
        </div>
      )}
      <div className="ag-pessoa-acoes">
        {vinculado && (
          <>
            <label className="ag-toggle"><input type="checkbox" checked={vinculo!.manha} disabled={ocupado} onChange={e => onPreferencia({ manha: e.target.checked })} /> Resumo da manhã</label>
            {!dono && <label className="ag-toggle"><input type="checkbox" checked={vinculo!.alertas} disabled={ocupado} onChange={e => onPreferencia({ alertas: e.target.checked })} /> Avisos de lead esperando</label>}
          </>
        )}
        <button type="button" className="pl-btn pl-btn-ghost" disabled={ocupado} onClick={onCodigo} data-agente-gerar>{vinculo ? 'Novo código' : 'Gerar código'}</button>
        {vinculo && <button type="button" className="pl-link-action pl-as-perigo" disabled={ocupado} onClick={onDesvincular}>Desvincular</button>}
      </div>
    </li>
  )
}
