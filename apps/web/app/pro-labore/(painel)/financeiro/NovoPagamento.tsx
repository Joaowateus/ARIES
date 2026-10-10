'use client'

// Um pagamento avulso do Financeiro: salário, vale, bonificação, reembolso,
// investimento, custo ou outro gasto. As linhas viram a tabela do recibo
// (descontos abatem do total, como INSS ou um vale no salário).
import { useState } from 'react'
import { proLaboreApi, type CategoriaFinanceira, type FormaPagamentoFinanceiro, type LancamentoFinanceiro, type PainelFinanceiro } from '@/lib/proLaboreApi'
import { formatMoeda } from '@/lib/format'
import { abrirRecibo, hojeLocal, lerValor, mesExtenso, ROTULO_FORMA } from './util'

const EXEMPLO: Record<CategoriaFinanceira, string> = {
  SALARIO: 'Em branco: "Salário de" + o mês de referência',
  ADIANTAMENTO: 'Em branco: "Adiantamento salarial de" + o mês',
  BONIFICACAO: 'Ex.: meta de vendas batida em setembro',
  REEMBOLSO: 'Ex.: combustível da entrega do cliente',
  INVESTIMENTO: 'Ex.: compra do elevador hidráulico da oficina',
  CUSTO: 'Ex.: aluguel da loja de outubro',
  OUTRO: 'Ex.: confraternização da equipe',
}

interface Linha { descricao: string; valor: string; desconto: boolean }

