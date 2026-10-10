'use client'

// Acessos da equipe: o dono cria logins e escolhe, módulo a módulo, o que cada
// pessoa vê (Ver) e pode mexer (Editar), e se ela enxerga só os próprios dados
// ou a equipe toda. Tudo é aplicado no backend (lib/acessos.ts) e vale na hora.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { proLaboreApi, type AcessoEquipe, type EscopoAcesso, type NivelAcesso, type PainelAcessos } from '@/lib/proLaboreApi'
import { Botao, Card, CardEsqueleto, Chip, EstadoVazio, Rotulo, Segmentado, Toggle, useToast } from '../../../sm/_ui'

const NIVEIS: Record<NivelAcesso, { rotulo: string; tom: 'ok' | 'info' | 'bad' }> = {
  EDITAR: { rotulo: 'Ver e editar', tom: 'ok' },
  VER: { rotulo: 'Só ver', tom: 'info' },
  NENHUM: { rotulo: 'Sem acesso', tom: 'bad' },
}
const ESCOPOS = [
  { valor: 'PROPRIO' as const, rotulo: 'Só os próprios dados', dica: 'Leads, vendas e tarefas dela mesma' },
  { valor: 'EQUIPE' as const, rotulo: 'A equipe toda', dica: 'Vê os dados de todos nos módulos liberados' },
]

interface Rascunho {
  id: string | null // null = novo acesso
  vendedorId: string // novo acesso para alguém já cadastrado em Vendedores
  nome: string
  email: string
  senha: string
  escopo: EscopoAcesso
  vende: boolean
  permissoes: Record<string, NivelAcesso>
}

export function AcessosEquipe() {
  const toast = useToast()
  const [dados, setDados] = useState<PainelAcessos | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)

  const carregar = useCallback(() => {
    proLaboreApi.acessos.listar().then(setDados).catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível carregar os acessos.'))
  }, [])
  useEffect(() => { carregar() }, [carregar])

  function novo() {
    if (!dados) return
    const p = dados.perfis[0]
    setRascunho({ id: null, vendedorId: '', nome: '', email: '', senha: '', escopo: p.escopo, vende: p.vende, permissoes: { ...p.permissoes } })
  }
  function editar(a: AcessoEquipe) {
    setRascunho({ id: a.id, vendedorId: '', nome: a.nome, email: a.email ?? '', senha: '', escopo: a.escopo, vende: a.vende, permissoes: { ...a.permissoes } })
  }

  if (rascunho && dados) {
    return <Editor dados={dados} inicial={rascunho} aoFechar={() => setRascunho(null)} aoSalvar={(d, msg) => { setDados(d); setRascunho(null); toast({ mensagem: msg }) }} />
  }

  return (
    <div className="sm-pagina">
      <header className="sm-pagina-cab">
        <div>
          <Rotulo>Equipe · Acessos</Rotulo>
          <h1 className="sm-ttl sm-h1">Quem entra no sistema e o que cada um vê</h1>
          <p>Cada acesso tem o seu login e o seu nível em cada módulo. O que você muda aqui vale na hora, sem a pessoa precisar sair e entrar.</p>
        </div>
        <Botao variante="pri" onClick={novo} disabled={!dados}>Novo acesso</Botao>
      </header>
      {erro && <p className="sm-erro" role="alert">{erro}</p>}
      {!dados ? <Card><CardEsqueleto linhas={4} /></Card> : dados.acessos.length === 0 ? (
        <Card>
          <EstadoVazio titulo="Ninguém além de você tem login ainda" acao={<Botao variante="pri" onClick={novo}>Criar o primeiro acesso</Botao>}>
            Crie um acesso para cada pessoa e escolha um perfil pronto (Vendedor, Supervisor, Gerente, Financeiro, Marketing ou Só leitura). Depois dá para ajustar módulo por módulo.
          </EstadoVazio>
        </Card>
      ) : (
        <section className="sm-card pl-acessos-lista" aria-label="Acessos da equipe">
          {dados.acessos.map(a => <LinhaAcesso key={a.id} acesso={a} dados={dados} aoEditar={() => editar(a)} />)}
        </section>
      )}
    </div>
  )
}

