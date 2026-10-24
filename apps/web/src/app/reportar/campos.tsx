import { CAMPO, TEXTO_ERROR, TEXTO_SUAVE } from "@/components/ui/estilos";
import {
  type CampoReporte,
  type ErroresReporte,
  largo,
} from "@/lib/reportes/esquemas";

// Campos de texto de un reporte, con ayuda, contador y error accesibles.
// Los usan el formulario de reportar y el de edición de administración.

export function ErrorCampo({
  campo,
  errores,
}: {
  campo: CampoReporte;
  errores: ErroresReporte;
}) {
  if (!errores[campo]) return null;
  return (
    <p id={`error-${campo}`} className={TEXTO_ERROR}>
      {errores[campo]}
    </p>
  );
}

type PropsCampoTexto = {
  campo: "titulo" | "descripcion" | "direccion_referencia";
  etiqueta: string;
  ayuda: string;
  valor: string;
  maximo: number;
  errores: ErroresReporte;
  describir: (campo: CampoReporte, ...ayudas: string[]) => string | undefined;
  onCambio: (valor: string) => void;
  multilinea?: boolean;
};

export function CampoTexto({
  campo,
  etiqueta,
  ayuda,
  valor,
  maximo,
  errores,
  describir,
  onCambio,
  multilinea = false,
}: PropsCampoTexto) {
  const usados = largo(valor);
  const propiedades = {
    id: campo,
    name: campo,
    value: valor,
    onChange: (
      evento: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => onCambio(evento.target.value),
    "aria-invalid": Boolean(errores[campo]),
    // El contador se lee junto con la ayuda al enfocar el campo, sin
    // anunciar cada tecla.
    "aria-describedby": describir(campo, `ayuda-${campo}`, `contador-${campo}`),
    className: CAMPO,
  };

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={campo} className="font-semibold">
        {etiqueta}
      </label>
      <p id={`ayuda-${campo}`} className={`text-sm ${TEXTO_SUAVE}`}>
        {ayuda}
      </p>
      {multilinea ? (
        <textarea rows={5} {...propiedades} />
      ) : (
        <input type="text" {...propiedades} />
      )}
      {/* El error va pegado al campo, antes del contador. */}
      <ErrorCampo campo={campo} errores={errores} />
      <p
        id={`contador-${campo}`}
        className={`text-sm tabular-nums ${usados > maximo ? TEXTO_ERROR : TEXTO_SUAVE}`}
      >
        {usados} de {maximo} caracteres
        {usados > maximo && ` (te pasaste por ${usados - maximo})`}
      </p>
    </div>
  );
}
