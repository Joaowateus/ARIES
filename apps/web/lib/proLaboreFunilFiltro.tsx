'use client'

import { useEffect, useRef, useState } from 'react'
import { Lead, TipoLead, Vendedor } from './proLaboreApi'

// Mesma ordem/lógica do backend (estagioAtingiu em proLabore.ts) — usada
// pra recalcular contagens "alcançou a etapa X" no cliente a partir de
// Leads já carregados (tanto no /painel quanto no CRM), sem precisar de
// endpoint novo pra cada combinação de filtro.
export const ORDEM_ESTAGIO_LEAD = ['LEAD', 'ABORDADO', 'NEGOCIACAO', 'PROPOSTA', 'FECHADO'] as const
export function estagioAtingiu(estagioAtual: string, alvo: (typeof ORDEM_ESTAGIO_LEAD)[number]): boolean {
  if (estagioAtual === 'PERDIDO') return false
  return ORDEM_ESTAGIO_LEAD.indexOf(estagioAtual as (typeof ORDEM_ESTAGIO_LEAD)[number]) >= ORDEM_ESTAGIO_LEAD.indexOf(alvo)
}

// Data em que o lead de fato ALCANÇOU a etapa (não quando foi criado) — pra
// LEAD é sempre `criadoEm` (a própria definição de "virou lead"); pras
// demais, é a transição mais antiga no histórico que já satisfaz essa etapa
// ou uma posterior (um lead que pulou direto de LEAD pra NEGOCIACAO também
// "alcançou" ABORDADO nesse mesmo instante). `null` quando o lead nunca
// alcançou essa etapa. Essencial pra filtrar o funil por período: usar
// `criadoEm` pra todas as etapas (como o código fazia antes) sub-conta
// qualquer lead que avançou de estágio depois de ter sido criado fora do
// período — inclusive fazendo uma venda fechada na semana "sumir" do
// filtro "essa semana" se o lead tinha sido criado antes.
export function dataAlcancouEtapa(lead: Lead, etapa: (typeof ORDEM_ESTAGIO_LEAD)[number]): Date | null {
  if (etapa === 'LEAD') return new Date(lead.criadoEm)
  const alvoIdx = ORDEM_ESTAGIO_LEAD.indexOf(etapa)
  const candidatos = (lead.historico ?? [])
    .filter(h => (ORDEM_ESTAGIO_LEAD as readonly string[]).includes(h.estagioNovo) && ORDEM_ESTAGIO_LEAD.indexOf(h.estagioNovo as (typeof ORDEM_ESTAGIO_LEAD)[number]) >= alvoIdx)
    .map(h => new Date(h.criadoEm).getTime())
  return candidatos.length > 0 ? new Date(Math.min(...candidatos)) : null
}

// Funil completo (contagem + população de leads por etapa) recortado por um
// predicado de período — mesma lógica compartilhada entre o Painel (Jornada
// de compra) e o CRM (Kanban de Leads), cada etapa usando a data em que
// realmente foi alcançada (dataAlcancouEtapa), não `criadoEm` uniforme.
// "Leads" (topo do funil) inclui perdidos (não é um "estágio alcançado",
// é população que entrou); as demais etapas excluem quem está PERDIDO hoje,
// mesmo raciocínio de `estagioAtingiu`.
export function popularFunilNoPeriodo(
  leads: Lead[],
  dentroPeriodo: (data: Date) => boolean,
  filtros: { vendedorId?: string | null; canal?: '' | TipoLead } = {},
): Record<(typeof ORDEM_ESTAGIO_LEAD)[number], Lead[]> {
  const passaFiltros = (l: Lead) =>
    (!filtros.vendedorId || l.vendedorId === filtros.vendedorId) && (!filtros.canal || l.tipoLead === filtros.canal)
  function popular(etapa: (typeof ORDEM_ESTAGIO_LEAD)[number]): Lead[] {
    const base = etapa === 'LEAD' ? leads.filter(passaFiltros) : leads.filter(l => passaFiltros(l) && l.estagio !== 'PERDIDO')
    return base.filter(l => {
      const d = dataAlcancouEtapa(l, etapa)
      return d != null && dentroPeriodo(d)
    })
  }
  return {
    LEAD: popular('LEAD'),
    ABORDADO: popular('ABORDADO'),
    NEGOCIACAO: popular('NEGOCIACAO'),
    PROPOSTA: popular('PROPOSTA'),
    FECHADO: popular('FECHADO'),
  }
}

// Mesma semântica do preset "hoje" de /receitas-periodo — só o dia atual.
export function periodoHoje(): { inicio: string; fim: string } {
  const hojeIso = new Date().toISOString().slice(0, 10)
  return { inicio: hojeIso, fim: hojeIso }
}

