'use client'

// Fase 6 · "Usar do acervo" no briefing: os arquivos já enviados da moto da
// pauta (ou de todas as motos, se a pauta não tem moto) para reaproveitar.
import { useEffect, useState } from 'react'
import { proLaboreApi, type SmAcervo, type SmArquivoAcervo } from '@/lib/proLaboreApi'
import { CardEsqueleto, EstadoVazio, Modal } from '../../_ui'
import { GradeArquivos } from '../acervo/Arquivos'

export function UsarDoAcervo({ motoId, jaNaPauta, aoUsar, aoFechar }: {
  motoId: string | null
  jaNaPauta: string[]
  aoUsar: (a: SmArquivoAcervo) => void
  aoFechar: () => void
}) {
  const [acervo, setAcervo] = useState<SmAcervo | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    proLaboreApi.sm.acervo.ver(motoId ?? undefined).then(setAcervo).catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível carregar o acervo'))
  }, [motoId])
  const grupos = (acervo?.motos ?? []).map(g => ({ ...g, arquivos: g.arquivos.filter(a => !jaNaPauta.includes(a.url)) })).filter(g => g.arquivos.length)
  return (
    <Modal titulo="Usar do acervo" aoFechar={aoFechar}>
      {erro ? <p className="sm-erro" role="alert">{erro}</p> : !acervo ? <CardEsqueleto linhas={3} /> : !grupos.length ? (
        <EstadoVazio titulo={motoId ? 'Nada novo no acervo desta moto' : 'Acervo vazio'}>
          {motoId ? 'Os arquivos desta moto já estão na pauta, ou ainda não há fotos e vídeos dela.' : 'Os arquivos aparecem aqui quando as pautas com moto recebem fotos, vídeos ou tomadas.'}
        </EstadoVazio>
      ) : (
        <div className="sm-acervo-modal">
          {grupos.map(g => (
            <div key={g.moto.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <b>{g.moto.modelo}{g.moto.ano ? ` ${g.moto.ano}` : ''}</b>
              <GradeArquivos arquivos={g.arquivos} rotuloAcao="Usar nesta pauta" aoUsar={aoUsar} />
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
