// PDF 07 · Central de Conhecimento — quem está consultando e o que pode ver (P7: no servidor).
// As regras são as mesmas das telas: módulos de acesso (acessos.ts), escopo dos leads
// (leadWhereDe, igual ao leadWhereBase do CRM) e o escopo pessoal de vendedor e SDR.
import type { Request } from 'express'
import type {} from '../../middleware/authProLabore'
import type { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { TUDO, nivelAtende, permissoesEfetivas, type Permissoes } from '../acessos'
import { leadWhereDe } from '../escopoLead'
import { papelDoUsuario } from '../papelHoje'
import type { Pessoa } from '../hoje'

export interface CtxCentral {
  pessoa: Pessoa
  acessos: Permissoes
  /** Filtro dos leads que a pessoa vê; null = sem acesso ao CRM. */
  leads: Prisma.LeadWhereInput | null
  /** Vendedor e SDR veem só os próprios registros. */
  pessoal: boolean
  ve: (modulo: string) => boolean
}

const PESSOAL = new Set(['VENDEDOR', 'SDR'])

function montar(pessoa: Pessoa, acessos: Permissoes, sdr: boolean, papelLogin: string): CtxCentral {
  const ve = (m: string) => pessoa.papel === 'DONO' || nivelAtende(acessos[m], 'VER')
  const pessoal = PESSOAL.has(pessoa.papel)
  const leads = ve('crm') || pessoal
    ? leadWhereDe({ usuarioId: pessoa.usuarioId, papel: papelLogin, sdr, vendedorId: pessoa.vendedorId })
    : null
  return { pessoa, acessos, leads, pessoal, ve }
}

/** Contexto do pedido HTTP (o login já trouxe papel e permissões do banco). */
export function contextoDoPedido(req: Request): CtxCentral {
  const u = req.proLaboreUser!
  const pessoa: Pessoa = { usuarioId: u.sub, papel: papelDoUsuario(u), id: u.vendedorId ?? (u.papel === 'SOCIAL_MEDIA' && u.smMembroId ? u.smMembroId : u.sub), vendedorId: u.vendedorId ?? null, nome: u.nome }
  const acessos = u.papel === 'DONO' ? TUDO : ((req as Request & { acessos?: Permissoes }).acessos ?? permissoesEfetivas(u.papel, null))
  return montar(pessoa, acessos, !!u.sdr, u.papel)
}

/** Contexto fora de um pedido (WhatsApp): lê o cadastro da pessoa, como o login faz. */
export async function contextoDaPessoa(usuarioId: string, vendedorId: string | null, nome: string): Promise<CtxCentral | null> {
  if (!vendedorId) return montar({ usuarioId, papel: 'DONO', id: usuarioId, vendedorId: null, nome }, TUDO, false, 'DONO')
  const v = await prisma.vendedor.findFirst({ where: { id: vendedorId, usuarioId, ativo: true }, select: { id: true, papel: true, funcao: true, permissoes: true } })
  if (!v) return null
  const papelLogin = v.papel === 'SUPERVISOR' ? 'SUPERVISOR' : 'VENDEDOR'
  const sdr = v.papel === 'SDR'
  const funcao = v.funcao === 'GESTOR_TRAFEGO' || v.funcao === 'FINANCEIRO' ? v.funcao : null
  const papel = papelDoUsuario({ papel: papelLogin, sdr, funcao })
  return montar({ usuarioId, papel, id: v.id, vendedorId: v.id, nome }, permissoesEfetivas(papelLogin, v.permissoes), sdr, papelLogin)
}
