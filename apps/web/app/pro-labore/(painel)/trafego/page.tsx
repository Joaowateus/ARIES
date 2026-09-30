'use client'

// Aba Tráfego: o funil do anúncio (Gerenciador de Anúncios da Meta) até o
// lead cadastrado no CRM, com a mesma lógica do funil comercial — pra
// entender com números onde a jornada perde gente e quanto custa cada
// etapa até o "custo por lead" que abre o funil comercial.
import { useCallback, useEffect, useRef, useState } from 'react'
import { proLaboreApi, type AnaliseTrafego, type ContaTrafego, type EtapaTrafego, type MetaEtapaTrafego, type ModoEtapaTrafego } from '@/lib/proLaboreApi'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { PageHeader } from '../../PageHeader'
import { FiltroPeriodo, periodoDoPreset, type Periodo } from '../social-media/_componentes/FiltroPeriodo'
import Conectar from './_componentes/Conectar'
import FunilTrafego from './_componentes/FunilTrafego'
import KpisTrafego from './_componentes/KpisTrafego'
import Diagnostico from './_componentes/Diagnostico'
import EvolucaoTrafego from './_componentes/EvolucaoTrafego'
import TabelaTrafego from './_componentes/TabelaTrafego'
import { tempoDesde } from './_componentes/formato'

const SECOES = [
  ['tf-jornada', 'Jornada até o lead'],
  ['tf-indicadores', 'Indicadores'],
  ['tf-melhorar', 'Onde melhorar'],
  ['tf-dia', 'Dia a dia'],
  ['tf-campanhas', 'Campanhas'],
] as const

// Sincroniza sozinho ao abrir se a última rodada foi há mais que isso.
const SYNC_AUTOMATICO_MS = 3 * 60 * 60 * 1000

function Secao({ id, eyebrow, titulo, nota, children }: { id: string; eyebrow: string; titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="pl-sv-section">
      <div className="pl-sv-section-head">
        <span className="pl-eyebrow">{eyebrow}</span>
        <h2 className="pl-section-title">{titulo}</h2>
        {nota && <p className="pl-hint">{nota}</p>}
      </div>
      <div className="pl-sv-grid">{children}</div>
    </section>
  )
}

