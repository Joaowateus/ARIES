'use client'

import { useEffect, useState, useCallback } from 'react'
import { temAcesso, proLaboreApi, FunilMensal, GastoAnuncioMensal, type GastoDoMes } from '@/lib/proLaboreApi'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { PageHeader } from '../../PageHeader'

function mesAtualStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function ProLaboreIndicadoresPage() {
  const { usuario } = useProLaboreAuth()
  // Dono ou acesso com o módulo liberado (Acessos e permissões).
  const isDono = temAcesso(usuario, 'indicadores')
  const [mesSelecionado, setMesSelecionado] = useState(mesAtualStr())
  const [funis, setFunis] = useState<FunilMensal[]>([])
  const [gastos, setGastos] = useState<GastoAnuncioMensal[]>([])
  const [resumoGastos, setResumoGastos] = useState<GastoDoMes[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  const [form, setForm] = useState({ leads: '0', abordados: '0', negociacao: '0', proposta: '0', gastoAnuncios: '0' })

  const ano = Number(mesSelecionado.slice(0, 4))

  const carregar = useCallback(() => {
    if (!isDono) { setLoading(false); return }
    setLoading(true)
    Promise.all([proLaboreApi.funil.listar(ano), proLaboreApi.gastosAnuncios.listar(ano), proLaboreApi.gastosAnuncios.resumo(ano).catch(() => [] as GastoDoMes[])])
      .then(([f, g, r]) => { setFunis(f); setGastos(g); setResumoGastos(r) })
      .finally(() => setLoading(false))
  }, [ano, isDono])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    const funilDoMes = funis.find(f => f.mesReferencia.slice(0, 7) === mesSelecionado)
    const gastoDoMes = gastos.find(g => g.mesReferencia.slice(0, 7) === mesSelecionado)
    setForm({
      leads: String(funilDoMes?.leads ?? 0),
      abordados: String(funilDoMes?.abordados ?? 0),
      negociacao: String(funilDoMes?.negociacao ?? 0),
      proposta: String(funilDoMes?.proposta ?? 0),
      gastoAnuncios: String(gastoDoMes?.valor ?? 0),
    })
  }, [mesSelecionado, funis, gastos])

  // Com o Tráfego sincronizado no mês, o gasto vem sozinho das campanhas e o
  // digitado fica só de reserva (vale quando o Tráfego não tem dados do mês).
  const gastoAuto = resumoGastos.find(g => g.mes === mesSelecionado)
  const automatico = gastoAuto?.fonte === 'TRAFEGO'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSucesso(false)
    setSalvando(true)
    try {
      const mesReferencia = `${mesSelecionado}-01`
      await Promise.all([
        proLaboreApi.funil.salvar({
          mesReferencia,
          leads: Number(form.leads),
          abordados: Number(form.abordados),
          negociacao: Number(form.negociacao),
          proposta: Number(form.proposta),
        }),
        ...(automatico ? [] : [proLaboreApi.gastosAnuncios.salvar({ mesReferencia, valor: Number(form.gastoAnuncios) })]),
      ])
      setSucesso(true)
      carregar()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar indicadores')
    } finally {
      setSalvando(false)
    }
  }

  if (!isDono) {
    return (
      <div className="pl-empty pl-card">
        <div className="pl-emoji">🔒</div>
        <h3 style={{ margin: 0, color: 'var(--pl-ink-1)', fontWeight: 600 }}>Seu acesso não inclui essa área</h3>
        <p style={{ marginTop: 6 }}>Indicadores de funil e anúncios são visão geral do negócio.</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Gestão"
        title="Indicadores mensais"
        subtitle="Funil manual dos meses antigos e gasto com anúncios: com o Tráfego conectado, o gasto vem sozinho das campanhas. Fechamento, ROAS, CAC e custo por lead são calculados automaticamente"
      />

      <form onSubmit={handleSubmit} className="pl-card">
        <div className="pl-field" style={{ maxWidth: 220, marginBottom: 20 }}>
          <label>Mês de referência</label>
          <input type="month" className="pl-input" value={mesSelecionado} onChange={e => setMesSelecionado(e.target.value)} required />
        </div>

        <div className="pl-card-title" style={{ marginBottom: 4 }}>Funil de vendas</div>
        <div className="pl-card-sub" style={{ marginBottom: 14 }}>Contagem de cada etapa no mês selecionado</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 22 }}>
          <div className="pl-field">
            <label>Leads</label>
            <input type="number" min="0" className="pl-input" value={form.leads} onChange={e => setForm(f => ({ ...f, leads: e.target.value }))} required />
          </div>
          <div className="pl-field">
            <label>Abordados</label>
            <input type="number" min="0" className="pl-input" value={form.abordados} onChange={e => setForm(f => ({ ...f, abordados: e.target.value }))} required />
          </div>
          <div className="pl-field">
            <label>Negociação</label>
            <input type="number" min="0" className="pl-input" value={form.negociacao} onChange={e => setForm(f => ({ ...f, negociacao: e.target.value }))} required />
          </div>
          <div className="pl-field">
            <label>Proposta</label>
            <input type="number" min="0" className="pl-input" value={form.proposta} onChange={e => setForm(f => ({ ...f, proposta: e.target.value }))} required />
          </div>
        </div>

        <div className="pl-card-title" style={{ marginBottom: 4 }}>Investimento em anúncios</div>
        <div className="pl-card-sub" style={{ marginBottom: 14 }}>Base para ROAS, CAC e custo por lead no Dashboard e na Central</div>
        {automatico && gastoAuto ? (
          <div className="pl-alert pl-alert-success" style={{ marginBottom: 20 }} data-gasto-automatico>
            <b>{gastoAuto.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b> gastos em {mesSelecionado.split('-').reverse().join('/')}, somados automaticamente das campanhas do Tráfego (Meta Ads, {gastoAuto.diasComDados} {gastoAuto.diasComDados === 1 ? 'dia' : 'dias'} com dados{gastoAuto.atualizadoEm ? `, atualizado ${new Date(gastoAuto.atualizadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}).
            {gastoAuto.manual != null && <> O valor digitado antes ({gastoAuto.manual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) não é mais usado.</>}
          </div>
        ) : (
          <div className="pl-field" style={{ maxWidth: 320, marginBottom: 20 }}>
            <label>Gasto com anúncios (R$)</label>
            <input type="number" min="0" step="0.01" className="pl-input" value={form.gastoAnuncios} onChange={e => setForm(f => ({ ...f, gastoAnuncios: e.target.value }))} required />
            <span className="pl-hint" style={{ fontSize: 12 }}>Conecte a conta de anúncios na aba Tráfego e este valor passa a vir sozinho das campanhas.</span>
          </div>
        )}

        {erro && <div className="pl-alert pl-alert-error" style={{ marginBottom: 14 }}>{erro}</div>}
        {sucesso && <div className="pl-alert pl-alert-success" style={{ marginBottom: 14 }}>Indicadores de {mesSelecionado} salvos.</div>}

        <button type="submit" className="pl-btn pl-btn-primary" disabled={salvando || loading}>{salvando ? 'Salvando...' : 'Salvar indicadores do mês'}</button>
      </form>
    </div>
  )
}
