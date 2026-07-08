'use client'

import { useState } from 'react'
import { ProtocoloDetalhe } from '@/lib/api'

const INPUT = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const LABEL = 'block text-xs font-medium text-gray-600 mb-1'

function listaParaTexto(lista?: string[]): string {
  return (lista ?? []).join('\n')
}
function textoParaLista(texto: string): string[] {
  return texto.split('\n').map(l => l.trim()).filter(Boolean)
}

function CampoTexto({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={INPUT} />
    </div>
  )
}

function CampoLista({ label, value, onChange, dica }: {
  label: string; value: string; onChange: (v: string) => void; dica?: string
}) {
  return (
    <div>
      <label className={LABEL}>{label} <span className="text-gray-400 font-normal">(um item por linha{dica ? ` — ${dica}` : ''})</span></label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={4} className={INPUT} />
    </div>
  )
}

interface Par { a: string; b: string }

function CampoPares({ label, labelA, labelB, pares, onChange }: {
  label: string; labelA: string; labelB: string; pares: Par[]; onChange: (p: Par[]) => void
}) {
  function set(i: number, campo: 'a' | 'b', v: string) {
    const novo = [...pares]
    novo[i] = { ...novo[i], [campo]: v }
    onChange(novo)
  }
  function remover(i: number) {
    onChange(pares.filter((_, idx) => idx !== i))
  }
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <div className="space-y-2">
        {pares.map((p, i) => (
          <div key={i} className="flex gap-2">
            <input value={p.a} onChange={e => set(i, 'a', e.target.value)} placeholder={labelA} className={INPUT} />
            <input value={p.b} onChange={e => set(i, 'b', e.target.value)} placeholder={labelB} className={INPUT} />
            <button type="button" onClick={() => remover(i)} className="text-red-500 text-xs px-2">✕</button>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...pares, { a: '', b: '' }])}
          className="text-xs font-medium text-blue-600 hover:text-blue-800">+ Adicionar</button>
      </div>
    </div>
  )
}

interface EtapaPop { titulo: string; descricao: string; checklist: string }
interface AnexoForm { titulo: string; itens: string }

function CampoPop({ etapas, onChange }: { etapas: EtapaPop[]; onChange: (e: EtapaPop[]) => void }) {
  function set(i: number, campo: keyof EtapaPop, v: string) {
    const novo = [...etapas]
    novo[i] = { ...novo[i], [campo]: v }
    onChange(novo)
  }
  function remover(i: number) {
    onChange(etapas.filter((_, idx) => idx !== i))
  }
  return (
    <div>
      <label className={LABEL}>POP — Etapas do Procedimento Operacional Padrão</label>
      <div className="space-y-3">
        {etapas.map((e, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
            <div className="flex gap-2">
              <input value={e.titulo} onChange={ev => set(i, 'titulo', ev.target.value)} placeholder="Título da etapa" className={INPUT} />
              <button type="button" onClick={() => remover(i)} className="text-red-500 text-xs px-2">✕</button>
            </div>
            <textarea value={e.descricao} onChange={ev => set(i, 'descricao', ev.target.value)} placeholder="Descrição (opcional)" rows={2} className={INPUT} />
            <textarea value={e.checklist} onChange={ev => set(i, 'checklist', ev.target.value)} placeholder="Checklist desta etapa — um item por linha (opcional)" rows={2} className={INPUT} />
          </div>
        ))}
        <button type="button" onClick={() => onChange([...etapas, { titulo: '', descricao: '', checklist: '' }])}
          className="text-xs font-medium text-blue-600 hover:text-blue-800">+ Adicionar Etapa</button>
      </div>
    </div>
  )
}

function CampoAnexos({ anexos, onChange }: { anexos: AnexoForm[]; onChange: (a: AnexoForm[]) => void }) {
  function set(i: number, campo: keyof AnexoForm, v: string) {
    const novo = [...anexos]
    novo[i] = { ...novo[i], [campo]: v }
    onChange(novo)
  }
  function remover(i: number) {
    onChange(anexos.filter((_, idx) => idx !== i))
  }
  return (
    <div>
      <label className={LABEL}>Anexos / Checklists (ex: Kit de Entrega)</label>
      <div className="space-y-3">
        {anexos.map((a, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
            <div className="flex gap-2">
              <input value={a.titulo} onChange={ev => set(i, 'titulo', ev.target.value)} placeholder="Título do anexo" className={INPUT} />
              <button type="button" onClick={() => remover(i)} className="text-red-500 text-xs px-2">✕</button>
            </div>
            <textarea value={a.itens} onChange={ev => set(i, 'itens', ev.target.value)} placeholder="Itens — um por linha" rows={3} className={INPUT} />
          </div>
        ))}
        <button type="button" onClick={() => onChange([...anexos, { titulo: '', itens: '' }])}
          className="text-xs font-medium text-blue-600 hover:text-blue-800">+ Adicionar Anexo</button>
      </div>
    </div>
  )
}

