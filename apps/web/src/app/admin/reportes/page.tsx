import type { Metadata } from "next";
import Link from "next/link";

import {
  argumentosDeFiltros,
  consultaDeFiltros,
  LARGO_BUSQUEDA_MAX,
  leerFiltros,
  MODERACIONES,
  POR_PAGINA,
  TODAS_LAS_MODERACIONES,
} from "@/lib/admin/filtros";
import { tituloPagina } from "@/lib/marca";
import { ordenDeCategoria } from "@/lib/reportes/categorias";
import {
  ESTADOS_PUBLICOS,
  formatearFecha,
  NOMBRE_ESTADO,
  NOMBRE_MODERACION,
} from "@/lib/reportes/presentacion";

import { clienteAdmin } from "./acceso";
import { AvisoAdmin } from "./aviso-admin";
import { BOTON_PRINCIPAL, BOTON_SECUNDARIO, CAMPO } from "./estilos";

export const metadata: Metadata = {
  title: tituloPagina("Administración de reportes"),
  robots: { index: false },
};

export default async function AdminReportesPage({
  searchParams,
}: PageProps<"/admin/reportes">) {
  const parametros = await searchParams;
  const supabase = await clienteAdmin("/admin/reportes");
  const filtros = leerFiltros(parametros);

  const [{ data: filas, error }, { data: categorias }] = await Promise.all([
    supabase.rpc("listar_reportes_admin", argumentosDeFiltros(filtros)),
    // También las desactivadas: un reporte antiguo puede tener una.
    supabase
      .from("categorias")
      .select("id, codigo, nombre, activa")
      .eq("tipo", "reporte")
      .order("id"),
  ]);
  // En el orden del catálogo, como en el resto de la app.
  categorias?.sort(
    (a, b) => ordenDeCategoria(a.codigo) - ordenDeCategoria(b.codigo),
  );
  if (error) console.error("listar_reportes_admin", error.code);
  const nombreCategoria = new Map(
    (categorias ?? []).map((categoria) => [categoria.id, categoria.nombre]),
  );

  const reportes = filas ?? [];
  const total = reportes[0]?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const consulta = consultaDeFiltros(filtros);
  const rutaPagina = (pagina: number) => {
    const texto = consultaDeFiltros(filtros, { pagina });
    return `/admin/reportes${texto ? `?${texto}` : ""}`;
  };
  const hayFiltros = consulta !== "";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <Link href="/" className="self-start text-sm underline">
          Volver al mapa
        </Link>
        <h1 className="text-2xl font-bold">Administración de reportes</h1>
        <p className="text-zinc-700 dark:text-zinc-300">
          Todos los reportes, en cualquier estado de moderación, del más
          reciente al más antiguo. Cada cambio queda en el historial del
          reporte, con quién lo hizo.
        </p>
      </div>

      <AvisoAdmin codigo={parametros.aviso} />

      <form
        role="search"
        aria-label="Buscar y filtrar reportes"
        action="/admin/reportes"
        className="grid gap-4 rounded-md border border-zinc-300 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-zinc-700"
      >
        <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-4">
          <label htmlFor="q" className="font-medium">
            Buscar
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={filtros.q}
            maxLength={LARGO_BUSQUEDA_MAX}
            aria-describedby="ayuda-q"
            className={CAMPO}
          />
          <p id="ayuda-q" className="text-sm text-zinc-700 dark:text-zinc-300">
            Busca en el título, la descripción y la referencia.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="moderacion" className="font-medium">
            Moderación
          </label>
          <select
            id="moderacion"
            name="moderacion"
            defaultValue={filtros.moderacion ?? ""}
            className={CAMPO}
          >
            <option value="">Todos menos archivados</option>
            <option value={TODAS_LAS_MODERACIONES}>
              Todos, con archivados
            </option>
            {MODERACIONES.map((moderacion) => (
              <option key={moderacion} value={moderacion}>
                {NOMBRE_MODERACION[moderacion]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="estado" className="font-medium">
            Estado del problema
          </label>
          <select
            id="estado"
            name="estado"
            defaultValue={filtros.estado ?? ""}
            className={CAMPO}
          >
            <option value="">Todos</option>
            {ESTADOS_PUBLICOS.map((estado) => (
              <option key={estado} value={estado}>
                {NOMBRE_ESTADO[estado]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="categoria" className="font-medium">
            Categoría
          </label>
          <select
            id="categoria"
            name="categoria"
            defaultValue={filtros.categoria ?? ""}
            className={CAMPO}
          >
            <option value="">Todas</option>
            {(categorias ?? []).map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nombre}
                {!categoria.activa && " (desactivada)"}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <button type="submit" className={BOTON_PRINCIPAL}>
            Buscar
          </button>
          {hayFiltros && (
            <Link
              href="/admin/reportes"
              className="inline-flex min-h-11 items-center underline"
            >
              Quitar filtros
            </Link>
          )}
        </div>
      </form>

      {error ? (
        <p role="alert" className="text-red-700 dark:text-red-400">
          No pudimos cargar los reportes. Inténtalo de nuevo más tarde.
        </p>
      ) : reportes.length === 0 ? (
        filtros.pagina > 1 ? (
          <p>
            Esta página no tiene resultados.{" "}
            <Link href={rutaPagina(1)} className="underline">
              Ir a la primera página
            </Link>
          </p>
        ) : (
          <p>No hay reportes con estos filtros.</p>
        )
      ) : (
        // min-w-0: sin él, el ancho mínimo de la tabla ensancha la página
        // en pantallas angostas (desplazamiento horizontal).
        <section
          aria-labelledby="titulo-tabla"
          className="flex min-w-0 flex-col gap-3"
        >
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {total === 1 ? "1 reporte" : `${total} reportes`}
            {paginas > 1 && ` · página ${filtros.pagina} de ${paginas}`}
          </p>

          {/* En el teléfono, una lista: cada reporte en un bloque, sin
              desplazamiento hacia el lado. Archivar y eliminar están en el
              editor. */}
          <ul className="flex flex-col gap-3 sm:hidden">
            {reportes.map((reporte) => (
              <li
                key={reporte.id}
                className="flex flex-col gap-2 rounded-md border border-zinc-300 p-3 dark:border-zinc-700"
              >
                <p className="font-medium break-words">{reporte.titulo}</p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  {nombreCategoria.get(reporte.categoria_id) ?? "Sin categoría"}
                  {reporte.fotos > 0 &&
                    ` · ${reporte.fotos === 1 ? "1 foto" : `${reporte.fotos} fotos`}`}
                  {reporte.direccion_referencia &&
                    ` · ${reporte.direccion_referencia}`}
                </p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="font-medium">Moderación</dt>
                  <dd>{NOMBRE_MODERACION[reporte.moderacion]}</dd>
                  <dt className="font-medium">Estado</dt>
                  <dd>{NOMBRE_ESTADO[reporte.estado]}</dd>
                  <dt className="font-medium">Creado</dt>
                  <dd>{formatearFecha(reporte.creado_en)}</dd>
                </dl>
                <Link
                  href={`/admin/reportes/${reporte.id}`}
                  className={`${BOTON_SECUNDARIO} self-start`}
                >
                  Editar
                  <span className="sr-only"> «{reporte.titulo}»</span>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desde sm, la tabla. Si aun así no cabe, se desplaza dentro de
              su región, que se puede enfocar para hacerlo con el teclado. */}
          <div
            role="region"
            aria-labelledby="titulo-tabla"
            tabIndex={0}
            className="hidden overflow-x-auto rounded-md border border-zinc-300 sm:block dark:border-zinc-700"
          >
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <caption id="titulo-tabla" className="sr-only">
                Reportes
                {paginas > 1 && `, página ${filtros.pagina} de ${paginas}`}
              </caption>
              <thead className="bg-zinc-100 dark:bg-zinc-900">
                <tr>
                  <th scope="col" className="p-3">
                    Reporte
                  </th>
                  <th scope="col" className="p-3">
                    Moderación
                  </th>
                  <th scope="col" className="p-3">
                    Estado
                  </th>
                  <th scope="col" className="p-3">
                    Creado
                  </th>
                  <th scope="col" className="p-3">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {reportes.map((reporte) => (
                  <tr
                    key={reporte.id}
                    className="border-t border-zinc-300 align-top dark:border-zinc-700"
                  >
                    <th scope="row" className="p-3 font-normal">
                      <span className="block font-medium break-words">
                        {reporte.titulo}
                      </span>
                      <span className="block text-zinc-700 dark:text-zinc-300">
                        {nombreCategoria.get(reporte.categoria_id) ??
                          "Sin categoría"}
                        {reporte.fotos > 0 &&
                          ` · ${reporte.fotos === 1 ? "1 foto" : `${reporte.fotos} fotos`}`}
                      </span>
                      {reporte.direccion_referencia && (
                        <span className="block break-words text-zinc-600 dark:text-zinc-400">
                          {reporte.direccion_referencia}
                        </span>
                      )}
                    </th>
                    <td className="p-3">
                      {NOMBRE_MODERACION[reporte.moderacion]}
                    </td>
                    <td className="p-3">{NOMBRE_ESTADO[reporte.estado]}</td>
                    <td className="p-3 whitespace-nowrap">
                      {formatearFecha(reporte.creado_en)}
                    </td>
                    <td className="p-3">
                      <Link
                        href={`/admin/reportes/${reporte.id}`}
                        className={BOTON_SECUNDARIO}
                      >
                        Editar
                        <span className="sr-only"> «{reporte.titulo}»</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {paginas > 1 && (
            <nav
              aria-label="Páginas de resultados"
              className="flex flex-wrap items-center justify-between gap-3"
            >
              {filtros.pagina > 1 ? (
                <Link
                  href={rutaPagina(filtros.pagina - 1)}
                  className={BOTON_SECUNDARIO}
                >
                  Página anterior
                </Link>
              ) : (
                <span />
              )}
              <p className="text-sm">
                Página {filtros.pagina} de {paginas}
              </p>
              {filtros.pagina < paginas ? (
                <Link
                  href={rutaPagina(filtros.pagina + 1)}
                  className={BOTON_SECUNDARIO}
                >
                  Página siguiente
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </section>
      )}
    </main>
  );
}
