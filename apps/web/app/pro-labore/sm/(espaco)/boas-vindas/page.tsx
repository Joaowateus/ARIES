'use client'

// Tela 08 · Primeiro acesso (seção 11.1, protótipo Onboarding.html): quatro
// passos, com os números reais da conta, as metas pré-selecionadas pela
// sugestão dos últimos 90 dias e o ritmo (rituais e avisos). Tudo é gravado
// nas preferências e nas metas da semana, que o gestor vê e ajusta.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { proLaboreApi, type SmBoasVindas, type SmGenero } from '@/lib/proLaboreApi'
import { Botao, CardEsqueleto, EstadoVazio, Rotulo, Segmentado, useToast } from '../../_ui'
import { useEspacoSM } from '../EspacoSM'

const PASSOS = ['Boas-vindas', 'Ponto de partida', 'Metas da semana', 'Seu ritmo']
const fmt = (n: number) => n.toLocaleString('pt-BR')
const HORAS = [7, 8, 9, 10, 11]

export default function BoasVindasPage() {
  const router = useRouter()
  const toast = useToast()
  const { eu, recarregar } = useEspacoSM()
  const [d, setD] = useState<SmBoasVindas | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [passo, setPasso] = useState(0)
  const [tratamento, setTratamento] = useState('')
  const [genero, setGenero] = useState<SmGenero | 'N'>('N')
  const [metas, setMetas] = useState({ diasComPost: 4, respostaMin: 15, leadsSemana: 20 })
  const [focoHora, setFocoHora] = useState(9)
  const [avisos, setAvisos] = useState({ whatsapp: true, celular: true, email: false })
  const [salvando, setSalvando] = useState(false)
  const previa = eu.visao !== 'SOCIAL_MEDIA' || eu.verComo

  useEffect(() => {
    proLaboreApi.sm.boasVindas.ver().then(r => {
      setD(r)
      setTratamento(r.pessoa.tratamento ?? '')
      setGenero(r.pessoa.genero ?? 'N')
      setMetas(r.metas.sugerida)
      setFocoHora(r.ritmo.focoHora)
      setAvisos(r.ritmo.avisos)
    }).catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível abrir o primeiro acesso'))
  }, [])

  async function comecar() {
    if (previa) { router.push('/pro-labore/sm'); return }
    setSalvando(true)
    try {
      await proLaboreApi.sm.boasVindas.salvar({ tratamento: tratamento.trim() || null, genero: genero === 'N' ? null : genero, metas, focoHora, avisos })
      recarregar()
      router.replace('/pro-labore/sm')
    } catch (e) {
      toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível salvar', tom: 'bad' })
      setSalvando(false)
    }
  }

  if (erro) return <div className="sm-boas"><EstadoVazio titulo="Não foi possível abrir o primeiro acesso">{erro}</EstadoVazio></div>
  if (!d) return <div className="sm-boas"><CardEsqueleto linhas={6} /></div>
  const p = d.ponto
  return (
    <div className="sm-boas">
      <aside className="sm-boas-lado">
        <div className="sm-boas-marca"><span className="sm-assist-avatar" aria-hidden="true">A</span><span className="sm-ttl">Pró-Labore</span></div>
        <ol className="sm-boas-passos" aria-label="Passos">
          {PASSOS.map((l, i) => (
            <li key={l} className={i < passo ? 'feito' : i === passo ? 'atual' : ''} aria-current={i === passo ? 'step' : undefined}>
              <span className="sm-boas-marcador">{i < passo ? '✓' : i + 1}</span><span>{l}</span>
            </li>
          ))}
        </ol>
        <p className="sm-legenda">Leva menos de 3 minutos. Dá para mudar tudo depois em Preferências.</p>
      </aside>

      <main className="sm-boas-meio">
        {previa && <p className="sm-legenda" role="status">Pré-visualização do primeiro acesso do Social Media: nada aqui é salvo.</p>}
        {passo === 0 && (
          <section className="sm-boas-passo" aria-label="Boas-vindas">
            <Rotulo>Primeiro acesso</Rotulo>
            <h1 className="sm-ttl sm-boas-titulo">Este é o seu espaço de trabalho{d.loja ? ` na ${d.loja}` : ''}.</h1>
            <p className="sm-boas-sub">Aqui você planeja, produz, atende e mostra quanto o Instagram vende. Tudo num lugar só, sem planilha paralela.</p>
            <div className="sm-boas-cartoes">
              <div className="sm-card"><Rotulo>Todo dia</Rotulo><strong>Um ritual de 15 minutos</strong><span className="sm-legenda">O sistema monta sua fila: responder, conferir, publicar.</span></div>
              <div className="sm-card"><Rotulo>Toda semana</Rotulo><strong>Sua retrospectiva pronta</strong><span className="sm-legenda">O que funcionou, o que vendeu e o que testar a seguir.</span></div>
              <div className="sm-card"><Rotulo>Sempre</Rotulo><strong>Seu trabalho vira venda visível</strong><span className="sm-legenda">Cada lead e cada moto vendida voltam para o post que os trouxe.</span></div>
            </div>
            <div className="sm-grade-2" style={{ maxWidth: 640 }}>
              <label className="sm-campo">Como te chamar
                <input className="sm-input" value={tratamento} onChange={e => setTratamento(e.target.value)} maxLength={40} readOnly={previa} />
              </label>
              <div className="sm-campo"><span>Na saudação</span>
                <Segmentado rotulo="Concordância da saudação" valor={genero} aoMudar={v => setGenero(v)} desabilitado={previa}
                  opcoes={[{ valor: 'F', rotulo: 'Bem-vinda' }, { valor: 'M', rotulo: 'Bem-vindo' }, { valor: 'N', rotulo: 'Boas-vindas' }]} />
              </div>
            </div>
          </section>
        )}
        {passo === 1 && (
          <section className="sm-boas-passo" aria-label="Ponto de partida">
            <Rotulo>Passo 2 · Seu ponto de partida</Rotulo>
            <h1 className="sm-ttl sm-boas-titulo">A conta hoje, sem filtro.</h1>
            <p className="sm-boas-sub">É daqui que medimos sua evolução. Nada aqui é cobrança: é a linha de base.</p>
            <div className="sm-boas-numeros">
              <div className="sm-card"><span className="sm-ttl">{p.seguidores != null ? fmt(p.seguidores) : '—'}</span><span>{p.seguidores != null ? 'seguidores' : 'seguidores (conta ainda não sincronizada)'}</span></div>
              {p.leads30 != null && <div className="sm-card"><span className="sm-ttl">{fmt(p.leads30)}</span><span>leads orgânicos em 30 dias</span></div>}
              {p.vendas30 != null && <div className="sm-card"><span className="sm-ttl">{fmt(p.vendas30)}</span><span>{p.vendas30 === 1 ? 'venda vinda' : 'vendas vindas'} do Instagram em 30 dias</span></div>}
              {p.diasSemPost != null && p.diasSemPost >= 2
                ? <div className="sm-card destaque"><span className="sm-ttl">{p.diasSemPost} dias</span><span>sem post no feed: sua primeira vitória é zerar isso</span></div>
                : p.maiorIntervalo30 != null
                  ? <div className="sm-card"><span className="sm-ttl">{p.maiorIntervalo30} {p.maiorIntervalo30 === 1 ? 'dia' : 'dias'}</span><span>de maior intervalo sem post nos últimos 30 dias</span></div>
                  : <div className="sm-card destaque"><span className="sm-ttl">Sem posts</span><span>nos últimos 90 dias: sua primeira vitória é o primeiro post</span></div>}
            </div>
          </section>
        )}
        {passo === 2 && (
          <section className="sm-boas-passo" aria-label="Metas da semana">
            <Rotulo>Passo 3 · Metas da semana</Rotulo>
            <h1 className="sm-ttl sm-boas-titulo">Combine o que é possível. Depois a gente sobe.</h1>
            <Meta rotulo="Dias com post por semana" valor={metas.diasComPost} opcoes={d.metas.opcoes.diasComPost} texto={v => `${v} dias`} aoMudar={v => setMetas({ ...metas, diasComPost: v })} previa={previa} />
            <Meta rotulo="Tempo máximo para responder uma DM" valor={metas.respostaMin} opcoes={d.metas.opcoes.respostaMin} texto={v => (v === 60 ? '1 hora' : `${v} min`)} aoMudar={v => setMetas({ ...metas, respostaMin: v })} previa={previa} />
            <Meta rotulo="Leads orgânicos por semana" valor={metas.leadsSemana} opcoes={d.metas.opcoes.leadsSemana} texto={v => String(v)} aoMudar={v => setMetas({ ...metas, leadsSemana: v })} previa={previa} />
            <p className="sm-legenda">
              Sugestão do sistema com base nos últimos 90 dias: {fmt(d.metas.base.diasPorSemana)} dias com post por semana
              {d.metas.base.respostaMediana != null ? `, resposta mediana de ${d.metas.base.respostaMediana < 1 ? 'menos de 1 minuto' : `${d.metas.base.respostaMediana} min`}` : ''}
              {d.metas.base.leadsPorSemana != null ? ` e ${fmt(d.metas.base.leadsPorSemana)} leads orgânicos por semana` : ''}. O gestor vê e pode ajustar.
            </p>
          </section>
        )}
        {passo === 3 && (
          <section className="sm-boas-passo" aria-label="Seu ritmo">
            <Rotulo>Passo 4 · Seu ritmo</Rotulo>
            <h1 className="sm-ttl sm-boas-titulo">Três rituais. Nada além disso.</h1>
            <div className="sm-boas-rituais">
              <div className="sm-card">
                <label className="sm-sr" htmlFor="foco-hora">Hora do modo foco</label>
                <select id="foco-hora" className="sm-boas-hora sm-ttl" value={focoHora} disabled={previa} onChange={e => setFocoHora(Number(e.target.value))}>
                  {HORAS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}h00</option>)}
                </select>
                <div><strong>Modo foco diário · 15 min</strong><div className="sm-legenda">Uma tarefa por vez, na ordem certa.</div></div>
              </div>
              <div className="sm-card"><span className="sm-ttl sm-boas-hora">Sex</span><div><strong>Retrospectiva da semana · 5 min</strong><div className="sm-legenda">Pronta automaticamente, com um botão para enviar ao gestor.</div></div></div>
              <div className="sm-card"><span className="sm-ttl sm-boas-hora">Dia 25</span><div><strong>Planejamento do mês seguinte · 40 min</strong><div className="sm-legenda">Calendário pré-montado com estoque e datas comerciais.</div></div></div>
            </div>
            <fieldset className="sm-boas-avisos">
              <legend className="sm-mono">Avisar no</legend>
              {([['whatsapp', 'WhatsApp'], ['celular', 'Celular (app)'], ['email', 'E-mail']] as const).map(([k, r]) => (
                <label key={k}><input type="checkbox" checked={avisos[k]} disabled={previa} onChange={e => setAvisos({ ...avisos, [k]: e.target.checked })} /> {r}</label>
              ))}
            </fieldset>
          </section>
        )}
        <div className="sm-boas-botoes">
          {passo > 0 && <Botao onClick={() => setPasso(passo - 1)}>Voltar</Botao>}
          {passo < 3
            ? <Botao variante="pri" onClick={() => setPasso(passo + 1)}>{passo === 0 ? 'Começar' : 'Continuar'}</Botao>
            : <Botao variante="pri" disabled={salvando} onClick={comecar}>{previa ? 'Voltar ao Hoje' : salvando ? 'Salvando…' : 'Começar meu primeiro dia'}</Botao>}
        </div>
      </main>
    </div>
  )
}

function Meta({ rotulo, valor, opcoes, texto, aoMudar, previa }: { rotulo: string; valor: number; opcoes: number[]; texto: (v: number) => string; aoMudar: (v: number) => void; previa: boolean }) {
  return (
    <div className="sm-boas-meta">
      <span className="sm-boas-meta-rotulo">{rotulo}</span>
      <div role="group" aria-label={rotulo} className="sm-boas-opcoes">
        {opcoes.map(o => <button key={o} type="button" className="sm-boas-opcao" aria-pressed={valor === o} disabled={previa} onClick={() => aoMudar(o)}>{texto(o)}</button>)}
      </div>
    </div>
  )
}
