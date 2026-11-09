'use client'

// PDF 04 · 4.1 Abas novas do menu sem tela própria ainda: entram com o que já
// existe hoje (links para onde o trabalho é feito) e com os números do
// dicionário; o restante fica como ponto de extensão, sinalizado na tela.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { telasApi } from '@/lib/proLaboreApi'
import { abaPorChave } from '@/lib/abasAries'
import { Agora, Cabecalho, Detalhes, Lente, TelaVazia, fmtValor } from '../../_padrao/Padrao'

const CONTEUDO: Record<string, { hoje: Array<{ texto: string; href: string }>; extensao: string }> = {
  'estoque-demanda': {
    hoje: [{ texto: 'Motos do estoque (Conversas › Estoque)', href: '/pro-labore/whatsapp' }, { texto: 'Estoque no espaço do Social Media', href: '/pro-labore/sm/estoque' }, { texto: 'Modelos que os clientes pedem (CRM)', href: '/pro-labore/leads' }],
    extensao: 'As regras de "o que está parado" e de ligar moto e lead ainda não foram aprovadas: ficam como ponto de extensão.',
  },
  'pos-venda': {
    hoje: [{ texto: 'Etapas de pós-venda de cada cliente (CRM, oportunidades vendidas)', href: '/pro-labore/leads' }, { texto: 'Atividades de entrega e revisão', href: '/pro-labore/atividades' }],
    extensao: 'Os pedidos de indicação e as regras detalhadas do pós-venda ainda não foram aprovados: ficam como ponto de extensão.',
  },
  'origem-vendas': {
    hoje: [{ texto: 'Funil mensal e gastos com anúncio (Indicadores)', href: '/pro-labore/indicadores' }, { texto: 'Campanhas e anúncios (Tráfego)', href: '/pro-labore/trafego' }],
    extensao: 'O custo por venda de cada origem chega com os detectores de Marketing (onda 4).',
  },
  'metas-premissas': {
    hoje: [{ texto: 'Meta anual, metas e tetos (Configurações)', href: '/pro-labore/configuracoes' }, { texto: 'Premissas da jornada, régua e detectores (Configurações)', href: '/pro-labore/configuracoes#detectores' }],
    extensao: 'Toda mudança de meta e premissa é aprovada pelo dono e fica no histórico.',
  },
  playbook: {
    hoje: [{ texto: 'Roteiro do robô e respostas prontas (Conversas)', href: '/pro-labore/whatsapp' }],
    extensao: 'O playbook completo da loja ainda não foi definido: fica como ponto de extensão.',
  },
  'base-conhecimento': {
    hoje: [{ texto: 'Base de conhecimento das conversas (Conversas)', href: '/pro-labore/whatsapp' }],
    extensao: 'A aprovação de verbetes por aqui ainda não foi definida: fica como ponto de extensão.',
  },
}

export default function AbaExtensaoPage() {
  const { chave } = useParams<{ chave: string }>()
  const { usuario } = useProLaboreAuth()
  const aba = abaPorChave(chave)
  const c = CONTEUDO[chave]
  if (!aba || !c) return <TelaVazia titulo="Aba não encontrada" passo={<Link className="pl-btn" href="/pro-labore/hoje">Voltar ao Hoje</Link>} />
  return (
    <div data-aba-extensao={chave}>
      <Cabecalho aba={aba} />
      <div className="ar-tela">
        <div className="ar-trabalho">
          <Agora chaves={aba.numeros} />
          <div className="ar-fila-grupo">O que já existe hoje</div>
          <ul className="ar-fila">{c.hoje.map(l => (
            <li key={l.href + l.texto} className="ar-fila-item"><div className="ar-fila-titulo">{l.texto}</div><Link className="pl-btn" href={l.href}>Abrir</Link></li>
          ))}</ul>
          {chave === 'metas-premissas' && usuario?.papel === 'DONO' && <OrcamentoAnuncio />}
          <div className="ar-vazio" style={{ marginTop: 14, textAlign: 'left' }} data-ponto-extensao><b>Ponto de extensão.</b> {c.extensao}</div>
          <Detalhes titulo="Sobre esta aba"><p style={{ margin: 0 }}>Para: {aba.paraQuem}. Pergunta: {aba.pergunta} Ação principal: {aba.acaoPrincipal}.</p></Detalhes>
        </div>
        <Lente aba={aba.lente} />
      </div>
    </div>
  )
}

// Orçamento de anúncio planejado do mês (o Hoje do gestor de tráfego compara o gasto com ele).
function OrcamentoAnuncio() {
  const [atual, setAtual] = useState<number | null | undefined>(undefined)
  const [valor, setValor] = useState(''), [just, setJust] = useState(''), [msg, setMsg] = useState<string | null>(null)
  useEffect(() => { telasApi.orcamentoAnuncio().then(r => setAtual(r.orcamentoAnuncioMensal)).catch(() => setAtual(null)) }, [])
  async function salvar() {
    const v = valor.trim() ? Number(valor.replace(/\./g, '').replace(',', '.')) : null
    if (v != null && (!Number.isFinite(v) || v < 0)) { setMsg('Valor inválido'); return }
    try { const r = await telasApi.salvarOrcamentoAnuncio(v, just); setAtual(r.orcamentoAnuncioMensal); setValor(''); setJust(''); setMsg('Salvo, com o histórico.') } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível salvar') }
  }
  return (
    <section className="pl-card" style={{ marginTop: 14 }} data-orcamento-anuncio>
      <b>Orçamento de anúncio do mês</b>
      <p className="pl-hint" style={{ margin: '4px 0 8px' }}>Atual: {atual === undefined ? '…' : atual == null ? 'não definido' : fmtValor(atual, 'BRL')}. O Hoje do gestor de tráfego compara o gasto do mês com este valor.</p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <input className="pl-input" style={{ width: 160 }} inputMode="decimal" placeholder="Novo valor (R$)" value={valor} onChange={e => setValor(e.target.value)} aria-label="Orçamento do mês" />
        <input className="pl-input" style={{ flex: 1, minWidth: 200 }} placeholder="Por que mudou" value={just} onChange={e => setJust(e.target.value)} aria-label="Justificativa" />
        <button type="button" className="pl-btn pl-btn-primary" onClick={() => void salvar()}>Salvar</button>
      </div>
      {msg && <p className="pl-hint" role="status" style={{ margin: '6px 0 0' }}>{msg}</p>}
    </section>
  )
}
