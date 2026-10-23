"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { FormAprobar, FormOcultarFoto, FormRechazar } from "./formularios";

// MapLibre necesita el navegador (WebGL): no se prerenderiza.
const MapaPunto = dynamic(() => import("@/components/mapa/mapa-punto"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 bg-zinc-100 dark:bg-zinc-900" />
  ),
});

export type Pendiente = {
  id: string;
  titulo: string;
  categoria: string;
  descripcion: string | null;
  direccion: string | null;
  enviado: string;
  latitud: number;
  longitud: number;
  fotos: { id: number; orden: number; oculta: boolean; url: string | null }[];
};

const FORMATO_COORDENADA = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
});

export function ListaPendientes({ pendientes }: { pendientes: Pendiente[] }) {
  // Un solo mapa a la vez: cada mapa usa un contexto WebGL y el navegador
  // admite pocos.
  const [mapaAbierto, setMapaAbierto] = useState<string | null>(null);

  return (
    <ul className="flex flex-col gap-6">
      {pendientes.map((reporte) => (
        <li key={reporte.id}>
          <TarjetaPendiente
            reporte={reporte}
            mapaVisible={mapaAbierto === reporte.id}
            onAlternarMapa={() =>
              setMapaAbierto((actual) =>
                actual === reporte.id ? null : reporte.id,
              )
            }
          />
        </li>
      ))}
    </ul>
  );
}

function TarjetaPendiente({
  reporte,
  mapaVisible,
  onAlternarMapa,
}: {
  reporte: Pendiente;
  mapaVisible: boolean;
  onAlternarMapa: () => void;
}) {
  const idTitulo = `titulo-${reporte.id}`;
  const idMapa = `mapa-${reporte.id}`;

  return (
    <article
      aria-labelledby={idTitulo}
      className="flex flex-col gap-4 rounded-md border border-zinc-300 p-4 dark:border-zinc-700"
    >
      <div className="flex flex-col gap-1">
        <h2 id={idTitulo} className="text-lg font-bold break-words">
          {reporte.titulo}
        </h2>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          {reporte.categoria} · Enviado el {reporte.enviado}
        </p>
      </div>

      {reporte.descripcion ? (
        <p className="break-words whitespace-pre-line">{reporte.descripcion}</p>
      ) : (
        <p className="text-zinc-600 italic dark:text-zinc-400">
          Sin descripción.
        </p>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="font-medium">Referencia</dt>
        <dd className="break-words">
          {reporte.direccion ?? "Sin dirección de referencia"}
        </dd>
        <dt className="font-medium">Coordenadas</dt>
        <dd>
          Latitud {FORMATO_COORDENADA.format(reporte.latitud)}, longitud{" "}
          {FORMATO_COORDENADA.format(reporte.longitud)}
        </dd>
      </dl>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          aria-expanded={mapaVisible}
          aria-controls={idMapa}
          onClick={onAlternarMapa}
          className="min-h-11 self-start rounded-md border border-zinc-400 px-4 py-2 text-sm font-medium dark:border-zinc-600"
        >
          {mapaVisible ? "Ocultar ubicación" : "Ver ubicación"}
        </button>
        <div
          id={idMapa}
          hidden={!mapaVisible}
          className="relative h-56 overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700"
        >
          {mapaVisible && (
            <MapaPunto
              latitud={reporte.latitud}
              longitud={reporte.longitud}
              titulo={`Ubicación de «${reporte.titulo}»`}
            />
          )}
        </div>
      </div>

      <section aria-label={`Fotos de «${reporte.titulo}»`}>
        {reporte.fotos.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Sin fotos.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {reporte.fotos.map((foto) => {
              const descripcion = `foto ${foto.orden} de «${reporte.titulo}»`;
              return (
                <li key={foto.id} className="flex flex-col gap-2">
                  {foto.oculta ? (
                    <p className="flex aspect-square items-center justify-center rounded-md border border-dashed border-zinc-400 p-2 text-center text-sm dark:border-zinc-600">
                      Foto {foto.orden} oculta
                    </p>
                  ) : foto.url ? (
                    <a
                      href={foto.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      {/* URL firmada de corta duración: no conviene que
                          next/image la optimice ni la guarde en caché. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={foto.url}
                        alt={`Abrir ${descripcion} en tamaño completo (pestaña nueva)`}
                        loading="lazy"
                        className="aspect-square w-full rounded-md border border-zinc-300 object-cover dark:border-zinc-700"
                      />
                    </a>
                  ) : (
                    <p className="flex aspect-square items-center justify-center rounded-md border border-zinc-300 p-2 text-center text-sm dark:border-zinc-700">
                      Foto {foto.orden}: no disponible
                    </p>
                  )}
                  {!foto.oculta && (
                    <FormOcultarFoto
                      reporteId={reporte.id}
                      fotoId={foto.id}
                      origen="panel"
                      descripcion={descripcion}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {reporte.fotos.some((foto) => !foto.oculta) && (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Ocultar una foto no se puede deshacer desde la app.
          </p>
        )}
      </section>

      <div className="flex flex-col gap-3 border-t border-zinc-300 pt-4 sm:flex-row sm:items-start dark:border-zinc-700">
        <FormAprobar reporteId={reporte.id} titulo={reporte.titulo} />
        <FormRechazar reporteId={reporte.id} titulo={reporte.titulo} />
      </div>
    </article>
  );
}
