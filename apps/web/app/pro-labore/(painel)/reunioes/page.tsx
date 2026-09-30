'use client'

// Aba Reuniões: biblioteca de apresentações ao vivo. O dono cria e
// apresenta (mapa mental + anotações + lembretes); a equipe assiste ao
// vivo e revê depois. Os registros de reunião do formato antigo continuam
// acessíveis no fim da página.
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { proLaboreApi, type ApresentacaoResumo, type ArvoreApresentacao, type MapaMental } from '@/lib/proLaboreApi'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { PageHeader } from '../../PageHeader'
import { boardParaArvore } from '../anotacoes/motor-mapa-mental/conversao'
import RegistrosAntigos from './_componentes/RegistrosAntigos'
import { duracaoDesde, tempoRelativo } from './_componentes/comum'

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

function NovaApresentacao({ onFechar }: { onFechar: () => void }) {
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
      const a = await proLaboreApi.apresentacoes.criar({ titulo: t, descricao: descricao.trim() || undefined, arvore })
      router.push(`/pro-labore/reunioes/${a.id}`)
    } catch (err) {
      setErro((err as Error).message)
      setCriando(false)
    }
  }

  return (
    <form className="pl-card pl-ap-nova" onSubmit={criar}>
      <div className="pl-card-title">Nova apresentação</div>
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

export default function ProLaboreReunioesPage() {
  const { usuario } = useProLaboreAuth()
  const isDono = usuario?.papel === 'DONO'
  const [lista, setLista] = useState<ApresentacaoResumo[] | null>(null)
  const [erro, setErro] = useState('')
  const [criando, setCriando] = useState(false)
  const [temRegistros, setTemRegistros] = useState(false)
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let cancelado = false
    proLaboreApi.apresentacoes.listar()
      .then(l => { if (!cancelado) { setLista(l); setErro('') } })
      .catch(e => { if (!cancelado) setErro((e as Error).message) })
    return () => { cancelado = true }
  }, [versao])

  // Atualiza a lista de tempos em tempos — é assim que a equipe descobre
  // que uma apresentação acabou de entrar ao vivo.
  useEffect(() => {
    const t = setInterval(() => setVersao(v => v + 1), 20_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    let cancelado = false
    proLaboreApi.reunioes.listar().then(r => { if (!cancelado) setTemRegistros(r.length > 0) }).catch(() => undefined)
    return () => { cancelado = true }
  }, [])

  async function excluir(a: ApresentacaoResumo) {
    if (!confirm(`Excluir "${a.titulo}"? O mapa, as anotações e os lembretes somem pra todo mundo.`)) return
    await proLaboreApi.apresentacoes.excluir(a.id)
    setVersao(v => v + 1)
  }

  const aoVivo = (lista ?? []).filter(a => a.aoVivo)

  return (
    <div>
      <PageHeader
        eyebrow="Operação"
        title="Reuniões"
        subtitle={isDono
          ? 'Apresente mapas mentais ao vivo: a equipe acompanha em tempo real, sem poder editar, e tudo fica guardado com anotações e lembretes'
          : 'Apresentações da equipe: acompanhe ao vivo quando começar e reveja o conteúdo depois'}
        actions={isDono && !criando && <button type="button" className="pl-btn pl-btn-primary" onClick={() => setCriando(true)}>Nova apresentação</button>}
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

      {criando && <NovaApresentacao onFechar={() => setCriando(false)} />}

      {erro && <div className="pl-alert pl-alert-error">{erro}</div>}
      {!lista ? <div className="pl-hint">Carregando…</div> : lista.length === 0 ? (
        !criando && (
          <div className="pl-empty pl-card">
            <div className="pl-emoji">🧠</div>
            <h3 style={{ margin: 0, color: 'var(--pl-ink-1)', fontWeight: 600 }}>{isDono ? 'Nenhuma apresentação ainda' : 'Nenhuma apresentação disponível ainda'}</h3>
            <p style={{ margin: '6px 0 0' }}>
              {isDono
                ? 'Crie uma, monte o mapa mental e clique em "Iniciar ao vivo" — a equipe abre o link e acompanha o que você faz, sem poder editar.'
                : 'Quando uma apresentação começar ao vivo, ela aparece aqui e no menu, com o selo AO VIVO.'}
            </p>
            {isDono && <button type="button" className="pl-btn pl-btn-primary" style={{ marginTop: 14 }} onClick={() => setCriando(true)}>Criar a primeira</button>}
          </div>
        )
      ) : (
        <div className="pl-ap-grade">
          {lista.map(a => (
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
                <button type="button" className="pl-ap-cartao-excluir" onClick={() => excluir(a)} aria-label={`Excluir ${a.titulo}`} title="Excluir">×</button>
              )}
            </article>
          ))}
        </div>
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
