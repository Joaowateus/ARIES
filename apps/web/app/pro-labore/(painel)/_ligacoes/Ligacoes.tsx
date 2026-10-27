'use client'

// Peças das ligações usadas na aba Ligações, no painel do lead e no Meu dia:
// o botão "Ligar" (registra a discagem e abre o discador do aparelho) e a
// janela de registrar o resultado. Os textos dos alertas explicam para o
// dono o que não fecha em cada registro.
import { useState } from 'react'
import { proLaboreApi, type AlertaLigacao, type GatilhoCadencia, type Ligacao, type ResultadoLigacao } from '@/lib/proLaboreApi'

export const RESULTADO: Record<ResultadoLigacao, string> = {
  ATENDEU: 'Atendeu', NAO_ATENDEU: 'Não atendeu', CAIXA_POSTAL: 'Caixa postal', OCUPADO: 'Ocupado', NUMERO_ERRADO: 'Número errado', PEDIU_RETORNO: 'Pediu retorno',
}
export const ALERTA: Record<AlertaLigacao, { rotulo: string; explica: string }> = {
  SEM_DISCAR: { rotulo: 'Sem discar', explica: 'Registrada sem tocar em "Ligar" no sistema.' },
  DURACAO_INCOERENTE: { rotulo: 'Duração impossível', explica: 'A duração informada é maior que o tempo entre tocar em "Ligar" e registrar.' },
  REGISTRO_RAPIDO: { rotulo: 'Registro rápido', explica: 'Marcou "atendeu" menos de 20 segundos depois de tocar em "Ligar".' },
  FORA_DO_HORARIO: { rotulo: 'Fora do horário', explica: 'Discada antes das 7h ou depois das 21h.' },
  EM_SERIE: { rotulo: 'Em série', explica: 'Registrada menos de 45 segundos depois do registro anterior da mesma pessoa.' },
  ATRASADA: { rotulo: 'Atrasada', explica: 'Feita mais de 2 horas depois do horário marcado.' },
}
export const GATILHO: Record<GatilhoCadencia, string> = {
  LEAD_NOVO: 'Todo lead novo', LEAD_ANUNCIO: 'Lead de anúncio (tráfego pago)', LEAD_WHATSAPP: 'Lead que entrou pelo WhatsApp',
}

const H = 3600e3
const diaBR = (t: number) => new Date(t - 3 * H).toISOString().slice(0, 10)
export const horaBR = (iso: string) => new Date(new Date(iso).getTime() - 3 * H).toISOString().slice(11, 16)

