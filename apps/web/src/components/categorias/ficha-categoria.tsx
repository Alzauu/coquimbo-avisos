import { type CategoriaVisual, GROSOR_ICONO } from "@/lib/reportes/categorias";

// Ficha de una categoría: círculo de color con borde blanco y el ícono en
// blanco. Sin ícono (Otros), un punto más pequeño, como el marcador de
// siempre. Es decorativa: el nombre de la categoría va siempre en texto
// junto a ella.
export function FichaCategoria({
  categoria,
  tamano = 24,
}: {
  categoria: CategoriaVisual;
  tamano?: number;
}) {
  if (!categoria.trazos) {
    return (
      <svg
        aria-hidden="true"
        focusable="false"
        width={tamano}
        height={tamano}
        viewBox="0 0 28 28"
        className="shrink-0"
      >
        <circle
          cx="14"
          cy="14"
          r="8"
          fill={categoria.color}
          stroke="#ffffff"
          strokeWidth="2"
        />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={tamano}
      height={tamano}
      viewBox="0 0 28 28"
      className="shrink-0"
    >
      <circle
        cx="14"
        cy="14"
        r="13"
        fill={categoria.color}
        stroke="#ffffff"
        strokeWidth="2"
      />
      {/* Ícono de 24×24 reducido a 16×16 y centrado. */}
      <g
        transform="translate(6 6) scale(0.6667)"
        fill="none"
        stroke="#ffffff"
        strokeWidth={GROSOR_ICONO}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {categoria.trazos.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
