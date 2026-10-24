// Logo provisorio: un pin de mapa con un sol que asoma sobre el mar. Toma
// el color del texto (currentColor); el interior usa --logo-interior (por
// defecto, blanco). Para cambiar el logo, reemplaza este archivo.
// Es decorativo: el nombre de la app va siempre en texto junto a él.
export function Logo({ tamano = 32 }: { tamano?: number }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={tamano}
      height={tamano}
      viewBox="0 0 32 32"
      className="shrink-0"
    >
      <path
        d="M16 30.5S5 20.6 5 12.5a11 11 0 0 1 22 0c0 8.1-11 18-11 18z"
        fill="currentColor"
      />
      {/* Sol sobre la línea del mar. */}
      <path d="M11 14.2a5 5 0 0 1 10 0z" fill="var(--logo-interior, #ffffff)" />
      <path
        d="M9.5 16.6c1.6-1.1 3-1.1 4.5 0s3 1.1 4.5 0 3-1.1 4.5 0"
        fill="none"
        stroke="var(--logo-interior, #ffffff)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
