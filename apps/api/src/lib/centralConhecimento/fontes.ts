// PDF 07 · Central de Conhecimento — catálogo das fontes.
// Limite de atraso dos registros: 30 min (o job roda a cada 15 min na produção; dois ciclos de folga).
// Cada fonte diz: de onde vêm os dados, o limite de atraso aceito, o que entra no
// índice de pesquisa (só os campos listados em `montar`: a lista de campos permitidos)
// e quem pode ver cada item (`visiveis`, com as mesmas regras das telas).
//
// Nunca entram no índice (teste em tests/central.test.ts): CPF, data de nascimento,
// valores em R$, custos e margens, texto e mídia das conversas, notas da negociação,
// a aba Processo e anotações de outra pessoa. Telefone: só os 4 últimos dígitos.
import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { NOME_ETAPA, type Etapa } from '../etapasJornada'
import { FICHAS_PADRAO, fichas, type Papel } from '../metricas'
import type { CtxCentral } from './contexto'

export type TipoDoc =
  | 'LEAD' | 'CLIENTE' | 'VENDA' | 'MOTO' | 'ATIVIDADE' | 'VERBETE' | 'INDICADOR' | 'RECOMENDACAO'
  | 'OCORRENCIA' | 'REUNIAO' | 'ANOTACAO' | 'PAUTA' | 'POST' | 'CAMPANHA' | 'LANCAMENTO' | 'DECISAO'

export const NOME_TIPO: Record<TipoDoc, string> = {
  LEAD: 'Leads e negociações', CLIENTE: 'Clientes', VENDA: 'Vendas', MOTO: 'Motos do estoque', ATIVIDADE: 'Atividades',
  VERBETE: 'Conhecimento comercial', INDICADOR: 'Indicadores', RECOMENDACAO: 'Recomendações', OCORRENCIA: 'Ocorrências',
  REUNIAO: 'Reuniões', ANOTACAO: 'Suas anotações', PAUTA: 'Pautas do Social Media', POST: 'Posts do Instagram',
  CAMPANHA: 'Campanhas de anúncio', LANCAMENTO: 'Lançamentos do Financeiro', DECISAO: 'Decisões do Daily',
}

/** Um item do índice, montado só com campos permitidos. */
export interface Doc {
  usuarioId: string
  fonte: string
  registroId: string
  tipo: TipoDoc
  titulo: string
  resumo: string | null
  palavrasChave: string[]
  papeis: string[]
  vendedorId: string | null
  autorId: string | null
  link: string
  dataRegistro: Date | null
  versaoFonte: Date | null
}

export type TipoFonte = 'REGISTRO' | 'INTEGRACAO' | 'CONHECIMENTO' | 'INDICADOR' | 'HISTORICO' | 'NAO_INTEGRADA'

export interface FonteDef {
  chave: string
  nome: string
  tipo: TipoFonte
  descricao: string
  /** Tabela cujo gatilho grava os eventos (nome no banco). */
  tabela: string | null
  /** Tipo dos itens no índice (fontes sem índice: consulta direta ou só metadados). */
  doc: TipoDoc | null
  /** Atraso aceito, em minutos, entre a mudança na fonte e o índice. */
  limiteMin: number
  /** Quem vê a fonte na Saúde e nos filtros (o item ainda passa por `visiveis`). */
  papeis: Papel[]
  /** SELECT dos ids que devem estar no índice (carga e conferência). */
  idsSql?: (usuarioId: string) => Prisma.Sql
  /** Monta os itens dos ids pedidos (os que não existem mais simplesmente não voltam). */
  montar?: (ids: string[]) => Promise<Doc[]>
  /** Dos ids pedidos, quais a pessoa pode ver (mesmas regras das telas). */
  visiveis?: (ctx: CtxCentral, ids: string[]) => Promise<Set<string>>
  /** A fonte inteira é remontada de uma vez (integrações e dicionário). */
  inteira?: boolean
}

const TODOS: Papel[] = ['DONO', 'SUPERVISOR', 'SDR', 'VENDEDOR', 'SOCIAL_MEDIA', 'TRAFEGO', 'FINANCEIRO']
const COMERCIAL: Papel[] = ['DONO', 'SUPERVISOR', 'SDR', 'VENDEDOR']
const GESTAO: Papel[] = ['DONO', 'SUPERVISOR']

