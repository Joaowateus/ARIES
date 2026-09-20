'use client'

interface EtapaJornada {
  titulo: string
  valor: number
  cor: string
}

function formatarNumero(n: number): string {
  return Math.round(n).toLocaleString('pt-BR')
}

// Jornada Seguidor→Lead em arcos concêntricos — cada anel representa uma
// etapa (Alcance é sempre o anel externo, 100%), com o comprimento do
// traço colorido proporcional à fração do alcance que chegou até ali.
// Embaixo, a trilha de etapas numeradas com o valor e a conversão em
// relação à etapa anterior.
export function SocialJourneyCircular({ alcance, visitasPerfil, novosSeguidores, leadsGerados }: {
  alcance: number
  visitasPerfil: number
  novosSeguidores: number
  leadsGerados: number
}) {
  const etapas: EtapaJornada[] = [
    { titulo: 'Alcance', valor: alcance, cor: 'var(--pl-accent-5)' },
    { titulo: 'Visitas ao perfil', valor: visitasPerfil, cor: 'var(--pl-accent-2)' },
    { titulo: 'Novos seguidores', valor: novosSeguidores, cor: 'var(--pl-accent-4)' },
    { titulo: 'Leads gerados', valor: leadsGerados, cor: 'var(--pl-accent-3)' },
  ]
  const base = alcance > 0 ? alcance : 1
  const raios = [86, 66, 46, 26]
  const largura = 16

  return (
    <div className="pl-journey-circular">
      <svg viewBox="0 0 220 220" className="pl-journey-circular-svg">
        {etapas.map((etapa, i) => {
          const raio = raios[i]
          const circunferencia = 2 * Math.PI * raio
          const fracao = Math.min(1, etapa.valor / base)
          const tracoAtivo = circunferencia * fracao
          return (
            <g key={etapa.titulo}>
              <circle cx={110} cy={110} r={raio} fill="none" stroke="var(--pl-border)" strokeWidth={largura} />
              <circle
                cx={110}
                cy={110}
                r={raio}
                fill="none"
                stroke={etapa.cor}
                strokeWidth={largura}
                strokeDasharray={`${tracoAtivo} ${Math.max(0, circunferencia - tracoAtivo)}`}
                strokeLinecap="round"
                transform="rotate(-90 110 110)"
              />
            </g>
          )
        })}
        <text x="110" y="104" textAnchor="middle" className="pl-journey-circular-central-label">Alcance</text>
        <text x="110" y="126" textAnchor="middle" className="pl-journey-circular-central-value">{formatarNumero(alcance)}</text>
      </svg>

      <div className="pl-journey-circular-trilha">
        {etapas.map((etapa, i) => {
          const anterior = i === 0 ? alcance : etapas[i - 1].valor
          const conversao = anterior > 0 ? (etapa.valor / anterior) * 100 : 0
          return (
            <div className="pl-journey-circular-step" key={etapa.titulo}>
              <div className="pl-journey-circular-step-dot" style={{ borderColor: etapa.cor, color: etapa.cor }}>{i + 1}</div>
              <div className="pl-journey-circular-step-titulo">{etapa.titulo}</div>
              <div className="pl-journey-circular-step-valor">{formatarNumero(etapa.valor)}</div>
              {i > 0 && <div className="pl-journey-circular-step-conv">{conversao.toFixed(1)}% da etapa anterior</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
