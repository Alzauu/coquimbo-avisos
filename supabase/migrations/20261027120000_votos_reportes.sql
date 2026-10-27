-- =====================================================================
-- Votos «Me afecta» / «No me afecta» en reportes públicos.
-- - Un voto por usuario y reporte: se puede cambiar o quitar.
-- - El autor no vota sus propios reportes.
-- - Solo se votan reportes públicos: aprobados, no rechazados y de una
--   comuna activa. La condición es explícita en votar_reporte, también
--   para moderadores y admins.
-- - Solo se vota con votar_reporte: nadie escribe en las tablas de votos
--   desde la API. Límite de 60 votos por hora por usuario.
-- - Los totales viven en su propia tabla, mantenida por un trigger, y no
--   en reportes: así un voto no cambia reportes.actualizado_en, que
--   editar_reporte usa para detectar ediciones simultáneas.
-- - Nadie lee votos ajenos; lo público son solo los totales.
-- - Los votos solo informan: no cambian el orden, la visibilidad ni el
--   estado de un reporte. Nada en la base lee los totales para decidir.
-- - Reemplaza a reporte_apoyos, que nunca se usó.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Quitar reporte_apoyos
--    Sin CASCADE: si algo dependiera de ella, la migración falla.
-- ---------------------------------------------------------------------
DROP TABLE reporte_apoyos;

-- ---------------------------------------------------------------------
-- 2. Tablas
--    valor: 1 = me afecta, -1 = no me afecta.
--    Borrar el reporte, o la cuenta (auth.users -> perfiles), borra sus
--    votos en cascada y el trigger descuenta los totales.
-- ---------------------------------------------------------------------
CREATE TABLE reporte_votos (
    reporte_id      UUID        NOT NULL REFERENCES reportes(id) ON DELETE CASCADE,
    usuario_id      UUID        NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
    valor           SMALLINT    NOT NULL CHECK (valor IN (1, -1)),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (reporte_id, usuario_id)
);
CREATE INDEX idx_reporte_votos_usuario ON reporte_votos(usuario_id);
CREATE TRIGGER trg_reporte_votos_actualizado BEFORE UPDATE ON reporte_votos
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();

CREATE TABLE reporte_votos_totales (
    reporte_id    UUID PRIMARY KEY REFERENCES reportes(id) ON DELETE CASCADE,
    me_afecta     INT  NOT NULL DEFAULT 0 CHECK (me_afecta >= 0),
    no_me_afecta  INT  NOT NULL DEFAULT 0 CHECK (no_me_afecta >= 0)
);

-- Ventana fija de una hora por usuario para el límite de frecuencia.
CREATE TABLE reporte_votos_limite (
    usuario_id      UUID        PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
    ventana_inicio  TIMESTAMPTZ NOT NULL,
    votos           INT         NOT NULL
);

ALTER TABLE reporte_votos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporte_votos_totales ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporte_votos_limite  ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 3. Permisos y políticas
--    Supabase concede todo a anon y authenticated en tablas nuevas; se
--    quita y se abre solo la lectura necesaria. Sin permisos de escritura
--    ni políticas de escritura: solo escriben las funciones SECURITY
--    DEFINER de abajo.
-- ---------------------------------------------------------------------
REVOKE ALL ON reporte_votos         FROM anon, authenticated;
REVOKE ALL ON reporte_votos_totales FROM anon, authenticated;
REVOKE ALL ON reporte_votos_limite  FROM anon, authenticated;

-- Cada usuario lee su propio voto (para marcar el botón). Sin usuario_id:
-- la política ya filtra por él.
GRANT SELECT (reporte_id, valor) ON reporte_votos TO authenticated;

CREATE POLICY "reporte_votos: cada usuario lee sus votos" ON reporte_votos
    FOR SELECT TO authenticated
    USING (usuario_id = (SELECT auth.uid()));

-- Totales: datos agregados. Se leen con la misma RLS que la vista
-- pública: solo los de reportes que quien consulta puede ver.
GRANT SELECT ON reporte_votos_totales TO anon, authenticated;

