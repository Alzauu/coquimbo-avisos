"use client";

import Link from "next/link";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import { FOCO } from "@/components/ui/estilos";

export type EnlaceMenu = { href: string; texto: string };

// Menú de la portada: un botón que muestra u oculta la navegación (patrón
// de divulgación, no role="menu"). Se cierra con Escape, que devuelve el
// foco al botón, o al tocar fuera.
export function MenuPrincipal({ enlaces }: { enlaces: EnlaceMenu[] }) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const alTocarFuera = (evento: PointerEvent) => {
      if (
        evento.target instanceof Node &&
        !contenedor.current?.contains(evento.target)
      ) {
        setAbierto(false);
      }
    };
    document.addEventListener("pointerdown", alTocarFuera);
    return () => document.removeEventListener("pointerdown", alTocarFuera);
  }, [abierto]);

  function alPresionarTecla(evento: KeyboardEvent) {
    if (evento.key === "Escape" && abierto) {
      evento.stopPropagation();
      setAbierto(false);
      boton.current?.focus();
    }
  }

  return (
    <div ref={contenedor} onKeyDown={alPresionarTecla} className="relative">
      <button
        ref={boton}
        type="button"
        aria-expanded={abierto}
        aria-controls="menu-principal"
        onClick={() => setAbierto((actual) => !actual)}
        className={`inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold hover:bg-(--superficie-2) ${FOCO}`}
      >
        Menú
      </button>
      <nav
        id="menu-principal"
        aria-label="Principal"
        hidden={!abierto}
        className="absolute top-full right-0 mt-3 w-56 rounded-(--radio) border border-(--borde) bg-(--superficie) p-2 shadow-(--sombra)"
      >
        <ul className="flex flex-col">
          {enlaces.map((enlace) => (
            <li key={enlace.href}>
              <Link
                href={enlace.href}
                className={`flex min-h-11 items-center rounded-(--radio-control) px-3 font-semibold hover:bg-(--superficie-2) ${FOCO}`}
              >
                {enlace.texto}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
