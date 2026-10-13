'use client'

// E/F/G. Bancos: ganchos e formatos (com resultado observado), dores,
// desejos e objeções do dossiê (com quantos vídeos trabalham cada um),
// perguntas reais e objeções do atendimento, aprendizados e sugestões de
// novos ângulos (sempre marcadas como sugestão, nunca como fato).
import { useCallback, useEffect, useState } from 'react'
import { proLaboreApi, type CtBanco, type CtCiclo, type CtDossie, type CtItem, type CtTipoItem } from '@/lib/proLaboreApi'
import { Botao, Card, Chip, EstadoVazio, Segmentado, useToast } from '../../_ui'
import { ETAPA_NOME, NATUREZA_ROTULO, num } from './rotulos'

type Sub = 'GANCHO' | 'DOSSIE' | 'PERGUNTA' | 'OBJECAO' | 'APRENDIZADO' | 'SUGESTAO'
const SUBS: ReadonlyArray<{ valor: Sub; rotulo: string }> = [
  { valor: 'GANCHO', rotulo: 'Ganchos e formatos' }, { valor: 'DOSSIE', rotulo: 'Dores, desejos e objeções' }, { valor: 'PERGUNTA', rotulo: 'Perguntas reais' },
  { valor: 'OBJECAO', rotulo: 'Objeções do atendimento' }, { valor: 'APRENDIZADO', rotulo: 'Aprendizados' }, { valor: 'SUGESTAO', rotulo: 'Sugestões de ângulos' },
]

export function Bancos({ inicial, dados }: { inicial?: string; dados: CtCiclo | null }) {
  const [sub, setSub] = useState<Sub>((SUBS.some(s => s.valor === inicial) ? inicial : 'GANCHO') as Sub)
  const [banco, setBanco] = useState<CtBanco | null>(null)
  const [dossie, setDossie] = useState<CtDossie | null>(null)
  const carregar = useCallback(() => { proLaboreApi.sm.central.banco().then(setBanco).catch(() => undefined) }, [])
  useEffect(() => { carregar(); proLaboreApi.sm.central.dossie().then(d => setDossie(d.vigente.conteudo)).catch(() => undefined) }, [carregar])
  const pode = dados?.podeEditar ?? true
  return (
    <div className="ct-bancos">
      <Segmentado rotulo="Bancos" opcoes={SUBS} valor={sub} aoMudar={setSub} />
      {!banco ? <p className="sm-legenda">Carregando…</p> : sub === 'GANCHO' ? <Ganchos banco={banco} pode={pode} aoMudar={carregar} />
        : sub === 'DOSSIE' ? <DoDossie dossie={dossie} dados={dados} />
          : sub === 'SUGESTAO' ? <Sugestoes itens={banco.itens.filter(i => i.tipo === 'SUGESTAO')} dossie={dossie} pode={pode} aoMudar={carregar} />
            : <ListaItens tipo={sub} itens={banco.itens.filter(i => i.tipo === sub)} pode={pode} aoMudar={carregar} />}
    </div>
  )
}

const AJUDA: Partial<Record<CtTipoItem, string>> = {
  PERGUNTA: 'Perguntas que clientes fizeram de verdade (direct, WhatsApp, loja). A mesma pergunta de novo soma ocorrência; no próximo calendário, viram vídeos de meio de funil.',
  OBJECAO: 'Objeções que aparecem no atendimento. As mais recorrentes entram no fechamento do mês.',
  APRENDIZADO: 'O que o mês ensinou. Separe o que foi observado (fato) do que é interpretação (hipótese).',
  GANCHO: 'Ganchos para testar, com o resultado observado quando houver.',
}

