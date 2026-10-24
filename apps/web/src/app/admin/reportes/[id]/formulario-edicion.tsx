"use client";

import dynamic from "next/dynamic";
import {
  type FormEvent,
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";

import { CampoTexto, ErrorCampo } from "@/app/reportar/campos";
import type { Punto } from "@/app/reportar/selector-ubicacion";
import {
  type CampoReporte,
  erroresDeValidacion,
  type ErroresReporte,
  esquemaReporte,
  estaEnLaSerena,
  LARGO_DESCRIPCION_MAX,
  LARGO_REFERENCIA_MAX,
  LARGO_TITULO,
} from "@/lib/reportes/esquemas";
import {
  type EstadoReporte,
  ESTADOS_PUBLICOS,
  NOMBRE_ESTADO,
} from "@/lib/reportes/presentacion";

import { editarReporte, type EstadoEdicion } from "../acciones";
import { BOTON_PRINCIPAL, CAMPO } from "../estilos";

// MapLibre necesita el navegador (WebGL): no se prerenderiza.
const SelectorUbicacion = dynamic(
  () => import("@/app/reportar/selector-ubicacion"),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 bg-zinc-100 dark:bg-zinc-900" />
    ),
  },
);

const ESTADO_INICIAL: EstadoEdicion = { estado: "inicial" };

const ETIQUETA_CAMPO: Partial<Record<CampoReporte, string>> = {
  categoria_id: "Categoría",
  titulo: "Título",
  descripcion: "Descripción",
  direccion_referencia: "Referencia",
  ubicacion: "Ubicación",
};

const ID_CAMPO: Partial<Record<CampoReporte, string>> = {
  categoria_id: "categoria_id",
  titulo: "titulo",
  descripcion: "descripcion",
  direccion_referencia: "direccion_referencia",
  ubicacion: "ayuda-ubicacion",
};

type Problema = { mensaje: string; errores: ErroresReporte };

export type ReporteEditable = {
  id: string;
  version: string;
  categoria_id: number;
  titulo: string;
  descripcion: string | null;
  direccion_referencia: string | null;
  estado: EstadoReporte;
  latitud: number;
  longitud: number;
};

