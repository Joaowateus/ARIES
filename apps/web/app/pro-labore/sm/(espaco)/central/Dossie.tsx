'use client'

// B. Dossiê e regras estratégicas: a fonte principal da Central. O gestor
// publica versões novas (com o que mudou e por quê); o Social Media propõe
// e o gestor decide. Os dados de desempenho nunca mudam o dossiê sozinhos.
import { useCallback, useEffect, useState } from 'react'
import { proLaboreApi, type CtDossie, type CtDossieTela } from '@/lib/proLaboreApi'
import { Banner, Botao, Card, Chip, EstadoVazio, useToast } from '../../_ui'

const LISTAS: Array<{ chave: keyof Omit<CtDossie, 'avatar' | 'promessa'>; titulo: string; ajuda?: string }> = [
  { chave: 'dores', titulo: 'Dores, frustrações e medos', ajuda: 'Orientam os conteúdos, mas não são atribuídas a todos os compradores.' },
  { chave: 'desejos', titulo: 'Desejos' }, { chave: 'objecoes', titulo: 'Objeções comerciais', ajuda: 'Não responder com desconto: explicação, transparência e critério.' },
  { chave: 'emocoes', titulo: 'Emoções (hipóteses de comunicação)' }, { chave: 'crencas', titulo: 'Crenças a explorar (validar com perguntas reais)' },
  { chave: 'lentes', titulo: 'Lentes mentais' }, { chave: 'personas', titulo: 'Personas ilustrativas', ajuda: 'Instrumentos de planejamento, não clientes reais.' },
  { chave: 'posicionamento', titulo: 'Posicionamento comercial' }, { chave: 'regras', titulo: 'Regras permanentes' },
]
const STATUS: Record<string, { texto: string; tom: 'ok' | 'neutro' | 'warn' | 'bad' }> = { VIGENTE: { texto: 'Vigente', tom: 'ok' }, SUBSTITUIDO: { texto: 'Substituída', tom: 'neutro' }, PROPOSTA: { texto: 'Proposta', tom: 'warn' }, RECUSADA: { texto: 'Recusada', tom: 'bad' } }

