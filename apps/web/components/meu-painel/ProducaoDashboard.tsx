'use client'

import { useState } from 'react'
import { ProducaoDashboard, Usuario } from '@/lib/api'
import { formatMoeda, formatMoedaCompacta, formatPct } from '@/lib/format'

const MESES_NOME = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  const primeiras = partes[0]?.[0] ?? ''
  const ultimas = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (primeiras + ultimas).toUpperCase()
}

function Tendencia({ valor, sufixo, inverterCor }: { valor: number | null; sufixo: (v: number) => string; inverterCor?: boolean }) {
  if (valor == null) return <span className="text-xs text-gray-500">sem comparativo</span>
  const positivo = inverterCor ? valor < 0 : valor > 0
  const zero = valor === 0
  const cor = zero ? 'text-gray-400' : positivo ? 'text-emerald-400' : 'text-red-400'
  const seta = zero ? '' : valor > 0 ? '↑' : '↓'
  return <span className={`text-xs font-medium ${cor}`}>{seta} {sufixo(Math.abs(valor))}</span>
}

function KpiCard({ titulo, valor, tendencia, comparativo }: { titulo: string; valor: string; tendencia?: React.ReactNode; comparativo?: string }) {
  return (
    <div className="bg-[#171923] border border-white/10 rounded-xl p-5">
      <div className="text-sm text-gray-400 mb-2">{titulo}</div>
      <div className="text-2xl font-bold text-white mb-1">{valor}</div>
      {tendencia && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          {tendencia}
          {comparativo && <span>{comparativo}</span>}
        </div>
      )}
    </div>
  )
}

