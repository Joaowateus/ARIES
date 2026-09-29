// Login OAuth com o Instagram (via Facebook Login) — client_id (App ID) é
// público por natureza, então dá pra montar a URL de autorização inteira no
// navegador, sem round-trip com o backend. O App Secret nunca aparece aqui:
// a troca do `code` por token acontece no servidor (POST /social-media/conectar-oauth).
export const META_OAUTH_SCOPES = 'instagram_basic,instagram_business_manage_insights,pages_show_list,pages_read_engagement'

// Guarda um valor aleatório antes de sair pro diálogo da Meta e confere na
// volta (callback) — proteção padrão contra CSRF em fluxos OAuth: sem isso,
// um `code` de outra sessão poderia ser "colado" na URL de callback de outra
// pessoa.
const CHAVE_ESTADO_OAUTH = 'pl_social_media_oauth_state'

export function metaAppIdConfigurado(): string | null {
  const id = process.env.NEXT_PUBLIC_META_APP_ID
  return id && id.trim() !== '' ? id : null
}

export function redirectUriSocialMediaOAuth(): string {
  return `${window.location.origin}/pro-labore/social-media/callback`
}

export function iniciarLoginInstagram(): void {
  const appId = metaAppIdConfigurado()
  if (!appId) return
  const estado = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  sessionStorage.setItem(CHAVE_ESTADO_OAUTH, estado)
  const url = new URL('https://www.facebook.com/v21.0/dialog/oauth')
  url.searchParams.set('client_id', appId)
  url.searchParams.set('redirect_uri', redirectUriSocialMediaOAuth())
  url.searchParams.set('scope', META_OAUTH_SCOPES)
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
