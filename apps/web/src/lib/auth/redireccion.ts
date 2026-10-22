export const RUTA_TRAS_INGRESO = "/perfil";

const ORIGEN_FICTICIO = "http://origen.invalid";

// Solo acepta rutas internas (por ejemplo "/perfil?x=1"), para que el
// parámetro "siguiente" no pueda usarse para redirigir a otro sitio.
export function rutaSegura(
  valor: unknown,
  porDefecto: string = RUTA_TRAS_INGRESO,
): string {
  if (typeof valor !== "string" || valor.length > 500) return porDefecto;
  if (!valor.startsWith("/") || valor.startsWith("//")) return porDefecto;
  if (valor.includes("\\") || /\p{Cc}/u.test(valor)) return porDefecto;

  try {
    const url = new URL(valor, ORIGEN_FICTICIO);
    if (url.origin !== ORIGEN_FICTICIO) return porDefecto;
    return url.pathname + url.search + url.hash;
  } catch {
    return porDefecto;
  }
}
