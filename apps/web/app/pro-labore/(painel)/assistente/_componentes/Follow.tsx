'use client'

// Aba "Follow" do Assistente: os fluxos automáticos para quem sumiu, cada um
// pelo ponto da negociação em que o cliente parou (sem resposta, depois da
// simulação, depois da aprovação e o resgate de perdido), com foto da moto,
// imagem própria e os links das redes da aba Processo. Mais o follow de
// crédito recusado, que é só do vendedor. A chave começa desligada, para o
// dono revisar antes; a fila mostra o que vai sair e a taxa de resposta.
import { useEffect, useRef, useState } from 'react'
import { proLaboreApi, urlArquivoApi, type ConfigFollow, type DadosFollow, type FluxoFollow, type LinkProcesso, type MidiaFollow, type PassoFollow, type SituacaoFollow } from '@/lib/proLaboreApi'
import { comprimirFoto } from './Vitrine'

const MIDIA: Record<MidiaFollow, string> = { NENHUMA: 'Só texto', FOTO_MOTO: 'Foto da moto de interesse', VIDEO_MOTO: 'Link do vídeo da moto', IMAGEM: 'Imagem própria' }
export const FLUXO: Record<SituacaoFollow, { rotulo: string; quando: string; dias: string }> = {
  SEM_RESPOSTA: { rotulo: 'Parou de responder', quando: 'Cliente que parou de responder depois do vendedor, antes de receber simulação.', dias: 'sem resposta' },
  APOS_SIMULACAO: { rotulo: 'Depois da simulação', quando: 'Recebeu a simulação do financiamento (do robô ou do vendedor) e sumiu.', dias: 'sem resposta' },
  APOS_APROVACAO: { rotulo: 'Depois da aprovação', quando: 'Recebeu a pré-análise aprovada pelo WhatsApp e sumiu.', dias: 'sem resposta' },
  REATIVACAO: { rotulo: 'Resgate de perdido', quando: 'Lead marcado como perdido (parou de responder, sem momento, achou caro…). Não vai para quem comprou em outro lugar, desistiu ou teve o crédito recusado.', dias: 'depois da perda' },
}
const ORDEM: Array<SituacaoFollow | 'CREDITO'> = ['SEM_RESPOSTA', 'APOS_SIMULACAO', 'APOS_APROVACAO', 'REATIVACAO', 'CREDITO']
const LIMITE: Record<SituacaoFollow, { min: number; max: number }> = { SEM_RESPOSTA: { min: 1, max: 30 }, APOS_SIMULACAO: { min: 1, max: 30 }, APOS_APROVACAO: { min: 1, max: 30 }, REATIVACAO: { min: 3, max: 180 } }
const REGRAS = [
  'Só em conversa que o vendedor já assumiu e respondeu: o follow nunca abre conversa.',
  'O fluxo é escolhido pelo ponto em que o cliente sumiu e fica até ele responder; respondeu, recomeça do zero.',
  'No máximo 1 mensagem automática por dia por lead e o teto diário por número.',
  'Só de segunda a sábado, no horário abaixo (Brasília).',
  'Para quando o cliente pede para parar, o lead fecha ou o vendedor para pela conversa.',
  'Crédito recusado nunca gera mensagem automática: vira lembrete do vendedor.',
]

function quando(iso: string): string {
  const d = new Date(iso)
  const dias = Math.round((d.getTime() - Date.now()) / 86_400_000)
  const data = d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  return d.getTime() <= Date.now() ? `pronto para sair (${data})` : dias <= 0 ? `hoje, ${data.slice(-5)}` : `em ${dias} dia${dias > 1 ? 's' : ''} (${data})`
}
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—')

