// Política de Privacidade pública: a Meta pede este endereço para publicar
// os apps usados pelo Tráfego e pelo Instagram (Configurações do app → Básico).
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Política de Privacidade — ARIES', description: 'Como o ARIES — Sistema Comercial trata os dados das contas conectadas.' }

const ATUALIZADA = '13 de outubro de 2026'

export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 leading-relaxed">
      <p className="text-sm uppercase tracking-wide text-gray-500">ARIES — Sistema Comercial</p>
      <h1 className="mt-1 text-3xl font-bold">Política de Privacidade</h1>
      <p className="mt-2 text-sm text-gray-500">Atualizada em {ATUALIZADA}</p>

      <Secao titulo="1. Quem somos">
        O ARIES é um sistema de gestão comercial usado internamente pela empresa que o contrata para acompanhar vendas,
        atendimento, redes sociais e anúncios. Esta política explica quais dados o sistema acessa quando a empresa conecta
        as contas dela da Meta (Facebook, Instagram e Gerenciador de Anúncios) e como esses dados são usados.
      </Secao>

      <Secao titulo="2. Dados que acessamos">
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Anúncios (API de Marketing):</b> nome e estrutura das campanhas, conjuntos e anúncios; métricas de desempenho (alcance, impressões, cliques, gasto, conversas e leads) e dados agregados de público (faixa etária, gênero, região, posicionamento). Não acessamos dados que identifiquem pessoas individualmente.</li>
          <li><b>Instagram da empresa:</b> perfil, publicações, métricas das publicações e da conta, comentários e mensagens diretas recebidas pela conta da empresa, para que a equipe responda os clientes.</li>
          <li><b>Login:</b> o identificador e o nome de quem autorizou a conexão, e os tokens de acesso concedidos.</li>
        </ul>
      </Secao>

      <Secao titulo="3. Como usamos">
        Os dados são usados só para mostrar relatórios e indicadores à própria empresa, organizar o atendimento dos clientes
        que entram em contato e registrar oportunidades de venda no CRM da empresa. Não vendemos, não alugamos e não
        compartilhamos esses dados com terceiros para publicidade.
      </Secao>

      <Secao titulo="4. Armazenamento e segurança">
        Os dados ficam em servidores com acesso restrito e conexões criptografadas. Os tokens de acesso são guardados de forma
        protegida e usados só pelo sistema. Cada pessoa da equipe vê apenas o que o responsável da empresa liberou para ela.
      </Secao>

      <Secao titulo="5. Por quanto tempo guardamos">
        Guardamos os dados enquanto a conta estiver conectada e a empresa usar o sistema. Ao desconectar a conta, o sistema para
        de buscar dados novos; a exclusão do que já foi guardado pode ser pedida a qualquer momento (veja o item 6).
      </Secao>

      <Secao titulo="6. Seus direitos e exclusão de dados">
        Você pode pedir acesso, correção ou exclusão dos dados, conforme a Lei Geral de Proteção de Dados (LGPD). O passo a passo
        está em <Link className="text-blue-700 underline" href="/exclusao-de-dados">Exclusão de dados</Link>. Também é possível
        remover o acesso do app a qualquer momento nas configurações do Facebook, em Configurações e privacidade → Integrações comerciais.
      </Secao>

      <Secao titulo="7. Contato">
        Dúvidas sobre esta política ou sobre os seus dados: fale com a empresa responsável pelo atendimento em que você foi
        atendido, ou peça pelo canal informado na página de exclusão de dados.
      </Secao>
    </main>
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold">{titulo}</h2>
      <div className="mt-2 text-gray-700">{children}</div>
    </section>
  )
}
