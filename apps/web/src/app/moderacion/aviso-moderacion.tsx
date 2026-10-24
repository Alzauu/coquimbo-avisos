import { AVISO_EXITO } from "@/components/ui/estilos";
import { textoDeAviso } from "@/lib/moderacion/mensajes";

// Aviso de éxito tras una acción de moderación (?aviso=<código>). Solo
// muestra textos conocidos, nunca el valor de la URL.
export function AvisoModeracion({ codigo }: { codigo: unknown }) {
  const texto = textoDeAviso(codigo);
  if (!texto) return null;
  return (
    <p role="status" className={`${AVISO_EXITO} font-semibold`}>
      {texto}
    </p>
  );
}