function NovoItem({ tipo, aoCriar }: { tipo: CtTipoItem; aoCriar: () => void }) {
  const toast = useToast()
  const [texto, setTexto] = useState('')
  const [natureza, setNatureza] = useState<'FATO' | 'HIPOTESE'>('FATO')
  async function criar(e: React.FormEvent) {
    e.preventDefault()
    try { await proLaboreApi.sm.central.novoItem({ tipo, texto: texto.trim(), natureza }); setTexto(''); toast({ mensagem: 'Registrado.' }); aoCriar() }
    catch (err) { toast({ mensagem: err instanceof Error ? err.message : 'Não foi possível', tom: 'bad' }) }
  }
  return (
    <form className="ct-novo-item" onSubmit={criar}>
      <input className="sm-input" aria-label="Novo registro" required minLength={3} maxLength={1000} value={texto} onChange={e => setTexto(e.target.value)} placeholder={tipo === 'PERGUNTA' ? 'Ex.: Posso dar a minha moto como entrada?' : tipo === 'OBJECAO' ? 'Ex.: Achei a parcela alta' : 'Escreva aqui'} />
      {tipo === 'APRENDIZADO' && <select className="sm-input" aria-label="Natureza" value={natureza} onChange={e => setNatureza(e.target.value as 'FATO' | 'HIPOTESE')}><option value="FATO">Fato observado</option><option value="HIPOTESE">Hipótese</option></select>}
      <Botao type="submit" variante="pri">Adicionar</Botao>
    </form>
  )
}

