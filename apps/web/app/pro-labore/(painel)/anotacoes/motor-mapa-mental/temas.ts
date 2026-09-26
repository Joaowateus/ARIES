// Temas do motor de mapa mental — só aparência, nunca posição. Cópia literal
// do objeto THEMES da referência (referencia/motor-mapa-mental.html): mesmos
// 5 temas, mesmas cores, mesmo `style`/`rootStyle` (o que muda a FORMA do nó:
// texto solto, sublinhado, pílula ou caixa) e mesma paleta cíclica por ramo.
export type EstiloNo = 'text' | 'pill' | 'box' | 'underline'

export interface Tema {
  name: string
  bg: string
  dots: string
  text: string
  rootText: string
  rootFill?: string
  rootStroke?: string
  sel: string
  style: EstiloNo
  rootStyle: EstiloNo
  palette: string[]
}

export const THEMES: Record<string, Tema> = {
  meister: {
    name: 'Meister', bg: '#ffffff', dots: '#e4e7ec', text: '#2a2f38', rootText: '#171a20', sel: '#2f6bff',
    style: 'text', rootStyle: 'text', palette: ['#3b6cf6', '#a36cf0', '#ee4f8a', '#12a898', '#f08a1c', '#2e9e4f'],
  },
  prism: {
    name: 'Prism', bg: '#fbfbfc', dots: '#e4e7ec', text: '#1f2430', rootText: '#ffffff', rootFill: '#5b6270', sel: '#2f6bff',
    style: 'pill', rootStyle: 'pill', palette: ['#1fb8cc', '#7bc31a', '#8f63f0', '#f2b200', '#ef4a2f', '#ff8c1a'],
  },
  ocean: {
    name: 'Oceano', bg: '#f7fafc', dots: '#dce4ee', text: '#1e293b', rootText: '#0f172a', sel: '#2563eb',
    style: 'text', rootStyle: 'text', palette: ['#1d4ed8', '#0ea5e9', '#0d9488', '#65a30d', '#4f46e5', '#0891b2'],
  },
  sunset: {
    name: 'Pôr do sol', bg: '#fffaf6', dots: '#efe2d7', text: '#2b2320', rootText: '#1c1411', sel: '#e0531f',
    style: 'text', rootStyle: 'text', palette: ['#f97316', '#e11d48', '#9333ea', '#ca8a04', '#db2777', '#ea580c'],
  },
  noite: {
    name: 'Noite', bg: '#101216', dots: '#252a33', text: '#e9ecf1', rootText: '#ffffff', rootFill: '#1c1f26', rootStroke: '#303541', sel: '#7ea6ff',
    style: 'underline', rootStyle: 'box', palette: ['#4f8cff', '#f2a33a', '#ef5a67', '#34c98a', '#a979f5', '#36c3de'],
  },
}

export const TEMA_PADRAO = 'meister'
