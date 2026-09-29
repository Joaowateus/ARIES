'use client'

import { useId, useState } from 'react'
import type { AnaliseSocialMedia, DemografiaPublicoSocial, FatiaSocial } from '@/lib/proLaboreApi'
import { Abas, CartaoViz, Vazio, fmtNum, fmtPct, useLargura } from './viz'

type Demografia = Extract<AnaliseSocialMedia, { conectado: true }>['demografia']

const ORDEM_IDADE = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+']
const GENERO: Record<string, { rotulo: string; cor: string }> = {
  M: { rotulo: 'Homens', cor: 'var(--sv-1)' },
  F: { rotulo: 'Mulheres', cor: 'var(--sv-2)' },
  U: { rotulo: 'Não informado', cor: 'var(--pl-ink-muted)' },
}

function nomePais(codigo: string): string {
  try {
    return new Intl.DisplayNames(['pt-BR'], { type: 'region' }).of(codigo) ?? codigo
  } catch {
    return codigo
  }
}

// Faixa etária em cápsulas verticais (como as da referência): mesma cor pra
// todas, a maior faixa em destaque — a posição no eixo já dá a ordem.
function CapsulasIdade({ idade }: { idade: FatiaSocial[] }) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const idClip = useId().replace(/:/g, '')
  const faixas = ORDEM_IDADE.map(k => ({ chave: k, valor: idade.find(i => i.chave === k)?.valor ?? 0 })).filter(f => f.valor > 0 || ['18-24', '25-34', '35-44', '45-54'].includes(f.chave))
  const total = idade.reduce((s, f) => s + f.valor, 0)
  const max = Math.max(1, ...faixas.map(f => f.valor))
  const altura = 170
  const topoPlot = 22
  const basePlot = altura - 26
  const hPlot = basePlot - topoPlot
  const passo = faixas.length > 0 ? largura / faixas.length : 0
  const larg = Math.min(34, Math.max(14, passo * 0.5))
  return (
    <div ref={ref}>
      {largura > 0 && (
        <svg className="pl-sv-svg" width={largura} height={altura} role="img" aria-label="Distribuição por faixa etária">
          {faixas.map((f, i) => {
            const cx = passo * (i + 0.5)
            const h = (f.valor / max) * hPlot
            const ehMaior = f.valor === max
            return (
              <g key={f.chave}>
                <clipPath id={`${idClip}-${i}`}>
                  <rect x={cx - larg / 2} y={topoPlot} width={larg} height={hPlot} rx={larg / 2} />
                </clipPath>
                <rect x={cx - larg / 2} y={topoPlot} width={larg} height={hPlot} rx={larg / 2} fill="var(--pl-surface-2)" />
                {/* nível exato recortado dentro do tubo — sem altura mínima que exagere faixa pequena */}
                {h > 0 && <rect x={cx - larg / 2} y={basePlot - h} width={larg} height={h} fill={ehMaior ? 'var(--sv-1)' : 'var(--sv-seq-1)'} clipPath={`url(#${idClip}-${i})`} />}
                <text x={cx} y={topoPlot - 7} textAnchor="middle" className={ehMaior ? 'rotulo-forte' : 'eixo'}>{fmtPct(total > 0 ? f.valor / total : 0, 0)}</text>
                <text x={cx} y={altura - 8} textAnchor="middle" className="eixo">{f.chave}</text>
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

function BarrasHorizontais({ itens, nome, limite = 8 }: { itens: FatiaSocial[]; nome?: (k: string) => string; limite?: number }) {
  const total = itens.reduce((s, f) => s + f.valor, 0)
  const top = itens.slice(0, limite)
  const max = Math.max(1, ...top.map(f => f.valor))
  return (
    <div>
      {top.map(f => (
        <div key={f.chave} className="pl-sv-hbar">
          <span className="nome" title={nome ? nome(f.chave) : f.chave}>{nome ? nome(f.chave) : f.chave}</span>
          <span className="pl-sv-hbar-trilho"><span style={{ width: `${(f.valor / max) * 100}%` }} /></span>
          <b>{fmtPct(total > 0 ? f.valor / total : 0, 0)}</b>
        </div>
      ))}
    </div>
  )
}

function PainelPublico({ dados }: { dados: DemografiaPublicoSocial }) {
  const totalGenero = dados.genero.reduce((s, g) => s + g.valor, 0)
  const generos = ['M', 'F', 'U'].map(k => ({ k, v: dados.genero.find(g => g.chave === k)?.valor ?? 0 })).filter(g => g.v > 0)
  const nomeCidade = (c: string) => c.split(',')[0]
  return (
    <div className="pl-sv-grid pl-sv-grid-2-eq" style={{ gap: 24 }}>
      <div>
        {totalGenero > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div className="pl-card-sub" style={{ marginBottom: 8, fontWeight: 600, color: 'var(--pl-ink-2)' }}>Gênero</div>
            <div className="pl-sv-split" role="img" aria-label="Distribuição por gênero">
              {generos.map(g => <span key={g.k} style={{ width: `${(g.v / totalGenero) * 100}%`, background: GENERO[g.k].cor }} />)}
            </div>
            <div className="pl-sv-split-legenda">
              {generos.map(g => (
                <span key={g.k}><i className="pl-sv-chave" style={{ background: GENERO[g.k].cor, marginRight: 6 }} />{GENERO[g.k].rotulo} <b>{fmtPct(g.v / totalGenero, 0)}</b></span>
              ))}
            </div>
          </div>
        )}
        {dados.idade.length > 0 && (
          <>
            <div className="pl-card-sub" style={{ marginBottom: 4, fontWeight: 600, color: 'var(--pl-ink-2)' }}>Faixa etária</div>
            <CapsulasIdade idade={dados.idade} />
          </>
        )}
      </div>
      <div>
        {dados.cidade.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div className="pl-card-sub" style={{ marginBottom: 6, fontWeight: 600, color: 'var(--pl-ink-2)' }}>Principais cidades</div>
            <BarrasHorizontais itens={dados.cidade} nome={nomeCidade} />
          </div>
        )}
        {dados.pais.length > 0 && (
          <div>
            <div className="pl-card-sub" style={{ marginBottom: 6, fontWeight: 600, color: 'var(--pl-ink-2)' }}>Países</div>
            <BarrasHorizontais itens={dados.pais} nome={nomePais} limite={5} />
          </div>
        )}
      </div>
    </div>
  )
}

export function Audiencia({ demografia, recarregando }: { demografia: Demografia; recarregando?: boolean }) {
  const [publico, setPublico] = useState<'seguidores' | 'engajados'>('seguidores')
  const temSeguidores = !!demografia?.seguidores
  const temEngajados = !!demografia?.engajados
  const atual = publico === 'engajados' && temEngajados ? demografia?.engajados : demografia?.seguidores ?? demografia?.engajados
  const atualizado = demografia?.atualizadoEm ? new Date(demografia.atualizadoEm).toLocaleDateString('pt-BR') : null

  const linhas = (d: DemografiaPublicoSocial) => [
    ...d.genero.map(g => ['Gênero', GENERO[g.chave]?.rotulo ?? g.chave, fmtNum(g.valor)]),
    ...d.idade.map(g => ['Idade', g.chave, fmtNum(g.valor)]),
    ...d.cidade.map(g => ['Cidade', g.chave, fmtNum(g.valor)]),
    ...d.pais.map(g => ['País', nomePais(g.chave), fmtNum(g.valor)]),
  ]

  return (
    <CartaoViz
      titulo="Quem é a sua audiência"
      subtitulo={publico === 'engajados' ? 'Contas que interagiram com o perfil neste mês' : 'Perfil dos seguidores atuais'}
      recarregando={recarregando}
      acoes={temSeguidores && temEngajados ? (
        <Abas rotulo="Público" valor={publico} onChange={setPublico} opcoes={[{ valor: 'seguidores', rotulo: 'Seguidores' }, { valor: 'engajados', rotulo: 'Contas engajadas' }]} />
      ) : undefined}
      tabela={atual ? { colunas: ['Dimensão', 'Fatia', 'Contas'], linhas: linhas(atual), alinharDireita: [2] } : undefined}
      rodape={atual ? `Retrato mais recente enviado pelo Instagram${atualizado ? ` (${atualizado})` : ''} — não muda com o filtro de período. O Instagram mostra só as maiores fatias de cada dimensão.` : undefined}
    >
      {!atual ? <Vazio>O Instagram só libera dados de audiência pra contas com 100+ seguidores — aparece aqui depois da próxima sincronização.</Vazio> : <PainelPublico dados={atual} />}
    </CartaoViz>
  )
}
