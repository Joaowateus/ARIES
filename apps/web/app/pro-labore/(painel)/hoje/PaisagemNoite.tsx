// Fundo padrão da tela inicial: serra à noite, lua e um lago, em vetor (sem foto
// de terceiros). A loja pode trocar por uma imagem própria nas configurações da tela.
export function PaisagemNoite({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="pn-ceu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#05070b" /><stop offset=".45" stopColor="#0c1118" /><stop offset=".62" stopColor="#141b24" /><stop offset="1" stopColor="#07090d" />
        </linearGradient>
        <radialGradient id="pn-lua" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1230 170) scale(240)">
          <stop offset="0" stopColor="#c9d4e6" stopOpacity=".35" /><stop offset="1" stopColor="#c9d4e6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="pn-serra1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a313c" /><stop offset="1" stopColor="#151a21" /></linearGradient>
        <linearGradient id="pn-neve" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9aa6b8" stopOpacity=".55" /><stop offset="1" stopColor="#9aa6b8" stopOpacity="0" /></linearGradient>
        <linearGradient id="pn-lago" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#131a23" /><stop offset="1" stopColor="#06080b" /></linearGradient>
        <radialGradient id="pn-vinheta" cx=".5" cy=".45" r=".75"><stop offset=".55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".7" /></radialGradient>
      </defs>
      <rect width="1600" height="1000" fill="url(#pn-ceu)" />
      <g fill="#dfe6f2">
        {[[120, 90, .9], [260, 160, .6], [420, 60, 1.1], [560, 210, .7], [700, 120, .8], [860, 70, .6], [1180, 140, 1], [1320, 60, .7], [1460, 190, .9], [980, 40, .6], [1520, 90, .5], [330, 270, .5], [1240, 280, .5]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} opacity={.65} />)}
      </g>
      <rect width="1600" height="1000" fill="url(#pn-lua)" />
      <path d="M1242 156a22 22 0 1 0 0 30a17 17 0 1 1 0-30Z" fill="#e8edf6" opacity=".9" />
      <path d="M0 560 L140 470 L250 520 L380 400 L470 455 L560 380 L660 470 L760 430 L860 500 L980 420 L1080 470 L1200 360 L1320 450 L1430 400 L1600 480 L1600 640 L0 640 Z" fill="url(#pn-serra1)" opacity=".9" />
      <path d="M380 400 L410 425 L395 428 L430 452 L470 455 L560 380 L600 418 L580 420 L620 440 M1200 360 L1235 392 L1215 395 L1260 420 L1320 450" fill="none" stroke="url(#pn-neve)" strokeWidth="10" strokeLinejoin="round" opacity=".55" />
      <path d="M0 640 L120 580 L230 620 L360 560 L520 630 L680 590 L820 640 L960 600 L1120 650 L1260 600 L1400 640 L1600 590 L1600 700 L0 700 Z" fill="#0d1117" />
      <rect y="690" width="1600" height="310" fill="url(#pn-lago)" />
      <g opacity=".22" fill="#9fb0c8"><rect x="980" y="720" width="70" height="2" /><rect x="1000" y="740" width="40" height="2" /><rect x="990" y="764" width="56" height="2" /><rect x="1010" y="790" width="24" height="2" /></g>
      <g fill="#05070a">
        <path d="M1360 700 l14 -60 l14 60 Z M1392 700 l10 -44 l10 44 Z M1418 700 l16 -72 l16 72 Z M1450 700 l12 -50 l12 50 Z M1480 700 l18 -84 l18 84 Z M1520 700 l14 -60 l14 60 Z M1550 700 l20 -90 l20 90 Z" />
        <path d="M0 700 l18 -78 l18 78 Z M40 700 l12 -52 l12 52 Z M70 700 l16 -66 l16 66 Z" />
      </g>
      <rect x="1440" y="684" width="22" height="12" fill="#e2a85a" opacity=".55" />
      <rect width="1600" height="1000" fill="url(#pn-vinheta)" />
    </svg>
  )
}
