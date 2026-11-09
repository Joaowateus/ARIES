// PDF 04 · seção 9: teste de aceite calculado na própria produção (o dono vê
// em Configurações). Os itens de tela (menu e nomes, padrão de tela, celular)
// são conferidos navegando pelo sistema; aqui fica o que os dados provam.
import { prisma } from './prisma'
import { calcular, ler, type Escopo } from './metricas'
import { CONFIG_PADRAO, ABA_LENTE, filaDoHoje, lenteDaAba, numerosDoHoje, type Pessoa } from './hoje'
import { envioSeguro, type NumeroResposta } from './pergunte'
import type { PapelHoje } from './papelHoje'
import { NOME_PAPEL } from './papelHoje'

const NADA = 'Nada fora do normal nesta aba'
const igual = (a: number | null, b: number | null) => (a == null && b == null) || (a != null && b != null && Math.abs(a - b) < 0.011)

async function pessoasDosPapeis(usuarioId: string): Promise<Array<Pessoa | { papel: PapelHoje; faltando: true }>> {
  const vs = await prisma.vendedor.findMany({ where: { usuarioId, ativo: true, email: { not: null } }, select: { id: true, nome: true, papel: true, funcao: true }, orderBy: { criadoEm: 'asc' } })
  const sm = await prisma.smMembro.findFirst({ where: { usuarioId }, select: { id: true, nome: true } }).catch(() => null)
  const dono = await prisma.proLaboreUsuario.findUnique({ where: { id: usuarioId }, select: { nome: true } })
  const de = (papel: PapelHoje, f: (v: typeof vs[number]) => boolean) => { const v = vs.find(f); return v ? { usuarioId, papel, id: v.id, vendedorId: v.id, nome: v.nome } : { papel, faltando: true as const } }
  return [
    { usuarioId, papel: 'DONO', id: usuarioId, vendedorId: null, nome: dono?.nome ?? 'Dono' },
    de('SUPERVISOR', v => v.papel === 'SUPERVISOR' && !v.funcao),
    de('SDR', v => v.papel === 'SDR'),
    de('VENDEDOR', v => v.papel === 'VENDEDOR' && !v.funcao),
    de('TRAFEGO', v => v.funcao === 'GESTOR_TRAFEGO'),
    de('FINANCEIRO', v => v.funcao === 'FINANCEIRO'),
    sm ? { usuarioId, papel: 'SOCIAL_MEDIA', id: sm.id, vendedorId: null, nome: sm.nome } : { papel: 'SOCIAL_MEDIA', faltando: true },
  ]
}

