'use client'

// Documento visual da página: o mesmo texto organizado em peças (seções
// numeradas, fluxo com setas, tabela com gráfico de barras, destaques,
// cadeias de métricas, cartões e listas). "Gerar PDF" abre a impressão do
// navegador só com o documento (A4, fundo branco) — lá se escolhe "Salvar
// como PDF".
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Bloco } from '@/lib/proLaboreApi'
import { estruturar, type Peca } from './estrutura'

/** **negrito** do texto colado (sem HTML). */
function Rico({ texto }: { texto: string }) {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g)
  return <>{partes.map((p, i) => (p.startsWith('**') && p.endsWith('**') && p.length > 4 ? <b key={i}>{p.slice(2, -2)}</b> : <Fragment key={i}>{p}</Fragment>))}</>
}

const Seta = () => <div className="vd-seta" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7 7 7-7" /></svg></div>

function Cadeia({ partes }: { partes: string[] }) {
  return (
    <div className="vd-cadeia">
      {partes.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="vd-cadeia-seta" aria-hidden="true">→</span>}
          <span className="vd-cadeia-item"><Rico texto={p} /></span>
        </Fragment>
      ))}
    </div>
  )
}

function Grafico({ g }: { g: NonNullable<Extract<Peca, { t: 'tabela' }>['grafico']> }) {
  const max = Math.max(...g.valores, 1)
  return (
    <div className="vd-grafico" aria-label={`Gráfico de ${g.coluna}`}>
      {g.rotulos.map((r, i) => (
        <div key={i} className="vd-grafico-linha">
          <span className="vd-grafico-rotulo">{r}</span>
          <span className="vd-grafico-trilho"><span className="vd-grafico-barra" style={{ width: `${Math.max(2, (g.valores[i] / max) * 100)}%`, ['--vd-i' as string]: i }} /></span>
          <span className="vd-grafico-valor">{g.valores[i].toLocaleString('pt-BR')}</span>
        </div>
      ))}
    </div>
  )
}

function PecaVisual({ p }: { p: Peca }): ReactNode {
  switch (p.t) {
    case 'secao': return <h2 className="vd-secao">{p.numero !== null && <span className="vd-secao-num">{p.numero}</span>}<Rico texto={p.texto} /></h2>
    case 'subtitulo': return <h3 className="vd-subtitulo"><Rico texto={p.texto} /></h3>
    case 'introducao': return <p className="vd-introducao"><Rico texto={p.texto} /></p>
    case 'paragrafo': return <p className="vd-paragrafo"><Rico texto={p.texto} /></p>
    case 'fluxo':
      return p.setas ? (
        <div className="vd-fluxo" data-vd="fluxo">
          {p.passos.map((s, i) => (
            <Fragment key={i}>
              {i > 0 && <Seta />}
              <div className="vd-passo" style={{ ['--vd-i' as string]: i, ['--vd-n' as string]: p.passos.length }}>
                <b><Rico texto={s.titulo} /></b>
                {s.descricao && <span><Rico texto={s.descricao} /></span>}
              </div>
            </Fragment>
          ))}
        </div>
      ) : (
        <ol className="vd-etapas" data-vd="etapas">
          {p.passos.map((s, i) => (
            <li key={i}><span className="vd-etapa-num">{i + 1}</span><div><b><Rico texto={s.titulo} /></b>{s.descricao && <span><Rico texto={s.descricao} /></span>}</div></li>
          ))}
        </ol>
      )
    case 'tabela':
      return (
        <div className="vd-tabela-bloco" data-vd="tabela">
          <div className="vd-tabela-rolagem">
            <table className="vd-tabela">
              <thead><tr>{p.cabecalho.map((c, i) => <th key={i}><Rico texto={c} /></th>)}</tr></thead>
              <tbody>{p.linhas.map((l, i) => <tr key={i}>{l.map((c, j) => (j === 0 ? <th key={j} scope="row"><Rico texto={c} /></th> : <td key={j}><Rico texto={c} /></td>))}</tr>)}</tbody>
            </table>
          </div>
          {p.grafico && <Grafico g={p.grafico} />}
        </div>
      )
    case 'destaque': return <div className="vd-destaque" data-vd="destaque">{p.icone && <span className="vd-destaque-icone" aria-hidden="true">{p.icone}</span>}<p>{p.rotulo && <b>{p.rotulo}: </b>}<Rico texto={p.texto} /></p></div>
    case 'cadeia': return <Cadeia partes={p.partes} />
    case 'cartoes':
      return (
        <div className="vd-cartoes" data-vd="cartoes">
          {p.itens.map((c, i) => (
            <div key={i} className="vd-cartao">
              <div className="vd-cartao-cab"><span className="vd-cartao-marca">{c.marca}</span><b><Rico texto={c.titulo} /></b></div>
              {c.linhas.map((l, j) => (l.t === 'cadeia' ? <Cadeia key={j} partes={l.partes!} /> : <p key={j}><Rico texto={l.texto} /></p>))}
            </div>
          ))}
        </div>
      )
    case 'lista':
      return p.numerada ? (
        <ol className="vd-lista-num">{p.itens.map((t, i) => <li key={i}><span>{i + 1}</span><div><Rico texto={t} /></div></li>)}</ol>
      ) : (
        <ul className="vd-lista">{p.itens.map((t, i) => <li key={i} style={{ marginLeft: `${Math.floor((t.match(/^ */)?.[0].length ?? 0) / 2) * 18}px` }}><Rico texto={t.trim()} /></li>)}</ul>
      )
    case 'checklist': return <ul className="vd-checklist">{p.itens.map((c, i) => <li key={i} className={c.marcado ? 'feito' : ''}><span aria-hidden="true">{c.marcado ? '✓' : ''}</span><Rico texto={c.texto} /></li>)}</ul>
    case 'citacao': return <blockquote className="vd-citacao"><Rico texto={p.texto} /></blockquote>
    case 'codigo': return <pre className="vd-codigo">{p.texto}</pre>
    // eslint-disable-next-line @next/next/no-img-element
    case 'imagem': return <img className="vd-imagem" src={p.src} alt="" />
    case 'divisor': return <hr className="vd-divisor" />
  }
}

