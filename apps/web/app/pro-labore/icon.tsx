import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

// Favicon só pras rotas em /pro-labore/* (arquivo por segmento, não mexe no
// favicon do resto do ARIES) — mesmo badge preto + "A" prata da marca usada
// no topo do painel e nas telas de login/setup/recuperar.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#08090b',
          borderRadius: 8,
        }}
      >
        <div style={{ color: '#c9cbd4', fontSize: 21, fontWeight: 800, display: 'flex' }}>A</div>
      </div>
    ),
    { ...size },
  )
}
