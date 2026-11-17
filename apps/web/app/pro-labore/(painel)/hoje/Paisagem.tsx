// Imagem de abertura do Hoje: estrada entre montanhas ao entardecer, desenhada
// em vetor (leve, sem foto de terceiros). O lado esquerdo escurece para o texto
// ler bem; o sol e a estrada ficam à direita, onde está o número do mês.
export function Paisagem({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1200 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="px-ceu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1220" />
          <stop offset=".45" stopColor="#1d2638" />
          <stop offset=".72" stopColor="#6b4a3a" />
          <stop offset=".86" stopColor="#c9874a" />
          <stop offset="1" stopColor="#efb46a" />
        </linearGradient>
        <radialGradient id="px-sol" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(640 268) scale(260 170)">
          <stop offset="0" stopColor="#ffe2a8" stopOpacity=".95" />
          <stop offset=".18" stopColor="#f6b866" stopOpacity=".55" />
          <stop offset="1" stopColor="#f6b866" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="px-serra1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a3346" /><stop offset="1" stopColor="#2a2735" /></linearGradient>
        <linearGradient id="px-serra2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#221f2b" /><stop offset="1" stopColor="#17161e" /></linearGradient>
        <linearGradient id="px-chao" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#14131a" /><stop offset="1" stopColor="#0c0c11" /></linearGradient>
        <linearGradient id="px-estrada" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8a6a4c" /><stop offset=".25" stopColor="#3a3038" /><stop offset="1" stopColor="#1b1a21" /></linearGradient>
        <linearGradient id="px-leitura" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0d1015" stopOpacity=".78" />
          <stop offset=".4" stopColor="#0d1015" stopOpacity=".3" />
          <stop offset=".6" stopColor="#0d1015" stopOpacity="0" />
          <stop offset=".86" stopColor="#0d1015" stopOpacity="0" />
          <stop offset="1" stopColor="#0d1015" stopOpacity=".55" />
        </linearGradient>
        <linearGradient id="px-base" x1="0" y1="0" x2="0" y2="1"><stop offset=".7" stopColor="#0d1015" stopOpacity="0" /><stop offset="1" stopColor="#0d1015" stopOpacity=".95" /></linearGradient>
      </defs>
      <rect width="1200" height="420" fill="url(#px-ceu)" />
      <g fill="#fff" opacity=".55">
        <circle cx="120" cy="46" r="1" /><circle cx="260" cy="88" r=".8" /><circle cx="410" cy="34" r="1.1" /><circle cx="560" cy="72" r=".7" />
        <circle cx="700" cy="28" r=".9" /><circle cx="820" cy="64" r=".7" /><circle cx="980" cy="40" r="1" /><circle cx="1120" cy="80" r=".8" />
      </g>
      <rect width="1200" height="420" fill="url(#px-sol)" />
      <circle cx="640" cy="270" r="26" fill="#ffe7b8" opacity=".9" />
      <path d="M0 262 L90 214 L170 238 L260 176 L340 222 L420 196 L520 246 L610 206 L700 240 L790 198 L860 236 L950 214 L1040 182 L1120 220 L1200 196 L1200 300 L0 300 Z" fill="url(#px-serra1)" opacity=".85" />
      <path d="M0 300 L120 248 L210 284 L330 236 L450 292 L560 262 L640 290 L760 252 L840 286 L930 270 L1010 236 L1100 278 L1200 250 L1200 330 L0 330 Z" fill="url(#px-serra2)" />
      <path d="M0 318 L1200 300 L1200 420 L0 420 Z" fill="url(#px-chao)" />
      <path d="M619 302 L661 302 L865 420 L435 420 Z" fill="url(#px-estrada)" />
      <path d="M640 306 L642 318 M646 332 L650 352 M656 372 L664 404" stroke="#f3c27a" strokeWidth="2.4" strokeLinecap="round" opacity=".85" />
      <path d="M619 302 L435 420 M661 302 L865 420" stroke="#e2a85a" strokeWidth="1" opacity=".35" />
      <rect width="1200" height="420" fill="url(#px-leitura)" />
      <rect width="1200" height="420" fill="url(#px-base)" />
    </svg>
  )
}

/** Versão em retrato para o cartão da frase do dia (a mesma estrada, de perto). */
export function PaisagemRetrato({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 300 380" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="pr-ceu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0f1626" /><stop offset=".55" stopColor="#2b2b3d" /><stop offset=".8" stopColor="#8a5b3f" /><stop offset="1" stopColor="#d99a58" /></linearGradient>
        <linearGradient id="pr-escuro" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0d1015" stopOpacity=".1" /><stop offset=".55" stopColor="#0d1015" stopOpacity=".55" /><stop offset="1" stopColor="#0d1015" stopOpacity=".95" /></linearGradient>
      </defs>
      <rect width="300" height="380" fill="url(#pr-ceu)" />
      <path d="M0 210 L60 150 L110 190 L170 120 L230 176 L300 140 L300 260 L0 260 Z" fill="#2b2836" />
      <path d="M0 250 L70 206 L140 244 L210 200 L300 236 L300 380 L0 380 Z" fill="#17161e" />
      <path d="M140 244 L160 244 L230 380 L70 380 Z" fill="#2e2a31" />
      <path d="M150 252 L151 262 M153 276 L156 296 M160 318 L165 350" stroke="#f3c27a" strokeWidth="2" strokeLinecap="round" opacity=".8" />
      <rect width="300" height="380" fill="url(#pr-escuro)" />
    </svg>
  )
}
