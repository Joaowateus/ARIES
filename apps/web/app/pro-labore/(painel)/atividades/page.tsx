'use client'

// PDF 04 · Aba Atividades (sobre a ATV da onda 1): atrasadas, de hoje e
// próximas. Concluir registra o resultado; follow e ligação concluem no lugar
// deles (a ATV acompanha, pela cópia da onda 1).
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { proLaboreApi, telasApi, type AtividadeLista } from '@/lib/proLaboreApi'
import { abaPorChave } from '@/lib/abasAries'
import { Agora, Cabecalho, Detalhes, Lente, TelaVazia, useTelas } from '../_padrao/Padrao'

type Lista = { atrasadas: AtividadeLista[]; hoje: AtividadeLista[]; proximas: AtividadeLista[] }

export default function AtividadesPage() {
  const { usuario } = useProLaboreAuth()
  const gestao = usuario?.papel === 'DONO' || usuario?.papel === 'SUPERVISOR'
  const [d, setD] = useState<Lista | null>(null)
  const [pessoa, setPessoa] = useState<string>('')
  const [equipe, setEquipe] = useState<Array<{ id: string; nome: string }>>([])
  const carregar = useCallback(() => { telasApi.atividades(pessoa || undefined).then(setD).catch(() => setD({ atrasadas: [], hoje: [], proximas: [] })) }, [pessoa])
  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { if (gestao) proLaboreApi.vendedores.listar().then(v => setEquipe(v.filter(x => x.ativo).map(x => ({ id: x.id, nome: x.nome })))).catch(() => setEquipe([])) }, [gestao])
  const aba = abaPorChave('atividades')!
  const total = d ? d.atrasadas.length + d.hoje.length + d.proximas.length : 0
  return (
    <div>
      <Cabecalho aba={aba} />
      <div className="ar-tela">
        <div className="ar-trabalho">
          <Agora chaves={aba.numeros} />
          {gestao && (
            <div style={{ marginBottom: 10 }}>
              <select className="pl-input" style={{ width: 'auto' }} value={pessoa} onChange={e => setPessoa(e.target.value)} aria-label="De quem" data-filtro-pessoa>
                <option value="">As minhas</option><option value="TODOS">Toda a equipe</option>
                {equipe.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
          )}
          {!d && <p className="pl-hint">Carregando…</p>}
          {d && total === 0 && <TelaVazia titulo="Nenhuma atividade pendente">As atividades vêm das oportunidades (follows, ligações, visitas), das Recomendações aceitas e dos planos de ação. Quando houver, as atrasadas aparecem primeiro.</TelaVazia>}
          {d && <Bloco titulo="Atrasadas" itens={d.atrasadas} aoMudar={carregar} chave="atrasadas" />}
          {d && <Bloco titulo="De hoje" itens={d.hoje} aoMudar={carregar} chave="hoje" />}
          {d && d.proximas.length > 0 && <Detalhes titulo={`Próximas (${d.proximas.length}, até 7 dias)`}><Bloco titulo="" itens={d.proximas} aoMudar={carregar} chave="proximas" /></Detalhes>}
          <p className="pl-hint" style={{ marginTop: 12 }}>Ligações do dia: <Link href="/pro-labore/ligacoes">abrir a lista de ligações</Link> · Agenda da equipe: <Link href="/pro-labore/agenda">abrir a agenda</Link></p>
        </div>
        <Lente aba="atividades" />
      </div>
    </div>
  )
}

function Bloco({ titulo, itens, aoMudar, chave }: { titulo: string; itens: AtividadeLista[]; aoMudar: () => void; chave: string }) {
  if (!itens.length) return null
  return (
    <section data-bloco-atividades={chave}>
      {titulo && <div className="ar-fila-grupo">{titulo} · {itens.length}</div>}
      <ul className="ar-fila">{itens.map(a => <Item key={a.id} a={a} aoMudar={aoMudar} />)}</ul>
    </section>
  )
}

function Item({ a, aoMudar }: { a: AtividadeLista; aoMudar: () => void }) {
  const { registrarAcao } = useTelas()
  const [aberto, setAberto] = useState(false)
  const [res, setRes] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  async function concluir() {
    try { await telasApi.concluirAtividade(a.id, res); registrarAcao('atividades:concluir'); setAberto(false); aoMudar() } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível') }
  }
  const prazo = new Date(a.prazo)
  return (
    <li className="ar-fila-item" data-atividade={a.codigo ?? a.id}>
      <div className="ar-fila-texto" style={{ flex: 1 }}>
        <div className="ar-fila-titulo">{a.oQueFazer ?? a.tipo}</div>
        <div className="ar-fila-det">{a.codigo} · {prazo.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}{a.cliente ? ` · ${a.cliente}` : ''}{a.responsavel ? ` · ${a.responsavel}` : ''}</div>
        {aberto && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <input className="pl-input" style={{ flex: 1, minWidth: 180 }} value={res} onChange={e => setRes(e.target.value)} placeholder="Resultado (o que foi feito)" aria-label="Resultado" />
            <button type="button" className="pl-btn pl-btn-primary" onClick={() => void concluir()}>Concluir</button>
          </div>
        )}
        {msg && <div className="pl-hint" role="alert">{msg}</div>}
      </div>
      {!aberto && (a.concluiAqui
        ? <button type="button" className="pl-btn pl-btn-primary" onClick={() => setAberto(true)} data-concluir>Concluir</button>
        : a.ondeConcluir ? <Link className="pl-btn" href={a.ondeConcluir} onClick={() => registrarAcao('atividades:abrir-origem')}>Fazer e registrar</Link> : null)}
    </li>
  )
}
