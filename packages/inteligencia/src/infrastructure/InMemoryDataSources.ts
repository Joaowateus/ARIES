import { KpiSnapshotProps } from '@soe/cap-08'
import { DiagnosticoProps } from '@soe/cap-08'
import { ActionPlanProps } from '@soe/cap-08'
import { DecisaoRecordProps } from '@soe/cap-08'
import { AuditoriaEventoProps } from '@soe/cap-09'

import { AlertaView, AlertaFiltros } from '../view-models/AlertaView'
import { DiagnosticoView, DiagnosticoFiltros } from '../view-models/DiagnosticoView'
import { PlanoAcaoView, PlanoAcaoFiltros } from '../view-models/PlanoAcaoView'
import { DecisaoView, DecisaoFiltros } from '../view-models/DecisaoView'
import { AuditoriaView, AuditoriaFiltros } from '../view-models/AuditoriaView'

import {
  IAlertaDataSource,
  IDiagnosticoViewDataSource,
  IPlanoAcaoViewDataSource,
  IDecisaoViewDataSource,
  IAuditoriaViewDataSource,
} from '../application/ports/IDataSources'

// ─── helpers ────────────────────────────────────────────────────────────────

function moduloDeEntidade(entidadeTipo: string): string {
  const mapa: Record<string, string> = {
    Diagnostico: 'CAP-08',
    ActionPlan: 'CAP-08',
    DecisaoRecord: 'CAP-08',
    KpiSnapshot: 'CAP-08',
    ConfiguracaoSistema: 'CAP-09',
    RegraGovernanca: 'CAP-09',
    Empresa: 'Implantação',
    Usuario: 'Implantação',
    Sessao: 'Implantação',
  }
  return mapa[entidadeTipo] ?? entidadeTipo
}

// ─── InMemoryAlertaDataSource ────────────────────────────────────────────────

export class InMemoryAlertaDataSource implements IAlertaDataSource {
  snapshots: KpiSnapshotProps[] = []

  async findAlertas(filtros: AlertaFiltros): Promise<AlertaView[]> {
    return this.snapshots
      .filter(s => {
        if (!s.anomalia?.detectada) return false
        if (filtros.periodo && s.periodo !== filtros.periodo) return false
        if (filtros.dominio && s.dominio !== filtros.dominio) return false
        if (filtros.severidade && !filtros.severidade.includes(s.anomalia.severidade)) return false
        if (filtros.de && s.registradoEm < filtros.de) return false
        if (filtros.ate && s.registradoEm > filtros.ate) return false
        return true
      })
      .map(s => ({
        id: s.id,
        kpiNome: s.kpiNome,
        dominio: s.dominio,
        valor: s.valor,
        baseline: s.baseline!,
        desvioPercent: s.anomalia!.desvioPercent,
        direcao: s.anomalia!.direcao,
        severidade: s.anomalia!.severidade,
        periodo: s.periodo,
        registradoEm: s.registradoEm,
      }))
  }
}

// ─── InMemoryDiagnosticoViewDataSource ──────────────────────────────────────

export class InMemoryDiagnosticoViewDataSource implements IDiagnosticoViewDataSource {
  diagnosticos: DiagnosticoProps[] = []

  private toView(d: DiagnosticoProps, prioridade: number): DiagnosticoView {
    const hipoteses = [...d.hipoteses].sort((a, b) => b.confianca - a.confianca)
    return {
      id: d.id,
      periodo: d.periodo,
      classificacao: d.classificacao,
      kpisAfetados: [...d.kpisAfetados],
      hipotesePrincipal: hipoteses[0],
      impactoFinanceiroEstimado: d.impactoFinanceiroEstimado,
      mupScore: { ...d.mupScore },
      prioridade,
      status: d.status,
      planoAcaoId: d.planoAcaoId,
      geradoEm: d.geradoEm,
      resolvidoEm: d.resolvidoEm,
    }
  }

  async findDiagnosticos(filtros: DiagnosticoFiltros): Promise<DiagnosticoView[]> {
    const filtered = this.diagnosticos.filter(d => {
      if (filtros.status && !filtros.status.includes(d.status)) return false
      if (filtros.classificacao && d.classificacao !== filtros.classificacao) return false
      if (filtros.periodo && d.periodo !== filtros.periodo) return false
      return true
    })
    const sorted = [...filtered].sort((a, b) => b.mupScore.total - a.mupScore.total)
    return sorted.map((d, i) => this.toView(d, i + 1))
  }

