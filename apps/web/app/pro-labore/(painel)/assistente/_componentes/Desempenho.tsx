'use client'

import { useState } from 'react'
import type { ResumoAssistente } from '@/lib/proLaboreApi'
import { CartaoViz, EstadoTooltip, LinhaTip, Tooltip, Vazio, fmtDiaMes, fmtNum, fmtPct, ticksBonitos, useLargura } from '../../social-media/_componentes/viz'
import { ORIGEM, RESULTADO, ROTULO_ESTAGIO, fmtMinutos } from './util'

function Kpi({ rotulo, valor, nota, destaque }: { rotulo: string; valor: string; nota?: React.ReactNode; destaque?: boolean }) {
  return (
    <div className={`pl-kpi pl-sv-kpi ${destaque ? 'pl-as-kpi-alerta' : ''}`}>
      <div className="pl-kpi-label">{rotulo}</div>
      <div className="pl-kpi-value">{valor}</div>
      {nota && <div className="pl-sv-kpi-nota">{nota}</div>}
    </div>
  )
}

export function KpisAssistente({ resumo }: { resumo: ResumoAssistente }) {
  const t = resumo.totais
  const tr = resumo.tempoResposta
  return (
    <div className="pl-sv-kpis pl-as-kpis">
      <Kpi rotulo="Leads atendidos" valor={fmtNum(t.atendidos)} nota={`Contatos novos que o assistente recebeu em ${resumo.periodo.dias} dias`} />
      <Kpi
        rotulo="Concluíram o roteiro"
        valor={resumo.taxaConclusao != null ? fmtPct(resumo.taxaConclusao, 0) : '—'}
        nota={t.atendidos > 0 ? `${fmtNum(t.qualificados)} responderam tudo · ${fmtNum(t.pediramAtendente)} pediram atendente` : 'Sem atendimentos no período'}
      />
      <Kpi
        rotulo="Esperando você agora"
        valor={fmtNum(t.aguardandoAgora)}
        destaque={t.aguardandoAgora > 0}
        nota={t.aguardandoAgora > 0 ? 'Leads prontos pra atendimento — responda pelo WhatsApp ou pela aba Conversas' : 'Nenhum lead parado na fila'}
      />
      <Kpi
        rotulo="Tempo até você responder"
        valor={fmtMinutos(tr.medianaMin)}
        nota={tr.amostras > 0 ? `Mediana de ${tr.amostras} conversa${tr.amostras > 1 ? 's' : ''} · ${fmtPct(tr.ate15MinPct, 0)} em até 15 min` : 'Aparece quando você assumir a primeira conversa'}
      />
      <Kpi rotulo="Leads no CRM" valor={fmtNum(t.leadsNoCrm)} nota="Criados ou ligados pelo assistente" />
      <Kpi rotulo="Vendas fechadas" valor={fmtNum(t.vendas)} nota="Leads do assistente que chegaram a “Fechado” no CRM" />
    </div>
  )
}

const ALTURA = 220
const MARGEM = { topo: 12, dir: 8, base: 34, esq: 34 }

