'use client'

// Assistente da aba (seção 16, protótipo Assistente.html): componente único,
// parametrizado pela aba. Avatar "A", rótulo, a frase do momento, Recolher /
// Abrir (estado salvo por pessoa e por aba) e as 3 sugestões do motor de
// insights. Ação executada: o cartão fica verde com "Feito · desfazer em 5s".
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { proLaboreApi, type SmAbaAssistente, type SmAssistente, type SmTipoInsight } from '@/lib/proLaboreApi'
import { Chip, type Tom } from './componentes'
import { useToast } from './Toast'

const TOM: Record<SmTipoInsight, Tom> = { URGENTE: 'bad', ATENCAO: 'warn', OPORTUNIDADE: 'info', PONTO_FORTE: 'ok', APRENDIZADO: 'learn', OBSERVACAO: 'neutro' }
const CONFIANCA = { alta: 'Confiança alta', media: 'Confiança média', baixa: 'Confiança baixa', hipotese: 'Hipótese' } as const
const DESFAZER_MS = 5000

function textoConfianca(c: SmAssistente['sugestoes'][number]): string {
  return c.confianca === 'hipotese'
    ? `Hipótese · confiança baixa${c.amostraTexto ? ` (${c.amostraTexto})` : ''}`
    : `${CONFIANCA[c.confianca]}${c.amostraTexto ? ` · ${c.amostraTexto}` : ''}`
}

export function AssistenteAba({ aba, aoMudar }: { aba: SmAbaAssistente; aoMudar?: () => void }) {
  const toast = useToast()
  const router = useRouter()
  const [dados, setDados] = useState<SmAssistente | null>(null)
  const [recolhido, setRecolhido] = useState(false)
  const [feitos, setFeitos] = useState<Record<string, { acaoId?: string; mensagem: string }>>({})
  const [ocupado, setOcupado] = useState<string | null>(null)
  const timers = useRef<number[]>([])

  const carregar = useCallback(() => {
    proLaboreApi.sm.assistente.ver(aba)
      .then(d => { setDados(d); setRecolhido(d.recolhido) })
      .catch(() => setDados(null))
  }, [aba])
  useEffect(() => { carregar() }, [carregar])
  useEffect(() => () => { timers.current.forEach(t => window.clearTimeout(t)) }, [])

  if (!dados) return null

  function alternar() {
    const novo = !recolhido
    setRecolhido(novo)
    proLaboreApi.sm.assistente.recolher(aba, novo).catch(() => undefined)
  }

  async function agir(chave: string) {
    setOcupado(chave)
    try {
      const r = await proLaboreApi.sm.assistente.executar(aba, chave)
      if (r.href) { router.push(r.href); return }
      setFeitos(f => ({ ...f, [chave]: { acaoId: r.desfazivel ? r.acaoId : undefined, mensagem: r.mensagem } }))
      aoMudar?.()
      // Passado o tempo de desfazer, a sugestão sai e entra a próxima.
      timers.current.push(window.setTimeout(() => { setFeitos(f => { const n = { ...f }; delete n[chave]; return n }); carregar() }, DESFAZER_MS))
    } catch (e) {
      toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível fazer agora', tom: 'bad' })
      carregar()
    } finally { setOcupado(null) }
  }

  async function desfazer(chave: string) {
    const f = feitos[chave]
    if (!f?.acaoId) return
    try {
      await proLaboreApi.sm.assistente.desfazer(f.acaoId)
      setFeitos(x => { const n = { ...x }; delete n[chave]; return n })
      toast({ mensagem: 'Desfeito.' })
      aoMudar?.()
      carregar()
    } catch (e) { toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível desfazer', tom: 'bad' }) }
  }

  const aberto = !recolhido
  return (
    <section className={`sm-assist${aberto ? '' : ' recolhido'}`} aria-label="Assistente">
      <div className="sm-assist-cab">
        <div className="sm-assist-avatar" aria-hidden="true">A</div>
        <div className="sm-assist-texto">
          <span className="sm-mono">{dados.rotulo}</span>
          <span className="sm-assist-frase">{dados.frase}</span>
        </div>
        <button type="button" className="sm-assist-alternar" aria-expanded={aberto} onClick={alternar}>{aberto ? 'Recolher' : 'Abrir'}</button>
      </div>
      {aberto && (
        dados.sugestoes.length === 0
          ? <p className="sm-legenda" style={{ margin: 0 }}>Nada pendente por aqui. As sugestões aparecem quando os dados pedirem.</p>
          : (
            <div className="sm-assist-grade">
              {dados.sugestoes.map(s => {
                const feito = feitos[s.chave]
                return (
                  <div key={s.chave} className={`sm-assist-card${feito ? ' feito' : ''}`}>
                    <Chip tom={TOM[s.tipo]}>{s.rotulo}</Chip>
                    <span className="sm-assist-card-texto">{feito ? feito.mensagem : s.texto}</span>
                    {!feito && <span className="sm-assist-conf">{textoConfianca(s)}</span>}
                    {feito
                      ? (
                        <span className="sm-assist-feito" role="status">
                          Feito{feito.acaoId ? ' · desfazer em 5s' : ''}
                          {feito.acaoId && <button type="button" className="sm-link-botao" onClick={() => desfazer(s.chave)}>Desfazer</button>}
                        </span>
                      )
                      : s.acao && !dados.somenteLeitura && (
                        <button type="button" className="sm-assist-acao" disabled={ocupado === s.chave} onClick={() => agir(s.chave)}>
                          {ocupado === s.chave ? 'Fazendo…' : s.acao.rotulo}
                        </button>
                      )}
                  </div>
                )
              })}
            </div>
          )
      )}
    </section>
  )
}
