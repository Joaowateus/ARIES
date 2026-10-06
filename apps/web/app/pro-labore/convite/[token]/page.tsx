'use client'

// Convite do papel Social Media: a pessoa define a própria senha e entra.
// O link vale 7 dias e uma vez só (a API apaga o token ao usar).
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { proLaboreApi } from '@/lib/proLaboreApi'
import { Botao, EstadoVazio, Rotulo, SmApp } from '../../sm/_ui'

export default function ConvitePage() {
  return (
    <SmApp style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Convite />
    </SmApp>
  )
}

function Convite() {
  const { token } = useParams<{ token: string }>()
  const { entrar } = useProLaboreAuth()
  const [info, setInfo] = useState<{ nome: string; tratamento: string | null; email: string; jaTemSenha: boolean } | null>(null)
  const [invalido, setInvalido] = useState<string | null>(null)
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    proLaboreApi.sm.convite.ver(token).then(setInfo).catch(e => setInvalido(e instanceof Error ? e.message : 'Convite inválido'))
  }, [token])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (senha !== confirmacao) { setErro('As duas senhas não são iguais'); return }
    setEnviando(true); setErro(null)
    try {
      const r = await proLaboreApi.sm.convite.aceitar(token, senha)
      entrar(r.token, r.usuario)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível concluir')
      setEnviando(false)
    }
  }

  if (invalido) {
    return (
      <div className="sm-card" style={{ width: '100%', maxWidth: 420 }}>
        <EstadoVazio titulo="Este convite não vale mais" acao={<Link className="sm-btn" href="/pro-labore/login">Ir para o login</Link>}>
          {invalido}
        </EstadoVazio>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="sm-card" style={{ width: '100%', maxWidth: 420, gap: 16, padding: 28 }} aria-busy={!info}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="sm-marca-logo" aria-hidden="true">A</div>
        <div><div className="sm-marca-nome">Pró-Labore</div><div className="sm-marca-sub">Social Media · acesso isolado</div></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Rotulo>{info?.jaTemSenha ? 'Trocar a senha' : 'Convite'}</Rotulo>
        <h1 className="sm-ttl" style={{ fontSize: 26 }}>{info ? `Olá, ${info.tratamento ?? info.nome.split(' ')[0]}!` : 'Carregando…'}</h1>
        <p className="sm-muted" style={{ margin: 0 }}>
          {info?.jaTemSenha ? 'Defina a nova senha de acesso.' : 'Defina sua senha para entrar no espaço do Social Media.'}
          {info && <> Seu login é <b style={{ color: 'var(--sm-text)' }}>{info.email}</b>.</>}
        </p>
      </div>
      <label className="sm-campo">Senha (mínimo de 8 caracteres)
        <input className="sm-input" type="password" value={senha} onChange={e => setSenha(e.target.value)} minLength={8} required autoComplete="new-password" disabled={!info} />
      </label>
      <label className="sm-campo">Repita a senha
        <input className="sm-input" type="password" value={confirmacao} onChange={e => setConfirmacao(e.target.value)} minLength={8} required autoComplete="new-password" disabled={!info} />
      </label>
      {erro && <p className="sm-erro" role="alert">{erro}</p>}
      <Botao type="submit" variante="pri" disabled={!info || enviando}>{enviando ? 'Entrando…' : 'Definir senha e entrar'}</Botao>
    </form>
  )
}
