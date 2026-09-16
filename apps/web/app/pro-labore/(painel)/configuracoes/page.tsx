'use client'

import { useEffect, useState } from 'react'
import { proLaboreApi, ParametroLiquidez } from '@/lib/proLaboreApi'
import { formatMoeda } from '@/lib/format'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'

export default function ProLaboreConfiguracoesPage() {
  const { usuario } = useProLaboreAuth()
  const isDono = usuario?.papel === 'DONO'
  const [teto, setTeto] = useState('')
  const [tetoComissao, setTetoComissao] = useState('')
  const [metaAnual, setMetaAnual] = useState('')
  const [metaMensalPadrao, setMetaMensalPadrao] = useState('')
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  // Limiares da Auditoria comercial da Agenda — antes eram fixos no código
  // (80%/50%); agora vivem aqui, parametrizáveis por operação.
  const [limiarBom, setLimiarBom] = useState('')
  const [limiarAtencao, setLimiarAtencao] = useState('')
  const [limiarEfetividade, setLimiarEfetividade] = useState('')
  const [limiarOscilacao, setLimiarOscilacao] = useState('')
  const [alertaAderencia, setAlertaAderencia] = useState('')
  const [alertaDias, setAlertaDias] = useState('')
  const [alertaQuedaEfetividade, setAlertaQuedaEfetividade] = useState('')
  const [reconhecimentoSemanas, setReconhecimentoSemanas] = useState('')
  const [salvandoAgenda, setSalvandoAgenda] = useState(false)
  const [erroAgenda, setErroAgenda] = useState('')
  const [sucessoAgenda, setSucessoAgenda] = useState(false)

  useEffect(() => {
    if (!isDono) { setLoading(false); return }
    proLaboreApi.parametros.get().then((p: ParametroLiquidez) => {
      setTeto(String(p.tetoProLaborePorVenda))
      setTetoComissao(String(p.tetoComissaoPadrao))
      setMetaAnual(String(p.metaFaturamentoAnual))
      setMetaMensalPadrao(String(p.metaMensalPadrao))
      setLimiarBom(String(p.agendaLimiarBomPct))
      setLimiarAtencao(String(p.agendaLimiarAtencaoPct))
      setLimiarEfetividade(String(p.agendaLimiarEfetividadeAltaPct))
      setLimiarOscilacao(String(p.agendaLimiarOscilacaoPct))
      setAlertaAderencia(String(p.agendaAlertaAderenciaPct))
      setAlertaDias(String(p.agendaAlertaDiasConsecutivos))
      setAlertaQuedaEfetividade(String(p.agendaAlertaQuedaEfetividadePct))
      setReconhecimentoSemanas(String(p.agendaReconhecimentoSemanas))
    }).finally(() => setLoading(false))
  }, [isDono])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSucesso(false)
    setSalvando(true)
    try {
      const atualizado = await proLaboreApi.parametros.atualizar({
        tetoProLaborePorVenda: Number(teto),
        tetoComissaoPadrao: Number(tetoComissao),
        metaFaturamentoAnual: Number(metaAnual),
        metaMensalPadrao: Number(metaMensalPadrao),
      })
      setTeto(String(atualizado.tetoProLaborePorVenda))
      setTetoComissao(String(atualizado.tetoComissaoPadrao))
      setMetaAnual(String(atualizado.metaFaturamentoAnual))
      setMetaMensalPadrao(String(atualizado.metaMensalPadrao))
      setSucesso(true)
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  async function handleSubmitAgenda(e: React.FormEvent) {
    e.preventDefault()
    setErroAgenda('')
    setSucessoAgenda(false)
    if (Number(limiarAtencao) >= Number(limiarBom)) {
      setErroAgenda('O limiar de "Atenção" precisa ser menor que o de "Em dia"')
      return
    }
    setSalvandoAgenda(true)
    try {
      const atualizado = await proLaboreApi.parametros.atualizar({
        agendaLimiarBomPct: Number(limiarBom),
        agendaLimiarAtencaoPct: Number(limiarAtencao),
        agendaLimiarEfetividadeAltaPct: Number(limiarEfetividade),
        agendaLimiarOscilacaoPct: Number(limiarOscilacao),
        agendaAlertaAderenciaPct: Number(alertaAderencia),
        agendaAlertaDiasConsecutivos: Number(alertaDias),
        agendaAlertaQuedaEfetividadePct: Number(alertaQuedaEfetividade),
        agendaReconhecimentoSemanas: Number(reconhecimentoSemanas),
      })
      setLimiarBom(String(atualizado.agendaLimiarBomPct))
      setLimiarAtencao(String(atualizado.agendaLimiarAtencaoPct))
      setLimiarEfetividade(String(atualizado.agendaLimiarEfetividadeAltaPct))
      setLimiarOscilacao(String(atualizado.agendaLimiarOscilacaoPct))
      setAlertaAderencia(String(atualizado.agendaAlertaAderenciaPct))
      setAlertaDias(String(atualizado.agendaAlertaDiasConsecutivos))
      setAlertaQuedaEfetividade(String(atualizado.agendaAlertaQuedaEfetividadePct))
      setReconhecimentoSemanas(String(atualizado.agendaReconhecimentoSemanas))
      setSucessoAgenda(true)
    } catch (err: unknown) {
      setErroAgenda(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSalvandoAgenda(false)
    }
  }

  if (loading) return <div style={{ color: 'var(--pl-ink-muted)', fontSize: 13 }}>Carregando...</div>

  if (!isDono) {
    return (
      <div className="pl-empty pl-card">
        <div className="pl-emoji">🔒</div>
        <h3 style={{ margin: 0, color: 'var(--pl-ink-1)', fontWeight: 600 }}>Área restrita ao dono da operação</h3>
        <p style={{ marginTop: 6 }}>Teto de pró-labore e meta anual são definidos pelo responsável pela conta.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="pl-section-head" style={{ marginTop: 0 }}>
        <div>
          <div className="pl-eyebrow">Preferências</div>
          <h2 className="pl-section-title">Configurações</h2>
          <div className="pl-section-note" style={{ marginTop: 4 }}>Teto de pró-labore, teto padrão de comissão e meta anual de faturamento</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="pl-card" style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="pl-field">
          <label>Teto de pró-labore por venda (R$)</label>
          <input type="number" step="0.01" min="0" className="pl-input" value={teto} onChange={e => setTeto(e.target.value)} required />
          <span className="pl-hint">Seu pró-labore pessoal — sacado de qualquer venda, nunca acima deste teto — hoje: {formatMoeda(Number(teto) || 0)}</span>
        </div>

        <div className="pl-field">
          <label>Teto de comissão padrão (R$)</label>
          <input type="number" step="0.01" min="0" className="pl-input" value={tetoComissao} onChange={e => setTetoComissao(e.target.value)} required />
          <span className="pl-hint">Usado só por vendedores sem comissão individual definida (em Vendedores) — hoje: {formatMoeda(Number(tetoComissao) || 0)}</span>
        </div>

        <div className="pl-field">
          <label>Meta de faturamento anual (R$)</label>
          <input type="number" step="0.01" min="0" className="pl-input" value={metaAnual} onChange={e => setMetaAnual(e.target.value)} required />
          <span className="pl-hint">Aparece no dashboard do dono e do supervisor como referência do progresso do ano — hoje: {formatMoeda(Number(metaAnual) || 0)}</span>
        </div>

        <div className="pl-field">
          <label>Meta mensal padrão por vendedor (R$)</label>
          <input type="number" step="0.01" min="0.01" className="pl-input" value={metaMensalPadrao} onChange={e => setMetaMensalPadrao(e.target.value)} required />
          <span className="pl-hint">Vendedor não vê a meta anual — no lugar, vê essa meta mensal (ou a individual dele, se definida em Vendedores) — hoje: {formatMoeda(Number(metaMensalPadrao) || 0)}</span>
        </div>

        {erro && <div className="pl-alert pl-alert-error">{erro}</div>}
        {sucesso && <div className="pl-alert pl-alert-success">Configurações atualizadas.</div>}

        <button type="submit" className="pl-btn pl-btn-primary" disabled={salvando} style={{ alignSelf: 'flex-start' }}>{salvando ? 'Salvando...' : 'Salvar'}</button>
      </form>

      <form onSubmit={handleSubmitAgenda} className="pl-card" style={{ maxWidth: 480, marginTop: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div className="pl-card-title">Auditoria comercial da Agenda</div>
          <div className="pl-card-sub">Limiares de classificação e regras de alerta — nada disso é fixo, calibre pela realidade da sua equipe</div>
        </div>

        <div className="pl-field">
          <label>Aderência “Em dia” a partir de (%)</label>
          <input type="number" step="1" min="0" max="100" className="pl-input" value={limiarBom} onChange={e => setLimiarBom(e.target.value)} required />
          <span className="pl-hint">Abaixo disso e acima do limiar de “Atenção”, o consultor aparece como “Atenção” na Agenda</span>
        </div>

        <div className="pl-field">
          <label>Aderência “Atenção” a partir de (%)</label>
          <input type="number" step="1" min="0" max="100" className="pl-input" value={limiarAtencao} onChange={e => setLimiarAtencao(e.target.value)} required />
          <span className="pl-hint">Abaixo disso o consultor aparece como “Crítico”</span>
        </div>

        <div className="pl-field">
          <label>Efetividade “alta” a partir de (%)</label>
          <input type="number" step="1" min="0" max="100" className="pl-input" value={limiarEfetividade} onChange={e => setLimiarEfetividade(e.target.value)} required />
          <span className="pl-hint">% de leads abordados que viram venda no período — usado na matriz de classificação (aderência × efetividade)</span>
        </div>

        <div className="pl-field">
          <label>Limiar de oscilação (coef. de variação, %)</label>
          <input type="number" step="1" min="0" max="200" className="pl-input" value={limiarOscilacao} onChange={e => setLimiarOscilacao(e.target.value)} required />
          <span className="pl-hint">Acima disso, a variação da aderência diária no período classifica o consultor como “Oscilante”</span>
        </div>

        <div className="pl-field">
          <label>Alerta: aderência abaixo de (%)</label>
          <input type="number" step="1" min="0" max="100" className="pl-input" value={alertaAderencia} onChange={e => setAlertaAderencia(e.target.value)} required />
          <span className="pl-hint">Combinado com o campo abaixo — dispara o card “Em alerta”</span>
        </div>

        <div className="pl-field">
          <label>...por quantos dias seguidos</label>
          <input type="number" step="1" min="1" className="pl-input" value={alertaDias} onChange={e => setAlertaDias(e.target.value)} required />
        </div>

        <div className="pl-field">
          <label>Alerta: queda de efetividade acima de (%)</label>
          <input type="number" step="1" min="0" max="100" className="pl-input" value={alertaQuedaEfetividade} onChange={e => setAlertaQuedaEfetividade(e.target.value)} required />
          <span className="pl-hint">Em relação à própria média móvel do consultor no período — não é um limiar absoluto</span>
        </div>

        <div className="pl-field">
          <label>Reconhecimento: semanas seguidas como “Referência”</label>
          <input type="number" step="1" min="1" className="pl-input" value={reconhecimentoSemanas} onChange={e => setReconhecimentoSemanas(e.target.value)} required />
          <span className="pl-hint">Gatilho de destaque positivo — a Agenda só sinalizava problema, isso sinaliza quando alguém merece reconhecimento</span>
        </div>

        {erroAgenda && <div className="pl-alert pl-alert-error">{erroAgenda}</div>}
        {sucessoAgenda && <div className="pl-alert pl-alert-success">Regras da Agenda atualizadas.</div>}

        <button type="submit" className="pl-btn pl-btn-primary" disabled={salvandoAgenda} style={{ alignSelf: 'flex-start' }}>{salvandoAgenda ? 'Salvando...' : 'Salvar'}</button>
      </form>
    </div>
  )
}