function LinhaAcesso({ acesso: a, dados, aoEditar }: { acesso: AcessoEquipe; dados: PainelAcessos; aoEditar: () => void }) {
  const perfil = dados.perfis.find(p => p.chave === a.perfil)
  const nomes = (n: NivelAcesso) => dados.modulos.filter(m => a.permissoes[m.chave] === n).map(m => m.rotulo)
  const edita = nomes('EDITAR'), ve = nomes('VER')
  return (
    <div className={`sm-linha-item pl-acesso${a.ativo ? '' : ' inativo'}`}>
      <div className="sm-linha-item-texto">
        <b>{a.nome}</b>
        <small>{a.email}</small>
        <span className="pl-acesso-chips">
          <Chip tom={perfil ? 'info' : 'neutro'}>{perfil ? perfil.rotulo : 'Personalizado'}</Chip>
          <Chip>{a.escopo === 'EQUIPE' ? 'Equipe toda' : 'Só os próprios dados'}</Chip>
          {!a.vende && <Chip>Não vende</Chip>}
          {!a.ativo && <Chip tom="bad">Desativado</Chip>}
        </span>
        <small className="pl-acesso-resumo">
          {edita.length > 0 && <>Edita: {edita.join(', ')}. </>}
          {ve.length > 0 && <>Só vê: {ve.join(', ')}.</>}
          {edita.length + ve.length === 0 && 'Nenhum módulo liberado.'}
        </small>
      </div>
      <Botao onClick={aoEditar}>Editar acesso</Botao>
    </div>
  )
}

