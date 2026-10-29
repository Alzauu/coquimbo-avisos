-- =====================================================================
-- Reportes públicos cerca de un punto, para avisar de posibles
-- duplicados al reportar (docs/plan-mejoras.md, #5a).
-- - SECURITY INVOKER sobre v_reportes_publicos: aplica la RLS y los
--   permisos de quien consulta, así que solo devuelve reportes públicos
--   (aprobados, no rechazados, de comunas activas). Nunca pendientes.
-- - Radio acotado entre 10 y 200 m (75 m si llega NULL). La app elige el
--   radio de cada categoría (RADIO_DUPLICADOS en
--   apps/web/src/lib/reportes/categorias.ts).
-- - Sin resueltos: un problema ya arreglado que vuelve es un reporte nuevo.
-- - Índice: con la RLS de anon y authenticated, Postgres NO usa el GIST
--   idx_reportes_ubicacion, porque st_dwithin y && de PostGIS no son
--   LEAKPROOF y no pueden evaluarse antes de la política (pasa lo mismo
--   con reportes_en_zona). Hace un Seq Scan de los reportes; con el
--   volumen del piloto toma milisegundos. Sin RLS (postgres) sí usa el
--   índice. Pendiente en docs/pendientes.md.
-- - Como máximo 5 filas, de la más cercana a la más lejana.
-- - No guarda ni registra el punto consultado.
-- =====================================================================

CREATE FUNCTION public.reportes_cercanos(
    latitud    DOUBLE PRECISION,
    longitud   DOUBLE PRECISION,
    categoria  SMALLINT DEFAULT NULL,   -- NULL = todas
    radio_m    INT DEFAULT 75
)
RETURNS TABLE (
    id                   UUID,
    categoria_id         SMALLINT,
    titulo               VARCHAR(140),
    direccion_referencia VARCHAR(200),
    estado               public.estado_reporte,
    creado_en            TIMESTAMPTZ,
    me_afecta            INT,
    distancia_m          INT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    -- Los parámetros van calificados con el nombre de la función: la vista
    -- también tiene columnas latitud y longitud. Un punto fuera de rango
    -- no produce fila en «punto», así que la función no devuelve nada.
    WITH punto AS (
        SELECT extensions.st_setsrid(
                   extensions.st_makepoint(reportes_cercanos.longitud,
                                           reportes_cercanos.latitud),
                   4326
               )::extensions.geography AS geo,
               LEAST(GREATEST(COALESCE(reportes_cercanos.radio_m, 75), 10), 200) AS radio
        WHERE reportes_cercanos.latitud BETWEEN -90 AND 90
          AND reportes_cercanos.longitud BETWEEN -180 AND 180
    )
    SELECT v.id, v.categoria_id, v.titulo, v.direccion_referencia, v.estado,
           v.creado_en, v.me_afecta,
           round(extensions.st_distance(v.ubicacion, p.geo))::INT AS distancia_m
    FROM public.v_reportes_publicos v
    CROSS JOIN punto p
    WHERE extensions.st_dwithin(v.ubicacion, p.geo, p.radio)
      AND (reportes_cercanos.categoria IS NULL
           OR v.categoria_id = reportes_cercanos.categoria)
      AND v.estado <> 'resuelto'
    ORDER BY distancia_m, v.creado_en DESC
    LIMIT 5;
$$;

REVOKE EXECUTE ON FUNCTION public.reportes_cercanos FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reportes_cercanos TO anon, authenticated;
