'use client'

// Aviso do bloqueio do app pela Meta ("API access blocked") no Tráfego e no
// Social Media. Os dois podem usar apps diferentes: cada aba mostra o passo a
// passo quando a conexão dela está parada e só uma nota quando é a outra.
// "Já resolvi: testar agora" testa as duas; sem ninguém clicar, a API testa
// sozinha de hora em hora.
import { useCallback, useEffect, useState } from 'react'
import { proLaboreApi, type EstadoConexaoMeta, type TesteConexaoMeta } from '@/lib/proLaboreApi'

const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Belem', day: '2-digit', month: '2-digit' })
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Belem', hour: '2-digit', minute: '2-digit' })

const NOME = { TRAFEGO: 'Tráfego', SOCIAL_MEDIA: 'Instagram' } as const

export function AvisoConexaoMeta({ modulo, versao, onLiberado }: { modulo: 'TRAFEGO' | 'SOCIAL_MEDIA'; versao?: string; onLiberado?: () => void }) {
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
    return <div className="pl-alert" role="status" style={{ marginBottom: 12 }}>A Meta liberou o acesso. O Tráfego e o Instagram voltam a sincronizar agora.</div>
  }
  if (!estado?.bloqueado || !estado.bloqueadoDesde) return null
  const outro = modulo === 'TRAFEGO' ? 'SOCIAL_MEDIA' : 'TRAFEGO'
  // Parado só o outro módulo: esta aba funciona, fica uma nota.
  if (estado.origem === outro) {
    return (
      <div className="pl-alert" role="status" style={{ marginBottom: 12 }}>
        {NOME[modulo]} funcionando normalmente. O app da Meta usado pelo {NOME[outro]} continua bloqueado desde {data(estado.bloqueadoDesde)}: o passo a passo está na aba {outro === 'TRAFEGO' ? 'Tráfego' : 'Social Media'}.
      </div>
    )
  }
  const parado = estado.origem === 'AMBOS' ? 'o Tráfego e o Instagram pararam' : `o ${NOME[modulo]} parou`
  return (
    <section className="pl-card pl-meta-bloqueio" aria-label="Conexão com a Meta bloqueada">
      <div className="pl-card-head">
        <div>
          <div className="pl-card-title">{estado.titulo} desde {data(estado.bloqueadoDesde)}</div>
          <div className="pl-card-sub">
            Por isso {parado}. Trocar ou gerar token não resolve; a pendência está no painel do app na Meta.
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