/** Variáveis e links das redes (aba Processo) para colocar na mensagem. */
function Inserir({ links, disabled, onInserir }: { links: LinkProcesso[]; disabled: boolean; onInserir: (t: string) => void }) {
  return (
    <div className="fu-inserir" aria-label="Inserir na mensagem">
      <span>Inserir:</span>
      {['{nome}', '{moto}', '{vendedor}'].map(v => <button key={v} type="button" className="pl-chip" disabled={disabled} onClick={() => onInserir(v)}>{v}</button>)}
      {links.length > 0 && (
        <select className="pl-input" value="" disabled={disabled} onChange={e => { if (e.target.value) onInserir(e.target.value) }} aria-label="Inserir link das redes" data-inserir-link>
          <option value="">Link das redes…</option>
          {links.map(l => <option key={l.url} value={l.url}>{l.rotulo}</option>)}
        </select>
      )}
    </div>
  )
}

function Passo({ p, i, situacao, editavel, links, podeTirar, onMudar, onTirar }: {
  p: PassoFollow; i: number; situacao: SituacaoFollow; editavel: boolean; links: LinkProcesso[]; podeTirar: boolean
  onMudar: (p: PassoFollow) => void; onTirar: () => void
}) {
  const texto = useRef<HTMLTextAreaElement>(null)
  const arquivo = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const { min, max } = LIMITE[situacao]

  function inserir(t: string) {
    const el = texto.current
    const ini = el?.selectionStart ?? p.texto.length, fim = el?.selectionEnd ?? p.texto.length
    const antes = p.texto.slice(0, ini), depois = p.texto.slice(fim)
    // Link entra como palavra solta: o WhatsApp só deixa clicável com espaço em volta.
    const peca = t.startsWith('http') ? `${antes && !/\s$/.test(antes) ? ' ' : ''}${t}${depois && !/^\s/.test(depois) ? ' ' : ''}` : t
    onMudar({ ...p, texto: antes + peca + depois })
    requestAnimationFrame(() => { el?.focus(); const pos = (antes + peca).length; el?.setSelectionRange(pos, pos) })
  }
  async function escolherImagem(f: File | undefined) {
    if (!f) return
    setEnviando(true); setErro('')
    try { onMudar({ ...p, midia: 'IMAGEM', imagem: await proLaboreApi.assistente.enviarFotoMoto(await comprimirFoto(f)) }) } catch (e) { setErro((e as Error).message) } finally { setEnviando(false) }
  }

  return (
    <div className="pl-fu-passo" data-passo={i + 1}>
      <div className="pl-fu-passo-topo">
        <b>Passo {i + 1}</b>
        <label>
          <input className="pl-input" type="number" min={min} max={max} value={p.dias} disabled={!editavel} onChange={e => onMudar({ ...p, dias: Number(e.target.value) || min })} aria-label={`Dias do passo ${i + 1}`} />
          <span>dia{p.dias > 1 ? 's' : ''} {FLUXO[situacao].dias}</span>
        </label>
        <select className="pl-input" value={p.midia} disabled={!editavel} onChange={e => { const m = e.target.value as MidiaFollow; if (m === 'IMAGEM' && !p.imagem) arquivo.current?.click(); else onMudar({ ...p, midia: m }) }} aria-label={`Mídia do passo ${i + 1}`} data-midia-passo>
          {(Object.keys(MIDIA) as MidiaFollow[]).map(m => <option key={m} value={m}>{MIDIA[m]}</option>)}
        </select>
        {editavel && podeTirar && <button type="button" className="pl-btn pl-btn-ghost" onClick={onTirar} aria-label={`Tirar passo ${i + 1}`}>✕</button>}
      </div>
      <input ref={arquivo} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => { void escolherImagem(e.target.files?.[0]); e.target.value = '' }} data-arquivo-passo />
      {p.midia === 'IMAGEM' && (
        <div className="fu-imagem">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.imagem && <img src={urlArquivoApi(p.imagem)} alt={`Imagem do passo ${i + 1}`} data-imagem-passo />}
          {editavel && <button type="button" className="pl-vt-link" disabled={enviando} onClick={() => arquivo.current?.click()}>{enviando ? 'Enviando…' : p.imagem ? 'Trocar imagem' : 'Escolher imagem'}</button>}
          <span className="pl-hint">A mensagem vai como legenda da imagem.</span>
        </div>
      )}
      {enviando && p.midia !== 'IMAGEM' && <span className="pl-hint">Enviando a imagem…</span>}
      {erro && <span className="pl-alert pl-alert-error">{erro}</span>}
      <textarea ref={texto} className="pl-input pl-textarea" rows={3} maxLength={600} value={p.texto} disabled={!editavel} onChange={e => onMudar({ ...p, texto: e.target.value })} aria-label={`Mensagem do passo ${i + 1}`} />
      {editavel && <Inserir links={links} disabled={!editavel} onInserir={inserir} />}
    </div>
  )
}

