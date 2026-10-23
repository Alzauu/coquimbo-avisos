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

import {
  type CampoReporte,
  erroresDeValidacion,
  type ErroresReporte,
  esquemaFotos,
  esquemaReporte,
  estaEnLaSerena,
  largo,
  LARGO_DESCRIPCION_MAX,
  LARGO_REFERENCIA_MAX,
  LARGO_TITULO,
} from "@/lib/reportes/esquemas";
import { CENTRO_LA_SERENA } from "@/lib/reportes/presentacion";

import { crearReporte, type EstadoFormulario } from "./acciones";
import { type FotoElegida, SelectorFotos } from "./selector-fotos";
import type { Punto } from "./selector-ubicacion";

// MapLibre necesita el navegador (WebGL): no se prerenderiza.
const SelectorUbicacion = dynamic(() => import("./selector-ubicacion"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 bg-zinc-100 dark:bg-zinc-900" />
  ),
});

const ESTADO_INICIAL: EstadoFormulario = { estado: "inicial" };

const ETIQUETA_CAMPO: Record<CampoReporte, string> = {
  categoria_id: "Categoría",
  titulo: "Título",
  descripcion: "Descripción",
  direccion_referencia: "Referencia",
  ubicacion: "Ubicación",
  fotos: "Fotos",
};

// Destino del enlace de cada error en el resumen.
const ID_CAMPO: Record<CampoReporte, string> = {
  categoria_id: "categoria_id",
  titulo: "titulo",
  descripcion: "descripcion",
  direccion_referencia: "direccion_referencia",
  ubicacion: "usar-mi-ubicacion",
  fotos: "ayuda-fotos",
};

const ERRORES_UBICACION: Record<number, string> = {
  1: "No diste permiso para usar tu ubicación. Puedes mover el mapa a mano.",
  2: "No pudimos obtener tu ubicación. Puedes mover el mapa a mano.",
  3: "Tu ubicación tardó demasiado en llegar. Inténtalo otra vez o mueve el mapa a mano.",
};

type Categoria = { id: number; nombre: string };
type Problema = { mensaje: string; errores: ErroresReporte };

const formatoCoordenada = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 5,
});

