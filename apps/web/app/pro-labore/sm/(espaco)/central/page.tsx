'use client'

// Central Estratégica de Conteúdo: o comando da produção mensal (prompt
// mestre). O dossiê do AVATAR é a fonte; o ciclo do mês tem 180 vídeos
// (20 dias × 9: manhã topo, tarde meio, noite fundo) com roteiro, produção,
// publicação, métricas e aprendizados; o fechamento alimenta o próximo mês.
import { Suspense, useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { proLaboreApi, type CtCiclo, type CtVisao } from '@/lib/proLaboreApi'
import { Botao, CardEsqueleto, Chip, EstadoVazio, Rotulo, Segmentado, useToast } from '../../_ui'
import { useEspacoSM } from '../EspacoSM'
import { CICLO_ROTULO } from './rotulos'
import { Painel } from './Painel'
import { Calendario, type Filtro } from './Calendario'
import { Resultados } from './Resultados'
import { Bancos } from './Bancos'
import { Provas } from './Provas'
import { DossieTela } from './Dossie'
import { MesEHistorico } from './MesEHistorico'

export type Aba = 'painel' | 'calendario' | 'producao' | 'resultados' | 'bancos' | 'provas' | 'dossie' | 'mes'
const ABAS: ReadonlyArray<{ valor: Aba; rotulo: string }> = [
  { valor: 'painel', rotulo: 'Painel' }, { valor: 'calendario', rotulo: 'Calendário e roteiros' }, { valor: 'producao', rotulo: 'Produção e publicação' },
  { valor: 'resultados', rotulo: 'Métricas e aprendizados' }, { valor: 'bancos', rotulo: 'Bancos' }, { valor: 'provas', rotulo: 'Provas e ativos' },
  { valor: 'dossie', rotulo: 'Dossiê do AVATAR' }, { valor: 'mes', rotulo: 'Fechamento e histórico' },
]

const hojeLocal = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10)
/** Dias de segunda a sexta do mês, de hoje em diante (no máximo os 20 da meta-base). */
function diasUteisDesde(mes: string, hoje: string): string[] {
  const [a, m] = mes.split('-').map(Number)
  const dias: string[] = []
  for (let d = 1; d <= 31 && dias.length < 20; d++) {
    const dt = new Date(Date.UTC(a, m - 1, d))
    if (dt.getUTCMonth() !== m - 1) break
    const iso = dt.toISOString().slice(0, 10)
    if (iso >= hoje && dt.getUTCDay() >= 1 && dt.getUTCDay() <= 5) dias.push(iso)
  }
  return dias
}

export interface Navegar { (aba: Aba, filtro?: Partial<Filtro>, banco?: string): void }

export default function CentralPage() {
  return <Suspense fallback={<CardEsqueleto linhas={6} texto="Abrindo a Central" />}><Central /></Suspense>
}

