'use client'

// "+ Nova pauta" e "Sugestões do estoque" (cabeçalho da Produção).
import { useState } from 'react'
import { proLaboreApi, type SmFormato, type SmMoto, type SmPauta, type SmPilar } from '@/lib/proLaboreApi'
import { Botao, Chip, EstadoVazio, FORMATO_ROTULO, Modal, PILAR_ROTULO, dataParaIso } from '../../_ui'

export function NovaPauta({ motos, inicial, aoCriar, aoFechar }: {
  motos: SmMoto[] | null
  inicial?: { agendadoPara?: string; origem?: 'CALENDARIO' }
  aoCriar: (p: SmPauta) => void
  aoFechar: () => void
}) {
  const [titulo, setTitulo] = useState('')
  const [pilar, setPilar] = useState<SmPilar>('ESTOQUE')
  const [formato, setFormato] = useState<SmFormato>('REELS')
  const [prazo, setPrazo] = useState('')
  const [motoId, setMotoId] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true); setErro(null)
    try {
      const p = await proLaboreApi.sm.pautas.criar({
        titulo, pilar, formato, prazo: dataParaIso(prazo), motoId: motoId || null,
        origem: inicial?.origem ?? 'MANUAL', agendadoPara: inicial?.agendadoPara ?? null,
      })
      aoCriar(p)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível criar')
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Nova pauta" aoFechar={aoFechar}>
      <form onSubmit={criar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label className="sm-campo">Título
          <input className="sm-input" value={titulo} onChange={e => setTitulo(e.target.value)} required minLength={3} maxLength={120} placeholder="Ex.: MT-03 em 15 segundos" />
        </label>
        <div className="sm-grade-2">
          <label className="sm-campo">Pilar
            <select className="sm-input" value={pilar} onChange={e => setPilar(e.target.value as SmPilar)}>
              {(Object.keys(PILAR_ROTULO) as SmPilar[]).map(p => <option key={p} value={p}>{PILAR_ROTULO[p]}</option>)}
            </select>
          </label>
          <label className="sm-campo">Formato
            <select className="sm-input" value={formato} onChange={e => setFormato(e.target.value as SmFormato)}>
              {(Object.keys(FORMATO_ROTULO) as SmFormato[]).map(f => <option key={f} value={f}>{FORMATO_ROTULO[f]}</option>)}
            </select>
          </label>
          <label className="sm-campo">Prazo da produção
            <input className="sm-input" type="date" value={prazo} onChange={e => setPrazo(e.target.value)} />
          </label>
          {motos && (
            <label className="sm-campo">Moto do estoque
              <select className="sm-input" value={motoId} onChange={e => setMotoId(e.target.value)}>
                <option value="">Nenhuma</option>
                {motos.filter(m => m.situacao !== 'VENDIDA').map(m => <option key={m.id} value={m.id}>{m.modelo}{m.ano ? ` ${m.ano}` : ''}</option>)}
              </select>
            </label>
          )}
        </div>
        {erro && <p className="sm-erro" role="alert">{erro}</p>}
        <div className="sm-linha-acoes" style={{ justifyContent: 'flex-end' }}>
          <Botao variante="fantasma" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" variante="pri" disabled={enviando}>{enviando ? 'Criando…' : 'Criar pauta'}</Botao>
        </div>
      </form>
    </Modal>
  )
}

const STATUS_MOTO = { PARADA: { texto: 'Parada', tom: 'bad' as const }, ATENCAO: { texto: 'Atenção', tom: 'warn' as const }, OK: { texto: 'Ok', tom: 'ok' as const } }

export function SugestoesEstoque({ sugestoes, podeEditar, aoGerar, aoFechar }: {
  sugestoes: SmMoto[]
  podeEditar: boolean
  aoGerar: (m: SmMoto) => Promise<void>
  aoFechar: () => void
}) {
  const [gerando, setGerando] = useState<string | null>(null)
  return (
    <Modal titulo="Sugestões do estoque" aoFechar={aoFechar}>
      <p className="sm-muted" style={{ margin: 0 }}>Motos há mais tempo na loja e sem conteúdo em produção. “Gerar pauta” cria a ideia com origem Estoque.</p>
      {sugestoes.length === 0
        ? <EstadoVazio titulo="Nenhuma moto parada sem conteúdo">Quando uma moto passar de 20 dias na loja sem pauta, ela aparece aqui.</EstadoVazio>
        : (
          <div className="sm-lista-sugestoes">
            {sugestoes.map(m => (
              <div key={m.id}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{m.modelo}{m.ano ? ` ${m.ano}` : ''}{m.cor ? ` · ${m.cor}` : ''}</div>
                  <div className="sm-legenda">{m.diasEmEstoque} dias em estoque · {m.posts === 0 ? 'nenhum post' : `${m.posts} ${m.posts === 1 ? 'post' : 'posts'}`}</div>
                </div>
                <Chip tom={STATUS_MOTO[m.status].tom}>{STATUS_MOTO[m.status].texto}</Chip>
                {podeEditar && (
                  <Botao disabled={!!gerando} onClick={async () => { setGerando(m.id); try { await aoGerar(m) } finally { setGerando(null) } }}>
                    {gerando === m.id ? 'Gerando…' : 'Gerar pauta'}
                  </Botao>
                )}
              </div>
            ))}
          </div>
        )}
    </Modal>
  )
}
