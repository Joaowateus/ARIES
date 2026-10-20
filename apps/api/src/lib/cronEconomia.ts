// Economia do banco nos crons. O Neon cobra (e limita, no plano gratuito)
// o tempo em que o banco fica ligado, e ele só desliga depois de alguns
// minutos sem consulta: um cron a cada 5 min o deixava ligado o dia inteiro
// e esgotou a cota do mês. Agora:
// - o job de "minuto" trabalha a cada CRON_MINUTO_INTERVALO minutos
//   (padrão 15; mínimo 5) e não consulta o banco nas outras chamadas;
// - de madrugada (0h até CRON_FIM_MADRUGADA, padrão 6h, horário de Brasília)
//   os jobs de minuto e de hora descansam.
// Vale só em produção, e CRON_ECONOMIA=0 desliga tudo (volta ao de antes).
const ativa = () => process.env.NODE_ENV === 'production' && process.env.CRON_ECONOMIA !== '0'
const horaBrasilia = (d: Date) => new Date(d.getTime() - 3 * 3600e3).getUTCHours()

export function madrugada(agora: Date, fimMadrugada = Number(process.env.CRON_FIM_MADRUGADA ?? 6)): boolean {
  return horaBrasilia(agora) < fimMadrugada
}

/** O job de minuto roda nesta chamada? (com o cron a cada 5 min, roda 1 vez a cada `intervalo` minutos) */
export function vezDoMinuto(agora: Date, intervalo = Number(process.env.CRON_MINUTO_INTERVALO) || 15): boolean {
  const passos = Math.max(1, Math.round(Math.max(5, intervalo) / 5))
  return Math.floor(agora.getTime() / 300_000) % passos === 0
}

export function pularMinuto(agora: Date): string | null {
  if (!ativa()) return null
  if (madrugada(agora)) return 'madrugada'
  if (!vezDoMinuto(agora)) return 'intervalo'
  return null
}

export function pularHora(agora: Date): string | null {
  if (!ativa()) return null
  return madrugada(agora) ? 'madrugada' : null
}
