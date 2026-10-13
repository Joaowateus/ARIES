'use client'

// D. Um vídeo do calendário inteiro: ficha estratégica, roteiro completo
// (editável até ir para a Produção), aprovação, confirmação comercial,
// prova, produção, publicação, métricas, resultado e aprendizado.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { proLaboreApi, type CtCiclo, type CtProva, type CtVideoCompleto } from '@/lib/proLaboreApi'
import { Banner, Botao, Chip, Modal, useToast } from '../../_ui'
import { ALVO_TIPO, ETAPA_NOME, ORIGEM_ROTEIRO, PERIODO_NOME, STATUS_ROTULO, STATUS_TOM, chegou, ddmm, diaSemana, num } from './rotulos'

type Texto = 'titulo' | 'gancho' | 'contexto' | 'desenvolvimento' | 'valor' | 'cta' | 'gravacao' | 'legenda'
const BLOCOS: Array<{ campo: Texto; rotulo: string; linhas: number }> = [
  { campo: 'titulo', rotulo: 'Título do vídeo', linhas: 1 }, { campo: 'gancho', rotulo: 'A · Gancho (1 a 3 primeiros segundos)', linhas: 2 },
  { campo: 'contexto', rotulo: 'B · Contexto', linhas: 3 }, { campo: 'desenvolvimento', rotulo: 'C · Desenvolvimento', linhas: 4 },
  { campo: 'valor', rotulo: 'D · Valor', linhas: 2 }, { campo: 'cta', rotulo: 'E · CTA', linhas: 1 }, { campo: 'gravacao', rotulo: 'F · Gravação', linhas: 3 },
  { campo: 'legenda', rotulo: 'G · Legenda para publicação', linhas: 5 },
]

