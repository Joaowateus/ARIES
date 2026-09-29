'use client'

import { useEffect, useState } from 'react'
import { proLaboreApi, type ConfigAssistenteResposta, type ResumoAssistente, type Vendedor } from '@/lib/proLaboreApi'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { PageHeader } from '../../PageHeader'
import { Conexao } from './_componentes/Conexao'
import { AtendimentosPorDia, DesfechoEOrigem, FunilCrm, FunilRoteiro, HorarioChegada, KpisAssistente } from './_componentes/Desempenho'
import { Conversas } from './_componentes/Conversas'
import { Roteiro } from './_componentes/Roteiro'
import { nomeProprio } from './_componentes/util'

type Aba = 'visao' | 'conversas' | 'roteiro'
const ABAS: Array<{ valor: Aba; rotulo: string }> = [
  { valor: 'visao', rotulo: 'Desempenho' },
  { valor: 'conversas', rotulo: 'Conversas' },
  { valor: 'roteiro', rotulo: 'Roteiro e teste' },
]
const PERIODOS = [7, 30, 90] as const

const COMO_FUNCIONA = [
  { titulo: 'Lead novo chama', texto: 'Veio de anúncio, mandou a frase da campanha ou é a primeira conversa com o vendedor.' },
  { titulo: 'Assistente qualifica', texto: 'Se apresenta como assistente e faz as perguntas do roteiro, uma por vez.' },
  { titulo: 'Vai pro CRM + aviso', texto: 'O lead é criado com as respostas e o vendedor recebe o resumo no próprio WhatsApp.' },
  { titulo: 'Vendedor assume', texto: 'Assim que o vendedor responde, o assistente sai de cena naquela conversa.' },
]

