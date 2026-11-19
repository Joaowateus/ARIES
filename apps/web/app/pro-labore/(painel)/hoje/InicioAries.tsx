'use client'

// Tela inicial do ARIES (especificação de 17/11). Reproduz a composição da
// referência — fundo de paisagem, barra de ícones, saudação, relógio, busca,
// cartão superior direito, três cartões centrais, um cartão vertical, três
// cartões inferiores e o elemento central de baixo — com o conteúdo do ARIES.
// Posições e tamanhos fixos; nada de arrastar ou redimensionar.
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { inicioApi, type InicioDados, type NotaInicio, type ResultadoBusca, type TarefaInicio } from '@/lib/proLaboreApi'
import { usePLTema } from '@/lib/proLaboreTheme'
import { PaisagemNoite } from './PaisagemNoite'
import { Ico, MODULOS as MODULOS_PADRAO, NavModulosContext, ParaHojeContext } from '../_padrao/Navegacao'

// ---------- Módulos e atalhos (rotas existentes do ARIES) ----------
const ATALHOS: Record<string, { nome: string; href: string; icone: string }> = {
  'novo-lead': { nome: 'Novo lead', href: '/pro-labore/leads?novo=1', icone: 'lead' },
  'nova-moto': { nome: 'Nova moto', href: '/pro-labore/whatsapp?aba=estoque', icone: 'moto' },
  'nova-campanha': { nome: 'Nova campanha', href: '/pro-labore/trafego', icone: 'campanha' },
  crm: { nome: 'CRM', href: '/pro-labore/leads', icone: 'crm' },
  estoque: { nome: 'Estoque', href: '/pro-labore/aba/estoque-demanda', icone: 'estoque' },
  relatorios: { nome: 'Relatórios', href: '/pro-labore/assistente', icone: 'relatorios' },
  pergunte: { nome: 'Pergunte ao ARIES', href: '/pro-labore/pergunte', icone: 'inteligencia' },
  atividades: { nome: 'Atividades', href: '/pro-labore/atividades', icone: 'calendario' },
  conversas: { nome: 'Conversas', href: '/pro-labore/whatsapp', icone: 'conversa' },
  financeiro: { nome: 'Financeiro', href: '/pro-labore/financeiro', icone: 'dinheiro' },
  painel: { nome: 'Painel', href: '/pro-labore/hoje?sub=painel', icone: 'relatorios' },
}
const ATALHOS_PADRAO = ['novo-lead', 'nova-moto', 'nova-campanha', 'crm', 'estoque', 'relatorios']
const ICONE_MODULO: Record<string, string> = { CRM: 'crm', Comercial: 'comercial', Estoque: 'estoque', Relatórios: 'relatorios', Tráfego: 'trafego' }

// ---------- Formatos ----------
const compacto = (v: number, unidade: string | null) => {
  if (unidade === 'BRL') return v >= 1_000_000 ? `R$ ${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi` : v >= 1000 ? `R$ ${Math.round(v / 1000).toLocaleString('pt-BR')} mil` : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
  if (unidade === 'PCT') return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}