export function VideoModal({ id, dados, aoFechar, aoMudar, aoAbrir }: { id: string; dados: CtCiclo; aoFechar: () => void; aoMudar: () => void; aoAbrir: (id: string) => void }) {
  const toast = useToast()
  const [v, setV] = useState<CtVideoCompleto | null>(null)
  const [form, setForm] = useState<Record<Texto, string> & { cenas: string; textosTela: string; duracaoSeg: number }>()
  const [provas, setProvas] = useState<CtProva[]>([])
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const carregarForm = (x: CtVideoCompleto) => setForm({ titulo: x.titulo, gancho: x.gancho, contexto: x.contexto, desenvolvimento: x.desenvolvimento, valor: x.valor, cta: x.cta, gravacao: x.gravacao, legenda: x.legenda, cenas: x.cenas.join('\n'), textosTela: x.textosTela.join('\n'), duracaoSeg: x.duracaoSeg })
  useEffect(() => {
    let ativo = true
    proLaboreApi.sm.central.video(id).then(x => { if (ativo) { setV(x); carregarForm(x) } }).catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível abrir'))
    proLaboreApi.sm.central.provas().then(p => { if (ativo) setProvas(p) }).catch(() => undefined)
    return () => { ativo = false }
  }, [id])

  async function acao<T>(f: () => Promise<T>, ok: string): Promise<T | null> {
    setOcupado(true); setErro(null)
    try { const r = await f(); toast({ mensagem: ok }); aoMudar(); return r } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível'); return null } finally { setOcupado(false) }
  }
  const atualizar = (x: CtVideoCompleto | null) => { if (x) { setV(x); carregarForm(x) } }

  if (!v || !form) return <Modal titulo="Vídeo" aoFechar={aoFechar} largo>{erro ? <p className="sm-erro">{erro}</p> : <p className="sm-legenda">Abrindo…</p>}</Modal>

  const aberto = ['RASCUNHO', 'APROVADO'].includes(dados.ciclo.status)
  const pode = dados.podeEditar && aberto
  const editavel = pode && !v.pautaId
  const mudou = BLOCOS.some(b => form[b.campo] !== v[b.campo]) || form.cenas !== v.cenas.join('\n') || form.textosTela !== v.textosTela.join('\n') || form.duracaoSeg !== v.duracaoSeg
  const pendente = v.pendenteConfirmacao && !v.confirmadoEm
  const parceiros = dados.videos.filter(x => x.id !== v.id && x.semana === v.semana && x.periodo === v.periodo && !x.pautaId)
  const m = v.metricas

  return (
    <Modal titulo={`${v.codigo} · ${v.titulo}`} aoFechar={aoFechar} largo rotulo={`Vídeo ${v.codigo}`}>
      <div className="ct-video-cab">
        <Chip tom={STATUS_TOM[v.status]}>{STATUS_ROTULO[v.status]}</Chip>
        <Chip>{diaSemana(v.data)} {ddmm(v.data)} · {v.horario}</Chip>
        <Chip>{PERIODO_NOME[v.periodo]} · {ETAPA_NOME[v.etapa]} de funil · vídeo {v.ordem}</Chip>
        <Chip tom="learn">{v.formatoNome}</Chip>
        <Chip tom={v.roteiroOrigem === 'MODELO' ? 'neutro' : 'info'}>{ORIGEM_ROTEIRO[v.roteiroOrigem]}</Chip>
      </div>
      <ol className="ct-etapas" aria-label="Etapas do vídeo">
        {Object.entries({ Roteiro: v.etapas.roteiro, Aprovação: v.etapas.aprovacao, Gravação: v.etapas.gravacao, Edição: v.etapas.edicao, Publicação: v.etapas.publicacao }).map(([k, s]) => <li key={k}><span>{k}</span><b>{s}</b></li>)}
      </ol>

      {v.ajusteComentario && v.status === 'ROTEIRIZADO' && <Banner tom="warn" titulo="Ajuste pedido pelo gestor">{v.ajusteComentario}</Banner>}
      {pendente && (
        <Banner tom="warn" titulo="Pendente de confirmação" acao={pode ? <ConfirmarInfo aoConfirmar={nota => acao(() => proLaboreApi.sm.central.confirmar(v.id, nota), 'Confirmação registrada.').then(atualizar)} /> : undefined}>
          {v.pendenteConfirmacao}. Nada disso é publicado sem confirmação.
        </Banner>
      )}
      {v.confirmadoEm && <p className="sm-legenda" style={{ margin: 0 }}>Confirmado em {new Date(v.confirmadoEm).toLocaleDateString('pt-BR')}: {v.confirmacaoNota}</p>}

      <section className="ct-ficha" aria-label="Ficha estratégica">
        <div><span>Tema</span><b>{v.tema}</b></div>
        <div><span>Pilar editorial</span><b>{v.pilar}</b></div>
        <div><span>{ALVO_TIPO[v.alvoTipo] ?? v.alvoTipo}</span><b>{v.alvo}</b></div>
        <div><span>Lente mental trabalhada</span><b>{v.lente}</b><small>{v.lenteMotivo}</small></div>
        <div><span>Persona prioritária</span><b>{v.persona}</b><small>Persona ilustrativa, não um cliente real</small></div>
        <div><span>Objetivo estratégico</span><b>{v.objetivo}</b></div>
        <div><span>Duração estimada</span><b>{v.duracaoSeg} s</b></div>
        <div><span>Prova ou ativo necessário</span><b>{v.provaNecessaria ?? 'Nenhum'}</b></div>
      </section>

      <section className="ct-roteiro" aria-label="Roteiro completo">
        <div className="ct-roteiro-cab">
          <h3 className="ct-sub" style={{ margin: 0 }}>Roteiro</h3>
          {editavel && dados.ia && <Botao disabled={ocupado} onClick={() => acao(() => proLaboreApi.sm.central.roteiroIA(v.id), 'Roteiro escrito pela IA.').then(atualizar)}>{ocupado ? 'Escrevendo…' : 'Reescrever com IA'}</Botao>}
        </div>
        {v.pautaId && <p className="sm-legenda" style={{ margin: 0 }}>Este vídeo está na Produção: o roteiro agora é editado pela pauta.</p>}
        {BLOCOS.map(b => (
          <label key={b.campo} className="sm-campo">{b.rotulo}
            {b.linhas === 1
              ? <input className="sm-input" value={form[b.campo]} readOnly={!editavel} onChange={e => setForm({ ...form, [b.campo]: e.target.value })} />
              : <textarea className="sm-input" rows={b.linhas} value={form[b.campo]} readOnly={!editavel} onChange={e => setForm({ ...form, [b.campo]: e.target.value })} />}
          </label>
        ))}
        <div className="sm-grade-2">
          <label className="sm-campo">Cenas sugeridas (uma por linha)<textarea className="sm-input" rows={4} value={form.cenas} readOnly={!editavel} onChange={e => setForm({ ...form, cenas: e.target.value })} /></label>
          <label className="sm-campo">Textos na tela (um por linha)<textarea className="sm-input" rows={4} value={form.textosTela} readOnly={!editavel} onChange={e => setForm({ ...form, textosTela: e.target.value })} /></label>
        </div>
        <label className="sm-campo" style={{ maxWidth: 200 }}>Duração estimada (segundos)<input className="sm-input" type="number" min={5} max={180} value={form.duracaoSeg} readOnly={!editavel} onChange={e => setForm({ ...form, duracaoSeg: Number(e.target.value) })} /></label>
        {editavel && mudou && (
          <div className="sm-linha-acoes">
            <Botao variante="pri" disabled={ocupado} onClick={() => acao(() => proLaboreApi.sm.central.editarVideo(v.id, { ...form, cenas: form.cenas.split('\n').map(x => x.trim()).filter(Boolean), textosTela: form.textosTela.split('\n').map(x => x.trim()).filter(Boolean) }), 'Roteiro salvo.').then(atualizar)}>Salvar roteiro</Botao>
            <Botao onClick={() => carregarForm(v)}>Desfazer</Botao>
          </div>
        )}
      </section>

      {pode && (
        <section className="ct-acoes" aria-label="Fluxo do vídeo">
          {!v.pautaId && ['ROTEIRIZADO'].includes(v.status) && !dados.podeAprovar && <Botao variante="pri" disabled={ocupado} onClick={() => acao(() => proLaboreApi.sm.central.statusVideo(v.id, 'AGUARDANDO_APROVACAO'), 'Enviado para aprovação.').then(atualizar)}>Enviar para aprovação</Botao>}
          {!v.pautaId && dados.podeAprovar && ['ROTEIRIZADO', 'AGUARDANDO_APROVACAO'].includes(v.status) && (
            <>
              <Botao variante="pri" disabled={ocupado} onClick={() => acao(() => proLaboreApi.sm.central.aprovar([v.id], true), 'Roteiro aprovado.').then(() => proLaboreApi.sm.central.video(v.id).then(atualizar))}>Aprovar roteiro</Botao>
              <PedirAjuste aoEnviar={c => acao(() => proLaboreApi.sm.central.aprovar([v.id], false, c), 'Ajuste pedido.').then(() => proLaboreApi.sm.central.video(v.id).then(atualizar))} />
            </>
          )}
          {v.status === 'PLANEJADO' && <span className="sm-legenda">Roteiro-base: revise (ou reescreva com IA) antes de mandar para aprovação.</span>}
          {!v.pautaId && chegou(v.status, 'APROVADO') && !chegou(v.status, 'PUBLICADO') && (
            <Botao variante="pri" disabled={ocupado || !!pendente} title={pendente ? 'Confirme a informação pendente antes' : undefined} onClick={() => acao(() => proLaboreApi.sm.central.producao(v.id), 'Vídeo enviado para a Produção.').then(() => proLaboreApi.sm.central.video(v.id).then(atualizar))}>Enviar para a Produção</Botao>
          )}
          {v.pauta && <Link className="sm-btn" href={`/pro-labore/sm/producao?pauta=${v.pauta.id}`}>Abrir na Produção{v.pauta.codigo ? ` (${v.pauta.codigo})` : ''}</Link>}
          {v.status === 'PRONTO_GRAVAR' && <Botao disabled={ocupado} onClick={() => acao(() => proLaboreApi.sm.central.statusVideo(v.id, 'GRAVADO'), 'Marcado como gravado.').then(atualizar)}>Marcar como gravado</Botao>}
          {parceiros.length > 0 && <TrocarLugar opcoes={parceiros.map(p => ({ id: p.id, rotulo: `${p.codigo} · ${ddmm(p.data)} ${p.horario} · ${p.titulo}` }))} aoTrocar={comId => acao(() => proLaboreApi.sm.central.trocar(v.id, comId), 'Vídeos trocados de lugar.').then(() => aoAbrir(v.id))} />}
        </section>
      )}

      <section className="ct-resultado" aria-label="Execução e resultados">
        <h3 className="ct-sub">Execução, publicação e resultados</h3>
        <div className="sm-grade-2">
          <Campo rotulo="Responsável pela produção" valor={v.responsavel ?? ''} pode={pode} aoSalvar={x => acao(() => proLaboreApi.sm.central.editarVideo(v.id, { responsavel: x || null }), 'Responsável salvo.').then(atualizar)} />
          <label className="sm-campo">Prova ou ativo ligado
            <select className="sm-input" disabled={!pode} value={v.provaId ?? ''} onChange={e => acao(() => proLaboreApi.sm.central.editarVideo(v.id, { provaId: e.target.value || null }), 'Prova ligada.').then(atualizar)}>
              <option value="">Nenhuma</option>{provas.map(p => <option key={p.id} value={p.id}>{p.titulo} ({p.situacaoEfetiva.toLowerCase()})</option>)}
            </select>
          </label>
          {!v.pautaId && <Campo rotulo="Link da publicação" valor={v.permalink ?? ''} pode={pode} tipo="url" aoSalvar={x => acao(() => proLaboreApi.sm.central.editarVideo(v.id, { permalink: x || null }), 'Link salvo.').then(atualizar)} />}
        </div>
        {!v.pautaId && pode && v.permalink && !chegou(v.status, 'PUBLICADO') && chegou(v.status, 'APROVADO') && <Botao onClick={() => acao(() => proLaboreApi.sm.central.statusVideo(v.id, 'PUBLICADO'), 'Marcado como publicado.').then(atualizar)}>Marcar como publicado</Botao>}

        <div className="ct-metricas">
          {m?.disponivel ? (
            <>
              {([['Alcance', m.alcance], ['Visualizações', m.visualizacoes], ['Compartilhamentos', m.compartilhamentos], ['Salvamentos', m.salvamentos], ['Comentários', m.comentarios], ['Curtidas', m.curtidas], ['Visitas ao perfil', m.visitasPerfil], ['Conversas', m.conversas], ['Leads', m.leads], ['Vendas atribuídas', m.vendas]] as const).map(([r, x]) => <div key={r}><span>{r}</span><b className="sm-num">{num(x)}</b></div>)}
              <div><span>Tempo médio assistido</span><b className="sm-num">{m.tempoMedioSeg != null ? `${Math.round(m.tempoMedioSeg)} s` : '—'}</b></div>
              <div><span>Taxa de conclusão (aprox.)</span><b className="sm-num">{m.retencao != null ? `${Math.round(m.retencao * 100)}%` : '—'}</b></div>
            </>
          ) : <p className="sm-legenda" style={{ margin: 0 }}>Métricas do Instagram aparecem quando o vídeo é publicado pela Produção e sincronizado. Sem dado, nada é estimado.</p>}
        </div>
        <MetricasManuais v={v} pode={pode} aoSalvar={x => acao(() => proLaboreApi.sm.central.editarVideo(v.id, { metricasManuais: x }), 'Métricas salvas.').then(atualizar)} />
        <Campo rotulo="Resultado observado" valor={v.resultado ?? ''} pode={pode} linhas={2} aoSalvar={x => acao(() => proLaboreApi.sm.central.editarVideo(v.id, { resultado: x || null }), 'Resultado salvo.').then(atualizar)} />
        <Campo rotulo="Aprendizado (vai para o banco de aprendizados)" valor={v.aprendizado ?? ''} pode={pode} linhas={2} aoSalvar={x => acao(() => proLaboreApi.sm.central.editarVideo(v.id, { aprendizado: x || null }), 'Aprendizado salvo.').then(atualizar)} />
        <Campo rotulo="Próxima melhoria sugerida" valor={v.melhoria ?? ''} pode={pode} linhas={2} aoSalvar={x => acao(() => proLaboreApi.sm.central.editarVideo(v.id, { melhoria: x || null }), 'Melhoria salva.').then(atualizar)} />
        {pode && chegou(v.status, 'PUBLICADO') && v.status !== 'ANALISADO' && <Botao onClick={() => acao(() => proLaboreApi.sm.central.statusVideo(v.id, 'ANALISADO'), 'Análise concluída.').then(atualizar)}>Concluir análise de resultados</Botao>}
      </section>
      {erro && <p className="sm-erro" role="alert">{erro}</p>}
    </Modal>
  )
}

