import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

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

  // Estoque de motos
  const motos = [
    { nome: 'Honda CG 160 Titan', marca: 'Honda', modelo: 'CG 160 Titan', ano: 2024, cor: 'Vermelho', chassi: 'JHMSC59A5RN000001', precoBase: 14490 },
    { nome: 'Honda CG 160 Fan', marca: 'Honda', modelo: 'CG 160 Fan', ano: 2024, cor: 'Preto', chassi: 'JHMSC59A5RN000002', precoBase: 12990 },
    { nome: 'Honda Biz 125', marca: 'Honda', modelo: 'Biz 125', ano: 2024, cor: 'Azul', chassi: 'JHMSC59A5RN000003', precoBase: 10490 },
    { nome: 'Yamaha Factor 150', marca: 'Yamaha', modelo: 'Factor 150', ano: 2024, cor: 'Branco', chassi: 'JYARK07E1RA000001', precoBase: 13490 },
    { nome: 'Yamaha Fazer 250', marca: 'Yamaha', modelo: 'Fazer 250', ano: 2023, cor: 'Cinza', chassi: 'JYARK07E1RA000002', precoBase: 22990 },
    { nome: 'Honda XRE 300', marca: 'Honda', modelo: 'XRE 300', ano: 2024, cor: 'Verde', chassi: 'JHMSC59A5RN000004', precoBase: 29990 },
    { nome: 'Yamaha NMAX 160', marca: 'Yamaha', modelo: 'NMAX 160', ano: 2024, cor: 'Preto', chassi: 'JYARK07E1RA000003', precoBase: 18490 },
    { nome: 'Honda PCX 150', marca: 'Honda', modelo: 'PCX 150', ano: 2023, cor: 'Prata', chassi: 'JHMSC59A5RN000005', precoBase: 16990 },
  ]

  const unidadesCriadas: { id: string }[] = []
  for (const moto of motos) {
    const u = await prisma.unidade.upsert({
      where: { chassi: moto.chassi },
      update: {},
      create: {
        empresaId: empresa.id,
        categoria: 'MOTO',
        situacao: 'DISPONIVEL',
        km: 0,
        ...moto,
      },
    })
    unidadesCriadas.push(u)
  }
  console.log(`✓ Estoque: ${unidadesCriadas.length} motos`)

  // Meta mensal
  const agora = new Date()
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
  const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0)

  await prisma.meta.upsert({
    where: { id: 'meta-julho-2026' },
    update: {},
    create: {
      id: 'meta-julho-2026',
      empresaId: empresa.id,
      titulo: 'Meta Julho 2026 — Quantidade',
      tipo: 'QUANTIDADE',
      valor: 30,
      periodo: 'MENSAL',
      inicioEm: inicioMes,
      fimEm: fimMes,
      status: 'ATIVA',
    },
  })

  await prisma.meta.upsert({
    where: { id: 'meta-julho-2026-receita' },
    update: {},
    create: {
      id: 'meta-julho-2026-receita',
      empresaId: empresa.id,
      titulo: 'Meta Julho 2026 — Receita',
      tipo: 'RECEITA',
      valor: 400000,
      periodo: 'MENSAL',
      inicioEm: inicioMes,
      fimEm: fimMes,
      status: 'ATIVA',
    },
  })
  console.log(`✓ Metas mensais criadas`)

  // Oportunidades de exemplo
  const ops = [
    { nomeCliente: 'Pedro Alves', telefone: '(85) 99999-1001', origem: 'INSTAGRAM', estagio: 'CONTATO', responsavelId: vendedor1.id, unidadeIdx: 0, valor: 14490 },
    { nomeCliente: 'Maria Santos', telefone: '(85) 99999-1002', origem: 'INDICACAO', estagio: 'VISITA_AGENDADA', responsavelId: vendedor2.id, unidadeIdx: 3, valor: 13490 },
    { nomeCliente: 'Lucas Oliveira', telefone: '(85) 99999-1003', origem: 'WHATSAPP', estagio: 'PROPOSTA', responsavelId: vendedor1.id, unidadeIdx: 4, valor: 22990 },
    { nomeCliente: 'Fernanda Lima', telefone: '(85) 99999-1004', origem: 'LOJA', estagio: 'NEGOCIACAO', responsavelId: vendedor2.id, unidadeIdx: 6, valor: 18490 },
    { nomeCliente: 'Roberto Costa', telefone: '(85) 99999-1005', origem: 'MANUAL', estagio: 'NOVO_LEAD', responsavelId: vendedor1.id, valor: undefined },
  ]

  for (const op of ops) {
    await prisma.oportunidade.create({
      data: {
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
  }
  console.log(`✓ Oportunidades de exemplo: ${ops.length}`)

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
