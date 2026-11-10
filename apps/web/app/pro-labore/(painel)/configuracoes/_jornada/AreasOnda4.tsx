'use client'

// PDF 05 · Onda 4: os detectores de Reativação, Marketing, Gestão e Pessoas.
// Uma área por vez, nesta ordem. Cada área liga em modo silencioso (RECs só
// para o dono e o responsável da área); o roteamento normal só liga com a
// liberação do dono, registrada. O aceite da seção 9 roda por área.
import { useCallback, useEffect, useState } from 'react'
import { recApi, type AceiteArea, type AreaOnda4 } from '@/lib/proLaboreApi'
import { DetalheRec, ForcaChip } from '../../recomendacoes/DetalheRec'

function Selo({ passa }: { passa: boolean | null | undefined }) {
  if (passa == null) return <span className="pl-hint">sem casos ainda</span>
  return <span className={`pl-chip-faixa ${passa ? 'pl-faixa-bom' : 'pl-faixa-critico'}`}>{passa ? 'Passa' : 'Não passa'}</span>
}
const estado = (a: AreaOnda4) => (!a.ligada ? 'Desligada' : a.modo === 'SILENCIOSO' ? 'Semana silenciosa' : 'Roteamento normal')

export function AreasOnda4() {
  const [areas, setAreas] = useState<AreaOnda4[] | null>(null)
  const [just, setJust] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [aceite, setAceite] = useState<Record<string, AceiteArea>>({})
  const [aberta, setAberta] = useState<string | null>(null)
  const carregar = useCallback(() => { recApi.areas().then(setAreas).catch(() => setAreas(null)) }, [])
  useEffect(() => { carregar() }, [carregar])
  async function mudar(g: string, d: { ligada?: boolean; modo?: 'SILENCIOSO' | 'NORMAL' }, texto: string) {
    if (just.trim().length < 5) { setMsg('Escreva o motivo (fica no histórico).'); return }
    if (!window.confirm(texto)) return
    try { const r = await recApi.mudarArea(g, { ...d, justificativa: just.trim() }); setMsg(`Feito.${r.afetadas ? ` ${r.afetadas} recomendação(ões) abertas passaram a ir para quem deve agir.` : ''}`); setJust(''); carregar() } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível') }
  }
  async function rodarAceite(g: string) { try { const a = await recApi.aceiteArea(g); setAceite(x => ({ ...x, [g]: a })) } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível') } }
  return (
    <section className="pl-card" id="areas-onda4" style={{ marginBottom: 20 }} data-areas-onda4>
      <div className="pl-card-head"><div>
        <div className="pl-card-title">Detectores das outras áreas (PDF 05)</div>
        <div className="pl-card-sub">Uma área por vez: Reativação, Marketing, Gestão e Pessoas. Cada uma passa uma semana em modo silencioso (só você e o responsável da área veem) antes do roteamento normal. Todos ficam no nível 1: só recomendam.</div>
      </div></div>
      <input className="pl-input" style={{ marginBottom: 10 }} placeholder="Motivo da mudança (obrigatório, fica no histórico)" value={just} onChange={e => setJust(e.target.value)} aria-label="Motivo" data-motivo-area />
      {msg && <p className="pl-hint" role="status">{msg}</p>}
      {areas?.map(a => (
        <details key={a.grupo} style={{ borderTop: '1px solid var(--pl-border)', padding: '8px 0' }} data-area={a.grupo}>
          <summary style={{ cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <b>{a.nome}</b>
            <span className={`pl-chip-faixa ${a.ligada ? (a.modo === 'NORMAL' ? 'pl-faixa-bom' : 'pl-faixa-atencao') : ''}`} data-estado-area={estado(a)}>{estado(a)}</span>
            <span className="pl-hint">responsável: {a.responsavel}{a.ligadaEm ? ` · ligada em ${new Date(a.ligadaEm).toLocaleDateString('pt-BR')}` : ''}{a.liberadaEm ? ` · liberada em ${new Date(a.liberadaEm).toLocaleDateString('pt-BR')}` : ''}</span>
          </summary>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
            {!a.ligada && <button type="button" className="pl-btn pl-btn-primary" onClick={() => void mudar(a.grupo, { ligada: true, modo: 'SILENCIOSO' }, `Ligar ${a.nome} em modo silencioso?`)} data-ligar-area={a.grupo}>Ligar (semana silenciosa)</button>}
            {a.ligada && a.modo === 'SILENCIOSO' && <button type="button" className="pl-btn pl-btn-primary" onClick={() => void mudar(a.grupo, { modo: 'NORMAL' }, `Liberar ${a.nome}: as recomendações passam a ir para quem deve agir?`)} data-liberar-area={a.grupo}>Liberar o roteamento normal</button>}
            {a.ligada && <button type="button" className="pl-btn" onClick={() => void mudar(a.grupo, { ligada: false }, `Desligar ${a.nome}? Os detectores param; o que já existe continua.`)} data-desligar-area={a.grupo}>Desligar</button>}
            <button type="button" className="pl-btn" onClick={() => void rodarAceite(a.grupo)} data-aceite-area={a.grupo}>Rodar o aceite da seção 9</button>
          </div>
          <table className="pl-table"><thead><tr><th>Detector</th><th>Dispara quando</th><th>Vai para</th><th>Volume mínimo</th></tr></thead>
            <tbody>{a.detectores.map(d => <tr key={d.chave}><td><b>{d.nome}</b></td><td className="pl-hint">{d.dispara}</td><td className="pl-hint">{d.roteamento}</td><td>{d.volumeMinimo}</td></tr>)}</tbody></table>
          {aceite[a.grupo] && <AceiteDaArea a={aceite[a.grupo]} abrir={setAberta} />}
        </details>
      ))}
      {aberta && <DetalheRec id={aberta} onFechar={() => setAberta(null)} onMudou={() => undefined} avaliarPertinencia />}
    </section>
  )
}

function AceiteDaArea({ a, abrir }: { a: AceiteArea; abrir: (id: string) => void }) {
  const linha = (n: string, txt: string, passa: boolean | null | undefined) => <tr key={n}><td>{n}</td><td>{txt}</td><td><Selo passa={passa} /></td></tr>
  return (
    <div style={{ marginTop: 10 }} data-aceite-pdf05={a.grupo}>
      <p className="pl-hint" style={{ margin: '0 0 6px' }}>{a.total} recomendações · {a.porDetector.map(d => `${d.nome}: ${d.total}`).join(' · ')}</p>
      <table className="pl-table"><thead><tr><th>Item</th><th>Medido</th><th /></tr></thead><tbody>
        {linha('Evidência correta', `${a.evidencia.itens.filter(x => x.bate).length} de ${a.evidencia.itens.filter(x => x.bate !== null).length} recalculadas batem com o dicionário (as demais contam registros direto da fonte)`, a.evidencia.passa)}
        {linha('Utilidade da área', a.utilidade.avaliacoes ? `${a.utilidade.pertinentes} de ${a.utilidade.avaliacoes} pertinentes (${a.utilidade.pct}%; precisa de 80%)` : 'avalie a amostra abaixo', a.utilidade.passa)}
        {linha('Roteamento', `${a.roteamento.itens.filter(x => x.ok).length} de ${a.roteamento.itens.length} chegam a quem a tabela da área define`, a.roteamento.passa)}
        {a.pessoas && linha('Cuidados de Pessoas', `${a.pessoas.ocorrencias} ocorrência(s) repetida(s) só com supervisor e dono · ${a.pessoas.dicas} boa(s) prática(s) compartilhada(s)`, a.pessoas.passa)}
        {a.gestaoSemIa && linha('Gestão sem valores na IA', `detectores só no código · ${a.gestaoSemIa.envios} envios à IA, ${a.gestaoSemIa.inseguros} com R$`, a.gestaoSemIa.passa)}
        {a.reativacao && linha('Reativação', `${a.reativacao.comBloqueado} com cliente bloqueado · ${a.reativacao.roteiros} roteiro(s) para promover, só com aprovação`, a.reativacao.passa)}
        {linha('Sem duplicidade', `${a.duplicidade.juntadas} achado(s) juntado(s) às correções da qualidade`, a.duplicidade.passa)}
        {linha('Sistema atual', `${a.sistemaAtual.areasDesligadas.length} área(s) ainda desligada(s), ${a.sistemaAtual.recsDeAreasDesligadas} recomendação(ões) delas`, a.sistemaAtual.passa)}
      </tbody></table>
      <div className="pl-eyebrow" style={{ marginTop: 8 }}>Amostra de 10 para o teste de utilidade</div>
      <table className="pl-table"><tbody>{a.utilidade.amostra.map(r => (
        <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => abrir(r.id)} data-amostra-area={r.id}><td>{r.codigo}</td><td>{r.titulo}</td><td><ForcaChip forca={r.forca} /></td><td className="pl-hint">{r.avaliacoes ? `${r.pertinentes} de ${r.avaliacoes} pertinentes` : '—'}</td></tr>
      ))}</tbody></table>
    </div>
  )
}
