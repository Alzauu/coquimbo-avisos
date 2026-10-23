-- =====================================================================
-- Creación de reportes por usuarios con sesión.
-- - authenticated solo puede insertar columnas que llena el vecino;
--   autor, estado y moderación los fija la base.
-- - Nadie puede editar ni borrar reportes desde la API.
-- - Límite de 5 reportes por hora por usuario, aplicado en la base para
--   que no se pueda saltar llamando a la API directamente.
-- - Fotos: hasta 3 por reporte, en un bucket privado.
-- - El autor lee sus reportes (incluso pendientes) con mis_reportes(),
--   no con una política SELECT: las políticas se combinan con OR y sus
--   pendientes aparecerían en v_reportes_publicos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Reportes: valores fijados por la base y límites de largo
-- ---------------------------------------------------------------------
ALTER TABLE reportes ALTER COLUMN usuario_id SET DEFAULT auth.uid();

ALTER TABLE reportes
    ADD CONSTRAINT reportes_titulo_largo
        CHECK (char_length(titulo) BETWEEN 5 AND 140),
    ADD CONSTRAINT reportes_descripcion_largo
        CHECK (descripcion IS NULL OR char_length(descripcion) <= 1000);

-- El id lo genera el servidor: así no hace falta RETURNING, que la RLS
-- bloquearía porque el autor no puede leer filas pendientes en la tabla.
GRANT INSERT (
    id, categoria_id, comuna_id, titulo, descripcion, ubicacion,
    direccion_referencia
) ON reportes TO authenticated;

-- Segunda capa: aunque los permisos por columna cambiaran, la fila debe
-- nacer a nombre de quien la crea, pendiente y sin gestión.
CREATE POLICY "reportes: creación de reportes propios" ON reportes
    FOR INSERT TO authenticated
    WITH CHECK (
        usuario_id = (SELECT auth.uid())
        AND moderacion = 'pendiente'
        AND estado = 'recibido'
        AND resuelto_en IS NULL
        AND entidad_asignada_id IS NULL
        AND NOT es_anonimo
        AND comuna_id IN (SELECT c.id FROM comunas c WHERE c.activa)
    );

-- ---------------------------------------------------------------------
-- 2. Límite de frecuencia y ubicación dentro de la comuna
--    SECURITY DEFINER: debe contar reportes pendientes que la RLS oculta
--    a su autor. Las cargas administrativas (seed, service_role) no
--    tienen auth.uid() y no se limitan.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.validar_nuevo_reporte() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    recientes INT;
    limites_comuna extensions.geography;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    -- Serializa los envíos simultáneos del mismo usuario para que no
    -- pasen todos el conteo a la vez.
    PERFORM pg_advisory_xact_lock(
        hashtextextended('reportes:' || NEW.usuario_id::text, 0)
    );

    SELECT count(*) INTO recientes
    FROM public.reportes r
    WHERE r.usuario_id = NEW.usuario_id
      AND r.creado_en > now() - interval '1 hour';

    IF recientes >= 5 THEN
        RAISE EXCEPTION 'Alcanzaste el límite de 5 reportes por hora.'
            USING ERRCODE = 'P0001', HINT = 'limite_frecuencia';
    END IF;

    -- Si la comuna tiene su límite oficial cargado, el punto debe caer
    -- dentro.
    SELECT c.limites INTO limites_comuna
    FROM public.comunas c
    WHERE c.id = NEW.comuna_id;

    IF limites_comuna IS NOT NULL THEN
        IF NOT extensions.st_covers(limites_comuna, NEW.ubicacion) THEN
            RAISE EXCEPTION 'La ubicación está fuera de la comuna.'
                USING ERRCODE = 'P0001', HINT = 'fuera_de_comuna';
        END IF;
    -- PROVISORIO hasta cargar el límite oficial de La Serena: rectángulo
    -- amplio (incluye parte de Coquimbo) para no rechazar reportes
    -- válidos; moderación revisa el resto. Debe coincidir con
    -- RECTANGULO_LA_SERENA en apps/web.
    ELSIF NEW.comuna_id = 4101 AND NOT (
        extensions.st_x(NEW.ubicacion::extensions.geometry) BETWEEN -71.40 AND -70.70
        AND extensions.st_y(NEW.ubicacion::extensions.geometry) BETWEEN -30.10 AND -29.55
    ) THEN
        RAISE EXCEPTION 'La ubicación está fuera de la comuna.'
            USING ERRCODE = 'P0001', HINT = 'fuera_de_comuna';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validar_nuevo_reporte() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_reportes_validar_nuevo BEFORE INSERT ON reportes
    FOR EACH ROW EXECUTE FUNCTION public.validar_nuevo_reporte();

-- ---------------------------------------------------------------------
-- 3. Fotos de reportes
--    ruta = ruta del archivo en Storage (no una URL pública).
--    oculta = moderación puede ocultar una foto (rostros, patentes).
--    orden de 1 a 3 y único por reporte: máximo 3 fotos.
-- ---------------------------------------------------------------------
ALTER TABLE reporte_fotos RENAME COLUMN url TO ruta;
ALTER TABLE reporte_fotos
    ADD COLUMN oculta BOOLEAN NOT NULL DEFAULT FALSE,
    ADD CONSTRAINT reporte_fotos_orden_rango CHECK (orden BETWEEN 1 AND 3),
    ADD CONSTRAINT reporte_fotos_reporte_orden_key UNIQUE (reporte_id, orden),
    ADD CONSTRAINT reporte_fotos_ruta_key UNIQUE (ruta);

