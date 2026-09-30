'use client'

// Tela de quem assiste: o mesmo mapa, só leitura, acompanhando o
// apresentador ao vivo — enquadramento, ideia selecionada e ponteiro laser.
// Dá pra sair do "seguir" e explorar sozinho (arrastar/zoom); um botão
// traz de volta pro que o apresentador está mostrando.
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { proLaboreApi, type ApresentacaoDetalhe, type Bloco, type ConfiguracaoApresentacao, type LembreteApresentacao, type PalcoApresentacao } from '@/lib/proLaboreApi'
import type { MotorMapaMental } from '../../anotacoes/motor-mapa-mental/motor'
import QuadroMotor from './QuadroMotor'
import Laser, { criarFonteLaser, type FonteLaser } from './Laser'
import PainelLateral from './PainelLateral'
import { useTransmissao } from './useTransmissao'
import { IconeEnquadrar, IconePainel, IconeTelaCheia, IconeVoltar, duracaoDesde, linkBiblioteca, tempoRelativo, useTelaCheia } from './comum'

export default function Espectador({ inicial }: { inicial: ApresentacaoDetalhe }) {
  const cfgInicial: ConfiguracaoApresentacao = inicial.configuracao ?? { layout: 'mind', tema: 'meister', doisLados: true }
  const [titulo, setTitulo] = useState(inicial.titulo)
  const [descricao, setDescricao] = useState(inicial.descricao)
  const [notas, setNotas] = useState<Bloco[]>(inicial.notas ?? [])
  const [lembretes, setLembretes] = useState<LembreteApresentacao[]>(inicial.lembretes ?? [])
  const [aoVivo, setAoVivo] = useState(inicial.aoVivo)
  const [aoVivoDesde, setAoVivoDesde] = useState(inicial.aoVivoDesde)
  const [seguindo, setSeguindo] = useState(true)
  const [painelAberto, setPainelAberto] = useState(false)
  const [novidadeNotas, setNovidadeNotas] = useState(false)
  const { ref: telaRef, cheia, alternar: alternarTelaCheia } = useTelaCheia<HTMLDivElement>()

  const motorRef = useRef<MotorMapaMental | null>(null)
  const seguindoRef = useRef(true)
  const ultimoPalcoRef = useRef<PalcoApresentacao | null>(inicial.aoVivo ? inicial.palco : null)
  const fonteLaserRef = useRef<FonteLaser>(criarFonteLaser())
  const aplicandoRef = useRef(false)
  const notasJsonRef = useRef(JSON.stringify(inicial.notas ?? []))

  // "Só pra mim": nota pessoal de quem assiste, salva sozinha.
  const [minhaNota, setMinhaNota] = useState(inicial.notaPessoal ?? '')
  const [statusNota, setStatusNota] = useState<'salvando' | 'salvo' | 'erro' | null>(null)
  const notaPendenteRef = useRef<string | null>(null)
  const timerNotaRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function salvarNota() {
    timerNotaRef.current = null
    const texto = notaPendenteRef.current
    if (texto === null) return
    notaPendenteRef.current = null
    try {
      await proLaboreApi.apresentacoes.salvarMinhaNota(inicial.id, texto)
      if (notaPendenteRef.current === null) setStatusNota('salvo')
    } catch {
      if (notaPendenteRef.current === null) notaPendenteRef.current = texto
      setStatusNota('erro')
    }
  }

  function mudarNota(t: string) {
    setMinhaNota(t)
    setStatusNota('salvando')
    notaPendenteRef.current = t
    if (timerNotaRef.current) clearTimeout(timerNotaRef.current)
    timerNotaRef.current = setTimeout(() => { void salvarNota() }, 800)
  }

  // Saiu da tela com algo por salvar: manda na hora.
  useEffect(() => () => {
    if (timerNotaRef.current) clearTimeout(timerNotaRef.current)
    const texto = notaPendenteRef.current
    if (texto !== null) void proLaboreApi.apresentacoes.salvarMinhaNota(inicial.id, texto).catch(() => {})
  }, [inicial.id])

  function aplicarPalco(p: PalcoApresentacao | null, animar = true) {
    const m = motorRef.current
    fonteLaserRef.current.ativo = !!p?.laser.ativo
    if (!p || !m) return
    if (p.laser.ativo && p.laser.pontos.length) fonteLaserRef.current.fila.push(...p.laser.pontos)
    if (!seguindoRef.current) return
    aplicandoRef.current = true
    if (p.vista) m.irParaVistaMundo(p.vista, animar)
    m.setSelecaoRemota(p.sel)
    aplicandoRef.current = false
  }

  function mudarSeguindo(v: boolean) {
    seguindoRef.current = v
    setSeguindo(v)
    if (v) aplicarPalco(ultimoPalcoRef.current)
  }

  const modo = useTransmissao(inicial.id, { versao: inicial.versao, palcoVersao: inicial.palcoVersao }, {
    onConteudo: c => {
      setTitulo(c.titulo)
      setDescricao(c.descricao)
      setLembretes(c.lembretes ?? [])
      const novas = c.notas ?? []
      const json = JSON.stringify(novas)
      if (json !== notasJsonRef.current) { notasJsonRef.current = json; setNotas(novas); setNovidadeNotas(true) }
      const cfg = c.configuracao ?? cfgInicial
      motorRef.current?.aplicarRemoto(JSON.parse(JSON.stringify(c.arvore)), { layout: cfg.layout, theme: cfg.tema, balanced: cfg.doisLados })
    },
    onPalco: p => { ultimoPalcoRef.current = p; aplicarPalco(p) },
    onStatus: v => {
      setAoVivo(v)
      if (v) setAoVivoDesde(d => d ?? new Date().toISOString())
      else { fonteLaserRef.current.ativo = false; setAoVivoDesde(null) }
    },
  })

  const pendentes = lembretes.filter(l => !l.feito).length

  return (
    <div ref={telaRef} className={`pl-ap-tela ${cheia ? 'cheia' : ''}`}>
      <header className="pl-ap-barra">
        <Link href={linkBiblioteca(inicial)} className="pl-ap-icone-btn" aria-label="Voltar pra biblioteca"><IconeVoltar /></Link>
        <div className="pl-ap-titulo-leitura">
          <b>{titulo}</b>
          {descricao && <small>{descricao}</small>}
        </div>
        <div className="pl-ap-barra-meio">
          {aoVivo ? (
            <span className="pl-ap-aovivo estatico">
              <span className="pl-ap-pulso" aria-hidden="true" />AO VIVO {aoVivoDesde && <span className="pl-mono">{duracaoDesde(aoVivoDesde)}</span>}
              {modo === 'reserva' && <span className="pl-ap-modo" title="A conexão contínua não passou pela rede — atualizando a cada segundo">· modo econômico</span>}
            </span>
          ) : (
            <span className="pl-ap-rascunho">Conteúdo salvo · atualizado {tempoRelativo(inicial.atualizadoEm)}</span>
          )}
        </div>
        <div className="pl-ap-barra-acoes">
          {aoVivo && (
            <button type="button" role="switch" aria-checked={seguindo} className={`pl-ap-seguir ${seguindo ? 'on' : ''}`} onClick={() => mudarSeguindo(!seguindo)}>
              <span className="pl-as-switch-trilho" aria-hidden="true"><span /></span>Seguir apresentador
            </button>
          )}
          <button type="button" className="pl-ap-icone-btn" onClick={() => motorRef.current?.enquadrar()} title="Ver o mapa inteiro"><IconeEnquadrar /></button>
          <button type="button" className={`pl-ap-icone-btn ${painelAberto ? 'ligado' : ''}`} onClick={() => { setPainelAberto(p => !p); setNovidadeNotas(false) }} aria-pressed={painelAberto} title="Anotações e lembretes">
            <IconePainel />
            {!painelAberto && (novidadeNotas || pendentes > 0) && <span className="pl-ap-bolinha" aria-label="Novidades" />}
          </button>
          <button type="button" className="pl-ap-icone-btn" onClick={alternarTelaCheia} title={cheia ? 'Sair da tela cheia' : 'Tela cheia'}><IconeTelaCheia cheia={cheia} /></button>
        </div>
      </header>

      <div className={`pl-ap-corpo ${painelAberto ? 'com-painel' : ''}`}>
        <div className="pl-ap-palco">
          <QuadroMotor
            arvoreInicial={inicial.arvore}
            layout={cfgInicial.layout}
            tema={cfgInicial.tema}
            doisLados={cfgInicial.doisLados}
            somenteLeitura
            onPronto={m => { motorRef.current = m; if (ultimoPalcoRef.current) aplicarPalco(ultimoPalcoRef.current, false) }}
            onInteracaoVista={() => { if (!aplicandoRef.current && seguindoRef.current && aoVivo) mudarSeguindo(false) }}
          >
            <Laser motorRef={motorRef} fonteRef={fonteLaserRef} />
          </QuadroMotor>
          {aoVivo && !seguindo && (
            <button type="button" className="pl-ap-voltar-seguir" onClick={() => mudarSeguindo(true)}>
              Voltar pro que está sendo apresentado
            </button>
          )}
          {!aoVivo && (
            <div className="pl-ap-dica-flutuante">
              Arraste pra navegar; zoom com pinça ou Ctrl + rolagem. Quando estiver ao vivo, esta tela acompanha sozinha.
            </div>
          )}
        </div>
        {painelAberto && (
          <PainelLateral
            editavel={false} notas={notas} lembretes={lembretes}
            notasPrivadas={minhaNota} onNotasPrivadas={mudarNota}
            statusPrivado={statusNota === 'salvando' ? 'Salvando…'
              : statusNota === 'salvo' ? 'Salvo'
              : statusNota === 'erro' ? <span className="pl-ap-privado-erro">Não salvou — <button type="button" onClick={() => { setStatusNota('salvando'); void salvarNota() }}>tentar de novo</button></span>
              : null}
          />
        )}
      </div>
    </div>
  )
}
