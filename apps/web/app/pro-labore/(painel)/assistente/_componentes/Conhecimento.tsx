'use client'

// Aba "Conhecimento": a biblioteca da loja (dúvidas, objeções, argumentos e
// gatilhos), o que os clientes mais perguntaram e o que o aprendizado trouxe
// das conversas para revisar. A base é da conta toda; aprovar é da gestão —
// o vendedor sugere e rascunha.
import { useEffect, useMemo, useState } from 'react'
import {
  proLaboreApi, type BaseConhecimento, type EtapaConhecimento, type ItemConhecimento, type StatusConhecimento, type TipoConhecimento,
} from '@/lib/proLaboreApi'
import { CartaoViz, Vazio, fmtNum } from '../../social-media/_componentes/viz'
import { tempoRelativo } from './util'

const TIPO: Record<TipoConhecimento, { rotulo: string; plural: string }> = {
  DUVIDA: { rotulo: 'Dúvida', plural: 'Dúvidas' },
  OBJECAO: { rotulo: 'Objeção', plural: 'Objeções' },
  ARGUMENTO: { rotulo: 'Argumento', plural: 'Argumentos' },
  GATILHO: { rotulo: 'Gatilho', plural: 'Gatilhos' },
}
const TIPOS = Object.keys(TIPO) as TipoConhecimento[]
const STATUS: Record<StatusConhecimento, { rotulo: string; classe: string }> = {
  PARA_REVISAR: { rotulo: 'Para revisar', classe: 'atencao' },
  ATIVO: { rotulo: 'Em uso', classe: 'bom' },
  ARQUIVADO: { rotulo: 'Arquivada', classe: '' },
}
const ORIGEM_RASCUNHO: Record<string, string> = { VENDEDOR: 'Sugestão da equipe', IA: 'Rascunho da IA', MODELO: 'Modelo pronto' }
const ETAPAS: Array<{ valor: EtapaConhecimento; rotulo: string }> = [
  { valor: 'LEAD', rotulo: 'Lead' }, { valor: 'ABORDADO', rotulo: 'Abordado' }, { valor: 'NEGOCIACAO', rotulo: 'Negociação' }, { valor: 'PROPOSTA', rotulo: 'Proposta' },
]
const PERIODOS = [7, 30, 90] as const
type Filtro = StatusConhecimento | 'TODOS'
const FILTROS: Array<{ valor: Filtro; rotulo: string }> = [
  { valor: 'PARA_REVISAR', rotulo: 'Para revisar' }, { valor: 'ATIVO', rotulo: 'Em uso' }, { valor: 'ARQUIVADO', rotulo: 'Arquivadas' }, { valor: 'TODOS', rotulo: 'Todas' },
]
const MARCADORES = 'Use {nome}, {vendedor} e {moto}: o assistente troca pelo primeiro nome do cliente, o nome do vendedor e a moto de interesse. Dúvidas e objeções em uso o robô responde sozinho no meio do roteiro (sem a pergunta do final, se ainda houver perguntas); argumentos e gatilhos aparecem como sugestão para o vendedor.'

const paraLista = (texto: string) => [...new Set(texto.split(',').map(p => p.trim().toLowerCase()).filter(Boolean))]

