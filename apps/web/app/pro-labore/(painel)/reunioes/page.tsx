'use client'

// Aba Reuniões: biblioteca de apresentações ao vivo, organizada em
// departamentos (cada um com senha) e pastas. O dono cria e apresenta
// (mapa mental + anotações + lembretes); a equipe assiste ao vivo e revê
// depois. Os registros de reunião do formato antigo continuam
// acessíveis no fim da página.
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { proLaboreApi, type ApresentacaoResumo, type ArvoreApresentacao, type EstruturaReunioes, type MapaMental } from '@/lib/proLaboreApi'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { PageHeader } from '../../PageHeader'
import { boardParaArvore } from '../anotacoes/motor-mapa-mental/conversao'
import RegistrosAntigos from './_componentes/RegistrosAntigos'
import { duracaoDesde, tempoRelativo } from './_componentes/comum'
import { FormDepartamento, IconeCadeado, IconePasta, MoverApresentacao, SenhaDepartamento } from './_componentes/Organizacao'

type Modelo = { id: string; rotulo: string; descricao: string; icone: string; ramos: Array<[string, string[]]> }

const MODELOS: Modelo[] = [
  { id: 'branco', rotulo: 'Em branco', descricao: 'Só a ideia central', icone: '✦', ramos: [] },
  {
    id: 'semanal', rotulo: 'Reunião semanal', descricao: 'Resultados, atenção, próximos passos', icone: '📅',
    ramos: [['Resultados da semana', ['Vendas', 'Leads', 'Destaques']], ['Pontos de atenção', []], ['Próximos passos', ['Metas da semana', 'Responsáveis']], ['Avisos', []]],
  },
  {
    id: 'treinamento', rotulo: 'Treinamento', descricao: 'Objetivo, conceitos, exemplos, exercício', icone: '🎓',
    ramos: [['Objetivo', []], ['Conceitos', ['Conceito 1', 'Conceito 2']], ['Exemplos práticos', []], ['Erros comuns', []], ['Exercício', []]],
  },
  {
    id: 'plano', rotulo: 'Plano de ação', descricao: 'Situação, meta, ações e prazos', icone: '🎯',
    ramos: [['Situação atual', []], ['Meta', []], ['Ações', ['Ação 1', 'Ação 2', 'Ação 3']], ['Prazos', []], ['Como vamos medir', []]],
  },
]

function arvoreDoModelo(m: Modelo, titulo: string): ArvoreApresentacao {
  let n = 1
  const no = (text: string, children: ArvoreApresentacao[] = []): ArvoreApresentacao => ({ id: `n${n++}`, text, children, collapsed: false })
  const raiz = no(titulo)
  raiz.children = m.ramos.map(([t, filhos]) => no(t, filhos.map(f => no(f))))
  return raiz
}

