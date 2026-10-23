-- =====================================================================
-- Moderación de reportes.
-- - Solo moderadores y admins (perfiles.rol) revisan reportes, siempre
--   mediante funciones: nadie edita reportes ni fotos directamente desde
--   la API. Cada función verifica el rol al empezar.
-- - Cada decisión queda en reporte_historial con quién la tomó.
-- - Fotos públicas: anon y authenticated pueden saber qué fotos visibles
--   tiene un reporte publicado (id y orden), nunca su ruta en Storage. La
--   app las sirve con URLs propias, firmadas y de corta duración (ver
--   apps/web/src/app/fotos/[id]). No se usan URLs firmadas de Supabase porque
--   llevan la ruta (con el id del autor), el cliente elige su vencimiento
--   y no se pueden revocar al ocultar una foto.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ¿Quién modera?
--    SECURITY DEFINER para no depender de las políticas de perfiles.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.es_moderador() RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.perfiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.rol IN ('moderador', 'admin')
    );
$$;

REVOKE EXECUTE ON FUNCTION public.es_moderador() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.es_moderador() TO authenticated;

-- Uso interno: se llama desde las funciones de moderación (SECURITY
-- DEFINER), que ya corren con los permisos de su dueño.
CREATE FUNCTION public.exigir_moderador() RETURNS VOID
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
    IF NOT public.es_moderador() THEN
        RAISE EXCEPTION 'No tienes permiso para moderar reportes.'
            USING ERRCODE = '42501', HINT = 'sin_permiso';
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.exigir_moderador() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Historial: qué se hizo, sobre qué foto y el estado de moderación.
--    estado_anterior y estado_nuevo (estado del problema) se llenan
--    siempre; si la acción no lo cambia, ambos son el estado actual.
--    Sigue cerrado: sin políticas ni permisos para anon y authenticated
--    (cambiado_por identifica al moderador).
-- ---------------------------------------------------------------------
CREATE TYPE public.accion_historial AS ENUM (
    'aprobar', 'rechazar', 'ocultar_reporte', 'ocultar_foto', 'cambiar_estado'
);

ALTER TABLE reporte_historial
    ADD COLUMN accion              public.accion_historial  NOT NULL,
    ADD COLUMN moderacion_anterior public.estado_moderacion NOT NULL,
    ADD COLUMN moderacion_nueva    public.estado_moderacion NOT NULL,
    ADD COLUMN foto_id             BIGINT REFERENCES reporte_fotos(id) ON DELETE SET NULL,
    ADD CONSTRAINT reporte_historial_nota_largo
        CHECK (nota IS NULL OR char_length(nota) BETWEEN 1 AND 500),
    ADD CONSTRAINT reporte_historial_foto
        CHECK (foto_id IS NULL OR accion = 'ocultar_foto');

