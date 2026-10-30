'use client'

// Salvos: o banco de referências da equipe, em três etapas (Ideias → Para
// gravar → Feitos), com a anotação do que aproveitar e a pauta criada.
import type { SmReferenciaSalva, SmReferencias, SmStatusSalva } from '@/lib/proLaboreApi'
import { Botao, EstadoVazio, haQuanto } from '../../_ui'
import { FORMATO, Miniatura, gancho, num, quem } from './comum'

const COLUNAS: Array<{ status: SmStatusSalva; rotulo: string; dica: string }> = [
  { status: 'IDEIA', rotulo: 'Ideias', dica: 'Referências guardadas para usar' },
  { status: 'GRAVAR', rotulo: 'Para gravar', dica: 'Já viraram pauta ou estão na fila' },
  { status: 'FEITO', rotulo: 'Feitos', dica: 'Já gravados/publicados' },
]

export function Salvos({ dados, ocupado, aoAbrir, aoStatus, aoRemover, aoPauta }: {
  dados: SmReferencias
  ocupado: boolean
  aoAbrir: (s: SmReferenciaSalva) => void
  aoStatus: (s: SmReferenciaSalva, status: SmStatusSalva) => void
  aoRemover: (s: SmReferenciaSalva) => void
  aoPauta: (s: SmReferenciaSalva) => void
}) {
  if (!dados.salvos.length) return <EstadoVazio titulo="Nenhuma referência salva">Em Explorar, Por moto ou no raio-x de um perfil, toque em &quot;Salvar&quot; nos posts que valem copiar a ideia. Eles ficam aqui com a sua anotação e viram pauta na Produção.</EstadoVazio>
  return (
    <div className="sm-ref-salvos">
      {COLUNAS.map(c => {
        const lista = dados.salvos.filter(s => s.status === c.status)
        return (
          <section key={c.status} className="sm-ref-coluna" aria-label={c.rotulo} data-coluna-salvos={c.status}>
            <header><b>{c.rotulo}</b><span className="sm-chip contador">{lista.length}</span><small>{c.dica}</small></header>
            {lista.map(s => (
              <article key={s.id} className="sm-ref-salvo-card" data-salvo-ref={s.mediaId}>
                <button type="button" className="sm-ref-salvo-capa" onClick={() => aoAbrir(s)} aria-label={`Abrir referência de ${quem(s)}`}><Miniatura p={s} /></button>
                <div className="sm-ref-salvo-corpo">
                  <b>{gancho(s.legenda) || quem(s)}</b>
                  <span className="sm-legenda">{quem(s)}{s.formato ? ` · ${FORMATO[s.formato]}` : ''} · {num(s.engajamento)} engaj. · salvo {haQuanto(s.criadoEm)}</span>
                  {s.nota && <p className="sm-ref-nota-salva">{s.nota}</p>}
                  {dados.podeEditar && (
                    <div className="sm-ref-acoes">
                      {s.pautaId
                        ? <a className="sm-link-botao" href={`/pro-labore/sm/producao?pauta=${s.pautaId}`}>Abrir pauta</a>
                        : <button type="button" className="sm-link-botao" disabled={ocupado} onClick={() => aoPauta(s)} data-criar-pauta-salvo>Criar pauta</button>}
                      {COLUNAS.filter(o => o.status !== c.status).map(o => (
                        <button key={o.status} type="button" className="sm-link-botao" disabled={ocupado} onClick={() => aoStatus(s, o.status)} data-mover={o.status}>→ {o.rotulo}</button>
                      ))}
                      <Botao variante="fantasma" disabled={ocupado} onClick={() => aoRemover(s)} data-remover-salvo>Tirar</Botao>
                    </div>
                  )}
                </div>
              </article>
            ))}
            {!lista.length && <p className="sm-legenda sm-ref-coluna-vazia">Nada aqui.</p>}
          </section>
        )
      })}
    </div>
  )
}