function Campo({ rotulo, valor, pode, aoSalvar, linhas = 1, tipo = 'text' }: { rotulo: string; valor: string; pode: boolean; aoSalvar: (v: string) => void; linhas?: number; tipo?: string }) {
  const [x, setX] = useState(valor)
  // Valor novo vindo do servidor (depois de salvar): o campo acompanha.
  const [base, setBase] = useState(valor)
  if (base !== valor) { setBase(valor); setX(valor) }
  const salvar = () => { if (x.trim() !== valor.trim()) aoSalvar(x.trim()) }
  return (
    <label className="sm-campo">{rotulo}
      {linhas > 1 ? <textarea className="sm-input" rows={linhas} value={x} readOnly={!pode} onChange={e => setX(e.target.value)} onBlur={salvar} />
        : <input className="sm-input" type={tipo} value={x} readOnly={!pode} onChange={e => setX(e.target.value)} onBlur={salvar} />}
    </label>
  )
}

const MANUAIS = [['mensagens', 'Mensagens recebidas'], ['cliques', 'Cliques'], ['visitasAgendadas', 'Visitas agendadas'], ['avaliacoesSolicitadas', 'Avaliações solicitadas'], ['propostas', 'Propostas realizadas']] as const
function MetricasManuais({ v, pode, aoSalvar }: { v: CtVideoCompleto; pode: boolean; aoSalvar: (x: NonNullable<CtVideoCompleto['metricasManuais']>) => void }) {
  const [x, setX] = useState<Record<string, string>>(() => Object.fromEntries(MANUAIS.map(([k]) => [k, v.metricasManuais?.[k] != null ? String(v.metricasManuais[k]) : ''])))
  const mudou = MANUAIS.some(([k]) => (x[k] || '') !== (v.metricasManuais?.[k] != null ? String(v.metricasManuais[k]) : ''))
  return (
    <div>
      <span className="sm-legenda">Registro manual (o que o Instagram não mede): deixe em branco o que não foi medido.</span>
      <div className="sm-grade-2">
        {MANUAIS.map(([k, r]) => <label key={k} className="sm-campo">{r}<input className="sm-input" type="number" min={0} value={x[k]} readOnly={!pode} onChange={e => setX({ ...x, [k]: e.target.value })} /></label>)}
      </div>
      {pode && mudou && <Botao onClick={() => aoSalvar(Object.fromEntries(MANUAIS.filter(([k]) => x[k] !== '').map(([k]) => [k, Math.max(0, Math.round(Number(x[k])))])))}>Salvar registro manual</Botao>}
    </div>
  )
}

