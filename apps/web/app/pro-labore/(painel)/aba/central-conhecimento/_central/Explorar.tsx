'use client'

// Explorar: uma caixa para pesquisar ou perguntar. A pesquisa mostra os resultados agrupados
// por tipo, com origem, data, a hora da última atualização da fonte e o botão Abrir; a pergunta
// abre a resposta do Pergunte ao ARIES aqui mesmo. Item fora da permissão simplesmente não aparece.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { centralApi, type BuscaCentral, type TipoDocCentral } from '@/lib/proLaboreApi'
import { PergunteChat } from '../../../_padrao/PergunteChat'
import { useTelas } from '../../../_padrao/Padrao'
import { data, haQuanto } from './util'

const TIPOS: Array<{ valor: TipoDocCentral; rotulo: string }> = [
  { valor: 'LEAD', rotulo: 'Leads' }, { valor: 'CLIENTE', rotulo: 'Clientes' }, { valor: 'VENDA', rotulo: 'Vendas' }, { valor: 'MOTO', rotulo: 'Motos' },
  { valor: 'ATIVIDADE', rotulo: 'Atividades' }, { valor: 'VERBETE', rotulo: 'Conhecimento' }, { valor: 'INDICADOR', rotulo: 'Indicadores' },
  { valor: 'RECOMENDACAO', rotulo: 'Recomendações' }, { valor: 'CAMPANHA', rotulo: 'Campanhas' }, { valor: 'POST', rotulo: 'Posts' },
  { valor: 'REUNIAO', rotulo: 'Reuniões' }, { valor: 'DECISAO', rotulo: 'Decisões' }, { valor: 'ANOTACAO', rotulo: 'Suas anotações' },
]
const PERIODOS = [{ valor: '', rotulo: 'Qualquer data' }, { valor: '7', rotulo: 'Últimos 7 dias' }, { valor: '30', rotulo: 'Últimos 30 dias' }, { valor: '90', rotulo: 'Últimos 90 dias' }]

// Sugestões por papel (estado vazio que ensina).
const SUGESTOES: Record<string, string[]> = {
  DONO: ['Como está a previsão de fechamento do mês?', 'Quais motos estão paradas há mais de 60 dias?', 'Como responder "está caro"?'],
  SUPERVISOR: ['Quais leads quentes estão parados?', 'Quantas conversas ficaram sem resposta ontem?', 'Decisões do Daily vencidas'],
  VENDEDOR: ['Quanto falta para eu bater a meta?', 'Como responder "vou pensar"?', 'Minhas atividades atrasadas'],
  SDR: ['Leads esperando a primeira resposta', 'Como responder "aceita moto na troca?"', 'Fichas aguardando os bancos'],
  TRAFEGO: ['Qual campanha trouxe mais leads este mês?', 'Custo por lead do mês', 'O que é a taxa de cliques?'],
  FINANCEIRO: ['Comissões a pagar', 'Saídas do caixa do mês', 'O que entra no Financeiro?'],
  SOCIAL_MEDIA: ['Engajamento dos posts do mês', 'Posts publicados na semana', 'Leads gerados pelos posts'],
}
/** Início do período de N dias (fora do componente: só roda no clique). */
const desdeDias = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()
const ehPergunta = (t: string) => /\?\s*$/.test(t) || /^(quanto|quantos|quantas|qual|quais|como|quem|onde|por que|porque|o que|quando|tem|existe)\b/i.test(t.trim())

