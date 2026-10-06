// Envio de e-mail (decisão P10): Resend quando RESEND_API_KEY e EMAIL_FROM
// estiverem configurados na hospedagem. Sem chave, nada é enviado e quem
// chamou mostra o conteúdo na tela (ex.: o link do convite para copiar).
export interface EmailEnvio { para: string; assunto: string; texto: string; html?: string }

export function emailConfigurado(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM
}

export async function enviarEmail(e: EmailEnvio): Promise<{ enviado: boolean; erro?: string }> {
  if (!emailConfigurado()) return { enviado: false, erro: 'Envio de e-mail não configurado' }
  try {
    const r = await fetch(process.env.RESEND_API_URL ?? 'https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [e.para], subject: e.assunto, text: e.texto, html: e.html }),
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) return { enviado: false, erro: `Provedor de e-mail respondeu ${r.status}` }
    return { enviado: true }
  } catch (err) {
    return { enviado: false, erro: err instanceof Error ? err.message : 'Falha no envio' }
  }
}

export const escaparHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
