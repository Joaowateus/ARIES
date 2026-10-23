'use client'

// Aba "Estoque" do Assistente: a ficha de cada moto que vai para o cliente
// no WhatsApp (o robô responde "tem a XRE?" com ela e o vendedor manda pelo
// botão "Enviar moto"). Mesmas motos do estoque do Social Media.
import { useEffect, useMemo, useState } from 'react'
import { proLaboreApi, urlArquivoApi, type DadosVitrine, type ItemFichaMoto, type MotoVitrine, type MotoVitrineEntrada, type SituacaoMotoVitrine } from '@/lib/proLaboreApi'

const SITUACAO: Record<SituacaoMotoVitrine, { rotulo: string; classe: string }> = {
  DISPONIVEL: { rotulo: 'Disponível', classe: 'bom' },
  RESERVADA: { rotulo: 'Reservada', classe: 'atencao' },
  VENDIDA: { rotulo: 'Vendida', classe: 'neutro' },
}
const FILTRO: Record<SituacaoMotoVitrine, string> = { DISPONIVEL: 'Disponíveis', RESERVADA: 'Reservadas', VENDIDA: 'Vendidas (30 dias)' }
const MAX_FOTOS = 6
const LADO_FOTO = 1280

// Foto do celular (3–8 MB) vira um JPEG de até 1280 px, leve para o banco e
// para o WhatsApp.
async function comprimirFoto(arquivo: File): Promise<Blob> {
  const url = URL.createObjectURL(arquivo)
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => {
      const i = new Image()
      i.onload = () => ok(i); i.onerror = () => erro(new Error('Esse arquivo não é uma imagem'))
      i.src = url
    })
    const esc = Math.min(1, LADO_FOTO / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * esc))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * esc))
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    for (const q of [0.82, 0.7, 0.6]) {
      const blob = await new Promise<Blob | null>(ok => canvas.toBlob(ok, 'image/jpeg', q))
      if (blob && blob.size <= 600_000) return blob
    }
    throw new Error('Não deu para reduzir essa foto')
  } finally {
    URL.revokeObjectURL(url)
  }
}

const numero = (v: string) => (v.trim() === '' ? null : Number(v.replace(/\./g, '').replace(',', '.')))

interface Rascunho {
  modelo: string; marca: string; versao: string; ano: string; cor: string; km: string; cilindrada: string; preco: string
  situacao: SituacaoMotoVitrine; destaques: string; ficha: ItemFichaMoto[]; fotos: string[]; videoUrl: string
}
const vazio: Rascunho = { modelo: '', marca: '', versao: '', ano: '', cor: '', km: '', cilindrada: '', preco: '', situacao: 'DISPONIVEL', destaques: '', ficha: [], fotos: [], videoUrl: '' }
function rascunhoDe(m: MotoVitrine): Rascunho {
  const s = (v: number | string | null) => (v === null ? '' : String(v))
  return {
    modelo: m.modelo, marca: s(m.marca), versao: s(m.versao), ano: s(m.ano), cor: s(m.cor), km: s(m.km), cilindrada: s(m.cilindrada), preco: s(m.preco),
    situacao: m.situacao, destaques: m.destaques.join(', '), ficha: m.ficha, fotos: m.fotos, videoUrl: s(m.videoUrl),
  }
}
function entradaDe(r: Rascunho): MotoVitrineEntrada {
  const t = (v: string) => v.trim() || null
  return {
    modelo: r.modelo.trim(), marca: t(r.marca), versao: t(r.versao), ano: numero(r.ano), cor: t(r.cor), km: numero(r.km), cilindrada: numero(r.cilindrada),
    preco: numero(r.preco), situacao: r.situacao, destaques: r.destaques.split(',').map(d => d.trim()).filter(Boolean),
    ficha: r.ficha.filter(f => f.rotulo.trim() && f.valor.trim()), fotos: r.fotos, videoUrl: t(r.videoUrl),
  }
}

