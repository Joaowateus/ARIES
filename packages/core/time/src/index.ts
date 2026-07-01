/**
 * CORE-07 — Time Engine
 * Provedor único de tempo. Nenhum código externo usa Date diretamente.
 * Suporta UTC, timezone, relógio simulado e datas de negócio.
 */

export interface BusinessCalendar {
  /** ISO date strings (YYYY-MM-DD) de feriados nacionais/locais */
  holidays: string[]
  /** Dias da semana considerados úteis: 0=Dom, 1=Seg … 6=Sab */
  workDays: number[]
  timezone: string
}

export interface ITimeEngine {
  /** Instante atual em UTC */
  now(): Date
  /** ISO 8601 UTC string */
  nowISO(): string
  /** UTC timestamp em milissegundos */
  nowMs(): number
  /** Data/hora no timezone informado */
  inTimezone(tz: string): Date
  /** Formata para gravação em banco (ISO 8601 com offset zero) */
  toDBString(date: Date): string
  /** Verifica se é dia útil conforme calendário */
  isBusinessDay(date: Date, calendar?: Partial<BusinessCalendar>): boolean
  /** Adiciona N dias úteis */
  addBusinessDays(date: Date, days: number, calendar?: Partial<BusinessCalendar>): Date
  /** Subtrai N dias úteis */
  subtractBusinessDays(date: Date, days: number, calendar?: Partial<BusinessCalendar>): Date
  /** Diferença em dias úteis entre duas datas */
  businessDaysBetween(from: Date, to: Date, calendar?: Partial<BusinessCalendar>): number
  /** Início do dia em UTC */
  startOfDay(date: Date): Date
  /** Fim do dia em UTC */
  endOfDay(date: Date): Date
  /** Para testes: congela o relógio em uma data específica */
  simulate(date: Date): void
  /** Para testes: volta ao relógio real */
  resetSimulation(): void
  /** Indica se o relógio está simulado */
  isSimulated(): boolean
}

const DEFAULT_CALENDAR: BusinessCalendar = {
  holidays: [],
  workDays: [1, 2, 3, 4, 5], // Seg–Sex
  timezone: 'UTC',
}

class TimeEngineImpl implements ITimeEngine {
  private simulatedDate: Date | null = null

  now(): Date {
    return this.simulatedDate !== null ? new Date(this.simulatedDate) : new Date()
  }

  nowISO(): string {
    return this.now().toISOString()
  }

  nowMs(): number {
    return this.now().getTime()
  }

  inTimezone(tz: string): Date {
    const now = this.now()
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: tz }))
    return tzDate
  }

  toDBString(date: Date): string {
    return date.toISOString()
  }

  isBusinessDay(date: Date, calendar?: Partial<BusinessCalendar>): boolean {
    const cal = { ...DEFAULT_CALENDAR, ...calendar }
    const dayOfWeek = date.getUTCDay()
    if (!cal.workDays.includes(dayOfWeek)) return false
    const isoDate = date.toISOString().slice(0, 10)
    return !cal.holidays.includes(isoDate)
  }

  addBusinessDays(date: Date, days: number, calendar?: Partial<BusinessCalendar>): Date {
    if (days < 0) return this.subtractBusinessDays(date, Math.abs(days), calendar)
    let result = new Date(date)
    let remaining = days
    while (remaining > 0) {
      result = new Date(result.getTime() + 86_400_000)
      if (this.isBusinessDay(result, calendar)) remaining--
    }
    return result
  }

  subtractBusinessDays(date: Date, days: number, calendar?: Partial<BusinessCalendar>): Date {
    if (days < 0) return this.addBusinessDays(date, Math.abs(days), calendar)
    let result = new Date(date)
    let remaining = days
    while (remaining > 0) {
      result = new Date(result.getTime() - 86_400_000)
      if (this.isBusinessDay(result, calendar)) remaining--
    }
    return result
  }

  businessDaysBetween(from: Date, to: Date, calendar?: Partial<BusinessCalendar>): number {
    if (from > to) return -this.businessDaysBetween(to, from, calendar)
    let count = 0
    let current = new Date(from)
    while (current < to) {
      current = new Date(current.getTime() + 86_400_000)
      if (this.isBusinessDay(current, calendar)) count++
    }
    return count
  }

  startOfDay(date: Date): Date {
    const d = new Date(date)
    d.setUTCHours(0, 0, 0, 0)
    return d
  }

  endOfDay(date: Date): Date {
    const d = new Date(date)
    d.setUTCHours(23, 59, 59, 999)
    return d
  }

  simulate(date: Date): void {
    this.simulatedDate = new Date(date)
  }

  resetSimulation(): void {
    this.simulatedDate = null
  }

  isSimulated(): boolean {
    return this.simulatedDate !== null
  }
}

/** Instância singleton — importe e use diretamente */
export const Time: ITimeEngine = new TimeEngineImpl()

/** Para testes que precisam de instância isolada */
export function createTimeEngine(): ITimeEngine {
  return new TimeEngineImpl()
}
