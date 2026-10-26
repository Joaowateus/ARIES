'use client'

// Paleta de comandos (Ctrl/⌘ + K): ir para qualquer aba, achar um lead pelo
// nome, telefone ou moto e fazer as ações mais comuns sem procurar no menu.
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { proLaboreApi, type Lead } from '@/lib/proLaboreApi'

export interface ItemPaleta { href: string; label: string }
type Opcao = { id: string; grupo: string; titulo: string; detalhe?: string; ir: () => void }

const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const ETAPA: Record<string, string> = { LEAD: 'Lead', ABORDADO: 'Abordado', NEGOCIACAO: 'Negociação', PROPOSTA: 'Proposta', FECHADO: 'Fechado', PERDIDO: 'Perdido' }

export function PaletaComandos({ itens, podeCrm }: { itens: ItemPaleta[]; podeCrm: boolean }) {
  const router = useRouter()
  const [aberta, setAberta] = useState(false)
  const [busca, setBusca] = useState('')
  const [indice, setIndice] = useState(0)
  const [leads, setLeads] = useState<Lead[] | null>(null)

  useEffect(() => {
    function atalho(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setAberta(a => !a) }
    }
    function abrirPeloBotao() { setAberta(true) }
    window.addEventListener('keydown', atalho)
    window.addEventListener('pl-abrir-paleta', abrirPeloBotao)
    return () => { window.removeEventListener('keydown', atalho); window.removeEventListener('pl-abrir-paleta', abrirPeloBotao) }
  }, [])

  // Os leads chegam na primeira vez que a paleta abre.
  useEffect(() => {
    if (!aberta || !podeCrm || leads) return
    proLaboreApi.leads.listar().then(setLeads).catch(() => setLeads([]))
  }, [aberta, podeCrm, leads])

  const fechar = () => { setAberta(false); setBusca(''); setIndice(0) }
  const navegar = (href: string) => { fechar(); router.push(href) }
  // Lead e "novo lead" abrem a página do zero: o CRM lê ?lead= / ?novo= ao montar.
  const abrirCompleto = (href: string) => { fechar(); window.location.assign(href) }

  const opcoes = useMemo<Opcao[]>(() => {
    const q = normal(busca.trim())
    const casa = (...t: Array<string | null | undefined>) => !q || t.some(x => x && normal(x).includes(q))
    const lista: Opcao[] = []
    if (podeCrm) {
      const acoes = [
        { id: 'novo-lead', titulo: 'Novo lead', detalhe: 'Cadastrar no CRM', ir: () => abrirCompleto('/pro-labore/leads?novo=1') },
        { id: 'fora-crm', titulo: 'WhatsApp fora do CRM', detalhe: 'Conferir quem escreveu e não virou lead', ir: () => abrirCompleto('/pro-labore/leads?foraDoCrm=1') },
      ]
      lista.push(...acoes.filter(a => casa(a.titulo, a.detalhe)).map(a => ({ ...a, grupo: 'Ações' })))
    }
    lista.push(...itens.filter(i => casa(i.label)).map(i => ({ id: `ir:${i.href}`, grupo: 'Ir para', titulo: i.label, ir: () => navegar(i.href) })))
    if (q.length >= 2 && leads) {
      const digitos = q.replace(/\D/g, '')
      lista.push(...leads
        .filter(l => normal(l.nomeCliente).includes(q) || (l.modeloInteresse && normal(l.modeloInteresse).includes(q)) || (digitos.length >= 4 && (l.telefone ?? '').replace(/\D/g, '').includes(digitos)))
        .slice(0, 8)
        .map(l => ({
          id: `lead:${l.id}`, grupo: 'Leads', titulo: l.nomeCliente,
          detalhe: [ETAPA[l.estagio] ?? l.estagio, l.modeloInteresse, l.vendedor?.nome].filter(Boolean).join(' · '),
          ir: () => abrirCompleto(`/pro-labore/leads?lead=${l.id}`),
        })))
    }
    return lista
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, itens, leads, podeCrm])

  if (!aberta) return null
  const atual = Math.min(indice, Math.max(0, opcoes.length - 1))

  function tecla(e: React.KeyboardEvent) {
    if (e.key === 'Escape') fechar()
    else if (e.key === 'ArrowDown') { e.preventDefault(); setIndice((atual + 1) % Math.max(1, opcoes.length)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndice((atual - 1 + opcoes.length) % Math.max(1, opcoes.length)) }
    else if (e.key === 'Enter' && opcoes[atual]) { e.preventDefault(); opcoes[atual].ir() }
  }

  let grupoAnterior = ''
  return (
    <div className="pl-cmd-fundo" onClick={fechar}>
      <div className="pl-cmd" role="dialog" aria-label="Buscar no sistema" onClick={e => e.stopPropagation()} data-paleta>
        <div className="pl-cmd-busca">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input autoFocus value={busca} onChange={e => { setBusca(e.target.value); setIndice(0) }} onKeyDown={tecla} placeholder={podeCrm ? 'Buscar aba, lead (nome, telefone, moto) ou ação…' : 'Buscar aba ou ação…'} aria-label="Buscar" />
          <kbd>Esc</kbd>
        </div>
        <ul className="pl-cmd-lista" role="listbox">
          {opcoes.length === 0 && <li className="pl-cmd-vazio">{leads === null && podeCrm && busca.trim().length >= 2 ? 'Buscando…' : 'Nada encontrado.'}</li>}
          {opcoes.map((o, i) => {
            const cabecalho = o.grupo !== grupoAnterior
            grupoAnterior = o.grupo
            return (
              <li key={o.id}>
                {cabecalho && <div className="pl-cmd-grupo">{o.grupo}</div>}
                <button type="button" role="option" aria-selected={i === atual} className={i === atual ? 'ativo' : ''} onMouseEnter={() => setIndice(i)} onClick={o.ir} data-opcao={o.id}>
                  <span>{o.titulo}</span>
                  {o.detalhe && <small>{o.detalhe}</small>}
                </button>
              </li>
            )
          })}
        </ul>
        <div className="pl-cmd-rodape"><span><kbd>↑</kbd><kbd>↓</kbd> escolher</span><span><kbd>Enter</kbd> abrir</span><span><kbd>Ctrl</kbd>+<kbd>K</kbd> abre de qualquer tela</span></div>
      </div>
    </div>
  )
}