export function NovoPagamento({ dados, nomeDono, onFechar, onRegistrado }: {
  dados: PainelFinanceiro
  nomeDono: string
  onFechar: () => void
  onRegistrado: () => void
}) {
  const [categoria, setCategoria] = useState<CategoriaFinanceira>('CUSTO')
  const info = dados.categorias.find(c => c.chave === categoria)!
  const [pessoaId, setPessoaId] = useState('')
  const [favorecido, setFavorecido] = useState('')
  const [documento, setDocumento] = useState('')
  const [competencia, setCompetencia] = useState(dados.mes)
  const [descricao, setDescricao] = useState('')
  const [linhas, setLinhas] = useState<Linha[]>([{ descricao: '', valor: '', desconto: false }])
  const [pagoEm, setPagoEm] = useState(hojeLocal)
  const [forma, setForma] = useState<FormaPagamentoFinanceiro>('PIX')
  const [pagador, setPagador] = useState(dados.pagador || nomeDono)
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState<LancamentoFinanceiro | null>(null)

  const pessoa = dados.equipe.find(p => p.id === pessoaId)
  const daEquipe = info.equipe && pessoaId !== '' && pessoaId !== 'outra'
  const total = linhas.reduce((s, l) => s + (l.desconto ? -1 : 1) * lerValor(l.valor), 0)

  function escolherCategoria(c: CategoriaFinanceira) {
    setCategoria(c)
    const nova = dados.categorias.find(x => x.chave === c)!
    if (!nova.equipe) setPessoaId('')
    if (c === 'SALARIO' && linhas.length === 1 && !linhas[0].valor) setLinhas([{ descricao: 'Salário base', valor: pessoa?.salarioBase ? String(pessoa.salarioBase) : '', desconto: false }])
  }
  function escolherPessoa(id: string) {
    setPessoaId(id)
    const p = dados.equipe.find(x => x.id === id)
    if (categoria === 'SALARIO' && p?.salarioBase && linhas.length === 1 && !linhas[0].valor) setLinhas([{ descricao: linhas[0].descricao || 'Salário base', valor: String(p.salarioBase), desconto: false }])
  }
  const mudarLinha = (i: number, m: Partial<Linha>) => setLinhas(ls => ls.map((l, j) => (j === i ? { ...l, ...m } : l)))

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    const ref = descricao.trim()
    const itens = linhas
      .filter(l => lerValor(l.valor) > 0)
      .map(l => ({ descricao: l.descricao.trim() || ref || info.rotulo, valor: Math.round(lerValor(l.valor) * 100) / 100, desconto: l.desconto }))
    if (!itens.length) { setErro('Informe o valor do pagamento.'); return }
    setSalvando(true)
    try {
      const r = await proLaboreApi.financeiro.criar({
        categoria,
        vendedorId: daEquipe ? pessoaId : null,
        favorecido: daEquipe ? null : favorecido.trim(),
        documento: documento.trim() || null,
        descricao: ref || null,
        competencia: info.equipe ? competencia : null,
        itens, pagoEm, formaPagamento: forma, pagador: pagador.trim(), observacao: observacao.trim() || null,
      })
      setFeito(r)
      onRegistrado()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não deu pra registrar o pagamento')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="pl-modal-backdrop" onClick={onFechar}>
      <div className="pl-card pl-modal-panel pl-fin-modal" role="dialog" aria-modal="true" aria-labelledby="fin-novo-titulo" onClick={e => e.stopPropagation()}>
        {feito ? (
          <>
            <div className="pl-card-title" id="fin-novo-titulo">Pagamento registrado</div>
            <div className="pl-card-sub">Imprima o recibo e peça para quem recebeu assinar.</div>
            <ul className="pl-pgc-lista">
              <li>
                <span><b>{feito.favorecido}</b><small>{info.rotulo} · recibo nº {feito.numero}</small></span>
                <b className="pl-pgc-valor">{formatMoeda(feito.valorTotal)}</b>
                <button type="button" className="pl-btn pl-btn-primary pl-pgc-btn" onClick={() => abrirRecibo(feito.id)}>Abrir recibo</button>
              </li>
            </ul>
            <div className="pl-pgc-acoes"><button type="button" className="pl-btn pl-btn-ghost" onClick={onFechar}>Fechar</button></div>
          </>
        ) : (
          <form onSubmit={confirmar}>
            <div className="pl-card-title" id="fin-novo-titulo">Novo pagamento</div>
            <div className="pl-card-sub">Gera um recibo numerado, pronto para imprimir e assinar.</div>

            <div className="pl-fin-cats" role="group" aria-label="Tipo de pagamento">
              {dados.categorias.map(c => (
                <button key={c.chave} type="button" className={c.chave === categoria ? 'ativo' : undefined} aria-pressed={c.chave === categoria} onClick={() => escolherCategoria(c.chave)}>{c.rotulo}</button>
              ))}
            </div>

            <div className="pl-pgc-campos">
              {info.equipe && (
                <div className="pl-field pl-pgc-largo">
                  <label htmlFor="fin-pessoa">Quem recebe</label>
                  <select id="fin-pessoa" className="pl-select" value={pessoaId} onChange={e => escolherPessoa(e.target.value)} required>
                    <option value="" disabled>Escolha a pessoa da equipe</option>
                    {dados.equipe.map(p => <option key={p.id} value={p.id}>{p.nome}{p.salarioBase ? ` · salário ${formatMoeda(p.salarioBase)}` : ''}</option>)}
                    <option value="outra">Outra pessoa (fora da equipe)</option>
                  </select>
                </div>
              )}
              {(!info.equipe || pessoaId === 'outra') && (
                <>
                  <div className="pl-field">
                    <label htmlFor="fin-fav">{info.equipe ? 'Nome de quem recebe' : 'Quem recebe (fornecedor, empresa ou pessoa)'}</label>
                    <input id="fin-fav" className="pl-input" value={favorecido} onChange={e => setFavorecido(e.target.value)} maxLength={120} required />
                  </div>
                  <div className="pl-field">
                    <label htmlFor="fin-doc">CPF ou CNPJ (opcional)</label>
                    <input id="fin-doc" className="pl-input" value={documento} onChange={e => setDocumento(e.target.value)} maxLength={30} />
                  </div>
                </>
              )}
              {daEquipe && pessoa && (
                <div className="pl-field">
                  <label htmlFor="fin-doc2">CPF (opcional)</label>
                  <input id="fin-doc2" className="pl-input" value={documento} onChange={e => setDocumento(e.target.value)} maxLength={30} />
                </div>
              )}
              {info.equipe && (
                <div className="pl-field">
                  <label htmlFor="fin-comp">Mês de referência</label>
                  <input id="fin-comp" type="month" className="pl-input" value={competencia} onChange={e => setCompetencia(e.target.value)} required />
                </div>
              )}
              <div className="pl-field pl-pgc-largo">
                <label htmlFor="fin-ref">Referente a{categoria === 'SALARIO' || categoria === 'ADIANTAMENTO' ? ' (opcional)' : ''}</label>
                <input id="fin-ref" className="pl-input" value={descricao} onChange={e => setDescricao(e.target.value)} maxLength={200} placeholder={EXEMPLO[categoria]}
                  required={categoria !== 'SALARIO' && categoria !== 'ADIANTAMENTO'} />
                {(categoria === 'SALARIO' || categoria === 'ADIANTAMENTO') && competencia && !descricao && <span className="pl-hint">Sai no recibo: {categoria === 'SALARIO' ? 'Salário' : 'Adiantamento salarial'} de {mesExtenso(competencia)}</span>}
              </div>
            </div>

            <div className="pl-fin-linhas">
              <div className="pl-fin-linhas-cab"><span>Linhas do recibo</span><span>Valor (R$)</span></div>
              {linhas.map((l, i) => (
                <div key={i} className="pl-fin-linha">
                  <input className="pl-input" aria-label={`Descrição da linha ${i + 1}`} value={l.descricao} onChange={e => mudarLinha(i, { descricao: e.target.value })} maxLength={120}
                    placeholder={i === 0 ? (categoria === 'SALARIO' ? 'Salário base' : 'Descrição (opcional)') : 'Ex.: INSS, vale descontado, hora extra'} />
                  <input className="pl-input pl-fin-valor" aria-label={`Valor da linha ${i + 1}`} inputMode="decimal" value={l.valor} onChange={e => mudarLinha(i, { valor: e.target.value })} placeholder="0,00" />
                  <label className="pl-fin-desc"><input type="checkbox" checked={l.desconto} onChange={e => mudarLinha(i, { desconto: e.target.checked })} /> Desconto</label>
                  {linhas.length > 1 && <button type="button" className="pl-fin-tirar" aria-label={`Tirar a linha ${i + 1}`} onClick={() => setLinhas(ls => ls.filter((_, j) => j !== i))}>×</button>}
                </div>
              ))}
              <div className="pl-fin-linhas-pe">
                <button type="button" className="pl-link-action" onClick={() => setLinhas(ls => [...ls, { descricao: '', valor: '', desconto: false }])}>+ Adicionar linha</button>
                <span>Total a pagar <b>{formatMoeda(Math.max(0, total))}</b></span>
              </div>
            </div>

            <div className="pl-pgc-campos">
              <div className="pl-field">
                <label htmlFor="fin-data">Data do pagamento</label>
                <input id="fin-data" type="date" className="pl-input" value={pagoEm} onChange={e => setPagoEm(e.target.value)} required />
              </div>
              <div className="pl-field">
                <label htmlFor="fin-forma">Forma de pagamento</label>
                <select id="fin-forma" className="pl-select" value={forma} onChange={e => setForma(e.target.value as FormaPagamentoFinanceiro)}>
                  {dados.formas.map(f => <option key={f} value={f}>{ROTULO_FORMA[f]}</option>)}
                </select>
              </div>
              <div className="pl-field pl-pgc-largo">
                <label htmlFor="fin-pagador">Quem paga: nome da empresa (sai no recibo)</label>
                <input id="fin-pagador" className="pl-input" value={pagador} onChange={e => setPagador(e.target.value)} maxLength={120} required placeholder="Ex.: Minha Empresa LTDA" />
              </div>
              <div className="pl-field pl-pgc-largo">
                <label htmlFor="fin-obs">Observação (opcional)</label>
                <input id="fin-obs" className="pl-input" value={observacao} onChange={e => setObservacao(e.target.value)} maxLength={500} />
              </div>
            </div>
            {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 12 }}>{erro}</div>}
            <div className="pl-pgc-acoes">
              <button type="button" className="pl-btn pl-btn-ghost" onClick={onFechar}>Cancelar</button>
              <button type="submit" className="pl-btn pl-btn-primary" disabled={salvando || total <= 0}>{salvando ? 'Registrando…' : `Registrar ${formatMoeda(Math.max(0, total))}`}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
