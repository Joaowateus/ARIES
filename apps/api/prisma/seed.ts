import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { PROTOCOLOS_SEED } from '../src/data/protocolos-padrao'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Populando banco de dados...')

  // Empresa
  const empresa = await prisma.empresa.upsert({
    where: { cnpj: '00.000.000/0001-00' },
    update: {},
    create: {
      nome: 'Aries Negócios',
      cnpj: '00.000.000/0001-00',
      segmento: 'motos',
    },
  })
  console.log(`✓ Empresa: ${empresa.nome}`)

  // Usuários
  const senhaAdmin = await bcrypt.hash('aries2026', 12)
  const senhaVendedor = await bcrypt.hash('vendedor123', 12)

  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@ariesnegocios.com.br' },
    update: {},
    create: {
      empresaId: empresa.id,
      nome: 'Administrador',
      email: 'admin@ariesnegocios.com.br',
      senhaHash: senhaAdmin,
      papel: 'ADMINISTRADOR',
      status: 'ATIVO',
    },
  })

  const gerente = await prisma.usuario.upsert({
    where: { email: 'gerente@ariesnegocios.com.br' },
    update: {},
    create: {
      empresaId: empresa.id,
      nome: 'Carlos Gerente',
      email: 'gerente@ariesnegocios.com.br',
      senhaHash: senhaAdmin,
      papel: 'GERENTE_COMERCIAL',
      status: 'ATIVO',
    },
  })

  const vendedor1 = await prisma.usuario.upsert({
    where: { email: 'joao@ariesnegocios.com.br' },
    update: {},
    create: {
      empresaId: empresa.id,
      nome: 'João Silva',
      email: 'joao@ariesnegocios.com.br',
      senhaHash: senhaVendedor,
      papel: 'VENDEDOR',
      status: 'ATIVO',
    },
  })

  const vendedor2 = await prisma.usuario.upsert({
    where: { email: 'ana@ariesnegocios.com.br' },
    update: {},
    create: {
      empresaId: empresa.id,
      nome: 'Ana Costa',
      email: 'ana@ariesnegocios.com.br',
      senhaHash: senhaVendedor,
      papel: 'VENDEDOR',
      status: 'ATIVO',
    },
  })

  console.log(`✓ Usuários: ${admin.nome}, ${gerente.nome}, ${vendedor1.nome}, ${vendedor2.nome}`)

  // Parâmetros de precificação (Pilar 9 — fonte única de verdade da empresa).
  // Valores de referência iguais aos usados no manual
  // docs/05-modules/commercial/cap-06-oferta-e-precificacao/ENGENHARIA-PRECIFICACAO-MOTOS-MM.md
  await prisma.parametroPrecificacao.upsert({
    where: { empresaId: empresa.id },
    update: {},
    create: { empresaId: empresa.id },
  })
  console.log('✓ Parâmetros de precificação (valores de referência do manual)')

  const diasAtras = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000)

  // Estoque de motos — inclui dados de compra/custos para o motor de precificação.
  // A "Honda CG 160 Titan" usa exatamente os valores da Moto-Modelo do manual
  // (compra R$ 9.500, custos diretos R$ 450, 44 dias em estoque) para conferência cruzada.
  const motos = [
    { nome: 'Honda CG 160 Titan', marca: 'Honda', modelo: 'CG 160 Titan', ano: 2024, cor: 'Vermelho', chassi: 'JHMSC59A5RN000001', precoBase: 14490,
      valorCompra: 9500, dataCompra: diasAtras(44), custoRevisao: 200, custoEstetica: 150, custoDocumentacao: 100 },
    { nome: 'Honda CG 160 Fan', marca: 'Honda', modelo: 'CG 160 Fan', ano: 2024, cor: 'Preto', chassi: 'JHMSC59A5RN000002', precoBase: 12990,
      valorCompra: 8200, dataCompra: diasAtras(10), custoRevisao: 180, custoEstetica: 90, custoDocumentacao: 90 },
    { nome: 'Honda Biz 125', marca: 'Honda', modelo: 'Biz 125', ano: 2024, cor: 'Azul', chassi: 'JHMSC59A5RN000003', precoBase: 10490,
      valorCompra: 6800, dataCompra: diasAtras(55), custoRevisao: 150, custoEstetica: 80, custoDocumentacao: 90 },
    { nome: 'Yamaha Factor 150', marca: 'Yamaha', modelo: 'Factor 150', ano: 2024, cor: 'Branco', chassi: 'JYARK07E1RA000001', precoBase: 13490,
      valorCompra: 8600, dataCompra: diasAtras(70), custoRevisao: 200, custoEstetica: 120, custoDocumentacao: 90, marketingInvestido: 150 },
    { nome: 'Yamaha Fazer 250', marca: 'Yamaha', modelo: 'Fazer 250', ano: 2023, cor: 'Cinza', chassi: 'JYARK07E1RA000002', precoBase: 22990,
      valorCompra: 15800, dataCompra: diasAtras(100), custoRevisao: 300, custoEstetica: 200, custoDocumentacao: 100, marketingInvestido: 400 },
    { nome: 'Honda XRE 300', marca: 'Honda', modelo: 'XRE 300', ano: 2024, cor: 'Verde', chassi: 'JHMSC59A5RN000004', precoBase: 29990,
      valorCompra: 21000, dataCompra: diasAtras(5), custoRevisao: 250, custoEstetica: 150, custoDocumentacao: 100 },
    { nome: 'Yamaha NMAX 160', marca: 'Yamaha', modelo: 'NMAX 160', ano: 2024, cor: 'Preto', chassi: 'JYARK07E1RA000003', precoBase: 18490,
      valorCompra: 12500, dataCompra: diasAtras(35), custoRevisao: 220, custoEstetica: 130, custoDocumentacao: 90 },
    { nome: 'Honda PCX 150', marca: 'Honda', modelo: 'PCX 150', ano: 2023, cor: 'Prata', chassi: 'JHMSC59A5RN000005', precoBase: 16990,
      situacao: 'VENDIDA', valorCompra: 11500, dataCompra: diasAtras(40), custoRevisao: 200, custoEstetica: 100, custoDocumentacao: 90 },
  ]

  const unidadesCriadas: { id: string }[] = []
  for (const moto of motos) {
    const { situacao, ...resto } = moto as typeof moto & { situacao?: string }
    const u = await prisma.unidade.upsert({
      where: { chassi: moto.chassi },
      update: {},
      create: {
        empresaId: empresa.id,
        categoria: 'MOTO',
        situacao: situacao ?? 'DISPONIVEL',
        km: 0,
        ...resto,
      },
    })
    unidadesCriadas.push(u)
  }
  console.log(`✓ Estoque: ${unidadesCriadas.length} motos (com dados de compra/custos para o motor de precificação)`)

  // Limpeza de metas antigas com id fixo ("meta-julho-2026") de uma versão
  // anterior do seed — ficavam presas no mês em que foram criadas pela
  // primeira vez porque o upsert nunca as atualizava.
  await prisma.meta.deleteMany({ where: { id: { in: ['meta-julho-2026', 'meta-julho-2026-receita'] } } })

  // Metas do mês corrente — id derivado do mês para que cada reseed em um mês
  // novo gere a meta certa, em vez de travar as datas no mês em que o seed
  // rodou pela primeira vez.
  const agora = new Date()
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
  const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0)
  const chaveMes = inicioMes.toISOString().slice(0, 7) // "2026-08"
  const nomeMes = inicioMes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  await prisma.meta.upsert({
    where: { id: `meta-quantidade-${chaveMes}` },
    update: {},
    create: {
      id: `meta-quantidade-${chaveMes}`,
      empresaId: empresa.id,
      titulo: `Meta ${nomeMes} — Quantidade`,
      tipo: 'QUANTIDADE',
      valor: 30,
      periodo: 'MENSAL',
      inicioEm: inicioMes,
      fimEm: fimMes,
      status: 'ATIVA',
    },
  })

  await prisma.meta.upsert({
    where: { id: `meta-faturamento-${chaveMes}` },
    update: {},
    create: {
      id: `meta-faturamento-${chaveMes}`,
      empresaId: empresa.id,
      titulo: `Meta ${nomeMes} — Faturamento`,
      tipo: 'FATURAMENTO',
      valor: 400000,
      periodo: 'MENSAL',
      inicioEm: inicioMes,
      fimEm: fimMes,
      status: 'ATIVA',
    },
  })
  const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
  const fimDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59)
  const diaSemana = agora.getDay() // 0 = domingo
  const inicioSemana = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - diaSemana)
  const fimSemana = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - diaSemana + 6, 23, 59, 59)
  const chaveDia = inicioDia.toISOString().slice(0, 10)
  const chaveSemana = inicioSemana.toISOString().slice(0, 10)

  await prisma.meta.upsert({
    where: { id: `meta-quantidade-dia-${chaveDia}` },
    update: {},
    create: {
      id: `meta-quantidade-dia-${chaveDia}`,
      empresaId: empresa.id,
      titulo: 'Meta do Dia — Vendas',
      tipo: 'QUANTIDADE',
      valor: 2,
      periodo: 'DIARIA',
      inicioEm: inicioDia,
      fimEm: fimDia,
      status: 'ATIVA',
    },
  })

  await prisma.meta.upsert({
    where: { id: `meta-quantidade-semana-${chaveSemana}` },
    update: {},
    create: {
      id: `meta-quantidade-semana-${chaveSemana}`,
      empresaId: empresa.id,
      titulo: 'Meta da Semana — Vendas',
      tipo: 'QUANTIDADE',
      valor: 8,
      periodo: 'SEMANAL',
      inicioEm: inicioSemana,
      fimEm: fimSemana,
      status: 'ATIVA',
    },
  })
  console.log(`✓ Metas mensais criadas`)

  // Oportunidades de exemplo — id fixo + upsert para que reexecuções do seed
  // (ex: reseed automático a cada deploy) não dupliquem os leads de demonstração.
  const ops = [
    { id: 'seed-op-pedro-alves', nomeCliente: 'Pedro Alves', telefone: '(85) 99999-1001', origem: 'INSTAGRAM', estagio: 'NAO_RESPONDEU', responsavelId: vendedor1.id, unidadeIdx: 0, valor: 14490 },
    { id: 'seed-op-maria-santos', nomeCliente: 'Maria Santos', telefone: '(85) 99999-1002', origem: 'INDICACAO', estagio: 'RESPONDEU', responsavelId: vendedor2.id, unidadeIdx: 3, valor: 13490 },
    { id: 'seed-op-lucas-oliveira', nomeCliente: 'Lucas Oliveira', telefone: '(85) 99999-1003', origem: 'WHATSAPP', estagio: 'SQL', responsavelId: vendedor1.id, unidadeIdx: 4, valor: 22990 },
    { id: 'seed-op-fernanda-lima', nomeCliente: 'Fernanda Lima', telefone: '(85) 99999-1004', origem: 'LOJA', estagio: 'MQL', responsavelId: vendedor2.id, unidadeIdx: 6, valor: 18490 },
    { id: 'seed-op-roberto-costa', nomeCliente: 'Roberto Costa', telefone: '(85) 99999-1005', origem: 'MANUAL', estagio: 'NOVO_LEAD', responsavelId: vendedor1.id, valor: undefined },
  ]

  for (const op of ops) {
    await prisma.oportunidade.upsert({
      where: { id: op.id },
      update: {},
      create: {
        id: op.id,
        empresaId: empresa.id,
        nomeCliente: op.nomeCliente,
        telefone: op.telefone,
        origem: op.origem,
        estagio: op.estagio,
        responsavelId: op.responsavelId,
        unidadeId: op.unidadeIdx !== undefined ? unidadesCriadas[op.unidadeIdx].id : undefined,
        valor: op.valor,
      },
    })
    // Backfill de EstagioHistorico — sem isso, "Funil & Conversão" não conta
    // esses leads de demonstração (a conversão real é calculada só a partir
    // do histórico de transição, não do estágio atual).
    await prisma.estagioHistorico.upsert({
      where: { id: `${op.id}-hist-novo-lead` },
      update: {},
      create: { id: `${op.id}-hist-novo-lead`, empresaId: empresa.id, oportunidadeId: op.id, estagioAnterior: null, estagioNovo: 'NOVO_LEAD' },
    })
    if (op.estagio !== 'NOVO_LEAD') {
      await prisma.estagioHistorico.upsert({
        where: { id: `${op.id}-hist-atual` },
        update: {},
        create: { id: `${op.id}-hist-atual`, empresaId: empresa.id, oportunidadeId: op.id, estagioAnterior: 'NOVO_LEAD', estagioNovo: op.estagio },
      })
    }
  }
  console.log(`✓ Oportunidades de exemplo: ${ops.length}`)

  // Venda fechada de exemplo — alimenta o Pilar 7 (Ranking de Vendedores) e os KPIs
  // de reconciliação planejado vs. real (Seção 11.5 do manual de precificação).
  // Id fixo + upsert pelo mesmo motivo acima.
  const opGanha = await prisma.oportunidade.upsert({
    where: { id: 'seed-op-juliana-rocha' },
    update: {},
    create: {
      id: 'seed-op-juliana-rocha',
      empresaId: empresa.id,
      nomeCliente: 'Juliana Rocha',
      telefone: '(85) 99999-1006',
      origem: 'LOJA',
      estagio: 'COMPRADO',
      statusFinal: 'COMPRADO',
      responsavelId: vendedor2.id,
      unidadeId: unidadesCriadas[7].id,
      valor: 16200,
      fechadaEm: diasAtras(10),
    },
  })
  await prisma.estagioHistorico.upsert({
    where: { id: `${opGanha.id}-hist-novo-lead` },
    update: {},
    create: { id: `${opGanha.id}-hist-novo-lead`, empresaId: empresa.id, oportunidadeId: opGanha.id, estagioAnterior: null, estagioNovo: 'NOVO_LEAD' },
  })
  await prisma.estagioHistorico.upsert({
    where: { id: `${opGanha.id}-hist-comprado` },
    update: {},
    create: { id: `${opGanha.id}-hist-comprado`, empresaId: empresa.id, oportunidadeId: opGanha.id, estagioAnterior: 'NOVO_LEAD', estagioNovo: 'COMPRADO' },
  })

  await prisma.contrato.upsert({
    where: { oportunidadeId: opGanha.id },
    update: {},
    create: {
      empresaId: empresa.id,
      oportunidadeId: opGanha.id,
      unidadeId: unidadesCriadas[7].id,
      vendedorId: vendedor2.id,
      nomeCliente: 'Juliana Rocha',
      valorTotal: 16200,
      entrada: 3000,
      parcelas: 12,
      criadoEm: diasAtras(10),
      contasReceber: {
        create: [{ empresaId: empresa.id, descricao: 'Entrada', valor: 3000, vencimento: diasAtras(10) }],
      },
    },
  })
  console.log('✓ Venda de exemplo registrada (Honda PCX 150 — alimenta ranking de vendedores e KPIs)')

  // Protocolos comerciais reais (id fixo + upsert com update:{} — não sobrescreve
  // edições feitas depois pela interface a cada reseed/redeploy).
  for (const p of PROTOCOLOS_SEED) {
    await prisma.protocolo.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        empresaId: empresa.id,
        categoria: p.categoria,
        nome: p.nome,
        ordem: p.ordem,
        objetivo: p.objetivo,
        resultadoEsperado: p.resultadoEsperado,
        responsaveis: p.responsaveis,
        processo: p.processo,
        pop: p.pop,
        regras: p.regras,
        ferramentas: p.ferramentas,
        rotina: p.rotina,
        sla: p.sla,
        kpis: p.kpis,
        auditoriaItens: p.auditoriaItens,
        frequenciaAuditoria: p.frequenciaAuditoria,
        criteriosConformidade: p.criteriosConformidade,
        naoConformidadesCatalogo: p.naoConformidadesCatalogo,
        reunioes: p.reunioes,
        perguntasAnalise: p.perguntasAnalise,
        riscos: p.riscos,
        planoContingencia: p.planoContingencia,
        revisaoFrequencia: p.revisaoFrequencia,
        revisaoResponsavel: p.revisaoResponsavel,
        oportunidadesMelhoriaNotas: p.oportunidadesMelhoriaNotas,
        anexos: p.anexos,
        criadoPorId: admin.id,
      },
    })
  }
  console.log(`✓ Protocolos comerciais: ${PROTOCOLOS_SEED.length}`)

  // Rotina e treinamento de demonstração — sem isso, Minha Rotina e
  // Treinamentos aparecem vazios no primeiro login.
  await prisma.rotina.upsert({
    where: { id: 'seed-rotina-vendedor' },
    update: {},
    create: {
      id: 'seed-rotina-vendedor',
      empresaId: empresa.id,
      nome: 'Rotina do Vendedor',
      papelAlvo: 'VENDEDOR',
      frequencia: 'DIARIA',
      criadoPorId: admin.id,
      blocos: [
        { titulo: 'BLOCO 01 — ABERTURA', itens: ['Conferir CRM', 'Conferir leads', 'Conferir follow-ups', 'Conferir agenda'] },
        { titulo: 'BLOCO 02 — PROSPECÇÃO', itens: ['Realizar contatos', 'Responder leads', 'Realizar follow-ups'] },
        { titulo: 'BLOCO 05 — ENCERRAMENTO', itens: ['Atualizar CRM', 'Registrar resultados'] },
      ],
    },
  })
  await prisma.treinamento.upsert({
    where: { id: 'seed-treinamento-crm' },
    update: {},
    create: {
      id: 'seed-treinamento-crm',
      empresaId: empresa.id,
      nome: 'Como usar o CRM da ARIES',
      categoria: 'Onboarding',
      papelAlvo: 'VENDEDOR',
      descricao: 'Passo a passo do funil, follow-up e registro de atividades.',
    },
  })
  console.log('✓ Rotina e treinamento de demonstração')

  console.log('\n✅ Seed concluído!')
  console.log('\n📋 Credenciais de acesso:')
  console.log('   Admin:    admin@ariesnegocios.com.br  / aries2026')
  console.log('   Gerente:  gerente@ariesnegocios.com.br / aries2026')
  console.log('   Vendedor: joao@ariesnegocios.com.br  / vendedor123')
  console.log('   Vendedor: ana@ariesnegocios.com.br   / vendedor123')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
