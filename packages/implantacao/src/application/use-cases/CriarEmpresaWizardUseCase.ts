/**
 * CriarEmpresaWizardUseCase — ponto de entrada do Commercial OS para uma nova empresa.
 *
 * Cria a empresa + usuário admin em um único passo atômico.
 * Ao término, a empresa está em status CONFIGURANDO e o admin pode fazer login.
 *
 * North Star: resolve "como uma empresa começa a usar o sistema".
 */

import { Empresa, PorteEmpresa } from '../../domain/entities/Empresa'
import { Usuario } from '../../domain/entities/Usuario'
import { IEmpresaRepository, IUsuarioRepository } from '../ports/repositories'
import { IHashService } from '../../domain/services/HashService'

export interface CriarEmpresaWizardInput {
  empresa: {
    nome: string
    cnpj: string
    segmento: string
    porte: PorteEmpresa
  }
  admin: {
    nome: string
    email: string
    senha: string
  }
  agora: string
}

export interface CriarEmpresaWizardOutput {
  empresa: ReturnType<Empresa['toObject']>
  adminUsuario: Omit<ReturnType<Usuario['toObject']>, 'senhaHash'>
  jaExistia: boolean
}

export class CriarEmpresaWizardUseCase {
  constructor(
    private readonly empresaRepo: IEmpresaRepository,
    private readonly usuarioRepo: IUsuarioRepository,
    private readonly hashService: IHashService,
  ) {}

  async execute(input: CriarEmpresaWizardInput): Promise<CriarEmpresaWizardOutput> {
    const cnpjLimpo = input.empresa.cnpj.replace(/\D/g, '')
    const existente = await this.empresaRepo.findByCnpj(cnpjLimpo)
    if (existente) {
      const admins = await this.usuarioRepo.findByEmpresaEPapel(existente.id, 'ADMIN')
      const { senhaHash: _, ...adminSemSenha } = admins[0]?.toObject() ?? { senhaHash: '' } as any
      return { empresa: existente.toObject(), adminUsuario: adminSemSenha, jaExistia: true }
    }

    const empresa = Empresa.create({ ...input.empresa, agora: input.agora })
    await this.empresaRepo.save(empresa)

    const senhaHash = await this.hashService.hash(input.admin.senha)
    const admin = Usuario.create({
      empresaId: empresa.id,
      nome: input.admin.nome,
      email: input.admin.email,
      senhaHash,
      papel: 'ADMIN',
      agora: input.agora,
    })
    await this.usuarioRepo.save(admin)

    const { senhaHash: _, ...adminSemSenha } = admin.toObject()
    return { empresa: empresa.toObject(), adminUsuario: adminSemSenha, jaExistia: false }
  }
}
