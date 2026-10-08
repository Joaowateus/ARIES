'use client'

// Fase 6 · Acervo de mídia por moto: a grade de arquivos de uma moto (fotos,
// vídeos, tomadas da captura e capas), usada na tela Acervo e no "Usar do
// acervo" do briefing.
import { urlArquivoApi, type SmArquivoAcervo } from '@/lib/proLaboreApi'
import { Botao } from '../../_ui'

const ROTULO: Record<SmArquivoAcervo['tipo'], string> = { IMAGEM: 'Foto', CAPA: 'Capa', VIDEO: 'Vídeo', TOMADA: 'Tomada' }
const urlDoArquivo = (url: string) => (/^https?:/.test(url) ? url : urlArquivoApi(url))

export function GradeArquivos({ arquivos, rotuloAcao, aoUsar, ocupado }: {
  arquivos: SmArquivoAcervo[]
  rotuloAcao?: string
  aoUsar?: (a: SmArquivoAcervo) => void
  ocupado?: boolean
}) {
  return (
    <ul className="sm-acervo-grade">
      {arquivos.map(a => {
        const foto = a.tipo === 'IMAGEM' || a.tipo === 'CAPA'
        const origem = a.pautas[0]
        return (
          <li key={a.id} className="sm-acervo-item">
            <a className="sm-acervo-miniatura" href={urlDoArquivo(a.url)} target="_blank" rel="noreferrer" aria-label={`Abrir ${ROTULO[a.tipo].toLowerCase()}${a.tomada ? ` ${a.tomada}` : ''} de “${origem?.titulo ?? 'pauta'}”`}>
              {foto
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={urlDoArquivo(a.url)} alt="" loading="lazy" />
                : <span className="sm-acervo-video" aria-hidden="true">▶</span>}
              <span className="sm-acervo-tipo">{ROTULO[a.tipo]}{a.tomada ? ` ${a.tomada}` : ''}</span>
            </a>
            <span className="sm-legenda sm-acervo-origem" title={a.pautas.map(p => p.titulo).join(' · ')}>
              {origem ? origem.titulo : 'Pauta'}{a.pautas.length > 1 ? ` e mais ${a.pautas.length - 1}` : ''}
            </span>
            {aoUsar && <Botao variante="fantasma" disabled={ocupado} onClick={() => aoUsar(a)}>{rotuloAcao ?? 'Usar'}</Botao>}
          </li>
        )
      })}
    </ul>
  )
}
