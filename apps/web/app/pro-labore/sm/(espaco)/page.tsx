'use client'

// Tela 01 · Hoje (seção 4 · Main.html): o cockpit do dia. Tudo vem de dados
// reais; o que depende de uma fase ainda não entregue aparece como tal, sem
// número inventado.
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { proLaboreApi, type SmHoje } from '@/lib/proLaboreApi'
import {
  Banner, BarraProgresso, Botao, BotaoLink, Card, CardEsqueleto, Chip, EstadoVazio, FORMATO_ROTULO, IcMais, KpiCard, PILAR_CHIP, PILAR_ROTULO, Rotulo,
  esperaDesde, quandoCurto, useToast, type Tom,
} from '../_ui'
import { useEspacoSM } from './EspacoSM'

const fmtNum = (n: number) => n.toLocaleString('pt-BR')
const fmtMult = (n: number) => `${n.toFixed(1).replace('.', ',')}×`
const TIPO_INSIGHT: Record<string, { texto: string; tom: Tom }> = {
  oportunidade: { texto: 'Oportunidade', tom: 'info' }, destaque: { texto: 'Ponto forte', tom: 'ok' }, alerta: { texto: 'Atenção', tom: 'warn' }, info: { texto: 'Info', tom: 'neutro' },
}
const CONFIANCA: Record<string, string> = { alta: 'confiança alta', media: 'confiança média', baixa: 'confiança baixa', hipotese: 'hipótese' }
const STATUS_MOTO = { PARADA: { texto: 'Parada', tom: 'bad' as const }, ATENCAO: { texto: 'Atenção', tom: 'warn' as const }, OK: { texto: 'Ok', tom: 'neutro' as const } }

function statusPost(p: NonNullable<SmHoje['publicarHoje']>[number]): { texto: string; tom: Tom } {
  if (p.status === 'PUBLICADO') return { texto: 'Publicado', tom: 'ok' }
  if (p.publicacaoStatus === 'FALHA') return { texto: 'Falhou ao publicar', tom: 'bad' }
  if (p.status === 'AGENDADO') return { texto: 'Agendado', tom: 'ok' }
  if (p.status === 'APROVACAO' && p.aprovacao === 'PENDENTE') return { texto: 'Aguardando aprovação', tom: 'warn' }
  return { texto: 'Em produção', tom: 'neutro' }
}

