'use client'

// PDF 02 · seção 9: teste de aceite com os dados reais, calculado na
// produção. Cada item diz o que foi medido e se passa. As 20 conversas são
// para o dono conferir a hora registrada contra a hora no WhatsApp.
import { useState } from 'react'
import { qualidadeApi, type AceitePdf02 as Aceite } from '@/lib/proLaboreApi'

const hora = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—')
const ETAPA: Record<string, string> = { LEMBRETE: 'Lembretes', ALERTA: 'Alertas no vencimento', ALERTA_2: 'Novos alertas (2 h)', ESCALONAMENTO: 'Escalonamentos (24 h)' }
const ORIGEM: Record<string, string> = { ANUNCIO: 'Anúncio', POST: 'Post', DIRECT_COMENTARIO: 'Direct ou comentário', ORGANICO: 'Orgânico', LISTA: 'Lista fechada', DESCONHECIDA: 'Desconhecida', 'SEM ORIGEM': 'Sem origem' }

function Selo({ passa, texto }: { passa: boolean | null; texto?: string }) {
  if (passa == null) return <span className="pl-hint">{texto ?? 'conferência manual'}</span>
  return <span className={`pl-chip-faixa ${passa ? 'pl-faixa-bom' : 'pl-faixa-critico'}`}>{texto ?? (passa ? 'Passa' : 'Não passa')}</span>
}

export function AceitePdf02() {
  const [a, setA] = useState<Aceite | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  async function rodar() {
    setErro(null); setCarregando(true)
    try { setA(await qualidadeApi.aceitePdf02()) } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível rodar') } finally { setCarregando(false) }
  }
  const brl = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: 2 }))
  return (
    <section className="pl-card" id="aceite-pdf02" style={{ marginBottom: 20 }} data-aceite-pdf02>
      <div className="pl-card-head"><div>
        <div className="pl-card-title">Aceite do PDF 02 · dados reais</div>
        <div className="pl-card-sub">Teste da seção 9 calculado na produção, desde a ida em modo paralelo.</div>
      </div>
        <button type="button" className="pl-btn" onClick={() => void rodar()} disabled={carregando} data-rodar-aceite>{carregando ? 'Calculando…' : a ? 'Rodar de novo' : 'Rodar o aceite'}</button>
      </div>
      {erro && <div className="pl-alert" role="alert">{erro}</div>}
      {a && (
        <div style={{ display: 'grid', gap: 18 }}>
          <div data-aceite="metricas">
            <div className="pl-eyebrow">1. Métricas do dicionário · {a.metricas.periodo.inicio.split('-').reverse().join('/')} a {a.metricas.periodo.fim.split('-').reverse().join('/')} <Selo passa={a.metricas.passa} /></div>
            <table className="pl-table"><thead><tr><th>Métrica</th><th>Dicionário</th><th>Registros originais</th><th /></tr></thead>
              <tbody>{a.metricas.itens.map(m => <tr key={m.chave}><td>{m.nome}</td><td>{m.erro ? `erro: ${m.erro}` : brl(m.valor)}</td><td>{brl(m.original)}</td><td><Selo passa={m.bate} texto={m.bate == null ? 'calculada' : undefined} /></td></tr>)}</tbody></table>
          </div>
          <div data-aceite="conversas">
            <div className="pl-eyebrow">2. Tempo de primeira resposta · confira as {a.conversas.length} conversas no WhatsApp <Selo passa={null} /></div>
            {a.conversas.length === 0 ? <p className="pl-hint">Ainda não há conversas com resposta depois de 08/11.</p> : (
              <table className="pl-table"><thead><tr><th>#</th><th>Contato</th><th>Número de</th><th>1ª mensagem do cliente</th><th>1ª resposta da loja</th><th>Minutos</th></tr></thead>
                <tbody>{a.conversas.map((c, i) => <tr key={i}><td>{i + 1}</td><td>{c.contato ?? '—'}</td><td>{c.vendedor ?? '—'}</td><td>{hora(c.clienteEm)}</td><td>{hora(c.respostaEm)}</td><td>{c.minutos ?? '—'}</td></tr>)}</tbody></table>
            )}
          </div>
          <div data-aceite="tarefas">
            <div className="pl-eyebrow">3. Migração das tarefas <Selo passa={a.tarefas.passa} /></div>
            <table className="pl-table"><thead><tr><th>Tipo</th><th>Hoje</th><th>Na ATV</th><th>Sem data</th><th>Sem autor</th></tr></thead>
              <tbody>{a.tarefas.itens.map(t => <tr key={t.tipo}><td>{t.tipo}</td><td>{t.atual}</td><td>{t.atv}</td><td>{t.semData}</td><td>{t.semAutor}</td></tr>)}</tbody></table>
          </div>
          <div data-aceite="regua">
            <div className="pl-eyebrow">4. Régua de cobrança (modo de registro) <Selo passa={a.regua.passa} /></div>
            <p style={{ margin: '4px 0' }}>{Object.keys(ETAPA).map(k => `${ETAPA[k]}: ${a.regua.porEtapa[k] ?? 0}`).join(' · ')}</p>
            <p className="pl-hint" style={{ margin: 0 }}>Alertas registrados depois da atividade feita: {a.regua.depoisDeFeita} · fora do tempo certo: {a.regua.foraDoTempo} (sem contar o que venceu de madrugada, quando o sistema descansa)</p>
          </div>
          <div data-aceite="origem">
            <div className="pl-eyebrow">5. Origem dos leads criados depois de 08/11 <Selo passa={a.origem.passa} /></div>
            <p style={{ margin: '4px 0' }}>{a.origem.porTipo.length ? a.origem.porTipo.map(o => `${ORIGEM[o.tipo] ?? o.tipo}: ${o.total}`).join(' · ') : 'Nenhum lead novo ainda.'}</p>
            {a.origem.desconhecidas > 0 && <p className="pl-hint" style={{ margin: 0 }}>{a.origem.desconhecidas} com origem desconhecida: estão na Saúde dos dados para o responsável escolher a origem.</p>}
          </div>
          <p className="pl-hint" style={{ margin: 0 }}>Permissões (6) e sistema atual (7) se conferem entrando com um usuário de cada perfil e usando as telas de sempre.</p>
        </div>
      )}
    </section>
  )
}
