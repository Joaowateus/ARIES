'use client'

// PDF 07 · Central de Conhecimento: substitui a Base de conhecimento. Tudo o que o ARIES
// sabe num lugar só, sempre atualizado e com as permissões de cada um (conferidas no servidor):
// Explorar (pesquisa e pergunta), Indicadores (o dicionário), Conhecimento comercial
// (verbetes com versões) e Saúde da Central (só o dono).
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { abaPorChave } from '@/lib/abasAries'
import { centralApi, type TopoCentral } from '@/lib/proLaboreApi'
import { Cabecalho, Lente, fmtValor } from '../../_padrao/Padrao'
import { Explorar } from './_central/Explorar'
import { Indicadores } from './_central/Indicadores'
import { SaudeCentral } from './_central/Saude'
import { Conhecimento } from '../../assistente/_componentes/Conhecimento'
import { dataHora } from './_central/util'

type Sub = 'explorar' | 'indicadores' | 'comercial' | 'saude'
const SUBS: Array<{ valor: Sub; rotulo: string; soDono?: boolean }> = [
  { valor: 'explorar', rotulo: 'Explorar' }, { valor: 'indicadores', rotulo: 'Indicadores' },
  { valor: 'comercial', rotulo: 'Conhecimento comercial' }, { valor: 'saude', rotulo: 'Saúde da Central', soDono: true },
]

function Topo() {
  const [topo, setTopo] = useState<TopoCentral | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => { centralApi.topo().then(setTopo).catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível carregar')) }, [])
  if (erro) return <div className="pl-alert pl-alert-error" role="alert">{erro}</div>
  if (!topo) return <section className="ar-agora" aria-busy="true">{[0, 1, 2].map(i => <div key={i} className="ar-numero" style={{ minHeight: 78, opacity: .5 }}><div className="ar-num-nome">Carregando…</div></div>)}</section>
  return (
    <>
      <section className="ar-agora" aria-label="Agora" data-central-topo={topo.papel}>
        {topo.numeros.map(n => (
          <div key={n.chave} className="ar-numero" data-numero={n.chave} style={{ cursor: 'default' }}>
            <div className="ar-num-nome"><span>{n.nome}</span></div>
            <div className="ar-num-valor">{fmtValor(n.valor, n.unidade)}</div>
            <div className="ar-num-sub">{n.detalhe}</div>
          </div>
        ))}
      </section>
      <p className="pl-hint cc-frescor" data-central-frescor>
        Última atualização da Central: {topo.ultimaAtualizacao ? dataHora(topo.ultimaAtualizacao) : 'ainda sem dados (a carga inicial roda nos próximos minutos)'}
      </p>
      {topo.aviso && <div className="pl-alert cc-aviso" role="status" data-central-atraso>{topo.aviso}</div>}
    </>
  )
}

function Conteudo() {
  const params = useSearchParams()
  const router = useRouter()
  const { usuario } = useProLaboreAuth()
  const aba = abaPorChave('central-conhecimento')!
  const dono = usuario?.papel === 'DONO'
  const pedida = params.get('sub') as Sub | null
  const sub: Sub = pedida && SUBS.some(s => s.valor === pedida && (!s.soDono || dono)) ? pedida : 'explorar'
  const ir = useCallback((s: Sub) => { const p = new URLSearchParams(); p.set('sub', s); router.replace(`/pro-labore/aba/central-conhecimento?${p}`, { scroll: false }) }, [router])
  return (
    <div data-central-conhecimento={sub}>
      <Cabecalho aba={aba} />
      <div className="ar-tela-larga ar-tela-compacta">
        <Lente aba={aba.lente} compacta />
        <div className="ar-trabalho">
          <Topo />
          <div className="pl-sv-tabs cc-subabas" role="tablist" aria-label="Seções da Central de Conhecimento">
            {SUBS.filter(s => !s.soDono || dono).map(s => (
              <button key={s.valor} type="button" role="tab" aria-selected={sub === s.valor} className={sub === s.valor ? 'ativo' : ''} onClick={() => ir(s.valor)} data-subaba={s.valor}>{s.rotulo}</button>
            ))}
          </div>
          <div role="tabpanel" className="cc-painel">
            {sub === 'explorar' && <Explorar inicial={params.get('q') ?? ''} />}
            {sub === 'indicadores' && <Indicadores abrir={params.get('ficha')} />}
            {sub === 'comercial' && <Conhecimento abrirId={params.get('verbete') ?? undefined} />}
            {sub === 'saude' && dono && <SaudeCentral />}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CentralConhecimentoPage() { return <Suspense fallback={null}><Conteudo /></Suspense> }