export function AtendimentosPorDia({ resumo, recarregando }: { resumo: ResumoAssistente; recarregando?: boolean }) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const [ativo, setAtivo] = useState<number | null>(null)
  const serie = resumo.serie
  const n = serie.length
  const w = Math.max(0, largura - MARGEM.esq - MARGEM.dir)
  const h = ALTURA - MARGEM.topo - MARGEM.base
  const ticks = ticksBonitos(Math.max(1, ...serie.map(s => s.atendidos)))
  const topo = ticks[ticks.length - 1]
  const passo = n > 0 ? w / n : 0
  const larguraBarra = Math.max(2, Math.min(28, passo - (passo > 8 ? 3 : 1)))
  const y = (v: number) => MARGEM.topo + h - (v / topo) * h
  const base = MARGEM.topo + h
  const cada = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 58))))

  let tip: EstadoTooltip | null = null
  if (ativo != null && serie[ativo]) {
    const s = serie[ativo]
    tip = {
      x: MARGEM.esq + passo * ativo + passo / 2,
      y: y(s.atendidos),
      conteudo: (
        <>
          <div className="pl-sv-tip-titulo">{fmtDiaMes(s.data)}</div>
          <LinhaTip cor="var(--sv-seq-2)" valor={fmtNum(s.atendidos)} rotulo="atendidos" />
          <LinhaTip cor="var(--sv-seq-5)" valor={fmtNum(s.concluidos)} rotulo="concluíram o roteiro" />
        </>
      ),
    }
  }
  const total = serie.reduce((a, s) => a + s.atendidos, 0)

  return (
    <CartaoViz
      titulo="Atendimentos por dia"
      subtitulo="Leads novos que o assistente atendeu e quantos concluíram o roteiro"
      recarregando={recarregando}
      tabela={{ colunas: ['Dia', 'Atendidos', 'Concluíram'], linhas: serie.map(s => [fmtDiaMes(s.data), s.atendidos, s.concluidos]) }}
    >
      {total === 0 ? <Vazio>Nenhum lead atendido nesse período.</Vazio> : (
        <div ref={ref} style={{ position: 'relative' }}>
          {largura > 0 && (
            <svg className="pl-sv-svg" width={largura} height={ALTURA} role="img" aria-label="Atendimentos por dia" onPointerLeave={() => setAtivo(null)}>
              {ticks.map(t => (
                <g key={t}>
                  <line className="grade" x1={MARGEM.esq} x2={MARGEM.esq + w} y1={y(t)} y2={y(t)} />
                  <text className="eixo" x={MARGEM.esq - 6} y={y(t) + 3.5} textAnchor="end">{fmtNum(t)}</text>
                </g>
              ))}
              {serie.map((s, i) => {
                const x = MARGEM.esq + passo * i + (passo - larguraBarra) / 2
                const outros = s.atendidos - s.concluidos
                return (
                  <g key={s.data} opacity={ativo == null || ativo === i ? 1 : 0.55}>
                    {s.concluidos > 0 && <rect x={x} y={y(s.concluidos)} width={larguraBarra} height={base - y(s.concluidos)} rx={Math.min(3, larguraBarra / 3)} fill="var(--sv-seq-5)" />}
                    {outros > 0 && <rect x={x} y={y(s.atendidos)} width={larguraBarra} height={Math.max(0, y(s.concluidos) - y(s.atendidos) - (s.concluidos > 0 ? 2 : 0))} rx={Math.min(3, larguraBarra / 3)} fill="var(--sv-seq-2)" />}
                    <rect x={MARGEM.esq + passo * i} y={MARGEM.topo} width={passo} height={h} fill="transparent" onPointerEnter={() => setAtivo(i)} />
                  </g>
                )
              })}
              <line className="base" x1={MARGEM.esq} x2={MARGEM.esq + w} y1={base} y2={base} />
              {serie.map((s, i) => (i % cada === 0) && (
                <text key={`r${s.data}`} className="eixo" x={MARGEM.esq + passo * i + passo / 2} y={base + 18} textAnchor="middle">{fmtDiaMes(s.data)}</text>
              ))}
            </svg>
          )}
          <Tooltip estado={tip} largura={largura} />
          <div className="pl-sv-legenda">
            <span><i className="ponto" style={{ background: 'var(--sv-seq-5)' }} />Concluíram o roteiro</span>
            <span><i className="ponto" style={{ background: 'var(--sv-seq-2)' }} />Não concluíram (ainda)</span>
          </div>
        </div>
      )}
    </CartaoViz>
  )
}

