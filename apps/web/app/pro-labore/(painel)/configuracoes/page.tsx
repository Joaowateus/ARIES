'use client'

import { useModoGuiado } from '../leads/_topo/modoGuiado'
import { useEffect, useState, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Interruptor } from '../_ui/ui'
import { temAcesso, proLaboreApi, ParametroLiquidez } from '@/lib/proLaboreApi'
import { formatMoeda } from '@/lib/format'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { AgenteWhatsapp } from './_agente/AgenteWhatsapp'
import { ImportacaoNeon } from './_importacao/ImportacaoNeon'
import { EspacoBanco } from './_espaco/EspacoBanco'
import { AuditoriaDados } from './_auditoria/AuditoriaDados'
import { CopiaSeguranca } from './_copia/CopiaSeguranca'
import { MigracaoJornada } from './_jornada/MigracaoJornada'
import { RodizioLeads } from './_jornada/RodizioLeads'
import { PremissasJornada } from './_jornada/PremissasJornada'
import { ReguaCobranca } from './_jornada/ReguaCobranca'
import { DicionarioMetricas } from './_jornada/DicionarioMetricas'
import { Detectores } from './_jornada/Detectores'
import { AceitePdf03 } from './_jornada/AceitePdf03'
import { TelasNovas } from './_jornada/TelasNovas'
import { AreasOnda4 } from './_jornada/AreasOnda4'
import { AceiteAjuste1Card } from './_jornada/Ajuste1'
import { BibliotecaFrases, ConfigExpediente } from './_jornada/HojeConfig'
import { MatrizAcoes } from './_jornada/MatrizAcoes'
import { AceitePdf02 } from './_jornada/AceitePdf02'

