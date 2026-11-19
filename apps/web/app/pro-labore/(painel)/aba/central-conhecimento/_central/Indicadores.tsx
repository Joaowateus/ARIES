'use client'

// Indicadores: as fichas do dicionário que o papel pode ver, agrupadas por área, com
// pesquisa por nome e sinônimo. Cada ficha mostra definição, fórmula, fonte, período,
// comparação, faixas, versão e histórico, qualidade do dado (P4) e o valor calculado na hora.
// A gestão sugere mudanças; o dono aprova cada uma (regra 2 do PDF 07).
import { useEffect, useMemo, useState } from 'react'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { centralApi, type FichaCentral, type FichaDetalhe, type RascunhoFicha } from '@/lib/proLaboreApi'
import { StatusChip } from '../../../_padrao/Padrao'
import { data } from './util'

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function Indicadores({ abrir }: { abrir: string | null }) {
  const [lista, setLista] = useState<{ fichas: FichaCentral[]; rascunhos: RascunhoFicha[]; podeAprovar: boolean } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [aberta, setAberta] = useState<string | null>(abrir)
  const [versao, setVersao] = useState(0)
  const { usuario } = useProLaboreAuth()
  // Sugerir mudança numa ficha é da gestão (o servidor confere de novo).
  const gestao = usuario?.papel === 'DONO' || usuario?.papel === 'SUPERVISOR'
  useEffect(() => { centralApi.indicadores().then(setLista).catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível carregar')) }, [versao])

  const grupos = useMemo(() => {
    if (!lista) return []
    const t = semAcento(busca.trim())
    const fs = lista.fichas.filter(f => !t || semAcento(f.nome).includes(t) || f.sinonimos.some(s => semAcento(s).includes(t)) || semAcento(f.definicao).includes(t))
    const mapa = new Map<string, FichaCentral[]>()
    for (const f of fs) mapa.set(f.area, [...(mapa.get(f.area) ?? []), f])
    return [...mapa].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
  }, [lista, busca])

  async function decidir(id: string, decisao: 'aprovar' | 'recusar') {
    try { await centralApi.decidirRascunho(id, decisao); setVersao(v => v + 1) } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível') }
  }

  if (erro) return <div className="pl-alert pl-alert-error" role="alert">{erro}</div>
  if (!lista) return <p className="pl-hint" aria-busy="true">Carregando o dicionário…</p>
  return (
    <div data-central-indicadores>
      {lista.rascunhos.length > 0 && (
        <section className="pl-card cc-rascunhos" data-central-rascunhos>
          <b>Mudanças aguardando {lista.podeAprovar ? 'a sua aprovação' : 'o dono'}</b>
          <ul className="ar-fila" style={{ marginTop: 8 }}>
            {lista.rascunhos.map(r => (
              <li key={r.id} className="ar-fila-item">
                <div>
                  <div className="ar-fila-titulo">{String(r.ficha.nome ?? r.chave)} · versão {r.versao}</div>
                  <div className="pl-hint">{r.justificativa} · {data(r.criadoEm)}</div>
                  {Array.isArray(r.ficha.sinonimos) && <div className="pl-hint">Sinônimos: {(r.ficha.sinonimos as string[]).join(', ') || '—'}</div>}
                </div>
                {lista.podeAprovar && (
                  <span className="cc-chips">
                    <button type="button" className="pl-btn" onClick={() => void decidir(r.id, 'recusar')}>Recusar</button>
                    <button type="button" className="pl-btn pl-btn-primary" onClick={() => void decidir(r.id, 'aprovar')} data-aprovar-ficha>Aprovar</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <input className="pl-input" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Pesquise por nome ou sinônimo (ex.: conversão, giro, CPL)" aria-label="Pesquisar indicador" style={{ marginBottom: 12 }} />
      {!grupos.length && <div className="ar-vazio"><h3>Nenhum indicador com “{busca}”</h3><p style={{ margin: 0 }}>Se a métrica não existe no dicionário, o ARIES responde que ela não existe. Peça ao dono para criá-la.</p></div>}
      {grupos.map(([area, fs]) => (
        <section key={area} className="cc-grupo">
          <div className="ar-fila-grupo">{area}</div>
          <ul className="ar-fila">
            {fs.map(f => (
              <li key={f.chave} className="cc-ficha" data-ficha={f.chave}>
                <button type="button" className="ar-fila-item cc-ficha-cabeca" onClick={() => setAberta(a => (a === f.chave ? null : f.chave))} aria-expanded={aberta === f.chave}>
                  <div style={{ minWidth: 0, textAlign: 'left' }}>
                    <div className="ar-fila-titulo">{f.nome}</div>
                    <div className="pl-hint">{f.definicao}</div>
                  </div>
                  <span className="pl-hint">v{f.versao}</span>
                </button>
                {aberta === f.chave && <FichaAberta chave={f.chave} podeSugerir={gestao} aoSugerir={() => setVersao(v => v + 1)} />}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function FichaAberta({ chave, podeSugerir, aoSugerir }: { chave: string; podeSugerir: boolean; aoSugerir: () => void }) {
  const [d, setD] = useState<FichaDetalhe | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [sugerindo, setSugerindo] = useState(false)
  useEffect(() => { centralApi.indicador(chave).then(setD).catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível carregar')) }, [chave])
  if (erro) return <div className="pl-alert pl-alert-error" role="alert">{erro}</div>
  if (!d) return <p className="pl-hint" aria-busy="true">Calculando…</p>
  const f = d.ficha
  const v = d.valor
  return (
    <div className="cc-ficha-corpo" data-ficha-aberta={chave}>
      {f.naoDefinido ? <div className="pl-alert" role="status">{f.naoDefinido}</div> : v && (
        <div className="cc-valor" data-ficha-valor>
          <span className="cc-valor-num">{v.texto}</span> <StatusChip status={(v.faixa ?? undefined) as never} />
          <span className="pl-hint"> · {d.escopo} · {f.retrato ? 'agora' : `${data(`${v.periodo.inicio}T15:00:00Z`)} a ${data(`${v.periodo.fim}T15:00:00Z`)}`}{v.anterior ? ` · mesmo intervalo anterior: ${v.anterior}` : ''}</span>
          {v.erro && <div className="pl-hint" role="alert">Não deu para calcular agora: {v.erro}</div>}
        </div>
      )}
      {d.qualidade && <div className="pl-alert cc-aviso" role="status" data-ficha-qualidade>{d.qualidade}</div>}
      <dl className="cc-dl">
        <dt>Fórmula</dt><dd>{f.formula}</dd>
        <dt>Fonte</dt><dd>{f.fonte}</dd>
        <dt>Período</dt><dd>{f.janela}</dd>
        <dt>Comparação</dt><dd>{f.retrato ? 'Retrato de agora (sem comparação)' : f.comparacao}</dd>
        <dt>Faixas</dt><dd>{f.faixas ? `bom a partir de ${f.faixas.bom}, crítico a partir de ${f.faixas.critico}` : f.melhor === 'NEUTRO' ? 'Sem faixa (número para leitura)' : 'Pelo padrão da loja: bom = no padrão ou melhor; atenção = até 20% pior; crítico = mais de 20% pior'}</dd>
        <dt>Responsável</dt><dd>{f.responsavel}</dd>
        <dt>Quem vê</dt><dd>{f.quemVe.join(', ')}</dd>
        <dt>Sinônimos</dt><dd>{f.sinonimos.length ? f.sinonimos.join(', ') : '—'}</dd>
        <dt>Versão</dt><dd>{f.versao}{f.aprovadoPor ? ` · aprovada${f.aprovadoEm ? ` em ${data(f.aprovadoEm)}` : ''}` : ''}</dd>
      </dl>
      {d.versoes.length > 0 && (
        <details className="ar-detalhes"><summary>Histórico de versões</summary>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {d.versoes.map(x => <li key={x.versao}>Versão {x.versao} · {x.situacao === 'APROVADA' ? 'aprovada' : x.situacao === 'RASCUNHO' ? 'aguardando o dono' : 'recusada'} · {data(x.criadoEm)} · {x.justificativa}</li>)}
          </ul>
        </details>
      )}
      {!podeSugerir ? null : !sugerindo
        ? <button type="button" className="pl-link-action" onClick={() => setSugerindo(true)} data-sugerir-ficha>Sugerir mudança nesta ficha</button>
        : <Sugestao chave={chave} nome={f.nome} definicao={f.definicao} sinonimos={f.sinonimos} aoFechar={() => setSugerindo(false)} aoSalvar={aoSugerir} />}
    </div>
  )
}

function Sugestao({ chave, nome, definicao, sinonimos, aoFechar, aoSalvar }: { chave: string; nome: string; definicao: string; sinonimos: string[]; aoFechar: () => void; aoSalvar: () => void }) {
  const [n, setN] = useState(nome), [d, setD] = useState(definicao), [s, setS] = useState(sinonimos.join(', ')), [j, setJ] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  async function salvar() {
    try {
      await centralApi.sugerirFicha(chave, { ...(n !== nome ? { nome: n } : {}), ...(d !== definicao ? { definicao: d } : {}), sinonimos: s.split(',').map(x => x.trim()).filter(x => x.length >= 2), justificativa: j })
      setMsg('Enviada. Vale depois que o dono aprovar.'); aoSalvar()
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível enviar') }
  }
  return (
    <div className="pl-card" style={{ marginTop: 8 }}>
      <label className="pl-field"><span>Nome</span><input className="pl-input" value={n} onChange={e => setN(e.target.value)} /></label>
      <label className="pl-field"><span>Definição</span><textarea className="pl-input pl-textarea" rows={2} value={d} onChange={e => setD(e.target.value)} /></label>
      <label className="pl-field"><span>Sinônimos (separe por vírgula)</span><input className="pl-input" value={s} onChange={e => setS(e.target.value)} /></label>
      <label className="pl-field"><span>Por que mudar</span><input className="pl-input" value={j} onChange={e => setJ(e.target.value)} /></label>
      {msg && <p className="pl-hint" role="status">{msg}</p>}
      <div className="cc-chips"><button type="button" className="pl-btn" onClick={aoFechar}>Fechar</button><button type="button" className="pl-btn pl-btn-primary" onClick={() => void salvar()} disabled={j.trim().length < 5}>Enviar para aprovação</button></div>
    </div>
  )
}
