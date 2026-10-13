'use client'

// C/D. Calendário dos vídeos (dia a dia, manhã/tarde/noite) e I/J. Produção
// e publicação (lista por status, com aprovação em lote). Filtros por
// semana, período, tema, status, responsável e pendências.
import { useMemo, useState } from 'react'
import { proLaboreApi, type CtCiclo, type CtPeriodo, type CtStatus, type CtVideo } from '@/lib/proLaboreApi'
import { Botao, Chip, EstadoVazio, Modal, useToast } from '../../_ui'
import { ALVO_TIPO, ETAPA_NOME, ORDEM_STATUS, ORIGEM_ROTEIRO, PERIODO_ETAPA, PERIODO_NOME, STATUS_ROTULO, STATUS_TOM, chegou, ddmm, diaSemana } from './rotulos'
import { VideoModal } from './VideoModal'

export type Especial = 'pendentesComerciais' | 'semProva' | 'semRevisao' | 'atrasados' | 'repetidos' | 'pendentes'
export interface Filtro { semana: number | 0; periodo: CtPeriodo | ''; tema: string; status: CtStatus | ''; responsavel: string; busca: string; especial: Especial | '' }
const VAZIO: Filtro = { semana: 0, periodo: '', tema: '', status: '', responsavel: '', busca: '', especial: '' }
const ESPECIAL_ROTULO: Record<Especial, string> = {
  pendentesComerciais: 'Dependem de confirmação comercial', semProva: 'Sem a prova necessária', semRevisao: 'Roteiro-base sem revisão', atrasados: 'Atrasados', repetidos: 'Possíveis repetições', pendentes: 'Pendentes (não publicados)',
}
const PERIODOS: CtPeriodo[] = ['MANHA', 'TARDE', 'NOITE']

