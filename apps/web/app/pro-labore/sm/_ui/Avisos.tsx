'use client'

// Avisos "Pulso" (seção 11.5) dentro do espaço: o mesmo que vai para o
// celular, para quem está no computador ou não ativou o push. Tocar abre a
// tela certa e marca como lido.
import Link from 'next/link'
import type { SmAvisoPulso, SmAvisosLista, SmTipoAviso } from '@/lib/proLaboreApi'
import { Botao, Chip, EstadoVazio, type Tom } from './componentes'
import { IcAvisos } from './icones'
import { Modal } from './Modal'
import { haQuanto } from './Sidebar'

const TIPO: Record<SmTipoAviso, { rotulo: string; tom: Tom }> = {
  CLIENTE: { rotulo: 'Cliente esperando', tom: 'warn' },
  DECOLANDO: { rotulo: 'Post decolando', tom: 'ok' },
  VENDA: { rotulo: 'Venda', tom: 'ok' },
  APROVACAO: { rotulo: 'Aprovação', tom: 'info' },
  FALHA: { rotulo: 'Falha', tom: 'bad' },
}

export function PainelAvisos({ lista, somenteLeitura, preferencias, aoAbrirAviso, aoMarcarTodos, aoFechar }: {
  lista: SmAvisosLista | null
  somenteLeitura: boolean
  /** Link para ativar no celular (fora do "ver como"). */
  preferencias?: string
  aoAbrirAviso: (a: SmAvisoPulso) => void
  aoMarcarTodos: () => void
  aoFechar: () => void
}) {
  const avisos = lista?.avisos ?? []
  return (
    <Modal titulo="Avisos" aoFechar={aoFechar}>
      <div className="sm-avisos-topo">
        <span className="sm-legenda">{lista ? (lista.naoLidos ? `${lista.naoLidos} ${lista.naoLidos === 1 ? 'novo' : 'novos'} · últimos 14 dias` : 'Tudo lido · últimos 14 dias') : 'Carregando…'}</span>
        {!somenteLeitura && !!lista?.naoLidos && <Botao variante="fantasma" onClick={aoMarcarTodos}>Marcar todos como lidos</Botao>}
      </div>
      {lista && !avisos.length ? (
        <EstadoVazio titulo="Nenhum aviso por enquanto" icone={<IcAvisos tamanho={22} />}>
          Quando um post decolar na 1ª hora, uma venda for creditada a um post ou um cliente esperar além da meta, o aviso aparece aqui{preferencias ? ' e no celular' : ''}.
        </EstadoVazio>
      ) : (
        <ul className="sm-avisos-lista">
          {avisos.map(a => (
            <li key={a.id}>
              <button type="button" className={`sm-aviso${a.lido ? '' : ' novo'}`} onClick={() => aoAbrirAviso(a)}>
                <span className="sm-aviso-cab">
                  <Chip tom={TIPO[a.tipo]?.tom ?? 'neutro'}>{TIPO[a.tipo]?.rotulo ?? 'Aviso'}</Chip>
                  <span className="sm-aviso-quando">{haQuanto(a.criadoEm)}</span>
                  {!a.lido && <span className="sm-aviso-ponto" aria-label="não lido" />}
                </span>
                <b>{a.titulo}</b>
                <span>{a.texto}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="sm-legenda">
        No celular, o cliente esperando chega na hora. O resto vem junto, no máximo um aviso a cada 30 min.
        {preferencias && <> <Link href={preferencias} onClick={aoFechar} className="sm-link-botao">Ativar no celular</Link></>}
      </p>
    </Modal>
  )
}
