'use client'

import { useEffect, useState } from 'react'
import { proLaboreApi, ChavePilarCrescimento, EstagioCrescimento, FormatoMetricaCrescimento, HistoricoCrescimentoMes, ItemAcaoCrescimento, PilarCrescimento, PlanoCrescimento } from '@/lib/proLaboreApi'
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

function ItemAcao({ item, onToggle, onSalvarTexto, onExcluir }: {
  item: ItemAcaoCrescimento
  onToggle: () => void
  onSalvarTexto: (texto: string) => void
  onExcluir: () => void
}) {
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState(item.texto)

  function salvar() {
    const texto = rascunho.trim()
    setEditando(false)
    if (texto && texto !== item.texto) onSalvarTexto(texto)
    else setRascunho(item.texto)
  }

  return (
    <div className="pl-acao-item">
      <input type="checkbox" className="pl-acao-checkbox" checked={item.concluida} onChange={onToggle} />
      {editando ? (
        <textarea
          className="pl-acao-texto-input"
          value={rascunho}
          autoFocus
          onChange={e => setRascunho(e.target.value)}
          onBlur={salvar}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); salvar() } if (e.key === 'Escape') { setRascunho(item.texto); setEditando(false) } }}
        />
      ) : (
        <span className={`pl-acao-texto ${item.concluida ? 'concluida' : ''}`}>{item.texto}</span>
      )}
      <div className="pl-acao-item-actions">
        <button type="button" className="pl-kanban-icon-btn" title="Editar" onClick={() => setEditando(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
          </svg>
        </button>
        {item.origem === 'CUSTOMIZADA' && (
          <button type="button" className="pl-kanban-icon-btn pl-danger" title="Excluir" onClick={onExcluir}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

function CardPilar({ pilar, onMudarItens }: { pilar: PilarCrescimento; onMudarItens: (itens: ItemAcaoCrescimento[]) => void }) {
  const [novoTexto, setNovoTexto] = useState('')
  const [adicionando, setAdicionando] = useState(false)

  async function toggleItem(item: ItemAcaoCrescimento) {
    onMudarItens(pilar.itens.map(i => i.id === item.id ? { ...i, concluida: !i.concluida } : i))
    await proLaboreApi.planoCrescimento.atualizarAcao(item.id, { concluida: !item.concluida })
  }

  async function salvarTexto(item: ItemAcaoCrescimento, texto: string) {
    onMudarItens(pilar.itens.map(i => i.id === item.id ? { ...i, texto } : i))
    await proLaboreApi.planoCrescimento.atualizarAcao(item.id, { texto })
  }

  async function excluirItem(item: ItemAcaoCrescimento) {
    onMudarItens(pilar.itens.filter(i => i.id !== item.id))
    await proLaboreApi.planoCrescimento.excluirAcao(item.id)
  }

  async function adicionarItem(e: React.FormEvent) {
    e.preventDefault()
    const texto = novoTexto.trim()
    if (!texto) return
    setAdicionando(true)
    try {
      const item = await proLaboreApi.planoCrescimento.criarAcao({ pilar: pilar.chave, texto })
      onMudarItens([...pilar.itens, item])
      setNovoTexto('')
    } finally {
      setAdicionando(false)
    }
  }

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
      {pilar.itens.length === 0 && <div className="pl-hint">Nenhuma ação ainda.</div>}
      <div className="pl-acoes-list">
        {pilar.itens.map(item => (
          <ItemAcao
            key={item.id}
            item={item}
            onToggle={() => toggleItem(item)}
            onSalvarTexto={texto => salvarTexto(item, texto)}
            onExcluir={() => excluirItem(item)}
          />
        ))}
      </div>
      <form className="pl-acao-add-row" onSubmit={adicionarItem}>
        <input className="pl-input" placeholder="Adicionar uma ação sua..." value={novoTexto} onChange={e => setNovoTexto(e.target.value)} />
        <button type="submit" className="pl-btn pl-btn-ghost" disabled={adicionando || !novoTexto.trim()}>Adicionar</button>
      </form>

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

const LINHAS_HISTORICO: { label: string; chave: keyof Omit<HistoricoCrescimentoMes, 'mes' | 'ano' | 'label'> }[] = [
  { label: 'Geral', chave: 'estagioGeral' },
  { label: 'Aquisição', chave: 'estagioAquisicao' },
  { label: 'Conversão', chave: 'estagioConversao' },
  { label: 'Execução', chave: 'estagioExecucao' },
  { label: 'Financeiro', chave: 'estagioFinanceiro' },
]

function TabelaHistorico({ meses }: { meses: HistoricoCrescimentoMes[] }) {
  if (meses.length === 0) {
    return <div className="pl-hint">O histórico começa a aparecer a partir do próximo mês — cada visita registra o estágio atual.</div>
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="pl-historico-tabela">
        <thead>
          <tr>
            <th>Pilar</th>
            {meses.map(m => <th key={`${m.ano}-${m.mes}`}>{m.label}/{String(m.ano).slice(2)}</th>)}
          </tr>
        </thead>
        <tbody>
          {LINHAS_HISTORICO.map(linha => (
            <tr key={linha.chave}>
              <td>{linha.label}</td>
              {meses.map(m => (
                <td key={`${m.ano}-${m.mes}`}>
                  <span className={`pl-status-badge ${ESTAGIO_BADGE_CLASSE[m[linha.chave]]}`}>{ESTAGIO_LABEL[m[linha.chave]]}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ProLaborePlanoCrescimentoPage() {
  const [plano, setPlano] = useState<PlanoCrescimento | null>(null)
  const [historico, setHistorico] = useState<HistoricoCrescimentoMes[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    // Encadeado de propósito: obter() é quem grava (upsert) o snapshot do
    // mês corrente no servidor — buscar o histórico em paralelo criaria uma
    // corrida onde ele podia chegar antes desse upsert terminar e não ver o
    // mês atual ainda.
    proLaboreApi.planoCrescimento.obter()
      .then(p => { setPlano(p); return proLaboreApi.planoCrescimento.historico(6) })
      .then(setHistorico)
      .finally(() => setCarregando(false))
  }, [])

  function mudarItensPilar(chave: ChavePilarCrescimento, itens: ItemAcaoCrescimento[]) {
    setPlano(atual => atual ? { ...atual, pilares: atual.pilares.map(p => p.chave === chave ? { ...p, itens } : p) } : atual)
  }

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
            {plano.pilares.map(p => (
              <CardPilar key={p.chave} pilar={p} onMudarItens={itens => mudarItensPilar(p.chave, itens)} />
            ))}
          </div>

          <div className="pl-card" style={{ marginTop: 20 }}>
            <div className="pl-card-head">
              <div>
                <div className="pl-card-title">Evolução mensal</div>
                <div className="pl-card-sub">O estágio de cada pilar registrado mês a mês, pra ver se a operação está avançando</div>
              </div>
            </div>
            <TabelaHistorico meses={historico} />
          </div>
        </>
      )}
    </div>
  )
}
