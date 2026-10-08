// Service worker do espaço do Social Media (PWA, seção 11.5): recebe os avisos
// "Pulso" do Web Push e abre a tela certa ao tocar. Sem cache offline: o
// sistema depende de dados ao vivo.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', evento => evento.waitUntil(self.clients.claim()))

self.addEventListener('push', evento => {
  let dados = {}
  try { dados = evento.data ? evento.data.json() : {} } catch { dados = { body: evento.data ? evento.data.text() : '' } }
  const titulo = dados.title || 'Pró-Labore'
  // Com o espaço aberto, a lista de avisos se atualiza na hora.
  self.clients.matchAll({ type: 'window' }).then(abertas => abertas.forEach(c => c.postMessage({ tipo: 'sm:aviso' })))
  evento.waitUntil(self.registration.showNotification(titulo, {
    body: dados.body || '',
    tag: dados.tag || undefined,
    renotify: !!dados.tag,
    icon: '/sm-icone-192.png',
    badge: '/sm-icone-badge.png',
    data: { href: dados.href || '/pro-labore/sm' },
    lang: 'pt-BR',
  }))
})

self.addEventListener('notificationclick', evento => {
  evento.notification.close()
  const destino = new URL((evento.notification.data && evento.notification.data.href) || '/pro-labore/sm', self.location.origin).href
  evento.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const doEspaco = abertas.find(c => new URL(c.url).pathname.startsWith('/pro-labore/sm'))
    if (doEspaco) {
      await doEspaco.focus()
      if ('navigate' in doEspaco) return doEspaco.navigate(destino)
      return undefined
    }
    return self.clients.openWindow(destino)
  })())
})
