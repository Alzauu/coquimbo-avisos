import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Administración de reportes: solo el rol admin lista, edita, archiva,
// restaura y elimina. Cada acción queda registrada (las eliminaciones, en
// reportes_eliminados) y las fotos de un reporte eliminado las borra el
// admin con su sesión, sin service_role. Igual que moderacion.test.ts,
// crea usuarios reales y asigna los roles con service_role.
function variable(nombre: string, archivo: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta ${nombre} en apps/web/${archivo}.`);
  return valor;
}

const url = variable("NEXT_PUBLIC_SUPABASE_URL", ".env.local");
const anonKey = variable("NEXT_PUBLIC_SUPABASE_ANON_KEY", ".env.local");
const serviceKey = variable("SUPABASE_SERVICE_ROLE_KEY", ".env.test.local");

const sinSesionPersistente = {
  auth: { persistSession: false, autoRefreshToken: false },
};
// Solo prepara datos, revisa el resultado y limpia.
const servicio = createClient(url, serviceKey, sinSesionPersistente);
const anon = createClient(url, anonKey, sinSesionPersistente);

const BUCKET = "reportes-fotos";
const LA_SERENA = 4101;
const LATITUD = -29.905;
const LONGITUD = -71.25;
const PUNTO = `SRID=4326;POINT(${LONGITUD} ${LATITUD})`;
const PERMISO_DENEGADO = "42501";
// Aparece en el título de cada reporte de este archivo: permite buscar
// solo lo creado aquí aunque la base tenga otros reportes.
const MARCA = `adm${randomUUID().slice(0, 8)}`;

type Usuario = { id: string; cliente: SupabaseClient };
type Reporte = {
  id: string;
  fotoId: number;
  ruta: string;
  huerfana: string; // archivo subido pero no registrado
};

const usuariosCreados: string[] = [];
const reportesCreados: string[] = [];
let ciudadano: Usuario;
let moderador: Usuario;
let admin: Usuario;
let categoriaId: number;
let otraCategoriaId: number;
let categoriaObraId: number;

async function crearUsuario(nombre: string): Promise<Usuario> {
  const email = `rls-${nombre}-${randomUUID()}@example.com`;
  const password = `${randomUUID()}Aa1!`;
  const { data, error } = await servicio.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`No se pudo crear el usuario de prueba: ${error?.message}`);
  }
  usuariosCreados.push(data.user.id);

  const cliente = createClient(url, anonKey, sinSesionPersistente);
  const sesion = await cliente.auth.signInWithPassword({ email, password });
  if (sesion.error) {
    throw new Error(`No se pudo iniciar sesión: ${sesion.error.message}`);
  }
  return { id: data.user.id, cliente };
}

async function asignarRol(usuario: Usuario, rol: "moderador" | "admin") {
  const { error } = await servicio
    .from("perfiles")
    .update({ rol })
    .eq("id", usuario.id);
  expect(error).toBeNull();
}

// Reporte del ciudadano con una foto registrada y otro archivo sin
// registrar en su carpeta. Se crea con service_role (sin límite de
// frecuencia), como en moderacion.test.ts.
async function crearReporte(
  moderacion: "pendiente" | "aprobado" = "aprobado",
  titulo = `Reporte ${MARCA} de administración`,
): Promise<Reporte> {
  const id = randomUUID();
  reportesCreados.push(id);
  const reporte = await servicio.from("reportes").insert({
    id,
    usuario_id: ciudadano.id,
    categoria_id: categoriaId,
    comuna_id: LA_SERENA,
    titulo,
    descripcion: "Creado por test:rls; se borra al terminar.",
    direccion_referencia: "Frente a la plaza",
    ubicacion: PUNTO,
    moderacion,
  });
  expect(reporte.error).toBeNull();

  const ruta = `${ciudadano.id}/${id}/${randomUUID()}.webp`;
  const huerfana = `${ciudadano.id}/${id}/${randomUUID()}.webp`;
  for (const archivo of [ruta, huerfana]) {
    const subida = await servicio.storage
      .from(BUCKET)
      .upload(archivo, Buffer.alloc(1024), { contentType: "image/webp" });
    expect(subida.error).toBeNull();
  }
  const { data: foto, error } = await servicio
    .from("reporte_fotos")
    .insert({ reporte_id: id, ruta, orden: 1 })
    .select("id")
    .single();
  expect(error).toBeNull();
  return { id, fotoId: foto!.id, ruta, huerfana };
}

async function filaDe(reporteId: string) {
  const { data } = await servicio
    .from("reportes")
    .select(
      "titulo, descripcion, direccion_referencia, categoria_id, estado, moderacion, resuelto_en, actualizado_en",
    )
    .eq("id", reporteId)
    .maybeSingle();
  return data;
}

async function historialDe(reporteId: string) {
  const { data } = await servicio
    .from("reporte_historial")
    .select(
      "accion, estado_anterior, estado_nuevo, moderacion_anterior, moderacion_nueva, cambiado_por, nota, cambios",
    )
    .eq("reporte_id", reporteId)
    .order("id");
  return data ?? [];
}

async function archivosDe(reporteId: string) {
  const carpeta = `${ciudadano.id}/${reporteId}`;
  const { data } = await servicio.storage.from(BUCKET).list(carpeta);
  return (data ?? []).map((archivo) => `${carpeta}/${archivo.name}`).sort();
}

async function esPublico(reporteId: string) {
  const { data } = await anon
    .from("v_reportes_publicos")
    .select("id")
    .eq("id", reporteId);
  return (data ?? []).length === 1;
}

async function obtener(reporteId: string) {
  const { data, error } = await admin.cliente
    .rpc("obtener_reporte_admin", { reporte: reporteId })
    .single();
  expect(error).toBeNull();
  return data as {
    titulo: string;
    descripcion: string | null;
    direccion_referencia: string | null;
    categoria_id: number;
    estado: string;
    actualizado_en: string;
    latitud: number;
    longitud: number;
  };
}

// Argumentos de editar_reporte que dejan el reporte como está.
async function edicionSinCambios(reporteId: string) {
  const actual = await obtener(reporteId);
  return {
    reporte: reporteId,
    version: actual.actualizado_en,
    nuevo_titulo: actual.titulo,
    nueva_descripcion: actual.descripcion,
    nueva_categoria: actual.categoria_id,
    nueva_referencia: actual.direccion_referencia,
    nueva_latitud: actual.latitud,
    nueva_longitud: actual.longitud,
    nuevo_estado: actual.estado,
  };
}

// Todas las funciones de administración, con argumentos válidos.
const llamadas = (reporte: Reporte) =>
  [
    ["listar_reportes_admin", {}],
    ["obtener_reporte_admin", { reporte: reporte.id }],
    [
      "editar_reporte",
      {
        reporte: reporte.id,
        version: new Date().toISOString(),
        nuevo_titulo: "Título cambiado sin permiso",
        nueva_descripcion: null,
        nueva_categoria: categoriaId,
        nueva_referencia: null,
        nueva_latitud: LATITUD,
        nueva_longitud: LONGITUD,
        nuevo_estado: "resuelto",
      },
    ],
    ["archivar_reporte", { reporte: reporte.id }],
    ["restaurar_reporte", { reporte: reporte.id }],
    ["eliminar_reporte", { reporte: reporte.id, motivo: "Motivo de prueba" }],
  ] as const;

// Borra solo lo creado aquí y siempre borra los usuarios, aunque falle
// lo demás.
async function limpiar() {
  const errores: string[] = [];
  try {
    if (reportesCreados.length > 0) {
      const reportes = await servicio
        .from("reportes")
        .delete()
        .in("id", reportesCreados);
      if (reportes.error) errores.push(`reportes: ${reportes.error.message}`);
      const eliminados = await servicio
        .from("reportes_eliminados")
        .delete()
        .in("reporte_id", reportesCreados);
      if (eliminados.error) {
        errores.push(`reportes_eliminados: ${eliminados.error.message}`);
      }
    }
    for (const usuarioId of usuariosCreados) {
      const carpetas = await servicio.storage.from(BUCKET).list(usuarioId);
      for (const carpeta of carpetas.data ?? []) {
        const prefijo = `${usuarioId}/${carpeta.name}`;
        const archivos = await servicio.storage.from(BUCKET).list(prefijo);
        const rutas = (archivos.data ?? []).map((f) => `${prefijo}/${f.name}`);
        if (rutas.length === 0) continue;
        const borrado = await servicio.storage.from(BUCKET).remove(rutas);
        if (borrado.error) errores.push(`fotos: ${borrado.error.message}`);
      }
    }
  } finally {
    for (const usuarioId of usuariosCreados) {
      const usuario = await servicio.auth.admin.deleteUser(usuarioId);
      if (usuario.error) errores.push(`usuario: ${usuario.error.message}`);
    }
  }
  if (errores.length > 0) {
    throw new Error(`Limpieza incompleta de test:rls: ${errores.join("; ")}`);
  }
}

beforeAll(async () => {
  const { data: categorias } = await anon
    .from("categorias")
    .select("id, tipo, codigo")
    .eq("activa", true)
    .order("id");
  const deReporte = (categorias ?? []).filter((c) => c.tipo === "reporte");
  categoriaId = deReporte.find((c) => c.codigo === "bache")!.id;
  otraCategoriaId = deReporte.find((c) => c.id !== categoriaId)!.id;
  categoriaObraId = (categorias ?? []).find((c) => c.tipo === "obra")!.id;

  [ciudadano, moderador, admin] = await Promise.all([
    crearUsuario("ciudadano"),
    crearUsuario("moderador"),
    crearUsuario("admin"),
  ]);
  await asignarRol(moderador, "moderador");
  await asignarRol(admin, "admin");
});

afterAll(limpiar);

describe("sin rol de admin", () => {
  let reporte: Reporte;
  beforeAll(async () => {
    reporte = await crearReporte();
  });

  it("anon, un ciudadano y un moderador no pueden ejecutar ninguna función", async () => {
    for (const cliente of [anon, ciudadano.cliente, moderador.cliente]) {
      for (const [funcion, argumentos] of llamadas(reporte)) {
        const { error } = await cliente.rpc(funcion, argumentos);
        expect(error?.code, funcion).toBe(PERMISO_DENEGADO);
      }
    }
    expect(await filaDe(reporte.id)).toMatchObject({
      titulo: `Reporte ${MARCA} de administración`,
      moderacion: "aprobado",
      estado: "recibido",
    });
    expect(await historialDe(reporte.id)).toEqual([]);
  });

  it("es_admin responde false a un moderador y a un ciudadano", async () => {
    for (const cliente of [moderador.cliente, ciudadano.cliente]) {
      const { data } = await cliente.rpc("es_admin");
      expect(data).toBe(false);
    }
  });

  it("nadie puede llamar a las funciones internas", async () => {
    for (const cliente of [ciudadano.cliente, admin.cliente]) {
      const exigir = await cliente.rpc("exigir_admin");
      const ubicacion = await cliente.rpc("ubicacion_en_comuna", {
        comuna: LA_SERENA,
        punto: PUNTO,
      });
      expect(exigir.error).not.toBeNull();
      expect(ubicacion.error).not.toBeNull();
    }
  });

  it("nadie, ni un admin, edita ni borra reportes directamente ni lee las eliminaciones", async () => {
    for (const cliente of [
      ciudadano.cliente,
      moderador.cliente,
      admin.cliente,
    ]) {
      const edicion = await cliente
        .from("reportes")
        .update({ titulo: "Cambio directo" })
        .eq("id", reporte.id);
      const borrado = await cliente
        .from("reportes")
        .delete()
        .eq("id", reporte.id);
      const eliminados = await cliente.from("reportes_eliminados").select("id");
      expect(edicion.error?.code).toBe(PERMISO_DENEGADO);
      expect(borrado.error?.code).toBe(PERMISO_DENEGADO);
      expect(eliminados.error?.code).toBe(PERMISO_DENEGADO);
    }
    expect(await filaDe(reporte.id)).not.toBeNull();
  });
});

describe("como admin: listar", () => {
  it("es_admin responde true", async () => {
    const { data } = await admin.cliente.rpc("es_admin");
    expect(data).toBe(true);
  });

  it("lista todos los estados de moderación, busca y filtra, sin datos del autor", async () => {
    const pendiente = await crearReporte("pendiente");
    const aprobado = await crearReporte("aprobado");
    const archivado = await crearReporte("aprobado");
    await admin.cliente.rpc("archivar_reporte", { reporte: archivado.id });

    const ids = async (argumentos: Record<string, unknown>) => {
      const { data, error } = await admin.cliente.rpc("listar_reportes_admin", {
        busqueda: MARCA,
        ...argumentos,
      });
      expect(error).toBeNull();
      return (data ?? []) as { id: string; total: number; fotos: number }[];
    };

    const porDefecto = await ids({});
    const idsPorDefecto = porDefecto.map((r) => r.id);
    expect(idsPorDefecto).toContain(pendiente.id);
    expect(idsPorDefecto).toContain(aprobado.id);
    // Sin filtro de moderación, los archivados no aparecen.
    expect(idsPorDefecto).not.toContain(archivado.id);
    expect(porDefecto[0]).not.toHaveProperty("usuario_id");
    expect(porDefecto[0]?.total).toBe(porDefecto.length);
    expect(porDefecto.find((r) => r.id === aprobado.id)?.fotos).toBe(1);

    const soloArchivados = await ids({ moderaciones: ["archivado"] });
    expect(soloArchivados.map((r) => r.id)).toEqual([archivado.id]);
    const soloPendientes = await ids({ moderaciones: ["pendiente"] });
    expect(soloPendientes.map((r) => r.id)).toContain(pendiente.id);
    expect(soloPendientes.map((r) => r.id)).not.toContain(aprobado.id);

    // La búsqueda no distingue mayúsculas.
    expect((await ids({ busqueda: MARCA.toUpperCase() })).length).toBe(
      porDefecto.length,
    );
    expect(await ids({ estados: ["resuelto"] })).toEqual([]);
    expect(await ids({ categoria: otraCategoriaId })).toEqual([]);
    expect(await ids({ pagina: 2 })).toEqual([]);
  });

  it("rechaza una página o una búsqueda no válidas", async () => {
    const pagina = await admin.cliente.rpc("listar_reportes_admin", {
      pagina: 0,
    });
    const busqueda = await admin.cliente.rpc("listar_reportes_admin", {
      busqueda: "x".repeat(101),
    });
    expect(pagina.error?.hint).toBe("pagina_invalida");
    expect(busqueda.error?.hint).toBe("busqueda_invalida");
  });
});

describe("como admin: editar", () => {
  it("edita y registra qué cambió, sin guardar los textos", async () => {
    const reporte = await crearReporte();
    const base = await edicionSinCambios(reporte.id);
    const { error } = await admin.cliente.rpc("editar_reporte", {
      ...base,
      nuevo_titulo: "  Título corregido por administración  ",
      nueva_descripcion: "Descripción nueva con un dato que no debe quedar",
      nueva_categoria: otraCategoriaId,
      nueva_referencia: "",
      nueva_latitud: -29.91,
      nueva_longitud: -71.26,
      nuevo_estado: "resuelto",
    });
    expect(error).toBeNull();

    expect(await filaDe(reporte.id)).toMatchObject({
      titulo: "Título corregido por administración",
      descripcion: "Descripción nueva con un dato que no debe quedar",
      direccion_referencia: null,
      categoria_id: otraCategoriaId,
      estado: "resuelto",
      moderacion: "aprobado",
    });
    expect((await filaDe(reporte.id))?.resuelto_en).not.toBeNull();

    const historial = await historialDe(reporte.id);
    expect(historial).toHaveLength(1);
    const [fila] = historial;
    expect(fila).toMatchObject({
      accion: "editar",
      estado_anterior: "recibido",
      estado_nuevo: "resuelto",
      moderacion_anterior: "aprobado",
      moderacion_nueva: "aprobado",
      cambiado_por: admin.id,
      nota: null,
    });
    expect(fila?.cambios).toMatchObject({
      titulo: true,
      descripcion: true,
      direccion_referencia: true,
      categoria_id: { antes: categoriaId, despues: otraCategoriaId },
      estado: { antes: "recibido", despues: "resuelto" },
      ubicacion: {
        despues: { lat: -29.91, lng: -71.26 },
      },
    });
    expect(fila?.cambios.ubicacion.antes.lat).toBeCloseTo(LATITUD, 6);
    expect(fila?.cambios.ubicacion.antes.lng).toBeCloseTo(LONGITUD, 6);
    // Ni el texto anterior ni el nuevo quedan en el historial.
    const texto = JSON.stringify(fila);
    for (const fragmento of ["corregido", "dato que no", "plaza", MARCA]) {
      expect(texto).not.toContain(fragmento);
    }
  });

  it("sin cambios no registra nada", async () => {
    const reporte = await crearReporte();
    const { error } = await admin.cliente.rpc(
      "editar_reporte",
      await edicionSinCambios(reporte.id),
    );
    expect(error).toBeNull();
    expect(await historialDe(reporte.id)).toEqual([]);
  });

  it("valida en la base: título, estado, categoría y ubicación", async () => {
    const reporte = await crearReporte();
    const base = await edicionSinCambios(reporte.id);
    const casos = [
      [{ nuevo_titulo: "abc" }, "titulo_invalido"],
      [{ nueva_descripcion: "x".repeat(1001) }, "descripcion_invalida"],
      [{ nueva_referencia: "x".repeat(201) }, "referencia_invalida"],
      [{ nuevo_estado: "rechazado" }, "estado_invalido"],
      [{ nueva_categoria: categoriaObraId }, "categoria_invalida"],
      // Santiago: fuera del rectángulo de La Serena.
      [{ nueva_latitud: -33.45, nueva_longitud: -70.66 }, "fuera_de_comuna"],
      [{ nueva_latitud: 95 }, "fuera_de_comuna"],
    ] as const;
    for (const [cambio, hint] of casos) {
      const { error } = await admin.cliente.rpc("editar_reporte", {
        ...base,
        ...cambio,
      });
      expect(error?.hint, hint).toBe(hint);
    }
    expect(await historialDe(reporte.id)).toEqual([]);
  });

  it("no pisa cambios hechos después de cargar el formulario", async () => {
    const reporte = await crearReporte();
    const base = await edicionSinCambios(reporte.id);
    // Otro admin (o moderación) cambia el reporte entretanto.
    await moderador.cliente.rpc("cambiar_estado_reporte", {
      reporte: reporte.id,
      nuevo: "en_revision",
    });
    const { error } = await admin.cliente.rpc("editar_reporte", {
      ...base,
      nuevo_titulo: "Título que llega tarde",
    });
    expect(error?.hint).toBe("modificado");
    expect((await filaDe(reporte.id))?.titulo).not.toBe(
      "Título que llega tarde",
    );
  });
});

describe("como admin: archivar y restaurar", () => {
  it("archivar retira un reporte publicado y restaurar lo devuelve", async () => {
    const reporte = await crearReporte("aprobado");
    expect(await esPublico(reporte.id)).toBe(true);

    const archivo = await admin.cliente.rpc("archivar_reporte", {
      reporte: reporte.id,
    });
    expect(archivo.error).toBeNull();
    expect(await esPublico(reporte.id)).toBe(false);
    const ruta = await servicio.rpc("ruta_foto_publica", {
      foto: reporte.fotoId,
    });
    expect(ruta.data).toBeNull();

    const otraVez = await admin.cliente.rpc("archivar_reporte", {
      reporte: reporte.id,
    });
    expect(otraVez.error?.hint).toBe("ya_archivado");

    const restauracion = await admin.cliente.rpc("restaurar_reporte", {
      reporte: reporte.id,
    });
    expect(restauracion.error).toBeNull();
    expect((await filaDe(reporte.id))?.moderacion).toBe("aprobado");
    expect(await esPublico(reporte.id)).toBe(true);

    const sinArchivar = await admin.cliente.rpc("restaurar_reporte", {
      reporte: reporte.id,
    });
    expect(sinArchivar.error?.hint).toBe("no_archivado");

    expect(await historialDe(reporte.id)).toMatchObject([
      {
        accion: "archivar",
        moderacion_anterior: "aprobado",
        moderacion_nueva: "archivado",
        cambiado_por: admin.id,
      },
      {
        accion: "restaurar",
        moderacion_anterior: "archivado",
        moderacion_nueva: "aprobado",
        cambiado_por: admin.id,
      },
    ]);
  });

  it("un pendiente archivado vuelve a pendiente y no a publicado", async () => {
    const reporte = await crearReporte("pendiente");
    await admin.cliente.rpc("archivar_reporte", { reporte: reporte.id });
    const { data: pendientes } = await moderador.cliente.rpc(
      "reportes_pendientes",
    );
    expect(pendientes?.map((r: { id: string }) => r.id)).not.toContain(
      reporte.id,
    );

    await admin.cliente.rpc("restaurar_reporte", { reporte: reporte.id });
    expect((await filaDe(reporte.id))?.moderacion).toBe("pendiente");
    expect(await esPublico(reporte.id)).toBe(false);
  });

  it("el autor ve su reporte archivado en Mis reportes", async () => {
    const reporte = await crearReporte("aprobado");
    await admin.cliente.rpc("archivar_reporte", { reporte: reporte.id });
    const { data } = await ciudadano.cliente.rpc("mis_reportes");
    const propio = data?.find((r: { id: string }) => r.id === reporte.id);
    expect(propio?.moderacion).toBe("archivado");
  });
});

describe("como admin: eliminar", () => {
  it("exige un motivo de 5 a 500 caracteres", async () => {
    const reporte = await crearReporte();
    for (const motivo of ["", "   ", "abcd", "x".repeat(501)]) {
      const { error } = await admin.cliente.rpc("eliminar_reporte", {
        reporte: reporte.id,
        motivo,
      });
      expect(error?.hint).toBe("motivo_invalido");
    }
    expect(await filaDe(reporte.id)).not.toBeNull();
  });

  it("borra el reporte y sus filas, y deja un registro sin contenido", async () => {
    const reporte = await crearReporte("aprobado");
    await admin.cliente.rpc("archivar_reporte", { reporte: reporte.id });

    const { data: rutas, error } = await admin.cliente.rpc("eliminar_reporte", {
      reporte: reporte.id,
      motivo: "  Duplicado de otro reporte.  ",
    });
    expect(error).toBeNull();
    // Devuelve también el archivo que no llegó a registrarse.
    expect([...(rutas as string[])].sort()).toEqual(
      [reporte.ruta, reporte.huerfana].sort(),
    );

    expect(await filaDe(reporte.id)).toBeNull();
    expect(await historialDe(reporte.id)).toEqual([]);
    const fotos = await servicio
      .from("reporte_fotos")
      .select("id")
      .eq("reporte_id", reporte.id);
    expect(fotos.data).toEqual([]);

    const { data: registro } = await servicio
      .from("reportes_eliminados")
      .select("*")
      .eq("reporte_id", reporte.id)
      .single();
    expect(registro).toMatchObject({
      reporte_id: reporte.id,
      eliminado_por: admin.id,
      motivo: "Duplicado de otro reporte.",
      categoria_id: categoriaId,
      comuna_id: LA_SERENA,
      moderacion: "archivado",
      estado: "recibido",
      fotos: 1,
      archivos: 2,
      filas_historial: 1,
    });
    // Sin título, descripción, referencia, ubicación, autor ni rutas.
    const texto = JSON.stringify(registro);
    for (const fragmento of [MARCA, "Creado por", "plaza", ciudadano.id]) {
      expect(texto).not.toContain(fragmento);
    }
    for (const columna of [
      "titulo",
      "descripcion",
      "ubicacion",
      "usuario_id",
    ]) {
      expect(registro).not.toHaveProperty(columna);
    }

    const otraVez = await admin.cliente.rpc("eliminar_reporte", {
      reporte: reporte.id,
      motivo: "Motivo de prueba",
    });
    expect(otraVez.error?.hint).toBe("no_existe");
  });

  it("solo un admin borra archivos, y solo de reportes ya eliminados", async () => {
    const reporte = await crearReporte();
    const archivos = [reporte.ruta, reporte.huerfana].sort();

    // Reporte vigente: ni el admin puede borrar sus archivos.
    await admin.cliente.storage.from(BUCKET).remove(archivos);
    expect(await archivosDe(reporte.id)).toEqual(archivos);

    await admin.cliente.rpc("eliminar_reporte", {
      reporte: reporte.id,
      motivo: "Prueba de borrado de archivos",
    });

    // Ya eliminado: el autor y un moderador siguen sin poder borrarlos.
    for (const cliente of [ciudadano.cliente, moderador.cliente]) {
      await cliente.storage.from(BUCKET).remove(archivos);
      expect(await archivosDe(reporte.id)).toEqual(archivos);
    }

    const { data, error } = await admin.cliente.storage
      .from(BUCKET)
      .remove(archivos);
    expect(error).toBeNull();
    // La app compara estos nombres con las rutas para saber qué faltó.
    expect(data?.map((archivo) => archivo.name).sort()).toEqual(archivos);
    expect(await archivosDe(reporte.id)).toEqual([]);
  });
});
