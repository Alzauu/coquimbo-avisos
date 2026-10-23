import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents y partialPrefetching quedan desactivados (valor por defecto)
  // hasta que integremos Supabase y decidamos qué datos cachear.
  experimental: {
    serverActions: {
      // Formulario de reporte: hasta 3 fotos ya reducidas en el navegador
      // (MAX_BYTES_FOTO_ENVIADA en lib/reportes/esquemas.ts) más los campos.
      // Por debajo del límite de 4,5 MB por petición de Vercel.
      bodySizeLimit: "4mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
