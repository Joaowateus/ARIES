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
            <li>Sobre a sua operação (leads, vendas, metas, estoque, atividades, conhecimento comercial, recomendações), o ARIES consulta a Central de Conhecimento na hora e não inventa números: se não encontrar, diz que não sabe e onde procurar.</li>
            <li>Cada resposta mostra de onde veio (fonte, tipo de dado, hora da última atualização e o link da tela) e avisa quando a fonte pode estar desatualizada.</li>
            <li>A IA nunca vê nem calcula valores em R$, custos, margens, CPF ou data de nascimento: ela escreve com espaços reservados e o sistema preenche os valores reais. O texto das conversas, as notas da negociação e as anotações não vão para a IA.</li>
            <li>Você só recebe o que já pode ver nas suas telas. O vendedor e o SDR veem só os próprios clientes e vendas; a equipe aparece só como média, sem nomes.</li>
            <li>Sobre qualquer outro assunto, responde como um chat e busca na internet quando precisa de algo atual, mostrando as fontes. Achou uma resposta errada? Marque: ela vai para o dono revisar.</li>
          </ul>
        </Detalhes>
      </div>
    </div>
  )
}
export default function PerguntePage() { return <Suspense fallback={null}><Conteudo /></Suspense> }
