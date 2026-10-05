'use client'

import { useEffect, useState, useCallback } from 'react'
import { proLaboreApi, Venda, ParametroLiquidez, Vendedor } from '@/lib/proLaboreApi'
import { formatMoeda } from '@/lib/format'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { PageHeader } from '../../PageHeader'
import RegistrarPagamento, { abrirComprovante } from './RegistrarPagamento'

const MESES_MAP: Record<string, number> = {
  jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11,
}

function normalizarMes(raw: string): string | null {
  const limpo = raw.trim().toLowerCase().slice(0, 3)
  return limpo in MESES_MAP ? limpo : null
}

function parseValorBR(raw: string): number {
  const semSimbolo = raw.replace(/[R$\s]/g, '')
  const semMilhar = semSimbolo.replace(/\./g, '')
  const comPonto = semMilhar.replace(',', '.')
  const numero = Number(comPonto)
  return Number.isFinite(numero) ? numero : 0
}

interface ResultadoImportacao { linha: string; ok: boolean; erro?: string }

type FiltroComissao = 'todas' | 'apagar' | 'pagas'

// Venda que gera comissão pra pagar: tem vendedor e valor maior que zero.
const temComissao = (v: Venda) => !!v.vendedorId && (v.valorComissao ?? 0) > 0