export async function aceitePdf04(usuarioId: string, agora = new Date()) {
  // 1. Hoje de cada papel: os três números recalculados direto do dicionário e a fila na ordem aprovada.
  const hoje = []
  for (const p of await pessoasDosPapeis(usuarioId)) {
    if ('faltando' in p) { hoje.push({ papel: p.papel, nome: NOME_PAPEL[p.papel], pessoa: null, numeros: [], filaEmOrdem: null, itensFila: 0, passa: null }); continue }
    const numeros = await numerosDoHoje(p, agora)
    const conferidos = await Promise.all(numeros.map(async n => {
      const pessoal = p.papel === 'VENDEDOR' || p.papel === 'SDR'
      const cfg = CONFIG_PADRAO[p.papel].numeros.find(x => x.chave === n.chave)
      const vendedorId = cfg?.escopo === 'LOJA' ? null : pessoal ? p.vendedorId : n.chave === 'itens_escalonados' ? p.vendedorId : null
      const e: Escopo = { usuarioId, papel: p.papel, vendedorId }
      const v = n.naoDefinido ? null : (await calcular(n.chave, e, n.periodo, agora).catch(() => ({ valor: null }))).valor
      return { chave: n.chave, nome: n.nome, valor: n.valor, dicionario: v, bate: n.naoDefinido ? null : igual(n.valor, v), naoDefinido: n.naoDefinido }
    }))
    const fila = p.papel === 'SOCIAL_MEDIA' ? [] : await filaDoHoje(p, agora)
    const emOrdem = fila.every((x, i) => i === 0 || fila[i - 1].ordem <= x.ordem)
    hoje.push({ papel: p.papel, nome: NOME_PAPEL[p.papel], pessoa: p.nome, numeros: conferidos, filaEmOrdem: emOrdem, itensFila: fila.length, passa: conferidos.length === 3 && conferidos.every(c => c.bate !== false) && emOrdem })
  }
  // 2. Lente: até três itens só da aba; vazia mostra a mensagem aprovada; nunca executa sozinha.
  const dono: Pessoa = { usuarioId, papel: 'DONO', id: usuarioId, vendedorId: null, nome: 'Dono' }
  const lentes = []
  for (const [aba, cfg] of Object.entries(ABA_LENTE)) {
    if (aba === 'hoje') continue
    const l = await lenteDaAba(dono, aba, agora)
    const ids = l.itens.map(i => i.id).filter((x): x is string => !!x)
    const areas = ids.length ? (await prisma.recomendacao.findMany({ where: { id: { in: ids } }, select: { area: true } })).map(r => r.area) : []
    const soDaAba = areas.every(a => cfg.areas.includes(a))
    lentes.push({ aba, itens: l.itens.length, soDaAba, vazia: l.vazio, mensagem: l.mensagem, passa: l.itens.length <= 3 && soDaAba && (!l.vazio || l.mensagem === NADA) })
  }
  const execAuto = await prisma.atividade.count({ where: { usuarioId, origemTipo: 'RECOMENDACAO', autorExecucaoTipo: 'AUTOMACAO' } })
  const decididasSemPessoa = await prisma.recomendacao.count({ where: { usuarioId, status: { not: 'NOVA' }, decididoPor: null } })
  // 3. Pergunte ao ARIES — números: cada número com métrica, período, comparação e link, e o valor do dicionário.
  const conversas = await prisma.pergunteConversa.findMany({ where: { usuarioId, naoSabe: false }, orderBy: { criadoEm: 'desc' }, take: 20 })
  const numerosPerg = conversas.flatMap(c => (c.valores as unknown as NumeroResposta[]).map(n => ({ conversa: c.id, papel: c.papel, pergunta: c.pergunta, criadoEm: c.criadoEm, n })))
  const conferidosPerg = await Promise.all(numerosPerg.map(async x => {
    const completo = !!x.n.nome && !!x.n.periodo && !!x.n.link && (x.n.comparacao != null || x.n.meta != null || x.n.periodoTexto === 'agora')
    // Recalcula só o que é de hoje e da loja inteira ou da própria pessoa (média da equipe é dividida e já conferida no teste local).
    let confere: boolean | null = null
    if (x.n.escopo === 'a loja' && x.n.periodoTexto !== 'agora') {
      const l = await ler(x.n.chave, { usuarioId, papel: 'DONO' }, x.n.periodo, agora, { faixas: false }).catch(() => null)
      confere = l ? igual(l.valor, x.n.valor) : null
    }
    return { pergunta: x.pergunta, papel: x.papel, metrica: x.n.nome, valor: x.n.valorTexto, periodo: x.n.periodoTexto, comparacao: x.n.comparacao?.valorTexto ?? null, link: x.n.link, completo, confere }
  }))
  const papeisPerg = new Set(conversas.map(c => c.papel))
  // 4. Proteção: nada de R$, CPF ou data de nascimento no que foi enviado à IA.
  const envios = await prisma.iaEnvio.findMany({ where: { usuarioId }, select: { id: true, conteudo: true, criadoEm: true, finalidade: true } })
  const inseguros = envios.filter(e => !envioSeguro(e.conteudo))
  // 5. Limites: "não sei" com onde procurar; vendedor perguntando de colega recebe média sem nomes.
  const naoSabe = await prisma.pergunteConversa.findMany({ where: { usuarioId, naoSabe: true }, orderBy: { criadoEm: 'desc' }, take: 10, select: { pergunta: true, resposta: true } })
  const nomes = (await prisma.vendedor.findMany({ where: { usuarioId }, select: { id: true, nome: true } })).map(v => ({ id: v.id, primeiro: v.nome.split(/\s+/)[0] })).filter(v => v.primeiro.length > 2)
  const doVendedor = await prisma.pergunteConversa.findMany({ where: { usuarioId, papel: { in: ['VENDEDOR', 'SDR'] } }, orderBy: { criadoEm: 'desc' }, take: 50, select: { pessoaId: true, resposta: true, valores: true, pergunta: true } })
  const vazou = doVendedor.filter(c => nomes.some(n => n.id !== c.pessoaId && new RegExp(`\\b${n.primeiro}\\b`, 'i').test(c.resposta)))
  const sobreColega = doVendedor.filter(c => nomes.some(n => n.id !== c.pessoaId && new RegExp(`\\b${n.primeiro}\\b`, 'i').test(c.pergunta)))
  const soMedia = sobreColega.every(c => (c.valores as unknown as NumeroResposta[]).every(n => n.escopo === 'a média da equipe'))
  // 9. Sistema atual: quem não está no piloto continua nas telas atuais.
  const [piloto, usoAtual, usoNova] = await Promise.all([
    prisma.pilotoParticipante.count({ where: { usuarioId, fim: null } }),
    prisma.usoTela.count({ where: { usuarioId, versao: 'ATUAL', abertaEm: { gte: new Date(agora.getTime() - 7 * 86_400_000) } } }),
    prisma.usoTela.count({ where: { usuarioId, versao: 'NOVA', abertaEm: { gte: new Date(agora.getTime() - 7 * 86_400_000) } } }),
  ])
  return {
    hoje: { papeis: hoje, passa: hoje.filter(h => h.passa !== null).length ? hoje.every(h => h.passa !== false) : null },
    lente: { abas: lentes, execucoesAutomaticas: execAuto, decididasSemPessoa, passa: lentes.every(l => l.passa) && execAuto === 0 && decididasSemPessoa === 0 },
    pergunteNumeros: { conversas: conversas.length, papeis: [...papeisPerg], numeros: conferidosPerg, passa: conversas.length >= 20 ? conferidosPerg.every(n => n.completo && n.confere !== false) : null },
    pergunteProtecao: { envios: envios.length, inseguros: inseguros.map(e => ({ id: e.id, finalidade: e.finalidade, criadoEm: e.criadoEm })), passa: inseguros.length === 0 },
    pergunteLimites: { naoSabe: naoSabe.length, exemplosNaoSabe: naoSabe.slice(0, 3), perguntasSobreColega: sobreColega.length, nomesVazados: vazou.length, passa: naoSabe.length > 0 && sobreColega.length > 0 ? vazou.length === 0 && soMedia && naoSabe.every(n => /Procure em/.test(n.resposta)) : null },
    sistemaAtual: { noPiloto: piloto, aberturasTelasAtuais: usoAtual, aberturasTelasNovas: usoNova, passa: usoAtual > 0 || piloto === 0 ? true : null },
  }
}
