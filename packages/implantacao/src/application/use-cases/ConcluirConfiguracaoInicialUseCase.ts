/**
 * ConcluirConfiguracaoInicialUseCase — finaliza o wizard e ativa a empresa.
 *
 * Valida que a empresa tem ao menos 1 admin ativo antes de ativar.
 * North Star: resolve "como a empresa passa de CONFIGURANDO para ATIVA".
 */

import { IEmpresaRepository, IUsuarioRepository } from '../ports/repositories'

export interface ConcluirConfiguracaoInicialOutput {
  empresaId: string
  status: string
  totalUsuarios: number
}

export class ConcluirConfiguracaoInicialUseCase {
  constructor(
    private readonly empresaRepo: IEmpresaRepository,
    private readonly usuarioRepo: IUsuarioRepository,
  ) {}

  async execute(empresaId: string, agora: string): Promise<ConcluirConfiguracaoInicialOutput> {
    const empresa = await this.empresaRepo.findById(empresaId)
    if (!empresa) throw new Error(`Empresa ${empresaId} não encontrada`)

    const admins = await this.usuarioRepo.findByEmpresaEPapel(empresaId, 'ADMIN')
    if (admins.length === 0) throw new Error('Empresa deve ter ao menos um usuário ADMIN para ser ativada')

    const todos = await this.usuarioRepo.findByEmpresa(empresaId)

    empresa.concluirConfiguracao(agora)
    await this.empresaRepo.save(empresa)

    return {
      empresaId: empresa.id,
      status: empresa.status,
      totalUsuarios: todos.length,
    }
  }
}
