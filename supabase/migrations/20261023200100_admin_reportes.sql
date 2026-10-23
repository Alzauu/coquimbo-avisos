-- =====================================================================
-- Administración de reportes (solo rol admin).
-- - Como en moderación, todo pasa por funciones SECURITY DEFINER que
--   verifican el rol al empezar (42501 si no es admin). La API sigue sin
--   permitir UPDATE ni DELETE directos sobre reportes.
-- - Cada acción queda en reporte_historial. Al editar, de título,
--   descripción y referencia solo se registra que cambiaron (no el texto,
--   que puede traer datos personales); de categoría, estado y ubicación,
--   el antes y el después.
-- - Eliminar es definitivo: el historial se borra en cascada con el
--   reporte, así que la eliminación queda en reportes_eliminados, sin
--   contenido del reporte (solo metadatos).
-- - Las fotos de un reporte eliminado las borra la app con la sesión del
--   admin (API de Storage), no con service_role.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ¿Es admin?
-- ---------------------------------------------------------------------
CREATE FUNCTION public.es_admin() RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.perfiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.rol = 'admin'
    );
$$;

REVOKE EXECUTE ON FUNCTION public.es_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.es_admin() TO authenticated;

-- Uso interno, como exigir_moderador.
CREATE FUNCTION public.exigir_admin() RETURNS VOID
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
    IF NOT public.es_admin() THEN
        RAISE EXCEPTION 'Solo administración puede hacer esto.'
            USING ERRCODE = '42501', HINT = 'sin_permiso';
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.exigir_admin() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Historial de ediciones
--    cambios: {campo: ...} solo con lo que cambió.
--    - titulo, descripcion, direccion_referencia: true (sin el texto).
--    - categoria_id, estado: {"antes": ..., "despues": ...}.
--    - ubicacion: {"antes": {"lat", "lng"}, "despues": {"lat", "lng"}}.
-- ---------------------------------------------------------------------
ALTER TABLE reporte_historial
    ADD COLUMN cambios JSONB,
    ADD CONSTRAINT reporte_historial_cambios CHECK (
        (accion = 'editar') = (cambios IS NOT NULL)
        AND (cambios IS NULL OR jsonb_typeof(cambios) = 'object')
    );

