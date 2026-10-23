import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Solo en desarrollo: permite abrir `pnpm dev` desde el teléfono en la
  // red local (IP de este PC). No afecta el build de producción.
  allowedDevOrigins: ["192.168.1.10"],
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
