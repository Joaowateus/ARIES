'use client'

// Tela 06 · Vendas por post (seção 9, protótipo Atribuicao.html). Cada post
// tem um código rastreado; leads e vendas do CRM voltam para o post que os
// gerou. Os totais da tabela batem com os KPIs, e os valores em R$ seguem a
// regra "Mostrar valores em R$" do gestor.
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { proLaboreApi, type SmLinhaAtribuicao, type SmVendasPorPost } from '@/lib/proLaboreApi'
import { Banner, Botao, Card, CardEsqueleto, Chip, EstadoVazio, KpiCard, Rotulo, Segmentado, useToast } from '../../_ui'
import { useEspacoSM } from '../EspacoSM'

type Dias = 7 | 30 | 90
type Visao = 'post' | 'canal'

const PERIODOS: ReadonlyArray<{ valor: `${Dias}`; rotulo: string }> = [{ valor: '7', rotulo: '7 dias' }, { valor: '30', rotulo: '30 dias' }, { valor: '90', rotulo: '90 dias' }]
const VISOES: ReadonlyArray<{ valor: Visao; rotulo: string }> = [{ valor: 'post', rotulo: 'Por post' }, { valor: 'canal', rotulo: 'Por canal' }]
const COR_FORMATO: Record<string, string> = { REELS: 'var(--sm-data-blue)', CARROSSEL: 'var(--sm-data-orange)', FOTO: 'var(--sm-p-prova-bar)', STORY: 'var(--sm-p-bastidores-bar)' }

const inteiro = (n: number) => n.toLocaleString('pt-BR')
const decimal = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
function moedaCurta(v: number): string {
  if (v >= 1_000_000) return `R$ ${decimal(v / 1_000_000)} mi`
  if (v >= 1_000) return `R$ ${decimal(v / 1_000)} mil`
  return `R$ ${inteiro(Math.round(v))}`
}
const moeda = (v: number) => `R$ ${inteiro(Math.round(v))}`

// Endereço do site só no navegador (o servidor pré-renderiza sem window).
const assinarNada = () => () => {}
function useOrigem(): string {
  return useSyncExternalStore(assinarNada, () => window.location.origin, () => '')
}

function formatarWhatsapp(n: string | null): string {
  if (!n) return ''
  const d = n.replace(/^55/, '')
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : n
}