function Documento({ titulo, pecas }: { titulo: string; pecas: Peca[] }) {
  return (
    <article className="vd-doc" data-documento-visual>
      <h1 className="vd-titulo">{titulo || 'Sem título'}</h1>
      {pecas.map((p, i) => <PecaVisual key={i} p={p} />)}
    </article>
  )
}

export function DocumentoVisual({ titulo, blocos }: { titulo: string; blocos: Bloco[] }) {
  const pecas = useMemo(() => estruturar(blocos), [blocos])
  const [imprimindo, setImprimindo] = useState(false)

  // Monta o documento direto no <body> (fora do painel) e chama a impressão;
  // o CSS de impressão esconde todo o resto.
  useEffect(() => {
    if (!imprimindo) return
    const tituloAntes = document.title
    document.title = titulo || 'Documento'
    document.documentElement.classList.add('vd-imprimindo')
    const fim = () => { document.documentElement.classList.remove('vd-imprimindo'); document.title = tituloAntes; setImprimindo(false) }
    window.addEventListener('afterprint', fim, { once: true })
    const t = setTimeout(() => window.print(), 80)
    return () => { clearTimeout(t); window.removeEventListener('afterprint', fim) }
  }, [imprimindo, titulo])

  return (
    <div className="vd">
      <div className="vd-barra">
        <span className="pl-hint">Organizado automaticamente pela estrutura do texto: títulos, itens numerados com descrição, tabelas, &ldquo;Rótulo: texto&rdquo; e setas (→).</span>
        <button type="button" className="pl-btn pl-btn-primary" onClick={() => setImprimindo(true)} data-gerar-pdf>Gerar PDF</button>
      </div>
      {pecas.length === 0 ? <div className="pl-hint">A página está vazia: escreva ou cole o conteúdo na aba Texto.</div> : <Documento titulo={titulo} pecas={pecas} />}
      {imprimindo && createPortal(<div className="vd-impressao"><Documento titulo={titulo} pecas={pecas} /></div>, document.body)}
    </div>
  )
}
