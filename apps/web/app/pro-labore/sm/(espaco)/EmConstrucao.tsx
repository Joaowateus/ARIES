'use client'

// Tela do espaço do Social Media que ainda não foi entregue. Mostra em qual
// fase da especificação ela chega, sem número inventado.
import { EstadoVazio, Rotulo } from '../_ui'
import { useEspacoSM } from './EspacoSM'

export function EmConstrucao({ secao, titulo, fase, descricao }: { secao: string; titulo: string; fase: string; descricao: string }) {
  const { eu } = useEspacoSM()
  return (
    <>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Rotulo>{secao}</Rotulo>
        <h1 className="sm-ttl sm-h1">{titulo}</h1>
      </header>
      <div className="sm-card">
        <EstadoVazio titulo={`Chega na ${fase}`}>
          {descricao}{eu.visao === 'GESTOR' ? ' O acesso e as permissões já valem.' : ''}
        </EstadoVazio>
      </div>
    </>
  )
}
