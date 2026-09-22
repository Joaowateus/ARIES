'use client'

import { useEffect, useState } from 'react'
import { proLaboreApi, EstagioCrescimento, FormatoMetricaCrescimento, PilarCrescimento, PlanoCrescimento } from '@/lib/proLaboreApi'
import { formatMoeda, formatPct } from '@/lib/format'
import { PageHeader } from '../../PageHeader'

const ESTAGIO_LABEL: Record<EstagioCrescimento, string> = {
  INICIAR: 'Iniciar',
  MANTER: 'Manter',
  ESCALONAR: 'Escalonar',
  ESCALAR: 'Escalar',
}
// Iniciar entra como "crítico" de propósito — não porque algo esteja
// quebrado, mas pra chamar atenção de que a base daquele pilar ainda não
// está pronta pra sustentar o próximo passo.
const ESTAGIO_BADGE_CLASSE: Record<EstagioCrescimento, string> = {
  INICIAR: 'critico',
  MANTER: 'atencao',
  ESCALONAR: 'bom',
  ESCALAR: 'bom',
}

function formatarValor(valor: number, formato: FormatoMetricaCrescimento): string {
  if (formato === 'moeda') return formatMoeda(valor)
  if (formato === 'percentual') return formatPct(valor)
  return valor.toLocaleString('pt-BR')
}

function IconeGate({ atingido }: { atingido: boolean }) {
  return atingido ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

function CardPilar({ pilar }: { pilar: PilarCrescimento }) {
  return (
    <div className="pl-card">
      <div className="pl-card-head">
        <div>
          <div className="pl-card-title">{pilar.nome}</div>
          <div className="pl-card-sub">{pilar.resumo}</div>
        </div>
        <span className={`pl-status-badge ${ESTAGIO_BADGE_CLASSE[pilar.estagio]}`}>{ESTAGIO_LABEL[pilar.estagio]}</span>
      </div>

      <div className="pl-kpi-grid">
        {pilar.metricas.map(m => (
          <div key={m.label} className="pl-kpi">
            <div className="pl-kpi-label">{m.label}</div>
            <div className="pl-kpi-value">{formatarValor(m.valor, m.formato)}</div>
          </div>
        ))}
      </div>

      <div className="pl-plano-secao-titulo">Critérios pra avançar</div>
      <div className="pl-gate-list">
        {pilar.gates.map((g, i) => (
          <div key={i} className={`pl-gate-item ${g.atingido ? 'atingido' : ''}`}>
            <IconeGate atingido={g.atingido} />
            <span>{g.descricao}</span>
          </div>
        ))}
      </div>

      <div className="pl-plano-secao-titulo">Plano de ação</div>
      <ul className="pl-acoes-list">
        {pilar.acoes.map((a, i) => <li key={i}>{a}</li>)}
      </ul>

      <div className="pl-ritmo-badge" style={{ marginTop: 14 }}>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        {pilar.ritmo}
      </div>
    </div>
  )
}

export default function ProLaborePlanoCrescimentoPage() {
  const [plano, setPlano] = useState<PlanoCrescimento | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    proLaboreApi.planoCrescimento.obter().then(setPlano).finally(() => setCarregando(false))
  }, [])

  return (
    <div>
      <PageHeader
        eyebrow="Sistema"
        title="Plano de Crescimento"
        subtitle="Diagnóstico do momento da operação, cruzando funil, vendas, ROAS e redes sociais — o que fazer agora pra iniciar, manter, escalonar ou escalar cada frente do negócio"
      />

      {carregando && <div className="pl-hint" style={{ marginTop: 16 }}>Carregando...</div>}

      {!carregando && plano && (
        <>
          <div className="pl-card" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ flex: 1 }}>
              <div className="pl-card-title">Estágio geral: {ESTAGIO_LABEL[plano.estagioGeral]}</div>
              <div className="pl-card-sub">{plano.resumoGeral}</div>
            </div>
            <span className={`pl-status-badge ${ESTAGIO_BADGE_CLASSE[plano.estagioGeral]}`}>{ESTAGIO_LABEL[plano.estagioGeral]}</span>
          </div>

          <div className="pl-plano-grid" style={{ marginTop: 20 }}>
            {plano.pilares.map(p => <CardPilar key={p.chave} pilar={p} />)}
          </div>
        </>
      )}
    </div>
  )
}
