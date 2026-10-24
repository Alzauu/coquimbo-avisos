"use client";

import {
  type FormEvent,
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  AVISO_ERROR,
  BOTON_PRINCIPAL,
  BOTON_SECUNDARIO,
  CAMPO,
  ENLACE,
  TEXTO_ERROR,
  TEXTO_SUAVE,
  TITULO_PAGINA,
} from "@/components/ui/estilos";

import { enviarEnlace, type EstadoIngreso } from "./acciones";

const ESTADO_INICIAL: EstadoIngreso = { estado: "inicial" };

// Supabase permite un enlace por correo cada 60 segundos.
const ESPERA_REENVIO = 60;

const formatoEspera = (segundos: number) =>
  `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;

export function FormularioIngreso({
  siguiente,
  enlaceVencido,
}: {
  siguiente: string;
  enlaceVencido: boolean;
}) {
  const [estado, accion, enviando] = useActionState(
    enviarEnlace,
    ESTADO_INICIAL,
  );
  // Controlado: lo escrito se conserva tras un error y al volver con
  // «Cambiarlo».
  const [correo, setCorreo] = useState("");
  // Envío que la persona descartó con «Cambiarlo»: vuelve al formulario.
  const [descartado, setDescartado] = useState<EstadoIngreso | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (descartado) campo.current?.focus();
  }, [descartado]);

  function enviar(evento: FormEvent<HTMLFormElement>) {
    // Sin action en el <form>: React no lo vacía al terminar.
    evento.preventDefault();
    if (enviando) return;
    const datos = new FormData(evento.currentTarget);
    startTransition(() => accion(datos));
  }

  if (estado.estado === "enviado" && estado !== descartado) {
    return (
      <RevisaTuCorreo
        correo={estado.correo}
        siguiente={siguiente}
        onCambiarCorreo={() => setDescartado(estado)}
      />
    );
  }

  const error = estado.estado === "error" ? estado : null;
  const errorCorreo = error?.tipo === "correo" ? error.mensaje : null;
  const errorGeneral = error && error.tipo !== "correo" ? error.mensaje : null;

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 className={TITULO_PAGINA}>Ingresa con tu correo</h1>
        <p>Sin contraseñas: te mandamos un enlace para entrar.</p>
      </div>

      {enlaceVencido && estado.estado === "inicial" && (
        <div role="alert" className={AVISO_ERROR}>
          <p className={TEXTO_ERROR}>Ese enlace ya no sirve</p>
          <p className="text-sm">
            Los enlaces duran una hora, se usan una sola vez y deben abrirse en
            el navegador donde los pediste. Pide uno nuevo.
          </p>
        </div>
      )}

      <input type="hidden" name="siguiente" value={siguiente} />

      <div className="flex flex-col gap-1">
        <label htmlFor="correo" className="font-semibold">
          Tu correo
        </label>
        <input
          ref={campo}
          id="correo"
          name="correo"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={correo}
          onChange={(evento) => setCorreo(evento.target.value)}
          aria-invalid={Boolean(errorCorreo)}
          aria-describedby={errorCorreo ? "error-correo" : "ayuda-correo"}
          className={CAMPO}
        />
        {errorCorreo ? (
          <p
            id="error-correo"
            role="alert"
            className={`text-sm ${TEXTO_ERROR}`}
          >
            {errorCorreo}
          </p>
        ) : (
          <p id="ayuda-correo" className={`text-sm ${TEXTO_SUAVE}`}>
            Solo lo usamos para que entres. No se muestra a nadie.
          </p>
        )}
      </div>

      {errorGeneral && (
        <p role="alert" className={AVISO_ERROR}>
          {errorGeneral}
        </p>
      )}

      <button type="submit" disabled={enviando} className={BOTON_PRINCIPAL}>
        {enviando ? "Enviando…" : "Enviarme el enlace"}
      </button>
    </form>
  );
}

function IconoCorreo() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="56"
      height="56"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
    </svg>
  );
}

// Pantalla tras enviar el enlace. El botón de reenviar espera
// ESPERA_REENVIO segundos (y vuelve a esperar tras cada reenvío).
function RevisaTuCorreo({
  correo,
  siguiente,
  onCambiarCorreo,
}: {
  correo: string;
  siguiente: string;
  onCambiarCorreo: () => void;
}) {
  const [reenvio, reenviar, reenviando] = useActionState(
    enviarEnlace,
    ESTADO_INICIAL,
  );
  const [restante, setRestante] = useState(ESPERA_REENVIO);
  const titulo = useRef<HTMLHeadingElement>(null);

  // Cada respuesta nueva del reenvío reinicia la espera, salvo un error
  // genérico (se puede reintentar de inmediato). Se ajusta durante el
  // render, sin efecto: https://react.dev/learn/you-might-not-need-an-effect
  const [ultimaRespuesta, setUltimaRespuesta] = useState(reenvio);
  if (reenvio !== ultimaRespuesta) {
    setUltimaRespuesta(reenvio);
    if (
      reenvio.estado === "enviado" ||
      (reenvio.estado === "error" && reenvio.tipo === "frecuencia")
    ) {
      setRestante(ESPERA_REENVIO);
    }
  }

  useEffect(() => {
    titulo.current?.focus();
  }, []);

  useEffect(() => {
    if (restante <= 0) return;
    const espera = setTimeout(() => setRestante((s) => s - 1), 1000);
    return () => clearTimeout(espera);
  }, [restante]);

  const puedeReenviar = restante <= 0 && !reenviando;

  return (
    <div className="flex flex-col gap-4">
      <IconoCorreo />
      <h1 ref={titulo} tabIndex={-1} className={TITULO_PAGINA}>
        Revisa tu correo
      </h1>
      <p>
        Te enviamos un enlace a <strong className="break-all">{correo}</strong>.
        Ábrelo para entrar.
      </p>

      <div className="rounded-(--radio-control) bg-(--acento) p-3 text-(--tinta-sobre-acento)">
        <p className="font-bold">Ábrelo en este mismo navegador.</p>
        <p className="text-sm">
          Si lo abres en otro (por ejemplo, desde la app de correo del
          teléfono), no podrás entrar y tendrás que pedir uno nuevo.
        </p>
      </div>

      <p className={`text-sm ${TEXTO_SUAVE}`}>
        ¿No llega? Puede tardar un par de minutos. Revisa también las carpetas
        de spam o promociones.
      </p>

      <form action={reenviar} className="flex flex-col gap-2">
        <input type="hidden" name="correo" value={correo} />
        <input type="hidden" name="siguiente" value={siguiente} />
        <button
          type="submit"
          disabled={!puedeReenviar}
          className={BOTON_SECUNDARIO}
        >
          {reenviando ? "Enviando…" : "Reenviar enlace"}
        </button>
        {/* La espera va fuera del botón (deshabilitado, más tenue) y fuera
            de la región viva: no se anuncia cada segundo. */}
        {restante > 0 && !reenviando && (
          <p className={`text-sm tabular-nums ${TEXTO_SUAVE}`}>
            Podrás pedir otro en {formatoEspera(restante)}.
          </p>
        )}
        {/* Se anuncia el resultado y el final de la espera, no cada
            segundo. */}
        <p aria-live="polite" className="text-sm">
          {reenvio.estado === "enviado" && restante > 0
            ? "Te enviamos un enlace nuevo."
            : ""}
          <span className="sr-only">
            {restante <= 0 ? "Ya puedes pedir otro enlace." : ""}
          </span>
        </p>
        {reenvio.estado === "error" && (
          <p role="alert" className={`text-sm ${TEXTO_ERROR}`}>
            {reenvio.mensaje}
          </p>
        )}
      </form>

      <button
        type="button"
        onClick={onCambiarCorreo}
        className={`${ENLACE} min-h-11 self-start`}
      >
        ¿Correo equivocado? Cambiarlo
      </button>
    </div>
  );
}
