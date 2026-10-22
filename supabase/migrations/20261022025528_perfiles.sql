-- =====================================================================
-- Reemplaza usuarios (con password_hash propio) por perfiles ligados a
-- Supabase Auth. Las credenciales y el email viven en auth.users.
-- Pendiente antes del lanzamiento: evidencia de consentimiento
-- (términos y privacidad, Ley 21.719) en una migración propia.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Quitar las llaves foráneas que apuntan a usuarios
--    (nombres confirmados en la base con pg_constraint)
-- ---------------------------------------------------------------------
ALTER TABLE dispositivos      DROP CONSTRAINT dispositivos_usuario_id_fkey;
ALTER TABLE reportes          DROP CONSTRAINT reportes_usuario_id_fkey;
ALTER TABLE reporte_apoyos    DROP CONSTRAINT reporte_apoyos_usuario_id_fkey;
ALTER TABLE reporte_historial DROP CONSTRAINT reporte_historial_cambiado_por_fkey;
ALTER TABLE comentarios       DROP CONSTRAINT comentarios_usuario_id_fkey;
ALTER TABLE obras             DROP CONSTRAINT obras_creado_por_fkey;
ALTER TABLE suscripciones     DROP CONSTRAINT suscripciones_usuario_id_fkey;
ALTER TABLE notificaciones    DROP CONSTRAINT notificaciones_usuario_id_fkey;

-- Sin CASCADE: si quedara algo dependiendo de usuarios, la migración falla.
DROP TABLE usuarios;

-- ---------------------------------------------------------------------
-- 2. Perfiles
-- ---------------------------------------------------------------------
CREATE TABLE perfiles (
    id              UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre_visible  VARCHAR(50)  CHECK (
                        nombre_visible IS NULL
                        OR (char_length(nombre_visible) >= 2
                            AND nombre_visible = btrim(nombre_visible))
                    ),
    rol             rol_usuario  NOT NULL DEFAULT 'ciudadano',
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_perfiles_actualizado BEFORE UPDATE ON perfiles
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();

-- ---------------------------------------------------------------------
-- 3. Volver a crear las llaves foráneas, ahora hacia perfiles
-- ---------------------------------------------------------------------
ALTER TABLE dispositivos ADD CONSTRAINT dispositivos_usuario_id_fkey
    FOREIGN KEY (usuario_id) REFERENCES perfiles(id) ON DELETE CASCADE;
ALTER TABLE reportes ADD CONSTRAINT reportes_usuario_id_fkey
    FOREIGN KEY (usuario_id) REFERENCES perfiles(id) ON DELETE SET NULL;
ALTER TABLE reporte_apoyos ADD CONSTRAINT reporte_apoyos_usuario_id_fkey
    FOREIGN KEY (usuario_id) REFERENCES perfiles(id) ON DELETE CASCADE;
ALTER TABLE reporte_historial ADD CONSTRAINT reporte_historial_cambiado_por_fkey
    FOREIGN KEY (cambiado_por) REFERENCES perfiles(id) ON DELETE SET NULL;
ALTER TABLE comentarios ADD CONSTRAINT comentarios_usuario_id_fkey
    FOREIGN KEY (usuario_id) REFERENCES perfiles(id) ON DELETE SET NULL;
ALTER TABLE obras ADD CONSTRAINT obras_creado_por_fkey
    FOREIGN KEY (creado_por) REFERENCES perfiles(id) ON DELETE SET NULL;
ALTER TABLE suscripciones ADD CONSTRAINT suscripciones_usuario_id_fkey
    FOREIGN KEY (usuario_id) REFERENCES perfiles(id) ON DELETE CASCADE;
ALTER TABLE notificaciones ADD CONSTRAINT notificaciones_usuario_id_fkey
    FOREIGN KEY (usuario_id) REFERENCES perfiles(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------
-- 4. Crear el perfil al registrarse
--    Solo se inserta el id: no se usan metadatos enviados por el cliente,
--    para que nadie pueda asignarse un rol al registrarse.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.crear_perfil_al_registrarse() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.perfiles (id) VALUES (NEW.id);
    RETURN NEW;
END;
$$;

-- Solo la usa el trigger; no debe poder llamarse desde la API.
REVOKE EXECUTE ON FUNCTION public.crear_perfil_al_registrarse() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_crear_perfil AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.crear_perfil_al_registrarse();

-- Perfiles para cuentas que ya existieran antes de esta migración.
INSERT INTO perfiles (id) SELECT id FROM auth.users ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5. RLS y permisos: cada persona lee y edita solo su perfil.
--    El rol no se puede cambiar: authenticated solo puede actualizar
--    la columna nombre_visible (permiso por columna).
-- ---------------------------------------------------------------------
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perfiles: lectura del propio perfil" ON perfiles
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = id);

CREATE POLICY "perfiles: edición del propio perfil" ON perfiles
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = id)
    WITH CHECK ((SELECT auth.uid()) = id);

REVOKE ALL ON perfiles FROM anon, authenticated;
GRANT SELECT ON perfiles TO authenticated;
GRANT UPDATE (nombre_visible) ON perfiles TO authenticated;

-- ---------------------------------------------------------------------
-- 6. Advertencia del linter: search_path fijo en set_actualizado_en
--    (solo usa now(), que está en pg_catalog)
-- ---------------------------------------------------------------------
ALTER FUNCTION public.set_actualizado_en() SET search_path = '';
