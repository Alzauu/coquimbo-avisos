import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents y partialPrefetching quedan desactivados (valor por defecto)
  // hasta que integremos Supabase y decidamos qué datos cachear.
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
