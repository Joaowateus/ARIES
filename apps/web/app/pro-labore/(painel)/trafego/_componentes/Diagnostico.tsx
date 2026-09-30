'use client'

// "Onde melhorar": o que a análise encontrou (com o porquê e o que fazer)
// e quanto cada meta batida renderia em leads e em custo por lead.
import type { AnaliseTrafego } from '@/lib/proLaboreApi'
import { minuscula, moeda, num, pct } from './formato'

const NIVEL = {
  critico: { rotulo: 'Crítico', icone: '!' },
  atencao: { rotulo: 'Atenção', icone: '▲' },
  info: { rotulo: 'Informação', icone: 'i' },
  positivo: { rotulo: 'Bom sinal', icone: '✓' },
} as const

export default function Diagnostico({ analise }: { analise: AnaliseTrafego }) {
  const c = analise.conta.moeda
  return (
    <div className="pl-tf-diag">
      <div className="pl-card">
        <div className="pl-card-title">O que os números dizem</div>
        {analise.diagnostico.length === 0 ? (
          <p className="pl-hint" style={{ marginTop: 10 }}>Nada fora do normal nesse período.</p>
        ) : (
          <ul className="pl-tf-diag-lista">
            {analise.diagnostico.map((d, i) => (
              <li key={i} className={d.nivel}>
                <span className="pl-tf-diag-icone" aria-hidden="true">{NIVEL[d.nivel].icone}</span>
                <div>
                  <b><span className="pl-tf-diag-nivel">{NIVEL[d.nivel].rotulo}</span>{d.titulo}</b>
                  <p>{d.texto}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="pl-card">
        <div className="pl-card-title">Se bater as metas</div>
        <p className="pl-card-sub" style={{ margin: '4px 0 0' }}>Mesmo investimento, as outras etapas convertendo igual.</p>
        {analise.simulacoes.length === 0 ? (
          <p className="pl-hint" style={{ marginTop: 10 }}>
            {analise.funil.some(e => e.meta?.tipo === 'CONV_MIN') ? 'Todas as etapas com meta de conversão já estão na meta. 👏' : 'Defina metas de conversão nas etapas do funil pra ver quanto cada melhoria renderia.'}
          </p>
        ) : (
          <ul className="pl-tf-sim">
            {analise.simulacoes.map(s => (
              <li key={s.etapa}>
                <div className="pl-tf-sim-de"><b>{s.rotulo}</b> de {pct(s.de, s.de < 0.1 ? 2 : 1)} para {pct(s.para, s.para < 0.1 ? 2 : 1)}</div>
                <div className="pl-tf-sim-ganho">
                  <span><b>+{num(s.finalNovo - s.finalAtual)}</b> {minuscula(s.etapaFinal)} <small>({num(s.finalAtual)} → {num(s.finalNovo)})</small></span>
                  {s.custoNovo != null && <span>custo por lead <b>{moeda(s.custoAtual, c)} → {moeda(s.custoNovo, c)}</b></span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
