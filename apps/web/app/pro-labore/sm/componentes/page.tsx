'use client'

// Catálogo dos componentes base do Social Media (Fase 0d). Serve para
// conferir o visual contra os protótipos nos dois temas. Só o dono abre;
// os valores aqui são exemplos fixos, não dados da conta.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { PLThemeToggle } from '@/lib/proLaboreTheme'
import {
  Banner, BarraProgresso, Botao, BotaoLink, Card, CardEsqueleto, CartaoStatusConta, Chip, ChipPilar, EstadoVazio, Esqueleto,
  IcAtendimento, IcCalendario, IcDesempenho, IcHoje, IcMais, IcProducao, IcVendasPorPost, Kbd, KpiCard, Rotulo, Segmentado,
  SidebarSM, SmApp, Toggle, haQuanto, useToast,
} from '../_ui'

export default function CatalogoComponentesSM() {
  const { usuario, loading } = useProLaboreAuth()
  const router = useRouter()
  useEffect(() => {
    if (loading) return
    if (!usuario) router.replace('/pro-labore/login')
    else if (usuario.papel !== 'DONO') router.replace('/pro-labore')
  }, [usuario, loading, router])
  if (loading || usuario?.papel !== 'DONO') return null
  return (
    <SmApp>
      <Catalogo />
    </SmApp>
  )
}

const MENU = [
  { rotulo: 'Trabalho', itens: [
    { href: '/pro-labore/sm/componentes', rotulo: 'Hoje', icone: <IcHoje /> },
    { href: '/pro-labore/sm/calendario', rotulo: 'Calendário', icone: <IcCalendario /> },
    { href: '/pro-labore/sm/producao', rotulo: 'Produção', icone: <IcProducao /> },
    { href: '/pro-labore/sm/atendimento', rotulo: 'Atendimento', icone: <IcAtendimento />, contador: 19 },
  ] },
  { rotulo: 'Resultado', itens: [
    { href: '/pro-labore/sm/desempenho', rotulo: 'Desempenho', icone: <IcDesempenho /> },
    { href: '/pro-labore/sm/vendas-por-post', rotulo: 'Vendas por post', icone: <IcVendasPorPost /> },
  ] },
]

