import { FichaCategoria } from "@/components/categorias/ficha-categoria";
import { FOCO } from "@/components/ui/estilos";
import { categoriaDe } from "@/lib/reportes/categorias";
import {
  type Categoria,
  type EstadoPublico,
  ESTADOS_PUBLICOS,
  NOMBRE_ESTADO,
} from "@/lib/reportes/presentacion";

const CASILLA = `size-4 shrink-0 accent-(--tinta) ${FOCO}`;

type Props = {
  // Solo las activas, en el orden del catálogo.
  categorias: readonly Categoria[];
  categoriasMarcadas: ReadonlySet<number>;
  estadosMarcados: ReadonlySet<EstadoPublico>;
  onCambiarCategoria: (id: number) => void;
  onCambiarEstado: (estado: EstadoPublico) => void;
};

// Las casillas de categoría también sirven de leyenda de las fichas del
// mapa (ícono y color).
export function FiltrosReportes({
  categorias,
  categoriasMarcadas,
  estadosMarcados,
  onCambiarCategoria,
  onCambiarEstado,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 font-semibold">Categoría</legend>
        {categorias.map((categoria) => (
          <label
            key={categoria.id}
            className="flex min-h-10 cursor-pointer items-center gap-2"
          >
            <input
              type="checkbox"
              checked={categoriasMarcadas.has(categoria.id)}
              onChange={() => onCambiarCategoria(categoria.id)}
              className={CASILLA}
            />
            <FichaCategoria
              categoria={categoriaDe(categoria.codigo)}
              tamano={24}
            />
            {categoria.nombre}
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 font-semibold">Estado</legend>
        {ESTADOS_PUBLICOS.map((estado) => (
          <label
            key={estado}
            className="flex min-h-10 cursor-pointer items-center gap-2"
          >
            <input
              type="checkbox"
              checked={estadosMarcados.has(estado)}
              onChange={() => onCambiarEstado(estado)}
              className={CASILLA}
            />
            {NOMBRE_ESTADO[estado]}
          </label>
        ))}
      </fieldset>
    </div>
  );
}
