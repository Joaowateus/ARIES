import type { Request } from 'express'

// Quais leads a pessoa enxerga: o vendedor só os dele; dono e supervisor a
// equipe inteira (ou um vendedor, quando filtram).
export function leadWhereBase(req: Request, vendedorIdFiltro?: string): { usuarioId: string; vendedorId?: string; OR?: Array<{ vendedorId?: string; responsavelQualificacaoId?: string }> } {
  const usuarioId = req.proLaboreUser!.sub
  // SDR: os próprios leads e os que qualificou (mesmo depois de passados ao vendedor).
  if (req.proLaboreUser!.papel === 'VENDEDOR' && req.proLaboreUser!.sdr) {
    const eu = req.proLaboreUser!.vendedorId!
    return { usuarioId, OR: [{ vendedorId: eu }, { responsavelQualificacaoId: eu }] }
  }
  if (req.proLaboreUser!.papel === 'VENDEDOR') {
    return { usuarioId, vendedorId: req.proLaboreUser!.vendedorId! }
  }
  if (vendedorIdFiltro) return { usuarioId, vendedorId: vendedorIdFiltro }
  return { usuarioId }
}

// Motivos de perda (a Reativação agrupa por eles).
export const MOTIVOS_PERDA = ['SEM_MOMENTO', 'SEM_CREDITO', 'PRECO', 'SEM_RESPOSTA', 'CONCORRENCIA', 'SEM_ESTOQUE', 'DESISTIU', 'OUTRO'] as const
export const TEMPERATURAS = ['FRIO', 'MORNO', 'QUENTE'] as const
export const CANAIS_FOLLOW = ['WHATSAPP', 'LIGACAO', 'VISITA', 'EMAIL', 'OUTRO'] as const
