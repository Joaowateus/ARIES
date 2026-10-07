'use client'

// Tela 02 · Calendário editorial (seção 5 · Calendario.html): o mês por
// pilares, com buracos, rajadas, slots livres, regras de cadência, mix de
// pilares e as melhores janelas de horário.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { proLaboreApi, type SmCalendario, type SmConfigCalendario, type SmDiaCalendario, type SmItemCalendario, type SmMoto, type SmPilar } from '@/lib/proLaboreApi'
import { Botao, Card, CardEsqueleto, Chip, EstadoVazio, IcMais, Modal, PILAR_CHIP, PILAR_ROTULO, Rotulo, Segmentado, localParaIso, useToast, type Tom } from '../../_ui'
import { useEspacoSM } from '../EspacoSM'
import { NovaPauta } from '../producao/Dialogos'
import { Grade } from './Grade'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const LEGENDA: Record<SmPilar, string> = { ESTOQUE: 'Estoque e produto', PROVA: 'Prova social · entregas', EDUCACAO: 'Educação · financiamento', BASTIDORES: 'Bastidores' }
const STATUS_REGRA: Record<'OK' | 'AJUSTAR' | 'ATENCAO', { texto: string; tom: Tom }> = { OK: { texto: 'OK', tom: 'ok' }, AJUSTAR: { texto: 'Ajustar', tom: 'bad' }, ATENCAO: { texto: 'Atenção', tom: 'warn' } }
const TODOS = new Set<SmPilar>(['ESTOQUE', 'PROVA', 'EDUCACAO', 'BASTIDORES'])

