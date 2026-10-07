'use client'

// Tela 07 · Permissões (especificação do Social Media, seção 10): o que o
// papel Social Media enxerga, o convite do responsável, as regras e a
// conexão do Instagram. Tudo aqui é aplicado no backend (lib/smAcesso.ts).
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import {
  definirVerComoSocialMedia, proLaboreApi, SM_MODULOS,
  type SmAcessoGestor, type SmModulo, type SmNivel, type SmRegras, type SmStatusMembro,
} from '@/lib/proLaboreApi'
import { AssistenteAba, Botao, Card, CardEsqueleto, Chip, Rotulo, Segmentado, SmApp, Toggle, haQuanto, useToast, type Tom } from '../../../sm/_ui'

const MODULOS: Record<SmModulo, { nome: string; nota: string }> = {
  analise: { nome: 'Social Media · análise', nota: 'Todos os indicadores da conta' },
  producao: { nome: 'Calendário e produção', nota: 'Criar, editar e enviar pautas para aprovação' },
  atendimento: { nome: 'Atendimento do Instagram', nota: 'Direct, comentários e envio de leads ao CRM' },
  estoque: { nome: 'Estoque', nota: 'Modelos e dias em estoque, sem custo e margem' },
  crm: { nome: 'CRM', nota: 'Só cria leads e acompanha os leads orgânicos' },
  vendas: { nome: 'Vendas', nota: 'Só vendas atribuídas ao orgânico' },
  trafego: { nome: 'Tráfego', nota: 'Só o gasto com impulsionamento de posts' },
  financeiro: { nome: 'Financeiro e pró-labore', nota: 'Liquidez, comissões e pró-labore' },
  dashboard: { nome: 'Dashboard geral e equipe', nota: 'Metas e desempenho dos consultores' },
}

const OPCOES_NIVEL = [
  { valor: 'COMPLETO' as const, rotulo: 'Completo', tom: 'ok' as const },
  { valor: 'LEITURA' as const, rotulo: 'Leitura', tom: 'info' as const },
  { valor: 'SEM_ACESSO' as const, rotulo: 'Sem acesso', tom: 'bad' as const },
]

const REGRAS: Array<{ chave: keyof SmRegras; rotulo: string; nota: string }> = [
  { chave: 'aprovacaoGestor', rotulo: 'Aprovação antes de publicar', nota: 'Nada vai ao ar sem o seu ok' },
  { chave: 'mostrarValores', rotulo: 'Mostrar valores em R$', nota: 'Valor negociado nas vendas atribuídas' },
  { chave: 'relatorioSemanal', rotulo: 'Relatório semanal', nota: 'Toda segunda às 8h, para o gestor' },
  { chave: 'assistenteIA', rotulo: 'Assistente de roteiro com IA', nota: 'Gera roteiro a partir da ficha da moto' },
]

const STATUS_MEMBRO: Record<SmStatusMembro, { texto: string; tom: Tom }> = {
  ATIVO: { texto: 'Acesso ativo', tom: 'ok' },
  CONVIDADO: { texto: 'Convite enviado', tom: 'info' },
  CONVITE_EXPIRADO: { texto: 'Convite expirado', tom: 'warn' },
  SUSPENSO: { texto: 'Acesso suspenso', tom: 'bad' },
}

export default function AcessosPermissoesPage() {
  const { usuario } = useProLaboreAuth()
  const router = useRouter()
  useEffect(() => { if (usuario && usuario.papel !== 'DONO') router.replace('/pro-labore') }, [usuario, router])
  if (usuario?.papel !== 'DONO') return null
  return (
    <SmApp className="sm-embutido">
      <Acessos />
    </SmApp>
  )
}

