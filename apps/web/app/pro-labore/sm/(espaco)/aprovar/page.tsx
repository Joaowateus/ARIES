'use client'

// Tela 12 · Aprovação do gestor (seção 11.5, fluxo 3): a fila "Para aprovar"
// com o horário de publicação em destaque, a prévia do post, os metadados
// (legenda, link rastreado, pilar, horário), comentário opcional e os botões
// "Pedir ajuste" e "Aprovar". Feita para o celular: aprovar em 10 segundos.
import { useCallback, useEffect, useRef, useState } from 'react'
import { proLaboreApi, urlArquivoApi, type SmFilaAprovacao, type SmPautaParaAprovar } from '@/lib/proLaboreApi'
import { Botao, BotaoLink, CardEsqueleto, EstadoVazio, PILAR_ROTULO, useToast } from '../../_ui'
import { useEspacoSM } from '../EspacoSM'

const OFF = 3 * 3600e3
const diaLocal = (d: Date) => new Date(d.getTime() - OFF).toISOString().slice(0, 10)
function vaiAoAr(iso: string | null, agora = new Date()): { texto: string; perto: boolean } | null {
  if (!iso) return null
  const d = new Date(iso)
  const l = new Date(d.getTime() - OFF)
  const hora = `${l.getUTCHours()}h${l.getUTCMinutes() ? String(l.getUTCMinutes()).padStart(2, '0') : ''}`
  const hoje = diaLocal(agora)
  const amanha = diaLocal(new Date(agora.getTime() + 864e5))
  const dia = diaLocal(d)
  const quando = dia === hoje ? hora : dia === amanha ? `amanhã ${hora}` : `${dia.slice(8, 10)}/${dia.slice(5, 7)} ${hora}`
  return { texto: `vai ao ar ${quando}`, perto: d.getTime() - agora.getTime() < 3 * 3600e3 }
}

export default function AprovarPage() {
  const { eu } = useEspacoSM()
  const gestor = eu.visao === 'GESTOR' && !eu.verComo
  if (!gestor) {
    return (
      <EstadoVazio titulo="A aprovação é do gestor" acao={<BotaoLink href="/pro-labore/sm/producao">Abrir a Produção</BotaoLink>}>
        As pautas enviadas para aprovação ficam na coluna Aprovação da Produção até o gestor aprovar ou pedir ajuste.
      </EstadoVazio>
    )
  }
  return <FilaDeAprovacao />
}