// Vendas é cadastro exclusivo do dono — vendedor não registra a própria
// venda, só acompanha o resultado (comissão) no Dashboard e trabalha o
// funil em Leads.
export default function ProLaboreVendasPage() {
  const { usuario } = useProLaboreAuth()
  const isDono = usuario?.papel === 'DONO'

  const [vendas, setVendas] = useState<Venda[]>([])
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [parametro, setParametro] = useState<ParametroLiquidez | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const [form, setForm] = useState({ data: '', valorVenda: '', valorProLabore: '', vendedorId: '', valorComissao: '', observacao: '' })

  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [apagandoSelecao, setApagandoSelecao] = useState(false)

  // Pagamento de comissões: quais vendas estão no modal de "marcar como
  // paga", filtro da tabela e a venda sendo desmarcada (pra travar o clique).
  const [pagando, setPagando] = useState<Venda[] | null>(null)
  const [filtroComissao, setFiltroComissao] = useState<FiltroComissao>('todas')
  const [filtroVendedor, setFiltroVendedor] = useState('')
  const [desmarcando, setDesmarcando] = useState<string | null>(null)
  const [erroComissao, setErroComissao] = useState('')

  const [importAberto, setImportAberto] = useState(false)
  const [textoImportacao, setTextoImportacao] = useState('')
  const [anoImportacao, setAnoImportacao] = useState('2026')
  const [comissaoImportacao, setComissaoImportacao] = useState('500')
  const [importando, setImportando] = useState(false)
  const [resultadosImportacao, setResultadosImportacao] = useState<ResultadoImportacao[]>([])

  const carregar = useCallback(() => {
    if (!isDono) { setLoading(false); return }
    Promise.all([proLaboreApi.vendas.listar(), proLaboreApi.parametros.get(), proLaboreApi.vendedores.listar()])
      .then(([v, p, ven]) => { setVendas(v); setParametro(p); setVendedores(ven) })
      .finally(() => setLoading(false))
  }, [isDono])

  useEffect(() => { carregar() }, [carregar])

  // Pró-labore é sempre do dono, sacado de qualquer venda — o teto é o
  // padrão único da conta (Configurações), não depende de vendedor.
  const tetoProLabore = parametro?.tetoProLaborePorVenda ?? 900

  // Comissão é o que se paga ao vendedor daquela venda — cada um pode ter
  // o próprio teto (Vendedores), senão cai pro padrão da conta.
  function tetoComissao(vendedorId: string): number {
    const vendedor = vendedores.find(v => v.id === vendedorId)
    return vendedor?.tetoComissaoPorVenda ?? parametro?.tetoComissaoPadrao ?? 900
  }

  function atualizarValorVenda(valor: string) {
    const numero = Number(valor)
    const sugestao = Number.isFinite(numero) && numero > 0 ? Math.min(numero, tetoProLabore) : tetoProLabore
    setForm(f => ({ ...f, valorVenda: valor, valorProLabore: editandoId ? f.valorProLabore : String(sugestao) }))
  }

  function selecionarVendedor(vendedorId: string) {
    setForm(f => {
      if (!vendedorId) return { ...f, vendedorId, valorComissao: '' }
      const novoTeto = tetoComissao(vendedorId)
      const sugestao = editandoId ? f.valorComissao : String(Math.min(Number(f.valorComissao) || novoTeto, novoTeto))
      return { ...f, vendedorId, valorComissao: sugestao }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      const valorVenda = Number(form.valorVenda)
      const valorProLabore = Number(form.valorProLabore)
      const vendedorId = form.vendedorId || undefined
      const valorComissao = vendedorId && form.valorComissao !== '' ? Number(form.valorComissao) : undefined
      if (editandoId) {
        await proLaboreApi.vendas.editar(editandoId, {
          valorVenda, valorProLabore, vendedorId: form.vendedorId || null,
          valorComissao: form.vendedorId ? valorComissao ?? 0 : null,
          observacao: form.observacao || undefined,
        })
      } else {
        await proLaboreApi.vendas.criar({ data: form.data, valorVenda, valorProLabore, vendedorId, valorComissao, observacao: form.observacao || undefined })
      }
      setForm({ data: '', valorVenda: '', valorProLabore: '', vendedorId: '', valorComissao: '', observacao: '' })
      setEditandoId(null)
      carregar()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar venda')
    } finally {
      setSalvando(false)
    }
  }

  function editar(v: Venda) {
    setEditandoId(v.id)
    setForm({
      data: v.data.slice(0, 10),
      valorVenda: String(v.valorVenda),
      valorProLabore: String(v.valorProLabore),
      vendedorId: v.vendedorId ?? '',
      valorComissao: v.valorComissao != null ? String(v.valorComissao) : '',
      observacao: v.observacao ?? '',
    })
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setForm({ data: '', valorVenda: '', valorProLabore: '', vendedorId: '', valorComissao: '', observacao: '' })
  }

  async function remover(id: string) {
    const v = vendas.find(x => x.id === id)
    const aviso = v?.pagamentoComissao ? `\n\nA comissão dela está no comprovante nº ${v.pagamentoComissao.numero} — ela sai do comprovante.` : ''
    if (!confirm(`Remover esta venda?${aviso}`)) return
    await proLaboreApi.vendas.remover(id)
    if (editandoId === id) cancelarEdicao()
    carregar()
  }

  function toggleSelecao(id: string) {
    setSelecionadas(atual => {
      const proxima = new Set(atual)
      if (proxima.has(id)) proxima.delete(id)
      else proxima.add(id)
      return proxima
    })
  }

  function toggleSelecaoTodas() {
    setSelecionadas(atual => (visiveis.length > 0 && visiveis.every(v => atual.has(v.id)) ? new Set() : new Set(visiveis.map(v => v.id))))
  }

  // Clique na coluna "Comissão paga": a pagar → abre o modal pra registrar;
  // paga → pergunta se quer desmarcar (sai do comprovante).
  async function alternarPaga(v: Venda) {
    setErroComissao('')
    if (!v.pagamentoComissao) { setPagando([v]); return }
    if (!confirm(`Desmarcar a comissão de ${v.vendedor?.nome ?? 'vendedor'} como paga?\n\nEla volta pra "a pagar" e sai do comprovante nº ${v.pagamentoComissao.numero}.`)) return
    setDesmarcando(v.id)
    try {
      await proLaboreApi.comissoes.desmarcar([v.id])
      carregar()
    } catch (err) {
      setErroComissao(err instanceof Error ? err.message : 'Não deu pra desmarcar')
    } finally {
      setDesmarcando(null)
    }
  }

  function pagarSelecionadas() {
    setErroComissao('')
    setPagando(vendas.filter(v => selecionadas.has(v.id) && temComissao(v) && !v.pagamentoComissao))
  }

  async function apagarSelecionadas() {
    const qtd = selecionadas.size
    if (qtd === 0) return
    if (!confirm(`Apagar ${qtd} venda${qtd > 1 ? 's' : ''} selecionada${qtd > 1 ? 's' : ''}? Essa ação não pode ser desfeita.`)) return
    setApagandoSelecao(true)
    try {
      for (const id of selecionadas) {
        await proLaboreApi.vendas.remover(id)
      }
      setSelecionadas(new Set())
      if (editandoId && selecionadas.has(editandoId)) cancelarEdicao()
      carregar()
    } finally {
      setApagandoSelecao(false)
    }
  }

  async function processarImportacao() {
    setImportando(true)
    setResultadosImportacao([])

    const ano = Number(anoImportacao)
    const linhas = textoImportacao.split('\n').map(l => l.trim()).filter(Boolean)
    const registros: { mes: string; mesIdx: number; vendedor: string; valor: number; pendente: boolean }[] = []

    for (const linha of linhas) {
      let campos = linha.split('\t').map(c => c.trim())
      if (campos.length < 3) campos = linha.split(/\s{2,}/).map(c => c.trim())
      if (campos.length < 3) continue
      const [mesRaw, vendedorRaw, valorRaw, statusRaw] = campos
      const mesNorm = normalizarMes(mesRaw)
      if (mesNorm === null) continue // pula cabeçalho ou linha inválida
      const valor = parseValorBR(valorRaw)
      if (!valor || !vendedorRaw) continue
      registros.push({ mes: mesRaw, mesIdx: MESES_MAP[mesNorm], vendedor: vendedorRaw, valor, pendente: /pendente/i.test(statusRaw ?? '') })
    }

    if (registros.length === 0) {
      setResultadosImportacao([{ linha: '—', ok: false, erro: 'Nenhuma linha reconhecida. Confira o formato (Mês, Vendedor, Valor, Status).' }])
      setImportando(false)
      return
    }

    // resolve/cria vendedores que ainda não existem
    const existentes = await proLaboreApi.vendedores.listar()
    const mapaVendedores = new Map(existentes.map(v => [v.nome.toLowerCase(), v.id]))
    const nomesUnicos = [...new Set(registros.map(r => r.vendedor.toLowerCase()))]
    for (const nomeLower of nomesUnicos) {
      if (!mapaVendedores.has(nomeLower)) {
        const original = registros.find(r => r.vendedor.toLowerCase() === nomeLower)!.vendedor
        const criado = await proLaboreApi.vendedores.criar(original)
        mapaVendedores.set(nomeLower, criado.id)
      }
    }
    setVendedores(await proLaboreApi.vendedores.listar())

    const contadorPorMes = new Map<number, number>()
    const resultados: ResultadoImportacao[] = []
    const comissaoPadraoLote = Number(comissaoImportacao) || 0

    for (const reg of registros) {
      const ocorrencia = (contadorPorMes.get(reg.mesIdx) ?? 0) + 1
      contadorPorMes.set(reg.mesIdx, ocorrencia)
      const diasNoMes = new Date(ano, reg.mesIdx + 1, 0).getDate()
      const dia = Math.min(ocorrencia, diasNoMes)
      const dataIso = `${ano}-${String(reg.mesIdx + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
      const valorProLabore = Math.min(tetoProLabore, reg.valor)
      const vendedorId = mapaVendedores.get(reg.vendedor.toLowerCase())
      const valorComissao = vendedorId ? Math.min(comissaoPadraoLote, reg.valor) : undefined
      const rotulo = `${reg.mes} · ${reg.vendedor} · ${formatMoeda(reg.valor)}`
      try {
        await proLaboreApi.vendas.criar({
          data: dataIso,
          valorVenda: reg.valor,
          valorProLabore,
          vendedorId,
          valorComissao,
          observacao: reg.pendente ? 'Importado do histórico — pagamento pendente' : 'Importado do histórico',
        })
        resultados.push({ linha: rotulo, ok: true })
      } catch (err) {
        resultados.push({ linha: rotulo, ok: false, erro: err instanceof Error ? err.message : 'Erro desconhecido' })
      }
    }

    setResultadosImportacao(resultados)
    setImportando(false)
    carregar()
  }

  // Lê os componentes da data direto da string ISO (ano-mês-dia), sem passar
  // por new Date(...).toLocaleDateString() — isso evita reconverter pro fuso
  // horário do navegador, que pode exibir o dia anterior (ex: a virada de mês)
  // dependendo de onde a pessoa está.
  function formatData(iso: string) {
    const [ano, mes, dia] = iso.slice(0, 10).split('-')
    return `${dia}/${mes}/${ano}`
  }

  if (!isDono) {
    return (
      <div className="pl-empty pl-card">
        <div className="pl-emoji">🔒</div>
        <h3 style={{ margin: 0, color: 'var(--pl-ink-1)', fontWeight: 600 }}>Área restrita ao dono da operação</h3>
        <p style={{ marginTop: 6 }}>O cadastro de vendas é feito só pelo dono. Use o Dashboard e o Leads pra acompanhar seu trabalho.</p>
      </div>
    )
  }

  const tetoComissaoAtual = form.vendedorId ? tetoComissao(form.vendedorId) : null
  const vendaEditada = editandoId ? vendas.find(v => v.id === editandoId) : undefined
  const comissaoTravada = !!vendaEditada?.pagamentoComissao

  // Resumo das comissões (sempre sobre todas as vendas, sem os filtros).
  const aPagar = vendas.filter(v => temComissao(v) && !v.pagamentoComissao)
  const totalAPagar = aPagar.reduce((s, v) => s + (v.valorComissao ?? 0), 0)
  const totalPago = vendas.filter(v => v.pagamentoComissao).reduce((s, v) => s + (v.valorComissao ?? 0), 0)
  const aPagarPorVendedor = [...aPagar.reduce((m, v) => {
    const k = v.vendedorId!
    const g = m.get(k) ?? { id: k, nome: v.vendedor?.nome ?? '—', vendas: [] as Venda[], total: 0 }
    g.vendas.push(v); g.total += v.valorComissao ?? 0
    return m.set(k, g)
  }, new Map<string, { id: string; nome: string; vendas: Venda[]; total: number }>()).values()].sort((a, b) => b.total - a.total)

  const visiveis = vendas.filter(v =>
    (!filtroVendedor || v.vendedorId === filtroVendedor) &&
    (filtroComissao === 'todas' || (filtroComissao === 'pagas' ? !!v.pagamentoComissao : temComissao(v) && !v.pagamentoComissao)))
  const selecionadasPagaveis = vendas.filter(v => selecionadas.has(v.id) && temComissao(v) && !v.pagamentoComissao).length

  return (
    <div>
      <PageHeader eyebrow="Vendas" title="Registro de vendas" subtitle={`Cada venda define seu pró-labore (teto: ${formatMoeda(tetoProLabore)}) e, quando tem vendedor, a comissão dele`} />

      <form onSubmit={handleSubmit} className="pl-card" style={{ marginBottom: 20 }}>
        <div className="pl-card-title" style={{ marginBottom: 14 }}>{editandoId ? 'Editar venda' : 'Nova venda'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
          <div className="pl-field">
            <label>Data da venda</label>
            <input type="date" className="pl-input" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} required disabled={!!editandoId} />
          </div>
          <div className="pl-field">
            <label>Valor da venda (R$)</label>
            <input type="number" step="0.01" min="0" className="pl-input" value={form.valorVenda} onChange={e => atualizarValorVenda(e.target.value)} placeholder="0,00" required />
          </div>
          <div className="pl-field">
            <label>Pró-labore sacado (R$)</label>
            <input type="number" step="0.01" min="0" max={tetoProLabore} className="pl-input" value={form.valorProLabore} onChange={e => setForm(f => ({ ...f, valorProLabore: e.target.value }))} placeholder="0,00" required />
            <span className="pl-hint">Máximo {formatMoeda(tetoProLabore)}</span>
          </div>
          <div className="pl-field">
            <label>Vendedor (opcional)</label>
            <select className="pl-select" value={form.vendedorId} onChange={e => selecionarVendedor(e.target.value)} disabled={comissaoTravada}>
              <option value="">— Sem vendedor —</option>
              {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
            </select>
          </div>
          {form.vendedorId && (
            <div className="pl-field">
              <label>Comissão do vendedor (R$)</label>
              <input type="number" step="0.01" min="0" max={tetoComissaoAtual ?? undefined} className="pl-input" value={form.valorComissao} onChange={e => setForm(f => ({ ...f, valorComissao: e.target.value }))} placeholder="0,00" disabled={comissaoTravada} />
              <span className="pl-hint">{comissaoTravada ? `Já paga (comprovante nº ${vendaEditada!.pagamentoComissao!.numero}). Desmarque na tabela pra mudar.` : `Máximo ${formatMoeda(tetoComissaoAtual ?? 0)}`}</span>
            </div>
          )}
          <div className="pl-field">
            <label>Observação (opcional)</label>
            <input type="text" className="pl-input" value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Ex: cliente / modelo" />
          </div>
        </div>

        {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 14 }}>{erro}</div>}

        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button type="submit" className="pl-btn pl-btn-primary" disabled={salvando}>{salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Registrar venda'}</button>
          {editandoId && <button type="button" className="pl-btn pl-btn-ghost" onClick={cancelarEdicao}>Cancelar</button>}
        </div>
      </form>

      <div className="pl-card" style={{ marginBottom: 20 }}>
        <div className="pl-card-head" style={{ marginBottom: importAberto ? 14 : 0 }}>
          <div>
            <div className="pl-card-title">Importação em lote</div>
            <div className="pl-card-sub">Cole vendas copiadas de outra planilha/sistema (uma por linha: Mês, Vendedor, Valor, Status)</div>
          </div>
          <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setImportAberto(a => !a)}>
            {importAberto ? 'Fechar' : 'Importar em lote'}
          </button>
        </div>

        {importAberto && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="pl-import-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 140px 160px', gap: 14 }}>
              <div className="pl-field">
                <label>Dados colados (uma venda por linha)</label>
                <textarea
                  className="pl-input"
                  rows={8}
                  style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5 }}
                  value={textoImportacao}
                  onChange={e => setTextoImportacao(e.target.value)}
                  placeholder={'Jan\tWanderson\tR$ 23.900,00\t✅ Importado\nJan\tNaiza\tR$ 20.000,00\t✅ Importado'}
                />
                <span className="pl-hint">Só o mês é usado (sem ano) — o ano vem do campo ao lado. Vendedores novos são cadastrados automaticamente. Pró-labore ({formatMoeda(tetoProLabore)}) e comissão são aplicados no valor fixo definido ao lado pra cada linha — edite a venda depois se precisar de um valor diferente.</span>
              </div>
              <div className="pl-field">
                <label>Ano dos dados</label>
                <input type="number" className="pl-input" value={anoImportacao} onChange={e => setAnoImportacao(e.target.value)} />
              </div>
              <div className="pl-field">
                <label>Comissão por venda (R$)</label>
                <input type="number" step="0.01" min="0" className="pl-input" value={comissaoImportacao} onChange={e => setComissaoImportacao(e.target.value)} />
              </div>
            </div>
            <div>
              <button type="button" className="pl-btn pl-btn-primary" disabled={importando || !textoImportacao.trim()} onClick={processarImportacao}>
                {importando ? 'Importando...' : 'Processar e importar'}
              </button>
            </div>

            {resultadosImportacao.length > 0 && (
              <div className="pl-table-wrap">
                <table className="pl-table">
                  <thead>
                    <tr>
                      <th>Registro</th>
                      <th>Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultadosImportacao.map((r, i) => (
                      <tr key={i}>
                        <td>{r.linha}</td>
                        <td>
                          {r.ok
                            ? <span className="pl-delta up" style={{ display: 'inline-flex' }}>Importado</span>
                            : <span className="pl-delta down" style={{ display: 'inline-flex' }} title={r.erro}>Falhou{r.erro ? `: ${r.erro}` : ''}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ color: 'var(--pl-ink-muted)', fontSize: 13 }}>Carregando...</div>
      ) : vendas.length === 0 ? (
        <div className="pl-empty pl-card">
          <div className="pl-emoji">🏍️</div>
          <h3 style={{ margin: 0, color: 'var(--pl-ink-1)', fontWeight: 600 }}>Nenhuma venda ainda</h3>
          <p style={{ marginTop: 6 }}>Registre a primeira venda acima para começar a acompanhar seu pró-labore</p>
        </div>
      ) : (
        <div>
          <div className="pl-card pl-cms-resumo">
            <div className="pl-cms-totais">
              <div>
                <small>Comissões a pagar</small>
                <b className="pl-cms-apagar">{formatMoeda(totalAPagar)}</b>
                <span>{aPagar.length ? `${aPagar.length} venda${aPagar.length > 1 ? 's' : ''}` : 'tudo pago'}</span>
              </div>
              <div>
                <small>Comissões pagas</small>
                <b>{formatMoeda(totalPago)}</b>
                <span>com comprovante registrado</span>
              </div>
            </div>
            {aPagarPorVendedor.length > 0 && (
              <ul className="pl-cms-vendedores" aria-label="Comissões a pagar por vendedor">
                {aPagarPorVendedor.map(g => (
                  <li key={g.id}>
                    <span><b>{g.nome}</b><small>{g.vendas.length} venda{g.vendas.length > 1 ? 's' : ''} · {formatMoeda(g.total)}</small></span>
                    <button type="button" className="pl-btn pl-btn-ghost pl-cms-pagar" onClick={() => { setErroComissao(''); setPagando(g.vendas) }}>Pagar tudo</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="pl-cms-filtros">
            <div className="pl-cms-abas" role="group" aria-label="Filtrar pela comissão">
              {([['todas', 'Todas'], ['apagar', 'Comissão a pagar'], ['pagas', 'Comissão paga']] as const).map(([k, r]) => (
                <button key={k} type="button" className={filtroComissao === k ? 'ativo' : ''} aria-pressed={filtroComissao === k} onClick={() => setFiltroComissao(k)}>{r}</button>
              ))}
            </div>
            <select className="pl-select pl-cms-vendedor" value={filtroVendedor} onChange={e => setFiltroVendedor(e.target.value)} aria-label="Filtrar por vendedor">
              <option value="">Todos os vendedores</option>
              {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
            </select>
          </div>
          {erroComissao && <div className="pl-alert pl-alert-error" style={{ marginBottom: 12 }}>{erroComissao}</div>}

          {selecionadas.size > 0 && (
            <div className="pl-card" style={{ marginBottom: 12, padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{selecionadas.size} venda{selecionadas.size > 1 ? 's' : ''} selecionada{selecionadas.size > 1 ? 's' : ''}</span>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setSelecionadas(new Set())}>Limpar seleção</button>
                {selecionadasPagaveis > 0 && (
                  <button type="button" className="pl-btn pl-btn-primary" onClick={pagarSelecionadas}>
                    Marcar {selecionadasPagaveis} comiss{selecionadasPagaveis > 1 ? 'ões' : 'ão'} como paga{selecionadasPagaveis > 1 ? 's' : ''}
                  </button>
                )}
                <button type="button" className="pl-btn pl-btn-primary" style={{ background: 'var(--pl-critical)' }} disabled={apagandoSelecao} onClick={apagarSelecionadas}>
                  {apagandoSelecao ? 'Apagando...' : 'Apagar selecionadas'}
                </button>
              </div>
            </div>
          )}
          <div className="pl-table-wrap">
            <table className="pl-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input type="checkbox" aria-label="Selecionar todas" checked={visiveis.length > 0 && visiveis.every(v => selecionadas.has(v.id))} onChange={toggleSelecaoTodas} style={{ accentColor: 'var(--pl-accent-3)' }} />
                  </th>
                  <th>Data</th>
                  <th>Vendedor</th>
                  <th className="pl-right">Valor da venda</th>
                  <th className="pl-right">Pró-labore sacado</th>
                  <th className="pl-right">Comissão</th>
                  <th>Comissão paga</th>
                  <th className="pl-right">Ficou no caixa</th>
                  <th>Observação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visiveis.length === 0 && (
                  <tr><td colSpan={10} className="pl-cms-vazio">Nenhuma venda com esse filtro.</td></tr>
                )}
                {visiveis.map(v => (
                  <tr key={v.id} style={selecionadas.has(v.id) ? { background: 'var(--pl-surface-2)' } : undefined}>
                    <td>
                      <input type="checkbox" checked={selecionadas.has(v.id)} onChange={() => toggleSelecao(v.id)} style={{ accentColor: 'var(--pl-accent-3)' }} />
                    </td>
                    <td>{formatData(v.data)}</td>
                    <td>{v.vendedor?.nome ?? '—'}</td>
                    <td className="pl-right">{formatMoeda(v.valorVenda)}</td>
                    <td className="pl-right" style={{ color: 'var(--pl-accent-3)', fontWeight: 700 }}>{formatMoeda(v.valorProLabore)}</td>
                    <td className="pl-right" style={{ color: 'var(--pl-accent-4)', fontWeight: 700 }}>{v.valorComissao != null ? formatMoeda(v.valorComissao) : '—'}</td>
                    <td className="pl-cms-celula">
                      {temComissao(v) ? (
                        <span className={`pl-cms-status ${v.pagamentoComissao ? 'paga' : ''}`}>
                          <label>
                            <input type="checkbox" checked={!!v.pagamentoComissao} disabled={desmarcando === v.id} onChange={() => alternarPaga(v)}
                              aria-label={v.pagamentoComissao ? `Comissão de ${v.vendedor?.nome ?? ''} paga — desmarcar` : `Marcar comissão de ${v.vendedor?.nome ?? ''} como paga`} />
                            <span>{v.pagamentoComissao ? `Paga em ${formatData(v.pagamentoComissao.pagoEm)}` : 'A pagar'}</span>
                          </label>
                          {v.pagamentoComissao && (
                            <button type="button" className="pl-link-action pl-cms-comprovante" onClick={() => abrirComprovante(v.pagamentoComissao!.id)}>
                              Comprovante nº {v.pagamentoComissao.numero}
                            </button>
                          )}
                        </span>
                      ) : <span className="pl-cms-sem">—</span>}
                    </td>
                    <td className="pl-right">{formatMoeda(v.valorVenda - v.valorProLabore - (v.valorComissao ?? 0))}</td>
                    <td>{v.observacao || '—'}</td>
                    <td className="pl-right" style={{ whiteSpace: 'nowrap' }}>
                      <span className="pl-link-action" onClick={() => editar(v)} style={{ marginRight: 14 }}>Editar</span>
                      <span className="pl-link-action pl-danger" onClick={() => remover(v.id)}>Remover</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pagando && pagando.length > 0 && (
        <RegistrarPagamento vendas={pagando} pagadorPadrao={usuario?.nome ?? ''} onFechar={() => setPagando(null)}
          onRegistrado={() => { setSelecionadas(new Set()); carregar() }} />
      )}
    </div>
  )
}
