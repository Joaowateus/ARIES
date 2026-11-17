// Rotinas automáticas (cron externo) dentro do limite da função na Vercel
// (30 s). Cada rotina tem um orçamento: as tarefas centrais rodam primeiro; as
// demais recebem o tempo que sobrar e, sem tempo, ficam para a próxima rodada
// (registradas em "adiadas", em vez de a função ser cortada no meio e as
// tarefas do fim da fila nunca rodarem).
export interface Orcamento {
  /** Milissegundos que ainda restam. */
  restante(): number
  /** Roda a tarefa se houver ao menos `minimoMs`; senão a registra como adiada e devolve o valor padrão. */
  rodar<T>(nome: string, fn: (limiteMs: number) => Promise<T>, padrao: T, minimoMs?: number): Promise<T>
  adiadas: string[]
  tempos: Record<string, number>
}

export function orcamento(totalMs = 25_000): Orcamento {
  const inicio = Date.now()
  const adiadas: string[] = []
  const tempos: Record<string, number> = {}
  const restante = () => totalMs - (Date.now() - inicio)
  return {
    restante, adiadas, tempos,
    async rodar(nome, fn, padrao, minimoMs = 1500) {
      const r = restante()
      if (r < minimoMs) { adiadas.push(nome); return padrao }
      const t0 = Date.now()
      try { return await fn(Math.max(500, r - 1000)) } catch (e) { console.error(`[cron] ${nome}`, e); return padrao } finally { tempos[nome] = Date.now() - t0 }
    },
  }
}
