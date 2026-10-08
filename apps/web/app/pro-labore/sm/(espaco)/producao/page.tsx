'use client'

// Tela 03 · Produção (seção 6 da especificação · Producao.html): da ideia
// ao agendado. Quadro de 6 colunas à esquerda, briefing da pauta à direita.
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { proLaboreApi, type SmColuna, type SmMoto, type SmPauta, type SmQuadro, type SmSugestaoAudiencia } from '@/lib/proLaboreApi'
import { AssistenteAba, Botao, CardEsqueleto, EstadoVazio, IcMais, Rotulo, useToast } from '../../_ui'
import { useEspacoSM } from '../EspacoSM'
import { Quadro } from './Quadro'
import { Briefing } from './Briefing'
import { NovaPauta, SugestoesEstoque } from './Dialogos'
import { BibliotecaGanchos } from './Ganchos'

export default function ProducaoPage() {
  const { pode } = useEspacoSM()
  if (!pode('producao')) {
    return (
      <div className="sm-card"><EstadoVazio titulo="Sem acesso à Produção">O gestor pode liberar em Equipe → Acessos e permissões.</EstadoVazio></div>
    )
  }
  return <Suspense fallback={<CardEsqueleto linhas={6} />}><Producao /></Suspense>
}

function Producao() {
  const { pode } = useEspacoSM()
  const toast = useToast()
  const [quadro, setQuadro] = useState<SmQuadro | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null)
  const [motos, setMotos] = useState<SmMoto[] | null>(null)
  const [sugestoes, setSugestoes] = useState<SmMoto[]>([])
  const [audiencia, setAudiencia] = useState<SmSugestaoAudiencia[]>([])
  const [dialogo, setDialogo] = useState<'nova' | 'sugestoes' | 'ganchos' | null>(null)
  const veEstoque = pode('estoque')

  const carregar = useCallback(() => {
    Promise.all([
      proLaboreApi.sm.pautas.quadro(),
      veEstoque ? proLaboreApi.sm.estoque.sugestoes() : Promise.resolve([]),
      veEstoque ? proLaboreApi.sm.estoque.listar() : Promise.resolve(null),
      proLaboreApi.sm.sugestoesAudiencia().catch(() => []),
    ]).then(([q, sug, est, aud]) => {
      setQuadro(q); setSugestoes(sug); setMotos(est); setAudiencia(aud); setErro(null)
      setSelecionadaId(id => id && q.pautas.some(p => p.id === id) ? id
        : q.pautas.find(p => p.status === 'ROTEIRO')?.id ?? q.pautas.find(p => p.status !== 'PUBLICADO')?.id ?? null)
    }).catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível carregar agora. Tente de novo em instantes.'))
  }, [veEstoque])
  useEffect(() => { carregar() }, [carregar])

  // Atalho N com a Produção aberta e pauta criada pela paleta (tela 10).
  useEffect(() => {
    const nova = () => setDialogo(d => d ?? 'nova')
    window.addEventListener('sm:nova-pauta', nova)
    window.addEventListener('sm:pautas-mudaram', carregar)
    return () => { window.removeEventListener('sm:nova-pauta', nova); window.removeEventListener('sm:pautas-mudaram', carregar) }
  }, [carregar])

  // Vindo do calendário, de um aviso ou da paleta: ?pauta=<id> abre o briefing e
  // ?nova=1 o formulário, também quando a URL muda com a tela aberta.
  const busca = useSearchParams()
  const pautaURL = busca.get('pauta')
  const novaURL = busca.get('nova') === '1'
  const chaveURL = `${pautaURL ?? ''}|${novaURL}`
  const [urlAplicada, setUrlAplicada] = useState<string | null>(null)
  // A pauta recém-criada pode ainda não estar no quadro: espera o recarregamento.
  if (quadro && chaveURL !== urlAplicada && (!pautaURL || quadro.pautas.some(p => p.id === pautaURL))) {
    setUrlAplicada(chaveURL)
    if (pautaURL) setSelecionadaId(pautaURL)
    if (novaURL && quadro.podeEditar) setDialogo(d => d ?? 'nova')
  }

  const atualizar = useCallback((p: SmPauta) => {
    setQuadro(q => q && { ...q, pautas: q.pautas.some(x => x.id === p.id) ? q.pautas.map(x => (x.id === p.id ? p : x)) : [...q.pautas, p] })
  }, [])

  async function mover(id: string, coluna: SmColuna, ordem?: number): Promise<boolean> {
    const antes = quadro?.pautas.find(p => p.id === id)
    if (!antes) return false
    setQuadro(q => q && { ...q, pautas: q.pautas.map(p => (p.id === id ? { ...p, status: coluna, ordem: ordem ?? p.ordem } : p)) })
    try {
      const p = await proLaboreApi.sm.pautas.mover(id, coluna, ordem)
      atualizar(p)
      if (coluna !== antes.status) {
        toast({
          mensagem: coluna === 'APROVACAO' && p.aprovacao === 'PENDENTE' ? 'Enviada para aprovação. O gestor foi avisado.' : coluna === 'AGENDADO' ? 'Agendada para publicar no horário.' : `Movida para ${({ IDEIA: 'Ideias', ROTEIRO: 'Roteiro', GRAVACAO: 'Gravação', EDICAO: 'Edição', APROVACAO: 'Aprovação', AGENDADO: 'Agendado' })[coluna]}.`,
          desfazer: coluna === 'AGENDADO' || antes.status === 'AGENDADO' || antes.status === 'APROVACAO' ? undefined : async () => { atualizar(await proLaboreApi.sm.pautas.mover(id, antes.status as SmColuna, antes.ordem)) },
        })
      }
      return true
    } catch (e) {
      atualizar(antes)
      toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível mover', tom: 'bad' })
      return false
    }
  }

  async function gerarDaAudiencia(a: SmSugestaoAudiencia) {
    try {
      const p = await proLaboreApi.sm.pautas.criar({ titulo: a.titulo, pilar: a.pilar, formato: a.formato, origem: 'AUDIENCIA', origemRef: a.ref, gancho: a.gancho })
      atualizar(p)
      setAudiencia(l => l.filter(x => x.ref !== a.ref))
      setSelecionadaId(p.id)
      toast({ mensagem: `Pauta criada em Ideias: ${p.titulo}` })
    } catch (e) {
      toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível criar', tom: 'bad' })
    }
  }

  async function gerarDaMoto(m: SmMoto) {
    try {
      const p = await proLaboreApi.sm.pautas.criar({
        titulo: `${m.modelo}${m.ano ? ` ${m.ano}` : ''}: parada há ${m.diasEmEstoque} dias`,
        pilar: 'ESTOQUE', formato: 'REELS', motoId: m.id, origem: 'ESTOQUE', origemRef: m.id,
      })
      atualizar(p)
      setSugestoes(s => s.filter(x => x.id !== m.id))
      setSelecionadaId(p.id)
      toast({ mensagem: `Pauta criada em Ideias: ${p.titulo}` })
    } catch (e) {
      toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível criar', tom: 'bad' })
    }
  }

  const podeEditar = !!quadro?.podeEditar
  const selecionada = quadro?.pautas.find(p => p.id === selecionadaId) ?? null
  const noQuadro = quadro?.pautas.filter(p => p.status !== 'PUBLICADO') ?? []

  return (
    <>
      <header className="sm-pagina-cab">
        <div>
          <Rotulo>Trabalho · Produção</Rotulo>
          <h1 className="sm-ttl sm-h1">Da ideia ao agendado</h1>
          <p>Clique numa pauta para abrir o briefing. {quadro?.regras.aprovacaoGestor ? 'Nada é publicado sem passar pela aprovação.' : 'A aprovação do gestor está desligada: a pauta pode ser agendada direto.'}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {(veEstoque || audiencia.length > 0) && <Botao onClick={() => setDialogo('sugestoes')}>{veEstoque ? `Sugestões do estoque (${sugestoes.length + audiencia.length})` : `Sugestões (${audiencia.length})`}</Botao>}
          <Botao onClick={() => setDialogo('ganchos')}>Biblioteca de ganchos</Botao>
          {podeEditar && <Botao variante="pri" icone={<IcMais tamanho={16} />} title="Nova pauta (atalho: N)" aria-keyshortcuts="N" onClick={() => setDialogo('nova')}>Nova pauta</Botao>}
        </div>
      </header>
      <AssistenteAba aba="producao" aoMudar={carregar} />

      {erro && <p className="sm-erro" role="alert">{erro}</p>}
      {!quadro && !erro && <CardEsqueleto linhas={5} />}

      {quadro && (
        <div className="sm-producao">
          <Quadro pautas={noQuadro} selecionadaId={selecionadaId} aoSelecionar={setSelecionadaId} aoMover={(id, c, o) => { mover(id, c, o) }} podeEditar={podeEditar} />
          {selecionada
            ? (
              <Briefing
                key={`${selecionada.id}:${selecionada.status}:${selecionada.aprovacao}:${selecionada.agendadoPara}:${selecionada.prazo}`}
                pauta={selecionada}
                podeEditar={podeEditar}
                souGestor={quadro.souGestor}
                regraAprovacao={quadro.regras.aprovacaoGestor}
                motos={motos}
                aoAtualizar={atualizar}
                aoExcluir={id => { setQuadro(q => q && { ...q, pautas: q.pautas.filter(p => p.id !== id) }); setSelecionadaId(null) }}
                aoMover={(id, c) => mover(id, c)}
              />
            )
            : (
              <aside className="sm-card sm-briefing" aria-label="Briefing">
                <EstadoVazio titulo={noQuadro.length ? 'Escolha uma pauta' : 'Nenhuma pauta ainda'} acao={!noQuadro.length && podeEditar ? <Botao variante="pri" onClick={() => setDialogo('nova')}>Criar a primeira pauta</Botao> : undefined}>
                  {noQuadro.length ? 'O briefing aparece aqui.' : podeEditar ? 'Crie a primeira em “Nova pauta” ou gere uma pelas sugestões do estoque.' : 'Quando houver pautas, elas aparecem no quadro.'}
                </EstadoVazio>
              </aside>
            )}
        </div>
      )}

      {dialogo === 'nova' && (
        <NovaPauta motos={motos} aoFechar={() => setDialogo(null)} aoCriar={p => { atualizar(p); setSelecionadaId(p.id); setDialogo(null); toast({ mensagem: 'Pauta criada em Ideias.' }) }} />
      )}
      {dialogo === 'ganchos' && <BibliotecaGanchos aoFechar={() => setDialogo(null)} />}
      {dialogo === 'sugestoes' && (
        <SugestoesEstoque sugestoes={sugestoes} audiencia={audiencia} podeEditar={podeEditar} aoFechar={() => setDialogo(null)} aoGerar={gerarDaMoto} aoGerarAudiencia={gerarDaAudiencia} />
      )}
    </>
  )
}