function Catalogo() {
  const toast = useToast()
  const [origem, setOrigem] = useState<'organico' | 'pago' | 'total'>('organico')
  const [vista, setVista] = useState<'mes' | 'semana'>('mes')
  const [lig1, setLig1] = useState(true)
  const [lig2, setLig2] = useState(false)
  const [itens, setItens] = useState(['Post do XRE 300', 'Reels de entrega', 'Carrossel do financiamento'])
  const [sincronizado] = useState(() => new Date(Date.now() - 12 * 60000))

  function arquivar(i: number) {
    const item = itens[i]
    setItens(l => l.filter((_, j) => j !== i))
    toast({ mensagem: `"${item}" arquivado.`, desfazer: () => setItens(l => [...l.slice(0, i), item, ...l.slice(i)]) })
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', minHeight: '100vh' }}>
      <div style={{ flex: '1 1 232px', display: 'flex' }}>
        <SidebarSM
          grupos={MENU}
          conta={<CartaoStatusConta usuario="mmnegociosveiculos" tipo="Conta da empresa" status="ok" texto={`Sincronizado ${haQuanto(sincronizado)}`} />}
          aoSair={() => toast({ mensagem: 'Exemplo: aqui o papel sairia do sistema.' })}
        />
      </div>
      <main style={{ flex: '999 1 560px', minWidth: 0, padding: 'clamp(20px, 4vw, 32px) clamp(16px, 4vw, 40px) 56px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Rotulo>Catálogo de componentes · exemplos fixos</Rotulo>
            <h1 className="sm-ttl sm-h1">Componentes base do Social Media</h1>
            <p className="sm-muted" style={{ margin: 0, fontSize: 15 }}>Seção 2 da especificação. Troque o tema para conferir o claro.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <PLThemeToggle />
            <BotaoLink href="/pro-labore/social-media">Ver aba atual</BotaoLink>
            <Botao variante="pri" icone={<IcMais tamanho={16} />}>Nova pauta</Botao>
          </div>
        </header>

        <Banner
          tom="warn"
          titulo="Retomada de cadência: 18 dias sem post no feed"
          extra={<BarraProgresso rotulo="Semana" valor={3} max={5} tom="warn" />}
        >
          Plano da semana: 1 post por dia útil, sem rajadas (máx. 2 por dia). 3 de 5 posts já estão agendados.
        </Banner>

        <section aria-label="KPIs" className="sm-grade">
          <KpiCard rotulo="Dias com post" valor="0" unidade="/ 5" legenda="Meta da semana · seg a sex" />
          <KpiCard rotulo="Resposta a DMs" valor="14" unidade="min" chip={{ tom: 'ok', texto: 'Dentro da meta ≤ 15 min' }} />
          <KpiCard rotulo="Leads do Instagram" valor="23" chip={{ tom: 'warn', texto: '6 sem resposta' }} />
          <KpiCard rotulo="Vendas atribuídas" valor="4" legenda="2 diretas · 2 assistidas" />
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
          <Card titulo="Chips" subtitulo="Semânticos e de pilar">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Chip tom="ok">Ponto forte</Chip><Chip tom="warn">Atenção</Chip><Chip tom="bad">Urgente</Chip>
              <Chip tom="info">Post</Chip><Chip tom="learn">Aprendizado</Chip><Chip>Neutro</Chip><Chip contador>19</Chip>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <ChipPilar pilar="estoque" /><ChipPilar pilar="prova" /><ChipPilar pilar="educacao" /><ChipPilar pilar="bastidores" />
            </div>
          </Card>

          <Card titulo="Botões e controles">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <Botao variante="pri">Primário</Botao><Botao>Secundário</Botao><Botao variante="fantasma">Fantasma</Botao>
              <Botao rotulo="Nova pauta" icone={<IcMais />} /><Botao disabled>Desabilitado</Botao>
            </div>
            <Segmentado rotulo="Origem do alcance" valor={origem} aoMudar={setOrigem} opcoes={[
              { valor: 'organico', rotulo: 'Orgânico' }, { valor: 'pago', rotulo: 'Pago' }, { valor: 'total', rotulo: 'Total' },
            ]} />
            <Segmentado rotulo="Visão do calendário" valor={vista} aoMudar={setVista} opcoes={[
              { valor: 'mes', rotulo: 'Mês' }, { valor: 'semana', rotulo: 'Semana' },
            ]} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Toggle ligado={lig1} aoMudar={setLig1} rotulo="Responder DMs" mostrarRotulo />
              <Toggle ligado={lig2} aoMudar={setLig2} rotulo="Ver vendas" mostrarRotulo />
            </div>
          </Card>

          <Card titulo="Progresso e atalhos">
            <BarraProgresso rotulo="Posts da semana" valor={3} max={5} />
            <BarraProgresso rotulo="Meta de respostas" valor={9} max={10} tom="ok" texto="90%" />
            <BarraProgresso rotulo="Fila atrasada" valor={4} max={5} tom="bad" />
            <p className="sm-muted" style={{ margin: 0 }}>Abrir a paleta: <Kbd rotulo="Control">Ctrl</Kbd> <Kbd>K</Kbd> · Próximo: <Kbd>J</Kbd></p>
          </Card>

          <Card titulo="Toast com desfazer" subtitulo="Arquive um item e desfaça em até 5 segundos">
            {itens.length === 0
              ? <EstadoVazio titulo="Nada na fila">Quando houver pautas, elas aparecem aqui.</EstadoVazio>
              : itens.map((t, i) => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTop: i ? '1px solid var(--sm-divider)' : 0, paddingTop: i ? 10 : 0 }}>
                  <span>{t}</span><Botao onClick={() => arquivar(i)}>Arquivar</Botao>
                </div>
              ))}
          </Card>
        </div>

        <Banner tom="ok" titulo="Meta de cadência cumprida">5 de 5 dias úteis com post nesta semana.</Banner>
        <Banner tom="info" titulo="Reels de entrega trazem 2,1× mais conversas" acao={<Botao>Ver posts</Botao>}>
          Com base em 7 reels nos últimos 60 dias.
        </Banner>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          <Card titulo="Estado vazio"><EstadoVazio titulo="Nenhuma conversa esperando" acao={<Botao variante="pri">Abrir atendimento</Botao>}>As novas mensagens do direct aparecem aqui assim que chegarem.</EstadoVazio></Card>
          <CardEsqueleto linhas={4} />
          <Card titulo="Status da conta">
            <CartaoStatusConta usuario="@mmnegociosveiculos" tipo="Conta da empresa" status="warn" texto="Última sincronização há 3 h" />
            <CartaoStatusConta usuario="@mmnegociosveiculos" tipo="Conta da empresa" status="bad" texto="Acesso bloqueado pela Meta" acao={<Botao>Ver diagnóstico</Botao>} />
            <Esqueleto altura={10} largura="60%" />
          </Card>
        </div>

        <Card titulo="Tabela larga" subtitulo="Rola dentro do cartão no celular">
          <div className="sm-tabela-rola">
            <table className="sm-tabela" style={{ minWidth: 640 }}>
              <thead><tr><th>Post</th><th>Alcance</th><th>Conversas</th><th>Leads</th><th>Vendas</th></tr></thead>
              <tbody>
                <tr><td>Reels · entrega da XRE 300</td><td>12.480</td><td>31</td><td>9</td><td>2</td></tr>
                <tr><td>Carrossel · financiamento</td><td>8.204</td><td>14</td><td>5</td><td>1</td></tr>
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </div>
  )
}
