"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { votarReporte } from "@/app/reporte/acciones";
import {
  BOTON_CHICO,
  ENLACE,
  TEXTO_ERROR,
  TEXTO_SUAVE,
} from "@/components/ui/estilos";
import { radioDuplicados } from "@/lib/reportes/categorias";
import {
  ESPERA_CERCANOS_MS,
  sinDescartados,
  textoDistancia,
  textoResumenCercanos,
} from "@/lib/reportes/cercanos";
import {
  type EstadoReporte,
  formatearFecha,
  NOMBRE_ESTADO,
} from "@/lib/reportes/presentacion";
import { AVISO_ME_AFECTA, textoVotos } from "@/lib/reportes/votos";
import { createClient } from "@/lib/supabase/client";

import type { Punto } from "./selector-ubicacion";

// Posibles duplicados del reporte que se está escribiendo: reportes
// públicos de la misma categoría cerca del punto marcado. Solo informa:
// nunca impide enviar. Si la consulta falla, no muestra nada.

type Cercano = {
  id: string;
  titulo: string;
  direccion_referencia: string | null;
  estado: EstadoReporte;
  creado_en: string;
  me_afecta: number;
  distancia_m: number;
  // Reporte de quien está reportando: no puede votarlo.
  propio: boolean;
};

type Resultado = { categoriaId: number; reportes: Cercano[] };

type Props = {
  // null mientras no se elija una categoría: no se busca nada.
  categoria: { id: number; codigo: string } | null;
  ubicacion: Punto;
};

export function PosiblesDuplicados({ categoria, ubicacion }: Props) {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [descartados, setDescartados] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const categoriaId = categoria?.id ?? null;
  const codigo = categoria?.codigo ?? null;
  const { latitud, longitud } = ubicacion;

  useEffect(() => {
    if (categoriaId === null) return;
    const controlador = new AbortController();
    const espera = setTimeout(async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .rpc("reportes_cercanos", {
          latitud,
          longitud,
          categoria: categoriaId,
          radio_m: radioDuplicados(codigo),
        })
        .abortSignal(controlador.signal);
      if (controlador.signal.aborted) return;
      if (error) {
        // Sin coordenadas en el registro: solo el código.
        console.error("reportes_cercanos", error.code);
        return;
      }

      // ¿Alguno es propio? Solo dice sí o no para quien consulta. Si
      // falla, se muestra el botón: la base rechaza igual el voto propio.
      const propios = await Promise.all(
        data.map(async (fila) => {
          const { data: propio } = await supabase
            .rpc("es_mi_reporte", { reporte: fila.id })
            .abortSignal(controlador.signal);
          return propio === true;
        }),
      );
      if (controlador.signal.aborted) return;

      setResultado({
        categoriaId,
        reportes: data.map((fila, indice) => ({
          ...fila,
          propio: propios[indice] ?? false,
        })),
      });
    }, ESPERA_CERCANOS_MS);

    return () => {
      clearTimeout(espera);
      controlador.abort();
    };
  }, [categoriaId, codigo, latitud, longitud]);

  // Mientras llega la nueva consulta se mantienen los resultados del punto
  // anterior (sin parpadeo), pero nunca los de otra categoría.
  const visibles =
    resultado && resultado.categoriaId === categoriaId
      ? sinDescartados(resultado.reportes, descartados)
      : [];

  function descartarTodos() {
    setDescartados(
      (actuales) => new Set([...actuales, ...visibles.map((r) => r.id)]),
    );
  }

  return (
    <>
      {/* Siempre montada, para que el lector de pantalla anuncie el cambio. */}
      <p aria-live="polite" className="sr-only">
        {visibles.length > 0 ? textoResumenCercanos(visibles.length) : ""}
      </p>

      {visibles.length > 0 && (
        <section
          aria-labelledby="titulo-duplicados"
          className="flex flex-col gap-3 rounded-(--radio-control) border-2 border-(--borde-control) bg-(--superficie-2) p-4"
        >
          <div className="flex flex-col gap-1">
            <h3 id="titulo-duplicados" className="font-semibold">
              ¿Es alguno de estos?
            </h3>
            <p className={`text-sm ${TEXTO_SUAVE}`}>
              {textoResumenCercanos(visibles.length)} Si es el mismo problema,
              suma tu «Me afecta» en vez de reportarlo otra vez. Si no, sigue
              con tu reporte.
            </p>
          </div>

          <ul className="flex flex-col gap-3">
            {visibles.map((reporte) => (
              <li key={reporte.id}>
                <TarjetaCercano reporte={reporte} />
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={descartarTodos}
            className={`${BOTON_CHICO} self-start`}
          >
            Ninguno: es otro problema
          </button>
        </section>
      )}
    </>
  );
}

function TarjetaCercano({ reporte }: { reporte: Cercano }) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const idTitulo = `cercano-${reporte.id}`;

  function meAfecta() {
    if (enviando) return;
    setError(null);
    iniciar(async () => {
      const resultado = await votarReporte(reporte.id, 1);
      if (resultado.estado === "error") {
        setError(resultado.mensaje);
        return;
      }
      router.push(`/reporte/${reporte.id}?aviso=${AVISO_ME_AFECTA.codigo}`);
    });
  }

  return (
    <article
      aria-labelledby={idTitulo}
      className="flex flex-col gap-2 rounded-(--radio-control) border border-(--borde) bg-(--superficie) p-3"
    >
      <h4 id={idTitulo} className="font-semibold break-words">
        {reporte.titulo}
      </h4>
      <p className={`text-sm ${TEXTO_SUAVE}`}>
        {textoDistancia(reporte.distancia_m)} · {NOMBRE_ESTADO[reporte.estado]}{" "}
        · {textoVotos(reporte.me_afecta)} «Me afecta» · Reportado el{" "}
        {formatearFecha(reporte.creado_en)}
      </p>
      {reporte.direccion_referencia && (
        <p className="text-sm break-words">{reporte.direccion_referencia}</p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {reporte.propio ? (
          <p className="text-sm font-semibold">Ya lo reportaste tú.</p>
        ) : (
          <button
            type="button"
            onClick={meAfecta}
            aria-disabled={enviando}
            aria-describedby={idTitulo}
            className={`${BOTON_CHICO} aria-disabled:cursor-progress`}
          >
            {enviando ? "Guardando…" : "Es este: me afecta"}
          </button>
        )}
        {/* En otra pestaña, para no perder lo escrito en el formulario. */}
        <Link
          href={`/reporte/${reporte.id}`}
          target="_blank"
          rel="noopener"
          className={`${ENLACE} text-sm`}
        >
          Ver reporte<span className="sr-only"> (se abre en otra pestaña)</span>
        </Link>
      </div>

      {error && (
        <p role="alert" className={`text-sm ${TEXTO_ERROR}`}>
          {error}
        </p>
      )}
    </article>
  );
}
