'use client'

// Espaço do banco (plano gratuito: 500 MB; ao passar, o banco fica só de
// leitura). Mostra o que mais ocupa e libera o que dá sem perder nada: apaga
// os eventos brutos do Instagram já processados e leva fotos e áudios para o
// armazenamento de arquivos (Vercel Blob). Cada ação roda em rodadas até acabar.
import { useEffect, useState } from 'react'
import { proLaboreApi, type EspacoBanco as Espaco } from '@/lib/proLaboreApi'

type Acao = 'eventos' | 'imagens' | 'midias' | 'compactar' | 'vercel'
const ACOES: Array<{ acao: Exclude<Acao, 'compactar' | 'vercel'>; titulo: string; texto: string; botao: string; precisaBlob: boolean }> = [
  { acao: 'eventos', titulo: 'Eventos brutos do Instagram', texto: 'Cópias dos avisos que o Instagram manda (comentários, mensagens). O conteúdo já foi para as telas do Social Media; os processados há mais de 7 dias podem sair. A partir de agora, saem sozinhos depois de 15 dias.', botao: 'Apagar eventos antigos', precisaBlob: false },
  { acao: 'imagens', titulo: 'Fotos e imagens dentro do banco', texto: 'Fotos das pautas, do estoque e miniaturas dos posts. Vão para o armazenamento de arquivos e continuam abrindo igual. As novas já vão direto para lá.', botao: 'Mover para o armazenamento', precisaBlob: true },
  { acao: 'midias', titulo: 'Áudios e fotos das conversas', texto: 'Mídias das conversas do WhatsApp guardadas no banco. Vão para o armazenamento de arquivos e continuam tocando igual.', botao: 'Mover para o armazenamento', precisaBlob: true },
]
const num = (n: number) => n.toLocaleString('pt-BR')