function Acessos() {
  const router = useRouter()
  const toast = useToast()
  const [dados, setDados] = useState<SmAcessoGestor | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(() => {
    proLaboreApi.sm.gestor.acesso().then(setDados).catch(e => setErro(e instanceof Error ? e.message : 'Erro ao carregar'))
  }, [])
  useEffect(() => { carregar() }, [carregar])

  async function salvar(mudanca: { niveis?: Partial<Record<SmModulo, SmNivel>>; regras?: Partial<SmRegras> }, anterior: SmAcessoGestor, mensagem: string) {
    setDados(d => d && { ...d, niveis: { ...d.niveis, ...mudanca.niveis }, regras: { ...d.regras, ...mudanca.regras } })
    try {
      await proLaboreApi.sm.gestor.salvarPermissoes(mudanca)
      toast({
        mensagem,
        desfazer: async () => {
          await proLaboreApi.sm.gestor.salvarPermissoes({ niveis: anterior.niveis, regras: anterior.regras })
          setDados(d => d && { ...d, niveis: anterior.niveis, regras: anterior.regras })
        },
      })
    } catch (e) {
      setDados(anterior)
      toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível salvar', tom: 'bad' })
    }
  }

  function verComo() {
    definirVerComoSocialMedia(true)
    router.push('/pro-labore/sm')
  }

  return (
    <div className="sm-pagina">
      <header className="sm-pagina-cab">
        <div>
          <Rotulo>Equipe · Acessos · Papel Social Media</Rotulo>
          <h1 className="sm-ttl sm-h1">O que o Social Media enxerga</h1>
          <p>Acesso isolado: só o que ele precisa para produzir, atender e provar resultado.</p>
        </div>
        <Botao variante="pri" onClick={verComo}>Ver como Social Media</Botao>
      </header>
      <AssistenteAba aba="permissoes" aoMudar={carregar} />

      {erro && <p className="sm-erro" role="alert">{erro}</p>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}>
        <section className="sm-card" style={{ flex: '999 1 560px', minWidth: 0, padding: '8px 20px', gap: 0 }} aria-label="Nível de acesso por módulo">
          {!dados ? <div style={{ padding: '12px 0' }}><CardEsqueleto linhas={6} /></div> : SM_MODULOS.map(m => (
            <div key={m} className="sm-linha-item">
              <div className="sm-linha-item-texto">
                <b id={`mod-${m}`}>{MODULOS[m].nome}</b>
                <small>{MODULOS[m].nota}{dados.niveis[m] !== dados.padrao.niveis[m] && ' · fora do padrão'}</small>
              </div>
              <Segmentado
                variante="nivel"
                rotulo={`Nível de acesso: ${MODULOS[m].nome}`}
                opcoes={OPCOES_NIVEL}
                valor={dados.niveis[m]}
                aoMudar={nivel => {
                  if (nivel === dados.niveis[m]) return
                  const rotulo = OPCOES_NIVEL.find(o => o.valor === nivel)!.rotulo
                  salvar({ niveis: { [m]: nivel } }, dados, `${MODULOS[m].nome}: ${rotulo.toLowerCase()}.`)
                }}
              />
            </div>
          ))}
        </section>

        <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Responsavel dados={dados} aoMudar={carregar} />

          <Card titulo="Regras">
            {!dados ? <CardEsqueleto linhas={3} /> : REGRAS.map(r => (
              <div key={r.chave} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{r.rotulo}</div>
                  <div className="sm-legenda">{r.nota}</div>
                </div>
                <Toggle
                  ligado={dados.regras[r.chave]}
                  rotulo={r.rotulo}
                  aoMudar={v => salvar({ regras: { [r.chave]: v } }, dados, `${r.rotulo}: ${v ? 'ligado' : 'desligado'}.`)}
                />
              </div>
            ))}
          </Card>

          <ConexaoInstagram conta={dados?.conta ?? null} carregando={!dados} />
        </div>
      </div>
    </div>
  )
}

