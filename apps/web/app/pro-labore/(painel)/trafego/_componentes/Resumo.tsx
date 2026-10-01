'use client'

// Resumo da auditoria: nota geral (checagens objetivas com referência de
// mercado ou a meta do dono), as prioridades do diagnóstico e o ritmo de
// investimento do mês. Cada item leva pra seção onde o problema aparece.
import type { AnaliseTrafego, CheckAuditoriaTrafego, SecaoTrafego } from '@/lib/proLaboreApi'
import { moeda, num } from './formato'

export function irPara(secao: SecaoTrafego | undefined) {
  if (secao) document.getElementById(secao)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const STATUS: Record<CheckAuditoriaTrafego['status'], { rotulo: string; icone: string }> = {
  ok: { rotulo: 'OK', icone: '✓' },
  atencao: { rotulo: 'Atenção', icone: '▲' },
  critico: { rotulo: 'Crítico', icone: '!' },
  sem_dado: { rotulo: 'Sem dado', icone: '–' },
}

function Nota({ nota }: { nota: number | null }) {
  const r = 46, c = 2 * Math.PI * r
  const frac = nota == null ? 0 : nota / 100
  return (
    <div className="pl-tf-nota" role="img" aria-label={nota == null ? 'Sem nota' : `Nota da auditoria: ${nota} de 100`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--pl-surface-2)" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--sv-1)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${c * frac} ${c}`} transform="rotate(-90 60 60)" />
      </svg>
      <div><b>{nota ?? '—'}</b><small>de 100</small></div>
    </div>
  )
}

export default function Resumo({ analise }: { analise: AnaliseTrafego }) {
  const c = analise.conta.moeda
  const { auditoria, ritmoMes: r } = analise
  const prioridades = analise.diagnostico.filter(d => d.nivel === 'critico' || d.nivel === 'atencao').slice(0, 4)
  const okCount = auditoria.itens.filter(i => i.status === 'ok').length
  const avaliados = auditoria.itens.filter(i => i.status !== 'sem_dado').length
  const mesNome = new Date(`${r.mes}-15T12:00:00`).toLocaleDateString('pt-BR', { month: 'long' })
  const pctMes = r.diaAtual / r.diasNoMes

  return (
    <div className="pl-tf-resumo-grid">
      <div className="pl-card pl-tf-auditoria">
        <div className="pl-card-title">Auditoria do período</div>
        <div className="pl-card-sub">{okCount} de {avaliados} pontos dentro da referência</div>
        <div className="pl-tf-auditoria-corpo">
          <Nota nota={auditoria.nota} />
          <ul className="pl-tf-checks">
            {auditoria.itens.map(i => (
              <li key={i.chave} className={i.status}>
                <button type="button" onClick={() => irPara(i.secao)} title="Ver a seção">
                  <span className="pl-tf-check-icone" aria-hidden="true">{STATUS[i.status].icone}</span>
                  <span className="pl-tf-check-nome">{i.titulo}</span>
                  <span className="pl-tf-check-valor">{i.valor}</span>
                  <span className="pl-tf-check-ref">{i.referencia}</span>
                  <span className="pl-tf-check-status">{STATUS[i.status].rotulo}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="pl-tf-resumo-lado">
        <div className="pl-card">
          <div className="pl-card-title">Prioridades agora</div>
          {prioridades.length === 0 ? <p className="pl-hint" style={{ marginTop: 8 }}>Nada crítico no período. 👏</p> : (
            <ol className="pl-tf-prioridades">
              {prioridades.map((p, i) => (
                <li key={i} className={p.nivel}>
                  <button type="button" onClick={() => irPara(p.secao)}>
                    <b>{p.titulo}</b>
                    <span>{p.texto}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="pl-card">
          <div className="pl-card-title">Ritmo de {mesNome}</div>
          <div className="pl-card-sub">Dia {r.diaAtual} de {r.diasNoMes} · independe do período escolhido</div>
          <div className="pl-tf-ritmo-barra" role="img" aria-label={`Investido até agora ${moeda(r.gasto, c)}, projeção ${moeda(r.projecao, c)}`}>
            <span className="feito" style={{ width: `${r.projecao > 0 ? Math.min(100, (r.gasto / r.projecao) * 100) : 0}%` }} />
            <span className="hoje" style={{ left: `${pctMes * 100}%` }} title="Hoje" />
          </div>
          <dl className="pl-tf-ritmo">
            <div><dt>Investido no mês</dt><dd>{moeda(r.gasto, c)}</dd></div>
            <div><dt>Projeção do mês</dt><dd>{moeda(r.projecao, c)}</dd></div>
            <div><dt>Média/dia (7 dias)</dt><dd>{moeda(r.mediaDiaria7, c)}</dd></div>
            <div><dt>Orçamento diário ativo</dt><dd>{r.orcamentoDiarioAtivo != null ? moeda(r.orcamentoDiarioAtivo, c) : '—'}</dd></div>
            {r.leadsCrm != null && <div><dt>Leads no CRM no mês</dt><dd>{num(r.leadsCrm)}{r.projecaoLeadsCrm != null && <small> → ~{num(r.projecaoLeadsCrm)}</small>}</dd></div>}
            {r.custoLeadCrm != null && <div><dt>Custo por lead no mês</dt><dd>{moeda(r.custoLeadCrm, c)}</dd></div>}
          </dl>
          {r.orcamentoDiarioAtivo != null && r.mediaDiaria7 > 0 && Math.abs(r.mediaDiaria7 / r.orcamentoDiarioAtivo - 1) > 0.2 && (
            <p className="pl-hint" style={{ marginTop: 8 }}>
              {r.mediaDiaria7 < r.orcamentoDiarioAtivo
                ? `A entrega está gastando ${Math.round((1 - r.mediaDiaria7 / r.orcamentoDiarioAtivo) * 100)}% abaixo do orçamento ativo — público pequeno, lance limitado ou anúncios em análise.`
                : 'O gasto médio passou do orçamento ativo — algum orçamento foi reduzido ou pausado nos últimos dias.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
