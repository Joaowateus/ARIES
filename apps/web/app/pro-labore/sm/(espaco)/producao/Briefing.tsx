'use client'

// Briefing da pauta selecionada (seção 6): gancho, retenção, recompensa e
// CTA, legenda, data, arquivos, checklist antes de aprovar e as ações
// (Trial Reel, enviar para aprovação, aprovar ou pedir ajuste). Cada campo
// salva ao sair dele.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { proLaboreApi, urlArquivoApi, type SmTesteAB, type SmColuna, type SmFormato, type SmMoto, type SmPauta, type SmPautaEntrada, type SmPilar, type SmRoteiroIA } from '@/lib/proLaboreApi'
import {
  Banner, Botao, Chip, COLUNA_ROTULO, COLUNAS, FORMATO_ROTULO, IcFechar, ORIGEM_ROTULO, PILAR_CHIP, PILAR_ROTULO, Rotulo,
  dataParaIso, isoParaData, isoParaLocal, localParaIso, quandoCurto, useToast,
} from '../../_ui'
import { BibliotecaGanchos } from './Ganchos'
import { UsarDoAcervo } from './UsarDoAcervo'
import { useEspacoSM } from '../EspacoSM'

type Campo = 'titulo' | 'gancho' | 'retencao' | 'recompensa' | 'cta' | 'legenda'

const BLOCOS: Array<{ campo: Campo; rotulo: string; dica: string; cta?: boolean }> = [
  { campo: 'gancho', rotulo: 'Gancho · 0 a 3s', dica: 'A primeira frase ou imagem que segura o dedo' },
  { campo: 'retencao', rotulo: 'Retenção · meio', dica: 'O que mantém a pessoa até o fim' },
  { campo: 'recompensa', rotulo: 'Recompensa · final', dica: 'O que ela leva de valor' },
  { campo: 'cta', rotulo: 'Chamada para ação', dica: 'O que ela deve fazer agora', cta: true },
]

