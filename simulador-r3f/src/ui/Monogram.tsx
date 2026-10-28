// Monograma "SC" en placa amarilla de criminalística: la misma marca del favicon
// (public/favicon.svg). Texto en #131217 sobre #f2c230 (11:1), nunca blanco.
export function Monogram({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="30" height="30" rx="5" fill="#f2c230" />
      <path d="M1 25h30v1a5 5 0 0 1-5 5H6a5 5 0 0 1-5-5z" fill="#131217" opacity="0.18" />
      <text x="16" y="20.5" textAnchor="middle" fontSize="13.5" fontWeight="800" fill="#131217"
        fontFamily="'Public Sans Variable', system-ui, sans-serif" letterSpacing="-0.4">SC</text>
    </svg>
  );
}