function Responsavel({ dados, aoMudar }: { dados: SmAcessoGestor | null; aoMudar: () => void }) {
  const toast = useToast()
  const membro = dados?.membro ?? null
  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState('')
  const [tratamento, setTratamento] = useState('')
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [convite, setConvite] = useState<{ link: string; emailEnviado: boolean } | null>(null)
  const [copiado, setCopiado] = useState(false)

  const mostrarFormulario = !membro || editando

  function abrirEdicao(reaproveitar: boolean) {
    setNome(reaproveitar && membro ? membro.nome : '')
    setTratamento(reaproveitar && membro ? membro.tratamento ?? '' : '')
    setEmail(reaproveitar && membro ? membro.email : '')
    setErro(null)
    setEditando(true)
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true); setErro(null)
    try {
      const r = await proLaboreApi.sm.gestor.convidar({ nome, tratamento: tratamento || null, email })
      setConvite(r); setCopiado(false); setEditando(false)
      aoMudar()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível enviar o convite')
    } finally { setEnviando(false) }
  }

  async function reenviar() {
    if (!membro) return
    setEnviando(true)
    try {
      const r = await proLaboreApi.sm.gestor.convidar({ nome: membro.nome, tratamento: membro.tratamento, email: membro.email })
      setConvite(r); setCopiado(false); aoMudar()
    } catch (err) {
      toast({ mensagem: err instanceof Error ? err.message : 'Não foi possível gerar o convite', tom: 'bad' })
    } finally { setEnviando(false) }
  }

  async function alternarAtivo() {
    if (!membro) return
    const ativo = membro.status === 'SUSPENSO'
    try {
      await proLaboreApi.sm.gestor.definirAtivo(ativo)
      aoMudar()
      toast({ mensagem: ativo ? 'Acesso reativado.' : 'Acesso suspenso. A sessão aberta cai na próxima ação.', desfazer: async () => { await proLaboreApi.sm.gestor.definirAtivo(!ativo); aoMudar() } })
    } catch (err) {
      toast({ mensagem: err instanceof Error ? err.message : 'Não foi possível alterar', tom: 'bad' })
    }
  }

  async function remover() {
    if (!membro || !window.confirm(`Remover o acesso de ${membro.nome}? Para voltar, será preciso um convite novo.`)) return
    try {
      await proLaboreApi.sm.gestor.removerMembro()
      setConvite(null)
      aoMudar()
      toast({ mensagem: 'Acesso removido.' })
    } catch (err) {
      toast({ mensagem: err instanceof Error ? err.message : 'Não foi possível remover', tom: 'bad' })
    }
  }

  async function copiar() {
    if (!convite) return
    try { await navigator.clipboard.writeText(convite.link); setCopiado(true) } catch { setCopiado(false) }
  }

  if (!dados) return <CardEsqueleto linhas={3} />

  return (
    <Card titulo="Responsável">
      {membro && !editando && (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{membro.nome}{membro.tratamento && membro.tratamento !== membro.nome && <span className="sm-legenda"> · “{membro.tratamento}”</span>}</div>
              <div className="sm-legenda" style={{ overflowWrap: 'anywhere' }}>{membro.email}</div>
            </div>
            <Chip tom={STATUS_MEMBRO[membro.status].tom}>{STATUS_MEMBRO[membro.status].texto}</Chip>
          </div>
          <div className="sm-legenda">
            {membro.status === 'ATIVO'
              ? (membro.ultimoAcessoEm ? `Último acesso ${haQuanto(membro.ultimoAcessoEm)}` : 'Ainda não entrou')
              : membro.status === 'CONVIDADO' && membro.conviteExpiraEm
                ? `Convite vale até ${new Date(membro.conviteExpiraEm).toLocaleDateString('pt-BR', { timeZone: 'America/Belem' })}`
                : membro.status === 'CONVITE_EXPIRADO' ? 'Gere um convite novo para liberar o acesso.' : 'Não consegue entrar até ser reativado.'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(membro.status === 'CONVIDADO' || membro.status === 'CONVITE_EXPIRADO') && <Botao onClick={reenviar} disabled={enviando}>{enviando ? 'Gerando…' : 'Gerar convite novo'}</Botao>}
            {membro.status === 'ATIVO' && <Botao onClick={reenviar} disabled={enviando}>{enviando ? 'Gerando…' : 'Link para trocar a senha'}</Botao>}
            {(membro.status === 'ATIVO' || membro.status === 'SUSPENSO') && <Botao onClick={alternarAtivo}>{membro.status === 'SUSPENSO' ? 'Reativar acesso' : 'Suspender acesso'}</Botao>}
            <Botao variante="fantasma" onClick={() => abrirEdicao(false)}>Trocar responsável</Botao>
            <Botao variante="fantasma" onClick={remover}>Remover</Botao>
          </div>
        </>
      )}

      {mostrarFormulario && (
        <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="sm-campo">Nome
            <input className="sm-input" value={nome} onChange={e => setNome(e.target.value)} required minLength={2} maxLength={80} autoComplete="off" />
          </label>
          <label className="sm-campo">Como chamar (na saudação)
            <input className="sm-input" value={tratamento} onChange={e => setTratamento(e.target.value)} maxLength={40} placeholder="Ex.: Ana" autoComplete="off" />
          </label>
          <label className="sm-campo">E-mail de acesso
            <input className="sm-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="[e-mail do social media]" autoComplete="off" />
          </label>
          {erro && <p className="sm-erro" role="alert">{erro}</p>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Botao type="submit" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar convite'}</Botao>
            {editando && <Botao variante="fantasma" onClick={() => setEditando(false)}>Cancelar</Botao>}
          </div>
          {membro && editando && <span className="sm-legenda">Ao trocar o e-mail, o acesso de {membro.nome} deixa de valer.</span>}
        </form>
      )}

      {convite && (
        <div className="sm-card" style={{ padding: 14, gap: 8, background: 'var(--sm-surface-2)' }} role="status">
          <b style={{ fontSize: 13 }}>{convite.emailEnviado ? 'Convite enviado por e-mail.' : 'Envio de e-mail não configurado: copie o link e mande para a pessoa.'}</b>
          <code style={{ fontSize: 12, overflowWrap: 'anywhere', color: 'var(--sm-text-muted)' }}>{convite.link}</code>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Botao onClick={copiar}>{copiado ? 'Copiado' : 'Copiar link'}</Botao>
            <span className="sm-legenda">Vale 7 dias e funciona uma vez só.</span>
          </div>
        </div>
      )}
    </Card>
  )
}