function Editor({ dados, inicial, aoFechar, aoSalvar }: { dados: PainelAcessos; inicial: Rascunho; aoFechar: () => void; aoSalvar: (d: PainelAcessos, mensagem: string) => void }) {
  const toast = useToast()
  const [r, setR] = useState<Rascunho>(inicial)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [novaSenha, setNovaSenha] = useState('')
  const atual = inicial.id ? dados.acessos.find(a => a.id === inicial.id) ?? null : null
  const mudar = (m: Partial<Rascunho>) => setR(x => ({ ...x, ...m }))
  const perfilAtual = useMemo(() => dados.perfis.find(p => p.escopo === r.escopo && dados.modulos.every(m => p.permissoes[m.chave] === r.permissoes[m.chave])), [dados, r])
  const grupos = useMemo(() => [...new Set(dados.modulos.map(m => m.grupo))], [dados])

  async function salvar() {
    setErro(null); setSalvando(true)
    try {
      if (r.id) {
        const d = await proLaboreApi.acessos.editar(r.id, { nome: r.nome.trim(), email: r.email.trim(), escopo: r.escopo, vende: r.vende, permissoes: r.permissoes })
        aoSalvar(d, `Acesso de ${r.nome.trim()} atualizado. Já vale.`)
      } else {
        const d = await proLaboreApi.acessos.criar({
          ...(r.vendedorId ? { vendedorId: r.vendedorId } : { nome: r.nome.trim() }),
          email: r.email.trim(), senha: r.senha, escopo: r.escopo, vende: r.vende, permissoes: r.permissoes,
        })
        const nome = r.vendedorId ? dados.semLogin.find(p => p.id === r.vendedorId)?.nome : r.nome.trim()
        aoSalvar(d, `Acesso de ${nome} criado. Passe o e-mail e a senha para a pessoa.`)
      }
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível salvar.') } finally { setSalvando(false) }
  }

  async function acao(fn: () => Promise<PainelAcessos | { ok: true }>, mensagem: string, fechar = true) {
    setErro(null); setSalvando(true)
    try {
      const d = await fn()
      if (fechar && 'acessos' in d) aoSalvar(d, mensagem)
      else toast({ mensagem })
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível concluir.') } finally { setSalvando(false) }
  }

  const novoAcesso = !r.id
  const podeSalvar = !salvando && r.email.includes('@') && (novoAcesso ? (r.vendedorId || r.nome.trim().length >= 2) && r.senha.length >= 6 : r.nome.trim().length >= 2)

  return (
    <div className="sm-pagina">
      <header className="sm-pagina-cab">
        <div>
          <Rotulo>Equipe · Acessos · {novoAcesso ? 'Novo acesso' : r.nome}</Rotulo>
          <h1 className="sm-ttl sm-h1">{novoAcesso ? 'Novo acesso' : `O que ${r.nome} vê e pode mexer`}</h1>
          <p>Escolha um perfil pronto e ajuste o que precisar. &quot;Só ver&quot; mostra a área sem deixar mudar nada.</p>
        </div>
        <Botao onClick={aoFechar}>Voltar para a lista</Botao>
      </header>

      <div className="pl-acesso-editor">
        <div className="pl-acesso-col">
          <Card titulo="Quem é">
            {novoAcesso && dados.semLogin.length > 0 && (
              <label className="sm-campo">Já está em Vendedores?
                <select className="sm-input" value={r.vendedorId} onChange={e => mudar({ vendedorId: e.target.value })}>
                  <option value="">Não, é uma pessoa nova</option>
                  {dados.semLogin.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </label>
            )}
            {!r.vendedorId && (
              <label className="sm-campo">Nome
                <input className="sm-input" value={r.nome} onChange={e => mudar({ nome: e.target.value })} autoComplete="off" />
              </label>
            )}
            <label className="sm-campo">E-mail de login
              <input className="sm-input" type="email" value={r.email} onChange={e => mudar({ email: e.target.value })} autoComplete="off" />
            </label>
            {novoAcesso && (
              <label className="sm-campo">Senha provisória (mínimo 6 caracteres)
                <input className="sm-input" type="text" value={r.senha} onChange={e => mudar({ senha: e.target.value })} autoComplete="new-password" />
              </label>
            )}
          </Card>

          <Card titulo="Perfil pronto" subtitulo="Preenche os módulos de uma vez. Depois dá para ajustar.">
            <div className="pl-acesso-perfis">
              {dados.perfis.map(p => (
                <button key={p.chave} type="button" className={`pl-acesso-perfil${perfilAtual?.chave === p.chave ? ' ativo' : ''}`} aria-pressed={perfilAtual?.chave === p.chave}
                  onClick={() => mudar({ escopo: p.escopo, vende: p.vende, permissoes: { ...p.permissoes } })}>
                  <b>{p.rotulo}</b>
                  <small>{p.descricao}</small>
                </button>
              ))}
            </div>
            {!perfilAtual && <p className="sm-legenda">Personalizado: os módulos foram ajustados à mão.</p>}
          </Card>

          <Card titulo="Dados que enxerga">
            <Segmentado rotulo="Dados que enxerga" opcoes={ESCOPOS} valor={r.escopo} aoMudar={v => mudar({ escopo: v })} />
            <p className="sm-legenda" style={{ margin: 0 }}>{ESCOPOS.find(e => e.valor === r.escopo)!.dica}.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>Vende</div>
                <div className="sm-legenda">Entra no ranking do Dashboard e no rodízio de leads.</div>
              </div>
              <Toggle ligado={r.vende} rotulo="Vende" aoMudar={v => mudar({ vende: v })} />
            </div>
          </Card>

          {atual && (
            <Card titulo="Login">
              <label className="sm-campo">Nova senha
                <input className="sm-input" type="text" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} autoComplete="new-password" placeholder="Mínimo 6 caracteres" />
              </label>
              <div className="sm-linha-acoes">
                <Botao disabled={salvando || novaSenha.length < 6} onClick={() => acao(() => proLaboreApi.acessos.senha(atual.id, novaSenha), 'Senha trocada.', false).then(() => setNovaSenha(''))}>Trocar senha</Botao>
                <Botao disabled={salvando} onClick={() => acao(() => proLaboreApi.acessos.editar(atual.id, { ativo: !atual.ativo }), atual.ativo ? `${atual.nome} não entra mais até você reativar.` : `${atual.nome} voltou a entrar.`)}>
                  {atual.ativo ? 'Desativar acesso' : 'Reativar acesso'}
                </Botao>
                <Botao variante="fantasma" disabled={salvando} onClick={() => { if (window.confirm(`Tirar o login de ${atual.nome}? ${atual.vende ? 'O cadastro continua em Vendedores.' : ''}`)) void acao(() => proLaboreApi.acessos.remover(atual.id), `Login de ${atual.nome} removido.`) }}>
                  Tirar o login
                </Botao>
              </div>
            </Card>
          )}
        </div>

        <section className="sm-card pl-acesso-modulos" aria-label="Nível por módulo">
          {grupos.map(g => (
            <div key={g} className="pl-acesso-grupo">
              <Rotulo as="h3">{g}</Rotulo>
              {dados.modulos.filter(m => m.grupo === g).map(m => (
                <div key={m.chave} className="sm-linha-item">
                  <div className="sm-linha-item-texto">
                    <b>{m.rotulo}</b>
                    <small>{m.descricao}{m.ver && r.permissoes[m.chave] === 'VER' ? ` ${m.ver}` : ''}</small>
                  </div>
                  <Segmentado
                    variante="nivel"
                    rotulo={`Acesso a ${m.rotulo}`}
                    opcoes={(['EDITAR', 'VER', 'NENHUM'] as NivelAcesso[]).filter(n => m.niveis.includes(n)).map(n => ({ valor: n, rotulo: n === 'VER' && !m.niveis.includes('EDITAR') ? 'Ver' : NIVEIS[n].rotulo, tom: NIVEIS[n].tom }))}
                    valor={r.permissoes[m.chave] ?? 'NENHUM'}
                    aoMudar={v => mudar({ permissoes: { ...r.permissoes, [m.chave]: v } })}
                  />
                </div>
              ))}
            </div>
          ))}
        </section>
      </div>

      {erro && <p className="sm-erro" role="alert">{erro}</p>}
      <div className="sm-linha-acoes pl-acesso-salvar">
        <Botao variante="pri" disabled={!podeSalvar} onClick={salvar}>{salvando ? 'Salvando…' : novoAcesso ? 'Criar acesso' : 'Salvar'}</Botao>
        <Botao onClick={aoFechar}>Cancelar</Botao>
      </div>
    </div>
  )
}
