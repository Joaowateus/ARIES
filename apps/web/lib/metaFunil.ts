import type { MetaFunilProLabore } from './proLaboreApi'

/** Meta de etapa do funil cadastrada de verdade: 0% (ou custo vazio) é "sem meta", não "meta batida". */
export function metaDefinida(meta: MetaFunilProLabore | undefined): meta is MetaFunilProLabore {
  if (!meta) return false
  if (meta.tipoMeta === 'MAXIMO_CUSTO') return (meta.metaCusto ?? 0) > 0
  return meta.metaPct > 0
}
