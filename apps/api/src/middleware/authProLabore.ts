import { Request, Response, NextFunction } from 'express'
import { verifyProLaboreToken, ProLaboreJwtPayload } from '../lib/jwtProLabore'
import { prisma } from '../lib/prisma'
import { TUDO, permissoesEfetivas } from '../lib/acessos'

declare global {
  namespace Express {
    interface Request {
      proLaboreUser?: ProLaboreJwtPayload
    }
  }
}

export async function requireProLaboreAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Não autorizado' })
    return
  }
  let payload: ProLaboreJwtPayload
  try {
    payload = verifyProLaboreToken(header.slice(7))
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' })
    return
  }
  req.proLaboreUser = payload
  if (payload.papel === 'DONO') req.acessos = TUDO
  // Acessos da equipe: o estado vem do banco a cada pedido, então mudar o
  // escopo, as permissões ou desativar o login vale na hora, sem esperar
  // a pessoa sair e entrar de novo.
  if ((payload.papel === 'VENDEDOR' || payload.papel === 'SUPERVISOR') && payload.vendedorId) {
    const v = await prisma.vendedor.findUnique({ where: { id: payload.vendedorId }, select: { usuarioId: true, ativo: true, email: true, senhaHash: true, papel: true, permissoes: true } })
    if (!v || v.usuarioId !== payload.sub || !v.ativo || !v.email || !v.senhaHash) {
      res.status(401).json({ error: 'Seu acesso foi desativado. Fale com o gestor.' })
      return
    }
    const papel = v.papel === 'SUPERVISOR' ? 'SUPERVISOR' : 'VENDEDOR'
    req.proLaboreUser = { ...payload, papel }
    req.acessos = permissoesEfetivas(papel, v.permissoes)
  }
  next()
}

// Algumas rotas (parâmetros, gestão de vendedores, gastos com anúncio) são
// exclusivas do dono da operação — um vendedor com login não pode acessá-las.
export function requireDono(req: Request, res: Response, next: NextFunction): void {
  if (req.proLaboreUser?.papel !== 'DONO') {
    res.status(403).json({ error: 'Acesso restrito ao dono da operação' })
    return
  }
  next()
}

// SUPERVISOR vê o painel e o CRM com o escopo da equipe inteira (igual ao
// dono), então também precisa enxergar a lista de vendedores — pro filtro
// do funil e pra atribuir/reatribuir lead a qualquer um do time. Só a
// GESTÃO de vendedores (criar/editar/remover/conceder acesso) continua em
// requireDono.
export function requireDonoOuSupervisor(req: Request, res: Response, next: NextFunction): void {
  const papel = req.proLaboreUser?.papel
  if (papel !== 'DONO' && papel !== 'SUPERVISOR') {
    res.status(403).json({ error: 'Acesso restrito ao dono ou supervisor da operação' })
    return
  }
  next()
}
