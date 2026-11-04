'use client'

// Restaurar uma cópia de segurança. Só funciona no ambiente de teste (ou na
// produção com PERMITIR_RESTAURACAO=1, para voltar atrás). Não pede login,
// porque o banco do teste começa vazio: pede a chave de restauração
// cadastrada na Vercel e o link temporário gerado na produção.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { proLaboreApi, type CopiaSeguranca } from '@/lib/proLaboreApi'

const num = (n: number) => n.toLocaleString('pt-BR')

export default function RestaurarCopiaPage() {
  const [amb, setAmb] = useState<{ ambiente: string; restauracaoPermitida: boolean } | null>(null)
  const [link, setLink] = useState('')
  const [chave, setChave] = useState('')
  const [autor, setAutor] = useState('')
  const [estado, setEstado] = useState<CopiaSeguranca | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => { proLaboreApi.sistema.ambiente().then(setAmb).catch(() => setAmb({ ambiente: '?', restauracaoPermitida: false })) }, [])

  async function restaurar(e: React.FormEvent) {
    e.preventDefault()
    const producao = amb?.ambiente !== 'teste'
    if (!window.confirm(producao
      ? 'ATENÇÃO: isto é a PRODUÇÃO. Restaurar apaga os dados atuais e põe os da cópia no lugar. Continuar?'
      : 'Restaurar apaga os dados do ambiente de teste e põe os da cópia no lugar. Continuar?')) return
    setOcupado(true); setErro(null); setEstado(null)
    try {
      const { id, sessao } = await proLaboreApi.sistema.copias.restaurar(link.trim(), chave, autor.trim())
      let c: CopiaSeguranca | null = null, falhas = 0
      for (let i = 0; i < 500; i++) {
        try { c = await proLaboreApi.sistema.copias.rodadaRestauracao(id, sessao); setEstado(c); falhas = 0 } catch (err) {
          if (++falhas >= 4) throw err
          await new Promise(r => setTimeout(r, 3000 * falhas))
          continue
        }
        if (c.status !== 'EM_ANDAMENTO') break
      }
    } catch (err) { setErro(err instanceof Error ? err.message : 'A restauração parou') }
    finally { setOcupado(false) }
  }

  const divergentes = estado?.conferencia?.filter(t => t.esperadas !== t.restauradas) ?? []
  return (
    <main style={{ maxWidth: 760, margin: '40px auto', padding: '0 16px' }}>
      <section className="pl-card" data-restaurar>
        <div className="pl-card-title">Restaurar cópia de segurança</div>
        {!amb ? <p className="pl-hint">Carregando…</p> : !amb.restauracaoPermitida ? (
          <div className="pl-alert" role="alert">A restauração está desligada aqui. Ela só funciona no ambiente de teste (variável AMBIENTE=teste) ou na produção com PERMITIR_RESTAURACAO=1, para voltar atrás numa emergência.</div>
        ) : (
          <>
            <p className="pl-card-sub">{amb.ambiente === 'teste' ? 'Ambiente de teste: os dados daqui são apagados e substituídos pela cópia. Nada daqui envia mensagem a clientes, à Meta ou à IA.' : 'PRODUÇÃO com restauração liberada: use só para voltar atrás. Depois, tire PERMITIR_RESTAURACAO da Vercel.'}</p>
            <form onSubmit={restaurar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="pl-field"><label htmlFor="r-link">Link da cópia</label><input id="r-link" className="pl-input" value={link} onChange={e => setLink(e.target.value)} placeholder="Gerado em Configurações → Cópia de segurança, na produção" required /></div>
              <div className="pl-field"><label htmlFor="r-chave">Chave de restauração</label><input id="r-chave" type="password" className="pl-input" value={chave} onChange={e => setChave(e.target.value)} placeholder="A CHAVE_RESTAURACAO cadastrada na Vercel" required autoComplete="off" /></div>
              <div className="pl-field"><label htmlFor="r-autor">Seu nome</label><input id="r-autor" className="pl-input" value={autor} onChange={e => setAutor(e.target.value)} maxLength={80} /></div>
              <div><button type="submit" className="pl-btn pl-btn-primary" disabled={ocupado} data-botao-restaurar>{ocupado ? 'Restaurando…' : 'Restaurar'}</button></div>
            </form>
          </>
        )}
        {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 12 }} role="alert">{erro}</div>}
        {estado && (
          <div style={{ marginTop: 14 }} data-resultado-restauracao>
            <p>{estado.status === 'CONCLUIDA' ? <b>Restauração concluída.</b> : <>Restaurando: passo {num(estado.passosFeitos ?? 0)} de {num(estado.passos ?? 0)}…</>} {num(estado.linhas)} registros{estado.falhas ? <>, <b>{num(estado.falhas)} não entraram</b></> : ''}.</p>
            {estado.origem && <p className="pl-hint">Cópia de {new Date(estado.origem.geradaEm).toLocaleString('pt-BR')} · versão do banco da cópia: {estado.origem.migracao ?? '—'} · daqui: {estado.origem.migracaoDestino ?? '—'}</p>}
            {estado.conferencia && (divergentes.length === 0
              ? <div className="pl-alert pl-alert-success" data-conferencia-ok>Conferência: as {num(estado.conferencia.length)} tabelas têm o mesmo número de registros da cópia.</div>
              : <div className="pl-alert pl-alert-error" data-conferencia-divergente>Conferência: {divergentes.length} tabela(s) com número diferente: {divergentes.slice(0, 8).map(t => `${t.tabela} (${t.restauradas} de ${t.esperadas})`).join(', ')}</div>)}
            {estado.ultimasFalhas && estado.ultimasFalhas.length > 0 && <details><summary className="pl-hint">Ver o que não entrou</summary><ul className="pl-hint">{estado.ultimasFalhas.map((f, i) => <li key={i}>{f.tabela}: {f.erro}</li>)}</ul></details>}
            {estado.status === 'CONCLUIDA' && <p><Link href="/pro-labore/login">Entrar no sistema</Link> (com os mesmos e-mails e senhas da produção).</p>}
          </div>
        )}
      </section>
    </main>
  )
}