function ConfirmarInfo({ aoConfirmar }: { aoConfirmar: (nota: string) => void }) {
  const [abrir, setAbrir] = useState(false)
  const [nota, setNota] = useState('')
  if (!abrir) return <Botao onClick={() => setAbrir(true)}>Registrar confirmação</Botao>
  return (
    <form className="ct-inline" onSubmit={e => { e.preventDefault(); aoConfirmar(nota.trim()); setAbrir(false) }}>
      <input className="sm-input" aria-label="O que foi confirmado" required minLength={5} value={nota} onChange={e => setNota(e.target.value)} placeholder="Ex.: estoque e preço conferidos com o gestor hoje" />
      <Botao type="submit" variante="pri">Confirmar</Botao>
    </form>
  )
}

function PedirAjuste({ aoEnviar }: { aoEnviar: (c: string) => void }) {
  const [abrir, setAbrir] = useState(false)
  const [c, setC] = useState('')
  if (!abrir) return <Botao onClick={() => setAbrir(true)}>Pedir ajuste</Botao>
  return (
    <form className="ct-inline" onSubmit={e => { e.preventDefault(); aoEnviar(c.trim()); setAbrir(false) }}>
      <input className="sm-input" aria-label="O que precisa mudar" required minLength={3} value={c} onChange={e => setC(e.target.value)} placeholder="O que precisa mudar" />
      <Botao type="submit">Enviar ajuste</Botao>
    </form>
  )
}

function TrocarLugar({ opcoes, aoTrocar }: { opcoes: Array<{ id: string; rotulo: string }>; aoTrocar: (id: string) => void }) {
  const [com, setCom] = useState('')
  return (
    <form className="ct-inline" onSubmit={e => { e.preventDefault(); if (com) aoTrocar(com) }}>
      <select className="sm-input" aria-label="Trocar de lugar com" value={com} onChange={e => setCom(e.target.value)}>
        <option value="">Trocar de lugar com… (mesmo período e semana)</option>
        {opcoes.map(o => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
      </select>
      <Botao type="submit" disabled={!com}>Trocar</Botao>
    </form>
  )
}
