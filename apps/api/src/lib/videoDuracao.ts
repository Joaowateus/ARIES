// Duração de um vídeo MP4 lida do próprio arquivo (caixa moov/mvhd), sem
// baixar o vídeo inteiro: a Graph API não expõe a duração dos reels, e a
// retenção em % (seção 12) precisa dela. Lê só cabeçalhos por Range.
const LIMITE_CAIXAS = 12
const TIMEOUT_MS = 5000

async function lerTrecho(url: string, inicio: number, tamanho: number): Promise<Buffer | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const r = await fetch(url, { headers: { Range: `bytes=${inicio}-${inicio + tamanho - 1}` }, signal: ctrl.signal })
    if (!r.ok) return null
    const buf = Buffer.from(await r.arrayBuffer())
    // Servidor que ignora o Range devolve o arquivo todo (200): corta o trecho pedido.
    return r.status === 206 ? buf : buf.subarray(inicio, inicio + tamanho)
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

/** Duração (s) a partir de uma caixa mvhd (conteúdo depois do cabeçalho de 8 bytes). */
export function duracaoDoMvhd(mvhd: Buffer): number | null {
  if (mvhd.length < 20) return null
  const versao = mvhd[0]
  const escala = versao === 1 ? mvhd.readUInt32BE(20) : mvhd.readUInt32BE(12)
  const duracao = versao === 1 ? Number(mvhd.readBigUInt64BE(24)) : mvhd.readUInt32BE(16)
  if (!escala || !duracao) return null
  const s = duracao / escala
  return s > 0 && s < 4 * 3600 ? Math.round(s * 10) / 10 : null
}

/** Procura mvhd dentro do conteúdo de uma moov. */
function mvhdNaMoov(moov: Buffer): number | null {
  let pos = 0
  while (pos + 8 <= moov.length) {
    const tamanho = moov.readUInt32BE(pos)
    const tipo = moov.toString('latin1', pos + 4, pos + 8)
    if (tipo === 'mvhd') return duracaoDoMvhd(moov.subarray(pos + 8, pos + Math.max(8, tamanho)))
    if (tamanho < 8) return null
    pos += tamanho
  }
  return null
}

/** Percorre as caixas do topo do arquivo até achar a moov (início ou fim do arquivo). */
export async function duracaoDoVideo(url: string): Promise<number | null> {
  let pos = 0
  for (let i = 0; i < LIMITE_CAIXAS; i++) {
    const cab = await lerTrecho(url, pos, 16)
    if (!cab || cab.length < 8) return null
    let tamanho = cab.readUInt32BE(0)
    const tipo = cab.toString('latin1', 4, 8)
    let cabecalho = 8
    if (tamanho === 1 && cab.length >= 16) { tamanho = Number(cab.readBigUInt64BE(8)); cabecalho = 16 }
    if (tipo === 'moov') {
      // A mvhd é a primeira caixa da moov: 512 bytes bastam.
      const conteudo = await lerTrecho(url, pos + cabecalho, Math.min(512, Math.max(0, tamanho - cabecalho)))
      return conteudo ? mvhdNaMoov(conteudo) : null
    }
    if (tamanho < 8) return null
    pos += tamanho
  }
  return null
}