export default function ProLaboreAssistentePage() {
  const { usuario } = useProLaboreAuth()
  const isDono = usuario?.papel === 'DONO'

  const [vendedores, setVendedores] = useState<Vendedor[] | null>(null)
  const [vendedorEscolhido, setVendedorEscolhido] = useState('')
  const [aba, setAba] = useState<Aba>('visao')
  const [dias, setDias] = useState<(typeof PERIODOS)[number]>(30)
  const [versao, setVersao] = useState(0)
  const [config, setConfig] = useState<{ chave: string; dados: ConfigAssistenteResposta } | null>(null)
  const [resumo, setResumo] = useState<{ chave: string; dados: ResumoAssistente } | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!isDono) return
    proLaboreApi.vendedores.listar().then(vs => setVendedores(vs.filter(v => v.ativo))).catch(() => setVendedores([]))
  }, [isDono])

  const vendedorId = isDono ? (vendedorEscolhido || vendedores?.[0]?.id) : undefined
  const pronto = !isDono || !!vendedorId
  const chaveConfig = `${vendedorId ?? 'eu'}|${versao}`

  useEffect(() => {
    if (!pronto) return
    let cancelado = false
    proLaboreApi.assistente.config(vendedorId)
      .then(dados => { if (!cancelado) { setConfig({ chave: chaveConfig, dados }); setErro('') } })
      .catch(e => { if (!cancelado) setErro((e as Error).message) })
    return () => { cancelado = true }
  }, [pronto, vendedorId, chaveConfig])

  const chaveResumo = `${vendedorId ?? 'eu'}|${dias}|${versao}`
  useEffect(() => {
    if (!pronto || aba !== 'visao') return
    let cancelado = false
    proLaboreApi.assistente.resumo({ vendedorId, dias })
      .then(dados => { if (!cancelado) setResumo({ chave: chaveResumo, dados }) })
      .catch(() => undefined)
    return () => { cancelado = true }
  }, [pronto, aba, vendedorId, dias, chaveResumo])

  // Mantém os números da fila ("esperando você") atualizados enquanto a
  // aba está aberta.
  useEffect(() => {
    const id = setInterval(() => setVersao(v => v + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const dados = config?.dados
  const doVendedorAtual = !!config && config.chave.startsWith(`${vendedorId ?? 'eu'}|`)
  const assistente = doVendedorAtual ? dados?.assistente ?? null : null
  const nomeVendedor = nomeProprio((doVendedorAtual && dados?.vendedor?.nome) || vendedores?.find(v => v.id === vendedorId)?.nome || usuario?.nome || 'vendedor')
  const conectado = assistente?.status === 'CONECTADO'
  const resumoAtual = resumo && resumo.chave.startsWith(`${vendedorId ?? 'eu'}|`) ? resumo.dados : null
  const recarregandoResumo = !!resumo && resumo.chave !== chaveResumo
  const atualizar = () => setVersao(v => v + 1)

  return (
    <div className="pl-as">
      <PageHeader
        eyebrow="Operação"
        title="Assistente Comercial"
        subtitle="Um assistente no WhatsApp de cada vendedor: pré-atende os leads novos, qualifica com o seu roteiro, joga no CRM e avisa o vendedor na hora certa"
      />

      {isDono && vendedores && vendedores.length > 0 && (
        <div className="pl-as-seletor">
          <span className="pl-hint">Vendedor</span>
          <select className="pl-select-chip active" value={vendedorId} onChange={e => setVendedorEscolhido(e.target.value)} aria-label="Escolher vendedor">
            {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>
        </div>
      )}

      {isDono && vendedores && vendedores.length === 0 ? (
        <div className="pl-empty pl-card" style={{ marginTop: 16 }}>
          <div className="pl-emoji">🧑‍💼</div>
          <h3 style={{ margin: 0, color: 'var(--pl-ink-1)', fontWeight: 600 }}>Cadastre um vendedor primeiro</h3>
          <p style={{ margin: '6px 0 0' }}>Cada vendedor tem o próprio assistente, ligado ao WhatsApp dele.</p>
        </div>
      ) : erro ? (
        <div className="pl-alert pl-alert-error" style={{ marginTop: 16 }}>{erro}</div>
      ) : !dados || !doVendedorAtual ? (
        <div className="pl-hint" style={{ marginTop: 16 }}>Carregando…</div>
      ) : (
        <>
          <Conexao
            key={`conexao-${vendedorId ?? 'eu'}`}
            assistente={assistente}
            vendedorId={vendedorId}
            nomeVendedor={nomeVendedor}
            servidorConfigurado={dados.servidorConfigurado}
            isDono={isDono}
            onAtualizar={atualizar}
          />

          {!conectado && (
            <ol className="pl-as-como">
              {COMO_FUNCIONA.map((p, i) => (
                <li key={p.titulo}>
                  <span className="pl-sv-num">{String(i + 1).padStart(2, '0')}</span>
                  <b>{p.titulo}</b>
                  <span>{p.texto}</span>
                </li>
              ))}
            </ol>
          )}

          <div className="pl-as-abas">
            <div className="pl-sv-tabs" role="tablist" aria-label="Seções do assistente">
              {ABAS.map(a => (
                <button key={a.valor} type="button" role="tab" aria-selected={aba === a.valor} className={aba === a.valor ? 'ativo' : ''} onClick={() => setAba(a.valor)}>
                  {a.rotulo}
                  {a.valor === 'conversas' && (resumoAtual?.totais.aguardandoAgora ?? 0) > 0 && <span className="pl-as-badge">{resumoAtual!.totais.aguardandoAgora}</span>}
                </button>
              ))}
            </div>
            {aba === 'visao' && (
              <div className="pl-as-periodos" role="group" aria-label="Período">
                {PERIODOS.map(p => (
                  <button key={p} type="button" className={`pl-chip ${dias === p ? 'active' : ''}`} onClick={() => setDias(p)}>{p} dias</button>
                ))}
              </div>
            )}
          </div>

          {aba === 'visao' && (
            !resumoAtual ? <div className="pl-hint">Carregando…</div> : (
              <div className="pl-as-visao">
                <KpisAssistente resumo={resumoAtual} />
                {resumoAtual.totais.aguardandoAgora > 0 && (
                  <button type="button" className="pl-as-fila" onClick={() => setAba('conversas')}>
                    <b>{resumoAtual.totais.aguardandoAgora} lead{resumoAtual.totais.aguardandoAgora > 1 ? 's' : ''} esperando resposta</b>
                    <span>Quanto antes o vendedor responder, maior a chance de venda — abrir conversas →</span>
                  </button>
                )}
                <div className="pl-sv-grid pl-sv-grid-2">
                  <AtendimentosPorDia resumo={resumoAtual} recarregando={recarregandoResumo} />
                  <FunilRoteiro resumo={resumoAtual} recarregando={recarregandoResumo} />
                </div>
                <DesfechoEOrigem resumo={resumoAtual} recarregando={recarregandoResumo} />
                <div className="pl-sv-grid pl-sv-grid-2-eq">
                  <HorarioChegada resumo={resumoAtual} recarregando={recarregandoResumo} />
                  <FunilCrm resumo={resumoAtual} recarregando={recarregandoResumo} />
                </div>
              </div>
            )
          )}

          {aba === 'conversas' && (
            <Conversas
              key={`conversas-${vendedorId ?? 'eu'}`}
              vendedorId={vendedorId}
              conectado={conectado}
              nomeVendedor={nomeVendedor}
              focoInicial={(resumoAtual?.totais.aguardandoAgora ?? 0) > 0 ? 'AGUARDANDO_VENDEDOR' : ''}
              onMudou={atualizar}
            />
          )}

          {aba === 'roteiro' && (
            <Roteiro
              key={`roteiro-${vendedorId ?? 'eu'}`}
              vendedorId={vendedorId}
              salva={assistente?.configuracao ?? dados.configuracaoPadrao}
              padrao={dados.configuracaoPadrao}
              nomeVendedor={nomeVendedor}
              onSalvo={atualizar}
            />
          )}
        </>
      )}
    </div>
  )
}
