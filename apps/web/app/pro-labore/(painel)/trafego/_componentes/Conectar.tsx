'use client'

// Conexão com o Gerenciador de Anúncios: o dono cola um token de acesso
// (de preferência de um "usuário do sistema", que não expira), escolhe a
// conta de anúncios e o sistema já puxa os últimos 90 dias.
import { useState } from 'react'
import { proLaboreApi, type ContaDeAnuncioMeta, type ContaTrafego } from '@/lib/proLaboreApi'

export default function Conectar({ atual, onConectado, onCancelar }: {
  atual?: ContaTrafego | null
  onConectado: (c: ContaTrafego, aviso: string | null) => void
  onCancelar?: () => void
}) {
  const [token, setToken] = useState('')
  const [contas, setContas] = useState<ContaDeAnuncioMeta[] | null>(null)
  const [escolhida, setEscolhida] = useState(atual?.adAccountId ?? '')
  const [etapa, setEtapa] = useState<'token' | 'conta' | 'conectando'>('token')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function verContas(e: React.FormEvent) {
    e.preventDefault()
    setCarregando(true)
    setErro('')
    try {
      const l = await proLaboreApi.trafego.contasDisponiveis(token.trim())
      setContas(l)
      if (!l.some(c => c.id === escolhida)) setEscolhida((l.find(c => c.ativa) ?? l[0]).id)
      setEtapa('conta')
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setCarregando(false)
    }
  }

  async function conectar() {
    setEtapa('conectando')
    setErro('')
    try {
      const r = await proLaboreApi.trafego.conectar(token.trim(), escolhida)
      onConectado(r.conta, r.aviso)
    } catch (err) {
      setErro((err as Error).message)
      setEtapa('conta')
    }
  }

  return (
    <div className="pl-tf-conectar">
      <div className="pl-card pl-tf-conectar-caixa">
        <div className="pl-card-title">{atual ? 'Trocar token ou conta de anúncios' : 'Conectar o Gerenciador de Anúncios'}</div>
        <p className="pl-card-sub" style={{ margin: '6px 0 16px' }}>
          O sistema lê (só leitura) as métricas das suas campanhas na Meta todos os dias e monta o funil do anúncio até o lead no CRM.
          {atual && ' Trocando o token da mesma conta, o histórico continua.'}
        </p>

        {etapa === 'token' ? (
          <form onSubmit={verContas}>
            <label className="pl-field"><span>Token de acesso</span>
              <input className="pl-input pl-mono" autoFocus autoComplete="off" spellCheck={false} value={token} onChange={e => setToken(e.target.value)} placeholder="EAA…" />
            </label>
            <small className="pl-hint">O token fica guardado só no servidor, nunca aparece de novo na tela.</small>
            {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 10 }}>{erro}</div>}
            <div className="pl-ap-nova-botoes">
              {onCancelar && <button type="button" className="pl-btn pl-btn-ghost" onClick={onCancelar}>Cancelar</button>}
              <button type="submit" className="pl-btn pl-btn-primary" disabled={carregando || token.trim().length < 20}>{carregando ? 'Conferindo…' : 'Ver minhas contas de anúncio'}</button>
            </div>
          </form>
        ) : (
          <div>
            <div className="pl-field"><span>Qual conta de anúncios</span></div>
            <div className="pl-tf-contas" role="radiogroup" aria-label="Contas de anúncio">
              {(contas ?? []).map(c => (
                <label key={c.id} className={escolhida === c.id ? 'ativo' : ''}>
                  <input type="radio" name="conta" checked={escolhida === c.id} onChange={() => setEscolhida(c.id)} />
                  <span><b>{c.nome}</b><small>{c.id.replace('act_', 'ID ')} · {c.moeda}{c.ativa ? '' : ' · inativa'}</small></span>
                </label>
              ))}
            </div>
            {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 10 }}>{erro}</div>}
            <div className="pl-ap-nova-botoes">
              <button type="button" className="pl-btn pl-btn-ghost" disabled={etapa === 'conectando'} onClick={() => setEtapa('token')}>Voltar</button>
              <button type="button" className="pl-btn pl-btn-primary" disabled={etapa === 'conectando' || !escolhida} onClick={conectar}>
                {etapa === 'conectando' ? 'Conectando e puxando os últimos 90 dias…' : 'Conectar essa conta'}
              </button>
            </div>
          </div>
        )}
      </div>

      <details className="pl-card pl-tf-guia" open={!atual}>
        <summary>Como gerar o token (uma vez só, uns 5 minutos)</summary>
        <p>O melhor é um token de <b>usuário do sistema</b> do Gerenciador de Negócios: ele <b>não expira</b>, então a atualização diária nunca para.</p>
        <ol>
          <li>Entre em <b>business.facebook.com</b> → <b>Configurações do negócio</b>.</li>
          <li>Em <b>Usuários → Usuários do sistema</b>, clique em <b>Adicionar</b>: nome “ARIES”, função <b>Administrador</b>.</li>
          <li>Com ele selecionado, clique em <b>Atribuir ativos</b> → <b>Contas de anúncios</b> → marque a sua conta → permissão <b>Ver desempenho</b> → Salvar.</li>
          <li>Clique em <b>Gerar novo token</b> → escolha o app (o mesmo usado no Instagram serve) → validade <b>Nunca</b> → marque <b>ads_read</b> → <b>Gerar token</b>.</li>
          <li>Copie o token (começa com “EAA”) e cole aqui em cima.</li>
        </ol>
        <p className="pl-hint">Se <b>ads_read</b> não aparecer na lista, no painel do app em <b>developers.facebook.com</b> adicione o produto <b>API de Marketing</b> e tente de novo. O app precisa estar no mesmo Gerenciador de Negócios da conta de anúncios.</p>
        <p className="pl-hint">Trate o token como senha: não mande por mensagem nem em print. Se desconfiar que vazou, gere outro no mesmo lugar e cole aqui.</p>
      </details>
    </div>
  )
}
