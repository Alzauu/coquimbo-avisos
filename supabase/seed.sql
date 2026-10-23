-- =====================================================================
-- Datos de ejemplo para desarrollo. Son ficticios y las ubicaciones en
-- La Serena son aproximadas. Ningún reporte tiene autor (usuario_id NULL).
--
-- 18 reportes:
--   ...01 a ...13  aprobados: deben verse en el mapa.
--   ...14 a ...17  pendientes de moderación: NO deben verse.
--   ...18          oculto por moderación: NO debe verse.
-- apps/web/tests/rls usa estos ids para comprobar qué ve anon.
-- Categorías: códigos de 20261023230000_categorias_reportes.sql (los dos
-- ejemplos de semáforo quedaron en Calles, como hizo esa migración).
--
-- Se puede ejecutar varias veces: los ids son fijos y se ignoran los
-- que ya existan. Se carga a mano en el SQL Editor de Supabase.
-- =====================================================================

INSERT INTO public.reportes (
    id, usuario_id, categoria_id, comuna_id, titulo, descripcion,
    ubicacion, direccion_referencia, estado, moderacion, creado_en, resuelto_en
)
SELECT d.id::uuid,
       NULL,
       c.id,
       4101,   -- La Serena
       d.titulo,
       d.descripcion,
       extensions.st_setsrid(
           extensions.st_makepoint(d.lng::float8, d.lat::float8), 4326
       )::extensions.geography,
       d.direccion,
       d.estado::public.estado_reporte,
       d.moderacion::public.estado_moderacion,
       now() - make_interval(days => d.dias_creado),
       CASE WHEN d.dias_resuelto IS NOT NULL
            THEN now() - make_interval(days => d.dias_resuelto)
       END
FROM (VALUES
    -- Aprobados (visibles)
    ('5eed0000-0000-4000-8000-000000000001', 'calles',
     'Bache profundo en la calzada',
     'Hoyo de unos 40 cm en la pista derecha; los autos lo esquivan de golpe.',
     'Av. Francisco de Aguirre, sector centro', -71.2585, -29.9046,
     'recibido', 'aprobado', 2, NULL),
    ('5eed0000-0000-4000-8000-000000000002', 'iluminacion',
     'Poste sin luz frente a la plaza',
     'La luminaria de la esquina lleva una semana apagada.',
     'Plaza de Armas, costado norte', -71.2518, -29.9022,
     'en_revision', 'aprobado', 6, NULL),
    ('5eed0000-0000-4000-8000-000000000003', 'basura',
     'Microbasural en sitio eriazo',
     'Escombros y bolsas de basura acumulados desde hace semanas.',
     'Las Compañías, sector norte', -71.2440, -29.8790,
     'derivado', 'aprobado', 10, NULL),
    ('5eed0000-0000-4000-8000-000000000004', 'calles',
     'Semáforo intermitente en hora punta',
     'El semáforo queda en amarillo intermitente por las tardes.',
     'Av. Balmaceda, sector centro', -71.2470, -29.9065,
     'resuelto', 'aprobado', 20, 3),
    ('5eed0000-0000-4000-8000-000000000005', 'alcantarillado',
     'Filtración de agua en la vereda',
     'Sale agua limpia desde la vereda hace dos días.',
     'Sector La Florida', -71.2240, -29.9190,
     'recibido', 'aprobado', 1, NULL),
    ('5eed0000-0000-4000-8000-000000000006', 'areas_verdes',
     'Juegos infantiles rotos',
     'Columpio cortado y resbalín con bordes filosos.',
     'Parque Pedro de Valdivia', -71.2505, -29.9112,
     'en_revision', 'aprobado', 5, NULL),
    ('5eed0000-0000-4000-8000-000000000007', 'vehiculos',
     'Auto abandonado hace meses',
     'Vehículo sin ruedas estacionado en la misma esquina desde hace meses.',
     'Sector San Joaquín', -71.2365, -29.9105,
     'derivado', 'aprobado', 15, NULL),
    ('5eed0000-0000-4000-8000-000000000008', 'otros',
     'Tapa de cámara suelta',
     'La tapa se mueve al pisarla y puede causar caídas.',
     'Av. del Mar, cerca del Faro Monumental', -71.2738, -29.9065,
     'recibido', 'aprobado', 3, NULL),
    ('5eed0000-0000-4000-8000-000000000009', 'calles',
     'Calzada hundida',
     'Hundimiento de la pista lenta después de la lluvia.',
     'Av. del Mar, sector Cuatro Esquinas', -71.2770, -29.9240,
     'en_revision', 'aprobado', 8, NULL),
    ('5eed0000-0000-4000-8000-000000000010', 'iluminacion',
     'Pasaje a oscuras',
     'Tres luminarias seguidas apagadas en el pasaje.',
     'Las Compañías, sector sur', -71.2490, -29.8880,
     'resuelto', 'aprobado', 25, 5),
    ('5eed0000-0000-4000-8000-000000000011', 'basura',
     'Contenedores desbordados',
     'Los contenedores no se vacían desde el fin de semana.',
     'Sector Cerro Grande', -71.2190, -29.9320,
     'recibido', 'aprobado', 1, NULL),
    ('5eed0000-0000-4000-8000-000000000012', 'areas_verdes',
     'Riego roto en el bandejón',
     'Un aspersor roto pierde agua todo el día.',
     'Av. Estadio', -71.2560, -29.9180,
     'derivado', 'aprobado', 12, NULL),
    ('5eed0000-0000-4000-8000-000000000013', 'calles',
     'Señal PARE caída',
     'El disco PARE está en el suelo desde el temporal.',
     'Sector Universidad de La Serena', -71.2420, -29.9100,
     'en_revision', 'aprobado', 4, NULL),

    -- Pendientes de moderación (NO deben verse)
    ('5eed0000-0000-4000-8000-000000000014', 'calles',
     'Bache en la esquina',
     'Ejemplo pendiente de moderación: no debe verse en el mapa.',
     'Sector centro', -71.2540, -29.9000,
     'recibido', 'pendiente', 0, NULL),
    ('5eed0000-0000-4000-8000-000000000015', 'iluminacion',
     'Luminaria parpadeando',
     'Ejemplo pendiente de moderación: no debe verse en el mapa.',
     'Sector La Florida', -71.2300, -29.9150,
     'recibido', 'pendiente', 1, NULL),
    ('5eed0000-0000-4000-8000-000000000016', 'basura',
     'Basura en la plazoleta',
     'Ejemplo pendiente de moderación: no debe verse en el mapa.',
     'Las Compañías', -71.2450, -29.8830,
     'recibido', 'pendiente', 0, NULL),
    ('5eed0000-0000-4000-8000-000000000017', 'otros',
     'Rejilla de desagüe tapada',
     'Ejemplo pendiente de moderación: no debe verse en el mapa.',
     'Sector Avenida del Mar', -71.2650, -29.9120,
     'recibido', 'pendiente', 2, NULL),

    -- Oculto por moderación (NO debe verse)
    ('5eed0000-0000-4000-8000-000000000018', 'vehiculos',
     'Camioneta abandonada',
     'Ejemplo oculto por moderación (la foto mostraba la patente): no debe verse.',
     'Sector centro oriente', -71.2400, -29.9050,
     'en_revision', 'oculto', 9, NULL)
) AS d (id, categoria, titulo, descripcion, direccion, lng, lat,
        estado, moderacion, dias_creado, dias_resuelto)
JOIN public.categorias c ON c.tipo = 'reporte' AND c.codigo = d.categoria
ON CONFLICT (id) DO NOTHING;
