import { textoDeAviso } from "@/lib/moderacion/mensajes";

// Aviso de éxito tras una acción de moderación (?aviso=<código>). Solo
// muestra textos conocidos, nunca el valor de la URL.
export function AvisoModeracion({ codigo }: { codigo: unknown }) {
  const texto = textoDeAviso(codigo);
  if (!texto) return null;
  return (
    <p
      role="status"
      className="rounded-md bg-green-50 p-4 font-medium text-green-900 dark:bg-green-950 dark:text-green-100"
    >
      {texto}
    </p>
  );
}
