import { InMemoryUsuarioAdminRepository, InMemoryTimeRepository, InMemoryFilialRepository, InMemoryAuditLog } from './infrastructure/repositories/InMemoryRepositories'
import { InMemoryEventPublisher } from './infrastructure/events/InMemoryEventPublisher'
import { ConvidarUsuarioUseCase } from './application/use-cases/ConvidarUsuarioUseCase'
import { AtivarUsuarioUseCase } from './application/use-cases/AtivarUsuarioUseCase'
import { DesativarUsuarioUseCase } from './application/use-cases/DesativarUsuarioUseCase'
import { AlterarPapelUseCase } from './application/use-cases/AlterarPapelUseCase'
import { AlterarEquipeUseCase } from './application/use-cases/AlterarEquipeUseCase'
import { AlterarFilialUseCase } from './application/use-cases/AlterarFilialUseCase'
import { ConsultarUsuariosUseCase } from './application/use-cases/ConsultarUsuariosUseCase'
import { CriarTimeUseCase } from './application/use-cases/CriarTimeUseCase'
import { EditarTimeUseCase } from './application/use-cases/EditarTimeUseCase'
import { DesativarTimeUseCase } from './application/use-cases/DesativarTimeUseCase'
import { CriarFilialUseCase } from './application/use-cases/CriarFilialUseCase'
import { EditarFilialUseCase } from './application/use-cases/EditarFilialUseCase'
import { DesativarFilialUseCase } from './application/use-cases/DesativarFilialUseCase'
import { VerificarPermissaoUseCase } from './application/use-cases/VerificarPermissaoUseCase'

export function bootstrapAdministracao() {
  const usuarioRepo = new InMemoryUsuarioAdminRepository()
  const timeRepo = new InMemoryTimeRepository()
  const filialRepo = new InMemoryFilialRepository()
  const audit = new InMemoryAuditLog()
  const events = new InMemoryEventPublisher()

  return {
    repos: { usuarioRepo, timeRepo, filialRepo },
    audit,
    events,
    useCases: {
      convidarUsuario: new ConvidarUsuarioUseCase(usuarioRepo, audit, events),
      ativarUsuario: new AtivarUsuarioUseCase(usuarioRepo, audit, events),
      desativarUsuario: new DesativarUsuarioUseCase(usuarioRepo, audit, events),
      alterarPapel: new AlterarPapelUseCase(usuarioRepo, audit, events),
      alterarEquipe: new AlterarEquipeUseCase(usuarioRepo, timeRepo, audit),
      alterarFilial: new AlterarFilialUseCase(usuarioRepo, filialRepo, audit),
      consultarUsuarios: new ConsultarUsuariosUseCase(usuarioRepo),
      criarTime: new CriarTimeUseCase(timeRepo, audit, events),
      editarTime: new EditarTimeUseCase(timeRepo, usuarioRepo, audit),
      desativarTime: new DesativarTimeUseCase(timeRepo, audit),
      criarFilial: new CriarFilialUseCase(filialRepo, audit, events),
      editarFilial: new EditarFilialUseCase(filialRepo, timeRepo, audit),
      desativarFilial: new DesativarFilialUseCase(filialRepo, audit),
      verificarPermissao: new VerificarPermissaoUseCase(usuarioRepo),
    },
  }
}