function FilaDeAprovacao() {
  const toast = useToast()
  const { recarregar } = useEspacoSM()
  const [fila, setFila] = useState<SmFilaAprovacao | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [indice, setIndice] = useState(0)
  const carregar = useCallback(() => {
    proLaboreApi.sm.aprovar.fila().then(f => { setFila(f); setErro(null) }).catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível carregar a fila'))
  }, [])
  useEffect(() => { carregar() }, [carregar])

  if (erro && !fila) return <EstadoVazio titulo="Não foi possível carregar a fila" acao={<Botao onClick={carregar}>Tentar de novo</Botao>}>{erro}</EstadoVazio>
  if (!fila) return <CardEsqueleto linhas={6} texto="Abrindo a fila de aprovação" />

  const n = fila.pautas.length
  const atual = fila.pautas[Math.min(indice, Math.max(0, n - 1))]

  function saiu(id: string, mensagem: string) {
    setFila(f => f && { ...f, pautas: f.pautas.filter(p => p.id !== id) })
    toast({ mensagem })
    recarregar()
  }

  return (
    <div className="sm-aprovar">
      <div className="sm-aprovar-topo">
        <h1 className="sm-aprovar-titulo">Para aprovar · {n}</h1>
        {atual && (() => { const h = vaiAoAr(atual.agendadoPara); return h && <span className={`sm-aprovar-hora${h.perto ? ' perto' : ''}`}>{h.texto}</span> })()}
      </div>
      {!fila.regraLigada && <p className="sm-legenda">A regra de aprovação está desligada: as pautas novas vão direto para Agendado.</p>}
      {!atual ? (
        <EstadoVazio titulo="Nada para aprovar" acao={<BotaoLink href="/pro-labore/sm/producao">Abrir a Produção</BotaoLink>}>
          Quando o Social Media enviar uma pauta para aprovação, ela aparece aqui e no seu celular.
        </EstadoVazio>
      ) : (
        <>
          <CartaoAprovacao key={atual.id} pauta={atual} aoSair={saiu} aoMudar={carregar} />
          {n > 1 && (
            <div className="sm-aprovar-pager">
              <Botao variante="fantasma" disabled={indice <= 0} onClick={() => setIndice(i => Math.max(0, i - 1))}>Anterior</Botao>
              <span className="sm-legenda">{Math.min(indice, n - 1) + 1} de {n}</span>
              <Botao variante="fantasma" disabled={indice >= n - 1} onClick={() => setIndice(i => Math.min(n - 1, i + 1))}>Próxima</Botao>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function CartaoAprovacao({ pauta, aoSair, aoMudar }: { pauta: SmPautaParaAprovar; aoSair: (id: string, mensagem: string) => void; aoMudar: () => void }) {
  const toast = useToast()
  const [tela, setTela] = useState(0)
  const [comentario, setComentario] = useState('')
  const [verLegenda, setVerLegenda] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const campo = useRef<HTMLInputElement>(null)
  const telas = pauta.previa.length ? pauta.previa : pauta.capa ? [{ id: 'capa', tipo: 'IMAGEM' as const, url: pauta.capa.url }] : []
  const midia = telas[tela] ?? null
  const meta = [
    pauta.legendaCaracteres ? `Legenda com ${pauta.legendaCaracteres} caracteres` : 'Sem legenda',
    pauta.linkSlug ? 'link rastreado' : null,
    `pilar ${PILAR_ROTULO[pauta.pilar]}`,
    pauta.horario === 'TESTE' ? 'horário em teste' : pauta.horario === 'PICO' ? 'horário de pico' : null,
    pauta.trial ? 'Trial Reel' : null,
  ].filter(Boolean).join(' · ')

  async function aprovar() {
    setOcupado(true)
    try {
      await proLaboreApi.sm.pautas.aprovar(pauta.id, comentario.trim() || undefined)
      aoSair(pauta.id, `Aprovada: ${pauta.titulo}. Agendada para o horário.`)
    } catch (e) {
      toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível aprovar', tom: 'bad' })
      aoMudar()
    } finally { setOcupado(false) }
  }
  async function pedirAjuste() {
    if (comentario.trim().length < 3) {
      toast({ mensagem: 'Diga o que precisa ajustar no comentário.', tom: 'bad' })
      campo.current?.focus()
      return
    }
    setOcupado(true)
    try {
      await proLaboreApi.sm.pautas.pedirAjuste(pauta.id, comentario.trim())
      aoSair(pauta.id, 'Ajuste pedido. A pauta voltou para Edição.')
    } catch (e) { toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível pedir ajuste', tom: 'bad' }) } finally { setOcupado(false) }
  }

  return (
    <article className="sm-aprovar-cartao" aria-label={`Pauta para aprovar: ${pauta.titulo}`}>
      <div className="sm-aprovar-previa">
        {midia && (midia.tipo === 'IMAGEM'
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={urlArquivoApi(midia.url)} alt={`Tela ${tela + 1} do post`} />
          : <video src={midia.url} controls playsInline preload="metadata" aria-label="Vídeo do post" />)}
        <div className="sm-aprovar-previa-texto">
          <span>{pauta.formatoRotulo}{telas.length > 1 ? ` · tela ${tela + 1} de ${telas.length}` : ''}</span>
          <b className="sm-ttl">{pauta.titulo}</b>
        </div>
        {telas.length > 1 && (
          <div className="sm-aprovar-telas">
            <button type="button" className="sm-btn icone" aria-label="Tela anterior" disabled={tela === 0} onClick={() => setTela(t => t - 1)}>‹</button>
            <button type="button" className="sm-btn icone" aria-label="Próxima tela" disabled={tela >= telas.length - 1} onClick={() => setTela(t => t + 1)}>›</button>
          </div>
        )}
      </div>
      <div className="sm-aprovar-meta">{meta}</div>
      {pauta.legenda && (
        <div>
          <button type="button" className="sm-link-botao" aria-expanded={verLegenda} onClick={() => setVerLegenda(v => !v)}>{verLegenda ? 'Esconder a legenda' : 'Ler a legenda'}</button>
          {verLegenda && <p className="sm-aprovar-legenda">{pauta.legenda}</p>}
        </div>
      )}
      {pauta.pendencias.length > 0 && <div className="sm-status warn" role="status">Antes de aprovar: {pauta.pendencias.join(' · ').toLowerCase()}.</div>}
      <label className="sm-campo">Comentário (opcional)
        <input ref={campo} className="sm-input" value={comentario} onChange={e => setComentario(e.target.value)} maxLength={500} placeholder="Ex.: trocar a foto da tela 3" />
      </label>
      <div className="sm-aprovar-botoes">
        <Botao onClick={pedirAjuste} disabled={ocupado}>Pedir ajuste</Botao>
        <Botao variante="pri" onClick={aprovar} disabled={ocupado || pauta.pendencias.length > 0}>Aprovar</Botao>
      </div>
    </article>
  )
}
