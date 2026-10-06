'use client'

import { EmConstrucao } from './EmConstrucao'
import { useEspacoSM } from './EspacoSM'

// Tela 01 · Hoje (seção 4). A versão completa chega na Fase 1d, depois da
// Produção e do Calendário, de onde ela tira os números.
export default function HojePage() {
  const { eu } = useEspacoSM()
  return (
    <EmConstrucao
      secao="Trabalho · Hoje"
      titulo={`Olá, ${eu.pessoa.tratamento ?? eu.pessoa.nome}.`}
      fase="Fase 1d"
      descricao="O cockpit do dia: posts de hoje, clientes esperando, metas da semana e as pautas sugeridas pelo estoque."
    />
  )
}
