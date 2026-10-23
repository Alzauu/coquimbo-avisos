"use client";

import { Marker } from "maplibre-gl";
import { useEffect } from "react";

import { MarcoMapa, useMapa } from "@/components/mapa/mapa-base";

type Props = {
  latitud: number;
  longitud: number;
  // Nombre accesible del mapa.
  titulo: string;
};

// Mapa pequeño con un solo punto marcado. Debe ir en un contenedor con
// position: relative y alto. Quien lo use debe mostrar también la
// ubicación en texto: el mapa no es accesible para todas las personas.
export default function MapaPunto({ latitud, longitud, titulo }: Props) {
  const { contenedor, mapa, falloCarga } = useMapa({
    titulo,
    centro: [longitud, latitud],
    zoom: 16,
  });

  useEffect(() => {
    if (!mapa) return;
    const marcador = new Marker({ color: "#b91c1c" })
      .setLngLat([longitud, latitud])
      .addTo(mapa);
    // El marcador es decorativo: la ubicación se da también en texto.
    marcador.getElement().setAttribute("aria-hidden", "true");
    return () => {
      marcador.remove();
    };
  }, [mapa, latitud, longitud]);

  return (
    <MarcoMapa
      contenedor={contenedor}
      falloCarga={falloCarga}
      alternativa="Usa la dirección y las coordenadas de arriba."
    />
  );
}
