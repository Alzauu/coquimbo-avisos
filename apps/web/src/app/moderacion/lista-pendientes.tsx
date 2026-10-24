"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { BOTON_CHICO, TARJETA, TEXTO_SUAVE } from "@/components/ui/estilos";

import { FormAprobar, FormOcultarFoto, FormRechazar } from "./formularios";

// MapLibre necesita el navegador (WebGL): no se prerenderiza.
const MapaPunto = dynamic(() => import("@/components/mapa/mapa-punto"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-(--superficie-2)" />,
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
      className={`flex flex-col gap-4 p-4 ${TARJETA}`}
    >
      <div className="flex flex-col gap-1">
        <h2 id={idTitulo} className="text-lg font-bold break-words">
          {reporte.titulo}
        </h2>
        <p className={`text-sm ${TEXTO_SUAVE}`}>
          {reporte.categoria} · Enviado el {reporte.enviado}
        </p>
      </div>

      {reporte.descripcion ? (
        <p className="break-words whitespace-pre-line">{reporte.descripcion}</p>
      ) : (
        <p className={`italic ${TEXTO_SUAVE}`}>Sin descripción.</p>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="font-semibold">Referencia</dt>
        <dd className="break-words">
          {reporte.direccion ?? "Sin dirección de referencia"}
        </dd>
        <dt className="font-semibold">Coordenadas</dt>
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
          className={`${BOTON_CHICO} self-start`}
        >
          {mapaVisible ? "Ocultar ubicación" : "Ver ubicación"}
        </button>
        <div
          id={idMapa}
          hidden={!mapaVisible}
          className="relative h-56 overflow-hidden rounded-(--radio-control) border-2 border-(--borde-control)"
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
          <p className={`text-sm ${TEXTO_SUAVE}`}>Sin fotos.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {reporte.fotos.map((foto) => {
              const descripcion = `foto ${foto.orden} de «${reporte.titulo}»`;
              return (
                <li key={foto.id} className="flex flex-col gap-2">
                  {foto.oculta ? (
                    <p className="flex aspect-square items-center justify-center rounded-(--radio-control) border-2 border-dashed border-(--borde-control) p-2 text-center text-sm">
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
                        className="aspect-square w-full rounded-(--radio-control) border border-(--borde) object-cover"
                      />
                    </a>
                  ) : (
                    <p className="flex aspect-square items-center justify-center rounded-(--radio-control) border border-(--borde) p-2 text-center text-sm">
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
          <p className={`mt-2 text-sm ${TEXTO_SUAVE}`}>
            Ocultar una foto no se puede deshacer desde la app.
          </p>
        )}
      </section>

      <div className="flex flex-col gap-3 border-t border-(--borde) pt-4 sm:flex-row sm:items-start">
        <FormAprobar reporteId={reporte.id} titulo={reporte.titulo} />
        <FormRechazar reporteId={reporte.id} titulo={reporte.titulo} />
      </div>
    </article>
  );
}
