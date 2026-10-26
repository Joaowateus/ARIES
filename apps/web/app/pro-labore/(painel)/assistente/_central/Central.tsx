'use client'

// Central de Inteligência Operacional: o cérebro analítico da operação.
// Junta Jornada de compra (fonte oficial do funil), Tráfego, Social Media,
// Vendas, Financeiro, Equipe e Estoque; calcula metas, projeções e custos
// por fórmulas fixas; gera os diagnósticos, a priorização e o plano de ação.
import './central.css'
import { useEffect, useState } from 'react'
import { proLaboreApi, type IntelCentral } from '@/lib/proLaboreApi'
import { PageHeader } from '../../../PageHeader'
import { WhatsApp } from '../_componentes/WhatsApp'
import { VisaoGeral } from './VisaoGeral'
import { MetasFunil } from './MetasFunil'
import { Aquisicao } from './Aquisicao'
import { Departamentos } from './Departamentos'
import { Plano } from './Plano'
import { Reuniao } from './Reuniao'
import { Fechamentos } from './Fechamentos'
import { Premissas } from './Premissas'
import { mesAtual, nomeMes, periodoDoMes, ultimosMeses } from './fmt'
import { BotaoPdf } from '../../_pdf/BotaoPdf'
import { relatorioCentral } from './pdfCentral'

export type AbaCentral = 'visao' | 'metas' | 'aquisicao' | 'departamentos' | 'plano' | 'reuniao' | 'fechamentos' | 'premissas' | 'whatsapp'
const ABAS: Array<{ valor: AbaCentral; rotulo: string }> = [
  { valor: 'visao', rotulo: 'Visão geral' },
  { valor: 'metas', rotulo: 'Metas e funil' },
  { valor: 'aquisicao', rotulo: 'Aquisição' },
  { valor: 'departamentos', rotulo: 'Departamentos' },
  { valor: 'plano', rotulo: 'Diagnóstico e plano' },
  { valor: 'reuniao', rotulo: 'Reunião' },
  { valor: 'fechamentos', rotulo: 'Fechamentos' },
  { valor: 'premissas', rotulo: 'Premissas' },
  { valor: 'whatsapp', rotulo: 'WhatsApp' },
]
// Abas que leem o retrato da Central (as outras buscam o que precisam).
const USA_CENTRAL: AbaCentral[] = ['visao', 'metas', 'aquisicao', 'departamentos', 'plano', 'premissas']

export function Central() {
  // ?aba=whatsapp (link "Conectar WhatsApp" do CRM) abre direto na aba.
  const [aba, setAba] = useState<AbaCentral>(() => {
    const pedida = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('aba')
    return ABAS.find(a => a.valor === pedida)?.valor ?? 'visao'
  })
  const [mes, setMes] = useState(mesAtual())
  const [versao, setVersao] = useState(0)
  const [dados, setDados] = useState<{ chave: string; d: IntelCentral } | null>(null)
  const [erro, setErro] = useState<{ chave: string; texto: string } | null>(null)
  const chave = `${mes}|${versao}`
  const precisa = USA_CENTRAL.includes(aba)

  useEffect(() => {
    if (!precisa) return
    let cancelado = false
    const { inicio, fim } = periodoDoMes(mes)
    proLaboreApi.intel.central(inicio, fim)
      .then(d => { if (!cancelado) setDados({ chave, d }) })
      .catch(e => { if (!cancelado) setErro({ chave, texto: (e as Error).message }) })
    return () => { cancelado = true }
  }, [chave, mes, precisa])

  const atual = dados && dados.chave.startsWith(`${mes}|`) ? dados.d : null
  const recarregando = !!dados && dados.chave !== chave
  const erroAtual = erro?.chave === chave ? erro.texto : ''
  const atualizar = () => setVersao(v => v + 1)
  const criticos = atual?.diagnosticos.filter(x => x.severidade === 'CRITICO' || x.severidade === 'ALTO').length ?? 0
  const meses = ultimosMeses(12)
  // PDF do dia: sempre o mês corrente, com os números de agora.
  async function montarPdf(gestao: boolean) {
    const { inicio, fim } = periodoDoMes(mesAtual())
    return relatorioCentral(await proLaboreApi.intel.central(inicio, fim), { gestao })
  }

  return (
    <div className="ic">
      <PageHeader
        eyebrow="Vendas · Central de inteligência"
        title="Assistente Comercial"
        subtitle="O cérebro analítico da operação: lê a Jornada de compra, Tráfego, Social Media, Vendas, Financeiro e Equipe, compara com as metas, explica onde está o gargalo e acompanha o plano de ação até o resultado"
        actions={<BotaoPdf versoes={[
          { rotulo: 'Completo (gestão)', descricao: 'Tudo, com o financeiro do mês', montar: () => montarPdf(true) },
          { rotulo: 'Para a equipe', descricao: 'Sem o financeiro e o pró-labore', montar: () => montarPdf(false) },
        ]} />}
      />

      <div className="ic-topo">
        <div className="pl-sv-tabs" role="tablist" aria-label="Seções da Central">
          {ABAS.map(a => (
            <button key={a.valor} type="button" role="tab" aria-selected={aba === a.valor} className={aba === a.valor ? 'ativo' : ''} onClick={() => setAba(a.valor)}>
              {a.rotulo}
              {a.valor === 'plano' && criticos > 0 && <span className="cp-badge" style={{ marginLeft: 6 }} aria-label={`${criticos} alertas críticos ou altos`}>{criticos}</span>}
            </button>
          ))}
        </div>
        {aba !== 'whatsapp' && aba !== 'fechamentos' && aba !== 'premissas' && (
          <div className="ic-topo-dir">
            <label className="pl-hint" htmlFor="ic-mes">Mês</label>
            <select id="ic-mes" className="pl-select-chip active" value={mes} onChange={e => setMes(e.target.value)}>
              {meses.map(m => <option key={m} value={m}>{nomeMes(m)}{m === mesAtual() ? ' (até hoje)' : ''}</option>)}
            </select>
            <button type="button" className="pl-btn pl-btn-ghost ic-btn-p" onClick={atualizar}>Atualizar</button>
          </div>
        )}
      </div>

      {aba === 'whatsapp' ? <WhatsApp cabecalho={false} />
        : aba === 'reuniao' ? <Reuniao mes={mes} />
        : aba === 'fechamentos' ? <Fechamentos />
        : erroAtual ? <div className="pl-alert pl-alert-error">{erroAtual}</div>
        : !atual ? <div className="pl-hint">Cruzando os dados da operação…</div>
        : (
          <div style={{ opacity: recarregando ? 0.55 : 1, transition: 'opacity .2s ease', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {aba === 'visao' && <VisaoGeral d={atual} mes={mes} irPara={setAba} />}
            {aba === 'metas' && <MetasFunil d={atual} />}
            {aba === 'aquisicao' && <Aquisicao d={atual} />}
            {aba === 'departamentos' && <Departamentos d={atual} />}
            {aba === 'plano' && <Plano d={atual} onMudou={atualizar} />}
            {aba === 'premissas' && <Premissas d={atual} onSalvo={atualizar} />}
          </div>
        )}
    </div>
  )
}
