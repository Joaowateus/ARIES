'use client'

// Copiloto Comercial: o mentor diário de cada pessoa. Lê a produção
// registrada no sistema (CRM, agenda, vendas, conversas de lead do
// WhatsApp), entrega o relatório do dia com o plano de ações, os estudos e
// as sugestões de resposta, e aprende com o que a pessoa faz e diz.
import './copiloto.css'
import { useEffect, useState } from 'react'
import { proLaboreApi, type CpHoje, type CpPessoa } from '@/lib/proLaboreApi'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { PageHeader } from '../../PageHeader'
import { Hoje } from './_componentes/Hoje'
import { Conversas } from './_componentes/Conversas'
import { Estudos } from './_componentes/Estudos'
import { Evolucao } from './_componentes/Evolucao'
import { Chat } from './_componentes/Chat'
import { Memoria } from './_componentes/Memoria'
import { MeuAgente } from '../_agente/MeuAgente'

export type AbaCopiloto = 'hoje' | 'conversas' | 'estudar' | 'evolucao' | 'conversar' | 'memoria'

export default function CopilotoPage() {
  const { usuario } = useProLaboreAuth()
  const isDono = usuario?.papel === 'DONO'
  const [pessoas, setPessoas] = useState<CpPessoa[] | null>(null)
  const [pessoaEscolhida, setPessoaEscolhida] = useState('')
  const pessoa = isDono ? (pessoaEscolhida || 'EQUIPE') : undefined
  const [aba, setAba] = useState<AbaCopiloto>('hoje')
  const [conversaInicial, setConversaInicial] = useState<string | null>(null)
  const [versao, setVersao] = useState(0)
  const chave = `${pessoa ?? 'eu'}|${versao}`
  const [hoje, setHoje] = useState<{ chave: string; dados: CpHoje } | null>(null)
  const [escrevendo, setEscrevendo] = useState<string | null>(null)
  const [erro, setErro] = useState<{ chave: string; texto: string } | null>(null)

  useEffect(() => {
    if (!isDono) return
    proLaboreApi.copiloto.pessoas().then(setPessoas).catch(() => setPessoas([]))
  }, [isDono, versao])

  useEffect(() => {
    let cancelado = false
    proLaboreApi.copiloto.hoje(pessoa)
      .then(d => {
        if (cancelado) return
        setHoje({ chave, dados: d })
        if (d.minha && !d.lidoEm) proLaboreApi.copiloto.lido(pessoa).catch(() => undefined)
        // As regras respondem na hora; a IA escreve o relatório em seguida.
        if (d.iaPendente) {
          setEscrevendo(chave)
          proLaboreApi.copiloto.hojeIA(pessoa)
            .then(x => { if (!cancelado) setHoje({ chave, dados: x }) })
            .catch(() => undefined)
            .finally(() => setEscrevendo(c => (c === chave ? null : c)))
        }
      })
      .catch(e => { if (!cancelado) setErro({ chave, texto: (e as Error).message }) })
    return () => { cancelado = true }
  }, [chave, pessoa])

  const dados = hoje && hoje.chave.split('|')[0] === (pessoa ?? 'eu') ? hoje.dados : null
  const erroAtual = erro?.chave === chave ? erro.texto : ''
  const pendentesWhats = dados ? dados.fatos.whatsapp.esperandoAgora + dados.fatos.whatsapp.semResposta : 0
  const minha = dados?.minha ?? !isDono
  const abas: Array<{ valor: AbaCopiloto; rotulo: string }> = [
    { valor: 'hoje', rotulo: 'Hoje' },
    { valor: 'conversas', rotulo: 'Conversas do WhatsApp' },
    { valor: 'estudar', rotulo: 'Estudar' },
    { valor: 'evolucao', rotulo: 'Evolução' },
    ...(minha ? [{ valor: 'conversar' as const, rotulo: 'Conversar' }, { valor: 'memoria' as const, rotulo: 'Memória e ajustes' }] : []),
  ]
  const abaAtual = abas.some(a => a.valor === aba) ? aba : 'hoje'
  const irPara = (a: AbaCopiloto, conversaId?: string) => { if (conversaId) setConversaInicial(conversaId); setAba(a) }
  const abrirPessoa = (id: string) => { setPessoaEscolhida(id); setAba('hoje') }

  return (
    <div className="cp">
      <PageHeader
        eyebrow="Vendas"
        title="Copiloto Comercial"
        subtitle="Seu mentor de vendas de todo dia: lê a sua produção no sistema, mostra onde você vai bem e onde está errando, monta o plano do dia e indica o que estudar e o que responder"
      />

      {isDono && pessoas && pessoas.length > 0 && (
        <div className="cp-topo">
          <span className="pl-hint">Copiloto de</span>
          <select className="pl-select-chip active" value={pessoa} onChange={e => abrirPessoa(e.target.value)} aria-label="Escolher de quem é o copiloto">
            {pessoas.map(p => <option key={p.pessoa} value={p.pessoa}>{p.nome}{p.indice != null ? ` · índice ${p.indice}` : ''}</option>)}
          </select>
          {pessoa !== 'EQUIPE' && <span className="cp-legenda">Você acompanha o copiloto desta pessoa só para ler. A conversa e a memória dela ficam com ela.</span>}
        </div>
      )}

      <MeuAgente />

      <div className="cp-abas">
        <div className="pl-sv-tabs" role="tablist" aria-label="Seções do copiloto">
          {abas.map(a => (
            <button key={a.valor} type="button" role="tab" aria-selected={abaAtual === a.valor} className={abaAtual === a.valor ? 'ativo' : ''} onClick={() => setAba(a.valor)}>
              {a.rotulo}
              {a.valor === 'conversas' && pendentesWhats > 0 && <span className="cp-badge" aria-label={`${pendentesWhats} esperando`}>{pendentesWhats}</span>}
            </button>
          ))}
        </div>
      </div>

      {erroAtual ? <div className="pl-alert pl-alert-error">{erroAtual}</div> : !dados ? <div className="pl-hint">Lendo a sua produção…</div> : (
        <>
          {abaAtual === 'hoje' && (
            <Hoje
              key={pessoa ?? 'eu'}
              dados={dados} pessoa={pessoa} escrevendo={escrevendo === chave}
              onDados={d => setHoje({ chave, dados: d })} irPara={irPara} abrirPessoa={abrirPessoa} atualizarPessoas={() => setVersao(v => v + 1)}
            />
          )}
          {abaAtual === 'conversas' && <Conversas key={pessoa ?? 'eu'} pessoa={pessoa} inicial={conversaInicial} somenteLeitura={dados.somenteLeitura && dados.minha} />}
          {abaAtual === 'estudar' && <Estudos key={pessoa ?? 'eu'} pessoa={pessoa} foco={dados.foco} porque={dados.relatorio.estudoPorque} somenteLeitura={dados.somenteLeitura} />}
          {abaAtual === 'evolucao' && <Evolucao key={pessoa ?? 'eu'} pessoa={pessoa} />}
          {abaAtual === 'conversar' && minha && <Chat nome={dados.nome} somenteLeitura={dados.somenteLeitura} />}
          {abaAtual === 'memoria' && minha && <Memoria somenteLeitura={dados.somenteLeitura} equipe={pessoa === 'EQUIPE'} />}
        </>
      )}
    </div>
  )
}