export function Briefing({ pauta, podeEditar, souGestor, regraAprovacao, motos, aoAtualizar, aoExcluir, aoMover }: {
  pauta: SmPauta
  podeEditar: boolean
  souGestor: boolean
  regraAprovacao: boolean
  motos: SmMoto[] | null
  aoAtualizar: (p: SmPauta) => void
  aoExcluir: (id: string) => void
  aoMover: (id: string, coluna: SmColuna) => Promise<boolean>
}) {
  const toast = useToast()
  const [textos, setTextos] = useState<Record<Campo, string>>(() => ({
    titulo: pauta.titulo, gancho: pauta.gancho ?? '', retencao: pauta.retencao ?? '', recompensa: pauta.recompensa ?? '', cta: pauta.cta ?? '', legenda: pauta.legenda ?? '',
  }))
  const [ocupado, setOcupado] = useState(false)
  // Itens manuais do checklist mudam na hora; o servidor confirma depois.
  const [manual, setManual] = useState<Record<string, boolean>>(() => ({ ...pauta.checklistManual }))
  const [linkVideo, setLinkVideo] = useState('')
  const [biblioteca, setBiblioteca] = useState(false)
  const [acervoAberto, setAcervoAberto] = useState(false)
  // Ganchos e roteiro pela IA (seção 16.3), com a regra "Assistente de roteiro com IA" ligada.
  const { eu } = useEspacoSM()
  const [ia, setIa] = useState<{ carregando: boolean; r: SmRoteiroIA | null }>({ carregando: false, r: null })
  const [pedindoAjuste, setPedindoAjuste] = useState(false)
  const [comentario, setComentario] = useState('')
  const arquivo = useRef<HTMLInputElement>(null)
  const termo = useRef<HTMLInputElement>(null)

  const travada = !podeEditar || pauta.status === 'PUBLICADO' || pauta.publicacaoStatus === 'PROCESSANDO'
  const avisar = (e: unknown) => toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível salvar', tom: 'bad' })

  async function salvar(dados: Partial<SmPautaEntrada>) {
    try { aoAtualizar(await proLaboreApi.sm.pautas.atualizar(pauta.id, dados)) } catch (e) { avisar(e) }
  }

  function aoSairDoCampo(campo: Campo) {
    const valor = textos[campo].trim()
    const atual = (pauta[campo] ?? '').trim()
    if (valor === atual) return
    if (campo === 'titulo' && valor.length < 3) { setTextos(t => ({ ...t, titulo: pauta.titulo })); return }
    salvar({ [campo]: valor || null })
  }

  async function gerarComIA() {
    setIa({ carregando: true, r: null })
    try { setIa({ carregando: false, r: await proLaboreApi.sm.pautas.roteiroIA(pauta.id) }) } catch (e) { avisar(e); setIa({ carregando: false, r: null }) }
  }

  function usarRoteiro(r: SmRoteiroIA) {
    const antes = { retencao: textos.retencao, recompensa: textos.recompensa, cta: textos.cta }
    const novo = { retencao: r.retencao || antes.retencao, recompensa: r.recompensa || antes.recompensa, cta: r.cta || antes.cta }
    setTextos(t => ({ ...t, ...novo }))
    salvar({ retencao: novo.retencao || null, recompensa: novo.recompensa || null, cta: novo.cta || null })
    toast({ mensagem: 'Roteiro aplicado.', desfazer: async () => { setTextos(t => ({ ...t, ...antes })); await salvar({ retencao: antes.retencao || null, recompensa: antes.recompensa || null, cta: antes.cta || null }) } })
  }

  async function acao(fn: () => Promise<SmPauta>, mensagem?: string) {
    setOcupado(true)
    try {
      const p = await fn()
      aoAtualizar(p)
      if (mensagem) toast({ mensagem })
      return true
    } catch (e) { avisar(e); return false } finally { setOcupado(false) }
  }

  async function enviarArquivo(lista: FileList | null, tipo: 'IMAGEM' | 'TERMO') {
    const f = lista?.[0]
    if (!f) return
    if (f.size > 4 * 1024 * 1024) { toast({ mensagem: 'Arquivo acima de 4 MB', tom: 'bad' }); return }
    await acao(() => proLaboreApi.sm.pautas.enviarImagem(pauta.id, f, tipo), tipo === 'TERMO' ? 'Termo anexado.' : 'Imagem enviada.')
  }

  const imagensEVideos = pauta.midias.filter(m => m.tipo === 'IMAGEM' || m.tipo === 'VIDEO')
  const tomadas = pauta.midias.filter(m => m.tipo === 'TOMADA').sort((a, b) => (a.tomada ?? 0) - (b.tomada ?? 0))
  const naCaptura = ['IDEIA', 'ROTEIRO', 'GRAVACAO', 'EDICAO'].includes(pauta.status)
  const termos = pauta.midias.filter(m => m.tipo === 'TERMO')
  const aguardandoGestor = pauta.status === 'APROVACAO' && pauta.aprovacao === 'PENDENTE'
  const fechada = pauta.status === 'AGENDADO' || pauta.status === 'PUBLICADO'
  const podeEnviar = podeEditar && !souGestor && regraAprovacao && !fechada && pauta.status !== 'APROVACAO'
  const podeAgendar = podeEditar && (souGestor || !regraAprovacao) && !fechada && !aguardandoGestor

  return (
    <aside aria-label="Briefing" className="sm-card sm-briefing">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Rotulo>Briefing · {pauta.status === 'PUBLICADO' ? 'Publicado' : COLUNA_ROTULO[pauta.status]}</Rotulo>
        <label className="sm-sr" htmlFor="briefing-titulo">Título da pauta</label>
        <textarea
          id="briefing-titulo"
          className="sm-campo-livre sm-ttl"
          style={{ fontSize: 20, lineHeight: 1.25, fontWeight: 800 }}
          value={textos.titulo}
          readOnly={travada}
          rows={1}
          onChange={e => setTextos(t => ({ ...t, titulo: e.target.value.replace(/\n/g, ' ') }))}
          onBlur={() => aoSairDoCampo('titulo')}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Chip pilar={PILAR_CHIP[pauta.pilar]}>{PILAR_ROTULO[pauta.pilar]}</Chip>
          <Chip>{FORMATO_ROTULO[pauta.formato]}</Chip>
          <Chip>Origem: {ORIGEM_ROTULO[pauta.origem]}</Chip>
          {pauta.trial && <Chip tom="info">Trial Reel</Chip>}
          {pauta.codigo && <Chip tom="learn">{pauta.codigo}</Chip>}
        </div>
        {naCaptura && (
          <Link href={`/pro-labore/sm/captura?pauta=${pauta.id}`} className="sm-link-botao">
            {pauta.status === 'GRAVACAO' || pauta.status === 'EDICAO' ? 'Abrir a captura (tomadas)' : 'Gravar na loja pela câmera'}
          </Link>
        )}
      </div>

      {pauta.aprovacao === 'AJUSTE' && pauta.comentarioAprovacao && (
        <Banner tom="warn" titulo="Ajuste pedido pelo gestor">{pauta.comentarioAprovacao}</Banner>
      )}
      {aguardandoGestor && !souGestor && <Banner tom="info" titulo="Aguardando aprovação do gestor">Ele foi avisado. Se mudar o conteúdo agora, ele vê a versão nova.</Banner>}
      {pauta.status === 'AGENDADO' && pauta.publicacaoStatus !== 'FALHA' && pauta.agendadoPara && (
        <Banner tom="ok" titulo={pauta.publicacaoStatus === 'PROCESSANDO' ? 'Publicando agora' : `Vai ao ar ${quandoCurto(pauta.agendadoPara)}`}>
          {pauta.aprovacao === 'APROVADA' ? `Aprovada${pauta.comentarioAprovacao ? `: “${pauta.comentarioAprovacao}”` : '.'} ` : ''}Publicação automática pela API, com o código na legenda.
        </Banner>
      )}
      {pauta.publicacaoStatus === 'FALHA' && (
        <Banner tom="warn" titulo="Não foi publicada" acao={podeEditar ? <Botao disabled={ocupado} onClick={() => acao(() => proLaboreApi.sm.pautas.republicar(pauta.id), 'Vai tentar de novo em até 5 minutos.')}>Tentar de novo</Botao> : undefined}>
          {pauta.publicacaoErro}
        </Banner>
      )}
      {pauta.status === 'PUBLICADO' && (
        <Banner tom="ok" titulo={`Publicada ${pauta.publicadaEm ? quandoCurto(pauta.publicadaEm) : ''}`}>
          {pauta.permalink ? <a href={pauta.permalink} target="_blank" rel="noreferrer">Ver no Instagram</a> : 'No ar.'}
        </Banner>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {BLOCOS.map(b => (
          <div key={b.campo} className={`sm-bloco${b.cta ? ' cta' : ''}`}>
            <label className="sm-mono" htmlFor={`briefing-${b.campo}`}>{b.rotulo}</label>
            <textarea
              id={`briefing-${b.campo}`}
              value={textos[b.campo]}
              placeholder={travada ? '—' : b.dica}
              readOnly={travada}
              rows={1}
              onChange={e => setTextos(t => ({ ...t, [b.campo]: e.target.value }))}
              onBlur={() => aoSairDoCampo(b.campo)}
            />
            {b.campo === 'gancho' && !travada && (
              <span className="sm-bloco-links">
                <button type="button" className="sm-link-botao" onClick={() => setBiblioteca(true)}>Usar um gancho da biblioteca</button>
                {eu.ia.roteiro && <button type="button" className="sm-link-botao" disabled={ia.carregando} onClick={gerarComIA}>{ia.carregando ? 'Escrevendo…' : 'Gerar ganchos com IA'}</button>}
              </span>
            )}
          </div>
        ))}
        {ia.r && (
          <section className="sm-ia-roteiro" aria-label="Sugestões da IA">
            <div className="sm-ia-roteiro-cab">
              <span className="sm-mono">Sugestões da IA</span>
              <button type="button" className="sm-link-botao" onClick={() => setIa({ carregando: false, r: null })}>Fechar</button>
            </div>
            {ia.r.ganchos.map(g => (
              <div key={g} className="sm-ia-gancho">
                <span>{g}</span>
                <Botao variante="fantasma" disabled={travada} onClick={() => { setTextos(t => ({ ...t, gancho: g })); salvar({ gancho: g }) }}>Usar</Botao>
              </div>
            ))}
            {(ia.r.retencao || ia.r.recompensa || ia.r.cta) && (
              <div className="sm-ia-resto">
                {ia.r.retencao && <p><b>Retenção:</b> {ia.r.retencao}</p>}
                {ia.r.recompensa && <p><b>Recompensa:</b> {ia.r.recompensa}</p>}
                {ia.r.cta && <p><b>Chamada:</b> {ia.r.cta}</p>}
                <Botao disabled={travada} onClick={() => usarRoteiro(ia.r!)}>Usar no roteiro</Botao>
              </div>
            )}
            <span className="sm-legenda">Escrito pela IA a partir da pauta e da ficha da moto, sem preço nem condição. Revise antes de gravar.</span>
          </section>
        )}
        {biblioteca && <BibliotecaGanchos aoFechar={() => setBiblioteca(false)} aoEscolher={texto => { setTextos(t => ({ ...t, gancho: texto })); salvar({ gancho: texto }) }} />}
        <div className="sm-bloco">
          <label className="sm-mono" htmlFor="briefing-legenda" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Legenda</span><span style={{ color: textos.legenda.trim().length >= 300 ? 'var(--sm-ok-fg)' : 'var(--sm-text-faint)' }}>{textos.legenda.trim().length} / 300+</span>
          </label>
          <textarea id="briefing-legenda" value={textos.legenda} placeholder={travada ? '—' : 'Texto que vai no post (o código entra sozinho no fim)'} readOnly={travada} rows={3}
            onChange={e => setTextos(t => ({ ...t, legenda: e.target.value }))} onBlur={() => aoSairDoCampo('legenda')} />
        </div>
      </div>

      {pauta.codigo && pauta.linkSlug && <LinkDoPost codigo={pauta.codigo} slug={pauta.linkSlug} />}

      <div className="sm-grade-2">
        <label className="sm-campo">Publicação (Brasília)
          <input className="sm-input" type="datetime-local" disabled={travada} defaultValue={isoParaLocal(pauta.agendadoPara)}
            onBlur={e => { const iso = localParaIso(e.target.value); if (iso !== pauta.agendadoPara) salvar({ agendadoPara: iso }) }} />
        </label>
        <label className="sm-campo">Prazo da produção
          <input className="sm-input" type="date" disabled={travada} defaultValue={isoParaData(pauta.prazo)}
            onBlur={e => { const iso = dataParaIso(e.target.value); if (isoParaData(iso) !== isoParaData(pauta.prazo)) salvar({ prazo: iso }) }} />
        </label>
        <label className="sm-campo">Pilar
          <select className="sm-input" disabled={travada} value={pauta.pilar} onChange={e => salvar({ pilar: e.target.value as SmPilar })}>
            {(Object.keys(PILAR_ROTULO) as SmPilar[]).map(p => <option key={p} value={p}>{PILAR_ROTULO[p]}</option>)}
          </select>
        </label>
        <label className="sm-campo">Formato
          <select className="sm-input" disabled={travada} value={pauta.formato} onChange={e => salvar({ formato: e.target.value as SmFormato })}>
            {(Object.keys(FORMATO_ROTULO) as SmFormato[]).map(f => <option key={f} value={f}>{FORMATO_ROTULO[f]}</option>)}
          </select>
        </label>
        {motos && (
          <label className="sm-campo" style={{ gridColumn: '1 / -1' }}>Moto do estoque
            <select className="sm-input" disabled={travada} value={pauta.motoId ?? ''} onChange={e => salvar({ motoId: e.target.value || null })}>
              <option value="">Nenhuma</option>
              {pauta.moto && !motos.some(m => m.id === pauta.moto!.id) && <option value={pauta.moto.id}>{pauta.moto.modelo}</option>}
              {motos.filter(m => m.situacao !== 'VENDIDA' || m.id === pauta.motoId).map(m => <option key={m.id} value={m.id}>{m.modelo}{m.ano ? ` ${m.ano}` : ''}{m.cor ? ` · ${m.cor}` : ''} · {m.diasEmEstoque} dias</option>)}
            </select>
          </label>
        )}
      </div>

      <TesteDaPauta pauta={pauta} travada={travada} salvar={salvar} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Rotulo>Arquivos</Rotulo>
        {tomadas.length > 0 && (
          <span className="sm-legenda">
            Tomadas da captura (para a edição):{' '}
            {tomadas.map((m, i) => <span key={m.id}>{i > 0 && ' · '}<a href={/^https?:/.test(m.url) ? m.url : urlArquivoApi(m.url)} target="_blank" rel="noreferrer">Tomada {m.tomada}</a></span>)}
          </span>
        )}
        {imagensEVideos.length > 0 && (
          <div className="sm-arquivos">
            {imagensEVideos.map(m => (
              <div key={m.id} className="sm-arquivo" title={m.url}>
                {m.tipo === 'IMAGEM'
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={urlArquivoApi(m.url)} alt="Imagem da pauta" />
                  : <span>Vídeo</span>}
                {!travada && <button type="button" aria-label={m.tipo === 'IMAGEM' ? 'Remover imagem' : 'Remover vídeo'} onClick={() => acao(() => proLaboreApi.sm.pautas.removerMidia(pauta.id, m.id))}><IcFechar tamanho={14} /></button>}
              </div>
            ))}
          </div>
        )}
        {!travada && (
          <>
            <div className="sm-linha-acoes">
              <input ref={arquivo} type="file" accept="image/jpeg" hidden onChange={e => { enviarArquivo(e.target.files, 'IMAGEM'); e.target.value = '' }} />
              <Botao disabled={ocupado} onClick={() => arquivo.current?.click()}>Enviar imagem (JPEG)</Botao>
              <Botao variante="fantasma" disabled={ocupado} onClick={() => setAcervoAberto(true)}>Usar do acervo</Botao>
            </div>
            {acervoAberto && (
              <UsarDoAcervo motoId={pauta.motoId} jaNaPauta={pauta.midias.map(m => m.url)} aoFechar={() => setAcervoAberto(false)}
                aoUsar={async a => { if (await acao(() => proLaboreApi.sm.pautas.usarDoAcervo(pauta.id, a.id), 'Arquivo do acervo na pauta.')) setAcervoAberto(false) }} />
            )}
            <form className="sm-linha-acoes" onSubmit={async e => { e.preventDefault(); if (await acao(() => proLaboreApi.sm.pautas.adicionarLink(pauta.id, 'VIDEO', linkVideo), 'Vídeo adicionado.')) setLinkVideo('') }}>
              <label className="sm-sr" htmlFor="briefing-video">Link público do vídeo</label>
              <input id="briefing-video" className="sm-input" style={{ flex: '1 1 180px' }} type="url" placeholder="https:// link público do vídeo" value={linkVideo} onChange={e => setLinkVideo(e.target.value)} />
              <Botao type="submit" disabled={ocupado || !linkVideo}>Adicionar vídeo</Botao>
            </form>
          </>
        )}
        {pauta.pendencias.length > 0 && pauta.status !== 'PUBLICADO' && <span className="sm-legenda">Para publicar: {pauta.pendencias.join(' · ')}.</span>}
      </div>

      {pauta.pilar === 'PROVA' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Rotulo>Autorização de imagem do cliente</Rotulo>
          <label className="sm-check"><input type="checkbox" disabled={travada} checked={pauta.autorizacaoImagem} onChange={e => salvar({ autorizacaoImagem: e.target.checked })} /> Cliente autorizou o uso da imagem</label>
          <div className="sm-linha-acoes" style={{ alignItems: 'center' }}>
            {termos.length > 0 && <a href={urlArquivoApi(termos[0].url)} target="_blank" rel="noreferrer">Ver termo assinado</a>}
            {!travada && (
              <>
                <input ref={termo} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => { enviarArquivo(e.target.files, 'TERMO'); e.target.value = '' }} />
                <Botao variante="fantasma" disabled={ocupado} onClick={() => termo.current?.click()}>{termos.length ? 'Trocar foto do termo' : 'Anexar foto do termo'}</Botao>
              </>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Rotulo>Checklist antes de aprovar</Rotulo>
        {pauta.checklist.map(i => (
          <label key={i.chave} className={`sm-check${i.automatico ? ' auto' : ''}`}>
            <input
              type="checkbox"
              checked={i.automatico ? !!i.ok : !!manual[i.chave]}
              disabled={i.automatico || travada}
              aria-describedby={i.detalhe ? `ck-${i.chave}` : undefined}
              onChange={e => { const v = e.target.checked; setManual(m => ({ ...m, [i.chave]: v })); salvar({ checklist: { [i.chave]: v } }) }}
            />
            <span>{i.rotulo}{i.detalhe && <small id={`ck-${i.chave}`}>{i.detalhe}</small>}</span>
          </label>
        ))}
      </div>

      {souGestor && aguardandoGestor && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pedindoAjuste ? (
            <form style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={async e => {
              e.preventDefault()
              if (await acao(() => proLaboreApi.sm.pautas.pedirAjuste(pauta.id, comentario), 'Ajuste pedido. O Social Media foi avisado.')) { setPedindoAjuste(false); setComentario('') }
            }}>
              <label className="sm-campo">O que precisa ajustar
                <textarea className="sm-input" value={comentario} onChange={e => setComentario(e.target.value)} required minLength={3} maxLength={500} />
              </label>
              <div className="sm-linha-acoes">
                <Botao type="submit" variante="pri" disabled={ocupado}>Enviar pedido de ajuste</Botao>
                <Botao variante="fantasma" onClick={() => setPedindoAjuste(false)}>Cancelar</Botao>
              </div>
            </form>
          ) : (
            <>
              <label className="sm-campo">Comentário (opcional)
                <input className="sm-input" value={comentario} onChange={e => setComentario(e.target.value)} maxLength={500} />
              </label>
              <div className="sm-linha-acoes">
                <Botao onClick={() => setPedindoAjuste(true)}>Pedir ajuste</Botao>
                <Botao variante="pri" disabled={ocupado} onClick={() => acao(() => proLaboreApi.sm.pautas.aprovar(pauta.id, comentario || undefined), 'Aprovada e agendada.')}>Aprovar</Botao>
              </div>
            </>
          )}
        </div>
      )}

      {podeEditar && pauta.status !== 'PUBLICADO' && (
        <div className="sm-linha-acoes">
          {pauta.formato === 'REELS' && !fechada && !aguardandoGestor && (
            <Botao disabled={ocupado} onClick={() => acao(() => proLaboreApi.sm.pautas.trial(pauta.id), souGestor || !regraAprovacao ? 'Trial Reel agendado.' : 'Enviada para aprovação como Trial Reel.')}>Testar como Trial Reel</Botao>
          )}
          {podeEnviar && <Botao variante="pri" disabled={ocupado} onClick={() => aoMover(pauta.id, 'APROVACAO')}>Enviar para aprovação</Botao>}
          {podeAgendar && <Botao variante="pri" disabled={ocupado} onClick={() => aoMover(pauta.id, 'AGENDADO')}>Agendar</Botao>}
        </div>
      )}

      {podeEditar && pauta.status !== 'PUBLICADO' && (
        <div className="sm-linha-acoes" style={{ alignItems: 'flex-end', borderTop: '1px solid var(--sm-divider)', paddingTop: 14 }}>
          <label className="sm-campo" style={{ flex: '1 1 160px' }}>Mover para
            <select className="sm-input" value={pauta.status} disabled={travada} onChange={e => aoMover(pauta.id, e.target.value as SmColuna)}>
              {COLUNAS.map(c => <option key={c} value={c}>{COLUNA_ROTULO[c]}</option>)}
            </select>
          </label>
          <Botao variante="fantasma" disabled={travada} onClick={async () => {
            if (!window.confirm(`Excluir a pauta “${pauta.titulo}”?`)) return
            try { await proLaboreApi.sm.pautas.excluir(pauta.id); aoExcluir(pauta.id); toast({ mensagem: 'Pauta excluída.' }) } catch (e) { avisar(e) }
          }}>Excluir pauta</Botao>
        </div>
      )}
    </aside>
  )
}

const assinarNada = () => () => {}

/** Link rastreado da pauta (seção 3.5): vai na bio, no story ou no direct. */
function LinkDoPost({ codigo, slug }: { codigo: string; slug: string }) {
  const toast = useToast()
  const origem = useSyncExternalStore(assinarNada, () => window.location.origin, () => '')
  const url = `${origem}/r/${slug}`
  async function copiar() {
    try { await navigator.clipboard.writeText(url); toast({ mensagem: 'Link rastreado copiado.' }) } catch { toast({ mensagem: 'Não deu para copiar; selecione o link e copie.', tom: 'bad' }) }
  }
  return (
    <div className="sm-atrib-link">
      <div>
        <span className="sm-legenda">Link rastreado · abre o WhatsApp da loja com {codigo}</span>
        <code>{url}</code>
      </div>
      <Botao onClick={copiar}>Copiar link</Botao>
    </div>
  )
}

/** Teste A/B da pauta (seção 13.3): escolhe o teste em andamento e o grupo. */
function TesteDaPauta({ pauta, travada, salvar }: { pauta: SmPauta; travada: boolean; salvar: (d: Partial<SmPautaEntrada>) => Promise<void> }) {
  const [ativos, setAtivos] = useState<SmTesteAB[] | null>(null)
  useEffect(() => {
    let vivo = true
    // Sem acesso à Análise, a lista não vem e o bloco mostra só o teste atual da pauta.
    proLaboreApi.sm.testes.listar().then(r => { if (vivo) setAtivos(r.ativos) }).catch(() => { if (vivo) setAtivos([]) })
    return () => { vivo = false }
  }, [])
  const atual = pauta.teste && pauta.teste.status !== 'CANCELADO' ? pauta.teste : null
  if (!atual && (travada || !ativos?.length)) return null
  const teste = ativos?.find(t => t.id === pauta.testeId)
  return (
    <div className="sm-bloco sm-teste-pauta">
      <span className="sm-mono">Teste A/B</span>
      {atual && <span>{atual.hipotese} · grupo <b>{pauta.testeGrupo}</b> ({pauta.testeGrupo === 'A' ? atual.grupoA : atual.grupoB})</span>}
      {!travada && ativos && ativos.length > 0 && (
        <div className="sm-linha-acoes">
          <select className="sm-input" aria-label="Teste A/B" style={{ flex: '1 1 200px' }} value={pauta.testeId ?? ''}
            onChange={e => salvar(e.target.value ? { testeId: e.target.value, testeGrupo: pauta.testeGrupo ?? 'A' } : { testeId: null, testeGrupo: null })}>
            <option value="">Fora de teste</option>
            {ativos.map(t => <option key={t.id} value={t.id}>{t.hipotese}</option>)}
          </select>
          {pauta.testeId && teste && (['A', 'B'] as const).map(g => (
            <Botao key={g} variante={pauta.testeGrupo === g ? 'pri' : 'sec'} aria-pressed={pauta.testeGrupo === g} onClick={() => salvar({ testeId: pauta.testeId, testeGrupo: g })}>
              {g}: {g === 'A' ? teste.grupoA : teste.grupoB}
            </Botao>
          ))}
        </div>
      )}
    </div>
  )
}