export function Explorar({ inicial }: { inicial: string }) {
  const { usuario } = useProLaboreAuth()
  const { registrarAcao } = useTelas()
  const [texto, setTexto] = useState(inicial)
  const [tipos, setTipos] = useState<TipoDocCentral[]>([])
  const [periodo, setPeriodo] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [responsaveis, setResponsaveis] = useState<Array<{ id: string; nome: string }>>([])
  const [resultado, setResultado] = useState<{ termo: string; dados: BuscaCentral } | null>(null)
  // Veio com ?q=: pergunta abre a resposta do Pergunte; o resto pesquisa (abaixo).
  const [pergunta, setPergunta] = useState<string | null>(() => (inicial && ehPergunta(inicial) ? inicial.trim() : null))
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [registrada, setRegistrada] = useState(false)
  const papel = usuario?.papel === 'DONO' ? 'DONO' : (usuario?.papel ?? 'VENDEDOR')

  useEffect(() => { centralApi.responsaveis().then(setResponsaveis).catch(() => setResponsaveis([])) }, [])
  useEffect(() => {
    if (!inicial || ehPergunta(inicial) || inicial.trim().length < 2) return
    let vivo = true
    centralApi.buscar(inicial.trim()).then(dados => { if (vivo) setResultado({ termo: inicial.trim(), dados }) }).catch(e => { if (vivo) setErro(e instanceof Error ? e.message : 'Não foi possível pesquisar agora') })
    return () => { vivo = false }
  }, [inicial])

  type Filtros = { tipos: TipoDocCentral[]; periodo: string; responsavel: string }
  async function pesquisar(q = texto, f: Filtros = { tipos, periodo, responsavel }) {
    const termo = q.trim()
    if (termo.length < 2) return
    setCarregando(true); setErro(null); setPergunta(null); setRegistrada(false)
    try {
      const desde = f.periodo ? desdeDias(Number(f.periodo)) : undefined
      setResultado({ termo, dados: await centralApi.buscar(termo, { tipos: f.tipos, desde, vendedorId: f.responsavel || undefined }) })
      registrarAcao('central:pesquisar')
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível pesquisar agora') } finally { setCarregando(false) }
  }
  function perguntar(q = texto) {
    if (q.trim().length < 3) return
    setResultado(null); setPergunta(q.trim()); registrarAcao('central:perguntar')
  }
  // Filtro mudou com uma pesquisa na tela: pesquisa de novo com o filtro novo.
  function filtrar(mudou: Partial<Filtros>) {
    const f = { tipos, periodo, responsavel, ...mudou }
    if (mudou.tipos) setTipos(mudou.tipos)
    if (mudou.periodo !== undefined) setPeriodo(mudou.periodo)
    if (mudou.responsavel !== undefined) setResponsavel(mudou.responsavel)
    if (resultado) void pesquisar(resultado.termo, f)
  }
  const alternarTipo = (t: TipoDocCentral) => filtrar({ tipos: tipos.includes(t) ? tipos.filter(x => x !== t) : [...tipos, t] })
  async function registrarSemResposta() {
    if (!resultado) return
    try { await centralApi.semResposta(resultado.termo); setRegistrada(true) } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível registrar') }
  }

  return (
    <div data-central-explorar>
      <form className="cc-caixa" onSubmit={e => { e.preventDefault(); if (ehPergunta(texto)) perguntar(); else void pesquisar() }}>
        <input className="pl-input" value={texto} onChange={e => setTexto(e.target.value)} placeholder="Pesquise um cliente, moto, métrica ou objeção — ou faça uma pergunta" aria-label="Pesquisar ou perguntar" maxLength={500} data-central-campo />
        <button type="button" className="pl-btn" onClick={() => void pesquisar()} disabled={texto.trim().length < 2 || carregando} data-central-pesquisar>Pesquisar</button>
        <button type="button" className="pl-btn pl-btn-primary" onClick={() => perguntar()} disabled={texto.trim().length < 3} data-central-perguntar>Perguntar ao ARIES</button>
      </form>

      <div className="cc-filtros" aria-label="Filtros">
        <div className="cc-chips" role="group" aria-label="Tipo">
          {TIPOS.map(t => <button key={t.valor} type="button" className={`pl-chip ${tipos.includes(t.valor) ? 'active' : ''}`} aria-pressed={tipos.includes(t.valor)} onClick={() => alternarTipo(t.valor)}>{t.rotulo}</button>)}
        </div>
        <select className="pl-select-chip" value={periodo} onChange={e => filtrar({ periodo: e.target.value })} aria-label="Período">{PERIODOS.map(p => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}</select>
        {responsaveis.length > 0 && (
          <select className="pl-select-chip" value={responsavel} onChange={e => filtrar({ responsavel: e.target.value })} aria-label="Responsável">
            <option value="">Qualquer responsável</option>
            {responsaveis.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        )}
      </div>

      {erro && <div className="pl-alert pl-alert-error" role="alert">{erro}</div>}
      {carregando && <p className="pl-hint" aria-live="polite">Pesquisando…</p>}

      {pergunta && <div className="cc-pergunta" data-central-resposta><PergunteChat key={pergunta} inicial={pergunta} /></div>}

      {!pergunta && !resultado && !carregando && (
        <div className="ar-vazio" data-central-vazio>
          <h3>O que você quer saber?</h3>
          <p style={{ margin: '0 0 10px' }}>A Central reúne o CRM, as vendas, o estoque, as atividades, o conhecimento comercial, os indicadores e as integrações, sempre com o que você pode ver.</p>
          <div className="cc-chips" style={{ justifyContent: 'center' }}>
            {(SUGESTOES[papel] ?? SUGESTOES.VENDEDOR).map(s => <button key={s} type="button" className="pl-btn" style={{ fontSize: '.8rem' }} onClick={() => { setTexto(s); if (ehPergunta(s)) perguntar(s); else void pesquisar(s) }}>{s}</button>)}
          </div>
        </div>
      )}

      {resultado && !carregando && (resultado.dados.total === 0 ? (
        <div className="ar-vazio" data-central-sem-resultado>
          <h3>Nada encontrado para “{resultado.termo}”</h3>
          <p style={{ margin: '0 0 10px' }}>Tente outra palavra, tire um filtro ou pergunte ao ARIES. Se a Central deveria saber isso, registre: vira tarefa na Saúde da Central.</p>
          <div className="cc-chips" style={{ justifyContent: 'center' }}>
            <button type="button" className="pl-btn pl-btn-primary" onClick={() => perguntar(resultado.termo)}>Perguntar ao ARIES</button>
            {registrada ? <span className="pl-hint" role="status">Registrada como pergunta sem resposta.</span> : <button type="button" className="pl-btn" onClick={() => void registrarSemResposta()} data-central-registrar>Registrar como pergunta sem resposta</button>}
          </div>
        </div>
      ) : (
        <div data-central-resultados>
          <p className="pl-hint">{resultado.dados.total} resultado{resultado.dados.total === 1 ? '' : 's'} para “{resultado.termo}”</p>
          {resultado.dados.grupos.map(g => (
            <section key={g.tipo} className="cc-grupo" data-grupo={g.tipo}>
              <div className="ar-fila-grupo">{g.nome} <span className="pl-hint">({g.itens.length})</span></div>
              <ul className="ar-fila">
                {g.itens.map(i => (
                  <li key={i.id} className="ar-fila-item cc-item" data-resultado={i.tipo}>
                    <div style={{ minWidth: 0 }}>
                      <div className="ar-fila-titulo">{i.titulo}</div>
                      {i.resumo && <div className="pl-hint cc-resumo">{i.resumo}</div>}
                      <div className="pl-hint cc-meta">
                        {i.fonteNome}{i.data ? ` · ${data(i.data)}` : ''} · fonte atualizada {haQuanto(i.fonteAtualizadaEm)}
                        {i.fonteAtrasada && <span className="pl-status-badge atencao" style={{ marginLeft: 6 }} title="A fonte passou do tempo de atualização aceito: o dado pode estar desatualizado">pode estar desatualizado</span>}
                      </div>
                    </div>
                    <Link className="pl-btn" href={i.link} onClick={() => registrarAcao('central:abrir')}>Abrir</Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ))}
    </div>
  )
}
