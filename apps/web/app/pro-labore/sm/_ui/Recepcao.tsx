'use client'

// Recepção do cabeçalho da tela Hoje (seção 14, protótipo Recepcao.html):
// kicker, a saudação do momento, uma frase com o que muda o dia, o CTA,
// 3 cartões e as perguntas sugeridas para o assistente. Depois da primeira
// ação, recolhe numa linha (com "Abrir" para ver de novo).
import { useState, type ReactNode } from 'react'
import type { SmAbaAssistente, SmRecepcao } from '@/lib/proLaboreApi'
import { BotaoLink, Chip, Rotulo } from './componentes'
import { ConversaAssistente } from './Assistente'

export function Recepcao({ r, acoes, ia, aoAgir, previa }: {
  r: SmRecepcao
  /** Botões fixos do cabeçalho (ex.: "Nova pauta"). */
  acoes?: ReactNode
  /** IA ligada: a conversa aceita perguntas livres. */
  ia: boolean
  /** O CTA conta como a primeira ação do dia. */
  aoAgir?: () => void
  /** Simulador: sem recolher e sem navegar. */
  previa?: boolean
}) {
  const [aberta, setAberta] = useState(!r.recolhida)
  const [pergunta, setPergunta] = useState<{ aba: SmAbaAssistente; id: string; texto: string } | null>(null)

  if (!aberta) {
    return (
      <section className="sm-recepcao recolhida" aria-label="Recepção">
        <div className="sm-recepcao-linha">
          <Rotulo>{r.kicker}</Rotulo>
          <span className="sm-recepcao-linha-texto"><b>{r.titulo}</b> {r.sub}</span>
        </div>
        <div className="sm-recepcao-acoes">
          <button type="button" className="sm-assist-alternar" aria-expanded={false} onClick={() => setAberta(true)}>Abrir</button>
          {acoes}
        </div>
      </section>
    )
  }
  return (
    <section className="sm-recepcao" aria-label="Recepção">
      <div className="sm-recepcao-topo">
        <div className="sm-recepcao-texto">
          <Rotulo>{r.kicker}</Rotulo>
          <h1 className="sm-ttl sm-recepcao-titulo">{r.titulo}</h1>
          <p className="sm-recepcao-sub">{r.sub}</p>
          {r.cta && (previa
            ? <span className="sm-btn pri sm-recepcao-cta" aria-disabled="true">{r.cta.rotulo}</span>
            : <BotaoLink href={r.cta.href} variante="pri" className="sm-recepcao-cta" onClick={aoAgir}
              {...(r.cta.href === '/pro-labore/sm/foco' ? { title: `${r.cta.rotulo} (atalho: F)`, atalho: 'F' } : {})}>{r.cta.rotulo}</BotaoLink>)}
        </div>
        <div className="sm-recepcao-acoes">
          {acoes}
          {!previa && <button type="button" className="sm-assist-alternar" aria-expanded onClick={() => setAberta(false)}>Recolher</button>}
        </div>
      </div>
      {r.itens.length > 0 && (
        <section className="sm-recepcao-lista" aria-label={r.listaTitulo}>
          <Rotulo>{r.listaTitulo}</Rotulo>
          <div className="sm-recepcao-itens">
            {r.itens.map((i, k) => (
              <div key={k} className="sm-recepcao-item">
                <Chip tom={i.tom}>{i.rotulo}</Chip>
                <span>{i.texto}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      {r.perguntas.length > 0 && (
        <div className="sm-recepcao-perguntar">
          <div className="sm-assist-perguntas" role="group" aria-label="Perguntas sugeridas">
            <span className="sm-assist-pergunte">Pergunte:</span>
            {r.perguntas.map(q => (
              <button key={q.id} type="button" className="sm-assist-pergunta" aria-pressed={pergunta?.id === q.id} onClick={() => setPergunta(q)}>{q.texto}</button>
            ))}
          </div>
          {pergunta && <ConversaAssistente key={pergunta.id} aba={pergunta.aba} inicial={pergunta} livre={ia} aoFechar={() => setPergunta(null)} />}
        </div>
      )}
    </section>
  )
}