export function DossieTela() {
  const toast = useToast()
  const [d, setD] = useState<CtDossieTela | null>(null)
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState<Record<string, string>>({})
  const [nota, setNota] = useState('')
  const [vendo, setVendo] = useState<{ versao: number; conteudo: CtDossie; nota: string | null; id: string; status: string } | null>(null)
  const carregar = useCallback(() => { proLaboreApi.sm.central.dossie().then(setD).catch(() => undefined) }, [])
  useEffect(() => { carregar() }, [carregar])
  if (!d) return <p className="sm-legenda">Carregando o dossiê…</p>
  const c = d.vigente.conteudo

  function abrirEdicao() {
    setRascunho({ avatar: c.avatar, ...Object.fromEntries(LISTAS.map(l => [l.chave, c[l.chave].join('\n')])), promessaTexto: c.promessa.texto, promessaCondicoes: c.promessa.condicoes, promessaAprovada: c.promessa.aprovada ? 'sim' : 'nao' })
    setNota(''); setEditando(true)
  }
  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const conteudo: CtDossie = {
      avatar: rascunho.avatar.trim(),
      ...Object.fromEntries(LISTAS.map(l => [l.chave, rascunho[l.chave].split('\n').map(x => x.trim()).filter(Boolean)])) as Omit<CtDossie, 'avatar' | 'promessa'>,
      promessa: { texto: rascunho.promessaTexto.trim(), condicoes: rascunho.promessaCondicoes.trim(), aprovada: rascunho.promessaAprovada === 'sim' },
    }
    try {
      if (d!.souGestor) { const r = await proLaboreApi.sm.central.salvarDossie(conteudo, nota.trim()); toast({ mensagem: `Dossiê versão ${r.versao} publicado. A anterior fica no histórico.` }) }
      else { await proLaboreApi.sm.central.proporDossie(conteudo, nota.trim()); toast({ mensagem: 'Proposta enviada ao gestor.' }) }
      setEditando(false); carregar()
    } catch (err) { toast({ mensagem: err instanceof Error ? err.message : 'Não foi possível salvar', tom: 'bad' }) }
  }
  async function decidir(id: string, aceitar: boolean) {
    try { await proLaboreApi.sm.central.decidirProposta(id, aceitar); toast({ mensagem: aceitar ? 'Proposta aceita: virou a versão vigente.' : 'Proposta recusada.' }); setVendo(null); carregar() }
    catch (err) { toast({ mensagem: err instanceof Error ? err.message : 'Não foi possível', tom: 'bad' }) }
  }
  const propostas = d.versoes.filter(v => v.status === 'PROPOSTA')

  return (
    <div className="ct-dossie">
      {propostas.length > 0 && d.souGestor && (
        <Banner tom="warn" titulo={`${propostas.length} ${propostas.length === 1 ? 'proposta' : 'propostas'} de mudança no dossiê`}>
          {propostas.map(p => <span key={p.id} className="ct-inline">“{p.nota}” <Botao onClick={() => proLaboreApi.sm.central.versaoDossie(p.id).then(setVendo)}>Ver</Botao></span>)}
        </Banner>
      )}
      {vendo && (
        <Card titulo={`Versão ${vendo.versao} (${STATUS[vendo.status]?.texto ?? vendo.status})`} subtitulo={vendo.nota ?? undefined}
          acoes={<div className="sm-linha-acoes">{vendo.status === 'PROPOSTA' && d.souGestor && <><Botao variante="pri" onClick={() => decidir(vendo.id, true)}>Aceitar e tornar vigente</Botao><Botao onClick={() => decidir(vendo.id, false)}>Recusar</Botao></>}<Botao variante="fantasma" onClick={() => setVendo(null)}>Fechar</Botao></div>}>
          <Conteudo c={vendo.conteudo} comparar={c} />
        </Card>
      )}

      {editando ? (
        <Card titulo={d.souGestor ? 'Editar o dossiê (nova versão)' : 'Propor mudança no dossiê'} subtitulo="Uma linha por item. A versão atual fica no histórico.">
          <form className="sm-form" onSubmit={salvar}>
            <label className="sm-campo">AVATAR principal<textarea className="sm-input" rows={4} required value={rascunho.avatar} onChange={e => setRascunho({ ...rascunho, avatar: e.target.value })} /></label>
            {LISTAS.map(l => <label key={l.chave} className="sm-campo">{l.titulo}<textarea className="sm-input" rows={Math.min(14, Math.max(4, rascunho[l.chave].split('\n').length + 1))} value={rascunho[l.chave]} onChange={e => setRascunho({ ...rascunho, [l.chave]: e.target.value })} /></label>)}
            <label className="sm-campo">Ideia comercial a avaliar<textarea className="sm-input" rows={2} value={rascunho.promessaTexto} onChange={e => setRascunho({ ...rascunho, promessaTexto: e.target.value })} /></label>
            <label className="sm-campo">Regras e condições da promessa<textarea className="sm-input" rows={3} value={rascunho.promessaCondicoes} onChange={e => setRascunho({ ...rascunho, promessaCondicoes: e.target.value })} /></label>
            <label className="sm-campo">A promessa tem regras comerciais formalmente aprovadas?
              <select className="sm-input" value={rascunho.promessaAprovada} onChange={e => setRascunho({ ...rascunho, promessaAprovada: e.target.value })}><option value="nao">Não: não pode ser publicada</option><option value="sim">Sim: critérios, condições, prazo e limitações definidos</option></select>
            </label>
            <label className="sm-campo">O que mudou e por quê (evidências disponíveis)<textarea className="sm-input" rows={2} required minLength={3} value={nota} onChange={e => setNota(e.target.value)} /></label>
            <div className="sm-linha-acoes" style={{ justifyContent: 'flex-end' }}><Botao onClick={() => setEditando(false)}>Cancelar</Botao><Botao type="submit" variante="pri">{d.souGestor ? 'Publicar nova versão' : 'Enviar proposta ao gestor'}</Botao></div>
          </form>
        </Card>
      ) : (
        <Card titulo={`Dossiê do AVATAR · versão ${d.vigente.versao}`} subtitulo={`Fonte principal da estratégia. ${d.vigente.nota ?? ''}`}
          acoes={d.podeEditar ? <Botao onClick={abrirEdicao}>{d.souGestor ? 'Editar (nova versão)' : 'Propor mudança'}</Botao> : undefined}>
          <Conteudo c={c} />
        </Card>
      )}

      <Card titulo="Histórico de versões">
        {d.versoes.length === 0 ? <EstadoVazio titulo="Sem versões" /> : (
          <ul className="ct-itens">{d.versoes.map(v => (
            <li key={v.id}><div><b>Versão {v.versao}</b> <Chip tom={STATUS[v.status].tom}>{STATUS[v.status].texto}</Chip><span className="sm-legenda">{new Date(v.criadoEm).toLocaleDateString('pt-BR')} · {v.criadoPor === 'SOCIAL_MEDIA' ? 'Social Media' : v.criadoPor === 'SISTEMA' ? 'Sistema' : 'Gestor'}{v.nota ? ` · ${v.nota}` : ''}</span></div>
              <Botao variante="fantasma" onClick={() => proLaboreApi.sm.central.versaoDossie(v.id).then(setVendo)}>Ver</Botao></li>
          ))}</ul>
        )}
      </Card>
    </div>
  )
}

function Conteudo({ c, comparar }: { c: CtDossie; comparar?: CtDossie }) {
  const novo = (chave: keyof Omit<CtDossie, 'avatar' | 'promessa'>, x: string) => comparar && !comparar[chave].includes(x)
  return (
    <div className="ct-dossie-conteudo">
      <div className="ct-dossie-bloco ct-dossie-avatar"><h3 className="ct-sub">AVATAR principal</h3><p>{c.avatar}</p></div>
      {LISTAS.map(l => (
        <div key={l.chave} className="ct-dossie-bloco">
          <h3 className="ct-sub">{l.titulo}</h3>{l.ajuda && <span className="sm-legenda">{l.ajuda}</span>}
          <ol>{c[l.chave].map(x => <li key={x} className={novo(l.chave, x) ? 'novo' : undefined}>{x}{novo(l.chave, x) && <Chip tom="info">novo</Chip>}</li>)}</ol>
        </div>
      ))}
      <div className="ct-dossie-bloco ct-dossie-avatar">
        <h3 className="ct-sub">Ideia comercial a avaliar</h3>
        <p>“{c.promessa.texto}” <Chip tom={c.promessa.aprovada ? 'ok' : 'bad'}>{c.promessa.aprovada ? 'Regras aprovadas' : 'Não publicar: regras não aprovadas'}</Chip></p>
        <span className="sm-legenda">{c.promessa.condicoes}</span>
      </div>
    </div>
  )
}
