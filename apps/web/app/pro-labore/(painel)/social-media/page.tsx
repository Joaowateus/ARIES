'use client'

import { useCallback, useEffect, useState } from 'react'
import { proLaboreApi, SocialMediaConta, ResumoSocialMedia } from '@/lib/proLaboreApi'
import { formatMoeda } from '@/lib/format'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { SocialJourneyCircular } from './SocialJourneyCircular'

const TIPO_MIDIA_LABEL: Record<string, string> = {
  IMAGE: 'Fotos',
  VIDEO: 'Vídeos',
  CAROUSEL_ALBUM: 'Carrosséis',
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

export default function ProLaboreSocialMediaPage() {
  const { usuario } = useProLaboreAuth()
  const isDono = usuario?.papel === 'DONO'

  const [carregando, setCarregando] = useState(true)
  const [conta, setConta] = useState<SocialMediaConta | null>(null)
  const [resumo, setResumo] = useState<ResumoSocialMedia | null>(null)

  const [tokenInput, setTokenInput] = useState('')
  const [conectando, setConectando] = useState(false)
  const [erroConexao, setErroConexao] = useState('')

  const [sincronizando, setSincronizando] = useState(false)
  const [erroSync, setErroSync] = useState('')

  const carregar = useCallback(() => {
    if (!isDono) { setCarregando(false); return }
    setCarregando(true)
    proLaboreApi.socialMedia.conta()
      .then(c => {
        setConta(c)
        if (c) return proLaboreApi.socialMedia.resumo().then(setResumo)
        return null
      })
      .finally(() => setCarregando(false))
  }, [isDono])

  useEffect(() => { carregar() }, [carregar])

  async function conectar(e: React.FormEvent) {
    e.preventDefault()
    setErroConexao('')
    setConectando(true)
    try {
      await proLaboreApi.socialMedia.conectar(tokenInput.trim())
      setTokenInput('')
      carregar()
    } catch (err) {
      setErroConexao(err instanceof Error ? err.message : 'Erro ao conectar com o Instagram')
    } finally {
      setConectando(false)
    }
  }

  async function sincronizar() {
    setErroSync('')
    setSincronizando(true)
    try {
      await proLaboreApi.socialMedia.sincronizar()
      carregar()
    } catch (err) {
      setErroSync(err instanceof Error ? err.message : 'Erro ao sincronizar')
    } finally {
      setSincronizando(false)
    }
  }

  async function desconectar() {
    if (!confirm('Desconectar a conta do Instagram? Todo o histórico de publicações e métricas sincronizadas será apagado.')) return
    await proLaboreApi.socialMedia.desconectar()
    setConta(null)
    setResumo(null)
  }

  if (!isDono) {
    return (
      <div className="pl-empty pl-card">
        <div className="pl-emoji">🔒</div>
        <h3 style={{ margin: 0, color: 'var(--pl-ink-1)', fontWeight: 600 }}>Área restrita ao dono da operação</h3>
        <p style={{ marginTop: 6 }}>Os dados de Social Media são usados pra auditar a produção da equipe.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="pl-section-head" style={{ marginTop: 0 }}>
        <div>
          <div className="pl-eyebrow">Equipe</div>
          <h2 className="pl-section-title">Social Media</h2>
          <div className="pl-section-note" style={{ marginTop: 4 }}>Produção, desempenho e crescimento reais do Instagram — puxados direto da conta, sem lançamento manual</div>
        </div>
        {conta && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="pl-btn pl-btn-ghost" onClick={desconectar}>Desconectar</button>
            <button type="button" className="pl-btn pl-btn-primary" onClick={sincronizar} disabled={sincronizando}>
              {sincronizando ? 'Sincronizando…' : 'Sincronizar agora'}
            </button>
          </div>
        )}
      </div>

      {carregando && <div className="pl-hint">Carregando…</div>}

      {!carregando && !conta && (
        <div className="pl-card" style={{ maxWidth: 560 }}>
          <div className="pl-card-head">
            <div>
              <div className="pl-card-title">Conectar conta do Instagram</div>
              <div className="pl-card-sub">Precisa ser uma conta comercial/criador de conteúdo vinculada a uma Página do Facebook</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '0 0 14px' }}>
            {[
              <>Acesse o <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer">Graph API Explorer</a> da Meta, logado com a conta que administra a Página.</>,
              <>Selecione o seu aplicativo no topo, e em &quot;Permissions&quot; adicione: <code>instagram_basic</code>, <code>instagram_manage_insights</code>, <code>pages_show_list</code>, <code>pages_read_engagement</code>.</>,
              <>Clique em &quot;Generate Access Token&quot;, autorize, e copie o token gerado.</>,
              <>Cole o token abaixo — a gente troca ele automaticamente por um de longa duração.</>,
            ].map((texto, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--pl-ink-2)', lineHeight: 1.5 }}>
                <span style={{ flexShrink: 0, fontWeight: 700, color: 'var(--pl-ink-muted)' }}>{i + 1}.</span>
                <span>{texto}</span>
              </div>
            ))}
          </div>
          <form onSubmit={conectar}>
            <textarea
              className="pl-input"
              style={{ width: '100%', minHeight: 80, fontFamily: 'monospace', fontSize: 12 }}
              placeholder="Cole aqui o token gerado no Graph API Explorer"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              required
            />
            {erroConexao && <div style={{ color: 'var(--pl-critical)', fontSize: 12.5, marginTop: 8 }}>{erroConexao}</div>}
            <button type="submit" className="pl-btn pl-btn-primary" style={{ marginTop: 10 }} disabled={conectando}>
              {conectando ? 'Conectando…' : 'Conectar'}
            </button>
          </form>
        </div>
      )}

      {!carregando && conta && resumo?.conectado && (
        <>
          <div className="pl-card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            {conta.fotoUrl && <img src={conta.fotoUrl} alt="" style={{ width: 44, height: 44, borderRadius: '50%' }} />}
            <div>
              <div className="pl-card-title">@{conta.nomeUsuario}</div>
              <div className="pl-card-sub">{conta.seguidores.toLocaleString('pt-BR')} seguidores · última sincronização {formatarData(conta.atualizadoEm)}</div>
            </div>
          </div>
          {erroSync && <div style={{ color: 'var(--pl-critical)', fontSize: 12.5, marginBottom: 12 }}>{erroSync}</div>}

          <div className="pl-kpi-grid" style={{ marginBottom: 20 }}>
            <div className="pl-kpi">
              <div className="pl-kpi-label">Publicações no período</div>
              <div className="pl-kpi-value">{resumo.volume.totalPublicacoes}<span className="pl-unit"> / {resumo.volume.metaPeriodo}</span></div>
            </div>
            <div className="pl-kpi">
              <div className="pl-kpi-label">Alcance total</div>
              <div className="pl-kpi-value">{resumo.desempenho.alcanceTotal.toLocaleString('pt-BR')}</div>
            </div>
            <div className="pl-kpi">
              <div className="pl-kpi-label">Taxa de engajamento</div>
              <div className="pl-kpi-value">{(resumo.desempenho.taxaEngajamento * 100).toFixed(1)}<span className="pl-unit">%</span></div>
            </div>
            <div className="pl-kpi">
              <div className="pl-kpi-label">Novos seguidores</div>
              <div className="pl-kpi-value">{resumo.crescimento.novosSeguidoresPeriodo}</div>
            </div>
          </div>

          <div className="pl-grid-2" style={{ marginBottom: 16 }}>
            <div className="pl-card">
              <div className="pl-card-head">
                <div>
                  <div className="pl-card-title">Volume de produção</div>
                  <div className="pl-card-sub">Meta: {resumo.volume.metaPostagensSemanais} publicações/semana</div>
                </div>
              </div>
              {resumo.volume.porTipo.length === 0 && <div className="pl-hint">Nenhuma publicação no período.</div>}
              {resumo.volume.porTipo.map(t => (
                <div key={t.tipo} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--pl-border)', fontSize: 13 }}>
                  <span>{TIPO_MIDIA_LABEL[t.tipo] ?? t.tipo}</span>
                  <b>{t.quantidade}</b>
                </div>
              ))}
            </div>

            <div className="pl-card">
              <div className="pl-card-head">
                <div>
                  <div className="pl-card-title">Relação com vendas/leads</div>
                  <div className="pl-card-sub">Leads de canal orgânico no período</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--pl-border)', fontSize: 13 }}>
                <span>Leads gerados</span><b>{resumo.relacaoVendas.leadsGerados}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--pl-border)', fontSize: 13 }}>
                <span>Leads convertidos em venda</span><b>{resumo.relacaoVendas.leadsGanhos}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
                <span>Valor negociado</span><b>{formatMoeda(resumo.relacaoVendas.valorNegociadoTotal)}</b>
              </div>
            </div>
          </div>

          <div className="pl-card" style={{ marginBottom: 16 }}>
            <div className="pl-card-head">
              <div>
                <div className="pl-card-title">Publicações em destaque</div>
                <div className="pl-card-sub">As 5 com melhor alcance + curtidas no período</div>
              </div>
            </div>
            {resumo.desempenho.topPublicacoes.length === 0 && <div className="pl-hint">Nenhuma publicação sincronizada ainda.</div>}
            {resumo.desempenho.topPublicacoes.map(p => (
              <a key={p.id} href={p.urlPermalink ?? '#'} target="_blank" rel="noreferrer" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: '1px dashed var(--pl-border)', fontSize: 13, color: 'inherit', textDecoration: 'none' }}>
                <span>{TIPO_MIDIA_LABEL[p.tipo] ?? p.tipo} · {formatarData(p.publicadoEm)}</span>
                <span style={{ color: 'var(--pl-ink-muted)' }}>{p.alcance.toLocaleString('pt-BR')} alcance · {p.curtidas} curtidas · {p.comentarios} comentários</span>
              </a>
            ))}
          </div>

          <div className="pl-card">
            <div className="pl-card-head">
              <div>
                <div className="pl-card-title">Jornada Seguidor → Lead</div>
                <div className="pl-card-sub">Do alcance dos posts até virar lead no CRM, no período selecionado</div>
              </div>
            </div>
            <SocialJourneyCircular
              alcance={resumo.jornada.alcance}
              visitasPerfil={resumo.jornada.visitasPerfil}
              novosSeguidores={resumo.jornada.novosSeguidores}
              leadsGerados={resumo.jornada.leadsGerados}
            />
          </div>
        </>
      )}
    </div>
  )
}
