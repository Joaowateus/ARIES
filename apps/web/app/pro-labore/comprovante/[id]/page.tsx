'use client'

// Comprovante de pagamento (comissão do vendedor ou retirada do pró-labore
// do dono), pronto pra imprimir e assinar.
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

// Cliente da venda: o lead convertido, ou o nome que a observação padrão
// de conversão ("Convertido do lead: X") carrega.
function cliente(v: ComprovanteComissao['vendas'][number]) {
  if (v.lead?.nomeCliente) return v.lead.nomeCliente
  return v.observacao?.match(/^Convertido do lead:\s*(.+)$/i)?.[1] ?? '—'
}

// Textos que mudam entre o comprovante de comissão e o recibo de pró-labore.
function textos(c: ComprovanteComissao) {
  const proLabore = c.tipo === 'PROLABORE'
  const recebedor = (proLabore ? c.recebedor : c.vendedor?.nome) ?? '—'
  return {
    proLabore,
    recebedor,
    titulo: proLabore ? 'Recibo de retirada de pró-labore' : 'Recibo de pagamento de comissão',
    doc: proLabore ? 'Recibo' : 'Comprovante',
    referente: proLabore ? 'à retirada de pró-labore' : 'à comissão',
    coluna: proLabore ? 'Pró-labore' : 'Comissão',
    total: proLabore ? 'Total do pró-labore' : 'Total da comissão',
    papelRecebedor: proLabore ? 'Quem recebe (sócio / titular)' : 'Vendedor (quem recebe)',
    papelPagador: proLabore ? 'Pela empresa (quem paga)' : 'Quem paga',
    via2: proLabore ? '2ª via — sócio' : '2ª via — vendedor',
  }
}

function Via({ c, rotulo }: { c: ComprovanteComissao; rotulo: string | null }) {
  const t = textos(c)
  const total = c.vendas.reduce((s, v) => s + v.valor, 0)
  return (
    <section className="pl-recibo-folha">
      <header className="pl-recibo-topo">
        <div>
          <h1>{t.titulo}</h1>
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
        Eu, <b>{t.recebedor}</b>, declaro que recebi de <b>{c.pagador}</b> a importância
        de <b>{formatMoeda(total)}</b> (<i>{reaisPorExtenso(total)}</i>), referente {t.referente}{' '}
        sobre {c.vendas.length === 1 ? 'a venda listada' : `as ${c.vendas.length} vendas listadas`} abaixo,
        paga em {dataLonga(c.pagoEm)}{c.formaPagamento ? ` via ${FORMA[c.formaPagamento] ?? c.formaPagamento}` : ''}.
      </p>

      <table className="pl-recibo-tabela">
        <thead>
          <tr><th>Data da venda</th><th>Cliente</th><th className="obs">Observação</th><th className="dir">Valor da venda</th><th className="dir">{t.coluna}</th></tr>
        </thead>
        <tbody>
          {c.vendas.map(v => (
            <tr key={v.id}>
              <td>{dataCurta(v.data)}</td>
              <td>{cliente(v)}</td>
              <td className="obs">{v.observacao || '—'}</td>
              <td className="dir">{formatMoeda(v.valorVenda)}</td>
              <td className="dir">{formatMoeda(v.valor)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td colSpan={4}>{t.total}</td><td className="dir">{formatMoeda(total)}</td></tr>
        </tfoot>
      </table>

      {c.observacao && <p className="pl-recibo-obs"><b>Observação do pagamento:</b> {c.observacao}</p>}

      <p className="pl-recibo-texto">Por ser verdade, dou plena quitação do valor acima e firmo o presente recibo.</p>

      <p className="pl-recibo-local">______________________________, {dataLonga(c.pagoEm)}.</p>

      <div className="pl-recibo-assinaturas">
        <div>
          <span className="linha" />
          <b>{t.recebedor}</b>
          <small>{t.papelRecebedor}</small>
          <small>CPF: ____________________________</small>
        </div>
        <div>
          <span className="linha" />
          <b>{c.pagador}</b>
          <small>{t.papelPagador}</small>
        </div>
      </div>

      <footer className="pl-recibo-rodape">{t.doc} nº {c.numero} registrado no ARIES em {dataCurta(c.criadoEm)} · pagamento de {dataCurta(c.pagoEm)}</footer>
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
    proLaboreApi.pagamentosVendas.comprovante(id)
      .then(r => { if (!cancelado) setC(r) })
      .catch(e => { if (!cancelado) setErro(e instanceof Error ? e.message : 'Não deu pra abrir o comprovante') })
    return () => { cancelado = true }
  }, [id, loading, usuario])

  useEffect(() => {
    if (c) { const t = textos(c); document.title = `${t.doc} nº ${c.numero} — ${t.recebedor}` }
  }, [c])

  const aviso = !loading && !usuario ? 'Entre no sistema pra ver o comprovante.' : erro
  const t = c ? textos(c) : null
  return (
    <div className="pl-recibo-pagina">
      <div className="pl-recibo-barra">
        <Link href="/pro-labore/vendas" className="pl-recibo-voltar">← Voltar pra Vendas</Link>
        {c && !c.canceladoEm && (
          <div className="pl-recibo-barra-acoes">
            <label><input type="checkbox" checked={duasVias} onChange={e => setDuasVias(e.target.checked)} /> Duas vias (empresa e {t?.proLabore ? 'sócio' : 'vendedor'})</label>
            <button type="button" onClick={() => window.print()}>Imprimir</button>
          </div>
        )}
      </div>
      {aviso ? <p className="pl-recibo-aviso">{aviso}</p> : !c ? <p className="pl-recibo-aviso">Carregando…</p> : c.canceladoEm ? (
        <p className="pl-recibo-aviso pl-recibo-cancelado">
          <b>{t!.doc} nº {c.numero} cancelado</b> em {dataCurta(c.canceladoEm)}: {t!.proLabore ? 'os pró-labores' : `as comissões de ${t!.recebedor}`} que estavam nele
          foram desmarcados e voltaram pra &quot;a pagar&quot;. Se ele já tinha sido impresso, descarte a via em papel.
        </p>
      ) : duasVias ? (
        <>
          <Via c={c} rotulo="1ª via — empresa" />
          <Via c={c} rotulo={t!.via2} />
        </>
      ) : <Via c={c} rotulo={null} />}
    </div>
  )
}
