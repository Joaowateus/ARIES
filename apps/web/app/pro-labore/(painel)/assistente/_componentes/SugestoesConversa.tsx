'use client'

import { useEffect, useRef, useState } from 'react'
import { proLaboreApi, urlArquivoApi, type FaixaNotaLead, type SinalNotaLead, type SugestaoIAConversa, type SugestoesConversa as Dados } from '@/lib/proLaboreApi'

export const FAIXA: Record<FaixaNotaLead, { rotulo: string; classe: string }> = {
  QUENTE: { rotulo: 'Quente', classe: 'quente' },
  MORNO: { rotulo: 'Morno', classe: 'morno' },
  FRIO: { rotulo: 'Frio', classe: 'frio' },
}

export function faixaDaNota(nota: number): FaixaNotaLead {
  return nota >= 70 ? 'QUENTE' : nota >= 40 ? 'MORNO' : 'FRIO'
}

export function ChipNota({ nota, titulo }: { nota: number; titulo?: string }) {
  const f = FAIXA[faixaDaNota(nota)]
  return (
    <span className={`pl-as-nota ${f.classe}`} title={titulo ?? `Nota do lead pela conversa: ${nota} de 100 (${f.rotulo.toLowerCase()})`} data-nota={nota}>
      <i aria-hidden="true" />{nota} · {f.rotulo}
    </span>
  )
}

/** Quadro da nota na lateral da conversa: o número e o motivo de cada ponto. */
export function NotaDoLead({ nota, sinais }: { nota: number | null | undefined; sinais: SinalNotaLead[] | null | undefined }) {
  if (nota === null || nota === undefined) return null
  const f = FAIXA[faixaDaNota(nota)]
  return (
    <div className={`pl-as-nota-quadro ${f.classe}`} data-nota-quadro>
      <div className="pl-as-subtitulo">Nota do lead</div>
      <div className="pl-as-nota-numero"><b className="pl-mono">{nota}</b><span>/100 · {f.rotulo}</span></div>
      <div className="pl-sv-meter" aria-hidden="true"><span style={{ width: `${nota}%` }} /></div>
      {(sinais?.length ?? 0) > 0 && (
        <ul className="pl-as-sinais">
          {sinais!.map(s => (
            <li key={s.chave} className={s.pontos < 0 ? 'menos' : ''}><span>{s.rotulo}</span><b className="pl-mono">{s.pontos > 0 ? `+${s.pontos}` : s.pontos}</b></li>
          ))}
        </ul>
      )}
    </div>
  )
}

const TIPO: Record<string, string> = { DUVIDA: 'Dúvida', OBJECAO: 'Objeção', ARGUMENTO: 'Argumento', GATILHO: 'Gatilho' }

/**
 * Faixa acima da caixa de resposta: respostas aprovadas da base para o que
 * o cliente acabou de perguntar e, sob demanda, a sugestão da IA.
 */
