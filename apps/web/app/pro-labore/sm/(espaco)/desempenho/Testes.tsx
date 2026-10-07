'use client'

// Testes A/B (seção 13.3) na tela 05: o cartão "Teste em andamento" (ou o
// último resultado), a criação de um teste e a lista com os resultados.
// O resultado só é declarado com a amostra completa.
import { useCallback, useEffect, useState } from 'react'
import { proLaboreApi, type SmMetricaTeste, type SmTesteAB, type SmVariavelTeste } from '@/lib/proLaboreApi'
import { BarraProgresso, Botao, Chip, EstadoVazio, Modal, Rotulo, useToast } from '../../_ui'

const VARIAVEIS: Array<{ valor: SmVariavelTeste; rotulo: string; metrica: SmMetricaTeste; dica: [string, string, string] }> = [
  { valor: 'HORARIO', rotulo: 'Horário', metrica: 'ALCANCE', dica: ['Posts às 17h alcançam mais que às 11h', '17h', '11h'] },
  { valor: 'GANCHO', rotulo: 'Gancho', metrica: 'PULO', dica: ['Abrir com a moto em movimento segura mais que com a moto parada', 'Em movimento', 'Parada'] },
  { valor: 'FORMATO', rotulo: 'Formato', metrica: 'ALCANCE', dica: ['Carrossel de estoque alcança tanto quanto reels', 'Carrossel', 'Reels'] },
  { valor: 'CTA', rotulo: 'Chamada para ação', metrica: 'ENVIOS', dica: ['Terminar com "mande para quem…" aumenta os envios', '"Mande para quem…"', 'Sem pedido'] },
  { valor: 'OUTRO', rotulo: 'Outro', metrica: 'ALCANCE', dica: ['Descreva a hipótese', 'Grupo A', 'Grupo B'] },
]
const METRICAS: Array<{ valor: SmMetricaTeste; rotulo: string }> = [
  { valor: 'ALCANCE', rotulo: 'Alcance' }, { valor: 'PULO', rotulo: 'Pulo nos 3 s (menor é melhor)' }, { valor: 'RETENCAO', rotulo: 'Retenção' },
  { valor: 'ENVIOS', rotulo: 'Envios por mil' }, { valor: 'SALVOS', rotulo: 'Salvos por mil' },
]
const CONFIANCA = { alta: 'Confiança alta', media: 'Confiança média', baixa: 'Confiança baixa', hipotese: 'Hipótese' } as const
const dec = (v: number, c = 1) => v.toLocaleString('pt-BR', { maximumFractionDigits: c })

function valorMetrica(t: SmTesteAB, v: number | null): string {
  if (v == null) return '—'
  if (t.metrica === 'ALCANCE') return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
  if (t.metrica === 'PULO' || t.metrica === 'RETENCAO') return `${dec(v)}%`
  return dec(v, 2)
}

/** Cartão do teste na tela 05 (protótipo: hipótese, descrição e amostra atual / alvo com barra). */
export function CartaoTeste({ teste, podeCriar, aoMudar }: { teste: SmTesteAB | null; podeCriar: boolean; aoMudar: () => void }) {
  const [novo, setNovo] = useState(false)
  const [lista, setLista] = useState(false)
  return (
    <section className="sm-card sm-desemp-teste" aria-label="Teste em andamento">
      <div className="sm-desemp-teste-corpo">
        <div className="sm-desemp-teste-texto">
          <Rotulo>{teste?.status === 'CONCLUIDO' ? 'Último teste concluído' : 'Teste em andamento'}</Rotulo>
          {teste
            ? <>
              <div className="sm-desemp-teste-tit">Hipótese: {teste.hipotese}</div>
              <p className="sm-legenda" style={{ margin: 0 }}>
                {teste.descricao ? `${teste.descricao} ` : ''}{teste.grupoA} contra {teste.grupoB}, medindo {teste.metricaRotulo.toLowerCase()}. O resultado só é declarado com {teste.amostraAlvo} posts.
              </p>
            </>
            : <>
              <div className="sm-desemp-teste-tit">Nenhum teste A/B em andamento</div>
              <p className="sm-legenda" style={{ margin: 0 }}>Crie um teste com uma hipótese e marque as pautas de cada grupo no briefing da Produção. O resultado só é declarado com a amostra completa.</p>
            </>}
        </div>
        {teste && teste.status === 'ATIVO' && (
          <div className="sm-desemp-teste-barra">
            <BarraProgresso rotulo="Amostra" valor={teste.amostraAtual} max={teste.amostraAlvo} texto={`${teste.amostraAtual} / ${teste.amostraAlvo} posts`} />
            <span className="sm-legenda">{teste.grupoA}: {teste.grupos.A.medidos} de {teste.amostraAlvo / 2} · {teste.grupoB}: {teste.grupos.B.medidos} de {teste.amostraAlvo / 2}{teste.grupos.A.posts + teste.grupos.B.posts > teste.grupos.A.medidos + teste.grupos.B.medidos ? ` · ${teste.grupos.A.posts + teste.grupos.B.posts - teste.grupos.A.medidos - teste.grupos.B.medidos} na fila` : ''}</span>
          </div>
        )}
        {teste && teste.status === 'CONCLUIDO' && teste.resultado && <ResultadoBarras t={teste} />}
      </div>
      <div className="sm-linha-acoes">
        {podeCriar && <Botao onClick={() => setNovo(true)}>Novo teste</Botao>}
        <Botao variante="fantasma" onClick={() => setLista(true)}>Ver todos os testes</Botao>
      </div>
      {novo && <NovoTeste aoFechar={() => setNovo(false)} aoCriar={() => { setNovo(false); aoMudar() }} />}
      {lista && <ListaTestes aoFechar={() => { setLista(false); aoMudar() }} />}
    </section>
  )
}

