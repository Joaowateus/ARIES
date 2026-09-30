'use client'

// Navegação da aba Anotações: árvore da barra lateral e a visão de uma
// pasta (tabela de arquivos). Aqui mora o "uso de explorador de arquivos":
// voltar, selecionar vários (caixinha, Ctrl/⌘+clique, Shift+clique,
// Ctrl+A), arrastar pra uma pasta, menu de cada item (renomear, mover,
// duplicar, apresentar nas Reuniões, excluir) e ordenação.
import { useEffect, useRef, useState } from 'react'
import type { MapaMental, Nota, Pasta } from '@/lib/proLaboreApi'

export type TipoItem = 'pasta' | 'nota' | 'mapa'
// "tipo:id" — identifica um item em seleções e arrastes.
export type Chave = string
export const chaveDe = (tipo: TipoItem, id: string): Chave => `${tipo}:${id}`
export function partesDa(chave: Chave): { tipo: TipoItem; id: string } {
  const i = chave.indexOf(':')
  return { tipo: chave.slice(0, i) as TipoItem, id: chave.slice(i + 1) }
}

export type Ordem = 'modificado' | 'nome' | 'criado'

// Tudo que a pasta sabe fazer — vem da página, que guarda os dados.
export interface AcoesNavegador {
  abrir: (chave: Chave) => void
  abrirPasta: (id: string | null) => void
  mover: (chaves: Chave[]) => void
  duplicar: (chaves: Chave[]) => void
  excluir: (chaves: Chave[]) => void
  renomear: (chave: Chave, nome: string) => void
  enviarReunioes: (mapaId: string) => void
  // Arrastar e soltar
  iniciarArraste: (e: React.DragEvent, chaves: Chave[]) => void
  terminarArraste: () => void
  propsSoltar: (destino: string | null) => {
    'data-destino': string
    onDragOver: (e: React.DragEvent) => void
    onDragLeave: (e: React.DragEvent) => void
    onDrop: (e: React.DragEvent) => void
  }
  alvoSoltar: string | null
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatarRelativo(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'ontem'
  if (dias < 30) return `há ${dias} dia${dias > 1 ? 's' : ''}`
  const meses = Math.floor(dias / 30)
  if (meses < 12) return `há ${meses} ${meses === 1 ? 'mês' : 'meses'}`
  const anos = Math.floor(meses / 12)
  return `há ${anos} ${anos === 1 ? 'ano' : 'anos'}`
}

// Caminho da raiz até a pasta (pra trilha de navegação).
export function caminhoAte(pastas: Pasta[], id: string | null): Pasta[] {
  const caminho: Pasta[] = []
  const vistos = new Set<string>()
  for (let atual = pastas.find(p => p.id === id) ?? null; atual && !vistos.has(atual.id); atual = pastas.find(p => p.id === atual!.paiId) ?? null) {
    vistos.add(atual.id)
    caminho.unshift(atual)
  }
  return caminho
}

// A pasta e tudo que está dentro dela (em qualquer nível).
export function descendentes(pastas: Pasta[], raizes: string[]): Set<string> {
  const r = new Set(raizes)
  let mudou = true
  while (mudou) {
    mudou = false
    for (const p of pastas) if (p.paiId && r.has(p.paiId) && !r.has(p.id)) { r.add(p.id); mudou = true }
  }
  return r
}

// Trilha "Todas as notas / Pasta / Subpasta" — cada pedaço aceita itens soltos.
export function Trilha({ pastas, atual, acoes, final }: { pastas: Pasta[]; atual: string | null; acoes: AcoesNavegador; final?: React.ReactNode }) {
  const caminho = caminhoAte(pastas, atual)
  return (
    <nav className="pl-breadcrumb-pastas" aria-label="Caminho">
      <button type="button" onClick={() => acoes.abrirPasta(null)} className={`${!atual && !final ? 'active' : ''} ${acoes.alvoSoltar === 'raiz' ? 'pl-an-alvo' : ''}`} {...acoes.propsSoltar(null)}>Todas as notas</button>
      {caminho.map(p => (
        <span key={p.id}>
          <span className="pl-breadcrumb-sep">/</span>
          <button type="button" onClick={() => acoes.abrirPasta(p.id)} className={`${atual === p.id && !final ? 'active' : ''} ${acoes.alvoSoltar === p.id ? 'pl-an-alvo' : ''}`} {...acoes.propsSoltar(p.id)}>{p.nome}</button>
        </span>
      ))}
      {final && <><span className="pl-breadcrumb-sep">/</span><span className="pl-an-trilha-final">{final}</span></>}
    </nav>
  )
}

export function NoArvore({ pasta, nivel, pastas, notas, mapas, ativo, abertas, onAlternarAberta, onNovaNota, acoes }: {
  pasta: Pasta
  nivel: number
  pastas: Pasta[]
  notas: Nota[]
  mapas: MapaMental[]
  ativo: Chave | null
  abertas: Set<string>
  onAlternarAberta: (id: string) => void
  onNovaNota: (pastaId: string | null) => void
  acoes: AcoesNavegador
}) {
  const subpastas = pastas.filter(p => (p.paiId ?? null) === pasta.id)
  const filhosNotas = notas.filter(n => (n.pastaId ?? null) === pasta.id)
  const filhosMapas = mapas.filter(m => (m.pastaId ?? null) === pasta.id)
  const temFilhos = subpastas.length > 0 || filhosNotas.length > 0 || filhosMapas.length > 0
  const aberta = abertas.has(pasta.id)
  const recuoFilho = (nivel + 1) * 14 + 18

  return (
    <div>
      <div
        className={`pl-arvore-item ${ativo === chaveDe('pasta', pasta.id) ? 'active' : ''} ${acoes.alvoSoltar === pasta.id ? 'pl-an-alvo' : ''}`}
        style={{ marginLeft: nivel * 14 }}
        draggable onDragStart={e => acoes.iniciarArraste(e, [chaveDe('pasta', pasta.id)])} onDragEnd={acoes.terminarArraste}
        {...acoes.propsSoltar(pasta.id)}
      >
        <button type="button" className={`pl-arvore-chevron ${temFilhos ? '' : 'invisivel'}`} onClick={() => onAlternarAberta(pasta.id)} aria-label={aberta ? 'Recolher' : 'Expandir'}>
          {temFilhos ? (aberta ? '▾' : '▸') : ''}
        </button>
        <button type="button" className="pl-arvore-label" onClick={() => acoes.abrirPasta(pasta.id)}>
          <span className="pl-arvore-icone">{pasta.icone || '📁'}</span>
          <span className="pl-arvore-nome">{pasta.nome}</span>
        </button>
        <button type="button" className="pl-arvore-acao" title="Nova página aqui" onClick={() => onNovaNota(pasta.id)}>+</button>
      </div>
      {aberta && (
        <div>
          {subpastas.map(p => (
            <NoArvore key={p.id} pasta={p} nivel={nivel + 1} pastas={pastas} notas={notas} mapas={mapas} ativo={ativo} abertas={abertas} onAlternarAberta={onAlternarAberta} onNovaNota={onNovaNota} acoes={acoes} />
          ))}
          {filhosNotas.map(n => <FolhaArvore key={n.id} chave={chaveDe('nota', n.id)} icone={n.icone || '📄'} nome={n.titulo || 'Sem título'} recuo={recuoFilho} ativo={ativo} acoes={acoes} />)}
          {filhosMapas.map(m => <FolhaArvore key={m.id} chave={chaveDe('mapa', m.id)} icone={m.icone || '🧠'} nome={m.titulo || 'Sem título'} recuo={recuoFilho} ativo={ativo} acoes={acoes} />)}
        </div>
      )}
    </div>
  )
}

export function FolhaArvore({ chave, icone, nome, recuo, ativo, acoes }: { chave: Chave; icone: string; nome: string; recuo: number; ativo: Chave | null; acoes: AcoesNavegador }) {
  return (
    <div className={`pl-arvore-item ${ativo === chave ? 'active' : ''}`} style={{ marginLeft: recuo }} draggable onDragStart={e => acoes.iniciarArraste(e, [chave])} onDragEnd={acoes.terminarArraste}>
      <button type="button" className="pl-arvore-label" onClick={() => acoes.abrir(chave)}>
        <span className="pl-arvore-icone">{icone}</span>
        <span className="pl-arvore-nome">{nome}</span>
      </button>
    </div>
  )
}

interface Linha { chave: Chave; tipo: TipoItem; id: string; nome: string; icone: string; criadoEm: string; atualizadoEm: string; itens?: number }

function IconeMais() {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
}

const ROTULO_ORDEM: Record<Ordem, string> = { modificado: 'Modificado', nome: 'Nome', criado: 'Criado' }

export function VisaoPasta({
  pasta, pastas, notas, mapas, ordem, onOrdem, atalhosAtivos, acoes, cabecalho, tiles,
}: {
  pasta: Pasta | null
  pastas: Pasta[]
  notas: Nota[]
  mapas: MapaMental[]
  ordem: Ordem
  onOrdem: (o: Ordem) => void
  // Desligado quando tem diálogo aberto por cima (não roubar Delete/Ctrl+A).
  atalhosAtivos: boolean
  acoes: AcoesNavegador
  cabecalho: React.ReactNode
  tiles: React.ReactNode
}) {
  const aqui = pasta?.id ?? null
  const linhas: Linha[] = [
    ...pastas.filter(p => (p.paiId ?? null) === aqui).map((p): Linha => ({
      chave: chaveDe('pasta', p.id), tipo: 'pasta', id: p.id, nome: p.nome, icone: p.icone || '📁', criadoEm: p.criadoEm, atualizadoEm: p.atualizadoEm,
      itens: pastas.filter(x => (x.paiId ?? null) === p.id).length + notas.filter(n => (n.pastaId ?? null) === p.id).length + mapas.filter(m => (m.pastaId ?? null) === p.id).length,
    })),
    ...notas.filter(n => (n.pastaId ?? null) === aqui).map((n): Linha => ({ chave: chaveDe('nota', n.id), tipo: 'nota', id: n.id, nome: n.titulo || 'Sem título', icone: n.icone || '📄', criadoEm: n.criadoEm, atualizadoEm: n.atualizadoEm })),
    ...mapas.filter(m => (m.pastaId ?? null) === aqui).map((m): Linha => ({ chave: chaveDe('mapa', m.id), tipo: 'mapa', id: m.id, nome: m.titulo || 'Sem título', icone: m.icone || '🧠', criadoEm: m.criadoEm, atualizadoEm: m.atualizadoEm })),
  ].sort((a, b) => {
    // Pastas sempre primeiro, como num explorador de arquivos.
    if ((a.tipo === 'pasta') !== (b.tipo === 'pasta')) return a.tipo === 'pasta' ? -1 : 1
    if (ordem === 'nome') return a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })
    const campo = ordem === 'criado' ? 'criadoEm' : 'atualizadoEm'
    return new Date(b[campo]).getTime() - new Date(a[campo]).getTime()
  })

  const [selecao, setSelecao] = useState<Set<Chave>>(new Set())
  const ancoraRef = useRef<Chave | null>(null)
  // Menu ⋯ flutuante (posição fixa na tela: não é cortado pela rolagem do painel).
  const [menu, setMenu] = useState<{ chave: Chave; estilo: React.CSSProperties } | null>(null)
  const [renomeando, setRenomeando] = useState<Chave | null>(null)
  // Itens que sumiram (movidos/excluídos) saem da seleção.
  const selecionados = linhas.filter(l => selecao.has(l.chave))
  const chavesSel = selecionados.map(l => l.chave)
  const todas = linhas.length > 0 && selecionados.length === linhas.length

  function alternar(chave: Chave) {
    setSelecao(prev => {
      const s = new Set(prev)
      if (s.has(chave)) s.delete(chave); else s.add(chave)
      return s
    })
    ancoraRef.current = chave
  }
  function selecionarAte(chave: Chave) {
    const a = linhas.findIndex(l => l.chave === ancoraRef.current)
    const b = linhas.findIndex(l => l.chave === chave)
    if (a < 0 || b < 0) { alternar(chave); return }
    const [i, j] = a < b ? [a, b] : [b, a]
    setSelecao(prev => new Set([...prev, ...linhas.slice(i, j + 1).map(l => l.chave)]))
  }
  function cliqueLinha(e: React.MouseEvent, l: Linha) {
    if (renomeando === l.chave) return
    if (e.shiftKey) { e.preventDefault(); selecionarAte(l.chave); return }
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); alternar(l.chave); return }
    acoes.abrir(l.chave)
  }

  // Fecha o menu ⋯ ao clicar fora ou rolar.
  useEffect(() => {
    if (!menu) return
    const fechar = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.pl-an-menu, .pl-an-menu-btn')) setMenu(null) }
    const rolar = () => setMenu(null)
    document.addEventListener('mousedown', fechar)
    window.addEventListener('scroll', rolar, true)
    window.addEventListener('resize', rolar)
    return () => {
      document.removeEventListener('mousedown', fechar)
      window.removeEventListener('scroll', rolar, true)
      window.removeEventListener('resize', rolar)
    }
  }, [menu])

  function abrirMenu(e: React.MouseEvent<HTMLButtonElement>, chave: Chave) {
    if (menu?.chave === chave) { setMenu(null); return }
    const r = e.currentTarget.getBoundingClientRect()
    const paraCima = window.innerHeight - r.bottom < 280 && r.top > 280
    setMenu({
      chave,
      estilo: {
        position: 'fixed', right: Math.max(8, window.innerWidth - r.right),
        ...(paraCima ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
      },
    })
  }

  // Atalhos: Ctrl/⌘+A seleciona tudo, Delete exclui, Esc limpa, F2 renomeia.
  const estadoAtalhos = useRef({ linhas, chavesSel, acoes })
  useEffect(() => { estadoAtalhos.current = { linhas, chavesSel, acoes } })
  useEffect(() => {
    if (!atalhosAtivos) return
    function aoTeclar(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement
      if (alvo.closest('input, textarea, select, [contenteditable="true"]')) return
      const { linhas: ls, chavesSel: sel, acoes: ac } = estadoAtalhos.current
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); setSelecao(new Set(ls.map(l => l.chave))) }
      else if (e.key === 'Escape') { setMenu(null); if (sel.length) setSelecao(new Set()) }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && sel.length) { e.preventDefault(); ac.excluir(sel) }
      else if (e.key === 'F2' && sel.length === 1) { e.preventDefault(); setRenomeando(sel[0]) }
      else if (e.key === 'Enter' && sel.length === 1) { e.preventDefault(); ac.abrir(sel[0]) }
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [atalhosAtivos])

  const soMapaSelecionado = selecionados.length === 1 && selecionados[0].tipo === 'mapa' ? selecionados[0] : null
  const temDuplicavel = selecionados.some(l => l.tipo !== 'pasta')

  function linhaDeItem(l: Linha) {
    const marcado = selecao.has(l.chave)
    const destinoSoltar = l.tipo === 'pasta' ? acoes.propsSoltar(l.id) : null
    return (
      <div
        key={l.chave}
        className={`pl-fb-linha pl-an-linha ${marcado ? 'selecionada' : ''} ${l.tipo === 'pasta' && acoes.alvoSoltar === l.id ? 'pl-an-alvo' : ''}`}
        onClick={e => cliqueLinha(e, l)}
        draggable={renomeando !== l.chave}
        onDragStart={e => acoes.iniciarArraste(e, marcado ? chavesSel : [l.chave])}
        onDragEnd={acoes.terminarArraste}
        {...destinoSoltar}
      >
        <span className="pl-an-col-check" onClick={e => { e.stopPropagation(); if (e.shiftKey) selecionarAte(l.chave); else alternar(l.chave) }}>
          <input type="checkbox" checked={marcado} readOnly aria-label={`Selecionar ${l.nome}`} tabIndex={-1} />
        </span>
        <span className="pl-fb-col-nome">
          <span className="pl-fb-linha-icone">{l.icone}</span>
          {renomeando === l.chave ? (
            <input
              className="pl-input pl-an-renomear" autoFocus defaultValue={l.nome === 'Sem título' ? '' : l.nome} maxLength={200}
              onClick={e => e.stopPropagation()}
              onKeyDown={e => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                if (e.key === 'Escape') { e.stopPropagation(); setRenomeando(null) }
              }}
              onBlur={e => {
                const nome = e.target.value.trim()
                setRenomeando(null)
                if (nome && nome !== l.nome) acoes.renomear(l.chave, nome)
              }}
            />
          ) : <span className="pl-an-nome">{l.nome}</span>}
        </span>
        <span className="pl-fb-col-data">{formatarData(l.criadoEm)}</span>
        <span className="pl-fb-col-data">{formatarRelativo(l.atualizadoEm)}{l.itens ? ` · ${l.itens} ${l.itens > 1 ? 'itens' : 'item'}` : ''}</span>
        <span className="pl-fb-col-acao pl-an-acao" onClick={e => e.stopPropagation()}>
          <button type="button" className="pl-an-menu-btn" aria-label={`Ações de ${l.nome}`} aria-expanded={menu?.chave === l.chave} onClick={e => abrirMenu(e, l.chave)}>
            <IconeMais />
          </button>
          {menu?.chave === l.chave && (
            <div className="pl-an-menu" role="menu" style={menu.estilo}>
              <button type="button" role="menuitem" onClick={() => { setMenu(null); acoes.abrir(l.chave) }}>Abrir</button>
              <button type="button" role="menuitem" onClick={() => { setMenu(null); setRenomeando(l.chave) }}>Renomear</button>
              <button type="button" role="menuitem" onClick={() => { setMenu(null); acoes.mover(marcado ? chavesSel : [l.chave]) }}>Mover para…</button>
              {l.tipo !== 'pasta' && <button type="button" role="menuitem" onClick={() => { setMenu(null); acoes.duplicar([l.chave]) }}>Duplicar</button>}
              {l.tipo === 'mapa' && <button type="button" role="menuitem" onClick={() => { setMenu(null); acoes.enviarReunioes(l.id) }}>Apresentar nas Reuniões</button>}
              <button type="button" role="menuitem" className="perigo" onClick={() => { setMenu(null); acoes.excluir(marcado ? chavesSel : [l.chave]) }}>{l.tipo === 'mapa' ? 'Mover pra lixeira' : 'Excluir'}</button>
            </div>
          )}
        </span>
      </div>
    )
  }

  return (
    <div>
      <div className="pl-an-topo">
        {pasta && (
          <button type="button" className="pl-an-voltar" onClick={() => acoes.abrirPasta(pasta.paiId ?? null)} title="Voltar pra pasta de cima">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
            Voltar
          </button>
        )}
        <Trilha pastas={pastas} atual={aqui} acoes={acoes} />
      </div>

      {cabecalho}
      {tiles}

      {selecionados.length > 0 && (
        <div className="pl-an-selbar" role="toolbar" aria-label="Ações nos itens selecionados">
          <b>{selecionados.length} {selecionados.length === 1 ? 'selecionado' : 'selecionados'}</b>
          <button type="button" onClick={() => acoes.mover(chavesSel)}>Mover para…</button>
          {temDuplicavel && <button type="button" onClick={() => acoes.duplicar(chavesSel)}>Duplicar</button>}
          {soMapaSelecionado && <button type="button" onClick={() => acoes.enviarReunioes(soMapaSelecionado.id)}>Apresentar nas Reuniões</button>}
          <button type="button" className="perigo" onClick={() => acoes.excluir(chavesSel)}>Excluir</button>
          <span className="pl-an-selbar-dica">Arraste pra uma pasta pra mover · Esc limpa</span>
          <button type="button" className="pl-an-selbar-fechar" onClick={() => setSelecao(new Set())} aria-label="Limpar seleção">×</button>
        </div>
      )}

      {linhas.length === 0 ? (
        <div className="pl-empty pl-card">
          <div className="pl-emoji">📝</div>
          {pasta ? 'Pasta vazia. Crie algo aqui ou arraste itens pra dentro dela.' : 'Nada por aqui ainda.'}
        </div>
      ) : (
        <div className="pl-fb-tabela" role="table" aria-label="Itens da pasta">
          <div className="pl-fb-tabela-head pl-an-head" role="row">
            <span className="pl-an-col-check">
              <input
                type="checkbox" aria-label="Selecionar tudo" checked={todas}
                ref={el => { if (el) el.indeterminate = selecionados.length > 0 && !todas }}
                onChange={() => setSelecao(todas ? new Set() : new Set(linhas.map(l => l.chave)))}
              />
            </span>
            {(['nome', 'criado', 'modificado'] as Ordem[]).map(o => (
              <button key={o} type="button" className={`pl-an-ordem ${o === 'nome' ? 'pl-fb-col-nome' : 'pl-fb-col-data'} ${ordem === o ? 'ativa' : ''}`} onClick={() => onOrdem(o)} title={`Ordenar por ${ROTULO_ORDEM[o].toLowerCase()}`}>
                {ROTULO_ORDEM[o]}{ordem === o && (o === 'nome' ? ' ↑' : ' ↓')}
              </button>
            ))}
            <span className="pl-fb-col-acao" />
          </div>
          {linhas.map(linhaDeItem)}
          <div className="pl-an-rodape">
            {linhas.length} {linhas.length === 1 ? 'item' : 'itens'} · Ctrl/⌘+clique ou Shift+clique pra selecionar vários
          </div>
        </div>
      )}
    </div>
  )
}