export default function ProLaboreConfiguracoesPage() {
  const { usuario } = useProLaboreAuth()
  // Dono ou acesso com o módulo liberado (Acessos e permissões).
  const isDono = temAcesso(usuario, 'configuracoes')
  const [teto, setTeto] = useState('')
  const [tetoComissao, setTetoComissao] = useState('')
  const [tetoProLaboreR, setTetoProLaboreR] = useState('')
  const [tetoComissaoR, setTetoComissaoR] = useState('')
  const [metaAnual, setMetaAnual] = useState('')
  const [metaMensalPadrao, setMetaMensalPadrao] = useState('')
  const [diasLeadParado, setDiasLeadParado] = useState('5')
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

  // Limiares do Plano de Crescimento — mesma lógica dos limiares da
  // Agenda acima: eram fixos no motor de regras, agora vivem aqui.
  const [roasMinimo, setRoasMinimo] = useState('')
  const [roasSaudavel, setRoasSaudavel] = useState('')
  const [conversaoMinima, setConversaoMinima] = useState('')
  const [conversaoConsolidada, setConversaoConsolidada] = useState('')
  const [engajamentoMinimo, setEngajamentoMinimo] = useState('')
  const [leadsOrganicosMinimo, setLeadsOrganicosMinimo] = useState('')
  const [concentracaoMaxima, setConcentracaoMaxima] = useState('')
  const [salvandoPlano, setSalvandoPlano] = useState(false)
  const [erroPlano, setErroPlano] = useState('')
  const [sucessoPlano, setSucessoPlano] = useState(false)

  useEffect(() => {
    if (!isDono) { setLoading(false); return }
    proLaboreApi.parametros.get().then((p: ParametroLiquidez) => {
      setTeto(String(p.tetoProLaborePorVenda))
      setTetoComissao(String(p.tetoComissaoPadrao))
      setTetoProLaboreR(String(p.tetoProLaboreRenegociacao))
      setTetoComissaoR(String(p.tetoComissaoRenegociacao))
      setMetaAnual(String(p.metaFaturamentoAnual))
      setMetaMensalPadrao(String(p.metaMensalPadrao))
      setDiasLeadParado(String(p.diasLeadParado ?? 5))
      setLimiarBom(String(p.agendaLimiarBomPct))
      setLimiarAtencao(String(p.agendaLimiarAtencaoPct))
      setLimiarEfetividade(String(p.agendaLimiarEfetividadeAltaPct))
      setLimiarOscilacao(String(p.agendaLimiarOscilacaoPct))
      setAlertaAderencia(String(p.agendaAlertaAderenciaPct))
      setAlertaDias(String(p.agendaAlertaDiasConsecutivos))
      setAlertaQuedaEfetividade(String(p.agendaAlertaQuedaEfetividadePct))
      setReconhecimentoSemanas(String(p.agendaReconhecimentoSemanas))
      setRoasMinimo(String(p.planoRoasMinimo))
      setRoasSaudavel(String(p.planoRoasSaudavel))
      setConversaoMinima(String(p.planoConversaoMinimaPct))
      setConversaoConsolidada(String(p.planoConversaoConsolidadaPct))
      setEngajamentoMinimo(String(p.planoEngajamentoMinimoPct))
      setLeadsOrganicosMinimo(String(p.planoLeadsOrganicosMinimo))
      setConcentracaoMaxima(String(p.planoConcentracaoMaximaLiderPct))
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
        tetoProLaboreRenegociacao: Number(tetoProLaboreR),
        tetoComissaoRenegociacao: Number(tetoComissaoR),
        metaFaturamentoAnual: Number(metaAnual),
        metaMensalPadrao: Number(metaMensalPadrao),
        diasLeadParado: Number(diasLeadParado),
      })
      setTeto(String(atualizado.tetoProLaborePorVenda))
      setTetoComissao(String(atualizado.tetoComissaoPadrao))
      setTetoProLaboreR(String(atualizado.tetoProLaboreRenegociacao))
      setTetoComissaoR(String(atualizado.tetoComissaoRenegociacao))
      setMetaAnual(String(atualizado.metaFaturamentoAnual))
      setMetaMensalPadrao(String(atualizado.metaMensalPadrao))
      setDiasLeadParado(String(atualizado.diasLeadParado ?? 5))
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

  async function handleSubmitPlano(e: React.FormEvent) {
    e.preventDefault()
    setErroPlano('')
    setSucessoPlano(false)
    setSalvandoPlano(true)
    try {
      const atualizado = await proLaboreApi.parametros.atualizar({
        planoRoasMinimo: Number(roasMinimo),
        planoRoasSaudavel: Number(roasSaudavel),
        planoConversaoMinimaPct: Number(conversaoMinima),
        planoConversaoConsolidadaPct: Number(conversaoConsolidada),
        planoEngajamentoMinimoPct: Number(engajamentoMinimo),
        planoLeadsOrganicosMinimo: Number(leadsOrganicosMinimo),
        planoConcentracaoMaximaLiderPct: Number(concentracaoMaxima),
      })
      setRoasMinimo(String(atualizado.planoRoasMinimo))
      setRoasSaudavel(String(atualizado.planoRoasSaudavel))
      setConversaoMinima(String(atualizado.planoConversaoMinimaPct))
      setConversaoConsolidada(String(atualizado.planoConversaoConsolidadaPct))
      setEngajamentoMinimo(String(atualizado.planoEngajamentoMinimoPct))
      setLeadsOrganicosMinimo(String(atualizado.planoLeadsOrganicosMinimo))
      setConcentracaoMaxima(String(atualizado.planoConcentracaoMaximaLiderPct))
      setSucessoPlano(true)
    } catch (err: unknown) {
      setErroPlano(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSalvandoPlano(false)
    }
  }

  if (loading) return <div style={{ color: 'var(--pl-ink-muted)', fontSize: 13 }}>Carregando...</div>

  if (!isDono) {
    return (
      <>
      <SeuJeito />
      <div className="pl-empty pl-card">
        <div className="pl-emoji">🔒</div>
        <h3 style={{ margin: 0, color: 'var(--pl-ink-1)', fontWeight: 600 }}>Seu acesso não inclui essa área</h3>
        <p style={{ marginTop: 6 }}>Teto de pró-labore e meta anual são definidos pelo responsável pela conta.</p>
      </div>
      </>
    )
  }

  const dono = usuario?.papel === 'DONO'
  const formTetos = (
      <form onSubmit={handleSubmit} className="pl-card" style={{ marginBottom: 20 }}>
        <div className="pl-card-head">
          <div>
            <div className="pl-card-title">Tetos e metas</div>
            <div className="pl-card-sub">Limites de pró-labore, comissão e metas de faturamento da operação</div>
          </div>
        </div>
        <div className="pl-field-grid">
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
            <label>Teto de pró-labore em negociação “R” (R$)</label>
            <input type="number" step="0.01" min="0" className="pl-input" value={tetoProLaboreR} onChange={e => setTetoProLaboreR(e.target.value)} required />
            <span className="pl-hint">Usado no lugar do teto normal quando o lead está classificado como “R” (renegociação), no CRM — hoje: {formatMoeda(Number(tetoProLaboreR) || 0)}</span>
          </div>

          <div className="pl-field">
            <label>Teto de comissão em negociação “R” (R$)</label>
            <input type="number" step="0.01" min="0" className="pl-input" value={tetoComissaoR} onChange={e => setTetoComissaoR(e.target.value)} required />
            <span className="pl-hint">Vale sempre pra negociação “R”, mesmo que o vendedor tenha um teto individual definido — hoje: {formatMoeda(Number(tetoComissaoR) || 0)}</span>
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

          <div className="pl-field">
            <label>Lead parado em Negociação/Proposta após (dias)</label>
            <input type="number" step="1" min="1" max="90" className="pl-input" value={diasLeadParado} onChange={e => setDiasLeadParado(e.target.value)} required data-campo-dias-parado />
            <span className="pl-hint">Sem mudar de etapa e sem follow agendado por mais que isso, o lead aparece como parado no CRM</span>
          </div>
        </div>

        {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 18 }}>{erro}</div>}
        {sucesso && <div className="pl-alert pl-alert-success" style={{ marginTop: 18 }}>Configurações atualizadas.</div>}

        <button type="submit" className="pl-btn pl-btn-primary" disabled={salvando} style={{ marginTop: 18 }}>{salvando ? 'Salvando...' : 'Salvar'}</button>
      </form>
  )
  const formAgenda = (
      <form onSubmit={handleSubmitAgenda} className="pl-card">
        <div className="pl-card-head">
          <div>
            <div className="pl-card-title">Auditoria comercial da Agenda</div>
            <div className="pl-card-sub">Limiares de classificação e regras de alerta — nada disso é fixo, calibre pela realidade da sua equipe</div>
          </div>
        </div>

        <div className="pl-field-grid">
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
        </div>

        {erroAgenda && <div className="pl-alert pl-alert-error" style={{ marginTop: 18 }}>{erroAgenda}</div>}
        {sucessoAgenda && <div className="pl-alert pl-alert-success" style={{ marginTop: 18 }}>Regras da Agenda atualizadas.</div>}

        <button type="submit" className="pl-btn pl-btn-primary" disabled={salvandoAgenda} style={{ marginTop: 18 }}>{salvandoAgenda ? 'Salvando...' : 'Salvar'}</button>
      </form>
  )
  const formPlano = (
      <form onSubmit={handleSubmitPlano} className="pl-card">
        <div className="pl-card-head">
          <div>
            <div className="pl-card-title">Metas do Plano de Crescimento</div>
            <div className="pl-card-sub">Limiares que classificam cada pilar em Iniciar/Manter/Escalonar/Escalar — calibre pela realidade do seu negócio, não são regra fixa</div>
          </div>
        </div>

        <div className="pl-field-grid">
          <div className="pl-field">
            <label>ROAS mínimo (anúncio se pagando)</label>
            <input type="number" step="0.1" min="0" className="pl-input" value={roasMinimo} onChange={e => setRoasMinimo(e.target.value)} required />
            <span className="pl-hint">Abaixo disso, o pilar Financeiro fica em “Iniciar”</span>
          </div>

          <div className="pl-field">
            <label>ROAS saudável</label>
            <input type="number" step="0.1" min="0" className="pl-input" value={roasSaudavel} onChange={e => setRoasSaudavel(e.target.value)} required />
            <span className="pl-hint">A partir daqui o pilar Financeiro avança pra “Escalonar”/“Escalar”</span>
          </div>

          <div className="pl-field">
            <label>Conversão lead → venda mínima (%)</label>
            <input type="number" step="1" min="0" max="100" className="pl-input" value={conversaoMinima} onChange={e => setConversaoMinima(e.target.value)} required />
            <span className="pl-hint">Abaixo disso, o pilar Conversão fica em “Iniciar”</span>
          </div>

          <div className="pl-field">
            <label>Conversão lead → venda consolidada (%)</label>
            <input type="number" step="1" min="0" max="100" className="pl-input" value={conversaoConsolidada} onChange={e => setConversaoConsolidada(e.target.value)} required />
            <span className="pl-hint">A partir daqui o funil é considerado maduro o bastante pra escalar</span>
          </div>

          <div className="pl-field">
            <label>Engajamento mínimo nas redes (%)</label>
            <input type="number" step="0.1" min="0" max="100" className="pl-input" value={engajamentoMinimo} onChange={e => setEngajamentoMinimo(e.target.value)} required />
            <span className="pl-hint">% do alcance que precisa virar curtida/comentário/salvamento pra considerar o engajamento saudável</span>
          </div>

          <div className="pl-field">
            <label>Leads orgânicos mínimos no período</label>
            <input type="number" step="1" min="0" className="pl-input" value={leadsOrganicosMinimo} onChange={e => setLeadsOrganicosMinimo(e.target.value)} required />
            <span className="pl-hint">Quantidade de leads vindos de rede social (últimos 30 dias) pra considerar a aquisição orgânica provada</span>
          </div>

          <div className="pl-field">
            <label>Concentração máxima no vendedor líder (%)</label>
            <input type="number" step="1" min="0" max="100" className="pl-input" value={concentracaoMaxima} onChange={e => setConcentracaoMaxima(e.target.value)} required />
            <span className="pl-hint">Acima disso, o resultado da equipe é considerado concentrado demais numa única pessoa</span>
          </div>
        </div>

        {erroPlano && <div className="pl-alert pl-alert-error" style={{ marginTop: 18 }}>{erroPlano}</div>}
        {sucessoPlano && <div className="pl-alert pl-alert-success" style={{ marginTop: 18 }}>Metas do Plano de Crescimento atualizadas.</div>}

        <button type="submit" className="pl-btn pl-btn-primary" disabled={salvandoPlano} style={{ marginTop: 18 }}>{salvandoPlano ? 'Salvando...' : 'Salvar'}</button>
      </form>
  )

  // Redesign 26/11: as ~25 seções em grupos, com um índice; uma página de cada vez (antes, uma rolagem
  // de 18 mil px). Os mesmos formulários, componentes e regras de antes.
  const grupos: GrupoConfig[] = [
    { id: 'voce', rotulo: 'Seu jeito', descricao: 'Preferências que valem só para você.', corpo: <SeuJeito /> },
    { id: 'metas', rotulo: 'Metas e limites', descricao: 'Tetos de pró-labore e comissão, metas de faturamento e as premissas da jornada.', corpo: <>{formTetos}<PremissasJornada podeEditar={dono} />{formPlano}</> },
    { id: 'rotina', rotulo: 'Rotina da equipe', descricao: 'Expediente, rodízio de leads, régua de cobrança e a auditoria da Agenda.', corpo: <>{dono && <ConfigExpediente />}<RodizioLeads /><ReguaCobranca podeEditar={dono} />{formAgenda}{dono && <BibliotecaFrases />}</> },
    { id: 'aries', rotulo: 'Métricas e ARIES', descricao: 'Como o ARIES mede, detecta e recomenda.', corpo: <><DicionarioMetricas podeEditar={dono} /><Detectores podeEditar={dono} />{dono && <AreasOnda4 />}<MatrizAcoes /></> },
    { id: 'whatsapp', rotulo: 'WhatsApp', descricao: 'O ARIES no WhatsApp da loja.', corpo: <AgenteWhatsapp /> },
    { id: 'dados', rotulo: 'Dados e segurança', descricao: 'Cópias de segurança, espaço do banco, auditoria e migrações.', corpo: <><CopiaSeguranca /><EspacoBanco /><AuditoriaDados /><MigracaoJornada /><ImportacaoNeon /></> },
    ...(dono ? [{ id: 'telas', rotulo: 'Telas e aceites', descricao: 'Versão das telas e os aceites das entregas.', corpo: <><TelasNovas /><AceiteAjuste1Card /><AceitePdf03 /><AceitePdf02 /></> }] : []),
  ]
  return <IndiceConfig grupos={grupos} />
}

type GrupoConfig = { id: string; rotulo: string; descricao: string; corpo: ReactNode }
const GRUPO_DA_ANCORA: Record<string, string> = { auditoria: 'dados', copia: 'dados', espaco: 'dados', detectores: 'aries', 'areas-onda4': 'aries', dicionario: 'aries', expediente: 'rotina', 'aceite-pdf02': 'telas', 'aceite-pdf03': 'telas', 'aceite-ajuste1': 'telas' }

/** Índice à esquerda (no celular, no topo) e o grupo escolhido; o grupo fica no endereço (?secao=). */
function IndiceConfig({ grupos }: { grupos: GrupoConfig[] }) {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  // Links antigos com âncora (ex.: /configuracoes#auditoria) abrem o grupo da seção e rolam até ela.
  const [ancora, setAncora] = useState<string | null>(null)
  useEffect(() => {
    const h = window.location.hash.slice(1)
    if (!h) return
    const g = GRUPO_DA_ANCORA[h]
    if (g && !params.get('secao')) router.replace(`${pathname}?secao=${g}#${h}`, { scroll: false })
    const t = setTimeout(() => setAncora(h), 0)
    return () => clearTimeout(t)
  }, [params, pathname, router])
  useEffect(() => {
    if (!ancora) return
    let n = 0
    const t = setInterval(() => { const el = document.getElementById(ancora); if (el || ++n > 20) { clearInterval(t); el?.scrollIntoView({ behavior: 'smooth', block: 'start' }) } }, 150)
    return () => clearInterval(t)
  }, [ancora])
  const atual = grupos.find(g => g.id === params.get('secao')) ?? grupos[1] ?? grupos[0]
  const ir = (id: string) => router.replace(`${pathname}?secao=${id}`, { scroll: false })
  return (
    <div className="dp-config ar-config" data-configuracoes>
      <nav className="dp-config-indice" aria-label="Seções das configurações">
        {grupos.map(g => <button key={g.id} type="button" className={g.id === atual.id ? 'on' : ''} aria-current={g.id === atual.id ? 'page' : undefined} onClick={() => ir(g.id)} data-secao={g.id}>{g.rotulo}</button>)}
      </nav>
      <div className="dp-config-corpo ar-config-corpo" data-secao-aberta={atual.id}>
        <header className="ar-config-topo"><h2>{atual.rotulo}</h2><p className="pl-hint">{atual.descricao}</p></header>
        {atual.corpo}
      </div>
    </div>
  )
}

/** Preferências de quem está usando (19/11): o Modo guiado do Funil. */
function SeuJeito() {
  const { usuario } = useProLaboreAuth()
  const [guiado, setGuiado] = useModoGuiado(usuario?.papel)
  return (
    <div className="pl-card" style={{ marginBottom: 20 }} data-seu-jeito>
      <div className="pl-card-head"><div><div className="pl-card-title">Seu jeito de usar</div><div className="pl-card-sub">Vale só para você, em qualquer aparelho.</div></div></div>
      <div data-config-guiado><Interruptor id="modo-guiado" ligado={guiado} mudar={setGuiado} rotulo="Modo guiado no Funil" detalhe="Mostra a dica do quadro, a pergunta de cada coluna e o que fazer em cada card. Sem isso, essas orientações ficam só no painel do lead." /></div>
    </div>
  )
}
