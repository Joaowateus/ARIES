'use client'

// ARIES DISPARO — central de campanhas e distribuição de mensagens pelo WhatsApp.
// Cinco áreas: Visão geral, Campanhas, Públicos, Biblioteca e Configurações. Toda regra (permissão,
// autorização, ritmo, envio) é do servidor; a tela só mostra e pede.
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { abaPorChave } from '@/lib/abasAries'
import { disparoApi, type MetaDisparo } from '@/lib/proLaboreApi'
import { Cabecalho } from '../_padrao/Padrao'
import { MetaCtx, RecarregarMetaCtx, erroDe } from './_disparo/util'
import { VisaoGeral } from './_disparo/VisaoGeral'
import { Campanhas } from './_disparo/Campanhas'
import { Publicos } from './_disparo/Publicos'
import { Biblioteca } from './_disparo/Biblioteca'
import { Configuracoes } from './_disparo/Configuracoes'

type Sub = 'visao' | 'campanhas' | 'publicos' | 'biblioteca' | 'configuracoes'
const SUBS: Array<{ valor: Sub; rotulo: string }> = [
  { valor: 'visao', rotulo: 'Visão geral' }, { valor: 'campanhas', rotulo: 'Campanhas' }, { valor: 'publicos', rotulo: 'Públicos' },
  { valor: 'biblioteca', rotulo: 'Biblioteca' }, { valor: 'configuracoes', rotulo: 'Configurações' },
]

function Conteudo() {
  const params = useSearchParams()
  const router = useRouter()
  const aba = abaPorChave('disparo')!
  const [meta, setMeta] = useState<MetaDisparo | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const recarregarMeta = useCallback(() => { disparoApi.meta().then(setMeta).catch(e => setErro(erroDe(e))) }, [])
  useEffect(() => { recarregarMeta() }, [recarregarMeta])
  const pedida = params.get('sub') as Sub | null
  const sub: Sub = pedida && SUBS.some(s => s.valor === pedida) ? pedida : 'visao'
  const campanha = params.get('campanha')
  const ir = useCallback((s: Sub, extra: Record<string, string> = {}) => {
    const p = new URLSearchParams({ sub: s, ...extra })
    router.replace(`/pro-labore/disparo?${p}`, { scroll: false })
  }, [router])
  if (erro) return <div><Cabecalho aba={aba} /><div className="pl-alert pl-alert-error" role="alert">{erro}</div></div>
  if (!meta) return <div><Cabecalho aba={aba} /><p className="pl-hint" aria-busy="true">Carregando o Disparo…</p></div>
  return (
    <MetaCtx.Provider value={meta}><RecarregarMetaCtx.Provider value={recarregarMeta}>
      <div data-disparo={sub}>
        <Cabecalho aba={aba} />
        <div className="pl-sv-tabs cc-subabas" role="tablist" aria-label="Áreas do Disparo">
          {SUBS.map(s => <button key={s.valor} type="button" role="tab" aria-selected={sub === s.valor} className={sub === s.valor ? 'ativo' : ''} onClick={() => ir(s.valor)} data-subaba={s.valor}>{s.rotulo}</button>)}
        </div>
        <div role="tabpanel" className="dp-painel">
          {sub === 'visao' && <VisaoGeral abrir={id => ir('campanhas', { campanha: id })} />}
          {sub === 'campanhas' && <Campanhas aberta={campanha} abrir={id => ir('campanhas', id ? { campanha: id } : {})} />}
          {sub === 'publicos' && <Publicos />}
          {sub === 'biblioteca' && <Biblioteca />}
          {sub === 'configuracoes' && <Configuracoes aoSalvar={recarregarMeta} />}
        </div>
      </div>
    </RecarregarMetaCtx.Provider></MetaCtx.Provider>
  )
}

export default function DisparoPage() { return <Suspense fallback={null}><Conteudo /></Suspense> }