function EditorFluxo({ f, editavel, links, desempenho, onMudar }: {
  f: FluxoFollow; editavel: boolean; links: LinkProcesso[]; desempenho: { enviados: number; responderam: number } | undefined
  onMudar: (f: FluxoFollow) => void
}) {
  const { min } = LIMITE[f.situacao]
  return (
    <div data-fluxo={f.situacao}>
      <div className="fu-fluxo-cab">
        <div>
          <div className="pl-card-title">{FLUXO[f.situacao].rotulo}</div>
          <div className="pl-card-sub">{FLUXO[f.situacao].quando}</div>
          {desempenho && desempenho.enviados > 0 && <div className="fu-taxa" data-taxa-fluxo>{desempenho.enviados} enviados em 30 dias · {pct(desempenho.responderam, desempenho.enviados)} responderam</div>}
        </div>
        <label className="fu-liga">
          <input type="checkbox" checked={f.ativo} disabled={!editavel} onChange={e => onMudar({ ...f, ativo: e.target.checked })} data-fluxo-ativo />
          {f.ativo ? 'Fluxo ligado' : 'Fluxo desligado'}
        </label>
      </div>
      {f.passos.map((p, i) => (
        <Passo
          key={i} p={p} i={i} situacao={f.situacao} editavel={editavel} links={links} podeTirar={f.passos.length > 1}
          onMudar={np => onMudar({ ...f, passos: f.passos.map((x, j) => (j === i ? np : x)) })}
          onTirar={() => onMudar({ ...f, passos: f.passos.filter((_, j) => j !== i) })}
        />
      ))}
      {editavel && f.passos.length < 5 && (
        <button type="button" className="pl-vt-link" onClick={() => onMudar({ ...f, passos: [...f.passos, { dias: Math.max(min, (f.passos.at(-1)?.dias ?? 0) + (f.situacao === 'REATIVACAO' ? 30 : 7)), texto: '', midia: 'NENHUMA', imagem: null }] })} data-mais-passo>+ Passo</button>
      )}
      <div className="pl-field" style={{ marginTop: 12 }}>
        <label htmlFor={`fu-fim-${f.situacao}`}>No fim do fluxo, se o cliente não responder</label>
        <select id={`fu-fim-${f.situacao}`} className="pl-input" value={f.aoFinal} disabled={!editavel} onChange={e => onMudar({ ...f, aoFinal: e.target.value as FluxoFollow['aoFinal'] })} data-fim-fluxo>
          <option value="NADA">Não fazer mais nada</option>
          <option value="AVISAR_VENDEDOR">Criar follow para o vendedor ligar (2 dias depois do último passo)</option>
        </select>
      </div>
    </div>
  )
}

