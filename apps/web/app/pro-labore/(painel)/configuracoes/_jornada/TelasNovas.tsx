'use client'

// PDF 04 · Telas novas: piloto (supervisor, um SDR e um vendedor por uma
// semana), liberação para todos (registrada), uso de cada aba, registro do que
// foi enviado à IA e o aceite da seção 9 calculado na produção.
import { useEffect, useState } from 'react'
import { telasApi, type AceitePdf04, type PilotoPessoa } from '@/lib/proLaboreApi'

function Selo({ passa }: { passa: boolean | null }) {
  if (passa == null) return <span className="pl-hint">sem casos ainda</span>
  return <span className={`pl-chip-faixa ${passa ? 'pl-faixa-bom' : 'pl-faixa-critico'}`}>{passa ? 'Passa' : 'Não passa'}</span>
}

export function TelasNovas() {
  const [p, setP] = useState<{ liberadaEm: string | null; pessoas: PilotoPessoa[] } | null>(null)
  const [uso, setUso] = useState<Array<{ aba: string; aberturas: number; pessoas: number; acoes: number; ultima: string }>>([])
  const [ia, setIa] = useState<{ total: number; envios: Array<{ id: string; finalidade: string; conteudo: string; criadoEm: string; seguro: boolean }> } | null>(null)
  const [a, setA] = useState<AceitePdf04 | null>(null)
  const [just, setJust] = useState(''), [msg, setMsg] = useState<string | null>(null), [rodando, setRodando] = useState(false)
  useEffect(() => {
    telasApi.piloto().then(setP).catch(() => setP(null))
    telasApi.usoResumo().then(setUso).catch(() => setUso([]))
  }, [])
  async function mudar(id: string, participa: boolean) { try { setP(await telasApi.definirPiloto(id, participa)) } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível') } }
  async function liberar() {
    if (just.trim().length < 5) { setMsg('Registre a liberação: por que e com base em quê.'); return }
    if (!window.confirm('Liberar as telas novas para toda a equipe? As telas antigas deixam de aparecer.')) return
    try { const r = await telasApi.liberarParaTodos(just.trim()); setMsg(`Liberado em ${new Date(r.liberadaEm).toLocaleString('pt-BR')}.`); setP(await telasApi.piloto()) } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível') }
  }
  async function rodarAceite() { setRodando(true); try { setA(await telasApi.aceite()) } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível') } finally { setRodando(false) } }
  return (
    <section className="pl-card" id="telas-novas" style={{ marginBottom: 20 }} data-telas-novas>
      <div className="pl-card-head"><div>
        <div className="pl-card-title">Telas novas · Hoje, Lente, Pergunte ao ARIES e novo menu (PDF 04)</div>
        <div className="pl-card-sub">A versão nova vai primeiro, por uma semana, para o supervisor, um SDR e um vendedor. Quem não está no piloto continua nas telas atuais.</div>
      </div></div>

      {p?.liberadaEm ? <div className="pl-alert" data-liberado>Liberado para todos em {new Date(p.liberadaEm).toLocaleString('pt-BR')}: as telas antigas foram desligadas.</div> : (
        <>
          <div className="pl-eyebrow">Participantes do piloto</div>
          <table className="pl-table" data-piloto><thead><tr><th>Pessoa</th><th>Perfil</th><th>No piloto</th><th>Desde</th></tr></thead>
            <tbody>{(p?.pessoas ?? []).map(x => (
              <tr key={x.id}><td>{x.nome}</td><td>{x.papel}</td>
                <td><label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={x.noPiloto} onChange={e => void mudar(x.id, e.target.checked)} data-piloto-pessoa={x.id} /> {x.noPiloto ? 'Sim' : 'Não'}</label></td>
                <td className="pl-hint">{x.noPiloto && x.inicio ? new Date(x.inicio).toLocaleDateString('pt-BR') : '—'}</td></tr>
            ))}</tbody></table>
          <p className="pl-hint">Você (dono) pode alternar entre as duas versões pelo botão no topo da tela, a qualquer momento.</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            <input className="pl-input" style={{ flex: 1, minWidth: 220 }} placeholder="Registro da liberação (por que e com base em quê)" value={just} onChange={e => setJust(e.target.value)} aria-label="Justificativa da liberação" />
            <button type="button" className="pl-btn pl-btn-primary" onClick={() => void liberar()} data-liberar-todos>Liberar para todos</button>
          </div>
        </>
      )}
      {msg && <p className="pl-hint" role="status">{msg}</p>}

      <details style={{ marginTop: 14 }}><summary className="pl-hint">Uso das telas nos últimos 30 dias ({uso.length} abas)</summary>
        <table className="pl-table"><thead><tr><th>Aba</th><th>Aberturas</th><th>Pessoas</th><th>Ações a partir dela</th><th>Última</th></tr></thead>
          <tbody>{uso.map(u => <tr key={u.aba}><td>{u.aba}</td><td>{u.aberturas}</td><td>{u.pessoas}</td><td>{u.acoes}</td><td className="pl-hint">{new Date(u.ultima).toLocaleDateString('pt-BR')}</td></tr>)}</tbody></table>
        <p className="pl-hint">O que ninguém usa por um mês entra em revisão (princípio 10).</p>
      </details>

      <details style={{ marginTop: 10 }} onToggle={e => { if ((e.target as HTMLDetailsElement).open && !ia) telasApi.registroIa().then(setIa).catch(() => setIa(null)) }}>
        <summary className="pl-hint">Registro do que foi enviado à IA (Pergunte ao ARIES)</summary>
        {ia && <p className="pl-hint">{ia.total} envio(s). {ia.envios.filter(x => !x.seguro).length === 0 ? 'Nenhum com R$, CPF ou data de nascimento.' : `${ia.envios.filter(x => !x.seguro).length} com conteúdo protegido: conferir.`}</p>}
        {ia?.envios.slice(0, 20).map(x => (
          <details key={x.id} style={{ marginBottom: 4 }} data-envio-ia={x.seguro ? 'seguro' : 'inseguro'}>
            <summary className="pl-hint">{new Date(x.criadoEm).toLocaleString('pt-BR')} · {x.finalidade === 'ENTENDER' ? 'entender a pergunta' : 'escrever a resposta'} · {x.seguro ? 'sem dados protegidos' : 'CONFERIR'}</summary>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '.72rem', maxHeight: 220, overflow: 'auto' }}>{x.conteudo}</pre>
          </details>
        ))}
      </details>

      <div style={{ marginTop: 14 }}>
        <button type="button" className="pl-btn" onClick={() => void rodarAceite()} disabled={rodando} data-rodar-aceite-04>{rodando ? 'Calculando…' : a ? 'Rodar o aceite de novo' : 'Rodar o aceite da seção 9'}</button>
      </div>
      {a && (
        <div style={{ display: 'grid', gap: 10, marginTop: 10 }} data-aceite-pdf04>
          <table className="pl-table"><thead><tr><th>Item</th><th>Medido</th><th /></tr></thead><tbody>
            <tr><td>Hoje de cada papel</td><td>{a.hoje.papeis.map(h => `${h.nome}: ${h.pessoa ? `${h.numeros.filter(n => n.bate).length}/${h.numeros.filter(n => n.bate !== null).length} números batem, fila ${h.filaEmOrdem ? 'na ordem' : 'FORA da ordem'}` : 'sem pessoa com esse perfil'}`).join(' · ')}</td><td><Selo passa={a.hoje.passa} /></td></tr>
            <tr><td>Lente do ARIES</td><td>{a.lente.abas.filter(l => l.passa).length} de {a.lente.abas.length} abas ok · {a.lente.execucoesAutomaticas} execução automática · {a.lente.decididasSemPessoa} decidida sem pessoa</td><td><Selo passa={a.lente.passa} /></td></tr>
            <tr><td>Pergunte ao ARIES: números</td><td>{a.pergunteNumeros.conversas} perguntas (precisa de 20) de {a.pergunteNumeros.papeis.length} papéis · {a.pergunteNumeros.numeros.filter(n => n.completo).length}/{a.pergunteNumeros.numeros.length} números com métrica, período, comparação e link</td><td><Selo passa={a.pergunteNumeros.passa} /></td></tr>
            <tr><td>Pergunte ao ARIES: proteção</td><td>{a.pergunteProtecao.envios} envios à IA · {a.pergunteProtecao.inseguros.length} com R$, CPF ou data</td><td><Selo passa={a.pergunteProtecao.passa} /></td></tr>
            <tr><td>Pergunte ao ARIES: limites</td><td>{a.pergunteLimites.naoSabe} respostas &quot;não sei&quot; · {a.pergunteLimites.perguntasSobreColega} perguntas de vendedor sobre colega · {a.pergunteLimites.nomesVazados} com nome de colega na resposta</td><td><Selo passa={a.pergunteLimites.passa} /></td></tr>
            <tr><td>Menu e nomes · Padrão de tela · Celular</td><td>Conferidos navegando pelo sistema (teste de tela)</td><td><span className="pl-hint">na tela</span></td></tr>
            <tr><td>Sistema atual</td><td>{a.sistemaAtual.noPiloto} no piloto · {a.sistemaAtual.aberturasTelasAtuais} aberturas das telas atuais e {a.sistemaAtual.aberturasTelasNovas} das novas nos últimos 7 dias</td><td><Selo passa={a.sistemaAtual.passa} /></td></tr>
          </tbody></table>
        </div>
      )}
    </section>
  )
}