// Semana comercial (segunda a sábado, sem domingo) que contém hoje — sempre
// a semana atual, nunca um intervalo fixo de dias pra trás.
export function periodoSemanaAtual(): { inicio: string; fim: string } {
  const hoje = new Date()
  const diasDesdeSegunda = (hoje.getUTCDay() + 6) % 7 // domingo=0 vira 6; segunda=1 vira 0
  const segunda = new Date(hoje.getTime() - diasDesdeSegunda * 24 * 60 * 60 * 1000)
  const sabado = new Date(segunda.getTime() + 5 * 24 * 60 * 60 * 1000)
  return { inicio: segunda.toISOString().slice(0, 10), fim: sabado.toISOString().slice(0, 10) }
}

/* ============ FILTRO DO FUNIL (vendedor isolado + canal + período) ============
 * Compartilhado entre o Painel (Jornada de compra) e o CRM (Leads) — mesmo
 * popover, mesmo comportamento, nos dois lugares. */
export function FunilFiltro({
  vendedores, vendedorId, vendedorGeralId, canal, onChangeVendedor, onChangeCanal,
  periodo, customInicio, customFim, onChangeCustomInicio, onChangeCustomFim, onAplicarPeriodo, onLimparPeriodo, onSelecionarPreset,
}: {
  vendedores: Vendedor[]
  vendedorId: string | null
  vendedorGeralId: string
  canal: '' | TipoLead
  onChangeVendedor: (v: string | null) => void
  onChangeCanal: (c: '' | TipoLead) => void
  periodo: { inicio: string; fim: string } | null
  customInicio: string
  customFim: string
  onChangeCustomInicio: (v: string) => void
  onChangeCustomFim: (v: string) => void
  onAplicarPeriodo: () => void
  onLimparPeriodo: () => void
  onSelecionarPreset: (tipo: 'hoje' | 'semana') => void
}) {
  const [aberto, setAberto] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const ativo = vendedorId !== null || canal !== '' || periodo !== null
  const rotuloGeral = vendedorGeralId ? (vendedores.find(v => v.id === vendedorGeralId)?.nome ?? 'vendedor') : 'Todos'

  function aplicarPeriodo() {
    onAplicarPeriodo()
    setAberto(false)
  }

  function selecionarPreset(tipo: 'hoje' | 'semana') {
    onSelecionarPreset(tipo)
    setAberto(false)
  }

  useEffect(() => {
    if (!aberto) return
    function onClickFora(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', onClickFora)
    return () => document.removeEventListener('mousedown', onClickFora)
  }, [aberto])

  return (
    <div className="pl-filter-wrap" ref={wrapRef}>
      <button type="button" className={`pl-icon-btn ${ativo ? 'active' : ''}`} onClick={() => setAberto(a => !a)} title="Filtrar funil" aria-label="Filtrar funil">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M8 12h8M11 18h2" /></svg>
        {ativo && <span className="pl-icon-btn-dot" />}
      </button>

      {aberto && (
        <div className="pl-filter-pop">
          {vendedores.length > 0 && (
            <div className="pl-field">
              <label>Vendedor (isolado do funil)</label>
              <select className="pl-select" value={vendedorId ?? '__geral__'} onChange={e => onChangeVendedor(e.target.value === '__geral__' ? null : e.target.value)}>
                <option value="__geral__">Filtro geral ({rotuloGeral})</option>
                <option value="">Todos</option>
                {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
              </select>
            </div>
          )}
          <div className="pl-field">
            <label>Canal</label>
            <select className="pl-select" value={canal} onChange={e => onChangeCanal(e.target.value as '' | TipoLead)}>
              <option value="">Todos</option>
              <option value="TRAFEGO">Tráfego pago</option>
              <option value="ORGANICO">Orgânico</option>
            </select>
          </div>
          <div className="pl-field">
            <label>Período</label>
            <div className="pl-period-row">
              <button type="button" className={`pl-chip ${periodo && periodo.inicio === periodoHoje().inicio && periodo.fim === periodoHoje().fim ? 'active' : ''}`} onClick={() => selecionarPreset('hoje')}>Hoje</button>
              <button type="button" className={`pl-chip ${periodo && periodo.inicio === periodoSemanaAtual().inicio && periodo.fim === periodoSemanaAtual().fim ? 'active' : ''}`} onClick={() => selecionarPreset('semana')}>Essa semana</button>
            </div>
          </div>
          <div className="pl-field">
            <label>Data início</label>
            <input type="date" className="pl-input" value={customInicio} onChange={e => onChangeCustomInicio(e.target.value)} />
          </div>
          <div className="pl-field">
            <label>Data fim</label>
            <input type="date" className="pl-input" value={customFim} onChange={e => onChangeCustomFim(e.target.value)} />
          </div>
          <button type="button" className="pl-btn pl-btn-primary" style={{ width: '100%' }} disabled={!customInicio || !customFim} onClick={aplicarPeriodo}>
            Aplicar período
          </button>
          {ativo && (
            <span className="pl-filter-clear" onClick={() => { onChangeVendedor(null); onChangeCanal(''); onLimparPeriodo(); setAberto(false) }}>
              Limpar filtros
            </span>
          )}
        </div>
      )}
    </div>
  )
}