-- ---------------------------------------------------------------------
-- 3. Ubicación dentro de la comuna, en un solo lugar: la usan el trigger
--    de reportes nuevos y editar_reporte.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.ubicacion_en_comuna(
    comuna SMALLINT,
    punto  extensions.geography
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
    limites_comuna extensions.geography;
BEGIN
    SELECT c.limites INTO limites_comuna
    FROM public.comunas c
    WHERE c.id = comuna;

    -- Si la comuna tiene su límite oficial cargado, el punto debe caer dentro.
    IF limites_comuna IS NOT NULL THEN
        RETURN extensions.st_covers(limites_comuna, punto);
    END IF;

    -- PROVISORIO hasta cargar el límite oficial de La Serena: rectángulo
    -- amplio (incluye parte de Coquimbo). Debe coincidir con
    -- RECTANGULO_LA_SERENA en apps/web/src/lib/reportes/esquemas.ts.
    IF comuna = 4101 THEN
        RETURN extensions.st_x(punto::extensions.geometry) BETWEEN -71.40 AND -70.70
           AND extensions.st_y(punto::extensions.geometry) BETWEEN -30.10 AND -29.55;
    END IF;

    RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ubicacion_en_comuna(SMALLINT, extensions.geography)
    FROM PUBLIC, anon, authenticated;

-- Mismo trigger de 20261023013650_crear_reportes.sql; solo cambia la
-- validación de la ubicación, que ahora usa ubicacion_en_comuna.
CREATE OR REPLACE FUNCTION public.validar_nuevo_reporte() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    recientes INT;
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

    IF NOT public.ubicacion_en_comuna(NEW.comuna_id, NEW.ubicacion) THEN
        RAISE EXCEPTION 'La ubicación está fuera de la comuna.'
            USING ERRCODE = 'P0001', HINT = 'fuera_de_comuna';
    END IF;

    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- 4. Lista para administración: todos los estados de moderación, del
--    más reciente al más antiguo, 25 por página. Sin datos del autor.
--    Sin filtro de moderación se omiten los archivados.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.listar_reportes_admin(
    busqueda     TEXT DEFAULT NULL,
    moderaciones public.estado_moderacion[] DEFAULT NULL,
    estados      public.estado_reporte[] DEFAULT NULL,
    categoria    SMALLINT DEFAULT NULL,
    pagina       INT DEFAULT 1
)
RETURNS TABLE (
    id                   UUID,
    categoria_id         SMALLINT,
    titulo               VARCHAR(140),
    direccion_referencia VARCHAR(200),
    moderacion           public.estado_moderacion,
    estado               public.estado_reporte,
    creado_en            TIMESTAMPTZ,
    actualizado_en       TIMESTAMPTZ,
    fotos                INT,
    total                BIGINT       -- reportes que cumplen los filtros
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    por_pagina CONSTANT INT := 25;
    texto TEXT := lower(NULLIF(btrim(busqueda), ''));
BEGIN
    PERFORM public.exigir_admin();

    IF char_length(texto) > 100 THEN
        RAISE EXCEPTION 'La búsqueda puede tener hasta 100 caracteres.'
            USING ERRCODE = 'P0001', HINT = 'busqueda_invalida';
    END IF;
    IF pagina IS NULL OR pagina NOT BETWEEN 1 AND 10000 THEN
        RAISE EXCEPTION 'Página no válida.'
            USING ERRCODE = 'P0001', HINT = 'pagina_invalida';
    END IF;

    -- strpos en vez de LIKE: el texto buscado no tiene comodines.
    RETURN QUERY
    SELECT r.id, r.categoria_id, r.titulo, r.direccion_referencia,
           r.moderacion, r.estado, r.creado_en, r.actualizado_en,
           (SELECT count(*)::INT
            FROM public.reporte_fotos f
            WHERE f.reporte_id = r.id),
           count(*) OVER ()
    FROM public.reportes r
    WHERE (texto IS NULL
           OR strpos(lower(r.titulo), texto) > 0
           OR strpos(lower(COALESCE(r.descripcion, '')), texto) > 0
           OR strpos(lower(COALESCE(r.direccion_referencia, '')), texto) > 0)
      AND (CASE WHEN moderaciones IS NULL
                THEN r.moderacion <> 'archivado'
                ELSE r.moderacion = ANY (moderaciones) END)
      AND (estados IS NULL OR r.estado = ANY (estados))
      AND (categoria IS NULL OR r.categoria_id = categoria)
    ORDER BY r.creado_en DESC, r.id
    LIMIT por_pagina
    OFFSET (pagina - 1) * por_pagina;
END;
$$;

-- Un reporte para el formulario de edición. actualizado_en sirve de
-- versión: editar_reporte la exige para no pisar cambios ajenos.
CREATE FUNCTION public.obtener_reporte_admin(reporte UUID)
RETURNS TABLE (
    id                   UUID,
    categoria_id         SMALLINT,
    titulo               VARCHAR(140),
    descripcion          TEXT,
    direccion_referencia VARCHAR(200),
    moderacion           public.estado_moderacion,
    estado               public.estado_reporte,
    creado_en            TIMESTAMPTZ,
    actualizado_en       TIMESTAMPTZ,
    latitud              DOUBLE PRECISION,
    longitud             DOUBLE PRECISION,
    fotos                INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM public.exigir_admin();

    RETURN QUERY
    SELECT r.id, r.categoria_id, r.titulo, r.descripcion,
           r.direccion_referencia, r.moderacion, r.estado, r.creado_en,
           r.actualizado_en,
           extensions.st_y(r.ubicacion::extensions.geometry),
           extensions.st_x(r.ubicacion::extensions.geometry),
           (SELECT count(*)::INT
            FROM public.reporte_fotos f
            WHERE f.reporte_id = r.id)
    FROM public.reportes r
    WHERE r.id = reporte;
END;
$$;

-- ---------------------------------------------------------------------
-- 5. Editar. Los parámetros llevan prefijo (nuevo_, nueva_) para no
--    confundirse con las columnas en PL/pgSQL.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.editar_reporte(
    reporte           UUID,
    version           TIMESTAMPTZ,
    nuevo_titulo      TEXT,
    nueva_descripcion TEXT,
    nueva_categoria   SMALLINT,
    nueva_referencia  TEXT,
    nueva_latitud     DOUBLE PRECISION,
    nueva_longitud    DOUBLE PRECISION,
    nuevo_estado      public.estado_reporte
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    actual      public.reportes%ROWTYPE;
    limpio_titulo      TEXT := btrim(nuevo_titulo);
    limpia_descripcion TEXT := NULLIF(btrim(nueva_descripcion), '');
    limpia_referencia  TEXT := NULLIF(btrim(nueva_referencia), '');
    punto              extensions.geography;
    cambios            JSONB := '{}';
BEGIN
    PERFORM public.exigir_admin();

    -- Mismos límites que los CHECK de reportes y que la app.
    IF limpio_titulo IS NULL OR char_length(limpio_titulo) NOT BETWEEN 5 AND 140 THEN
        RAISE EXCEPTION 'El título debe tener entre 5 y 140 caracteres.'
            USING ERRCODE = 'P0001', HINT = 'titulo_invalido';
    END IF;
    IF char_length(limpia_descripcion) > 1000 THEN
        RAISE EXCEPTION 'La descripción puede tener hasta 1000 caracteres.'
            USING ERRCODE = 'P0001', HINT = 'descripcion_invalida';
    END IF;
    IF char_length(limpia_referencia) > 200 THEN
        RAISE EXCEPTION 'La referencia puede tener hasta 200 caracteres.'
            USING ERRCODE = 'P0001', HINT = 'referencia_invalida';
    END IF;
    -- 'rechazado' no se usa como estado del problema (ver
    -- cambiar_estado_reporte).
    IF nuevo_estado IS NULL OR nuevo_estado = 'rechazado' THEN
        RAISE EXCEPTION 'Estado no válido.'
            USING ERRCODE = 'P0001', HINT = 'estado_invalido';
    END IF;
    IF nueva_latitud IS NULL OR nueva_longitud IS NULL
       OR nueva_latitud NOT BETWEEN -90 AND 90
       OR nueva_longitud NOT BETWEEN -180 AND 180 THEN
        RAISE EXCEPTION 'La ubicación no es válida.'
            USING ERRCODE = 'P0001', HINT = 'fuera_de_comuna';
    END IF;
    punto := extensions.st_setsrid(
        extensions.st_makepoint(nueva_longitud, nueva_latitud), 4326
    )::extensions.geography;

    SELECT * INTO actual
    FROM public.reportes r
    WHERE r.id = reporte
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El reporte no existe.'
            USING ERRCODE = 'P0001', HINT = 'no_existe';
    END IF;
    IF version IS NULL OR actual.actualizado_en <> version THEN
        RAISE EXCEPTION 'El reporte cambió mientras lo editabas.'
            USING ERRCODE = 'P0001', HINT = 'modificado';
    END IF;

    -- Una categoría de reportes y activa. Se acepta dejar la actual
    -- aunque se haya desactivado.
    IF nueva_categoria IS DISTINCT FROM actual.categoria_id AND NOT EXISTS (
        SELECT 1
        FROM public.categorias c
        WHERE c.id = nueva_categoria AND c.tipo = 'reporte' AND c.activa
    ) THEN
        RAISE EXCEPTION 'Elige una categoría de la lista.'
            USING ERRCODE = 'P0001', HINT = 'categoria_invalida';
    END IF;

    -- Un movimiento de menos de medio metro no cuenta como cambio (el mapa
    -- devuelve el centro con su propia precisión).
    IF extensions.st_dwithin(actual.ubicacion, punto, 0.5) THEN
        punto := actual.ubicacion;
    ELSIF NOT public.ubicacion_en_comuna(actual.comuna_id, punto) THEN
        RAISE EXCEPTION 'La ubicación está fuera de la comuna.'
            USING ERRCODE = 'P0001', HINT = 'fuera_de_comuna';
    ELSE
        cambios := cambios || jsonb_build_object('ubicacion', jsonb_build_object(
            'antes', jsonb_build_object(
                'lat', extensions.st_y(actual.ubicacion::extensions.geometry),
                'lng', extensions.st_x(actual.ubicacion::extensions.geometry)),
            'despues', jsonb_build_object(
                'lat', nueva_latitud,
                'lng', nueva_longitud)));
    END IF;

    IF limpio_titulo IS DISTINCT FROM actual.titulo THEN
        cambios := cambios || '{"titulo": true}';
    END IF;
    IF limpia_descripcion IS DISTINCT FROM actual.descripcion THEN
        cambios := cambios || '{"descripcion": true}';
    END IF;
    IF limpia_referencia IS DISTINCT FROM actual.direccion_referencia THEN
        cambios := cambios || '{"direccion_referencia": true}';
    END IF;
    IF nueva_categoria IS DISTINCT FROM actual.categoria_id THEN
        cambios := cambios || jsonb_build_object('categoria_id', jsonb_build_object(
            'antes', actual.categoria_id, 'despues', nueva_categoria));
    END IF;
    IF nuevo_estado IS DISTINCT FROM actual.estado THEN
        cambios := cambios || jsonb_build_object('estado', jsonb_build_object(
            'antes', actual.estado, 'despues', nuevo_estado));
    END IF;

    -- Sin cambios no se toca la fila ni se registra nada.
    IF cambios = '{}' THEN
        RETURN;
    END IF;

    UPDATE public.reportes r
    SET titulo = limpio_titulo,
        descripcion = limpia_descripcion,
        direccion_referencia = limpia_referencia,
        categoria_id = nueva_categoria,
        ubicacion = punto,
        estado = nuevo_estado,
        resuelto_en = CASE
            WHEN nuevo_estado <> 'resuelto' THEN NULL
            WHEN actual.estado = 'resuelto' THEN actual.resuelto_en
            ELSE now()
        END
    WHERE r.id = reporte;

    INSERT INTO public.reporte_historial (
        reporte_id, accion, estado_anterior, estado_nuevo,
        moderacion_anterior, moderacion_nueva, cambiado_por, cambios
    ) VALUES (
        reporte, 'editar', actual.estado, nuevo_estado,
        actual.moderacion, actual.moderacion, (SELECT auth.uid()), cambios
    );
END;
$$;

-- ---------------------------------------------------------------------
-- 6. Archivar y restaurar. Restaurar vuelve al estado de moderación que
--    tenía al archivarse (último 'archivar' del historial).
-- ---------------------------------------------------------------------
CREATE FUNCTION public.archivar_reporte(reporte UUID) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    moderacion_actual public.estado_moderacion;
BEGIN
    PERFORM public.exigir_admin();

    SELECT r.moderacion INTO moderacion_actual
    FROM public.reportes r
    WHERE r.id = reporte
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El reporte no existe.'
            USING ERRCODE = 'P0001', HINT = 'no_existe';
    END IF;
    IF moderacion_actual = 'archivado' THEN
        RAISE EXCEPTION 'El reporte ya está archivado.'
            USING ERRCODE = 'P0001', HINT = 'ya_archivado';
    END IF;

    PERFORM public.moderar_reporte(
        reporte, moderacion_actual, 'archivado', 'archivar', NULL
    );
END;
$$;

CREATE FUNCTION public.restaurar_reporte(reporte UUID) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    destino public.estado_moderacion;
BEGIN
    PERFORM public.exigir_admin();

    PERFORM 1
    FROM public.reportes r
    WHERE r.id = reporte AND r.moderacion = 'archivado'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El reporte no existe o no está archivado.'
            USING ERRCODE = 'P0001', HINT = 'no_archivado';
    END IF;

    SELECT h.moderacion_anterior INTO destino
    FROM public.reporte_historial h
    WHERE h.reporte_id = reporte AND h.accion = 'archivar'
    ORDER BY h.creado_en DESC, h.id DESC
    LIMIT 1;

    -- Sin registro (no debería pasar), vuelve a revisión.
    PERFORM public.moderar_reporte(
        reporte, 'archivado', COALESCE(destino, 'pendiente'), 'restaurar', NULL
    );
END;
$$;

-- ---------------------------------------------------------------------
-- 7. Eliminaciones: registro que sobrevive al reporte. Sin título,
--    descripción, ubicación, autor ni fotos: si se elimina por datos
--    personales, una copia anularía el borrado. Cerrada para anon y
--    authenticated; por ahora se consulta en el SQL Editor.
-- ---------------------------------------------------------------------
CREATE TABLE public.reportes_eliminados (
    id                     BIGSERIAL PRIMARY KEY,
    reporte_id             UUID        NOT NULL UNIQUE,  -- sin FK: ya no existe
    eliminado_por          UUID        REFERENCES public.perfiles(id) ON DELETE SET NULL,
    eliminado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
    motivo                 TEXT        NOT NULL CHECK (char_length(motivo) BETWEEN 5 AND 500),
    categoria_id           SMALLINT    NOT NULL,
    comuna_id              SMALLINT    NOT NULL,
    moderacion             public.estado_moderacion NOT NULL,
    estado                 public.estado_reporte    NOT NULL,
    reporte_creado_en      TIMESTAMPTZ NOT NULL,
    reporte_actualizado_en TIMESTAMPTZ NOT NULL,
    fotos                  INT         NOT NULL,   -- registradas en reporte_fotos
    archivos               INT         NOT NULL,   -- archivos en Storage por borrar
    filas_historial        INT         NOT NULL
);

ALTER TABLE public.reportes_eliminados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reportes_eliminados FROM anon, authenticated;

-- Borra el reporte (y en cascada sus fotos registradas, historial,
-- apoyos y comentarios), deja el registro y devuelve las rutas de los
-- archivos que quedan en Storage bajo su carpeta (incluidos los que no
-- llegaron a registrarse). La app los borra después con la sesión del
-- admin; la política de Storage solo lo permite una vez borrado el
-- reporte.
CREATE FUNCTION public.eliminar_reporte(reporte UUID, motivo TEXT)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    actual public.reportes%ROWTYPE;
    nota   TEXT;
    rutas  TEXT[];
BEGIN
    PERFORM public.exigir_admin();
    nota := public.validar_nota_moderacion(motivo, TRUE);

    SELECT * INTO actual
    FROM public.reportes r
    WHERE r.id = reporte
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El reporte no existe.'
            USING ERRCODE = 'P0001', HINT = 'no_existe';
    END IF;

    SELECT COALESCE(array_agg(o.name ORDER BY o.name), '{}') INTO rutas
    FROM storage.objects o
    WHERE o.bucket_id = 'reportes-fotos'
      AND (storage.foldername(o.name))[2] = reporte::TEXT;

    INSERT INTO public.reportes_eliminados (
        reporte_id, eliminado_por, motivo, categoria_id, comuna_id,
        moderacion, estado, reporte_creado_en, reporte_actualizado_en,
        fotos, archivos, filas_historial
    ) VALUES (
        reporte, (SELECT auth.uid()), nota, actual.categoria_id,
        actual.comuna_id, actual.moderacion, actual.estado,
        actual.creado_en, actual.actualizado_en,
        (SELECT count(*) FROM public.reporte_fotos f WHERE f.reporte_id = reporte),
        cardinality(rutas),
        (SELECT count(*) FROM public.reporte_historial h WHERE h.reporte_id = reporte)
    );

    DELETE FROM public.reportes r WHERE r.id = reporte;

    RETURN rutas;
END;
$$;

-- Solo usuarios con sesión; el rol se verifica dentro de cada función.
REVOKE EXECUTE ON FUNCTION public.listar_reportes_admin(TEXT, public.estado_moderacion[], public.estado_reporte[], SMALLINT, INT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.obtener_reporte_admin(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.editar_reporte(UUID, TIMESTAMPTZ, TEXT, TEXT, SMALLINT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, public.estado_reporte) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.archivar_reporte(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.restaurar_reporte(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.eliminar_reporte(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_reportes_admin(TEXT, public.estado_moderacion[], public.estado_reporte[], SMALLINT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_reporte_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.editar_reporte(UUID, TIMESTAMPTZ, TEXT, TEXT, SMALLINT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, public.estado_reporte) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archivar_reporte(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restaurar_reporte(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.eliminar_reporte(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------
-- 8. Storage: solo un admin borra archivos, y solo de reportes que ya
--    no existen (después de eliminar_reporte). Así ni un admin puede
--    romper desde la API las fotos de un reporte vigente.
--    SECURITY DEFINER: la política se evalúa con el rol de quien borra,
--    que no puede leer la tabla reportes completa.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.admin_puede_borrar_archivo(nombre TEXT) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT public.es_admin()
       AND NOT EXISTS (
           SELECT 1
           FROM public.reportes r
           WHERE r.id::TEXT = (storage.foldername(nombre))[2]
       );
$$;

REVOKE EXECUTE ON FUNCTION public.admin_puede_borrar_archivo(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_puede_borrar_archivo(TEXT) TO authenticated;

-- La API de Storage borra con DELETE ... RETURNING, que además exige
-- poder leer el archivo: los admins ya pueden ("moderación lee todas").
CREATE POLICY "reportes-fotos: admin borra archivos de reportes eliminados" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'reportes-fotos'
        AND public.admin_puede_borrar_archivo(name)
    );
