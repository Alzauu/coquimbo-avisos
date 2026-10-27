"use client";

import Link from "next/link";
import {
  type ReactNode,
  startTransition,
  useId,
  useOptimistic,
  useState,
  useTransition,
} from "react";

import { votarReporte } from "@/app/reporte/acciones";
import {
  ENLACE,
  FOCO,
  TEXTO_ERROR,
  TEXTO_SUAVE,
} from "@/components/ui/estilos";
import {
  type Participacion,
  siguienteVoto,
  type TotalesVotos,
  textoVotos,
  totalesTrasVoto,
  type Voto,
} from "@/lib/reportes/votos";

// Votos «Me afecta» / «No me afecta» de un reporte público. Quien no tiene
// sesión y el autor solo ven los totales. Al votar, el cambio se ve al
// instante; cuando la base responde, sus totales reemplazan a los
// calculados aquí, y si falla, vuelve lo que había.
// variante "tarjeta": dentro de la tarjeta del mapa, cuyo título ya es un
// h2, y tan angosta que las opciones siempre se reparten el ancho.

type Variante = "pagina" | "tarjeta";

type Props = {
  reporteId: string;
  totales: TotalesVotos;
  participacion: Participacion;
  variante?: Variante;
  // Totales confirmados por la base tras cada voto.
  onVotado?: (totales: TotalesVotos) => void;
};

type Estado = { voto: Voto | null; totales: TotalesVotos };

const OPCIONES = [
  { valor: 1, texto: "Me afecta", campo: "me_afecta" },
  { valor: -1, texto: "No me afecta", campo: "no_me_afecta" },
] as const satisfies readonly {
  valor: Voto;
  texto: string;
  campo: keyof TotalesVotos;
}[];

const CONFIRMACION = {
  "1": "Guardamos tu voto: te afecta.",
  "-1": "Guardamos tu voto: no te afecta.",
  null: "Quitamos tu voto.",
} as const;

// Las dos opciones usan el mismo estilo: ninguna es "buena" ni "mala".
// Elegida = borde de tinta + relleno + ✓ (no solo color), sin el acento.
// En el teléfono las dos opciones llenan el ancho; en la página, desde md,
// son compactas y del ancho de su contenido.
const OPCION = `inline-flex min-h-11 flex-1 basis-36 items-center justify-center gap-2 rounded-(--radio-control) border-2 px-3 text-sm font-semibold text-(--tinta) aria-disabled:cursor-progress ${FOCO}`;
const ANCHO_OPCION: Record<Variante, string> = {
  pagina: "md:flex-none md:basis-auto",
  tarjeta: "",
};
const NO_ELEGIDA =
  "border-(--borde-control) bg-(--superficie) hover:bg-(--superficie-2)";
const ELEGIDA = "border-(--tinta) bg-(--superficie-2)";

export function VotosReporte({
  reporteId,
  totales,
  participacion,
  variante = "pagina",
  onVotado,
}: Props) {
  const idPregunta = useId();
  const Titulo = variante === "tarjeta" ? "h3" : "h2";

  if (participacion.tipo !== "votante") {
    const esAutor = participacion.tipo === "autor";
    return (
      <section aria-labelledby={idPregunta} className="flex flex-col gap-2">
        <Titulo id={idPregunta} className="font-semibold">
          {esAutor ? "Votos de vecinos" : "¿Este problema te afecta?"}
        </Titulo>
        <ResumenTotales totales={totales} />
        {esAutor ? (
          <p className={`text-sm ${TEXTO_SUAVE}`}>
            Es tu reporte: lo votan los demás vecinos.
          </p>
        ) : (
          <Link
            href={`/ingresar?siguiente=${encodeURIComponent(`/reporte/${reporteId}`)}`}
            className={`${ENLACE} self-start text-sm`}
          >
            Ingresa para votar
          </Link>
        )}
      </section>
    );
  }

  return (
    <Votacion
      reporteId={reporteId}
      inicial={{ voto: participacion.voto, totales }}
      idPregunta={idPregunta}
      variante={variante}
      onVotado={onVotado}
    >
      <Titulo id={idPregunta} className="font-semibold">
        ¿Este problema te afecta?
      </Titulo>
    </Votacion>
  );
}