function NovaApresentacao({ destino, rotuloDestino, onFechar }: { destino: { departamentoId: string | null; pastaId: string | null }; rotuloDestino: string; onFechar: () => void }) {
  const router = useRouter()
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [modelo, setModelo] = useState('branco')
  const [mapas, setMapas] = useState<MapaMental[] | null>(null)
  const [mapaId, setMapaId] = useState('')
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let cancelado = false
    proLaboreApi.mapasMentais.listar()
      .then(l => { if (!cancelado) setMapas(l.filter(m => (m.objetos ?? []).some(o => o.tipo === 'noMapa'))) })
      .catch(() => { if (!cancelado) setMapas([]) })
    return () => { cancelado = true }
  }, [])

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    const t = titulo.trim()
    if (!t) return
    setCriando(true)
    setErro('')
    try {
      let arvore: ArvoreApresentacao
      if (modelo === 'importar') {
        const mapa = mapas?.find(m => m.id === mapaId)
        if (!mapa) throw new Error('Escolha o mapa da aba Anotações')
        arvore = boardParaArvore(mapa.objetos ?? [], mapa.conectores ?? []).tree
      } else {
        arvore = arvoreDoModelo(MODELOS.find(m => m.id === modelo) ?? MODELOS[0], t)
      }
      const a = await proLaboreApi.apresentacoes.criar({ titulo: t, descricao: descricao.trim() || undefined, arvore, ...destino })
      router.push(`/pro-labore/reunioes/${a.id}`)
    } catch (err) {
      setErro((err as Error).message)
      setCriando(false)
    }
  }

  return (
    <form className="pl-card pl-ap-nova" onSubmit={criar}>
      <div className="pl-card-title">Nova apresentação</div>
      <div className="pl-card-sub">Será criada em <b>{rotuloDestino}</b></div>
      <div className="pl-ap-nova-campos">
        <label className="pl-field">
          <span>Título</span>
          <input className="pl-input" autoFocus value={titulo} maxLength={120} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Reunião de segunda — metas de outubro" />
        </label>
        <label className="pl-field">
          <span>Descrição (opcional)</span>
          <input className="pl-input" value={descricao} maxLength={500} onChange={e => setDescricao(e.target.value)} placeholder="Do que se trata, pra equipe saber antes de entrar" />
        </label>
      </div>
      <div className="pl-ap-sub" style={{ marginTop: 14 }}>Começar com</div>
      <div className="pl-ap-modelos" role="radiogroup" aria-label="Modelo inicial">
        {MODELOS.map(m => (
          <button key={m.id} type="button" role="radio" aria-checked={modelo === m.id} className={modelo === m.id ? 'ativo' : ''} onClick={() => setModelo(m.id)}>
            <span className="icone">{m.icone}</span><b>{m.rotulo}</b><small>{m.descricao}</small>
          </button>
        ))}
        <button type="button" role="radio" aria-checked={modelo === 'importar'} className={modelo === 'importar' ? 'ativo' : ''} onClick={() => setModelo('importar')} disabled={mapas?.length === 0}>
          <span className="icone">🧠</span><b>Mapa das Anotações</b><small>{mapas === null ? 'Carregando…' : mapas.length === 0 ? 'Nenhum mapa mental salvo' : 'Copia um mapa que você já tem'}</small>
        </button>
      </div>
      {modelo === 'importar' && mapas && mapas.length > 0 && (
        <label className="pl-field" style={{ marginTop: 12 }}>
          <span>Qual mapa</span>
          <select className="pl-input" value={mapaId} onChange={e => { setMapaId(e.target.value); const m = mapas.find(x => x.id === e.target.value); if (m && !titulo.trim()) setTitulo(m.titulo ?? '') }}>
            <option value="">Escolha…</option>
            {mapas.map(m => <option key={m.id} value={m.id}>{m.icone ? `${m.icone} ` : ''}{m.titulo || 'Sem título'}</option>)}
          </select>
          <small className="pl-hint">É uma cópia: mexer na apresentação não altera o mapa original.</small>
        </label>
      )}
      {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 12 }}>{erro}</div>}
      <div className="pl-ap-nova-botoes">
        <button type="button" className="pl-btn pl-btn-ghost" onClick={onFechar}>Cancelar</button>
        <button type="submit" className="pl-btn pl-btn-primary" disabled={criando || !titulo.trim() || (modelo === 'importar' && !mapaId)}>{criando ? 'Criando…' : 'Criar e abrir'}</button>
      </div>
    </form>
  )
}

type Selecao = { dep: string | null; pasta: string | null }