function ProgressoDark({ percentual }: { percentual: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(percentual * 100)))
  return (
    <div className="bg-white/10 rounded-full h-2.5">
      <div className="h-2.5 rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function ProducaoDashboardCard({ user, dados }: { user: Usuario | null; dados: ProducaoDashboard }) {
  const [visao, setVisao] = useState<'mensal' | 'anual'>('mensal')
  const [verTabela, setVerTabela] = useState(false)

  const agora = new Date()
  const nomeMes = MESES_NOME[agora.getMonth()]
  const ano = agora.getFullYear()

  const producaoAnualTotal = dados.producaoAnualAcumulada

  return (
    <div className="bg-[#0d0f17] rounded-2xl p-6 text-white">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center font-semibold text-sm shrink-0">
            {iniciais(user?.nome ?? '?')}
          </div>
          <div>
            <div className="font-semibold text-white">{user?.nome ?? '—'}</div>
            <div className="text-xs text-gray-400">Consultor de Vendas — ARIES</div>
          </div>
        </div>
        <div className="flex items-center bg-white/5 rounded-lg p-1 text-sm">
          <button
            onClick={() => setVisao('mensal')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${visao === 'mensal' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-gray-200'}`}
          >
            Visão mensal
          </button>
          <button
            onClick={() => setVisao('anual')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${visao === 'anual' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-gray-200'}`}
          >
            Visão anual
          </button>
        </div>
      </div>

      {/* KPIs — comuns às duas visões */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <KpiCard titulo="Produção total anual" valor={formatMoedaCompacta(producaoAnualTotal)} />
        <KpiCard
          titulo="Produção do mês (até hoje)"
          valor={formatMoedaCompacta(dados.producaoMesAteHoje)}
          tendencia={<Tendencia valor={dados.variacaoProducaoMesPct} sufixo={v => formatPct(v)} />}
          comparativo="vs mesmo período do mês anterior"
        />
        <KpiCard
          titulo="Vendas realizadas"
          valor={String(dados.vendasRealizadasMes)}
          tendencia={<Tendencia valor={dados.variacaoVendasMes} sufixo={v => `${v} venda${v !== 1 ? 's' : ''}`} />}
          comparativo="vs mesmo período do mês anterior"
        />
        <KpiCard
          titulo="Ticket médio"
          valor={formatMoedaCompacta(dados.ticketMedio)}
          tendencia={<Tendencia valor={dados.variacaoTicketMedioPct} sufixo={v => formatPct(v)} />}
          comparativo="vs ticket do mês anterior"
        />
        <KpiCard
          titulo="Taxa de conversão"
          valor={formatPct(dados.taxaConversao)}
          tendencia={<Tendencia valor={dados.variacaoConversaoPP} sufixo={v => `${Math.round(v * 100)} p.p.`} />}
          comparativo="vs mês anterior"
        />
      </div>

      {visao === 'mensal' ? (
        <VisaoMensal dados={dados} nomeMes={nomeMes} ano={ano} verTabela={verTabela} setVerTabela={setVerTabela} />
      ) : (
        <VisaoAnual dados={dados} ano={ano} verTabela={verTabela} setVerTabela={setVerTabela} />
      )}
    </div>
  )
}

function VisaoMensal({
  dados, nomeMes, ano, verTabela, setVerTabela,
}: { dados: ProducaoDashboard; nomeMes: string; ano: number; verTabela: boolean; setVerTabela: (v: boolean) => void }) {
  const W = 600
  const H = 200
  const margem = 8

  const realizados = dados.producaoDiaria.filter(d => d.realizado != null).map(d => d.realizado as number)
  const max = Math.max(dados.metaMes, dados.projecaoFimMes, ...realizados, 1)

  const x = (dia: number) => margem + ((dia - 1) / Math.max(1, dados.diasNoMes - 1)) * (W - margem * 2)
  const y = (valor: number) => H - margem - (Math.max(0, valor) / max) * (H - margem * 2)

  const pontosRealizado = dados.producaoDiaria.filter(d => d.realizado != null)
  const pathRealizado = pontosRealizado.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(d.dia)} ${y(d.realizado as number)}`).join(' ')
  const pathMetaLinear = dados.producaoDiaria.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(d.dia)} ${y(d.metaLinear)}`).join(' ')

  const ultimoRealizado = pontosRealizado[pontosRealizado.length - 1]
  const pathProjecao = ultimoRealizado
    ? `M ${x(ultimoRealizado.dia)} ${y(ultimoRealizado.realizado as number)} L ${x(dados.diasNoMes)} ${y(dados.projecaoFimMes)}`
    : ''

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 bg-[#171923] border border-white/10 rounded-xl p-5">
        <h3 className="font-semibold text-white mb-0.5">Produção diária acumulada — {nomeMes}/{ano}</h3>
        <p className="text-xs text-gray-400 mb-4">
          Dia {dados.diaAtual} de {dados.diasNoMes} · ritmo atual de {formatMoeda(dados.ritmoDiarioAtual)}/dia
        </p>

        <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue-500 inline-block" /> Realizado</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue-500/50 inline-block" style={{ borderTop: '1px dashed' }} /> Projeção</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-gray-500 inline-block" /> Meta linear</span>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-48">
          <path d={pathMetaLinear} fill="none" stroke="#6b7280" strokeWidth="1" strokeDasharray="2 3" />
          {pathRealizado && <path d={pathRealizado} fill="none" stroke="#3b82f6" strokeWidth="2.5" />}
          {pathProjecao && <path d={pathProjecao} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="5 4" opacity="0.6" />}
          {ultimoRealizado && <circle cx={x(ultimoRealizado.dia)} cy={y(ultimoRealizado.realizado as number)} r="4" fill="#3b82f6" />}
          <circle cx={x(dados.diasNoMes)} cy={y(dados.projecaoFimMes)} r="3.5" fill="#3b82f6" opacity="0.6" />
        </svg>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10 text-xs flex-wrap gap-2">
          <div><span className="text-gray-400">Hoje (dia {dados.diaAtual}):</span> <span className="font-semibold text-white">{formatMoeda(dados.producaoMesAteHoje)}</span></div>
          <div><span className="text-gray-400">Projeção (dia {dados.diasNoMes}):</span> <span className="font-semibold text-white">{formatMoeda(dados.projecaoFimMes)}</span></div>
          <div><span className="text-gray-400">Meta do mês:</span> <span className="font-semibold text-white">{formatMoeda(dados.metaMes)}</span></div>
        </div>

        <button onClick={() => setVerTabela(!verTabela)} className="text-xs text-blue-400 hover:text-blue-300 mt-3">
          {verTabela ? '▾' : '▸'} Ver tabela de dados
        </button>
        {verTabela && (
          <div className="mt-2 max-h-40 overflow-y-auto text-xs">
            <table className="w-full text-left">
              <thead className="text-gray-500"><tr><th className="py-1">Dia</th><th>Realizado</th><th>Meta linear</th></tr></thead>
              <tbody className="text-gray-300">
                {dados.producaoDiaria.map(d => (
                  <tr key={d.dia} className="border-t border-white/5">
                    <td className="py-0.5">{d.dia}</td>
                    <td>{d.realizado != null ? formatMoeda(d.realizado) : '—'}</td>
                    <td>{formatMoeda(d.metaLinear)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="bg-[#171923] border border-white/10 rounded-xl p-5">
          <h3 className="font-semibold text-white mb-0.5">Meta do mês</h3>
          <p className="text-xs text-gray-400 mb-3">Realizado até o dia {dados.diaAtual}</p>
          <div className="text-3xl font-bold text-white mb-3">{formatPct(dados.percentualMetaMes)}</div>
          <ProgressoDark percentual={dados.percentualMetaMes} />
          <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
            <span>Realizado: <span className="text-white font-medium">{formatMoeda(dados.producaoMesAteHoje)}</span></span>
            <span>Meta: <span className="text-white font-medium">{formatMoeda(dados.metaMes)}</span></span>
          </div>
        </div>

        <div className="bg-[#171923] border border-white/10 rounded-xl p-5">
          <h3 className="font-semibold text-white mb-0.5">Estimativa de fechamento do mês</h3>
          <p className="text-xs text-gray-400 mb-3">No ritmo atual de vendas</p>
          <div className="text-2xl font-bold text-white mb-1">{formatMoeda(dados.projecaoFimMes)}</div>
          <div className="text-xs text-gray-400 mb-3">{formatPct(dados.percentualProjecaoMes)} da meta</div>
          <div className="bg-white/5 rounded-lg p-3 text-xs text-gray-300 leading-relaxed">
            {dados.faltaParaMeta <= 0 ? (
              <>No ritmo atual ({formatMoeda(dados.ritmoDiarioAtual)}/dia), a meta do mês já foi batida.</>
            ) : dados.diasRestantesMes > 0 ? (
              <>No ritmo atual ({formatMoeda(dados.ritmoDiarioAtual)}/dia), faltam {formatMoeda(dados.faltaParaMeta)} para bater a meta.
                {' '}Nos {dados.diasRestantesMes} dia{dados.diasRestantesMes !== 1 ? 's' : ''} restantes, é preciso vender {formatMoeda(dados.ritmoNecessarioRestante)}/dia.</>
            ) : (
              <>O mês fechou faltando {formatMoeda(dados.faltaParaMeta)} para a meta.</>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function VisaoAnual({
  dados, ano, verTabela, setVerTabela,
}: { dados: ProducaoDashboard; ano: number; verTabela: boolean; setVerTabela: (v: boolean) => void }) {
  const max = Math.max(dados.metaMes, ...dados.balancoMensal.map(m => m.valor), 1)

  return (
    <div className="space-y-4">
      <div className="bg-[#171923] border border-white/10 rounded-xl p-5">
        <h3 className="font-semibold text-white mb-0.5">Balanço entre meses — {ano}</h3>
        <p className="text-xs text-gray-400 mb-4">Comparativo de produção mês a mês, com variação sobre o mês anterior</p>

        <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" /> Mês atual (projetado)</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-gray-500 inline-block" /> Meses fechados</span>
        </div>

        <div className="flex items-end gap-3 h-52">
          {dados.balancoMensal.map(m => {
            const altura = Math.max((m.valor / max) * 100, m.valor > 0 ? 2 : 0)
            return (
              <div key={m.mes} className="flex-1 flex flex-col items-center justify-end h-full">
                {m.variacaoPct != null && (
                  <div className={`text-[10px] font-medium mb-1 ${m.variacaoPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {m.variacaoPct >= 0 ? '▲' : '▼'} {Math.round(Math.abs(m.variacaoPct) * 100)}%
                  </div>
                )}
                <div
                  title={`${m.label}: ${formatMoeda(m.valor)}`}
                  className={`w-full rounded-t transition-all ${m.projetado ? 'bg-blue-500' : 'bg-gray-500'}`}
                  style={{ height: `${altura}%` }}
                />
                <div className="text-[11px] text-gray-400 mt-1.5">{m.label}{m.projetado ? ' (proj.)' : ''}</div>
              </div>
            )
          })}
        </div>

        <button onClick={() => setVerTabela(!verTabela)} className="text-xs text-blue-400 hover:text-blue-300 mt-4">
          {verTabela ? '▾' : '▸'} Ver tabela de dados
        </button>
        {verTabela && (
          <div className="mt-2 text-xs">
            <table className="w-full text-left">
              <thead className="text-gray-500"><tr><th className="py-1">Mês</th><th>Produção</th><th>Variação</th></tr></thead>
              <tbody className="text-gray-300">
                {dados.balancoMensal.map(m => (
                  <tr key={m.mes} className="border-t border-white/5">
                    <td className="py-0.5">{m.label}{m.projetado ? ' (projetado)' : ''}</td>
                    <td>{formatMoeda(m.valor)}</td>
                    <td>{m.variacaoPct != null ? `${m.variacaoPct >= 0 ? '+' : ''}${Math.round(m.variacaoPct * 100)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="font-semibold text-white mb-3">Progresso por trimestre</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {dados.trimestres.map(t => (
            <div key={t.numero} className="bg-[#171923] border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">{t.label}</span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${t.status === 'FECHADO' ? 'bg-white/10 text-gray-300' : 'bg-blue-500/20 text-blue-300'}`}>
                  {t.status}
                </span>
              </div>
              <div className="text-xl font-bold text-white mb-2">{formatPct(t.percentual)}</div>
              <ProgressoDark percentual={t.percentual} />
              <div className="text-[11px] text-gray-400 mt-2">{formatMoeda(t.realizado)} de {formatMoeda(t.meta)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#171923] border border-white/10 rounded-xl p-5">
          <h3 className="font-semibold text-white mb-0.5">Meta anual</h3>
          <p className="text-xs text-gray-400 mb-3">Acumulado de janeiro até hoje</p>
          <div className="text-3xl font-bold text-white mb-3">{formatPct(dados.percentualMetaAnual)}</div>
          <ProgressoDark percentual={dados.percentualMetaAnual} />
          <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
            <span>Realizado: <span className="text-white font-medium">{formatMoedaCompacta(dados.producaoAnualAcumulada)}</span></span>
            <span>Meta: <span className="text-white font-medium">{formatMoedaCompacta(dados.metaAnual)}</span></span>
          </div>
        </div>

        <div className="bg-[#171923] border border-white/10 rounded-xl p-5">
          <h3 className="font-semibold text-white mb-0.5">Projeção de fechamento anual</h3>
          <p className="text-xs text-gray-400 mb-3">Com base no ritmo dos últimos meses</p>
          <div className="text-2xl font-bold text-white mb-1">{formatMoedaCompacta(dados.projecaoFechamentoAnual)}</div>
          <div className="text-xs text-gray-400 mb-3">{formatPct(dados.percentualProjecaoAnual)} da meta</div>
          <div className="bg-white/5 rounded-lg p-3 text-xs text-gray-300 leading-relaxed">
            {dados.faltaAnual <= 0 ? (
              <>Mantendo o ritmo recente, deve fechar {formatMoedaCompacta(Math.abs(dados.faltaAnual))} acima da meta anual.</>
            ) : (
              <>Mantendo o ritmo médio recente, deve fechar {formatMoedaCompacta(dados.faltaAnual)} abaixo da meta anual.</>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
