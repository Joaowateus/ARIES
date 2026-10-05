'use client'

// Comprovante de pagamento de comissão, pronto pra imprimir e assinar.
// Fica fora do layout do painel (sem menu lateral) e sempre em papel branco,
// independente do tema escolhido no sistema.
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { proLaboreApi, type ComprovanteComissao } from '@/lib/proLaboreApi'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { formatMoeda } from '@/lib/format'
import { reaisPorExtenso } from '@/lib/porExtenso'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const FORMA: Record<string, string> = { PIX: 'Pix', DINHEIRO: 'dinheiro', TRANSFERENCIA: 'transferência bancária', OUTRO: 'outra forma' }

// Datas vêm como ISO; lê dia/mês/ano direto da string pra não trocar de dia
// por causa do fuso do navegador.
const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const dataLonga = (iso: string) => `${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`

function descricao(v: ComprovanteComissao['vendas'][number]) {
  if (v.lead?.nomeCliente) return v.lead.nomeCliente
  return v.observacao?.replace(/^Convertido do lead:\s*/i, '') || '—'
}

function Via({ c, rotulo }: { c: ComprovanteComissao; rotulo: string | null }) {
  const total = c.vendas.reduce((s, v) => s + (v.valorComissao ?? 0), 0)
  return (
    <section className="pl-recibo-folha">
      <header className="pl-recibo-topo">
        <div>
          <h1>Recibo de pagamento de comissão</h1>
          {rotulo && <span className="pl-recibo-via">{rotulo}</span>}
        </div>
        <div className="pl-recibo-num">
          <small>Nº</small>
          <b>{String(c.numero).padStart(4, '0')}</b>
        </div>
      </header>

      <div className="pl-recibo-valor">
        <small>Valor</small>
        <b>{formatMoeda(total)}</b>
      </div>

      <p className="pl-recibo-texto">
        Eu, <b>{c.vendedor.nome}</b>, declaro que recebi de <b>{c.pagador}</b> a importância
        de <b>{formatMoeda(total)}</b> (<i>{reaisPorExtenso(total)}</i>), referente à comissão
        sobre {c.vendas.length === 1 ? 'a venda listada' : `as ${c.vendas.length} vendas listadas`} abaixo,
        paga em {dataLonga(c.pagoEm)}{c.formaPagamento ? ` via ${FORMA[c.formaPagamento] ?? c.formaPagamento}` : ''}.
      </p>

      <table className="pl-recibo-tabela">
        <thead>
          <tr><th>Data da venda</th><th>Cliente / descrição</th><th className="dir">Valor da venda</th><th className="dir">Comissão</th></tr>
        </thead>
        <tbody>
          {c.vendas.map(v => (
            <tr key={v.id}>
              <td>{dataCurta(v.data)}</td>
              <td>{descricao(v)}</td>
              <td className="dir">{formatMoeda(v.valorVenda)}</td>
              <td className="dir">{formatMoeda(v.valorComissao ?? 0)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td colSpan={3}>Total da comissão</td><td className="dir">{formatMoeda(total)}</td></tr>
        </tfoot>
      </table>

      {c.observacao && <p className="pl-recibo-obs"><b>Observação:</b> {c.observacao}</p>}

      <p className="pl-recibo-texto">Por ser verdade, dou plena quitação do valor acima e firmo o presente recibo.</p>

      <p className="pl-recibo-local">______________________________, {dataLonga(c.pagoEm)}.</p>

      <div className="pl-recibo-assinaturas">
        <div>
          <span className="linha" />
          <b>{c.vendedor.nome}</b>
          <small>Vendedor (quem recebe)</small>
          <small>CPF: ____________________________</small>
        </div>
        <div>
          <span className="linha" />
          <b>{c.pagador}</b>
          <small>Quem paga</small>
        </div>
      </div>

      <footer className="pl-recibo-rodape">Comprovante nº {c.numero} registrado no ARIES em {dataCurta(c.criadoEm)} · pagamento de {dataCurta(c.pagoEm)}</footer>
    </section>
  )
}

export default function ComprovantePage() {
  const { id } = useParams<{ id: string }>()
  const { usuario, loading } = useProLaboreAuth()
  const [c, setC] = useState<ComprovanteComissao | null>(null)
  const [erro, setErro] = useState('')
  const [duasVias, setDuasVias] = useState(true)

  useEffect(() => {
    if (loading || !usuario) return
    let cancelado = false
    proLaboreApi.comissoes.comprovante(id)
      .then(r => { if (!cancelado) setC(r) })
      .catch(e => { if (!cancelado) setErro(e instanceof Error ? e.message : 'Não deu pra abrir o comprovante') })
    return () => { cancelado = true }
  }, [id, loading, usuario])

  useEffect(() => {
    if (c) document.title = `Comprovante nº ${c.numero} — ${c.vendedor.nome}`
  }, [c])

  const aviso = !loading && !usuario ? 'Entre no sistema pra ver o comprovante.' : erro
  return (
    <div className="pl-recibo-pagina">
      <div className="pl-recibo-barra">
        <Link href="/pro-labore/vendas" className="pl-recibo-voltar">← Voltar pra Vendas</Link>
        {c && !c.canceladoEm && (
          <div className="pl-recibo-barra-acoes">
            <label><input type="checkbox" checked={duasVias} onChange={e => setDuasVias(e.target.checked)} /> Duas vias (empresa e vendedor)</label>
            <button type="button" onClick={() => window.print()}>Imprimir</button>
          </div>
        )}
      </div>
      {aviso ? <p className="pl-recibo-aviso">{aviso}</p> : !c ? <p className="pl-recibo-aviso">Carregando…</p> : c.canceladoEm ? (
        <p className="pl-recibo-aviso pl-recibo-cancelado">
          <b>Comprovante nº {c.numero} cancelado</b> em {dataCurta(c.canceladoEm)}: as comissões de {c.vendedor.nome} que estavam nele
          foram desmarcadas e voltaram pra &quot;a pagar&quot;. Se ele já tinha sido impresso, descarte a via em papel.
        </p>
      ) : duasVias ? (
        <>
          <Via c={c} rotulo="1ª via — empresa" />
          <Via c={c} rotulo="2ª via — vendedor" />
        </>
      ) : <Via c={c} rotulo={null} />}
    </div>
  )
}
