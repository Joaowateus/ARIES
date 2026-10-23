'use client'

// Aba "Follow" do Assistente: a cadência automática para quem parou de
// responder (texto, foto ou vídeo da moto de interesse), a chave — que
// começa desligada, para o dono revisar antes — e a fila do que vai sair.
import { useEffect, useState } from 'react'
import { proLaboreApi, urlArquivoApi, type ConfigFollow, type DadosFollow, type MidiaFollow } from '@/lib/proLaboreApi'

const MIDIA: Record<MidiaFollow, string> = { NENHUMA: 'Só texto', FOTO_MOTO: 'Foto da moto de interesse', VIDEO_MOTO: 'Link do vídeo da moto' }
const REGRAS = [
  'Só em conversa que o vendedor já assumiu e respondeu: o follow nunca abre conversa.',
  'Conta a partir da resposta do vendedor; se o cliente responder, a sequência recomeça.',
  'No máximo 1 mensagem automática por dia por lead e o teto diário por número.',
  'Só de segunda a sábado, no horário abaixo (Brasília).',
  'Para quando o cliente pede para parar, o lead fecha ou é perdido, ou o vendedor para pela conversa.',
]

function quando(iso: string): string {
  const d = new Date(iso)
  const dias = Math.round((d.getTime() - Date.now()) / 86_400_000)
  const data = d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  return d.getTime() <= Date.now() ? `pronto para sair (${data})` : dias <= 0 ? `hoje, ${data.slice(-5)}` : `em ${dias} dia${dias > 1 ? 's' : ''} (${data})`
}

