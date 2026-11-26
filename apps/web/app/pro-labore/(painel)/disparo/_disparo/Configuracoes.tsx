'use client'

// Configurações do Disparo (o dono muda; os demais veem): envio automático, janela e ritmo, sequência,
// regras da loja (promoções, aprovação, rodapé e palavras de saída), números conectados e o que o
// provedor de WhatsApp consegue fazer. Redesign 26/11: índice, interruptores, horário em 24 h e a
// barra "Salvar" que aparece só quando algo mudou. Os mesmos campos e regras de antes.
import { useMemo, useState } from 'react'
import { disparoApi, type ConfigLojaDisparo } from '@/lib/proLaboreApi'
import { DIAS, erroDe, useMeta } from './util'
import { Hora, Interruptor, Quando, useAvisar } from './ui'

const SECOES = [['envio-automatico', 'Envio automático'], ['janela', 'Janela e ritmo'], ['sequencia', 'Sequência'], ['regras', 'Regras da loja'], ['numeros', 'Números'], ['limites', 'Limites do WhatsApp']] as const

export function Configuracoes({ aoSalvar }: { aoSalvar: () => void }) {
  const meta = useMeta()
  const avisar = useAvisar()
  const [c, setC] = useState<ConfigLojaDisparo>(meta.config)
  const [salvo, setSalvo] = useState<ConfigLojaDisparo>(meta.config)
  const [salvando, setSalvando] = useState(false)
  const e = c.envio
  const setE = (x: Partial<ConfigLojaDisparo['envio']>) => setC({ ...c, envio: { ...e, ...x } })
  const dono = meta.dono
  const mudou = useMemo(() => JSON.stringify(c) !== JSON.stringify(salvo), [c, salvo])
  async function salvar() {
    setSalvando(true)
    try { const n = await disparoApi.config.salvar(c); setC(n); setSalvo(n); avisar('Configurações salvas'); aoSalvar() } catch (err) { avisar(erroDe(err), 'erro') } finally { setSalvando(false) }
  }
  const cap = meta.capacidades
  const numero = (v: number, set: (n: number) => void, rotulo: string, min: number, max?: number) => (
    <input className="pl-input dp-num" type="number" inputMode="numeric" min={min} max={max} value={v} aria-label={rotulo} onChange={ev => set(Number(ev.target.value))} />
  )
  return (
    <div className="dp-config" data-disparo-config>
      <nav className="dp-config-indice" aria-label="Seções">
        {SECOES.map(([id, r]) => <a key={id} href={`#dp-${id}`}>{r}</a>)}
      </nav>
      <div className="dp-config-corpo">
        <section id="dp-envio-automatico" className="pl-card dp-secao" data-envio-automatico={meta.motor.rotinaLigada ? 'ligado' : 'desligado'}>
          <div className="dp-secao-topo">
            <div>
              <h3>Envio automático</h3>
              <p className="pl-hint">{meta.motor.rotinaLigada
                ? <>O ARIES envia as campanhas sozinho, mesmo com o sistema fechado. Última rodada <Quando iso={meta.motor.ultimaRotinaEm} />.</>
                : <>{meta.motor.ultimaRotinaEm ? <>Parado desde <Quando iso={meta.motor.ultimaRotinaEm} />.</> : 'Ainda não ligado.'} As campanhas continuam enviando sempre que alguém da equipe estiver com o ARIES aberto (qualquer tela).</>}</p>
            </div>
            <span className={`dp-selo ${meta.motor.rotinaLigada ? 'ok vivo' : 'warn'}`}>{meta.motor.rotinaLigada ? 'Ligado' : 'Parado'}</span>
          </div>
          {!meta.motor.rotinaLigada && (
            <details className="dp-detalhes">
              <summary>Para o técnico: como ligar (uma vez só)</summary>
              <ul className="pl-hint">
                <li>No cron-job.org, crie uma tarefa igual às do ARIES que já existem.</li>
                <li>Endereço: <span className="pl-mono">https://ariessistemacomercial.vercel.app/pro-labore/sm/cron/disparo</span></li>
                <li>Método POST, a cada 1 minuto, com o cabeçalho <span className="pl-mono">x-cron-secret</span> igual ao das outras tarefas.</li>
              </ul>
            </details>
          )}
        </section>

        {!dono && <p className="pl-hint dp-aviso-leitura">Só o dono altera as regras abaixo. Você está vendo os valores atuais.</p>}
        <fieldset disabled={!dono} className="dp-campos">
          <section id="dp-janela" className="pl-card dp-secao">
            <h3>Janela e ritmo</h3>
            <p className="pl-hint">O padrão de toda campanha nova. Cada campanha pode mudar no passo Envio.</p>
            <div className="dp-config-linhas">
              <div className="dp-config-linha">
                <span className="dp-config-rotulo">Horário (Brasília)</span>
                <div className="dp-linha"><Hora valor={e.janela.inicio} mudar={v => setE({ janela: { ...e.janela, inicio: v } })} rotulo="Início" id="cf-ini" /><span className="pl-hint">até</span><Hora valor={e.janela.fim} mudar={v => setE({ janela: { ...e.janela, fim: v } })} rotulo="Fim" id="cf-fim" /></div>
              </div>
              <div className="dp-config-linha">
                <span className="dp-config-rotulo">Dias</span>
                <div className="dp-dias" role="group" aria-label="Dias de envio">{DIAS.map((d, i) => <button key={d} type="button" aria-pressed={e.janela.dias.includes(i)} className={e.janela.dias.includes(i) ? 'on' : ''} onClick={() => setE({ janela: { ...e.janela, dias: e.janela.dias.includes(i) ? e.janela.dias.filter(x => x !== i) : [...e.janela.dias, i].sort() } })}>{d}</button>)}</div>
              </div>
              <div className="dp-config-linha">
                <span className="dp-config-rotulo">Ritmo por número</span>
                <p className="dp-frase">1 mensagem a cada {numero(e.intervaloSeg, v => setE({ intervaloSeg: v }), 'Segundos entre mensagens', 8)} s, até {numero(e.maxPorHora, v => setE({ maxPorHora: v }), 'Máximo por hora', 1, 400)} por hora e {numero(e.maxPorDia, v => setE({ maxPorDia: v }), 'Máximo por dia', 1, 3000)} por dia.</p>
              </div>
              <div className="dp-config-linha">
                <span className="dp-config-rotulo">Tentativas</span>
                <p className="dp-frase">Até {numero(e.maxTentativas, v => setE({ maxTentativas: v }), 'Tentativas por mensagem', 1, 8)} tentativas por mensagem quando o WhatsApp falhar.</p>
              </div>
            </div>
            <p className="pl-hint">O servidor nunca passa de 1 a cada 8 s, 400 por hora e 3.000 por dia por número. O limite vale para o número, somando todas as campanhas dele.</p>
          </section>

          <section id="dp-sequencia" className="pl-card dp-secao">
            <h3>Sequência</h3>
            <p className="pl-hint">Quando a campanha tem mais de uma mensagem, para de enviar para o contato que:</p>
            <Interruptor id="parar-responder" ligado={e.pararAoResponder} mudar={v => setE({ pararAoResponder: v })} rotulo="Responder" detalhe="A conversa passa para o vendedor." desabilitado={!dono} />
            <Interruptor id="parar-comprar" ligado={e.pararAoComprar} mudar={v => setE({ pararAoComprar: v })} rotulo="Comprar" detalhe="Venda registrada no CRM depois do início." desabilitado={!dono} />
            <Interruptor id="parar-vendedor" ligado={e.pararSeVendedorAssumir} mudar={v => setE({ pararSeVendedorAssumir: v })} rotulo="For atendido pelo vendedor" detalhe="O vendedor mandou mensagem para ele no WhatsApp." desabilitado={!dono} />
          </section>

          <section id="dp-regras" className="pl-card dp-secao">
            <h3>Regras da loja</h3>
            <span className="dp-config-rotulo">Mensagens promocionais vão para</span>
            <div className="dp-opcoes" role="radiogroup" aria-label="Mensagens promocionais vão para">
              <button type="button" role="radio" aria-checked={c.baseMarketing === 'EXPLICITA'} className={c.baseMarketing === 'EXPLICITA' ? 'on' : ''} onClick={() => setC({ ...c, baseMarketing: 'EXPLICITA' })}>
                <b>Só quem autorizou</b><span>Registro com base legal e evidência. Recomendado.</span>
              </button>
              <button type="button" role="radio" aria-checked={c.baseMarketing === 'RELACAO'} className={c.baseMarketing === 'RELACAO' ? 'on' : ''} onClick={() => setC({ ...c, baseMarketing: 'RELACAO' })}>
                <b>Também leads e clientes da loja</b><span>Quem não pediu para sair (legítimo interesse). A decisão e o risco são da loja.</span>
              </button>
            </div>
            <p className="pl-hint">Ter escrito para a loja não é autorização para receber promoções.</p>
            <Interruptor id="aprovacao" ligado={c.exigirAprovacao} mudar={v => setC({ ...c, exigirAprovacao: v })} rotulo="Aprovação" detalhe="Campanha de quem não é da gestão passa pelo dono ou pelo supervisor antes de sair." desabilitado={!dono} />
            <div className="dp-config-duas">
              <div className="pl-field"><label htmlFor="cf-rod">Rodapé das promocionais</label><input id="cf-rod" className="pl-input" maxLength={200} value={c.rodapeSair} onChange={ev => setC({ ...c, rodapeSair: ev.target.value })} /></div>
              <div className="pl-field"><label htmlFor="cf-sair">Palavras que descadastram</label><input id="cf-sair" className="pl-input" value={c.palavrasSair.join(', ')} onChange={ev => setC({ ...c, palavrasSair: ev.target.value.split(',').map(x => x.trim()).filter(Boolean) })} /><span className="pl-hint">Separadas por vírgula.</span></div>
            </div>
          </section>
        </fieldset>

        <section id="dp-numeros" className="pl-card dp-secao">
          <h3>Números conectados</h3>
          {!meta.remetentes.length ? <p className="pl-hint">Nenhum WhatsApp conectado. Conecte em Conversas › Conexão.</p> : (
            <ul className="dp-numeros">{meta.remetentes.map(r => (
              <li key={r.id}><span className={`dp-selo ${r.conectado ? 'ok' : 'crit'}`}>{r.conectado ? 'Conectado' : 'Desconectado'}</span><b>{r.vendedor}</b><span className="pl-hint">{r.numero ?? ''}{r.ativo ? '' : ' · vendedor inativo'}</span></li>
            ))}</ul>
          )}
        </section>

        <section id="dp-limites" className="pl-card dp-secao">
          <details className="dp-detalhes">
            <summary><b>Limites do WhatsApp conectado</b> <span className="pl-hint">o que esta conexão consegue fazer</span></summary>
            <ul className="pl-hint">
              <li>Texto, imagem, áudio, vídeo e documento: {cap.texto && cap.imagem && cap.audio && cap.video && cap.documento ? 'sim' : 'em parte'} (até {Math.round(cap.maxMidiaBytes / 1024 / 1024)} MB por arquivo)</li>
              <li>Modelos aprovados (templates) e botões: {cap.templates ? 'sim' : 'não'}</li>
              <li>Eventos: aceita {cap.eventos.aceita ? 'sim' : 'não'} · entregue {cap.eventos.entregue ? 'sim' : 'não'} · lida {cap.eventos.lida ? 'sim' : 'não'} · resposta {cap.eventos.resposta ? 'sim' : 'não'}</li>
              {cap.observacoes.map(o => <li key={o}>{o}</li>)}
            </ul>
          </details>
        </section>
      </div>
      {dono && mudou && (
        <div className="dp-salvar" role="region" aria-label="Alterações não salvas" data-salvar-config>
          <span>Você tem alterações não salvas.</span>
          <span className="dp-linha"><button type="button" className="pl-btn pl-btn-ghost" onClick={() => setC(salvo)} disabled={salvando}>Desfazer</button><button type="button" className="pl-btn pl-btn-primary" onClick={() => void salvar()} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar alterações'}</button></span>
        </div>
      )}
    </div>
  )
}