export default function HojePage() {
  const toast = useToast()
  const { pode } = useEspacoSM()
  const [h, setH] = useState<SmHoje | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [gerando, setGerando] = useState<string | null>(null)

  const carregar = useCallback(() => {
    proLaboreApi.sm.hoje().then(r => { setH(r); setErro(null) }).catch(e => setErro(e instanceof Error ? e.message : 'Erro ao carregar'))
  }, [])
  useEffect(() => { carregar() }, [carregar])

  async function criarPauta(chave: string, dados: Parameters<typeof proLaboreApi.sm.pautas.criar>[0], mensagem: string) {
    setGerando(chave)
    try {
      const p = await proLaboreApi.sm.pautas.criar(dados)
      toast({ mensagem, desfazer: async () => { await proLaboreApi.sm.pautas.excluir(p.id); carregar() } })
      carregar()
    } catch (e) {
      toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível criar a pauta', tom: 'bad' })
    } finally { setGerando(null) }
  }

  if (erro) return <div className="sm-card"><EstadoVazio titulo="Não foi possível montar o dia" acao={<Botao onClick={carregar}>Tentar de novo</Botao>}>{erro}</EstadoVazio></div>
  if (!h) return <><CardEsqueleto linhas={3} /><div className="sm-grade">{[0, 1, 2, 3].map(i => <CardEsqueleto key={i} linhas={2} />)}</div></>

  const m = h.metas
  return (
    <>
      <header className="sm-pagina-cab">
        <div>
          <Rotulo>{h.cabecalho.rotulo}</Rotulo>
          <h1 className="sm-ttl sm-h1">{h.cabecalho.saudacao}</h1>
          <p>{h.cabecalho.resumo}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {pode('producao') && <BotaoLink href="/pro-labore/sm/calendario">Ver calendário</BotaoLink>}
          {h.podeCriarPauta && <BotaoLink href="/pro-labore/sm/producao?nova=1" variante="pri" icone={<IcMais tamanho={16} />}>Nova pauta</BotaoLink>}
        </div>
      </header>

      {h.retomada && (
        <Banner
          tom="warn"
          titulo={`Retomada de cadência: ${h.retomada.diasSemPost} dias sem post no feed`}
          extra={<BarraProgresso rotulo="Semana" valor={Math.min(h.retomada.feitos, h.retomada.meta)} max={h.retomada.meta} texto={`${h.retomada.feitos} / ${h.retomada.meta}`} tom="warn" />}
        >
          Plano da semana: {h.retomada.meta} dias com post, sem rajadas (máx. {h.retomada.maxPostsDia} por dia). {h.retomada.feitos} de {h.retomada.meta} já estão publicados ou agendados.
        </Banner>
      )}

      <section aria-label="Metas da semana" className="sm-grade">
        <KpiCard rotulo="Dias com post" valor={m.diasComPost.valor} unidade={`/ ${m.diasComPost.meta}`} legenda={m.diasComPost.planejados > m.diasComPost.valor ? `Meta da semana · ${m.diasComPost.planejados} contando os agendados` : 'Meta da semana'} />
        {m.respostaDm && (
          <KpiCard
            rotulo="Resposta a DMs"
            valor={m.respostaDm.valorMin ?? '—'}
            unidade={m.respostaDm.valorMin != null ? 'min' : undefined}
            legenda={m.respostaDm.valorMin == null ? 'Sem respostas nesta semana ainda' : 'Mediana da 1ª resposta humana'}
            chip={m.respostaDm.valorMin == null
              ? { tom: 'neutro', texto: `Meta ≤ ${m.respostaDm.meta} min` }
              : m.respostaDm.valorMin <= m.respostaDm.meta
                ? { tom: 'ok', texto: `Dentro da meta ≤ ${m.respostaDm.meta} min` }
                : { tom: 'bad', texto: `Acima da meta de ${m.respostaDm.meta} min` }}
          />
        )}
        {m.leads && (
          <KpiCard rotulo="Leads orgânicos" valor={m.leads.valor} unidade={`/ ${m.leads.meta}`}
            rodape={<BarraProgresso rotulo="Leads orgânicos da semana" valor={Math.min(m.leads.valor, m.leads.meta)} max={Math.max(1, m.leads.meta)} ocultarCabecalho />} />
        )}
        {m.retencao && (
          <KpiCard
            rotulo="Retenção dos reels"
            valor={m.retencao.percentual != null ? `${Math.round(m.retencao.percentual * 100)}%` : m.retencao.tempoMedioSeg != null ? m.retencao.tempoMedioSeg.toFixed(1).replace('.', ',') : '—'}
            unidade={m.retencao.percentual == null && m.retencao.tempoMedioSeg != null ? 's assistidos' : undefined}
            legenda={m.retencao.percentual == null ? 'Tempo médio; em % quando houver a duração dos reels' : undefined}
            chip={{ tom: 'neutro', texto: `Meta ${m.retencao.meta}%` }}
          />
        )}
      </section>

      <div className="sm-hoje-layout">
        <div className="sm-hoje-principal">
          {h.publicarHoje && (
            <section className="sm-card">
              <div className="sm-card-cab-linha"><h2 className="sm-h-card">Publicar hoje</h2><Rotulo>{h.publicarHoje.length} {h.publicarHoje.length === 1 ? 'post' : 'posts'}</Rotulo></div>
              {h.publicarHoje.length === 0
                ? <EstadoVazio titulo="Nada marcado para hoje" acao={pode('producao') ? <BotaoLink href="/pro-labore/sm/calendario">Abrir o calendário</BotaoLink> : undefined}>Um post simples hoje evita buraco na cadência.</EstadoVazio>
                : h.publicarHoje.map(p => {
                  const st = statusPost(p)
                  return (
                    <Link key={p.id} href={`/pro-labore/sm/producao?pauta=${p.id}`} className="sm-row sm-row-link">
                      <div className="sm-hora"><b>{p.hora}</b><span>{FORMATO_ROTULO[p.formato]}</span></div>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontWeight: 600 }}>{p.titulo}</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <Chip pilar={PILAR_CHIP[p.pilar]}>{PILAR_ROTULO[p.pilar]}</Chip>
                          {p.codigo && <Chip>Link rastreado {p.codigo}</Chip>}
                          {p.trial && <Chip tom="info">Trial Reel</Chip>}
                        </div>
                      </div>
                      <Chip tom={st.tom}>{st.texto}</Chip>
                    </Link>
                  )
                })}
            </section>
          )}

          {h.estoqueSemConteudo && (
            <section className="sm-card">
              <div className="sm-card-cab-linha"><h2 className="sm-h-card">Estoque sem conteúdo</h2><Rotulo>Puxado do estoque</Rotulo></div>
              {h.estoqueSemConteudo.length === 0
                ? <EstadoVazio titulo="Nenhuma moto cadastrada">O gestor cadastra as motos em Estoque.</EstadoVazio>
                : h.estoqueSemConteudo.map(mo => (
                  <div key={mo.id} className="sm-row">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{mo.modelo}{mo.ano ? ` ${mo.ano}` : ''}</div>
                      <div className="sm-legenda">{mo.diasEmEstoque} dias no estoque · {mo.posts === 0 ? '0 posts' : `${mo.posts} ${mo.posts === 1 ? 'post' : 'posts'}`}{mo.emProducao ? ` · ${mo.emProducao} em produção` : ''}</div>
                    </div>
                    <Chip tom={STATUS_MOTO[mo.status].tom}>{STATUS_MOTO[mo.status].texto}</Chip>
                    {h.podeCriarPauta && (
                      <Botao disabled={gerando === mo.id} onClick={() => criarPauta(mo.id, {
                        titulo: `${mo.modelo}${mo.ano ? ` ${mo.ano}` : ''}: parada há ${mo.diasEmEstoque} dias`,
                        pilar: 'ESTOQUE', formato: 'REELS', motoId: mo.id, origem: 'ESTOQUE', origemRef: mo.id,
                      }, `Pauta criada em Ideias: ${mo.modelo}.`)}>{gerando === mo.id ? 'Gerando…' : 'Gerar pauta'}</Botao>
                    )}
                  </div>
                ))}
            </section>
          )}

          {h.ultimosPosts && (
            <section className="sm-card">
              <div className="sm-card-cab-linha"><h2 className="sm-h-card">Últimos posts vs. mediana</h2><Rotulo>Mediana {fmtNum(h.ultimosPosts.mediana)} contas</Rotulo></div>
              {h.ultimosPosts.posts.length === 0
                ? <EstadoVazio titulo="Sem posts nos últimos 90 dias">Quando houver posts com alcance, eles aparecem aqui contra a mediana.</EstadoVazio>
                : h.ultimosPosts.posts.map(p => (
                  <div key={p.id} className="sm-row">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{p.titulo}</div>
                      <div className="sm-legenda">{FORMATO_ROTULO[p.formato]} · {quandoCurto(p.publicadoEm, false)} · {fmtNum(p.alcance)} contas</div>
                    </div>
                    {p.multiplo != null && <span className={`sm-multiplo${p.multiplo < 1 ? ' abaixo' : ''}`} title="Alcance do post dividido pela mediana de 90 dias">{fmtMult(p.multiplo)}</span>}
                  </div>
                ))}
            </section>
          )}
        </div>

        <div className="sm-hoje-lado">
          {h.atendimento && (
            <Card titulo="Fila de atendimento">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                <div className="sm-mini"><b>{h.atendimento.dmsSemResposta}</b><span>DMs sem resposta</span></div>
                <div className="sm-mini"><b>{h.atendimento.comentariosSemResposta}</b><span>Comentários</span></div>
              </div>
              {h.atendimento.maisAntiga
                ? <div style={{ fontSize: 13, color: h.atendimento.maisAntiga.atrasada ? 'var(--sm-bad-fg)' : 'var(--sm-text-muted)' }}>
                  Mais antiga: {esperaDesde(h.atendimento.maisAntiga.desde)} · {h.atendimento.maisAntiga.nome}{h.atendimento.maisAntiga.texto ? ` · “${h.atendimento.maisAntiga.texto.length > 60 ? `${h.atendimento.maisAntiga.texto.slice(0, 57)}…` : h.atendimento.maisAntiga.texto}”` : ''}
                </div>
                : <span className="sm-legenda">Ninguém esperando resposta.</span>}
              <BotaoLink href="/pro-labore/sm/atendimento" variante="pri">Abrir atendimento</BotaoLink>
            </Card>
          )}

          {h.producao && (
            <section className="sm-card" style={{ gap: 4 }}>
              <h2 className="sm-h-card" style={{ marginBottom: 6 }}>Produção</h2>
              {[
                { rotulo: 'Atrasadas', valor: h.producao.atrasadas, tom: 'bad' as const },
                { rotulo: 'Aguardando aprovação', valor: h.producao.aguardandoAprovacao, tom: 'warn' as const },
                { rotulo: 'Prontas para agendar', valor: h.producao.prontasParaAgendar, tom: 'ok' as const },
                ...(h.producao.falhas ? [{ rotulo: 'Falharam ao publicar', valor: h.producao.falhas, tom: 'bad' as const }] : []),
              ].map(l => (
                <Link key={l.rotulo} href="/pro-labore/sm/producao" className="sm-row sm-row-link" style={{ padding: '10px 0' }}>
                  <span style={{ flex: 1 }}>{l.rotulo}</span><Chip tom={l.valor ? l.tom : 'neutro'}>{l.valor}</Chip>
                </Link>
              ))}
            </section>
          )}

          {h.insights && (
            <Card titulo="Insights da semana">
              {h.insights.length === 0
                ? <span className="sm-legenda">Ainda sem posts suficientes para comparar com segurança. Cada comparação pede pelo menos 3 posts por grupo.</span>
                : h.insights.map(i => (
                  <div key={i.id} className="sm-insight">
                    <Chip tom={TIPO_INSIGHT[i.tipo]?.tom ?? 'neutro'}>{TIPO_INSIGHT[i.tipo]?.texto ?? 'Insight'} · {CONFIANCA[i.confianca] ?? i.confianca}{i.amostra ? ` (${i.amostra} posts)` : ''}</Chip>
                    <div style={{ fontWeight: 600 }}>{i.titulo}</div>
                    <div className="sm-legenda">{i.detalhe}</div>
                    {h.podeCriarPauta && (
                      <Botao disabled={gerando === i.id} onClick={() => criarPauta(i.id, {
                        titulo: i.titulo.length > 110 ? `${i.titulo.slice(0, 107)}…` : i.titulo,
                        pilar: 'EDUCACAO', formato: 'REELS', origem: 'INSIGHT', origemRef: `${i.id}:${h.cabecalho.rotulo}`, gancho: i.detalhe.slice(0, 500),
                      }, 'Insight virou pauta em Ideias.')}>{gerando === i.id ? 'Criando…' : 'Transformar em pauta'}</Botao>
                    )}
                  </div>
                ))}
            </Card>
          )}
          {!pode('producao') && !h.insights && <EstadoVazio titulo="Seu acesso é limitado">O gestor define o que aparece aqui em Acessos e permissões.</EstadoVazio>}
        </div>
      </div>
    </>
  )
}
