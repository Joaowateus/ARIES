'use client'

// Preferências da pessoa (seção 11.1: "Dá para mudar tudo depois em
// Preferências"): como chamar, a concordância da saudação, o tema (seção 15),
// a hora do modo foco e os canais de aviso. As metas da semana ficam com o gestor.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { proLaboreApi, type SmAvisos, type SmGenero, type SmTema } from '@/lib/proLaboreApi'
import { usePLTema } from '@/lib/proLaboreTheme'
import { Botao, Card, CardEsqueleto, Rotulo, Segmentado, useToast } from '../../_ui'
import { useEspacoSM } from '../EspacoSM'

const HORAS = [7, 8, 9, 10, 11]

export default function PreferenciasPage() {
  const toast = useToast()
  const { eu, recarregar } = useEspacoSM()
  const [carregado, setCarregado] = useState(false)
  const [tratamento, setTratamento] = useState('')
  const [genero, setGenero] = useState<SmGenero | 'N'>('N')
  const [focoHora, setFocoHora] = useState(9)
  const [avisos, setAvisos] = useState<SmAvisos>({ whatsapp: true, celular: true, email: false })
  const [salvando, setSalvando] = useState(false)
  const souSM = eu.visao === 'SOCIAL_MEDIA'
  const plTema = usePLTema()
  const tema: SmTema = plTema?.tema === 'light' ? 'CLARO' : 'ESCURO'

  // O tema muda na hora e fica guardado para a pessoa (vale em qualquer aparelho).
  async function mudarTema(t: SmTema) {
    plTema?.setTema(t === 'CLARO' ? 'light' : 'dark')
    try {
      await proLaboreApi.sm.preferencias.salvar({ tema: t })
      toast({ mensagem: t === 'CLARO' ? 'Tema claro ativado.' : 'Tema escuro ativado.' })
      recarregar()
    } catch (err) { toast({ mensagem: err instanceof Error ? err.message : 'Não foi possível guardar o tema', tom: 'bad' }) }
  }

  useEffect(() => {
    proLaboreApi.sm.preferencias.ver().then(p => {
      setTratamento(p.tratamento ?? ''); setGenero(p.genero ?? 'N'); setFocoHora(p.focoHora); setAvisos(p.avisos); setCarregado(true)
    }).catch(() => setCarregado(true))
  }, [])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    try {
      await proLaboreApi.sm.preferencias.salvar({ genero: genero === 'N' ? null : genero, focoHora, avisos, ...(souSM && tratamento.trim() ? { tratamento: tratamento.trim() } : {}) })
      toast({ mensagem: 'Preferências salvas.' })
      recarregar()
    } catch (err) {
      toast({ mensagem: err instanceof Error ? err.message : 'Não foi possível salvar', tom: 'bad' })
    } finally { setSalvando(false) }
  }

  return (
    <>
      <header className="sm-pagina-cab">
        <div>
          <Rotulo>Preferências</Rotulo>
          <h1 className="sm-ttl sm-h1">Do seu jeito</h1>
          <p>Como o sistema te chama, a hora do ritual e por onde avisar.</p>
        </div>
      </header>
      {!carregado ? <CardEsqueleto linhas={5} /> : (
        <form onSubmit={salvar} className="sm-pref">
          <Card titulo="Saudação">
            {souSM && (
              <label className="sm-campo">Como te chamar
                <input className="sm-input" value={tratamento} onChange={e => setTratamento(e.target.value)} maxLength={40} />
              </label>
            )}
            <div className="sm-campo"><span>Concordância</span>
              <Segmentado rotulo="Concordância da saudação" valor={genero} aoMudar={v => setGenero(v)}
                opcoes={[{ valor: 'F', rotulo: 'Bem-vinda' }, { valor: 'M', rotulo: 'Bem-vindo' }, { valor: 'N', rotulo: 'Boas-vindas' }]} />
            </div>
          </Card>
          <Card titulo="Aparência">
            <div className="sm-campo"><span>Tema</span>
              <Segmentado rotulo="Tema" valor={tema} aoMudar={v => mudarTema(v)}
                opcoes={[{ valor: 'ESCURO', rotulo: 'Escuro' }, { valor: 'CLARO', rotulo: 'Claro' }]} />
            </div>
            <span className="sm-legenda">Muda na hora. A escolha vale em qualquer aparelho em que você entrar.</span>
          </Card>
          <Card titulo="Ritmo">
            <label className="sm-campo">Modo foco diário
              <select className="sm-input" value={focoHora} onChange={e => setFocoHora(Number(e.target.value))}>
                {HORAS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}h00</option>)}
              </select>
            </label>
            <span className="sm-legenda">Retrospectiva na sexta e planejamento do mês seguinte no dia 25.</span>
            <fieldset className="sm-boas-avisos">
              <legend className="sm-mono">Avisar no</legend>
              {([['whatsapp', 'WhatsApp'], ['celular', 'Celular (app)'], ['email', 'E-mail']] as const).map(([k, r]) => (
                <label key={k}><input type="checkbox" checked={avisos[k]} onChange={e => setAvisos({ ...avisos, [k]: e.target.checked })} /> {r}</label>
              ))}
            </fieldset>
          </Card>
          <Card titulo="Metas da semana">
            <span className="sm-legenda">
              {souSM ? 'As metas combinadas no primeiro acesso ficam com o gestor, que pode ajustar nas regras do Calendário.' : 'As metas ficam nas regras do Calendário.'}
            </span>
            <Link href="/pro-labore/sm/calendario" className="sm-link-botao">Ver no Calendário</Link>
          </Card>
          <div><Botao type="submit" variante="pri" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar preferências'}</Botao></div>
        </form>
      )}
    </>
  )
}
