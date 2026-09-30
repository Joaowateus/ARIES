'use client'

// Painel ao lado do mapa: anotações (visíveis pra equipe), lembretes
// (visíveis pra equipe) e notas privadas (só quem apresenta). Pra quem
// assiste é tudo só leitura e atualiza ao vivo.
import { Fragment, useState } from 'react'
import type { Bloco, LembreteApresentacao } from '@/lib/proLaboreApi'
import EditorBlocos from '../../anotacoes/EditorBlocos'

type Aba = 'anotacoes' | 'lembretes' | 'privado'

export function BlocosLeitura({ blocos }: { blocos: Bloco[] }) {
  const visiveis = blocos.filter(b => b.tipo === 'divisor' || b.tipo === 'imagem' ? true : b.texto.trim())
  if (visiveis.length === 0) return <div className="pl-hint" style={{ padding: '8px 2px' }}>Nenhuma anotação ainda.</div>
  // Número de cada item de lista numerada (recomeça a cada lista).
  const numeros = visiveis.reduce<number[]>((acc, b, i) => [...acc, b.tipo === 'lista_numerada' ? (i > 0 ? acc[i - 1] : 0) + 1 : 0], [])
  return (
    <div className="pl-editor-blocos pl-ap-blocos-leitura">
      {visiveis.map((b, i) => {
        const numero = numeros[i]
        if (b.tipo === 'divisor') return <hr key={b.id} className="pl-bloco-divisor" />
        if (b.tipo === 'imagem') {
          // eslint-disable-next-line @next/next/no-img-element
          return b.texto ? <img key={b.id} src={b.texto} alt="" className="pl-bloco-imagem-img" style={{ maxWidth: '100%', borderRadius: 8, margin: '6px 0' }} /> : null
        }
        return (
          <div key={b.id} className={`pl-bloco-tipo-${b.tipo} pl-ap-bloco`}>
            {b.tipo === 'lista' && <span className="pl-bloco-marcador">•</span>}
            {b.tipo === 'lista_numerada' && <span className="pl-bloco-marcador">{numero}.</span>}
            {b.tipo === 'checkbox' && <input type="checkbox" className="pl-bloco-checkbox" checked={!!b.marcado} readOnly disabled />}
            {b.tipo === 'callout' && <span className="pl-bloco-callout-icone">{b.icone ?? '💡'}</span>}
            <div className={`pl-bloco-texto ${b.marcado ? 'pl-bloco-marcado' : ''}`}>{b.texto}</div>
          </div>
        )
      })}
    </div>
  )
}

