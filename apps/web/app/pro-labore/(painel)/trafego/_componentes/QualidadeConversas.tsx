'use client'

// Qualidade das conversas que o anúncio gerou. Quando a Meta manda a
// profundidade (2, 3 e 5+ mensagens da pessoa — Messenger e Direct), mostra
// quantas passaram da mensagem pronta. Quando não manda (o caso comum do
// WhatsApp), mede a qualidade pelo que dá pra medir: quantas conversas viraram
// lead no CRM, quanto custou cada uma e quantas terminaram em bloqueio — e
// lista o que a Meta mandou, pra ficar claro de onde vem cada número.
import type { AnaliseTrafego } from '@/lib/proLaboreApi'
import { moeda, num, pct } from './formato'

const NOME_ACAO: Record<string, string> = {
  'onsite_conversion.messaging_conversation_started_7d': 'Conversas iniciadas',
  'onsite_conversion.messaging_conversation_replied_7d': 'Conversas respondidas',
  'onsite_conversion.messaging_first_reply': 'Primeira resposta',
  'onsite_conversion.messaging_user_depth_2_message_send': '2+ mensagens da pessoa',
  'onsite_conversion.messaging_user_depth_3_message_send': '3+ mensagens da pessoa',
  'onsite_conversion.messaging_user_depth_5_message_send': '5+ mensagens da pessoa',
  'onsite_conversion.messaging_block': 'Bloqueios',
  'onsite_conversion.total_messaging_connection': 'Conexões por mensagem',
  'onsite_conversion.messaging_welcome_message_view': 'Viram a mensagem de boas-vindas',
}

function AcoesDaMeta({ analise }: { analise: AnaliseTrafego }) {
  const a = analise.conta.acoesMeta
  if (!a) return null
  const msgs = Object.entries(a.totais).filter(([k]) => /messag|conversation|reply|whatsapp/i.test(k)).sort((x, y) => y[1] - x[1])
  if (!msgs.length) return null
  const d = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`
  return (
    <details className="pl-tf-acoes-meta">
      <summary>O que a Meta mandou sobre mensagens ({d(a.desde)}–{d(a.ate)})</summary>
      <ul>
        {msgs.map(([k, v]) => <li key={k}><span>{NOME_ACAO[k] ?? k}</span><b>{num(v)}</b></li>)}
      </ul>
    </details>
  )
}

export default function QualidadeConversas({ analise }: { analise: AnaliseTrafego }) {
  const t = analise.totais, ta = analise.totaisAnterior, d = analise.derivadas
  const c = analise.conta.moeda
  if (t.conversas <= 0) return null
  const temProfundidade = t.conversasProf2 > 0

  if (!temProfundidade) {
    // Sem profundidade: conversa → lead no CRM (só sem filtro de campanha,
    // porque o CRM não sabe de qual campanha o lead veio).
    const crm = analise.crm.leads
    const contatos = t.conversas + t.leads
    const taxa = crm != null && contatos > 0 ? crm / contatos : null
    const custoConv = d.custoConversa
    const tiles = [
      { rotulo: 'Conversas iniciadas', valor: num(t.conversas), nota: `${moeda(custoConv, c)} cada`, ant: ta.conversas ? `antes ${num(ta.conversas)}` : null },
      ...(crm != null ? [{ rotulo: 'Viraram lead no CRM', valor: pct(taxa), nota: `${num(crm)} leads de ${num(contatos)} ${t.leads ? 'contatos' : 'conversas'}`, ant: null }] : []),
      ...(crm ? [{ rotulo: 'Custo por lead no CRM', valor: moeda(t.gasto / crm, c), nota: `contra ${moeda(custoConv, c)} por conversa`, ant: null }] : []),
      { rotulo: 'Bloqueios', valor: num(t.bloqueios), nota: t.bloqueios ? `${pct(d.taxaBloqueio)} das conversas` : 'nenhum registrado', ant: null },
    ]
    return (
      <div className="pl-card pl-tf-conversas">
        <div className="pl-card-title">Qualidade das conversas</div>
        <div className="pl-card-sub">
          A Meta não mandou quantas mensagens cada pessoa trocou nessas conversas (essa medida costuma vir só no Messenger e no Direct).
          {crm != null ? ' No WhatsApp, a qualidade aparece em quantas conversas viram lead no CRM.' : ' Tire o filtro de campanha pra comparar com os leads do CRM.'}
        </div>
        <div className="pl-tf-conv-tiles">
          {tiles.map(x => (
            <div key={x.rotulo}>
              <small>{x.rotulo}</small>
              <b>{x.valor}</b>
              <span>{x.nota}{x.ant && <> · {x.ant}</>}</span>
            </div>
          ))}
        </div>
        {taxa != null && (
          <div className="pl-tf-conv-medidor" role="img" aria-label={`${pct(taxa)} das conversas viraram lead no CRM`}>
            <span style={{ width: `${Math.min(100, taxa * 100)}%` }} />
            <i style={{ left: '70%' }} title="Referência: 70%" />
          </div>
        )}
        {taxa != null && <div className="pl-tf-conv-legenda"><span>0%</span><span>referência 70%</span><span>100%</span></div>}
        <AcoesDaMeta analise={analise} />
      </div>
    )
  }

  const etapas = [
    { nome: 'Conversas iniciadas', valor: t.conversas, ant: ta.conversas, nota: 'Abriram a conversa pelo anúncio' },
    { nome: '2+ mensagens', valor: t.conversasProf2, ant: ta.conversasProf2, nota: 'Passaram da mensagem pronta' },
    { nome: '3+ mensagens', valor: t.conversasProf3, ant: ta.conversasProf3, nota: 'Conversa de verdade' },
    { nome: '5+ mensagens', valor: t.conversasProf5, ant: ta.conversasProf5, nota: 'Negociação em andamento' },
  ]
  return (
    <div className="pl-card pl-tf-conversas">
      <div className="pl-card-title">Qualidade das conversas</div>
      <div className="pl-card-sub">Quantas mensagens a pessoa mandou depois de abrir a conversa (dado da Meta)</div>
      <ol className="pl-tf-conv-lista">
        {etapas.map((e, i) => {
          const frac = e.valor / t.conversas
          const custo = e.valor > 0 ? t.gasto / e.valor : null
          const fracAnt = ta.conversas > 0 ? e.ant / ta.conversas : null
          return (
            <li key={e.nome}>
              <div className="pl-tf-conv-rotulo"><b>{e.nome}</b><small>{e.nota}</small></div>
              <div className="pl-tf-conv-barra" role="img" aria-label={`${pct(frac)} das conversas`}>
                <span style={{ width: `${Math.max(1, frac * 100)}%` }} />
              </div>
              <div className="pl-tf-conv-num">
                <b>{num(e.valor)}</b>
                <small>{i === 0 ? '100%' : pct(frac)}{i > 0 && fracAnt != null && <> · antes {pct(fracAnt)}</>}</small>
              </div>
              <div className="pl-tf-conv-custo"><small>custo</small><b>{moeda(custo, c)}</b></div>
            </li>
          )
        })}
      </ol>
      <div className="pl-tf-conv-rodape">
        <span>Bloqueios: <b>{num(t.bloqueios)}</b> ({pct(d.taxaBloqueio)})</span>
        <span>Custo por conversa engajada: <b>{moeda(d.custoConversaEngajada, c)}</b></span>
      </div>
      <AcoesDaMeta analise={analise} />
    </div>
  )
}
