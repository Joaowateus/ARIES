'use client'

// Biblioteca de ganchos (seção 3.4): o texto e os reels que o usaram, com o
// pulo médio nos 3 s vindo das métricas desses reels. Abre para gerenciar
// (cabeçalho da Produção) ou para escolher (bloco Gancho do briefing).
import { useCallback, useEffect, useState } from 'react'
import { proLaboreApi, type SmBibliotecaGanchos } from '@/lib/proLaboreApi'
import { Botao, BotaoLink, Chip, EstadoVazio, Esqueleto, Modal, Rotulo, useToast } from '../../_ui'
import { useEspacoSM } from '../EspacoSM'

const pct = (v: number | null) => (v == null ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)
const inteiro = (v: number) => v.toLocaleString('pt-BR')

export function BibliotecaGanchos({ aoFechar, aoEscolher }: { aoFechar: () => void; aoEscolher?: (texto: string) => void }) {
  const { pode } = useEspacoSM()
  const toast = useToast()
  const [dados, setDados] = useState<SmBibliotecaGanchos | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [novo, setNovo] = useState('')

  const carregar = useCallback(() => {
    proLaboreApi.sm.ganchos.listar().then(setDados).catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível carregar agora. Tente de novo em instantes.'))
  }, [])
  useEffect(() => { carregar() }, [carregar])

  async function salvar(texto: string, ids: string[] = []) {
    try {
      const r = await proLaboreApi.sm.ganchos.salvar(texto, ids)
      toast({ mensagem: r.novo ? 'Gancho salvo na biblioteca.' : 'Esse gancho já estava na biblioteca: exemplos juntados.', desfazer: r.novo ? async () => { await proLaboreApi.sm.ganchos.excluir(r.id); carregar() } : undefined })
      carregar()
      return true
    } catch (e) { toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível salvar', tom: 'bad' }); return false }
  }
  async function excluir(id: string, texto: string) {
    try {
      await proLaboreApi.sm.ganchos.excluir(id)
      toast({ mensagem: 'Gancho removido.', desfazer: async () => { await proLaboreApi.sm.ganchos.salvar(texto); carregar() } })
      carregar()
    } catch (e) { toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível remover', tom: 'bad' }) }
  }

  const escolhendo = !!aoEscolher
  return (
    <Modal titulo="Biblioteca de ganchos" aoFechar={aoFechar}>
      <div className="sm-ganchos">
        <p className="sm-legenda" style={{ margin: 0 }}>
          {escolhendo ? 'Escolha um gancho para a pauta. ' : ''}O pulo nos 3 primeiros segundos vem dos reels que usaram cada gancho: quanto menor, mais gente ficou.
        </p>
        {erro && <p className="sm-erro" role="alert">{erro}</p>}
        {!dados && !erro && <div aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><span className="sm-sr" role="status">Carregando a biblioteca</span><Esqueleto altura={40} /><Esqueleto altura={40} largura="85%" /><Esqueleto altura={40} largura="70%" /></div>}
        {dados && dados.podeEditar && !escolhendo && (
          <form className="sm-ganchos-novo" onSubmit={async e => { e.preventDefault(); if (novo.trim().length >= 3 && await salvar(novo.trim())) setNovo('') }}>
            <label className="sm-campo" style={{ flex: 1 }}>Novo gancho
              <input className="sm-input" value={novo} onChange={e => setNovo(e.target.value)} placeholder='Ex.: "Ronco da partida + nome da moto na tela"' maxLength={300} />
            </label>
            <Botao type="submit" variante="pri" disabled={novo.trim().length < 3}>Salvar</Botao>
          </form>
        )}
        {dados && (dados.ganchos.length === 0
          ? <EstadoVazio titulo="Biblioteca vazia" acao={pode('analise') ? <BotaoLink href="/pro-labore/sm/desempenho#reels">Ver os reels que foram bem</BotaoLink> : undefined}>Salve ganchos dos reels que foram bem (no diagnóstico do Desempenho) ou escreva um aqui.</EstadoVazio>
          : (
            <ul className="sm-ganchos-lista" aria-label="Ganchos salvos">
              {dados.ganchos.map(g => (
                <li key={g.id}>
                  <div className="sm-ganchos-texto">
                    <b>{g.texto}</b>
                    <span className="sm-legenda">
                      {g.exemplos ? `${g.exemplos} ${g.exemplos === 1 ? 'reel' : 'reels'}` : 'Sem reel ainda'}
                      {g.alcanceMedio != null ? ` · ${inteiro(g.alcanceMedio)} de alcance médio` : ''}
                      {g.links.map((l, i) => <> · <a key={l} href={l} target="_blank" rel="noreferrer">ver {i + 1}</a></>)}
                    </span>
                  </div>
                  <Chip tom={g.puloMedio == null ? 'neutro' : g.puloMedio < 0.4 ? 'ok' : g.puloMedio >= 0.6 ? 'bad' : 'warn'} titulo={g.comPulo ? `Média de ${g.comPulo} ${g.comPulo === 1 ? 'reel' : 'reels'}` : undefined}>
                    {g.puloMedio == null ? 'Sem pulo medido' : `Pulo ${pct(g.puloMedio)}`}
                  </Chip>
                  {escolhendo
                    ? <Botao onClick={() => { aoEscolher!(g.texto); aoFechar() }}>Usar</Botao>
                    : dados.podeEditar && <Botao variante="fantasma" onClick={() => excluir(g.id, g.texto)}>Remover</Botao>}
                </li>
              ))}
            </ul>
          ))}
        {dados && !escolhendo && dados.podeEditar && dados.sugestoes.length > 0 && (
          <section aria-label="Ganchos de reels publicados">
            <Rotulo>Dos reels publicados pela Produção</Rotulo>
            <ul className="sm-ganchos-lista">
              {dados.sugestoes.map(s => (
                <li key={s.texto}>
                  <div className="sm-ganchos-texto"><b>{s.texto}</b><span className="sm-legenda">{s.midiaIgIds.length} {s.midiaIgIds.length === 1 ? 'reel' : 'reels'}{s.alcanceMedio != null ? ` · ${inteiro(s.alcanceMedio)} de alcance médio` : ''}</span></div>
                  <Chip tom={s.puloMedio == null ? 'neutro' : s.puloMedio < 0.4 ? 'ok' : s.puloMedio >= 0.6 ? 'bad' : 'warn'}>{s.puloMedio == null ? 'Sem pulo medido' : `Pulo ${pct(s.puloMedio)}`}</Chip>
                  <Botao onClick={() => salvar(s.texto, s.midiaIgIds)}>Salvar</Botao>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Modal>
  )
}