const haQuanto = (iso: string, agora: number) => {
  const m = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 60000))
  if (m < 1) return 'agora'
  if (m < 60) return `${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h`
  const d = Math.round(h / 24)
  return `${d} ${d === 1 ? 'dia' : 'dias'}`
}
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function InicioAries({ embutida = false }: { embutida?: boolean } = {}) {
  const MODULOS = useContext(NavModulosContext) ?? MODULOS_PADRAO
  const router = useRouter()
  const tema = usePLTema()
  const [d, setD] = useState<InicioDados | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const carregar = useCallback(() => { inicioApi.carregar().then(x => { setD(x); setErro(null) }).catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível carregar')) }, [])
  useEffect(() => { carregar() }, [carregar])

  // Relógio e data (atualizam sozinhos).
  const [agora, setAgora] = useState<number | null>(null)
  useEffect(() => { setAgora(Date.now()); const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t) }, [])
  const [nome, setNome] = useState('')
  useEffect(() => { try { setNome(((JSON.parse(localStorage.getItem('pro_labore_usuario') ?? '{}') as { nome?: string }).nome ?? '').trim().split(/\s+/)[0] ?? '') } catch { /* sem nome */ } }, [])
  const relogio = agora == null ? null : new Date(agora)
  const hora = relogio?.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) ?? '--:--'
  const h = relogio ? Number(relogio.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false })) : 12
  const saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  const data = relogio ? capital(relogio.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long' })) : ''

  const [configurando, setConfigurando] = useState(false)
  const fundo = d?.fundo ? inicioApi.urlImagem(d.fundo) : null

  return (
    <div className={`ia${embutida ? ' ia-embutida' : ''}`} data-inicio-aries>
      {fundo ? <div className="ia-fundo" style={{ backgroundImage: `url(${fundo})` }} data-fundo-proprio /> : <PaisagemNoite className="ia-fundo" />}
      <div className="ia-veu" aria-hidden />

      {!embutida && <nav className="ia-trilho" aria-label="Módulos do ARIES" data-trilho>
        {MODULOS.map(m => (
          <Link key={m.chave} href={m.href} className={`ia-trilho-item${m.chave === 'inicio' ? ' ativo' : ''}`} title={m.nome} aria-label={m.nome} aria-current={m.chave === 'inicio' ? 'page' : undefined} data-modulo-trilho={m.chave}>
            <Ico n={m.chave} />
          </Link>
        ))}
      </nav>}

      <div className="ia-palco">
        <div className="ia-saudacao" data-saudacao>{saud}{nome ? `, ${capital(nome.toLowerCase())}` : ''}</div>
        <div className="ia-controles" role="group" aria-label="Aparência e configurações">
          {d?.podeConfigurar && <button type="button" onClick={() => setConfigurando(true)} title="Configurar a tela inicial" aria-label="Configurar a tela inicial" data-configurar-inicio><Ico n="lapis" /></button>}
          {tema && <button type="button" onClick={() => tema.setTema(tema.tema === 'dark' ? 'light' : 'dark')} title={tema.tema === 'dark' ? 'Usar o tema claro no sistema' : 'Usar o tema escuro no sistema'} aria-label="Trocar o tema"><Ico n={tema.tema === 'dark' ? 'sol' : 'lua'} /></button>}
          <Link href="/pro-labore/configuracoes" title="Configurações" aria-label="Configurações"><Ico n="engrenagem" /></Link>
        </div>

        <header className="ia-centro">
          <div className="ia-hora" data-relogio aria-live="off">{hora}</div>
          <div className="ia-data" data-data>{data}</div>
          <Busca aoAbrir={href => router.push(href)} />
        </header>

        <ParaHoje />

        {erro && <div className="ia-cartao ia-erro" role="alert">Não deu para carregar a tela agora: {erro}</div>}

        <Modulos />
        <Atalhos ids={d ? (d.atalhos ?? ATALHOS_PADRAO) : []} />
        <Tarefas lista={d?.tarefas ?? null} aoMudar={carregar} />
        <Indicadores d={d} />
        <div className="ia-baixo">
          <Notas lista={d?.notas ?? null} aoMudar={carregar} />
          <Insights itens={d?.insights ?? null} />
          <Atividade itens={d?.atividade ?? null} agora={agora ?? Date.now()} aoAtualizar={carregar} />
        </div>

        <div className="ia-rodape" data-rodape-inicio><Ico n="brilho" /><span>ARIES</span></div>
      </div>

      {configurando && d && <ConfigurarInicio d={d} aoFechar={() => setConfigurando(false)} aoSalvar={carregar} />}
    </div>
  )
}

