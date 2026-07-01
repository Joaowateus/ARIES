import { ActionPlan, Acao } from '../../domain/entities/ActionPlan'
import { DecisaoRecord } from '../../domain/entities/DecisaoRecord'
import { rn_d06_verificarHistorico } from '../../domain/rules/BusinessRules'
import { IDiagnosticoRepository, IActionPlanRepository, IDecisaoRecordRepository } from '../ports/repositories'

export interface AcaoInput {
  id: string
  descricao: string
  responsavelId: string
  prazoIso: string
  criterioSucesso: string
}

export interface CriarPlanoAcaoInput {
  diagnosticoId: string
  titulo: string
  acoes: AcaoInput[]
  criadoPor: string
  decisaoTomada: string
  resultadoEsperado: string
  agora: string
}

export interface CriarPlanoAcaoOutput {
  plano: ReturnType<ActionPlan['toObject']>
  decisaoRecord: ReturnType<DecisaoRecord['toObject']>
  historicoConsultado: { temHistorico: boolean; decisoesEfetivas: number; decisoesInefetivas: number }
}

export class CriarPlanoAcaoUseCase {
  constructor(
    private readonly diagnosticoRepo: IDiagnosticoRepository,
    private readonly planoRepo: IActionPlanRepository,
    private readonly decisaoRepo: IDecisaoRecordRepository,
  ) {}

  async execute(input: CriarPlanoAcaoInput): Promise<CriarPlanoAcaoOutput> {
    const diagnostico = await this.diagnosticoRepo.findById(input.diagnosticoId)
    if (!diagnostico) throw new Error(`Diagnóstico ${input.diagnosticoId} não encontrado`)

    const historico = await this.decisaoRepo.findByClassificacao(diagnostico.classificacao)
    const historicoConsultado = rn_d06_verificarHistorico(
      diagnostico.classificacao,
      historico.map(h => ({ classificacao: h.classificacao, resultado: h.resultado })),
    )

    const acoes: Acao[] = input.acoes.map(a => ({
      ...a,
      status: 'PENDENTE' as const,
    }))

    const plano = ActionPlan.create({
      diagnosticoId: input.diagnosticoId,
      titulo: input.titulo,
      acoes,
      criadoPor: input.criadoPor,
      agora: input.agora,
    })

    await this.planoRepo.save(plano)

    diagnostico.vincularPlano(plano.id, input.agora)
    await this.diagnosticoRepo.save(diagnostico)

    const decisaoRecord = DecisaoRecord.create({
      diagnosticoId: input.diagnosticoId,
      planoAcaoId: plano.id,
      classificacao: diagnostico.classificacao,
      periodo: diagnostico.periodo,
      decisaoTomada: input.decisaoTomada,
      resultadoEsperado: input.resultadoEsperado,
      registradoEm: input.agora,
    })

    await this.decisaoRepo.save(decisaoRecord)

    return {
      plano: plano.toObject(),
      decisaoRecord: decisaoRecord.toObject(),
      historicoConsultado,
    }
  }
}