// Rotina/Reuniões viram array de {chave,valor} (não objeto) para preservar a
// ordem das cadências — JSONB no Postgres não garante ordem de chaves de objeto.
function cadenciasParaPares(dados?: { chave: string; valor: string }[]): Par[] {
  return (dados ?? []).map(d => ({ a: d.chave, b: d.valor }))
}
function paresParaCadencias(pares: Par[]): { chave: string; valor: string }[] {
  return pares.filter(p => p.a.trim()).map(p => ({ chave: p.a.trim(), valor: p.b }))
}
function itemPrazoParaPares(lista?: { item: string; prazo: string }[]): Par[] {
  return (lista ?? []).map(x => ({ a: x.item, b: x.prazo }))
}
function categoriaIndicadorParaPares(lista?: { categoria: string; indicador: string }[]): Par[] {
  return (lista ?? []).map(x => ({ a: x.categoria, b: x.indicador }))
}
function cenarioAcaoParaPares(lista?: { cenario: string; acao: string }[]): Par[] {
  return (lista ?? []).map(x => ({ a: x.cenario, b: x.acao }))
}

export interface ProtocoloFormData {
  categoria: string
  nome: string
  versao: string
  status: string
  objetivo: string
  resultadoEsperado: string[]
  responsaveis: string[]
  processo: string[]
  pop: { titulo: string; descricao?: string; checklist?: string[] }[]
  regras: string[]
  ferramentas: string[]
  rotina: { chave: string; valor: string }[]
  sla: { item: string; prazo: string }[]
  kpis: { categoria: string; indicador: string }[]
  auditoriaItens: string[]
  frequenciaAuditoria: string
  criteriosConformidade: string[]
  naoConformidadesCatalogo: string[]
  reunioes: { chave: string; valor: string }[]
  perguntasAnalise: string[]
  riscos: string[]
  planoContingencia: { cenario: string; acao: string }[]
  oportunidadesMelhoriaNotas: string[]
  automacoesPossiveis: string[]
  iaAplicavel: string[]
  revisaoFrequencia: string
  revisaoResponsavel: string
  anexos: { titulo: string; itens: string[] }[]
}

