/**
 * DecisaoRecord — registro histórico de decisão para a Engine de Aprendizado.
 *
 * Responde: esse problema já aconteceu? O que foi feito? Funcionou?
 * RN-D05: toda decisão operacional deve ser registrada com resultado.
 * RN-D06: sistema deve consultar histórico antes de criar novo plano.
 */

import { v4 as uuidv4 } from 'uuid'
import { ClassificacaoDiagnostico } from './Diagnostico'

export type ResultadoDecisao = 'EFETIVO' | 'PARCIAL' | 'INEFETIVO'

export interface AprendizadoGerado {
  insight: string                          // o que aprendemos
  recomendacao: string                     // o que fazer da próxima vez
  alterarPlaybook: boolean                 // deve atualizar regra no sistema?
  alteracaoSugerida?: string              // qual alteração sugerir
}

export interface DecisaoRecordProps {
  id: string
  diagnosticoId: string
  planoAcaoId: string
  classificacao: ClassificacaoDiagnostico
  periodo: string
  decisaoTomada: string                   // descrição da decisão
  resultadoEsperado: string
  resultadoReal?: string                  // preenchido após execução
  resultado?: ResultadoDecisao
  aprendizado?: AprendizadoGerado
  registradoEm: string
  fechadoEm?: string
}

export class DecisaoRecord {
  private constructor(private props: DecisaoRecordProps) {}

  static create(params: Omit<DecisaoRecordProps, 'id' | 'resultadoReal' | 'resultado' | 'aprendizado' | 'fechadoEm'>): DecisaoRecord {
    if (!params.decisaoTomada?.trim()) throw new Error('DecisaoRecord: decisaoTomada obrigatória (RN-D05)')
    if (!params.resultadoEsperado?.trim()) throw new Error('DecisaoRecord: resultadoEsperado obrigatório (RN-D05)')
    return new DecisaoRecord({ ...params, id: uuidv4() })
  }

  static reconstitute(props: DecisaoRecordProps): DecisaoRecord {
    return new DecisaoRecord(props)
  }

  get id(): string { return this.props.id }
  get diagnosticoId(): string { return this.props.diagnosticoId }
  get planoAcaoId(): string { return this.props.planoAcaoId }
  get classificacao(): ClassificacaoDiagnostico { return this.props.classificacao }
  get periodo(): string { return this.props.periodo }
  get decisaoTomada(): string { return this.props.decisaoTomada }
  get resultadoEsperado(): string { return this.props.resultadoEsperado }
  get resultadoReal(): string | undefined { return this.props.resultadoReal }
  get resultado(): ResultadoDecisao | undefined { return this.props.resultado }
  get aprendizado(): AprendizadoGerado | undefined { return this.props.aprendizado }
  get registradoEm(): string { return this.props.registradoEm }
  get fechadoEm(): string | undefined { return this.props.fechadoEm }

  /** RN-D05: registrar resultado e gerar aprendizado. */
  registrarResultado(
    resultadoReal: string,
    resultado: ResultadoDecisao,
    aprendizado: AprendizadoGerado,
    agora: string,
  ): void {
    if (this.props.resultado) throw new Error('DecisaoRecord: resultado já registrado')
    this.props.resultadoReal = resultadoReal
    this.props.resultado = resultado
    this.props.aprendizado = aprendizado
    this.props.fechadoEm = agora
  }

  foiEfetivo(): boolean { return this.props.resultado === 'EFETIVO' }
  estaFechado(): boolean { return !!this.props.fechadoEm }

  toObject(): DecisaoRecordProps {
    return {
      ...this.props,
      aprendizado: this.props.aprendizado ? { ...this.props.aprendizado } : undefined,
    }
  }
}
