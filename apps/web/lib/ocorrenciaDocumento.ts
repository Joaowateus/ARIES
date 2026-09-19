import { jsPDF } from 'jspdf'
import { Ocorrencia, TIPO_OCORRENCIA_LABEL, GRAVIDADE_OCORRENCIA_LABEL, MEDIDA_DISCIPLINAR_LABEL } from './proLaboreApi'

const NOME_EMPRESA = 'MM Negócios Veículos'

function tituloDocumento(o: Ocorrencia): string {
  if (o.medidaAplicada === 'ADVERTENCIA_VERBAL' || o.medidaAplicada === 'ADVERTENCIA_ESCRITA') return 'Termo de Advertência'
  if (o.medidaAplicada === 'SUSPENSAO') return 'Termo de Suspensão'
  if (o.medidaAplicada === 'DESLIGAMENTO') return 'Termo de Desligamento por Justa Causa Disciplinar'
  if (o.tipo === 'FEEDBACK_POSITIVO') return 'Registro de Feedback Positivo'
  return 'Registro de Ocorrência Funcional'
}

function formatarData(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

// Documento gerado 100% no navegador (jsPDF) — não existe storage de
// arquivo nesse repo, então o PDF não fica hospedado em lugar nenhum; ele é
// baixado na hora e o registro no backend (marcarDocumentoGerado) guarda só
// o carimbo de que foi emitido, não o arquivo em si.
export function gerarDocumentoOcorrenciaPdf(o: Ocorrencia, vendedorNome: string, vendedorPapel?: string): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margemEsq = 56
  const larguraUtil = 595 - margemEsq * 2
  let y = 64

  function linha(altura = 18) { y += altura }
  function texto(conteudo: string, opcoes: { negrito?: boolean; tamanho?: number } = {}) {
    doc.setFont('helvetica', opcoes.negrito ? 'bold' : 'normal')
    doc.setFontSize(opcoes.tamanho ?? 10.5)
    const linhas = doc.splitTextToSize(conteudo, larguraUtil)
    doc.text(linhas, margemEsq, y)
    linha(14 * linhas.length + 4)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(NOME_EMPRESA, margemEsq, y)
  linha(26)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(tituloDocumento(o), margemEsq, y)
  linha(20)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Protocolo: ${o.protocolo}`, margemEsq, y)
  linha(24)

  texto(`Colaborador(a): ${vendedorNome}${vendedorPapel ? ` — ${vendedorPapel === 'SUPERVISOR' ? 'Supervisor(a)' : 'Vendedor(a)'}` : ''}`, { negrito: true })
  texto(`Data da ocorrência: ${formatarData(o.dataOcorrencia)}    Registrado por: ${o.registradoPor}    Registrado em: ${formatarData(o.dataRegistro)}`)
  linha(6)

  texto('Classificação', { negrito: true })
  texto(`Tipo: ${TIPO_OCORRENCIA_LABEL[o.tipo]}    Gravidade: ${GRAVIDADE_OCORRENCIA_LABEL[o.gravidade]}    Motivo: ${o.motivo}`)
  linha(6)

  texto('Descrição dos fatos', { negrito: true })
  texto(o.descricao)
  linha(6)

  if (o.planoDeCorrecao || o.prazoCorrecao) {
    texto('Plano de correção', { negrito: true })
    if (o.planoDeCorrecao) texto(o.planoDeCorrecao)
    texto(`Prazo para correção: ${formatarData(o.prazoCorrecao)}`)
    linha(6)
  }

  if (o.medidaAplicada !== 'NENHUMA') {
    texto(`Medida disciplinar aplicada: ${MEDIDA_DISCIPLINAR_LABEL[o.medidaAplicada]}`, { negrito: true })
    linha(6)
  }

  texto(
    'O não cumprimento do plano de correção acima, ou a reincidência em fatos de mesma natureza, poderá ' +
    'resultar na aplicação de medida disciplinar mais severa, incluindo advertência formal, suspensão ou ' +
    'desligamento por justa causa, nos termos da legislação trabalhista vigente e das políticas internas da empresa.',
  )
  linha(10)

  texto(
    'Declaro estar ciente do teor deste documento e dos fatos nele descritos, sem que isso represente ' +
    'concordância obrigatória com seu conteúdo, apenas a confirmação de que fui devidamente comunicado(a).',
  )
  linha(28)

  const dataPorExtenso = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  texto(`Local e data: ______________________________, ${dataPorExtenso}`)
  linha(46)

  const colunaLargura = larguraUtil / 2 - 10
  doc.setLineWidth(0.5)
  doc.line(margemEsq, y, margemEsq + colunaLargura, y)
  doc.line(margemEsq + colunaLargura + 20, y, margemEsq + colunaLargura * 2 + 20, y)
  linha(14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.text('Colaborador(a)', margemEsq, y)
  doc.text('Gestor(a) responsável', margemEsq + colunaLargura + 20, y)
  linha(46)

  doc.line(margemEsq, y, margemEsq + colunaLargura, y)
  linha(14)
  doc.text('Testemunha (opcional)', margemEsq, y)

  doc.save(`${o.protocolo}.pdf`)
}