CREATE POLICY "reporte_votos_totales: lectura de reportes públicos" ON reporte_votos_totales
    FOR SELECT TO anon, authenticated
    USING (EXISTS (SELECT 1 FROM public.reportes r WHERE r.id = reporte_id));

-- reporte_votos_limite: sin permisos ni políticas; nadie la lee.

-- ---------------------------------------------------------------------
-- 4. Totales
--    Incrementos atómicos: UPDATE y el upsert bloquean la fila de
--    totales, así que votos simultáneos no se pisan.
--    Al borrar un voto se usa UPDATE (no upsert): si el reporte se está
--    borrando en cascada, su fila de totales puede haberse ido ya.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.actualizar_totales_votos() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        UPDATE public.reporte_votos_totales t
        SET me_afecta    = t.me_afecta    - (OLD.valor = 1)::INT,
            no_me_afecta = t.no_me_afecta - (OLD.valor = -1)::INT
        WHERE t.reporte_id = OLD.reporte_id;
    END IF;

    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        INSERT INTO public.reporte_votos_totales AS t
            (reporte_id, me_afecta, no_me_afecta)
        VALUES (NEW.reporte_id, (NEW.valor = 1)::INT, (NEW.valor = -1)::INT)
        ON CONFLICT (reporte_id) DO UPDATE
        SET me_afecta    = t.me_afecta    + EXCLUDED.me_afecta,
            no_me_afecta = t.no_me_afecta + EXCLUDED.no_me_afecta;
    END IF;

    RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.actualizar_totales_votos() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_reporte_votos_totales
    AFTER INSERT OR UPDATE OR DELETE ON reporte_votos
    FOR EACH ROW EXECUTE FUNCTION public.actualizar_totales_votos();

-- ---------------------------------------------------------------------
-- 5. ¿Es un reporte propio?
--    Para que la app no muestre los botones al autor.
--    SECURITY DEFINER: authenticated no puede leer reportes.usuario_id.
--    Solo dice sí o no para quien llama; no revela al autor.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.es_mi_reporte(reporte UUID) RETURNS BOOLEAN
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
    );
$$;