// Mismo formulario y mismas validaciones (esquemaReporte) que /reportar,
// más el estado del problema. Sin fotos: se moderan aparte.
export function FormularioEdicion({
  reporte,
  categorias,
}: {
  reporte: ReporteEditable;
  categorias: { id: number; nombre: string }[];
}) {
  const [estado, accion, enviando] = useActionState(
    editarReporte,
    ESTADO_INICIAL,
  );
  const [valores, setValores] = useState({
    categoria_id: String(reporte.categoria_id),
    titulo: reporte.titulo,
    descripcion: reporte.descripcion ?? "",
    direccion_referencia: reporte.direccion_referencia ?? "",
    estado: reporte.estado as string,
  });
  const [inicial] = useState<Punto>({
    latitud: reporte.latitud,
    longitud: reporte.longitud,
  });
  const [ubicacion, setUbicacion] = useState<Punto>(inicial);
  const [destino, setDestino] = useState<(Punto & { zoom: number }) | null>(
    null,
  );
  const [problemaLocal, setProblemaLocal] = useState<Problema | null>(null);

  const problema: Problema | null =
    problemaLocal ?? (estado.estado === "error" ? estado : null);
  const errores = problema?.errores ?? {};

  // Lleva el foco al resumen de errores para que se anuncie.
  const resumen = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (problema) resumen.current?.focus();
  }, [problema]);

  function cambiar(campo: keyof typeof valores, valor: string) {
    setValores((actuales) => ({ ...actuales, [campo]: valor }));
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;

    const { estado: estadoProblema, ...campos } = valores;
    const datos = {
      ...campos,
      latitud: String(ubicacion.latitud),
      longitud: String(ubicacion.longitud),
    };
    const validacion = esquemaReporte.safeParse(datos);
    if (!validacion.success) {
      setProblemaLocal({
        mensaje: "Revisa los campos marcados.",
        errores: erroresDeValidacion(validacion.error, undefined),
      });
      return;
    }
    setProblemaLocal(null);

    const formData = new FormData();
    formData.set("reporte_id", reporte.id);
    formData.set("version", reporte.version);
    formData.set("estado", estadoProblema);
    for (const [campo, valor] of Object.entries(datos)) {
      formData.set(campo, valor);
    }
    startTransition(() => accion(formData));
  }

  const describir = (campo: CampoReporte, ...ayudas: string[]) =>
    [...ayudas, errores[campo] ? `error-${campo}` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  const camposConError = (Object.keys(errores) as CampoReporte[]).filter(
    (campo) => ETIQUETA_CAMPO[campo],
  );

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-6">
      {problema && (
        <div
          ref={resumen}
          role="alert"
          tabIndex={-1}
          className="rounded-md border-2 border-red-700 p-4 dark:border-red-400"
        >
          <p className="font-medium">{problema.mensaje}</p>
          {camposConError.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {camposConError.map((campo) => (
                <li key={campo}>
                  <a href={`#${ID_CAMPO[campo]}`} className="underline">
                    {ETIQUETA_CAMPO[campo]}: {errores[campo]}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <section aria-labelledby="titulo-detalle" className="flex flex-col gap-4">
        <h2 id="titulo-detalle" className="text-lg font-bold">
          Detalle
        </h2>

        <div className="flex flex-col gap-1">
          <label htmlFor="estado" className="font-medium">
            Estado del problema
          </label>
          <select
            id="estado"
            value={valores.estado}
            onChange={(e) => cambiar("estado", e.target.value)}
            className={CAMPO}
          >
            {ESTADOS_PUBLICOS.map((opcion) => (
              <option key={opcion} value={opcion}>
                {NOMBRE_ESTADO[opcion]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="categoria_id" className="font-medium">
            Categoría
          </label>
          <select
            id="categoria_id"
            value={valores.categoria_id}
            onChange={(e) => cambiar("categoria_id", e.target.value)}
            aria-invalid={Boolean(errores.categoria_id)}
            aria-describedby={describir("categoria_id")}
            className={CAMPO}
          >
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nombre}
              </option>
            ))}
          </select>
          <ErrorCampo campo="categoria_id" errores={errores} />
        </div>

        <CampoTexto
          campo="titulo"
          etiqueta="Título"
          ayuda={`Entre ${LARGO_TITULO.min} y ${LARGO_TITULO.max} caracteres.`}
          valor={valores.titulo}
          maximo={LARGO_TITULO.max}
          errores={errores}
          describir={describir}
          onCambio={(valor) => cambiar("titulo", valor)}
        />

        <CampoTexto
          campo="descripcion"
          etiqueta="Descripción (opcional)"
          ayuda="Quita aquí datos personales que haya dejado el vecino (nombres, teléfonos, patentes). El historial solo registra que la descripción cambió, no su texto."
          valor={valores.descripcion}
          maximo={LARGO_DESCRIPCION_MAX}
          errores={errores}
          describir={describir}
          onCambio={(valor) => cambiar("descripcion", valor)}
          multilinea
        />

        <CampoTexto
          campo="direccion_referencia"
          etiqueta="Referencia (opcional)"
          ayuda="Por ejemplo: «Av. del Mar, frente al Faro»."
          valor={valores.direccion_referencia}
          maximo={LARGO_REFERENCIA_MAX}
          errores={errores}
          describir={describir}
          onCambio={(valor) => cambiar("direccion_referencia", valor)}
        />
      </section>

      <section
        aria-labelledby="titulo-ubicacion"
        className="flex flex-col gap-2"
      >
        <h2 id="titulo-ubicacion" className="text-lg font-bold">
          Ubicación
        </h2>
        <p
          id="ayuda-ubicacion"
          className="text-sm text-zinc-700 dark:text-zinc-300"
        >
          El reporte queda en el punto marcado al centro del mapa. Mueve el mapa
          con el dedo o el mouse; con el mapa enfocado, también con las flechas
          del teclado.
        </p>
        <div className="relative h-72 overflow-hidden rounded-md border border-zinc-300 md:h-96 dark:border-zinc-700">
          <SelectorUbicacion
            inicial={inicial}
            destino={destino}
            onCambio={setUbicacion}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setUbicacion(inicial);
            setDestino({ ...inicial, zoom: 16 });
          }}
          aria-describedby={describir("ubicacion", "ayuda-ubicacion")}
          className="self-start rounded-md border border-zinc-400 px-4 py-2 font-medium dark:border-zinc-600"
        >
          Volver al punto original
        </button>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Ubicación marcada en el mapa <span aria-hidden="true">✓</span>
        </p>
        <div aria-live="polite" className="text-sm font-medium">
          {!estaEnLaSerena(ubicacion) && !errores.ubicacion && (
            <p>Atención: este punto está fuera de La Serena.</p>
          )}
        </div>
        <ErrorCampo campo="ubicacion" errores={errores} />
      </section>

      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={enviando}
          className={`${BOTON_PRINCIPAL} sm:self-start`}
        >
          {enviando ? "Guardando…" : "Guardar cambios"}
        </button>
        <p aria-live="polite" className="text-sm">
          {enviando ? "Guardando los cambios…" : ""}
        </p>
      </div>
    </form>
  );
}
