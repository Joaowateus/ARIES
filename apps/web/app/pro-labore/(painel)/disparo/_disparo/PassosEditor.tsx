'use client'

// Editor da sequência de mensagens: texto, imagem, áudio, vídeo ou documento (da biblioteca), a
// espera antes de cada passo e as variáveis do CRM ({{nome}}, {{cidade}}…) inseridas onde o cursor está.
import { useRef } from 'react'
import type { ConteudoDisparo, MidiaDisparo, PassoDisparo, TipoPassoDisparo } from '@/lib/proLaboreApi'
import { useMeta } from './util'
import { EscolherMidia } from './Midias'

const TIPOS: Array<{ valor: TipoPassoDisparo; rotulo: string }> = [
  { valor: 'TEXTO', rotulo: 'Texto' }, { valor: 'IMAGEM', rotulo: 'Imagem' }, { valor: 'AUDIO', rotulo: 'Áudio' }, { valor: 'VIDEO', rotulo: 'Vídeo' }, { valor: 'DOCUMENTO', rotulo: 'Documento/PDF' },
]

function Passo({ p, i, total, midias, mudar, tirar, subir, recarregarMidias }: { p: PassoDisparo; i: number; total: number; midias: MidiaDisparo[]; mudar: (p: PassoDisparo) => void; tirar: () => void; subir: () => void; recarregarMidias?: () => Promise<MidiaDisparo[]> | void }) {
  const meta = useMeta()
  const ref = useRef<HTMLTextAreaElement>(null)
  const inserir = (chave: string) => {
    const el = ref.current
    const t = p.texto ?? ''
    const ini = el?.selectionStart ?? t.length, fim = el?.selectionEnd ?? t.length
    const novo = `${t.slice(0, ini)}{{${chave}}}${t.slice(fim)}`
    mudar({ ...p, texto: novo })
    requestAnimationFrame(() => { el?.focus(); const pos = ini + chave.length + 4; el?.setSelectionRange(pos, pos) })
  }
    const cap = meta.capacidades
  const suportado = p.tipo === 'TEXTO' || (p.tipo === 'IMAGEM' && cap.imagem) || (p.tipo === 'AUDIO' && cap.audio) || (p.tipo === 'VIDEO' && cap.video) || (p.tipo === 'DOCUMENTO' && cap.documento)
  return (
    <div className="dp-passo" data-passo={i}>
      <div className="dp-linha" style={{ justifyContent: 'space-between' }}>
        <b>Mensagem {i + 1}</b>
        <span className="cc-chips">
          {i > 0 && <button type="button" className="pl-btn" onClick={subir}>Subir</button>}
          {total > 1 && <button type="button" className="pl-btn" onClick={tirar}>Tirar</button>}
        </span>
      </div>
      {i > 0 && (
        <div className="dp-linha"><span className="pl-hint">Enviar</span>
          <input className="pl-input dp-curto" type="number" min={0} value={Math.round((p.esperarMin ?? 0) / 60 * 10) / 10} onChange={e => mudar({ ...p, esperarMin: Math.max(0, Math.round(Number(e.target.value) * 60)) })} aria-label="Horas depois da anterior" />
          <span className="pl-hint">hora(s) depois da mensagem anterior (se a pessoa não tiver respondido)</span>
        </div>
      )}
      <div className="cc-chips">{TIPOS.map(t => <button key={t.valor} type="button" className={`pl-chip ${p.tipo === t.valor ? 'active' : ''}`} onClick={() => mudar({ ...p, tipo: t.valor, midiaId: t.valor === 'TEXTO' ? null : p.midiaId })}>{t.rotulo}</button>)}</div>
      {!suportado && <p className="pl-alert pl-alert-error">O provedor conectado não envia este tipo.</p>}
      {p.tipo !== 'TEXTO' && <EscolherMidia tipo={p.tipo} midias={midias} valor={p.midiaId} mudar={id => mudar({ ...p, midiaId: id })} recarregar={recarregarMidias} />}
      {p.tipo !== 'AUDIO' && (
        <>
          <textarea ref={ref} className="pl-input" rows={4} maxLength={4000} value={p.texto ?? ''} onChange={e => mudar({ ...p, texto: e.target.value })} placeholder={p.tipo === 'TEXTO' ? 'Escreva a mensagem. Use as variáveis para personalizar.' : 'Legenda (opcional)'} aria-label={`Texto da mensagem ${i + 1}`} style={{ marginTop: 6 }} />
          <div className="cc-chips" style={{ marginTop: 4 }}>
            {meta.variaveis.map(v => <button key={v.chave} type="button" className="pl-chip" title={`Ex.: ${v.exemplo}`} onClick={() => inserir(v.chave)}>{`{{${v.chave}}}`}</button>)}
          </div>
        </>
      )}
    </div>
  )
}

export function PassosEditor({ conteudo, mudar, midias, recarregarMidias }: { conteudo: ConteudoDisparo; mudar: (c: ConteudoDisparo) => void; midias: MidiaDisparo[]; recarregarMidias?: () => Promise<MidiaDisparo[]> | void }) {
  const passos = conteudo.passos
  const setPasso = (i: number, p: PassoDisparo) => mudar({ ...conteudo, passos: passos.map((x, j) => (j === i ? p : x)) })
  return (
    <div className="dp-passos">
      {passos.map((p, i) => (
        <Passo key={i} p={p} i={i} total={passos.length} midias={midias} recarregarMidias={recarregarMidias} mudar={x => setPasso(i, x)}
          tirar={() => mudar({ ...conteudo, passos: passos.filter((_, j) => j !== i) })}
          subir={() => { const l = [...passos]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; mudar({ ...conteudo, passos: l }) }} />
      ))}
      {passos.length < 10 && <button type="button" className="pl-btn" onClick={() => mudar({ ...conteudo, passos: [...passos, { tipo: 'TEXTO', texto: '', esperarMin: 24 * 60 }] })}>+ Mensagem na sequência</button>}
    </div>
  )
}
