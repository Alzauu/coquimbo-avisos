// Copia el worker de MapLibre a public/vendor. MapLibre arma la URL del
// worker en tiempo de ejecución, así que el bundler no lo incluye; el mapa
// lo carga con setWorkerUrl. Se ejecuta antes de `next dev` y `next build`
// para que siempre coincida con la versión instalada.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const origen = require.resolve("maplibre-gl/dist/maplibre-gl-worker.mjs");
const destino = new URL("../public/vendor/", import.meta.url);

mkdirSync(destino, { recursive: true });
copyFileSync(origen, new URL("maplibre-gl-worker.mjs", destino));
