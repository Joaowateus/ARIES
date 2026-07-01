import { InMemoryEmpresaRepository } from './infrastructure/repositories/InMemoryEmpresaRepository'
import { InMemoryUsuarioRepository } from './infrastructure/repositories/InMemoryUsuarioRepository'
import { InMemorySessaoRepository } from './infrastructure/repositories/InMemorySessaoRepository'
import { InMemoryHashService } from './infrastructure/hash/InMemoryHashService'
import { CriarEmpresaWizardUseCase } from './application/use-cases/CriarEmpresaWizardUseCase'
import { AutenticarUseCase } from './application/use-cases/AutenticarUseCase'
import { ConvidarUsuarioUseCase } from './application/use-cases/ConvidarUsuarioUseCase'
import { ConcluirConfiguracaoInicialUseCase } from './application/use-cases/ConcluirConfiguracaoInicialUseCase'

export function bootstrapImplantacao() {
  const empresaRepo = new InMemoryEmpresaRepository()
  const usuarioRepo = new InMemoryUsuarioRepository()
  const sessaoRepo = new InMemorySessaoRepository()
  const hashService = new InMemoryHashService()

  return {
    repos: { empresaRepo, usuarioRepo, sessaoRepo },
    services: { hashService },
    useCases: {
      criarEmpresaWizard: new CriarEmpresaWizardUseCase(empresaRepo, usuarioRepo, hashService),
      autenticar: new AutenticarUseCase(usuarioRepo, sessaoRepo, hashService),
      convidarUsuario: new ConvidarUsuarioUseCase(usuarioRepo, hashService),
      concluirConfiguracaoInicial: new ConcluirConfiguracaoInicialUseCase(empresaRepo, usuarioRepo),
    },
  }
}
