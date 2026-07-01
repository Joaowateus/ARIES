/**
 * AutenticarUseCase — valida credenciais e emite sessão de acesso.
 *
 * North Star: resolve "como um usuário faz o primeiro (e todos os) login".
 */

import { Sessao } from '../../domain/entities/Sessao'
import { IUsuarioRepository, ISessaoRepository } from '../ports/repositories'
import { IHashService } from '../../domain/services/HashService'

export interface AutenticarInput {
  email: string
  senha: string
  agora: string
  ttlMinutos?: number
}

export interface AutenticarOutput {
  sessao: {
    token: string
    empresaId: string
    usuarioId: string
    papel: string
    expiradaEm: string
  }
  primeiroAcesso: boolean
  nomeUsuario: string
}

export class AutenticarUseCase {
  constructor(
    private readonly usuarioRepo: IUsuarioRepository,
    private readonly sessaoRepo: ISessaoRepository,
    private readonly hashService: IHashService,
  ) {}

  async execute(input: AutenticarInput): Promise<AutenticarOutput> {
    const usuario = await this.usuarioRepo.findByEmail(input.email)
    if (!usuario) throw new Error('Credenciais inválidas')

    const senhaValida = await this.hashService.verify(input.senha, usuario.senhaHash)
    if (!senhaValida) throw new Error('Credenciais inválidas')

    if (usuario.status === 'INATIVO') throw new Error('Usuário inativo. Entre em contato com o administrador.')

    const sessao = Sessao.create({
      empresaId: usuario.empresaId,
      usuarioId: usuario.id,
      papel: usuario.papel,
      ttlMinutos: input.ttlMinutos,
      agora: input.agora,
    })

    await this.sessaoRepo.save(sessao)

    usuario.registrarLogin(input.agora)
    await this.usuarioRepo.save(usuario)

    return {
      sessao: {
        token: sessao.token,
        empresaId: sessao.empresaId,
        usuarioId: sessao.usuarioId,
        papel: sessao.papel,
        expiradaEm: sessao.expiradaEm,
      },
      primeiroAcesso: false,  // já foi registrado o login
      nomeUsuario: usuario.nome,
    }
  }
}
