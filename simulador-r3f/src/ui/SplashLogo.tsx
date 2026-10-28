// Marca del simulador: la placa A-frame amarilla con la que criminalística numera
// los EMP/EF, delante de un tramo de cinta de cordón. Mismos colores que la escena
// (#f2c230 placa y cinta, #131217 tinta). Texto oscuro sobre amarillo (11:1).
export function SplashLogo({ size = 160 }: { size?: number }) {
  return (
    <svg className="splash-logo" width={size} height={size} viewBox="-14 0 228 200" role="img" aria-label="Placa de numeración de evidencia SC">
      {/* Cinta de cordón detrás de la placa */}
      <g transform="rotate(-12 100 112)">
        <rect x="-34" y="98" width="268" height="26" fill="#f2c230" />
        {/* Un "NO PASE" entero a cada lado de la placa */}
        <text x="15" y="115.5" textAnchor="middle" fontSize="11" fontWeight="800" fill="#131217" letterSpacing="1"
          fontFamily="'Public Sans Variable', system-ui, sans-serif">NO PASE</text>
        <text x="187" y="115.5" textAnchor="middle" fontSize="11" fontWeight="800" fill="#131217" letterSpacing="1"
          fontFamily="'Public Sans Variable', system-ui, sans-serif">NO PASE</text>
      </g>
      {/* Sombra de contacto */}
      <ellipse cx="100" cy="180" rx="66" ry="7" fill="#000" opacity="0.45" />
      {/* Cara lateral (en sombra) */}
      <path d="M140 38 L152 42 L170 174 L158 178 Z" fill="#a5831c" />
      {/* Cara frontal de la placa */}
      <path d="M58 38 H140 L158 178 H40 Z" fill="#f2c230" stroke="#131217" strokeWidth="3" strokeLinejoin="round" />
      {/* Filete interior: separa el número del rótulo */}
      <path d="M46 140 H152" stroke="#131217" strokeWidth="3" />
      <text x="99" y="118" textAnchor="middle" fontSize="54" fontWeight="800" fill="#131217" letterSpacing="-2"
        fontFamily="'Public Sans Variable', system-ui, sans-serif">SC</text>
      <text x="99" y="168" textAnchor="middle" fontSize="14" fontWeight="800" fill="#131217" letterSpacing="2"
        fontFamily="'Public Sans Variable', system-ui, sans-serif">EMP / EF</text>
    </svg>
  );
}
