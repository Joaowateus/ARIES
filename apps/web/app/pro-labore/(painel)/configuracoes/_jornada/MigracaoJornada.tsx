'use client'

// Migração do CRM de 5 etapas para a jornada de 10 (PDF 01). Primeiro a
// simulação (só lê); depois aplicar em rodadas, com a conferência de cada
// etapa antiga contra a nova. Aplicar e desfazer só existem no ambiente de
// teste até o dono liberar a troca na produção.
import { useEffect, useState } from 'react'
import { proLaboreApi, type SimulacaoJornada, type StatusJornada } from '@/lib/proLaboreApi'

const num = (n: number) => n.toLocaleString('pt-BR')
const ETAPA: Record<string, string> = {
  LEAD: 'Lead', ABORDADO: 'Abordado', LEVANTAMENTO: 'Levantamento', MQL: 'MQL (Simulação)', SQL: 'SQL (Aprovado)', NEGOCIACAO: 'Negociação',
  PROPOSTA: 'Proposta', AGENDAMENTO: 'Agendamento', VISITA: 'Visita confirmada', VENDA: 'Venda', FECHADO: 'Fechamento', PERDIDO: 'Perdido',
}
const MOTIVO: Record<string, string> = {
  SEM_MOMENTO: 'Ainda não é o momento', SEM_CREDITO: 'Sem crédito', PRECO: 'Achou caro', SEM_RESPOSTA: 'Parou de responder', CONCORRENCIA: 'Comprou em outro lugar',
  SEM_ESTOQUE: 'Não tínhamos o modelo', DESISTIU: 'Desistiu', OUTRO: 'Outro motivo', 'sem motivo': 'Sem motivo',
  ACHOU_CARO: 'Achou caro', COMPROU_OUTRO_LUGAR: 'Comprou em outro lugar', MOTO_INDISPONIVEL: 'Moto indisponível', NUNCA_RESPONDEU: 'Nunca respondeu',
  PAROU_DE_RESPONDER: 'Parou de responder', OUTRO_ANTERIOR_MIGRACAO: 'Outro (anterior à migração)',
}
const DESTINO: Record<string, string> = {
  REATIVACAO_SEM_RESPOSTA: 'Reativação · sem resposta', REATIVACAO_INTERESSE: 'Reativação · interesse não convertido', REATIVACAO_NEGOCIACAO: 'Reativação · negociação interrompida',
  REATIVACAO_RETOMADA: 'Reativação · oportunidade de retomada', REATIVACAO_OUTRO: 'Reativação · outro (anterior à migração)',
}
// Ordem da jornada: etapas antigas (Lead → Fechamento, depois Perdido) e, dentro delas, as novas (1 a 10).
const ORDEM_ANTIGA = ['LEAD', 'ABORDADO', 'NEGOCIACAO', 'PROPOSTA', 'FECHADO', 'PERDIDO']
const ORDEM_NOVA = ['LEAD', 'ABORDADO', 'LEVANTAMENTO', 'MQL', 'SQL', 'NEGOCIACAO', 'PROPOSTA', 'AGENDAMENTO', 'VISITA', 'VENDA']
const posicao = (lista: string[], v: string | null) => { const i = lista.indexOf((v ?? '').replace(/ .*/, '')); return i < 0 ? 99 : i }
const naOrdem = <T,>(itens: T[], de: (t: T) => string | null, para: (t: T) => string | null) =>
  [...itens].sort((a, b) => posicao(ORDEM_ANTIGA, de(a)) - posicao(ORDEM_ANTIGA, de(b)) || posicao(ORDEM_NOVA, para(a)) - posicao(ORDEM_NOVA, para(b)))
const FASE: Record<string, string> = { PRE_VENDA: 'Pré-venda', VENDA: 'Venda', FECHAMENTO: 'Fechamento' }
const nomeEtapa = (s: string) => {
  const [de, para] = s.split('→')
  if (de === 'PERDIDO') return `Perdido → continua perdido, marcado na etapa ${ETAPA[para] ?? para}`
  return [de, para].map(p => p.replace(/^([A-Z_]+)/, m => ETAPA[m] ?? m)).join(' → ')
}

