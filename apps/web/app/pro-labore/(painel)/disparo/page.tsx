'use client'

// ARIES DISPARO — central de campanhas e distribuição de mensagens pelo WhatsApp e Instagram.
// Abas por frequência de uso (redesign 26/11): Visão geral, Campanhas, Respostas, Jornada, Públicos,
// Biblioteca e Configurações (ícone). Uma barra só com as abas, de quem são as campanhas mostradas e
// "Nova campanha". Toda regra (permissão, autorização, ritmo, envio) é do servidor; a tela só mostra e pede.
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { abaPorChave } from '@/lib/abasAries'
import { disparoApi, type MetaDisparo } from '@/lib/proLaboreApi'
import { Cabecalho } from '../_padrao/Padrao'
import { EscopoCtx, MetaCtx, RecarregarMetaCtx, SeletorEscopo, erroDe } from './_disparo/util'
import { Respostas } from './_disparo/Respostas'
import { DisparoUi } from './_disparo/ui'
import { VisaoGeral } from './_disparo/VisaoGeral'
import { Campanhas } from './_disparo/Campanhas'
import { Publicos } from './_disparo/Publicos'
import { Biblioteca } from './_disparo/Biblioteca'
import { Configuracoes } from './_disparo/Configuracoes'
import { Jornada } from './_disparo/Jornada'

type Sub = 'visao' | 'jornada' | 'campanhas' | 'respostas' | 'publicos' | 'biblioteca' | 'configuracoes'
const SUBS: Array<{ valor: Sub; rotulo: string }> = [
  { valor: 'visao', rotulo: 'Visão geral' }, { valor: 'campanhas', rotulo: 'Campanhas' }, { valor: 'respostas', rotulo: 'Respostas' }, { valor: 'jornada', rotulo: 'Jornada do CRM' }, { valor: 'publicos', rotulo: 'Públicos' },
  { valor: 'biblioteca', rotulo: 'Biblioteca' }, { valor: 'configuracoes', rotulo: 'Configurações' },
]
const ler = (k: string, padrao: string) => { try { return (typeof window !== 'undefined' && localStorage.getItem(k)) || padrao } catch { return padrao } }
const gravar = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* sem armazenamento */ } }

function Conteudo() {
  const params = useSearchParams()
  const router = useRouter()
  const aba = abaPorChave('disparo')!
  const [meta, setMeta] = useState<MetaDisparo | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  // De quem são as campanhas mostradas (só dono e supervisor trocam; fica lembrado neste navegador).
  // Na Visão geral, dono e supervisor começam pela equipe toda; nas outras abas, pelas próprias campanhas.
  const [de, setDeEstado] = useState(() => ler('aries:disparo:de', 'minhas'))
  const [deVisao, setDeVisao] = useState(() => ler('aries:disparo:de:visao', 'equipe'))
  const recarregarMeta = useCallback(() => { disparoApi.meta().then(setMeta).catch(e => setErro(erroDe(e))) }, [])
  useEffect(() => { recarregarMeta() }, [recarregarMeta])
  const pedida = params.get('sub') as Sub | null
  const sub: Sub = pedida && SUBS.some(s => s.valor === pedida) ? pedida : 'visao'
  const campanha = params.get('campanha')
  const nova = params.get('nova') === '1'
  const naVisao = sub === 'visao'
  const setDe = useCallback((v: string) => { if (naVisao) { setDeVisao(v); gravar('aries:disparo:de:visao', v) } else { setDeEstado(v); gravar('aries:disparo:de', v) } }, [naVisao])
  const escopo = useMemo(() => ({ de: meta?.gestao ? (naVisao ? deVisao : de) : 'minhas', setDe }), [de, deVisao, naVisao, setDe, meta?.gestao])
  const ir = useCallback((s: Sub, extra: Record<string, string> = {}) => {
    const p = new URLSearchParams({ sub: s, ...extra })
    router.replace(`/pro-labore/disparo?${p}`, { scroll: false })
  }, [router])
  if (erro) return <div><Cabecalho aba={aba} /><div className="pl-alert pl-alert-error" role="alert">{erro}</div></div>
  if (!meta) return <div><Cabecalho aba={aba} /><p className="pl-hint" aria-busy="true">Carregando o Disparo…</p></div>
  return (
    <MetaCtx.Provider value={meta}><RecarregarMetaCtx.Provider value={recarregarMeta}><EscopoCtx.Provider value={escopo}>
      <div data-disparo={sub}><DisparoUi>
        <Cabecalho aba={aba} />
        <div className="dp-barra">
          <div className="dp-abas" role="tablist" aria-label="Áreas do Disparo">
            {SUBS.map(s => <button key={s.valor} type="button" role="tab" aria-selected={sub === s.valor} className={`${sub === s.valor ? 'ativo' : ''} ${s.valor === 'configuracoes' ? 'icone' : ''}`} onClick={() => ir(s.valor)} data-subaba={s.valor} title={s.valor === 'configuracoes' ? s.rotulo : undefined} aria-label={s.rotulo}>{s.valor === 'configuracoes' ? <IconeAjustes /> : s.rotulo}</button>)}
          </div>
          <div className="dp-barra-acoes">
            {['visao', 'jornada', 'campanhas', 'respostas'].includes(sub) && !campanha && !nova && <SeletorEscopo />}
            {meta.nivel === 'EDITAR' && !(sub === 'campanhas' && (campanha || nova)) && <button type="button" className="pl-btn pl-btn-primary" onClick={() => ir('campanhas', { nova: '1' })} data-nova-campanha-topo>+ Nova campanha</button>}
          </div>
        </div>
        <div role="tabpanel" className="dp-painel">
          {sub === 'visao' && <VisaoGeral abrir={id => ir('campanhas', { campanha: id })} />}
          {sub === 'jornada' && <Jornada abrir={id => ir('campanhas', { campanha: id })} />}
          {sub === 'campanhas' && <Campanhas aberta={campanha} nova={nova} abrir={id => ir('campanhas', id ? { campanha: id } : {})} />}
          {sub === 'respostas' && <Respostas abrir={id => ir('campanhas', { campanha: id })} />}
          {sub === 'publicos' && <Publicos />}
          {sub === 'biblioteca' && <Biblioteca />}
          {sub === 'configuracoes' && <Configuracoes aoSalvar={recarregarMeta} />}
        </div>
      </DisparoUi></div>
    </EscopoCtx.Provider></RecarregarMetaCtx.Provider></MetaCtx.Provider>
  )
}

function IconeAjustes() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
}

export default function DisparoPage() { return <Suspense fallback={null}><Conteudo /></Suspense> }
