import { IcpDefinition } from '../../domain/entities/IcpDefinition'
import { WinLossAnalysis } from '../../domain/entities/WinLossAnalysis'
import { MarketSegment } from '../../domain/entities/MarketSegment'
import { Competitor } from '../../domain/entities/Competitor'
import { MarketSignal } from '../../domain/entities/MarketSignal'

export interface IIcpRepository {
  save(icp: IcpDefinition): Promise<void>
  findById(id: string): Promise<IcpDefinition | null>
  findActive(): Promise<IcpDefinition | null>
  findAll(): Promise<IcpDefinition[]>
}

export interface IWinLossRepository {
  save(analysis: WinLossAnalysis): Promise<void>
  findById(id: string): Promise<WinLossAnalysis | null>
  findByOportunidade(oportunidadeId: string): Promise<WinLossAnalysis | null>
  findPendentes(): Promise<WinLossAnalysis[]>
  findAll(): Promise<WinLossAnalysis[]>
}

export interface ISegmentRepository {
  save(segment: MarketSegment): Promise<void>
  findById(id: string): Promise<MarketSegment | null>
  findAtivos(): Promise<MarketSegment[]>
  findAll(): Promise<MarketSegment[]>
}

export interface ICompetitorRepository {
  save(competitor: Competitor): Promise<void>
  findById(id: string): Promise<Competitor | null>
  findAtivos(): Promise<Competitor[]>
  findAll(): Promise<Competitor[]>
}

export interface ISignalRepository {
  save(signal: MarketSignal): Promise<void>
  findById(id: string): Promise<MarketSignal | null>
  findNaoProcessados(): Promise<MarketSignal[]>
  findAll(): Promise<MarketSignal[]>
}