function EditorCredito({ cfg, editavel, links, onMudar }: { cfg: ConfigFollow['credito']; editavel: boolean; links: LinkProcesso[]; onMudar: (c: ConfigFollow['credito']) => void }) {
  const texto = useRef<HTMLTextAreaElement>(null)
  return (
    <div data-fluxo="CREDITO">
      <div className="fu-fluxo-cab">
        <div>
          <div className="pl-card-title">Crédito recusado</div>
          <div className="pl-card-sub">Nenhum banco aprovou: o vendedor ganha um follow para refazer a pré-análise depois de um tempo e ver se a restrição continua. Nada sai para o cliente sozinho.</div>
        </div>
        <label className="fu-liga">
          <input type="checkbox" checked={cfg.ativo} disabled={!editavel} onChange={e => onMudar({ ...cfg, ativo: e.target.checked })} data-credito-ativo />
          {cfg.ativo ? 'Criar sozinho' : 'Só à mão (na ficha)'}
        </label>
      </div>
      <ol className="fu-passos-credito">
        <li>Todos os bancos lançados recusaram: o follow fica marcado para daqui a <input className="pl-input" type="number" min={7} max={120} value={cfg.dias} disabled={!editavel} onChange={e => onMudar({ ...cfg, dias: Number(e.target.value) || 30 })} aria-label="Dias até a nova análise" data-credito-dias /> dias, às 10h.</li>
        <li>No dia, o vendedor recebe o aviso no WhatsApp (Aries ou chat &ldquo;Você&rdquo;) e o follow aparece no card, no Meu dia e no menu.</li>
        <li>Ele chama o cliente com a mensagem abaixo e, com a autorização nova, reabre a pré-análise: as recusas voltam para &ldquo;a enviar&rdquo;.</li>
      </ol>
      <div className="pl-field">
        <label htmlFor="fu-credito-texto">Mensagem para chamar o cliente de novo</label>
        <textarea ref={texto} id="fu-credito-texto" className="pl-input pl-textarea" rows={3} maxLength={600} value={cfg.texto} disabled={!editavel} onChange={e => onMudar({ ...cfg, texto: e.target.value })} data-credito-texto />
      </div>
      {editavel && <Inserir links={links} disabled={!editavel} onInserir={t => onMudar({ ...cfg, texto: `${cfg.texto}${/\s$/.test(cfg.texto) || !cfg.texto ? '' : ' '}${t}` })} />}
      <div className="pl-hint" style={{ marginTop: 8 }}>A mensagem não fala em restrição nem em banco: só oferece tentar de novo.</div>
    </div>
  )
}