export default function VendasPorPostPage() {
  const { pode } = useEspacoSM()
  const toast = useToast()
  const [dias, setDias] = useState<Dias>(30)
  const [visao, setVisao] = useState<Visao>('post')
  const [dados, setDados] = useState<SmVendasPorPost | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)

  const carregar = useCallback((d: Dias) => {
    proLaboreApi.sm.vendasPorPost.ver(d)
      .then(r => { setDados(r); setErro(null) })
      .catch(e => setErro(e instanceof Error ? e.message : 'Erro ao carregar'))
  }, [])
  useEffect(() => { if (pode('vendas')) carregar(dias) }, [carregar, dias, pode])

  if (!pode('vendas')) return <div className="sm-card"><EstadoVazio titulo="Sem acesso a vendas">O gestor pode liberar o módulo Vendas em Equipe → Acessos e permissões.</EstadoVazio></div>

  async function criarPautas() {
    if (!dados?.concentracao) return
    const codigos = dados.concentracao.posts.map(p => p.codigo).filter((c): c is string => !!c)
    if (!codigos.length) { toast({ mensagem: 'Esses posts não vieram da Produção; crie a pauta pela tela Produção.', tom: 'bad' }); return }
    setCriando(true)
    try {
      const r = await proLaboreApi.sm.vendasPorPost.criarPautas(codigos)
      if (!r.criadas.length) toast({ mensagem: 'As pautas desses posts já estão na Produção.' })
      else toast({
        mensagem: `${r.criadas.length} ${r.criadas.length === 1 ? 'pauta criada' : 'pautas criadas'} em Ideias, na Produção.`,
        desfazer: async () => { await Promise.all(r.criadas.map(p => proLaboreApi.sm.pautas.excluir(p.id))) },
      })
    } catch (e) { toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível criar as pautas', tom: 'bad' }) }
    finally { setCriando(false) }
  }

  return (
    <>
      <header className="sm-pagina-cab">
        <div>
          <Rotulo>Resultado · Vendas por post{dados ? ` · ${dados.periodo.rotulo}` : ''}</Rotulo>
          <h1 className="sm-ttl sm-h1">Qual conteúdo vende moto</h1>
          <p>Cada post tem um código rastreado. Leads e vendas do CRM voltam para o post que os gerou.</p>
        </div>
        <Segmentado rotulo="Período" opcoes={PERIODOS} valor={`${dias}`} aoMudar={v => setDias(Number(v) as Dias)} />
      </header>

      {erro && <p className="sm-erro" role="alert">{erro}</p>}
      {!dados && !erro && <><div className="sm-grade">{[0, 1, 2, 3, 4].map(i => <CardEsqueleto key={i} linhas={2} />)}</div><CardEsqueleto linhas={6} /></>}

      {dados && (
        <>
          <section aria-label="Resumo" className="sm-grade sm-atrib-kpis">
            <KpiCard rotulo="Leads orgânicos" valor={inteiro(dados.kpis.leads)} />
            <KpiCard rotulo="Vendas" valor={inteiro(dados.kpis.vendas)} />
            <KpiCard rotulo="Valor negociado" valor={dados.kpis.valor != null ? moedaCurta(dados.kpis.valor) : '—'} legenda={dados.valoresOcultos ? 'Valores ocultos pelo gestor' : undefined} />
            <KpiCard rotulo="Lead → venda" valor={dados.kpis.conversao != null ? `${decimal(dados.kpis.conversao)}%` : '—'} legenda={dados.kpis.conversao == null ? 'Sem leads no período' : undefined} />
            <KpiCard rotulo="Ticket médio" valor={dados.kpis.ticket != null ? moedaCurta(dados.kpis.ticket) : '—'} legenda={dados.valoresOcultos ? 'Valores ocultos pelo gestor' : dados.kpis.vendas === 0 ? 'Sem vendas no período' : undefined} />
          </section>

          {dados.concentracao
            ? (
              <Banner tom="info" titulo={<span className="sm-atrib-banner-tit"><Rotulo>O que os dados dizem</Rotulo>{dados.concentracao.titulo}</span>}
                acao={dados.podeCriarPautas && dados.concentracao.posts.some(p => p.codigo)
                  ? <Botao onClick={criarPautas} disabled={criando}>{criando ? 'Criando…' : 'Criar pautas no mesmo formato'}</Botao>
                  : undefined}>
                {dados.concentracao.detalhe}
              </Banner>
            )
            : (
              <Banner tom="info" titulo="O que os dados dizem">
                {dados.leadsComPost === 0
                  ? 'Nenhum lead com post de origem neste período ainda.'
                  : `${dados.leadsComPost} ${dados.leadsComPost === 1 ? 'lead veio' : 'leads vieram'} de posts neste período.`}
                {dados.leadsComPost < dados.minimoConcentracao ? ` O padrão de concentração aparece a partir de ${dados.minimoConcentracao} leads com post.` : ' Nenhum grupo de até 3 posts concentrou 30% dos leads.'}
              </Banner>
            )}

          <div className="sm-hoje-layout">
            <Card className="sm-hoje-principal" titulo="Atribuição" acoes={<Segmentado rotulo="Agrupar por" opcoes={VISOES} valor={visao} aoMudar={setVisao} />}>
              <TabelaAtribuicao linhas={visao === 'post' ? dados.porPost : dados.porCanal} totais={dados.totais} cabecalho={visao === 'post' ? 'Post' : 'Canal'} valoresOcultos={dados.valoresOcultos} />
            </Card>

            <div className="sm-hoje-lado">
              <Card titulo="Leads por formato">
                {dados.leadsPorFormato.length === 0
                  ? <p className="sm-legenda" style={{ margin: 0 }}>Nenhum post publicado no período.</p>
                  : <LeadsPorFormato itens={dados.leadsPorFormato} />}
              </Card>
              <Card titulo="Ciclo de venda">
                <div className="sm-atrib-par"><span>Do primeiro contato à venda</span><b className="sm-num">{dados.ciclo.medianaDias != null ? `${dados.ciclo.medianaDias} ${dados.ciclo.medianaDias === 1 ? 'dia' : 'dias'}` : '—'}</b></div>
                <div className="sm-atrib-par"><span>Leads ainda em negociação</span><b className="sm-num">{inteiro(dados.ciclo.emNegociacao)}</b></div>
                <p className="sm-legenda" style={{ margin: 0 }}>
                  {dados.ciclo.vendas > 0 ? `Mediana de ${dados.ciclo.vendas} ${dados.ciclo.vendas === 1 ? 'venda' : 'vendas'}. ` : ''}
                  Vendas fechadas depois do período continuam sendo creditadas ao post de origem.
                </p>
              </Card>
              <LinksRastreados dados={dados} aoSalvar={() => carregar(dias)} />
            </div>
          </div>
        </>
      )}
    </>
  )
}

function celula(n: number | null) {
  return n == null ? <span className="sm-atrib-vazio">—</span> : inteiro(n)
}

