'use client'

// PDF 04 · O Social Media mantém o Hoje do seu espaço próprio, com os três
// números e a Lente do ARIES acrescentados (só na versão nova das telas).
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { telasApi, type Lente, type NumeroHoje } from '@/lib/proLaboreApi'
import { StatusChip, fmtValor, subDoNumero } from '../../(painel)/_padrao/Padrao'

export function AriesNoSm() {
  const [d, setD] = useState<{ pergunta?: string; numeros?: NumeroHoje[]; lente?: Lente } | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)
  useEffect(() => { telasApi.smHoje().then(r => setD(r.ativo ? r : null)).catch(() => setD(null)) }, [])
  if (!d?.numeros) return null
  const n = d.numeros.find(x => x.chave === aberto)
  return (
    <section style={{ margin: '12px 0' }} data-aries-sm>
      <p style={{ margin: '0 0 8px', fontWeight: 600 }}>{d.pergunta}</p>
      <div className="ar-agora">
        {d.numeros.map(x => (
          <button key={x.chave} type="button" className="ar-numero" onClick={() => setAberto(a => (a === x.chave ? null : x.chave))} data-numero={x.chave}>
            <div className="ar-num-nome"><span>{x.nome}</span><StatusChip status={x.status} /></div>
            <div className="ar-num-valor">{x.naoDefinido ? '—' : fmtValor(x.valor, x.unidade)}</div>
            <div className="ar-num-sub">{x.naoDefinido ?? subDoNumero(x)}</div>
          </button>
        ))}
      </div>
      {n?.ficha && <div className="pl-card" style={{ marginBottom: 10, fontSize: '.85rem' }} data-ficha-metrica={n.chave}><b>{n.nome}</b>: {n.ficha.definicao}. <span className="pl-hint">Fórmula: {n.ficha.formula} · Fonte: {n.ficha.fonte}</span></div>}
      {d.lente && (
        <div className="ar-lente" style={{ position: 'static' }} data-lente="hoje">
          <div className="ar-lente-titulo"><span className="ar-marca" aria-hidden />Lente do ARIES</div>
          {d.lente.vazio ? <p style={{ margin: 0 }}>{d.lente.mensagem}</p> : d.lente.itens.slice(0, 3).map((it, i) => (
            <div className="ar-lente-item" key={i}>
              <p className="ar-lente-achado">{it.achado}</p><p className="ar-lente-evid">{it.evidencia}</p>
              {it.acao?.href && <Link className="pl-btn" href={it.acao.href}>{it.acao.rotulo}</Link>}
              {it.tipo === 'REC' && it.id && <AcoesRec id={it.id} />}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// PDF 05: achados de conteúdo vêm para o social media decidir (aceitar ou descartar com motivo).
function AcoesRec({ id }: { id: string }) {
  const [feito, setFeito] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [descartando, setDescartando] = useState(false)
  if (feito) return <span className="pl-hint">{feito}</span>
  return (
    <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', marginLeft: 6 }}>
      <button type="button" className="pl-btn pl-btn-primary" onClick={() => void telasApi.smRec(id, 'aceitar').then(() => setFeito('Aceita: as atividades foram criadas.')).catch(e => setFeito(e instanceof Error ? e.message : 'Não foi possível'))} data-sm-aceitar>Aceitar</button>
      {!descartando ? <button type="button" className="pl-btn" onClick={() => setDescartando(true)}>Descartar com motivo</button> : (
        <>
          <input className="pl-input" style={{ width: 200 }} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo" aria-label="Motivo do descarte" />
          <button type="button" className="pl-btn" onClick={() => void telasApi.smRec(id, 'descartar', motivo).then(() => setFeito('Descartada com motivo.')).catch(e => setFeito(e instanceof Error ? e.message : 'Não foi possível'))}>Descartar</button>
        </>
      )}
    </span>
  )
}
