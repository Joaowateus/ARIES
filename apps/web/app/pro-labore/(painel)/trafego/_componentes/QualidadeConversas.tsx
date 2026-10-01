'use client'

// Qualidade das conversas do WhatsApp/Direct que o anúncio gerou: quantas
// passaram da mensagem pronta (2, 3 e 5+ mensagens da pessoa) e quantas
// terminaram em bloqueio. Conversa que não passa da 1ª mensagem é clique
// por curiosidade — o custo que importa é o da conversa engajada.
import type { AnaliseTrafego } from '@/lib/proLaboreApi'
import { moeda, num, pct } from './formato'

export default function QualidadeConversas({ analise }: { analise: AnaliseTrafego }) {
  const t = analise.totais, ta = analise.totaisAnterior
  const c = analise.conta.moeda
  if (t.conversas <= 0) return null
  const semProfundidade = t.conversasProf2 === 0
  const etapas = [
    { nome: 'Conversas iniciadas', valor: t.conversas, ant: ta.conversas, nota: 'Abriram o WhatsApp/Direct pelo anúncio' },
    { nome: '2+ mensagens', valor: t.conversasProf2, ant: ta.conversasProf2, nota: 'Passaram da mensagem pronta' },
    { nome: '3+ mensagens', valor: t.conversasProf3, ant: ta.conversasProf3, nota: 'Conversa de verdade' },
    { nome: '5+ mensagens', valor: t.conversasProf5, ant: ta.conversasProf5, nota: 'Negociação em andamento' },
  ]
  return (
    <div className="pl-card pl-tf-conversas">
      <div className="pl-card-head">
        <div>
          <div className="pl-card-title">Qualidade das conversas</div>
          <div className="pl-card-sub">Quantas mensagens a pessoa mandou depois de abrir a conversa (dado da Meta)</div>
        </div>
      </div>
      {semProfundidade ? (
        <p className="pl-hint" style={{ marginTop: 10 }}>A Meta ainda não mandou a profundidade das conversas desse período (o histórico pode estar carregando).</p>
      ) : (
        <>
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
            <span>Bloqueios: <b>{num(t.bloqueios)}</b> ({pct(analise.derivadas.taxaBloqueio)})</span>
            <span>Custo por conversa engajada: <b>{moeda(analise.derivadas.custoConversaEngajada, c)}</b></span>
          </div>
        </>
      )}
    </div>
  )
}
