import { createContext } from "react"
// Ícones e módulos da navegação do ARIES (tela inicial e menu lateral usam
// a mesma lista, na mesma ordem e com os mesmos ícones).
// ---------- Ícones (traço fino, 24×24) ----------
export const ICONES: Record<string, string> = {
  inicio: 'M4 11.5 12 4.5l8 7M6.5 10v9.5h11V10',
  inteligencia: 'M12 3.5l1.6 4.3 4.4 1.7-4.4 1.6L12 15.5l-1.6-4.4L6 9.5l4.4-1.7L12 3.5ZM18 15l.7 1.8 1.8.7-1.8.7L18 20l-.7-1.8-1.8-.7 1.8-.7L18 15Z',
  crm: 'M4.5 5h4v14h-4zM10 5h4v9h-4zM15.5 5h4v6h-4z',
  trafego: 'M4 5.5h16l-6.2 7.2V18l-3.6 1.5v-6.8L4 5.5Z',
  comercial: 'M4 5h2l2 10h10l2-7H7.2M9.5 19.5a1 1 0 1 0 0-.01M17 19.5a1 1 0 1 0 0-.01',
  estoque: 'M4 8l8-4 8 4v8l-8 4-8-4V8Zm0 0 8 4 8-4M12 12v8',
  produtos: 'M5.5 16.5a2.5 2.5 0 1 0 0-.01M18.5 16.5a2.5 2.5 0 1 0 0-.01M8 16.5h6l2-5h-4l-1.5-3H8M14 8h2.5l2 4',
  equipe: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5 8.5c.6-3 2.6-4.5 5-4.5s4.4 1.5 5 4.5M16 5.3a3 3 0 0 1 0 5.4M17.5 15c1.4.6 2.3 2 2.6 4.5',
  relatorios: 'M6 3.5h8l4 4v13H6v-17ZM14 3.5v4h4M9 12h6M9 15.5h6M9 8.5h3',
  busca: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-4-4',
  lapis: 'M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4',
  sol: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
  lua: 'M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z',
  engrenagem: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4.9a7.6 7.6 0 0 0-2-1.2L14.5 3h-5l-.4 2.5a7.6 7.6 0 0 0-2 1.2l-2.4-.9-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-.9a7.6 7.6 0 0 0 2 1.2l.4 2.5h5l.4-2.5a7.6 7.6 0 0 0 2-1.2l2.4.9 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z',
  seta: 'M9 6l6 6-6 6',
  esquerda: 'M15 6l-6 6 6 6',
  mais: 'M12 5v14M5 12h14',
  lixo: 'M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12',
  nota: 'M6 3.5h12v17H6zM9 8h6M9 11.5h6M9 15h4',
  brilho: 'M12 4l1.5 5 5 1.5-5 1.5L12 17l-1.5-5-5-1.5 5-1.5L12 4Z',
  aspas: 'M7 17c-2 0-3-1.5-3-3.5C4 10 6 7.5 9 6.5l.6 1.2C7.7 8.6 7 9.8 7 11h1.5A2.5 2.5 0 0 1 11 13.5 3.3 3.3 0 0 1 7 17Zm9 0c-2 0-3-1.5-3-3.5 0-3.5 2-6 5-7l.6 1.2c-1.9.9-2.6 2.1-2.6 3.3h1.5a2.5 2.5 0 0 1 2.5 2.5A3.3 3.3 0 0 1 16 17Z',
  lead: 'M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6.5 9c.7-3.6 3.2-5.5 6.5-5.5M18 14v6M15 17h6',
  moto: 'M5.5 16.5a2.5 2.5 0 1 0 0-.01M18.5 16.5a2.5 2.5 0 1 0 0-.01M8 16.5h6l2-5h-4l-1.5-3H8M17 6v4M15 8h4',
  campanha: 'M4 10v4h3l6 4V6L7 10H4Zm13-1.5a4.5 4.5 0 0 1 0 7',
  relogio: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm0-12v4l3 2',
  calendario: 'M5 6h14v14H5zM5 10h14M9 3.5v4M15 3.5v4',
  conversa: 'M4 6.5h16v10H9l-5 4v-14Z',
  dinheiro: 'M4 7h16v10H4zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM7 10v4M17 10v4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
}
export function Ico({ n, className }: { n: string; className?: string }) {
  return <svg className={className ?? 'ia-ico'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONES[n] ?? ICONES.brilho} /></svg>
}


/** Os 9 módulos (especificação de 17/11); "grupo" liga cada módulo às abas do menu. */
export const MODULOS: Array<{ chave: string; nome: string; href: string; rota: string; grupo: string }> = [
  { chave: 'inicio', grupo: 'Início', nome: 'Início', href: '/pro-labore/hoje', rota: 'Tela inicial' },
  { chave: 'inteligencia', grupo: 'Inteligência', nome: 'Inteligência', href: '/pro-labore/recomendacoes', rota: 'Recomendações e Pergunte' },
  { chave: 'crm', grupo: 'CRM', nome: 'CRM', href: '/pro-labore/leads', rota: 'Leads e negociações' },
  { chave: 'trafego', grupo: 'Tráfego', nome: 'Tráfego', href: '/pro-labore/trafego', rota: 'Campanhas e anúncios' },
  { chave: 'comercial', grupo: 'Comercial', nome: 'Comercial', href: '/pro-labore/vendas', rota: 'Vendas e pagamentos' },
  { chave: 'estoque', grupo: 'Estoque', nome: 'Estoque', href: '/pro-labore/aba/estoque-demanda', rota: 'Estoque e demanda' },
  { chave: 'produtos', grupo: 'Produtos', nome: 'Produtos', href: '/pro-labore/whatsapp?aba=estoque', rota: 'Vitrine de motos' },
  { chave: 'equipe', grupo: 'Equipe', nome: 'Equipe', href: '/pro-labore/vendedores', rota: 'Pessoas e metas' },
  { chave: 'relatorios', grupo: 'Relatórios', nome: 'Relatórios', href: '/pro-labore/assistente', rota: 'Relatórios do período' },
]

/** Ícone do módulo pelo nome do grupo do menu ("Sistema" = engrenagem). */
export const moduloDoGrupo = (grupo: string | null | undefined) => MODULOS.find(m => m.grupo === grupo)?.chave ?? (grupo === 'Sistema' ? 'engrenagem' : 'brilho')

/** Os módulos que a pessoa vê, já com o endereço da primeira aba liberada (o menu e a tela inicial usam o mesmo). */
export const NavModulosContext = createContext<Array<{ chave: string; nome: string; href: string; rota: string }> | null>(null)