// ---------- Busca global ----------
function Busca({ aoAbrir }: { aoAbrir: (href: string) => void }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<ResultadoBusca[] | null>(null)
  const [i, setI] = useState(0)
  const [aberta, setAberta] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); e.stopPropagation(); ref.current?.focus() } }
    window.addEventListener('keydown', f, true); return () => window.removeEventListener('keydown', f, true)
  }, [])
  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return }
    const t = setTimeout(() => { inicioApi.buscar(q.trim()).then(r => { setRes(r); setI(0) }).catch(() => setRes([])) }, 250)
    return () => clearTimeout(t)
  }, [q])
  return (
    <div className="ia-busca" data-busca-global>
      <Ico n="busca" />
      <input ref={ref} value={q} onChange={e => { setQ(e.target.value); setAberta(true) }} onFocus={() => setAberta(true)} onBlur={() => setTimeout(() => setAberta(false), 150)}
        onKeyDown={e => { if (!res?.length) return; if (e.key === 'ArrowDown') { e.preventDefault(); setI(x => Math.min(res.length - 1, x + 1)) } else if (e.key === 'ArrowUp') { e.preventDefault(); setI(x => Math.max(0, x - 1)) } else if (e.key === 'Enter') aoAbrir(res[i].href) }}
        placeholder="Buscar clientes, leads, motos, vendas, campanhas…" aria-label="Busca global" role="combobox" aria-expanded={aberta && !!res} aria-controls="ia-busca-lista" />
      <kbd>Ctrl K</kbd>
      {aberta && res && (
        <ul className="ia-busca-lista" id="ia-busca-lista" role="listbox" data-resultados>
          {res.length === 0 && <li className="ia-busca-vazio">Nada encontrado para “{q.trim()}”.</li>}
          {res.map((r, k) => (
            <li key={r.id} role="option" aria-selected={k === i}>
              <button type="button" className={k === i ? 'ativo' : ''} onMouseDown={e => { e.preventDefault(); aoAbrir(r.href) }} data-resultado={r.origem}>
                <span className="ia-busca-origem">{r.origem}</span>
                <span className="ia-busca-titulo">{r.titulo}</span>
                {r.detalhe && <span className="ia-busca-det">{r.detalhe}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------- Módulos ----------
function Modulos() {
  const MODULOS = useContext(NavModulosContext) ?? MODULOS_PADRAO
  const [todos, setTodos] = useState(false)
  const lista = MODULOS.filter(m => m.chave !== 'inicio')
  return (
    <section className={`ia-cartao ia-modulos${todos ? ' ia-todos' : ''}`} aria-label="Módulos" data-cartao-modulos>
      <div className="ia-cartao-topo"><h2>Módulos</h2><button type="button" className="ia-pilula" onClick={() => setTodos(t => !t)} data-ver-todos>{todos ? 'Ver menos' : 'Ver todos'}</button></div>
      <ul className="ia-linhas">
        {(todos ? lista : lista.slice(0, 5)).map(m => (
          <li key={m.chave}><Link href={m.href} className="ia-linha" data-modulo={m.chave}>
            <span className="ia-linha-ico"><Ico n={m.chave} /></span><span className="ia-linha-nome">{m.nome}</span><span className="ia-linha-det">{m.rota}</span><Ico n="seta" className="ia-seta" />
          </Link></li>
        ))}
      </ul>
    </section>
  )
}

// ---------- Acesso rápido ----------
function Atalhos({ ids }: { ids: string[] }) {
  const lista = ids.filter(id => ATALHOS[id]).slice(0, 7)
  return (
    <section className="ia-cartao ia-atalhos" aria-label="Acesso rápido" data-cartao-atalhos>
      <div className="ia-cartao-topo"><h2>Acesso rápido</h2></div>
      <div className="ia-grade-atalhos">
        {lista.map(id => (
          <Link key={id} href={ATALHOS[id].href} className="ia-atalho" data-atalho={id}>
            <span className="ia-atalho-ico"><Ico n={ATALHOS[id].icone} /></span><span>{ATALHOS[id].nome}</span>
          </Link>
        ))}
        {ids.length > 0 && lista.length < 8 && <Link href="/pro-labore/hoje?configurar=atalhos" className="ia-atalho ia-atalho-mais" data-atalho-adicionar onClick={e => { e.preventDefault(); document.querySelector<HTMLButtonElement>('[data-configurar-inicio]')?.click() }}>
          <span className="ia-atalho-ico"><Ico n="mais" /></span><span>Adicionar</span>
        </Link>}
      </div>
    </section>
  )
}

// ---------- Tarefas (compartilhadas) ----------
function Tarefas({ lista, aoMudar }: { lista: TarefaInicio[] | null; aoMudar: () => void }) {
  const [novo, setNovo] = useState<string | null>(null)
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const feitas = lista?.filter(t => t.feita).length ?? 0
  const total = lista?.length ?? 0
  const fazer = async (p: Promise<unknown>) => { setMsg(null); try { await p; aoMudar() } catch (e) { setMsg(e instanceof Error ? e.message : 'Não deu certo') } }
  return (
    <section className="ia-cartao ia-tarefas" aria-label="Tarefas da loja" data-cartao-tarefas>
      <div className="ia-cartao-topo"><h2>Tarefas</h2><button type="button" className="ia-pilula" onClick={() => setNovo('')} data-nova-tarefa><Ico n="mais" /> Nova</button></div>
      <ul className="ia-lista-tarefas">
        {novo != null && (
          <li className="ia-tarefa ia-tarefa-nova">
            <input autoFocus value={novo} maxLength={200} onChange={e => setNovo(e.target.value)} placeholder="O que precisa ser feito?" aria-label="Nova tarefa"
              onKeyDown={e => { if (e.key === 'Enter' && novo.trim()) { void fazer(inicioApi.criarTarefa(novo.trim())); setNovo(null) } else if (e.key === 'Escape') setNovo(null) }}
              onBlur={() => { if (novo.trim()) void fazer(inicioApi.criarTarefa(novo.trim())); setNovo(null) }} data-campo-tarefa />
          </li>
        )}
        {lista?.map(t => (
          <li key={t.id} className={`ia-tarefa${t.feita ? ' feita' : ''}`} data-tarefa={t.id}>
            <button type="button" className="ia-marca" role="checkbox" aria-checked={t.feita} aria-label={t.feita ? 'Marcar como não feita' : 'Marcar como feita'} onClick={() => void fazer(inicioApi.mudarTarefa(t.id, { feita: !t.feita }))} data-marcar-tarefa>{t.feita && <Ico n="check" />}</button>
            {editando?.id === t.id
              ? <input autoFocus value={editando.texto} maxLength={200} onChange={e => setEditando({ id: t.id, texto: e.target.value })} aria-label="Editar tarefa"
                onKeyDown={e => { if (e.key === 'Enter' && editando.texto.trim()) { void fazer(inicioApi.mudarTarefa(t.id, { texto: editando.texto.trim() })); setEditando(null) } else if (e.key === 'Escape') setEditando(null) }}
                onBlur={() => { if (editando.texto.trim() && editando.texto.trim() !== t.texto) void fazer(inicioApi.mudarTarefa(t.id, { texto: editando.texto.trim() })); setEditando(null) }} data-editar-tarefa />
              : <span className="ia-tarefa-texto" onDoubleClick={() => setEditando({ id: t.id, texto: t.texto })} title={`${t.autorNome ? `Criada por ${t.autorNome}. ` : ''}Clique duas vezes para editar`}>{t.texto}</span>}
            <button type="button" className="ia-excluir" aria-label="Excluir tarefa" title="Excluir" onClick={() => void fazer(inicioApi.excluirTarefa(t.id))} data-excluir-tarefa><Ico n="lixo" /></button>
          </li>
        ))}
        {lista && !lista.length && novo == null && <li className="ia-vazio">Nenhuma tarefa. Use “Nova” para criar a primeira; toda a equipe vê a mesma lista.</li>}
      </ul>
      {msg && <p className="ia-msg" role="alert">{msg}</p>}
      <div className="ia-progresso" data-progresso-tarefas>
        <span>{total ? `${feitas} de ${total} concluídas` : 'Sem tarefas'}</span>
        <span className="ia-barra" aria-hidden><span style={{ width: total ? `${(feitas / total) * 100}%` : 0 }} /></span>
      </div>
    </section>
  )
}

// ---------- Indicadores (cartão vertical) ----------
const NOME_IND: Record<string, string> = { faturamento: 'Faturamento do mês', vendas: 'Motos vendidas', leads_novos: 'Leads recebidos', conversao_lead_venda: 'Conversão comercial', gasto_anuncio: 'Investimento em tráfego' }
function Indicadores({ d }: { d: InicioDados | null }) {
  return (
    <section className="ia-cartao ia-indicadores" aria-label="Indicadores do mês" data-cartao-indicadores>
      <div className="ia-ind-topo"><h2>Indicadores</h2><span>{d?.escopo === 'PROPRIO' ? 'Os seus, no mês' : 'Da loja, no mês'}</span></div>
      <ul>
        {(d?.indicadores ?? Object.keys(NOME_IND).map(chave => ({ chave, valor: null, variacao: null, unidade: null }))).map(i => (
          <li key={i.chave} data-indicador={i.chave}>
            <span className="ia-ind-nome">{NOME_IND[i.chave] ?? i.chave}</span>
            <b className="ia-ind-valor">{'semAcesso' in i && i.semAcesso ? '—' : i.valor == null ? '—' : compacto(i.valor, i.unidade)}</b>
            <span className="ia-ind-det">{'semAcesso' in i && i.semAcesso ? 'Fora do seu acesso' : i.valor == null ? (d ? 'Sem dados ainda' : 'Carregando…') : i.variacao == null ? 'sem comparação ainda' : `${i.variacao > 0 ? '+' : ''}${i.variacao.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% vs. mês anterior`}</span>
          </li>
        ))}
      </ul>
      <Link href="/pro-labore/indicadores" className="ia-ind-link">Abrir os indicadores</Link>
    </section>
  )
}

// ---------- Notas (compartilhadas, salvam sozinhas) ----------
function Notas({ lista, aoMudar }: { lista: NotaInicio[] | null; aoMudar: () => void }) {
  const [pos, setPos] = useState(0)
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState<'salvo' | 'salvando' | 'erro' | null>(null)
  const nota = lista?.[Math.min(pos, Math.max(0, (lista?.length ?? 1) - 1))] ?? null
  const idAtual = nota?.id ?? null
  useEffect(() => { setTexto(nota?.texto ?? '') }, [idAtual]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!nota || texto === nota.texto) return
    setEstado('salvando')
    const t = setTimeout(() => { inicioApi.salvarNota(nota.id, texto).then(() => setEstado('salvo')).catch(() => setEstado('erro')) }, 700)
    return () => clearTimeout(t)
  }, [texto]) // eslint-disable-line react-hooks/exhaustive-deps
  async function nova() { await inicioApi.criarNota(''); setPos(0); aoMudar() }
  async function excluir() { if (!nota) return; await inicioApi.excluirNota(nota.id); setPos(0); aoMudar() }
  return (
    <section className="ia-cartao ia-notas" aria-label="Bloco de notas da loja" data-cartao-notas>
      <div className="ia-cartao-topo">
        <h2><Ico n="nota" /> Notas</h2>
        <div className="ia-topo-acoes">
          {lista && lista.length > 1 && <span className="ia-pagina"><button type="button" aria-label="Nota anterior" onClick={() => setPos(p => Math.max(0, p - 1))}><Ico n="esquerda" /></button>{pos + 1}/{lista.length}<button type="button" aria-label="Próxima nota" onClick={() => setPos(p => Math.min(lista.length - 1, p + 1))}><Ico n="seta" /></button></span>}
          {nota && <button type="button" className="ia-icone-btn" aria-label="Excluir nota" title="Excluir nota" onClick={() => void excluir()} data-excluir-nota><Ico n="lixo" /></button>}
          <button type="button" className="ia-icone-btn" aria-label="Nova nota" title="Nova nota" onClick={() => void nova()} data-nova-nota><Ico n="mais" /></button>
        </div>
      </div>
      {nota ? (
        <div className="ia-nota">
          <textarea value={texto} onChange={e => setTexto(e.target.value)} maxLength={4000} aria-label="Texto da nota" placeholder="Escreva aqui. Salva sozinho." data-texto-nota />
          <span className="ia-nota-rodape">{estado === 'salvando' ? 'Salvando…' : estado === 'erro' ? 'Não salvou; tente de novo' : `${nota.autorNome ? `${nota.autorNome} · ` : ''}${new Date(nota.atualizadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}</span>
        </div>
      ) : <p className="ia-vazio">{lista ? 'Nenhuma nota. Use + para escrever; toda a equipe vê o mesmo bloco.' : 'Carregando…'}</p>}
    </section>
  )
}

// ---------- Para hoje (cartão superior direito) ----------
// Mesmos números do aviso "Para hoje" do menu lateral (vêm do layout, sem chamada nova).
function ParaHoje() {
  const p = useContext(ParaHojeContext)
  if (!p) return (
    <section className="ia-cartao ia-reservado" aria-label="Espaço reservado" data-cartao-reservado>
      <Ico n="lua" className="ia-reservado-ico" />
      <div><b>Em definição</b><span>Este espaço da tela inicial ainda vai receber a sua função.</span></div>
    </section>
  )
  const follows = p.followsHoje + p.followsAtrasados
  const ligacoes = p.ligacoesHoje + p.ligacoesAtrasadas
  const atrasados = p.followsAtrasados + p.ligacoesAtrasadas
  return (
    <section className="ia-cartao ia-reservado ia-para-hoje" aria-label="Para hoje" data-cartao-reservado data-para-hoje>
      <div className="ia-cartao-topo"><h2>Para hoje</h2></div>
      <p className="ia-para-hoje-num">
        <span>{follows} {follows === 1 ? 'follow' : 'follows'}</span><span aria-hidden> · </span><span>{ligacoes} {ligacoes === 1 ? 'ligação' : 'ligações'}</span>
      </p>
      {atrasados > 0 ? <p className="ia-para-hoje-atraso" data-para-hoje-atrasados>{atrasados} {atrasados === 1 ? 'atrasado' : 'atrasados'}</p> : <p className="ia-para-hoje-ok">Nada atrasado</p>}
      <Link href="/pro-labore/atividades" className="ia-ind-link">Abrir atividades</Link>
    </section>
  )
}

// ---------- ARIES Insights ----------
function Insights({ itens }: { itens: InicioDados['insights'] | null }) {
  const [i, setI] = useState(0)
  const atual = itens?.[i % Math.max(1, itens.length)] ?? null
  return (
    <section className="ia-cartao ia-insights" aria-label="ARIES Insights" data-cartao-insights>
      <Ico n="aspas" className="ia-aspas" />
      {atual ? <>
        {atual.tipo === 'RISCO' && <span className="ia-selo ia-selo-critico" data-selo-critico>Crítico</span>}
        <p className="ia-insight-titulo">{atual.titulo}</p>
        {atual.texto && <p className="ia-insight-texto">{atual.texto}</p>}
        <div className="ia-insight-rodape">
          <span>ARIES{atual.forca ? ` · ${atual.forca === 'HIPOTESE' ? 'hipótese' : atual.forca === 'COMPROVADA' ? 'comprovado' : 'padrão observado'}` : ''}</span>
          <span className="ia-pagina">
            {itens!.length > 1 && <><button type="button" aria-label="Insight anterior" onClick={() => setI(x => (x - 1 + itens!.length) % itens!.length)}><Ico n="esquerda" /></button><button type="button" aria-label="Próximo insight" onClick={() => setI(x => (x + 1) % itens!.length)}><Ico n="seta" /></button></>}
            {atual.href && <Link href={atual.href}>Ver</Link>}
          </span>
        </div>
      </> : <p className="ia-vazio">{itens ? 'Sem análises novas agora. Quando o ARIES encontrar um gargalo ou uma oportunidade, ela aparece aqui.' : 'Carregando…'}</p>}
    </section>
  )
}

// ---------- Atividade recente ----------
function Atividade({ itens, agora, aoAtualizar }: { itens: InicioDados['atividade'] | null; agora: number; aoAtualizar: () => void }) {
  return (
    <section className="ia-cartao ia-atividade" aria-label="Atividade recente" data-cartao-atividade>
      <div className="ia-cartao-topo"><h2>Atividade recente</h2><button type="button" className="ia-pilula" onClick={aoAtualizar}>Atualizar</button></div>
      <ul className="ia-linhas">
        {itens?.slice(0, 4).map(a => (
          <li key={a.id}><Link href={a.href} className="ia-linha" data-atividade={a.modulo}>
            <span className="ia-linha-ico"><Ico n={ICONE_MODULO[a.modulo] ?? 'brilho'} /></span>
            <span className="ia-linha-nome">{a.texto}</span><span className="ia-linha-det">{a.modulo}</span><span className="ia-linha-tempo">{haQuanto(a.em, agora)}</span>
          </Link></li>
        ))}
        {itens && !itens.length && <li className="ia-vazio">Nada nos últimos 30 dias.</li>}
      </ul>
    </section>
  )
}

// ---------- Configurar a tela (fundo e atalhos; iguais para todos) ----------
function ConfigurarInicio({ d, aoFechar, aoSalvar }: { d: InicioDados; aoFechar: () => void; aoSalvar: () => void }) {
  const [atalhos, setAtalhos] = useState<string[]>(d.atalhos ?? ATALHOS_PADRAO)
  const [msg, setMsg] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === 'Escape') aoFechar() }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f) }, [aoFechar])
  const disponiveis = useMemo(() => Object.keys(ATALHOS).filter(k => !atalhos.includes(k)), [atalhos])
  async function salvar(dados: { fundo?: string | null; atalhos?: string[] }) {
    setMsg(null)
    try { await inicioApi.salvarConfig(dados); aoSalvar(); setMsg('Salvo para toda a loja.') } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível salvar') }
  }
  async function enviarFundo(f: File) {
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { setMsg('Use uma imagem JPG, PNG ou WEBP.'); return }
    setEnviando(true)
    try { const caminho = await inicioApi.enviarFundo(f); await salvar({ fundo: caminho }) } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível enviar') } finally { setEnviando(false) }
  }
  return (
    <div className="ia-modal" role="dialog" aria-modal="true" aria-label="Configurar a tela inicial" onClick={e => { if (e.target === e.currentTarget) aoFechar() }} data-modal-inicio>
      <div className="ia-modal-painel">
        <div className="ia-cartao-topo"><h2>Configurar a tela inicial</h2><button type="button" className="ia-icone-btn" onClick={aoFechar} aria-label="Fechar">✕</button></div>
        <p className="ia-modal-sub">Vale para toda a equipe.</p>
        <h3>Imagem de fundo</h3>
        <div className="ia-modal-linha">
          <label className="ia-pilula ia-arquivo">{enviando ? 'Enviando…' : 'Trocar a imagem'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const f = e.target.files?.[0]; if (f) void enviarFundo(f) }} data-enviar-fundo /></label>
          {d.fundo && <button type="button" className="ia-pilula" onClick={() => void salvar({ fundo: null })} data-fundo-padrao>Voltar à paisagem padrão</button>}
        </div>
        <h3>Acesso rápido ({atalhos.length} de 7)</h3>
        <ul className="ia-modal-atalhos">
          {atalhos.map(id => <li key={id}><Ico n={ATALHOS[id]?.icone ?? 'brilho'} />{ATALHOS[id]?.nome ?? id}<button type="button" className="ia-icone-btn" aria-label={`Tirar ${ATALHOS[id]?.nome}`} onClick={() => setAtalhos(a => a.filter(x => x !== id))}>✕</button></li>)}
        </ul>
        {atalhos.length < 7 && disponiveis.length > 0 && (
          <div className="ia-modal-linha">{disponiveis.map(id => <button key={id} type="button" className="ia-pilula" onClick={() => setAtalhos(a => [...a, id])} data-adicionar-atalho={id}><Ico n="mais" /> {ATALHOS[id].nome}</button>)}</div>
        )}
        <div className="ia-modal-linha"><button type="button" className="ia-botao" onClick={() => void salvar({ atalhos })} data-salvar-atalhos>Salvar os atalhos</button></div>
        {msg && <p className="ia-msg" role="status">{msg}</p>}
      </div>
    </div>
  )
}