export function MigracaoJornada() {
  const [sim, setSim] = useState<SimulacaoJornada | null>(null)
  const [st, setSt] = useState<StatusJornada | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = async () => {
    setErro(null)
    try { const [a, b] = await Promise.all([proLaboreApi.sistema.jornada.simulacao(), proLaboreApi.sistema.jornada.status()]); setSim(a); setSt(b) } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível simular') }
  }
  useEffect(() => { void carregar() }, [])

  async function rodar(acao: 'rodada' | 'desfazer') {
    const msg = acao === 'rodada'
      ? `Aplicar a migração em ${num(sim?.aMigrar ?? 0)} leads e criar ${num(sim?.clientes.aCriar ?? 0)} clientes? Tudo fica registrado na auditoria e pode ser desfeito.`
      : 'Desfazer a migração e voltar os leads às 5 etapas?'
    if (!window.confirm(msg)) return
    setOcupado(true); setErro(null)
    try {
      let s: StatusJornada, falhas = 0
      for (let i = 0; i < 400; i++) {
        try { s = await proLaboreApi.sistema.jornada[acao](); setSt(s); falhas = 0 } catch (e) {
          if (++falhas >= 4) throw e
          await new Promise(r => setTimeout(r, 3000 * falhas)); continue
        }
        if (acao === 'rodada' ? s.pendentes === 0 : s.migrados === 0 || s.conferencia.length === 0) break
      }
    } catch (e) { setErro(e instanceof Error ? e.message : 'A migração parou') }
    finally { setOcupado(false); void carregar() }
  }

  if (!sim && !erro) return null
  return (
    <section className="pl-card" id="jornada" style={{ marginBottom: 20 }} data-migracao-jornada>
      <div className="pl-card-head">
        <div>
          <div className="pl-card-title">Nova jornada de compra · migração</div>
          <div className="pl-card-sub">Passa os leads das 5 etapas para as 10 da nova jornada e cria o cadastro de cada cliente (o mesmo telefone vira um cliente só). Primeiro a simulação, que não grava nada.</div>
        </div>
      </div>
      {erro && <div className="pl-alert" role="alert">{erro}</div>}
      {sim && (
        <>
          <p data-sim-resumo><b>{num(sim.total)}</b> leads · <b>{num(sim.aMigrar)}</b> a migrar · {num(sim.jaMigrados)} já migrados.{' '}
            {sim.conferencia.nenhumPerdido ? <span className="pl-chip" style={{ color: "var(--pl-success, #2a7)" }}>nenhum lead fica de fora</span> : <span className="pl-chip" style={{ color: "var(--pl-danger, #c33)" }}>a soma não fecha</span>}</p>
          {sim.aMigrar > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 16 }}>
              <div>
                <div className="pl-eyebrow">Etapa antiga → etapa nova{sim.jaMigrados > 0 ? ' · só o que falta migrar' : ''}</div>
                <div style={{ overflowX: 'auto' }}><table className="pl-table" data-sim-pares><tbody>{naOrdem(sim.pares, p => p.de.split('→')[0], p => p.de.split('→')[1]).map(p => <tr key={p.de}><td>{nomeEtapa(p.de)}</td><td style={{ textAlign: 'right' }}>{num(p.n)}</td></tr>)}</tbody></table></div>
                {sim.revisarEtapa > 0 && <p className="pl-hint">{num(sim.revisarEtapa)} fechados sem venda confirmada vão para Proposta com a marcação “revisar etapa”, para o vendedor posicionar.</p>}
                <p className="pl-hint">Levantamento: {num(sim.levantamento.aVista)} à vista e {num(sim.levantamento.financiado)} financiados pelas etiquetas da conversa; {num(sim.levantamento.semInformacao)} sem informação. Todos ficam com o levantamento incompleto (falta a CNH).</p>
              </div>
              <div>
                <div className="pl-eyebrow">Clientes</div>
                <p data-sim-clientes><b>{num(sim.clientes.aCriar)}</b> clientes a criar ({num(sim.clientes.comTelefone)} por telefone, {num(sim.clientes.semTelefone)} leads sem telefone). {num(sim.clientes.telefonesRepetidos)} telefones têm mais de um lead: {num(sim.clientes.leadsJuntados)} leads viram oportunidades desses clientes.</p>
                {sim.clientes.exemplos.length > 0 && <div style={{ overflowX: 'auto' }}><table className="pl-table"><tbody>{sim.clientes.exemplos.map(c => <tr key={c.telefone + c.nome}><td>{c.nome}</td><td>{c.telefone}</td><td style={{ textAlign: 'right' }}>{c.leads} leads</td></tr>)}</tbody></table></div>}
                {sim.perdidos > 0 && (<>
                  <div className="pl-eyebrow" style={{ marginTop: 12 }}>Perdidos ({num(sim.perdidos)}): motivo antigo → novo → destino</div>
                  <div style={{ overflowX: 'auto' }}><table className="pl-table" data-sim-motivos><tbody>{sim.motivos.map(m => <tr key={m.antigo + m.novo}><td>{MOTIVO[m.antigo] ?? m.antigo}</td><td>{MOTIVO[m.novo] ?? m.novo}</td><td>{DESTINO[m.destino] ?? m.destino}</td><td style={{ textAlign: 'right' }}>{num(m.n)}</td></tr>)}</tbody></table></div>
                </>)}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {sim.permitido ? (<>
              {sim.aMigrar > 0 && <button type="button" className="pl-btn pl-btn-primary" disabled={ocupado} onClick={() => void rodar('rodada')} data-aplicar-migracao>{ocupado ? 'Migrando…' : sim.jaMigrados > 0 ? 'Continuar a migração' : 'Aplicar a migração'}</button>}
              {(st?.migrados ?? 0) > 0 && <button type="button" className="pl-btn pl-btn-ghost" disabled={ocupado} onClick={() => void rodar('desfazer')} data-desfazer-migracao>Desfazer</button>}
            </>) : <p className="pl-hint" data-sim-bloqueada>Na produção a migração só roda depois do teste e da sua liberação; aqui fica só a simulação.</p>}
          </div>
          {st && st.migrados > 0 && (
            <div style={{ marginTop: 16 }} data-jornada-10>
              <div className="pl-eyebrow">Como ficou a nova jornada ({num(st.migrados)} leads migrados{st.pendentes ? `, faltam ${num(st.pendentes)}` : ''})</div>
              <div style={{ overflowX: 'auto' }}><table className="pl-table"><thead><tr><th>Fase</th><th>Etapa</th><th style={{ textAlign: 'right' }}>No funil</th><th style={{ textAlign: 'right' }}>Perdidos nela</th></tr></thead>
                <tbody>{st.jornada.map((j, i) => <tr key={j.etapa}><td>{FASE[j.fase]}</td><td>{i + 1}. {ETAPA[j.etapa]}</td><td style={{ textAlign: 'right' }}>{num(j.ativos)}</td><td style={{ textAlign: 'right' }}>{num(j.perdidos)}</td></tr>)}</tbody></table></div>
              <p className="pl-hint">Levantamento, MQL, SQL, Agendamento e Visita começam vazias: no funil antigo não havia essas etapas, então nenhum lead entra nelas pela migração. Os leads passam por elas daqui para a frente, conforme avançam. O CRM já mostra o quadro com as 10 colunas.</p>
            </div>
          )}
          {st && st.migrados > 0 && (
            <div style={{ marginTop: 12 }} data-conferencia-migracao>
              <div className="pl-eyebrow">Conferência ({num(st.migrados)} de {num(st.total)} migrados · {num(st.clientes)} clientes{st.semCliente ? ` · ${num(st.semCliente)} sem cliente` : ''})</div>
              <div style={{ overflowX: 'auto' }}><table className="pl-table"><thead><tr><th>Etapa antiga</th><th>Etapa nova</th><th style={{ textAlign: 'right' }}>Leads</th></tr></thead>
                <tbody>{naOrdem(st.conferencia, c => c.de, c => c.para).map(c => <tr key={`${c.de}${c.para}${c.revisarEtapa}`}><td>{ETAPA[c.de ?? ''] ?? c.de}</td><td>{ETAPA[c.para ?? ''] ?? c.para}{c.revisarEtapa ? ' (revisar etapa)' : ''}</td><td style={{ textAlign: 'right' }}>{num(c.n)}</td></tr>)}</tbody></table></div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