function Central() {
  const { pode } = useEspacoSM()
  const busca = useSearchParams()
  const router = useRouter()
  const caminho = usePathname()
  const toast = useToast()
  const aba = (ABAS.some(a => a.valor === busca.get('aba')) ? busca.get('aba') : 'painel') as Aba
  const [visao, setVisao] = useState<CtVisao | null>(null)
  const [cicloId, setCicloId] = useState<string | null>(busca.get('ciclo'))
  const [dados, setDados] = useState<CtCiclo | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Partial<Filtro>>({})
  const [banco, setBanco] = useState<string | undefined>(undefined)
  const [gerando, setGerando] = useState(false)

  const carregarVisao = useCallback(() => {
    proLaboreApi.sm.central.visao().then(v => { setVisao(v); setCicloId(c => c ?? v.atualId); setErro(null) }).catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível abrir a Central'))
  }, [])
  const carregarCiclo = useCallback((id: string) => {
    proLaboreApi.sm.central.ciclo(id).then(d => { setDados(d); setErro(null) }).catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível abrir o ciclo'))
  }, [])
  useEffect(() => { if (pode('producao')) carregarVisao() }, [carregarVisao, pode])
  useEffect(() => { if (cicloId) carregarCiclo(cicloId) }, [cicloId, carregarCiclo])
  const recarregar = useCallback(() => { carregarVisao(); if (cicloId) carregarCiclo(cicloId) }, [carregarVisao, carregarCiclo, cicloId])

  const irPara: Navegar = (nova, f, b) => {
    if (f) setFiltro(f)
    if (b) setBanco(b)
    const q = new URLSearchParams(busca.toString()); q.set('aba', nova)
    router.replace(`${caminho}?${q.toString()}`, { scroll: false })
  }
  function trocarCiclo(id: string) {
    setCicloId(id); setDados(null)
    const q = new URLSearchParams(busca.toString()); q.set('ciclo', id)
    router.replace(`${caminho}?${q.toString()}`, { scroll: false })
  }
  async function gerar(mes: string, dias?: string[]) {
    setGerando(true)
    try {
      const c = await proLaboreApi.sm.central.gerar(mes, dias)
      toast({ mensagem: `Calendário gerado: ${(dias?.length ?? 20) * 9} vídeos com roteiro-base (versão ${c.versao}).` })
      setCicloId(c.id); carregarVisao()
    } catch (e) { toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível gerar', tom: 'bad' }) } finally { setGerando(false) }
  }

  if (!pode('producao')) return <div className="sm-card"><EstadoVazio titulo="Sem acesso à Central">O gestor pode liberar o módulo Produção em Equipe → Acessos e permissões.</EstadoVazio></div>

  return (
    <>
      <header className="sm-pagina-cab">
        <div>
          <Rotulo>Trabalho · Central de conteúdo</Rotulo>
          <h1 className="sm-ttl sm-h1">Central Estratégica de Conteúdo</h1>
          <p>O que produzir em cada dia, com roteiro pronto, do dossiê do AVATAR até o resultado de cada vídeo.</p>
        </div>
        {visao && visao.ciclos.length > 0 && (
          <label className="sm-campo ct-seletor">Ciclo
            <select className="sm-input" value={cicloId ?? ''} onChange={e => trocarCiclo(e.target.value)}>
              {visao.ciclos.map(c => <option key={c.id} value={c.id}>{c.nomeMes} · versão {c.versao} · {CICLO_ROTULO[c.status]}</option>)}
            </select>
          </label>
        )}
      </header>
      {erro && <p className="sm-erro" role="alert">{erro}</p>}
      {!visao && !erro && <CardEsqueleto linhas={6} texto="Abrindo a Central" />}
      {visao && visao.ciclos.length === 0 && (
        <div className="sm-card">
          <EstadoVazio titulo="Nenhum calendário ainda" acao={visao.podeEditar ? (
            <div className="sm-linha-acoes" style={{ justifyContent: 'center' }}>
              {(() => {
                const restantes = diasUteisDesde(visao.mesAtual, hojeLocal())
                return restantes.length > 0 && (
                  <Botao variante="pri" disabled={gerando} onClick={() => gerar(visao.mesAtual, restantes)}>
                    {gerando ? 'Gerando…' : restantes.length >= 20 ? 'Gerar o calendário deste mês (180 vídeos)' : `Gerar este mês a partir de hoje (${restantes.length} dias, ${restantes.length * 9} vídeos)`}
                  </Botao>
                )
              })()}
              <Botao disabled={gerando} onClick={() => gerar(visao.proximoMes)}>Gerar o próximo mês completo (180 vídeos)</Botao>
            </div>
          ) : undefined}>
            A Central monta 180 vídeos para 20 dias de produção (3 de manhã no topo do funil, 3 à tarde no meio e 3 à noite no fundo), a partir do dossiê do AVATAR (versão {visao.dossieVersao}). Cada vídeo sai com roteiro-base completo; depois você revisa, gera com a IA, aprova e leva para a Produção.
          </EstadoVazio>
        </div>
      )}
      {visao && visao.ciclos.length > 0 && (
        <>
          <Segmentado rotulo="Seções da Central" className="ct-abas" opcoes={ABAS} valor={aba} aoMudar={a => irPara(a)} />
          {aba === 'dossie' ? <DossieTela /> : aba === 'provas' ? <Provas /> : aba === 'bancos' ? <Bancos inicial={banco} dados={dados} /> : !dados ? <CardEsqueleto linhas={6} texto="Abrindo o ciclo" /> : (
            <>
              {dados.ciclo.status === 'ARQUIVADO' && <p className="sm-legenda ct-aviso-arquivo">Versão arquivada: fica só para consulta. A versão vigente do mês está no seletor de ciclo.</p>}
              {aba === 'painel' && <Painel dados={dados} visao={visao} irPara={irPara} recarregar={recarregar} aoGerar={gerar} />}
              {aba === 'calendario' && <Calendario dados={dados} filtroInicial={filtro} recarregar={recarregar} />}
              {aba === 'producao' && <Calendario dados={dados} filtroInicial={filtro} recarregar={recarregar} modo="producao" />}
              {aba === 'resultados' && <Resultados dados={dados} recarregar={recarregar} />}
              {aba === 'mes' && <MesEHistorico dados={dados} visao={visao} recarregar={recarregar} aoAbrirCiclo={trocarCiclo} />}
            </>
          )}
          {dados && aba === 'painel' && <p className="sm-legenda" style={{ marginTop: 4 }}><Chip>{CICLO_ROTULO[dados.ciclo.status]}</Chip> Dossiê versão {dados.ciclo.dossieVersao} · gerado {dados.ciclo.origem === 'AUTOMATICO' ? 'automaticamente' : 'à mão'} em {new Date(dados.ciclo.criadoEm).toLocaleDateString('pt-BR')}</p>}
        </>
      )}
    </>
  )
}
