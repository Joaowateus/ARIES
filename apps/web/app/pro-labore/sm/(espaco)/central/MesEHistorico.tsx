'use client'

// L/M/N. Fechamento do mês (fatos separados de hipóteses e sugestões),
// planejamento do próximo mês e o histórico de ciclos e versões.
import { useEffect, useState } from 'react'
import { proLaboreApi, type CtCiclo, type CtEtapa, type CtFechamento, type CtVisao } from '@/lib/proLaboreApi'
import { Banner, Botao, Card, Chip, EstadoVazio, useToast } from '../../_ui'
import { CICLO_ROTULO, ETAPA_NOME, NATUREZA_ROTULO, num } from './rotulos'

export function MesEHistorico({ dados, visao, recarregar, aoAbrirCiclo }: { dados: CtCiclo; visao: CtVisao; recarregar: () => void; aoAbrirCiclo: (id: string) => void }) {
  const toast = useToast()
  const [rel, setRel] = useState<CtFechamento | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const id = dados.ciclo.id
  useEffect(() => { proLaboreApi.sm.central.fechamento(id).then(setRel).catch(() => undefined) }, [id])
  const proximo = (() => { const [a, m] = dados.ciclo.mes.split('-').map(Number); return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}` })()
  const jaTemProximo = visao.ciclos.find(c => c.mes === proximo && c.status !== 'ARQUIVADO')

  async function fechar() {
    setOcupado(true)
    try { setRel({ ...(await proLaboreApi.sm.central.fechar(id)), guardado: true }); toast({ mensagem: 'Mês fechado: relatório guardado no histórico.' }); recarregar() }
    catch (e) { toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível fechar', tom: 'bad' }) } finally { setOcupado(false) }
  }
  async function gerarProximo(novaVersao: boolean) {
    setOcupado(true)
    try { const c = await proLaboreApi.sm.central.proximo(id, novaVersao); toast({ mensagem: `Calendário de ${proximo} gerado (versão ${c.versao}).` }); aoAbrirCiclo(c.id); recarregar() }
    catch (e) { toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível gerar', tom: 'bad' }) } finally { setOcupado(false) }
  }
  async function novaVersaoDoMes() {
    setOcupado(true)
    try { const c = await proLaboreApi.sm.central.gerar(dados.ciclo.mes); toast({ mensagem: `Versão ${c.versao} gerada; a anterior foi para o histórico.` }); aoAbrirCiclo(c.id); recarregar() }
    catch (e) { toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível gerar', tom: 'bad' }) } finally { setOcupado(false) }
  }
  const pode = dados.podeEditar
  const aberto = dados.ciclo.status === 'RASCUNHO' || dados.ciclo.status === 'APROVADO'

  return (
    <div className="ct-mes">
      <Card titulo={`Fechamento de ${dados.nomeMes}`} subtitulo={rel?.guardado ? `Relatório guardado em ${new Date(rel.geradoEm).toLocaleDateString('pt-BR')}.` : 'Prévia com os dados de agora. Ao fechar, o relatório é guardado e alimenta o próximo mês.'}
        acoes={pode && aberto ? <Botao variante="pri" disabled={ocupado} onClick={fechar}>Fechar o mês</Botao> : undefined}>
        {!rel ? <p className="sm-legenda">Montando o relatório…</p> : <Relatorio r={rel} />}
      </Card>

      <Card titulo="Planejamento do próximo mês" subtitulo="Gerado a partir do dossiê vigente e do fechamento deste mês (temas a continuar, a mudar, perguntas reais e aprendizados). Automático: no 1º dia de cada mês, o sistema gera o calendário em rascunho para aprovação.">
        {jaTemProximo ? (
          <div className="sm-linha-acoes"><span className="sm-legenda">Já existe o calendário de {jaTemProximo.nomeMes} (versão {jaTemProximo.versao}).</span>
            <Botao onClick={() => aoAbrirCiclo(jaTemProximo.id)}>Abrir</Botao>
            {pode && <Botao disabled={ocupado} onClick={() => gerarProximo(true)}>Gerar nova versão</Botao>}</div>
        ) : pode ? <Botao variante="pri" disabled={ocupado} onClick={() => gerarProximo(false)}>Gerar calendário do próximo mês</Botao> : <p className="sm-legenda">Quem cuida da produção gera o próximo mês.</p>}
        {pode && aberto && <div style={{ marginTop: 10 }}><Botao variante="fantasma" disabled={ocupado} onClick={novaVersaoDoMes}>Gerar nova versão deste mês (a atual vai para o histórico)</Botao></div>}
      </Card>

      <Card titulo="Histórico e versões" subtitulo="Nada é apagado: versões substituídas ficam arquivadas, meses fechados guardam o relatório.">
        <ul className="ct-itens">{visao.ciclos.map(c => (
          <li key={c.id} className={c.id === id ? 'atual' : undefined}>
            <div><b>{c.nomeMes} · versão {c.versao}</b> <Chip tom={c.status === 'APROVADO' ? 'ok' : c.status === 'FECHADO' ? 'info' : c.status === 'ARQUIVADO' ? 'neutro' : 'warn'}>{CICLO_ROTULO[c.status]}</Chip>
              <span className="sm-legenda">{c.videos} vídeos · {c.diasProducao} dias · dossiê v{c.dossieVersao} · gerado {c.origem === 'AUTOMATICO' ? 'automaticamente' : 'à mão'} em {new Date(c.criadoEm).toLocaleDateString('pt-BR')}</span></div>
            {c.id !== id && <Botao variante="fantasma" onClick={() => aoAbrirCiclo(c.id)}>Abrir</Botao>}
          </li>
        ))}</ul>
      </Card>
    </div>
  )
}

function Relatorio({ r }: { r: CtFechamento }) {
  const etapas: CtEtapa[] = ['TOPO', 'MEIO', 'FUNDO']
  const metrica = (e: CtEtapa, m: CtFechamento['melhores']['TOPO'][number]['metricas']) => e === 'TOPO' ? `${num(m.alcance)} alcance · ${num(m.compartilhamentos)} compart.` : e === 'MEIO' ? `${num(m.salvamentos)} salvos · ${num(m.comentarios)} coment.` : `${num(m.conversas)} conversas · ${num(m.leads)} leads · ${num(m.vendas)} vendas atrib.`
  return (
    <div className="ct-relatorio">
      {r.avisos.map(a => <Banner key={a} tom="info" titulo="Atenção ao ler">{a}</Banner>)}
      <p className="ct-fatos"><Chip tom="ok">Fato</Chip> {r.fatos.planejados} vídeos planejados, {r.fatos.publicados} publicados, {r.fatos.comMetricas} com métricas.</p>
      <div className="ct-tres">
        {etapas.map(e => (
          <div key={e} className="ct-rel-etapa">
            <h3 className="ct-sub">{ETAPA_NOME[e]} de funil</h3><span className="sm-legenda">Critério: {r.fatos.criterios[e]}</span>
            <b>Melhores</b>
            {r.melhores[e].length ? <ol>{r.melhores[e].map(v => <li key={v.id}><span className="sm-mono">{v.codigo}</span> {v.titulo} <span className="sm-legenda">{metrica(e, v.metricas)}</span></li>)}</ol> : <p className="sm-legenda">Sem dados suficientes.</p>}
            <b>Menor desempenho</b>
            {r.piores[e].length ? <ol>{r.piores[e].map(v => <li key={v.id}><span className="sm-mono">{v.codigo}</span> {v.titulo} <span className="sm-legenda">{metrica(e, v.metricas)}</span></li>)}</ol> : <p className="sm-legenda">Sem dados suficientes.</p>}
          </div>
        ))}
      </div>
      <div className="ct-duas">
        <div><h3 className="ct-sub">Temas que merecem continuidade</h3>{r.temasContinuar.length ? <ul className="ct-lista">{r.temasContinuar.map(t => <li key={t.tema + t.etapa}>{t.tema} · {ETAPA_NOME[t.etapa]} ({t.videos} vídeos)</li>)}</ul> : <p className="sm-legenda">Ainda sem dados para comparar temas.</p>}</div>
        <div><h3 className="ct-sub">Temas que precisam mudar de abordagem</h3>{r.temasMudar.length ? <ul className="ct-lista">{r.temasMudar.map(t => <li key={t.tema + t.etapa}>{t.tema} · {ETAPA_NOME[t.etapa]} ({t.videos} vídeos)</li>)}</ul> : <p className="sm-legenda">Ainda sem dados para comparar temas.</p>}</div>
        <div><h3 className="ct-sub">Perguntas reais que devem virar conteúdo</h3>{r.perguntas.length ? <ul className="ct-lista">{r.perguntas.map(p => <li key={p.id}>{p.texto}{p.ocorrencias > 1 ? ` (${p.ocorrencias}×)` : ''}</li>)}</ul> : <p className="sm-legenda">Nenhuma pendente.</p>}</div>
        <div><h3 className="ct-sub">Objeções mais recorrentes</h3>{r.objecoes.length ? <ul className="ct-lista">{r.objecoes.map(o => <li key={o.texto}>{o.texto}{o.ocorrencias > 1 ? ` (${o.ocorrencias}×)` : ''}</li>)}</ul> : <p className="sm-legenda">Nenhuma registrada no atendimento.</p>}</div>
        <div><h3 className="ct-sub">Ganchos e formatos para novos testes</h3>{r.ganchosTestar.length ? <ul className="ct-lista">{r.ganchosTestar.map(g => <li key={g.texto}>{g.texto}{g.resultado ? ` · ${g.resultado}` : ''}</li>)}</ul> : <p className="sm-legenda">Nenhum registrado.</p>}</div>
        <div><h3 className="ct-sub">Oportunidades comerciais</h3>{r.oportunidades.length ? <ul className="ct-lista">{r.oportunidades.map(v => <li key={v.id}><span className="sm-mono">{v.codigo}</span> {v.titulo} · {num(v.metricas.conversas)} conversas · {num(v.metricas.leads)} leads</li>)}</ul> : <p className="sm-legenda">Nenhum vídeo de fundo com conversa ou lead atribuído.</p>}</div>
        <div><h3 className="ct-sub">Aprendizados</h3>{r.aprendizados.length ? <ul className="ct-lista">{r.aprendizados.map(a => <li key={a.texto}><Chip tom={a.natureza === 'FATO' ? 'ok' : 'warn'}>{NATUREZA_ROTULO[a.natureza]}</Chip> {a.texto}</li>)}</ul> : <p className="sm-legenda">Nenhum registrado.</p>}</div>
        <div><h3 className="ct-sub">Hipóteses ainda não validadas</h3><ul className="ct-lista">{r.hipotesesNaoValidadas.map(h => <li key={h}><Chip tom="warn">Hipótese</Chip> {h}</li>)}</ul></div>
      </div>
      <h3 className="ct-sub">Recomendações para o próximo ciclo</h3>
      {r.recomendacoes.length ? <ul className="ct-lista">{r.recomendacoes.map(x => <li key={x.texto}><Chip tom={x.natureza === 'FATO' ? 'ok' : x.natureza === 'HIPOTESE' ? 'warn' : 'learn'}>{NATUREZA_ROTULO[x.natureza]}</Chip> {x.texto}</li>)}</ul> : <EstadoVazio titulo="Sem recomendações ainda">Com vídeos publicados e métricas, as recomendações aparecem aqui.</EstadoVazio>}
    </div>
  )
}
