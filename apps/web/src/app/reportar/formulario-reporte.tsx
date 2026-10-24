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

import { FichaCategoria } from "@/components/categorias/ficha-categoria";
import {
  AVISO_ERROR,
  BOTON_PRINCIPAL,
  BOTON_SECUNDARIO,
  ENLACE,
  FOCO,
  TEXTO_ERROR,
  TEXTO_SUAVE,
  TITULO_SECCION,
} from "@/components/ui/estilos";
import { categoriaDe } from "@/lib/reportes/categorias";
import {
  type CampoReporte,
  erroresDeValidacion,
  type ErroresReporte,
  esquemaFotos,
  esquemaReporte,
  estaEnLaSerena,
  LARGO_DESCRIPCION_MAX,
  LARGO_REFERENCIA_MAX,
  LARGO_TITULO,
} from "@/lib/reportes/esquemas";
import { CENTRO_LA_SERENA } from "@/lib/reportes/presentacion";

import { crearReporte, type EstadoFormulario } from "./acciones";
import { CampoTexto, ErrorCampo } from "./campos";
import { type FotoElegida, SelectorFotos } from "./selector-fotos";
import type { Punto } from "./selector-ubicacion";

// MapLibre necesita el navegador (WebGL): no se prerenderiza.
const SelectorUbicacion = dynamic(() => import("./selector-ubicacion"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-(--superficie-2)" />,
});

const ESTADO_INICIAL: EstadoFormulario = { estado: "inicial" };

// Las secciones van separadas por una línea, sin tarjetas.
const SECCION = "border-t border-(--borde) pt-5";

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

type Categoria = { id: number; codigo: string; nombre: string };
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
          className={`${AVISO_ERROR} ${FOCO}`}
        >
          <p className={TEXTO_ERROR}>{problema.mensaje}</p>
          {Object.keys(problema.errores).length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {(Object.keys(problema.errores) as CampoReporte[]).map(
                (campo) => (
                  <li key={campo}>
                    <a href={`#${ID_CAMPO[campo]}`} className={ENLACE}>
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
        className={`flex flex-col gap-2 ${SECCION}`}
      >
        <h2 id="titulo-ubicacion" className={TITULO_SECCION}>
          Ubicación
        </h2>
        <p id="ayuda-ubicacion" className={`text-sm ${TEXTO_SUAVE}`}>
          El reporte quedará en el punto marcado al centro del mapa. Mueve el
          mapa con el dedo o el mouse; con el mapa enfocado, también con las
          flechas del teclado.
        </p>
        <div className="relative h-72 overflow-hidden rounded-(--radio-control) border-2 border-(--borde-control) md:h-96">
          <SelectorUbicacion destino={destino} onCambio={setUbicacion} />
        </div>
        <button
          id="usar-mi-ubicacion"
          type="button"
          onClick={usarMiUbicacion}
          aria-describedby={describir("ubicacion", "ayuda-ubicacion")}
          className={`${BOTON_SECUNDARIO} self-start`}
        >
          Usar mi ubicación
        </button>
        <p className={`text-sm ${TEXTO_SUAVE}`}>
          Punto elegido: {formatoCoordenada.format(ubicacion.latitud)},{" "}
          {formatoCoordenada.format(ubicacion.longitud)}
        </p>
        <div aria-live="polite" className="flex flex-col gap-1 text-sm">
          {avisoUbicacion && <p>{avisoUbicacion}</p>}
          {fueraDeLaSerena && !errores.ubicacion && (
            <p className="font-semibold">
              Atención: este punto está fuera de La Serena. Por ahora solo
              recibimos reportes de La Serena.
            </p>
          )}
        </div>
        {errores.ubicacion && (
          <p id="error-ubicacion" className={TEXTO_ERROR}>
            {errores.ubicacion}
          </p>
        )}
      </section>

      <section
        aria-labelledby="titulo-detalle"
        className={`flex flex-col gap-4 ${SECCION}`}
      >
        <h2 id="titulo-detalle" className={TITULO_SECCION}>
          Detalle
        </h2>

        {/* Opciones con su ficha (un <option> no puede mostrar íconos).
            Ninguna marcada al empezar: la persona elige. La ficha es
            decorativa; el nombre es la etiqueta de cada opción. */}
        <fieldset
          id="categoria_id"
          aria-describedby={describir("categoria_id")}
          className="flex flex-col gap-2"
        >
          <legend className="mb-1 font-semibold">Categoría</legend>
          <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:grid-cols-4">
            {categorias.map((categoria) => (
              <label
                key={categoria.id}
                className="flex min-h-12 cursor-pointer items-center gap-2 rounded-(--radio-control) border-2 border-(--borde) bg-(--superficie) px-3 py-2 has-[:checked]:border-(--tinta) has-[:checked]:bg-(--superficie-2) has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--foco)"
              >
                <input
                  type="radio"
                  name="categoria_id"
                  value={categoria.id}
                  checked={valores.categoria_id === String(categoria.id)}
                  onChange={(e) => cambiar("categoria_id", e.target.value)}
                  className="size-4 shrink-0 accent-(--tinta)"
                />
                <FichaCategoria
                  categoria={categoriaDe(categoria.codigo)}
                  tamano={28}
                />
                <span className="text-sm leading-tight">
                  {categoria.nombre}
                </span>
              </label>
            ))}
          </div>
          <ErrorCampo campo="categoria_id" errores={errores} />
        </fieldset>

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

      {/* La línea va en un div: en el <fieldset> la leyenda se dibujaría
          sobre el borde. */}
      <div className={SECCION}>
        <SelectorFotos
          fotos={fotos}
          onCambio={setFotos}
          onProcesando={setProcesandoFotos}
          error={errores.fotos}
        />
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={enviando || procesandoFotos}
          className={`${BOTON_PRINCIPAL} sm:self-start`}
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
