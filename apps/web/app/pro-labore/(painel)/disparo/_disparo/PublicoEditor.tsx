'use client'

// Construtor de públicos: prontos, filtros E/OU (com um nível de subgrupo), seleção manual e a prévia
// (contagem, motivos de exclusão e a lista paginada no servidor — nunca milhares de contatos no navegador).
// Redesign 26/11: os quatro caminhos em abas (Prontos · Filtros · Escolher · Colar lista) e interruptores.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { disparoApi, type ItemCampanhaDisparo, type CanalDisparo, type CondicaoDisparo, type ConteudoDisparo, type DefinicaoPublicoDisparo, type FinalidadeDisparo, type GrupoDisparo, type PreviaPublicoDisparo } from '@/lib/proLaboreApi'
import { Paginacao, erroDe, n, useMeta, AvisoAutorizacao } from './util'
import { Interruptor } from './ui'

type AbaPublico = 'prontos' | 'filtros' | 'escolher' | 'colar' | 'campanha'

const BASES: Array<{ valor: DefinicaoPublicoDisparo['base']; rotulo: string }> = [
  { valor: 'TODOS', rotulo: 'Todos os contatos' }, { valor: 'LEADS', rotulo: 'Leads' }, { valor: 'CLIENTES', rotulo: 'Clientes' }, { valor: 'CONTATARAM', rotulo: 'Quem já escreveu no WhatsApp' }, { valor: 'EQUIPE', rotulo: 'Equipe (WhatsApp conectado)' },
]
const BASES_IG: Array<{ valor: DefinicaoPublicoDisparo['base']; rotulo: string }> = [
  { valor: 'INSTAGRAM_DM', rotulo: 'Quem mandou mensagem no direct (inclui resposta a story)' }, { valor: 'INSTAGRAM_COMENTARIOS', rotulo: 'Quem comentou nos posts (resposta privada)' },
]
/** "fecha em 3 h" / "até 28/11" — quanto tempo a Meta ainda deixa mandar para esta pessoa. */
export function textoJanela(iso: string | null, modo: 'DM' | 'COMENTARIO'): string {
  if (!iso) return 'janela fechada'
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'janela fechada'
  if (modo === 'COMENTARIO') return `resposta privada até ${new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
  const h = Math.floor(ms / 3_600_000)
  return h >= 1 ? `janela fecha em ${h} h` : `janela fecha em ${Math.max(1, Math.round(ms / 60_000))} min`
}
const OPS: Record<string, string> = { igual: 'é', em: 'é um destes', contem: 'contém', vazio: 'está vazio', entre: 'entre', ultimos_dias: 'nos últimos (dias)', ha_mais_de_dias: 'há mais de (dias)', maior: 'maior que', menor: 'menor que' }
const ETAPAS = ['LEAD', 'ABORDADO', 'LEVANTAMENTO', 'MQL', 'SQL', 'NEGOCIACAO', 'PROPOSTA', 'AGENDAMENTO', 'VISITA', 'VENDA']
const OPCOES: Record<string, Array<[string, string]>> = {
  situacao: [['ABERTO', 'Lead aberto'], ['PERDIDO', 'Lead perdido'], ['FECHADO', 'Lead com venda'], ['CLIENTE', 'Cliente'], ['CONTATO', 'Só conversa no WhatsApp'], ['EQUIPE', 'Equipe']],
  etapa: ETAPAS.map(e => [e, e.charAt(0) + e.slice(1).toLowerCase()]),
  regiao: [['Norte', 'Norte'], ['Nordeste', 'Nordeste'], ['Centro-Oeste', 'Centro-Oeste'], ['Sudeste', 'Sudeste'], ['Sul', 'Sul']],
  temperatura: [['QUENTE', 'Quente'], ['MORNO', 'Morno'], ['FRIO', 'Frio']],
  interacoes: [['CONVERSOU', 'Já conversou no WhatsApp'], ['NUNCA_CONVERSOU', 'Nunca conversou'], ['VISITOU', 'Teve visita'], ['PROPOSTA', 'Recebeu proposta']],
  reativado: [['true', 'Sim'], ['false', 'Não']],
  autorizacao: [['AUTORIZADO', 'Autorizou'], ['REVOGADO', 'Pediu para sair'], ['BLOQUEADO', 'Bloqueado'], ['SEM_REGISTRO', 'Sem registro']],
  destino_perda: [['REATIVACAO', 'Reativação']],
}
const ORIGEM_IG: Record<string, string> = { DIRECT: 'Direct', RESPOSTA_STORY: 'Respondeu story', COMENTARIO_AUTOMACAO: 'Comente a palavra-chave', COMENTARIO: 'Comentário' }
const ehGrupo = (x: CondicaoDisparo | GrupoDisparo): x is GrupoDisparo => Array.isArray((x as GrupoDisparo).itens)

function ValorCondicao({ c, mudar }: { c: CondicaoDisparo; mudar: (v: unknown) => void }) {
  const meta = useMeta()
  if (c.op === 'vazio') return null
  const opcoes = c.campo === 'vendedor' ? meta.vendedores.map(v => [v.id, v.nome] as [string, string]) : OPCOES[c.campo]
  if (c.op === 'entre') {
    const [a, b] = (Array.isArray(c.valor) ? c.valor : ['', '']) as string[]
    const tipo = ['cadastro', 'ultimo_contato', 'ultima_compra'].includes(c.campo) ? 'date' : 'number'
    return <><input className="pl-input dp-curto" type={tipo} value={a ?? ''} onChange={e => mudar([e.target.value, b])} aria-label="De" /><span className="pl-hint">e</span><input className="pl-input dp-curto" type={tipo} value={b ?? ''} onChange={e => mudar([a, e.target.value])} aria-label="Até" /></>
  }
  if (c.op === 'em' && opcoes) {
    const sel = new Set(Array.isArray(c.valor) ? (c.valor as string[]) : [])
    return <span className="cc-chips">{opcoes.map(([v, r]) => <button key={v} type="button" className={`pl-chip ${sel.has(v) ? 'active' : ''}`} onClick={() => { const s = new Set(sel); if (s.has(v)) s.delete(v); else s.add(v); mudar([...s]) }}>{r}</button>)}</span>
  }
  if (opcoes) return <select className="pl-select" value={String(c.valor ?? '')} onChange={e => mudar(e.target.value === 'true' ? true : e.target.value === 'false' ? false : e.target.value)} aria-label="Valor"><option value="">Escolha…</option>{opcoes.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select>
  const numerico = ['ultimos_dias', 'ha_mais_de_dias', 'maior', 'menor'].includes(c.op)
  return <input className="pl-input dp-curto" type={numerico ? 'number' : 'text'} value={String(c.valor ?? '')} onChange={e => mudar(numerico ? Number(e.target.value) : e.target.value)} placeholder={c.op === 'em' ? 'separe por vírgula' : ''} aria-label="Valor" />
}

function EditorGrupo({ g, mudar, nivel = 0, remover }: { g: GrupoDisparo; mudar: (g: GrupoDisparo) => void; nivel?: number; remover?: () => void }) {
  const meta = useMeta()
  const campos = meta.campos.filter(c => c.campo !== 'vendedor' || meta.gestao)
  const setItem = (i: number, it: CondicaoDisparo | GrupoDisparo) => mudar({ ...g, itens: g.itens.map((x, j) => (j === i ? it : x)) })
  const tirar = (i: number) => mudar({ ...g, itens: g.itens.filter((_, j) => j !== i) })
  return (
    <div className={`dp-grupo ${nivel ? 'dp-subgrupo' : ''}`}>
      <div className="dp-linha">
        <span className="pl-hint">{nivel ? 'Subgrupo:' : 'Combinar as condições com'}</span>
        {(['E', 'OU'] as const).map(o => <button key={o} type="button" className={`pl-chip ${g.op === o ? 'active' : ''}`} onClick={() => mudar({ ...g, op: o })}>{o === 'E' ? 'E (todas)' : 'OU (qualquer uma)'}</button>)}
        {remover && <button type="button" className="pl-btn" onClick={remover}>Tirar subgrupo</button>}
      </div>
      {g.itens.map((it, i) => ehGrupo(it) ? (
        <EditorGrupo key={i} g={it} nivel={nivel + 1} mudar={x => setItem(i, x)} remover={() => tirar(i)} />
      ) : (
        <div key={i} className="dp-condicao">
          <select className="pl-select" value={it.campo} onChange={e => { const campo = e.target.value; const op = meta.campos.find(c => c.campo === campo)?.ops[0] ?? 'igual'; setItem(i, { campo, op, valor: undefined }) }} aria-label="Campo">
            {campos.map(c => <option key={c.campo} value={c.campo}>{c.rotulo}</option>)}
          </select>
          <select className="pl-select" value={it.op} onChange={e => setItem(i, { ...it, op: e.target.value, valor: undefined })} aria-label="Operador">
            {(meta.campos.find(c => c.campo === it.campo)?.ops ?? []).map(o => <option key={o} value={o}>{OPS[o] ?? o}</option>)}
          </select>
          <ValorCondicao c={it} mudar={v => setItem(i, { ...it, valor: it.op === 'em' && typeof v === 'string' ? v.split(',').map(x => x.trim()).filter(Boolean) : v })} />
          <button type="button" className="pl-btn" onClick={() => tirar(i)} aria-label="Tirar condição">✕</button>
        </div>
      ))}
      <div className="dp-linha">
        <button type="button" className="pl-btn" onClick={() => mudar({ ...g, itens: [...g.itens, { campo: 'situacao', op: 'igual', valor: 'ABERTO' }] })}>+ Condição</button>
        {nivel === 0 && <button type="button" className="pl-btn" onClick={() => mudar({ ...g, itens: [...g.itens, { op: g.op === 'E' ? 'OU' : 'E', itens: [] }] })}>+ Subgrupo</button>}
      </div>
    </div>
  )
}

/** Lê uma lista colada: um número por linha (com ou sem nome), ou vários números numa linha. */
export function lerLista(texto: string): { numeros: Array<{ telefone: string; nome: string | null }>; ignoradas: number } {
  const numeros: Array<{ telefone: string; nome: string | null }> = []
  const vistos = new Set<string>()
  let ignoradas = 0
  for (const linha of texto.split(/\r?\n/)) {
    if (!linha.trim()) continue
    const achados = [...linha.matchAll(/\+?\(?\d[\d\s().-]{6,}\d/g)].map(m => m[0]).filter(m => m.replace(/\D/g, '').length >= 8)
    if (!achados.length) { ignoradas += 1; continue }
    const nome = achados.length === 1 ? linha.replace(achados[0], '').replace(/["']/g, '').replace(/[;,\t|]+/g, ' ').replace(/\s+-\s+/g, ' ').replace(/\s+/g, ' ').trim() || null : null
    for (const a of achados) {
      const dig = a.replace(/\D/g, '')
      if (vistos.has(dig)) continue
      vistos.add(dig)
      numeros.push({ telefone: a.trim(), nome: nome && /[a-zA-ZÀ-ú]/.test(nome) ? nome.slice(0, 160) : null })
    }
  }
  return { numeros, ignoradas }
}

export function PublicoEditor({ definicao, mudar, finalidade, conteudo, assistenteId, canal = 'WHATSAPP' }: { definicao: DefinicaoPublicoDisparo; mudar: (d: DefinicaoPublicoDisparo) => void; finalidade: FinalidadeDisparo; conteudo?: ConteudoDisparo | null; assistenteId?: string | null; canal?: CanalDisparo }) {
  const meta = useMeta()
  const ig = canal === 'INSTAGRAM'
  const [busca, setBusca] = useState('')
  const [achados, setAchados] = useState<Awaited<ReturnType<typeof disparoApi.publicos.contatos>>['itens']>([])
  const [previa, setPrevia] = useState<PreviaPublicoDisparo | null>(null)
  const [verExcluidos, setVerExcluidos] = useState(false)
  const [pagina, setPagina] = useState(0)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const ultima = useRef(0)
  const [totalAchados, setTotalAchados] = useState(0)
  const [mostrar, setMostrar] = useState(50)
  const [lista, setLista] = useState('')
  const [verEscolhidos, setVerEscolhidos] = useState(false)
  const manual = definicao.manual ?? {}
  const filtros = definicao.filtros ?? { op: 'E', itens: [] }
  const [aba, setAba] = useState<AbaPublico>(() => (definicao.base === 'CAMPANHA' ? 'campanha' : manual.numeros?.length ? 'colar' : filtros.itens.length ? 'filtros' : manual.incluir?.length ? 'escolher' : 'prontos'))

  const atualizar = useCallback(async (p = 0, exc = verExcluidos) => {
    const id = ++ultima.current
    setCarregando(true); setErro(null)
    try {
      const r = await disparoApi.publicos.previa({ definicao, finalidade, conteudo: conteudo ?? null, assistenteId: assistenteId ?? null, pagina: p, excluidos: exc })
      if (id === ultima.current) { setPrevia(r); setPagina(p) }
    } catch (e) { if (id === ultima.current) setErro(erroDe(e)) } finally { if (id === ultima.current) setCarregando(false) }
  }, [definicao, finalidade, conteudo, assistenteId, verExcluidos])
  useEffect(() => { const t = setTimeout(() => void atualizar(0), 600); return () => clearTimeout(t) }, [atualizar])
  useEffect(() => {
    if (busca.trim().length < 2) return
    const t = setTimeout(() => { disparoApi.publicos.contatos(busca).then(r => { setAchados(r.itens); setTotalAchados(r.total ?? r.itens.length) }).catch(() => setAchados([])) }, 350)
    return () => clearTimeout(t)
  }, [busca])

  const incluidos = manual.incluir ?? []
  const numerosLista = manual.numeros ?? []
  const lida = useMemo(() => lerLista(lista), [lista])
  return (
    <div className="dp-publico" data-publico-editor>
      {ig && (
        <div className="dp-guia" role="note" data-guia-instagram>
          <b>Quem pode receber pelo Instagram (regra da Meta)</b>
          <ol>
            <li><b>Quem mandou mensagem ou respondeu um story</b>: até 24 h depois da última mensagem da pessoa. Cada vez que ela escreve, a janela abre de novo.</li>
            <li><b>Quem comentou num post</b>: uma resposta privada no direct, em até 7 dias do comentário (só texto). Se a pessoa responder, as próximas mensagens saem normalmente.</li>
            <li><b>Seguidor que nunca interagiu não pode receber DM</b> pela API oficial — a Meta não libera a lista de seguidores. Para alcançar todos, use um story ou post com “comente QUERO”: quem comenta entra aqui.</li>
          </ol>
          <span className="pl-hint">A prévia mostra até quando cada pessoa pode receber. O envio confere a janela de novo antes de cada mensagem: quem passou do prazo fica de fora (nunca é enviado fora da regra).</span>
        </div>
      )}
      {ig && (
        <div className="pl-field"><label>① Públicos do Instagram</label>
          <div className="cc-chips">
            {meta.predefinidos.filter(p => p.grupo === 'INSTAGRAM').map(p => <button key={p.chave} type="button" title={p.descricao} className={`pl-chip ${definicao.predefinido === p.chave ? 'active' : ''}`} onClick={() => mudar({ ...p.definicao, predefinido: p.chave })} data-ig-chip={p.chave}>{p.nome}</button>)}
          </div>
          <div className="pl-field" style={{ marginTop: 12 }}><label htmlFor="dp-base-ig">② De onde vêm os contatos</label>
            <select id="dp-base-ig" className="pl-select" value={definicao.base} onChange={e => mudar({ base: e.target.value as DefinicaoPublicoDisparo['base'], predefinido: null })}>
              {BASES_IG.map(b => <option key={b.valor} value={b.valor}>{b.rotulo}</option>)}
            </select>
          </div>
        </div>
      )}
      {!ig && <>
      <p className="pl-hint dp-publico-guia">Use um caminho ou combine: quem você escolhe à mão ou cola soma ao público pronto e aos filtros. A prévia abaixo mostra exatamente quem vai receber e quem fica de fora (com o motivo).</p>
      <div className="dp-subabas" role="tablist" aria-label="Como montar o público">
        {([['prontos', 'Prontos', definicao.predefinido ? '●' : ''], ['filtros', 'Filtros', filtros.itens.length || ''], ['escolher', 'Escolher pessoas', (manual.incluir ?? []).length || ''], ['colar', 'Colar lista', (manual.numeros ?? []).length || ''], ['campanha', 'De uma campanha', definicao.base === 'CAMPANHA' ? '●' : '']] as Array<[AbaPublico, string, string | number]>).map(([k, r, q]) => (
          <button key={k} type="button" role="tab" aria-selected={aba === k} className={aba === k ? 'on' : ''} onClick={() => setAba(k)} data-aba-publico={k}>{r}{q !== '' && <small>{q}</small>}</button>
        ))}
      </div>
      <div className="dp-subaba-corpo" role="tabpanel">
      {aba === 'prontos' && (
      <div className="pl-field"><label>Públicos prontos</label>
        <div className="cc-chips">
          {meta.predefinidos.filter(p => !p.grupo).map(p => <button key={p.chave} type="button" title={p.descricao} className={`pl-chip ${definicao.predefinido === p.chave ? 'active' : ''}`} onClick={() => mudar({ ...p.definicao, predefinido: p.chave, manual: definicao.manual })}>{p.nome}</button>)}
        </div>
        <span className="pl-hint" style={{ marginTop: 8 }}>Etapas do CRM (atualizam sozinhas conforme a equipe move os leads):</span>
        <div className="cc-chips">
          {meta.predefinidos.filter(p => p.grupo === 'JORNADA').map(p => <button key={p.chave} type="button" title={p.descricao} className={`pl-chip ${definicao.predefinido === p.chave ? 'active' : ''}`} onClick={() => mudar({ ...p.definicao, predefinido: p.chave, manual: definicao.manual })} data-etapa-chip={p.chave}>{p.nome}</button>)}
        </div>
      </div>
      )}
      {aba === 'campanha' && <DeUmaCampanha definicao={definicao} mudar={mudar} />}
      {aba === 'filtros' && <>
      {definicao.base === 'CAMPANHA' && <p className="pl-hint">Base: quem recebeu uma campanha (aba “De uma campanha”). Os filtros abaixo valem para quem está no CRM; número fora do CRM não tem esses dados e fica de fora quando há filtro.</p>}
      <div className="pl-field-grid">
        <div className="pl-field"><label htmlFor="dp-base">De onde vêm os contatos</label>
          <select id="dp-base" className="pl-select" value={definicao.base} onChange={e => mudar({ ...definicao, base: e.target.value as DefinicaoPublicoDisparo['base'], predefinido: null, campanha: e.target.value === 'CAMPANHA' ? definicao.campanha : null })}>
            {BASES.filter(b => meta.gestao || (b.valor !== 'CLIENTES' && b.valor !== 'EQUIPE')).map(b => <option key={b.valor} value={b.valor}>{b.rotulo}</option>)}
            {definicao.base === 'CAMPANHA' && <option value="CAMPANHA">Quem recebeu uma campanha</option>}
          </select>
        </div>
      </div>
      <div className="pl-field" style={{ marginTop: 12 }}><label>Filtros (opcional)</label>
        <EditorGrupo g={filtros} mudar={g => mudar({ ...definicao, filtros: g, predefinido: null })} />
      </div>
      </>}
      {aba === 'escolher' && (
      <div className="pl-field"><label htmlFor="dp-busca">Escolher pessoas ({meta.gestao ? 'busca em todos os contatos da loja' : 'busca nos seus leads e conversas'})</label>
        <input id="dp-busca" className="pl-input" placeholder="Nome ou telefone (ex.: João, 9822)" value={busca} onChange={e => { setBusca(e.target.value); setMostrar(50) }} />
        {busca.trim().length >= 2 && (
          <div className="dp-linha" style={{ justifyContent: 'space-between', marginTop: 6 }}>
            <span className="pl-hint">{achados.length ? `${achados.length}${totalAchados > achados.length ? ` de ${totalAchados}` : ''} encontrado(s)` : 'Ninguém encontrado'}</span>
            {achados.length > 1 && <button type="button" className="pl-btn" data-adicionar-todos onClick={() => { const novos = achados.filter(a => !incluidos.some(x => x.id === a.id)).map(a => ({ tipo: a.tipo, id: a.id, nome: a.nome })); mudar({ ...definicao, manual: { ...manual, incluir: [...incluidos, ...novos] } }) }}>Adicionar todos ({achados.filter(a => !incluidos.some(x => x.id === a.id)).length})</button>}
          </div>
        )}
        {busca.trim().length >= 2 && achados.length > 0 && (
          <ul className="ar-fila" style={{ marginTop: 6 }}>
            {achados.slice(0, mostrar).map(a => {
              const ja = incluidos.some(x => x.id === a.id)
              return (
                <li key={`${a.tipo}:${a.id}`} className="ar-fila-item">
                  <div><div className="ar-fila-titulo">{a.nome}</div><div className="pl-hint">{a.telefone ?? 'sem telefone'} · {a.situacao.toLowerCase()}{a.vendedor ? ` · ${a.vendedor}` : ''}</div></div>
                  <button type="button" className={`pl-btn ${ja ? '' : 'pl-btn-primary'}`} onClick={() => mudar({ ...definicao, manual: { ...manual, incluir: ja ? incluidos.filter(x => x.id !== a.id) : [...incluidos, { tipo: a.tipo, id: a.id, nome: a.nome }] } })}>{ja ? 'Adicionado ✓' : 'Adicionar'}</button>
                </li>
              )
            })}
            {achados.length > mostrar && <li className="ar-fila-item"><button type="button" className="pl-btn" onClick={() => setMostrar(m => m + 100)}>Mostrar mais ({achados.length - mostrar})</button></li>}
          </ul>
        )}
      </div>
      )}
      {aba === 'colar' && (
      <div className="pl-field"><label htmlFor="dp-lista">Colar uma lista de números (de planilha, conversa ou qualquer lugar — mesmo quem não está no CRM{meta.gestao ? '' : '; lead de outro vendedor fica de fora'})</label>
        <textarea id="dp-lista" className="pl-input" rows={4} value={lista} onChange={e => setLista(e.target.value)} placeholder={'Um por linha. Pode ter o nome junto:\nMaria Souza; (91) 98888-7777\n91 99999-0000\nJoão, 5591988887777'} />
        <div className="dp-linha" style={{ marginTop: 6 }}>
          <span className="pl-hint">{lida.numeros.length ? `${lida.numeros.length} número(s) reconhecido(s)${lida.ignoradas ? ` · ${lida.ignoradas} linha(s) sem número` : ''}` : 'Cole ou envie um arquivo .csv/.txt'}</span>
          <label className="pl-btn" style={{ cursor: 'pointer' }}>Enviar arquivo<input type="file" hidden accept=".csv,.txt,text/csv,text/plain" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void f.text().then(t => setLista(l => (l ? `${l}\n${t}` : t))) }} /></label>
          <button type="button" className="pl-btn pl-btn-primary" disabled={!lida.numeros.length} data-adicionar-lista onClick={() => { const ja = new Set(numerosLista.map(x => x.telefone.replace(/\D/g, ''))); const novos = lida.numeros.filter(x => !ja.has(x.telefone.replace(/\D/g, ''))); mudar({ ...definicao, manual: { ...manual, numeros: [...numerosLista, ...novos], listaAutorizada: manual.listaAutorizada ?? true } }); setLista('') }}>Adicionar {lida.numeros.length || ''} à lista</button>
        </div>
      </div>
      )}
      </div>

      {(incluidos.length > 0 || numerosLista.length > 0) && (
        <div className="dp-escolhidos" data-escolhidos>
          <div className="dp-linha" style={{ justifyContent: 'space-between' }}>
            <b>{incluidos.length + numerosLista.length} escolhido(s) à mão{numerosLista.length ? ` (${numerosLista.length} da lista colada)` : ''}</b>
            <span className="cc-chips">
              <button type="button" className="pl-btn" onClick={() => setVerEscolhidos(v => !v)}>{verEscolhidos ? 'Esconder' : 'Ver quem'}</button>
              <button type="button" className="pl-btn" onClick={() => mudar({ ...definicao, manual: { ...manual, incluir: [], numeros: [] } })}>Tirar todos</button>
            </span>
          </div>
          {numerosLista.length > 0 && (
            <div data-lista-autorizada><Interruptor id="lista-autorizada" ligado={!!manual.listaAutorizada} mudar={v => mudar({ ...definicao, manual: { ...manual, listaAutorizada: v } })} rotulo="As pessoas da lista colada aceitaram receber mensagens da loja" detalhe="Assim números novos recebem também promoção. O ARIES registra a autorização de cada número em seu nome (data e campanha) para a LGPD. Quem já pediu para sair continua de fora." /></div>
          )}
          <Interruptor id="apenas-manual" ligado={!!manual.apenasManual} mudar={v => mudar({ ...definicao, manual: { ...manual, apenasManual: v } })} rotulo="Enviar só para os escolhidos" detalhe="Ignora o público pronto, a base e os filtros. Desligado, os escolhidos são somados ao público." />
          {verEscolhidos && (
            <div className="cc-chips" style={{ marginTop: 6, maxHeight: 220, overflow: 'auto' }}>
              {incluidos.map(x => <button key={x.id} type="button" className="pl-chip active" onClick={() => mudar({ ...definicao, manual: { ...manual, incluir: incluidos.filter(y => y.id !== x.id) } })} title="Tirar">{x.nome ?? x.id} ✕</button>)}
              {numerosLista.map(x => <button key={x.telefone} type="button" className="pl-chip active" onClick={() => mudar({ ...definicao, manual: { ...manual, numeros: numerosLista.filter(y => y.telefone !== x.telefone) } })} title="Tirar">{x.nome ? `${x.nome} · ` : ''}{x.telefone} ✕</button>)}
            </div>
          )}
        </div>
      )}
      </>}
      <div>
        {(manual.excluir ?? []).length > 0 && <p className="pl-hint">{manual.excluir!.length} número(s) tirado(s) à mão. <button type="button" className="pl-btn" onClick={() => mudar({ ...definicao, manual: { ...manual, excluir: [] } })}>Devolver todos</button></p>}
      </div>

      <section className="dp-previa" aria-live="polite" data-previa>
        <div className="dp-linha" style={{ justifyContent: 'space-between' }}>
          <b>Prévia dos destinatários</b>
          <button type="button" className="pl-btn" onClick={() => void atualizar(0)} disabled={carregando}>{carregando ? 'Contando…' : 'Atualizar'}</button>
        </div>
        {erro && <div className="pl-alert pl-alert-error" role="alert">{erro}</div>}
        {previa && (
          <>
            <div className="dp-totais">
              <div><span>Selecionados</span><b>{n(previa.selecionados)}</b></div>
              <div><span>Vão receber</span><b data-elegiveis>{n(previa.elegiveis)}</b></div>
              <div><span>Excluídos</span><b>{n(previa.excluidos)}</b></div>
            </div>
            {Object.keys(previa.porMotivo).length > 0 && (
              <ul className="pl-hint" style={{ margin: '6px 0', paddingLeft: 18 }}>
                {Object.entries(previa.porMotivo).sort((a, b) => b[1] - a[1]).map(([m, q]) => <li key={m}>{meta.motivos[m] ?? m}: <b>{n(q)}</b></li>)}
              </ul>
            )}
            {finalidade === 'MARKETING' && !ig && <AvisoAutorizacao quantos={previa.porMotivo.SEM_AUTORIZACAO ?? 0} aoMudar={() => void atualizar(0)} />}
            {previa.exemplo && <div className="dp-exemplo"><span className="pl-hint">Como o primeiro contato vai receber:</span>{previa.exemplo.map((t, i) => <p key={i}>{t || <i>(arquivo)</i>}</p>)}</div>}
            <div className="dp-linha">
              <button type="button" className={`pl-chip ${!verExcluidos ? 'active' : ''}`} onClick={() => { setVerExcluidos(false); void atualizar(0, false) }}>Quem vai receber</button>
              <button type="button" className={`pl-chip ${verExcluidos ? 'active' : ''}`} onClick={() => { setVerExcluidos(true); void atualizar(0, true) }}>Excluídos</button>
            </div>
            <div className="pl-table-wrap">
              <table className="pl-table">
                <thead><tr><th>Contato</th><th>{ig ? 'Instagram' : 'Telefone'}</th><th>{ig ? 'Origem' : 'Situação'}</th><th>{ig ? 'Pode receber' : 'Vendedor'}</th><th>{verExcluidos ? 'Motivo' : ig ? 'Como vai' : 'Autorização'}</th><th /></tr></thead>
                <tbody>
                  {previa.pagina.map((c, i) => (
                    <tr key={`${c.telefoneCompleto ?? i}`}>
                      {c.instagram ? <>
                        <td>{c.nome}</td><td className="pl-mono">{c.telefone ?? '—'}</td><td>{ORIGEM_IG[c.instagram.canal] ?? c.instagram.canal}</td><td data-janela>{textoJanela(c.instagram.janelaAte, c.instagram.modo)}</td>
                        <td>{verExcluidos ? meta.motivos[c.motivo ?? ''] ?? c.motivo : c.instagram.modo === 'COMENTARIO' ? 'resposta privada' : 'direct'}</td>
                      </> : <>
                      <td>{c.nome}</td><td className="pl-mono">{c.telefone ?? '—'}</td><td>{c.situacao.toLowerCase()}{c.etapa ? ` · ${c.etapa.toLowerCase()}` : ''}</td><td>{c.vendedor ?? '—'}</td>
                      <td>{verExcluidos ? meta.motivos[c.motivo ?? ''] ?? c.motivo : c.autorizacao === 'AUTORIZADO' ? 'autorizou' : 'sem registro'}</td>
                      </>}
                      <td>{!verExcluidos && c.telefoneCompleto && <button type="button" className="pl-btn" onClick={() => mudar({ ...definicao, manual: { ...manual, excluir: [...(manual.excluir ?? []), c.telefoneCompleto!] } })}>Tirar</button>}</td>
                    </tr>
                  ))}
                  {!previa.pagina.length && <tr><td colSpan={6} className="pl-hint">Ninguém nesta lista.</td></tr>}
                </tbody>
              </table>
            </div>
            <Paginacao pagina={pagina} total={previa.total} porPagina={previa.porPagina} ir={p => void atualizar(p)} />
          </>
        )}
      </section>
    </div>
  )
}

/** Quem recebeu uma campanha de WhatsApp e respondeu, ou não respondeu (para dar sequência a cada grupo). */
function DeUmaCampanha({ definicao, mudar }: { definicao: DefinicaoPublicoDisparo; mudar: (d: DefinicaoPublicoDisparo) => void }) {
  const meta = useMeta()
  const [busca, setBusca] = useState('')
  const [itens, setItens] = useState<ItemCampanhaDisparo[] | null>(null)
  useEffect(() => {
    const t = setTimeout(() => {
      disparoApi.campanhas.listar({ de: meta.gestao ? 'equipe' : undefined, busca: busca.trim() || undefined })
        .then(r => setItens(r.itens.filter(c => (c.canal ?? 'WHATSAPP') === 'WHATSAPP' && !!c.iniciadaEm))).catch(() => setItens([]))
    }, 300)
    return () => clearTimeout(t)
  }, [busca, meta.gestao])
  const ref = definicao.base === 'CAMPANHA' ? definicao.campanha : null
  const escolher = (id: string, quem: 'RESPONDERAM' | 'NAO_RESPONDERAM') => mudar({ base: 'CAMPANHA', campanha: { id, quem }, predefinido: null, filtros: null, manual: definicao.manual })
  return (
    <div className="pl-field" data-publico-campanha>
      <label htmlFor="dp-camp-busca">Quem recebeu uma campanha</label>
      <p className="pl-hint" style={{ margin: '0 0 8px' }}>Separe quem respondeu de quem não respondeu e mande a mensagem certa para cada grupo. {meta.gestao ? 'Campanhas da loja toda.' : 'Só as suas campanhas.'} Quem pediu para sair fica de fora.</p>
      <div className="dp-linha" style={{ marginBottom: 8 }}>
        <span role="radiogroup" aria-label="Quem" className="dp-seg p">
          {([['RESPONDERAM', 'Responderam'], ['NAO_RESPONDERAM', 'Não responderam']] as const).map(([v, r]) => <button key={v} type="button" role="radio" aria-checked={ref?.quem === v} className={ref?.quem === v ? 'on' : ''} disabled={!ref} onClick={() => ref && escolher(ref.id, v)}>{r}</button>)}
        </span>
        <input id="dp-camp-busca" className="pl-input dp-busca" type="search" placeholder="Buscar campanha" value={busca} onChange={e => setBusca(e.target.value)} />
      </div>
      {!itens ? <p className="pl-hint" aria-busy="true">Carregando…</p> : !itens.length ? <p className="pl-hint">Nenhuma campanha de WhatsApp que já começou a enviar.</p> : (
        <ul className="ar-fila">
          {itens.map(c => {
            const on = ref?.id === c.id
            return (
              <li key={c.id} className="ar-fila-item">
                <div><div className="ar-fila-titulo">{c.nome}</div><div className="pl-hint">{meta.finalidades[c.finalidade]}{c.iniciadaEm ? ` · começou ${new Date(c.iniciadaEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : ''}{c.criadoPorNome ? ` · ${c.criadoPorNome}` : ''}</div></div>
                <span className="cc-chips">
                  <button type="button" className={`pl-btn ${on && ref?.quem === 'RESPONDERAM' ? 'pl-btn-primary' : ''}`} onClick={() => escolher(c.id, 'RESPONDERAM')} data-campanha-quem="RESPONDERAM">Responderam{on && ref?.quem === 'RESPONDERAM' ? ' ✓' : ''}</button>
                  <button type="button" className={`pl-btn ${on && ref?.quem === 'NAO_RESPONDERAM' ? 'pl-btn-primary' : ''}`} onClick={() => escolher(c.id, 'NAO_RESPONDERAM')} data-campanha-quem="NAO_RESPONDERAM">Não responderam{on && ref?.quem === 'NAO_RESPONDERAM' ? ' ✓' : ''}</button>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
