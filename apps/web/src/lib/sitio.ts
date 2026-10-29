// URL de un valor de configuración (por ejemplo NEXT_PUBLIC_SITIO_URL =
// https://avisos.example.cl). Si falta o no es http/https, no hay URL.
export function urlDelSitio(valor: string | undefined): URL | undefined {
  if (!valor) return undefined;
  try {
    const url = new URL(valor);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url
      : undefined;
  } catch {
    return undefined;
  }
}

type EntornoSitio = {
  NEXT_PUBLIC_SITIO_URL?: string;
  VERCEL_ENV?: string;
  VERCEL_BRANCH_URL?: string;
  VERCEL_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
};

const deHost = (host: string | undefined) =>
  host ? urlDelSitio(`https://${host}`) : undefined;

// Base de las URLs absolutas de los metadatos (metadataBase), solo en el
// servidor. En un preview de Vercel, la del preview: si apuntara a
// producción, WhatsApp seguiría og:url hasta allá y no se podría probar.
// Si no, NEXT_PUBLIC_SITIO_URL o, en su defecto, el dominio de producción
// de Vercel. En desarrollo no hay ninguna: Next.js usa localhost.
// Las variables se leen de forma literal, como pide Next.js.
export function urlBaseMetadatos(
  entorno: EntornoSitio = {
    NEXT_PUBLIC_SITIO_URL: process.env.NEXT_PUBLIC_SITIO_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_BRANCH_URL: process.env.VERCEL_BRANCH_URL,
    VERCEL_URL: process.env.VERCEL_URL,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  },
): URL | undefined {
  if (entorno.VERCEL_ENV === "preview") {
    const preview = deHost(entorno.VERCEL_BRANCH_URL || entorno.VERCEL_URL);
    if (preview) return preview;
  }
  return (
    urlDelSitio(entorno.NEXT_PUBLIC_SITIO_URL) ??
    deHost(entorno.VERCEL_PROJECT_PRODUCTION_URL)
  );
}
