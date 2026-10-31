'use client'

// Histórico do banco antigo (Neon): primeiro a simulação (o que entra, o que
// já existe, o que casa com um registro já cadastrado e as vendas que parecem
// repetidas); só depois de conferir, a importação, em rodadas até concluir.
import { useEffect, useState } from 'react'
import { proLaboreApi, type ImportacaoNeon as Estado } from '@/lib/proLaboreApi'

const data = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—')
const num = (n: number) => n.toLocaleString('pt-BR')

export function ImportacaoNeon() {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<'simular' | 'importar' | null>(null)
  const [conferido, setConferido] = useState(false)
  const [todas, setTodas] = useState(false)

  useEffect(() => { proLaboreApi.sistema.importacaoNeon.ver().then(setEstado).catch(() => setEstado(null)) }, [])

  async function simular() {
    setOcupado('simular'); setErro(null); setConferido(false)
    try { setEstado(await proLaboreApi.sistema.importacaoNeon.simular()) }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível ler o banco antigo') }
    finally { setOcupado(null) }
  }

  async function importar() {
    setOcupado('importar'); setErro(null)
    try {
      // Cada chamada tem tempo limitado: continua sozinho até concluir.
      for (let i = 0; i < 300; i++) {
        const r = await proLaboreApi.sistema.importacaoNeon.importar()
        setEstado(r)
        if (r.status === 'CONCLUIDA') break
      }
    } catch (e) { setErro(e instanceof Error ? `${e.message}. Toque em "Continuar" para seguir de onde parou.` : 'A importação parou. Toque em "Continuar".') }
    finally { setOcupado(null) }
  }

  if (!estado) return null
  const r = estado.relatorio
  const p = estado.progresso
  const tabelas = r ? [...r.tabelas].sort((a, b) => Number(!!b.rotulo) - Number(!!a.rotulo) || b.total - a.total) : []
  const visiveis = todas ? tabelas : tabelas.filter(t => t.rotulo || t.novos > 0).slice(0, 12)

  return (
    <section className="pl-card" style={{ marginBottom: 20 }} data-importacao-neon>
      <div className="pl-card-head">
        <div>
          <div className="pl-card-title">Histórico do banco antigo</div>
          <div className="pl-card-sub">Traz para cá os registros da sua conta que ficaram no banco anterior (Neon). O banco antigo só é lido: nada lá é apagado ou alterado.</div>
        </div>
      </div>

      {!estado.configurado ? (
        <div className="pl-alert" data-neon-sem-config>
          Para começar, cadastre na Vercel (projeto da API) a variável <b>NEON_DATABASE_URL</b> com a conexão do banco antigo, copiada do painel do Neon, e faça um novo deploy. Não envie essa conexão por mensagem.
        </div>
      ) : (
        <>
          <p className="pl-hint" style={{ marginTop: 0 }}>
            1. Simule e confira o relatório. 2. Importe: os registros que já existem aqui ou que são o mesmo cadastro (a mesma vendedora, o mesmo telefone de lead) não são duplicados. Pode rodar de novo sem duplicar.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="pl-btn pl-btn-ghost" onClick={simular} disabled={!!ocupado || estado.status === 'IMPORTANDO'} data-simular-neon>
              {ocupado === 'simular' ? 'Lendo o banco antigo…' : r ? 'Simular de novo' : 'Simular importação'}
            </button>
            {estado.simuladoEm && <span className="pl-hint">Simulado em {new Date(estado.simuladoEm).toLocaleString('pt-BR')}</span>}
          </div>
        </>
      )}

      {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 14 }} role="alert">{erro}</div>}

      {r && (
        <div style={{ marginTop: 16 }} data-relatorio-neon>
          <div className="pl-alert" style={{ marginBottom: 12 }}>
            <b>{num(r.total)} registros novos</b> para importar.
            {r.vendasNoAtualDesde && <> As vendas lançadas aqui começam em {data(r.vendasNoAtualDesde)}.</>}
            {r.vendasRepetidas > 0 && <> <b>{r.vendasRepetidas} venda{r.vendasRepetidas > 1 ? 's' : ''} do banco antigo têm o mesmo dia e valor de uma venda já lançada aqui</b> (podem ser a mesma venda lançada duas vezes: confira em Vendas depois).</>}
          </div>
          <div className="pl-table-wrap">
            <table className="pl-table">
              <thead><tr><th>O quê</th><th style={{ textAlign: 'right' }}>No banco antigo</th><th style={{ textAlign: 'right' }}>Já existem aqui</th><th style={{ textAlign: 'right' }}>Mesmo cadastro</th><th style={{ textAlign: 'right' }}>Novos</th><th>Período</th></tr></thead>
              <tbody>
                {visiveis.map(t => (
                  <tr key={t.tabela} data-tabela-neon={t.tabela}>
                    <td>{t.rotulo ?? <span className="pl-hint">{t.tabela.replace(/^pro_labore_/, '').replace(/_/g, ' ')}</span>}</td>
                    <td style={{ textAlign: 'right' }}>{num(t.total)}</td>
                    <td style={{ textAlign: 'right' }}>{num(t.jaExistem)}</td>
                    <td style={{ textAlign: 'right' }}>{num(t.casados)}</td>
                    <td style={{ textAlign: 'right' }}><b>{num(t.novos)}</b></td>
                    <td>{t.de ? `${data(t.de)} a ${data(t.ate)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tabelas.length > visiveis.length && <button type="button" className="pl-btn pl-btn-ghost" style={{ marginTop: 8 }} onClick={() => setTodas(true)}>Ver todas as {tabelas.length} tabelas</button>}

          {estado.status !== 'CONCLUIDA' && r.total > 0 && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {estado.status === 'SIMULADO' && (
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                  <input type="checkbox" checked={conferido} onChange={e => setConferido(e.target.checked)} data-conferido-neon />
                  Conferi o relatório e quero importar
                </label>
              )}
              <div>
                <button type="button" className="pl-btn pl-btn-primary" onClick={importar} disabled={!!ocupado || (estado.status === 'SIMULADO' && !conferido)} data-importar-neon>
                  {ocupado === 'importar' ? 'Importando…' : estado.status === 'IMPORTANDO' ? 'Continuar a importação' : 'Importar'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {p && estado.status !== 'SIMULADO' && (
        <div style={{ marginTop: 16 }} data-progresso-neon>
          <div style={{ height: 8, borderRadius: 4, background: 'var(--pl-border)', overflow: 'hidden' }} role="progressbar" aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.feitos} aria-label="Andamento da importação">
            <span style={{ display: 'block', height: 8, borderRadius: 4, background: 'var(--pl-ink-1)', width: `${p.total ? Math.round((p.feitos / p.total) * 100) : 100}%` }} />
          </div>
          <p className="pl-hint" style={{ marginTop: 8 }}>
            {estado.status === 'CONCLUIDA' ? <><b>Importação concluída</b>{estado.concluidoEm ? ` em ${new Date(estado.concluidoEm).toLocaleString('pt-BR')}` : ''}: </> : <>{num(p.feitos)} de {num(p.total)} lidos: </>}
            {num(p.inseridos)} importados, {num(p.casados)} ligados a um cadastro que já existia, {num(p.existentes)} já existiam{p.falhas ? <>, <b>{num(p.falhas)} não entraram</b></> : ''}.
          </p>
          {p.ultimasFalhas.length > 0 && (
            <details>
              <summary className="pl-hint">Ver os que não entraram</summary>
              <ul className="pl-hint">{p.ultimasFalhas.map(f => <li key={f.tabela + f.id}>{f.tabela} · {f.id}: {f.erro}</li>)}</ul>
            </details>
          )}
        </div>
      )}
    </section>
  )
}
