'use client'

// PDF 03 · seção 9: aceite da onda 2 calculado na produção, e a amostra de
// 20 Recomendações para o teste de utilidade (dono e supervisor marcam
// pertinente ou não; passa com 80% ou mais).
import { useState } from 'react'
import { recApi, type AceitePdf03 as Aceite } from '@/lib/proLaboreApi'
import { DetalheRec, ForcaChip } from '../../recomendacoes/DetalheRec'

function Selo({ passa }: { passa: boolean | null }) {
  if (passa == null) return <span className="pl-hint">sem casos ainda</span>
  return <span className={`pl-chip-faixa ${passa ? 'pl-faixa-bom' : 'pl-faixa-critico'}`}>{passa ? 'Passa' : 'Não passa'}</span>
}

export function AceitePdf03() {
  const [a, setA] = useState<Aceite | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [aberta, setAberta] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  async function rodar() {
    setErro(null); setCarregando(true)
    try { setA(await recApi.aceite()) } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível rodar') } finally { setCarregando(false) }
  }
  const linha = (n: string, passa: boolean | null, txt: string) => <tr key={n}><td>{n}</td><td>{txt}</td><td><Selo passa={passa} /></td></tr>
  return (
    <section className="pl-card" id="aceite-pdf03" style={{ marginBottom: 20 }} data-aceite-pdf03>
      <div className="pl-card-head"><div>
        <div className="pl-card-title">Aceite do PDF 03 · Recomendações</div>
        <div className="pl-card-sub">Teste da seção 9 calculado na produção, e a amostra de 20 recomendações para o teste de utilidade.</div>
      </div>
        <button type="button" className="pl-btn" onClick={() => void rodar()} disabled={carregando} data-rodar-aceite-03>{carregando ? 'Calculando…' : a ? 'Rodar de novo' : 'Rodar o aceite'}</button>
      </div>
      {erro && <div className="pl-alert" role="alert">{erro}</div>}
      {a && (
        <div style={{ display: 'grid', gap: 14 }}>
          <p style={{ margin: 0 }}>{a.total} recomendações · {a.modo === 'SILENCIOSO' ? 'modo silencioso (só dono e supervisor)' : 'roteamento ligado'} · {a.porDetector.map(d => `${d.nome}: ${d.total}`).join(' · ')}</p>
          <table className="pl-table"><thead><tr><th>Item</th><th>Medido</th><th /></tr></thead>
            <tbody>
              {linha('Evidência correta', a.evidencia.passa, `${a.evidencia.itens.filter(x => x.bate).length} de ${a.evidencia.itens.filter(x => x.bate != null).length} RECs abertas batem com o dicionário`)}
              {linha('Utilidade', a.utilidade.passa, a.utilidade.avaliacoes ? `${a.utilidade.pertinentes} de ${a.utilidade.avaliacoes} avaliações pertinentes (${a.utilidade.pct}%; precisa de 80%)` : 'avalie a amostra abaixo')}
              {linha('Volume mínimo', a.volumeMinimo.passa, `${a.volumeMinimo.abaixo} REC abaixo do volume mínimo`)}
              {linha('Dados suspeitos', a.suspeitos.passa, `${a.suspeitos.comSuspeito} REC com registro suspeito na evidência`)}
              {linha('Força da evidência', a.forca.passa, a.forca.porForca.map(f => `${f.forca === 'COMPROVADA' ? 'comprovada' : f.forca === 'PADRAO' ? 'padrão observado' : 'hipótese'}: ${f.n}`).join(' · '))}
              {linha('Nível 1', a.nivel1.passa, `${a.nivel1.semPessoa} decidida sem pessoa · ${a.nivel1.atvAuto} atividade executada sozinha · detectores no nível 1: ${a.nivel1.niveis ? 'sim' : 'não'}`)}
              {linha('Roteamento', a.roteamento.passa, `${a.roteamento.porTipo.map(t => `${t.tipo.toLowerCase()}: ${t.n}`).join(' · ')} · achado sobre pessoa visível a colega: ${a.roteamento.vazou}`)}
              {linha('Escalonamento', a.escalonamento.passa, `${a.escalonamento.escalonadas} orientações subiram ao supervisor · ${a.escalonamento.tratarVencidas} vencidas há mais de 24 h`)}
              {linha('Descarte', a.descarte.passa, `${a.descarte.descartadas} descartadas · ${a.descarte.repeticoesEvitadas} repetições evitadas · ${a.descarte.voltaram} voltaram no mesmo contexto`)}
              {linha('Ciclo e atividades', a.ciclo.passa, `${a.ciclo.aceitas} aceitas, ${a.ciclo.comAtividades} com atividades · ${a.ciclo.encerradas} encerradas`)}
              {linha('Avaliação do resultado', a.avaliacao.passa, `${a.avaliacao.avaliadas} avaliadas com indicador antes e depois`)}
              {linha('Sem duplicidade', a.duplicidade.passa, `${a.duplicidade.juntadas} achados juntados a correções da qualidade`)}
              {linha('Auditoria', a.auditoria.passa, `${a.auditoria.semEvento} REC sem evento de criação`)}
            </tbody></table>
          <div data-amostra>
            <div className="pl-eyebrow">Amostra para o teste de utilidade ({a.utilidade.amostra.length})</div>
            <p className="pl-hint" style={{ margin: '0 0 6px' }}>Abra cada uma e marque “pertinente” ou “não pertinente”. O supervisor faz o mesmo em Análise › Recomendações.</p>
            <table className="pl-table"><thead><tr><th>REC</th><th>O que foi achado</th><th>Força</th><th>Avaliações</th></tr></thead>
              <tbody>{a.utilidade.amostra.map(r => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setAberta(r.id)} data-amostra-rec={r.id}><td>{r.codigo}</td><td>{r.titulo}</td><td><ForcaChip forca={r.forca} /></td><td>{r.avaliacoes ? `${r.pertinentes} de ${r.avaliacoes} pertinentes` : '—'}</td></tr>
              ))}</tbody></table>
          </div>
          <p className="pl-hint" style={{ margin: 0 }}>Sistema atual: confira usando as telas de sempre durante a semana.</p>
        </div>
      )}
      {aberta && <DetalheRec id={aberta} onFechar={() => setAberta(null)} onMudou={() => void rodar()} avaliarPertinencia />}
    </section>
  )
}