const corta = (s: string | null | undefined, n: number) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t
}
const final4 = (tel: string | null | undefined) => { const d = (tel ?? '').replace(/\D/g, ''); return d.length >= 4 ? [`final ${d.slice(-4)}`] : [] }
const junta = (...xs: Array<string | null | undefined | false>) => xs.filter(Boolean).join(' · ') || null
const set = (xs: Array<{ id: string }>) => new Set(xs.map(x => x.id))
const SITUACAO_MOTO: Record<string, string> = { DISPONIVEL: 'Disponível', RESERVADA: 'Reservada', VENDIDA: 'Vendida' }

export const FONTES: FonteDef[] = [
  {
    chave: 'leads', nome: 'Leads e negociações (CRM)', tipo: 'REGISTRO', descricao: 'Nome do cliente, moto de interesse, etapa e vendedor. Sem CPF, valores ou conversas.',
    tabela: 'pro_labore_leads', doc: 'LEAD', limiteMin: 30, papeis: COMERCIAL,
    idsSql: u => Prisma.sql`SELECT id FROM pro_labore_leads WHERE "usuarioId" = ${u}`,
    async montar(ids) {
      const ls = await prisma.lead.findMany({ where: { id: { in: ids } }, select: { id: true, usuarioId: true, nomeCliente: true, telefone: true, modeloInteresse: true, etapa: true, estagio: true, vendedorId: true, criadoEm: true, atualizadoEm: true, temperatura: true, vendedor: { select: { nome: true } } } })
      return ls.map(l => ({
        usuarioId: l.usuarioId, fonte: 'pro_labore_leads', registroId: l.id, tipo: 'LEAD',
        titulo: corta(l.nomeCliente, 120) || 'Lead sem nome',
        resumo: junta(l.modeloInteresse && corta(l.modeloInteresse, 60), l.etapa ? NOME_ETAPA[l.etapa as Etapa] ?? l.etapa : l.estagio, l.vendedor?.nome && `com ${l.vendedor.nome.split(/\s+/)[0]}`, l.temperatura?.toLowerCase()),
        palavrasChave: final4(l.telefone), papeis: COMERCIAL, vendedorId: l.vendedorId, autorId: null,
        link: `/pro-labore/leads?lead=${l.id}`, dataRegistro: l.criadoEm, versaoFonte: l.atualizadoEm,
      }))
    },
    async visiveis(ctx, ids) {
      if (!ctx.leads) return new Set()
      return set(await prisma.lead.findMany({ where: { AND: [ctx.leads, { id: { in: ids } }] }, select: { id: true } }))
    },
  },
  {
    chave: 'clientes', nome: 'Clientes', tipo: 'REGISTRO', descricao: 'Nome do cliente e se está bloqueado. Sem CPF, nascimento ou endereço.',
    tabela: 'pro_labore_clientes', doc: 'CLIENTE', limiteMin: 30, papeis: GESTAO,
    idsSql: u => Prisma.sql`SELECT id FROM pro_labore_clientes WHERE "usuarioId" = ${u}`,
    async montar(ids) {
      const cs = await prisma.cliente.findMany({ where: { id: { in: ids } }, select: { id: true, usuarioId: true, nome: true, telefone: true, bloqueado: true, criadoEm: true, atualizadoEm: true, _count: { select: { leads: true } } } })
      return cs.map(c => ({
        usuarioId: c.usuarioId, fonte: 'pro_labore_clientes', registroId: c.id, tipo: 'CLIENTE',
        titulo: corta(c.nome, 120) || 'Cliente sem nome', resumo: junta(`${c._count.leads} oportunidade${c._count.leads === 1 ? '' : 's'}`, c.bloqueado && 'bloqueado'),
        palavrasChave: final4(c.telefone), papeis: GESTAO, vendedorId: null, autorId: null,
        link: `/pro-labore/leads?busca=${encodeURIComponent(c.nome)}`, dataRegistro: c.criadoEm, versaoFonte: c.atualizadoEm,
      }))
    },
    // Como na busca do Início: cliente (cadastro da loja inteira) é da gestão com acesso ao CRM.
    async visiveis(ctx, ids) { return ctx.pessoal || !ctx.ve('crm') ? new Set() : new Set(ids) },
  },
  {
    chave: 'vendas', nome: 'Vendas', tipo: 'REGISTRO', descricao: 'Moto, cliente e data da venda. Sem valores (os valores ficam em Vendas e pagamentos).',
    tabela: 'pro_labore_vendas', doc: 'VENDA', limiteMin: 30, papeis: ['DONO', 'FINANCEIRO', 'SUPERVISOR', 'VENDEDOR', 'SDR'],
    idsSql: u => Prisma.sql`SELECT id FROM pro_labore_vendas WHERE "usuarioId" = ${u}`,
    async montar(ids) {
      const vs = await prisma.venda.findMany({ where: { id: { in: ids } }, select: { id: true, usuarioId: true, data: true, situacao: true, vendedorId: true, placa: true, atualizadoEm: true, moto: { select: { modelo: true, ano: true } }, lead: { select: { nomeCliente: true } }, vendedor: { select: { nome: true } } } })
      return vs.map(v => ({
        usuarioId: v.usuarioId, fonte: 'pro_labore_vendas', registroId: v.id, tipo: 'VENDA',
        titulo: corta(junta(v.moto && `${v.moto.modelo}${v.moto.ano ? ` ${v.moto.ano}` : ''}`, v.lead?.nomeCliente) ?? 'Venda', 140),
        resumo: junta(v.situacao === 'CONFIRMADA' ? 'Venda confirmada' : `Venda ${v.situacao.toLowerCase()}`, v.vendedor?.nome && `por ${v.vendedor.nome.split(/\s+/)[0]}`),
        palavrasChave: v.placa ? [v.placa] : [], papeis: ['DONO', 'FINANCEIRO', 'SUPERVISOR', 'VENDEDOR', 'SDR'], vendedorId: v.vendedorId, autorId: null,
        link: '/pro-labore/vendas', dataRegistro: v.data, versaoFonte: v.atualizadoEm,
      }))
    },
    async visiveis(ctx, ids) {
      if (ctx.pessoal) return set(await prisma.venda.findMany({ where: { id: { in: ids }, vendedorId: ctx.pessoa.vendedorId ?? '__nenhum__' }, select: { id: true } }))
      return ctx.ve('vendas') ? new Set(ids) : new Set()
    },
  },
  {
    chave: 'estoque', nome: 'Estoque de motos', tipo: 'REGISTRO', descricao: 'Modelo, ano, cor, km, placa e situação. Sem preço nem custo.',
    tabela: 'pro_labore_sm_motos_estoque', doc: 'MOTO', limiteMin: 30, papeis: TODOS,
    idsSql: u => Prisma.sql`SELECT id FROM pro_labore_sm_motos_estoque WHERE "usuarioId" = ${u}`,
    async montar(ids) {
      const ms = await prisma.smMotoEstoque.findMany({ where: { id: { in: ids } }, select: { id: true, usuarioId: true, marca: true, modelo: true, versao: true, ano: true, cor: true, km: true, placa: true, situacao: true, entradaEm: true, atualizadoEm: true } })
      return ms.map(m => ({
        usuarioId: m.usuarioId, fonte: 'pro_labore_sm_motos_estoque', registroId: m.id, tipo: 'MOTO',
        titulo: corta([m.marca, m.modelo, m.versao, m.ano].filter(Boolean).join(' '), 140),
        resumo: junta(SITUACAO_MOTO[m.situacao] ?? m.situacao, m.cor, m.km != null && `${m.km.toLocaleString('pt-BR')} km`),
        palavrasChave: m.placa ? [m.placa] : [], papeis: TODOS, vendedorId: null, autorId: null,
        link: '/pro-labore/aba/estoque-demanda', dataRegistro: m.entradaEm, versaoFonte: m.atualizadoEm,
      }))
    },
    async visiveis(_ctx, ids) { return new Set(ids) },
  },
  {
    chave: 'atividades', nome: 'Atividades', tipo: 'REGISTRO', descricao: 'O que fazer, tipo, situação e responsável.',
    tabela: 'pro_labore_atividades', doc: 'ATIVIDADE', limiteMin: 30, papeis: TODOS,
    idsSql: u => Prisma.sql`SELECT id FROM pro_labore_atividades WHERE "usuarioId" = ${u}`,
    async montar(ids) {
      const as = await prisma.atividade.findMany({ where: { id: { in: ids } }, select: { id: true, codigo: true, usuarioId: true, tipo: true, oQueFazer: true, status: true, responsavelId: true, prazo: true, atualizadoEm: true } })
      return as.map(a => ({
        usuarioId: a.usuarioId, fonte: 'pro_labore_atividades', registroId: a.id, tipo: 'ATIVIDADE',
        titulo: corta(a.oQueFazer || a.tipo.replace(/_/g, ' ').toLowerCase(), 140),
        resumo: junta(a.codigo, a.status === 'PENDENTE' ? 'Pendente' : a.status === 'EXECUTADA' ? 'Feita' : 'Cancelada'),
        palavrasChave: [a.tipo.replace(/_/g, ' ').toLowerCase(), ...(a.codigo ? [a.codigo] : [])], papeis: TODOS, vendedorId: a.responsavelId, autorId: null,
        link: '/pro-labore/atividades', dataRegistro: a.prazo, versaoFonte: a.atualizadoEm,
      }))
    },
    // Gestão vê todas; as demais pessoas, só as que estão com elas.
    async visiveis(ctx, ids) {
      if (ctx.pessoa.papel === 'DONO' || ctx.pessoa.papel === 'SUPERVISOR') return new Set(ids)
      return set(await prisma.atividade.findMany({ where: { id: { in: ids }, responsavelId: ctx.pessoa.vendedorId ?? ctx.pessoa.id }, select: { id: true } }))
    },
  },
  {
    chave: 'conhecimento', nome: 'Conhecimento comercial', tipo: 'CONHECIMENTO', descricao: 'Dúvidas, objeções, argumentos e gatilhos com a resposta aprovada.',
    tabela: 'pro_labore_assistente_conhecimento', doc: 'VERBETE', limiteMin: 30, papeis: TODOS,
    idsSql: u => Prisma.sql`SELECT id FROM pro_labore_assistente_conhecimento WHERE "usuarioId" = ${u}`,
    async montar(ids) {
      const vs = await prisma.assistenteConhecimento.findMany({ where: { id: { in: ids } }, select: { id: true, usuarioId: true, tipo: true, titulo: true, resposta: true, palavrasChave: true, status: true, modelo: true, criadoEm: true, atualizadoEm: true } })
      return vs.map(v => ({
        usuarioId: v.usuarioId, fonte: 'pro_labore_assistente_conhecimento', registroId: v.id, tipo: 'VERBETE',
        titulo: corta(v.titulo, 160),
        resumo: v.status === 'ATIVO' ? corta(v.resposta, 280) : v.status === 'ARQUIVADO' ? 'Arquivado' : 'Aguardando aprovação',
        palavrasChave: [...v.palavrasChave, v.tipo.toLowerCase(), ...(v.modelo ? [v.modelo] : [])].slice(0, 25),
        // Só a resposta aprovada é de todos; rascunho e arquivado ficam com a gestão.
        papeis: v.status === 'ATIVO' ? TODOS : GESTAO, vendedorId: null, autorId: null,
        link: `/pro-labore/aba/central-conhecimento?sub=comercial&verbete=${v.id}`, dataRegistro: v.criadoEm, versaoFonte: v.atualizadoEm,
      }))
    },
    async visiveis(ctx, ids) {
      if (ctx.pessoa.papel === 'DONO' || ctx.pessoa.papel === 'SUPERVISOR') return new Set(ids)
      return set(await prisma.assistenteConhecimento.findMany({ where: { id: { in: ids }, status: 'ATIVO' }, select: { id: true } }))
    },
  },
  {
    chave: 'indicadores', nome: 'Dicionário de métricas', tipo: 'INDICADOR', descricao: 'Nome, definição e sinônimos de cada ficha. O valor é calculado na hora, nunca copiado.',
    tabela: 'pro_labore_metricas_versoes', doc: 'INDICADOR', limiteMin: 30, papeis: TODOS, inteira: true,
    idsSql: u => Prisma.sql`SELECT ${u} || ':' || x AS id FROM unnest(${FICHAS_PADRAO.map(f => f.chave)}::text[]) AS x`,
    async montar(ids) {
      const porLoja = new Map<string, string[]>()
      for (const id of ids) { const [u, chave] = id.split(':'); porLoja.set(u, [...(porLoja.get(u) ?? []), chave]) }
      const docs: Doc[] = []
      for (const [u, chaves] of porLoja) {
        for (const f of (await fichas(u)).filter(x => chaves.includes(x.chave))) {
          docs.push({
            usuarioId: u, fonte: 'pro_labore_metricas_versoes', registroId: `${u}:${f.chave}`, tipo: 'INDICADOR',
            titulo: f.nome, resumo: corta(f.definicao, 240), palavrasChave: [...(f.sinonimos ?? []), f.fonte, f.chave.replace(/_/g, ' ')],
            papeis: f.quemVe, vendedorId: null, autorId: null,
            link: `/pro-labore/aba/central-conhecimento?sub=indicadores&ficha=${f.chave}`, dataRegistro: null, versaoFonte: f.aprovadoEm ?? null,
          })
        }
      }
      return docs
    },
    async visiveis(ctx, ids) {
      if (ctx.pessoa.papel === 'DONO') return new Set(ids)
      const fs = await fichas(ctx.pessoa.usuarioId)
      return new Set(ids.filter(id => fs.find(f => f.chave === id.split(':')[1])?.quemVe.includes(ctx.pessoa.papel)))
    },
  },
  {
    chave: 'recomendacoes', nome: 'Recomendações', tipo: 'REGISTRO', descricao: 'Título, área e ação sugerida.',
    tabela: 'pro_labore_recomendacoes', doc: 'RECOMENDACAO', limiteMin: 30, papeis: TODOS,
    idsSql: u => Prisma.sql`SELECT id FROM pro_labore_recomendacoes WHERE "usuarioId" = ${u}`,
    async montar(ids) {
      const rs = await prisma.recomendacao.findMany({ where: { id: { in: ids } }, select: { id: true, codigo: true, usuarioId: true, titulo: true, area: true, acaoSugerida: true, status: true, visivelPara: true, destinatarioId: true, criadoEm: true, atualizadoEm: true } })
      return rs.map(r => ({
        usuarioId: r.usuarioId, fonte: 'pro_labore_recomendacoes', registroId: r.id, tipo: 'RECOMENDACAO',
        titulo: corta(r.titulo, 160), resumo: junta(r.codigo, corta(r.acaoSugerida, 200)), palavrasChave: [r.area.toLowerCase()],
        papeis: ['DONO', ...r.visivelPara], vendedorId: r.destinatarioId, autorId: null,
        link: '/pro-labore/recomendacoes', dataRegistro: r.criadoEm, versaoFonte: r.atualizadoEm,
      }))
    },
    async visiveis(ctx, ids) {
      if (ctx.pessoa.papel === 'DONO') return new Set(ids)
      const p = ctx.pessoa
      return set(await prisma.recomendacao.findMany({ where: { id: { in: ids }, OR: [{ visivelPara: { has: p.papel } }, { destinatarioId: p.id }, { acompanhaIds: { has: p.id } }] }, select: { id: true } }))
    },
  },
  {
    chave: 'ocorrencias', nome: 'Ocorrências da equipe', tipo: 'REGISTRO', descricao: 'Tipo, motivo, pessoa e situação.',
    tabela: 'pro_labore_ocorrencias', doc: 'OCORRENCIA', limiteMin: 30, papeis: GESTAO,
    idsSql: u => Prisma.sql`SELECT id FROM pro_labore_ocorrencias WHERE "usuarioId" = ${u}`,
    async montar(ids) {
      const os = await prisma.ocorrencia.findMany({ where: { id: { in: ids } }, select: { id: true, usuarioId: true, protocolo: true, tipo: true, motivo: true, status: true, gravidade: true, vendedorId: true, dataOcorrencia: true, atualizadoEm: true, vendedor: { select: { nome: true } } } })
      return os.map(o => ({
        usuarioId: o.usuarioId, fonte: 'pro_labore_ocorrencias', registroId: o.id, tipo: 'OCORRENCIA',
        titulo: corta(`${o.tipo} · ${o.vendedor.nome}`, 140), resumo: junta(o.protocolo, corta(o.motivo, 120), o.gravidade, o.status.toLowerCase().replace(/_/g, ' ')),
        palavrasChave: [o.protocolo], papeis: GESTAO, vendedorId: o.vendedorId, autorId: null,
        link: '/pro-labore/ocorrencias', dataRegistro: o.dataOcorrencia, versaoFonte: o.atualizadoEm,
      }))
    },
    async visiveis(ctx, ids) { return !ctx.pessoal && ctx.ve('ocorrencias') ? new Set(ids) : new Set() },
  },
  {
    chave: 'reunioes', nome: 'Reuniões', tipo: 'REGISTRO', descricao: 'Título, tipo e data. Sem a transcrição.',
    tabela: 'pro_labore_reunioes', doc: 'REUNIAO', limiteMin: 30, papeis: TODOS,
    idsSql: u => Prisma.sql`SELECT id FROM pro_labore_reunioes WHERE "usuarioId" = ${u}`,
    async montar(ids) {
      const rs = await prisma.reuniao.findMany({ where: { id: { in: ids } }, select: { id: true, usuarioId: true, titulo: true, tipo: true, data: true, vendedorId: true, atualizadoEm: true } })
      return rs.map(r => ({
        usuarioId: r.usuarioId, fonte: 'pro_labore_reunioes', registroId: r.id, tipo: 'REUNIAO',
        titulo: corta(r.titulo, 140), resumo: r.tipo === 'AULA' ? 'Aula' : r.tipo === 'VIDEO' ? 'Vídeo' : 'Reunião', palavrasChave: [], papeis: TODOS, vendedorId: r.vendedorId, autorId: null,
        link: '/pro-labore/reunioes', dataRegistro: r.data, versaoFonte: r.atualizadoEm,
      }))
    },
    // O dono vê todas; cada pessoa, as dela (as compartilhadas continuam na aba Reuniões).
    async visiveis(ctx, ids) {
      if (ctx.pessoa.papel === 'DONO') return new Set(ids)
      if (!ctx.ve('reunioes')) return new Set()
      return set(await prisma.reuniao.findMany({ where: { id: { in: ids }, vendedorId: ctx.pessoa.vendedorId ?? '__nenhum__' }, select: { id: true } }))
    },
  },
  {
    chave: 'anotacoes', nome: 'Anotações', tipo: 'REGISTRO', descricao: 'Título e trecho das anotações. Cada uma só aparece para quem escreveu e nunca vai à IA.',
    tabela: 'pro_labore_notas', doc: 'ANOTACAO', limiteMin: 30, papeis: TODOS,
    idsSql: u => Prisma.sql`SELECT id FROM pro_labore_notas WHERE "usuarioId" = ${u}`,
    async montar(ids) {
      const ns = await prisma.nota.findMany({ where: { id: { in: ids } }, select: { id: true, usuarioId: true, vendedorId: true, titulo: true, conteudo: true, criadoEm: true, atualizadoEm: true } })
      return ns.map(n => ({
        usuarioId: n.usuarioId, fonte: 'pro_labore_notas', registroId: n.id, tipo: 'ANOTACAO',
        titulo: corta(n.titulo || n.conteudo.split('\n')[0] || 'Anotação', 120), resumo: corta(n.conteudo, 200) || null, palavrasChave: [],
        papeis: TODOS, vendedorId: n.vendedorId, autorId: n.vendedorId ?? `DONO:${n.usuarioId}`,
        link: '/pro-labore/anotacoes', dataRegistro: n.criadoEm, versaoFonte: n.atualizadoEm,
      }))
    },
    // Privadas do autor: o dono escreve com vendedorId vazio; a pessoa da equipe, com o próprio id.
    async visiveis(ctx, ids) {
      const where = ctx.pessoa.papel === 'DONO' && !ctx.pessoa.vendedorId ? { vendedorId: null } : { vendedorId: ctx.pessoa.vendedorId ?? '__nenhum__' }
      return set(await prisma.nota.findMany({ where: { id: { in: ids }, usuarioId: ctx.pessoa.usuarioId, ...where }, select: { id: true } }))
    },
  },
  {
    chave: 'pautas', nome: 'Pautas do Social Media', tipo: 'REGISTRO', descricao: 'Título, formato e situação da pauta.',
    tabela: 'pro_labore_sm_pautas', doc: 'PAUTA', limiteMin: 30, papeis: ['DONO', 'SOCIAL_MEDIA'],
    idsSql: u => Prisma.sql`SELECT id FROM pro_labore_sm_pautas WHERE "usuarioId" = ${u}`,
    async montar(ids) {
      const ps = await prisma.smPauta.findMany({ where: { id: { in: ids } }, select: { id: true, usuarioId: true, titulo: true, formato: true, status: true, codigo: true, criadoEm: true, atualizadoEm: true } })
      return ps.map(p => ({
        usuarioId: p.usuarioId, fonte: 'pro_labore_sm_pautas', registroId: p.id, tipo: 'PAUTA',
        titulo: corta(p.titulo, 140), resumo: junta(p.codigo, p.formato.toLowerCase(), p.status.toLowerCase()), palavrasChave: p.codigo ? [p.codigo] : [],
        papeis: ['DONO', 'SOCIAL_MEDIA'], vendedorId: null, autorId: null, link: '/pro-labore/sm', dataRegistro: p.criadoEm, versaoFonte: p.atualizadoEm,
      }))
    },
    async visiveis(ctx, ids) { return ctx.pessoa.papel === 'DONO' || ctx.pessoa.papel === 'SOCIAL_MEDIA' ? new Set(ids) : new Set() },
  },
  {
    chave: 'financeiro', nome: 'Lançamentos do Financeiro', tipo: 'REGISTRO', descricao: 'Categoria, favorecido e descrição. Sem valores nem documento.',
    tabela: 'pro_labore_lancamentos_financeiros', doc: 'LANCAMENTO', limiteMin: 30, papeis: ['DONO', 'FINANCEIRO'],
    idsSql: u => Prisma.sql`SELECT id FROM pro_labore_lancamentos_financeiros WHERE "usuarioId" = ${u}`,
    async montar(ids) {
      const ls = await prisma.lancamentoFinanceiro.findMany({ where: { id: { in: ids } }, select: { id: true, usuarioId: true, categoria: true, numero: true, favorecido: true, descricao: true, vendedorId: true, pagoEm: true, canceladoEm: true, criadoEm: true } })
      return ls.map(l => ({
        usuarioId: l.usuarioId, fonte: 'pro_labore_lancamentos_financeiros', registroId: l.id, tipo: 'LANCAMENTO',
        titulo: corta(`${l.categoria.charAt(0)}${l.categoria.slice(1).toLowerCase()} nº ${l.numero} · ${l.favorecido}`, 140), resumo: junta(corta(l.descricao, 160), l.canceladoEm && 'cancelado'),
        palavrasChave: [], papeis: ['DONO', 'FINANCEIRO'], vendedorId: l.vendedorId, autorId: null,
        link: '/pro-labore/financeiro', dataRegistro: l.pagoEm, versaoFonte: l.canceladoEm ?? l.criadoEm,
      }))
    },
    // Quem vê só os próprios dados vê só os recibos dele (regra do módulo Financeiro).
    async visiveis(ctx, ids) {
      if (!ctx.ve('financeiro')) return new Set()
      if (!ctx.pessoal) return new Set(ids)
      return set(await prisma.lancamentoFinanceiro.findMany({ where: { id: { in: ids }, vendedorId: ctx.pessoa.vendedorId ?? '__nenhum__' }, select: { id: true } }))
    },
  },
  {
    chave: 'daily', nome: 'Decisões do Daily', tipo: 'REGISTRO', descricao: 'O que foi decidido, prioridade e responsáveis.',
    tabela: 'pro_labore_daily_decisoes', doc: 'DECISAO', limiteMin: 30, papeis: TODOS,
    idsSql: u => Prisma.sql`SELECT id FROM pro_labore_daily_decisoes WHERE "usuarioId" = ${u}`,
    async montar(ids) {
      const ds = await prisma.dailyDecisao.findMany({ where: { id: { in: ids } }, select: { id: true, usuarioId: true, texto: true, prioridade: true, prazo: true, criadoEm: true } })
      return ds.map(d => ({
        usuarioId: d.usuarioId, fonte: 'pro_labore_daily_decisoes', registroId: d.id, tipo: 'DECISAO',
        titulo: corta(d.texto, 160), resumo: `Prioridade ${d.prioridade.toLowerCase()}`, palavrasChave: ['daily', 'decisao'], papeis: TODOS, vendedorId: null, autorId: null,
        link: '/pro-labore/hoje?sub=daily', dataRegistro: d.prazo, versaoFonte: d.criadoEm,
      }))
    },
    async visiveis(ctx, ids) {
      if (ctx.pessoa.papel === 'DONO' || ctx.pessoa.papel === 'SUPERVISOR') return new Set(ids)
      return set(await prisma.dailyDecisao.findMany({ where: { id: { in: ids }, responsaveis: { has: ctx.pessoa.id } }, select: { id: true } }))
    },
  },
  {
    chave: 'instagram', nome: 'Instagram (posts)', tipo: 'INTEGRACAO', descricao: 'Legenda e formato dos posts, atualizados a cada sincronização.',
    tabela: 'instagram', doc: 'POST', limiteMin: 26 * 60, papeis: ['DONO', 'SOCIAL_MEDIA'], inteira: true,
    idsSql: u => Prisma.sql`SELECT m.id FROM pro_labore_social_media_midias m JOIN pro_labore_social_media_contas c ON c.id = m."contaId" WHERE c."usuarioId" = ${u}`,
    async montar(ids) {
      const ms = await prisma.socialMediaMidia.findMany({ where: { id: { in: ids } }, select: { id: true, legenda: true, formato: true, tipo: true, publicadoEm: true, atualizadoEm: true, conta: { select: { usuarioId: true } } } })
      return ms.map(m => ({
        usuarioId: m.conta.usuarioId, fonte: 'instagram', registroId: m.id, tipo: 'POST',
        titulo: corta(m.legenda?.split('\n')[0] || 'Post sem legenda', 120), resumo: junta((m.formato ?? m.tipo).toLowerCase(), corta(m.legenda, 160)), palavrasChave: [],
        papeis: ['DONO', 'SOCIAL_MEDIA'], vendedorId: null, autorId: null, link: '/pro-labore/sm', dataRegistro: m.publicadoEm, versaoFonte: m.atualizadoEm,
      }))
    },
    async visiveis(ctx, ids) { return ctx.pessoa.papel === 'DONO' || ctx.pessoa.papel === 'SOCIAL_MEDIA' ? new Set(ids) : new Set() },
  },
  {
    chave: 'meta', nome: 'Meta (campanhas de anúncio)', tipo: 'INTEGRACAO', descricao: 'Nome e situação das campanhas, atualizados a cada sincronização do Tráfego.',
    tabela: 'meta', doc: 'CAMPANHA', limiteMin: 3 * 60, papeis: ['DONO', 'TRAFEGO'], inteira: true,
    idsSql: u => Prisma.sql`SELECT e.id FROM pro_labore_trafego_estrutura e JOIN pro_labore_trafego_contas c ON c.id = e."contaId" WHERE c."usuarioId" = ${u} AND e.tipo = 'campanha'`,
    async montar(ids) {
      const es = await prisma.trafegoEstrutura.findMany({ where: { id: { in: ids } }, select: { id: true, contaId: true, nome: true, status: true, atualizadoEm: true } })
      const contas = new Map((await prisma.trafegoConta.findMany({ where: { id: { in: [...new Set(es.map(e => e.contaId))] } }, select: { id: true, usuarioId: true } })).map(c => [c.id, c.usuarioId]))
      return es.filter(e => contas.has(e.contaId)).map(e => ({
        usuarioId: contas.get(e.contaId)!, fonte: 'meta', registroId: e.id, tipo: 'CAMPANHA',
        titulo: corta(e.nome, 140), resumo: e.status ? `Campanha ${e.status.toLowerCase()}` : 'Campanha', palavrasChave: ['campanha', 'anuncio'],
        papeis: ['DONO', 'TRAFEGO'], vendedorId: null, autorId: null, link: '/pro-labore/trafego', dataRegistro: null, versaoFonte: e.atualizadoEm,
      }))
    },
    async visiveis(ctx, ids) { return ctx.pessoa.papel === 'DONO' || ctx.pessoa.papel === 'TRAFEGO' || ctx.ve('trafego') ? new Set(ids) : new Set() },
  },
  // Fontes sem itens no índice: aparecem na Saúde com a hora da última atualização.
  {
    chave: 'whatsapp', nome: 'WhatsApp (só metadados)', tipo: 'INTEGRACAO', descricao: 'Tempos e contagens das conversas, pelas métricas. O texto das mensagens não entra na Central nem vai à IA (decisão D5).',
    tabela: null, doc: null, limiteMin: 3 * 60, papeis: COMERCIAL,
  },
  {
    chave: 'historico', nome: 'Histórico (auditoria e etapas)', tipo: 'HISTORICO', descricao: 'Consultado direto da trilha de auditoria e do histórico de etapas, que já são imutáveis.',
    tabela: null, doc: null, limiteMin: 30, papeis: GESTAO,
  },
  {
    chave: 'dados', nome: 'Dados do Pró-Labore (consulta direta)', tipo: 'REGISTRO', descricao: 'Todas as tabelas do sistema, consultadas na hora pelo catálogo de dados, com as permissões de cada papel. Dinheiro só reservado; CPF, nascimento, senhas, e-mail e endereço nunca saem.',
    tabela: null, doc: null, limiteMin: 0, papeis: TODOS,
  },
  {
    chave: 'ia', nome: 'IA do Pergunte', tipo: 'INTEGRACAO', descricao: 'A chamada à IA que entende a pergunta e escreve a resposta. Se falhar, o Pergunte responde pelas regras e o motivo aparece aqui.',
    tabela: null, doc: null, limiteMin: 0, papeis: ['DONO'],
  },
  {
    chave: 'playbook', nome: 'Playbook', tipo: 'NAO_INTEGRADA', descricao: 'O playbook da loja ainda não tem conteúdo no sistema. Entra na Central quando existir (decisão D4).',
    tabela: null, doc: null, limiteMin: 0, papeis: TODOS,
  },
]

export const fontePorChave = (chave: string) => FONTES.find(f => f.chave === chave) ?? null
export const fontePorTabela = (tabela: string) => FONTES.find(f => f.tabela === tabela) ?? null
export const fontePorTipo = (tipo: string) => FONTES.find(f => f.doc === tipo) ?? null
export const FONTES_INDEXADAS = FONTES.filter(f => f.doc && f.montar && f.idsSql)
