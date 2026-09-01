'use client'

import { useEffect, useState, useCallback } from 'react'
import { proLaboreApi, Venda, ParametroLiquidez, Vendedor } from '@/lib/proLaboreApi'
import { formatMoeda } from '@/lib/format'

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

export default function ProLaboreVendasPage() {
  const [vendas, setVendas] = useState<Venda[]>([])
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [parametro, setParametro] = useState<ParametroLiquidez | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const [form, setForm] = useState({ data: '', valorVenda: '', valorProLabore: '', vendedorId: '', observacao: '' })

  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [apagandoSelecao, setApagandoSelecao] = useState(false)

  const [importAberto, setImportAberto] = useState(false)
  const [textoImportacao, setTextoImportacao] = useState('')
  const [anoImportacao, setAnoImportacao] = useState('2026')
  const [importando, setImportando] = useState(false)
  const [resultadosImportacao, setResultadosImportacao] = useState<ResultadoImportacao[]>([])

  const carregar = useCallback(() => {
    Promise.all([proLaboreApi.vendas.listar(), proLaboreApi.parametros.get(), proLaboreApi.vendedores.listar()])
      .then(([v, p, ven]) => { setVendas(v); setParametro(p); setVendedores(ven) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  function atualizarValorVenda(valor: string) {
    const numero = Number(valor)
    const teto = parametro?.tetoProLaborePorVenda ?? 900
    const sugestao = Number.isFinite(numero) && numero > 0 ? Math.min(numero, teto) : teto
    setForm(f => ({ ...f, valorVenda: valor, valorProLabore: editandoId ? f.valorProLabore : String(sugestao) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      const valorVenda = Number(form.valorVenda)
      const valorProLabore = Number(form.valorProLabore)
      const vendedorId = form.vendedorId || undefined
      if (editandoId) {
        await proLaboreApi.vendas.editar(editandoId, { valorVenda, valorProLabore, vendedorId: form.vendedorId || null, observacao: form.observacao || undefined })
      } else {
        await proLaboreApi.vendas.criar({ data: form.data, valorVenda, valorProLabore, vendedorId, observacao: form.observacao || undefined })
      }
      setForm({ data: '', valorVenda: '', valorProLabore: '', vendedorId: '', observacao: '' })
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
      observacao: v.observacao ?? '',
    })
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setForm({ data: '', valorVenda: '', valorProLabore: '', vendedorId: '', observacao: '' })
  }

  async function remover(id: string) {
    if (!confirm('Remover esta venda?')) return
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
    setSelecionadas(atual => (atual.size === vendas.length ? new Set() : new Set(vendas.map(v => v.id))))
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

    const teto = parametro?.tetoProLaborePorVenda ?? 900
    const contadorPorMes = new Map<number, number>()
    const resultados: ResultadoImportacao[] = []

    for (const reg of registros) {
      const ocorrencia = (contadorPorMes.get(reg.mesIdx) ?? 0) + 1
      contadorPorMes.set(reg.mesIdx, ocorrencia)
      const diasNoMes = new Date(ano, reg.mesIdx + 1, 0).getDate()
      const dia = Math.min(ocorrencia, diasNoMes)
      const dataIso = `${ano}-${String(reg.mesIdx + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
      const valorProLabore = Math.min(teto, reg.valor)
      const rotulo = `${reg.mes} · ${reg.vendedor} · ${formatMoeda(reg.valor)}`
      try {
        await proLaboreApi.vendas.criar({
          data: dataIso,
          valorVenda: reg.valor,
          valorProLabore,
          vendedorId: mapaVendedores.get(reg.vendedor.toLowerCase()),
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

  const teto = parametro?.tetoProLaborePorVenda ?? 900

  return (
    <div>
      <div className="pl-section-head" style={{ marginTop: 0 }}>
        <div>
          <div className="pl-eyebrow">Vendas</div>
          <h2 className="pl-section-title">Registro de vendas</h2>
          <div className="pl-section-note" style={{ marginTop: 4 }}>Cada venda define quanto de pró-labore você sacou dela (teto: {formatMoeda(teto)})</div>
        </div>
      </div>

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
            <input type="number" step="0.01" min="0" max={teto} className="pl-input" value={form.valorProLabore} onChange={e => setForm(f => ({ ...f, valorProLabore: e.target.value }))} placeholder="0,00" required />
            <span className="pl-hint">Máximo {formatMoeda(teto)}</span>
          </div>
          <div className="pl-field">
            <label>Vendedor (opcional)</label>
            <select className="pl-select" value={form.vendedorId} onChange={e => setForm(f => ({ ...f, vendedorId: e.target.value }))}>
              <option value="">— Sem vendedor —</option>
              {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
            </select>
          </div>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 14 }}>
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
                <span className="pl-hint">Só o mês é usado (sem ano) — o ano vem do campo ao lado. Vendedores novos são cadastrados automaticamente.</span>
              </div>
              <div className="pl-field">
                <label>Ano dos dados</label>
                <input type="number" className="pl-input" value={anoImportacao} onChange={e => setAnoImportacao(e.target.value)} />
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
          {selecionadas.size > 0 && (
            <div className="pl-card" style={{ marginBottom: 12, padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{selecionadas.size} venda{selecionadas.size > 1 ? 's' : ''} selecionada{selecionadas.size > 1 ? 's' : ''}</span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setSelecionadas(new Set())}>Limpar seleção</button>
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
                    <input type="checkbox" checked={selecionadas.size === vendas.length} onChange={toggleSelecaoTodas} style={{ accentColor: 'var(--pl-accent-3)' }} />
                  </th>
                  <th>Data</th>
                  <th>Vendedor</th>
                  <th className="pl-right">Valor da venda</th>
                  <th className="pl-right">Pró-labore sacado</th>
                  <th className="pl-right">Ficou no caixa</th>
                  <th>Observação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {vendas.map(v => (
                  <tr key={v.id} style={selecionadas.has(v.id) ? { background: 'var(--pl-surface-2)' } : undefined}>
                    <td>
                      <input type="checkbox" checked={selecionadas.has(v.id)} onChange={() => toggleSelecao(v.id)} style={{ accentColor: 'var(--pl-accent-3)' }} />
                    </td>
                    <td>{formatData(v.data)}</td>
                    <td>{v.vendedor?.nome ?? '—'}</td>
                    <td className="pl-right">{formatMoeda(v.valorVenda)}</td>
                    <td className="pl-right" style={{ color: 'var(--pl-accent-3)', fontWeight: 700 }}>{formatMoeda(v.valorProLabore)}</td>
                    <td className="pl-right">{formatMoeda(v.valorVenda - v.valorProLabore)}</td>
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
    </div>
  )
}
