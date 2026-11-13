'use client'

// PDF 06 · 4.2: o Daily transmitido pela apresentação ao vivo de Reuniões. Quem
// assiste vê o bloco atual, os números e os itens sempre no modo equipe (só
// totais, sem orientações individuais nem números por pessoa), mesmo que quem
// conduz esteja no modo gestão: a tela de quem conduz manda só o slide da pauta equipe.
import { useState } from 'react'
import type { ApresentacaoDetalhe, BlocoPauta } from '@/lib/proLaboreApi'
import { useTransmissao } from './useTransmissao'
import { ItensSlide, NumerosSlide } from '../../hoje/SlideDaily'

interface PalcoDaily { tipo: 'DAILY'; indice: number; total: number; nomes: string[]; bloco: BlocoPauta | null; minutos: number; segundosBloco: number; segundosTotal: number; totalMinutos: number }
const mmss = (s: number) => `${s < 0 ? '−' : ''}${Math.floor(Math.abs(s) / 60)}:${String(Math.abs(s) % 60).padStart(2, '0')}`

export default function EspectadorDaily({ inicial }: { inicial: ApresentacaoDetalhe }) {
  const [palco, setPalco] = useState<PalcoDaily | null>((inicial.palco as unknown as PalcoDaily | null)?.tipo === 'DAILY' ? inicial.palco as unknown as PalcoDaily : null)
  const [aoVivo, setAoVivo] = useState(inicial.aoVivo)
  useTransmissao(inicial.id, { versao: inicial.versao, palcoVersao: inicial.palcoVersao }, {
    onConteudo: () => undefined,
    onPalco: p => setPalco((p as unknown as PalcoDaily | null)?.tipo === 'DAILY' ? p as unknown as PalcoDaily : null),
    onStatus: setAoVivo,
  })
  if (!aoVivo || !palco) return (
    <div className="pl-card" data-espectador-daily="aguardando">
      <h2 style={{ margin: 0 }}>{inicial.titulo}</h2>
      <p className="pl-hint">{aoVivo ? 'Aguardando quem conduz abrir o primeiro bloco…' : 'O Daily não está ao vivo agora.'}</p>
    </div>
  )
  const b = palco.bloco
  return (
    <div data-espectador-daily="EQUIPE" data-daily="EQUIPE" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <header style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div className="pl-hint" style={{ fontSize: 12 }}>{inicial.titulo} · modo equipe · bloco {palco.indice + 1} de {palco.total}</div>
          <h1 style={{ margin: 0, fontSize: 26 }} data-bloco-titulo>{palco.nomes[palco.indice] ?? b?.nome}</h1>
        </div>
        <div style={{ textAlign: 'right' }}><div className="pl-hint" style={{ fontSize: 11 }}>Bloco ({palco.minutos} min)</div><b style={{ fontSize: 24 }} data-cronometro>{mmss(palco.minutos * 60 - palco.segundosBloco)}</b></div>
        <div style={{ textAlign: 'right' }}><div className="pl-hint" style={{ fontSize: 11 }}>Reunião ({palco.totalMinutos} min)</div><b style={{ fontSize: 18 }} data-tempo-total>{mmss(palco.segundosTotal)}</b></div>
      </header>
      {b ? <div className="pl-card" data-bloco={b.chave}><NumerosSlide numeros={b.numeros} grande /><ItensSlide bloco={b} modoEquipe /></div> : <p className="pl-hint">Bloco sem conteúdo para a equipe.</p>}
    </div>
  )
}
