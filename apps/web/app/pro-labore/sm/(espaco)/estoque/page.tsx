'use client'

// Estoque leve do Social Media (decisão P3): modelo, ano, cor e dias na loja,
// sem custo nem margem. O gestor mantém; o Social Media só lê (ou edita, se
// o gestor der Estoque "Completo").
import { useCallback, useEffect, useState } from 'react'
import { proLaboreApi, type SmMoto } from '@/lib/proLaboreApi'
import { Botao, CardEsqueleto, Chip, EstadoVazio, IcMais, Modal, Rotulo, dataParaIso, isoParaData, quandoCurto, useToast } from '../../_ui'
import { useEspacoSM } from '../EspacoSM'

const STATUS = { PARADA: { texto: 'Parada', tom: 'bad' as const }, ATENCAO: { texto: 'Atenção', tom: 'warn' as const }, OK: { texto: 'Ok', tom: 'ok' as const } }
const SITUACAO = { DISPONIVEL: 'Disponível', RESERVADA: 'Reservada', VENDIDA: 'Vendida' } as const

export default function EstoquePage() {
  const { pode, eu } = useEspacoSM()
  const toast = useToast()
  const [motos, setMotos] = useState<SmMoto[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [novo, setNovo] = useState(false)
  const podeEditar = pode('estoque', 'COMPLETO') && !eu.somenteLeitura

  const carregar = useCallback(() => {
    proLaboreApi.sm.estoque.listar().then(setMotos).catch(e => setErro(e instanceof Error ? e.message : 'Erro ao carregar'))
  }, [])
  useEffect(() => { if (pode('estoque')) carregar() }, [carregar, pode])

  if (!pode('estoque')) return <div className="sm-card"><EstadoVazio titulo="Sem acesso ao estoque">O gestor pode liberar em Equipe → Acessos e permissões.</EstadoVazio></div>

  async function mudarSituacao(m: SmMoto, situacao: SmMoto['situacao']) {
    try {
      await proLaboreApi.sm.estoque.atualizar(m.id, { situacao })
      carregar()
      toast({ mensagem: `${m.modelo}: ${SITUACAO[situacao].toLowerCase()}.`, desfazer: async () => { await proLaboreApi.sm.estoque.atualizar(m.id, { situacao: m.situacao }); carregar() } })
    } catch (e) { toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível salvar', tom: 'bad' }) }
  }

  async function excluir(m: SmMoto) {
    if (!window.confirm(`Tirar ${m.modelo} do estoque? As pautas ligadas a ela continuam, sem a moto.`)) return
    try { await proLaboreApi.sm.estoque.excluir(m.id); carregar(); toast({ mensagem: 'Moto removida.' }) } catch (e) { toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível remover', tom: 'bad' }) }
  }

  const naLoja = motos?.filter(m => m.situacao !== 'VENDIDA') ?? []
  const vendidas = motos?.filter(m => m.situacao === 'VENDIDA') ?? []

  return (
    <>
      <header className="sm-pagina-cab">
        <div>
          <Rotulo>Trabalho · Estoque</Rotulo>
          <h1 className="sm-ttl sm-h1">Motos na loja</h1>
          <p>Base das pautas de estoque: há quanto tempo cada moto está na loja e quanto conteúdo ela já teve. Sem custo e sem margem.</p>
        </div>
        {podeEditar && <Botao variante="pri" icone={<IcMais tamanho={16} />} onClick={() => setNovo(true)}>Cadastrar moto</Botao>}
      </header>
      {erro && <p className="sm-erro" role="alert">{erro}</p>}
      {!motos && !erro && <CardEsqueleto linhas={4} />}
      {motos && (
        <section className="sm-card" aria-label="Motos em estoque">
          {naLoja.length === 0 ? <EstadoVazio titulo="Nenhuma moto cadastrada">{podeEditar ? 'Cadastre as motos da loja para o Social Media saber o que precisa de conteúdo.' : 'O gestor ainda não cadastrou as motos.'}</EstadoVazio> : (
            <div className="sm-tabela-rola">
              <table className="sm-tabela" style={{ minWidth: 720 }}>
                <thead><tr><th>Moto</th><th>Entrada</th><th>Dias</th><th>Posts</th><th>Em produção</th><th>Situação</th>{podeEditar && <th><span className="sm-sr">Ações</span></th>}</tr></thead>
                <tbody>
                  {naLoja.sort((a, b) => b.diasEmEstoque - a.diasEmEstoque).map(m => (
                    <tr key={m.id}>
                      <td><b>{m.modelo}</b>{m.ano ? ` ${m.ano}` : ''}{m.cor ? <span className="sm-legenda"> · {m.cor}</span> : null} <Chip tom={STATUS[m.status].tom}>{STATUS[m.status].texto}</Chip></td>
                      <td>{quandoCurto(m.entradaEm, false)}</td>
                      <td>{m.diasEmEstoque}</td>
                      <td>{m.posts}</td>
                      <td>{m.emProducao}</td>
                      <td>
                        {podeEditar
                          ? (
                            <select className="sm-input" style={{ minHeight: 36, width: 'auto' }} aria-label={`Situação de ${m.modelo}`} value={m.situacao} onChange={e => mudarSituacao(m, e.target.value as SmMoto['situacao'])}>
                              {Object.entries(SITUACAO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                            </select>
                          )
                          : SITUACAO[m.situacao]}
                      </td>
                      {podeEditar && <td><Botao variante="fantasma" onClick={() => excluir(m)}>Remover</Botao></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {vendidas.length > 0 && <p className="sm-legenda" style={{ margin: 0 }}>{vendidas.length} {vendidas.length === 1 ? 'moto vendida' : 'motos vendidas'} fora da lista: {vendidas.slice(0, 5).map(m => m.modelo).join(', ')}{vendidas.length > 5 ? '…' : ''}.</p>}
        </section>
      )}
      {novo && <NovaMoto aoFechar={() => setNovo(false)} aoCriar={() => { setNovo(false); carregar(); toast({ mensagem: 'Moto cadastrada.' }) }} />}
    </>
  )
}

function NovaMoto({ aoFechar, aoCriar }: { aoFechar: () => void; aoCriar: () => void }) {
  const [modelo, setModelo] = useState('')
  const [marca, setMarca] = useState('')
  const [ano, setAno] = useState('')
  const [cor, setCor] = useState('')
  const [entrada, setEntrada] = useState(() => isoParaData(new Date().toISOString()))
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  return (
    <Modal titulo="Cadastrar moto" aoFechar={aoFechar}>
      <form style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={async e => {
        e.preventDefault(); setEnviando(true); setErro(null)
        try {
          await proLaboreApi.sm.estoque.criar({ modelo, marca: marca || null, ano: ano ? Number(ano) : null, cor: cor || null, entradaEm: dataParaIso(entrada)! })
          aoCriar()
        } catch (err) { setErro(err instanceof Error ? err.message : 'Não foi possível cadastrar'); setEnviando(false) }
      }}>
        <label className="sm-campo">Modelo<input className="sm-input" value={modelo} onChange={e => setModelo(e.target.value)} required minLength={2} maxLength={80} placeholder="Ex.: XRE 300 Sahara" /></label>
        <div className="sm-grade-2">
          <label className="sm-campo">Marca<input className="sm-input" value={marca} onChange={e => setMarca(e.target.value)} maxLength={40} /></label>
          <label className="sm-campo">Ano<input className="sm-input" type="number" min={1950} max={2100} value={ano} onChange={e => setAno(e.target.value)} /></label>
          <label className="sm-campo">Cor<input className="sm-input" value={cor} onChange={e => setCor(e.target.value)} maxLength={40} /></label>
          <label className="sm-campo">Entrada na loja<input className="sm-input" type="date" value={entrada} onChange={e => setEntrada(e.target.value)} required /></label>
        </div>
        {erro && <p className="sm-erro" role="alert">{erro}</p>}
        <div className="sm-linha-acoes" style={{ justifyContent: 'flex-end' }}>
          <Botao variante="fantasma" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" variante="pri" disabled={enviando}>{enviando ? 'Salvando…' : 'Cadastrar'}</Botao>
        </div>
      </form>
    </Modal>
  )
}