export function Follow() {
  const [dados, setDados] = useState<DadosFollow | null>(null)
  const [cfg, setCfg] = useState<ConfigFollow | null>(null)
  const [links, setLinks] = useState<LinkProcesso[]>([])
  const [aba, setAba] = useState<SituacaoFollow | 'CREDITO'>('SEM_RESPOSTA')
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let cancelado = false
    proLaboreApi.assistente.follow().then(d => { if (!cancelado) { setDados(d); setCfg(d.config) } }).catch(e => { if (!cancelado) setErro((e as Error).message) })
    return () => { cancelado = true }
  }, [versao])
  useEffect(() => { proLaboreApi.processo.ler().then(p => setLinks(p.conteudo.links.filter(l => l.url))).catch(() => undefined) }, [])

  if (!dados || !cfg) return erro ? <div className="pl-alert pl-alert-error">{erro}</div> : <div className="pl-hint">Carregando…</div>
  const editavel = dados.podeEditar
  const fluxo = aba === 'CREDITO' ? null : cfg.fluxos.find(f => f.situacao === aba) ?? null
  const desempenho = new Map(dados.desempenho.fluxos.map(f => [f.fluxo, f]))
  const totalEnviados = dados.desempenho.fluxos.reduce((t, f) => t + f.enviados, 0)
  const totalResponderam = dados.desempenho.fluxos.reduce((t, f) => t + f.responderam, 0)

  async function salvar(extra: { ativo?: boolean } = {}) {
    setSalvando(true)
    setErro('')
    setAviso('')
    try {
      await proLaboreApi.assistente.salvarFollow({ ...extra, config: cfg! })
      setAviso(extra.ativo === true ? 'Follow automático ligado.' : extra.ativo === false ? 'Follow automático desligado.' : 'Fluxos salvos.')
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
          <div className="pl-card-sub">Um fluxo para cada ponto em que o cliente some, com foto da moto, imagem própria e os links das redes. E o lembrete do vendedor quando o crédito não sai.</div>
          <div className="pl-fu-status">
            <span className={`pl-status-badge ${dados.ativo ? 'bom' : 'neutro'}`}>{dados.ativo ? 'Ligado' : 'Desligado'}</span>
            {dados.ativo && <span>{dados.noHorario ? 'Dentro do horário agora' : 'Fora do horário agora: sai no próximo horário'}</span>}
            <span>{dados.enviadosHoje} enviado{dados.enviadosHoje === 1 ? '' : 's'} hoje</span>
            {totalEnviados > 0 && <span data-taxa-geral>{pct(totalResponderam, totalEnviados)} responderam em 30 dias</span>}
            {dados.desempenho.paraVendedor > 0 && <span>{dados.desempenho.paraVendedor} passaram para o vendedor</span>}
          </div>
        </div>
        {editavel && (
          <button type="button" role="switch" aria-checked={dados.ativo} className={`pl-as-switch ${dados.ativo ? 'on' : ''}`} onClick={() => salvar({ ativo: !dados.ativo })} disabled={salvando} data-chave-follow>
            <span className="pl-as-switch-trilho" aria-hidden="true"><span /></span>
            <span><b>{dados.ativo ? 'Follow ligado' : 'Ligar follow automático'}</b><small>{dados.ativo ? 'Toque para desligar' : 'Revise os fluxos antes'}</small></span>
          </button>
        )}
      </div>

      <div className="pl-fu-grade">
        <div className="pl-card">
          <div className="fu-abas" role="tablist" aria-label="Fluxos">
            {ORDEM.map(s => {
              const f = s === 'CREDITO' ? null : cfg.fluxos.find(x => x.situacao === s)
              const ligado = s === 'CREDITO' ? cfg.credito.ativo : !!f?.ativo
              return (
                <button key={s} type="button" role="tab" aria-selected={aba === s} className={`pl-chip ${aba === s ? 'active' : ''}`} onClick={() => setAba(s)} data-aba-fluxo={s}>
                  <span className={`fu-ponto ${ligado ? 'on' : ''}`} aria-hidden="true" />{s === 'CREDITO' ? 'Crédito recusado' : FLUXO[s].rotulo}
                </button>
              )
            })}
          </div>

          {fluxo && <EditorFluxo key={fluxo.situacao} f={fluxo} editavel={editavel} links={links} desempenho={desempenho.get(fluxo.situacao)} onMudar={nf => setCfg(c => c && ({ ...c, fluxos: c.fluxos.map(x => (x.situacao === nf.situacao ? nf : x)) }))} />}
          {aba === 'CREDITO' && <EditorCredito cfg={cfg.credito} editavel={editavel} links={links} onMudar={cr => setCfg(c => c && ({ ...c, credito: cr }))} />}

          {aba !== 'CREDITO' && <div className="pl-hint" style={{ marginTop: 10 }}>Use {'{nome}'}, {'{vendedor}'} e {'{moto}'}. A foto e o vídeo saem da aba Estoque, pela moto de interesse do lead; sem foto ou vídeo cadastrado, vai só o texto. Os links vêm da aba Processo. O preço nunca entra.</div>}

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
          {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 12 }} role="alert">{erro}</div>}
          {aviso && <div className="pl-hint" style={{ marginTop: 12 }} data-aviso-follow>{aviso}</div>}
          {editavel && <div className="pl-vt-rodape"><button type="button" className="pl-btn pl-btn-primary" onClick={() => salvar()} disabled={salvando} data-salvar-follow>{salvando ? 'Salvando…' : 'Salvar fluxos'}</button></div>}
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
                  <li key={f.conversaId} data-item-fila data-fluxo-item={f.fluxo}>
                    <div className="pl-fu-fila-topo"><b>{f.nome}</b><span>passo {f.passo} de {f.total}</span></div>
                    <div className="pl-fu-fila-quando"><span className="fu-tag">{FLUXO[f.fluxo].rotulo}</span> {quando(f.devidoEm)}{f.vendedor ? ` · ${f.vendedor}` : ''}{f.foto ? ' · com imagem' : ''}</div>
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
                    {u.followFluxo && <div className="pl-fu-fila-quando"><span className="fu-tag">{FLUXO[u.followFluxo].rotulo}</span></div>}
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