export function FormularioReporte({ categorias }: { categorias: Categoria[] }) {
  const [estado, accion, enviando] = useActionState(
    crearReporte,
    ESTADO_INICIAL,
  );
  const [valores, setValores] = useState({
    categoria_id: "",
    titulo: "",
    descripcion: "",
    direccion_referencia: "",
  });
  const [ubicacion, setUbicacion] = useState<Punto>({
    latitud: CENTRO_LA_SERENA[1],
    longitud: CENTRO_LA_SERENA[0],
  });
  const [destino, setDestino] = useState<(Punto & { zoom: number }) | null>(
    null,
  );
  const [avisoUbicacion, setAvisoUbicacion] = useState("");
  const [fotos, setFotos] = useState<FotoElegida[]>([]);
  const [procesandoFotos, setProcesandoFotos] = useState(false);
  const [problemaLocal, setProblemaLocal] = useState<Problema | null>(null);

  // Los errores del navegador se muestran hasta el siguiente envío; después,
  // los que devuelva el servidor.
  const problema: Problema | null =
    problemaLocal ?? (estado.estado === "error" ? estado : null);
  const errores = problema?.errores ?? {};

  // Lleva el foco al resumen de errores para que se anuncie y se pueda
  // recorrer con el teclado.
  const resumen = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (problema) resumen.current?.focus();
  }, [problema]);

  function cambiar(campo: keyof typeof valores, valor: string) {
    setValores((actuales) => ({ ...actuales, [campo]: valor }));
  }

  function usarMiUbicacion() {
    if (!("geolocation" in navigator)) {
      setAvisoUbicacion(
        "Tu navegador no permite obtener la ubicación. Mueve el mapa a mano.",
      );
      return;
    }
    setAvisoUbicacion("Buscando tu ubicación…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const punto = { latitud: coords.latitude, longitud: coords.longitude };
        setUbicacion(punto);
        setDestino({ ...punto, zoom: 17 });
        setAvisoUbicacion(
          `Listo: centramos el mapa en tu ubicación (precisión aproximada de ${Math.round(coords.accuracy)} m). Ajusta el punto si hace falta.`,
        );
      },
      (error) =>
        setAvisoUbicacion(
          ERRORES_UBICACION[error.code] ?? ERRORES_UBICACION[2]!,
        ),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando || procesandoFotos) return;

    const datos = {
      ...valores,
      latitud: String(ubicacion.latitud),
      longitud: String(ubicacion.longitud),
    };
    const archivos = fotos.map((foto) => foto.archivo);
    const campos = esquemaReporte.safeParse(datos);
    const validacionFotos = esquemaFotos.safeParse(archivos);
    if (!campos.success || !validacionFotos.success) {
      setProblemaLocal({
        mensaje: "Revisa los campos marcados.",
        errores: erroresDeValidacion(campos.error, validacionFotos.error),
      });
      return;
    }
    setProblemaLocal(null);

    const formData = new FormData();
    for (const [campo, valor] of Object.entries(datos)) {
      formData.set(campo, valor);
    }
    for (const archivo of archivos) formData.append("fotos", archivo);
    startTransition(() => accion(formData));
  }

  // aria-describedby con la ayuda del campo y, si lo hay, su error.
  const describir = (campo: CampoReporte, ...ayudas: string[]) =>
    [...ayudas, errores[campo] ? `error-${campo}` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  const fueraDeLaSerena = !estaEnLaSerena(ubicacion);

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
          {Object.keys(problema.errores).length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {(Object.keys(problema.errores) as CampoReporte[]).map(
                (campo) => (
                  <li key={campo}>
                    <a href={`#${ID_CAMPO[campo]}`} className="underline">
                      {ETIQUETA_CAMPO[campo]}: {problema.errores[campo]}
                    </a>
                  </li>
                ),
              )}
            </ul>
          )}
        </div>
      )}

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
          El reporte quedará en el punto marcado al centro del mapa. Mueve el
          mapa con el dedo o el mouse; con el mapa enfocado, también con las
          flechas del teclado.
        </p>
        <div className="relative h-72 overflow-hidden rounded-md border border-zinc-300 md:h-96 dark:border-zinc-700">
          <SelectorUbicacion destino={destino} onCambio={setUbicacion} />
        </div>
        <button
          id="usar-mi-ubicacion"
          type="button"
          onClick={usarMiUbicacion}
          aria-describedby={describir("ubicacion", "ayuda-ubicacion")}
          className="self-start rounded-md border border-zinc-400 px-4 py-2 font-medium dark:border-zinc-600"
        >
          Usar mi ubicación
        </button>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Punto elegido: {formatoCoordenada.format(ubicacion.latitud)},{" "}
          {formatoCoordenada.format(ubicacion.longitud)}
        </p>
        <div aria-live="polite" className="flex flex-col gap-1 text-sm">
          {avisoUbicacion && <p>{avisoUbicacion}</p>}
          {fueraDeLaSerena && !errores.ubicacion && (
            <p className="font-medium">
              Atención: este punto está fuera de La Serena. Por ahora solo
              recibimos reportes de La Serena.
            </p>
          )}
        </div>
        {errores.ubicacion && (
          <p id="error-ubicacion" className="text-red-700 dark:text-red-400">
            {errores.ubicacion}
          </p>
        )}
      </section>

      <section aria-labelledby="titulo-detalle" className="flex flex-col gap-4">
        <h2 id="titulo-detalle" className="text-lg font-bold">
          Detalle
        </h2>

        <div className="flex flex-col gap-1">
          <label htmlFor="categoria_id" className="font-medium">
            Categoría
          </label>
          <select
            id="categoria_id"
            name="categoria_id"
            value={valores.categoria_id}
            onChange={(e) => cambiar("categoria_id", e.target.value)}
            aria-invalid={Boolean(errores.categoria_id)}
            aria-describedby={describir("categoria_id")}
            className="rounded-md border border-zinc-400 bg-transparent px-3 py-2 dark:border-zinc-600"
          >
            <option value="">Elige una categoría</option>
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
          ayuda="Un resumen corto, por ejemplo: «Bache profundo frente al colegio»."
          valor={valores.titulo}
          maximo={LARGO_TITULO.max}
          errores={errores}
          describir={describir}
          onCambio={(valor) => cambiar("titulo", valor)}
        />

        <CampoTexto
          campo="descripcion"
          etiqueta="Descripción (opcional)"
          ayuda="Qué pasa, desde cuándo y cómo afecta. No incluyas datos personales."
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

      <SelectorFotos
        fotos={fotos}
        onCambio={setFotos}
        onProcesando={setProcesandoFotos}
        error={errores.fotos}
      />

      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={enviando || procesandoFotos}
          className="rounded-md bg-zinc-900 px-4 py-3 font-medium text-white disabled:opacity-60 sm:self-start dark:bg-zinc-100 dark:text-zinc-900"
        >
          {enviando ? "Enviando reporte…" : "Enviar reporte"}
        </button>
        <p aria-live="polite" className="text-sm">
          {procesandoFotos
            ? "Espera a que terminen de prepararse las fotos."
            : enviando
              ? "Enviando tu reporte y sus fotos. Esto puede tardar unos segundos."
              : ""}
        </p>
      </div>
    </form>
  );
}

