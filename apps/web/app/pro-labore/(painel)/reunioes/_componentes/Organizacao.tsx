'use client'

// Peças da organização da aba Reuniões: senha do departamento, formulário
// de departamento e "mover apresentação".
import { useEffect, useState } from 'react'
import { proLaboreApi, type DepartamentoReuniao, type EstruturaReunioes, type ModoApresentador, type PermissaoApresentador } from '@/lib/proLaboreApi'

export const CORES_DEPARTAMENTO = ['#5b8def', '#e0687a', '#57c785', '#e0a83e', '#a679e0', '#4fc3d9', '#e08d4f', '#8b93a6']

export function IconeCadeado({ aberto = false }: { aberto?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d={aberto ? 'M8 11V7a4 4 0 0 1 7.5-2' : 'M8 11V7a4 4 0 0 1 8 0v4'} />
    </svg>
  )
}

export function IconePasta() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  )
}

// Pede a senha do departamento. Depois de acertar, a pessoa não precisa
// digitar de novo (até o responsável trocar a senha).
export function SenhaDepartamento({ departamento, onLiberado }: {
  departamento: { id: string; nome: string; cor?: string }
  onLiberado: () => void
}) {
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro('')
    try {
      await proLaboreApi.reunioesOrg.entrar(departamento.id, senha)
      onLiberado()
    } catch (err) {
      setErro((err as Error).message)
      setSenha('')
    } finally {
      setEnviando(false)
    }
  }
  return (
    <form className="pl-card pl-rn-senha" onSubmit={entrar}>
      <span className="pl-rn-senha-icone" style={{ color: departamento.cor ?? 'var(--pl-ink-2)' }}><IconeCadeado /></span>
      <div className="pl-card-title">{departamento.nome}</div>
      <p className="pl-card-sub" style={{ margin: '4px 0 16px' }}>Esse departamento é protegido. Digite a senha pra ver as reuniões e participar.</p>
      <input
        className="pl-input" type="password" autoFocus autoComplete="off" placeholder="Senha do departamento"
        value={senha} onChange={e => setSenha(e.target.value)} aria-label={`Senha do departamento ${departamento.nome}`}
      />
      {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 10 }}>{erro}</div>}
      <button type="submit" className="pl-btn pl-btn-primary" style={{ marginTop: 12, width: '100%' }} disabled={!senha || enviando}>{enviando ? 'Conferindo…' : 'Entrar'}</button>
    </form>
  )
}

