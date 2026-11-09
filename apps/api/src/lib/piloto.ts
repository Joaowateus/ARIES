// PDF 04 · Piloto antes de todos: a versão nova das telas vai primeiro para o
// supervisor, um SDR e um vendedor (escolhidos pelo dono). Quem não está no
// piloto continua nas telas atuais. Depois da liberação do dono, registrada,
// vale para todos e as telas antigas são desligadas.
import { prisma } from './prisma'
import type { PapelHoje } from './papelHoje'

export type Versao = 'NOVA' | 'ATUAL'

export async function versaoDasTelas(usuarioId: string, pessoaId: string, papel: PapelHoje) {
  const [p, linha] = await Promise.all([
    prisma.parametroLiquidez.findUnique({ where: { usuarioId }, select: { telasNovasParaTodosEm: true } }),
    prisma.pilotoParticipante.findUnique({ where: { usuarioId_pessoaId: { usuarioId, pessoaId } } }),
  ])
  if (p?.telasNovasParaTodosEm) return { versao: 'NOVA' as Versao, piloto: false, podeAlternar: false, liberadaEm: p.telasNovasParaTodosEm }
  const ativa = linha && !linha.fim
  // O dono acompanha o piloto e alterna livremente (decisão aprovada).
  if (papel === 'DONO') return { versao: (linha?.versao as Versao) ?? 'ATUAL', piloto: false, podeAlternar: true, liberadaEm: null }
  return { versao: ativa ? (linha!.versao as Versao) : 'ATUAL', piloto: !!ativa, podeAlternar: !!ativa, liberadaEm: null }
}

export async function participantes(usuarioId: string) {
  const [linhas, pessoas, p] = await Promise.all([
    prisma.pilotoParticipante.findMany({ where: { usuarioId }, orderBy: { inicio: 'asc' } }),
    prisma.vendedor.findMany({ where: { usuarioId, ativo: true, email: { not: null }, senhaHash: { not: null } }, select: { id: true, nome: true, papel: true, funcao: true }, orderBy: { nome: 'asc' } }),
    prisma.parametroLiquidez.findUnique({ where: { usuarioId }, select: { telasNovasParaTodosEm: true } }),
  ])
  return {
    liberadaEm: p?.telasNovasParaTodosEm ?? null,
    pessoas: pessoas.map(x => {
      const l = linhas.find(y => y.pessoaId === x.id)
      return { id: x.id, nome: x.nome, papel: x.funcao === 'GESTOR_TRAFEGO' ? 'Gestor de tráfego' : x.funcao === 'FINANCEIRO' ? 'Financeiro' : x.papel === 'SDR' ? 'SDR' : x.papel === 'SUPERVISOR' ? 'Supervisor' : 'Vendedor', noPiloto: !!l && !l.fim, inicio: l?.inicio ?? null, fim: l?.fim ?? null, versao: l?.versao ?? null }
    }),
  }
}

export async function definirParticipante(usuarioId: string, pessoaId: string, participa: boolean, autor: string) {
  const v = await prisma.vendedor.findFirst({ where: { id: pessoaId, usuarioId, ativo: true } })
  if (!v) throw new Error('Pessoa não encontrada')
  const agora = new Date()
  if (participa) {
    await prisma.pilotoParticipante.upsert({
      where: { usuarioId_pessoaId: { usuarioId, pessoaId } },
      create: { usuarioId, pessoaId, versao: 'NOVA', inicio: agora, auditoriaAutor: autor },
      update: { versao: 'NOVA', inicio: agora, fim: null, auditoriaAutor: autor },
    })
  } else {
    await prisma.pilotoParticipante.updateMany({ where: { usuarioId, pessoaId, fim: null }, data: { fim: agora, versao: 'ATUAL', auditoriaAutor: autor } })
  }
  return participantes(usuarioId)
}

/** Quem está no piloto (ou o dono) alterna entre a versão nova e a atual. */
export async function alternarVersao(usuarioId: string, pessoaId: string, papel: PapelHoje, versao: Versao, autor: string) {
  const atual = await versaoDasTelas(usuarioId, pessoaId, papel)
  if (!atual.podeAlternar) throw new Error('A alternância só existe para quem está no piloto')
  await prisma.pilotoParticipante.upsert({
    where: { usuarioId_pessoaId: { usuarioId, pessoaId } },
    // O dono não é participante: a linha guarda só a versão que ele está olhando (fim preenchido = fora do piloto).
    create: { usuarioId, pessoaId, versao, auditoriaAutor: autor, ...(papel === 'DONO' ? { fim: new Date() } : {}) },
    update: { versao, auditoriaAutor: autor },
  })
  return versaoDasTelas(usuarioId, pessoaId, papel)
}

/** Liberação do dono, registrada: a versão nova passa a valer para todos. */
export async function liberarParaTodos(usuarioId: string, justificativa: string, autorId: string) {
  const agora = new Date()
  const antes = await prisma.parametroLiquidez.findUnique({ where: { usuarioId }, select: { telasNovasParaTodosEm: true } })
  await prisma.parametroLiquidez.update({ where: { usuarioId }, data: { telasNovasParaTodosEm: agora } })
  await prisma.parametroHistorico.create({ data: { usuarioId, nome: 'telasNovasParaTodos', valorAnterior: antes?.telasNovasParaTodosEm ? 1 : 0, valorNovo: 1, origem: 'MANUAL', justificativa, autorId } })
  await prisma.pilotoParticipante.updateMany({ where: { usuarioId, fim: null }, data: { fim: agora, auditoriaAutor: `USUARIO|${autorId}|DONO|piloto-liberado` } })
  return agora
}
