'use client'

// Tela de quem apresenta: edita o mapa (mesmo motor da aba Anotações),
// liga/desliga a transmissão, usa o ponteiro laser e vê quem está
// assistindo. Tudo que a equipe vê é salvo continuamente (~0,3s depois de
// cada mudança) e empurrado pros espectadores pela transmissão.
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  proLaboreApi, type ApresentacaoDetalhe, type Bloco, type ConfiguracaoApresentacao, type EspectadorApresentacao,
  type LembreteApresentacao, type PalcoApresentacao,
} from '@/lib/proLaboreApi'
import type { EstadoMotor, MotorMapaMental, VistaMundo } from '../../anotacoes/motor-mapa-mental/motor'
import type { NoArvore } from '../../anotacoes/motor-mapa-mental/dados'
import type { Layout } from '../../anotacoes/motor-mapa-mental/layoutMotor'
import { THEMES } from '../../anotacoes/motor-mapa-mental/temas'
import QuadroMotor from './QuadroMotor'
import Laser, { criarFonteLaser, type FonteLaser } from './Laser'
import PainelLateral from './PainelLateral'
import CopiarParaAnotacoes from './CopiarParaAnotacoes'
import { IconeCopiarAnotacoes, IconeTelaCheia, IconeLaser, IconePainel, IconeLink, IconeVoltar, duracaoDesde, linkBiblioteca, useTelaCheia } from './comum'

type Salvamento = 'salvo' | 'pendente' | 'salvando' | 'erro'
type Campos = Partial<{
  titulo: string; descricao: string | null; arvore: NoArvore; configuracao: ConfiguracaoApresentacao
  notas: Bloco[]; lembretes: LembreteApresentacao[]; notasPrivadas: string | null; visivelEquipe: boolean
}>

const LAYOUTS: Array<{ id: Layout; rotulo: string }> = [
  { id: 'mind', rotulo: 'Mapa mental' },
  { id: 'org', rotulo: 'Organograma' },
  { id: 'list', rotulo: 'Lista' },
]
const ESPERA_SALVAR_MS = 90
const ESPERA_MAXIMA_MS = 250
const INTERVALO_PALCO_MS = 150
const SINAL_VIDA_MS = 15_000
const AMOSTRA_LASER_MS = 40

