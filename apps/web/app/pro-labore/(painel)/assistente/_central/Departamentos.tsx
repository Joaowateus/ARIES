'use client'

// Bloco 7 — Departamentos: o painel de cada área com o que ela controla,
// os indicadores contra a meta, a equipe comercial, financeiro e estoque.
import type { IntelCentral, IntelLinhaScore } from '@/lib/proLaboreApi'
import { brl, num, pct100 } from './fmt'

const STATUS_LINHA: Record<IntelLinhaScore['status'], string> = { OK: 'Na meta', ATENCAO: 'Atenção', CRITICO: 'Crítico', SEM_DADOS: 'Sem dados', INFO: 'Informativo' }
const CATEGORIA: Record<string, string> = { ANUNCIO: 'Anúncios', MARKETING: 'Marketing', COMISSAO: 'Comissões', SALARIO: 'Salários', ALUGUEL: 'Aluguel', IMPOSTO: 'Impostos', OUTROS: 'Outros' }

export function Departamentos({ d }: { d: IntelCentral }) {
  const eq = d.equipe, fin = d.financeiro
  return (
    <>
      <div className="ic-grade">
        {d.departamentos.map(s => (
          <section key={s.departamento} className="ic-card">
            <div className="ic-cab">
              <div><h2>{s.nome}</h2><p className="ic-sub">Controla: {s.controla}</p></div>
              {s.diagnosticos > 0 && <span className="ic-tag moderado">{s.diagnosticos} alerta{s.diagnosticos > 1 ? 's' : ''}</span>}
            </div>
            {s.linhas.map(l => (
              <div key={l.nome} className="ic-linha">
                <span>{l.nome}{(l.meta || l.nota) && <small>{l.meta ? `meta: ${l.meta}` : ''}{l.meta && l.nota ? ' · ' : ''}{l.nota ?? ''}</small>}</span>
                <b style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>{l.valor}{l.status !== 'INFO' && <span className={`ic-tag ${l.status}`}>{STATUS_LINHA[l.status]}</span>}</b>
              </div>
            ))}
          </section>
        ))}
      </div>

      {eq && (
        <section className="ic-card">
          <div className="ic-cab">
            <div><h2>Equipe comercial</h2><p className="ic-sub">Carteira e produtividade de cada vendedor (os mesmos números do Copiloto). Abordagem e tempo pela coorte de 30 dias.</p></div>
          </div>
          <div className="ic-kpis" style={{ marginBottom: 14 }}>
            <div className="ic-kpi"><span>Leads novos sem abordagem</span><b>{eq.semAbordar}</b></div>
            <div className="ic-kpi"><span>Leads parados</span><b>{eq.parados}</b><small>além do prazo do estágio</small></div>
            <div className="ic-kpi"><span>Tempo até a 1ª abordagem</span><b>{eq.tempoAbordagemHoras != null ? `${num(eq.tempoAbordagemHoras, 1)} h` : '—'}</b><small>mediana</small></div>
            <div className="ic-kpi"><span>WhatsApp esperando</span><b>{eq.whatsapp.esperando}</b><small>{eq.whatsapp.semResposta} sem resposta · assume em {eq.whatsapp.tempoAssumirMinutos != null ? `${num(eq.whatsapp.tempoAssumirMinutos)} min` : '—'}</small></div>
            <div className="ic-kpi"><span>Agenda cumprida</span><b>{pct100(eq.agendaPct, 0)}</b><small>últimos 7 dias</small></div>
          </div>
          {eq.linhas.length === 0 ? <p className="ic-legenda">Nenhum vendedor ativo.</p> : (
            <div className="ic-rola">
              <table className="ic-tabela" style={{ minWidth: 760 }}>
                <thead><tr><th>Vendedor</th><th className="num">Carteira</th><th className="num">Sem abordar</th><th className="num">Parados</th><th className="num">Novos 7d</th><th className="num">Avanços 7d</th><th className="num">Vendas 7d</th><th className="num">Lead → abordado</th><th className="num">1ª abordagem</th><th className="num">Agenda</th><th className="num">Índice</th></tr></thead>
                <tbody>{eq.linhas.map(l => (
                  <tr key={l.vendedorId}>
                    <td>{l.nome}</td><td className="num">{l.carteira}</td><td className="num">{l.semAbordar}</td><td className="num">{l.parados}</td><td className="num">{l.novos7d}</td><td className="num">{l.movimentos7d}</td><td className="num">{l.fechados7d}</td>
                    <td className="num">{pct100(l.conversaoLeadAbordado, 0)}</td><td className="num">{l.tempoAbordagemHoras != null ? `${num(l.tempoAbordagemHoras, 1)} h` : '—'}</td><td className="num">{pct100(l.agendaPct, 0)}</td><td className="num"><b>{l.indice}</b></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <div className="ic-grade">
        {fin && (
          <section className="ic-card">
            <div className="ic-cab"><div><h2>Financeiro do mês</h2><p className="ic-sub">Faturamento é o que entrou em vendas; não é lucro.</p></div></div>
            <div className="ic-linha"><span>Faturamento bruto</span><b>{brl(fin.faturamentoBruto)}</b></div>
            <div className="ic-linha"><span>Comissões</span><b>{brl(fin.comissoes)}</b></div>
            {fin.proLabore != null && <div className="ic-linha"><span>Pró-labore</span><b>{brl(fin.proLabore)}</b></div>}
            <div className="ic-linha"><span>Investimento em marketing</span><b>{brl(fin.investimentoMarketing)}</b></div>
            {Object.entries(fin.despesasLancadas).map(([k, v]) => <div key={k} className="ic-linha"><span>{CATEGORIA[k] ?? k}<small>lançamentos pagos</small></span><b>{brl(v)}</b></div>)}
            <div className="ic-linha"><span>Total lançado no Financeiro</span><b>{brl(fin.totalLancado)}</b></div>
            <div className="ic-linha"><span>Margem de contribuição<small>{fin.margemConfigurada ? 'margem por venda × vendas' : 'não configurada nas Premissas'}</small></span><b>{brl(fin.margemContribuicao)}</b></div>
            <div className="ic-linha"><span>ROAS geral<small>faturamento ÷ investimento</small></span><b>{fin.roasGeral != null ? `${num(fin.roasGeral, 1)}×` : '—'}</b></div>
            {fin.avisos.length > 0 && <ul className="ic-pontos" style={{ marginTop: 10 }}>{fin.avisos.map(a => <li key={a}>{a}</li>)}</ul>}
          </section>
        )}
        <section className="ic-card">
          <div className="ic-cab"><div><h2>Estoque</h2><p className="ic-sub">Motos disponíveis e há quanto tempo estão paradas.</p></div></div>
          <div className="ic-linha"><span>Disponíveis</span><b>{d.estoque.disponiveis}</b></div>
          <div className="ic-linha"><span>Reservadas</span><b>{d.estoque.reservadas}</b></div>
          <div className="ic-linha"><span>Tempo médio em estoque</span><b>{d.estoque.diasMedio != null ? `${num(d.estoque.diasMedio)} dias` : '—'}</b></div>
          {d.estoque.maisAntigas.length > 0 && <>
            <h3 style={{ margin: '12px 0 6px' }}>Mais antigas</h3>
            {d.estoque.maisAntigas.map(m => <div key={m.modelo + m.dias} className="ic-linha"><span>{m.modelo}</span><b>{m.dias} dias</b></div>)}
          </>}
        </section>
      </div>
    </>
  )
}
