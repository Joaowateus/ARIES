import {
  InMemoryPipelineDataSource,
  InMemoryPropostaDataSource,
  InMemoryReceitaClienteDataSource,
  InMemoryEquipeDataSource,
  InMemoryDiagnosticoDataSource,
} from './infrastructure/data-sources/InMemoryDataSources'
import { DashboardExecutivoUseCase } from './application/use-cases/DashboardExecutivoUseCase'
import { DashboardComercialUseCase } from './application/use-cases/DashboardComercialUseCase'
import { DashboardGestorUseCase } from './application/use-cases/DashboardGestorUseCase'
import { DashboardSDRUseCase } from './application/use-cases/DashboardSDRUseCase'
import { DashboardVendedorUseCase } from './application/use-cases/DashboardVendedorUseCase'

export function bootstrapDashboards() {
  const pipeline = new InMemoryPipelineDataSource()
  const proposta = new InMemoryPropostaDataSource()
  const receitaCliente = new InMemoryReceitaClienteDataSource()
  const equipe = new InMemoryEquipeDataSource()
  const diagnostico = new InMemoryDiagnosticoDataSource()

  return {
    dataSources: { pipeline, proposta, receitaCliente, equipe, diagnostico },
    dashboards: {
      executivo: new DashboardExecutivoUseCase(pipeline, receitaCliente, equipe, diagnostico),
      comercial: new DashboardComercialUseCase(pipeline, proposta, equipe),
      gestor: new DashboardGestorUseCase(equipe),
      sdr: new DashboardSDRUseCase(pipeline),
      vendedor: new DashboardVendedorUseCase(pipeline, proposta, equipe),
    },
  }
}
