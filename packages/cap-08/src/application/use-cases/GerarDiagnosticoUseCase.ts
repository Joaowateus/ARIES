import { Diagnostico, calcularMupTotal } from '../../domain/entities/Diagnostico'
import { KpiSnapshot, KpiNome } from '../../domain/entities/KpiSnapshot'
import { rn_d01_kpiObrigatorio, rn_d02_anomaliaDetectada, rn_d_classificarAnomalia, rn_d_gerarHipoteses } from '../../domain/rules/BusinessRules'
import { IKpiSnapshotRepository, IDiagnosticoRepository } from '../ports/repositories'

export interface GerarDiagnosticoInput {
  periodo: string
  agora: string
  impactoFinanceiroEstimado: number
  mupScore: {
    impacto: number
    urgencia: number
    esforco: number
    bloqueadores: number
  }
}

export interface GerarDiagnosticoOutput {
  diagnostico: ReturnType<Diagnostico['toObject']>
  kpisAfetados: KpiNome[]
  hipotesePrincipal: string
}

export class GerarDiagnosticoUseCase {
  constructor(
    private readonly kpiRepo: IKpiSnapshotRepository,
    private readonly diagnosticoRepo: IDiagnosticoRepository,
  ) {}

  async execute(input: GerarDiagnosticoInput): Promise<GerarDiagnosticoOutput> {
    const snapshots = await this.kpiRepo.findByPeriodo(input.periodo)
    rn_d01_kpiObrigatorio(snapshots)
    rn_d02_anomaliaDetectada(snapshots)

    const snapshotsComAnomalia = snapshots.filter(s => s.possuiAnomalia())
    const kpisAfetados = snapshotsComAnomalia.map(s => s.kpiNome)

    const classificacao = rn_d_classificarAnomalia(kpisAfetados)
    const hipoteses = rn_d_gerarHipoteses(classificacao, kpisAfetados)

    const diagnostico = Diagnostico.create({
      periodo: input.periodo,
      kpisAfetados,
      classificacao,
      hipoteses,
      impactoFinanceiroEstimado: input.impactoFinanceiroEstimado,
      mupScore: {
        ...input.mupScore,
        total: calcularMupTotal(input.mupScore),
      },
      agora: input.agora,
    })

    await this.diagnosticoRepo.save(diagnostico)

    return {
      diagnostico: diagnostico.toObject(),
      kpisAfetados,
      hipotesePrincipal: diagnostico.hipotesePrincipal().descricao,
    }
  }
}
