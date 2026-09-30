'use client'

// Recebe a transmissão ao vivo de uma apresentação. Tenta primeiro a
// conexão de eventos (SSE, lida via fetch porque EventSource não manda o
// cabeçalho de autorização): o servidor segura ~24s empurrando cada
// mudança e a tela reabre em seguida. Se a hospedagem segurar o fluxo em
// vez de repassar na hora (o primeiro evento não chega em 6s, duas vezes
// seguidas), cai pro modo reserva: pergunta a cada ~1s só pelo que mudou.
import { useEffect, useRef, useState } from 'react'
import { proLaboreApi, type ConteudoApresentacao, type PalcoApresentacao } from '@/lib/proLaboreApi'

export type ModoTransmissao = 'conectando' | 'continuo' | 'reserva'

export interface HandlersTransmissao {
  onConteudo: (c: ConteudoApresentacao, versao: number) => void
  onPalco: (p: PalcoApresentacao | null) => void
  onStatus: (aoVivo: boolean) => void
}

interface EventoRecebido {
  tipo: 'estado' | 'conteudo' | 'palco' | 'status' | 'fim'
  versao?: number
  conteudo?: ConteudoApresentacao
  palcoVersao?: number
  palco?: PalcoApresentacao | null
  aoVivo?: boolean
}

const ESPERA_PRIMEIRO_EVENTO_MS = 6000
const INTERVALO_RESERVA_MS = 1000

const dormir = (ms: number) => new Promise(r => setTimeout(r, ms))

export function useTransmissao(id: string, inicial: { versao: number; palcoVersao: number }, handlers: HandlersTransmissao): ModoTransmissao {
  const [modo, setModo] = useState<ModoTransmissao>('conectando')
  const handlersRef = useRef(handlers)
  useEffect(() => { handlersRef.current = handlers })
  const inicialRef = useRef(inicial)

  useEffect(() => {
    let ativo = true
    let versao = inicialRef.current.versao
    let palcoVersao = inicialRef.current.palcoVersao
    let controle: AbortController | null = null

    const aplicar = (e: EventoRecebido) => {
      const h = handlersRef.current
      if ((e.tipo === 'estado' || e.tipo === 'conteudo') && e.conteudo && (e.versao ?? -1) > versao) {
        versao = e.versao!
        h.onConteudo(e.conteudo, versao)
      }
      if ((e.tipo === 'estado' || e.tipo === 'palco') && e.palco !== undefined && (e.palcoVersao ?? -1) > palcoVersao) {
        palcoVersao = e.palcoVersao!
        h.onPalco(e.palco)
      }
      if ((e.tipo === 'estado' || e.tipo === 'status') && typeof e.aoVivo === 'boolean') h.onStatus(e.aoVivo)
    }

    // Uma conexão de eventos. Devolve true se chegou pelo menos um evento
    // a tempo (o fluxo passa ao vivo pela hospedagem).
    async function conexaoContinua(): Promise<boolean> {
      controle = new AbortController()
      let recebeu = false
      const limite = setTimeout(() => { if (!recebeu) controle?.abort() }, ESPERA_PRIMEIRO_EVENTO_MS)
      try {
        const token = proLaboreApi.apresentacoes.token()
        const r = await fetch(proLaboreApi.apresentacoes.urlTransmissao(id), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controle.signal,
          cache: 'no-store',
        })
        if (!r.ok || !r.body) return false
        const leitor = r.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (ativo) {
          const { value, done } = await leitor.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          let fim: number
          while ((fim = buffer.indexOf('\n\n')) >= 0) {
            const bloco = buffer.slice(0, fim)
            buffer = buffer.slice(fim + 2)
            const dados = bloco.split('\n').filter(l => l.startsWith('data: ')).map(l => l.slice(6)).join('\n')
            if (!dados) continue
            if (!recebeu) { recebeu = true; clearTimeout(limite); if (ativo) setModo('continuo') }
            try { aplicar(JSON.parse(dados) as EventoRecebido) } catch { /* evento malformado: ignora */ }
          }
        }
        return recebeu
      } catch {
        return recebeu
      } finally {
        clearTimeout(limite)
      }
    }

    async function modoReserva() {
      setModo('reserva')
      while (ativo) {
        try {
          const e = await proLaboreApi.apresentacoes.estado(id, versao, palcoVersao)
          aplicar({ tipo: 'estado', ...e, palco: e.palco === undefined ? undefined : e.palco })
        } catch { /* rede instável: tenta de novo */ }
        await dormir(document.hidden ? INTERVALO_RESERVA_MS * 3 : INTERVALO_RESERVA_MS)
      }
    }

    ;(async () => {
      let falhas = 0
      while (ativo) {
        const funcionou = await conexaoContinua()
        if (!ativo) return
        falhas = funcionou ? 0 : falhas + 1
        if (falhas >= 2) { await modoReserva(); return }
        await dormir(funcionou ? 150 : 1500)
      }
    })()

    return () => { ativo = false; controle?.abort() }
  }, [id])

  return modo
}
