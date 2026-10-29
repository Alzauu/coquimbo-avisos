# Plan de mejoras

Estado: **aprobado el 2026-10-28**. Ninguna fase iniciada.

Ideas incluidas: #1 Avísame en mi barrio, #4 aportes moderados, #5 detectar
duplicados al reportar, #6 "¿Sigue ahí?" a los 30 días, #7 reporteros de
confianza, #8 borrador sin señal y #9 compartir por WhatsApp con imagen.

## Resumen ejecutivo

1. La base ya tiene las tablas `comentarios`, `suscripciones`,
   `notificaciones` y `dispositivos`, con RLS activada pero sin políticas ni
   pantallas. Las 7 ideas las reutilizan; no hacen falta tablas grandes nuevas.
2. Hay cuatro piezas compartidas: cercanía con `ST_DWithin` (#5, #6, #1), una
   tabla de aportes (#4, #6), avisos pendientes de envío con Web Push (#1, #6) y
   la regla de confianza (#7, #4).
3. La fase 1 (#5 y #9, 2 o 3 días) no necesita dependencias nuevas, ni service
   worker, ni decisiones pendientes.
4. La única dependencia nueva de todo el plan es `web-push`, en la fase 7. El
   service worker y el manifest también llegan recién en esa fase.
5. Son unas 85 a 120 h en 7 fases, con una pausa de revisión después de la
   fase 4. #4 no se publica sin consentimiento registrado y supresión de cuenta.

## Hallazgos del código que condicionan el diseño

- Mientras se suben las fotos, el reporte debe estar `pendiente`
  (`puede_subir_foto_reporte`, `puede_registrar_foto`), y la política de
  inserción exige `moderacion = 'pendiente'`. Por eso #7 publica al final de
  `crearReporte`, y no al insertar.
- `crearReporte` genera el id en el servidor (`randomUUID`). En #8 conviene
  generarlo en el navegador, para que reenviar no duplique el reporte.
- ESLint limita `service_role` a `src/app/fotos/[id]/route.ts`. El envío de push
  respeta esa regla (ver "Envío de push: endurecimiento").
- No hay `manifest` ni `sw.js`. Desde el teléfono se prueba en
  `http://192.168.1.10`, donde un service worker no se registra porque exige
  HTTPS o localhost. Para probar push hay que usar un preview de Vercel.
- Las fotos se guardan en `<usuario>/<reporte>/<uuid>.webp`, así que la ruta
  lleva el id del autor. Esto importa para la supresión de cuenta.
- Playwright no está instalado. Las pruebas de RLS (`pnpm test:rls`) sí
  existen y son el patrón a seguir.

## Decisiones tomadas

- **#6:** las respuestas de la comunidad solo marcan un reporte como
  "posiblemente resuelto"; **moderación confirma el cierre** con
  `cambiar_estado_reporte('resuelto')`. No hay cierre automático.
- **#7:** los reportes **con fotos siempre pasan por la cola**, aunque sean de
  un reportero de confianza.
- **Fase 2:** antes de publicar #4 debe estar listo el registro de
  consentimiento y la supresión de cuenta, que borra también los aportes de la
  persona.

## Supuestos

Se pueden cambiar; si alguno no calza, se ajusta la fase que lo usa.

- **S1.** El envío de push no usa `service_role`. Lo hace una función con su
  propio secreto (detalle más abajo).
- **S2.** Ante el público, los aportes aparecen como "Vecino/a", sin nombre.
- **S3.** Radios: 75 m para duplicados (con ajuste por categoría) y 300, 500 o
  1000 m para zonas. Máximo 3 zonas por persona.
- **S4.** Push: máximo 5 al día por persona, y ninguno entre las 22:00 y las
  08:00 (America/Santiago). Lo que no se envía queda solo en la bandeja.
- **S5.** "¿Sigue ahí?" por push: al autor, siempre; a quienes votaron "Me
  afecta", solo si activaron esa preferencia.
- **S6.** Los 30 días de #6 se cuentan desde `creado_en`.
- **S7.** Este plan no envía correos.
- **S8.** Al eliminar una cuenta, los reportes publicados se conservan
  anonimizados y **sin fotos**; los pendientes se borran.
- **S9.** El registro de consentimiento se borra junto con la cuenta. Conviene
  confirmarlo con asesoría legal.

---

## #1 "Avísame en mi barrio"

Se divide en **1a** (zonas y bandeja dentro de la app, fase 6) y **1b** (Web
Push, fase 7).

**Alcance mínimo**

- 1a:
  - En Perfil, "Mis zonas": hasta 3, cada una con un punto en el mapa
    (reutiliza `MapaPunto` y el selector de `/reportar`), un nombre opcional y
    un radio de 300, 500 o 1000 m.
  - Cuando un reporte pasa a `aprobado`, por cualquier camino, se avisa a cada
    persona cuya zona lo cubre.
  - `/avisos` con la lista y la opción de marcar como leído, más un contador en
    el menú.
- 1b:
  - Botón "Activar avisos en este teléfono" y registro del dispositivo.
  - Envío por Web Push con horario silencioso y tope diario.
- Queda afuera: filtro por categoría, correo, avisos según la ubicación actual,
  avisos de obras y de cortes.

**Base de datos**

- Reutiliza `suscripciones`:
  - Se agregan `centro extensions.geography(Point,4326)`,
    `radio_m SMALLINT CHECK (radio_m IN (300,500,1000))`, `nombre VARCHAR(30)` y
    un índice GIST sobre `centro`.
  - Se reemplaza `uq_suscripciones`, que hoy impide tener dos zonas en la misma
    comuna.
  - El punto se guarda redondeado a unos 100 m y se valida con
    `ubicacion_en_comuna`.
- Funciones `guardar_zona`, `borrar_zona` y `mis_zonas()`, todas `SECURITY
DEFINER` y siempre sobre el usuario actual. El tope de 3 se revisa en la
  función.
- Reutiliza `notificaciones`:
  - Ya trae `leida`, `enviada_en` y el tipo `nuevo_reporte_zona`.
  - Se agrega un índice único parcial `(usuario_id, reporte_id, tipo)`, para
    que restaurar un reporte no avise dos veces.
  - Política SELECT solo sobre los avisos propios, con permisos por columna, y
    la función `marcar_avisos_leidos(ids)`.
- Reparto de avisos:
  - Trigger `AFTER UPDATE OF moderacion ON reportes`, cuando el reporte pasa a
    `aprobado`.
  - Inserta los usuarios de
    `SELECT DISTINCT usuario_id FROM suscripciones WHERE ST_DWithin(centro, NEW.ubicacion, radio_m)`,
    sin el autor.
  - Cubre tanto la moderación manual como la publicación automática de #7.
- 1b reutiliza `dispositivos`:
  - `token_push` guarda el endpoint, y se agregan `p256dh`, `auth`,
    `fallos SMALLINT` y `ultimo_envio_en`.
  - Funciones `registrar_dispositivo` y `quitar_dispositivo`.
  - Funciones de envío según S1.

**API e interfaz**

- 1a:
  - Sección "Mis zonas" en `/perfil`, con el radio dibujado como círculo y el
    texto de consentimiento.
  - `/avisos` protegido en `proxy.ts` y contador en `menu-principal.tsx`.
  - La bandeja solo muestra avisos de reportes que siguen públicos.
- 1b:
  - `app/manifest.ts` y `public/sw.js`, este último solo con `push` y
    `notificationclick`, sin caché.
  - `POST /api/avisos/enviar`.
  - El permiso se pide solo al tocar el botón. En iOS, si la app no está
    instalada, se muestran instrucciones para agregarla a la pantalla de inicio.

**Dependencias**

- 1a: ninguna.
- 1b: `web-push`, solo en el servidor. Hace falta para la firma VAPID y el
  cifrado RFC 8291; escribir esa criptografía a mano es riesgoso.
- Variables de entorno: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_CONTACTO`, `AVISOS_CRON_SECRETO` y `AVISOS_LOTE_SECRETO`.
- `sw.js` va en la raíz con `Cache-Control: no-cache`. Antes de escribirlo hay
  que leer la guía de PWA de Next 16 en `node_modules/next/dist/docs`.

**Riesgos**

- Privacidad: la zona suele ser el domicilio de la persona.
  - Se guarda redondeada, nunca se expone a moderación ni a administración y se
    borra con la cuenta.
  - Pide un consentimiento específico, que se registra en `consentimientos`
    (fase 2).
  - La Ley 21.719 rige desde el 1 de diciembre de 2026.
  - Los endpoints de push también son datos personales.
- Abuso: solo se avisa de reportes aprobados. Máximo 3 zonas por persona, y un
  límite a la frecuencia con que se cambian.
- Límites de envío: ver S4. Si el servicio de push responde 404 o 410, se
  borra el dispositivo. Los lotes son de 50, por el tiempo máximo de Vercel. El
  push solo lleva título y enlace, nunca coordenadas.
- Falsos positivos: si un reporte se oculta después, su aviso sale de la
  bandeja, pero un push ya enviado no se puede retirar.

**Aceptación y pruebas**

- Pruebas de RLS:
  - Nadie lee zonas ajenas, y las funciones de administración no las exponen.
  - Se rechaza una cuarta zona y una zona fuera de la comuna.
  - El reparto avisa solo a las zonas que cubren el reporte, no al autor, y sin
    duplicar.
- Pruebas unitarias: esquema Zod de la zona, horario silencioso y armado del
  contenido del push.
- Prueba manual (1b): en un preview de Vercel, con Android Chrome y la app
  instalada, y con iOS 16.4 o superior agregada a la pantalla de inicio. Probar
  también el permiso denegado y la desuscripción.

**Esfuerzo:** 1a es M, unas 10 a 14 h. 1b es L, unas 18 a 24 h, incluido el
endurecimiento. Quedan para después: filtro por categoría, resumen agrupado y
avisos de obras.

## #4 Aportes moderados

**Requisito previo:** consentimiento y supresión de cuenta (fase 2, entregas
2.1 y 2.2).

**Alcance mínimo**

- Entra:
  - Cualquier persona con sesión aporta a un reporte público: un tipo
    (`sigue_igual`, `empeoro`, `arreglado`, `dato_util`) y un texto opcional de
    hasta 280 caracteres.
  - Sin texto, el aporte se publica al instante. Con texto, va a moderación,
    salvo que lo envíe un reportero de confianza (#7).
- Queda afuera: fotos, respuestas, edición, borrar el propio aporte, denuncias y
  aportes oficiales.

**Base de datos**

- Una migración sobre `comentarios`, que hoy no se usa:
  - La renombra a `reporte_aportes`.
  - Agrega el enum `tipo_aporte`, `moderacion estado_moderacion DEFAULT
'pendiente'`, `moderado_por` y `moderado_en`.
  - Deja `contenido` opcional, con un CHECK de 280 caracteres.
  - Cambia la llave foránea de `usuario_id` a **`ON DELETE CASCADE`**, para
    que la supresión de cuenta borre los aportes.
  - Agrega un índice parcial `WHERE moderacion = 'pendiente'`.
- Nueva tabla `limites_frecuencia (usuario_id, accion, ventana_inicio, cuenta)`,
  con el patrón de `reporte_votos_limite` y cascada desde `perfiles`. La
  reutilizan #6 y #1, y su limpieza va en pg_cron.
- Funciones:
  - `aportar(reporte, tipo, texto)`, `SECURITY DEFINER`. Revisa que el reporte
    sea público, que haya consentimiento vigente, el límite de 10 por hora, uno
    por persona y reporte cada 24 h, y la contención de la cola. Decide si el
    aporte se publica o queda pendiente.
  - `aportes_de_reporte(reporte)`, pública y sin `usuario_id`.
  - Para moderación: `aportes_pendientes()`, `aprobar_aporte`,
    `rechazar_aporte` y `ocultar_aporte`.

**API e interfaz**

- En `/reporte/[id]`, la sección "Novedades de vecinos": la lista, un
  formulario con `fieldset` y `legend` para elegir el tipo, y un `textarea` con
  contador. Sin sesión: "Ingresa para aportar".
- `/moderacion` pasa a tener pestañas por cola.
- Zod reutiliza `sinControles` y `textoLargo`, y además rechaza teléfonos,
  correos y RUT.

**Dependencias:** ninguna. No necesita service worker.

**Riesgos**

- Datos personales e insultos en el texto: moderación obligatoria más el filtro
  de patrones.
- Manipulación de #6: un aporte estructurado por persona y reporte, y solo se
  cuentan personas distintas.
- Carga de moderación: ver "Operación de la moderación".

**Aceptación y pruebas**

- Pruebas de RLS:
  - Anon no aporta, nadie ve aportes pendientes ni `usuario_id`.
  - Se aplican los límites.
  - Solo moderación aprueba.
  - Sin consentimiento vigente, no se puede aportar.
- Pruebas unitarias: el esquema Zod.

**Esfuerzo:** M, unas 10 a 14 h. Queda para después: avisar al autor (fase 7),
fotos y denuncias.

## #5 Detectar duplicados al reportar

**Alcance mínimo**

- 5a (fase 1):
  - En `/reportar`, al elegir ubicación y categoría aparece "¿Es alguno de
    estos?" con hasta 5 reportes públicos de la misma categoría, sin resolver y
    a menos de 75 m.
  - Botón "Es este: me afecta", que llama a `votar_reporte(1)` y abre el
    detalle.
  - Botón "Es otro problema". Nunca bloquea el envío.
- 5b (fase 3): en `/moderacion`, cada reporte pendiente muestra sus posibles
  duplicados, incluidos otros pendientes.
- Queda afuera: fusionar reportes, comparar textos y miniaturas.

**Base de datos:** no hay tablas nuevas.

- `EXPLAIN` (2026-10-28) mostró que, bajo la RLS de anon, la consulta no usa
  `idx_reportes_ubicacion`: PostGIS no es LEAKPROOF. Se decidió mantener
  `SECURITY INVOKER` y aceptar el Seq Scan en el piloto (ver
  `docs/pendientes.md`).
- `reportes_cercanos(latitud, longitud, categoria, radio_m DEFAULT 75)`:
  - `SECURITY INVOKER` sobre `v_reportes_publicos`, con el patrón de
    `reportes_en_zona`.
  - Limita el radio entre 10 y 200 m, ordena por distancia y devuelve
    `distancia_m`.
  - Se concede a anon y authenticated.
- 5b: `posibles_duplicados(reporte)`, `SECURITY DEFINER` con
  `exigir_moderador()`.

**API e interfaz**

- Componente `PosiblesDuplicados` en `formulario-reporte.tsx`: espera 400 ms
  antes de consultar, llama por RPC desde el navegador y usa
  `aria-live="polite"`.
- Radio por categoría en `lib/reportes/categorias.ts`.
- Si el reporte es propio: "Ya lo reportaste tú".

**Dependencias:** ninguna. No necesita service worker.

**Riesgos**

- El GPS del teléfono se equivoca entre 20 y 50 m.
- Falsos positivos: decide la persona.
- La ubicación consultada no se guarda ni se registra.
- Solo devuelve datos que ya son públicos.

**Aceptación y pruebas**

- Pruebas de RLS: solo reportes aprobados y públicos, de la misma categoría y
  dentro del radio; nunca pendientes; respeta el límite de radio; funciona para
  anon.
- Pruebas unitarias: radio por categoría y formato de la distancia.
- Prueba manual en el teléfono, también con teclado y lector de pantalla.

**Esfuerzo:** 5a son unas 5 a 6 h; 5b, unas 2 a 3 h.

## #6 "¿Sigue ahí?" a los 30 días

**Alcance mínimo, sin push (fase 4)**

- En el detalle de un reporte `recibido`, `en_revision` o `derivado` con más de
  30 días: "Reportado hace N días. ¿Sigue ahí?".
- Botones "Sigue igual" y "Ya lo arreglaron", que crean un aporte de #4 sin
  texto. Se muestran los totales de los últimos 30 días.
- Si al menos 3 personas distintas con cuentas de más de 7 días, o el autor,
  dicen "arreglado", y son más que "sigue igual", el reporte entra en
  "Posiblemente resueltos". **Moderación confirma el cierre.**
- Queda afuera: push al autor y a quienes votaron (fase 7, según S5), foto de
  antes y después, y cierre automático.

**Base de datos**

- Reutiliza `reporte_aportes`, con un índice `(reporte_id, tipo, creado_en)`.
- Funciones `estado_comunidad(reporte)` (pública) y
  `reportes_posiblemente_resueltos()` (moderación).
- En la fase 7: el valor `confirmar_reporte` en `tipo_notificacion`, en una
  migración propia, y una tarea diaria en pg_cron.

**API e interfaz:** el componente `SigueAhi`, una pestaña en `/moderacion` y la
función pura `debePreguntar(reporte, ahora)`.

**Dependencias:** ninguna.

**Riesgos:** falsos positivos, como un parche provisorio o un lugar
equivocado; por eso moderación confirma. Contra las cuentas falsas, la
antigüedad mínima.

**Aceptación y pruebas**

- Pruebas en SQL y RLS: umbrales, personas distintas y la ventana de 30 días.
- Prueba unitaria: `debePreguntar`.
- Prueba manual con `creado_en` cambiado a una fecha antigua sobre datos de
  prueba.

**Esfuerzo:** el mínimo son unas 6 a 9 h; la parte con push, unas 4 h más en
la fase 7.

## #7 Reporteros de confianza

**Alcance mínimo**

- Una persona es de confianza si cumple tres condiciones:
  - al menos 5 reportes aprobados por moderación;
  - ningún rechazo ni ocultamiento en los últimos 90 días;
  - una cuenta de 14 días o más.
- Sus reportes **sin fotos** y sus aportes con texto se publican solos. Los
  reportes con fotos siempre pasan por la cola.
- Lista "Publicados automáticamente (7 días)" para revisar después.
- Un rechazo u ocultamiento le quita la confianza al instante.
- Queda afuera: insignias y puntajes públicos.

**Base de datos**

- `perfiles.confianza`, enum `automatica` / `otorgada` / `revocada`, que solo
  cambia administración.
- `es_reportero_confiable(usuario)`, basada en `reporte_historial`.
- `publicar_si_confiable(reporte)`: comprueba que el reporte sea propio,
  pendiente, sin fotos y de hace menos de 10 minutos. Llama a
  `moderar_reporte(..., 'aprobar', 'Publicación automática: reportero de confianza')`
  con `cambiado_por` NULL.

**API e interfaz:** `crearReporte` la llama al final, después de las fotos. Se
agrega una pestaña de moderación y un selector en administración.

**Dependencias:** ninguna.

**Riesgos**

- Cuentas que acumulan confianza para después hacer spam: sigue el límite de 5
  reportes por hora, hay revisión posterior y la confianza se pierde al
  instante.
- Decisión automatizada (Ley 21.719): hay que explicarla en la política de
  privacidad.

**Aceptación y pruebas**

- Pruebas de RLS: con 5 aprobados se publica solo; con un rechazo, queda
  pendiente; con fotos, queda pendiente; no se puede publicar el reporte de
  otra persona; `revocada` manda.

**Esfuerzo:** unas 6 a 8 h.

## #8 Borrador sin señal

**Alcance mínimo**

- `/reportar` guarda un borrador en IndexedDB: campos, ubicación, fotos ya
  reducidas y un id generado en el navegador.
- Sin conexión: "Guardamos tu reporte en este teléfono".
- Con el evento `online`: "Enviar ahora". El envío siempre lo confirma la
  persona.
- Un borrador por usuario, que vence a los 7 días y se borra al enviarlo o al
  cerrar sesión.
- Queda afuera: abrir la app sin conexión, Background Sync y varios borradores.

**Base de datos:** sin migraciones. `crearReporte` acepta el id del cliente
(UUID validado con Zod). Si el insert da 23505 y `es_mi_reporte(id)` es
verdadero, se trata como un envío exitoso.

**API e interfaz:** `lib/borradores`, un envoltorio de IndexedDB de unas 60
líneas, más los avisos en el formulario. El borrador se vuelve a validar con
`esquemaReporte` al recuperarlo.

**Dependencias:** ninguna. No necesita service worker.

**Riesgos**

- Teléfono compartido: la llave es por usuario, el borrador vence y se borra
  al cerrar sesión.
- iOS puede borrar los datos tras 7 días sin uso.
- Sesión vencida: el borrador sobrevive al nuevo ingreso.

**Aceptación y pruebas**

- Pruebas unitarias: vencimiento, serialización y el caso de id duplicado.
- Prueba manual en modo avión, cerrando y volviendo a abrir la pestaña, y con
  la sesión vencida.

**Esfuerzo:** M, unas 8 a 12 h.

## #9 Compartir por WhatsApp con imagen

**Alcance mínimo**

- Botón "Compartir" con `navigator.share`. Si no está disponible, ofrece
  WhatsApp (`wa.me/?text=`) y "Copiar enlace".
- `app/reporte/[id]/opengraph-image.tsx` de 1200×630, con categoría, título,
  referencia, estado, "Me afecta" y la marca.
- `openGraph` en el `generateMetadata` existente.
- Queda afuera: mini mapa, fotos y compartir desde la tarjeta del mapa.

**Base de datos:** ninguna. La consulta usa `v_reportes_publicos` con la clave
anónima. Si el reporte no existe o está oculto, se entrega una imagen genérica.

**API e interfaz:** `BotonCompartir` y `metadataBase` con
`NEXT_PUBLIC_SITIO_URL`, que se agrega a `.env.example` y también usa la fase 7.

**Dependencias:** ninguna (`next/og` viene incluido).

**Riesgos:** WhatsApp y Meta guardan la vista previa, por eso nunca lleva fotos
ni autor. Para el costo de generar la imagen, encabezados de caché.

**Aceptación y pruebas**

- Prueba unitaria: `datosParaCompartir(reporte | null)`.
- Prueba manual: vista previa real en WhatsApp con un preview de Vercel, el
  Sharing Debugger de Facebook, Android y escritorio.

**Esfuerzo:** S, unas 4 a 6 h.

---

## Fase 2: consentimiento y supresión de cuenta

Antes de publicar #4 tienen que estar listas las entregas 2.1 y 2.2. Esto
cierra dos tareas de `docs/pendientes.md`: la evidencia de consentimiento
(anotada en `20261022025528_perfiles.sql`) y el derecho de supresión.

### 2.1 Evidencia de consentimiento

**Entrada que necesito de ti:** los textos de los términos y de la política de
privacidad, idealmente revisados por un abogado. La política debe mencionar la
regla de confianza (#7) y, más adelante, las zonas (#1). No voy a redactar el
texto legal.

**Base de datos**

- `documentos_legales (documento, version, vigente_desde, url)`, de lectura
  pública, con una versión vigente por documento.
- `consentimientos`:
  - Columnas `id`, `usuario_id`, `documento`, `version` y `aceptado_en`, con
    `UNIQUE (usuario_id, documento, version)`.
  - `usuario_id` va con `ON DELETE CASCADE` hacia `perfiles`.
  - Solo se agregan filas; no hay permisos para UPDATE ni DELETE.
  - La política SELECT deja ver solo los propios.
  - No se guarda la IP (minimización).
- Funciones `aceptar_documentos_vigentes()` y `tengo_consentimiento_vigente()`.
  La segunda se exige en la política de inserción de reportes (en una versión
  nueva de la política), en `aportar` y, más adelante, en `guardar_zona`.

**Interfaz**

- `/terminos`, `/privacidad` y `/aceptar`.
- `proxy.ts` y las páginas protegidas llevan a `/aceptar` a quien no haya
  aceptado la versión vigente. Esto incluye a las cuentas que ya existen.

**Pruebas:** pruebas de RLS: sin consentimiento vigente no se puede reportar ni
aportar; con una versión nueva hay que volver a aceptar.

**Esfuerzo:** unas 4 a 6 h, sin contar los textos.

### 2.2 Supresión de cuenta

**Flujo en `/perfil` → "Eliminar mi cuenta"**

1. Confirmación explícita: escribir "ELIMINAR" y haber ingresado hace menos de
   15 minutos (se revisa la marca de tiempo de `amr` del JWT). Si el ingreso es
   más antiguo, se pide un código nuevo.
2. Con la sesión del usuario, la app lista y borra sus archivos de
   `reportes-fotos/<usuario>/`. Requiere una política nueva de Storage: DELETE
   solo en la carpeta propia.
3. La función `eliminar_mi_cuenta()`, `SECURITY DEFINER`:
   - borra los aportes de la persona (y además la cascada lo garantiza);
   - borra sus reportes pendientes y las filas de `reporte_fotos` de todos sus
     reportes;
   - por último borra su fila en `auth.users`. Así caen en cascada
     `perfiles`, los votos, `suscripciones`, `dispositivos`,
     `notificaciones`, `consentimientos` y `limites_frecuencia`, y
     `reportes.usuario_id` queda en NULL.
   - Hay que verificar que el dueño de la función pueda borrar en `auth.users`
     en este proyecto. Es el patrón habitual en Supabase y evita
     `service_role`.
4. Se cierra la sesión y se muestra una confirmación.

**Notas**

- Si el paso 3 falla después del 2, la cuenta queda sin fotos y se puede
  reintentar sin dejar datos a medias.
- Los reportes publicados se conservan anonimizados y sin fotos (S8). La ruta
  de los archivos lleva el id del autor, por eso se borran.

**Pruebas:** prueba de RLS que, después de la supresión, comprueba que no queda
ninguna fila con ese id en ninguna tabla, que la carpeta de Storage está vacía y
que los reportes publicados siguen visibles con `usuario_id` NULL y sin fotos.

**Esfuerzo:** unas 8 a 12 h.

### 2.3 Aportes (#4) y operación de colas

- Aportes según la sección #4.
- Indicadores de las colas de moderación.
- `limites_frecuencia` y las primeras tareas de pg_cron.
- Paginación de `reportes_pendientes`, que hoy tiene `LIMIT 50`.

---

## Infraestructura compartida

| Pieza                                                      | Se construye en | La reutilizan                                                                           |
| ---------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------- |
| Cercanía con `ST_DWithin` (geography + GIST)               | Fase 1 (#5a)    | #5b, #1 (en sentido inverso: zonas que cubren un reporte), #6                           |
| `reporte_aportes` y `limites_frecuencia`                   | Fase 2          | #6 (respuestas), #7 (publicación automática de aportes), #1 (límite de cambios de zona) |
| `consentimientos`                                          | Fase 2          | Reportes, aportes y zonas                                                               |
| Cola de moderación con pestañas e indicadores              | Fase 2          | #5b, #6, #7                                                                             |
| pg_cron                                                    | Fase 2          | Limpiezas, envío de push y "¿Sigue ahí?"                                                |
| Reparto de avisos (trigger + `notificaciones` + `/avisos`) | Fase 6          | #6 y el aviso al autor de #4                                                            |
| Web Push (`dispositivos`, `sw.js`, manifest, envío)        | Fase 7          | #1 y #6                                                                                 |
| `NEXT_PUBLIC_SITIO_URL`                                    | Fase 1 (#9)     | Enlaces de los push                                                                     |
| Id generado en el cliente                                  | Fase 5 (#8)     | Aportes sin conexión, más adelante                                                      |

## Envío de push: endurecimiento (S1)

El envío no usa `service_role`, y la regla de ESLint que la limita a la ruta de
fotos queda igual. Hay dos secretos distintos, cada uno con un solo uso:

- **`AVISOS_CRON_SECRETO`:** pg_cron, mediante pg_net, llama a
  `POST /api/avisos/enviar`.
  - En la base vive en Supabase Vault y la tarea lo lee desde
    `vault.decrypted_secrets`. En Vercel, como variable de servidor.
  - La ruta lo compara con `crypto.timingSafeEqual` sobre los SHA-256 de ambos
    valores, para que tengan el mismo largo y la comparación tarde siempre lo
    mismo.
  - Solo acepta POST, responde `Cache-Control: no-store` y devuelve únicamente
    conteos.
- **`AVISOS_LOTE_SECRETO`:** la ruta llama a las funciones de envío con la
  clave anónima.
  - La base guarda **solo su hash** SHA-256 en `secretos_servicio (nombre,
hash, valido_hasta)`, una tabla sin permisos para anon ni authenticated.
  - La función calcula el hash de lo que recibe y lo compara con el guardado.
    Comparar hashes de largo fijo no revela el secreto por diferencias de
    tiempo.

**Funciones con el mínimo poder**

- `tomar_avisos_para_enviar(secreto, lote)`:
  - Valida el secreto y limita `lote` a 50.
  - Toma avisos con `enviada_en IS NULL`, fuera del horario silencioso y
    dentro del tope diario, usando `FOR UPDATE SKIP LOCKED`. Los marca con
    `enviada_en = now()` y devuelve el lote.
  - Devuelve solo el id del aviso, el título, la ruta relativa del enlace y los
    endpoints con `p256dh` y `auth` de ese usuario.
  - Nunca devuelve `usuario_id`, correo, zonas ni otros datos.
  - No puede hacer nada más.
- `registrar_resultado_envio(secreto, resultados)`: con el mismo control. Solo
  puede sumar `fallos` o borrar un dispositivo a partir de su endpoint, cuando
  el servicio respondió 404 o 410.
- La entrega es "como máximo una vez": un aviso marcado cuyo envío falló no se
  reintenta por push. La bandeja es la fuente de verdad.
- Ambas funciones son `SECURITY DEFINER` con `search_path = ''`, se revocan de
  `PUBLIC` y se conceden a anon.
- Un secreto incorrecto da un error genérico y suma 1 a un contador de intentos
  fallidos, sin guardar el valor.

**Nunca registrar el secreto**

- Los secretos van en el cuerpo del POST, nunca en la URL ni en GET.
- Ni la ruta ni las funciones escriben los encabezados, el cuerpo ni los
  parámetros en los registros.
- Los mensajes de error no repiten la entrada.
- Después de la primera prueba hay que confirmar en el Log Explorer de Supabase
  y en los registros de Vercel que ningún secreto aparece en ellos.

**Rotación**

- Cada 90 días, o de inmediato si se sospecha una filtración.
- `secretos_servicio` admite dos hashes vigentes, el actual y el anterior con
  `valido_hasta`:
  1. Agregar el hash nuevo.
  2. Cambiar la variable en Vercel y desplegar.
  3. Comprobar un envío.
  4. Borrar el hash anterior.
- Para `AVISOS_CRON_SECRETO`: actualizar Vault y Vercel. Durante el cambio, la
  ruta acepta temporalmente el valor actual y el anterior.
- El procedimiento queda en `.env.example` y en este documento.

## Tareas programadas (pg_cron)

pg_cron se habilita en la fase 2. Antes hay que verificar el procedimiento
vigente de Supabase. pg_cron usa UTC: 07:00 UTC equivale aproximadamente a las
04:00 en Chile, según el horario de verano.

| Tarea                                                                                                                                             | Frecuencia                          | Fase |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ---- |
| **Limpiar `limites_frecuencia`**: `DELETE ... WHERE ventana_inicio < now() - interval '1 day'`. Opcionalmente, lo mismo en `reporte_votos_limite` | Diaria, 07:00 UTC                   | 2    |
| Descartar aportes con texto pendientes por más de 14 días                                                                                         | Diaria, 07:00 UTC                   | 2    |
| Borrar avisos de más de 90 días                                                                                                                   | Diaria, 07:00 UTC                   | 6    |
| Llamar a `/api/avisos/enviar`                                                                                                                     | Cada 5 min                          | 7    |
| Crear los avisos de "¿Sigue ahí?"                                                                                                                 | Diaria, 13:00 UTC (mañana en Chile) | 7    |

Cada tarea se crea en una migración, y una prueba revisa que esté registrada en
`cron.job`.

## Operación de la moderación

**Quién modera**

- Hoy, tú, con el rol admin.
- Antes de publicar #4 debería haber al menos una persona más con el rol
  `moderador`, para cubrir ausencias. Idealmente alguien de una junta de
  vecinos, asignado por administración.
- La moderación no ve datos del autor; las funciones de moderación ya los
  omiten.

**Frecuencia y objetivos**

| Cola                                                          | Objetivo                            | Revisión                                         |
| ------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------ |
| Reportes pendientes (con posibles duplicados desde la fase 3) | Menos de 24 h                       | 2 veces al día, mañana y noche, unos 10 a 15 min |
| Aportes con texto                                             | Menos de 48 h                       | 1 vez al día                                     |
| Publicados automáticamente (#7)                               | Revisión posterior en menos de 24 h | 1 vez al día                                     |
| Posiblemente resueltos (#6)                                   | Menos de 7 días                     | Semanal                                          |

**Si se acumulan pendientes**

- **Visibilidad (fase 2):** `/moderacion` muestra, por cola, la cantidad y la
  antigüedad del más antiguo. Los moderadores ven un contador en el menú. Desde
  la fase 7, además reciben como máximo un push al día cuando se cruza un
  umbral.
- **Umbral de alerta:** cuando el reporte más antiguo tiene más de 48 h o hay
  más de 30 pendientes, "Mis reportes" avisa: "La revisión está tardando más de
  lo normal".
- **Contención automática:** con más de 100 aportes con texto pendientes,
  `aportar` acepta solo aportes sin texto y lo explica. Se reactiva cuando baja
  de 50.
- **Vencimiento:** los aportes con texto pendientes por más de 14 días se
  descartan (tarea de pg_cron).
- **Lo que nunca pasa:** los reportes no se aprueban porque la cola esté
  llena, ni vencen. Se revisan del más antiguo al más nuevo, y
  `reportes_pendientes` se pagina.
- **Si el retraso dura más de 2 semanas:** sumar un moderador o pausar los
  aportes con texto hasta ponerse al día.
- **Métrica:** tiempo mediano entre `reportes.creado_en` y la decisión
  registrada en `reporte_historial`. Se revisa en cada fase.

---

## Orden de implementación

Las métricas se miden con consultas SQL sobre tablas que ya existen y con los
registros de Vercel. No se agrega analítica ni seguimiento de usuarios. Las
metas son iniciales y se revisan en la pausa que sigue a la fase 4.

| Fase  | Contenido                                                                                    | Esfuerzo                | Depende de         | Métrica de éxito (4 semanas tras salir)                                                                                                                                                      |
| ----- | -------------------------------------------------------------------------------------------- | ----------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | #5a duplicados al reportar + #9 compartir                                                    | S+S, 10–14 h (2–3 días) | —                  | Los rechazos por duplicado por cada 100 reportes bajan al menos 50 %; al menos 20 vistas previas generadas por semana, según los registros de Vercel                                         |
| **2** | 2.1 consentimiento → 2.2 supresión → 2.3 #4 aportes + colas + `limites_frecuencia` + pg_cron | L, 24–34 h              | —                  | El 100 % de las cuentas activas tiene consentimiento vigente; la prueba de supresión deja 0 filas; al menos 1 aporte cada 10 reportes públicos; aportes moderados en menos de 48 h (mediana) |
| **3** | #7 confianza + publicados automáticamente + #5b duplicados en moderación                     | M, 8–11 h               | 2                  | Al menos 30 % de los reportes sin fotos se publican solos; menos del 5 % de ellos se oculta después; la mediana de reportes pendientes baja                                                  |
| **4** | #6 "¿Sigue ahí?" en la página + posiblemente resueltos                                       | M, 6–9 h                | 2                  | Al menos 30 % de los reportes con más de 30 días recibe una respuesta; al menos 70 % de los "posiblemente resueltos" se confirma                                                             |
| ⏸     | **Pausa de revisión**                                                                        | 1–2 semanas de uso      | 1–4                | Ver abajo                                                                                                                                                                                    |
| **5** | #8 borrador sin señal + id idempotente                                                       | M, 8–12 h               | —                  | 0 reportes duplicados por reenvío (mismo autor y título en menos de 10 min); 0 quejas de reportes perdidos                                                                                   |
| **6** | #1a zonas + reparto + `/avisos`                                                              | M, 10–14 h              | 2 (consentimiento) | Al menos 15 % de las personas activas tiene una zona; el aviso llega a la bandeja menos de 1 min después de aprobar                                                                          |
| **7** | #1b Web Push + push de #6 + endurecimiento S1                                                | L, 18–24 h              | 6, `web-push`      | Al menos 40 % de quienes tienen zona activan push; menos de 10 % de endpoints muertos al mes; menos de 5 % de desuscripciones a la semana; el 95 % de los push sale en menos de 10 min       |

Cada entrega (incluidas 2.1, 2.2 y 2.3) es su propio commit y cierra con `pnpm
lint`, `pnpm typecheck`, `pnpm test` y `pnpm test:rls`, regenerando los tipos
después de cada migración.

### Pausa de revisión después de la fase 4

Antes de empezar la fase 5 se revisa lo siguiente:

1. Las métricas de las fases 1 a 4 frente a sus metas, ajustando las metas si
   el volumen del piloto es muy bajo para medir.
2. La carga real de moderación (minutos al día y tiempo mediano) y si hace
   falta otro moderador.
3. Los comentarios de vecinos y el uso de los aportes, los duplicados y "¿Sigue
   ahí?".
4. La revisión legal de los textos y del registro de consentimiento antes de
   guardar zonas de domicilio (fase 6).
5. Una decisión explícita: seguir con 5, 6 y 7, cambiar su orden o pausar
   alguna.

## Qué NO conviene hacer todavía

- **Correo:** requiere un proveedor nuevo y SMTP propio, que sigue pendiente.
- **App completa sin conexión y Background Sync:** guardar en caché el App
  Router es frágil, y Background Sync no existe en iOS.
- **Fotos en aportes y fotos de antes y después:** el flujo de fotos todavía
  tiene pendientes.
- **Mini mapa en la imagen para compartir:** requiere una API de pago y aporta
  poco.
- **Insignias o rankings públicos de confianza:** incentivan el spam y hacen
  visible el perfilamiento.
- **Fusionar duplicados automáticamente o comparar textos:** el riesgo de
  equivocarse es alto.
- **Avisos según la ubicación actual:** su costo de privacidad es
  desproporcionado.
- **Instalar Playwright antes de las fases 5 y 7:** se propondrá ahí, donde se
  necesita para probar sin conexión y con permisos.

## Forma de trabajo

- Ninguna fase empieza sin pedirlo explícitamente.
- Cada fase se trabaja en una **rama aparte** (por ejemplo,
  `feat/fase-1-duplicados-compartir`), **sin commits a `main`**.
- Commits pequeños por entrega, en imperativo.
