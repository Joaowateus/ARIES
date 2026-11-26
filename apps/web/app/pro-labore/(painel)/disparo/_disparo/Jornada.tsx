'use client'

// Jornada do CRM: um público vivo por etapa (quem está nela agora, atualizado sozinho conforme a equipe
// usa o CRM) e as estratégias contínuas de cada etapa — sequências que fazem o lead avançar, com entrada
// automática de quem chega na etapa e saída automática de quem muda de etapa.
// Redesign 26/11: trilho com as 10 etapas (coluna proporcional, parados em amarelo) e o detalhe da
// etapa escolhida, com um só "Criar estratégia". Os mesmos números e regras.
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
  const [sel, setSel] = useState<string | null>(null)
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
  const max = Math.max(1, ...(d?.etapas.map(e => e.total) ?? [1]))
  const padrao = d ? [...d.etapas].sort((a, b) => b.parados7d - a.parados7d)[0] : null
  const atual = d?.etapas.find(e => e.etapa === sel) ?? (padrao && padrao.parados7d > 0 ? padrao : d?.etapas[0]) ?? null
  const iAtual = d && atual ? d.etapas.indexOf(atual) : -1
  const sugestao = atual ? meta.jornada.find(j => j.etapa === atual.etapa)?.sugestao ?? [] : []
  return (
    <div data-disparo-jornada>
      <p className="pl-hint dp-publico-guia">Cada etapa do CRM é um público vivo: quem a equipe move para a etapa entra sozinho, e quem sai dela para de receber. {meta.gestao ? 'Os números contam os leads da loja toda; as estratégias saem pelo WhatsApp do vendedor de cada lead' : 'Os números contam só os seus leads (a sua carteira no CRM); as estratégias saem pelo seu WhatsApp'}, respeitam o ritmo de proteção e param quando o cliente responde.</p>
      {erro && <div className="pl-alert pl-alert-error" role="alert">{erro}</div>}
      {!d ? <p className="pl-hint" aria-busy="true">Contando a jornada…</p> : (
        <>
          <div className="pl-card dp-trilho-cartao">
            <div className="dp-trilho" role="tablist" aria-label="Etapas da jornada">
              {d.etapas.map((e, i) => {
                const h = Math.round((e.total / max) * 100)
                const parados = e.etapa === 'VENDA' ? 0 : Math.min(e.total, e.parados7d)
                return (
                  <button key={e.etapa} type="button" role="tab" aria-selected={atual?.etapa === e.etapa} className={atual?.etapa === e.etapa ? 'on' : ''} onClick={() => setSel(e.etapa)} data-etapa={e.etapa}
                    title={`${e.rotulo}: ${n(e.total)} ${e.etapa === 'VENDA' ? 'compraram' : 'na etapa'}${parados ? ` · ${n(parados)} parados há mais de 7 dias` : ''}`}>
                    <span className="dp-trilho-col" aria-hidden="true">
                      <span className="dp-trilho-barra" style={{ height: `${Math.max(e.total ? 4 : 0, h)}%` }}>
                        {parados > 0 && <span className="dp-trilho-parados" style={{ height: `${(parados / Math.max(1, e.total)) * 100}%` }} />}
                      </span>
                    </span>
                    <b>{n(e.total)}</b>
                    <span className="dp-trilho-nome"><small>{i + 1}</small>{e.rotulo}</span>
                    <span className="dp-trilho-marca">{e.estrategias.length ? `${e.estrategias.length} estratégia${e.estrategias.length > 1 ? 's' : ''}` : ' '}</span>
                  </button>
                )
              })}
            </div>
            <div className="dp-legenda"><span><i className="neutro" />na etapa agora</span><span><i className="warn" />parados há mais de 7 dias</span></div>
          </div>

          {atual && (
            <section className="pl-card dp-etapa-detalhe" data-etapa-detalhe={atual.etapa}>
              <header className="dp-bloco-topo">
                <div>
                  <span className="dp-config-rotulo">Etapa {iAtual + 1} de {d.etapas.length}</span>
                  <h3>{atual.rotulo}</h3>
                  <p className="pl-hint">Objetivo: {atual.objetivo}</p>
                </div>
                {pode && <button type="button" className="pl-btn pl-btn-primary" onClick={() => criar(atual.etapa)} data-criar-estrategia={atual.etapa}>{atual.estrategias.length ? 'Criar outra estratégia' : 'Criar estratégia'}</button>}
              </header>
              <div className="dp-mini-numeros">
                <div><span>{atual.etapa === 'VENDA' ? 'Compraram' : 'Na etapa agora'}</span><b>{n(atual.total)}</b></div>
                {atual.etapa !== 'VENDA' && <div><span>Parados há +7 dias</span><b className={atual.parados7d ? 'dp-txt-warn' : ''}>{n(atual.parados7d)}</b></div>}
                <div><span>Estratégias</span><b>{atual.estrategias.length}</b></div>
              </div>
              <div className="dp-etapa-colunas">
                <div>
                  <span className="dp-config-rotulo">Estratégias desta etapa</span>
                  {atual.estrategias.length ? (
                    <ul className="dp-etapa-estrategias">
                      {atual.estrategias.map((s: EstrategiaDisparo) => <li key={s.id}><button type="button" className="dp-link" onClick={() => abrir(s.id)}>{s.nome}</button> <SeloStatus status={s.status} /> <span className="pl-hint">· {n(s.entraram)} entraram</span></li>)}
                    </ul>
                  ) : <p className="pl-hint">Nenhuma ainda. {pode ? 'Crie uma: o ARIES já sugere as mensagens e você ajusta.' : ''}</p>}
                </div>
                {sugestao.length > 0 && (
                  <div>
                    <span className="dp-config-rotulo">Mensagens sugeridas pelo ARIES</span>
                    <div className="dp-balao-area">
                      {sugestao.map((m, i) => (
                        <div key={i}>
                          {i > 0 && <div className="dp-balao-espera">{m.esperarDias} dia(s) depois do início</div>}
                          <div className="dp-balao"><p>{m.texto}</p></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </>
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
