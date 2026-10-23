# coquimbo-avisos

Aplicación web (PWA) y, más adelante, móvil para que los vecinos de la Región de Coquimbo reporten y vean incidentes y obras (pavimentación, cortes de agua/luz, desvíos) en su comuna. Piloto: La Serena. Se expandirá comuna por comuna y región por región. El nombre comercial está pendiente.

Desarrollador: una sola persona. Prefiere pasos pequeños, simples y revisables.

## Stack

- Web: Next.js (App Router) + TypeScript estricto, desplegado en Vercel
- Base de datos: Supabase (PostgreSQL + PostGIS), auth y storage de Supabase
- Mapas: MapLibre GL con tiles de un proveedor (MapTiler o Protomaps). NO usar tile.openstreetmap.org en producción
- Estilos: Tailwind CSS
- Validación: Zod
- Tests: Vitest (unitarios) y Playwright (flujos clave)
- Gestor de paquetes: pnpm
- Móvil (más adelante): Expo / React Native, compartiendo tipos y lógica

## Estructura

```
apps/web                 Next.js
apps/mobile              Expo (aún no)
packages/shared          tipos, validaciones Zod, utilidades (cuando haga falta)
supabase/migrations      migraciones SQL (la primera es el schema inicial)
supabase/seed.sql        datos de ejemplo para desarrollo
docs                     plan de negocio y notas
```

## Base de datos

- El esquema está en `supabase/migrations/`. Léelo antes de escribir consultas. Los nombres de tablas y columnas están en español (comunas, categorias, reportes, obras, etc.).
- Solo La Serena está `activa`. El resto de comunas existen, pero desactivadas.
- Usa las vistas `v_reportes_publicos` y `v_obras_vigentes` para lo público; nunca expongas columnas privadas (email, ubicación exacta de usuarios, etc.).
- Todo cambio de esquema va en una migración nueva. No edites migraciones ya aplicadas.
- Toda tabla debe tener RLS activada y políticas explícitas. Si una tabla no tiene política, nadie la lee.
- Tras cambiar el esquema, regenera los tipos de TypeScript con la CLI de Supabase.

## Reglas importantes

- Nunca escribas ni subas claves, tokens ni contraseñas. Usa variables de entorno. Mantén `.env.example` con nombres y sin valores. La clave `service_role` solo vive en el servidor y jamás en código cliente ni en variables `NEXT_PUBLIC_*`.
- Datos personales: guarda lo mínimo. Respeta la Ley 19.628 y la Ley 21.719. Las fotos pueden mostrar rostros o patentes; la moderación debe poder ocultarlas.
- Contenido de usuarios: valida y sanitiza todo en el servidor, limita tamaño y tipo de las fotos, y aplica límites de frecuencia a la creación de reportes.
- Interfaz en español de Chile, mobile-first, accesible (contraste, etiquetas, teclado).
- Antes de agregar una dependencia nueva, explica por qué hace falta.

## Forma de trabajar

- Haz un cambio pequeño por vez. Antes de empezar una tarea grande, propón un plan corto y espera confirmación.
- Al terminar, ejecuta `pnpm lint`, `pnpm typecheck` y `pnpm test`, y corrige lo que falle.
- Commits pequeños en español o inglés, en imperativo, por ejemplo `feat: formulario de reporte`.
- Si algo es ambiguo o no sabes cómo funciona una parte del dominio, pregunta en vez de inventar.

## Comandos

- `pnpm dev` servidor de desarrollo (apps/web, http://localhost:3000)
- `pnpm build` build de producción
- `pnpm lint` / `pnpm typecheck` / `pnpm test`
- `pnpm format` / `pnpm format:check` Prettier
- `pnpm db:push` aplica migraciones al proyecto Supabase vinculado (remoto; no hay base local con Docker por ahora)
- `pnpm db:types` regenera `apps/web/src/lib/supabase/database.types.ts`
- Variables de entorno: copiar `.env.example` a `apps/web/.env.local`
- PostGIS y citext viven en el esquema `extensions`: en SQL usa `extensions.geography`, `extensions.citext`, etc.
