import {
  type Categoria,
  type EstadoPublico,
  ESTADOS_PUBLICOS,
  NOMBRE_ESTADO,
} from "@/lib/reportes/presentacion";

type Props = {
  categorias: readonly Categoria[];
  colorPorCategoria: ReadonlyMap<number, string>;
  categoriasMarcadas: ReadonlySet<number>;
  estadosMarcados: ReadonlySet<EstadoPublico>;
  onCambiarCategoria: (id: number) => void;
  onCambiarEstado: (estado: EstadoPublico) => void;
};

// Las casillas de categoría también sirven de leyenda de colores del mapa.
export function FiltrosReportes({
  categorias,
  colorPorCategoria,
  categoriasMarcadas,
  estadosMarcados,
  onCambiarCategoria,
  onCambiarEstado,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 font-medium">Categoría</legend>
        {categorias.map((categoria) => (
          <label
            key={categoria.id}
            className="flex min-h-9 cursor-pointer items-center gap-2"
          >
            <input
              type="checkbox"
              checked={categoriasMarcadas.has(categoria.id)}
              onChange={() => onCambiarCategoria(categoria.id)}
              className="size-4"
            />
            <span
              aria-hidden="true"
              className="size-3.5 shrink-0 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.3)]"
              style={{ backgroundColor: colorPorCategoria.get(categoria.id) }}
            />
            {categoria.nombre}
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 font-medium">Estado</legend>
        {ESTADOS_PUBLICOS.map((estado) => (
          <label
            key={estado}
            className="flex min-h-9 cursor-pointer items-center gap-2"
          >
            <input
              type="checkbox"
              checked={estadosMarcados.has(estado)}
              onChange={() => onCambiarEstado(estado)}
              className="size-4"
            />
            {NOMBRE_ESTADO[estado]}
          </label>
        ))}
      </fieldset>
    </div>
  );
}
