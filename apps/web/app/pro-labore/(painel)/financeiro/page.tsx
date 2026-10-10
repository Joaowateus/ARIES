'use client'

// Financeiro: tudo o que a operação paga fora das vendas (salário, vale,
// bonificação, reembolso, investimento, custo e outros gastos). Cada
// pagamento gera um recibo numerado para imprimir e assinar, como o
// comprovante de comissão de Vendas. A visão do mês soma também o que saiu
// pela tela de Vendas (comissões e pró-labore) para fechar o caixa.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { proLaboreApi, type CategoriaFinanceira, type LancamentoFinanceiro, type PainelFinanceiro } from '@/lib/proLaboreApi'
import { formatMoeda } from '@/lib/format'
import { PageHeader } from '../../PageHeader'
import { NovoPagamento } from './NovoPagamento'
import { PagarSalarios } from './PagarSalarios'
import { abrirRecibo, dataCurta, mesAtualLocal, mesExtenso, ROTULO_FORMA, somarMes } from './util'

const EQUIPE: CategoriaFinanceira[] = ['SALARIO', 'ADIANTAMENTO', 'BONIFICACAO', 'REEMBOLSO']

export default function FinanceiroPage() {
  const { usuario } = useProLaboreAuth()
  const [mes, setMes] = useState(mesAtualLocal)
  const [dados, setDados] = useState<PainelFinanceiro | null>(null)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState<CategoriaFinanceira | 'TODOS'>('TODOS')
  const [busca, setBusca] = useState('')
  const [verCancelados, setVerCancelados] = useState(false)
  const [modal, setModal] = useState<null | 'novo' | 'salarios'>(null)
  const [cancelando, setCancelando] = useState<string | null>(null)

  const carregar = useCallback(() => {
    proLaboreApi.financeiro.painel(mes).then(d => { setDados(d); setErro('') }).catch(e => setErro(e instanceof Error ? e.message : 'Não deu pra carregar o Financeiro'))
  }, [mes])
  useEffect(() => { carregar() }, [carregar])

  const atual = dados?.mes === mes ? dados : null
  const rotulo = (c: CategoriaFinanceira) => dados?.categorias.find(x => x.chave === c)?.rotulo ?? c
  const lista = useMemo(() => {
    if (!atual) return []
    const q = busca.trim().toLowerCase()
    return atual.lancamentos.filter(l => (verCancelados || !l.canceladoEm)
      && (filtro === 'TODOS' || l.categoria === filtro)
      && (!q || `${l.favorecido} ${l.descricao} ${l.numero}`.toLowerCase().includes(q)))
  }, [atual, busca, filtro, verCancelados])

  async function cancelar(l: LancamentoFinanceiro) {
    if (!window.confirm(`Cancelar o recibo nº ${l.numero} de ${l.favorecido} (${formatMoeda(l.valorTotal)})? O número não é reaproveitado e o recibo passa a aparecer como cancelado.`)) return
    setCancelando(l.id)
    try { await proLaboreApi.financeiro.cancelar(l.id); carregar() } catch (e) { window.alert(e instanceof Error ? e.message : 'Não deu pra cancelar') } finally { setCancelando(null) }
  }

  const p = atual?.totais.porCategoria
  const equipeTotal = p ? EQUIPE.reduce((s, c) => s + p[c], 0) : 0
  const ativos = atual?.lancamentos.filter(l => !l.canceladoEm) ?? []
  const pode = !!dados?.podeEditar
  const nomeDono = usuario?.nome ?? ''

  return (
    <div className="pl-fin">
      <PageHeader
        eyebrow="Operação"
        title="Financeiro"
        subtitle="Salários, investimentos, custos e outros gastos. Cada pagamento gera um recibo pronto para imprimir e assinar."
        actions={pode ? (
          <div className="pl-fin-acoes">
            <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setModal('salarios')}>Pagar salários</button>
            <button type="button" className="pl-btn pl-btn-primary" onClick={() => setModal('novo')}>Novo pagamento</button>
          </div>
        ) : undefined}
      />

      <div className="pl-fin-mes" role="group" aria-label="Mês">
        <button type="button" className="pl-btn pl-btn-ghost" aria-label="Mês anterior" onClick={() => setMes(m => somarMes(m, -1))}>‹</button>
        <b>{mesExtenso(mes).replace(/^./, c => c.toUpperCase())}</b>
        <button type="button" className="pl-btn pl-btn-ghost" aria-label="Próximo mês" onClick={() => setMes(m => somarMes(m, 1))}>›</button>
        {mes !== mesAtualLocal() && <button type="button" className="pl-link-action" onClick={() => setMes(mesAtualLocal())}>Voltar para este mês</button>}
      </div>

      {erro && <div className="pl-alert pl-alert-error" style={{ marginBottom: 14 }}>{erro}</div>}

      <div className="pl-kpi-grid pl-fin-kpis">
        <div className="pl-kpi pl-fin-kpi-total">
          <div className="pl-kpi-label">Pago no mês</div>
          <div className="pl-kpi-value">{atual ? formatMoeda(atual.totais.total) : '—'}</div>
          <div className="pl-kpi-foot"><span className="pl-kpi-vs">{atual ? `${ativos.length} ${ativos.length === 1 ? 'recibo' : 'recibos'}` : 'Carregando…'}</span></div>
        </div>
        <div className="pl-kpi">
          <div className="pl-kpi-label">Equipe</div>
          <div className="pl-kpi-value">{p ? formatMoeda(equipeTotal) : '—'}</div>
          <div className="pl-kpi-foot"><span className="pl-kpi-vs">Salários, vales, bonificações e reembolsos</span></div>
        </div>
        {(['INVESTIMENTO', 'CUSTO', 'OUTRO'] as CategoriaFinanceira[]).map(c => (
          <div key={c} className="pl-kpi">
            <div className="pl-kpi-label">{dados?.categorias.find(x => x.chave === c)?.plural ?? c}</div>
            <div className="pl-kpi-value">{p ? formatMoeda(p[c]) : '—'}</div>
          </div>
        ))}
      </div>
      {atual?.vendas && (atual.vendas.comissoes > 0 || atual.vendas.proLabore > 0) && (
        <p className="pl-hint pl-fin-vendas">
          Pago pela tela de Vendas no mesmo mês: comissões {formatMoeda(atual.vendas.comissoes)} · pró-labore {formatMoeda(atual.vendas.proLabore)}.
          {' '}Total do mês somando tudo: <b>{formatMoeda(atual.totais.total + atual.vendas.comissoes + atual.vendas.proLabore)}</b>.
        </p>
      )}

      <div className="pl-card pl-fin-lista">
        <div className="pl-cms-filtros">
          <div className="pl-cms-abas" role="group" aria-label="Tipo de pagamento">
            <button type="button" className={filtro === 'TODOS' ? 'ativo' : undefined} aria-pressed={filtro === 'TODOS'} onClick={() => setFiltro('TODOS')}>Todos</button>
            {dados?.categorias.filter(c => atual?.lancamentos.some(l => l.categoria === c.chave)).map(c => (
              <button key={c.chave} type="button" className={filtro === c.chave ? 'ativo' : undefined} aria-pressed={filtro === c.chave} onClick={() => setFiltro(c.chave)}>{c.plural}</button>
            ))}
          </div>
          <div className="pl-fin-filtros-dir">
            <label className="pl-fin-cancelados"><input type="checkbox" checked={verCancelados} onChange={e => setVerCancelados(e.target.checked)} /> Mostrar cancelados</label>
            <input className="pl-input pl-fin-busca" type="search" placeholder="Buscar por nome ou referente" aria-label="Buscar pagamento" value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
        </div>

        {!atual ? <p className="pl-hint">Carregando…</p> : lista.length === 0 ? (
          <div className="pl-empty">
            <div className="pl-emoji">🧾</div>
            <h3 style={{ margin: 0, color: 'var(--pl-ink-1)', fontWeight: 600 }}>
              {atual.lancamentos.length ? 'Nenhum pagamento com esse filtro' : `Nenhum pagamento em ${mesExtenso(mes)}`}
            </h3>
            {pode && !atual.lancamentos.length && <p style={{ marginTop: 6 }}>Use &quot;Pagar salários&quot; para a folha da equipe ou &quot;Novo pagamento&quot; para custos, investimentos e outros gastos.</p>}
          </div>
        ) : (
          <div className="pl-table-wrap">
            <table className="pl-table pl-fin-tabela">
              <thead>
                <tr><th>Recibo</th><th>Data</th><th>Tipo</th><th>Quem recebe</th><th>Referente a</th><th className="pl-right">Valor</th><th><span className="pl-sr">Ações</span></th></tr>
              </thead>
              <tbody>
                {lista.map(l => (
                  <tr key={l.id} className={l.canceladoEm ? 'pl-fin-cancelado' : undefined}>
                    <td className="pl-mono">nº {String(l.numero).padStart(4, '0')}</td>
                    <td>{dataCurta(l.pagoEm)}</td>
                    <td><span className={`pl-fin-tag c-${l.categoria.toLowerCase()}`}>{rotulo(l.categoria)}</span></td>
                    <td><b>{l.favorecido}</b>{l.formaPagamento && <small className="pl-fin-sub">{ROTULO_FORMA[l.formaPagamento]}</small>}</td>
                    <td>{l.descricao}{l.canceladoEm && <small className="pl-fin-sub">Cancelado em {dataCurta(l.canceladoEm)}</small>}</td>
                    <td className="pl-right pl-mono">{formatMoeda(l.valorTotal)}</td>
                    <td className="pl-fin-acoes-linha">
                      <button type="button" className="pl-link-action" onClick={() => abrirRecibo(l.id)}>Abrir recibo</button>
                      {pode && !l.canceladoEm && <button type="button" className="pl-link-action pl-danger" disabled={cancelando === l.id} onClick={() => void cancelar(l)}>Cancelar</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal === 'novo' && dados && <NovoPagamento dados={dados} nomeDono={nomeDono} onFechar={() => setModal(null)} onRegistrado={carregar} />}
      {modal === 'salarios' && dados && <PagarSalarios mesInicial={mes} formas={dados.formas} nomeDono={nomeDono} onFechar={() => setModal(null)} onRegistrado={carregar} />}
    </div>
  )
}
