'use client'

// H. Provas e ativos autorizados: tudo que sustenta um conteúdo, com
// origem, data de verificação, responsável, permissão de uso, validade e
// situação. Nunca se fabrica uma prova para preencher o calendário.
import { useCallback, useEffect, useState } from 'react'
import { proLaboreApi, type CtProva, type CtProvaEntrada, type CtTipoProva } from '@/lib/proLaboreApi'
import { Botao, Card, Chip, EstadoVazio, Modal, useToast } from '../../_ui'
import { useEspacoSM } from '../EspacoSM'
import { PROVA_ROTULO } from './rotulos'

const VAZIA: CtProvaEntrada = { titulo: '', tipo: 'FOTO_VIDEO', origem: '', link: '', responsavel: '', permissao: '', verificadoEm: '', validoAte: '', situacao: 'PENDENTE', nota: '' }

export function Provas() {
  const { eu, pode } = useEspacoSM()
  const toast = useToast()
  const [provas, setProvas] = useState<CtProva[] | null>(null)
  const [editando, setEditando] = useState<CtProva | 'nova' | null>(null)
  const carregar = useCallback(() => { proLaboreApi.sm.central.provas().then(setProvas).catch(() => setProvas([])) }, [])
  useEffect(() => { carregar() }, [carregar])
  const gestor = eu.visao === 'GESTOR' && !eu.verComo
  const podeEditar = pode('producao', 'COMPLETO') && !eu.somenteLeitura
  const tom = (s: string) => (s === 'APROVADO' ? 'ok' : s === 'VENCIDO' ? 'bad' : 'warn') as 'ok' | 'bad' | 'warn'
  return (
    <Card titulo="Provas e ativos autorizados" subtitulo="Fotos e vídeos reais, informações verificadas, condições aprovadas, garantia, documentação, inspeções, avaliações e depoimentos com consentimento, bastidores, perguntas reais e pós-venda."
      acoes={podeEditar ? <Botao variante="pri" onClick={() => setEditando('nova')}>Nova prova</Botao> : undefined}>
      {!provas ? <p className="sm-legenda">Carregando…</p> : provas.length === 0 ? <EstadoVazio titulo="Nenhuma prova registrada">Registre aqui o que pode sustentar os vídeos. Depoimento e avaliação de cliente só são aprovados com a autorização registrada; só o gestor aprova.</EstadoVazio> : (
        <ul className="ct-itens">
          {provas.map(p => (
            <li key={p.id}>
              <div>
                <b>{p.titulo}</b> <Chip tom={tom(p.situacaoEfetiva)}>{p.situacaoEfetiva === 'APROVADO' ? 'Aprovada' : p.situacaoEfetiva === 'VENCIDO' ? 'Vencida' : 'Pendente'}</Chip>
                <span className="sm-legenda">{PROVA_ROTULO[p.tipo]}{p.origem ? ` · origem: ${p.origem}` : ''}{p.responsavel ? ` · ${p.responsavel}` : ''}{p.verificadoEm ? ` · verificada em ${new Date(p.verificadoEm).toLocaleDateString('pt-BR')}` : ''}{p.validoAte ? ` · válida até ${new Date(p.validoAte).toLocaleDateString('pt-BR')}` : ''}</span>
                {p.permissao && <span className="sm-legenda">Permissão: {p.permissao}</span>}
                {p.link && <a className="sm-legenda" href={p.link} target="_blank" rel="noreferrer">Abrir o arquivo</a>}
              </div>
              {podeEditar && <Botao variante="fantasma" onClick={() => setEditando(p)}>Editar</Botao>}
            </li>
          ))}
        </ul>
      )}
      {editando && <FormProva prova={editando === 'nova' ? null : editando} gestor={gestor} aoFechar={() => setEditando(null)} aoSalvar={() => { setEditando(null); carregar(); toast({ mensagem: 'Prova salva.' }) }} />}
    </Card>
  )
}