REVOKE ALL ON reporte_historial FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Lista de pendientes, de la más antigua a la más nueva.
--    Sin datos del autor: moderar no los necesita.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.reportes_pendientes()
RETURNS TABLE (
    id                   UUID,
    categoria_id         SMALLINT,
    titulo               VARCHAR(140),
    descripcion          TEXT,
    direccion_referencia VARCHAR(200),
    creado_en            TIMESTAMPTZ,
    latitud              DOUBLE PRECISION,
    longitud             DOUBLE PRECISION,
    fotos                JSONB      -- [{id, ruta, orden, oculta}], en orden
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM public.exigir_moderador();

    RETURN QUERY
    SELECT r.id, r.categoria_id, r.titulo, r.descripcion,
           r.direccion_referencia, r.creado_en,
           extensions.st_y(r.ubicacion::extensions.geometry),
           extensions.st_x(r.ubicacion::extensions.geometry),
           COALESCE(
               (SELECT jsonb_agg(
                           jsonb_build_object(
                               'id', f.id, 'ruta', f.ruta,
                               'orden', f.orden, 'oculta', f.oculta)
                           ORDER BY f.orden)
                FROM public.reporte_fotos f
                WHERE f.reporte_id = r.id),
               '[]'::jsonb
           )
    FROM public.reportes r
    WHERE r.moderacion = 'pendiente'
    ORDER BY r.creado_en
    LIMIT 50;
END;
$$;

-- ---------------------------------------------------------------------
-- 4. Decisiones. Cada una bloquea la fila (FOR UPDATE) y comprueba el
--    estado esperado: si dos moderadores deciden a la vez, el segundo
--    recibe un error en vez de pisar al primero.
-- ---------------------------------------------------------------------

-- Texto opcional u obligatorio de una decisión: sin espacios sobrantes,
-- entre 5 y 500 caracteres.
CREATE FUNCTION public.validar_nota_moderacion(nota TEXT, obligatoria BOOLEAN)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
    limpia TEXT := NULLIF(btrim(nota), '');
BEGIN
    IF limpia IS NULL AND NOT obligatoria THEN
        RETURN NULL;
    END IF;
    IF limpia IS NULL OR char_length(limpia) NOT BETWEEN 5 AND 500 THEN
        RAISE EXCEPTION 'El motivo debe tener entre 5 y 500 caracteres.'
            USING ERRCODE = 'P0001', HINT = 'motivo_invalido';
    END IF;
    RETURN limpia;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validar_nota_moderacion(TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;

-- Cambia la moderación de un reporte que esté en el estado esperado y lo
-- registra. Uso interno, como exigir_moderador.
CREATE FUNCTION public.moderar_reporte(
    reporte  UUID,
    esperada public.estado_moderacion,
    nueva    public.estado_moderacion,
    accion   public.accion_historial,
    nota     TEXT
) RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    estado_actual public.estado_reporte;
BEGIN
    SELECT r.estado INTO estado_actual
    FROM public.reportes r
    WHERE r.id = reporte AND r.moderacion = esperada
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El reporte no existe o ya fue revisado.'
            USING ERRCODE = 'P0001', HINT = 'ya_revisado';
    END IF;

    UPDATE public.reportes r SET moderacion = nueva WHERE r.id = reporte;

    INSERT INTO public.reporte_historial (
        reporte_id, accion, estado_anterior, estado_nuevo,
        moderacion_anterior, moderacion_nueva, cambiado_por, nota
    ) VALUES (
        reporte, accion, estado_actual, estado_actual,
        esperada, nueva, (SELECT auth.uid()), nota
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.moderar_reporte(UUID, public.estado_moderacion, public.estado_moderacion, public.accion_historial, TEXT)
    FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.aprobar_reporte(reporte UUID) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM public.exigir_moderador();
    PERFORM public.moderar_reporte(reporte, 'pendiente', 'aprobado', 'aprobar', NULL);
END;
$$;

CREATE FUNCTION public.rechazar_reporte(reporte UUID, motivo TEXT) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM public.exigir_moderador();
    PERFORM public.moderar_reporte(
        reporte, 'pendiente', 'rechazado', 'rechazar',
        public.validar_nota_moderacion(motivo, TRUE)
    );
END;
$$;

-- Retira del mapa público un reporte ya publicado. El motivo es opcional.
CREATE FUNCTION public.ocultar_reporte(reporte UUID, motivo TEXT DEFAULT NULL) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM public.exigir_moderador();
    PERFORM public.moderar_reporte(
        reporte, 'aprobado', 'oculto', 'ocultar_reporte',
        public.validar_nota_moderacion(motivo, FALSE)
    );
END;
$$;

-- Oculta una foto (rostros, patentes) de un reporte pendiente o publicado.
CREATE FUNCTION public.ocultar_foto(foto BIGINT) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    reporte UUID;
    estado_actual public.estado_reporte;
    moderacion_actual public.estado_moderacion;
BEGIN
    PERFORM public.exigir_moderador();

    SELECT f.reporte_id INTO reporte
    FROM public.reporte_fotos f
    WHERE f.id = foto AND NOT f.oculta
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La foto no existe o ya está oculta.'
            USING ERRCODE = 'P0001', HINT = 'foto_no_disponible';
    END IF;

    UPDATE public.reporte_fotos f SET oculta = TRUE WHERE f.id = foto;

    SELECT r.estado, r.moderacion INTO estado_actual, moderacion_actual
    FROM public.reportes r
    WHERE r.id = reporte;

    INSERT INTO public.reporte_historial (
        reporte_id, accion, estado_anterior, estado_nuevo,
        moderacion_anterior, moderacion_nueva, cambiado_por, foto_id
    ) VALUES (
        reporte, 'ocultar_foto', estado_actual, estado_actual,
        moderacion_actual, moderacion_actual, (SELECT auth.uid()), foto
    );
END;
$$;

-- Estado del problema de un reporte publicado. 'rechazado' no se usa:
-- rechazar es una decisión de moderación (rechazar_reporte).
CREATE FUNCTION public.cambiar_estado_reporte(
    reporte UUID,
    nuevo   public.estado_reporte
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    anterior public.estado_reporte;
BEGIN
    PERFORM public.exigir_moderador();

    IF nuevo IS NULL OR nuevo = 'rechazado' THEN
        RAISE EXCEPTION 'Estado no válido.'
            USING ERRCODE = 'P0001', HINT = 'estado_invalido';
    END IF;

    SELECT r.estado INTO anterior
    FROM public.reportes r
    WHERE r.id = reporte AND r.moderacion = 'aprobado'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El reporte no existe o no está publicado.'
            USING ERRCODE = 'P0001', HINT = 'no_publicado';
    END IF;

    IF anterior = nuevo THEN
        RETURN;
    END IF;

    UPDATE public.reportes r
    SET estado = nuevo,
        resuelto_en = CASE WHEN nuevo = 'resuelto' THEN now() END
    WHERE r.id = reporte;

    INSERT INTO public.reporte_historial (
        reporte_id, accion, estado_anterior, estado_nuevo,
        moderacion_anterior, moderacion_nueva, cambiado_por
    ) VALUES (
        reporte, 'cambiar_estado', anterior, nuevo,
        'aprobado', 'aprobado', (SELECT auth.uid())
    );
END;
$$;

-- Solo usuarios con sesión; el rol se verifica dentro de cada función.
REVOKE EXECUTE ON FUNCTION public.reportes_pendientes() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.aprobar_reporte(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rechazar_reporte(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ocultar_reporte(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ocultar_foto(BIGINT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cambiar_estado_reporte(UUID, public.estado_reporte) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reportes_pendientes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.aprobar_reporte(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rechazar_reporte(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocultar_reporte(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocultar_foto(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cambiar_estado_reporte(UUID, public.estado_reporte) TO authenticated;

-- ---------------------------------------------------------------------
-- 5. Fotos visibles de reportes publicados: id y orden, nunca la ruta.
--    La subconsulta sobre reportes aplica la RLS de quien consulta, así
--    que hereda exactamente la regla de "reporte público" (aprobado, no
--    rechazado, comuna activa). Ocultar la foto o el reporte la retira.
-- ---------------------------------------------------------------------
GRANT SELECT (id, reporte_id, orden) ON reporte_fotos TO anon, authenticated;

CREATE POLICY "reporte_fotos: lectura pública de fotos visibles" ON reporte_fotos
    FOR SELECT TO anon, authenticated
    USING (
        NOT oculta
        AND EXISTS (SELECT 1 FROM public.reportes r WHERE r.id = reporte_id)
    );

-- Ruta en Storage de una foto pública, o NULL si la foto o su reporte ya
-- no son públicos. Solo para el servidor de la app (service_role), que
-- sirve la foto sin mostrar la ruta. service_role se salta la RLS, así que
-- la regla de "reporte público" se repite aquí: debe coincidir con la
-- política "reportes: lectura pública de aprobados".
CREATE FUNCTION public.ruta_foto_publica(foto BIGINT) RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    SELECT f.ruta
    FROM public.reporte_fotos f
    JOIN public.reportes r ON r.id = f.reporte_id
    JOIN public.comunas c ON c.id = r.comuna_id
    WHERE f.id = foto
      AND NOT f.oculta
      AND r.moderacion = 'aprobado'
      AND r.estado <> 'rechazado'
      AND c.activa;
$$;

REVOKE EXECUTE ON FUNCTION public.ruta_foto_publica(BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ruta_foto_publica(BIGINT) TO service_role;

-- ---------------------------------------------------------------------
-- 6. Storage: moderación puede ver (y firmar URLs de) todas las fotos,
--    incluidas las de reportes pendientes.
-- ---------------------------------------------------------------------
CREATE POLICY "reportes-fotos: moderación lee todas" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'reportes-fotos'
        AND public.es_moderador()
    );

-- ---------------------------------------------------------------------
-- 7. Mis reportes: agrega el motivo del rechazo, si lo hay.
--    Se recrea porque cambia el tipo de retorno.
-- ---------------------------------------------------------------------
DROP FUNCTION public.mis_reportes();

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
    fotos                TEXT[],         -- rutas en Storage, en orden
    motivo_rechazo       TEXT            -- NULL si no fue rechazado
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
           ),
           -- Un rechazo es definitivo: si hay uno, es el motivo vigente.
           (SELECT h.nota
            FROM public.reporte_historial h
            WHERE h.reporte_id = r.id AND h.accion = 'rechazar'
            ORDER BY h.creado_en DESC
            LIMIT 1)
    FROM public.reportes r
    WHERE r.usuario_id = (SELECT auth.uid())
    ORDER BY r.creado_en DESC
    LIMIT 100;
$$;

REVOKE EXECUTE ON FUNCTION public.mis_reportes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mis_reportes() TO authenticated;
