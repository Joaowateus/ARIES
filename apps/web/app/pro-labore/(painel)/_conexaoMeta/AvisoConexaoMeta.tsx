'use client'

// Aviso único do bloqueio do app pela Meta ("API access blocked"), igual no
// Tráfego e no Social Media: os dois usam o mesmo app, então param juntos e
// voltam juntos. Mostra o passo a passo e o "Já resolvi: testar agora"; sem
// ninguém clicar, a API testa sozinha de hora em hora.
import { useCallback, useEffect, useState } from 'react'
import { proLaboreApi, type EstadoConexaoMeta, type TesteConexaoMeta } from '@/lib/proLaboreApi'

const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Belem', day: '2-digit', month: '2-digit' })
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Belem', hour: '2-digit', minute: '2-digit' })

export function AvisoConexaoMeta({ versao, onLiberado }: { versao?: string; onLiberado?: () => void }) {
  const [estado, setEstado] = useState<EstadoConexaoMeta | null>(null)
  const [testando, setTestando] = useState(false)
  const [testes, setTestes] = useState<TesteConexaoMeta[] | null>(null)
  const [liberado, setLiberado] = useState(false)
  const [erro, setErro] = useState('')
  const carregar = useCallback(() => { proLaboreApi.metaConexao.estado().then(setEstado).catch(() => setEstado(null)) }, [])
  useEffect(() => { carregar() }, [carregar, versao])

  async function testar() {
    setTestando(true); setErro('')
    try {
      const r = await proLaboreApi.metaConexao.testar()
      setTestes(r.testes); setEstado(r.estado)
      if (!r.bloqueado) { setLiberado(true); onLiberado?.() }
    } catch (e) { setErro((e as Error).message) } finally { setTestando(false) }
  }

  if (liberado && !estado?.bloqueado) {
    return <div className="pl-alert" role="status" style={{ marginBottom: 12 }}>A Meta liberou o app. O Tráfego e o Instagram voltam a sincronizar agora.</div>
  }
  if (!estado?.bloqueado || !estado.bloqueadoDesde) return null
  return (
    <section className="pl-card pl-meta-bloqueio" aria-label="Conexão com a Meta bloqueada">
      <div className="pl-card-head">
        <div>
          <div className="pl-card-title">{estado.titulo} desde {data(estado.bloqueadoDesde)}</div>
          <div className="pl-card-sub">
            Por isso o Tráfego e o Instagram pararam juntos: os dois usam o mesmo app da Meta. Trocar ou gerar token não resolve; a pendência está no painel do app.
          </div>
        </div>
      </div>
      <ol className="pl-meta-bloqueio-passos">{estado.passos.map((p, i) => <li key={i}>{p}</li>)}</ol>
      {estado.mensagemMeta && <p className="pl-hint">Mensagem da Meta: “{estado.mensagemMeta}”{estado.verificadoEm ? ` · testado sozinho às ${hora(estado.verificadoEm)}` : ''}</p>}
      {testes && (
        <ul className="pl-meta-bloqueio-testes">
          {testes.map(t => <li key={t.modulo} className={t.ok ? 'ok' : 'erro'}><b>{t.nome}</b>: {t.ok ? 'respondeu normalmente' : t.detalhe}</li>)}
        </ul>
      )}
      {erro && <div className="pl-alert pl-alert-error">{erro}</div>}
      <div><button type="button" className="pl-btn pl-btn-primary" disabled={testando} onClick={() => void testar()}>{testando ? 'Testando com a Meta…' : 'Já resolvi: testar agora'}</button></div>
    </section>
  )
}