export function Follow() {
  const [dados, setDados] = useState<DadosFollow | null>(null)
  const [cfg, setCfg] = useState<ConfigFollow | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let cancelado = false
    proLaboreApi.assistente.follow().then(d => { if (!cancelado) { setDados(d); setCfg(d.config) } }).catch(e => { if (!cancelado) setErro((e as Error).message) })
    return () => { cancelado = true }
  }, [versao])

  if (!dados || !cfg) return erro ? <div className="pl-alert pl-alert-error">{erro}</div> : <div className="pl-hint">Carregando…</div>
  const editavel = dados.podeEditar
  const mudarPasso = (i: number, campo: 'dias' | 'texto' | 'midia', valor: string) =>
    setCfg(c => c && ({ ...c, passos: c.passos.map((p, j) => (j === i ? { ...p, [campo]: campo === 'dias' ? Number(valor) || 1 : valor } : p)) }))

  async function salvar(extra: { ativo?: boolean } = {}) {
    setSalvando(true)
    setErro('')
    setAviso('')
    try {
      await proLaboreApi.assistente.salvarFollow({ ...extra, config: cfg! })
      setAviso(extra.ativo === true ? 'Follow automático ligado.' : extra.ativo === false ? 'Follow automático desligado.' : 'Mensagens salvas.')
      setVersao(v => v + 1)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="pl-fu" data-follow>
      <div className="pl-card pl-fu-topo">
        <div>
          <div className="pl-card-title">Follow automático</div>
          <div className="pl-card-sub">Para quem parou de responder: lembrete leve, depois a foto ou o vídeo da moto de interesse e, por fim, uma última mensagem.</div>
          <div className="pl-fu-status">
            <span className={`pl-status-badge ${dados.ativo ? 'bom' : 'neutro'}`}>{dados.ativo ? 'Ligado' : 'Desligado'}</span>
            {dados.ativo && <span>{dados.noHorario ? 'Dentro do horário agora' : 'Fora do horário agora: sai no próximo horário'}</span>}
            <span>{dados.enviadosHoje} enviado{dados.enviadosHoje === 1 ? '' : 's'} hoje</span>
          </div>
        </div>
        {editavel && (
          <button type="button" role="switch" aria-checked={dados.ativo} className={`pl-as-switch ${dados.ativo ? 'on' : ''}`} onClick={() => salvar({ ativo: !dados.ativo })} disabled={salvando} data-chave-follow>
            <span className="pl-as-switch-trilho" aria-hidden="true"><span /></span>
            <span><b>{dados.ativo ? 'Follow ligado' : 'Ligar follow automático'}</b><small>{dados.ativo ? 'Toque para desligar' : 'Revise as mensagens antes'}</small></span>
          </button>
        )}
      </div>

      <div className="pl-fu-grade">
        <div className="pl-card">
          <div className="pl-as-card-head"><div className="pl-card-title">Mensagens da cadência</div></div>
          {cfg.passos.map((p, i) => (
            <div key={i} className="pl-fu-passo" data-passo={i + 1}>
              <div className="pl-fu-passo-topo">
                <b>Passo {i + 1}</b>
                <label>
                  <input className="pl-input" type="number" min={1} max={30} value={p.dias} disabled={!editavel} onChange={e => mudarPasso(i, 'dias', e.target.value)} aria-label={`Dias sem resposta do passo ${i + 1}`} />
                  <span>dia{p.dias > 1 ? 's' : ''} sem resposta</span>
                </label>
                <select className="pl-input" value={p.midia} disabled={!editavel} onChange={e => mudarPasso(i, 'midia', e.target.value)} aria-label={`Mídia do passo ${i + 1}`}>
                  {(Object.keys(MIDIA) as MidiaFollow[]).map(m => <option key={m} value={m}>{MIDIA[m]}</option>)}
                </select>
                {editavel && cfg.passos.length > 1 && <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setCfg(c => c && ({ ...c, passos: c.passos.filter((_, j) => j !== i) }))} aria-label={`Tirar passo ${i + 1}`}>✕</button>}
              </div>
              <textarea className="pl-input pl-textarea" rows={3} value={p.texto} disabled={!editavel} onChange={e => mudarPasso(i, 'texto', e.target.value)} aria-label={`Mensagem do passo ${i + 1}`} />
            </div>
          ))}
          {editavel && cfg.passos.length < 5 && (
            <button type="button" className="pl-vt-link" onClick={() => setCfg(c => c && ({ ...c, passos: [...c.passos, { dias: (c.passos.at(-1)?.dias ?? 0) + 7, texto: '', midia: 'NENHUMA' }] }))}>+ Passo</button>
          )}
          <div className="pl-hint" style={{ marginTop: 10 }}>Use {'{nome}'}, {'{vendedor}'} e {'{moto}'}. Foto e vídeo saem da aba Estoque, pela moto de interesse do lead; sem foto ou vídeo cadastrado, vai só o texto. O preço nunca entra.</div>

          <div className="pl-vt-grade" style={{ marginTop: 14 }}>
            <div className="pl-field">
              <label htmlFor="fu-teto">Teto por número por dia</label>
              <input id="fu-teto" className="pl-input" type="number" min={1} max={100} value={cfg.tetoDiario} disabled={!editavel} onChange={e => setCfg(c => c && ({ ...c, tetoDiario: Number(e.target.value) || 1 }))} />
            </div>
            <div className="pl-field">
              <label htmlFor="fu-inicio">Das (hora)</label>
              <input id="fu-inicio" className="pl-input" type="number" min={7} max={20} value={cfg.horaInicio} disabled={!editavel} onChange={e => setCfg(c => c && ({ ...c, horaInicio: Number(e.target.value) || 9 }))} />
            </div>
            <div className="pl-field">
              <label htmlFor="fu-fim">Até (hora)</label>
              <input id="fu-fim" className="pl-input" type="number" min={8} max={21} value={cfg.horaFim} disabled={!editavel} onChange={e => setCfg(c => c && ({ ...c, horaFim: Number(e.target.value) || 19 }))} />
            </div>
          </div>
          {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 12 }}>{erro}</div>}
          {aviso && <div className="pl-hint" style={{ marginTop: 12 }} data-aviso-follow>{aviso}</div>}
          {editavel && <div className="pl-vt-rodape"><button type="button" className="pl-btn pl-btn-primary" onClick={() => salvar()} disabled={salvando} data-salvar-follow>{salvando ? 'Salvando…' : 'Salvar mensagens'}</button></div>}
        </div>

        <div className="pl-fu-lateral">
          <div className="pl-card">
            <div className="pl-card-title" style={{ marginBottom: 8 }}>Regras de segurança</div>
            <ul className="pl-fu-regras">{REGRAS.map(r => <li key={r}>{r}</li>)}</ul>
          </div>
          <div className="pl-card" data-fila-follow>
            <div className="pl-card-title" style={{ marginBottom: 8 }}>Próximos follows</div>
            {dados.fila.length === 0 ? <div className="pl-hint">Ninguém na fila: quando um lead parar de responder depois do vendedor, ele aparece aqui.</div> : (
              <ul className="pl-fu-fila">
                {dados.fila.map(f => (
                  <li key={f.conversaId} data-item-fila>
                    <div className="pl-fu-fila-topo"><b>{f.nome}</b><span>passo {f.passo} de {f.total}</span></div>
                    <div className="pl-fu-fila-quando">{quando(f.devidoEm)}{f.vendedor ? ` · ${f.vendedor}` : ''}{f.foto ? ' · com foto' : ''}</div>
                    <p>{f.texto}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {dados.ultimos.length > 0 && (
            <div className="pl-card">
              <div className="pl-card-title" style={{ marginBottom: 8 }}>Últimos enviados</div>
              <ul className="pl-fu-fila">
                {dados.ultimos.map(u => (
                  <li key={u.id}>
                    <div className="pl-fu-fila-topo"><b>{u.conversa.nomeContato}</b><span>{new Date(u.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {u.midiaUrl && <img className="pl-fu-mini" src={urlArquivoApi(u.midiaUrl)} alt="" />}
                    <p>{u.texto}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
