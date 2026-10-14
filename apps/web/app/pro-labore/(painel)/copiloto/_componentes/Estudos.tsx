'use client'

import { useEffect, useState } from 'react'
import { proLaboreApi, type CpEstudo, type CpEstudos, type CpStatusEstudo } from '@/lib/proLaboreApi'
import { TIPO_ESTUDO } from './rotulos'

export function Estudos({ pessoa, foco, porque, somenteLeitura }: { pessoa?: string; foco: { chave: string; nome: string; descricao: string }; porque: string; somenteLeitura: boolean }) {
  const [dados, setDados] = useState<CpEstudos | null>(null)
  const [versao, setVersao] = useState(0)
  const [competencia, setCompetencia] = useState(foco.chave)
  const [buscando, setBuscando] = useState(false)
  const [aviso, setAviso] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null)

  useEffect(() => {
    let cancelado = false
    proLaboreApi.copiloto.estudos(pessoa).then(d => { if (!cancelado) setDados(d) }).catch(e => { if (!cancelado) setAviso({ tom: 'erro', texto: (e as Error).message }) })
    return () => { cancelado = true }
  }, [pessoa, versao])

  async function buscar() {
    setBuscando(true); setAviso(null)
    try {
      const r = await proLaboreApi.copiloto.buscarEstudos(competencia)
      const nome = dados?.competencias.find(c => c.chave === competencia)?.nome ?? ''
      setAviso(r.adicionados === 0
        ? { tom: 'ok', texto: 'Nada novo para acrescentar agora: o que a busca achou você já tem na trilha.' }
        : r.origem === 'WEB'
          ? { tom: 'ok', texto: `${r.adicionados} conteúdos encontrados na web sobre ${nome.toLowerCase()}. Os links são os que a busca devolveu.` }
          : { tom: 'ok', texto: r.webFalhou ? `A busca na web não respondeu agora; entraram ${r.adicionados} itens da biblioteca.` : `${r.adicionados} itens da biblioteca sobre ${nome.toLowerCase()}.` })
      setVersao(v => v + 1)
    } catch (e) { setAviso({ tom: 'erro', texto: (e as Error).message }) } finally { setBuscando(false) }
  }
  async function mudar(e: CpEstudo, data: { status?: CpStatusEstudo; util?: boolean | null }) {
    try {
      const novo = await proLaboreApi.copiloto.estudo(e.id, data)
      setDados(d => d && ({ ...d, itens: data.status === 'DESCARTADO' ? d.itens.filter(x => x.id !== e.id) : d.itens.map(x => (x.id === e.id ? novo : x)) }))
    } catch (err) { setAviso({ tom: 'erro', texto: (err as Error).message }) }
  }

  if (!dados) return aviso ? <div className="pl-alert pl-alert-error">{aviso.texto}</div> : <div className="pl-hint">Carregando a trilha…</div>
  const nomeDe = (c: string) => dados.competencias.find(x => x.chave === c)?.nome ?? c
  const ordem = [foco.chave, ...new Set(dados.itens.map(i => i.competencia).filter(c => c !== foco.chave))]
  const concluidos = dados.itens.filter(i => i.status === 'CONCLUIDO').length

  return (
    <>
      <section className="cp-card">
        <div className="cp-card-cab">
          <div>
            <span className="cp-acao-tipo">Foco de hoje</span>
            <h2 style={{ marginTop: 4 }}>{foco.nome}</h2>
            <p className="cp-sub" style={{ color: 'var(--pl-ink-2)' }}>{porque}</p>
            <p className="cp-sub">{concluidos} {concluidos === 1 ? 'conteúdo concluído' : 'conteúdos concluídos'} até aqui.</p>
          </div>
        </div>
        {!somenteLeitura && (
          <div className="cp-form-linha">
            <label>Buscar conteúdo sobre
              <select className="pl-select" value={competencia} onChange={e => setCompetencia(e.target.value)}>
                {dados.competencias.map(c => <option key={c.chave} value={c.chave}>{c.nome}</option>)}
              </select>
            </label>
            <button type="button" className="pl-btn pl-btn-primary" onClick={buscar} disabled={buscando}>{buscando ? 'Buscando na web…' : dados.buscaWeb ? 'Buscar vídeos, artigos e livros na web' : 'Adicionar da biblioteca'}</button>
          </div>
        )}
        <p className="cp-legenda" style={{ marginTop: 8 }}>
          {dados.buscaWeb ? 'A busca na web traz conteúdos reais com o endereço que a própria busca encontrou (nada é inventado). ' : 'A busca na web precisa da IA ligada; por enquanto entram livros conhecidos e buscas prontas no YouTube e no Google Acadêmico. '}
          Marque o que foi útil: o copiloto passa a priorizar o formato que funciona para você.
        </p>
        {aviso && <div className={`pl-alert ${aviso.tom === 'ok' ? 'pl-alert-success' : 'pl-alert-error'}`} style={{ marginTop: 10 }} role="status">{aviso.texto}</div>}
      </section>

      {ordem.map(c => {
        const itens = dados.itens.filter(i => i.competencia === c)
        if (!itens.length) return null
        return (
          <section key={c} className="cp-card" aria-label={nomeDe(c)}>
            <h2 style={{ marginBottom: 12 }}>{nomeDe(c)}{c === foco.chave ? ' · foco de hoje' : ''}</h2>
            <div className="cp-grade-3">
              {itens.map(e => (
                <article key={e.id} className={`cp-estudo ${e.status === 'CONCLUIDO' ? 'concluido' : ''}`}>
                  <div className="cp-estudo-topo">
                    <span className="cp-selo">{TIPO_ESTUDO[e.tipo] ?? e.tipo}</span>
                    <span className={`cp-selo ${e.origem === 'WEB' ? 'ia' : ''}`}>{e.origem === 'WEB' ? 'Achado na web' : 'Biblioteca'}</span>
                    {e.status === 'CONCLUIDO' && <span className="cp-selo ok">Concluído</span>}
                    {e.status === 'ESTUDANDO' && <span className="cp-selo atencao">Estudando</span>}
                  </div>
                  <a className="titulo" href={e.url} target="_blank" rel="noreferrer">{e.titulo}</a>
                  {e.fonte && <span className="cp-legenda">{e.fonte}</span>}
                  <span className="cp-acao-porque">{e.porque}</span>
                  {!somenteLeitura && (
                    <div className="cp-estudo-botoes">
                      {e.status !== 'ESTUDANDO' && e.status !== 'CONCLUIDO' && <button type="button" className="cp-link" onClick={() => mudar(e, { status: 'ESTUDANDO' })}>Começar</button>}
                      {e.status !== 'CONCLUIDO' && <button type="button" className="cp-link" onClick={() => mudar(e, { status: 'CONCLUIDO' })}>Concluí</button>}
                      <button type="button" className={`pl-chip ${e.util === true ? 'active' : ''}`} onClick={() => mudar(e, { util: e.util === true ? null : true })} aria-pressed={e.util === true}>Útil</button>
                      <button type="button" className={`pl-chip ${e.util === false ? 'active' : ''}`} onClick={() => mudar(e, { util: e.util === false ? null : false })} aria-pressed={e.util === false}>Não serviu</button>
                      <button type="button" className="cp-link mudo" onClick={() => mudar(e, { status: 'DESCARTADO' })}>Tirar da trilha</button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )
      })}
    </>
  )
}