function TabelaAtribuicao({ linhas, totais, cabecalho, valoresOcultos }: { linhas: SmLinhaAtribuicao[]; totais: SmLinhaAtribuicao; cabecalho: string; valoresOcultos: boolean }) {
  if (linhas.every(l => !l.leads && !l.vendas && !l.conversas && !l.toques)) {
    return <EstadoVazio titulo="Sem atividade no período">Os toques no link, as conversas e os leads com código aparecem aqui.</EstadoVazio>
  }
  return (
    <div className="sm-tabela-rola">
      <table className="sm-tabela sm-atrib-tabela" style={{ minWidth: valoresOcultos ? 540 : 660 }}>
        <thead>
          <tr><th scope="col">{cabecalho}</th><th scope="col">Toques no link</th><th scope="col">Conversas</th><th scope="col">Leads</th><th scope="col">Vendas</th>{!valoresOcultos && <th scope="col">Valor negociado</th>}</tr>
        </thead>
        <tbody>
          {linhas.map(l => (
            <tr key={l.chave}>
              <td><div className="sm-atrib-nome">{l.nome}</div><div className="sm-legenda">{l.sub}</div></td>
              <td>{celula(l.toques)}</td>
              <td>{celula(l.conversas)}</td>
              <td><b>{inteiro(l.leads)}</b></td>
              <td>{inteiro(l.vendas)}</td>
              {!valoresOcultos && <td className={l.valor ? 'sm-atrib-valor' : undefined}>{l.valor ? moeda(l.valor) : <span className="sm-atrib-vazio">—</span>}</td>}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td>{celula(totais.toques)}</td>
            <td>{celula(totais.conversas)}</td>
            <td><b>{inteiro(totais.leads)}</b></td>
            <td>{inteiro(totais.vendas)}</td>
            {!valoresOcultos && <td className={totais.valor ? 'sm-atrib-valor' : undefined}>{totais.valor ? moeda(totais.valor) : <span className="sm-atrib-vazio">—</span>}</td>}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function LeadsPorFormato({ itens }: { itens: SmVendasPorPost['leadsPorFormato'] }) {
  const maximo = Math.max(1, ...itens.map(i => i.leads))
  return (
    <div className="sm-atrib-formatos">
      {itens.map(i => (
        <div key={i.formato} className="sm-atrib-formato">
          <div className="sm-atrib-par"><span>{i.rotulo} · {i.posts} {i.posts === 1 ? 'post' : 'posts'}</span><b className="sm-num">{inteiro(i.leads)}</b></div>
          <div className="sm-atrib-trilho" role="img" aria-label={`${i.rotulo}: ${i.leads} leads`}>
            <span style={{ width: `${Math.max(i.leads ? 2 : 0, (i.leads / maximo) * 100)}%`, background: COR_FORMATO[i.formato] }} />
          </div>
          <span className="sm-legenda">{decimal(i.leadsPorPost)} {i.leadsPorPost === 1 ? 'lead' : 'leads'} por post{i.amostraPequena ? ' · amostra pequena' : ''}</span>
        </div>
      ))}
    </div>
  )
}

function LinksRastreados({ dados, aoSalvar }: { dados: SmVendasPorPost; aoSalvar: () => void }) {
  const toast = useToast()
  const origem = useOrigem()
  const [numero, setNumero] = useState(formatarWhatsapp(dados.links.whatsappLoja))
  const [salvando, setSalvando] = useState(false)
  const linkBio = `${origem}/r/${dados.links.bio.slug}`

  async function copiar() {
    try { await navigator.clipboard.writeText(linkBio); toast({ mensagem: 'Link da bio copiado.' }) } catch { toast({ mensagem: 'Não deu para copiar; selecione o link e copie.', tom: 'bad' }) }
  }
  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    try {
      const r = await proLaboreApi.sm.vendasPorPost.salvarWhatsapp(numero.trim() || null)
      setNumero(formatarWhatsapp(r.whatsappLoja))
      toast({ mensagem: r.whatsappLoja ? 'WhatsApp da loja salvo.' : 'WhatsApp da loja removido.' })
      aoSalvar()
    } catch (e2) { toast({ mensagem: e2 instanceof Error ? e2.message : 'Não foi possível salvar', tom: 'bad' }) }
    finally { setSalvando(false) }
  }

  return (
    <Card titulo="Links rastreados">
      <p className="sm-legenda" style={{ margin: 0 }}>O toque abre o WhatsApp da loja com o código na mensagem. O consultor cola o código no lead e o CRM liga o lead ao post.</p>
      {dados.souGestor
        ? (
          <form onSubmit={salvar} className="sm-atrib-whats">
            <label className="sm-campo">
              <span>WhatsApp da loja</span>
              <input className="sm-input" inputMode="tel" placeholder="(91) 98888-7777" value={numero} onChange={e => setNumero(e.target.value)} />
            </label>
            <Botao type="submit" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
          </form>
        )
        : (
          <div className="sm-atrib-par"><span>WhatsApp da loja</span>{dados.links.whatsappLoja ? <b className="sm-num">{formatarWhatsapp(dados.links.whatsappLoja)}</b> : <Chip tom="warn">Não configurado</Chip>}</div>
        )}
      {!dados.whatsappConfigurado && <p className="sm-legenda sm-atrib-aviso" style={{ margin: 0 }}>Sem o número, o toque é contado, mas o cliente não chega ao WhatsApp.</p>}
      <div className="sm-atrib-link">
        <div>
          <span className="sm-legenda">Link da bio · {dados.links.bio.codigo} · {inteiro(dados.links.bio.toques)} {dados.links.bio.toques === 1 ? 'toque' : 'toques'} no total</span>
          <code>{linkBio}</code>
        </div>
        <Botao onClick={copiar}>Copiar</Botao>
      </div>
      <p className="sm-legenda" style={{ margin: 0 }}>O link de cada post fica no briefing da pauta, na Produção.</p>
    </Card>
  )
}