const dia = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '')

function FormProva({ prova, gestor, aoFechar, aoSalvar }: { prova: CtProva | null; gestor: boolean; aoFechar: () => void; aoSalvar: () => void }) {
  const [f, setF] = useState<CtProvaEntrada>(prova ? { ...prova, verificadoEm: dia(prova.verificadoEm), validoAte: dia(prova.validoAte) } : VAZIA)
  const [erro, setErro] = useState<string | null>(null)
  const campo = (k: keyof CtProvaEntrada, rotulo: string, tipo = 'text') => (
    <label className="sm-campo">{rotulo}<input className="sm-input" type={tipo} value={(f[k] as string) ?? ''} onChange={e => setF({ ...f, [k]: e.target.value })} /></label>
  )
  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(null)
    const limpo = Object.fromEntries(Object.entries(f).map(([k, x]) => [k, x === '' ? null : x])) as unknown as CtProvaEntrada
    try {
      if (prova) {
        await proLaboreApi.sm.central.editarProva(prova.id, {
          titulo: limpo.titulo, tipo: limpo.tipo, origem: limpo.origem, link: limpo.link, responsavel: limpo.responsavel, permissao: limpo.permissao,
          verificadoEm: limpo.verificadoEm, validoAte: limpo.validoAte, nota: limpo.nota, ...(gestor ? { situacao: limpo.situacao } : {}),
        })
      } else await proLaboreApi.sm.central.novaProva({ ...limpo, situacao: gestor ? limpo.situacao : 'PENDENTE' })
      aoSalvar()
    } catch (err) { setErro(err instanceof Error ? err.message : 'Não foi possível salvar') }
  }
  return (
    <Modal titulo={prova ? 'Editar prova' : 'Nova prova'} aoFechar={aoFechar}>
      <form className="sm-form" onSubmit={salvar}>
        <label className="sm-campo">Identificação<input className="sm-input" required minLength={3} value={f.titulo} onChange={e => setF({ ...f, titulo: e.target.value })} placeholder="Ex.: Vídeo da inspeção da CB 300F" /></label>
        <label className="sm-campo">Tipo
          <select className="sm-input" value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value as CtTipoProva })}>{(Object.keys(PROVA_ROTULO) as CtTipoProva[]).map(t => <option key={t} value={t}>{PROVA_ROTULO[t]}</option>)}</select>
        </label>
        <div className="sm-grade-2">{campo('origem', 'Origem')}{campo('responsavel', 'Responsável')}{campo('verificadoEm', 'Verificada em', 'date')}{campo('validoAte', 'Válida até', 'date')}</div>
        {campo('link', 'Link do arquivo (opcional)')}
        <label className="sm-campo">Permissão de uso<textarea className="sm-input" rows={2} value={f.permissao ?? ''} onChange={e => setF({ ...f, permissao: e.target.value })} placeholder="Ex.: cliente autorizou por escrito no WhatsApp em 10/11" /></label>
        {gestor ? (
          <label className="sm-campo">Situação<select className="sm-input" value={f.situacao} onChange={e => setF({ ...f, situacao: e.target.value as 'APROVADO' | 'PENDENTE' })}><option value="PENDENTE">Pendente</option><option value="APROVADO">Aprovada</option></select></label>
        ) : <p className="sm-legenda" style={{ margin: 0 }}>A prova fica pendente até o gestor aprovar.</p>}
        <label className="sm-campo">Observação<textarea className="sm-input" rows={2} value={f.nota ?? ''} onChange={e => setF({ ...f, nota: e.target.value })} /></label>
        {erro && <p className="sm-erro" role="alert">{erro}</p>}
        <div className="sm-linha-acoes" style={{ justifyContent: 'flex-end' }}><Botao onClick={aoFechar}>Cancelar</Botao><Botao type="submit" variante="pri">Salvar</Botao></div>
      </form>
    </Modal>
  )
}