export function EspacoBanco() {
  const [dados, setDados] = useState<Espaco | null>(null)
  const [ocupado, setOcupado] = useState<Acao | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  useEffect(() => { proLaboreApi.sistema.espaco().then(setDados).catch(() => setDados(null)) }, [])

  async function liberar(acao: Acao) {
    setOcupado(acao); setErro(null); setOk(null)
    const antes = dados?.usadoMB ?? 0
    let total = 0, falhas = 0
    try {
      for (let i = 0; i < 400; i++) {
        try {
          const r = await proLaboreApi.sistema.liberarEspaco(acao)
          setDados(r); falhas = 0; total += r.rodada.feitos
          if (!r.rodada.restantes) { setOk(acao === 'vercel' ? `Pronto: ${num(total)} arquivos levados da Vercel para o Supabase.` : acao === 'compactar' ? `Pronto: tabelas compactadas. O banco foi de ${num(antes)} MB para ${num(r.usadoMB)} MB.` : `Pronto: ${num(total)} ${acao === 'eventos' ? 'eventos apagados' : 'arquivos movidos'}. O banco foi de ${num(antes)} MB para ${num(r.usadoMB)} MB.`); break }
        } catch (e) {
          if (++falhas >= 4) throw e
          await new Promise(res => setTimeout(res, 3000 * falhas))
        }
      }
    } catch (e) {
      setErro(`${e instanceof Error ? e.message : 'Não deu para concluir'}. O que já foi feito ficou; toque de novo para continuar.`)
      proLaboreApi.sistema.espaco().then(setDados).catch(() => {})
    } finally { setOcupado(null) }
  }

  if (!dados) return null
  const pct = Math.min(100, Math.round((dados.usadoMB / dados.limiteMB) * 100))
  return (
    <section className="pl-card" id="espaco" style={{ marginBottom: 20 }} data-espaco-banco>
      <div className="pl-card-head">
        <div>
          <div className="pl-card-title">Espaço do banco de dados</div>
          <div className="pl-card-sub">No plano gratuito o limite é {num(dados.limiteMB)} MB. Ao passar, o banco fica só para leitura e o sistema não salva nada novo.</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <b style={{ fontSize: 22 }} data-usado-mb>{num(dados.usadoMB)} MB</b><span className="pl-hint">de {num(dados.limiteMB)} MB ({pct}%)</span>
      </div>
      <div role="progressbar" aria-label="Espaço usado" aria-valuemin={0} aria-valuemax={dados.limiteMB} aria-valuenow={dados.usadoMB} style={{ height: 8, borderRadius: 4, background: 'var(--pl-border)', overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: pct >= 90 ? 'var(--pl-danger, #d33)' : 'var(--pl-ink-1)' }} />
      </div>

      <h3 style={{ margin: '18px 0 8px', fontSize: 14 }}>O que dá para liberar sem perder nada</h3>
      {!dados.supabaseConfigurado && (dados.liberar.imagens.quantidade > 0 || dados.liberar.midias.quantidade > 0 || dados.naVercel.quantidade > 0) && (
        <div className="pl-alert" style={{ marginBottom: 10 }} data-sem-blob>
          Para mover fotos e áudios, ligue o armazenamento do <b>Supabase</b> (1 GB grátis, fora dos 500 MB do banco): na Vercel, projeto <b>ariessistemacomercial</b> → Settings → Environment Variables, crie <b>SUPABASE_URL</b> (o Project URL do Supabase) e <b>SUPABASE_SERVICE_ROLE_KEY</b> (a chave secreta do Supabase), marcadas para Production. Depois faça um Redeploy da Produção e volte aqui.
        </div>
      )}
      {dados.naVercel.quantidade > 0 && (
        <div className="pl-card" style={{ padding: 14, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }} data-liberar="vercel">
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <b>Arquivos guardados na Vercel</b>
            <div className="pl-hint" style={{ marginTop: 4 }}>Fotos e áudios que foram para o armazenamento da Vercel, que suspende no plano gratuito. Leve para o Supabase para eles não ficarem presos lá.{!dados.supabaseConfigurado && ' Primeiro configure o Supabase (acima).'}</div>
          </div>
          <div style={{ textAlign: 'right', minWidth: 120 }}><b>~{num(dados.naVercel.mb)} MB</b><div className="pl-hint">{num(dados.naVercel.quantidade)} arquivos</div></div>
          <button type="button" className="pl-btn pl-btn-primary" disabled={!!ocupado || !dados.supabaseConfigurado} onClick={() => liberar('vercel')} data-botao-liberar="vercel">{ocupado === 'vercel' ? 'Levando…' : 'Levar para o Supabase'}</button>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ACOES.map(a => {
          const l = dados.liberar[a.acao]
          const bloqueado = a.precisaBlob && !dados.blobConfigurado
          return (
            <div key={a.acao} className="pl-card" style={{ padding: 14, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }} data-liberar={a.acao}>
              <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                <b>{a.titulo}</b>
                <div className="pl-hint" style={{ marginTop: 4 }}>{a.texto}</div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 120 }}>
                <b>{l.quantidade ? `~${num(l.mb)} MB` : 'Nada a liberar'}</b>
                {l.quantidade > 0 && <div className="pl-hint">{num(l.quantidade)} {a.acao === 'eventos' ? 'eventos' : 'arquivos'}</div>}
              </div>
              <button type="button" className="pl-btn pl-btn-primary" disabled={!!ocupado || !l.quantidade || bloqueado} onClick={() => liberar(a.acao)} data-botao-liberar={a.acao}>
                {ocupado === a.acao ? 'Liberando…' : a.botao}
              </button>
            </div>
          )
        })}
      </div>
      <div className="pl-card" style={{ padding: 14, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }} data-liberar="compactar">
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <b>Compactar (devolver o espaço já liberado)</b>
          <div className="pl-hint" style={{ marginTop: 4 }}>Depois de tirar arquivos e eventos, o espaço continua reservado nas tabelas até elas serem compactadas. Leva alguns segundos e não apaga nada.</div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 120 }}><b>{num(dados.compactaveisMB)} MB</b><div className="pl-hint">nessas tabelas hoje</div></div>
        <button type="button" className="pl-btn pl-btn-primary" disabled={!!ocupado} onClick={() => liberar('compactar')} data-botao-liberar="compactar">{ocupado === 'compactar' ? 'Compactando…' : 'Compactar'}</button>
      </div>
      {ok && <div className="pl-alert pl-alert-success" style={{ marginTop: 12 }} role="status">{ok}</div>}
      {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 12 }} role="alert">{erro}</div>}

      <h3 style={{ margin: '18px 0 8px', fontSize: 14 }}>O que mais ocupa</h3>
      <div className="pl-table-wrap">
        <table className="pl-table" data-tabelas-espaco>
          <thead><tr><th>O quê</th><th style={{ textAlign: 'right' }}>Registros</th><th style={{ textAlign: 'right' }}>Tamanho</th></tr></thead>
          <tbody>
            {dados.tabelas.map(t => (
              <tr key={t.tabela}>
                <td>{t.rotulo ?? <span className="pl-hint">{t.tabela.replace(/^pro_labore_/, '').replace(/copiloto/g, 'aries').replace(/_/g, ' ')}</span>}</td>
                <td style={{ textAlign: 'right' }}>{t.linhas > 0 ? num(t.linhas) : '—'}</td>
                <td style={{ textAlign: 'right' }}>{num(t.mb)} MB</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