export default function Apresentador({ inicial }: { inicial: ApresentacaoDetalhe }) {
  const id = inicial.id
  const cfgInicial: ConfiguracaoApresentacao = inicial.configuracao ?? { layout: 'mind', tema: 'meister', doisLados: true }
  const [titulo, setTitulo] = useState(inicial.titulo)
  const [notas, setNotas] = useState<Bloco[]>(inicial.notas ?? [])
  const [lembretes, setLembretes] = useState<LembreteApresentacao[]>(inicial.lembretes ?? [])
  const [notasPrivadas, setNotasPrivadas] = useState(inicial.notasPrivadas ?? '')
  const [visivelEquipe, setVisivelEquipe] = useState(inicial.visivelEquipe)
  const [aoVivo, setAoVivo] = useState(inicial.aoVivo)
  const [aoVivoDesde, setAoVivoDesde] = useState(inicial.aoVivoDesde)
  const [alternandoAoVivo, setAlternandoAoVivo] = useState(false)
  const [estadoMotor, setEstadoMotor] = useState<EstadoMotor | null>(null)
  const [laserAtivo, setLaserAtivo] = useState(false)
  const [painelAberto, setPainelAberto] = useState(true)
  const [espectadores, setEspectadores] = useState<EspectadorApresentacao[]>([])
  const [listaAberta, setListaAberta] = useState(false)
  const [salvamento, setSalvamento] = useState<Salvamento>('salvo')
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [copiandoAnotacoes, setCopiandoAnotacoes] = useState(false)
  // Quem é da equipe só vai ao vivo depois que o dono autoriza.
  const [aprovacao, setAprovacao] = useState(inicial.aprovacao)
  const [motivoRecusa, setMotivoRecusa] = useState(inicial.aprovacaoMotivo)
  const [pedindo, setPedindo] = useState(false)
  const [, forcarRelogio] = useState(0)
  const { ref: telaRef, cheia, alternar: alternarTelaCheia } = useTelaCheia<HTMLDivElement>()

  const motorRef = useRef<MotorMapaMental | null>(null)
  const configRef = useRef(cfgInicial)
  const arvoreSalvaRef = useRef(JSON.stringify(inicial.arvore))

  // ---------- Salvamento contínuo ----------
  const pendenteRef = useRef<Campos>({})
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const primeiroPendenteRef = useRef(0)
  const emVooRef = useRef(false)

  // Novas tentativas passam pela ref (a função não pode se referenciar
  // dentro da própria definição).
  const reenviarRef = useRef<() => void>(() => undefined)
  const enviar = useCallback(async () => {
    timerRef.current = null
    if (emVooRef.current) { timerRef.current = setTimeout(() => reenviarRef.current(), 120); return }
    const dados = pendenteRef.current
    if (Object.keys(dados).length === 0) return
    pendenteRef.current = {}
    primeiroPendenteRef.current = 0
    emVooRef.current = true
    setSalvamento('salvando')
    try {
      await proLaboreApi.apresentacoes.atualizar(id, dados)
      setSalvamento(Object.keys(pendenteRef.current).length ? 'pendente' : 'salvo')
      setErro('')
    } catch (e) {
      pendenteRef.current = { ...dados, ...pendenteRef.current }
      setSalvamento('erro')
      setErro((e as Error).message)
      timerRef.current = setTimeout(() => reenviarRef.current(), 3000)
    } finally {
      emVooRef.current = false
    }
  }, [id])
  useEffect(() => { reenviarRef.current = () => void enviar() }, [enviar])

  const agendar = useCallback((campos: Campos, espera = ESPERA_SALVAR_MS) => {
    pendenteRef.current = { ...pendenteRef.current, ...campos }
    setSalvamento('pendente')
    const agora = Date.now()
    if (!primeiroPendenteRef.current) primeiroPendenteRef.current = agora
    if (timerRef.current) clearTimeout(timerRef.current)
    // Digitando sem parar: salva pelo menos a cada ~0,25s, pra equipe ver o
    // texto aparecendo, não só quando você para.
    const restante = Math.max(0, ESPERA_MAXIMA_MS - (agora - primeiroPendenteRef.current))
    timerRef.current = setTimeout(() => void enviar(), Math.min(espera, restante))
  }, [enviar])

  useEffect(() => () => { if (timerRef.current) { clearTimeout(timerRef.current); void enviar() } }, [enviar])

  useEffect(() => {
    const aviso = (e: BeforeUnloadEvent) => {
      if (Object.keys(pendenteRef.current).length || emVooRef.current || aoVivo) { e.preventDefault() }
    }
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [aoVivo])

  // ---------- Palco (o que a equipe acompanha além do mapa) ----------
  const vistaRef = useRef<VistaMundo | null>(null)
  const selRef = useRef<string | null>(null)
  const pontosRef = useRef<Array<{ x: number; y: number }>>([])
  const laserAtivoRef = useRef(false)
  const fonteLaserRef = useRef<FonteLaser>(criarFonteLaser())
  const ultimoPalcoRef = useRef({ chave: '', em: 0 })
  const palcoEmVooRef = useRef(false)

  useEffect(() => { laserAtivoRef.current = laserAtivo; fonteLaserRef.current.ativo = laserAtivo }, [laserAtivo])

  useEffect(() => {
    if (!aoVivo) return
    const enviarPalco = async (forcar = false) => {
      if (palcoEmVooRef.current) return
      const pontos = pontosRef.current.splice(0, 30)
      const palco: PalcoApresentacao = { vista: vistaRef.current, sel: selRef.current, laser: { ativo: laserAtivoRef.current, pontos } }
      const chave = JSON.stringify({ ...palco, laser: { ativo: palco.laser.ativo } })
      const agora = Date.now()
      if (!forcar && !pontos.length && chave === ultimoPalcoRef.current.chave && agora - ultimoPalcoRef.current.em < SINAL_VIDA_MS) return
      ultimoPalcoRef.current = { chave, em: agora }
      palcoEmVooRef.current = true
      try { await proLaboreApi.apresentacoes.enviarPalco(id, palco) } catch { /* próxima rodada tenta de novo */ } finally { palcoEmVooRef.current = false }
    }
    void enviarPalco(true)
    const t = setInterval(() => void enviarPalco(), INTERVALO_PALCO_MS)
    return () => clearInterval(t)
  }, [aoVivo, id])

  // Quem está assistindo (a cada 5s enquanto ao vivo) + relógio da duração.
  useEffect(() => {
    if (!aoVivo) return
    let cancelado = false
    const buscar = () => proLaboreApi.apresentacoes.espectadores(id).then(l => { if (!cancelado) setEspectadores(l) }).catch(() => undefined)
    void buscar()
    const t = setInterval(() => { void buscar(); forcarRelogio(n => n + 1) }, 5000)
    return () => { cancelado = true; clearInterval(t) }
  }, [aoVivo, id])

  const ultimaAmostraRef = useRef(0)
  function capturarLaser(e: React.PointerEvent<HTMLDivElement>) {
    if (!laserAtivoRef.current || !motorRef.current) return
    const agora = e.timeStamp
    if (agora - ultimaAmostraRef.current < AMOSTRA_LASER_MS) return
    ultimaAmostraRef.current = agora
    const r = e.currentTarget.getBoundingClientRect()
    const p = motorRef.current.telaParaMundo(e.clientX - r.left, e.clientY - r.top)
    const ponto = { x: Math.round(p.x), y: Math.round(p.y) }
    if (aoVivo) pontosRef.current.push(ponto)
    fonteLaserRef.current.fila.push(ponto)
  }

  // ---------- Ações ----------
  async function alternarAoVivo() {
    if (aoVivo && !confirm('Encerrar a transmissão? A equipe continua vendo o conteúdo salvo, mas para de acompanhar ao vivo.')) return
    setAlternandoAoVivo(true)
    try {
      if (timerRef.current) { clearTimeout(timerRef.current); await enviar() }
      const d = await proLaboreApi.apresentacoes.definirAoVivo(id, !aoVivo)
      setAoVivo(d.aoVivo)
      setAoVivoDesde(d.aoVivoDesde)
      if (!d.aoVivo) { setLaserAtivo(false); setEspectadores([]) }
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setAlternandoAoVivo(false)
    }
  }

  async function pedirAutorizacao(cancelar = false) {
    setPedindo(true)
    try {
      if (timerRef.current) { clearTimeout(timerRef.current); await enviar() }
      const d = await proLaboreApi.apresentacoes.pedir(id, cancelar)
      setAprovacao(d.aprovacao)
      setMotivoRecusa(d.aprovacaoMotivo)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setPedindo(false)
    }
  }

  function mudarConfig(parcial: Partial<ConfiguracaoApresentacao>) {
    const nova = { ...configRef.current, ...parcial }
    configRef.current = nova
    const m = motorRef.current
    if (parcial.layout) m?.setLayout(parcial.layout)
    if (parcial.tema) m?.setTheme(parcial.tema)
    if (parcial.doisLados !== undefined) m?.setBalanced(parcial.doisLados)
    agendar({ configuracao: nova })
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* navegador sem permissão de área de transferência */ }
  }

  const assistindo = espectadores.filter(e => e.assistindo)
  const layoutAtual = estadoMotor?.layout ?? cfgInicial.layout

  return (
    <div ref={telaRef} className={`pl-ap-tela ${cheia ? 'cheia' : ''}`}>
      <header className="pl-ap-barra">
        <Link href={linkBiblioteca(inicial)} className="pl-ap-icone-btn" aria-label="Voltar pra biblioteca"><IconeVoltar /></Link>
        <input
          className="pl-ap-titulo"
          value={titulo}
          maxLength={120}
          aria-label="Título da apresentação"
          onChange={e => { setTitulo(e.target.value); if (e.target.value.trim()) agendar({ titulo: e.target.value.trim() }, 600) }}
        />
        <span className={`pl-ap-salvo ${salvamento}`} role="status">
          {salvamento === 'salvo' ? 'Salvo' : salvamento === 'erro' ? 'Erro ao salvar — tentando de novo' : 'Salvando…'}
        </span>

        <div className="pl-ap-barra-meio">
          {aoVivo ? (
            <div className="pl-ap-aovivo-wrap">
              <button type="button" className="pl-ap-aovivo" onClick={() => setListaAberta(a => !a)} aria-expanded={listaAberta}>
                <span className="pl-ap-pulso" aria-hidden="true" />AO VIVO {aoVivoDesde && <span className="pl-mono">{duracaoDesde(aoVivoDesde)}</span>}
                <span className="pl-ap-aovivo-sep" />👁 {assistindo.length} {assistindo.length === 1 ? 'assistindo' : 'assistindo'}
              </button>
              {listaAberta && (
                <div className="pl-ap-pop" onMouseLeave={() => setListaAberta(false)}>
                  <div className="pl-ap-sub">Assistindo agora</div>
                  {assistindo.length === 0 ? <div className="pl-hint">Ninguém ainda — mande o link pra equipe.</div> : (
                    <ul>{assistindo.map(e => <li key={e.nome}><span className="pl-ap-ponto-on" />{e.nome}</li>)}</ul>
                  )}
                  {espectadores.some(e => !e.assistindo) && (
                    <>
                      <div className="pl-ap-sub">Já passaram por aqui</div>
                      <ul>{espectadores.filter(e => !e.assistindo).map(e => <li key={e.nome} className="off">{e.nome}</li>)}</ul>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : <span className="pl-ap-rascunho">Não transmitindo</span>}
        </div>

        <div className="pl-ap-barra-acoes">
          <button type="button" className={`pl-ap-icone-btn ${laserAtivo ? 'ligado laser' : ''}`} onClick={() => setLaserAtivo(l => !l)} aria-pressed={laserAtivo} title="Ponteiro laser — a equipe vê um ponto vermelho seguindo seu mouse">
            <IconeLaser />
          </button>
          <button type="button" className="pl-ap-icone-btn" onClick={copiarLink} title="Copiar link pra equipe">
            <IconeLink />{copiado && <span className="pl-ap-tip">Link copiado</span>}
          </button>
          <button type="button" className={`pl-ap-icone-btn ${painelAberto ? 'ligado' : ''}`} onClick={() => setPainelAberto(p => !p)} aria-pressed={painelAberto} title="Anotações e lembretes">
            <IconePainel />
          </button>
          <button type="button" className="pl-ap-icone-btn" onClick={() => setCopiandoAnotacoes(true)} title="Salvar cópia nas Anotações">
            <IconeCopiarAnotacoes />
          </button>
          <button type="button" className="pl-ap-icone-btn" onClick={alternarTelaCheia} title={cheia ? 'Sair da tela cheia' : 'Tela cheia'}><IconeTelaCheia cheia={cheia} /></button>
          {aprovacao === 'APROVADA' || aoVivo ? (
            <button type="button" className={`pl-btn ${aoVivo ? 'pl-btn-ghost pl-ap-encerrar' : 'pl-btn-primary pl-ap-iniciar'}`} disabled={alternandoAoVivo} onClick={alternarAoVivo}>
              {alternandoAoVivo ? '…' : aoVivo ? 'Encerrar' : 'Iniciar ao vivo'}
            </button>
          ) : aprovacao === 'PENDENTE' ? (
            <button type="button" className="pl-btn pl-btn-ghost pl-ap-aguardando" disabled>Aguardando autorização</button>
          ) : (
            <button type="button" className="pl-btn pl-btn-primary" disabled={pedindo} onClick={() => pedirAutorizacao()}>
              {pedindo ? 'Enviando…' : aprovacao === 'RECUSADA' ? 'Pedir de novo' : 'Pedir pra apresentar'}
            </button>
          )}
        </div>
      </header>

      <div className="pl-ap-ferramentas">
        <div className="pl-motor-seg" role="group" aria-label="Layout">
          {LAYOUTS.map(l => (
            <button key={l.id} type="button" aria-pressed={layoutAtual === l.id} onClick={() => mudarConfig({ layout: l.id })}>{l.rotulo}</button>
          ))}
        </div>
        <button
          type="button" className="pl-motor-chip" aria-pressed={!!estadoMotor?.balanced && layoutAtual === 'mind'} disabled={layoutAtual !== 'mind'}
          onClick={() => mudarConfig({ doisLados: !estadoMotor?.balanced })}
        >Dois lados</button>
        <label className="pl-ap-tema">
          <span>Tema</span>
          <select value={estadoMotor?.theme ?? cfgInicial.tema} onChange={e => mudarConfig({ tema: e.target.value })}>
            {Object.entries(THEMES).map(([k, t]) => <option key={k} value={k}>{t.name}</option>)}
          </select>
        </label>
        <span className="pl-motor-grow" />
        <button type="button" className="pl-motor-icon" aria-label="Desfazer" title="Desfazer (Ctrl+Z)" disabled={!estadoMotor?.canUndo} onClick={() => motorRef.current?.undo()}>↶</button>
        <button type="button" className="pl-motor-icon" aria-label="Refazer" title="Refazer (Ctrl+Shift+Z)" disabled={!estadoMotor?.canRedo} onClick={() => motorRef.current?.redo()}>↷</button>
        <span className="pl-ap-atalhos">Tab: ideia filha · Enter: irmã · F2: editar · Espaço: recolher</span>
      </div>

      {erro && salvamento === 'erro' && <div className="pl-alert pl-alert-error pl-ap-erro">{erro}</div>}

      <div className={`pl-ap-corpo ${painelAberto ? 'com-painel' : ''}`}>
        <div className={`pl-ap-palco ${laserAtivo ? 'laser' : ''}`} onPointerMove={capturarLaser}>
          <QuadroMotor
            arvoreInicial={inicial.arvore}
            layout={cfgInicial.layout}
            tema={cfgInicial.tema}
            doisLados={cfgInicial.doisLados}
            onPronto={m => { motorRef.current = m; vistaRef.current = m.getVistaMundo() }}
            onMudancaEstado={setEstadoMotor}
            onMudancaVista={v => { vistaRef.current = { x: Math.round(v.x), y: Math.round(v.y), w: Math.round(v.w), h: Math.round(v.h) } }}
            onMudancaSelecao={s => { selRef.current = s }}
            onMudancaArvore={tree => {
              const json = JSON.stringify(tree)
              if (json === arvoreSalvaRef.current) return
              arvoreSalvaRef.current = json
              agendar({ arvore: JSON.parse(json) })
            }}
          >
            <Laser motorRef={motorRef} fonteRef={fonteLaserRef} />
          </QuadroMotor>
          {!aoVivo && aprovacao === 'APROVADA' && (
            <div className="pl-ap-dica-flutuante">
              Monte o mapa à vontade — quando for apresentar, clique em <b>Iniciar ao vivo</b> e mande o link pra equipe.
            </div>
          )}
          {!aoVivo && aprovacao !== 'APROVADA' && (
            <div className={`pl-ap-aprovacao ${aprovacao.toLowerCase()}`} role="status">
              {aprovacao === 'RASCUNHO' && <>Rascunho — só você vê. Monte à vontade e, quando estiver pronto, clique em <b>Pedir pra apresentar</b>: o responsável recebe o pedido e libera.</>}
              {aprovacao === 'PENDENTE' && (
                <>
                  Pedido enviado — assim que o responsável autorizar, o botão <b>Iniciar ao vivo</b> aparece aqui. Dá pra continuar editando enquanto isso.
                  <button type="button" disabled={pedindo} onClick={() => pedirAutorizacao(true)}>Cancelar pedido</button>
                </>
              )}
              {aprovacao === 'RECUSADA' && <>Não autorizada{motivoRecusa ? <>: <i>“{motivoRecusa}”</i></> : ''}. Ajuste o que precisar e peça de novo.</>}
            </div>
          )}
        </div>
        {painelAberto && (
          <PainelLateral
            editavel
            notas={notas}
            lembretes={lembretes}
            notasPrivadas={notasPrivadas}
            onNotas={b => { setNotas(b); agendar({ notas: b }, 500) }}
            onLembretes={l => { setLembretes(l); agendar({ lembretes: l }, 200) }}
            onNotasPrivadas={t => { setNotasPrivadas(t); agendar({ notasPrivadas: t }, 800) }}
            extra={aprovacao !== 'APROVADA' ? undefined :
              <label className="pl-ap-visivel">
                <input type="checkbox" checked={visivelEquipe} onChange={e => { setVisivelEquipe(e.target.checked); agendar({ visivelEquipe: e.target.checked }, 0) }} />
                <span><b>Equipe pode rever depois</b><small>Desmarcado, a equipe só vê enquanto estiver ao vivo.</small></span>
              </label>
            }
          />
        )}
      </div>
      {copiandoAnotacoes && (
        <CopiarParaAnotacoes
          onFechar={() => setCopiandoAnotacoes(false)}
          obter={() => ({
            titulo: titulo.trim() || inicial.titulo, icone: inicial.icone, arvore: JSON.parse(arvoreSalvaRef.current),
            configuracao: configRef.current, notas, textoPessoal: notasPrivadas,
          })}
        />
      )}
    </div>
  )
}
