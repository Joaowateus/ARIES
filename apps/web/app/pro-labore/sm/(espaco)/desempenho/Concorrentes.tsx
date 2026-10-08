'use client'

// Fase 6 · Concorrentes (subseção do Desempenho, decisão P12): a loja ao lado
// de outras revendas da região, pela mesma régua pública: seguidores (e a
// variação em 30 dias), posts por semana e curtidas + comentários por post.
// A lista é do gestor; o Social Media vê a comparação.
import { useEffect, useState } from 'react'
import { proLaboreApi, type SmConcorrentes, type SmPerfilComparado } from '@/lib/proLaboreApi'
import { Banner, Botao, CardEsqueleto, Chip, EstadoVazio, haQuanto, useToast } from '../../_ui'

const num = (v: number | null, c = 0) => (v == null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: c }))
const variacao = (v: number | null) => (v == null ? null : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('pt-BR')}`)

export function Concorrentes() {
  const toast = useToast()
  const [dados, setDados] = useState<SmConcorrentes | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [novo, setNovo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => {
    proLaboreApi.sm.concorrentes.ver().then(setDados).catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível carregar agora.'))
  }, [])

  async function acao(fn: () => Promise<SmConcorrentes>, ok?: string) {
    setOcupado(true)
    try { setDados(await fn()); if (ok) toast({ mensagem: ok }); return true }
    catch (e) { toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível concluir', tom: 'bad' }); return false }
    finally { setOcupado(false) }
  }

  const linha = (p: SmPerfilComparado, opcoes: { loja?: boolean; nome?: string | null; erro?: string | null; id?: string } = {}) => {
    const v = variacao(p.variacao30d)
    return (
      <tr key={opcoes.id ?? 'loja'} className={opcoes.loja ? 'sm-conc-loja' : undefined}>
        <th scope="row">
          <span className="sm-conc-perfil">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.fotoUrl ? <img src={p.fotoUrl} alt="" /> : <span className="sm-conc-inicial" aria-hidden="true">{p.usuario.slice(0, 1).toUpperCase()}</span>}
            <span><b>@{p.usuario}</b>{opcoes.loja ? <Chip tom="info">Sua loja</Chip> : opcoes.nome && <span className="sm-legenda">{opcoes.nome}</span>}</span>
          </span>
          {opcoes.erro && <span className="sm-status warn">{opcoes.erro}</span>}
        </th>
        <td>{num(p.seguidores)}{v && <span className={`sm-conc-var${p.variacao30d! > 0 ? ' sobe' : p.variacao30d! < 0 ? ' desce' : ''}`}> {v} em 30 dias</span>}</td>
        <td>{num(p.postsSemana, 1)}</td>
        <td>{num(p.engajamentoMedio)}{p.taxaEngajamento != null && <span className="sm-legenda"> · {num(p.taxaEngajamento, 2)}%</span>}</td>
        <td>{p.ultimoPostEm ? haQuanto(p.ultimoPostEm) : '—'}</td>
        {dados?.podeEditar && <td>{opcoes.id && <Botao variante="fantasma" disabled={ocupado} onClick={() => acao(() => proLaboreApi.sm.concorrentes.remover(opcoes.id!), `@${p.usuario} saiu da lista.`)}>Remover</Botao>}</td>}
      </tr>
    )
  }

  return (
    <section className="sm-card" aria-label="Concorrentes">
      <div className="sm-desemp-completa-cab">
        <div>
          <h2 className="sm-h-card">Concorrentes</h2>
          <p className="sm-legenda" style={{ margin: '4px 0 0' }}>Dados públicos dos perfis (seguidores, posts, curtidas e comentários) dos últimos 28 dias, atualizados uma vez por dia.</p>
        </div>
        {dados?.podeEditar && dados.disponivel && dados.perfis.length > 0 && <Botao variante="fantasma" disabled={ocupado} onClick={() => acao(() => proLaboreApi.sm.concorrentes.atualizar(), 'Perfis atualizados.')}>Atualizar agora</Botao>}
      </div>
      {erro ? <p className="sm-erro" role="alert">{erro}</p> : !dados ? <CardEsqueleto linhas={3} /> : (
        <>
          {!dados.disponivel && <Banner tom="info" titulo="Comparação com a conta da empresa">{dados.motivo}</Banner>}
          {dados.perfis.length === 0 ? (
            <EstadoVazio titulo="Nenhum concorrente na lista">
              {dados.podeEditar ? 'Adicione o @ de outras revendas da região para comparar seguidores, frequência e engajamento público.' : 'O gestor escolhe os perfis de outras revendas para comparar.'}
            </EstadoVazio>
          ) : (
            <div className="sm-tabela-rolagem">
              <table className="sm-tabela sm-conc-tabela">
                <thead>
                  <tr><th scope="col">Perfil</th><th scope="col">Seguidores</th><th scope="col">Posts por semana</th><th scope="col">Curtidas + comentários por post</th><th scope="col">Último post</th>{dados.podeEditar && <th scope="col"><span className="sm-sr">Ações</span></th>}</tr>
                </thead>
                <tbody>
                  {dados.loja && linha(dados.loja, { loja: true })}
                  {dados.perfis.map(p => linha(p, { nome: p.nome, erro: p.erro, id: p.id }))}
                </tbody>
              </table>
            </div>
          )}
          {dados.podeEditar && dados.perfis.length < dados.max && (
            <form className="sm-linha-acoes" onSubmit={async e => { e.preventDefault(); if (await acao(() => proLaboreApi.sm.concorrentes.adicionar(novo), 'Perfil adicionado.')) setNovo('') }}>
              <label className="sm-sr" htmlFor="conc-novo">@ do perfil</label>
              <input id="conc-novo" className="sm-input" style={{ flex: '1 1 200px' }} placeholder="@ do perfil ou link do Instagram" value={novo} onChange={e => setNovo(e.target.value)} />
              <Botao type="submit" disabled={ocupado || !novo.trim()}>Acompanhar</Botao>
            </form>
          )}
        </>
      )}
    </section>
  )
}