export default function ProtocoloForm({ inicial, onSubmit, textoBotao }: {
  inicial?: ProtocoloDetalhe
  onSubmit: (data: ProtocoloFormData) => Promise<void>
  textoBotao: string
}) {
  const [categoria, setCategoria] = useState(inicial?.categoria ?? 'Comercial')
  const [nome, setNome] = useState(inicial?.nome ?? '')
  const [versao, setVersao] = useState(inicial?.versao ?? '1.0.0')
  const [status, setStatus] = useState(inicial?.status ?? 'ativo')
  const [objetivo, setObjetivo] = useState(inicial?.objetivo ?? '')
  const [resultadoEsperado, setResultadoEsperado] = useState(listaParaTexto(inicial?.resultadoEsperado))
  const [responsaveis, setResponsaveis] = useState(listaParaTexto(inicial?.responsaveis))
  const [processo, setProcesso] = useState(listaParaTexto(inicial?.processo))
  const [pop, setPop] = useState<EtapaPop[]>(
    (inicial?.pop ?? []).map(e => ({ titulo: e.titulo, descricao: e.descricao ?? '', checklist: (e.checklist ?? []).join('\n') }))
  )
  const [regras, setRegras] = useState(listaParaTexto(inicial?.regras))
  const [ferramentas, setFerramentas] = useState(listaParaTexto(inicial?.ferramentas))
  const [rotina, setRotina] = useState<Par[]>(cadenciasParaPares(inicial?.rotina))
  const [sla, setSla] = useState<Par[]>(itemPrazoParaPares(inicial?.sla))
  const [kpis, setKpis] = useState<Par[]>(categoriaIndicadorParaPares(inicial?.kpis))
  const [auditoriaItens, setAuditoriaItens] = useState(listaParaTexto(inicial?.auditoriaItens))
  const [frequenciaAuditoria, setFrequenciaAuditoria] = useState(inicial?.frequenciaAuditoria ?? '')
  const [criteriosConformidade, setCriteriosConformidade] = useState(listaParaTexto(inicial?.criteriosConformidade))
  const [naoConformidadesCatalogo, setNaoConformidadesCatalogo] = useState(listaParaTexto(inicial?.naoConformidadesCatalogo))
  const [reunioes, setReunioes] = useState<Par[]>(cadenciasParaPares(inicial?.reunioes))
  const [perguntasAnalise, setPerguntasAnalise] = useState(listaParaTexto(inicial?.perguntasAnalise))
  const [riscos, setRiscos] = useState(listaParaTexto(inicial?.riscos))
  const [planoContingencia, setPlanoContingencia] = useState<Par[]>(cenarioAcaoParaPares(inicial?.planoContingencia))
  const [oportunidadesMelhoriaNotas, setOportunidadesMelhoriaNotas] = useState(listaParaTexto(inicial?.oportunidadesMelhoriaNotas))
  const [automacoesPossiveis, setAutomacoesPossiveis] = useState(listaParaTexto(inicial?.automacoesPossiveis))
  const [iaAplicavel, setIaAplicavel] = useState(listaParaTexto(inicial?.iaAplicavel))
  const [revisaoFrequencia, setRevisaoFrequencia] = useState(inicial?.revisaoFrequencia ?? '')
  const [revisaoResponsavel, setRevisaoResponsavel] = useState(inicial?.revisaoResponsavel ?? '')
  const [anexos, setAnexos] = useState<AnexoForm[]>((inicial?.anexos ?? []).map(a => ({ titulo: a.titulo, itens: a.itens.join('\n') })))

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!nome.trim()) { setErro('Nome é obrigatório'); return }
    setSalvando(true)
    try {
      await onSubmit({
        categoria, nome, versao, status, objetivo,
        resultadoEsperado: textoParaLista(resultadoEsperado),
        responsaveis: textoParaLista(responsaveis),
        processo: textoParaLista(processo),
        pop: pop.filter(e => e.titulo.trim()).map(e => ({
          titulo: e.titulo,
          descricao: e.descricao || undefined,
          checklist: e.checklist ? textoParaLista(e.checklist) : undefined,
        })),
        regras: textoParaLista(regras),
        ferramentas: textoParaLista(ferramentas),
        rotina: paresParaCadencias(rotina),
        sla: sla.filter(p => p.a.trim()).map(p => ({ item: p.a, prazo: p.b })),
        kpis: kpis.filter(p => p.a.trim()).map(p => ({ categoria: p.a, indicador: p.b })),
        auditoriaItens: textoParaLista(auditoriaItens),
        frequenciaAuditoria,
        criteriosConformidade: textoParaLista(criteriosConformidade),
        naoConformidadesCatalogo: textoParaLista(naoConformidadesCatalogo),
        reunioes: paresParaCadencias(reunioes),
        perguntasAnalise: textoParaLista(perguntasAnalise),
        riscos: textoParaLista(riscos),
        planoContingencia: planoContingencia.filter(p => p.a.trim()).map(p => ({ cenario: p.a, acao: p.b })),
        oportunidadesMelhoriaNotas: textoParaLista(oportunidadesMelhoriaNotas),
        automacoesPossiveis: textoParaLista(automacoesPossiveis),
        iaAplicavel: textoParaLista(iaAplicavel),
        revisaoFrequencia,
        revisaoResponsavel,
        anexos: anexos.filter(a => a.titulo.trim()).map(a => ({ titulo: a.titulo, itens: textoParaLista(a.itens) })),
      })
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-6 max-w-3xl">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-xs font-semibold text-blue-600 bg-blue-50 inline-block px-2 py-0.5 rounded mb-3">Identificação</h2>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <CampoTexto label="Categoria" value={categoria} onChange={setCategoria} />
          <CampoTexto label="Nome do Protocolo" value={nome} onChange={setNome} placeholder="Ex: Agendamento e Confirmação de Visita" />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <CampoTexto label="Versão" value={versao} onChange={setVersao} />
          <div>
            <label className={LABEL}>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className={INPUT}>
              <option value="rascunho">Rascunho</option>
              <option value="ativo">Ativo</option>
              <option value="em_revisao">Em revisão</option>
              <option value="obsoleto">Obsoleto</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="text-xs font-semibold text-blue-600 bg-blue-50 inline-block px-2 py-0.5 rounded">Nível 1 — Identidade do Processo</h2>
        <div>
          <label className={LABEL}>Objetivo</label>
          <textarea value={objetivo} onChange={e => setObjetivo(e.target.value)} rows={2} className={INPUT} />
        </div>
        <CampoLista label="Resultado Esperado" value={resultadoEsperado} onChange={setResultadoEsperado} />
        <CampoLista label="Responsáveis" value={responsaveis} onChange={setResponsaveis} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="text-xs font-semibold text-blue-600 bg-blue-50 inline-block px-2 py-0.5 rounded">Nível 2 — Estrutura Operacional</h2>
        <CampoLista label="Processo (fluxo macro)" value={processo} onChange={setProcesso} dica="a seta ↓ é implícita entre as linhas" />
        <CampoPop etapas={pop} onChange={setPop} />
        <CampoLista label="Regras Obrigatórias" value={regras} onChange={setRegras} />
        <CampoLista label="Ferramentas" value={ferramentas} onChange={setFerramentas} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="text-xs font-semibold text-blue-600 bg-blue-50 inline-block px-2 py-0.5 rounded">Nível 3 — Gestão de Execução</h2>
        <CampoPares label="Rotina" labelA="Cadência (ex: Diária)" labelB="O que acontece" pares={rotina} onChange={setRotina} />
        <CampoPares label="SLA" labelA="Item" labelB="Prazo" pares={sla} onChange={setSla} />
        <CampoPares label="KPIs" labelA="Categoria (ex: Volume)" labelB="Indicador" pares={kpis} onChange={setKpis} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="text-xs font-semibold text-blue-600 bg-blue-50 inline-block px-2 py-0.5 rounded">Nível 4 — Controle e Auditoria</h2>
        <CampoLista label="O que verificar na auditoria" value={auditoriaItens} onChange={setAuditoriaItens} />
        <CampoTexto label="Frequência de Auditoria" value={frequenciaAuditoria} onChange={setFrequenciaAuditoria} placeholder="Ex: Diária" />
        <CampoLista label="Critérios de Conformidade" value={criteriosConformidade} onChange={setCriteriosConformidade} />
        <CampoLista label="Catálogo de Não Conformidades" value={naoConformidadesCatalogo} onChange={setNaoConformidadesCatalogo} dica="o que caracteriza uma falha" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="text-xs font-semibold text-blue-600 bg-blue-50 inline-block px-2 py-0.5 rounded">Nível 5 — Gestão</h2>
        <CampoPares label="Reuniões" labelA="Cadência" labelB="Foco da reunião" pares={reunioes} onChange={setReunioes} />
        <CampoLista label="Perguntas Obrigatórias de Análise" value={perguntasAnalise} onChange={setPerguntasAnalise} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="text-xs font-semibold text-blue-600 bg-blue-50 inline-block px-2 py-0.5 rounded">Nível 6 — Risco e Contingência</h2>
        <CampoLista label="Riscos" value={riscos} onChange={setRiscos} />
        <CampoPares label="Plano de Contingência" labelA="Cenário (SE)" labelB="Ação (ENTÃO)" pares={planoContingencia} onChange={setPlanoContingencia} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="text-xs font-semibold text-blue-600 bg-blue-50 inline-block px-2 py-0.5 rounded">Nível 7 — Melhoria Contínua</h2>
        <CampoLista label="Notas de Melhoria" value={oportunidadesMelhoriaNotas} onChange={setOportunidadesMelhoriaNotas} />
        <CampoLista label="Automações Possíveis" value={automacoesPossiveis} onChange={setAutomacoesPossiveis} />
        <CampoLista label="IA Aplicável" value={iaAplicavel} onChange={setIaAplicavel} />
        <div className="grid grid-cols-2 gap-3">
          <CampoTexto label="Frequência de Revisão" value={revisaoFrequencia} onChange={setRevisaoFrequencia} placeholder="Ex: Mensal" />
          <CampoTexto label="Responsável pela Revisão" value={revisaoResponsavel} onChange={setRevisaoResponsavel} placeholder="Ex: Supervisor Comercial" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-xs font-semibold text-blue-600 bg-blue-50 inline-block px-2 py-0.5 rounded mb-3">Anexos e Checklists</h2>
        <CampoAnexos anexos={anexos} onChange={setAnexos} />
      </div>

      {erro && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{erro}</div>}

      <button type="submit" disabled={salvando}
        className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
        {salvando ? 'Salvando...' : textoBotao}
      </button>
    </form>
  )
}
