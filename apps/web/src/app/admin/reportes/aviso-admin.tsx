import { textoDeAvisoAdmin } from "@/lib/admin/mensajes";

// Aviso de éxito tras una acción de administración (?aviso=<código>).
// Solo muestra textos conocidos, nunca el valor de la URL.
export function AvisoAdmin({ codigo }: { codigo: unknown }) {
  const texto = textoDeAvisoAdmin(codigo);
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
