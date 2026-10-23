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
    <p id={`error-${campo}`} className="text-red-700 dark:text-red-400">
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
    className:
      "rounded-md border border-zinc-400 bg-transparent px-3 py-2 dark:border-zinc-600",
  };

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={campo} className="font-medium">
        {etiqueta}
      </label>
      <p
        id={`ayuda-${campo}`}
        className="text-sm text-zinc-700 dark:text-zinc-300"
      >
        {ayuda}
      </p>
      {multilinea ? (
        <textarea rows={5} {...propiedades} />
      ) : (
        <input type="text" {...propiedades} />
      )}
      <p
        id={`contador-${campo}`}
        className={`text-sm ${usados > maximo ? "font-medium text-red-700 dark:text-red-400" : "text-zinc-700 dark:text-zinc-300"}`}
      >
        {usados} de {maximo} caracteres
        {usados > maximo && ` (te pasaste por ${usados - maximo})`}
      </p>
      <ErrorCampo campo={campo} errores={errores} />
    </div>
  );
}
