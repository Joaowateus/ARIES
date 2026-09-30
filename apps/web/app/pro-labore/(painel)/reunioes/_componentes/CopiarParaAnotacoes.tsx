'use client'

// "Salvar uma cópia nas Anotações": qualquer pessoa que vê a apresentação
// leva o mapa mental (e, se quiser, as anotações da reunião e o próprio
// "Só pra mim") pra aba Anotações dela, numa pasta à escolha — lá é dela,
// pode editar à vontade sem mexer na reunião.
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { proLaboreApi, type ArvoreApresentacao, type Bloco, type ConfiguracaoApresentacao, type Pasta } from '@/lib/proLaboreApi'
import EscolherPasta from '../../anotacoes/EscolherPasta'
import { apresentacaoParaMapa, blocosParaPagina, temConteudo } from './ponteAnotacoes'

export interface ConteudoParaCopiar {
  titulo: string
  icone: string | null
  arvore: ArvoreApresentacao
  configuracao: ConfiguracaoApresentacao | null
  notas: Bloco[]
  textoPessoal: string
}

export default function CopiarParaAnotacoes({ obter, onFechar }: { obter: () => ConteudoParaCopiar; onFechar: () => void }) {
  // O conteúdo é lido uma vez ao abrir (a apresentação pode estar mudando ao vivo).
  const [conteudo] = useState(obter)
  const [pastas, setPastas] = useState<Pasta[] | null>(null)
  const [pastaId, setPastaId] = useState<string | null>(null)
  const [titulo, setTitulo] = useState(conteudo.titulo)
  const temNotas = temConteudo(conteudo.notas)
  const temPessoal = !!conteudo.textoPessoal.trim()
  const [levarNotas, setLevarNotas] = useState(temNotas)
  const [levarPessoal, setLevarPessoal] = useState(temPessoal)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState<{ mapaId: string; notaId: string | null; onde: string } | null>(null)

  useEffect(() => {
    let cancelado = false
    proLaboreApi.pastas.listar().then(p => { if (!cancelado) setPastas(p) }).catch(e => { if (!cancelado) { setPastas([]); setErro((e as Error).message) } })
    return () => { cancelado = true }
  }, [])

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onFechar])

  async function salvar() {
    setSalvando(true)
    setErro('')
    try {
      const nome = titulo.trim() || conteudo.titulo
      const { objetos, conectores, configuracao } = apresentacaoParaMapa(conteudo.arvore, conteudo.configuracao)
      const mapa = await proLaboreApi.mapasMentais.criar({ titulo: nome, icone: conteudo.icone, pastaId, objetos, conectores, configuracao })
      let notaId: string | null = null
      if ((levarNotas && temNotas) || (levarPessoal && temPessoal)) {
        const blocos = blocosParaPagina(levarNotas ? conteudo.notas : [], levarPessoal ? conteudo.textoPessoal : null, 'Minhas anotações')
        const nota = await proLaboreApi.notas.criar({
          titulo: `Anotações — ${nome}`.slice(0, 200), icone: '📝', pastaId, blocos,
          conteudo: blocos.map(b => b.texto).filter(Boolean).join('\n').slice(0, 20000),
        })
        notaId = nota.id
      }
      const onde = pastaId ? pastas?.find(p => p.id === pastaId)?.nome ?? 'pasta escolhida' : 'Todas as notas'
      setFeito({ mapaId: mapa.id, notaId, onde })
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="pl-rn-modal" role="dialog" aria-modal="true" aria-label="Salvar cópia nas Anotações" onClick={e => { if (e.target === e.currentTarget) onFechar() }}>
      <div className="pl-card pl-rn-modal-caixa pl-cp-caixa">
        {feito ? (
          <>
            <div className="pl-cp-ok" aria-hidden="true">✓</div>
            <div className="pl-card-title">Cópia salva nas suas Anotações</div>
            <p className="pl-card-sub" style={{ margin: '6px 0 16px' }}>
              Em <b>{feito.onde}</b>{feito.notaId ? ' — o mapa mental e uma página com as anotações.' : '.'} É sua: pode editar, mover e organizar sem mexer na reunião.
            </p>
            <div className="pl-ap-nova-botoes">
              <button type="button" className="pl-btn pl-btn-ghost" onClick={onFechar}>Fechar</button>
              <Link href={`/pro-labore/anotacoes?mapa=${feito.mapaId}`} className="pl-btn pl-btn-primary">Abrir nas Anotações</Link>
            </div>
          </>
        ) : (
          <>
            <div className="pl-card-title">Salvar cópia nas Anotações</div>
            <p className="pl-card-sub" style={{ margin: '4px 0 14px' }}>Vira um mapa mental seu na aba Anotações. Mudanças lá não alteram a reunião.</p>
            <label className="pl-field"><span>Nome</span>
              <input className="pl-input" value={titulo} maxLength={200} onChange={e => setTitulo(e.target.value)} />
            </label>
            <div className="pl-field" style={{ marginTop: 12 }}><span>Pasta</span>
              {pastas === null ? <div className="pl-hint">Carregando pastas…</div> : (
                <EscolherPasta pastas={pastas} valor={pastaId} onEscolher={setPastaId} onPastaCriada={p => setPastas(l => [...(l ?? []), p])} />
              )}
            </div>
            {(temNotas || temPessoal) && (
              <div className="pl-cp-opcoes">
                {temNotas && (
                  <label><input type="checkbox" checked={levarNotas} onChange={e => setLevarNotas(e.target.checked)} /> Levar as anotações da reunião (vira uma página)</label>
                )}
                {temPessoal && (
                  <label><input type="checkbox" checked={levarPessoal} onChange={e => setLevarPessoal(e.target.checked)} /> Incluir o meu “Só pra mim”</label>
                )}
              </div>
            )}
            {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 10 }}>{erro}</div>}
            <div className="pl-ap-nova-botoes">
              <button type="button" className="pl-btn pl-btn-ghost" onClick={onFechar}>Cancelar</button>
              <button type="button" className="pl-btn pl-btn-primary" disabled={salvando || pastas === null} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar cópia'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