function Editor({ moto, mostrarPreco, onFechar, onSalvo }: { moto: MotoVitrine | null; mostrarPreco: boolean; onFechar: () => void; onSalvo: () => void }) {
  const [r, setR] = useState<Rascunho>(moto ? rascunhoDe(moto) : vazio)
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const mudar = <K extends keyof Rascunho>(k: K, v: Rascunho[K]) => setR(x => ({ ...x, [k]: v }))

  async function adicionarFotos(lista: FileList | null) {
    if (!lista?.length) return
    setEnviandoFoto(true)
    setErro('')
    try {
      const novas: string[] = []
      for (const arquivo of [...lista].slice(0, MAX_FOTOS - r.fotos.length)) novas.push(await proLaboreApi.assistente.enviarFotoMoto(await comprimirFoto(arquivo)))
      setR(x => ({ ...x, fotos: [...x.fotos, ...novas].slice(0, MAX_FOTOS) }))
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setEnviandoFoto(false)
    }
  }

  async function salvar() {
    if (r.modelo.trim().length < 2) { setErro('Informe o modelo'); return }
    setSalvando(true)
    setErro('')
    try {
      if (moto) await proLaboreApi.assistente.editarMoto(moto.id, entradaDe(r))
      else await proLaboreApi.assistente.criarMoto(entradaDe(r))
      onSalvo()
    } catch (e) {
      setErro((e as Error).message)
      setSalvando(false)
    }
  }

  const campo = (k: keyof Rascunho, rotulo: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="pl-field">
      <label htmlFor={`vt-${k}`}>{rotulo}</label>
      <input id={`vt-${k}`} className="pl-input" value={r[k] as string} onChange={e => mudar(k, e.target.value as never)} {...props} />
    </div>
  )

  return (
    <div className="pl-modal-backdrop" onClick={onFechar}>
      <div className="pl-card pl-modal-panel pl-vt-editor" role="dialog" aria-modal="true" aria-labelledby="vt-titulo" onClick={e => e.stopPropagation()} data-editor-moto>
        <div className="pl-as-card-head">
          <div>
            <div className="pl-card-title" id="vt-titulo">{moto ? `Editar ${moto.nome}` : 'Nova moto no estoque'}</div>
            <div className="pl-card-sub">O que estiver aqui é o que o cliente recebe no WhatsApp.</div>
          </div>
          <button type="button" className="pl-btn pl-btn-ghost" onClick={onFechar} aria-label="Fechar">✕</button>
        </div>

        <div className="pl-vt-fotos" data-fotos>
          {r.fotos.map((f, i) => (
            <div key={f} className="pl-vt-foto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urlArquivoApi(f)} alt={`Foto ${i + 1}`} />
              {i === 0 && <span className="pl-vt-capa">Capa</span>}
              <span className="pl-vt-foto-acoes">
                {i > 0 && <button type="button" onClick={() => mudar('fotos', [f, ...r.fotos.filter(x => x !== f)])} aria-label="Usar como capa">★</button>}
                <button type="button" onClick={() => mudar('fotos', r.fotos.filter(x => x !== f))} aria-label="Tirar foto">✕</button>
              </span>
            </div>
          ))}
          {r.fotos.length < MAX_FOTOS && (
            <label className="pl-vt-foto pl-vt-foto-nova">
              <input type="file" accept="image/*" multiple onChange={e => { adicionarFotos(e.target.files); e.target.value = '' }} disabled={enviandoFoto} data-input-fotos />
              <span>{enviandoFoto ? 'Enviando…' : '+ Fotos'}</span>
            </label>
          )}
        </div>
        <div className="pl-hint" style={{ marginBottom: 14 }}>Até {MAX_FOTOS} fotos; a primeira é a capa que o robô manda. As fotos são reduzidas antes de subir.</div>

        <div className="pl-vt-grade">
          {campo('modelo', 'Modelo *', { placeholder: 'XRE 300 Sahara' })}
          {campo('marca', 'Marca', { placeholder: 'Honda' })}
          {campo('versao', 'Versão', { placeholder: 'ABS' })}
          {campo('ano', 'Ano', { inputMode: 'numeric', placeholder: '2023' })}
          {campo('cor', 'Cor', { placeholder: 'Vermelha' })}
          {campo('km', 'Km', { inputMode: 'numeric', placeholder: '12000' })}
          {campo('cilindrada', 'Cilindrada (cc)', { inputMode: 'numeric', placeholder: '300' })}
          <div className="pl-field">
            <label htmlFor="vt-situacao">Situação</label>
            <select id="vt-situacao" className="pl-input" value={r.situacao} onChange={e => mudar('situacao', e.target.value as SituacaoMotoVitrine)}>
              {(Object.keys(SITUACAO) as SituacaoMotoVitrine[]).map(s => <option key={s} value={s}>{SITUACAO[s].rotulo}</option>)}
            </select>
          </div>
          {campo('preco', 'Preço (R$)', { inputMode: 'decimal', placeholder: '25900' })}
        </div>
        <div className="pl-hint" style={{ margin: '6px 0 14px' }}>
          {mostrarPreco ? 'O preço aparece na ficha do WhatsApp (a loja ligou “Mostrar preço”).' : 'O preço fica só no sistema: “Mostrar preço no WhatsApp” está desligado.'} O preço nunca vai para a IA.
        </div>

        <div className="pl-field" style={{ marginBottom: 14 }}>
          <label htmlFor="vt-destaques">Destaques (separe por vírgula)</label>
          <input id="vt-destaques" className="pl-input" value={r.destaques} onChange={e => mudar('destaques', e.target.value)} placeholder="Revisada, único dono, manual e chave reserva" />
        </div>

        <div className="pl-field" style={{ marginBottom: 14 }}>
          <label>Ficha técnica</label>
          {r.ficha.map((f, i) => (
            <div key={i} className="pl-vt-ficha-linha">
              <input className="pl-input" value={f.rotulo} placeholder="Freio" aria-label={`Item ${i + 1}`} onChange={e => mudar('ficha', r.ficha.map((x, j) => (j === i ? { ...x, rotulo: e.target.value } : x)))} />
              <input className="pl-input" value={f.valor} placeholder="ABS dianteiro" aria-label={`Valor do item ${i + 1}`} onChange={e => mudar('ficha', r.ficha.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))} />
              <button type="button" className="pl-btn pl-btn-ghost" onClick={() => mudar('ficha', r.ficha.filter((_, j) => j !== i))} aria-label="Tirar item">✕</button>
            </div>
          ))}
          {r.ficha.length < 12 && <button type="button" className="pl-link-action pl-vt-link" onClick={() => mudar('ficha', [...r.ficha, { rotulo: '', valor: '' }])}>+ Item da ficha</button>}
        </div>

        {campo('videoUrl', 'Vídeo (link do YouTube, Instagram ou Drive)', { placeholder: 'https://…', type: 'url' })}

        {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 12 }}>{erro}</div>}
        <div className="pl-vt-rodape">
          <button type="button" className="pl-btn pl-btn-ghost" onClick={onFechar}>Cancelar</button>
          <button type="button" className="pl-btn pl-btn-primary" onClick={salvar} disabled={salvando || enviandoFoto} data-salvar-moto>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

