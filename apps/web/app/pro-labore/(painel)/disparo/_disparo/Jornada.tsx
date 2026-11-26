'use client'

// Jornada do CRM: um público vivo por etapa (quem está nela agora, atualizado sozinho conforme a equipe
// usa o CRM) e as estratégias contínuas de cada etapa — sequências que fazem o lead avançar, com entrada
// automática de quem chega na etapa e saída automática de quem muda de etapa.
import { useCallback, useEffect, useState } from 'react'
import { disparoApi, type CampanhaDisparoEntrada, type EstrategiaDisparo } from '@/lib/proLaboreApi'
import { Assistente } from './Assistente'
import { SeloStatus, erroDe, n, useEscopo, useMeta } from './util'

type Dados = Awaited<ReturnType<typeof disparoApi.jornada>>

export function Jornada({ abrir }: { abrir: (id: string) => void }) {
  const meta = useMeta()
  const [d, setD] = useState<Dados | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [preset, setPreset] = useState<Partial<CampanhaDisparoEntrada> | null>(null)
  const { de } = useEscopo()
  const carregar = useCallback(() => { disparoApi.jornada(de).then(setD).catch(e => setErro(erroDe(e))) }, [de])
  useEffect(() => { carregar() }, [carregar])
  const pode = meta.nivel === 'EDITAR'

  function criar(etapa: string) {
    const j = meta.jornada.find(x => x.etapa === etapa)
    if (!j) return
    setPreset({
      nome: `Estratégia · ${j.rotulo}`, objetivo: j.objetivo, finalidade: 'RELACIONAMENTO', publicoId: null,
      publico: { ...j.definicao, predefinido: `ETAPA_${j.etapa}` },
      conteudo: { passos: j.sugestao.map((p, i) => ({ tipo: 'TEXTO' as const, texto: p.texto, ...(i > 0 ? { esperarMin: Math.max(0, p.esperarDias - j.sugestao[i - 1].esperarDias) * 24 * 60 } : {}) })), fallbacks: {}, rodapeSair: true },
      config: { continua: true, pararAoSairDoPublico: true, remetentePorVendedor: true, pararAoResponder: true },
    })
  }

  if (preset) return <Assistente campanha={null} preset={preset} fechar={() => { setPreset(null); carregar() }} abrirMonitor={id => { setPreset(null); abrir(id) }} />
  return (
    <div data-disparo-jornada>
      <section className="pl-card dp-guia" style={{ marginBottom: 12 }}>
        <b>Estratégias pela jornada de compra</b>
        <p style={{ margin: '4px 0' }}>Cada etapa do CRM é um público vivo: quem a equipe move para a etapa entra sozinho, e quem sai dela para de receber. Crie uma estratégia para fazer o lead avançar — o ARIES sugere as mensagens, você ajusta.</p>
        <span className="pl-hint">Elas saem pelo WhatsApp do vendedor de cada lead, respeitam o ritmo de proteção e param quando o cliente responde.</span>
      </section>
      {erro && <div className="pl-alert pl-alert-error" role="alert">{erro}</div>}
      {!d ? <p className="pl-hint" aria-busy="true">Contando a jornada…</p> : (
        <div className="dp-jornada">
          {d.etapas.map((e, i) => (
            <article key={e.etapa} className="dp-etapa-cartao" data-etapa={e.etapa}>
              <div className="dp-etapa-topo"><span className="dp-etapa-n">{i + 1}</span><b>{e.rotulo}</b></div>
              <div className="dp-etapa-total">{n(e.total)}<span className="pl-hint"> {e.etapa === 'VENDA' ? 'compraram' : 'na etapa agora'}</span></div>
              {e.parados7d > 0 && e.etapa !== 'VENDA' && <div className="pl-hint" style={{ color: 'var(--ar-estado-atencao)' }}>{n(e.parados7d)} parados há mais de 7 dias</div>}
              <div className="pl-hint">Objetivo: {e.objetivo}</div>
              {e.estrategias.length > 0 && (
                <ul className="dp-etapa-estrategias">
                  {e.estrategias.map((s: EstrategiaDisparo) => <li key={s.id}><button type="button" className="dp-link" onClick={() => abrir(s.id)}>{s.nome}</button> <SeloStatus status={s.status} /> <span className="pl-hint">· {n(s.entraram)} entraram</span></li>)}
                </ul>
              )}
              {pode && <button type="button" className={`pl-btn ${e.estrategias.length ? '' : 'pl-btn-primary'}`} onClick={() => criar(e.etapa)} data-criar-estrategia={e.etapa}>{e.estrategias.length ? '+ Outra estratégia' : 'Criar estratégia'}</button>}
            </article>
          ))}
        </div>
      )}
      {d && d.outras.length > 0 && (
        <section className="pl-card" style={{ marginTop: 12 }}>
          <div className="pl-card-title">Outras estratégias contínuas</div>
          <ul className="dp-etapa-estrategias">{d.outras.map(s => <li key={s.id}><button type="button" className="dp-link" onClick={() => abrir(s.id)}>{s.nome}</button> <SeloStatus status={s.status} /> <span className="pl-hint">· {n(s.entraram)} entraram</span></li>)}</ul>
        </section>
      )}
    </div>
  )
}
