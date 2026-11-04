'use client'

// Cópia de segurança do banco inteiro (só o dono): vai em rodadas para o
// armazenamento privado do Supabase, com a contagem de cada tabela. Antes de
// qualquer migração, faça uma. O link temporário serve para restaurar a cópia
// no ambiente de teste (vale 6 horas e não leva chave nenhuma da produção).
import { useEffect, useState } from 'react'
import { proLaboreApi, type CopiaSeguranca as Copia } from '@/lib/proLaboreApi'

const num = (n: number) => n.toLocaleString('pt-BR')
const mb = (b?: number) => `${((b ?? 0) / 1_048_576).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
const quando = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR') : '—')

export function CopiaSeguranca() {
  const [copias, setCopias] = useState<Copia[] | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [andamento, setAndamento] = useState<Copia | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [link, setLink] = useState<{ id: string; link: string; validoAte: string } | null>(null)
  const [detalhe, setDetalhe] = useState<{ id: string; tabelas: Array<{ nome: string; linhas: number }> } | null>(null)

  const carregar = () => proLaboreApi.sistema.copias.listar().then(setCopias).catch(() => setCopias([]))
  useEffect(() => { void carregar() }, [])

  async function fazer() {
    setOcupado(true); setErro(null); setLink(null)
    try {
      let c = await proLaboreApi.sistema.copias.iniciar()
      setAndamento(c)
      let falhas = 0
      for (let i = 0; i < 300 && c.status === 'EM_ANDAMENTO'; i++) {
        try { c = await proLaboreApi.sistema.copias.rodada(c.id); setAndamento(c); falhas = 0 } catch (e) {
          if (++falhas >= 4) throw e
          await new Promise(r => setTimeout(r, 3000 * falhas))
        }
      }
    } catch (e) { setErro(e instanceof Error ? e.message : 'A cópia parou') }
    finally { setOcupado(false); setAndamento(null); void carregar() }
  }

  async function gerarLink(id: string) {
    setErro(null)
    try { setLink({ id, ...(await proLaboreApi.sistema.copias.link(id)) }) } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível gerar o link') }
  }
  async function verTabelas(id: string) {
    if (detalhe?.id === id) { setDetalhe(null); return }
    try { const m = await proLaboreApi.sistema.copias.ver(id); setDetalhe({ id, tabelas: m.tabelas.filter(t => t.linhas > 0).sort((a, b) => b.linhas - a.linhas) }) } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível abrir') }
  }

  if (!copias) return null
  const exportacoes = copias.filter(c => c.tipo === 'EXPORTACAO')
  return (
    <section className="pl-card" id="copia" style={{ marginBottom: 20 }} data-copia-seguranca>
      <div className="pl-card-head">
        <div>
          <div className="pl-card-title">Cópia de segurança</div>
          <div className="pl-card-sub">Copia todas as tabelas do banco para o armazenamento privado, com a contagem de cada uma. Faça uma antes de qualquer mudança grande. A cópia não sai do sistema e não vai para o GitHub.</div>
        </div>
        <button type="button" className="pl-btn pl-btn-primary" disabled={ocupado} onClick={() => void fazer()} data-fazer-copia>{ocupado ? 'Copiando…' : 'Fazer cópia agora'}</button>
      </div>
      {andamento && <p className="pl-hint" role="status">Copiando: {num(andamento.tabelasFeitas ?? 0)} de {num(andamento.tabelas ?? 0)} tabelas, {num(andamento.linhas)} registros…</p>}
      {erro && <div className="pl-alert pl-alert-error" role="alert">{erro}</div>}
      {exportacoes.length === 0 ? <p className="pl-hint">Nenhuma cópia ainda. A primeira leva alguns minutos; pode deixar a tela aberta.</p> : (
        <div className="pl-table-wrap">
          <table className="pl-table" data-lista-copias>
            <thead><tr><th>Feita em</th><th>Por</th><th style={{ textAlign: 'right' }}>Registros</th><th style={{ textAlign: 'right' }}>Tamanho</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {exportacoes.map(c => (
                <tr key={c.id} data-copia={c.id}>
                  <td>{quando(c.concluidoEm ?? c.iniciadoEm)}</td>
                  <td>{c.autor ?? '—'}</td>
                  <td style={{ textAlign: 'right' }}>{num(c.linhas)}</td>
                  <td style={{ textAlign: 'right' }}>{mb(c.bytes)}</td>
                  <td>{c.status === 'CONCLUIDA' ? 'Concluída' : c.erro ? `Parou: ${c.erro}` : 'Em andamento'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {c.status === 'CONCLUIDA' && <>
                      <button type="button" className="pl-btn pl-btn-ghost" onClick={() => void verTabelas(c.id)}>{detalhe?.id === c.id ? 'Fechar' : 'Ver tabelas'}</button>{' '}
                      <button type="button" className="pl-btn pl-btn-ghost" onClick={() => void gerarLink(c.id)} data-gerar-link>Link para o ambiente de teste</button>
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {link && (
        <div className="pl-alert" style={{ marginTop: 12 }} data-link-copia>
          <b>Link da cópia (vale até {quando(link.validoAte)}).</b> Cole só na tela de restauração do ambiente de teste. Não envie por mensagem.
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input className="pl-input" readOnly value={link.link} onFocus={e => e.currentTarget.select()} aria-label="Link da cópia" />
            <button type="button" className="pl-btn pl-btn-ghost" onClick={() => { void navigator.clipboard?.writeText(link.link) }}>Copiar</button>
          </div>
        </div>
      )}
      {detalhe && (
        <div className="pl-table-wrap" style={{ marginTop: 12, maxHeight: 320, overflow: 'auto' }}>
          <table className="pl-table"><thead><tr><th>Tabela</th><th style={{ textAlign: 'right' }}>Registros</th></tr></thead>
            <tbody>{detalhe.tabelas.map(t => <tr key={t.nome}><td>{t.nome.replace(/^pro_labore_/, '').replace(/_/g, ' ')}</td><td style={{ textAlign: 'right' }}>{num(t.linhas)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  )
}