export function Conhecimento() {
  const [dias, setDias] = useState<(typeof PERIODOS)[number]>(7)
  const [versao, setVersao] = useState(0)
  const [base, setBase] = useState<{ chave: string; dados: BaseConhecimento } | null>(null)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('PARA_REVISAR')
  const [tipo, setTipo] = useState<TipoConhecimento | ''>('')
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState<string | null>(null)
  const [novo, setNovo] = useState(false)
  const [analisando, setAnalisando] = useState(false)
  const [aviso, setAviso] = useState('')

  const chave = `${dias}|${versao}`
  useEffect(() => {
    let cancelado = false
    proLaboreApi.assistente.conhecimento(dias)
      .then(dados => { if (!cancelado) { setBase({ chave, dados }); setErro('') } })
      .catch(e => { if (!cancelado) setErro((e as Error).message) })
    return () => { cancelado = true }
  }, [dias, chave])

  const recarregar = () => setVersao(v => v + 1)
  const dados = base?.dados

  const lista = useMemo(() => {
    if (!dados) return []
    const termo = busca.trim().toLowerCase()
    return dados.itens
      .filter(i => filtro === 'TODOS' || i.status === filtro)
      .filter(i => !tipo || i.tipo === tipo)
      .filter(i => !termo || i.titulo.toLowerCase().includes(termo) || i.palavrasChave.some(p => p.includes(termo)) || (i.resposta ?? '').toLowerCase().includes(termo))
      // A caixa "Outras dúvidas" vazia não ajuda em nada.
      .filter(i => !i.outras || i.ocorrencias > 0)
      .sort((a, b) => (b.noPeriodo ?? 0) - (a.noPeriodo ?? 0) || b.ocorrencias - a.ocorrencias)
  }, [dados, filtro, tipo, busca])

  async function analisar() {
    setAnalisando(true); setAviso('')
    try {
      const r = await proLaboreApi.assistente.analisarConversas()
      setAviso(r.lidas === 0
        ? 'Nenhuma mensagem nova de cliente desde a última análise.'
        : `Li ${r.lidas} mensage${r.lidas === 1 ? 'm' : 'ns'} de clientes: ${r.reconhecidas} sobre assuntos da base${r.novasNaBase ? `, ${r.novasNaBase} assunto${r.novasNaBase > 1 ? 's' : ''} novo${r.novasNaBase > 1 ? 's' : ''} para revisar` : ''}${r.semAssunto ? `, ${r.semAssunto} em “Outras dúvidas”` : ''}.`)
      recarregar()
    } catch (e) {
      setAviso((e as Error).message)
    } finally {
      setAnalisando(false)
    }
  }

  function abrirDoRanking(id: string) {
    setFiltro('TODOS'); setTipo(''); setBusca(''); setAberto(id)
    setTimeout(() => document.getElementById(`kb-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  if (erro) return <div className="pl-alert pl-alert-error">{erro}</div>
  if (!dados) return <div className="pl-hint">Carregando…</div>
  const t = dados.totais
  const maxRanking = Math.max(1, ...dados.ranking.map(r => r.total))

  return (
    <div className="pl-as-kb">
      <div className="pl-sv-kpis pl-as-kpis">
        <Kpi rotulo="Para revisar" valor={fmtNum(t.paraRevisar)} destaque={t.paraRevisar > 0} nota={dados.podeAprovar ? 'Aprove para o assistente poder usar' : 'Esperando a gestão aprovar'} />
        <Kpi rotulo="Respostas em uso" valor={fmtNum(t.ativos)} nota="Aprovadas: o assistente usa com os clientes" />
        <Kpi rotulo={`Perguntas captadas (${dias} dias)`} valor={fmtNum(t.captadasNoPeriodo)} nota="Dúvidas e objeções reais dos clientes" />
        <Kpi rotulo="Ainda sem resposta aprovada" valor={fmtNum(t.semRespostaNoPeriodo)} destaque={t.semRespostaNoPeriodo > 0} nota="Perguntas do período sobre assuntos que não estão em uso" />
      </div>

      <div className="pl-as-kb-barra">
        <div className="pl-as-periodos" role="group" aria-label="Período">
          {PERIODOS.map(p => <button key={p} type="button" className={`pl-chip ${dias === p ? 'active' : ''}`} onClick={() => setDias(p)}>{p} dias</button>)}
        </div>
        <span className="pl-hint">{dados.ultimaAnalise ? `Conversas analisadas ${tempoRelativo(dados.ultimaAnalise)}` : 'Conversas ainda não analisadas'}</span>
        <div className="pl-as-kb-acoes">
          <button type="button" className="pl-btn pl-btn-ghost" onClick={analisar} disabled={analisando} data-analisar>{analisando ? 'Analisando…' : 'Analisar conversas agora'}</button>
          <button type="button" className="pl-btn pl-btn-primary" onClick={() => setNovo(n => !n)} data-novo-conhecimento>+ Nova resposta</button>
        </div>
      </div>
      {aviso && <div className="pl-alert pl-alert-info" data-aviso-analise>{aviso}</div>}
      {!dados.iaLigada && <div className="pl-hint" style={{ marginBottom: 10 }}>Sem a IA ligada, as perguntas novas ficam em “Outras dúvidas” para você organizar em assuntos.</div>}

      {novo && <NovoItem podeAprovar={dados.podeAprovar} onCancelar={() => setNovo(false)} onCriado={id => { setNovo(false); setFiltro('TODOS'); setAberto(id); recarregar() }} />}

      <CartaoViz
        titulo="O que os clientes mais perguntaram"
        subtitulo={`Últimos ${dias} dias · ${fmtNum(t.captadasNoPeriodo)} dúvidas e objeções reais. Clique para abrir o assunto.`}
        tabela={{ colunas: ['Assunto', 'Tipo', 'Situação', 'Vezes'], linhas: dados.ranking.map(r => [r.titulo, TIPO[r.tipo].rotulo, STATUS[r.status].rotulo, r.total]) }}
      >
        {dados.ranking.length === 0 ? <Vazio>As perguntas dos clientes aparecem aqui conforme as conversas acontecem.</Vazio> : (
          <div className="pl-as-funil pl-as-kb-ranking">
            {dados.ranking.map(r => (
              <button key={r.id} type="button" className="pl-as-funil-linha pl-as-kb-ranking-linha" onClick={() => abrirDoRanking(r.id)}>
                <span className="nome">{r.titulo}{r.status !== 'ATIVO' && <small className="pl-as-kb-sem"> · sem resposta em uso</small>}</span>
                <span className="pl-sv-hbar-trilho"><span style={{ width: `${Math.max(2, (r.total / maxRanking) * 100)}%`, background: r.status === 'ATIVO' ? 'var(--sv-1)' : 'var(--sv-2)' }} /></span>
                <b>{fmtNum(r.total)}</b>
              </button>
            ))}
          </div>
        )}
      </CartaoViz>

      <div className="pl-as-kb-filtros">
        <div className="pl-as-filtros" role="group" aria-label="Situação">
          {FILTROS.map(f => {
            const n = f.valor === 'TODOS' ? dados.itens.length : dados.itens.filter(i => i.status === f.valor && (!i.outras || i.ocorrencias > 0)).length
            return <button key={f.valor} type="button" className={`pl-chip ${filtro === f.valor ? 'active' : ''}`} onClick={() => setFiltro(f.valor)}>{f.rotulo} · {n}</button>
          })}
        </div>
        <select className="pl-select-chip" value={tipo} onChange={e => setTipo(e.target.value as TipoConhecimento | '')} aria-label="Tipo">
          <option value="">Todos os tipos</option>
          {TIPOS.map(x => <option key={x} value={x}>{TIPO[x].plural}</option>)}
        </select>
        <input className="pl-input pl-as-kb-busca" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar assunto ou palavra" aria-label="Buscar na base" />
      </div>

      {lista.length === 0 ? (
        <div className="pl-card pl-empty">
          {filtro === 'PARA_REVISAR' ? 'Nada para revisar agora. As dúvidas novas dos clientes aparecem aqui.' : 'Nenhum item com esse filtro.'}
        </div>
      ) : (
        <div className="pl-as-kb-lista">
          {lista.map(item => (
            <ItemCartao
              key={item.id}
              item={item}
              todos={dados.itens}
              podeAprovar={dados.podeAprovar}
              aberto={aberto === item.id}
              onAbrir={() => setAberto(a => (a === item.id ? null : item.id))}
              onMudou={recarregar}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Kpi({ rotulo, valor, nota, destaque }: { rotulo: string; valor: string; nota?: string; destaque?: boolean }) {
  return (
    <div className={`pl-kpi pl-sv-kpi ${destaque ? 'pl-as-kpi-alerta' : ''}`}>
      <div className="pl-kpi-label">{rotulo}</div>
      <div className="pl-kpi-value">{valor}</div>
      {nota && <div className="pl-sv-kpi-nota">{nota}</div>}
    </div>
  )
}

function NovoItem({ podeAprovar, onCancelar, onCriado }: { podeAprovar: boolean; onCancelar: () => void; onCriado: (id: string) => void }) {
  const [tipo, setTipo] = useState<TipoConhecimento>('DUVIDA')
  const [titulo, setTitulo] = useState('')
  const [resposta, setResposta] = useState('')
  const [palavras, setPalavras] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  async function salvar() {
    setSalvando(true); setErro('')
    try {
      const item = await proLaboreApi.assistente.criarConhecimento({ tipo, titulo, resposta: resposta.trim() || undefined, palavrasChave: paraLista(palavras) })
      onCriado(item.id)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }
  return (
    <div className="pl-card pl-as-kb-novo" data-form-novo>
      <div className="pl-card-title">Nova resposta para a base</div>
      <div className="pl-card-sub">{podeAprovar ? 'Com a resposta preenchida, já entra em uso.' : 'Vai para a gestão aprovar antes de o assistente usar.'}</div>
      <div className="pl-as-kb-grade">
        <label className="pl-field"><span>Tipo</span>
          <select className="pl-input" value={tipo} onChange={e => setTipo(e.target.value as TipoConhecimento)}>{TIPOS.map(x => <option key={x} value={x}>{TIPO[x].rotulo}</option>)}</select>
        </label>
        <label className="pl-field pl-as-kb-largo"><span>Dúvida ou objeção (como o cliente fala)</span>
          <input className="pl-input" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Vocês aceitam cartão?" />
        </label>
      </div>
      <label className="pl-field"><span>Resposta</span>
        <textarea className="pl-input pl-textarea" rows={3} value={resposta} onChange={e => setResposta(e.target.value)} placeholder="A melhor resposta que a loja dá para isso" />
      </label>
      <div className="pl-hint">{MARCADORES}</div>
      <label className="pl-field"><span>Palavras-chave (separe por vírgula)</span>
        <input className="pl-input" value={palavras} onChange={e => setPalavras(e.target.value)} placeholder="cartão, crédito, parcelar no cartão" />
      </label>
      {erro && <div className="pl-alert pl-alert-error">{erro}</div>}
      <div className="pl-as-kb-botoes">
        <button type="button" className="pl-btn pl-btn-ghost" onClick={onCancelar}>Cancelar</button>
        <button type="button" className="pl-btn pl-btn-primary" onClick={salvar} disabled={salvando || titulo.trim().length < 3}>{salvando ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </div>
  )
}

function ItemCartao({ item, todos, podeAprovar, aberto, onAbrir, onMudou }: {
  item: ItemConhecimento
  todos: ItemConhecimento[]
  podeAprovar: boolean
  aberto: boolean
  onAbrir: () => void
  onMudou: () => void
}) {
  // Gestão edita a resposta; o vendedor, num item para revisar, edita a sugestão (rascunho).
  const editaResposta = podeAprovar
  const somenteLeitura = !podeAprovar && item.status !== 'PARA_REVISAR'
  const [texto, setTexto] = useState(editaResposta ? item.resposta ?? '' : item.rascunho ?? '')
  const [titulo, setTitulo] = useState(item.titulo)
  const [tipo, setTipo] = useState<TipoConhecimento>(item.tipo)
  const [etapa, setEtapa] = useState<EtapaConhecimento | ''>(item.etapa ?? '')
  const [palavras, setPalavras] = useState(item.palavrasChave.join(', '))
  const [destino, setDestino] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function executar(acao: () => Promise<unknown>) {
    setSalvando(true); setErro('')
    try { await acao(); onMudou() } catch (e) { setErro((e as Error).message) } finally { setSalvando(false) }
  }
  const campos = () => ({ titulo, tipo, etapa: etapa || null, palavrasChave: paraLista(palavras), ...(editaResposta ? { resposta: texto.trim() || null } : { rascunho: texto.trim() || null }) })
  const salvar = () => executar(() => proLaboreApi.assistente.editarConhecimento(item.id, campos()))
  const aprovar = () => executar(() => proLaboreApi.assistente.editarConhecimento(item.id, { ...campos(), status: 'ATIVO' }))
  const mudarStatus = (status: StatusConhecimento) => executar(() => proLaboreApi.assistente.editarConhecimento(item.id, { status }))
  const juntar = () => destino && executar(() => proLaboreApi.assistente.juntarConhecimento(item.id, destino))
  const excluir = () => confirm(`Excluir “${item.titulo}” da base?`) && executar(() => proLaboreApi.assistente.excluirConhecimento(item.id))
  const mover = (frase: string, paraId: string) => paraId && executar(() => proLaboreApi.assistente.moverOcorrencia({ texto: frase, deId: item.id, paraId }))

  const outrosAssuntos = todos.filter(o => o.id !== item.id && !o.outras && o.status !== 'ARQUIVADO')
  const equipe = item.respostasEquipe ?? []

  return (
    <div id={`kb-${item.id}`} className={`pl-card pl-as-kb-item ${aberto ? 'aberto' : ''}`} data-kb-item={item.chave ?? item.id}>
      <button type="button" className="pl-as-kb-cabeca" onClick={onAbrir} aria-expanded={aberto}>
        <span className="pl-as-kb-tags">
          <span className={`pl-as-kb-tipo ${item.tipo.toLowerCase()}`}>{TIPO[item.tipo].rotulo}</span>
          <span className={`pl-status-badge ${STATUS[item.status].classe}`}>{STATUS[item.status].rotulo}</span>
          {item.origem === 'APRENDIDO' && <span className="pl-as-kb-origem">Aprendido das conversas</span>}
          {item.origem === 'MODELO_PRONTO' && <span className="pl-as-kb-origem">Modelo pronto</span>}
        </span>
        <b className="pl-as-kb-titulo">{item.titulo}</b>
        <span className="pl-as-kb-numeros">
          {(item.noPeriodo ?? 0) > 0 && <span><b>{item.noPeriodo}</b> no período</span>}
          <span>{item.ocorrencias} no total</span>
          {item.usos > 0 && <span title="Vezes que o robô ou a equipe usou essa resposta, e quantos leads avançaram de etapa no CRM em até 3 dias">usada {item.usos}× · {item.avancos} {item.avancos === 1 ? 'avançou' : 'avançaram'}</span>}
        </span>
        {!aberto && item.exemplos?.[0] && <span className="pl-as-kb-exemplo">“{item.exemplos[0].texto}”</span>}
      </button>

      {aberto && (
        <div className="pl-as-kb-corpo">
          {(item.exemplos?.length ?? 0) > 0 && (
            <div className="pl-as-kb-bloco">
              <div className="pl-as-kb-rotulo">Como os clientes perguntaram</div>
              <ul className="pl-as-kb-frases">
                {item.exemplos!.map(e => (
                  <li key={e.texto}>
                    <span>“{e.texto}”</span>
                    {podeAprovar && outrosAssuntos.length > 0 && (
                      <select className="pl-select-chip" value="" onChange={ev => mover(e.texto, ev.target.value)} aria-label="Mover esta frase para outro assunto">
                        <option value="">Mover para…</option>
                        {outrosAssuntos.map(o => <option key={o.id} value={o.id}>{o.titulo}</option>)}
                      </select>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {equipe.length > 0 && (
            <div className="pl-as-kb-bloco">
              <div className="pl-as-kb-rotulo">Como a equipe respondeu</div>
              {equipe.map(r => (
                <div key={r.texto} className="pl-as-kb-equipe">
                  <p>{r.texto}</p>
                  <small>{r.vendedor ?? 'Vendedor'} · {tempoRelativo(r.em)}</small>
                  {!somenteLeitura && !item.outras && <button type="button" className="pl-link-action" onClick={() => setTexto(r.texto)}>Usar como base</button>}
                </div>
              ))}
            </div>
          )}

          {item.outras ? (
            <div className="pl-hint">Caixa de entrada: perguntas que ainda não têm assunto. Mova cada frase para um assunto ou crie uma nova resposta com “+ Nova resposta”.</div>
          ) : (
            <>
              {item.rascunho && editaResposta && item.rascunho !== texto && (
                <div className="pl-as-kb-rascunho">
                  <div className="pl-as-kb-rotulo">{ORIGEM_RASCUNHO[item.rascunhoOrigem ?? ''] ?? 'Rascunho'}</div>
                  <p>{item.rascunho}</p>
                  <button type="button" className="pl-link-action" onClick={() => setTexto(item.rascunho ?? '')} data-usar-rascunho>Usar este rascunho</button>
                </div>
              )}
              <div className="pl-as-kb-grade">
                <label className="pl-field pl-as-kb-largo"><span>Dúvida ou objeção</span>
                  <input className="pl-input" value={titulo} onChange={e => setTitulo(e.target.value)} disabled={somenteLeitura} />
                </label>
                <label className="pl-field"><span>Tipo</span>
                  <select className="pl-input" value={tipo} onChange={e => setTipo(e.target.value as TipoConhecimento)} disabled={somenteLeitura}>{TIPOS.map(x => <option key={x} value={x}>{TIPO[x].rotulo}</option>)}</select>
                </label>
                <label className="pl-field"><span>Costuma aparecer em</span>
                  <select className="pl-input" value={etapa} onChange={e => setEtapa(e.target.value as EtapaConhecimento | '')} disabled={somenteLeitura}>
                    <option value="">Qualquer etapa</option>
                    {ETAPAS.map(x => <option key={x.valor} value={x.valor}>{x.rotulo}</option>)}
                  </select>
                </label>
              </div>
              <label className="pl-field"><span>{editaResposta ? 'Resposta que o assistente usa' : somenteLeitura ? 'Resposta em uso' : 'Sua sugestão de resposta'}</span>
                <textarea className="pl-input pl-textarea" rows={4} value={somenteLeitura ? item.resposta ?? '' : texto} onChange={e => setTexto(e.target.value)} disabled={somenteLeitura} data-kb-resposta />
              </label>
              <div className="pl-hint">{MARCADORES}</div>
              <label className="pl-field"><span>Palavras-chave para reconhecer o assunto (separe por vírgula)</span>
                <input className="pl-input" value={palavras} onChange={e => setPalavras(e.target.value)} disabled={somenteLeitura} />
              </label>
            </>
          )}

          {erro && <div className="pl-alert pl-alert-error">{erro}</div>}
          <div className="pl-as-kb-botoes">
            {podeAprovar && outrosAssuntos.length > 0 && (
              <span className="pl-as-kb-juntar">
                <select className="pl-select-chip" value={destino} onChange={e => setDestino(e.target.value)} aria-label="Juntar com outro assunto">
                  <option value="">Juntar com…</option>
                  {outrosAssuntos.map(o => <option key={o.id} value={o.id}>{o.titulo}</option>)}
                </select>
                {destino && <button type="button" className="pl-btn pl-btn-ghost" onClick={juntar} disabled={salvando}>Juntar</button>}
              </span>
            )}
            {podeAprovar && !item.outras && item.origem === 'MANUAL' && <button type="button" className="pl-btn pl-btn-ghost pl-danger" onClick={excluir} disabled={salvando}>Excluir</button>}
            {podeAprovar && !item.outras && item.status !== 'ARQUIVADO' && <button type="button" className="pl-btn pl-btn-ghost" onClick={() => mudarStatus('ARQUIVADO')} disabled={salvando}>Arquivar</button>}
            {podeAprovar && item.status === 'ARQUIVADO' && <button type="button" className="pl-btn pl-btn-ghost" onClick={() => mudarStatus('PARA_REVISAR')} disabled={salvando}>Voltar para revisão</button>}
            {!somenteLeitura && !item.outras && <button type="button" className="pl-btn pl-btn-ghost" onClick={salvar} disabled={salvando}>Salvar</button>}
            {podeAprovar && !item.outras && item.status !== 'ATIVO' && (
              <button type="button" className="pl-btn pl-btn-primary" onClick={aprovar} disabled={salvando || !texto.trim()} data-aprovar>Aprovar e usar</button>
            )}
          </div>
          {item.aprovadoPor && <div className="pl-hint">Aprovada por {item.aprovadoPor} {item.aprovadoEm ? tempoRelativo(item.aprovadoEm) : ''}</div>}
        </div>
      )}
    </div>
  )
}
