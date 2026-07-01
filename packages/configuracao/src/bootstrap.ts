import { InMemoryCommercialPolicyRepository } from '@soe/cap-06'
import {
  InMemoryProdutoRepository,
  InMemoryMetaRepository,
  InMemoryMotivoPerdaCatalogoRepository,
  InMemorySegmentoRepository,
  InMemoryConfiguracaoAuditLog,
} from './infrastructure/repositories/InMemoryRepositories'
import { InMemoryConfiguracaoEventPublisher } from './infrastructure/events/InMemoryEventPublisher'
import { CriarProdutoUseCase } from './application/use-cases/CriarProdutoUseCase'
import { EditarProdutoUseCase } from './application/use-cases/EditarProdutoUseCase'
import { AlterarStatusProdutoUseCase } from './application/use-cases/AlterarStatusProdutoUseCase'
import { CriarMetaUseCase } from './application/use-cases/CriarMetaUseCase'
import { RevisarMetaUseCase } from './application/use-cases/RevisarMetaUseCase'
import { EncerrarMetaUseCase } from './application/use-cases/EncerrarMetaUseCase'
import { GerenciarMotivoPerdaUseCase } from './application/use-cases/GerenciarMotivoPerdaUseCase'
import { GerenciarSegmentoUseCase } from './application/use-cases/GerenciarSegmentoUseCase'
import { ConfigurarPoliticaComercialUseCase } from './application/use-cases/ConfigurarPoliticaComercialUseCase'

export function bootstrapConfiguracao() {
  const produtoRepo        = new InMemoryProdutoRepository()
  const metaRepo           = new InMemoryMetaRepository()
  const motivoRepo         = new InMemoryMotivoPerdaCatalogoRepository()
  const segmentoRepo       = new InMemorySegmentoRepository()
  const policyRepo         = new InMemoryCommercialPolicyRepository()
  const audit              = new InMemoryConfiguracaoAuditLog()
  const events             = new InMemoryConfiguracaoEventPublisher()

  return {
    repos: { produtoRepo, metaRepo, motivoRepo, segmentoRepo, policyRepo },
    audit,
    events,
    useCases: {
      criarProduto:       new CriarProdutoUseCase(produtoRepo, audit, events),
      editarProduto:      new EditarProdutoUseCase(produtoRepo, audit),
      alterarStatusProduto: new AlterarStatusProdutoUseCase(produtoRepo, audit, events),
      criarMeta:          new CriarMetaUseCase(metaRepo, audit, events),
      revisarMeta:        new RevisarMetaUseCase(metaRepo, audit, events),
      encerrarMeta:       new EncerrarMetaUseCase(metaRepo, audit),
      motivoPerda:        new GerenciarMotivoPerdaUseCase(motivoRepo, audit, events),
      segmento:           new GerenciarSegmentoUseCase(segmentoRepo, audit, events),
      configurarPolitica: new ConfigurarPoliticaComercialUseCase(policyRepo, segmentoRepo, audit, events),
    },
  }
}
