'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { proLaboreApi, SocialMediaConta, AnaliseSocialMedia, ResultadoSyncSocialMedia } from '@/lib/proLaboreApi'
import { formatMoeda } from '@/lib/format'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { iniciarLoginInstagram, instagramAppIdConfigurado } from '@/lib/socialMediaOAuth'
import { SocialJourneyCircular } from './SocialJourneyCircular'
import { PageHeader } from '../../PageHeader'
import { FiltroPeriodo, Periodo, periodoDoPreset } from './_componentes/FiltroPeriodo'
import { KpisSocial } from './_componentes/KpisSocial'
import { EvolucaoDiaria } from './_componentes/EvolucaoDiaria'
import { ComposicaoInteracoes } from './_componentes/ComposicaoInteracoes'
import { RadarImpacto } from './_componentes/RadarImpacto'
import { LequeDiasSemana } from './_componentes/LequeDiasSemana'
import { MapaCalorHorarios, SeguidoresOnline } from './_componentes/Horarios'
import { CrescimentoSeguidores } from './_componentes/CrescimentoSeguidores'
import { FormatosComparativo, OrigemAlcance } from './_componentes/Formatos'
import { CalendarioPublicacoes, TabelaPublicacoes, TopPublicacoes } from './_componentes/Publicacoes'
import { Audiencia } from './_componentes/Audiencia'
import { HashtagsELegendas, Recomendacoes, ReelsEStories } from './_componentes/Conteudo'
import { fmtNum } from './_componentes/viz'

type Analise = Extract<AnaliseSocialMedia, { conectado: true }>

