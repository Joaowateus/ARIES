// Badge da marca Aries — reaproveitado no topo do painel e nas telas de
// autenticação (login/setup/recuperar). Preto fixo com o "A" em prata,
// igual à logo real da empresa, independente do tema claro/escuro do resto
// do painel (uma logo não deveria mudar de cor conforme o usuário troca de
// tema).
export function AriesBrandMark({ size = 40 }: { size?: number }) {
  return (
    <div className="pl-brand-mark" style={{ width: size, height: size, borderRadius: size * 0.28 }}>
      <span style={{ fontSize: size * 0.48 }}>A</span>
    </div>
  )
}