REVOKE ALL ON reporte_fotos FROM anon, authenticated;
GRANT INSERT (reporte_id, ruta, orden) ON reporte_fotos TO authenticated;

-- ¿Es un reporte propio, todavía pendiente de moderación?
-- SECURITY DEFINER: el autor no puede leer sus filas pendientes.
CREATE FUNCTION public.es_mi_reporte_pendiente(reporte UUID) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.reportes r
        WHERE r.id = reporte
          AND r.usuario_id = (SELECT auth.uid())
          AND r.moderacion = 'pendiente'
    );
$$;

-- Registrar una foto solo si el archivo ya está subido en la carpeta
-- del reporte propio pendiente: "<usuario>/<reporte>/<uuid>.webp".
CREATE FUNCTION public.puede_registrar_foto(reporte UUID, ruta TEXT) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT public.es_mi_reporte_pendiente(reporte)
       AND ruta ~ ('^' || (SELECT auth.uid())::text || '/' || reporte::text
                   || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$')
       AND EXISTS (
           SELECT 1
           FROM storage.objects o
           WHERE o.bucket_id = 'reportes-fotos'
             AND o.name = ruta
       );
$$;

CREATE POLICY "reporte_fotos: registrar fotos de reportes propios" ON reporte_fotos
    FOR INSERT TO authenticated
    WITH CHECK (public.puede_registrar_foto(reporte_id, ruta));

-- ---------------------------------------------------------------------
-- 4. Storage: bucket privado, 800 KB por foto, solo WebP (el servidor
--    vuelve a codificar cada foto, lo que también quita EXIF y GPS).
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('reportes-fotos', 'reportes-fotos', FALSE, 819200, ARRAY['image/webp']);

-- Subir solo a "<usuario>/<reporte propio pendiente>/<uuid>.webp" y
-- como máximo 3 archivos por reporte.
CREATE FUNCTION public.puede_subir_foto_reporte(nombre TEXT) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    partes TEXT[] := string_to_array(nombre, '/');
    uuid_re CONSTANT TEXT := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
BEGIN
    IF auth.uid() IS NULL
       OR array_length(partes, 1) <> 3
       OR partes[1] <> auth.uid()::text
       OR partes[2] !~ (uuid_re || '$')
       OR partes[3] !~ (uuid_re || '\.webp$') THEN
        RETURN FALSE;
    END IF;

    IF NOT public.es_mi_reporte_pendiente(partes[2]::uuid) THEN
        RETURN FALSE;
    END IF;

    RETURN (
        SELECT count(*)
        FROM storage.objects o
        WHERE o.bucket_id = 'reportes-fotos'
          AND o.name LIKE partes[1] || '/' || partes[2] || '/%'
    ) < 3;
END;
$$;

-- Las políticas evalúan estas funciones con el rol de quien consulta.
REVOKE EXECUTE ON FUNCTION public.es_mi_reporte_pendiente(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.puede_registrar_foto(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.puede_subir_foto_reporte(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.es_mi_reporte_pendiente(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.puede_registrar_foto(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.puede_subir_foto_reporte(TEXT) TO authenticated;

-- Sin políticas UPDATE ni DELETE: una foto subida no se reemplaza ni se
-- borra desde la API (tampoco se permite upsert).
CREATE POLICY "reportes-fotos: subir a reportes propios pendientes" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'reportes-fotos'
        AND public.puede_subir_foto_reporte(name)
    );

-- Cada usuario lee (y firma URLs de) solo sus propias fotos. La lectura
-- pública de fotos aprobadas tendrá su propia migración.
CREATE POLICY "reportes-fotos: leer las propias" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'reportes-fotos'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

-- ---------------------------------------------------------------------
-- 5. Mis reportes: los del usuario actual, con su estado de moderación.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.mis_reportes()
RETURNS TABLE (
    id                   UUID,
    categoria_id         SMALLINT,
    titulo               VARCHAR(140),
    descripcion          TEXT,
    direccion_referencia VARCHAR(200),
    estado               public.estado_reporte,
    moderacion           public.estado_moderacion,
    creado_en            TIMESTAMPTZ,
    latitud              DOUBLE PRECISION,
    longitud             DOUBLE PRECISION,
    fotos                TEXT[]          -- rutas en Storage, en orden
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT r.id, r.categoria_id, r.titulo, r.descripcion,
           r.direccion_referencia, r.estado, r.moderacion, r.creado_en,
           extensions.st_y(r.ubicacion::extensions.geometry),
           extensions.st_x(r.ubicacion::extensions.geometry),
           COALESCE(
               (SELECT array_agg(f.ruta ORDER BY f.orden)
                FROM public.reporte_fotos f
                WHERE f.reporte_id = r.id),
               '{}'
           )
    FROM public.reportes r
    WHERE r.usuario_id = (SELECT auth.uid())
    ORDER BY r.creado_en DESC
    LIMIT 100;
$$;

REVOKE EXECUTE ON FUNCTION public.mis_reportes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mis_reportes() TO authenticated;