function gerarId() {
  return `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

function fmtData(d: string): string {
  const [a, m, dia] = d.split('-').map(Number)
  const data = new Date(a, m - 1, dia)
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const dif = Math.round((data.getTime() - hoje.getTime()) / 86_400_000)
  const rotulo = data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  if (dif === 0) return `hoje`
  if (dif === 1) return `amanhã`
  if (dif < 0) return `${rotulo} · atrasado`
  return rotulo
}

export function Lembretes({ itens, editavel, onChange }: { itens: LembreteApresentacao[]; editavel: boolean; onChange?: (l: LembreteApresentacao[]) => void }) {
  const [texto, setTexto] = useState('')
  const [data, setData] = useState('')
  const pendentes = itens.filter(l => !l.feito)
  const feitos = itens.filter(l => l.feito)

  function adicionar() {
    const t = texto.trim()
    if (!t || !onChange) return
    onChange([...itens, { id: gerarId(), texto: t, feito: false, data: data || null }])
    setTexto('')
    setData('')
  }
  const alternar = (id: string) => onChange?.(itens.map(l => (l.id === id ? { ...l, feito: !l.feito } : l)))
  const remover = (id: string) => onChange?.(itens.filter(l => l.id !== id))

  const linha = (l: LembreteApresentacao) => (
    <li key={l.id} className={l.feito ? 'feito' : ''}>
      <input type="checkbox" checked={l.feito} disabled={!editavel} onChange={() => alternar(l.id)} aria-label={`Marcar "${l.texto}" como feito`} />
      <span className="texto">{l.texto}</span>
      {l.data && <span className={`data ${!l.feito && fmtData(l.data).includes('atrasado') ? 'atrasado' : ''}`}>{fmtData(l.data)}</span>}
      {editavel && <button type="button" className="pl-ap-x" onClick={() => remover(l.id)} aria-label={`Remover "${l.texto}"`}>×</button>}
    </li>
  )

  return (
    <div className="pl-ap-lembretes">
      {editavel && (
        <form className="pl-ap-lembrete-novo" onSubmit={e => { e.preventDefault(); adicionar() }}>
          <input className="pl-input" placeholder="Novo lembrete pra equipe…" value={texto} maxLength={300} onChange={e => setTexto(e.target.value)} />
          <div className="pl-ap-lembrete-linha2">
            <input className="pl-input" type="date" value={data} onChange={e => setData(e.target.value)} aria-label="Data (opcional)" />
            <button type="submit" className="pl-btn pl-btn-primary" disabled={!texto.trim()}>Adicionar</button>
          </div>
        </form>
      )}
      {itens.length === 0 ? <div className="pl-hint" style={{ padding: '8px 2px' }}>{editavel ? 'Prazos, tarefas e combinados aparecem aqui pra equipe.' : 'Nenhum lembrete.'}</div> : (
        <>
          <ul>{pendentes.map(linha)}</ul>
          {feitos.length > 0 && (
            <>
              <div className="pl-ap-sub">Concluídos</div>
              <ul>{feitos.map(linha)}</ul>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default function PainelLateral({ editavel, notas, lembretes, notasPrivadas, onNotas, onLembretes, onNotasPrivadas, statusPrivado, chaveEditor, extra }: {
  editavel: boolean
  notas: Bloco[]
  lembretes: LembreteApresentacao[]
  notasPrivadas?: string
  onNotas?: (b: Bloco[]) => void
  onLembretes?: (l: LembreteApresentacao[]) => void
  onNotasPrivadas?: (t: string) => void
  // Aviso de salvamento embaixo do "Só pra mim" (tela de quem assiste).
  statusPrivado?: React.ReactNode
  chaveEditor?: string
  extra?: React.ReactNode
}) {
  const [aba, setAba] = useState<Aba>('anotacoes')
  const pendentes = lembretes.filter(l => !l.feito).length
  const abas: Array<{ valor: Aba; rotulo: React.ReactNode }> = [
    { valor: 'anotacoes', rotulo: 'Anotações' },
    { valor: 'lembretes', rotulo: <>Lembretes{pendentes > 0 && <span className="pl-ap-contador">{pendentes}</span>}</> },
    ...(onNotasPrivadas ? [{ valor: 'privado' as const, rotulo: 'Só pra mim' }] : []),
  ]
  return (
    <aside className="pl-ap-painel">
      <div className="pl-sv-tabs pl-ap-painel-abas" role="tablist" aria-label="Painel da apresentação">
        {abas.map(a => (
          <button key={a.valor} type="button" role="tab" aria-selected={aba === a.valor} className={aba === a.valor ? 'ativo' : ''} onClick={() => setAba(a.valor)}>{a.rotulo}</button>
        ))}
      </div>
      <div className="pl-ap-painel-corpo">
        {aba === 'anotacoes' && (editavel
          ? (
            <>
              <div className="pl-ap-dica">A equipe vê essas anotações ao vivo. Digite “/” pra títulos, listas, checklists e destaques.</div>
              <EditorBlocos key={chaveEditor} blocosIniciais={notas} onChange={b => onNotas?.(b)} />
            </>
          )
          : <BlocosLeitura blocos={notas} />)}
        {aba === 'lembretes' && <Lembretes itens={lembretes} editavel={editavel} onChange={onLembretes} />}
        {aba === 'privado' && onNotasPrivadas && (
          <>
            <div className="pl-ap-dica">
              {editavel
                ? 'Só você vê — roteiro, falas, pontos pra não esquecer. Não é transmitido.'
                : 'Só você vê — nem quem apresenta nem os colegas têm acesso. Fica salvo pra quando voltar nesta reunião.'}
            </div>
            <textarea
              className="pl-input pl-textarea pl-ap-privado"
              value={notasPrivadas ?? ''}
              placeholder={editavel
                ? 'Ex.:\n1. Abrir com o resultado do mês\n2. Mostrar o galho "Objeções"\n3. Fechar com a meta da semana'
                : 'Ex.:\n- Ligar pro cliente X usando o argumento do ponto B\n- Dúvida pra levar no fim da reunião'}
              onChange={e => onNotasPrivadas(e.target.value)}
            />
            {statusPrivado && <div className="pl-ap-privado-status">{statusPrivado}</div>}
          </>
        )}
        {extra && <Fragment>{extra}</Fragment>}
      </div>
    </aside>
  )
}
