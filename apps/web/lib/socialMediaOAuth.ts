// Login do Instagram (Business Login) — o dono autoriza direto com a conta
// profissional do Instagram, sem passar pelo Facebook. client_id (App ID do
// Instagram) é público por natureza, então dá pra montar a URL de
// autorização inteira no navegador, sem round-trip com o backend. O App
// Secret nunca aparece aqui: a troca do `code` por token acontece no
// servidor (POST /social-media/conectar-oauth).
export const INSTAGRAM_OAUTH_SCOPES = 'instagram_business_basic,instagram_business_manage_insights'

// Guarda um valor aleatório antes de sair pro diálogo do Instagram e confere
// na volta (callback) — proteção padrão contra CSRF em fluxos OAuth: sem
// isso, um `code` de outra sessão poderia ser "colado" na URL de callback de
// outra pessoa.
const CHAVE_ESTADO_OAUTH = 'pl_social_media_oauth_state'

export function instagramAppIdConfigurado(): string | null {
  const id = process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID
  return id && id.trim() !== '' ? id : null
}

export function redirectUriSocialMediaOAuth(): string {
  return `${window.location.origin}/pro-labore/social-media/callback`
}

export function iniciarLoginInstagram(): void {
  const appId = instagramAppIdConfigurado()
  if (!appId) return
  const estado = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  sessionStorage.setItem(CHAVE_ESTADO_OAUTH, estado)
  const url = new URL('https://www.instagram.com/oauth/authorize')
  url.searchParams.set('client_id', appId)
  url.searchParams.set('redirect_uri', redirectUriSocialMediaOAuth())
  url.searchParams.set('scope', INSTAGRAM_OAUTH_SCOPES)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', estado)
  window.location.href = url.toString()
}

// Chamado só pela página de callback — confere o `state` e limpa a chave em
// seguida (uso único, como qualquer nonce de CSRF).
export function consumirEstadoOAuth(estadoRecebido: string | null): boolean {
  const estadoSalvo = sessionStorage.getItem(CHAVE_ESTADO_OAUTH)
  sessionStorage.removeItem(CHAVE_ESTADO_OAUTH)
  return !!estadoRecebido && estadoRecebido === estadoSalvo
}