export function Vitrine() {
  const [dados, setDados] = useState<DadosVitrine | null>(null)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState<SituacaoMotoVitrine>('DISPONIVEL')
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState<MotoVitrine | 'nova' | null>(null)
  const [aberta, setAberta] = useState<string | null>(null)
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let cancelado = false
    proLaboreApi.assistente.vitrine().then(d => { if (!cancelado) setDados(d) }).catch(e => { if (!cancelado) setErro((e as Error).message) })
    return () => { cancelado = true }
  }, [versao])

  const motos = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return (dados?.motos ?? []).filter(m => m.situacao === filtro && (!t || m.nome.toLowerCase().includes(t) || (m.cor ?? '').toLowerCase().includes(t)))
  }, [dados, filtro, busca])

  async function alternar(chave: 'mostrarPreco' | 'vitrineRobo') {
    if (!dados) return
    try {
      const config = await proLaboreApi.assistente.configVitrine({ [chave]: !dados.config[chave] })
      setVersao(v => v + 1)
      setDados(d => (d ? { ...d, config } : d))
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  if (erro && !dados) return <div className="pl-alert pl-alert-error">{erro}</div>
  if (!dados) return <div className="pl-hint">Carregando…</div>
  const conta = (s: SituacaoMotoVitrine) => dados.motos.filter(m => m.situacao === s).length
  const semFoto = dados.motos.filter(m => m.situacao === 'DISPONIVEL' && m.fotos.length === 0).length

  return (
    <div className="pl-vt" data-vitrine>
      <div className="pl-card pl-vt-topo">
        <div>
          <div className="pl-card-title">Estoque no WhatsApp</div>
          <div className="pl-card-sub">A ficha de cada moto: o assistente responde “tem a XRE?” com ela, e o vendedor manda pelo botão “Enviar moto” na conversa.</div>
          {semFoto > 0 && <div className="pl-hint" style={{ marginTop: 8 }} data-sem-foto>{semFoto} {semFoto === 1 ? 'moto disponível está' : 'motos disponíveis estão'} sem foto: o cliente recebe só a ficha em texto.</div>}
        </div>
        {dados.podeEditar && (
          <div className="pl-vt-chaves">
            <button type="button" role="switch" aria-checked={dados.config.vitrineRobo} className={`pl-as-switch ${dados.config.vitrineRobo ? 'on' : ''}`} onClick={() => alternar('vitrineRobo')} data-chave-robo>
              <span className="pl-as-switch-trilho" aria-hidden="true"><span /></span>
              <span><b>{dados.config.vitrineRobo ? 'Robô mostra o estoque' : 'Robô não mostra o estoque'}</b><small>Responde “tem a XRE?” com a ficha e a foto</small></span>
            </button>
            <button type="button" role="switch" aria-checked={dados.config.mostrarPreco} className={`pl-as-switch ${dados.config.mostrarPreco ? 'on' : ''}`} onClick={() => alternar('mostrarPreco')} data-chave-preco>
              <span className="pl-as-switch-trilho" aria-hidden="true"><span /></span>
              <span><b>{dados.config.mostrarPreco ? 'Preço aparece no WhatsApp' : 'Preço não aparece no WhatsApp'}</b><small>O preço nunca vai para a IA</small></span>
            </button>
          </div>
        )}
      </div>

      <div className="pl-vt-filtros">
        {(Object.keys(SITUACAO) as SituacaoMotoVitrine[]).map(s => (
          <button key={s} type="button" className={`pl-chip ${filtro === s ? 'active' : ''}`} onClick={() => setFiltro(s)}>{FILTRO[s]} · {conta(s)}</button>
        ))}
        <input className="pl-input" type="search" placeholder="Buscar moto" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar moto" />
        {dados.podeEditar && <button type="button" className="pl-btn pl-btn-primary" onClick={() => setEditando('nova')} data-nova-moto>+ Nova moto</button>}
      </div>
      {erro && <div className="pl-alert pl-alert-error">{erro}</div>}

      {motos.length === 0 ? (
        <div className="pl-card pl-empty">{dados.motos.length === 0 ? 'Nenhuma moto no estoque ainda. Cadastre a primeira com “+ Nova moto”.' : 'Nenhuma moto com esse filtro.'}</div>
      ) : (
        <div className="pl-vt-grade-motos">
          {motos.map(m => (
            <div key={m.id} className="pl-card pl-vt-moto" data-moto={m.id}>
              <button type="button" className="pl-vt-moto-capa" onClick={() => setAberta(aberta === m.id ? null : m.id)} aria-expanded={aberta === m.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {m.fotos[0] ? <img src={urlArquivoApi(m.fotos[0])} alt={m.nome} loading="lazy" /> : <span className="pl-vt-sem-foto">Sem foto</span>}
                {m.fotos.length > 1 && <span className="pl-vt-qtd-fotos">{m.fotos.length} fotos</span>}
              </button>
              <div className="pl-vt-moto-corpo">
                <div className="pl-vt-moto-topo">
                  <b>{m.nome}</b>
                  <span className={`pl-status-badge ${SITUACAO[m.situacao].classe}`}>{SITUACAO[m.situacao].rotulo}</span>
                </div>
                <div className="pl-vt-moto-meta">{[m.km !== null ? `${m.km.toLocaleString('pt-BR')} km` : null, m.cilindrada ? `${m.cilindrada} cc` : null, m.cor].filter(Boolean).join(' · ') || 'Ficha incompleta'}</div>
                <div className="pl-vt-moto-rodape">
                  <span>{m.enviosWhatsapp > 0 ? `enviada ${m.enviosWhatsapp}×` : 'ainda não enviada'}</span>
                  {dados.podeEditar && <button type="button" className="pl-link-action pl-vt-link" onClick={() => setEditando(m)}>Editar</button>}
                </div>
                {aberta === m.id && <pre className="pl-vt-previa" data-previa>{m.previa}</pre>}
              </div>
            </div>
          ))}
        </div>
      )}

      {editando && (
        <Editor
          moto={editando === 'nova' ? null : editando}
          mostrarPreco={dados.config.mostrarPreco}
          onFechar={() => setEditando(null)}
          onSalvo={() => { setEditando(null); setVersao(v => v + 1) }}
        />
      )}
    </div>
  )
}