function Biblioteca() {
  const { usuario } = useProLaboreAuth()
  const isDono = usuario?.papel === 'DONO'
  const router = useRouter()
  const params = useSearchParams()
  // Onde estou fica na URL (?dep=&pasta=): dá pra voltar da apresentação
  // pro mesmo lugar e mandar o link de uma pasta pra alguém.
  const sel: Selecao = { dep: params.get('dep'), pasta: params.get('pasta') }
  const irPara = (s: Selecao) => {
    const q = new URLSearchParams()
    if (s.dep) q.set('dep', s.dep)
    if (s.pasta) q.set('pasta', s.pasta)
    router.replace(`/pro-labore/reunioes${q.size ? `?${q}` : ''}`, { scroll: false })
  }

  const [lista, setLista] = useState<ApresentacaoResumo[] | null>(null)
  const [estrutura, setEstrutura] = useState<EstruturaReunioes | null>(null)
  const [erro, setErro] = useState('')
  const [painel, setPainel] = useState<null | 'nova' | 'departamento' | 'editarDep' | 'pasta'>(null)
  const [nomePasta, setNomePasta] = useState('')
  const [movendo, setMovendo] = useState<ApresentacaoResumo | null>(null)
  const [temRegistros, setTemRegistros] = useState(false)
  const [versao, setVersao] = useState(0)
  const recarregar = () => setVersao(v => v + 1)

  useEffect(() => {
    let cancelado = false
    Promise.all([proLaboreApi.apresentacoes.listar(), proLaboreApi.reunioesOrg.estrutura()])
      .then(([l, e]) => { if (!cancelado) { setLista(l); setEstrutura(e); setErro('') } })
      .catch(e => { if (!cancelado) setErro((e as Error).message) })
    return () => { cancelado = true }
  }, [versao])

  // Atualiza de tempos em tempos — é assim que a equipe descobre que uma
  // apresentação acabou de entrar ao vivo.
  useEffect(() => {
    const t = setInterval(() => setVersao(v => v + 1), 20_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    let cancelado = false
    proLaboreApi.reunioes.listar().then(r => { if (!cancelado) setTemRegistros(r.length > 0) }).catch(() => undefined)
    return () => { cancelado = true }
  }, [])

  const depAtual = sel.dep ? estrutura?.departamentos.find(d => d.id === sel.dep) ?? null : null
  const pastasAqui = sel.dep ? depAtual?.pastas ?? [] : estrutura?.geral.pastas ?? []
  const pastaAtual = sel.pasta ? pastasAqui.find(p => p.id === sel.pasta) ?? null : null
  const bloqueado = !!depAtual && !depAtual.liberado
  const itens = (lista ?? []).filter(a => (a.departamentoId ?? null) === sel.dep && (a.pastaId ?? null) === (sel.pasta ?? null))
  const aoVivo = (lista ?? []).filter(a => a.aoVivo)
  const depsTrancadosAoVivo = (estrutura?.departamentos ?? []).filter(d => d.aoVivo && !d.liberado)
  const rotuloDestino = [depAtual?.nome ?? 'Geral', pastaAtual?.nome].filter(Boolean).join(' / ')

  async function excluir(a: ApresentacaoResumo) {
    if (!confirm(`Excluir "${a.titulo}"? O mapa, as anotações e os lembretes somem pra todo mundo.`)) return
    await proLaboreApi.apresentacoes.excluir(a.id)
    recarregar()
  }
  async function criarPasta(e: React.FormEvent) {
    e.preventDefault()
    if (!nomePasta.trim()) return
    try {
      const p = await proLaboreApi.reunioesOrg.criarPasta({ nome: nomePasta.trim(), departamentoId: sel.dep })
      setNomePasta('')
      setPainel(null)
      recarregar()
      irPara({ dep: sel.dep, pasta: p.id })
    } catch (err) { alert((err as Error).message) }
  }
  async function renomearPasta() {
    if (!pastaAtual) return
    const nome = prompt('Novo nome da pasta', pastaAtual.nome)?.trim()
    if (!nome) return
    await proLaboreApi.reunioesOrg.renomearPasta(pastaAtual.id, nome)
    recarregar()
  }
  async function excluirPasta() {
    if (!pastaAtual) return
    if (!confirm(`Excluir a pasta "${pastaAtual.nome}"? As apresentações dela não são apagadas — voltam pra ${depAtual?.nome ?? 'Geral'}.`)) return
    await proLaboreApi.reunioesOrg.excluirPasta(pastaAtual.id)
    irPara({ dep: sel.dep, pasta: null })
    recarregar()
  }
  async function excluirDepartamento() {
    if (!depAtual) return
    if (!confirm(`Excluir o departamento "${depAtual.nome}" e as pastas dele?`)) return
    try {
      await proLaboreApi.reunioesOrg.excluirDepartamento(depAtual.id)
      irPara({ dep: null, pasta: null })
      recarregar()
    } catch (err) { alert((err as Error).message) }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Operação"
        title="Reuniões"
        subtitle={isDono
          ? 'Apresente mapas mentais ao vivo pra equipe, organizados em departamentos com senha e pastas — tudo fica guardado com anotações e lembretes'
          : 'Reuniões da equipe: acompanhe ao vivo e reveja depois. Departamentos com cadeado pedem a senha uma vez.'}
      />

      {aoVivo.map(a => (
        <Link key={a.id} href={`/pro-labore/reunioes/${a.id}`} className="pl-ap-banner">
          <span className="pl-ap-pulso" aria-hidden="true" />
          <span className="pl-ap-banner-texto">
            <b>AO VIVO{a.aoVivoDesde ? ` há ${duracaoDesde(a.aoVivoDesde)}` : ''}: {a.titulo}</b>
            <small>{isDono ? 'Sua transmissão está no ar — voltar pra apresentação' : 'Entre pra acompanhar em tempo real'}</small>
          </span>
          <span className="pl-btn pl-btn-primary">{isDono ? 'Voltar' : 'Assistir agora'}</span>
        </Link>
      ))}
      {depsTrancadosAoVivo.map(d => (
        <button key={d.id} type="button" className="pl-ap-banner" onClick={() => irPara({ dep: d.id, pasta: null })}>
          <span className="pl-ap-pulso" aria-hidden="true" />
          <span className="pl-ap-banner-texto">
            <b>Reunião ao vivo em {d.nome}</b>
            <small>Departamento protegido — digite a senha pra entrar</small>
          </span>
          <span className="pl-btn pl-btn-primary"><IconeCadeado /> Entrar</span>
        </button>
      ))}

      {erro && <div className="pl-alert pl-alert-error">{erro}</div>}

      <div className="pl-rn-layout">
        <nav className="pl-rn-lateral" aria-label="Departamentos e pastas">
          <button type="button" className={`pl-rn-item ${!sel.dep ? 'ativo' : ''}`} onClick={() => irPara({ dep: null, pasta: null })}>
            <span className="pl-rn-bolinha" style={{ background: 'var(--pl-ink-muted)' }} />
            <span className="nome">Geral</span>
            {estrutura?.geral.aoVivo && <span className="pl-ap-pulso" title="Ao vivo agora" />}
            <small>{estrutura?.geral.total ?? ''}</small>
          </button>
          {!sel.dep && (estrutura?.geral.pastas ?? []).map(p => (
            <button key={p.id} type="button" className={`pl-rn-item pasta ${sel.pasta === p.id ? 'ativo' : ''}`} onClick={() => irPara({ dep: null, pasta: p.id })}>
              <IconePasta /><span className="nome">{p.nome}</span><small>{p.total}</small>
            </button>
          ))}

          <div className="pl-rn-lateral-titulo">
            <span>Departamentos</span>
            {isDono && <button type="button" onClick={() => setPainel('departamento')} aria-label="Novo departamento" title="Novo departamento">+</button>}
          </div>
          {estrutura && estrutura.departamentos.length === 0 && (
            <div className="pl-hint" style={{ fontSize: 12, padding: '4px 10px' }}>{isDono ? 'Crie departamentos com senha pra separar quem participa de cada reunião.' : 'Nenhum departamento.'}</div>
          )}
          {(estrutura?.departamentos ?? []).map(d => (
            <div key={d.id}>
              <button type="button" className={`pl-rn-item ${sel.dep === d.id ? 'ativo' : ''}`} onClick={() => irPara({ dep: d.id, pasta: null })}>
                <span className="pl-rn-bolinha" style={{ background: d.cor }} />
                <span className="nome">{d.nome}</span>
                {d.aoVivo && <span className="pl-ap-pulso" title="Ao vivo agora" />}
                {!isDono && <span className="pl-rn-cadeado" title={d.liberado ? 'Você já tem acesso' : 'Pede senha'}><IconeCadeado aberto={d.liberado} /></span>}
                {d.total != null && <small>{d.total}</small>}
              </button>
              {sel.dep === d.id && d.pastas.map(p => (
                <button key={p.id} type="button" className={`pl-rn-item pasta ${sel.pasta === p.id ? 'ativo' : ''}`} onClick={() => irPara({ dep: d.id, pasta: p.id })}>
                  <IconePasta /><span className="nome">{p.nome}</span><small>{p.total}</small>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <section className="pl-rn-conteudo">
          {painel === 'departamento' && <FormDepartamento onCancelar={() => setPainel(null)} onSalvo={id => { setPainel(null); recarregar(); irPara({ dep: id, pasta: null }) }} />}
          {painel === 'editarDep' && depAtual && <FormDepartamento atual={depAtual} onCancelar={() => setPainel(null)} onSalvo={() => { setPainel(null); recarregar() }} />}

          {estrutura && <div className="pl-rn-cabecalho">
            <div className="pl-rn-trilha">
              <button type="button" onClick={() => irPara({ dep: sel.dep, pasta: null })} disabled={!sel.pasta}>
                {depAtual && <span className="pl-rn-bolinha" style={{ background: depAtual.cor }} />}
                {depAtual?.nome ?? 'Geral'}
              </button>
              {pastaAtual && <><span className="sep">/</span><span className="atual"><IconePasta /> {pastaAtual.nome}</span></>}
              {depAtual?.descricao && !pastaAtual && <small>{depAtual.descricao}</small>}
            </div>
            {isDono && !bloqueado && (
              <div className="pl-rn-acoes">
                {!pastaAtual && <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setPainel(p => (p === 'pasta' ? null : 'pasta'))}>Nova pasta</button>}
                {pastaAtual && <button type="button" className="pl-btn pl-btn-ghost" onClick={renomearPasta}>Renomear pasta</button>}
                {pastaAtual && <button type="button" className="pl-btn pl-btn-ghost pl-as-perigo" onClick={excluirPasta}>Excluir pasta</button>}
                {depAtual && !pastaAtual && <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setPainel('editarDep')}>Editar departamento</button>}
                {depAtual && !pastaAtual && <button type="button" className="pl-btn pl-btn-ghost pl-as-perigo" onClick={excluirDepartamento}>Excluir</button>}
                <button type="button" className="pl-btn pl-btn-primary" onClick={() => setPainel('nova')}>Nova apresentação</button>
              </div>
            )}
          </div>}

          {painel === 'pasta' && (
            <form className="pl-card pl-rn-pasta-form" onSubmit={criarPasta}>
              <IconePasta />
              <input className="pl-input" autoFocus placeholder={`Nome da pasta em ${depAtual?.nome ?? 'Geral'}`} value={nomePasta} maxLength={60} onChange={e => setNomePasta(e.target.value)} />
              <button type="submit" className="pl-btn pl-btn-primary" disabled={!nomePasta.trim()}>Criar pasta</button>
              <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setPainel(null)}>Cancelar</button>
            </form>
          )}
          {painel === 'nova' && <NovaApresentacao destino={{ departamentoId: sel.dep, pastaId: sel.pasta }} rotuloDestino={rotuloDestino} onFechar={() => setPainel(null)} />}

          {bloqueado && depAtual ? (
            <SenhaDepartamento departamento={depAtual} onLiberado={recarregar} />
          ) : !lista || !estrutura ? <div className="pl-hint">Carregando…</div> : (
            <>
              {!sel.pasta && pastasAqui.length > 0 && (
                <div className="pl-rn-pastas">
                  {pastasAqui.map(p => (
                    <button key={p.id} type="button" className="pl-rn-pasta" onClick={() => irPara({ dep: sel.dep, pasta: p.id })}>
                      <span className="icone" style={{ color: depAtual?.cor ?? 'var(--pl-ink-2)' }}><IconePasta /></span>
                      <b>{p.nome}</b>
                      <small>{p.total} {p.total === 1 ? 'apresentação' : 'apresentações'}</small>
                    </button>
                  ))}
                </div>
              )}
              {itens.length === 0 ? (
                painel !== 'nova' && (
                  <div className="pl-empty pl-card">
                    <div className="pl-emoji">{pastaAtual ? '📁' : '🧠'}</div>
                    <h3 style={{ margin: 0, color: 'var(--pl-ink-1)', fontWeight: 600 }}>{pastaAtual ? 'Pasta vazia' : pastasAqui.length ? 'Nada fora das pastas' : 'Nenhuma apresentação aqui ainda'}</h3>
                    <p style={{ margin: '6px 0 0' }}>
                      {isDono
                        ? 'Crie uma apresentação aqui, ou mova uma existente pelo menu do cartão. Na hora de apresentar, clique em "Iniciar ao vivo".'
                        : 'Quando tiver uma apresentação ao vivo, ela aparece com o selo AO VIVO.'}
                    </p>
                  </div>
                )
              ) : (
                <div className="pl-ap-grade">
                  {itens.map(a => (
                    <article key={a.id} className={`pl-ap-cartao ${a.aoVivo ? 'aovivo' : ''}`}>
                      <Link href={`/pro-labore/reunioes/${a.id}`} className="pl-ap-cartao-link">
                        <div className="pl-ap-cartao-topo">
                          <span className="pl-ap-cartao-icone">{a.icone ?? '🧠'}</span>
                          {a.aoVivo && <span className="pl-ap-selo"><span className="pl-ap-pulso" aria-hidden="true" />AO VIVO</span>}
                          {isDono && !a.visivelEquipe && <span className="pl-ap-selo neutro">Só você revê</span>}
                        </div>
                        <b className="pl-ap-cartao-titulo">{a.titulo}</b>
                        {a.descricao && <p className="pl-ap-cartao-desc">{a.descricao}</p>}
                        <div className="pl-ap-cartao-meta">
                          <span>{a.totalIdeias} {a.totalIdeias === 1 ? 'ideia' : 'ideias'}</span>
                          {a.lembretesPendentes > 0 && <span>{a.lembretesPendentes} {a.lembretesPendentes === 1 ? 'lembrete' : 'lembretes'}</span>}
                          <span>atualizada {tempoRelativo(a.atualizadoEm)}</span>
                        </div>
                      </Link>
                      {isDono && (
                        <div className="pl-rn-cartao-acoes">
                          <button type="button" onClick={() => setMovendo(a)} title="Mover pra outro departamento ou pasta">Mover</button>
                          <button type="button" className="perigo" onClick={() => excluir(a)} aria-label={`Excluir ${a.titulo}`} title="Excluir">Excluir</button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {movendo && estrutura && (
        <MoverApresentacao
          titulo={movendo.titulo}
          atual={{ departamentoId: movendo.departamentoId, pastaId: movendo.pastaId }}
          estrutura={estrutura}
          onCancelar={() => setMovendo(null)}
          onMover={async destino => {
            await proLaboreApi.apresentacoes.atualizar(movendo.id, { destino })
            setMovendo(null)
            recarregar()
          }}
        />
      )}

      {temRegistros && (
        <details className="pl-ap-antigos">
          <summary>Registros de reuniões (formato antigo)</summary>
          <div style={{ marginTop: 14 }}><RegistrosAntigos /></div>
        </details>
      )}
    </div>
  )
}

export default function ProLaboreReunioesPage() {
  return (
    <Suspense fallback={<div className="pl-hint">Carregando…</div>}>
      <Biblioteca />
    </Suspense>
  )
}
