// Aries no WhatsApp — envio "como uma pessoa" e quem recebe pelo agente.
// Fica separado do motor para o Assistente Comercial (avisos e resumo do chat
// "Você") poder entregar pelo Aries sem dependência circular.
import { prisma } from './prisma'
import { enviarTexto } from './whatsappEvolution'
import { emPartes, tempoDigitando } from './agenteConversa'

// O "digitando..." segura a chamada ao servidor do WhatsApp: no total, cabe
// folgado nos 30 s da função na Vercel junto com a IA (vercel.json).
const DIGITANDO_TOTAL_MS = 8000

/** Manda em até 3 partes, cada uma com "digitando..." proporcional ao tamanho (8 s no total, no máximo), e registra. */
export async function enviarComoPessoa(agente: { instancia: string }, numero: string, texto: string, registro?: { vinculoId: string; intencao?: string }) {
  const partes = emPartes(texto)
  const tempos = partes.map(tempoDigitando)
  const soma = tempos.reduce((a, b) => a + b, 0)
  const fator = soma > DIGITANDO_TOTAL_MS ? DIGITANDO_TOTAL_MS / soma : 1
  for (let k = 0; k < partes.length; k++) await enviarTexto(agente.instancia, numero, partes[k], Math.max(800, Math.round(tempos[k] * fator)))
  if (registro) await prisma.agenteMensagem.create({ data: { vinculoId: registro.vinculoId, direcao: 'SAIDA', texto: texto.slice(0, 4000), intencao: registro.intencao ?? null } })
}

/**
 * A pessoa conversa com o Aries (vinculada, agente conectado) e quer receber
 * isso por ele: os avisos ou o resumo da manhã saem pelo agente, não pelo
 * chat "Você" do WhatsApp de vendas.
 */
export async function agenteDaPessoa(pessoa: string, uso: 'alertas' | 'manha') {
  const v = await prisma.agenteVinculo.findFirst({
    where: { pessoa, [uso]: true, verificadoEm: { not: null }, numero: { not: null }, agente: { status: 'CONECTADO' } },
    select: { id: true, numero: true, agente: { select: { instancia: true } } },
  })
  return v?.numero ? { vinculoId: v.id, numero: v.numero, agente: v.agente } : null
}