  async findById(id: string): Promise<DiagnosticoView | undefined> {
    const d = this.diagnosticos.find(d => d.id === id)
    if (!d) return undefined
    const allSorted = [...this.diagnosticos].sort((a, b) => b.mupScore.total - a.mupScore.total)
    const rank = allSorted.findIndex(x => x.id === id) + 1
    return this.toView(d, rank)
  }
}

// ─── InMemoryPlanoAcaoViewDataSource ────────────────────────────────────────

export class InMemoryPlanoAcaoViewDataSource implements IPlanoAcaoViewDataSource {
  planos: ActionPlanProps[] = []

  private toView(p: ActionPlanProps): PlanoAcaoView {
    const acoes = p.acoes.map(a => ({ ...a }))
    const concluidas = acoes.filter(a => a.status === 'CONCLUIDA').length
    const percentualConcluido = Math.round(concluidas / acoes.length * 100)
    const pendentes = acoes.filter(a => a.status === 'PENDENTE').sort((a, b) => a.prazoIso.localeCompare(b.prazoIso))
    return {
      id: p.id,
      diagnosticoId: p.diagnosticoId,
      titulo: p.titulo,
      status: p.status,
      criadoPor: p.criadoPor,
      acoes,
      percentualConcluido,
      prazoProximaAcao: pendentes[0]?.prazoIso,
      criadoEm: p.criadoEm,
      concluidoEm: p.concluidoEm,
    }
  }

  async findPlanos(filtros: PlanoAcaoFiltros): Promise<PlanoAcaoView[]> {
    return this.planos
      .filter(p => {
        if (filtros.status && !filtros.status.includes(p.status)) return false
        if (filtros.diagnosticoId && p.diagnosticoId !== filtros.diagnosticoId) return false
        return true
      })
      .map(p => this.toView(p))
  }

  async findByDiagnostico(diagnosticoId: string): Promise<PlanoAcaoView | undefined> {
    const p = this.planos.find(p => p.diagnosticoId === diagnosticoId)
    return p ? this.toView(p) : undefined
  }
}

// ─── InMemoryDecisaoViewDataSource ──────────────────────────────────────────

export class InMemoryDecisaoViewDataSource implements IDecisaoViewDataSource {
  decisoes: DecisaoRecordProps[] = []

  private toView(d: DecisaoRecordProps): DecisaoView {
    return {
      ...d,
      aprendizado: d.aprendizado ? { ...d.aprendizado } : undefined,
      estaFechada: !!d.fechadoEm,
      foiEfetiva: d.resultado === 'EFETIVO',
    }
  }

  async findDecisoes(filtros: DecisaoFiltros): Promise<DecisaoView[]> {
    return this.decisoes
      .filter(d => {
        if (filtros.classificacao && d.classificacao !== filtros.classificacao) return false
        if (filtros.periodo && d.periodo !== filtros.periodo) return false
        if (filtros.resultado && d.resultado !== filtros.resultado) return false
        if (filtros.apenasAbertas && d.fechadoEm) return false
        return true
      })
      .map(d => this.toView(d))
  }

  async findByDiagnostico(diagnosticoId: string): Promise<DecisaoView | undefined> {
    const d = this.decisoes.find(d => d.diagnosticoId === diagnosticoId)
    return d ? this.toView(d) : undefined
  }
}

// ─── InMemoryAuditoriaViewDataSource ────────────────────────────────────────

export class InMemoryAuditoriaViewDataSource implements IAuditoriaViewDataSource {
  eventos: AuditoriaEventoProps[] = []

  async findEventos(filtros: AuditoriaFiltros): Promise<AuditoriaView[]> {
    return this.eventos
      .filter(e => {
        if (filtros.realizadoPor && e.realizadoPor !== filtros.realizadoPor) return false
        if (filtros.categoria && e.categoria !== filtros.categoria) return false
        if (filtros.entidadeTipo && e.entidadeTipo !== filtros.entidadeTipo) return false
        if (filtros.de && e.ocorridoEm < filtros.de) return false
        if (filtros.ate && e.ocorridoEm > filtros.ate) return false
        return true
      })
      .map(e => ({
        id: e.id,
        modulo: moduloDeEntidade(e.entidadeTipo),
        categoria: e.categoria,
        acao: e.acao,
        entidadeTipo: e.entidadeTipo,
        entidadeId: e.entidadeId,
        realizadoPor: e.realizadoPor,
        payload: { ...e.payload },
        ocorridoEm: e.ocorridoEm,
      }))
  }
}
