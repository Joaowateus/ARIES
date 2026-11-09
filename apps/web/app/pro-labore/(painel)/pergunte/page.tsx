'use client'

// PDF 04 · Pergunte ao ARIES como aba: o chat da operação, com a Lente à direita.
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { abaPorChave } from '@/lib/abasAries'
import { Cabecalho, Detalhes } from '../_padrao/Padrao'
import { PergunteChat } from '../_padrao/PergunteChat'

function Conteudo() {
  const q = useSearchParams().get('q') ?? undefined
  const aba = abaPorChave('pergunte')!
  return (
    <div>
      <Cabecalho aba={aba} />
      <div style={{ maxWidth: 860 }}>
        <PergunteChat inicial={q} />
        <Detalhes titulo="Como o ARIES responde">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>A inteligência só entende a pergunta e escolhe as métricas do dicionário; quem calcula os números é o sistema.</li>
            <li>A inteligência nunca recebe valores em R$, CPF ou data de nascimento: ela escreve com espaços reservados e o sistema coloca os números.</li>
            <li>Você só recebe o que pode ver. O vendedor recebe dados da equipe só como média, sem nomes.</li>
            <li>Quando a pergunta sai do dicionário, o ARIES diz que não sabe e indica onde procurar.</li>
          </ul>
        </Detalhes>
      </div>
    </div>
  )
}
export default function PerguntePage() { return <Suspense fallback={null}><Conteudo /></Suspense> }
