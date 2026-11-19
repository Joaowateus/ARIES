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
            <li>Sobre a sua operação (leads, conversas, vendas, metas, estoque, atividades, recomendações), o ARIES consulta o sistema na hora e não inventa números: se não encontrar, diz que não encontrou.</li>
            <li>Sobre qualquer outro assunto, responde como um chat e busca na internet quando precisa de algo atual, mostrando as fontes.</li>
            <li>Você só recebe o que já pode ver nas suas telas. O vendedor e o SDR veem só os próprios clientes e vendas; a equipe aparece só como média, sem nomes.</li>
            <li>Quando o ARIES abre um CPF, a leitura fica registrada no controle de acesso a dados sensíveis.</li>
            <li>A conversa lembra as últimas perguntas, então dá para continuar o assunto.</li>
          </ul>
        </Detalhes>
      </div>
    </div>
  )
}
export default function PerguntePage() { return <Suspense fallback={null}><Conteudo /></Suspense> }
