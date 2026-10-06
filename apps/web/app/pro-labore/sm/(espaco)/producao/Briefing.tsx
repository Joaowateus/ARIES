'use client'

// Briefing da pauta selecionada (seção 6): gancho, retenção, recompensa e
// CTA, legenda, data, arquivos, checklist antes de aprovar e as ações
// (Trial Reel, enviar para aprovação, aprovar ou pedir ajuste). Cada campo
// salva ao sair dele.
import { useRef, useState } from 'react'
import { proLaboreApi, urlArquivoApi, type SmColuna, type SmFormato, type SmMoto, type SmPauta, type SmPautaEntrada, type SmPilar } from '@/lib/proLaboreApi'
import {
  Banner, Botao, Chip, COLUNA_ROTULO, COLUNAS, FORMATO_ROTULO, IcFechar, ORIGEM_ROTULO, PILAR_CHIP, PILAR_ROTULO, Rotulo,
  dataParaIso, isoParaData, isoParaLocal, localParaIso, quandoCurto, useToast,
} from '../../_ui'

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
          </div>
        ))}
        <div className="sm-bloco">
          <label className="sm-mono" htmlFor="briefing-legenda" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Legenda</span><span style={{ color: textos.legenda.trim().length >= 300 ? 'var(--sm-ok-fg)' : 'var(--sm-text-faint)' }}>{textos.legenda.trim().length} / 300+</span>
          </label>
          <textarea id="briefing-legenda" value={textos.legenda} placeholder={travada ? '—' : 'Texto que vai no post (o código entra sozinho no fim)'} readOnly={travada} rows={3}
            onChange={e => setTextos(t => ({ ...t, legenda: e.target.value }))} onBlur={() => aoSairDoCampo('legenda')} />
        </div>
      </div>

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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Rotulo>Arquivos</Rotulo>
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
            </div>
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