export default function ProLaboreTrafegoPage() {
  const { usuario } = useProLaboreAuth()
  const [conta, setConta] = useState<ContaTrafego | null | undefined>(undefined)
  const [trocando, setTrocando] = useState(false)
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoDoPreset('7d'))
  const [filtro, setFiltro] = useState<{ campanhaId?: string; adsetId?: string }>({})
  const [analise, setAnalise] = useState<AnaliseTrafego | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  // Chave da última análise que voltou: se difere da pedida, está carregando.
  const [chaveCarregada, setChaveCarregada] = useState('')
  const [sincronizando, setSincronizando] = useState(false)
  const [versao, setVersao] = useState(0)
  const syncAutoRef = useRef(false)
  const campanhasRef = useRef<Array<{ id: string; nome: string }>>([])
  const [campanhas, setCampanhas] = useState<Array<{ id: string; nome: string }>>([])

  useEffect(() => {
    let cancelado = false
    proLaboreApi.trafego.conta()
      .then(r => { if (!cancelado) setConta(r.conectada ? r.conta : null) })
      .catch(e => { if (!cancelado) { setErro((e as Error).message); setConta(null) } })
    return () => { cancelado = true }
  }, [])

  const sincronizar = useCallback(async (silencioso = false) => {
    setSincronizando(true)
    if (!silencioso) setAviso('')
    try {
      const r = await proLaboreApi.trafego.sincronizar()
      setConta(r.conta)
      setVersao(v => v + 1)
    } catch (e) {
      setAviso((e as Error).message)
    } finally {
      setSincronizando(false)
    }
  }, [])

  // Abriu a aba e a última atualização é antiga: atualiza sozinho.
  useEffect(() => {
    if (!conta || syncAutoRef.current) return
    const ultima = conta.ultimaSincronizacaoEm ? new Date(conta.ultimaSincronizacaoEm).getTime() : 0
    if (Date.now() - ultima <= SYNC_AUTOMATICO_MS) {
      syncAutoRef.current = true
      return
    }
    const t = setTimeout(() => { syncAutoRef.current = true; void sincronizar(true) }, 0)
    return () => clearTimeout(t)
  }, [conta, sincronizar])

  const contaId = conta?.adAccountId
  const chavePedida = JSON.stringify([contaId, periodo.inicio, periodo.fim, filtro, versao])
  const carregando = chavePedida !== chaveCarregada
  useEffect(() => {
    if (!contaId) return
    let cancelado = false
    proLaboreApi.trafego.analise({ inicio: periodo.inicio, fim: periodo.fim, ...filtro })
      .then(a => {
        if (cancelado) return
        setAnalise(a)
        setErro('')
        // Lista de campanhas do filtro: guarda as que já apareceram (com
        // filtro ativo a análise só traz uma).
        const vistas = new Map(campanhasRef.current.map(c => [c.id, c]))
        a.campanhas.forEach(c => vistas.set(c.id, { id: c.id, nome: c.nome }))
        campanhasRef.current = [...vistas.values()].sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'))
        setCampanhas(campanhasRef.current)
      })
      .catch(e => { if (!cancelado) setErro((e as Error).message) })
      .finally(() => { if (!cancelado) setChaveCarregada(chavePedida) })
    return () => { cancelado = true }
  }, [contaId, periodo, filtro, versao, chavePedida])

  async function configurar(c: Parameters<typeof proLaboreApi.trafego.configurar>[0]) {
    try {
      const nova = await proLaboreApi.trafego.configurar(c)
      setConta(nova)
      setVersao(v => v + 1)
    } catch (e) {
      alert((e as Error).message)
    }
  }

  async function atualizarCustoTopo(valor: number) {
    if (!confirm(`Usar ${valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} como "custo por lead (topo da jornada)" no funil comercial do Dashboard?`)) return
    try {
      await proLaboreApi.parametros.atualizar({ custoPorLeadTopo: valor })
      setVersao(v => v + 1)
      setAviso('Custo por lead atualizado no funil comercial.')
    } catch (e) {
      alert((e as Error).message)
    }
  }

  async function desconectar() {
    if (!confirm('Desconectar o Gerenciador de Anúncios? O histórico guardado aqui é apagado (os dados continuam na Meta).')) return
    await proLaboreApi.trafego.desconectar()
    setConta(null)
    setAnalise(null)
    campanhasRef.current = []
    setCampanhas([])
  }

  if (usuario && usuario.papel !== 'DONO') {
    return <div className="pl-empty pl-card"><div className="pl-emoji">🔒</div>A aba Tráfego é só do responsável pela conta.</div>
  }

  const cabecalho = (
    <PageHeader
      eyebrow="Marketing"
      title="Tráfego"
      subtitle="Do anúncio ao lead no CRM: cada etapa com conversão, perda e custo — atualizado todo dia a partir do Gerenciador de Anúncios"
    />
  )

  if (conta === undefined) return <div>{cabecalho}<div className="pl-hint">Carregando…</div></div>
  if (conta === null || trocando) {
    return (
      <div>
        {cabecalho}
        {erro && <div className="pl-alert pl-alert-error">{erro}</div>}
        <Conectar
          atual={trocando ? conta : null}
          onCancelar={trocando ? () => setTrocando(false) : undefined}
          onConectado={(c, av) => {
            setConta(c)
            setTrocando(false)
            setAviso(av ?? '')
            campanhasRef.current = []
            setCampanhas([])
            setVersao(v => v + 1)
          }}
        />
      </div>
    )
  }

  const filtroCampanha = (
    <select
      className="pl-select pl-tf-filtro" aria-label="Filtrar por campanha"
      value={filtro.campanhaId ?? ''}
      onChange={e => setFiltro(e.target.value ? { campanhaId: e.target.value } : {})}
    >
      <option value="">Todas as campanhas</option>
      {campanhas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
    </select>
  )
  const conjuntoFiltrado = filtro.adsetId ? analise?.conjuntos.find(c => c.id === filtro.adsetId) : null

  return (
    <div className="pl-tf">
      {cabecalho}

      <div className="pl-tf-conta">
        <span className="pl-tf-conta-nome"><span className={`pl-tf-ponto ${conta.ultimoErroSync ? 'erro' : 'ok'}`} aria-hidden="true" /><b>{conta.nome}</b><small>{conta.adAccountId.replace('act_', 'ID ')}</small></span>
        <span className="pl-tf-conta-sync">
          {sincronizando ? 'Atualizando com a Meta…' : `Atualizado ${tempoDesde(conta.ultimaSincronizacaoEm)}`}
          {!conta.historicoCompleto && !sincronizando && ' · histórico de 90 dias ainda carregando'}
        </span>
        <button type="button" className="pl-btn pl-btn-ghost pl-tf-btn-peq" disabled={sincronizando} onClick={() => void sincronizar()}>{sincronizando ? 'Atualizando…' : 'Atualizar agora'}</button>
        <button type="button" className="pl-btn pl-btn-ghost pl-tf-btn-peq" onClick={() => setTrocando(true)}>Trocar token/conta</button>
        <button type="button" className="pl-btn pl-btn-ghost pl-tf-btn-peq pl-as-perigo" onClick={() => void desconectar()}>Desconectar</button>
      </div>
      {conta.ultimoErroSync && <div className="pl-alert pl-alert-error" style={{ marginBottom: 12 }}>{conta.ultimoErroSync}{/expirou|revogado/.test(conta.ultimoErroSync) && <> <button type="button" className="pl-link-action" onClick={() => setTrocando(true)}>Colar token novo</button></>}</div>}
      {aviso && <div className="pl-alert" style={{ marginBottom: 12 }}>{aviso}</div>}

      <FiltroPeriodo
        periodo={periodo}
        onChange={p => setPeriodo(p)}
        comparacao={analise ? { inicio: analise.periodo.anteriorInicio, fim: analise.periodo.anteriorFim } : null}
        secoes={SECOES}
        extra={filtroCampanha}
      />
      {conjuntoFiltrado && (
        <div className="pl-tf-filtro-ativo">
          Filtrando pelo conjunto <b>{conjuntoFiltrado.nome}</b>
          <button type="button" className="pl-link-action" onClick={() => setFiltro(filtro.campanhaId ? { campanhaId: filtro.campanhaId } : {})}>limpar</button>
        </div>
      )}

      {erro && <div className="pl-alert pl-alert-error">{erro}</div>}
      {!analise ? <div className="pl-hint" style={{ marginTop: 20 }}>{carregando ? 'Montando a análise…' : ''}</div> : (
        <div className={carregando ? 'pl-tf-recarregando' : ''}>
          <Secao id="tf-jornada" eyebrow="Funil do tráfego" titulo="Jornada até o lead" nota="Cada etapa com a conversão da anterior, a perda, o custo e a meta. O Connect rate mostra quantos dos cliques chegaram de verdade no destino.">
            <div className="pl-card"><FunilTrafego
              analise={analise}
              onMeta={(etapa: EtapaTrafego, meta: MetaEtapaTrafego | null) => configurar({ metas: { [etapa]: meta } })}
              onEtapas={(etapas: Partial<Record<EtapaTrafego, ModoEtapaTrafego>>) => configurar({ etapas })}
              onCrmSomenteTrafego={v => configurar({ crmSomenteTrafego: v })}
              onAtualizarCustoTopo={atualizarCustoTopo}
            /></div>
          </Secao>
          <Secao id="tf-indicadores" eyebrow="Gerenciador de Anúncios" titulo="Indicadores" nota="Comparados com o período anterior de mesmo tamanho.">
            <KpisTrafego analise={analise} />
          </Secao>
          <Secao id="tf-melhorar" eyebrow="Diagnóstico" titulo="Onde melhorar">
            <Diagnostico analise={analise} />
          </Secao>
          <Secao id="tf-dia" eyebrow="Evolução" titulo="Dia a dia">
            <EvolucaoTrafego analise={analise} />
          </Secao>
          <Secao id="tf-campanhas" eyebrow="Detalhe" titulo="Campanhas">
            <TabelaTrafego analise={analise} onFiltrar={f => { setFiltro(f); document.getElementById('tf-jornada')?.scrollIntoView({ behavior: 'smooth' }) }} />
          </Secao>
        </div>
      )}
    </div>
  )
}