export function FormDepartamento({ atual, onSalvo, onCancelar }: {
  atual?: DepartamentoReuniao
  onSalvo: (id: string) => void
  onCancelar: () => void
}) {
  const [nome, setNome] = useState(atual?.nome ?? '')
  const [descricao, setDescricao] = useState(atual?.descricao ?? '')
  const [cor, setCor] = useState(atual?.cor ?? CORES_DEPARTAMENTO[0])
  const [senha, setSenha] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro('')
    try {
      if (atual) {
        await proLaboreApi.reunioesOrg.atualizarDepartamento(atual.id, { nome: nome.trim(), descricao: descricao.trim() || null, cor, ...(senha && { senha }) })
        onSalvo(atual.id)
      } else {
        const d = await proLaboreApi.reunioesOrg.criarDepartamento({ nome: nome.trim(), descricao: descricao.trim() || undefined, cor, senha })
        onSalvo(d.id)
      }
    } catch (err) {
      setErro((err as Error).message)
      setSalvando(false)
    }
  }
  return (
    <form className="pl-card pl-rn-form" onSubmit={salvar}>
      <div className="pl-card-title">{atual ? `Editar ${atual.nome}` : 'Novo departamento'}</div>
      <div className="pl-rn-form-campos">
        <label className="pl-field"><span>Nome</span>
          <input className="pl-input" autoFocus value={nome} maxLength={60} onChange={e => setNome(e.target.value)} placeholder="Ex.: Vendas, Pós-venda, Gestão" />
        </label>
        <label className="pl-field"><span>Descrição (opcional)</span>
          <input className="pl-input" value={descricao} maxLength={200} onChange={e => setDescricao(e.target.value)} placeholder="Quem participa, do que trata" />
        </label>
        <label className="pl-field"><span>{atual ? 'Nova senha (deixe em branco pra manter)' : 'Senha de acesso'}</span>
          <input className="pl-input" type="password" autoComplete="new-password" value={senha} maxLength={64} onChange={e => setSenha(e.target.value)} placeholder="Mínimo 4 caracteres" />
          {atual && senha && <small className="pl-hint">Trocar a senha tira o acesso de todo mundo que já tinha entrado — eles vão precisar da nova.</small>}
        </label>
        <div className="pl-field"><span>Cor</span>
          <div className="pl-rn-cores" role="radiogroup" aria-label="Cor do departamento">
            {CORES_DEPARTAMENTO.map(c => (
              <button key={c} type="button" role="radio" aria-checked={cor === c} aria-label={c} className={cor === c ? 'ativo' : ''} style={{ background: c }} onClick={() => setCor(c)} />
            ))}
          </div>
        </div>
      </div>
      {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 10 }}>{erro}</div>}
      <div className="pl-ap-nova-botoes">
        <button type="button" className="pl-btn pl-btn-ghost" onClick={onCancelar}>Cancelar</button>
        <button type="submit" className="pl-btn pl-btn-primary" disabled={salvando || !nome.trim() || (!atual && senha.length < 4) || (!!atual && !!senha && senha.length < 4)}>
          {salvando ? 'Salvando…' : atual ? 'Salvar' : 'Criar departamento'}
        </button>
      </div>
    </form>
  )
}

// Escolha de destino: Geral ou um departamento, e opcionalmente uma pasta.
export function MoverApresentacao({ titulo, atual, estrutura, onMover, onCancelar }: {
  titulo: string
  atual: { departamentoId: string | null; pastaId: string | null }
  estrutura: EstruturaReunioes
  onMover: (destino: { departamentoId: string | null; pastaId: string | null }) => Promise<void>
  onCancelar: () => void
}) {
  const [dep, setDep] = useState<string>(atual.departamentoId ?? '')
  const [pasta, setPasta] = useState<string>(atual.pastaId ?? '')
  const [movendo, setMovendo] = useState(false)
  const [erro, setErro] = useState('')
  const pastas = dep ? estrutura.departamentos.find(d => d.id === dep)?.pastas ?? [] : estrutura.geral.pastas
  async function mover() {
    setMovendo(true)
    setErro('')
    try {
      await onMover({ departamentoId: dep || null, pastaId: pasta || null })
    } catch (e) {
      setErro((e as Error).message)
      setMovendo(false)
    }
  }
  return (
    <div className="pl-rn-modal" role="dialog" aria-modal="true" aria-label={`Mover ${titulo}`} onClick={e => { if (e.target === e.currentTarget) onCancelar() }}>
      <div className="pl-card pl-rn-modal-caixa">
        <div className="pl-card-title">Mover “{titulo}”</div>
        <label className="pl-field" style={{ marginTop: 14 }}><span>Departamento</span>
          <select className="pl-input" value={dep} onChange={e => { setDep(e.target.value); setPasta('') }}>
            <option value="">Geral (sem senha)</option>
            {estrutura.departamentos.map(d => (
              <option key={d.id} value={d.id} disabled={!d.liberado}>{d.nome} {d.liberado ? '(com senha)' : '(entre com a senha antes)'}</option>
            ))}
          </select>
        </label>
        <label className="pl-field" style={{ marginTop: 10 }}><span>Pasta</span>
          <select className="pl-input" value={pasta} onChange={e => setPasta(e.target.value)}>
            <option value="">Fora de pasta</option>
            {pastas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </label>
        {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 10 }}>{erro}</div>}
        <div className="pl-ap-nova-botoes">
          <button type="button" className="pl-btn pl-btn-ghost" onClick={onCancelar}>Cancelar</button>
          <button type="button" className="pl-btn pl-btn-primary" disabled={movendo} onClick={mover}>{movendo ? 'Movendo…' : 'Mover'}</button>
        </div>
      </div>
    </div>
  )
}

