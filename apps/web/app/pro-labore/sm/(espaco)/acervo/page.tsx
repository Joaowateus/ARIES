'use client'

// Fase 6 · Acervo de mídia por moto (seção 18): tudo o que já foi enviado nas
// pautas, organizado pela moto do estoque. "Usar em uma pauta da moto" leva o
// arquivo para a pauta aberta da moto (ou cria uma, com o roteiro sugerido).
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { proLaboreApi, type SmAcervo, type SmArquivoAcervo } from '@/lib/proLaboreApi'
import { BotaoLink, CardEsqueleto, Chip, EstadoVazio, Rotulo, haQuanto, useToast } from '../../_ui'
import { useEspacoSM } from '../EspacoSM'
import { GradeArquivos } from './Arquivos'

const SITUACAO = { DISPONIVEL: 'Na loja', RESERVADA: 'Reservada', VENDIDA: 'Vendida' } as const

export default function AcervoPage() {
  const { pode } = useEspacoSM()
  const toast = useToast()
  const router = useRouter()
  const [acervo, setAcervo] = useState<SmAcervo | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [moto, setMoto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => {
    if (!pode('producao')) return
    proLaboreApi.sm.acervo.ver().then(setAcervo).catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível carregar agora. Tente de novo em instantes.'))
  }, [pode])

  if (!pode('producao')) return <div className="sm-card"><EstadoVazio titulo="Sem acesso à Produção">O gestor pode liberar o módulo Produção em Equipe → Acessos e permissões.</EstadoVazio></div>

  async function usar(a: SmArquivoAcervo) {
    setOcupado(true)
    try {
      const p = await proLaboreApi.sm.acervo.novaPauta(a.id)
      toast({ mensagem: p.criada ? `Pauta criada com o arquivo: ${p.titulo}.` : `Arquivo na pauta “${p.titulo}”.` })
      router.push(`/pro-labore/sm/producao?pauta=${p.id}`)
    } catch (e) { toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível usar o arquivo', tom: 'bad' }) } finally { setOcupado(false) }
  }

  const motos = acervo?.motos ?? []
  const visiveis = moto ? motos.filter(m => m.moto.id === moto) : motos
  return (
    <>
      <header className="sm-pagina-cab">
        <div>
          <Rotulo>Trabalho · Acervo de mídia</Rotulo>
          <h1 className="sm-ttl sm-h1">Tudo o que já foi gravado, por moto</h1>
          <p>Fotos, vídeos e tomadas das pautas, organizados pela moto do estoque. Reaproveite numa pauta nova.</p>
        </div>
        {motos.length > 1 && (
          <label className="sm-campo">Moto
            <select className="sm-input" value={moto} onChange={e => setMoto(e.target.value)}>
              <option value="">Todas ({motos.length})</option>
              {motos.map(m => <option key={m.moto.id} value={m.moto.id}>{m.moto.modelo}{m.moto.ano ? ` ${m.moto.ano}` : ''}</option>)}
            </select>
          </label>
        )}
      </header>
      {erro ? <p className="sm-erro" role="alert">{erro}</p> : !acervo ? <CardEsqueleto linhas={4} /> : !motos.length ? (
        <div className="sm-card">
          <EstadoVazio titulo="O acervo começa na primeira pauta com moto" acao={<BotaoLink href="/pro-labore/sm/captura">Abrir a captura na loja</BotaoLink>}>
            Escolha a moto no briefing e envie fotos ou grave as tomadas: tudo fica guardado aqui, por moto.
          </EstadoVazio>
        </div>
      ) : visiveis.map(g => (
        <section key={g.moto.id} className="sm-card" aria-label={`Acervo: ${g.moto.modelo}`}>
          <div className="sm-acervo-cab">
            <div>
              <h2 className="sm-h-card">{g.moto.modelo}{g.moto.ano ? ` ${g.moto.ano}` : ''}{g.moto.cor ? ` · ${g.moto.cor}` : ''}</h2>
              <span className="sm-legenda">
                {g.fotos} {g.fotos === 1 ? 'foto' : 'fotos'} · {g.videos} {g.videos === 1 ? 'vídeo' : 'vídeos'}{g.ultimoEm ? ` · último ${haQuanto(g.ultimoEm)}` : ''}
              </span>
            </div>
            {g.moto.situacao && <Chip tom={g.moto.situacao === 'VENDIDA' ? 'neutro' : g.moto.situacao === 'RESERVADA' ? 'warn' : 'ok'}>{SITUACAO[g.moto.situacao]}</Chip>}
          </div>
          <GradeArquivos arquivos={g.arquivos} ocupado={ocupado}
            rotuloAcao="Usar numa pauta da moto"
            aoUsar={acervo.podeUsar && g.moto.situacao !== 'VENDIDA' ? usar : undefined} />
        </section>
      ))}
    </>
  )
}