export function SugestoesConversa({ conversaId, versao, onUsar, onEnviarMoto }: { conversaId: string; versao: number; onUsar: (texto: string, conhecimentoId?: string) => void; onEnviarMoto?: (motoId: string) => Promise<void> }) {
  const [dados, setDados] = useState<{ chave: string; d: Dados } | null>(null)
  const [ia, setIa] = useState<{ chave: string; s: SugestaoIAConversa } | null>(null)
  const [pedindo, setPedindo] = useState(false)
  const [erro, setErro] = useState('')
  const [fechada, setFechada] = useState(false)
  const [enviandoMoto, setEnviandoMoto] = useState<string | null>(null)
  const listaRef = useRef<HTMLDivElement>(null)
  const chave = `${conversaId}|${versao}`

  useEffect(() => {
    let cancelado = false
    proLaboreApi.assistente.sugestoes(conversaId)
      .then(d => { if (!cancelado) setDados({ chave, d }) })
      .catch(() => undefined)
    return () => { cancelado = true }
  }, [conversaId, chave])

  async function pedirIA() {
    setPedindo(true)
    setErro('')
    try {
      setIa({ chave: conversaId, s: await proLaboreApi.assistente.sugestaoIA(conversaId) })
      listaRef.current?.scrollTo({ left: 0 })
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setPedindo(false)
    }
  }

  const sugestoes = dados?.chave === chave ? dados.d.sugestoes : dados?.d.sugestoes ?? []
  const motos = dados?.d.motos ?? []
  async function enviarMoto(id: string) {
    if (!onEnviarMoto) return
    setEnviandoMoto(id)
    try { await onEnviarMoto(id) } finally { setEnviandoMoto(null) }
  }
  const daIA = ia?.chave === conversaId ? ia.s : null
  if (fechada) {
    return <button type="button" className="pl-link-action pl-as-sug-abrir" onClick={() => setFechada(false)}>Mostrar sugestões{sugestoes.length ? ` (${sugestoes.length})` : ''}</button>
  }
  return (
    <div className="pl-as-sug" data-sugestoes>
      <div className="pl-as-sug-topo">
        <span className="pl-as-subtitulo">Sugestões para responder</span>
        <button type="button" className="pl-btn pl-btn-ghost pl-as-sug-ia" onClick={pedirIA} disabled={pedindo} data-sugerir-ia>
          {pedindo ? 'Pensando…' : dados?.d.iaLigada === false ? 'Sugerir resposta' : 'Sugerir com IA'}
        </button>
        <button type="button" className="pl-link-action" onClick={() => setFechada(true)} aria-label="Esconder sugestões">Esconder</button>
      </div>
      {erro && <div className="pl-hint" style={{ color: 'var(--pl-critical)' }}>{erro}</div>}
      {motos.length > 0 && onEnviarMoto && (
        <div className="pl-as-sug-motos" data-motos-citadas>
          {motos.map(m => (
            <div key={m.id} className="pl-as-sug-moto" data-moto-citada={m.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {m.foto ? <img src={urlArquivoApi(m.foto)} alt="" /> : <span className="pl-as-sug-moto-sem" aria-hidden="true" />}
              <span>{m.nome}<small>{m.situacao === 'DISPONIVEL' ? 'No estoque' : m.situacao === 'RESERVADA' ? 'Reservada' : 'Vendida'}{m.km !== null ? ` · ${m.km.toLocaleString('pt-BR')} km` : ''}</small></span>
              {m.situacao === 'DISPONIVEL' && (
                <button type="button" className="pl-link-action" onClick={() => enviarMoto(m.id)} disabled={!!enviandoMoto}>{enviandoMoto === m.id ? 'Enviando…' : 'Enviar ficha'}</button>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="pl-as-sug-lista" ref={listaRef}>
        {daIA?.opcoes.map((o, i) => (
          <div key={`ia-${i}`} className="pl-as-sug-item ia" data-sugestao-ia>
            <span className="pl-as-sug-tipo">{daIA.origem === 'IA' ? 'IA' : 'Modelo'}{o.quando ? ` · ${o.quando}` : ''}</span>
            <p>{o.texto}</p>
            <button type="button" className="pl-link-action" onClick={() => onUsar(o.texto)}>Usar</button>
          </div>
        ))}
        {sugestoes.map(s => (
          <div key={s.id} className="pl-as-sug-item" data-sugestao={s.id}>
            <span className="pl-as-sug-tipo">{TIPO[s.tipo] ?? s.tipo} · {s.titulo}</span>
            <span className="pl-as-sug-motivo">{s.motivo}</span>
            <p>{s.texto}</p>
            <span className="pl-as-sug-rodape">
              <button type="button" className="pl-link-action" onClick={() => onUsar(s.texto, s.id)}>Usar</button>
              {s.usos > 0 && <span title="Vezes que essa resposta foi usada e quantos leads avançaram de etapa depois">usada {s.usos}× · {s.avancos} avançaram</span>}
            </span>
          </div>
        ))}
        {!daIA && sugestoes.length === 0 && dados && motos.length === 0 && (
          <div className="pl-hint" style={{ fontSize: 12 }}>Nenhuma resposta aprovada bate com as últimas mensagens. Aprove respostas na aba Conhecimento ou peça uma sugestão.</div>
        )}
      </div>
    </div>
  )
}
