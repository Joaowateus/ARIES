'use client'

// Recibo do Financeiro (salário, vale, bonificação, reembolso, investimento,
// custo ou outro gasto), pronto pra imprimir e assinar. Mesmo papel branco e
// mesma estrutura do comprovante de comissão; fica fora do layout do painel.
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { proLaboreApi, type ReciboFinanceiro } from '@/lib/proLaboreApi'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { formatMoeda } from '@/lib/format'
import { reaisPorExtenso } from '@/lib/porExtenso'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const FORMA: Record<string, string> = { PIX: 'Pix', DINHEIRO: 'dinheiro', TRANSFERENCIA: 'transferência bancária', BOLETO: 'boleto', CARTAO: 'cartão', OUTRO: 'outra forma' }
const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const dataLonga = (iso: string) => `${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`
const mesExtenso = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`

// "referente ao salário de outubro de 2026" / "referente ao custo: aluguel da loja"
function referente(r: ReciboFinanceiro) {
  const porMes = (r.categoria === 'SALARIO' || r.categoria === 'ADIANTAMENTO') && r.competencia
  if (porMes) {
    const automatico = r.descricao === `${r.categoria === 'SALARIO' ? 'Salário' : 'Adiantamento salarial'} de ${mesExtenso(r.competencia!)}`
    return `${r.categoriaInfo.referente} de ${mesExtenso(r.competencia!)}${automatico ? '' : ` (${r.descricao})`}`
  }
  return `${r.categoriaInfo.referente}: ${r.descricao}${r.competencia ? `, referência ${mesExtenso(r.competencia)}` : ''}`
}

function Via({ r, rotulo }: { r: ReciboFinanceiro; rotulo: string | null }) {
  const temDesconto = r.itens.some(i => i.desconto)
  const proventos = r.itens.filter(i => !i.desconto).reduce((s, i) => s + i.valor, 0)
  const descontos = r.itens.filter(i => i.desconto).reduce((s, i) => s + i.valor, 0)
  const equipe = r.categoriaInfo.equipe
  return (
    <section className="pl-recibo-folha">
      <header className="pl-recibo-topo">
        <div>
          <h1>{r.categoriaInfo.titulo}</h1>
          {rotulo && <span className="pl-recibo-via">{rotulo}</span>}
        </div>
        <div className="pl-recibo-num">
          <small>Nº</small>
          <b>{String(r.numero).padStart(4, '0')}</b>
        </div>
      </header>

      <div className="pl-recibo-valor">
        <small>Valor</small>
        <b>{formatMoeda(r.valorTotal)}</b>
      </div>

      <p className="pl-recibo-texto">
        Eu, <b>{r.favorecido}</b>{r.documento ? <>, CPF/CNPJ <b>{r.documento}</b></> : null}, declaro que recebi de <b>{r.pagador}</b> a importância
        de <b>{formatMoeda(r.valorTotal)}</b> (<i>{reaisPorExtenso(r.valorTotal)}</i>), referente {referente(r)},
        paga em {dataLonga(r.pagoEm)}{r.formaPagamento ? ` via ${FORMA[r.formaPagamento] ?? r.formaPagamento}` : ''}.
      </p>

      <table className="pl-recibo-tabela">
        <thead>
          {temDesconto
            ? <tr><th>Descrição</th><th className="dir">Proventos</th><th className="dir">Descontos</th></tr>
            : <tr><th>Descrição</th><th className="dir">Valor</th></tr>}
        </thead>
        <tbody>
          {r.itens.map((i, k) => (
            <tr key={k}>
              <td>{i.descricao}</td>
              {temDesconto
                ? <><td className="dir">{i.desconto ? '' : formatMoeda(i.valor)}</td><td className="dir">{i.desconto ? formatMoeda(i.valor) : ''}</td></>
                : <td className="dir">{formatMoeda(i.valor)}</td>}
            </tr>
          ))}
        </tbody>
        <tfoot>
          {temDesconto ? (
            <>
              <tr><td>Totais</td><td className="dir">{formatMoeda(proventos)}</td><td className="dir">{formatMoeda(descontos)}</td></tr>
              <tr><td colSpan={2}>Valor líquido recebido</td><td className="dir">{formatMoeda(r.valorTotal)}</td></tr>
            </>
          ) : <tr><td>Total</td><td className="dir">{formatMoeda(r.valorTotal)}</td></tr>}
        </tfoot>
      </table>

      {r.observacao && <p className="pl-recibo-obs"><b>Observação do pagamento:</b> {r.observacao}</p>}

      <p className="pl-recibo-texto">Por ser verdade, dou plena quitação do valor acima e firmo o presente recibo.</p>

      <p className="pl-recibo-local">______________________________, {dataLonga(r.pagoEm)}.</p>

      <div className="pl-recibo-assinaturas">
        <div>
          <span className="linha" />
          <b>{r.favorecido}</b>
          <small>{equipe ? 'Funcionário (quem recebe)' : 'Quem recebe (fornecedor / prestador)'}</small>
          {!r.documento && <small>CPF/CNPJ: ____________________________</small>}
        </div>
        <div>
          <span className="linha" />
          <b>{r.pagador}</b>
          <small>Pela empresa (quem paga)</small>
        </div>
      </div>

      <footer className="pl-recibo-rodape">Recibo de {r.categoriaInfo.rotulo.toLowerCase()} nº {r.numero} registrado no ARIES em {dataCurta(r.criadoEm)} · pagamento de {dataCurta(r.pagoEm)}</footer>
    </section>
  )
}

export default function ReciboFinanceiroPage() {
  const { id } = useParams<{ id: string }>()
  const { usuario, loading } = useProLaboreAuth()
  const [r, setR] = useState<ReciboFinanceiro | null>(null)
  const [erro, setErro] = useState('')
  const [duasVias, setDuasVias] = useState(true)

  useEffect(() => {
    if (loading || !usuario) return
    let cancelado = false
    proLaboreApi.financeiro.recibo(id)
      .then(x => { if (!cancelado) setR(x) })
      .catch(e => { if (!cancelado) setErro(e instanceof Error ? e.message : 'Não deu pra abrir o recibo') })
    return () => { cancelado = true }
  }, [id, loading, usuario])

  useEffect(() => {
    if (r) document.title = `Recibo nº ${r.numero} — ${r.favorecido}`
  }, [r])

  const aviso = !loading && !usuario ? 'Entre no sistema pra ver o recibo.' : erro
  return (
    <div className="pl-recibo-pagina">
      <div className="pl-recibo-barra">
        <Link href="/pro-labore/financeiro" className="pl-recibo-voltar">← Voltar pro Financeiro</Link>
        {r && !r.canceladoEm && (
          <div className="pl-recibo-barra-acoes">
            <label><input type="checkbox" checked={duasVias} onChange={e => setDuasVias(e.target.checked)} /> Duas vias (empresa e quem recebe)</label>
            <button type="button" onClick={() => window.print()}>Imprimir</button>
          </div>
        )}
      </div>
      {aviso ? <p className="pl-recibo-aviso">{aviso}</p> : !r ? <p className="pl-recibo-aviso">Carregando…</p> : r.canceladoEm ? (
        <p className="pl-recibo-aviso pl-recibo-cancelado">
          <b>Recibo nº {r.numero} cancelado</b> em {dataCurta(r.canceladoEm)}: o pagamento de {formatMoeda(r.valorTotal)} a {r.favorecido} ({r.descricao}) foi desfeito no Financeiro.
          Se ele já tinha sido impresso, descarte a via em papel.
        </p>
      ) : duasVias ? (
        <>
          <Via r={r} rotulo="1ª via — empresa" />
          <Via r={r} rotulo="2ª via — quem recebe" />
        </>
      ) : <Via r={r} rotulo={null} />}
    </div>
  )
}