const MODOS: Array<{ valor: ModoApresentador; rotulo: string; descricao: string }> = [
  { valor: 'APROVACAO', rotulo: 'Com autorização', descricao: 'Monta à vontade; cada apresentação passa por você antes da equipe ver' },
  { valor: 'LIVRE', rotulo: 'Livre', descricao: 'Apresenta sem pedir' },
  { valor: 'BLOQUEADO', rotulo: 'Não apresenta', descricao: 'Só assiste' },
]

// Quem da equipe pode apresentar na aba Reuniões (só o dono vê).
export function PermissoesEquipe({ onFechar }: { onFechar: () => void }) {
  const [lista, setLista] = useState<PermissaoApresentador[] | null>(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState<string | null>(null)
  useEffect(() => {
    let cancelado = false
    proLaboreApi.reunioesOrg.permissoes().then(l => { if (!cancelado) setLista(l) }).catch(e => { if (!cancelado) setErro((e as Error).message) })
    return () => { cancelado = true }
  }, [])
  async function mudar(p: PermissaoApresentador, modo: ModoApresentador) {
    setSalvando(p.vendedorId)
    setErro('')
    try {
      await proLaboreApi.reunioesOrg.definirPermissao(p.vendedorId, modo)
      setLista(l => l?.map(x => (x.vendedorId === p.vendedorId ? { ...x, modo } : x)) ?? l)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(null)
    }
  }
  return (
    <div className="pl-rn-modal" role="dialog" aria-modal="true" aria-label="Quem pode apresentar" onClick={e => { if (e.target === e.currentTarget) onFechar() }}>
      <div className="pl-card pl-rn-modal-caixa pl-rn-perm-caixa">
        <div className="pl-card-title">Quem pode apresentar</div>
        <p className="pl-card-sub" style={{ margin: '4px 0 14px' }}>
          Por padrão, todo mundo da equipe pode montar uma apresentação, mas ela só vai pra equipe (e ao vivo) depois que você autorizar.
          Os pedidos aparecem no topo da aba Reuniões.
        </p>
        {erro && <div className="pl-alert pl-alert-error" style={{ marginBottom: 10 }}>{erro}</div>}
        {lista === null ? <div className="pl-hint">Carregando…</div> : lista.length === 0 ? (
          <div className="pl-hint">Ninguém da equipe tem login ainda. Dê acesso em Vendedores.</div>
        ) : (
          <ul className="pl-rn-perm-lista">
            {lista.map(p => (
              <li key={p.vendedorId}>
                <div className="pl-rn-perm-nome"><b>{p.nome}</b><small>{p.papel === 'SUPERVISOR' ? 'Supervisor' : 'Vendedor'}</small></div>
                <div className="pl-rn-perm-modos" role="radiogroup" aria-label={`Permissão de ${p.nome}`}>
                  {MODOS.map(m => (
                    <button
                      key={m.valor} type="button" role="radio" aria-checked={p.modo === m.valor} title={m.descricao}
                      className={`${p.modo === m.valor ? 'ativo' : ''} ${m.valor.toLowerCase()}`}
                      disabled={salvando === p.vendedorId} onClick={() => mudar(p, m.valor)}
                    >{m.rotulo}</button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
        <ul className="pl-rn-perm-legenda">
          {MODOS.map(m => <li key={m.valor}><b>{m.rotulo}:</b> {m.descricao.toLowerCase()}.</li>)}
        </ul>
        <div className="pl-ap-nova-botoes">
          <button type="button" className="pl-btn pl-btn-primary" onClick={onFechar}>Pronto</button>
        </div>
      </div>
    </div>
  )
}