// Funil do roteiro: onde os leads param de responder. Barras de um tom só
// (é magnitude de uma série), com a queda de uma etapa pra outra em texto.
export function FunilRoteiro({ resumo, recarregando }: { resumo: ResumoAssistente; recarregando?: boolean }) {
  const f = resumo.funilRoteiro
  const inicio = f[0]?.total ?? 0
  const maiorQueda = f.slice(1).reduce<{ i: number; queda: number } | null>((m, e, i) => {
    const queda = f[i].total - e.total
    return queda > 0 && (!m || queda > m.queda) ? { i: i + 1, queda } : m
  }, null)
  return (
    <CartaoViz
      titulo="Onde os leads param no roteiro"
      subtitulo="Quantos responderam cada pergunta — a maior queda é a pergunta a revisar"
      recarregando={recarregando}
      tabela={{ colunas: ['Etapa', 'Leads', '% de quem começou'], linhas: f.map(e => [e.rotulo, e.total, fmtPct(inicio > 0 ? e.total / inicio : 0, 0)]) }}
      rodape={maiorQueda && inicio >= 5 ? `Maior perda: ${fmtNum(maiorQueda.queda)} ${maiorQueda.queda === 1 ? 'lead parou' : 'leads pararam'} em “${f[maiorQueda.i].rotulo}”. Vale deixar essa pergunta mais curta ou oferecer opções pra escolher.` : undefined}
    >
      {inicio === 0 ? <Vazio>O funil aparece quando o primeiro lead for atendido.</Vazio> : (
        <div className="pl-as-funil">
          {f.map((e, i) => (
            <div key={e.rotulo + i} className="pl-as-funil-linha">
              <span className="nome">{i === 0 ? e.rotulo : `${i}. ${e.rotulo}`}</span>
              <span className="pl-sv-hbar-trilho"><span style={{ width: `${Math.max(1.5, (e.total / inicio) * 100)}%`, background: maiorQueda?.i === i ? 'var(--sv-2)' : 'var(--sv-1)' }} /></span>
              <b>{fmtNum(e.total)}</b>
              <small>{fmtPct(e.total / inicio, 0)}</small>
            </div>
          ))}
        </div>
      )}
    </CartaoViz>
  )
}