function Votacion({
  reporteId,
  inicial,
  idPregunta,
  variante,
  onVotado,
  children: titulo,
}: {
  reporteId: string;
  inicial: Estado;
  idPregunta: string;
  variante: Variante;
  onVotado?: (totales: TotalesVotos) => void;
  children: ReactNode;
}) {
  const [confirmado, setConfirmado] = useState(inicial);
  const [mostrado, mostrarAlInstante] = useOptimistic(
    confirmado,
    (_actual, siguiente: Estado) => siguiente,
  );
  const [enviando, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{ error: boolean; texto: string } | null>(
    null,
  );

  function tocar(pulsado: Voto) {
    // aria-disabled no bloquea el clic: un segundo toque mientras se envía
    // no hace nada.
    if (enviando) return;
    const nuevo = siguienteVoto(confirmado.voto, pulsado);
    setAviso(null);
    iniciar(async () => {
      mostrarAlInstante({
        voto: nuevo,
        totales: totalesTrasVoto(confirmado.totales, confirmado.voto, nuevo),
      });
      const resultado = await votarReporte(reporteId, nuevo);
      startTransition(() => {
        if (resultado.estado === "error") {
          setAviso({ error: true, texto: resultado.mensaje });
          return;
        }
        setConfirmado({ voto: resultado.voto, totales: resultado.totales });
        onVotado?.(resultado.totales);
        setAviso({
          error: false,
          texto:
            CONFIRMACION[String(resultado.voto) as keyof typeof CONFIRMACION],
        });
      });
    });
  }

  return (
    <section className="flex flex-col gap-2">
      {titulo}
      <div
        role="group"
        aria-labelledby={idPregunta}
        className="flex flex-wrap gap-2"
      >
        {OPCIONES.map((opcion) => {
          const elegida = mostrado.voto === opcion.valor;
          const cantidad = mostrado.totales[opcion.campo];
          return (
            <button
              key={opcion.valor}
              type="button"
              aria-pressed={elegida}
              aria-disabled={enviando}
              onClick={() => tocar(opcion.valor)}
              className={`${OPCION} ${ANCHO_OPCION[variante]} ${elegida ? ELEGIDA : NO_ELEGIDA}`}
            >
              {elegida && <IconoElegido />}
              <span>{opcion.texto}</span>
              <span className="font-normal text-(--tinta-suave) tabular-nums">
                <span aria-hidden="true">
                  {cantidad.toLocaleString("es-CL")}
                </span>
                <span className="sr-only">, {textoVotos(cantidad)}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* min-h-5: la línea guarda su alto aunque esté vacía, para que el
          contenido de abajo no salte al aparecer la confirmación. */}
      {aviso?.error ? (
        <p role="alert" className={`min-h-5 text-sm ${TEXTO_ERROR}`}>
          {aviso.texto}
        </p>
      ) : (
        <p role="status" className={`min-h-5 text-sm ${TEXTO_SUAVE}`}>
          {aviso?.texto ??
            (mostrado.voto !== null
              ? "Toca de nuevo tu opción para quitar el voto."
              : "")}
        </p>
      )}
    </section>
  );
}

// Totales sin botones (sin sesión o autor).
function ResumenTotales({ totales }: { totales: TotalesVotos }) {
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
      {OPCIONES.map((opcion) => (
        <div key={opcion.valor} className="flex gap-1.5">
          <dt className="font-semibold">{opcion.texto}:</dt>
          <dd className="tabular-nums">{textoVotos(totales[opcion.campo])}</dd>
        </div>
      ))}
    </dl>
  );
}

// Marca dibujada (no emoji) del voto elegido. Decorativa: el estado lo
// anuncia aria-pressed.
function IconoElegido() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d="M3 8.5 6.5 12 13 4.5" />
    </svg>
  );
}