/** "hoje 14:00", "amanhã 10:00", "qua 29/10 10:00", "atrasada há 2 h". */
export function quandoLigar(iso: string, agora = Date.now()): { texto: string; atrasada: boolean } {
  const t = new Date(iso).getTime()
  if (t < agora - 60e3) {
    const min = Math.round((agora - t) / 60e3)
    return { texto: `atrasada há ${min < 60 ? `${min} min` : min < 1440 ? `${Math.round(min / 60)} h` : `${Math.round(min / 1440)} d`}`, atrasada: true }
  }
  const d = diaBR(t), hoje = diaBR(agora), amanha = diaBR(agora + 24 * H)
  if (d === hoje) return { texto: `hoje ${horaBR(iso)}`, atrasada: false }
  if (d === amanha) return { texto: `amanhã ${horaBR(iso)}`, atrasada: false }
  const dt = new Date(t - 3 * H)
  return { texto: `${['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][dt.getUTCDay()]} ${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')} ${horaBR(iso)}`, atrasada: false }
}
export const duracao = (s: number | null) => (s ? `${Math.floor(s / 60)}min${s % 60 ? ` ${s % 60}s` : ''}` : '—')
export const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** "5591969730002" → "+55 91 96973-0002" (cadastro manual guarda o número cru). */
export function telefoneLegivel(t: string | null | undefined): string | null {
  const d = (t ?? '').replace(/\D/g, '')
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) return `+55 ${d.slice(2, 4)} ${d.slice(4, -4)}-${d.slice(-4)}`
  if (d.length === 10 || d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}`
  return t ?? null
}

/** tel:+55… a partir do telefone do lead (null se não der para discar). */
export function linkTel(telefone: string | null | undefined): string | null {
  const d = (telefone ?? '').replace(/\D/g, '')
  if (d.length < 10) return null
  return `tel:+${d.length <= 11 ? `55${d}` : d}`
}

export function rotuloPasso(l: Pick<Ligacao, 'passo' | 'totalPassos' | 'cadenciaNome'>) {
  if (!l.passo) return 'Ligação avulsa'
  return `Ligação ${l.passo} de ${l.totalPassos ?? l.passo}${l.cadenciaNome ? ` · ${l.cadenciaNome}` : ''}`
}

/** Toca em "Ligar": registra a discagem e abre o discador (no computador, o app de telefone/Phone Link). */
export function BotaoLigar({ ligacao, telefone, onDiscou, rotulo = 'Ligar' }: { ligacao: Pick<Ligacao, 'id' | 'status'>; telefone: string | null | undefined; onDiscou?: (l: Ligacao) => void; rotulo?: string }) {
  const tel = linkTel(telefone)
  if (!tel || ligacao.status !== 'PENDENTE') return <button type="button" className="pl-btn pl-btn-primary" disabled title={tel ? 'Ligação encerrada' : 'Lead sem telefone'}>{rotulo}</button>
  return (
    <a className="pl-btn pl-btn-primary lg-ligar" href={tel} onClick={() => { proLaboreApi.ligacoes.discar(ligacao.id).then(l => onDiscou?.(l)).catch(() => undefined) }} data-ligar>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92z" /></svg>
      {rotulo}
    </a>
  )
}

/** Janela "Como foi a ligação?": resultado obrigatório; atendeu pede duração e resumo; pediu retorno pede quando. */
export function RegistrarLigacao({ ligacao, nomeCliente, onFechar, onRegistrou }: {
  ligacao: Pick<Ligacao, 'id' | 'discadaEm' | 'discagens' | 'instrucao'>
  nomeCliente: string
  onFechar: () => void
  onRegistrou: (r: { feita: Ligacao; proxima: Ligacao | null }) => void
}) {
  const [resultado, setResultado] = useState<ResultadoLigacao | null>(null)
  const [min, setMin] = useState('')
  const [seg, setSeg] = useState('')
  const [resumo, setResumo] = useState('')
  const [retorno, setRetorno] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!resultado) { setErro('Escolha como foi a ligação'); return }
    const duracaoSeg = (Number(min) || 0) * 60 + (Number(seg) || 0)
    setSalvando(true); setErro('')
    try {
      const r = await proLaboreApi.ligacoes.registrar(ligacao.id, {
        resultado,
        ...(resultado === 'ATENDEU' && duracaoSeg > 0 && { duracaoSeg }),
        ...(resumo.trim() && { resumo: resumo.trim() }),
        ...(resultado === 'PEDIU_RETORNO' && retorno && { retornoEm: new Date(retorno).toISOString() }),
      })
      onRegistrou(r)
    } catch (err) { setErro((err as Error).message) } finally { setSalvando(false) }
  }

  return (
    <div className="pl-modal-backdrop" onClick={onFechar}>
      <form className="pl-card pl-modal-panel lg-modal" onClick={e => e.stopPropagation()} onSubmit={salvar} data-registrar-ligacao>
        <div className="pl-card-title">Como foi a ligação para {nomeCliente}?</div>
        {ligacao.instrucao && <p className="pl-hint" style={{ margin: '4px 0 0' }}>Objetivo: {ligacao.instrucao}</p>}
        <p className={`lg-discagem ${ligacao.discadaEm ? '' : 'sem'}`}>
          {ligacao.discadaEm
            ? `Você tocou em "Ligar" às ${horaBR(ligacao.discadaEm)}${ligacao.discagens > 1 ? ` (${ligacao.discagens} vezes)` : ''}.`
            : 'Você não tocou em "Ligar" por aqui: o registro fica marcado para conferência do gestor.'}
        </p>
        <div className="lg-resultados" role="radiogroup" aria-label="Resultado">
          {(Object.keys(RESULTADO) as ResultadoLigacao[]).map(r => (
            <button key={r} type="button" role="radio" aria-checked={resultado === r} className={`pl-chip ${resultado === r ? 'active' : ''}`} onClick={() => setResultado(r)} data-resultado={r}>{RESULTADO[r]}</button>
          ))}
        </div>
        {resultado === 'ATENDEU' && (
          <div className="lg-duracao">
            <label className="pl-field"><span>Duração</span>
              <span className="lg-duracao-campos">
                <input className="pl-input" type="number" min={0} max={240} inputMode="numeric" placeholder="0" value={min} onChange={e => setMin(e.target.value)} aria-label="Minutos" data-duracao-min /> min
                <input className="pl-input" type="number" min={0} max={59} inputMode="numeric" placeholder="0" value={seg} onChange={e => setSeg(e.target.value)} aria-label="Segundos" /> s
              </span>
            </label>
          </div>
        )}
        {resultado === 'PEDIU_RETORNO' && (
          <label className="pl-field"><span>Ligar de volta em</span>
            <input className="pl-input" type="datetime-local" value={retorno} onChange={e => setRetorno(e.target.value)} data-retorno />
          </label>
        )}
        <label className="pl-field"><span>{resultado === 'ATENDEU' ? 'O que foi falado (obrigatório)' : 'Observação (opcional)'}</span>
          <textarea className="pl-input" rows={3} maxLength={2000} value={resumo} onChange={e => setResumo(e.target.value)} placeholder={resultado === 'ATENDEU' ? 'Ex.: quer simular em 48x, vem sábado com a esposa' : ''} data-resumo />
        </label>
        {erro && <div className="pl-alert pl-alert-error" role="alert">{erro}</div>}
        <div className="lg-modal-acoes">
          <button type="button" className="pl-btn pl-btn-ghost" onClick={onFechar}>Cancelar</button>
          <button type="submit" className="pl-btn pl-btn-primary" disabled={salvando || !resultado} data-salvar-registro>{salvando ? 'Salvando…' : 'Registrar'}</button>
        </div>
      </form>
    </div>
  )
}
