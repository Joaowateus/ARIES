'use client'

// K/L. Métricas e aprendizados: cada etapa do funil julgada pelo seu
// objetivo (topo por alcance e compartilhamento, meio por salvamento e
// dúvida, fundo por conversa, lead e venda atribuídos). Sem dado, nada é
// estimado; vendas só com código ou mídia do post.
import { useState } from 'react'
import type { CtCiclo, CtEtapa, CtVideo } from '@/lib/proLaboreApi'
import { Card, Chip, EstadoVazio, Segmentado } from '../../_ui'
import { ETAPA_NOME, STATUS_ROTULO, ddmm, num } from './rotulos'
import { VideoModal } from './VideoModal'

const CRITERIO: Record<CtEtapa, string> = {
  TOPO: 'Topo: alcance, compartilhamentos, comentários e retenção (identificação)',
  MEIO: 'Meio: salvamentos, comentários e dúvidas recebidas (confiança)',
  FUNDO: 'Fundo: conversas, leads e vendas atribuídos, visitas, avaliações e propostas (oportunidade)',
}

export function Resultados({ dados, recarregar }: { dados: CtCiclo; recarregar: () => void }) {
  const [etapa, setEtapa] = useState<CtEtapa>('TOPO')
  const [aberto, setAberto] = useState<string | null>(null)
  const daEtapa = dados.videos.filter(v => v.etapa === etapa)
  const comDados = daEtapa.filter(v => v.metricas.disponivel || v.metricasManuais || v.resultado).sort((a, b) => (b.nota ?? -1) - (a.nota ?? -1))
  const aprendizados = dados.videos.filter(v => v.aprendizado)
  return (
    <div className="ct-resultados">
      <Segmentado rotulo="Etapa do funil" opcoes={[{ valor: 'TOPO', rotulo: 'Topo (manhã)' }, { valor: 'MEIO', rotulo: 'Meio (tarde)' }, { valor: 'FUNDO', rotulo: 'Fundo (noite)' }] as const} valor={etapa} aoMudar={setEtapa} />
      <Card titulo={`Resultados do ${ETAPA_NOME[etapa].toLowerCase()} de funil`} subtitulo={`${CRITERIO[etapa]}. ${comDados.length} de ${daEtapa.length} vídeos com algum dado.`}>
        {comDados.length === 0 ? <EstadoVazio titulo="Nenhum resultado ainda">As métricas chegam quando o vídeo é publicado pela Produção e o Instagram sincroniza. O registro manual (mensagens, visitas, avaliações, propostas) fica dentro de cada vídeo.</EstadoVazio> : (
          <div className="sm-tabela-rola">
            <table className="sm-tabela ct-tabela">
              <thead><tr><th scope="col">Vídeo</th>{etapa === 'TOPO' && <><th scope="col">Alcance</th><th scope="col">Compart.</th><th scope="col">Coment.</th><th scope="col">Conclusão</th></>}
                {etapa === 'MEIO' && <><th scope="col">Salvos</th><th scope="col">Coment.</th><th scope="col">Compart.</th><th scope="col">Mensagens</th></>}
                {etapa === 'FUNDO' && <><th scope="col">Conversas</th><th scope="col">Leads</th><th scope="col">Vendas atrib.</th><th scope="col">Visitas · aval. · prop.</th></>}
                <th scope="col">Resultado</th></tr></thead>
              <tbody>{comDados.map(v => <Linha key={v.id} v={v} abrir={setAberto} />)}</tbody>
            </table>
          </div>
        )}
      </Card>
      <Card titulo="Aprendizados do ciclo" subtitulo="Registrados nos vídeos: entram no fechamento do mês e no próximo calendário.">
        {aprendizados.length ? <ul className="ct-lista">{aprendizados.map(v => <li key={v.id}><button type="button" className="sm-link-botao" onClick={() => setAberto(v.id)}>{v.codigo}</button> {v.aprendizado}</li>)}</ul> : <p className="sm-legenda" style={{ margin: 0 }}>Nenhum aprendizado registrado ainda. Abra um vídeo publicado e registre o que observou.</p>}
      </Card>
      {aberto && <VideoModal id={aberto} dados={dados} aoFechar={() => setAberto(null)} aoMudar={recarregar} aoAbrir={setAberto} />}
    </div>
  )
}

function Linha({ v, abrir }: { v: CtVideo; abrir: (id: string) => void }) {
  const m = v.metricas, man = v.metricasManuais ?? {}
  return (
    <tr>
      <td><button type="button" className="ct-link-video" onClick={() => abrir(v.id)}><span className="sm-mono">{v.codigo}</span> {v.titulo}</button><span className="sm-legenda">{ddmm(v.data)} · {STATUS_ROTULO[v.status]}{!m.disponivel && ' · sem métricas do Instagram'}</span></td>
      {v.etapa === 'TOPO' && <><td>{num(m.alcance)}</td><td>{num(m.compartilhamentos)}</td><td>{num(m.comentarios)}</td><td>{m.retencao != null ? `${Math.round(m.retencao * 100)}%` : '—'}</td></>}
      {v.etapa === 'MEIO' && <><td>{num(m.salvamentos)}</td><td>{num(m.comentarios)}</td><td>{num(m.compartilhamentos)}</td><td>{num(man.mensagens)}</td></>}
      {v.etapa === 'FUNDO' && <><td>{num(m.conversas)}</td><td>{num(m.leads)}</td><td>{num(m.vendas)}</td><td>{num(man.visitasAgendadas)} · {num(man.avaliacoesSolicitadas)} · {num(man.propostas)}</td></>}
      <td>{v.resultado ? <Chip tom="info" titulo={v.resultado}>Registrado</Chip> : '—'}</td>
    </tr>
  )
}
