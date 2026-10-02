// Pastas dentro de pastas: a API manda a lista plana (com paiId) e aqui
// viram árvore — filhas, caminho até a raiz, lista com nível pra <select> e
// total somando as subpastas.
import type { PastaReuniao } from '@/lib/proLaboreApi'

const pai = (p: PastaReuniao) => p.paiId ?? null

export function filhasDe(pastas: PastaReuniao[], paiId: string | null): PastaReuniao[] {
  return pastas.filter(p => pai(p) === paiId).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

// Da pasta mais de cima até a pasta pedida.
export function caminhoAte(pastas: PastaReuniao[], id: string | null): PastaReuniao[] {
  const porId = new Map(pastas.map(p => [p.id, p]))
  const out: PastaReuniao[] = []
  for (let atual = id ? porId.get(id) : undefined; atual && out.length < 20; atual = pai(atual) ? porId.get(pai(atual)!) : undefined) out.unshift(atual)
  return out
}

// Todas as pastas em ordem de árvore, com o nível (0 = direto no departamento).
export function emOrdem(pastas: PastaReuniao[], excluirRamo?: string): Array<PastaReuniao & { nivel: number }> {
  const out: Array<PastaReuniao & { nivel: number }> = []
  const visitar = (paiId: string | null, nivel: number) => {
    for (const p of filhasDe(pastas, paiId)) {
      if (p.id === excluirRamo) continue
      out.push({ ...p, nivel })
      if (nivel < 20) visitar(p.id, nivel + 1)
    }
  }
  visitar(null, 0)
  return out
}

// Apresentações da pasta e de todas as subpastas.
export function totalComSubpastas(pastas: PastaReuniao[], id: string): number {
  return (pastas.find(p => p.id === id)?.total ?? 0) + filhasDe(pastas, id).reduce((s, f) => s + totalComSubpastas(pastas, f.id), 0)
}

// Rótulo de opção de <select> com recuo pelo nível.
export const rotuloComNivel = (p: { nome: string; nivel: number }) => `${'   '.repeat(p.nivel)}${p.nivel ? '└ ' : ''}${p.nome}`
