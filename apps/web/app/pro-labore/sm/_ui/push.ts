'use client'

// PWA e Web Push do espaço do Social Media (seção 11.5): registro do service
// worker, inscrição do aparelho e o convite para instalar.
import type { SmPushInscricao } from '@/lib/proLaboreApi'

export const SW_URL = '/sm-sw.js'
export const SW_ESCOPO = '/pro-labore/sm'

interface PedidoInstalar extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
let pedidoInstalar: PedidoInstalar | null = null
// O navegador oferece a instalação uma vez, no carregamento: guarda para o botão "Instalar".
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); pedidoInstalar = e as PedidoInstalar; window.dispatchEvent(new Event('sm:pode-instalar')) })
  window.addEventListener('appinstalled', () => { pedidoInstalar = null; window.dispatchEvent(new Event('sm:pode-instalar')) })
}
export const podeInstalar = () => !!pedidoInstalar
export async function instalar(): Promise<boolean> {
  if (!pedidoInstalar) return false
  const p = pedidoInstalar
  pedidoInstalar = null
  await p.prompt()
  const { outcome } = await p.userChoice
  window.dispatchEvent(new Event('sm:pode-instalar'))
  return outcome === 'accepted'
}

export const pushSuportado = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
export const ehIPhone = () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)
export const instaladoComoApp = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)
export const permissaoAvisos = (): NotificationPermission | null => (typeof Notification === 'undefined' ? null : Notification.permission)

export async function registrarSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  try { return await navigator.serviceWorker.register(SW_URL, { scope: SW_ESCOPO, updateViaCache: 'none' }) } catch { return null }
}

export async function inscricaoAtual(): Promise<PushSubscription | null> {
  if (!pushSuportado()) return null
  const r = await navigator.serviceWorker.getRegistration(SW_ESCOPO)
  return (await r?.pushManager.getSubscription()) ?? null
}

function chaveEmBytes(base64: string) {
  const b = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const bruto = atob(b)
  const saida = new Uint8Array(bruto.length)
  for (let i = 0; i < bruto.length; i++) saida[i] = bruto.charCodeAt(i)
  return saida
}

function nomeDoNavegador(): string {
  const ua = navigator.userAgent
  const nav = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navegador'
  const so = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iPhone' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : ''
  return so ? `${nav} · ${so}` : nav
}

/** Pede a permissão e inscreve o aparelho. Erro com mensagem pronta para a tela. */
export async function ativarPush(chavePublica: string): Promise<SmPushInscricao> {
  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') throw new Error(permissao === 'denied' ? 'O navegador bloqueou os avisos. Libere nas configurações do site e tente de novo.' : 'Os avisos não foram liberados.')
  const reg = (await navigator.serviceWorker.getRegistration(SW_ESCOPO)) ?? (await registrarSW())
  if (!reg) throw new Error('Este navegador não aceita avisos do app.')
  await navigator.serviceWorker.ready
  const atual = await reg.pushManager.getSubscription()
  const sub = atual ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveEmBytes(chavePublica) })
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  return { endpoint: json.endpoint, keys: json.keys, navegador: nomeDoNavegador() }
}

/** Cancela a inscrição deste aparelho; devolve o endpoint para sair do servidor. */
export async function desativarPush(): Promise<string | null> {
  const sub = await inscricaoAtual()
  if (!sub) return null
  const endpoint = sub.endpoint
  await sub.unsubscribe().catch(() => undefined)
  return endpoint
}
