import Link from "next/link";

import { Logo } from "@/components/marca/logo";
import { FOCO, TEXTO_SUAVE } from "@/components/ui/estilos";
import { esAdmin, esModerador } from "@/lib/auth/rol";
import { MARCA } from "@/lib/marca";
import { createClient } from "@/lib/supabase/server";

import { ExploradorReportes } from "./_explorador/explorador-reportes";
import { type EnlaceMenu, MenuPrincipal } from "./menu-principal";

export default async function Home() {
  const supabase = await createClient();
  const [{ data: sesion }, { data: categorias, error }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase
      .from("categorias")
      // También las inactivas: un reporte antiguo puede tener una y debe
      // seguir mostrando su nombre. Los filtros solo ofrecen las activas.
      .select("id, codigo, nombre, activa")
      .eq("tipo", "reporte")
      .order("id"),
  ]);
  // Sin categorías el mapa sigue funcionando, con la ficha de Otros y sin
  // filtro por categoría.
  if (error) console.error("categorias", error.code);
  // Los enlaces del menú son solo una comodidad: /moderacion y /admin
  // verifican el rol por su cuenta. El nombre visible solo sirve para
  // saludar; sin nombre, no hay saludo.
  const [modera, administra, nombre] = sesion?.claims
    ? await Promise.all([
        esModerador(supabase),
        esAdmin(supabase),
        supabase
          .from("perfiles")
          .select("nombre_visible")
          .eq("id", sesion.claims.sub)
          .maybeSingle()
          .then(({ data }) => data?.nombre_visible ?? null),
      ])
    : [false, false, null];

  const enlaces: EnlaceMenu[] = [
    { href: "/mis-reportes", texto: "Mis reportes" },
    ...(modera ? [{ href: "/moderacion", texto: "Moderación" }] : []),
    ...(administra
      ? [{ href: "/admin/reportes", texto: "Administración" }]
      : []),
    { href: "/perfil", texto: "Mi perfil" },
  ];

  return (
    // El mapa ocupa toda la pantalla; el encabezado flota arriba a la
    // izquierda (arriba a la derecha van los botones de zoom). z-30: por
    // encima de la lista (z-10) y de la tarjeta (z-20). El vidrio
    // (backdrop-blur) y el z-index lo vuelven un contexto de apilamiento,
    // así que su menú desplegable no puede quedar más arriba que él.
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <header className="absolute top-3 left-3 z-30 flex items-center gap-2 rounded-full bg-(--vidrio) py-1.5 pr-1.5 pl-3 shadow-(--sombra) backdrop-blur">
        <Logo tamano={28} />
        <div className="pr-1 leading-tight">
          <h1 className="font-bold">{MARCA.nombre}</h1>
          <p className={`hidden text-xs sm:block ${TEXTO_SUAVE}`}>
            {MARCA.lema}
          </p>
        </div>
        {sesion?.claims ? (
          <MenuPrincipal enlaces={enlaces} nombre={nombre} />
        ) : (
          <Link
            href="/ingresar"
            className={`inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold hover:bg-(--superficie-2) ${FOCO}`}
          >
            Ingresar
          </Link>
        )}
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        <ExploradorReportes categorias={categorias ?? []} />
      </main>
    </div>
  );
}