function tempoDesde(iso: string | null | undefined): string {
  if (!iso) return 'nunca'
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'agora há pouco'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h}h`
  return `em ${new Date(iso).toLocaleDateString('pt-BR')}`
}

function Secao({ id, eyebrow, titulo, nota, children }: { id: string; eyebrow: string; titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="pl-sv-section">
      <div className="pl-sv-section-head">
        <div>
          <div className="pl-eyebrow">{eyebrow}</div>
          <h2 className="pl-section-title">{titulo}</h2>
        </div>
        {nota && <div className="pl-section-note">{nota}</div>}
      </div>
      <div className="pl-sv-grid">{children}</div>
    </section>
  )
}

export default function ProLaboreSocialMediaPage() {
  const { usuario } = useProLaboreAuth()
  const isDono = usuario?.papel === 'DONO'

  const [carregando, setCarregando] = useState(true)
  const [conta, setConta] = useState<SocialMediaConta | null>(null)
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoDoPreset('30d'))
  // A análise guarda a "chave" (período + última sync) com que foi
  // carregada: enquanto a chave pedida for outra, a tela mostra a análise
  // anterior esmaecida (sem piscar/pular layout) até a nova chegar.
  const [carregada, setCarregada] = useState<{ chave: string; analise: Analise } | null>(null)
  const [erroAnalise, setErroAnalise] = useState('')

  const [tokenInput, setTokenInput] = useState('')
  const [conectando, setConectando] = useState(false)
  const [erroConexao, setErroConexao] = useState('')
  // Login OAuth de verdade (botão "Conectar com Instagram") só aparece
  // quando o app da Meta está configurado (NEXT_PUBLIC_INSTAGRAM_APP_ID); o
  // caminho manual (colar token gerado no painel da Meta) fica sempre
  // disponível como alternativa — atrás de um "mostrar opção avançada"
  // quando o OAuth já está configurado, e aberto direto quando não está.
  const oauthConfigurado = instagramAppIdConfigurado() != null
  const [mostrarManual, setMostrarManual] = useState(!oauthConfigurado)

  const [sincronizando, setSincronizando] = useState(false)
  const [erroSync, setErroSync] = useState('')
  const [resultadoSync, setResultadoSync] = useState<ResultadoSyncSocialMedia | null>(null)
  const primeiraSyncDisparada = useRef(false)


  const sincronizar = useCallback(async () => {
    setErroSync('')
    setSincronizando(true)
    try {
      const r = await proLaboreApi.socialMedia.sincronizar()
      setConta(r.conta)
      setResultadoSync(r.resultado)
    } catch (err) {
      setErroSync(err instanceof Error ? err.message : 'Erro ao sincronizar')
      const c = await proLaboreApi.socialMedia.conta().catch(() => null)
      if (c) setConta(c)
    } finally {
      setSincronizando(false)
    }
  }, [])

  useEffect(() => {
    if (!isDono) return
    proLaboreApi.socialMedia.conta()
      .then(c => setConta(c))
      .finally(() => setCarregando(false))
  }, [isDono])

  // Conta recém-conectada (nunca sincronizada): dispara a primeira
  // sincronização sozinha, em vez de mostrar tudo zerado esperando o dono
  // descobrir o botão.
  useEffect(() => {
    if (conta && !conta.ultimaSincronizacaoEm && !primeiraSyncDisparada.current) {
      primeiraSyncDisparada.current = true
      void sincronizar()
    }
  }, [conta, sincronizar])

  const contaId = conta?.id
  const chaveAnalise = `${contaId}|${periodo.inicio}|${periodo.fim}|${conta?.ultimaSincronizacaoEm ?? ''}`
  useEffect(() => {
    if (!contaId) return
    let cancelado = false
    proLaboreApi.socialMedia.resumo({ inicio: periodo.inicio, fim: periodo.fim })
      .then(r => { if (!cancelado && r.conectado) { setCarregada({ chave: chaveAnalise, analise: r }); setErroAnalise('') } })
      .catch(err => { if (!cancelado) setErroAnalise(err instanceof Error ? err.message : 'Erro ao carregar a análise') })
    return () => { cancelado = true }
  }, [contaId, chaveAnalise, periodo.inicio, periodo.fim])
  const analise = carregada?.analise ?? null
  const recarregando = !!carregada && carregada.chave !== chaveAnalise

  async function conectar(e: React.FormEvent) {
    e.preventDefault()
    setErroConexao('')
    setConectando(true)
    try {
      const c = await proLaboreApi.socialMedia.conectar(tokenInput.trim())
      setTokenInput('')
      setConta(c)
    } catch (err) {
      setErroConexao(err instanceof Error ? err.message : 'Erro ao conectar com o Instagram')
    } finally {
      setConectando(false)
    }
  }

  async function desconectar() {
    if (!confirm('Desconectar a conta do Instagram? Todo o histórico de publicações e métricas sincronizadas será apagado.')) return
    await proLaboreApi.socialMedia.desconectar()
    setConta(null)
    setCarregada(null)
    primeiraSyncDisparada.current = false
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
      <PageHeader
        eyebrow="Equipe"
        title="Social Media"
        subtitle="Desempenho, conteúdo, audiência e crescimento do Instagram — puxados direto da conta, sem lançamento manual"
        actions={conta && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="pl-btn pl-btn-ghost" onClick={desconectar}>Desconectar</button>
            <button type="button" className="pl-btn pl-btn-primary" onClick={() => void sincronizar()} disabled={sincronizando}>
              {sincronizando ? 'Sincronizando…' : 'Sincronizar agora'}
            </button>
          </div>
        )}
      />

      {carregando && <div className="pl-hint">Carregando…</div>}

      {!carregando && !conta && (
        <div className="pl-card" style={{ maxWidth: 580 }}>
          <div className="pl-card-head">
            <div>
              <div className="pl-card-title">Conectar conta do Instagram</div>
              <div className="pl-card-sub">Precisa ser uma conta profissional (comercial ou criador de conteúdo). O login é feito direto no Instagram — sem passar pelo Facebook.</div>
            </div>
          </div>

          {oauthConfigurado && (
            <button type="button" className="pl-btn pl-btn-primary" style={{ width: '100%', marginBottom: 14 }} onClick={iniciarLoginInstagram}>
              Conectar com Instagram
            </button>
          )}

          {!oauthConfigurado && (
            <div style={{ fontSize: 12.5, color: 'var(--pl-ink-muted)', marginBottom: 14 }}>
              O login com um clique ainda não está disponível nesse ambiente (falta configurar o app da Meta) — use o caminho manual abaixo por enquanto.
            </div>
          )}

          {oauthConfigurado && !mostrarManual && (
            <button type="button" className="pl-link-action" style={{ fontSize: 12.5 }} onClick={() => setMostrarManual(true)}>
              Prefiro colar um token manualmente
            </button>
          )}

          {mostrarManual && (
            <>
              {oauthConfigurado && <div className="pl-card-sub" style={{ margin: '4px 0 10px' }}>Caminho manual (avançado)</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '0 0 14px' }}>
                {[
                  <>No <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer">painel de apps da Meta</a>, abra o app e vá em Casos de uso → Personalizar → <b>Configuração da API com login do Instagram</b>.</>,
                  <>Em &quot;Gerar tokens de acesso&quot;, clique em &quot;Adicionar conta&quot;, entre com a conta do Instagram e copie o token gerado.</>,
                  <>Cole o token abaixo — a gente troca ele automaticamente por um de longa duração (~60 dias, renovado sozinho).</>,
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
                  placeholder="Cole aqui o token gerado no painel da Meta"
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  required
                />
                {erroConexao && <div style={{ color: 'var(--pl-critical)', fontSize: 12.5, marginTop: 8 }}>{erroConexao}</div>}
                <button type="submit" className="pl-btn pl-btn-primary" style={{ marginTop: 10 }} disabled={conectando}>
                  {conectando ? 'Conectando…' : 'Conectar'}
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {!carregando && conta && (
        <>
          <div className="pl-card pl-sv-perfil" style={{ marginBottom: 16 }}>
            {conta.fotoUrl
              ? <img className="pl-sv-avatar" src={conta.fotoUrl} alt="" referrerPolicy="no-referrer" />
              : <div className="pl-sv-avatar" />}
            <div style={{ minWidth: 0 }}>
              <div className="pl-sv-perfil-nome">
                @{conta.nomeUsuario}
                {conta.tipoConta && <span className="pl-sv-badge">{conta.tipoConta === 'MEDIA_CREATOR' ? 'Criador' : 'Comercial'}</span>}
              </div>
              {conta.nomeExibicao && <div style={{ fontSize: 13, color: 'var(--pl-ink-1)', fontWeight: 600, marginTop: 2 }}>{conta.nomeExibicao}</div>}
              {conta.biografia && <div className="pl-sv-bio">{conta.biografia}</div>}
              {conta.site && <a href={conta.site} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: 'var(--sv-1)', fontWeight: 600 }}>{conta.site.replace(/^https?:\/\//, '')}</a>}
              <div className="pl-sv-sync">
                {sincronizando ? 'Sincronizando com o Instagram…' : `Última sincronização ${tempoDesde(conta.ultimaSincronizacaoEm)}`}
              </div>
            </div>
            <div className="pl-sv-perfil-stats">
              <div className="pl-sv-perfil-stat"><b>{fmtNum(conta.seguidores)}</b><span>Seguidores</span></div>
              <div className="pl-sv-perfil-stat"><b>{fmtNum(conta.seguindo)}</b><span>Seguindo</span></div>
              <div className="pl-sv-perfil-stat"><b>{fmtNum(conta.publicacoesTotal)}</b><span>Publicações</span></div>
            </div>
          </div>

          {(erroSync || conta.ultimoErroSync) && !sincronizando && (
            <div className="pl-sv-aviso erro" role="alert">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 2 21h20L12 3Zm0 6v5m0 3v.5" /></svg>
              <div><b>A última sincronização falhou.</b> {erroSync || conta.ultimoErroSync} Os números abaixo são da última sincronização bem-sucedida.</div>
            </div>
          )}
          {sincronizando && !conta.ultimaSincronizacaoEm && (
            <div className="pl-sv-aviso info" role="status">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              <div>Fazendo a primeira sincronização: posts, reels, stories, métricas dos últimos 30 dias e audiência. Pode levar até 30 segundos.</div>
            </div>
          )}
          {resultadoSync && resultadoSync.insightsPendentes > 0 && !sincronizando && (
            <div className="pl-sv-aviso info" role="status">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-9v.5" /></svg>
              <div>{resultadoSync.insightsPendentes} publicações ainda estão sem métricas (a sincronização tem um tempo máximo por rodada). Clique em &quot;Sincronizar agora&quot; de novo pra completar.</div>
            </div>
          )}
          {erroAnalise && <div className="pl-sv-aviso erro" role="alert"><div>{erroAnalise}</div></div>}

          {analise && (
            <>
              <FiltroPeriodo
                periodo={periodo}
                onChange={setPeriodo}
                comparacao={{ inicio: analise.periodo.anteriorInicio, fim: analise.periodo.anteriorFim }}
              />

              <Secao id="sv-visao" eyebrow="Visão geral" titulo="Como a conta está indo" nota="Variações sempre comparadas com o período anterior de mesma duração">
                <KpisSocial analise={analise} />
                <div>
                  <div className="pl-card-sub" style={{ margin: '6px 0 10px', fontWeight: 600, color: 'var(--pl-ink-2)' }}>O que os dados dizem · próximos passos</div>
                  <Recomendacoes itens={analise.recomendacoes} />
                </div>
                <div className="pl-sv-grid pl-sv-grid-2">
                  <EvolucaoDiaria serie={analise.serie} serieAnterior={analise.serieAnterior} recarregando={recarregando} />
                  <ComposicaoInteracoes composicao={analise.composicaoInteracoes} recarregando={recarregando} />
                </div>
              </Secao>

              <Secao id="sv-conteudo" eyebrow="Conteúdo" titulo="O que funciona e o que não funciona">
                <RadarImpacto
                  posts={analise.publicacoes}
                  medianaReferencia={analise.radar.medianaReferencia}
                  diasReferencia={analise.radar.diasReferencia}
                  periodo={analise.periodo}
                  recarregando={recarregando}
                />
                <div className="pl-sv-grid pl-sv-grid-2">
                  <FormatosComparativo porFormato={analise.porFormato} recarregando={recarregando} />
                  <OrigemAlcance distribuicao={analise.distribuicaoAlcance} recarregando={recarregando} />
                </div>
                <TopPublicacoes posts={analise.publicacoes} recarregando={recarregando} />
                <HashtagsELegendas analise={analise} recarregando={recarregando} />
                <ReelsEStories analise={analise} recarregando={recarregando} />
              </Secao>

              <Secao id="sv-horarios" eyebrow="Quando postar" titulo="Dias e horários de melhor resposta" nota="Horários em Brasília">
                <div className="pl-sv-grid pl-sv-grid-2-eq">
                  <LequeDiasSemana porDiaSemana={analise.porDiaSemana} recarregando={recarregando} />
                  <MapaCalorHorarios heatmap={analise.heatmap} recarregando={recarregando} />
                </div>
                <div className="pl-sv-grid pl-sv-grid-2-eq">
                  <SeguidoresOnline valores={analise.seguidoresOnline} recarregando={recarregando} />
                  <CalendarioPublicacoes posts={analise.publicacoes} periodo={analise.periodo} recarregando={recarregando} />
                </div>
              </Secao>

              <Secao id="sv-crescimento" eyebrow="Crescimento" titulo="Entradas, saídas e evolução da base">
                <CrescimentoSeguidores serie={analise.serie} kpis={analise.kpis} recarregando={recarregando} />
              </Secao>

              <Secao id="sv-audiencia" eyebrow="Audiência" titulo="Quem acompanha o perfil">
                <Audiencia demografia={analise.demografia} recarregando={recarregando} />
              </Secao>

              <Secao id="sv-comercial" eyebrow="Resultado comercial" titulo="Do Instagram até a venda" nota="Leads com canal Orgânico no CRM, criados no período">
                <div className="pl-sv-grid pl-sv-grid-2">
                  <div className="pl-card">
                    <div className="pl-card-head">
                      <div>
                        <div className="pl-card-title">Jornada Seguidor → Lead</div>
                        <div className="pl-card-sub">Do alcance do conteúdo até virar lead no CRM, no período selecionado</div>
                      </div>
                    </div>
                    <SocialJourneyCircular
                      alcance={analise.jornada.alcance}
                      visitasPerfil={analise.jornada.visitasPerfil}
                      novosSeguidores={analise.jornada.novosSeguidores}
                      leadsGerados={analise.jornada.leadsGerados}
                    />
                  </div>
                  <div className="pl-card">
                    <div className="pl-card-head">
                      <div>
                        <div className="pl-card-title">Relação com vendas</div>
                        <div className="pl-card-sub">Leads de canal orgânico criados no período</div>
                      </div>
                    </div>
                    <div className="pl-sv-mini-stats">
                      <div className="pl-sv-mini-stat"><span>Leads gerados</span><b>{fmtNum(analise.relacaoVendas.leadsGerados)}</b></div>
                      <div className="pl-sv-mini-stat"><span>Viraram venda</span><b>{fmtNum(analise.relacaoVendas.leadsGanhos)}</b><small>{analise.relacaoVendas.leadsGerados > 0 ? `${((analise.relacaoVendas.leadsGanhos / analise.relacaoVendas.leadsGerados) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% de conversão` : '—'}</small></div>
                      <div className="pl-sv-mini-stat"><span>Valor negociado</span><b style={{ fontSize: 15 }}>{formatMoeda(analise.relacaoVendas.valorNegociadoTotal)}</b></div>
                      <div className="pl-sv-mini-stat"><span>Lead por visita</span><b>{analise.jornada.visitasPerfil > 0 ? `${((analise.relacaoVendas.leadsGerados / analise.jornada.visitasPerfil) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—'}</b><small>leads ÷ visitas ao perfil</small></div>
                    </div>
                  </div>
                </div>
              </Secao>

              <Secao id="sv-publicacoes" eyebrow="Detalhe" titulo="Todas as publicações">
                <TabelaPublicacoes posts={analise.publicacoes} periodo={analise.periodo} recarregando={recarregando} />
              </Secao>
            </>
          )}
          {!analise && !erroAnalise && <div className="pl-hint">Carregando análise…</div>}
        </>
      )}
    </div>
  )
}
