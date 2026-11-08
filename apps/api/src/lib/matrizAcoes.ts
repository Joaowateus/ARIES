// PDF 02 · 4.7 Matriz única de quem pode fazer cada ação. O modelo atual de
// perfis continua (perfis prontos, módulos e escopo); esta matriz vale por
// cima dele para as ações abaixo. O perfil "gerente" ainda não existe no
// sistema: fica previsto aqui e, até ser criado, só o dono (e o supervisor,
// onde a matriz diz) faz essas ações.
export type PerfilMatriz = 'DONO' | 'GERENTE' | 'SUPERVISOR' | 'SDR' | 'VENDEDOR' | 'SOCIAL_MEDIA'
export const ACOES = {
  ACEITAR_RECOMENDACAO: { nome: 'Aceitar ou descartar uma Recomendação', perfis: ['DESTINATARIO'], nota: 'Quem a recebeu pelo roteamento (a partir da onda 2)' },
  REDISTRIBUIR_ATIVIDADES: { nome: 'Redistribuir ou repriorizar atividades', perfis: ['SUPERVISOR', 'GERENTE', 'DONO'] },
  MUDAR_AUTONOMIA: { nome: 'Mudar o nível de autonomia de um processo', perfis: ['DONO'] },
  APROVAR_METRICA_PARAMETRO: { nome: 'Aprovar mudança em métrica, faixa ou parâmetro', perfis: ['DONO'] },
  APROVAR_ROTEIRO_REGRA: { nome: 'Aprovar roteiro-base, protocolo ou regra comercial', perfis: ['DONO', 'GERENTE'] },
  APROVAR_METAS: { nome: 'Aprovar metas sugeridas pelo ARIES', perfis: ['DONO', 'GERENTE'], nota: 'Gerente só para metas da equipe' },
  VER_AUDITORIA: { nome: 'Ver a auditoria completa', perfis: ['DONO', 'SUPERVISOR', 'GERENTE'], nota: 'Supervisor e gerente veem a da própria equipe' },
  CONFIRMAR_VENDA_PAGAMENTO: { nome: 'Confirmar vendas e aprovar pagamentos', perfis: ['DONO'] },
} as const
export type Acao = keyof typeof ACOES

/** Perfil da matriz a partir do login (o SDR é um vendedor com o papel SDR). */
export function perfilDe(u: { papel: string; sdr?: boolean }): PerfilMatriz {
  if (u.papel === 'VENDEDOR' && u.sdr) return 'SDR'
  return (['DONO', 'GERENTE', 'SUPERVISOR', 'SDR', 'VENDEDOR', 'SOCIAL_MEDIA'].includes(u.papel) ? u.papel : 'VENDEDOR') as PerfilMatriz
}
export const pode = (u: { papel: string; sdr?: boolean }, acao: Acao) => (ACOES[acao].perfis as readonly string[]).includes(perfilDe(u))

import type { Request, Response, NextFunction } from 'express'
/** Middleware: só segue se o perfil de quem pede pode fazer a ação (matriz 4.7). */
export const requireAcao = (acao: Acao) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.proLaboreUser || !pode(req.proLaboreUser, acao)) { res.status(403).json({ error: `Sem permissão: ${ACOES[acao].nome.toLowerCase()}` }); return }
  next()
}