REVOKE EXECUTE ON FUNCTION public.es_mi_reporte(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.es_mi_reporte(UUID) TO authenticated;

-- ---------------------------------------------------------------------
-- 6. Votar
--    voto: 1, -1 o NULL para quitarlo. Es idempotente: la app envía el
--    voto deseado, no "alternar", para que un doble clic no lo deshaga.
--    SECURITY DEFINER: escribe en tablas cerradas a la API, así que todas
--    las reglas se revisan aquí, sin depender de la RLS ni del rol.
--    "Público" debe coincidir con la política "reportes: lectura pública
--    de aprobados" y con ruta_foto_publica.
--    FOR SHARE: moderación no puede ocultar el reporte entre la revisión
--    y el voto.
--    Un error deshace también el conteo del límite: solo cuentan los
--    votos que se guardan.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.votar_reporte(reporte UUID, voto SMALLINT)
RETURNS TABLE (me_afecta INT, no_me_afecta INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    yo       UUID := (SELECT auth.uid());
    publico  BOOLEAN;
    propio   BOOLEAN;
    votos_en_ventana INT;
BEGIN
    IF yo IS NULL THEN
        RAISE EXCEPTION 'Debes iniciar sesión para votar.'
            USING ERRCODE = 'P0001', HINT = 'sin_sesion';
    END IF;

    IF voto IS NOT NULL AND voto NOT IN (1, -1) THEN
        RAISE EXCEPTION 'El voto no es válido.'
            USING ERRCODE = 'P0001', HINT = 'voto_invalido';
    END IF;

    SELECT r.moderacion = 'aprobado' AND r.estado <> 'rechazado' AND c.activa,
           r.usuario_id IS NOT DISTINCT FROM yo
    INTO publico, propio
    FROM public.reportes r
    JOIN public.comunas c ON c.id = r.comuna_id
    WHERE r.id = reporte
    FOR SHARE OF r;

    IF NOT FOUND OR NOT COALESCE(publico, FALSE) THEN
        RAISE EXCEPTION 'El reporte no existe.'
            USING ERRCODE = 'P0001', HINT = 'no_existe';
    END IF;

    IF propio THEN
        RAISE EXCEPTION 'No puedes votar tu propio reporte.'
            USING ERRCODE = 'P0001', HINT = 'reporte_propio';
    END IF;

    -- Límite de frecuencia: el upsert bloquea la fila del usuario, así que
    -- votos simultáneos se cuentan de a uno.
    INSERT INTO public.reporte_votos_limite AS l (usuario_id, ventana_inicio, votos)
    VALUES (yo, now(), 1)
    ON CONFLICT (usuario_id) DO UPDATE
    SET ventana_inicio = CASE WHEN l.ventana_inicio <= now() - interval '1 hour'
                              THEN now() ELSE l.ventana_inicio END,
        votos          = CASE WHEN l.ventana_inicio <= now() - interval '1 hour'
                              THEN 1 ELSE l.votos + 1 END
    RETURNING l.votos INTO votos_en_ventana;

    IF votos_en_ventana > 60 THEN
        RAISE EXCEPTION 'Alcanzaste el límite de 60 votos por hora.'
            USING ERRCODE = 'P0001', HINT = 'limite_frecuencia';
    END IF;

    IF voto IS NULL THEN
        DELETE FROM public.reporte_votos v
        WHERE v.reporte_id = reporte
          AND v.usuario_id = yo;
    ELSE
        INSERT INTO public.reporte_votos AS v (reporte_id, usuario_id, valor)
        VALUES (reporte, yo, voto)
        ON CONFLICT (reporte_id, usuario_id) DO UPDATE
        SET valor = EXCLUDED.valor
        WHERE v.valor <> EXCLUDED.valor;
    END IF;

    RETURN QUERY
    SELECT COALESCE(t.me_afecta, 0), COALESCE(t.no_me_afecta, 0)
    FROM (SELECT 1) AS uno
    LEFT JOIN public.reporte_votos_totales t ON t.reporte_id = reporte;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.votar_reporte(UUID, SMALLINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.votar_reporte(UUID, SMALLINT) TO authenticated;

-- ---------------------------------------------------------------------
-- 7. Vista pública con los totales
--    Las columnas nuevas van al final (CREATE OR REPLACE solo permite
--    agregar). CREATE OR REPLACE conserva los permisos; se repiten igual
--    que en 20261022180306_reportes_publicos.sql para dejarlos a la vista.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_reportes_publicos WITH (security_invoker = true) AS
SELECT r.id, r.categoria_id, r.comuna_id, r.titulo, r.descripcion,
       r.direccion_referencia, r.estado, r.creado_en, r.resuelto_en,
       extensions.st_y(r.ubicacion::extensions.geometry) AS latitud,
       extensions.st_x(r.ubicacion::extensions.geometry) AS longitud,
       r.ubicacion,   -- para filtros espaciales con índice (ver reportes_en_zona)
       COALESCE(t.me_afecta, 0)    AS me_afecta,
       COALESCE(t.no_me_afecta, 0) AS no_me_afecta
FROM reportes r
LEFT JOIN reporte_votos_totales t ON t.reporte_id = r.id;

REVOKE ALL ON v_reportes_publicos FROM anon, authenticated;
GRANT SELECT ON v_reportes_publicos TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 8. reportes_en_zona con los totales
--    Se recrea porque cambia el tipo de retorno. Mismos atributos y
--    permisos que en 20261022180306_reportes_publicos.sql. El orden
--    sigue siendo por fecha: los votos no lo cambian.
-- ---------------------------------------------------------------------
DROP FUNCTION public.reportes_en_zona(
    DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION,
    SMALLINT[], public.estado_reporte[]
);

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
    longitud             DOUBLE PRECISION,
    me_afecta            INT,
    no_me_afecta         INT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT v.id, v.categoria_id, v.titulo, v.descripcion,
           v.direccion_referencia, v.estado, v.creado_en, v.resuelto_en,
           v.latitud, v.longitud, v.me_afecta, v.no_me_afecta
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
