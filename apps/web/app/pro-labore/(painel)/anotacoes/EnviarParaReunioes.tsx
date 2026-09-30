'use client'

// "Apresentar nas Reuniões": leva uma CÓPIA de um mapa mental das
// Anotações pra aba Reuniões, num departamento/pasta à escolha. Dono (ou
// quem está liberado) já pode apresentar; o resto da equipe fica com um
// rascunho e pede a autorização do responsável.
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { proLaboreApi, type EstruturaReunioes, type MapaMental } from '@/lib/proLaboreApi'
import { mapaParaApresentacao } from '../reunioes/_componentes/ponteAnotacoes'
import { dadosIniciaisDoBoard } from './MapaMental'

export default function EnviarParaReunioes({ mapa, onFechar }: { mapa: MapaMental; onFechar: () => void }) {
  const [estrutura, setEstrutura] = useState<EstruturaReunioes | null>(null)
  const [titulo, setTitulo] = useState(mapa.titulo || 'Sem título')
  const [dep, setDep] = useState('')
  const [pasta, setPasta] = useState('')
  const [pedirJa, setPedirJa] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState<{ id: string; aprovacao: string } | null>(null)
  const [convertido] = useState(() => {
    const { objetos, conectores } = dadosIniciaisDoBoard(mapa)
    return mapaParaApresentacao(objetos, conectores, mapa.configuracao)
  })

  useEffect(() => {
    let cancelado = false
    proLaboreApi.reunioesOrg.estrutura().then(e => { if (!cancelado) setEstrutura(e) }).catch(e => { if (!cancelado) setErro((e as Error).message) })
    return () => { cancelado = true }
  }, [])

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onFechar])

  const permissao = estrutura?.permissao
  const pastas = dep ? estrutura?.departamentos.find(d => d.id === dep)?.pastas ?? [] : estrutura?.geral.pastas ?? []

  async function enviar() {
    setEnviando(true)
    setErro('')
    try {
      let a = await proLaboreApi.apresentacoes.criar({
        titulo: titulo.trim() || 'Sem título', icone: mapa.icone ?? undefined,
        arvore: convertido.arvore, configuracao: convertido.configuracao,
        departamentoId: dep || null, pastaId: pasta || null,
      })
      if (permissao === 'APROVACAO' && pedirJa) a = await proLaboreApi.apresentacoes.pedir(a.id)
      setFeito({ id: a.id, aprovacao: a.aprovacao })
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="pl-rn-modal" role="dialog" aria-modal="true" aria-label="Apresentar nas Reuniões" onClick={e => { if (e.target === e.currentTarget) onFechar() }}>
      <div className="pl-card pl-rn-modal-caixa pl-cp-caixa">
        {feito ? (
          <>
            <div className="pl-cp-ok" aria-hidden="true">✓</div>
            <div className="pl-card-title">
              {feito.aprovacao === 'APROVADA' ? 'Pronto pra apresentar' : feito.aprovacao === 'PENDENTE' ? 'Pedido enviado' : 'Rascunho criado em Reuniões'}
            </div>
            <p className="pl-card-sub" style={{ margin: '6px 0 16px' }}>
              {feito.aprovacao === 'APROVADA'
                ? 'A cópia está na aba Reuniões. Abra e clique em "Iniciar ao vivo" quando for a hora.'
                : feito.aprovacao === 'PENDENTE'
                  ? 'O responsável recebeu o pedido. Assim que ele autorizar, o botão "Iniciar ao vivo" aparece pra você.'
                  : 'Só você vê por enquanto. Quando estiver pronto, abra e clique em "Pedir pra apresentar".'}
            </p>
            <div className="pl-ap-nova-botoes">
              <button type="button" className="pl-btn pl-btn-ghost" onClick={onFechar}>Fechar</button>
              <Link href={`/pro-labore/reunioes/${feito.id}`} className="pl-btn pl-btn-primary">Abrir em Reuniões</Link>
            </div>
          </>
        ) : (
          <>
            <div className="pl-card-title">Apresentar nas Reuniões</div>
            <p className="pl-card-sub" style={{ margin: '4px 0 14px' }}>Vai uma cópia do mapa — o original continua aqui nas suas Anotações, sem mudar.</p>
            {!estrutura ? <div className="pl-hint">{erro ? '' : 'Carregando…'}</div> : permissao === 'BLOQUEADO' ? (
              <div className="pl-cp-aviso">O responsável ainda não liberou você pra apresentar nas reuniões. Fale com ele pra liberar.</div>
            ) : (
              <>
                <label className="pl-field"><span>Título na reunião</span>
                  <input className="pl-input" value={titulo} maxLength={120} onChange={e => setTitulo(e.target.value)} />
                </label>
                <label className="pl-field" style={{ marginTop: 10 }}><span>Departamento</span>
                  <select className="pl-input" value={dep} onChange={e => { setDep(e.target.value); setPasta('') }}>
                    <option value="">Geral</option>
                    {estrutura.departamentos.map(d => (
                      <option key={d.id} value={d.id} disabled={!d.liberado}>{d.nome}{d.liberado ? '' : ' (entre com a senha na aba Reuniões antes)'}</option>
                    ))}
                  </select>
                </label>
                {pastas.length > 0 && (
                  <label className="pl-field" style={{ marginTop: 10 }}><span>Pasta</span>
                    <select className="pl-input" value={pasta} onChange={e => setPasta(e.target.value)}>
                      <option value="">Fora de pasta</option>
                      {pastas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                  </label>
                )}
                {convertido.ignorados > 0 && (
                  <div className="pl-cp-aviso">
                    Só as ideias do mapa mental vão pra apresentação — {convertido.ignorados} {convertido.ignorados === 1 ? 'item solto do quadro (forma, post-it…) fica' : 'itens soltos do quadro (formas, post-its…) ficam'} de fora.
                  </div>
                )}
                {permissao === 'APROVACAO' && (
                  <div className="pl-cp-opcoes">
                    <label><input type="checkbox" checked={pedirJa} onChange={e => setPedirJa(e.target.checked)} /> Já pedir a autorização do responsável pra apresentar</label>
                  </div>
                )}
              </>
            )}
            {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 10 }}>{erro}</div>}
            <div className="pl-ap-nova-botoes">
              <button type="button" className="pl-btn pl-btn-ghost" onClick={onFechar}>Cancelar</button>
              {estrutura && permissao !== 'BLOQUEADO' && (
                <button type="button" className="pl-btn pl-btn-primary" disabled={enviando || !titulo.trim()} onClick={enviar}>
                  {enviando ? 'Enviando…' : permissao === 'APROVACAO' && pedirJa ? 'Enviar e pedir' : 'Enviar pra Reuniões'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