export function DesfechoEOrigem({ resumo, recarregando }: { resumo: ResumoAssistente; recarregando?: boolean }) {
  const t = resumo.totais
  const desfechos = [
    { rotulo: RESULTADO.QUALIFICADO, valor: t.qualificados },
    { rotulo: RESULTADO.PEDIU_ATENDENTE, valor: t.pediramAtendente },
    { rotulo: 'Ainda respondendo', valor: t.emAndamento },
    { rotulo: 'Pararam de responder (24h+)', valor: t.pararamDeResponder },
    { rotulo: RESULTADO.DESISTIU, valor: t.desistiram },
    { rotulo: RESULTADO.NAO_E_LEAD, valor: t.naoEraLead },
  ]
  const maxD = Math.max(1, ...desfechos.map(d => d.valor))
  const origens = resumo.porOrigem
  const totalOrigem = origens.reduce((a, o) => a + o.total, 0)
  const CORES = ['var(--sv-1)', 'var(--sv-2)', 'var(--sv-3)']
  return (
    <CartaoViz
      titulo="Como terminaram e de onde vieram"
      subtitulo="Resultado de cada conversa do período e o canal que trouxe o lead"
      recarregando={recarregando}
      tabela={{
        colunas: ['Item', 'Conversas', 'Concluíram'],
        linhas: [
          ...desfechos.map(d => [d.rotulo, d.valor, '']),
          ...origens.map(o => [`Origem: ${ORIGEM[o.origem].rotulo}`, o.total, o.total > 0 ? fmtPct(o.concluidos / o.total, 0) : '—']),
        ],
      }}
    >
      {t.atendidos === 0 ? <Vazio>Sem conversas no período.</Vazio> : (
        <div className="pl-sv-grid pl-sv-grid-2-eq" style={{ gap: 28 }}>
          <div>
            <div className="pl-as-subtitulo">Resultado</div>
            {desfechos.map(d => (
              <div key={d.rotulo} className="pl-sv-hbar" style={{ opacity: d.valor === 0 ? 0.5 : 1 }}>
                <span className="nome">{d.rotulo}</span>
                <span className="pl-sv-hbar-trilho"><span style={{ width: `${(d.valor / maxD) * 100}%` }} /></span>
                <b>{fmtNum(d.valor)}</b>
              </div>
            ))}
          </div>
          <div>
            <div className="pl-as-subtitulo">Origem</div>
            {totalOrigem > 0 && (
              <div className="pl-sv-split" role="img" aria-label={origens.map(o => `${ORIGEM[o.origem].rotulo}: ${o.total}`).join(', ')}>
                {origens.map((o, i) => o.total > 0 && <span key={o.origem} style={{ width: `${(o.total / totalOrigem) * 100}%`, background: CORES[i] }} />)}
              </div>
            )}
            <div className="pl-as-origens">
              {origens.map((o, i) => (
                <div key={o.origem} title={ORIGEM[o.origem].descricao}>
                  <i className="pl-sv-chave" style={{ background: CORES[i] }} />
                  <span>{ORIGEM[o.origem].rotulo}</span>
                  <b>{fmtNum(o.total)}</b>
                  <small>{o.total > 0 ? `${fmtPct(o.concluidos / o.total, 0)} concluíram` : '—'}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </CartaoViz>
  )
}

export function HorarioChegada({ resumo, recarregando }: { resumo: ResumoAssistente; recarregando?: boolean }) {
  const [ativo, setAtivo] = useState<number | null>(null)
  const horas = resumo.porHora
  const max = Math.max(1, ...horas.map(h => h.total))
  const total = horas.reduce((a, h) => a + h.total, 0)
  const pico = horas.reduce((m, h) => (h.total > m.total ? h : m), horas[0])
  const foraDoHorario = horas.filter(h => h.hora < 8 || h.hora >= 18).reduce((a, h) => a + h.total, 0)
  return (
    <CartaoViz
      titulo="Quando os leads chegam"
      subtitulo="Primeira mensagem de cada lead por hora do dia (horário de Brasília)"
      recarregando={recarregando}
      tabela={{ colunas: ['Hora', 'Leads'], linhas: horas.map(h => [`${h.hora}h`, h.total]) }}
      rodape={total > 0 ? `Pico às ${pico.hora}h. ${fmtPct(foraDoHorario / total, 0)} chegaram antes das 8h ou depois das 18h — é aí que a resposta automática mais segura o lead.` : undefined}
    >
      {total === 0 ? <Vazio>Sem dados no período.</Vazio> : (
        <div className="pl-as-horas" onPointerLeave={() => setAtivo(null)}>
          {horas.map(h => (
            <div key={h.hora} className="pl-as-hora" onPointerEnter={() => setAtivo(h.hora)} title={`${h.hora}h: ${h.total} lead${h.total === 1 ? '' : 's'}`}>
              <div className="pl-as-hora-trilho">
                <span style={{ height: `${h.total > 0 ? Math.max(4, (h.total / max) * 100) : 0}%`, background: h.hora === pico.hora ? 'var(--sv-1)' : 'var(--sv-seq-2)', opacity: ativo == null || ativo === h.hora ? 1 : 0.5 }} />
              </div>
              <small>{h.hora % 3 === 0 ? `${h.hora}h` : ''}</small>
              {ativo === h.hora && <b className="pl-as-hora-valor">{h.total}</b>}
            </div>
          ))}
        </div>
      )}
    </CartaoViz>
  )
}

export function FunilCrm({ resumo, recarregando }: { resumo: ResumoAssistente; recarregando?: boolean }) {
  const itens = resumo.funilCrm
  const total = itens.reduce((a, e) => a + e.total, 0)
  const max = Math.max(1, ...itens.map(e => e.total))
  return (
    <CartaoViz
      titulo="Do WhatsApp à venda"
      subtitulo="Onde estão hoje, no CRM, os leads que o assistente atendeu no período"
      recarregando={recarregando}
      tabela={{ colunas: ['Etapa do CRM', 'Leads'], linhas: itens.map(e => [ROTULO_ESTAGIO[e.estagio] ?? e.estagio, e.total]) }}
    >
      {total === 0 ? <Vazio>Nenhum lead do assistente no CRM ainda.</Vazio> : itens.map(e => (
        <div key={e.estagio} className="pl-sv-hbar" style={{ opacity: e.total === 0 ? 0.5 : 1 }}>
          <span className="nome">{ROTULO_ESTAGIO[e.estagio] ?? e.estagio}</span>
          <span className="pl-sv-hbar-trilho"><span style={{ width: `${(e.total / max) * 100}%`, background: e.estagio === 'FECHADO' ? 'var(--sv-3)' : e.estagio === 'PERDIDO' ? 'var(--pl-ink-muted)' : 'var(--sv-1)' }} /></span>
          <b>{fmtNum(e.total)}</b>
        </div>
      ))}
    </CartaoViz>
  )
}
