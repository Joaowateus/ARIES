'use client'

// PDF 02 · dicionário de métricas na tela: a leitura vem da ficha única
// (mesmo cálculo em todo lugar) e tocar no número abre a ficha da métrica.
import { useEffect, useState } from 'react'
import { metricasApi, type FichaMetrica, type LeituraMetrica, type PeriodoMetrica, type VersaoMetrica } from '@/lib/proLaboreApi'

/** Lê as métricas do dicionário para o período (mês corrente quando não informado). */
export function useMetricas(chaves: string[], periodo: PeriodoMetrica | null, vendedorId?: string) {
  const [leituras, setLeituras] = useState<Record<string, LeituraMetrica>>({})
  const chave = `${chaves.join(',')}|${periodo?.inicio}|${periodo?.fim}|${vendedorId ?? ''}`
  useEffect(() => {
    if (!periodo || chaves.length === 0) return
    let vivo = true
    metricasApi.ler(chaves, periodo, vendedorId || undefined)
      .then(r => { if (vivo) setLeituras(Object.fromEntries(r.leituras.filter(l => l && 'valor' in l).map(l => [l.chave, l]))) })
      .catch(() => { if (vivo) setLeituras({}) })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])
  return leituras
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
/** "1–6 out", "out" (mês inteiro) ou "28/10–3/11". */
export function rotuloPeriodo(p: PeriodoMetrica): string {
  const [ai, mi, di] = p.inicio.split('-').map(Number), [af, mf, df] = p.fim.split('-').map(Number)
  const fimDoMes = new Date(Date.UTC(af, mf, 0)).getUTCDate()
  if (ai === af && mi === mf) {
    if (di === 1 && df === fimDoMes) return `${MESES[mi - 1]}`
    return di === df ? `${di} ${MESES[mi - 1]}` : `${di}–${df} ${MESES[mi - 1]}`
  }
  return `${di}/${mi}–${df}/${mf}`
}

const NOME_FAIXA = { BOM: 'Bom', ATENCAO: 'Atenção', CRITICO: 'Crítico' } as const
export function FaixaChip({ faixa }: { faixa: LeituraMetrica['faixa'] }) {
  if (!faixa) return null
  return <span className={`pl-chip-faixa pl-faixa-${faixa.toLowerCase()}`} data-faixa={faixa}>{NOME_FAIXA[faixa]}</span>
}

const PAPEL: Record<string, string> = { DONO: 'Dono', SUPERVISOR: 'Supervisor', SDR: 'SDR', VENDEDOR: 'Vendedor', SOCIAL_MEDIA: 'Social Media' }

export function FichaMetricaModal({ chave, onFechar }: { chave: string; onFechar: () => void }) {
  const [dados, setDados] = useState<{ ficha: FichaMetrica; versoes: VersaoMetrica[] } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => { metricasApi.ficha(chave).then(setDados).catch(e => setErro(e instanceof Error ? e.message : 'Ficha indisponível')) }, [chave])
  const f = dados?.ficha
  const linha = (rotulo: string, valor: React.ReactNode) => (
    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--pl-border)' }}>
      <span className="pl-hint">{rotulo}</span><span>{valor}</span>
    </div>
  )
  return (
    <div className="pl-modal-backdrop" onClick={onFechar} role="dialog" aria-modal="true" aria-label="Ficha da métrica">
      <div className="pl-card pl-modal-panel" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()} data-ficha-metrica={chave}>
        {erro && <p className="pl-hint">{erro}</p>}
        {!f && !erro && <p className="pl-hint">Carregando…</p>}
        {f && (
          <>
            <div className="pl-eyebrow">Ficha da métrica · versão {f.versao}</div>
            <div className="pl-card-title" style={{ marginBottom: 6 }}>{f.nome}</div>
            <p style={{ marginTop: 0 }}>{f.definicao}</p>
            {linha('Fórmula', f.formula)}
            {linha('Fonte', f.fonte)}
            {linha('Janela', f.janela)}
            {linha('Comparação', f.retrato ? 'Retrato de agora (sem comparação)' : f.comparacao)}
            {linha('Faixas', f.faixas ? `Bom: ${f.faixas.bom} · crítico: ${f.faixas.critico} (definidas pelo dono)` : f.melhor === 'NEUTRO' ? 'Sem faixa (informativa)' : 'Pelo padrão da loja (mediana de 90 dias): bom no padrão ou melhor; atenção até 20% pior; crítico mais de 20% pior')}
            {linha('Responsável', f.responsavel)}
            {linha('Quem vê', f.quemVe.map(p => PAPEL[p] ?? p).join(', '))}
            {linha('Aprovação', f.aprovadoEm ? `${f.aprovadoPor === 'PDF 02 (aprovado)' ? 'PDF 02' : 'Dono'} em ${new Date(f.aprovadoEm).toLocaleDateString('pt-BR')}` : 'PDF 02 (versão inicial)')}
            {dados.versoes.length > 0 && (
              <details style={{ marginTop: 10 }}>
                <summary className="pl-hint">Histórico de versões ({dados.versoes.length + 1})</summary>
                <ul style={{ paddingLeft: 18 }}>
                  {dados.versoes.map(v => <li key={v.id}>v{v.versao} · {new Date(v.criadoEm).toLocaleDateString('pt-BR')} · {v.justificativa}</li>)}
                  <li>v1 · PDF 02</li>
                </ul>
              </details>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button type="button" className="pl-btn" onClick={onFechar}>Fechar</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