function ResultadoBarras({ t }: { t: SmTesteAB }) {
  const r = t.resultado!
  const max = Math.max(r.mediaA ?? 0, r.mediaB ?? 0, 1)
  return (
    <div className="sm-desemp-teste-barra">
      {(['A', 'B'] as const).map(g => {
        const v = g === 'A' ? r.mediaA : r.mediaB
        return (
          <div key={g} className="sm-teste-res">
            <div className="sm-atrib-par"><span>{g === 'A' ? t.grupoA : t.grupoB}{r.vencedor === g ? ' · vencedor' : ''}</span><b className="sm-num">{valorMetrica(t, v)}</b></div>
            <div className="sm-atrib-trilho"><span style={{ width: `${v ? Math.max(2, (v / max) * 100) : 0}%`, background: r.vencedor === g ? 'var(--sm-ok-dot)' : 'var(--sm-data-blue)' }} /></div>
          </div>
        )
      })}
      <span className="sm-legenda">{r.texto}</span>
      <Chip tom={r.confianca === 'alta' ? 'ok' : r.confianca === 'media' ? 'info' : 'neutro'}>{CONFIANCA[r.confianca]} · {r.nA + r.nB} posts</Chip>
    </div>
  )
}

function NovoTeste({ aoFechar, aoCriar }: { aoFechar: () => void; aoCriar: () => void }) {
  const toast = useToast()
  const [variavel, setVariavel] = useState<SmVariavelTeste>('HORARIO')
  const info = VARIAVEIS.find(v => v.valor === variavel)!
  const [f, setF] = useState({ hipotese: '', descricao: '', grupoA: '', grupoB: '', horaA: 17, horaB: 11, metrica: info.metrica as SmMetricaTeste, amostraAlvo: 6 })
  const [erro, setErro] = useState<string | null>(null)
  return (
    <Modal titulo="Novo teste A/B" aoFechar={aoFechar}>
      <form className="sm-form" onSubmit={async e => {
        e.preventDefault()
        try {
          await proLaboreApi.sm.testes.criar({
            hipotese: f.hipotese, descricao: f.descricao || null, variavel, grupoA: f.grupoA, grupoB: f.grupoB,
            horaA: variavel === 'HORARIO' ? f.horaA : null, horaB: variavel === 'HORARIO' ? f.horaB : null, metrica: f.metrica, amostraAlvo: f.amostraAlvo,
          })
          toast({ mensagem: 'Teste criado. Marque as pautas de cada grupo no briefing da Produção.' })
          aoCriar()
        } catch (err) { setErro(err instanceof Error ? err.message : 'Não foi possível criar') }
      }}>
        <label className="sm-campo">O que está sendo testado
          <select className="sm-input" value={variavel} onChange={e => { const v = e.target.value as SmVariavelTeste; setVariavel(v); setF(x => ({ ...x, metrica: VARIAVEIS.find(i => i.valor === v)!.metrica })) }}>
            {VARIAVEIS.map(v => <option key={v.valor} value={v.valor}>{v.rotulo}</option>)}
          </select>
        </label>
        <label className="sm-campo">Hipótese
          <input className="sm-input" required minLength={8} maxLength={200} value={f.hipotese} onChange={e => setF({ ...f, hipotese: e.target.value })} placeholder={info.dica[0]} />
        </label>
        <label className="sm-campo">Descrição (opcional)
          <input className="sm-input" maxLength={500} value={f.descricao} onChange={e => setF({ ...f, descricao: e.target.value })} placeholder="Mesmo formato e pilar nos dois grupos." />
        </label>
        <div className="sm-grade-2">
          <label className="sm-campo">Grupo A
            <input className="sm-input" required maxLength={40} value={f.grupoA} onChange={e => setF({ ...f, grupoA: e.target.value })} placeholder={info.dica[1]} />
          </label>
          <label className="sm-campo">Grupo B
            <input className="sm-input" required maxLength={40} value={f.grupoB} onChange={e => setF({ ...f, grupoB: e.target.value })} placeholder={info.dica[2]} />
          </label>
          {variavel === 'HORARIO' && (
            <>
              <label className="sm-campo">Hora do grupo A
                <input className="sm-input" type="number" min={0} max={23} value={f.horaA} onChange={e => setF({ ...f, horaA: Number(e.target.value) })} />
              </label>
              <label className="sm-campo">Hora do grupo B
                <input className="sm-input" type="number" min={0} max={23} value={f.horaB} onChange={e => setF({ ...f, horaB: Number(e.target.value) })} />
              </label>
            </>
          )}
          <label className="sm-campo">Medir por
            <select className="sm-input" value={f.metrica} onChange={e => setF({ ...f, metrica: e.target.value as SmMetricaTeste })}>
              {METRICAS.map(m => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
            </select>
          </label>
          <label className="sm-campo">Amostra (posts)
            <input className="sm-input" type="number" min={2} max={20} step={2} value={f.amostraAlvo} onChange={e => setF({ ...f, amostraAlvo: Number(e.target.value) })} />
          </label>
        </div>
        <p className="sm-legenda" style={{ margin: 0 }}>Metade da amostra em cada grupo. Use Trial Reels para testar ganchos sem afetar o feed.</p>
        {erro && <p className="sm-erro" role="alert">{erro}</p>}
        <div className="sm-linha-acoes" style={{ justifyContent: 'flex-end' }}>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" variante="pri">Criar teste</Botao>
        </div>
      </form>
    </Modal>
  )
}

function ListaTestes({ aoFechar }: { aoFechar: () => void }) {
  const toast = useToast()
  const [dados, setDados] = useState<{ ativos: SmTesteAB[]; concluidos: SmTesteAB[]; podeEditar: boolean } | null>(null)
  const carregar = useCallback(() => { proLaboreApi.sm.testes.listar().then(setDados).catch(() => setDados({ ativos: [], concluidos: [], podeEditar: false })) }, [])
  useEffect(() => { carregar() }, [carregar])
  async function cancelar(t: SmTesteAB) {
    if (!window.confirm(`Cancelar o teste "${t.hipotese}"? As pautas saem do teste.`)) return
    try { await proLaboreApi.sm.testes.cancelar(t.id); toast({ mensagem: 'Teste cancelado.' }); carregar() } catch (e) { toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível cancelar', tom: 'bad' }) }
  }
  return (
    <Modal titulo="Testes A/B" aoFechar={aoFechar}>
      {!dados ? <p className="sm-legenda">Carregando…</p> : dados.ativos.length + dados.concluidos.length === 0 ? <EstadoVazio titulo="Nenhum teste ainda">Os testes criados aparecem aqui, com o resultado quando a amostra completa.</EstadoVazio> : (
        <div className="sm-form">
          {[...dados.ativos, ...dados.concluidos].map(t => (
            <article key={t.id} className="sm-teste-item">
              <div className="sm-atrib-par">
                <b>{t.hipotese}</b>
                <Chip tom={t.status === 'ATIVO' ? 'info' : 'ok'}>{t.status === 'ATIVO' ? `${t.amostraAtual} / ${t.amostraAlvo} posts` : 'Concluído'}</Chip>
              </div>
              {t.status === 'CONCLUIDO' && t.resultado ? <ResultadoBarras t={t} /> : (
                <span className="sm-legenda">
                  {t.grupoA}: {t.grupos.A.posts} {t.grupos.A.posts === 1 ? 'pauta' : 'pautas'} ({t.grupos.A.medidos} medidas) · {t.grupoB}: {t.grupos.B.posts} ({t.grupos.B.medidos} medidas)
                </span>
              )}
              {t.status === 'ATIVO' && dados.podeEditar && <div><Botao variante="fantasma" onClick={() => cancelar(t)}>Cancelar teste</Botao></div>}
            </article>
          ))}
        </div>
      )}
    </Modal>
  )
}
