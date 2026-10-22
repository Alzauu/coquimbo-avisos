-- =====================================================================
-- Lectura pública de reportes.
-- anon y authenticated solo ven reportes aprobados por moderación, no
-- rechazados y de comunas activas, y solo las columnas seguras: nunca
-- usuario_id, es_anonimo, entidad_asignada_id ni moderacion.
-- Defensa en dos capas: permisos por columna + política RLS por fila.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Moderación: separa "¿es público?" del estado del problema.
--    Todo reporte nace pendiente; "oculto" retira uno ya aprobado
--    (por ejemplo, si una foto muestra un rostro o una patente).
-- ---------------------------------------------------------------------
CREATE TYPE estado_moderacion AS ENUM ('pendiente', 'aprobado', 'oculto');

ALTER TABLE reportes
    ADD COLUMN moderacion estado_moderacion NOT NULL DEFAULT 'pendiente';

-- ---------------------------------------------------------------------
-- 2. Permisos por columna sobre la tabla.
--    Supabase da todos los permisos a anon y authenticated por defecto;
--    se quitan y se concede SELECT solo sobre columnas seguras.
--    Crear o editar reportes tendrá su propia migración.
-- ---------------------------------------------------------------------
REVOKE ALL ON reportes FROM anon, authenticated;

GRANT SELECT (
    id, categoria_id, comuna_id, titulo, descripcion, ubicacion,
    direccion_referencia, estado, creado_en, resuelto_en
) ON reportes TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. RLS: solo filas aprobadas, no rechazadas y de comunas activas.
--    La política se evalúa aunque quien consulta no pueda leer
--    la columna moderacion.
-- ---------------------------------------------------------------------
CREATE POLICY "reportes: lectura pública de aprobados" ON reportes
    FOR SELECT TO anon, authenticated
    USING (
        moderacion = 'aprobado'
        AND estado <> 'rechazado'
        AND comuna_id IN (SELECT c.id FROM comunas c WHERE c.activa)
    );

-- ---------------------------------------------------------------------
-- 4. Vista pública con coordenadas legibles.
--    Se recrea (no se puede quitar columnas con CREATE OR REPLACE):
--    sin usuario_id y sin apoyos (contarlos exigiría abrir
--    reporte_apoyos, que tiene usuario_id).
--    security_invoker: aplica los permisos y la RLS de quien consulta,
--    por eso la vista solo puede usar columnas concedidas arriba.
-- ---------------------------------------------------------------------
DROP VIEW v_reportes_publicos;

CREATE VIEW v_reportes_publicos WITH (security_invoker = true) AS
SELECT r.id, r.categoria_id, r.comuna_id, r.titulo, r.descripcion,
       r.direccion_referencia, r.estado, r.creado_en, r.resuelto_en,
       extensions.st_y(r.ubicacion::extensions.geometry) AS latitud,
       extensions.st_x(r.ubicacion::extensions.geometry) AS longitud,
       r.ubicacion   -- para filtros espaciales con índice (ver reportes_en_zona)
FROM reportes r;

-- Solo lectura: la vista es actualizable automáticamente, así que se
-- quitan los permisos por defecto y se concede únicamente SELECT.
REVOKE ALL ON v_reportes_publicos FROM anon, authenticated;
GRANT SELECT ON v_reportes_publicos TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Reportes en la zona visible del mapa.
--    SECURITY INVOKER: respeta la RLS y los permisos de quien llama.
--    Devuelve coordenadas como números (no geography) y como máximo
--    500 filas por llamada.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.reportes_en_zona(
    oeste       DOUBLE PRECISION,
    sur         DOUBLE PRECISION,
    este        DOUBLE PRECISION,
    norte       DOUBLE PRECISION,
    categorias  SMALLINT[] DEFAULT NULL,             -- NULL = todas
    estados     public.estado_reporte[] DEFAULT NULL -- NULL = todos
)
RETURNS TABLE (
    id                   UUID,
    categoria_id         SMALLINT,
    titulo               VARCHAR(140),
    descripcion          TEXT,
    direccion_referencia VARCHAR(200),
    estado               public.estado_reporte,
    creado_en            TIMESTAMPTZ,
    resuelto_en          TIMESTAMPTZ,
    latitud              DOUBLE PRECISION,
    longitud             DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT v.id, v.categoria_id, v.titulo, v.descripcion,
           v.direccion_referencia, v.estado, v.creado_en, v.resuelto_en,
           v.latitud, v.longitud
    FROM public.v_reportes_publicos v
    WHERE v.ubicacion OPERATOR(extensions.&&)
              extensions.st_makeenvelope(oeste, sur, este, norte, 4326)::extensions.geography
      AND (categorias IS NULL OR v.categoria_id = ANY (categorias))
      AND (estados IS NULL OR v.estado = ANY (estados))
    ORDER BY v.creado_en DESC
    LIMIT 500;
$$;

REVOKE EXECUTE ON FUNCTION public.reportes_en_zona FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reportes_en_zona TO anon, authenticated;