function ErrorCampo({
  campo,
  errores,
}: {
  campo: CampoReporte;
  errores: ErroresReporte;
}) {
  if (!errores[campo]) return null;
  return (
    <p id={`error-${campo}`} className="text-red-700 dark:text-red-400">
      {errores[campo]}
    </p>
  );
}

type PropsCampoTexto = {
  campo: "titulo" | "descripcion" | "direccion_referencia";
  etiqueta: string;
  ayuda: string;
  valor: string;
  maximo: number;
  errores: ErroresReporte;
  describir: (campo: CampoReporte, ...ayudas: string[]) => string | undefined;
  onCambio: (valor: string) => void;
  multilinea?: boolean;
};

function CampoTexto({
  campo,
  etiqueta,
  ayuda,
  valor,
  maximo,
  errores,
  describir,
  onCambio,
  multilinea = false,
}: PropsCampoTexto) {
  const usados = largo(valor);
  const propiedades = {
    id: campo,
    name: campo,
    value: valor,
    onChange: (
      evento: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => onCambio(evento.target.value),
    "aria-invalid": Boolean(errores[campo]),
    // El contador se lee junto con la ayuda al enfocar el campo, sin
    // anunciar cada tecla.
    "aria-describedby": describir(campo, `ayuda-${campo}`, `contador-${campo}`),
    className:
      "rounded-md border border-zinc-400 bg-transparent px-3 py-2 dark:border-zinc-600",
  };

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={campo} className="font-medium">
        {etiqueta}
      </label>
      <p
        id={`ayuda-${campo}`}
        className="text-sm text-zinc-700 dark:text-zinc-300"
      >
        {ayuda}
      </p>
      {multilinea ? (
        <textarea rows={5} {...propiedades} />
      ) : (
        <input type="text" {...propiedades} />
      )}
      <p
        id={`contador-${campo}`}
        className={`text-sm ${usados > maximo ? "font-medium text-red-700 dark:text-red-400" : "text-zinc-700 dark:text-zinc-300"}`}
      >
        {usados} de {maximo} caracteres
        {usados > maximo && ` (te pasaste por ${usados - maximo})`}
      </p>
      <ErrorCampo campo={campo} errores={errores} />
    </div>
  );
}
