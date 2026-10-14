'use client'

// Fechamentos diários recebidos das abas: o que já foi validado hoje, o que
// falta, e o histórico com as versões (a substituída fica guardada).
import { useEffect, useState } from 'react'
import { proLaboreApi, type IntelModuloRelatorio, type IntelRelatorio } from '@/lib/proLaboreApi'
import { JanelaFechamento } from '../../_fechamento/FechamentoDiario'
import { dataBR, dataHoraBR, hojeBR, valorIndicador } from './fmt'

const MODULOS: Array<{ valor: IntelModuloRelatorio; rotulo: string; aba: string }> = [
  { valor: 'JORNADA', rotulo: 'Jornada de compra', aba: 'Dashboard' },
  { valor: 'TRAFEGO', rotulo: 'Tráfego', aba: 'Tráfego' },
  { valor: 'SOCIAL_MEDIA', rotulo: 'Social Media', aba: 'Social Media' },
  { valor: 'VENDAS', rotulo: 'Vendas', aba: 'Vendas' },
  { valor: 'FINANCEIRO', rotulo: 'Financeiro', aba: 'Financeiro' },
]

export function Fechamentos() {
  const [lista, setLista] = useState<IntelRelatorio[] | null>(null)
  const [versao, setVersao] = useState(0)
  const [erro, setErro] = useState('')
  const [abrir, setAbrir] = useState<IntelModuloRelatorio | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)
  const [verSubstituidos, setVerSubstituidos] = useState(false)

  useEffect(() => {
    let cancelado = false
    proLaboreApi.intel.relatorios(31).then(l => { if (!cancelado) setLista(l) }).catch(e => { if (!cancelado) setErro((e as Error).message) })
    return () => { cancelado = true }
  }, [versao])

  const hoje = hojeBR()
  const deHoje = (m: IntelModuloRelatorio) => lista?.find(r => r.modulo === m && r.dia === hoje && r.status === 'VALIDO') ?? null
  const visiveis = (lista ?? []).filter(r => verSubstituidos || r.status === 'VALIDO')
  const nome = (m: IntelModuloRelatorio) => MODULOS.find(x => x.valor === m)?.rotulo ?? m

  return (
    <>
      <section className="ic-card">
        <div className="ic-cab">
          <div><h2>Fechamento de hoje</h2><p className="ic-sub">Cada aba tem o botão &quot;Enviar relatório para o Assistente Comercial&quot;. Também dá para enviar daqui. Reenviar com os mesmos números não duplica; números novos viram outra versão.</p></div>
        </div>
        {erro && <div className="pl-alert pl-alert-error">{erro}</div>}
        <div className="ic-fontes">
          {MODULOS.map(m => {
            const r = deHoje(m.valor)
            return (
              <div key={m.valor} className="ic-fonte" data-modulo={m.valor}>
                <div className="ic-fonte-cab"><b>{m.rotulo}</b><span className={`ic-tag ${r ? 'OK' : 'SEM_DADOS'}`}>{r ? `Validado · v${r.versao}` : 'Pendente'}</span></div>
                <small>{r ? `Por ${r.geradoPorNome} às ${dataHoraBR(r.confirmadoEm).split(' ').pop()}` : `Envie pela aba ${m.aba} ou por aqui.`}</small>
                <button type="button" className="pl-btn pl-btn-ghost ic-btn-p" style={{ alignSelf: 'flex-start', marginTop: 4 }} onClick={() => setAbrir(m.valor)}>{r ? 'Conferir de novo' : 'Enviar fechamento'}</button>
              </div>
            )
          })}
        </div>
      </section>

      <section className="ic-card">
        <div className="ic-cab">
          <div><h2>Histórico dos últimos 31 dias</h2><p className="ic-sub">Validado é o número que a pessoa conferiu e confirmou. Clique para ver os indicadores do envio.</p></div>
          <label className="ic-legenda" style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={verSubstituidos} onChange={e => setVerSubstituidos(e.target.checked)} /> Mostrar versões substituídas</label>
        </div>
        {!lista ? <div className="pl-hint">Carregando…</div> : visiveis.length === 0 ? <p className="ic-legenda">Nenhum fechamento enviado ainda.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {visiveis.map(r => (
              <div key={r.id} style={{ borderBottom: '1px solid var(--pl-border)' }}>
                <button type="button" className="ic-linha" style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit' }} onClick={() => setAberto(a => (a === r.id ? null : r.id))} aria-expanded={aberto === r.id}>
                  <span>{dataBR(`${r.dia}T12:00:00Z`)} · {nome(r.modulo)}<small>Versão {r.versao} · {r.geradoPorNome} · {dataHoraBR(r.confirmadoEm)}{r.observacao ? ` · "${r.observacao}"` : ''}</small></span>
                  <b><span className={`ic-tag ${r.status === 'VALIDO' ? 'OK' : 'SEM_DADOS'}`}>{r.status === 'VALIDO' ? 'Válido' : 'Substituído'}</span></b>
                </button>
                {aberto === r.id && (
                  <div className="ic-rola" style={{ padding: '0 0 12px' }}>
                    <table className="ic-tabela" style={{ minWidth: 480 }}>
                      <thead><tr><th>Indicador</th><th className="num">Valor</th><th className="num">Meta</th><th>Fonte</th></tr></thead>
                      <tbody>{r.indicadores.map(i => <tr key={i.chave}><td>{i.nome}</td><td className="num">{valorIndicador(i.valor, i.unidade)}</td><td className="num">{valorIndicador(i.meta, i.unidade)}</td><td className="fraco">{i.fonte}</td></tr>)}</tbody>
                    </table>
                    {r.alertas.length > 0 && <ul className="ic-pontos" style={{ marginTop: 8 }}>{r.alertas.map(a => <li key={a.problema}>{a.problema}</li>)}</ul>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {abrir && <JanelaFechamento modulo={abrir} onFechar={() => setAbrir(null)} onEnviado={() => setVersao(v => v + 1)} />}
    </>
  )
}