export function Calendario({ dados, filtroInicial, recarregar, modo = 'calendario' }: { dados: CtCiclo; filtroInicial: Partial<Filtro>; recarregar: () => void; modo?: 'calendario' | 'producao' }) {
  const [f, setF] = useState<Filtro>({ ...VAZIO, ...filtroInicial })
  const [aberto, setAberto] = useState<string | null>(null)
  const repetidos = useMemo(() => new Set(dados.repetidos.flatMap(r => [r.a, r.b])), [dados.repetidos])
  const temas = useMemo(() => [...new Set(dados.videos.map(v => v.tema))].sort(), [dados.videos])
  const lista = dados.videos.filter(v => {
    if (f.semana && v.semana !== f.semana) return false
    if (f.periodo && v.periodo !== f.periodo) return false
    if (f.tema && v.tema !== f.tema) return false
    if (f.status && v.status !== f.status) return false
    if (f.responsavel && !(v.responsavel ?? '').toLowerCase().includes(f.responsavel.toLowerCase())) return false
    if (f.busca && !`${v.codigo} ${v.titulo} ${v.gancho} ${v.alvo}`.toLowerCase().includes(f.busca.toLowerCase())) return false
    switch (f.especial) {
      case 'pendentesComerciais': return !!v.pendenteConfirmacao && !v.confirmadoEm
      case 'semProva': return !!v.provaNecessaria && !v.provaOk
      case 'semRevisao': return v.roteiroOrigem === 'MODELO' && v.status === 'PLANEJADO'
      case 'atrasados': return v.data < dados.hoje && !chegou(v.status, 'PUBLICADO')
      case 'repetidos': return repetidos.has(v.id)
      case 'pendentes': return !chegou(v.status, 'PUBLICADO')
      default: return true
    }
  })
  const mudar = (p: Partial<Filtro>) => setF(x => ({ ...x, ...p }))

  return (
    <div className="ct-cal">
      <div className="ct-filtros" role="group" aria-label="Filtros">
        <label className="sm-campo">Semana
          <select className="sm-input" value={f.semana} onChange={e => mudar({ semana: Number(e.target.value) })}>
            <option value={0}>Todas</option>{[1, 2, 3, 4].map(s => <option key={s} value={s}>Semana {s}</option>)}
          </select>
        </label>
        <label className="sm-campo">Período e funil
          <select className="sm-input" value={f.periodo} onChange={e => mudar({ periodo: e.target.value as CtPeriodo | '' })}>
            <option value="">Todos</option>{PERIODOS.map(p => <option key={p} value={p}>{PERIODO_NOME[p]} · {ETAPA_NOME[PERIODO_ETAPA[p]]}</option>)}
          </select>
        </label>
        <label className="sm-campo">Tema
          <select className="sm-input" value={f.tema} onChange={e => mudar({ tema: e.target.value })}>
            <option value="">Todos</option>{temas.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="sm-campo">Status
          <select className="sm-input" value={f.status} onChange={e => mudar({ status: e.target.value as CtStatus | '' })}>
            <option value="">Todos</option>{ORDEM_STATUS.map(s => <option key={s} value={s}>{STATUS_ROTULO[s]}</option>)}
          </select>
        </label>
        <label className="sm-campo">Responsável<input className="sm-input" value={f.responsavel} onChange={e => mudar({ responsavel: e.target.value })} placeholder="Nome" /></label>
        <label className="sm-campo">Buscar<input className="sm-input" value={f.busca} onChange={e => mudar({ busca: e.target.value })} placeholder="Código, título, gancho" /></label>
      </div>
      <div className="ct-especiais" role="group" aria-label="Pendências">
        {(Object.keys(ESPECIAL_ROTULO) as Especial[]).map(k => (
          <button key={k} type="button" className="ct-chip-filtro" aria-pressed={f.especial === k} onClick={() => mudar({ especial: f.especial === k ? '' : k })}>{ESPECIAL_ROTULO[k]}</button>
        ))}
        {JSON.stringify(f) !== JSON.stringify(VAZIO) && <button type="button" className="ct-chip-filtro limpar" onClick={() => setF(VAZIO)}>Limpar filtros</button>}
        <span className="sm-legenda">{lista.length} de {dados.videos.length} vídeos</span>
      </div>

      {f.especial === 'repetidos' && dados.repetidos.length > 0 && (
        <div className="sm-card ct-repetidos">
          <b>Pares parecidos</b>
          <ul className="ct-lista">{dados.repetidos.map(r => {
            const a = dados.videos.find(v => v.id === r.a)!, b = dados.videos.find(v => v.id === r.b)!
            return <li key={r.a + r.b}>{r.motivo}: <button type="button" className="sm-link-botao" onClick={() => setAberto(a.id)}>{a.codigo}</button> e <button type="button" className="sm-link-botao" onClick={() => setAberto(b.id)}>{b.codigo}</button> ({Math.round(r.semelhanca * 100)}%)</li>
          })}</ul>
          <span className="sm-legenda">Reformule um dos dois ou justifique a repetição na edição do roteiro.</span>
        </div>
      )}

      {lista.length === 0 ? <div className="sm-card"><EstadoVazio titulo="Nenhum vídeo com esses filtros">{f.especial === 'repetidos' ? 'Nenhuma repetição encontrada no ciclo.' : 'Mude os filtros para ver outros vídeos.'}</EstadoVazio></div>
        : modo === 'producao' ? <ListaProducao dados={dados} videos={lista} abrir={setAberto} recarregar={recarregar} />
          : <PorDia dados={dados} videos={lista} abrir={setAberto} repetidos={repetidos} />}

      {aberto && <VideoModal id={aberto} dados={dados} aoFechar={() => setAberto(null)} aoMudar={recarregar} aoAbrir={setAberto} />}
    </div>
  )
}

function Flags({ v, repetido }: { v: CtVideo; repetido?: boolean }) {
  return (
    <span className="ct-flags">
      {v.pendenteConfirmacao && !v.confirmadoEm && <Chip tom="warn" titulo={v.pendenteConfirmacao}>Confirmar</Chip>}
      {v.provaNecessaria && !v.provaOk && <Chip tom="neutro" titulo={v.provaNecessaria}>Prova</Chip>}
      {v.ajusteComentario && v.status === 'ROTEIRIZADO' && <Chip tom="bad" titulo={v.ajusteComentario}>Ajuste</Chip>}
      {repetido && <Chip tom="bad">Parecido</Chip>}
    </span>
  )
}

function PorDia({ dados, videos, abrir, repetidos }: { dados: CtCiclo; videos: CtVideo[]; abrir: (id: string) => void; repetidos: Set<string> }) {
  const dias = [...new Set(videos.map(v => v.data))].sort()
  return (
    <div className="ct-dias">
      {dias.map(d => {
        const doDia = videos.filter(v => v.data === d)
        const v0 = doDia[0]
        return (
          <section key={d} className={`sm-card ct-dia${d === dados.hoje ? ' hoje' : ''}`} aria-label={`Dia ${v0.diaCiclo} do ciclo, ${ddmm(d)}`}>
            <div className="ct-dia-cab">
              <b>{diaSemana(d)} {ddmm(d)}</b><span className="sm-legenda">Dia {v0.diaCiclo} · Semana {v0.semana} · {v0.pilar}</span>
              {d === dados.hoje && <Chip tom="info">Hoje</Chip>}
            </div>
            <div className="ct-dia-grade">
              {PERIODOS.map(p => {
                const doP = doDia.filter(v => v.periodo === p)
                if (!doP.length) return null
                return (
                  <div key={p} className={`ct-periodo e-${PERIODO_ETAPA[p].toLowerCase()}`}>
                    <span className="ct-periodo-ttl">{PERIODO_NOME[p]} · {ETAPA_NOME[PERIODO_ETAPA[p]]} de funil</span>
                    {doP.map(v => (
                      <button key={v.id} type="button" className="ct-video" onClick={() => abrir(v.id)} aria-label={`${v.codigo}: ${v.titulo}`}>
                        <span className="ct-video-topo"><span className="sm-mono">{v.horario} · {v.codigo.split('-').slice(-1)[0]}</span><Chip tom={STATUS_TOM[v.status]}>{STATUS_ROTULO[v.status]}</Chip></span>
                        <span className="ct-video-ttl">{v.titulo}</span>
                        <span className="ct-video-meta">{v.tema} · {ALVO_TIPO[v.alvoTipo] ?? v.alvoTipo}: {v.alvo}</span>
                        <Flags v={v} repetido={repetidos.has(v.id)} />
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function ListaProducao({ dados, videos, abrir, recarregar }: { dados: CtCiclo; videos: CtVideo[]; abrir: (id: string) => void; recarregar: () => void }) {
  const toast = useToast()
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [ajuste, setAjuste] = useState(false)
  const aprovaveis = videos.filter(v => !v.pautaId && ['ROTEIRIZADO', 'AGUARDANDO_APROVACAO'].includes(v.status))
  const contagem = ORDEM_STATUS.map(s => [s, dados.videos.filter(v => v.status === s).length] as const).filter(([, n]) => n > 0)
  async function aprovar(sim: boolean, comentario?: string) {
    try {
      const r = await proLaboreApi.sm.central.aprovar([...sel], sim, comentario)
      toast({ mensagem: sim ? `${r.feitos} roteiros aprovados${r.ignorados ? ` (${r.ignorados} ignorados: roteiro-base sem revisão ou já aprovados)` : ''}.` : `Ajuste pedido em ${r.feitos} roteiros.` })
      setSel(new Set()); setAjuste(false); recarregar()
    } catch (e) { toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível', tom: 'bad' }) }
  }
  const alternar = (id: string) => setSel(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  return (
    <>
      <div className="ct-status-resumo" aria-label="Vídeos por etapa da produção">
        {contagem.map(([s, n]) => <span key={s} className="ct-status-pill"><Chip tom={STATUS_TOM[s]}>{STATUS_ROTULO[s]}</Chip><b className="sm-num">{n}</b></span>)}
      </div>
      {dados.podeAprovar && aprovaveis.length > 0 && (
        <div className="sm-linha-acoes ct-lote">
          <Botao onClick={() => setSel(new Set(aprovaveis.map(v => v.id)))}>Selecionar os {aprovaveis.length} prontos para aprovar</Botao>
          <Botao variante="pri" disabled={!sel.size} onClick={() => aprovar(true)}>Aprovar {sel.size || ''}</Botao>
          <Botao disabled={!sel.size} onClick={() => setAjuste(true)}>Pedir ajuste</Botao>
        </div>
      )}
      <div className="sm-tabela-rola sm-card" style={{ padding: 0 }}>
        <table className="sm-tabela ct-tabela">
          <thead><tr>{dados.podeAprovar && <th scope="col"><span className="sm-sr">Selecionar</span></th>}<th scope="col">Vídeo</th><th scope="col">Data</th><th scope="col">Funil</th><th scope="col">Roteiro</th><th scope="col">Aprovação</th><th scope="col">Gravação</th><th scope="col">Edição</th><th scope="col">Publicação</th></tr></thead>
          <tbody>
            {videos.map(v => (
              <tr key={v.id}>
                {dados.podeAprovar && <td>{!v.pautaId && ['ROTEIRIZADO', 'AGUARDANDO_APROVACAO'].includes(v.status) && <input type="checkbox" aria-label={`Selecionar ${v.codigo}`} checked={sel.has(v.id)} onChange={() => alternar(v.id)} />}</td>}
                <td><button type="button" className="ct-link-video" onClick={() => abrir(v.id)}><span className="sm-mono">{v.codigo}</span> {v.titulo}</button><Flags v={v} /></td>
                <td>{ddmm(v.data)} {v.horario}</td>
                <td>{ETAPA_NOME[v.etapa]}</td>
                <td title={ORIGEM_ROTEIRO[v.roteiroOrigem]}>{v.etapas.roteiro}</td>
                <td>{v.etapas.aprovacao}</td><td>{v.etapas.gravacao}</td><td>{v.etapas.edicao}</td>
                <td>{v.metricas.permalink || v.permalink ? <a href={(v.metricas.permalink || v.permalink)!} target="_blank" rel="noreferrer">{v.etapas.publicacao}</a> : v.etapas.publicacao}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ajuste && <PedirAjuste n={sel.size} aoFechar={() => setAjuste(false)} aoEnviar={c => aprovar(false, c)} />}
    </>
  )
}

function PedirAjuste({ n, aoFechar, aoEnviar }: { n: number; aoFechar: () => void; aoEnviar: (c: string) => void }) {
  const [c, setC] = useState('')
  return (
    <Modal titulo={`Pedir ajuste em ${n} ${n === 1 ? 'roteiro' : 'roteiros'}`} aoFechar={aoFechar}>
      <form className="sm-form" onSubmit={e => { e.preventDefault(); aoEnviar(c.trim()) }}>
        <label className="sm-campo">O que precisa mudar<textarea className="sm-input" rows={3} required minLength={3} value={c} onChange={e => setC(e.target.value)} /></label>
        <div className="sm-linha-acoes" style={{ justifyContent: 'flex-end' }}><Botao onClick={aoFechar}>Cancelar</Botao><Botao type="submit" variante="pri">Pedir ajuste</Botao></div>
      </form>
    </Modal>
  )
}