function ListaItens({ tipo, itens, pode, aoMudar }: { tipo: CtTipoItem; itens: CtItem[]; pode: boolean; aoMudar: () => void }) {
  return (
    <Card subtitulo={AJUDA[tipo]}>
      {pode && <NovoItem tipo={tipo} aoCriar={aoMudar} />}
      {itens.length === 0 ? <EstadoVazio titulo="Nada registrado ainda" /> : (
        <ul className="ct-itens">
          {itens.map(i => (
            <li key={i.id}>
              <div><b>{i.texto}</b>
                <span className="sm-legenda">{NATUREZA_ROTULO[i.natureza]}{i.ocorrencias > 1 ? ` · ${i.ocorrencias} vezes` : ''}{i.usadoEm ? ' · já virou vídeo' : ''} · {new Date(i.criadoEm).toLocaleDateString('pt-BR')}</span>
              </div>
              {pode && <Botao variante="fantasma" onClick={() => proLaboreApi.sm.central.excluirItem(i.id).then(aoMudar)}>Excluir</Botao>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function Ganchos({ banco, pode, aoMudar }: { banco: CtBanco; pode: boolean; aoMudar: () => void }) {
  const ganchos = banco.itens.filter(i => i.tipo === 'GANCHO')
  return (
    <>
      <Card titulo="Ganchos publicados, com resultado" subtitulo="Fato observado: métricas do post no Instagram, agrupáveis por etapa, formato, dor/desejo/objeção, persona e lente.">
        {banco.ganchosPublicados.length === 0 ? <EstadoVazio titulo="Nenhum vídeo da Central publicado com métricas ainda" /> : (
          <div className="sm-tabela-rola">
            <table className="sm-tabela ct-tabela">
              <thead><tr><th scope="col">Gancho</th><th scope="col">Etapa</th><th scope="col">Formato</th><th scope="col">Alcance</th><th scope="col">Compart.</th><th scope="col">Salvos</th><th scope="col">Leads</th></tr></thead>
              <tbody>{banco.ganchosPublicados.map(g => (
                <tr key={g.id}><td><b>{g.gancho}</b><span className="sm-legenda">{g.alvo} · {g.persona} · {g.lente}</span></td><td>{ETAPA_NOME[g.etapa]}</td><td>{g.formatoNome}</td><td>{num(g.metricas.alcance)}</td><td>{num(g.metricas.compartilhamentos)}</td><td>{num(g.metricas.salvamentos)}</td><td>{num(g.metricas.leads)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
      <ListaItens tipo="GANCHO" itens={ganchos} pode={pode} aoMudar={aoMudar} />
      {banco.biblioteca.length > 0 && (
        <Card titulo="Biblioteca de ganchos da Produção" subtitulo="Ganchos salvos a partir dos reels que foram bem (Desempenho).">
          <ul className="ct-lista">{banco.biblioteca.map(g => <li key={g.id}>{g.texto} <span className="sm-legenda">({g.exemplos.length} {g.exemplos.length === 1 ? 'reel' : 'reels'})</span></li>)}</ul>
        </Card>
      )}
    </>
  )
}

function DoDossie({ dossie, dados }: { dossie: CtDossie | null; dados: CtCiclo | null }) {
  if (!dossie) return <p className="sm-legenda">Carregando…</p>
  const usos = (texto: string) => dados?.videos.filter(v => v.alvo === texto).length ?? 0
  const bloco = (titulo: string, lista: string[]) => (
    <Card titulo={titulo} subtitulo="Do dossiê vigente. Hipóteses de comunicação: não valem para todos os compradores.">
      <ul className="ct-itens">{lista.map(x => <li key={x}><div><b>{x}</b></div><Chip tom={usos(x) ? 'info' : 'neutro'}>{usos(x)} {usos(x) === 1 ? 'vídeo' : 'vídeos'} no ciclo</Chip></li>)}</ul>
    </Card>
  )
  return <>{bloco('Dores, frustrações e medos', dossie.dores)}{bloco('Desejos', dossie.desejos)}{bloco('Objeções comerciais', dossie.objecoes)}</>
}

function Sugestoes({ itens, dossie, pode, aoMudar }: { itens: CtItem[]; dossie: CtDossie | null; pode: boolean; aoMudar: () => void }) {
  const toast = useToast()
  const [foco, setFoco] = useState('')
  const [gerando, setGerando] = useState(false)
  async function gerar(e: React.FormEvent) {
    e.preventDefault(); setGerando(true)
    try { const r = await proLaboreApi.sm.central.sugestoes(foco.trim()); toast({ mensagem: `${r.ideias.length} sugestões ${r.origem === 'IA' ? 'da IA' : 'pelos modelos da Central'}.` }); aoMudar() }
    catch (err) { toast({ mensagem: err instanceof Error ? err.message : 'Não foi possível', tom: 'bad' }) } finally { setGerando(false) }
  }
  return (
    <Card titulo="Sugestões de novos ângulos" subtitulo="Para uma objeção, dor, tema ou aprendizado. São sugestões, não fatos: não alteram o AVATAR nem o calendário sozinhas.">
      {pode && (
        <form className="ct-novo-item" onSubmit={gerar}>
          <input className="sm-input" list="ct-focos" aria-label="Foco das sugestões" required minLength={3} value={foco} onChange={e => setFoco(e.target.value)} placeholder="Ex.: Achei os juros altos" />
          <datalist id="ct-focos">{dossie?.objecoes.map(o => <option key={o} value={o} />)}</datalist>
          <Botao type="submit" variante="pri" disabled={gerando}>{gerando ? 'Pensando…' : 'Gerar conteúdos para esse foco'}</Botao>
        </form>
      )}
      {itens.length === 0 ? <EstadoVazio titulo="Nenhuma sugestão ainda" /> : (
        <ul className="ct-itens">{itens.map(i => (
          <li key={i.id}><div><Chip tom="learn">Sugestão · {ETAPA_NOME[i.tags.etapa as 'TOPO'] ?? i.tags.etapa}</Chip> <b>{i.texto}</b><span className="sm-legenda">{i.tags.porque} · foco: {i.tags.foco} · {i.tags.origem === 'IA' ? 'IA' : 'modelo'}</span></div>
            {pode && <Botao variante="fantasma" onClick={() => proLaboreApi.sm.central.excluirItem(i.id).then(aoMudar)}>Descartar</Botao>}</li>
        ))}</ul>
      )}
    </Card>
  )
}
