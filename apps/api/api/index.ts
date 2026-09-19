import app from '../src/app'

// Ponto de entrada da função serverless da Vercel — reaproveita o mesmo
// Express de src/app.ts, sem chamar listen() (a Vercel entrega a conexão
// HTTP direto pra esse handler). O vercel.json na raiz da API redireciona
// todo caminho pra cá, então o próprio Express continua resolvendo as
// rotas internamente (/health, /pro-labore/..., etc.) como sempre fez.
export default app