function ConexaoInstagram({ conta, carregando }: { conta: SmAcessoGestor['conta']; carregando: boolean }) {
  if (carregando) return <CardEsqueleto linhas={2} />
  const empresa = conta?.tipoConexao === 'EMPRESA'
  return (
    <section className="sm-card" style={{ gap: 10, borderColor: empresa && conta?.status !== 'bad' ? 'var(--sm-bn-ok-border)' : undefined }}>
      <h2 className="sm-h-card">Conexão do Instagram</h2>
      {!conta ? (
        <>
          <div className="sm-status neutro">Instagram não conectado</div>
          <p className="sm-legenda" style={{ margin: 0, lineHeight: 1.5 }}>Conecte a conta da empresa na aba Social Media para o responsável enxergar os números.</p>
        </>
      ) : empresa ? (
        <>
          <div className={`sm-status ${conta.status === 'bad' ? 'bad' : 'ok'}`}>
            {conta.status === 'bad' ? `Conectado pela empresa · falha na sincronização` : `Conectado pela empresa · @${conta.usuario}`}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--sm-text-muted)', lineHeight: 1.5 }}>
            A conta fica ligada ao Business Manager da empresa, não ao login pessoal. Se o responsável mudar, nada para de sincronizar.
          </p>
        </>
      ) : (
        <>
          <div className="sm-status warn">Conectado pelo login pessoal · @{conta.usuario}</div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--sm-text-muted)', lineHeight: 1.5 }}>
            Funciona, mas depende do login de uma pessoa. Use “Conectar pela empresa” na aba Social Media para não parar se alguém sair.
          </p>
          <Link href="/pro-labore/social-media" style={{ fontSize: 13 }}>Abrir a aba Social Media</Link>
        </>
      )}
    </section>
  )
}
