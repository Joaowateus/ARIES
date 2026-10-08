'use client'

// Tela 13 · Recepção (seção 11.6, protótipo Recepcao.html): simulador de
// momentos numa rota interna do gestor, para revisar as saudações com os
// dados reais da conta. Nada aqui é gravado.
import { useEffect, useState } from 'react'
import { proLaboreApi, type SmGenero, type SmMomento, type SmSimulacaoRecepcao } from '@/lib/proLaboreApi'
import { CardEsqueleto, Chip, EstadoVazio, Recepcao, Rotulo, Segmentado } from '../../_ui'
import { useEspacoSM } from '../EspacoSM'

const REGRAS: Array<[string, string]> = [
  ['1 · Útil antes de simpática', 'Toda saudação carrega pelo menos uma informação que muda o dia: um cliente esperando, um post no ar, uma venda creditada.'],
  ['2 · Nunca repetida', '8 frases por momento. A mesma frase não volta antes de 7 dias para a mesma pessoa; no mesmo dia e momento, a saudação é a mesma.'],
  ['3 · O tom acompanha o dia', 'Semana boa celebra, semana difícil acolhe sem cobrança, à noite libera.'],
  ['4 · Some quando a pessoa começa', 'Depois da primeira ação na tela Hoje, o bloco recolhe numa linha.'],
  ['5 · Respeita o expediente', 'Fora do horário configurado, nenhuma pendência em vermelho: só o resumo e o que espera amanhã.'],
]
const fmtData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Belem' })

export default function RecepcaoSimuladorPage() {
  const { eu } = useEspacoSM()
  if (eu.visao !== 'GESTOR' || eu.verComo) return <div className="sm-card"><EstadoVazio titulo="Só para o gestor">O simulador de saudações fica na visão do gestor.</EstadoVazio></div>
  return <Simulador ia={eu.ia.ligada} />
}

function Simulador({ ia }: { ia: boolean }) {
  const [momento, setMomento] = useState<SmMomento>('MANHA')
  const [para, setPara] = useState<'SOCIAL_MEDIA' | 'GESTOR'>('SOCIAL_MEDIA')
  const [genero, setGenero] = useState<SmGenero | 'N'>('N')
  const [frase, setFrase] = useState<string | null>(null)
  const [dados, setDados] = useState<SmSimulacaoRecepcao | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    proLaboreApi.sm.recepcao.simular({ momento, para, genero: genero === 'N' ? null : genero, frase })
      .then(d => { setDados(d); setErro(null) })
      .catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível simular'))
  }, [momento, para, genero, frase])

  return (
    <>
      <header className="sm-pagina-cab">
        <div>
          <Rotulo>Experiência · Recepção</Rotulo>
          <h1 className="sm-ttl sm-h1">O sistema que te recebe</h1>
          <p>A saudação muda com a hora, o dia da semana e o que aconteceu desde o último acesso. Escolha um momento para ver como o Hoje abre, com os dados reais da conta.</p>
        </div>
      </header>

      <div className="sm-recepcao-sim">
        <nav aria-label="Momentos" className="sm-card sm-recepcao-sim-nav">
          <Rotulo>Simular momento</Rotulo>
          {(dados?.momentos ?? []).map(m => (
            <button key={m.id} type="button" className="sm-recepcao-mom" aria-pressed={momento === m.id} onClick={() => { setMomento(m.id); setFrase(null) }}>
              <span style={{ fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {m.rotulo}
                {dados?.vence === m.id ? <Chip tom="ok">Vence agora</Chip> : m.aplicaAgora ? <Chip tom="neutro">Também vale agora</Chip> : null}
              </span>
              <span className="sm-legenda">{m.quando}</span>
            </button>
          ))}
          {!dados && <CardEsqueleto linhas={6} />}
        </nav>

        <section aria-label="Prévia" className="sm-recepcao-sim-previa">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Segmentado rotulo="Para quem" valor={para} aoMudar={v => setPara(v)} opcoes={[{ valor: 'SOCIAL_MEDIA', rotulo: `Social Media${dados && para === 'SOCIAL_MEDIA' ? ` (${dados.pessoa})` : ''}` }, { valor: 'GESTOR', rotulo: 'Gestor' }]} />
            <Segmentado rotulo="Concordância" valor={genero} aoMudar={v => setGenero(v)} opcoes={[{ valor: 'F', rotulo: 'Bem-vinda' }, { valor: 'M', rotulo: 'Bem-vindo' }, { valor: 'N', rotulo: 'Neutra' }]} />
          </div>
          {erro && <p className="sm-erro" role="alert">{erro}</p>}
          <div className="sm-recepcao-sim-tela">
            {dados?.recepcao
              ? <Recepcao key={`${momento}-${para}-${genero}-${frase}`} r={dados.recepcao} ia={ia} previa />
              : dados?.aviso ? <EstadoVazio titulo="Este momento não apareceria agora">{dados.aviso}</EstadoVazio> : <CardEsqueleto linhas={4} />}
          </div>
          {dados && (
            <section className="sm-card" aria-label="Banco de frases">
              <Rotulo>Banco de frases · {dados.frases.length} variações</Rotulo>
              <div className="sm-recepcao-frases">
                {dados.frases.map((f, i) => (
                  <button key={f.id} type="button" className="sm-recepcao-frase" aria-pressed={(frase ?? dados.frases[0]?.id) === f.id} onClick={() => setFrase(f.id)}>
                    <span>{f.texto}</span>
                    <span className="sm-legenda">{f.ultimaVez ? `Apareceu em ${fmtData(f.ultimaVez)}` : i === 0 && !frase ? 'Na prévia' : 'Ainda não apareceu'}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </section>
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 className="sm-ttl" style={{ fontSize: 22, margin: 0 }}>Regras da recepção</h2>
        <div className="sm-recepcao-itens">
          {REGRAS.map(([t, x]) => (
            <div key={t} className="sm-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="sm-mono" style={{ color: 'var(--sm-info-fg)' }}>{t}</span>
              <span style={{ lineHeight: 1.5 }}>{x}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
