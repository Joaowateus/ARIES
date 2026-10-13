'use client'

// A. Painel do mês: números do ciclo (só contagem do que existe), progresso
// por semana, período e funil, pendências que pedem ação, prioridades da
// próxima semana, checklist de qualidade e os comandos de operação.
import { useState } from 'react'
import { proLaboreApi, type CtCiclo, type CtVisao } from '@/lib/proLaboreApi'
import { Banner, BarraProgresso, Botao, Card, Chip, KpiCard, useToast } from '../../_ui'
import { ETAPA_NOME, PERIODO_NOME } from './rotulos'
import type { Navegar } from './page'

export function Painel({ dados, visao, irPara, recarregar, aoGerar }: { dados: CtCiclo; visao: CtVisao; irPara: Navegar; recarregar: () => void; aoGerar: (mes: string) => void }) {
  const toast = useToast()
  const { painel: p, checklist, ciclo } = dados
  const t = p.totais
  const falhas = checklist.filter(i => !i.ok)
  const essenciais = falhas.filter(i => i.essencial && i.chave !== 'comercial')
  const aberto = ciclo.status === 'RASCUNHO' || ciclo.status === 'APROVADO'
  const [aprovando, setAprovando] = useState(false)

  async function aprovarCiclo() {
    setAprovando(true)
    try { await proLaboreApi.sm.central.atualizarCiclo(ciclo.id, { status: 'APROVADO' }); toast({ mensagem: 'Calendário do mês aprovado.' }); recarregar() }
    catch (e) { toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível aprovar', tom: 'bad' }) } finally { setAprovando(false) }
  }

  const kpis: Array<[string, number, string]> = [
    ['Planejados', t.planejado, `${p.diasProducao} dias de produção`], ['Roteirizados', t.roteirizado, 'revisados ou escritos pela IA'], ['Aprovados', t.aprovado, 'roteiro aprovado'],
    ['Gravados', t.gravado, 'na Produção ou marcados'], ['Editados', t.editado, 'prontos para publicar'], ['Agendados', t.agendado, 'com data na Produção'],
    ['Publicados', t.publicado, 'no Instagram'], ['Pendentes', t.pendente, 'ainda não publicados'],
  ]
  const pend: Array<{ rotulo: string; valor: number; acao: () => void; tom: 'warn' | 'bad' | 'info' }> = [
    { rotulo: 'Roteiros-base ainda sem revisão', valor: p.semRoteiroRevisado, acao: () => irPara('calendario', { especial: 'semRevisao' }), tom: 'info' },
    { rotulo: 'Aguardando aprovação', valor: p.aguardandoAprovacao, acao: () => irPara('producao', { status: 'AGUARDANDO_APROVACAO' }), tom: 'warn' },
    { rotulo: 'Dependem de confirmação comercial', valor: p.pendentesComerciais, acao: () => irPara('calendario', { especial: 'pendentesComerciais' }), tom: 'warn' },
    { rotulo: 'Sem a prova necessária', valor: p.semProva, acao: () => irPara('calendario', { especial: 'semProva' }), tom: 'warn' },
    { rotulo: 'Atrasados (data passou, não publicados)', valor: p.atrasados, acao: () => irPara('producao', { especial: 'atrasados' }), tom: 'bad' },
    { rotulo: 'Com resultado registrado', valor: p.comResultado, acao: () => irPara('resultados'), tom: 'info' },
  ]

  return (
    <div className="ct-painel">
      {ciclo.status === 'RASCUNHO' && (
        <Banner tom="info" titulo="Calendário em rascunho"
          acao={dados.souGestor ? <Botao variante="pri" disabled={aprovando || essenciais.length > 0} onClick={aprovarCiclo}>{aprovando ? 'Aprovando…' : 'Aprovar o calendário do mês'}</Botao> : undefined}>
          {essenciais.length ? `Antes de aprovar, corrija: ${essenciais.map(e => e.rotulo.toLowerCase()).join('; ')}.` : dados.souGestor ? 'O checklist essencial está ok. Os roteiros continuam sendo revisados e aprovados um a um.' : 'O gestor aprova o calendário do mês; os roteiros são aprovados um a um.'}
        </Banner>
      )}

      <section className="sm-grade ct-kpis" aria-label="Totais do ciclo">
        {kpis.map(([r, v, l]) => <KpiCard key={r} rotulo={r} valor={v.toLocaleString('pt-BR')} legenda={l} />)}
      </section>

      <div className="ct-duas">
        <Card titulo="Progresso" subtitulo="Publicados sobre o total de cada grupo (roteirizados e aprovados entre parênteses).">
          <div className="ct-progresso">
            {Object.entries(p.porSemana).map(([k, g]) => <BarraProgresso key={k} rotulo={k} valor={g.publicados} max={g.total} texto={`${g.publicados}/${g.total} (${g.roteirizados} rot. · ${g.aprovados} apr.)`} />)}
            <hr className="ct-hr" />
            {Object.entries(p.porPeriodo).map(([k, g]) => <BarraProgresso key={k} rotulo={`${PERIODO_NOME[k as keyof typeof PERIODO_NOME]} · ${ETAPA_NOME[({ MANHA: 'TOPO', TARDE: 'MEIO', NOITE: 'FUNDO' } as const)[k as 'MANHA']]} de funil`} valor={g.publicados} max={g.total} texto={`${g.publicados}/${g.total}`} />)}
          </div>
        </Card>
        <Card titulo="Pendências" subtitulo="Clique para ver os vídeos.">
          <ul className="ct-pend">
            {pend.map(x => (
              <li key={x.rotulo}><button type="button" className="ct-pend-item" onClick={x.acao} disabled={x.valor === 0}>
                <span>{x.rotulo}</span><Chip tom={x.valor === 0 ? 'neutro' : x.tom}>{x.valor}</Chip>
              </button></li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="ct-duas">
        <Card titulo="Prioridades da próxima semana" subtitulo="Calculadas a partir das datas e dos status (não são estimativas).">
          {p.prioridades.length ? <ul className="ct-lista">{p.prioridades.map(x => <li key={x}>{x}</li>)}</ul> : <p className="sm-legenda" style={{ margin: 0 }}>Nada pendente para os próximos 7 dias.</p>}
          <h3 className="ct-sub">Principais aprendizados</h3>
          {p.aprendizados.length ? <ul className="ct-lista">{p.aprendizados.map(a => <li key={a.codigo}><span className="sm-mono">{a.codigo}</span> {a.texto}</li>)}</ul> : <p className="sm-legenda" style={{ margin: 0 }}>Nenhum aprendizado registrado neste ciclo ainda.</p>}
        </Card>
        <Card titulo="Checklist de qualidade" subtitulo={falhas.length ? `${falhas.length} ${falhas.length === 1 ? 'item pede' : 'itens pedem'} atenção` : 'Tudo certo'}>
          <ul className="ct-check">
            {checklist.map(i => <li key={i.chave} className={i.ok ? 'ok' : i.essencial ? 'bad' : 'warn'}><span aria-hidden="true">{i.ok ? '✓' : '!'}</span><div><b>{i.rotulo}</b>{i.detalhe && <span className="sm-legenda">{i.detalhe}</span>}</div></li>)}
          </ul>
        </Card>
      </div>

      <Comandos dados={dados} visao={visao} irPara={irPara} recarregar={recarregar} aoGerar={aoGerar} aberto={aberto} />
    </div>
  )
}

function Comandos({ dados, visao, irPara, recarregar, aoGerar, aberto }: { dados: CtCiclo; visao: CtVisao; irPara: Navegar; recarregar: () => void; aoGerar: (mes: string) => void; aberto: boolean }) {
  const proximo = (() => { const [a, m] = dados.ciclo.mes.split('-').map(Number); return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}` })()
  const jaTemProximo = visao.ciclos.some(c => c.mes === proximo && c.status !== 'ARQUIVADO')
  const pode = dados.podeEditar
  const cmd: Array<{ rotulo: string; fazer: () => void; desativado?: boolean; dica?: string }> = [
    { rotulo: 'Gerar calendário do próximo mês', fazer: () => aoGerar(proximo), desativado: !pode || jaTemProximo, dica: jaTemProximo ? 'Já existe: gere uma nova versão em Fechamento e histórico' : undefined },
    { rotulo: 'Revisar alinhamento ao dossiê', fazer: () => irPara('dossie') },
    { rotulo: 'Analisar resultados do mês', fazer: () => irPara('resultados') },
    { rotulo: 'Atualizar banco de objeções com perguntas reais', fazer: () => irPara('bancos', undefined, 'PERGUNTA') },
    { rotulo: 'Sugerir novos ângulos sem alterar o AVATAR', fazer: () => irPara('bancos', undefined, 'SUGESTAO') },
    { rotulo: 'Gerar novos conteúdos para uma objeção específica', fazer: () => irPara('bancos', undefined, 'SUGESTAO') },
    { rotulo: 'Mostrar conteúdos pendentes', fazer: () => irPara('producao', { especial: 'pendentes' }) },
    { rotulo: 'Listar conteúdos que dependem de confirmação comercial', fazer: () => irPara('calendario', { especial: 'pendentesComerciais' }) },
    { rotulo: 'Revisar vídeos repetidos', fazer: () => irPara('calendario', { especial: 'repetidos' }) },
    { rotulo: 'Reorganizar a semana (sem perder o funil)', fazer: () => irPara('calendario', {}) , dica: 'Abra um vídeo e use "Trocar de lugar"' },
    { rotulo: 'Preparar fechamento mensal', fazer: () => irPara('mes') },
  ]
  return (
    <Card titulo="Comandos" subtitulo="Cada comando faz uma tarefa e preserva o que já existe.">
      {dados.ia ? <RoteirosIA dados={dados} recarregar={recarregar} aberto={aberto} /> : (
        <p className="sm-legenda" style={{ margin: 0 }}>A IA não está ligada neste sistema: os 180 vídeos usam os roteiros-base da Central. Para escrever os roteiros com IA, o gestor configura a chave da Anthropic no servidor.</p>
      )}
      <div className="ct-comandos">
        {cmd.map(c => <Botao key={c.rotulo} disabled={c.desativado} onClick={c.fazer} title={c.dica}>{c.rotulo}</Botao>)}
      </div>
    </Card>
  )
}

/** "Gerar roteiros dos próximos cinco dias": a IA escreve um vídeo por vez, com progresso. */
function RoteirosIA({ dados, recarregar, aberto }: { dados: CtCiclo; recarregar: () => void; aberto: boolean }) {
  const toast = useToast()
  const [estado, setEstado] = useState<{ feitos: number; total: number; falhas: number } | null>(null)
  const [dias, setDias] = useState(5)
  async function rodar() {
    try {
      const { ids } = await proLaboreApi.sm.central.paraRoteirizar(dados.ciclo.id, dias)
      if (!ids.length) { toast({ mensagem: 'Os vídeos desses dias já têm roteiro revisado ou estão na Produção.' }); return }
      let feitos = 0, falhas = 0
      setEstado({ feitos, total: ids.length, falhas })
      const fila = [...ids]
      const trabalhador = async () => {
        while (fila.length) {
          const id = fila.shift()!
          try { await proLaboreApi.sm.central.roteiroIA(id); feitos++ } catch { falhas++ }
          setEstado({ feitos, total: ids.length, falhas })
        }
      }
      await Promise.all([trabalhador(), trabalhador(), trabalhador()])
      toast({ mensagem: falhas ? `${feitos} roteiros escritos; ${falhas} ficaram com o roteiro-base (tente de novo depois).` : `${feitos} roteiros escritos pela IA.`, tom: falhas && !feitos ? 'bad' : 'normal' })
      recarregar()
    } catch (e) { toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível gerar', tom: 'bad' }) }
  }
  const rodando = !!estado && estado.feitos + estado.falhas < estado.total
  return (
    <div className="ct-ia">
      <div className="sm-linha-acoes" style={{ alignItems: 'flex-end' }}>
        <label className="sm-campo">Dias de produção a partir de hoje
          <select className="sm-input" value={dias} onChange={e => setDias(Number(e.target.value))} disabled={rodando}>
            {[1, 3, 5, 10, 20].map(n => <option key={n} value={n}>{n} {n === 1 ? 'dia' : 'dias'} ({n * 9} vídeos)</option>)}
          </select>
        </label>
        <Botao variante="pri" disabled={rodando || !aberto || !dados.podeEditar} onClick={rodar}>{rodando ? 'Escrevendo roteiros…' : `Gerar roteiros dos próximos ${dias} ${dias === 1 ? 'dia' : 'dias'} com IA`}</Botao>
      </div>
      {estado && <BarraProgresso rotulo="Roteiros com IA" valor={estado.feitos + estado.falhas} max={estado.total} texto={`${estado.feitos} prontos${estado.falhas ? ` · ${estado.falhas} com roteiro-base` : ''} de ${estado.total}`} />}
      <p className="sm-legenda" style={{ margin: 0 }}>A IA reescreve só o que ainda é roteiro-base, seguindo o dossiê; não inventa preço, estoque, depoimento nem número. Cada roteiro ainda passa pela aprovação.</p>
    </div>
  )
}
