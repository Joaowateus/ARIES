'use client'

// Perfil do cliente e "Preparar com o ARIES" no painel do lead (19/11).
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { proLaboreApi, type Lead, type PerfilCliente } from '@/lib/proLaboreApi'
import { NOME_ETAPA } from '@/lib/etapasJornada'
import { useTelas } from '../../_padrao/Padrao'
import { NOME_PERFIL, motoValida, nomeLimpo } from '../_jornada/QuadroJornada'

const DICA: Record<PerfilCliente, string> = {
  INDECISO: 'Faça as perguntas certas para descobrir o que ele quer.',
  DETALHISTA: 'Ouça com calma, traga novidades e explique os detalhes.',
  APRESSADO: 'Seja rápido e direto ao trazer as informações.',
  NERVOSO: 'Mostre empatia, mantenha a calma e atenda com paciência.',
}
const PERFIS = Object.keys(DICA) as PerfilCliente[]

/** Perfil do cliente: 1 clique marca, clique de novo limpa. Só quem pode editar o lead muda. */
export function PerfilCliente({ lead, podeEscrever, onMudou }: { lead: Lead; podeEscrever: boolean; onMudou: () => void }) {
  const [perfil, setPerfil] = useState<PerfilCliente | null>(lead.perfilCliente ?? null)
  const [erro, setErro] = useState<string | null>(null)
  async function escolher(p: PerfilCliente) {
    const novo = perfil === p ? null : p
    const antes = perfil
    setPerfil(novo); setErro(null)
    try { await proLaboreApi.leads.editar(lead.id, { perfilCliente: novo }); onMudou() } catch (e) { setPerfil(antes); setErro(e instanceof Error ? e.message : 'Não foi possível salvar o perfil') }
  }
  return (
    <div className="pn2-perfil" data-perfil-cliente>
      <div className="pn2-perfil-linha">
        <span className="pn2-perfil-rot">Perfil</span>
        <div className="fn-seg pn2-perfil-seg" role="group" aria-label="Perfil do cliente">
          {PERFIS.map(p => (
            <button key={p} type="button" className={perfil === p ? 'ativo' : ''} aria-pressed={perfil === p} disabled={!podeEscrever} onClick={() => void escolher(p)} title={podeEscrever ? (perfil === p ? 'Clique de novo para limpar' : DICA[p]) : 'Só quem pode editar o lead muda o perfil'} data-perfil={p}>{NOME_PERFIL[p]}</button>
          ))}
        </div>
      </div>
      {perfil && <div className="pn2-perfil-dica" data-dica-perfil>{DICA[perfil]}</div>}
      {erro && <div className="pl-alert" role="alert">{erro}</div>}
    </div>
  )
}

const PAGAMENTO = { A_VISTA: 'à vista', FINANCIADO: 'financiado' } as const
const CNH = { TEM: 'tem CNH', EM_PROCESSO: 'tirando a CNH', NAO_TEM: 'sem CNH' } as const
/** Junta só os pedaços preenchidos ("interessado em X, pagamento Y"). */
const juntar = (partes: Array<string | null | false | undefined>, sep = ', ') => partes.filter(Boolean).join(sep)

export function montarPrompts(l: Lead) {
  const nome = nomeLimpo(l) ?? 'o cliente'
  const moto = motoValida(l.modeloInteresse) ? l.modeloInteresse!.trim() : null
  const pagamento = l.formaPagamento ? PAGAMENTO[l.formaPagamento] : null
  const perfil = l.perfilCliente ? NOME_PERFIL[l.perfilCliente].toLowerCase() : null
  const etapa = l.etapa ? NOME_ETAPA[l.etapa] : null
  const entrada = l.temEntrada === true ? (l.levantamento?.entradaValor ? `entrada de R$ ${l.levantamento.entradaValor.toLocaleString('pt-BR')}` : 'tem entrada') : l.temEntrada === false ? 'sem entrada' : null
  const ultima = l.conversa?.ultima?.texto ? `última mensagem: "${l.conversa.ultima.texto.slice(0, 200)}"` : null
  const origem = l.origemCadastro === 'WHATSAPP' ? 'chegou pelo WhatsApp' : l.tipoLead === 'TRAFEGO' ? 'veio do tráfego pago' : l.tipoLead === 'ORGANICO' ? 'veio do Instagram' : null
  const dados = juntar([etapa && `etapa ${etapa}`, moto && `moto ${moto}`, l.valorNegociacao > 0 && `valor R$ ${l.valorNegociacao.toLocaleString('pt-BR')}`, pagamento && `pagamento ${pagamento}`, entrada, l.situacaoCnh && CNH[l.situacaoCnh], origem, perfil && `perfil ${perfil}`, ultima], '; ')
  const fim = dados ? `\n\nDados do lead: ${dados}.` : ''
  return [
    { chave: 'visita', rotulo: 'Preparar a visita', texto: `Monte um roteiro de atendimento para a visita de ${juntar([nome + (moto ? `, interessado em ${moto}` : ''), pagamento && `pagamento ${pagamento}`, perfil && `perfil ${perfil}`])}. Inclua perguntas de diagnóstico, como apresentar a moto e as condições, as objeções prováveis e o próximo passo.${fim}` },
    { chave: 'levantamento', rotulo: 'Perguntas de levantamento', texto: `Crie 10 perguntas consultivas para o levantamento de ${nome}${moto || pagamento ? ` (${juntar([moto, pagamento])})` : ''}, para descobrir uso da moto, orçamento, entrada, CNH e prazo de compra.${fim}` },
    { chave: 'valor', rotulo: 'Argumentos de valor', texto: `Monte uma apresentação de valor ${moto ? `da ${moto}` : 'da moto'} para ${nome}, comparando com as alternativas que ele pode estar considerando e mostrando como resolve o que ele precisa.${fim}` },
    { chave: 'objecoes', rotulo: 'Objeções prováveis', texto: `Liste as objeções mais prováveis de ${nome}${etapa ? ` na etapa ${etapa}` : ''}${perfil ? ` (perfil ${perfil})` : ''} e a resposta para cada uma, para manter a negociação ativa.${fim}` },
  ]
}

/** Abre o Pergunte ao ARIES com a pergunta pronta: na gaveta (telas novas) ou na aba. */
export function PrepararComAries({ lead }: { lead: Lead }) {
  const { versao } = useTelas()
  const router = useRouter()
  function abrir(texto: string) {
    if (versao === 'NOVA') window.dispatchEvent(new CustomEvent('ar-abrir-pergunte', { detail: { pergunta: texto } }))
    else router.push(`/pro-labore/pergunte?q=${encodeURIComponent(texto)}`)
  }
  return (
    <section className="pl-pn-bloco" data-preparar-aries>
      <h3>Preparar com o ARIES</h3>
      <div className="pn2-prompts">
        {montarPrompts(lead).map(p => <button key={p.chave} type="button" className="pl-btn" onClick={() => abrir(p.texto)} title={p.texto} data-prompt={p.chave}>{p.rotulo}</button>)}
      </div>
    </section>
  )
}
