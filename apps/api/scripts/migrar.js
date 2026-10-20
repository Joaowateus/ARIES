// Migrações do banco no build da Vercel (npm run vercel-build).
// - Tenta `prisma migrate deploy`; se falhar, espera 20 s e tenta de novo
//   (dois builds ao mesmo tempo disputam o lock da migração).
// - Se o banco não responde (cota do Neon esgotada, servidor fora do ar), o
//   build segue com um aviso: o código novo sobe e as migrações rodam no
//   próximo deploy com o banco de volta.
// - Erro de migração de verdade (SQL que falha, histórico divergente)
//   continua barrando o deploy.
const { spawnSync } = require('child_process')

const BANCO_FORA = /P1001|P1002|P1017|quota|Can't reach database server|Timed out|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|endpoint (is|has been) (disabled|suspended)/i

function migrar() {
  // O CLI do Prisma instalado no projeto, sem depender do PATH.
  const r = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { encoding: 'utf8' })
  process.stdout.write(r.stdout ?? '')
  process.stderr.write(r.stderr ?? '')
  return { ok: r.status === 0, saida: `${r.stdout ?? ''}\n${r.stderr ?? ''}\n${r.error?.message ?? ''}` }
}

let r = migrar()
if (!r.ok) {
  console.warn('[migrar] falhou; nova tentativa em 20 s')
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20_000)
  r = migrar()
}
if (r.ok) process.exit(0)
if (BANCO_FORA.test(r.saida)) {
  console.warn('[migrar] AVISO: banco indisponível durante o build. O deploy segue; as migrações pendentes rodam no próximo deploy.')
  process.exit(0)
}
console.error('[migrar] erro de migração: deploy interrompido.')
process.exit(1)
