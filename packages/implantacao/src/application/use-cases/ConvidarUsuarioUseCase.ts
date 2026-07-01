/**
 * ConvidarUsuarioUseCase — ADMIN adiciona novos membros à empresa.
 *
 * Novo usuário inicia em PENDENTE_PRIMEIRO_ACESSO e deve alterar senha no primeiro login.
 * North Star: resolve "como o admin adiciona sua equipe ao sistema".
 */

import { Usuario, PapelUsuario } from '../../domain/entities/Usuario'
import { IUsuarioRepository } from '../ports/repositories'
import { IHashService } from '../../domain/services/HashService'

export interface ConvidarUsuarioInput {
  empresaId: string
  convidadoPorId: string
  nome: string
  email: string
  papel: PapelUsuario
  senhaTemporaria: string
  agora: string
}

export interface ConvidarUsuarioOutput {
  usuario: Omit<ReturnType<Usuario['toObject']>, 'senhaHash'>
  jaExistia: boolean
}

export class ConvidarUsuarioUseCase {
  constructor(
    private readonly usuarioRepo: IUsuarioRepository,
    private readonly hashService: IHashService,
  ) {}

  async execute(input: ConvidarUsuarioInput): Promise<ConvidarUsuarioOutput> {
    const existente = await this.usuarioRepo.findByEmail(input.email)
    if (existente) {
      const { senhaHash: _, ...semSenha } = existente.toObject()
      return { usuario: semSenha, jaExistia: true }
    }

    const senhaHash = await this.hashService.hash(input.senhaTemporaria)
    const usuario = Usuario.create({
      empresaId: input.empresaId,
      nome: input.nome,
      email: input.email,
      senhaHash,
      papel: input.papel,
      agora: input.agora,
    })

    await this.usuarioRepo.save(usuario)
    const { senhaHash: _, ...semSenha } = usuario.toObject()
    return { usuario: semSenha, jaExistia: false }
  }
}
