import { ImageResponse } from "next/og";
import { z } from "zod";

import { MARCA } from "@/lib/marca";
import {
  type DatosImagen,
  datosParaCompartir,
  type ReporteCompartible,
} from "@/lib/reportes/compartir";
import { GROSOR_ICONO } from "@/lib/reportes/categorias";
import {
  ESTADOS_PUBLICOS,
  type EstadoPublico,
} from "@/lib/reportes/presentacion";
import { createAnonClient } from "@/lib/supabase/anonimo";

// Imagen de vista previa al compartir un reporte (WhatsApp, redes). Se lee
// sin sesión (rol anon): solo existe para reportes públicos. Si el reporte
// no existe, está oculto o falla la consulta, se entrega la imagen de la
// marca, sin nada del reporte. Nunca lleva fotos ni datos del autor: las
// apps guardan la vista previa aunque el reporte se oculte después.

export const alt = `Reporte vecinal en ${MARCA.nombre}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Se genera en cada petición: un reporte ocultado deja de mostrarse de
// inmediato. Las apps y el navegador la guardan hasta 5 minutos.
export const dynamic = "force-dynamic";
const CACHE = "public, max-age=300";

// Colores del tema claro (globals.css): la imagen no lee variables CSS.
const COLOR = {
  fondo: "#f3f5f7",
  superficie: "#ffffff",
  tinta: "#16191d",
  tintaSuave: "#4b5563",
  borde: "#7b8794",
  acento: "#d7f59a",
  exitoFondo: "#e4f5e9",
  exitoTinta: "#14532d",
};

const esEstadoPublico = (estado: string): estado is EstadoPublico =>
  (ESTADOS_PUBLICOS as readonly string[]).includes(estado);

async function cargar(id: string): Promise<ReporteCompartible | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("v_reportes_publicos")
    .select("titulo, categoria_id, estado, direccion_referencia, me_afecta")
    .eq("id", id)
    .maybeSingle();
  if (error) console.error("opengraph-image", error.code);
  if (
    !data?.titulo ||
    data.categoria_id === null ||
    !data.estado ||
    !esEstadoPublico(data.estado)
  ) {
    return null;
  }

  const { data: categoria } = await supabase
    .from("categorias")
    .select("nombre, codigo")
    .eq("id", data.categoria_id)
    .maybeSingle();

  return {
    titulo: data.titulo,
    categoriaNombre: categoria?.nombre ?? null,
    categoriaCodigo: categoria?.codigo ?? null,
    estado: data.estado,
    direccion_referencia: data.direccion_referencia,
    me_afecta: data.me_afecta ?? 0,
  };
}

export default async function Imagen({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const datos = datosParaCompartir(await cargar((await params).id));
  return new ImageResponse(
    datos.tipo === "reporte" ? <ImagenReporte datos={datos} /> : <Generica />,
    { ...size, headers: { "Cache-Control": CACHE } },
  );
}

type DatosReporte = Extract<DatosImagen, { tipo: "reporte" }>;

function ImagenReporte({ datos }: { datos: DatosReporte }) {
  const largo = Array.from(datos.titulo).length > 60;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: COLOR.fondo,
        color: COLOR.tinta,
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "56px 64px 40px",
          gap: 28,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <Ficha datos={datos} />
            <div style={{ fontSize: 34, color: COLOR.tintaSuave }}>
              {datos.categoriaNombre}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 30,
              padding: "10px 26px",
              borderRadius: 999,
              backgroundColor: datos.resuelto
                ? COLOR.exitoFondo
                : COLOR.superficie,
              color: datos.resuelto ? COLOR.exitoTinta : COLOR.tinta,
              border: datos.resuelto ? "none" : `2px solid ${COLOR.borde}`,
            }}
          >
            {/* Resuelto lleva su marca, no solo el color (como en la app).
                Dibujada: la fuente por defecto no trae el carácter ✓. */}
            {datos.resuelto && <Check />}
            {datos.estado}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: largo ? 54 : 66,
            lineHeight: 1.15,
            letterSpacing: -1,
          }}
        >
          {datos.titulo}
        </div>

        {datos.referencia && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 32,
              color: COLOR.tintaSuave,
            }}
          >
            <Pin />
            {datos.referencia}
          </div>
        )}

        {datos.meAfecta && (
          <div style={{ display: "flex", fontSize: 32, marginTop: "auto" }}>
            {datos.meAfecta}
          </div>
        )}
      </div>

      <Pie />
    </div>
  );
}

function Generica() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: COLOR.fondo,
        color: COLOR.tinta,
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 64px",
          gap: 24,
        }}
      >
        <div style={{ display: "flex", fontSize: 76, letterSpacing: -1 }}>
          {MARCA.nombre}
        </div>
        <div style={{ display: "flex", fontSize: 38, color: COLOR.tintaSuave }}>
          {MARCA.lema}
        </div>
      </div>
      <Pie />
    </div>
  );
}

// Franja inferior con la marca: el acento solo como relleno de bloque, con
// tinta encima (como en la app).
function Pie() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "26px 64px",
        backgroundColor: COLOR.acento,
        color: COLOR.tinta,
        fontSize: 32,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Logo />
        {MARCA.nombre}
      </div>
      <div style={{ display: "flex" }}>La Serena</div>
    </div>
  );
}

// Misma ficha que FichaCategoria (círculo de color con el ícono en blanco),
// dibujada aquí porque la imagen no usa los componentes de la app.
function Ficha({ datos }: { datos: DatosReporte }) {
  const { color, trazos } = datos.categoria;
  return (
    <svg width="72" height="72" viewBox="0 0 28 28">
      <circle
        cx="14"
        cy="14"
        r={trazos ? 13 : 8}
        fill={color}
        stroke="#ffffff"
        strokeWidth="2"
      />
      {trazos && (
        <g
          transform="translate(6 6) scale(0.6667)"
          fill="none"
          stroke="#ffffff"
          strokeWidth={GROSOR_ICONO}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {trazos.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      )}
    </svg>
  );
}

function Check() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 16 16"
      fill="none"
      stroke={COLOR.exitoTinta}
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
    </svg>
  );
}

function Pin() {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 16 16"
      fill="none"
      stroke={COLOR.tintaSuave}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 14.5s5-4.2 5-8.2a5 5 0 1 0-10 0c0 4 5 8.2 5 8.2Z" />
      <path d="M6.5 6.3a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0" />
    </svg>
  );
}

// Logo de components/marca/logo.tsx con el interior del color del acento.
function Logo() {
  return (
    <svg width="44" height="44" viewBox="0 0 32 32">
      <path
        d="M16 30.5S5 20.6 5 12.5a11 11 0 0 1 22 0c0 8.1-11 18-11 18z"
        fill={COLOR.tinta}
      />
      <path d="M11 14.2a5 5 0 0 1 10 0z" fill={COLOR.acento} />
      <path
        d="M9.5 16.6c1.6-1.1 3-1.1 4.5 0s3 1.1 4.5 0 3-1.1 4.5 0"
        fill="none"
        stroke={COLOR.acento}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