const somarDias = (dia: string, n: number) => new Date(Date.parse(`${dia}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10)
const mesDe = (dia: string) => dia.slice(0, 7)
const somarMeses = (mes: string, n: number) => { const d = new Date(Date.UTC(+mes.slice(0, 4), +mes.slice(5, 7) - 1 + n, 1)); return d.toISOString().slice(0, 7) }
const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`

export default function CalendarioPage() {
  const { pode } = useEspacoSM()
  if (!pode('producao')) return <div className="sm-card"><EstadoVazio titulo="Sem acesso ao calendário">O gestor pode liberar em Equipe → Acessos e permissões.</EstadoVazio></div>
  return <Calendario />
}

function Calendario() {
  const router = useRouter()
  const toast = useToast()
  const { pode } = useEspacoSM()
  const [mes, setMes] = useState<string | null>(null)
  const [cal, setCal] = useState<SmCalendario | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [modo, setModo] = useState<'mes' | 'semana'>('mes')
  const [semanaInicio, setSemanaInicio] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Set<SmPilar>>(TODOS)
  const [novaEm, setNovaEm] = useState<string | null | false>(false) // false = fechado; null = sem data
  const [editarRegras, setEditarRegras] = useState(false)
  const [motos, setMotos] = useState<SmMoto[] | null>(null)

  const carregar = useCallback((alvo: string | null) => {
    proLaboreApi.sm.calendario.mes(alvo ?? undefined).then(c => {
      setCal(c); setErro(null); setMes(c.mes)
      setSemanaInicio(s => {
        if (s && c.semanas.some(w => w[0].data === s)) return s
        return (c.semanas.find(w => w.some(d => d.hoje)) ?? c.semanas[0])[0].data
      })
    }).catch(e => setErro(e instanceof Error ? e.message : 'Erro ao carregar'))
  }, [])
  useEffect(() => { carregar(null) }, [carregar])
  useEffect(() => { if (pode('estoque')) proLaboreApi.sm.estoque.listar().then(setMotos).catch(() => setMotos(null)) }, [pode])

  const semanas = useMemo(() => {
    if (!cal) return []
    if (modo === 'mes') return cal.semanas
    return cal.semanas.filter(w => w[0].data === semanaInicio).slice(0, 1)
  }, [cal, modo, semanaInicio])

  function navegar(dir: -1 | 1) {
    if (!mes) return
    if (modo === 'mes') { carregar(somarMeses(mes, dir)); return }
    const novo = somarDias(semanaInicio!, dir * 7)
    setSemanaInicio(novo)
    const mesDaSemana = mesDe(somarDias(novo, 3)) // a quinta decide o mês da semana
    if (mesDaSemana !== mes) carregar(mesDaSemana)
  }

  function abrir(it: SmItemCalendario) {
    if (it.tipo === 'PAUTA') router.push(`/pro-labore/sm/producao?pauta=${it.id}`)
    else if (it.permalink) window.open(it.permalink, '_blank', 'noopener')
  }

  function horaSugerida(dia: SmDiaCalendario): string {
    const semana = new Date(`${dia.data}T12:00:00Z`).getUTCDay()
    const j = cal?.janelas.janelas.find(x => x.dia === semana) ?? cal?.janelas.janelas[0]
    const h = j ? Math.min(j.inicioHora + 1, 21) : 12
    return `${dia.data}T${String(h).padStart(2, '0')}:00`
  }

  async function soltar(it: SmItemCalendario, dia: string) {
    if (cal && dia < cal.hoje) { toast({ mensagem: 'Não dá para agendar num dia que já passou.', tom: 'bad' }); return }
    const antes = it.instante
    const novo = localParaIso(`${dia}T${it.hora}`)
    try {
      await proLaboreApi.sm.pautas.atualizar(it.id, { agendadoPara: novo })
      carregar(mes)
      toast({
        mensagem: `“${it.titulo}” movida para ${ddmm(dia)} às ${it.hora}.`,
        desfazer: async () => { await proLaboreApi.sm.pautas.atualizar(it.id, { agendadoPara: antes }); carregar(mes) },
      })
    } catch (e) {
      toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível mover', tom: 'bad' })
    }
  }

  const titulo = mes ? `${MESES[+mes.slice(5, 7) - 1]} ${mes.slice(0, 4)}` : 'Calendário'
  const tituloSemana = modo === 'semana' && semanaInicio ? `Semana de ${ddmm(semanaInicio)} a ${ddmm(somarDias(semanaInicio, 6))}` : null

  return (
    <>
      <header className="sm-pagina-cab">
        <div>
          <Rotulo>Trabalho · Calendário editorial</Rotulo>
          <div className="sm-nav-mes">
            <h1 className="sm-ttl sm-h1">{tituloSemana ?? titulo}</h1>
          </div>
          <p>Planeje o mês por pilares. O sistema avisa sobre buracos, rajadas e mix fora da meta.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="sm-linha-acoes" role="group" aria-label="Navegar no calendário">
            <Botao variante="fantasma" rotulo={modo === 'mes' ? 'Mês anterior' : 'Semana anterior'} icone={<span aria-hidden="true" style={{ fontSize: 20 }}>‹</span>} onClick={() => navegar(-1)} />
            <Botao variante="fantasma" onClick={() => { setSemanaInicio(null); carregar(null) }}>Hoje</Botao>
            <Botao variante="fantasma" rotulo={modo === 'mes' ? 'Próximo mês' : 'Próxima semana'} icone={<span aria-hidden="true" style={{ fontSize: 20 }}>›</span>} onClick={() => navegar(1)} />
          </div>
          <Segmentado rotulo="Visualização" valor={modo} aoMudar={setModo} opcoes={[{ valor: 'mes', rotulo: 'Mês' }, { valor: 'semana', rotulo: 'Semana' }]} />
          {cal?.podeEditar && <Botao variante="pri" icone={<IcMais tamanho={16} />} onClick={() => setNovaEm(null)}>Nova pauta</Botao>}
        </div>
      </header>

      <div className="sm-cal-legenda" role="group" aria-label="Filtrar por pilar">
        <span className="sm-mono" style={{ marginRight: 4 }}>Pilares</span>
        {(Object.keys(LEGENDA) as SmPilar[]).map(p => (
          <button
            key={p}
            type="button"
            className={`sm-chip p-${PILAR_CHIP[p]}`}
            aria-pressed={filtro.has(p)}
            onClick={() => setFiltro(f => { const n = new Set(f); if (n.has(p)) n.delete(p); else n.add(p); return n.size ? n : new Set(TODOS) })}
          >{LEGENDA[p]}</button>
        ))}
      </div>

      {erro && <p className="sm-erro" role="alert">{erro}</p>}
      {!cal && !erro && <CardEsqueleto linhas={6} />}

      {cal && (
        <div className="sm-cal-layout">
          <section className="sm-card sm-cal-grade-card" aria-label={tituloSemana ?? titulo}>
            <Grade
              semanas={semanas}
              modo={modo}
              filtro={filtro}
              aoAbrir={abrir}
              aoSlot={d => setNovaEm(horaSugerida(d))}
              aoSoltar={soltar}
            />
          </section>

          <div className="sm-cal-lado">
            <Card titulo="Regras de cadência" acoes={cal.souGestor ? <Botao variante="fantasma" onClick={() => setEditarRegras(true)}>Editar</Botao> : undefined}>
              {cal.regras.map(r => (
                <div key={r.chave} className="sm-regra"><Chip tom={STATUS_REGRA[r.status].tom}>{STATUS_REGRA[r.status].texto}</Chip><span>{r.texto}</span></div>
              ))}
            </Card>

            <Card titulo="Mix de pilares do mês">
              {cal.mix.pilares.map(m => (
                <div key={m.pilar} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span>{PILAR_ROTULO[m.pilar] === 'Estoque' ? 'Estoque e produto' : PILAR_ROTULO[m.pilar]}</span>
                    <span className="sm-muted">{Math.round(m.percentual * 100)}% · meta {Math.round(m.meta * 100)}%</span>
                  </div>
                  <div className={`sm-mix-barra p-${m.pilar}`} role="img" aria-label={`${PILAR_ROTULO[m.pilar]}: ${Math.round(m.percentual * 100)}% planejado, meta ${Math.round(m.meta * 100)}%`}>
                    <span style={{ width: `${Math.min(100, m.percentual * 100)}%` }} />
                    <i style={{ left: `calc(${m.meta * 100}% - 1px)` }} />
                  </div>
                </div>
              ))}
              <p className="sm-legenda" style={{ margin: 0 }}>
                {cal.mix.total === 0 ? 'Nenhum post com pilar neste mês ainda. ' : `${cal.mix.total} ${cal.mix.total === 1 ? 'post' : 'posts'} planejados ou publicados com pilar${cal.mix.semPilar ? `; ${cal.mix.semPilar} do Instagram sem pilar ficam de fora` : ''}. `}
                Regra 3 para 1: a cada 3 posts de valor, 1 post de oferta direta.
              </p>
            </Card>

            <Card titulo="Melhores janelas">
              {cal.janelas.base === 'SEM_DADOS' && <p className="sm-legenda" style={{ margin: 0 }}>Ainda não há posts suficientes para calcular. Cada janela precisa de pelo menos 3 posts.</p>}
              {cal.janelas.base === 'SEGUIDORES_ONLINE' && cal.janelas.janelas[0] && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>Dias úteis · {cal.janelas.janelas[0].inicioHora}h–{cal.janelas.janelas[0].fimHora}h</span><Chip tom="info">Seguidores online</Chip></div>
              )}
              {cal.janelas.base === 'POSTS' && cal.janelas.janelas.map(j => (
                <div key={`${j.dia}-${j.bloco}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }} title={`${j.posts} posts, alcance médio ${j.alcanceMedio.toLocaleString('pt-BR')} (${j.indice.toFixed(1).replace('.', ',')}× a mediana)`}>
                  <span>{DIAS_SEMANA[j.dia]} · {j.inicioHora}h–{j.fimHora}h</span>
                  <span style={{ display: 'flex', gap: 6 }}>
                    {j.emTeste && <Chip tom="learn">Em teste</Chip>}
                    <Chip tom={j.status === 'COMPROVADA' ? 'ok' : 'info'}>{j.status === 'COMPROVADA' ? 'Comprovado' : 'Hipótese'}</Chip>
                  </span>
                </div>
              ))}
              <p className="sm-legenda" style={{ margin: 0 }}>Horários de Brasília. Janela só vira “comprovada” com 5 posts ou mais; “em teste” quando um teste A/B de horário usa essa faixa.</p>
            </Card>
          </div>
        </div>
      )}

      {novaEm !== false && (
        <NovaPauta
          motos={motos}
          inicial={novaEm ? { agendadoPara: localParaIso(novaEm) ?? undefined, origem: 'CALENDARIO' } : undefined}
          aoFechar={() => setNovaEm(false)}
          aoCriar={p => {
            setNovaEm(false)
            carregar(mes)
            toast({ mensagem: novaEm ? `Pauta criada para ${ddmm(novaEm.slice(0, 10))} às ${novaEm.slice(11, 16)}. O briefing fica na Produção.` : 'Pauta criada em Ideias.' })
            if (!novaEm) router.push(`/pro-labore/sm/producao?pauta=${p.id}`)
          }}
        />
      )}
      {editarRegras && cal && <EditarRegras config={cal.config} aoFechar={() => setEditarRegras(false)} aoSalvar={() => { setEditarRegras(false); carregar(mes); toast({ mensagem: 'Regras atualizadas.' }) }} />}
    </>
  )
}

function EditarRegras({ config, aoFechar, aoSalvar }: { config: SmConfigCalendario; aoFechar: () => void; aoSalvar: () => void }) {
  const [c, setC] = useState(config)
  const [erro, setErro] = useState<string | null>(null)
  const soma = Object.values(c.mixMeta).reduce((s, v) => s + v, 0)
  const num = (k: keyof Omit<SmConfigCalendario, 'mixMeta'>, rotulo: string, min: number, max: number) => (
    <label className="sm-campo">{rotulo}<input className="sm-input" type="number" min={min} max={max} value={c[k]} onChange={e => setC({ ...c, [k]: Number(e.target.value) })} required /></label>
  )
  return (
    <Modal titulo="Regras e metas" aoFechar={aoFechar}>
      <form style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={async e => {
        e.preventDefault()
        try { await proLaboreApi.sm.calendario.salvarConfig(c); aoSalvar() } catch (err) { setErro(err instanceof Error ? err.message : 'Não foi possível salvar') }
      }}>
        <div className="sm-grade-2">
          {num('minDiasSemana', 'Mínimo de dias com post por semana', 1, 7)}
          {num('maxPostsDia', 'Máximo de posts por dia', 1, 10)}
          {num('maxDiasSemPost', 'Máximo de dias seguidos sem post', 1, 14)}
          {num('horizonteDias', 'Horizonte de planejamento (dias)', 7, 90)}
        </div>
        <Rotulo>Metas da semana (tela Hoje)</Rotulo>
        <div className="sm-grade-2">
          {num('metaLeadsSemana', 'Leads orgânicos por semana', 0, 1000)}
          {num('metaRespostaMin', 'Resposta a DMs (minutos)', 1, 1440)}
          {num('metaRetencao', 'Retenção dos reels (%)', 1, 100)}
        </div>
        <Rotulo>Mix de pilares (meta do mês, %)</Rotulo>
        <div className="sm-grade-2">
          {(Object.keys(PILAR_ROTULO) as SmPilar[]).map(p => (
            <label key={p} className="sm-campo">{PILAR_ROTULO[p]}
              <input className="sm-input" type="number" min={0} max={100} value={c.mixMeta[p]} onChange={e => setC({ ...c, mixMeta: { ...c.mixMeta, [p]: Number(e.target.value) } })} required />
            </label>
          ))}
        </div>
        <span className="sm-legenda" style={{ color: soma === 100 ? undefined : 'var(--sm-bad-fg)' }}>Soma do mix: {soma}%{soma === 100 ? '' : ' (precisa dar 100%)'}</span>
        {erro && <p className="sm-erro" role="alert">{erro}</p>}
        <div className="sm-linha-acoes" style={{ justifyContent: 'flex-end' }}>
          <Botao variante="fantasma" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" variante="pri" disabled={soma !== 100}>Salvar regras</Botao>
        </div>
      </form>
    </Modal>
  )
}
